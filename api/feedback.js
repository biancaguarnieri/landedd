// api/feedback.js — Vercel Serverless Function
// Receives feedback from the site and emails it via Resend

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.landedd.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Email service not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, message, email, rating, tool, source } = body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'Not rated';
    const toolLabel = tool || 'Not specified';
    const userEmail = email || 'Not provided';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    // Log to Vercel runtime logs regardless
    console.log('FEEDBACK:', JSON.stringify({ timestamp, source, type, tool, rating, message, email }));

    // Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Landedd Feedback <hello@landedd.com>',
        to: ['hello@landedd.com'],
        reply_to: userEmail !== 'Not provided' ? userEmail : undefined,
        subject: `[Landedd Feedback] ${stars} — ${toolLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
            <div style="background:#2d6a4f;padding:20px 28px;border-radius:8px 8px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">New Landedd Feedback</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 8px 8px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:6px 0;color:#888;width:110px">Rating</td><td style="padding:6px 0;font-size:18px">${stars}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Tool used</td><td style="padding:6px 0;font-weight:600">${toolLabel}</td></tr>
                <tr><td style="padding:6px 0;color:#888">User email</td><td style="padding:6px 0">${userEmail}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Source</td><td style="padding:6px 0">${source || 'feedback-section'}</td></tr>
                <tr><td style="padding:6px 0;color:#888">Time (CT)</td><td style="padding:6px 0">${timestamp}</td></tr>
              </table>
              <hr style="border:none;border-top:1px solid #e8e8e8;margin:16px 0"/>
              <p style="font-size:13px;color:#888;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em">Message</p>
              <p style="font-size:15px;line-height:1.6;background:#fff;padding:14px 16px;border-radius:6px;border:1px solid #e8e8e8;margin:0">${message.replace(/\n/g, '<br>')}</p>
              ${userEmail !== 'Not provided' ? `<p style="margin-top:16px;font-size:13px;color:#888">Hit Reply to respond directly to ${userEmail}</p>` : ''}
            </div>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error('Resend error:', emailRes.status, JSON.stringify(emailData));
      return res.status(500).json({ error: 'Could not send feedback. Please try again or email us at hello@landedd.com' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Feedback error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
