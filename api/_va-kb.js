// api/_va-kb.js
// Title 38 Knowledge Base — embedded constant for synthesis calls
// Update quarterly or when OPM/VHA issues new guidance
// Last updated: April 25, 2026

const TITLE_38_KB = `
# Title 38 Knowledge Base — Landedd VA

## 1. Title 38 — What It Is

Title 38 of the U.S. Code governs VA clinical hiring. It is structurally separate from Title 5
(standard federal civil service) and has its own pay system, hiring authority, qualification
standards, and review process.

There are three tiers a VA applicant could fall under:

| Tier | Authority | Pay | 2-page rule | Essay questions | Review body |
|---|---|---|---|---|---|
| Pure Title 38 | 38 U.S.C. § 7401 | VM (variable market) | Does NOT apply | Generally do NOT apply | Profession-specific board (NPSB for nurses) |
| Hybrid Title 38 | 38 U.S.C. § 7401(3) | GS scale | MAY apply (check JOA) | Generally DO apply | Hybrid review: HR specialist + clinical board |
| Title 5 | 5 U.S.C. | GS scale | DOES apply | DOES apply | HR specialist (USA Staffing) |

The most common JOA confusion: an applicant sees a GS pay scale and assumes Title 5 rules apply.
For Hybrid Title 38, the pay is GS but the qualification review is clinical. Misreading this leads
to wrong-format resumes.

JOA decoder logic: Look at the announcement number, occupational series, and the "Eligibility"
section. Series 0610 (Nurse), 0602 (Medical Officer), 0603 (Physician Assistant), 0680 (Dental
Officer), 0660 (Pharmacist), 0644 (Medical Technologist), 0633 (Physical Therapist), 0631
(Occupational Therapist), 0665 (Speech Pathologist), 0647 (Diagnostic Radiologic Technologist),
0185 (Social Worker), 0180 (Psychologist) — these are the most common Title 38 / Hybrid 38 series.

## 2. Pure Title 38 Occupations (5/38 Authority)

These positions have the strongest Landedd advantage — exempt from 2-page rule, exempt from essay
questions, governed by clinical boards.

- Physicians (MD, DO) — series 0602
- Dentists — series 0680
- Podiatrists — series 0668
- Optometrists — series 0662
- Chiropractors — series 0660 (overlap)
- Registered Nurses — series 0610
- Physician Assistants — series 0603
- Expanded-Function Dental Auxiliaries (EFDA) — series 0683
- Nurse Anesthetists (CRNAs) — series 0610 (specialty)

Pay system: VM pay plan for nurses; special physician pay tables for MDs/DOs; PA pay tables for PAs.
All are locality-adjusted.

Highest-volume hiring: Registered Nurses (VA is the largest single employer of RNs in the U.S.),
followed by Physicians (primary care, mental health, anesthesiology, emergency medicine).

## 3. Hybrid Title 38 Occupations

GS pay, but clinical qualification review. ~30 occupations. Critical caveat: 2-page rule and essay
questions generally apply to these. This is the trap.

Diagnostic & lab: Pharmacists (0660), Pharmacy Technicians (0661), Medical Technologists (0644),
Histopathology Technologists, Cytotechnologists, Diagnostic Radiologic Technologists (0647),
Therapeutic Radiologic Technologists, MRI Technologists, CT Technologists, Diagnostic Medical
Sonographers, Nuclear Medicine Technologists (0642).

Therapy & rehab: Physical Therapists (0633), Occupational Therapists (0631), Speech-Language
Pathologists (0665), Audiologists (0665), Recreation Therapists (0638), Creative Arts Therapists,
Kinesiotherapists, Blind Rehabilitation Specialists.

Mental health: Psychologists (0180), Social Workers (0185), Marriage and Family Therapists,
Licensed Professional Mental Health Counselors, Addiction Therapists.

Dental support: Dental Hygienists, Dental Assistants.

Other clinical: Respiratory Therapists, Medical Instrument Technicians, Industrial Hygienists,
Biomedical Engineers, Optometric Technicians, Orthotists / Prosthetists / Restoration Technicians.

## 4. NPSB — Nurse Professional Standards Board

The NPSB is the grade-determining body for VA RNs.

NPSB grade levels:
| Grade | Typical applicant |
|---|---|
| Nurse I, Level 1 | Entry RN, ADN/Diploma — limited autonomy, supervised |
| Nurse I, Level 2 | Entry RN, BSN — most BSN new grads land here |
| Nurse I, Level 3 | Experienced staff RN, BSN — demonstrated competence, no leadership |
| Nurse II | Senior staff RN, BSN, often with cert — charge nurse, preceptor |
| Nurse III | MSN or extensive specialty experience — clinical leadership |
| Nurse IV | DNP/PhD or executive clinical — program-level leadership |
| Nurse V | Executive — service-line or facility leadership |

NPSB review dimensions (three independently scored):

1. Education & Clinical Competence
   - Highest degree (ADN < BSN < MSN < DNP/PhD)
   - Specialty certifications (CCRN, CEN, OCN, etc.)
   - Continuing education evidence
   - Clinical specialty alignment with the role

2. Practice
   - Years of experience by clinical setting
   - Patient population complexity (med-surg < tele < ICU < trauma ICU)
   - Patient acuity and caseload size
   - Autonomy level (supervised, independent, charge, manager)
   - Specialty depth (generalist vs. subspecialty)

3. Performance
   - Leadership roles (charge, preceptor, mentor, committee chair)
   - Quality improvement projects (named, with outcomes)
   - Scholarly activity (publications, presentations, posters)
   - Awards and recognition

Critical insight: Most private-sector RN resumes only address dimension 2 (practice). They omit
dimensions 1 and 3. NPSB assigns the lowest defensible grade, costing the applicant 1-2 levels
and $10-30K/year in starting pay.

## 5. Required Resume Fields (Title 38 Specific)

Licensing & certification (CRITICAL):
- Active state license, number, issue/expiration date
- Compact or multistate license status
- BLS, ACLS, PALS, NRP, TNCC (current, with expiration)
- Specialty certifications (CCRN, CEN, OCN, CNOR, etc., with body and expiration)
- DEA registration (for prescribers)
- Board certification (for MD/DO/PA)

Education detail:
- Degree, school, graduation date
- For nursing: ADN/BSN/MSN/DNP, exact program
- Clinical hours / preceptorship hours (especially for new grads)

Practice detail:
- Patient population (med-surg, tele, ICU, ED, OR, etc. — be specific)
- Patient acuity (use measurable terms: ratio, complexity)
- Caseload size (e.g., "1:2 ICU ratio" or "panel of 1,200 primary care patients")
- Autonomy level
- EHR systems used (CPRS, Cerner Millennium for VA — Epic for many private)

Performance evidence:
- Quality improvement projects (named, with metric)
- Leadership roles (with scope and duration)
- Scholarly activity (publications, presentations)
- Quantified outcomes wherever possible

VA-specific:
- Veterans preference status (always, even if not a veteran)
- Citizenship status
- Selective Service registration (males)
- Prior federal experience (highest GS grade held, if any)

## 6. Common Rejection Patterns in Title 38

| Failure | Frequency | What we do about it |
|---|---|---|
| Inactive or expired license | 5-10% | Flag immediately; block submission |
| Missing scope-of-practice detail | 30%+ | Prompt for population, acuity, autonomy, ratio |
| No quantified outcomes | 40%+ | Suggest metric reframes for every duty bullet |
| Missing required certs | 15% | Enumerate required certs by JOA |
| Private-sector formatting | 60%+ | Full reformat to federal standard |
| No EHR system mention | Very common | Specifically prompt for EHR list |
| Veterans status not addressed | Common | Require field |
| Hours per week missing | Common | Require numeric value |
| Supervisor info incomplete | Common | Require name + phone + may-contact field |

## 7. Direct Hire Authority (DHA) for Title 38

DHA postings often skip questionnaire scoring, skip "Rule of Many" ranking, move directly to hiring
manager review, and move on shorter timelines (4-8 weeks vs. 12-20 weeks for competitive).

Currently active DHA (April 2026):
- Registered Nurses (DHA active across most VHA networks due to severe shortage)
- Physicians (primary care, mental health, anesthesiology, emergency)
- Pharmacists (intermittent, by network)
- Physical Therapists (intermittent)
- Medical Technologists (intermittent)

Strategic note: DHA postings are high-converting. The applicant skips the questionnaire trap, but
resume quality matters MORE because the hiring manager reads it directly.

## 8. VA Pay Scale Context

| Role | Pay system | Typical range |
|---|---|---|
| Nurse I-V | VM pay plan | $60K (Nurse I-1 rural) to $150K+ (Nurse IV major metro) |
| Nurse Anesthetist | Special pay table | $180K-260K |
| Physician Assistant | PA special pay | $100K-160K |
| Physician (primary care) | Physician special pay | $200K-280K |
| Physician (specialty) | Physician special pay | $250K-400K+ |
| Hybrid 38 (PT, OT, RT) | GS-9 to GS-13 | $60K-110K |
| Pharmacist | Hybrid 38 GS-12/13 | $90K-130K |

Loan forgiveness: Education Debt Reduction Program (up to $200K for shortage specialties),
PSLF eligibility for all federal employees.

## 9. Major VHA Networks (VISNs)

VA is organized into 18 Veterans Integrated Service Networks (VISNs).

Highest-volume: VISN 7 (Atlanta/Southeast), VISN 16 (South Central), VISN 17 (Heart of Texas),
VISN 22 (Desert Pacific).

Hardest to fill (best for applicants): VISN 19 (Rocky Mountain), VISN 20 (Northwest),
VISN 23 (Midwest) — rural facilities chronically understaffed.

Highest-volume metro VAMCs: Houston, Atlanta, San Antonio, Dallas, Phoenix, Tampa, Philadelphia,
Pittsburgh, Cleveland, Minneapolis, Salt Lake, Seattle, Portland.

## 10. What This KB Does NOT Cover (Out of Scope)

- USA Hire / technical assessments (regulated, hands-off)
- Security clearance / SF-86 documentation (sensitive, off-limits)
- SES Executive Core Qualifications
- The 4 essay questions (structural coaching only, never content)
- Disability claims or veterans benefits
- Title 5 standard GS hiring outside healthcare
`;

module.exports = { TITLE_38_KB };
