// /api/metrics.js — Landedd pilot dashboard Redis handler
// Rewritten to use Redis (matching usage.js pattern) instead of @vercel/kv
// Fixed: dashboard visits excluded from user/session counts

import { createClient } from 'redis';

export const config = { runtime: 'nodejs' };

const PILOT_PREFIX = 'pilot_v1';
const WEEK_COUNT = 3;

let client = null;

async function getClient() {
  if (client && client.isOpen) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL not set');
  client = createClient({ url });
  client.on('error', () => { client = null; });
  await client.connect();
  return client;
}

function totalsKey()    { return `${PILOT_PREFIX}:totals`; }
function toolsKey()     { return `${PILOT_PREFIX}:tools`; }
function wtpKey()       { return `${PILOT_PREFIX}:wtp`; }
function feedbackKey()  { return `${PILOT_PREFIX}:feedback`; }
function weekKey(w)     { return `${PILOT_PREFIX}:week:${w}`; }
function weekIndexKey() { return `${PILOT_PREFIX}:weekindex`; }

async function hincrby(rc, key, field, by = 1) {
  return rc.hIncrBy(key, field, by);
}

async function getTotals(rc) {
  const t = await rc.hGetAll(totalsKey()) || {};
  return {
    users:      parseInt(t.users      || 0),
    sessions:   parseInt(t.sessions   || 0),
    runs:       parseInt(t.runs       || 0),
    downloads:  parseInt(t.downloads  || 0),
    thumbsup:   parseInt(t.thumbsup   || 0),
    thumbsdown: parseInt(t.thumbsdown || 0),
  };
}

async function getTools(rc) {
  const t = await rc.hGetAll(toolsKey()) || {};
  return {
    builder: parseInt(t.builder || 0),
    tailor:  parseInt(t.tailor  || 0),
    scanner: parseInt(t.scanner || 0),
    gaps:    parseInt(t.gaps    || 0),
    impact:  parseInt(t.impact  || 0),
  };
}

async function getWtp(rc) {
  const w = await rc.hGetAll(wtpKey()) || {};
  return {
    free:  parseInt(w.free  || 0),
    basic: parseInt(w.basic || 0),
    pro:   parseInt(w.pro   || 0),
    more:  parseInt(w.more  || 0),
  };
}

async function getFeedback(rc) {
  const f = await rc.hGetAll(feedbackKey()) || {};
  const total = parseInt(f.total || 0);
  const ratingSum = parseInt(f.rating_sum || 0);
  return {
    total,
    avgRating: total > 0 ? Math.round((ratingSum / total) * 10) / 10 : null,
  };
}

async function getCurrentWeek(rc) {
  const w = await rc.get(weekIndexKey());
  return parseInt(w || 1);
}

async function getWeeklyData(rc) {
  const runs = [], sessions = [], users = [], thumbsup = [], thumbsdown = [];
  for (let i = 1; i <= WEEK_COUNT; i++) {
    const w = await rc.hGetAll(weekKey(i)) || {};
    runs.push(parseInt(w.runs || 0));
    sessions.push(parseInt(w.sessions || 0));
    users.push(parseInt(w.users || 0));
    thumbsup.push(parseInt(w.thumbsup || 0));
    thumbsdown.push(parseInt(w.thumbsdown || 0));
  }
  return { runs, sessions, users, thumbsup, thumbsdown };
}

function isDashboardRequest(req) {
  const referer = (req.headers['referer'] || req.headers['referrer'] || '').toLowerCase();
  const page = (req.body?.page || '').toLowerCase();
  return referer.includes('/dashboard') || page.includes('dashboard');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let rc;
  try {
    rc = await getClient();
  } catch (err) {
    console.error('[metrics] Redis connection failed:', err.message);
    return res.status(500).json({ error: 'Database unavailable' });
  }

  // GET: return full dashboard snapshot
  if (req.method === 'GET') {
    try {
      const [totals, tools, wtp, feedback, weekly, currentWeek] = await Promise.all([
        getTotals(rc), getTools(rc), getWtp(rc), getFeedback(rc),
        getWeeklyData(rc), getCurrentWeek(rc),
      ]);
      const demo = totals.users === 0 && totals.runs === 0;
      return res.status(200).json({
        totals, tools, wtp, feedback, weekly, currentWeek, demo,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[metrics GET error]', err);
      return res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  }

  // POST: record an event
  if (req.method === 'POST') {
    if (req.body?.action === 'reset') {
      if (req.body?.password !== process.env.DASHBOARD_RESET_PASSWORD) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      try {
        const keys = [totalsKey(), toolsKey(), wtpKey(), feedbackKey(), weekIndexKey()];
        for (let i = 1; i <= WEEK_COUNT; i++) keys.push(weekKey(i));
        await Promise.all(keys.map(k => rc.del(k)));
        return res.status(200).json({ ok: true, reset: true });
      } catch (err) {
        return res.status(500).json({ error: 'Reset failed' });
      }
    }

    const { event, feature, tool, rating, tier } = req.body || {};
    const fromDashboard = isDashboardRequest(req);
    const currentWeek = await getCurrentWeek(rc).catch(() => 1);
    const wk = weekKey(currentWeek);

    try {
      switch (event) {
        case 'user_signed_up':
          if (!fromDashboard) {
            await hincrby(rc, totalsKey(), 'users');
            await hincrby(rc, wk, 'users');
          }
          break;

        case 'app_opened':
          if (!fromDashboard) {
            await hincrby(rc, totalsKey(), 'sessions');
            await hincrby(rc, wk, 'sessions');
          }
          break;

        case 'ai_output_generated': {
          await hincrby(rc, totalsKey(), 'runs');
          await hincrby(rc, wk, 'runs');
          const toolName = (feature || tool || '').toLowerCase();
          const validTools = ['builder', 'tailor', 'scanner', 'gaps', 'impact'];
          if (validTools.includes(toolName)) {
            await hincrby(rc, toolsKey(), toolName);
          }
          break;
        }

        case 'ai_output_rated':
          if (rating === 'positive') {
            await hincrby(rc, totalsKey(), 'thumbsup');
            await hincrby(rc, wk, 'thumbsup');
          } else if (rating === 'negative') {
            await hincrby(rc, totalsKey(), 'thumbsdown');
            await hincrby(rc, wk, 'thumbsdown');
          }
          break;

        case 'resume_downloaded_or_saved':
          await hincrby(rc, totalsKey(), 'downloads');
          break;

        case 'wtp_response': {
          const validTiers = ['free', 'basic', 'pro', 'more'];
          const t2 = (tier || '').toLowerCase();
          if (validTiers.includes(t2)) {
            await hincrby(rc, wtpKey(), t2);
          }
          break;
        }

        case 'feedback_submitted': {
          await hincrby(rc, feedbackKey(), 'total');
          const r = parseInt(req.body?.rating || 0);
          if (r >= 1 && r <= 5) {
            await hincrby(rc, feedbackKey(), 'rating_sum', r);
          }
          break;
        }

        default:
          break;
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[metrics POST error]', event, err);
      return res.status(500).json({ error: 'Failed to record event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
