// api/premium-verify.js
// Verifies Stripe checkout session payment status before showing intake form
// GET /api/premium-verify?session_id={id}
// Returns: { paid: boolean, email: string|null, already_submitted: boolean }

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    // Check Redis first — if intake was already submitted for this session, redirect to view
    try {
      const redis = await getRedis();
      const submitted = await redis.get(`premium:submitted:${session_id}`);
      if (submitted) {
        const data = JSON.parse(submitted);
        return res.status(200).json({
          paid: true,
          already_submitted: true,
          view_token: data.view_token,
          email: data.email,
        });
      }
    } catch (redisErr) {
      console.error('Redis check failed (non-fatal):', redisErr.message);
    }

    // Verify with Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(200).json({
        paid: false,
        already_submitted: false,
        email: null,
      });
    }

    return res.status(200).json({
      paid: true,
      already_submitted: false,
      email: session.customer_details?.email || null,
    });
  } catch (err) {
    console.error('Stripe verify error:', err);
    // If Stripe throws on invalid session ID
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    return res.status(500).json({ error: 'Verification failed. Please contact hello@landedd.com.' });
  }
};
