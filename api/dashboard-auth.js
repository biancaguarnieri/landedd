export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = await new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });

  const correctPassword = process.env.DASHBOARD_PASSWORD;
  if (!correctPassword) return res.status(500).json({ error: 'Dashboard password not configured' });

  if (password === correctPassword) {
    return res.status(200).json({ ok: true, token: Buffer.from(correctPassword + ':landedd-dash').toString('base64') });
  }

  return res.status(401).json({ error: 'Wrong password' });
}
