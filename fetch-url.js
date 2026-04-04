// api/fetch-url.js — Vercel Serverless Function
// Fetches a URL and returns extracted plain text for job postings

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.landedd.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url in request body' });
  }

  // Basic URL validation
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are supported' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Landedd/1.0; resume tool)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(422).json({ error: `Could not fetch that page (status ${response.status}). Please paste the job description directly.` });
    }

    const html = await response.text();

    // Strip HTML tags and extract readable text
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Limit to 5000 chars — enough for any job description
    if (text.length > 5000) text = text.substring(0, 5000);

    if (text.length < 100) {
      return res.status(422).json({ error: 'Could not extract enough text from that page. Please paste the job description directly.' });
    }

    return res.status(200).json({ text });
  } catch (err) {
    const msg = err.name === 'TimeoutError'
      ? 'That page took too long to load. Please paste the job description directly.'
      : 'Could not fetch that URL. Please paste the job description directly.';
    return res.status(422).json({ error: msg });
  }
};
