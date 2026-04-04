import { createClient } from 'redis';

export const config = { runtime: 'nodejs' };

let client = null;

async function getClient() {
  if (client && client.isOpen) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = createClient({ url });
  client.on('error', () => { client = null; });
  await client.connect();
  return client;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const rc = await getClient();

  if (!rc) {
    return res.status(200).json({ demo: true, ...getDemoData() });
  }

  try {
    if (req.method === 'POST') {
      const body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', c => raw += c);
        req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
      });

      const { event, tool, rating, tier } = body;
      const w = getCurrentWeek();

      if (event === 'ai_output_generated') {
        await rc.incr('pilot:runs:total');
        await rc.incr(`pilot:runs:week:${w}`);
        if (tool) await rc.incr(`pilot:tool:${tool}`);
      }
      if (event === 'user_signed_up') {
        await rc.incr('pilot:users:total');
        await rc.incr(`pilot:users:week:${w}`);
      }
      if (event === 'app_opened') {
        await rc.incr('pilot:sessions:total');
        await rc.incr(`pilot:sessions:week:${w}`);
      }
      if (event === 'ai_output_rated') {
        const dir = rating === 'positive' ? 'thumbsup' : 'thumbsdown';
        await rc.incr(`pilot:rating:${dir}`);
        await rc.incr(`pilot:rating:${dir}:week:${w}`);
      }
      if (event === 'wtp_response' && tier) {
        await rc.incr(`pilot:wtp:${tier}`);
      }
      if (event === 'resume_downloaded_or_saved') {
        await rc.incr('pilot:downloads:total');
      }
      if (event === 'feedback_submitted' && rating) {
        await rc.incr('pilot:feedback:total');
        const ratingNum = parseInt(rating);
        if (!isNaN(ratingNum)) {
          await rc.incrBy('pilot:feedback:ratingsum', ratingNum);
          await rc.incr('pilot:feedback:ratingcount');
        }
      }
      return res.status(200).json({ ok: true });
    }

    const keys = [
      'pilot:users:total','pilot:sessions:total','pilot:runs:total','pilot:downloads:total',
      'pilot:rating:thumbsup','pilot:rating:thumbsdown',
      'pilot:wtp:free','pilot:wtp:basic','pilot:wtp:pro','pilot:wtp:more',
      'pilot:tool:builder','pilot:tool:tailor','pilot:tool:scanner','pilot:tool:gaps','pilot:tool:impact',
      'pilot:feedback:total','pilot:feedback:ratingsum','pilot:feedback:ratingcount',
      'pilot:users:week:1','pilot:users:week:2','pilot:users:week:3',
      'pilot:runs:week:1','pilot:runs:week:2','pilot:runs:week:3',
      'pilot:sessions:week:1','pilot:sessions:week:2','pilot:sessions:week:3',
      'pilot:rating:thumbsup:week:1','pilot:rating:thumbsup:week:2','pilot:rating:thumbsup:week:3',
      'pilot:rating:thumbsdown:week:1','pilot:rating:thumbsdown:week:2','pilot:rating:thumbsdown:week:3'
    ];

    const vals = await rc.mGet(keys);
    const g = k => parseInt(vals[keys.indexOf(k)] || 0);

    const fbSum = g('pilot:feedback:ratingsum');
    const fbCnt = g('pilot:feedback:ratingcount');

    return res.status(200).json({
      totals: {
        users: g('pilot:users:total'), sessions: g('pilot:sessions:total'),
        runs: g('pilot:runs:total'), downloads: g('pilot:downloads:total'),
        thumbsup: g('pilot:rating:thumbsup'), thumbsdown: g('pilot:rating:thumbsdown')
      },
      tools: {
        builder: g('pilot:tool:builder'), tailor: g('pilot:tool:tailor'),
        scanner: g('pilot:tool:scanner'), gaps: g('pilot:tool:gaps'), impact: g('pilot:tool:impact')
      },
      wtp: { free: g('pilot:wtp:free'), basic: g('pilot:wtp:basic'), pro: g('pilot:wtp:pro'), more: g('pilot:wtp:more') },
      feedback: { total: g('pilot:feedback:total'), avgRating: fbCnt > 0 ? Math.round((fbSum / fbCnt) * 10) / 10 : null },
      weekly: {
        users: [g('pilot:users:week:1'), g('pilot:users:week:2'), g('pilot:users:week:3')],
        runs: [g('pilot:runs:week:1'), g('pilot:runs:week:2'), g('pilot:runs:week:3')],
        sessions: [g('pilot:sessions:week:1'), g('pilot:sessions:week:2'), g('pilot:sessions:week:3')],
        thumbsup: [g('pilot:rating:thumbsup:week:1'), g('pilot:rating:thumbsup:week:2'), g('pilot:rating:thumbsup:week:3')],
        thumbsdown: [g('pilot:rating:thumbsdown:week:1'), g('pilot:rating:thumbsdown:week:2'), g('pilot:rating:thumbsdown:week:3')]
      },
      currentWeek: getCurrentWeek(),
      updatedAt: new Date().toISOString()
    });

  } catch (err) {
    return res.status(200).json({ demo: true, error: err.message, ...getDemoData() });
  }
}

function getCurrentWeek() {
  const start = new Date('2026-04-07');
  const days = Math.floor((Date.now() - start) / 86400000);
  return Math.min(3, Math.max(1, Math.floor(days / 7) + 1));
}

function getDemoData() {
  return {
    totals: { users: 0, sessions: 0, runs: 0, downloads: 0, thumbsup: 0, thumbsdown: 0 },
    tools: { builder: 0, tailor: 0, scanner: 0, gaps: 0, impact: 0 },
    wtp: { free: 0, basic: 0, pro: 0, more: 0 },
    feedback: { total: 0, avgRating: null },
    weekly: { users: [0,0,0], runs: [0,0,0], sessions: [0,0,0], thumbsup: [0,0,0], thumbsdown: [0,0,0] },
    currentWeek: 1, updatedAt: new Date().toISOString()
  };
}
