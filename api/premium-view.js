// api/premium-view.js
// Serves Premium deliverable data for web view rendering
// GET /api/premium-view?token={viewToken}
// Returns: { markdown, metadata } or { error }
// The frontend renders the markdown into a beautiful HTML view

const { createClient } = require('@redis/client') || require('redis');

let redisClient = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
  }
  return redisClient;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;

  if (!token || token.length < 32) {
    return res.status(400).json({ error: 'Invalid access token.' });
  }

  try {
    const redis = await getRedis();

    // Look up intake ID from token
    const tokenData = await redis.get(`premium:token:${token}`);
    if (!tokenData) {
      return res.status(404).json({
        error: 'Analysis not found. This link may have expired (90 days) or the token is invalid. Please contact hello@landedd.com.',
      });
    }

    const { intake_id } = JSON.parse(tokenData);

    // Load deliverable
    const deliverableRaw = await redis.get(`premium:deliverable:${intake_id}`);
    if (!deliverableRaw) {
      return res.status(404).json({
        error: 'Analysis data not found. Please contact hello@landedd.com with your order details.',
      });
    }

    const deliverable = JSON.parse(deliverableRaw);

    // Return deliverable (exclude internal fields)
    return res.status(200).json({
      markdown: deliverable.markdown,
      metadata: {
        created_at: deliverable.created_at,
        credential_level: deliverable.credential_level,
        joa_count: deliverable.joa_count,
        joa_titles: deliverable.joa_titles,
      },
      // followup_token is the same as view_token — used to submit Day 7 question
      followup_token: token,
    });
  } catch (err) {
    console.error('Premium view error:', err);
    return res.status(500).json({
      error: 'Failed to load your analysis. Please try again or contact hello@landedd.com.',
    });
  }
};
