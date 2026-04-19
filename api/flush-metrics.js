// api/flush-metrics.js
// One-time endpoint to wipe all metrics data and start fresh.
// Protected by DASHBOARD_PASSWORD. Call once, then delete or ignore.

const { createClient } = require('redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check — same password as dashboard
  const { password } = req.body || {};
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = createClient({ url: process.env.REDIS_URL });

  try {
    await client.connect();

    // SCAN all keys and delete in batches to avoid blocking
    let cursor = 0;
    let deleted = 0;
    const deletedKeys = [];

    do {
      const reply = await client.scan(cursor, { COUNT: 100 });
      cursor = reply.cursor;
      const keys = reply.keys;

      if (keys.length > 0) {
        await client.del(keys);
        deleted += keys.length;
        deletedKeys.push(...keys);
      }
    } while (cursor !== 0);

    await client.disconnect();

    return res.status(200).json({
      ok: true,
      deleted,
      message: `Metrics reset complete. ${deleted} Redis keys cleared.`,
      keys: deletedKeys.slice(0, 50) // show first 50 for verification
    });

  } catch (err) {
    try { await client.disconnect(); } catch (_) {}
    console.error('[flush-metrics] error:', err);
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
};
