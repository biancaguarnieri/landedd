// api/premium-checkout.js
// Creates a Stripe Checkout Session for $49 Premium VA analysis
// POST /api/premium-checkout
// Body: { email?: string }
// Returns: { url: string } — redirect to Stripe hosted checkout

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@redis/client') || require('redis');

const PREMIUM_PRICE_ID = process.env.STRIPE_VA_PREMIUM_PRICE_ID || 'price_1TQC4sLwSq63TKxImh2xpbMC';
const VA_BASE_URL = process.env.VA_BASE_URL || 'https://va.landedd.com';

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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};

    const sessionParams = {
      mode: 'payment',
      line_items: [
        {
          price: PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      // Capture email at checkout if not provided upfront
      success_url: `${VA_BASE_URL}/premium/intake?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${VA_BASE_URL}?canceled=1#premium`,
      // Metadata we'll read back on intake
      metadata: {
        product: 'va_premium',
        version: '1.0',
      },
      // Allow promo codes in future
      allow_promotion_codes: true,
      // Collect billing address for tax purposes
      billing_address_collection: 'auto',
    };

    // Pre-fill email if provided
    if (email && email.includes('@')) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store checkout session in Redis — 24-hour TTL
    // We'll check this on intake to confirm payment
    try {
      const redis = await getRedis();
      await redis.setEx(
        `premium:checkout:${session.id}`,
        86400, // 24 hours
        JSON.stringify({
          status: 'pending',
          created_at: new Date().toISOString(),
          session_id: session.id,
        })
      );
    } catch (redisErr) {
      // Non-fatal — we can still verify directly with Stripe on intake
      console.error('Redis store failed (non-fatal):', redisErr.message);
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
};
