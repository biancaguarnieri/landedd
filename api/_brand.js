// api/_brand.js  — Landedd VA brand constants and transactional email templates

const LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:inline-block;vertical-align:middle;margin-right:8px;flex-shrink:0"><rect width="28" height="28" rx="6" fill="#2d6a4f"/><rect x="8" y="6" width="3.5" height="16" rx="1.75" fill="white"/><rect x="8" y="18.5" width="12" height="3.5" rx="1.75" fill="white"/></svg>`;

function emailBase({ preheader = '', body = '' }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Landedd VA</title></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:#f4f4f2;font-size:1px">${preheader}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 16px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
  <tr><td style="background:#2d6a4f;border-radius:10px 10px 0 0;padding:18px 28px">
    <a href="https://va.landedd.com" style="text-decoration:none;color:white;font-size:18px;font-weight:700;letter-spacing:-.3px">Landedd VA</a>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:0 0 10px 10px;padding:32px 28px 28px;border:1px solid #e8e8e8;border-top:none">
    ${body}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;padding-top:20px;border-top:1px solid #e8e8e8">
      <tr><td style="font-size:11px;color:#999;line-height:1.6;text-align:center">
        Landedd VA &nbsp;·&nbsp; <a href="https://va.landedd.com" style="color:#2d6a4f;text-decoration:none">va.landedd.com</a>
        &nbsp;·&nbsp; <a href="mailto:hello@landedd.com" style="color:#2d6a4f;text-decoration:none">hello@landedd.com</a><br>
        AI-generated guidance, not official federal employment advice.
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function firstName(email = '') {
  const local = (email.split('@')[0] || '').split(/[._\-+0-9]/)[0] || '';
  if (local.length < 2) return null;
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

function extractExecSummary(markdown = '') {
  const match = markdown.match(/##\s*1[.:\s]*Executive Summary\s*\n+([\s\S]*?)(?=\n##|\n---\n|$)/i);
  if (!match) return null;
  const text = match[1].replace(/\*\*/g, '').replace(/\*/g, '').trim();
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  return sentences.slice(0, 2).join(' ').substring(0, 320);
}

function processingEmail({ email = '', joaTitles = [] }) {
  const topJoa = joaTitles[0] || 'your target role';
  const name = firstName(email);
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const body = `
<p style="font-size:21px;font-weight:700;margin:0 0 6px;color:#1a1a1a">We're building your analysis</p>
<p style="font-size:14px;color:#555;margin:0 0 22px;line-height:1.6">${greeting} Your Premium VA analysis for <strong>${topJoa}</strong> is generating. It takes about 1–3 minutes.</p>
<p style="font-size:15px;color:#3d3d3d;line-height:1.7;margin:0 0 24px"><strong>You can safely close your browser.</strong> We'll email you the link to your analysis as soon as it's ready — usually within 15 minutes.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0faf4;border-radius:8px;padding:16px 20px;margin:0 0 24px">
  <tr><td style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#2d6a4f;padding-bottom:10px">What's being built for you</td></tr>
  <tr><td style="font-size:13px;color:#3d3d3d;line-height:1.9">
    ✓&nbsp; JOA tier classification (Pure vs. Hybrid Title 38)<br>
    ✓&nbsp; NPSB grade prediction with dimension scoring<br>
    ✓&nbsp; Specialized experience match — verbatim gaps identified<br>
    ✓&nbsp; Complete federal resume tailored to your top JOA<br>
    ✓&nbsp; Questionnaire strategy + 90-day application plan
  </td></tr>
</table>
<p style="font-size:13px;color:#888;line-height:1.6;margin:0">Questions? Reply to this email or contact <a href="mailto:hello@landedd.com" style="color:#2d6a4f">hello@landedd.com</a>. Your purchase is confirmed.</p>`;

  return {
    subject: 'Your VA analysis is generating — safe to close this tab',
    html: emailBase({ preheader: 'We\'ll email you the link in ~15 minutes — safe to close this tab.', body }),
  };
}

function deliveryEmail({ email = '', viewUrl = '', execSummaryPreview = '', joaTitles = [] }) {
  const name = firstName(email);
  const topJoa = joaTitles[0] || 'your target role';
  const subject = name
    ? `${name}, your VA strategy for "${topJoa}" is ready`
    : `Your VA strategy for "${topJoa}" is ready`;

  const execBlock = execSummaryPreview
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0faf4;border-left:3px solid #2d6a4f;border-radius:0 6px 6px 0;padding:14px 16px;margin:0 0 24px">
        <tr><td style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2d6a4f;padding-bottom:6px">From your Executive Summary</td></tr>
        <tr><td style="font-size:14px;color:#3d3d3d;line-height:1.7;font-style:italic">${execSummaryPreview}…</td></tr>
       </table>`
    : '';

  const body = `
<p style="font-size:21px;font-weight:700;margin:0 0 20px;color:#1a1a1a">Your Premium Analysis is Ready</p>
${execBlock}
<p style="font-size:15px;color:#3d3d3d;line-height:1.7;margin:0 0 24px">Your complete VA application strategy for <strong>${topJoa}</strong> is ready — federal resume, NPSB grade prediction, questionnaire strategy, and your 90-day plan.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
  <tr><td align="center">
    <a href="${viewUrl}" style="display:inline-block;background:#2d6a4f;color:#ffffff;text-decoration:none;padding:15px 32px;border-radius:8px;font-size:15px;font-weight:700">View Your Analysis →</a>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-radius:8px;padding:16px 20px;margin:0 0 16px;border:1px solid #e8e8e8">
  <tr><td style="font-size:13px;color:#555;line-height:1.75">
    <strong style="color:#1a1a1a">Save as PDF:</strong> Open your analysis → File → Print → Save as PDF. Already formatted for clean output.<br><br>
    <strong style="color:#1a1a1a">One follow-up question included.</strong> After you've applied, use the form in your analysis to ask what's next.
  </td></tr>
</table>
<p style="font-size:12px;color:#aaa;margin:0;word-break:break-all">Or copy this link: <a href="${viewUrl}" style="color:#2d6a4f">${viewUrl}</a></p>`;

  return { subject, html: emailBase({ preheader: execSummaryPreview || 'Your personalized VA application strategy is complete.', body }) };
}

function followupEmail({ question = '', answerMarkdown = '', viewUrl = '', email = '' }) {
  const name = firstName(email);
  const answerHtml = answerMarkdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*)/gm, '<p style="font-size:13px;font-weight:700;color:#2d6a4f;margin:12px 0 4px">$1</p>')
    .replace(/^## (.*)/gm, '<p style="font-size:14px;font-weight:700;color:#1a1a1a;margin:14px 0 5px">$1</p>')
    .replace(/^- (.*)/gm, '&nbsp;&nbsp;• &nbsp;$1<br>')
    .split('\n\n').join('</p><p style="font-size:14px;color:#3d3d3d;line-height:1.7;margin:0 0 10px">');

  const body = `
<p style="font-size:21px;font-weight:700;margin:0 0 20px;color:#1a1a1a">Your Follow-Up Answer</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;border-radius:8px;padding:14px 16px;margin:0 0 20px">
  <tr><td style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#717171;padding-bottom:6px">Your question</td></tr>
  <tr><td style="font-size:14px;color:#3d3d3d;line-height:1.6;font-style:italic">"${question}"</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
  <tr><td style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2d6a4f;padding-bottom:10px">Answer</td></tr>
  <tr><td style="font-size:14px;color:#3d3d3d;line-height:1.75"><p style="margin:0">${answerHtml}</p></td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0faf4;border-radius:8px;padding:14px 16px;border:1px solid #d8f3dc">
  <tr><td style="font-size:13px;color:#3d3d3d;line-height:1.6">
    Your included follow-up question has been used. For your next role, <a href="https://va.landedd.com#premium" style="color:#2d6a4f">get a new Premium analysis</a>.<br>
    <a href="${viewUrl}" style="color:#2d6a4f">View your full analysis →</a>
  </td></tr>
</table>`;

  return {
    subject: name ? `${name}, your VA follow-up — answer inside` : 'Your VA follow-up question — answer inside',
    html: emailBase({ preheader: 'Your personalized follow-up response is ready.', body }),
  };
}

function failureAlertEmail({ customerEmail = '', intakeId = '', sessionId = '', errorMessage = '' }) {
  const body = `
<p style="font-size:18px;font-weight:700;color:#c0392b;margin:0 0 16px">⚠ Manual Follow-Up Required</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff3f3;border-radius:8px;padding:16px;margin:0 0 16px;border:1px solid #f5c6c6">
  <tr><td style="font-size:13px;color:#3d3d3d;line-height:1.9">
    <strong>Customer:</strong> ${customerEmail}<br>
    <strong>Intake ID:</strong> ${intakeId}<br>
    <strong>Stripe Session:</strong> ${sessionId}<br>
    <strong>Error:</strong> ${errorMessage}<br>
    <strong>Time:</strong> ${new Date().toISOString()}
  </td></tr>
</table>
<p style="font-size:14px;color:#3d3d3d;line-height:1.7">Synthesis failed twice. Customer was notified of delay. Manually regenerate and send view link within 24 hours.</p>`;

  return { subject: `MANUAL FOLLOW-UP NEEDED — ${customerEmail}`, html: emailBase({ body }) };
}

module.exports = { processingEmail, deliveryEmail, followupEmail, failureAlertEmail, extractExecSummary, LOGO_SVG };
