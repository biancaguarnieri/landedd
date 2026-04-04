// api/claude.js — Vercel Serverless Function
// Proxies requests to Anthropic API. API key never exposed to browser.

const MAX_INPUT_CHARS = 20000; // ~5000 tokens — enough for any resume + JD combo

// Simple input sanitizer: strips HTML, enforces length, rejects obvious injections
function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, ' ')          // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .slice(0, MAX_INPUT_CHARS)
    .trim();
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: sanitizeInput(String(m.content || '')),
  })).filter(m => m.content.length > 0);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.landedd.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
  }

  // IP-based rate limiting (backup layer — primary is in api/usage.js)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  try {
    const { kv } = require('@vercel/kv');
    const rateKey = `claude:rate:${ip}`;
    const calls = parseInt(await kv.get(rateKey) || 0);
    if (calls > 20) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });
    }
    await kv.set(rateKey, calls + 1, { ex: 3600 });
  } catch {
    // KV not available — continue without rate limiting during setup
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const messages = sanitizeMessages(body.messages);
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'No valid message content provided.' });
    }

    const payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(body.max_tokens || 2000, 3000),
      messages,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
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
