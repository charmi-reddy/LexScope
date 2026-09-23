/**
 * End-to-end pipeline test with a MOCKED window.puter.
 * Simulates exactly what the browser does: analyzeLegalDocument → puter.ai.chat
 * (fake Gemini response, code-fenced, slightly messy on purpose) → parse →
 * normalize → analysis result.
 *
 * Run: node scripts/test-pipeline.mjs
 */
import { analyzeLegalDocument } from '../frontend/src/services/legalAnalysisService.js'
import { SAMPLE_DOCUMENT } from '../frontend/src/utils/sampleDocument.js'

// --- Fake Puter global (mirrors the real window.puter surface we use) -------
const GEMINI_PAYLOAD = `Here is the analysis you requested:

\`\`\`json
{
  "summary": "This is a fictional employment agreement between Hopwell Analytics Pte. Ltd. and Jordan Blake for a Senior Data Analyst role. It sets a six-month probation, a salary of SGD 8,500 paid up to 60 days after month end, and gives the company very broad rights over intellectual property, non-compete restrictions, monitoring, and amendment of the contract itself. Several clauses are notably one-sided and deserve close attention before signing.",
  "document_type": "Employment agreement",
  "overall_risk": "high",
  "key_takeaways": [
    "Salary arrives up to 60 days after each month ends — a long payment cycle.",
    "Everything you create, even in your own time, belongs to the company.",
    "You cannot work for any competitor worldwide for 24 months after leaving.",
    "The company can end your employment with 1 week's notice, but you need 3 months' notice to resign.",
    "The company can amend any clause by notice, and continued employment counts as acceptance."
  ],
  "clauses": [
    {
      "title": "Liability and indemnity (uncapped)",
      "category": "indemnity",
      "original_text": "The Employee shall indemnify and hold harmless the Company against any and all claims, damages, losses, costs, and expenses arising from acts or omissions of the Employee in the course of employment. This indemnity is not subject to any monetary cap.",
      "plain_language": "If the company claims your work caused it harm, you must pay it back for every loss, and there is no upper limit on the amount.",
      "risk_level": "high",
      "why_it_matters": "An uncapped indemnity can expose you to unlimited personal financial risk. Employment-related indemnities are unusual and in some jurisdictions may be limited by law.",
      "suggested_action": "Ask for the indemnity to be capped (e.g. at a few months' salary) and limited to losses caused by gross negligence."
    },
    {
      "title": "Termination notice asymmetry",
      "category": "termination",
      "original_text": "After the probationary period, the Company may terminate this Agreement with one (1) week's written notice or payment in lieu. The Employee must give the Company three (3) months' written notice of resignation.",
      "plain_language": "The company can let you go with one week's notice, but if you want to leave, you must give three months' notice.",
      "risk_level": "high",
      "why_it_matters": "The 12x difference in notice periods makes it much easier for the employer to end the relationship than for you — and a 3-month notice can block job offers you may want to accept.",
      "suggested_action": "Ask for symmetric notice periods (e.g. one month each) or a shorter employee notice."
    },
    {
      "title": "Unilateral amendment",
      "category": "other",
      "original_text": "The Company may amend any clause of this Agreement by written notice to the Employee, and continued employment shall constitute acceptance of the amended terms.",
      "plain_language": "The company can change any part of this contract at any time, and just by continuing to work you are considered to have agreed to the changes.",
      "risk_level": "high",
      "why_it_matters": "This undermines every guarantee in the document — salary, notice, benefits could all be changed after you sign. In many jurisdictions such clauses are unenforceable, but contesting them is costly.",
      "suggested_action": "Ask that amendments require mutual written agreement."
    },
    {
      "title": "Salary payment terms",
      "category": "payment",
      "original_text": "The Company shall pay the Employee a monthly salary of SGD 8,500 (eight thousand five hundred dollars), payable within sixty (60) days of the end of each calendar month.",
      "plain_language": "You are paid SGD 8,500 a month, but the money can arrive up to two months after the month you worked.",
      "risk_level": "medium",
      "why_it_matters": "A 60-day payment window is unusually long for salaries and can strain personal cash flow. Most employment contracts pay monthly in arrears within days, not months.",
      "suggested_action": "Ask for payment within 7–14 days of month end, and check local law — some jurisdictions require salary within a fixed number of days."
    },
    {
      "title": "Confidentiality",
      "category": "confidentiality",
      "original_text": "The Employee shall keep secret all information relating to the Company's business, customers, suppliers, financial affairs, and plans, whether or not marked confidential, during employment and at all times thereafter, unless the information enters the public domain other than through the Employee's breach.",
      "plain_language": "You must never share company information, even after you leave, unless it becomes public through no fault of yours.",
      "risk_level": "low",
      "why_it_matters": "Confidentiality obligations are standard, but this one is unlimited in time and covers anything 'relating to' the company, whether or not it was marked confidential.",
      "suggested_action": "Check that the definition excludes general skills and knowledge you take with you."
    }
  ],
  "red_flags": [
    {
      "title": "Unlimited liability",
      "severity": "high",
      "explanation": "Clause 8 states the indemnity 'is not subject to any monetary cap'. Unlike a normal work-performance duty, an uncapped indemnity means potentially unbounded personal payments to the company. The wording is broad enough to cover ordinary mistakes, not just misconduct.",
      "related_clause": "Liability and indemnity (uncapped)"
    },
    {
      "title": "One-sided termination rights",
      "severity": "high",
      "explanation": "The company can terminate with one week's notice while the employee owes three months' notice. Combined with 'termination without severance' during probation, exits are structured entirely in the employer's favour.",
      "related_clause": "Termination notice asymmetry"
    },
    {
      "title": "Broad intellectual-property transfer",
      "severity": "medium",
      "explanation": "The IP clause covers inventions 'whether or not created during working hours and whether or not in the course of the Employee's duties' — including work unrelated to the job. Some jurisdictions refuse to enforce such breadth for entirely personal projects.",
      "related_clause": "Intellectual property"
    }
  ],
  "obligations": [
    "Employee: keep all company information confidential during and after employment",
    "Employee: reimburse training costs (up to 6 months' salary) if resigning within 24 months of funded training",
    "Employee: give 3 months' notice to resign",
    "Company: pay SGD 8,500 monthly within 60 days of month end",
    "Company: provide 44-hour working week baseline"
  ],
  "important_dates": [
    { "date": "1 March 2026", "description": "Effective date of the agreement" },
    { "date": "1 September 2026", "description": "End of the six-month probationary period (approximate)" },
    { "date": "1 April 2027", "description": "Earliest salary review date" }
  ],
  "questions_to_ask": [
    "Can the uncapped indemnity in clause 8 be capped at a fixed amount?",
    "Why is the notice period one week for the company but three months for me — can they be made equal?",
    "Does the intellectual-property clause apply to personal projects I work on outside hours?",
    "Can the 60-day salary payment window be shortened?",
    "What exactly counts as 'Company-funded training' under clause 11?",
    "Will the company agree that contract changes always require mutual written consent?"
  ]
}
\`\`\`

Let me know if you need anything else!`

let chatCalls = 0

// --- Fake backend AI proxy (mirrors POST /api/ai/chat) ----------------------
globalThis.fetch = async (url, options) => {
  chatCalls++
  const body = JSON.parse(options.body)
  if (url !== '/api/ai/chat') throw new Error('unexpected url: ' + url)
  if (body.model !== 'google/gemini-2.5-flash') throw new Error('unexpected model: ' + body.model)
  if (!Array.isArray(body.messages) || body.messages.length < 2) throw new Error('expected system+user messages')
  return {
    ok: true,
    status: 200,
    json: async () => ({ text: GEMINI_PAYLOAD, model: body.model, usage: { prompt_tokens: 1, completion_tokens: 1 } }),
  }
}

// --- Run the pipeline exactly like the UI does ------------------------------
const stages = []
const { analysis, meta } = await analyzeLegalDocument({
  text: SAMPLE_DOCUMENT.text,
  name: SAMPLE_DOCUMENT.name,
  onStage: (s) => stages.push(s),
})

let failures = 0
const check = (label, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.error(`  ✗ ${label} ${extra}`) }
}

check('called Gemini once (no repair round needed)', chatCalls === 1, `calls=${chatCalls}`)
check('progress stages emitted', stages.join(',') === 'connect,analyzing,parsing', stages.join(','))
check('model recorded', meta.model === 'google/gemini-2.5-flash')
check('document_type parsed', analysis.document_type === 'Employment agreement')
check('overall risk = high', analysis.overall_risk === 'high')
check('5 clauses normalized', analysis.clauses.length === 5, `got ${analysis.clauses.length}`)
check('clause ids assigned', analysis.clauses[0].id === 'clause-1' && analysis.clauses[4].id === 'clause-5')
check('categories kept', analysis.clauses[0].category === 'indemnity')
check('3 red flags', analysis.red_flags.length === 3)
check('dates structured', analysis.important_dates.length === 3 && analysis.important_dates[0].date === '1 March 2026')
check('obligations array', analysis.obligations.length === 5)
check('questions array', analysis.questions_to_ask.length === 6)
check('no normalization issues', (meta.issues || []).length === 0, JSON.stringify(meta.issues))

// Highlight integration: every quoted clause should locate in the sample doc
const { locateClauses } = await import('../frontend/src/utils/highlight.js')
const { highlights, located } = locateClauses(SAMPLE_DOCUMENT.text, analysis.clauses)
check('all 5 clause excerpts locate in the real document', located === 5, `located=${located}`)

console.log(failures === 0 ? '\nPIPELINE TEST PASSED' : `\n${failures} PIPELINE TEST(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
