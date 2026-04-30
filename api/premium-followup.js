// api/premium-followup.js
// Day 7 follow-up question — included in Premium tier
// POST /api/premium-followup
// Body: { token, question, applied_joa_title? }
// Returns: { success: true, answer_markdown }
//
// One follow-up question is included per Premium purchase.
// After that, returns a gentle upsell prompt.

const { createClient } = require('@redis/client') || require('redis');
const { Resend } = require('resend');
const { TITLE_38_KB } = require('./_va-kb');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const VA_BASE_URL = process.env.VA_BASE_URL || 'https://va.landedd.com';

let redisClient = null;
let resendClient = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
  }
  return redisClient;
}

function getResend() {
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

// ─── Run follow-up synthesis (Haiku — cost efficient for short Q&A) ──────────

async function runFollowup(question, deliverable, appliedJoaTitle) {
  const contextSummary = `
The customer previously received a Premium VA application analysis.
Their credential level: ${deliverable.credential_level}
Their JOAs: ${(deliverable.joa_titles || []).join(', ')}
Analysis was generated: ${deliverable.created_at}
${appliedJoaTitle ? `They applied to: ${appliedJoaTitle}` : ''}
`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `You are Landedd VA's federal hiring expert. A customer has applied to a VA position
after using the Premium analysis service. They have one follow-up question included in their purchase.

Answer their question specifically, drawing on the Title 38 KB and their context.
Be concise but thorough — 200-500 words. Use headers if the answer has multiple parts.
Tone: confident, specific, empowering. You are on their side.

CONSTRAINTS:
- No essay question content (Constitution, Government Efficiency, etc.)
- No USA Hire coaching
- No SF-86 guidance
- No fabricated information

Title 38 Knowledge Base reference:
${TITLE_38_KB}

Customer context:
${contextSummary}`,
      messages: [{ role: 'user', content: question }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, question, applied_joa_title } = req.body || {};

  if (!token || token.length < 32) {
    return res.status(400).json({ error: 'Invalid token.' });
  }
  if (!question || question.trim().length < 10) {
    return res.status(400).json({ error: 'Please enter a question (at least 10 characters).' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ error: 'Question is too long. Please keep it under 1,000 characters.' });
  }

  try {
    const redis = await getRedis();

    // Resolve token → intake ID
    const tokenData = await redis.get(`premium:token:${token}`);
    if (!tokenData) {
      return res.status(404).json({ error: 'Invalid or expired token.' });
    }
    const { intake_id } = JSON.parse(tokenData);

    // Check follow-up quota (1 per Premium purchase)
    const followupKey = `premium:followup_used:${intake_id}`;
    const followupUsed = await redis.get(followupKey);

    if (followupUsed) {
      // Return a gentle upsell — one follow-up has been used
      return res.status(200).json({
        success: false,
        quota_exceeded: true,
        message: `Your one included follow-up question has been used. For additional guidance, you can purchase another Premium analysis for a new role, or email us at hello@landedd.com.`,
      });
    }

    // Load deliverable context
    const deliverableRaw = await redis.get(`premium:deliverable:${intake_id}`);
    if (!deliverableRaw) {
      return res.status(404).json({ error: 'Analysis data not found.' });
    }
    const deliverable = JSON.parse(deliverableRaw);

    // Run follow-up synthesis
    let answerMarkdown;
    try {
      answerMarkdown = await runFollowup(question, deliverable, applied_joa_title);
    } catch (synthErr) {
      console.error('Follow-up synthesis failed:', synthErr.message);
      return res.status(500).json({
        error: 'Failed to generate response. Please try again or email hello@landedd.com.',
      });
    }

    // Mark follow-up as used (90 days)
    await redis.setEx(followupKey, 7776000, JSON.stringify({
      used_at: new Date().toISOString(),
      question: question.substring(0, 200), // Store truncated for logging
    }));

    // Store follow-up answer in Redis for reference
    await redis.setEx(
      `premium:followup_answer:${intake_id}`,
      7776000,
      JSON.stringify({
        question,
        answer: answerMarkdown,
        applied_joa_title,
        created_at: new Date().toISOString(),
      })
    );

    // Send follow-up answer via email too
    try {
      const resend = getResend();
      const viewUrl = `${VA_BASE_URL}/premium/view?token=${token}`;

      await resend.emails.send({
        from: 'Landedd VA <hello@landedd.com>',
        to: deliverable.email,
        subject: 'Your VA Follow-Up Question — Answer Inside',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">
  <span style="font-size:20px;font-weight:700;color:#2d6a4f;">Landedd VA</span>
  <h2 style="margin:24px 0 8px;">Your Follow-Up Question</h2>
  <p style="background:#f4f4f4;padding:16px;border-radius:8px;font-style:italic;color:#4a4a4a;margin:0 0 24px;">"${question}"</p>
  <h2 style="margin:0 0 16px;">Answer</h2>
  <div style="line-height:1.7;color:#1a1a1a;">
    <pre style="white-space:pre-wrap;font-family:inherit;">${answerMarkdown}</pre>
  </div>
  <hr style="border:none;border-top:1px solid #e8e8e8;margin:32px 0;">
  <p style="font-size:12px;color:#aaaaaa;">
    Landedd VA · <a href="${viewUrl}" style="color:#aaaaaa;">View your full analysis</a>
    · Questions? <a href="mailto:hello@landedd.com" style="color:#aaaaaa;">hello@landedd.com</a>
  </p>
</body>
</html>
`,
      });
    } catch (emailErr) {
      console.error('Follow-up email failed (non-fatal):', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      answer_markdown: answerMarkdown,
    });
  } catch (err) {
    console.error('Follow-up handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
