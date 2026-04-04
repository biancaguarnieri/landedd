export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return new Response(JSON.stringify({ demo: true, ...getDemoData() }), { headers: corsHeaders });
  }

  const kv = (path, method = 'GET') =>
    fetch(`${kvUrl}${path}`, { method, headers: { Authorization: `Bearer ${kvToken}` } }).then(r => r.json());

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      const { event, tool, rating, tier } = body;
      const w = getCurrentWeek();

      if (event === 'ai_output_generated') {
        await kv('/incr/pilot:runs:total', 'POST');
        await kv(`/incr/pilot:runs:week:${w}`, 'POST');
        if (tool) await kv(`/incr/pilot:tool:${tool}`, 'POST');
      }
      if (event === 'user_signed_up') {
        await kv('/incr/pilot:users:total', 'POST');
        await kv(`/incr/pilot:users:week:${w}`, 'POST');
      }
      if (event === 'app_opened') {
        await kv('/incr/pilot:sessions:total', 'POST');
        await kv(`/incr/pilot:sessions:week:${w}`, 'POST');
      }
      if (event === 'ai_output_rated') {
        const dir = rating === 'positive' ? 'thumbsup' : 'thumbsdown';
        await kv(`/incr/pilot:rating:${dir}`, 'POST');
        await kv(`/incr/pilot:rating:${dir}:week:${w}`, 'POST');
      }
      if (event === 'wtp_response' && tier) {
        await kv(`/incr/pilot:wtp:${tier}`, 'POST');
      }
      if (event === 'resume_downloaded_or_saved') {
        await kv('/incr/pilot:downloads:total', 'POST');
      }
      if (event === 'feedback_submitted' && rating) {
        await kv('/incr/pilot:feedback:total', 'POST');
        const ratingNum = parseInt(rating);
        if (!isNaN(ratingNum)) {
          const [sr, cr] = await Promise.all([kv('/get/pilot:feedback:ratingsum'), kv('/get/pilot:feedback:ratingcount')]);
          await kv(`/set/pilot:feedback:ratingsum/${parseInt(sr.result||0)+ratingNum}`, 'POST');
          await kv(`/set/pilot:feedback:ratingcount/${parseInt(cr.result||0)+1}`, 'POST');
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
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

    const res = await fetch(`${kvUrl}/mget/${keys.join('/')}`, {
      headers: { Authorization: `Bearer ${kvToken}` }
    });
    const { result: vals = [] } = await res.json();
    const g = k => parseInt(vals[keys.indexOf(k)] || 0);

    const fbSum = g('pilot:feedback:ratingsum'), fbCnt = g('pilot:feedback:ratingcount');

    return new Response(JSON.stringify({
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
      feedback: { total: g('pilot:feedback:total'), avgRating: fbCnt > 0 ? Math.round((fbSum/fbCnt)*10)/10 : null },
      weekly: {
        users: [g('pilot:users:week:1'),g('pilot:users:week:2'),g('pilot:users:week:3')],
        runs: [g('pilot:runs:week:1'),g('pilot:runs:week:2'),g('pilot:runs:week:3')],
        sessions: [g('pilot:sessions:week:1'),g('pilot:sessions:week:2'),g('pilot:sessions:week:3')],
        thumbsup: [g('pilot:rating:thumbsup:week:1'),g('pilot:rating:thumbsup:week:2'),g('pilot:rating:thumbsup:week:3')],
        thumbsdown: [g('pilot:rating:thumbsdown:week:1'),g('pilot:rating:thumbsdown:week:2'),g('pilot:rating:thumbsdown:week:3')]
      },
      currentWeek: getCurrentWeek(),
      updatedAt: new Date().toISOString()
    }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, demo: true, ...getDemoData() }), { headers: corsHeaders });
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
