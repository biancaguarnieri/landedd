// api/usage.js — Vercel Serverless Function
// Server-side usage tracking using Vercel KV (Redis).
// Falls back gracefully if KV is not configured (allows all during setup).
//
// GET  /api/usage?fp=<fingerprint>  → { tools: {builder:n,...}, downloads:n }
// POST /api/usage                   → { type:'tool'|'download', tool?:'builder', fp:'...' }
//                                  → { ok:true, remaining:n }

const TOOL_MAX = 3;
const DL_MAX   = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper: get KV client if available
function getKV() {
  try {
    const { kv } = require('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.landedd.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kv = getKV();

  // ── GET: return current counts for a fingerprint ──
  if (req.method === 'GET') {
    const fp = (req.query?.fp || '').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!fp || !kv) {
      return res.status(200).json({ tools: {}, downloads: 0, unlimited: !kv });
    }
    try {
      const tools = {};
      const toolNames = ['builder','gaps','impact','tailor','scanner'];
      for (const t of toolNames) {
        const count = await kv.get(`u:${fp}:${t}`) || 0;
        tools[t] = parseInt(count);
      }
      const downloads = parseInt(await kv.get(`u:${fp}:dl`) || 0);
      return res.status(200).json({ tools, downloads });
    } catch (err) {
      console.error('KV GET error:', err);
      return res.status(200).json({ tools: {}, downloads: 0, unlimited: true });
    }
  }

  // ── POST: increment a usage count ──
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, tool, fp } = body || {};
    const safeType = type === 'download' ? 'download' : 'tool';
    const safeTool = (tool || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const safeFp   = (fp || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

    if (!safeFp) return res.status(400).json({ error: 'Missing fingerprint' });

    // Rate limiting: max 60 API calls per IP per hour
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (kv) {
      try {
        const rateKey = `rate:${ip}`;
        const calls = parseInt(await kv.get(rateKey) || 0);
        if (calls > 60) {
          return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
        }
        await kv.set(rateKey, calls + 1, { ex: 3600 }); // expires in 1 hour
      } catch (err) {
        console.error('Rate limit KV error:', err);
      }
    }

    if (!kv) {
      // KV not configured yet — allow all, return mock remaining
      return res.status(200).json({ ok: true, remaining: 99 });
    }

    try {
      const key = safeType === 'download' ? `u:${safeFp}:dl` : `u:${safeFp}:${safeTool}`;
      const max = safeType === 'download' ? DL_MAX : TOOL_MAX;
      const current = parseInt(await kv.get(key) || 0);

      if (current >= max) {
        return res.status(200).json({ ok: false, remaining: 0, limitReached: true });
      }

      // Increment with 24h expiry
      await kv.set(key, current + 1, { ex: Math.floor(WINDOW_MS / 1000) });

      return res.status(200).json({ ok: true, remaining: max - (current + 1) });
    } catch (err) {
      console.error('KV POST error:', err);
      // Fail open during beta — don't block users if KV has issues
      return res.status(200).json({ ok: true, remaining: 1 });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
