// api/joa-classifier.js
// Classifies a VA job announcement into Pure Title 38, Hybrid Title 38, or Title 5
// Returns structured JSON for the frontend to render
// Uses Claude Haiku (cheap — this is a free tool)

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a federal VA hiring expert. Your job is to classify a VA job announcement (JOA) and explain exactly which rules apply to the applicant.

You have deep knowledge of Title 38 of the U.S. Code and VA hiring:

PURE TITLE 38 series (VM pay, no 2-page rule, no essay questions, NPSB/clinical board review):
- 0602 Physicians (MD/DO), 0603 Physician Assistants, 0610 Registered Nurses (including CRNAs), 0660 Chiropractors/Optometrists, 0662 Optometrists, 0668 Podiatrists, 0680 Dentists, 0683 EFDA

HYBRID TITLE 38 series (GS pay, 2-page rule MAY apply, essay questions generally apply, clinical + HR review):
- 0180 Psychologists, 0185 Social Workers, 0631 OT, 0633 PT, 0638 Recreation Therapists, 0644 Medical Technologists, 0647 Diagnostic Radiologic Technologists, 0660 Pharmacists, 0661 Pharmacy Technicians, 0665 Speech-Language Pathologists/Audiologists, and other allied health series with GS pay

TITLE 5 (standard GS, 2-page rule applies, essay questions apply, HR specialist review):
- All non-clinical roles, administrative roles, any GS series not in the Hybrid 38 list above

DIRECT HIRE AUTHORITY (DHA): Currently active for RNs (nearly nationwide), certain physician specialties (primary care, mental health, anesthesiology, emergency), pharmacists (intermittent), PTs (intermittent), medical technologists (intermittent). DHA = resume goes directly to hiring manager, faster timeline (4-8 weeks vs. 12-20 weeks).

NPSB (Nurse Professional Standards Board): Only applies to series 0610 (RNs). NPSB grades on 3 dimensions: Education & Clinical Competence, Practice, Performance. Most private-sector RN resumes only address Practice — costing applicants 1-2 grade levels and $10-30K/year in starting pay.

Analyze the provided JOA text and return ONLY valid JSON in this exact structure (no markdown, no explanation outside the JSON):

{
  "tier": "pure_38" | "hybrid_38" | "title_5",
  "tier_label": "Pure Title 38" | "Hybrid Title 38" | "Title 5",
  "series": "0610",
  "series_name": "Registered Nurse",
  "role_title": "The exact job title from the JOA",
  "confidence": "high" | "medium" | "low",
  "dha_active": true | false,
  "dha_note": "string or null — brief note on DHA status",
  "npsb_applies": true | false,
  "two_page_rule": "exempt" | "applies" | "may_apply",
  "essay_questions": "exempt" | "applies" | "likely_applies",
  "pay_system": "VM" | "GS" | "Special",
  "vamc": "string or null — name of the VA medical center if identifiable",
  "rules": [
    {
      "rule": "Short rule name",
      "status": "good" | "caution" | "required",
      "detail": "One sentence explaining what this means for the applicant"
    }
  ],
  "key_insight": "2-3 sentences. The single most important thing this applicant needs to know about this specific posting that most applicants get wrong.",
  "premium_hook": "1 sentence. A specific, factual reason why Premium analysis would help for THIS posting — reference the tier, NPSB, DHA, or other specific detail."
}

Rules array should include 4-6 items covering: resume length, essay questions, review body, DHA status, NPSB (if applicable), timeline.
Keep all text concise and actionable. Never invent data not in the JOA.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { joa_text } = req.body || {};

  if (!joa_text || joa_text.trim().length < 100) {
    return res.status(400).json({ error: 'Please paste the full job announcement text (at least a few paragraphs).' });
  }

  if (joa_text.length > 30000) {
    return res.status(400).json({ error: 'JOA text is too long. Please trim to the key sections (Duties, Qualifications, How to Apply).' });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify this VA job announcement:\n\n${joa_text.trim()}`,
        },
      ],
    });

    const raw = message.content[0]?.text?.trim();
    if (!raw) throw new Error('Empty response from AI');

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const result = JSON.parse(cleaned);

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('JOA classifier error:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'AI returned unexpected format. Please try again.' });
    }
    return res.status(500).json({ error: 'Classification failed. Please try again or email hello@landedd.com.' });
  }
};
