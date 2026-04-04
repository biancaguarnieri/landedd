// api/feedback.js — Vercel Serverless Function
// Collects beta feedback and emails it to hello@landedd.com via Resend

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = 'hello@landedd.com';
const FROM_EMAIL = 'feedback@landedd.com'; // must be verified domain in Resend

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.landedd.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { message, email, rating, tool, source } = body || {};

  if (!message || typeof message !== 'string' || message.trim().length < 3) {
    return res.status(400).json({ error: 'Feedback message is required' });
  }

  // Sanitize inputs
  const safeMsg   = message.slice(0, 2000).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeEmail = (email || '').slice(0, 200).replace(/</g, '&lt;');
  const safeTool  = (tool || 'unknown').slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeRating = (typeof rating === 'number' && rating >= 1 && rating <= 5) ? rating : null;
  const stars = safeRating ? '⭐'.repeat(safeRating) : 'No rating';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#f4f4f0;border-radius:8px;padding:24px 28px;margin-bottom:20px">
        <h2 style="margin:0 0 4px;font-size:18px">New Landedd Feedback</h2>
        <p style="margin:0;color:#666;font-size:13px">Beta feedback submission</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr><td style="padding:8px 12px;background:#f9f9f7;border-radius:4px;color:#555;width:110px">Tool</td>
            <td style="padding:8px 12px">${safeTool}</td></tr>
        <tr><td style="padding:8px 12px;color:#555">Rating</td>
            <td style="padding:8px 12px">${stars}</td></tr>
        <tr><td style="padding:8px 12px;background:#f9f9f7;color:#555">Reply-to</td>
            <td style="padding:8px 12px">${safeEmail || '<em>Not provided</em>'}</td></tr>
      </table>

      <div style="background:#fff;border:1.5px solid #e8e8e0;border-radius:8px;padding:20px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#999">Message</p>
        <p style="margin:0;line-height:1.7;font-size:15px;white-space:pre-wrap">${safeMsg}</p>
      </div>

      <p style="margin-top:20px;font-size:12px;color:#aaa;text-align:center">
        Sent from Landedd beta feedback form
      </p>
    </div>
  `;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: safeEmail || undefined,
        subject: `[Landedd Feedback] ${safeTool} — ${stars}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Could not send feedback. Please email us directly at hello@landedd.com' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Feedback handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please email us at hello@landedd.com' });
  }
};
