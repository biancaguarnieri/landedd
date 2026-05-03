// api/metrics.js — Landedd unified metrics
// Tracks events across both Landedd (main) and Landedd Title 38 sites.
// Backward compatible: old combined keys still increment, plus new per-site keys.

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
  const s = String(src || '').toLowerCase();
  if (s.includes('reddit')) return 'reddit';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('indeed')) return 'indeed';
  if (s.includes('google')) return 'google';
  if (s.includes('twitter') || s.includes('x.com')) return 'twitter';
  return 'other';
}

function normalizeSite(s) {
  return s === 'title38' ? 'title38' : 'main';
}

const KNOWN_SOURCES = ['direct', 'reddit', 'linkedin', 'indeed', 'google', 'twitter', 'other'];
const MAIN_TOOLS    = ['builder', 'tailor', 'scanner', 'gaps', 'impact'];
const TITLE38_TOOLS = ['joa', 'questionnaire', 'premium'];
const ALL_TOOLS     = [...MAIN_TOOLS, ...TITLE38_TOOLS];
const KNOWN_WTP     = ['free', 'basic', 'pro', 'more'];
const SITES         = ['main', 'title38'];

// Helper: increment both the combined key and the per-site key
async function dualIncr(r, base, site) {
  await Promise.all([
    r.incr(base),
    r.incr(base + ':' + site),
  ]);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await getRedis();

    // ── GET: return full metrics ──────────────────────────────────────────
    if (req.method === 'GET') {
      // Combined totals (existing keys — preserved for backward compat)
      const totalKeys = ['users','sessions','runs','downloads','thumbsup','thumbsdown'];
      const totalVals = await Promise.all(totalKeys.map(k => r.get('pilot:totals:' + k)));
      const totals = {};
      totalKeys.forEach((k, i) => { totals[k] = parseInt(totalVals[i] || '0'); });

      // Combined tools (now includes Title 38 tools too)
      const toolVals = await Promise.all(ALL_TOOLS.map(t => r.get('pilot:tools:' + t)));
      const tools = {};
      ALL_TOOLS.forEach((k, i) => { tools[k] = parseInt(toolVals[i] || '0'); });

      // Combined WTP
      const wtpVals = await Promise.all(KNOWN_WTP.map(k => r.get('pilot:wtp:' + k)));
      const wtp = {};
      KNOWN_WTP.forEach((k, i) => { wtp[k] = parseInt(wtpVals[i] || '0'); });

      // Combined sources
      const srcVals = await Promise.all(KNOWN_SOURCES.map(k => r.get('pilot:sources:' + k)));
      const sources = {};
      KNOWN_SOURCES.forEach((k, i) => { sources[k] = parseInt(srcVals[i] || '0'); });

      // Weekly (combined)
      const weeklyRuns     = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:runs:'      + w)));
      const weeklySessions = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:sessions:'  + w)));
      const weeklyUsers    = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:users:'     + w)));
      const weeklyUp       = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:thumbsup:'   + w)));
      const weeklyDown     = await Promise.all([0,1,2].map(w => r.get('pilot:weekly:thumbsdown:' + w)));

      // Feedback
      const feedbackTotal = parseInt(await r.get('pilot:feedback:total')      || '0');
      const ratingSum     = parseInt(await r.get('pilot:feedback:rating_sum') || '0');
      const avgRating     = feedbackTotal > 0 ? parseFloat((ratingSum / feedbackTotal).toFixed(1)) : null;

      // ── Per-site breakdown ──
      const bySite = {};
      for (const site of SITES) {
        const stTotalVals = await Promise.all(totalKeys.map(k => r.get('pilot:totals:' + k + ':' + site)));
        const stTotals = {};
        totalKeys.forEach((k, i) => { stTotals[k] = parseInt(stTotalVals[i] || '0'); });

        const stToolVals = await Promise.all(ALL_TOOLS.map(t => r.get('pilot:tools:' + t + ':' + site)));
        const stTools = {};
        ALL_TOOLS.forEach((k, i) => { stTools[k] = parseInt(stToolVals[i] || '0'); });

        const stSrcVals = await Promise.all(KNOWN_SOURCES.map(k => r.get('pilot:sources:' + k + ':' + site)));
        const stSources = {};
        KNOWN_SOURCES.forEach((k, i) => { stSources[k] = parseInt(stSrcVals[i] || '0'); });

        const stWtpVals = await Promise.all(KNOWN_WTP.map(k => r.get('pilot:wtp:' + k + ':' + site)));
        const stWtp = {};
        KNOWN_WTP.forEach((k, i) => { stWtp[k] = parseInt(stWtpVals[i] || '0'); });

        bySite[site] = { totals: stTotals, tools: stTools, sources: stSources, wtp: stWtp };
      }

      return res.json({
        totals, tools, wtp, sources,
        feedback: { total: feedbackTotal, avgRating },
        weekly: {
          runs:       weeklyRuns    .map(v => parseInt(v || '0')),
          sessions:   weeklySessions.map(v => parseInt(v || '0')),
          users:      weeklyUsers   .map(v => parseInt(v || '0')),
          thumbsup:   weeklyUp      .map(v => parseInt(v || '0')),
          thumbsdown: weeklyDown    .map(v => parseInt(v || '0')),
        },
        bySite,
        currentWeek: weekIndex(),
        demo: false,
        updatedAt: new Date().toISOString(),
      });
    }

    // ── POST: record events ───────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};

      // Reset (preserved from previous version)
      if (body.action === 'reset' && body.password === DASHBOARD_PASSWORD) {
        const keys = await r.keys('pilot:*');
        if (keys.length > 0) await Promise.all(keys.map(k => r.del(k)));
        return res.json({ ok: true, reset: true, deleted: keys.length });
      }

      // Seed (preserved)
      if (body.action === 'seed' && body.password === DASHBOARD_PASSWORD) {
        const s = body.data || {};
        const ops = [];
        if (s.users)     ops.push(r.set('pilot:totals:users',     String(s.users)));
        if (s.sessions)  ops.push(r.set('pilot:totals:sessions',  String(s.sessions)));
        if (s.runs)      ops.push(r.set('pilot:totals:runs',      String(s.runs)));
        if (s.downloads) ops.push(r.set('pilot:totals:downloads', String(s.downloads)));
        if (s.scanner)   ops.push(r.set('pilot:tools:scanner',    String(s.scanner)));
        if (s.tailor)    ops.push(r.set('pilot:tools:tailor',     String(s.tailor)));
        if (s.gaps)      ops.push(r.set('pilot:tools:gaps',       String(s.gaps)));
        await Promise.all(ops);
        return res.json({ ok: true, seeded: ops.length });
      }

      const { event, feature, tier, rating, utm_source } = body;
      const site = normalizeSite(body.site);
      const wk   = weekIndex();
      const src  = normalizeSource(utm_source);

      switch (event) {
        case 'user_signed_up':
          await dualIncr(r, 'pilot:totals:users', site);
          await dualIncr(r, 'pilot:weekly:users:' + wk, site);
          await dualIncr(r, 'pilot:sources:' + src, site);
          break;

        case 'app_opened':
          await dualIncr(r, 'pilot:totals:sessions', site);
          await dualIncr(r, 'pilot:weekly:sessions:' + wk, site);
          break;

        case 'ai_output_generated':
          await dualIncr(r, 'pilot:totals:runs', site);
          await dualIncr(r, 'pilot:weekly:runs:' + wk, site);
          if (feature && ALL_TOOLS.includes(feature)) {
            await dualIncr(r, 'pilot:tools:' + feature, site);
          }
          break;

        case 'ai_output_rated':
          if (rating === 'positive') {
            await dualIncr(r, 'pilot:totals:thumbsup', site);
            await dualIncr(r, 'pilot:weekly:thumbsup:' + wk, site);
          } else if (rating === 'negative') {
            await dualIncr(r, 'pilot:totals:thumbsdown', site);
            await dualIncr(r, 'pilot:weekly:thumbsdown:' + wk, site);
          }
          break;

        case 'resume_downloaded_or_saved':
          await dualIncr(r, 'pilot:totals:downloads', site);
          break;

        case 'wtp_response':
          if (tier && KNOWN_WTP.includes(tier)) {
            await dualIncr(r, 'pilot:wtp:' + tier, site);
          }
          break;

        case 'feedback_submitted':
          await r.incr('pilot:feedback:total');
          await r.incr('pilot:feedback:total:' + site);
          if (rating && !isNaN(Number(rating))) {
            await r.incrBy('pilot:feedback:rating_sum', parseInt(rating));
            await r.incrBy('pilot:feedback:rating_sum:' + site, parseInt(rating));
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
