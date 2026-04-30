// api/premium-intake.js  v2
// POST /api/premium-intake
// Pipeline: Validate → Verify payment → Store → SEND PROCESSING EMAIL → Synthesize → Store → Send delivery email → Return
// maxDuration: 300 (Vercel Pro required)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@redis/client') || require('redis');
const { Resend } = require('resend');
const crypto = require('crypto');
const { TITLE_38_KB } = require('./_va-kb');
const { processingEmail, deliveryEmail, failureAlertEmail, extractExecSummary } = require('./_brand');

const VA_BASE_URL = process.env.VA_BASE_URL || 'https://va.landedd.com';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// maxDuration set via vercel.json — do not use ES module export here

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
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function validateIntake(body) {
  const required = ['session_id', 'email', 'credential_level', 'years_experience', 'practice_setting', 'resume_text'];
  const missing = required.filter((f) => !body[f] || String(body[f]).trim() === '');
  if (missing.length) return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  if (!body.joas?.length) return { valid: false, error: 'At least one JOA is required.' };
  if (body.joas.length > 3) return { valid: false, error: 'Maximum 3 JOAs per analysis.' };
  for (const j of body.joas) if (!j.title || !j.text) return { valid: false, error: 'Each JOA needs a title and full text.' };
  const yrs = parseInt(body.years_experience, 10);
  if (isNaN(yrs) || yrs < 0 || yrs > 60) return { valid: false, error: 'Years of experience must be 0–60.' };
  return { valid: true };
}

function buildSynthesisMessage(intake) {
  const { credential_level, licenses='Not provided', certifications='Not provided', years_experience,
    practice_setting, ehr_systems='Not provided', leadership_scholarly='Not provided',
    geographic_pref='Not specified', career_goal='Not specified', fed_history='No prior federal employment',
    resume_text, joas } = intake;

  return `# Title 38 Knowledge Base\n${TITLE_38_KB}\n\n---\n\n# Applicant Intake
**Credential level:** ${credential_level}
**Licenses:** ${licenses}
**Certifications:** ${certifications}
**Years experience:** ${years_experience}
**Practice setting:** ${practice_setting}
**EHR systems:** ${ehr_systems}
**Leadership / scholarly:** ${leadership_scholarly}
**Geographic preference:** ${geographic_pref}
**Career goal:** ${career_goal}
**Federal history:** ${fed_history}

**Resume:**
${resume_text}

---
# Target JOAs
${joas.map((j, i) => `## JOA ${i+1}: ${j.title}\nURL: ${j.url||'N/A'} | Announcement: ${j.announcement_number||'N/A'}\n${j.text}`).join('\n---\n')}

---
# Generate Premium Deliverable

Produce a complete Premium VA application strategy with these sections in order:

## 1. Executive Summary
3-5 sentences speaking directly to the applicant. Name the highest-priority JOA and why. State the predicted outcome with specificity (e.g., grade level, VAMC, experience match %).

## 2. JOA Tier Classification
Table: Pure Title 38 / Hybrid Title 38 / Title 5 for each JOA, with applicable rules (2-page rule, essays, review body).

## 3. NPSB Grade Prediction (nursing) / Grade Analysis (all others)
Nursing: Score all 3 NPSB dimensions (Education 0-30, Practice 0-40, Performance 0-30). Rationale per dimension. Predicted grade. What is needed for next level.
Non-nursing: Parallel GS grade analysis for their occupation series.

## 4. Specialized Experience Match Analysis
For each JOA: extract Specialized Experience paragraph verbatim. Score match 0-100%. List top 5 missing/weak terms with honest incorporation suggestions.

## 5. Application Priority Ranking
Table: rank 1-3 JOAs with referral probability, time to fill, DHA status, rationale, recommended apply-by date.

## 6. Tailored Resume — Top Priority JOA
Complete federal-format resume tailored to the highest-priority JOA. Mirror specialized experience language where the applicant's actual experience supports it. Mark gaps as [APPLICANT TO PROVIDE: detail needed]. Apply correct length (Pure 38 = comprehensive, Hybrid/Title 5 = ruthless priority).

## 7. Self-Assessment Questionnaire Strategy
Anticipated question types for the top JOA. Address the deflation problem. Rating criteria per level (Expert through None) for each type. Worked example using this applicant's actual experience.

## 8. Cover Letter Template
3 paragraphs, 200-350 words. Para 1: what draws you to this specific VAMC. Para 2: strongest 2-3 specialized experience matches with evidence. Para 3: mission alignment.

## 9. 90-Day Application Plan
Week-by-week: 1-2, 3-6, 7-9, 10-13. Customized to their geographic preferences and career goals. Specific search criteria for similar JOAs.

## 10. Watch-outs & Final Checklist
5-10 specific items to double-check before submitting, drawn from this applicant's intake and Title 38 rejection patterns. End with one confidence statement.

CONSTRAINTS: Plain markdown. No XML tags. 2,500-5,000 words. All recommendations trace to intake or KB. Never fabricate. Never write essay question content.`;
}

function extractExecSummary(markdown) {
  const match = markdown.match(/## 1\. Executive Summary\s*\n+([\s\S]+?)(?=\n## )/);
  if (!match) return null;
  const text = match[1].trim().replace(/\*\*/g, '').replace(/\n+/g, ' ');
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 2).join(' ').trim() || null;
}

async function runSynthesis(intake) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: `You are Landedd VA's federal hiring expert AI. Generate strategic VA application plans for civilian healthcare professionals.
NEVER: write essay question content, fabricate any clinical data, coach USA Hire assessments, discuss SF-86/clearances, provide political commentary.
TONE: Confident, specific, empowering. Translation not critique. Surface evidence reviewers can credit.`,
      messages: [{ role: 'user', content: buildSynthesisMessage(intake) }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.content?.[0];
  if (!content || content.type !== 'text') throw new Error('Unexpected Claude API response');
  return { markdown: content.text, input_tokens: data.usage?.input_tokens||0, output_tokens: data.usage?.output_tokens||0 };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  const body = req.body || {};

  const validation = validateIntake(body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const { session_id, email } = body;

  // Verify Stripe
  let stripeSession;
  try { stripeSession = await stripe.checkout.sessions.retrieve(session_id); }
  catch { return res.status(400).json({ error: 'Invalid payment session. Contact hello@landedd.com.' }); }
  if (stripeSession.payment_status !== 'paid')
    return res.status(402).json({ error: 'Payment not confirmed. Complete checkout first.' });

  const deliveryAddr = email || stripeSession.customer_details?.email;
  const joaTitles = body.joas.map((j) => j.title);

  // Check duplicate
  try {
    const redis = await getRedis();
    const existing = await redis.get(`premium:submitted:${session_id}`);
    if (existing) {
      const d = JSON.parse(existing);
      return res.status(200).json({ success: true, already_submitted: true, view_token: d.view_token });
    }
  } catch (e) { console.error('Redis dupe check:', e.message); }

  // Generate IDs
  const intakeId = crypto.randomUUID();
  const viewToken = crypto.randomBytes(32).toString('hex');
  const viewUrl = `${VA_BASE_URL}/premium/view?token=${viewToken}`;

  // Store intake
  const intakeData = {
    id: intakeId, session_id, email: deliveryAddr, created_at: new Date().toISOString(),
    status: 'processing', credential_level: body.credential_level,
    years_experience: body.years_experience, practice_setting: body.practice_setting,
    joas: body.joas.map((j) => ({ title: j.title, url: j.url })),
  };
  try { const r = await getRedis(); await r.setEx(`premium:intake:${intakeId}`, 7776000, JSON.stringify(intakeData)); }
  catch (e) { console.error('Redis intake store:', e.message); }

  // ── CRITICAL FIX: Send processing email BEFORE synthesis ────────────────────
  // Customer can safely close their browser — analysis link arrives by email
  try {
    const resend = getResend();
    const pe = processingEmail({ email: deliveryAddr, credentialLevel: body.credential_level, joaTitles });
    await resend.emails.send({ from: 'Landedd VA <hello@landedd.com>', to: deliveryAddr, subject: pe.subject, html: pe.html });
  } catch (e) { console.error('Processing email (non-fatal):', e.message); }

  // Run synthesis
  let synthesisResult;
  try {
    synthesisResult = await runSynthesis(body);
    console.log(`Synthesis: ${synthesisResult.input_tokens}in/${synthesisResult.output_tokens}out / ${((Date.now()-startTime)/1000).toFixed(1)}s`);
  } catch (err) {
    console.error('Synthesis attempt 1 failed:', err.message);
    try {
      await new Promise((r) => setTimeout(r, 3000));
      synthesisResult = await runSynthesis(body);
    } catch (retryErr) {
      console.error('Synthesis retry failed:', retryErr.message);
      try {
        const resend = getResend();
        const a = failureAlertEmail({ customerEmail: deliveryAddr, intakeId, sessionId: session_id, errorMessage: retryErr.message });
        await resend.emails.send({ from: 'Landedd VA <hello@landedd.com>', to: 'hello@landedd.com', subject: a.subject, html: a.html });
      } catch (_) {}
      return res.status(500).json({ error: 'Your analysis is processing and will arrive by email within 24 hours.' });
    }
  }

  const execPreview = extractExecSummary(synthesisResult.markdown);

  // Store deliverable
  const deliverableData = {
    id: intakeId, view_token: viewToken, markdown: synthesisResult.markdown,
    email: deliveryAddr, created_at: new Date().toISOString(),
    input_tokens: synthesisResult.input_tokens, output_tokens: synthesisResult.output_tokens,
    generation_seconds: ((Date.now()-startTime)/1000).toFixed(1),
    credential_level: body.credential_level, joa_count: body.joas.length, joa_titles: joaTitles,
  };
  try {
    const r = await getRedis();
    await r.setEx(`premium:deliverable:${intakeId}`, 7776000, JSON.stringify(deliverableData));
    await r.setEx(`premium:token:${viewToken}`, 7776000, JSON.stringify({ intake_id: intakeId }));
    await r.setEx(`premium:submitted:${session_id}`, 7776000, JSON.stringify({ intake_id: intakeId, view_token: viewToken, email: deliveryAddr }));
    await r.setEx(`premium:intake:${intakeId}`, 7776000, JSON.stringify({ ...intakeData, status: 'complete' }));
  } catch (e) { console.error('Redis deliverable store:', e.message); }

  // Send delivery email — personalized subject + exec summary preview
  try {
    const resend = getResend();
    const de = deliveryEmail({ email: deliveryAddr, viewUrl, execSummaryPreview: execPreview, credentialLevel: body.credential_level, joaTitles });
    await resend.emails.send({ from: 'Landedd VA <hello@landedd.com>', to: deliveryAddr, subject: de.subject, html: de.html });
  } catch (e) { console.error('Delivery email (non-fatal):', e.message); }

  return res.status(200).json({ success: true, view_token: viewToken, view_url: viewUrl, message: 'Your analysis is ready.' });
};
