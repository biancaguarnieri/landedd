import { createClient } from 'redis';

export const config = { runtime: 'nodejs' };

let client = null;
const TOOL_MAX = 3;
const DL_MAX = 3;
const WINDOW_SECS = 86400; // 24 hours

async function getClient() {
  if (client && client.isOpen) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = createClient({ url });
  client.on('error', () => { client = null; });
  await client.connect();
  return client;
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://www.landedd.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const rc = await getClient();

  // No Redis — fail open (unlimited)
  if (!rc) {
    if (req.method === 'POST') return res.status(200).json({ ok: true, remaining: TOOL_MAX });
    return res.status(200).json({ tools: {}, downloads: 0, unlimited: true });
  }

  const body = req.method === 'POST' ? await new Promise(resolve => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
  }) : {};

  const fp = req.method === 'GET'
    ? (new URL(req.url, 'http://x').searchParams.get('fp') || 'anon')
    : (body.fp || 'anon');

  const day = todayKey();
  const toolKeys = ['builder','tailor','scanner','gaps','impact'].reduce((acc, t) => {
    acc[t] = `usage:${fp}:tool:${t}:${day}`;
    return acc;
  }, {});
  const dlKey = `usage:${fp}:dl:${day}`;

  try {
    if (req.method === 'POST') {
      const { type, tool } = body;

      if (type === 'tool' && tool && toolKeys[tool]) {
        const count = await rc.incr(toolKeys[tool]);
        // Set 24h expiry on first write
        if (count === 1) await rc.expire(toolKeys[tool], WINDOW_SECS + 3600);
        const remaining = Math.max(0, TOOL_MAX - count);
        return res.status(200).json({ ok: remaining >= 0, remaining, count, resetsIn: '24h' });
      }

      if (type === 'download') {
        const count = await rc.incr(dlKey);
        if (count === 1) await rc.expire(dlKey, WINDOW_SECS + 3600);
        const remaining = Math.max(0, DL_MAX - count);
        return res.status(200).json({ ok: remaining >= 0, remaining });
      }

      return res.status(200).json({ ok: true });
    }

    // GET — return today's usage counts
    const allKeys = [...Object.values(toolKeys), dlKey];
    const vals = await rc.mGet(allKeys);

    const tools = {};
    Object.entries(toolKeys).forEach(([t, k], i) => {
      tools[t] = parseInt(vals[i] || 0);
    });
    const downloads = parseInt(vals[allKeys.length - 1] || 0);

    // Get TTL of first tool key to show when quota resets
    const ttl = await rc.ttl(Object.values(toolKeys)[0]);
    const resetsInSeconds = ttl > 0 ? ttl : WINDOW_SECS;

    return res.status(200).json({ tools, downloads, resetsInSeconds, day });

  } catch (err) {
    // Fail open on any Redis error
    if (req.method === 'POST') return res.status(200).json({ ok: true, remaining: TOOL_MAX });
    return res.status(200).json({ tools: {}, downloads: 0, unlimited: true });
  }
}
