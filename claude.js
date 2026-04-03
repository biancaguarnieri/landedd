// api/claude.js — Vercel Serverless Function (CommonJS)
// Proxies requests to Anthropic API. Users never need their own key.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
  }

  try {
    // Vercel auto-parses JSON body, but guard against string bodies too
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    // Force Haiku for pilot — fast, cheap, excellent for resume tasks (~5x cheaper than Sonnet)
    body.model = 'claude-haiku-4-5-20251001';
    body.max_tokens = Math.min(body.max_tokens || 2000, 3000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', response.status, JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || 'AI service error. Please try again.',
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
