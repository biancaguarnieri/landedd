// api/feedback.js — Vercel Serverless Function
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, email, rating, tool } = body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'Not rated';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Landedd Feedback <hello@landedd.com>',
        to: ['hello@landedd.com'],
        reply_to: email || undefined,
        subject: `[Feedback] ${stars} — ${tool || 'General'}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
            <div style="background:#2d6a4f;padding:20px 28px;border-radius:8px 8px 0 0">
              <h2 style="color:#fff;margin:0">New Feedback</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #e8e8e8;border-radius:0 0 8px 8px">
              <p><strong>Rating:</strong> ${stars}</p>
              <p><strong>Tool:</strong> ${tool || 'Not specified'}</p>
              <p><strong>User email:</strong> ${email || 'Not provided'}</p>
              <p><strong>Time (CT):</strong> ${timestamp}</p>
              <hr style="border:none;border-top:1px solid #e8e8e8;margin:16px 0"/>
              <p style="font-size:15px;line-height:1.6;background:#fff;padding:14px 16px;border-radius:6px;border:1px solid #e8e8e8">
                ${message.replace(/\n/g, '<br>')}
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Could not send feedback. Please try again.' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Feedback error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
