// /api/metrics.js — Landedd pilot dashboard KV handler
// Fixed: ai_output_generated now routes to tools[feature], ai_output_rated routes to thumbsup/thumbsdown
// Fixed: dashboard visits (referer /dashboard) excluded from user/session counts

import { kv } from '@vercel/kv';

const PILOT_PREFIX = 'pilot_v1';
const WEEK_COUNT = 3;

function weekKey(week) { return `${PILOT_PREFIX}:week:${week}`; }
function totalsKey() { return `${PILOT_PREFIX}:totals`; }
function toolsKey() { return `${PILOT_PREFIX}:tools`; }
function wtpKey() { return `${PILOT_PREFIX}:wtp`; }
function feedbackKey() { return `${PILOT_PREFIX}:feedback`; }
function weekIndexKey() { return `${PILOT_PREFIX}:weekindex`; }

async function getTotals() {
  const t = await kv.hgetall(totalsKey()) || {};
  return {
    users:     parseInt(t.users     || 0),
    sessions:  parseInt(t.sessions  || 0),
    runs:      parseInt(t.runs      || 0),
    downloads: parseInt(t.downloads || 0),
    thumbsup:  parseInt(t.thumbsup  || 0),
    thumbsdown:parseInt(t.thumbsdown|| 0),
  };
}

async function getTools() {
  const t = await kv.hgetall(toolsKey()) || {};
  return {
    builder: parseInt(t.builder || 0),
    tailor:  parseInt(t.tailor  || 0),
    scanner: parseInt(t.scanner || 0),
    gaps:    parseInt(t.gaps    || 0),
    impact:  parseInt(t.impact  || 0),
  };
}

async function getWtp() {
  const w = await kv.hgetall(wtpKey()) || {};
  return {
    free:  parseInt(w.free  || 0),
    basic: parseInt(w.basic || 0),
    pro:   parseInt(w.pro   || 0),
    more:  parseInt(w.more  || 0),
  };
}

async function getFeedback() {
  const f = await kv.hgetall(feedbackKey()) || {};
  const total = parseInt(f.total || 0);
  const ratingSum = parseInt(f.rating_sum || 0);
  return {
    total,
    avgRating: total > 0 ? Math.round((ratingSum / total) * 10) / 10 : null,
  };
}

async function getCurrentWeek() {
  const w = await kv.get(weekIndexKey());
  return parseInt(w || 1);
}

async function getWeeklyData() {
  const runs = [], sessions = [], users = [], thumbsup = [], thumbsdown = [];
  for (let i = 1; i <= WEEK_COUNT; i++) {
    const w = await kv.hgetall(weekKey(i)) || {};
    runs.push(parseInt(w.runs || 0));
    sessions.push(parseInt(w.sessions || 0));
    users.push(parseInt(w.users || 0));
    thumbsup.push(parseInt(w.thumbsup || 0));
    thumbsdown.push(parseInt(w.thumbsdown || 0));
  }
  return { runs, sessions, users, thumbsup, thumbsdown };
}

// Returns true if the request is coming from the dashboard itself
function isDashboardRequest(req) {
  const referer = req.headers['referer'] || req.headers['referrer'] || '';
  const page = req.body?.page || '';
  return (
    referer.includes('/dashboard') ||
    page === 'dashboard' ||
    page.includes('dashboard')
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: return full dashboard snapshot ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [totals, tools, wtp, feedback, weekly, currentWeek] = await Promise.all([
        getTotals(), getTools(), getWtp(), getFeedback(), getWeeklyData(), getCurrentWeek(),
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

  // ── POST: record an event ────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Password-protected reset
    if (req.body?.action === 'reset') {
      if (req.body?.password !== process.env.DASHBOARD_RESET_PASSWORD) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      try {
        const keys = [totalsKey(), toolsKey(), wtpKey(), feedbackKey(), weekIndexKey()];
        for (let i = 1; i <= WEEK_COUNT; i++) keys.push(weekKey(i));
        await Promise.all(keys.map(k => kv.del(k)));
        return res.status(200).json({ ok: true, reset: true });
      } catch (err) {
        return res.status(500).json({ error: 'Reset failed' });
      }
    }

    const { event, feature, tool, rating, tier } = req.body || {};
    const currentWeek = await getCurrentWeek();
    const wk = weekKey(currentWeek);

    // ── DASHBOARD FILTER: skip user/session events from dashboard visits ──
    const fromDashboard = isDashboardRequest(req);

    try {
      switch (event) {

        // ── A user arrived for the first time ───────────────────────────
        case 'user_signed_up':
          if (fromDashboard) break; // filter out dashboard owner
          await kv.hincrby(totalsKey(), 'users', 1);
          await kv.hincrby(wk, 'users', 1);
          break;

        // ── App panel opened (session) ───────────────────────────────────
        case 'app_opened':
          if (fromDashboard) break; // filter out dashboard owner
          await kv.hincrby(totalsKey(), 'sessions', 1);
          await kv.hincrby(wk, 'sessions', 1);
          break;

        // ── AI tool ran ──────────────────────────────────────────────────
        // Frontend sends: { event: 'ai_output_generated', feature: 'tailor' }
        case 'ai_output_generated': {
          await kv.hincrby(totalsKey(), 'runs', 1);
          await kv.hincrby(wk, 'runs', 1);
          // Route to per-tool counter using `feature` field
          const toolName = (feature || tool || '').toLowerCase();
          const validTools = ['builder', 'tailor', 'scanner', 'gaps', 'impact'];
          if (validTools.includes(toolName)) {
            await kv.hincrby(toolsKey(), toolName, 1);
          }
          break;
        }

        // ── User rated AI output ─────────────────────────────────────────
        // Frontend sends: { event: 'ai_output_rated', tool: 'tailor', rating: 'positive' }
        case 'ai_output_rated':
          if (rating === 'positive') {
            await kv.hincrby(totalsKey(), 'thumbsup', 1);
            await kv.hincrby(wk, 'thumbsup', 1);
          } else if (rating === 'negative') {
            await kv.hincrby(totalsKey(), 'thumbsdown', 1);
            await kv.hincrby(wk, 'thumbsdown', 1);
          }
          break;

        // ── Download / save ──────────────────────────────────────────────
        case 'resume_downloaded_or_saved':
          await kv.hincrby(totalsKey(), 'downloads', 1);
          break;

        // ── Willingness to pay ───────────────────────────────────────────
        case 'wtp_response': {
          const validTiers = ['free', 'basic', 'pro', 'more'];
          const t2 = (tier || '').toLowerCase();
          if (validTiers.includes(t2)) {
            await kv.hincrby(wtpKey(), t2, 1);
          }
          break;
        }

        // ── Feedback form submitted ──────────────────────────────────────
        case 'feedback_submitted': {
          await kv.hincrby(feedbackKey(), 'total', 1);
          const r = parseInt(req.body?.rating || 0);
          if (r >= 1 && r <= 5) {
            await kv.hincrby(feedbackKey(), 'rating_sum', r);
          }
          break;
        }

        default:
          // Unknown event — silently accept (don't break frontend)
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
