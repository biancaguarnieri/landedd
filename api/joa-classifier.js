// Vercel Serverless Function: /api/joa-classifier
// Classifies a VA USAJobs posting into Title 38, Hybrid Title 38, or Title 5
// Calls Anthropic Messages API server-side. Requires env var: ANTHROPIC_API_KEY

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are a federal hiring expert specializing in VA healthcare hiring. You classify USAJobs Job Opportunity Announcements (JOAs) into three buckets and return strict JSON.

CLASSIFICATION RULES:
- "pure_title_38": Roles authorized under 38 U.S.C. (e.g., Registered Nurse, Physician, Dentist, Podiatrist, Optometrist, Chiropractor, Physician Assistant, Expanded-function Dental Auxiliary). Independent of OPM standards. NPSB grades nurses.
- "hybrid_title_38": Healthcare roles like Pharmacist, Psychologist, Social Worker, Audiologist, Speech-Language Pathologist, Occupational Therapist, Physical Therapist, Respiratory Therapist, Medical Technologist, Dietitian, Licensed Practical Nurse — appointed under both Title 38 and Title 5.
- "title_5": Standard competitive service roles (administrative, IT, support, GS-graded). Subject to OPM rules and traditional federal resume formatting.
- "unknown": Insufficient information.

Look for signals like: agency = "Department of Veterans Affairs" or "Veterans Health Administration", appointment authority, pay plan code (VN/VM/VP = Title 38, GS = Title 5, hybrid often noted in description), occupational series (0610 RN, 0602 MD = T38; 0660 Pharmacist, 0185 Social Worker = H38; 2210 IT, 0301 admin = T5).

Detect:
- Resume page limit (often 5 pages for federal; some VA JOAs say "no limit"; private-sector 2-page myth is FALSE for federal)
- Direct Hire Authority (DHA) — phrases like "direct hire", "expedited hiring", "Schedule A"
- Open to public vs internal/feds-only ("Open to: The public", "Federal employees - Competitive service")
- Specialized Experience paragraph existence

Return JSON with this exact shape (no extra keys, no markdown):
{
  "tier": "pure_title_38" | "hybrid_title_38" | "title_5" | "unknown",
  "title": "<short human title for the role, e.g., 'Registered Nurse — VA Pittsburgh Healthcare System'>",
  "summary": "<1-2 sentence plain-English summary of what tier this is and why>",
  "resume_page_limit": "<string like '5 pages', 'No limit specified', or 'Not specified'>",
  "dha_active": true | false | null,
  "open_to_public": true | false | null,
  "specialized_experience_required": true | false | null,
  "what_it_means": "<2-3 sentences explaining what this classification means for an applicant — what's different from private-sector hiring, what they should know>",
  "next_steps": ["<concrete step 1>", "<concrete step 2>", "<concrete step 3>", "<concrete step 4>"]
}

If tier is "unknown", explain in summary what info is missing. Always include 3-5 next_steps.`;

export default async function handler(req, res) {
  // CORS for any frontend on landedd.com
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY is not set.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const url = (body.url || '').trim();
  const text = (body.text || '').trim();

  if (!url && !text) {
    return res.status(400).json({ error: 'Provide either a USAJobs URL or the JOA text.' });
  }

  // Build user message
  let userContent = '';
  if (url) userContent += `USAJobs URL or announcement number: ${url}\n\n`;
  if (text) userContent += `Full JOA text:\n${text.slice(0, 30000)}\n`;
  if (!text && url) {
    userContent += `\n(Note: Only a URL was provided — classify based on whatever the URL/announcement number reveals plus VA hiring conventions. If the announcement number doesn't reveal enough, set tier to "unknown" and ask the user to paste the full text.)`;
  }

  try {
    const aRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!aRes.ok) {
      const errText = await aRes.text();
      console.error('Anthropic API error:', aRes.status, errText);
      return res.status(502).json({ error: `AI provider error (${aRes.status}). Please try again in a moment.` });
    }

    const aData = await aRes.json();
    const rawText = aData?.content?.[0]?.text || '';

    // Extract JSON (strip any accidental markdown fences)
    let jsonStr = rawText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1];

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', rawText);
      return res.status(502).json({ error: 'AI returned an unexpected format. Please try again.' });
    }

    // Minimal validation
    const validTiers = ['pure_title_38', 'hybrid_title_38', 'title_5', 'unknown'];
    if (!validTiers.includes(result.tier)) result.tier = 'unknown';
    if (!Array.isArray(result.next_steps)) result.next_steps = [];

    return res.status(200).json(result);
  } catch (err) {
    console.error('JOA classifier error:', err);
    return res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
}
