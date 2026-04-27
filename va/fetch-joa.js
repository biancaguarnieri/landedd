// api/fetch-joa.js
// Fetches job details from the official USAJobs REST API given a USAJobs URL.
// Requires: USAJOBS_API_KEY env var (free key from developer.usajobs.gov)
// User-Agent is set to hello@landedd.com per USAJobs API requirements.
//
// USAJobs URL formats supported:
//   https://www.usajobs.gov/job/12345678
//   https://www.usajobs.gov/GetJob/ViewDetails/12345678

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  // Extract control number from URL
  // Matches: /job/12345678 or /GetJob/ViewDetails/12345678
  const match = url.match(/\/(?:job|GetJob\/ViewDetails)\/(\d+)/i);
  if (!match) {
    return res.status(400).json({
      error: 'Could not find a USAJobs job ID in that URL. Make sure you\'re pasting a link like https://www.usajobs.gov/job/12345678'
    });
  }

  const controlNumber = match[1];
  const apiKey = process.env.USAJOBS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'USAJobs API not configured' });
  }

  try {
    const apiUrl = `https://data.usajobs.gov/api/Search?ControlNumber=${controlNumber}&ResultsPerPage=1`;
    const response = await fetch(apiUrl, {
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': 'hello@landedd.com',
        'Authorization-Key': apiKey
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('USAJobs API error:', response.status, errText);
      return res.status(502).json({ error: 'USAJobs API error — please paste the job text directly instead.' });
    }

    const data = await response.json();
    const items = data?.SearchResult?.SearchResultItems;

    if (!items || items.length === 0) {
      return res.status(404).json({
        error: 'Job not found. The posting may be closed. For closed postings, paste the job text directly.'
      });
    }

    const job = items[0].MatchedObjectDescriptor;

    // Extract all useful fields for classification
    const parts = [];

    if (job.PositionTitle) parts.push('Position Title: ' + job.PositionTitle);
    if (job.OrganizationName) parts.push('Organization: ' + job.OrganizationName);
    if (job.DepartmentName) parts.push('Department: ' + job.DepartmentName);

    // Series / occupation
    const series = job.JobCategory;
    if (series && series.length > 0) {
      parts.push('Occupational Series: ' + series.map(s => s.Code + ' (' + s.Name + ')').join(', '));
    }

    // Pay plan and grade
    const grades = job.JobGrade;
    if (grades && grades.length > 0) {
      parts.push('Pay Plan / Grade: ' + grades.map(g => (g.Code || '') + ' ' + (g.MinimumRange || '') + '-' + (g.MaximumRange || '')).join(', '));
    }

    // Pay range
    const pay = job.PositionRemuneration;
    if (pay && pay.length > 0) {
      parts.push('Salary Range: $' + pay[0].MinimumRange + ' – $' + pay[0].MaximumRange + ' per year');
    }

    // Work schedule, appointment type
    const sched = job.PositionSchedule;
    if (sched && sched.length > 0) parts.push('Work Schedule: ' + sched.map(s => s.Name).join(', '));

    const appt = job.PositionOfferingType;
    if (appt && appt.length > 0) parts.push('Appointment Type: ' + appt.map(a => a.Name).join(', '));

    // Who may apply
    const userArea = job.UserArea;
    if (userArea && userArea.Details) {
      const d = userArea.Details;
      if (d.WhoMayApply && d.WhoMayApply.Name) parts.push('Who May Apply: ' + d.WhoMayApply.Name);
      if (d.JobSummary) parts.push('Job Summary:\n' + d.JobSummary);
      if (d.MajorDuties) parts.push('Major Duties:\n' + d.MajorDuties.join('\n'));
      if (d.Requirements) parts.push('Requirements:\n' + d.Requirements);
      if (d.Evaluations) parts.push('How You Will Be Evaluated:\n' + d.Evaluations);
      if (d.RequiredDocuments) parts.push('Required Documents:\n' + d.RequiredDocuments);
    }

    // Qualifications
    if (job.QualificationSummary) {
      parts.push('Qualifications:\n' + job.QualificationSummary);
    }

    // Announcement number
    if (job.PositionID) parts.push('Announcement Number: ' + job.PositionID);

    // Location
    const locs = job.PositionLocation;
    if (locs && locs.length > 0) {
      parts.push('Location: ' + locs.map(l => l.LocationName + ', ' + l.CountrySubDivisionCode).join(' | '));
    }

    const text = parts.join('\n\n');

    // Flag if we got limited data (missing duties/qualifications)
    const hasFullText = text.length > 800;
    const warning = hasFullText
      ? null
      : 'Limited data returned from USAJobs API for this posting. For highest accuracy, paste the full job description text directly.';

    return res.status(200).json({ text, warning, controlNumber });

  } catch (err) {
    console.error('fetch-joa error:', err);
    return res.status(500).json({ error: 'Could not fetch job data. Please paste the job text directly.' });
  }
};
