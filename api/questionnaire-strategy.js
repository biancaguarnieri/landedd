// api/questionnaire-strategy.js
// Analyzes a VA JOA's self-assessment questionnaire criteria and tells the applicant
// how to rate themselves accurately (not modestly) — the "deflation fix"
// Uses Claude Haiku (free tool)

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a federal VA hiring expert specializing in USAJobs self-assessment questionnaires.

The self-assessment questionnaire is where qualified VA applicants get eliminated. Most applicants systematically underrate themselves — they pick "B: I have training in this area" when their actual experience clearly supports "D: I have trained others in this area." This costs them referral status entirely.

Your job: analyze the JOA text, identify the qualification criteria and questionnaire scoring pattern, and tell the applicant how to rate themselves accurately.

QUESTIONNAIRE SCORING BASICS:
- VA self-assessments typically use a 5-point scale (A-E) or a Yes/No format
- Common scale: A=No experience, B=Training only, C=Performed under supervision, D=Performed independently, E=Trained/supervised others
- Each question maps to a KSA (Knowledge, Skill, Ability) from the qualification standard
- Choosing too-low answers can disqualify an otherwise qualified applicant before a human ever sees their resume
- The "deflation trap": applicants read "independently" and think it means "without any oversight ever" — it actually means "without needing day-to-day supervision"

PURE TITLE 38 EXCEPTION: Pure Title 38 roles (RNs, MDs, PAs, Dentists) typically do NOT use a scored questionnaire — they go straight to clinical board or NPSB review. If the JOA is Pure Title 38, explain this and redirect to resume quality instead.

DHA EXCEPTION: Direct Hire Authority postings sometimes skip the questionnaire entirely. Note this if detected.

Analyze the provided JOA and return ONLY valid JSON (no markdown, no explanation outside JSON):

{
  "tier": "pure_38" | "hybrid_38" | "title_5",
  "questionnaire_applies": true | false,
  "questionnaire_note": "Brief explanation of why questionnaire does/doesn't apply for this posting",
  "scoring_pattern": "5_point_scale" | "yes_no" | "narrative" | "none" | "unknown",
  "key_trap": "The single most common deflation mistake applicants make on this TYPE of questionnaire — 2 sentences max.",
  "criteria": [
    {
      "ksa": "Short name of the KSA or competency area",
      "what_they_test": "What this question is really measuring — 1 sentence",
      "deflation_risk": "high" | "medium" | "low",
      "rating_guidance": "Specific guidance on how to rate yourself accurately here — what experience actually supports D vs E, etc. 2-3 sentences."
    }
  ],
  "general_rules": [
    "Rule 1 — brief, actionable",
    "Rule 2 — brief, actionable",
    "Rule 3 — brief, actionable",
    "Rule 4 — brief, actionable"
  ],
  "premium_hook": "1 sentence. A specific reason why the Premium analysis would help — reference their role, tier, or a specific gap in their strategy."
}

Extract 3-6 criteria from the JOA's qualifications/questionnaire sections. If the full questionnaire isn't in the JOA text, infer the likely KSAs from the qualifications section and Specialized Experience paragraph — these almost always map directly to questionnaire items.

Keep guidance specific and actionable. Never say "be honest" or "answer accurately" without explaining what accuracy actually means for that item.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { joa_text } = req.body || {};

  if (!joa_text || joa_text.trim().length < 100) {
    return res.status(400).json({ error: 'Please paste the full job announcement text.' });
  }

  if (joa_text.length > 30000) {
    return res.status(400).json({ error: 'JOA text is too long. Please trim to key sections.' });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze the questionnaire strategy for this VA job announcement:\n\n${joa_text.trim()}`,
        },
      ],
    });

    const raw = message.content[0]?.text?.trim();
    if (!raw) throw new Error('Empty response from AI');

    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const result = JSON.parse(cleaned);

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Questionnaire strategy error:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'AI returned unexpected format. Please try again.' });
    }
    return res.status(500).json({ error: 'Analysis failed. Please try again or email hello@landedd.com.' });
  }
};
