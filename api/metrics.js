const { createClient } = require('redis');

let redis = null;
async function getRedis() {
  if (!redis) {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on('error', () => {});
    await redis.connect();
  }
  return redis;
}

const PILOT_START = new Date('2026-04-04T00:00:00Z');
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'landedd2026';

function weekIndex() {
  const now = new Date();
  const diff = Math.floor((now - PILOT_START) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(2, diff));
}

function normalizeSource(src) {
  if (!src || src === 'direct') return 'direct';
  const s = (src || '').toLowerCase();
  if (s.includes('reddit')) return 'reddit';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('indeed')) return 'indeed';
  if (s.includes('google')) return 'google';
  if (s.includes('twitter') || s.includes('x.com')) return 'twitter';
  return 'other';
}

const KNOWN_SOURCES = ['direct', 'reddit', 'linkedin', 'indeed', 'google', 'twitter', 'other'];
const KNOWN_TOOLS   = ['builder', 'tailor', 'scanner', 'gaps', 'impact'];
const KNOWN_WTP     = ['free', 'basic', 'pro', 'more'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await getRedis();

    // ── GET — return full metrics ──
    if (req.method === 'GET') {
      // Skip recording dashboard visits as real traffic
      const referer = req.headers.referer || req.headers.referrer || '';
      if (referer.includes('/dashboard')) {
        return res.json({ dashboard_visit: true });
      }

      const [users, sessions, runs, downloads, thumbsup, thumbsdown] = await Promise.all([
        r.get('pilot:totals:users'),
        r.get('pilot:totals:sessions'),
        r.get('pilot:totals:runs'),
        r.get('pilot:totals:downloads'),
        r.get('pilot:totals:thumbsup'),
        r.get('pilot:totals:thumbsdown'),
      ]);

      const toolVals = await Promise.all(KNOWN_TOOLS.map(t => r.get('pilot:tools:' + t)));
      const tools = {};
      KNOWN_TOOLS.forEach((k, i) => { tools[k] = parseInt(toolVals[i] || '0'); });

      const wtpVals = await Promise.all(KNOWN_WTP.map(k => r.get('pilot:wtp:' + k)));
      const wtp = {};
      KNOWN_WTP.forEach((k, i) => { wtp[k] = parseInt(wtpVals[i] || '0'); });

      const sourceVals = await Promise.all(KNOWN_SOURCES.map(k => r.get('pilot:sources:' + k)));
      const sources = {};
      KNOWN_SOURCES.forEach((k, i) => {
        const v = parseInt(sourceVals[i] || '0');
        sources[k] = v;
      });

      const weeklyRuns     = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:runs:'     + w)));
      const weeklySessions = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:sessions:' + w)));
      const weeklyUsers    = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:users:'    + w)));
      const weeklyUp       = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:thumbsup:'  + w)));
      const weeklyDown     = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:thumbsdown:'+ w)));

      const feedbackTotal  = parseInt(await r.get('pilot:feedback:total')      || '0');
      const ratingSum      = parseInt(await r.get('pilot:feedback:rating_sum') || '0');
      const avgRating      = feedbackTotal > 0 ? parseFloat((ratingSum / feedbackTotal).toFixed(1)) : null;

      return res.json({
        totals: {
          users:     parseInt(users     || '0'),
          sessions:  parseInt(sessions  || '0'),
          runs:      parseInt(runs      || '0'),
          downloads: parseInt(downloads || '0'),
          thumbsup:  parseInt(thumbsup  || '0'),
          thumbsdown:parseInt(thumbsdown|| '0'),
        },
        tools,
        wtp,
        sources,
        feedback: { total: feedbackTotal, avgRating },
        weekly: {
          runs:      weeklyRuns    .map(v => parseInt(v || '0')),
          sessions:  weeklySessions.map(v => parseInt(v || '0')),
          users:     weeklyUsers   .map(v => parseInt(v || '0')),
          thumbsup:  weeklyUp      .map(v => parseInt(v || '0')),
          thumbsdown:weeklyDown    .map(v => parseInt(v || '0')),
        },
        currentWeek: weekIndex(),
        demo: false,
        updatedAt: new Date().toISOString(),
      });
    }

    // ── POST — record events ──
    if (req.method === 'POST') {
      const body = req.body || {};

      // Password-protected reset
      if (body.action === 'reset' && body.password === DASHBOARD_PASSWORD) {
        const keys = await r.keys('pilot:*');
        if (keys.length > 0) await Promise.all(keys.map(k => r.del(k)));
        return res.json({ ok: true, reset: true, deleted: keys.length });
      }

      const { event, feature, tier, rating, utm_source } = body;
      const wk  = weekIndex();
      const src = normalizeSource(utm_source);

      switch (event) {
        case 'user_signed_up':
          await r.incr('pilot:totals:users');
          await r.incr('pilot:weekly:users:' + wk);
          await r.incr('pilot:sources:' + src);
          break;

        case 'app_opened':
          await r.incr('pilot:totals:sessions');
          await r.incr('pilot:weekly:sessions:' + wk);
          break;

        case 'ai_output_generated':
          await r.incr('pilot:totals:runs');
          await r.incr('pilot:weekly:runs:' + wk);
          if (feature && KNOWN_TOOLS.includes(feature)) {
            await r.incr('pilot:tools:' + feature);
          }
          break;

        case 'ai_output_rated':
          if (rating === 'positive') {
            await r.incr('pilot:totals:thumbsup');
            await r.incr('pilot:weekly:thumbsup:' + wk);
          } else if (rating === 'negative') {
            await r.incr('pilot:totals:thumbsdown');
            await r.incr('pilot:weekly:thumbsdown:' + wk);
          }
          break;

        case 'resume_downloaded_or_saved':
          await r.incr('pilot:totals:downloads');
          break;

        case 'wtp_response':
          if (tier && KNOWN_WTP.includes(tier)) {
            await r.incr('pilot:wtp:' + tier);
          }
          break;

        case 'feedback_submitted':
          await r.incr('pilot:feedback:total');
          if (rating && !isNaN(Number(rating))) {
            await r.incrBy('pilot:feedback:rating_sum', parseInt(rating));
          }
          break;
      }

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[metrics]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
