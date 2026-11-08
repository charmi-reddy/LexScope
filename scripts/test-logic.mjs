/**
 * Quick sanity tests for the pure frontend logic (no browser needed).
 * Run: node scripts/test-logic.mjs
 */
import { parseAiJson } from '../frontend/src/services/legalAnalysisService.js'
import { normalizeAnalysis, riskCounts } from '../frontend/src/utils/analysisSchema.js'
import { locateClauses, locateQuote } from '../frontend/src/utils/highlight.js'
import { SAMPLE_DOCUMENT } from '../frontend/src/utils/sampleDocument.js'

let failures = 0
function check(label, cond, extra = '') {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures++
    console.error(`  ✗ ${label} ${extra}`)
  }
}

console.log('parseAiJson:')
{
  const fenced = '```json\n{"summary": "ok", "clauses": []}\n```'
  check('strips fences', parseAiJson(fenced).summary === 'ok')
  const prose = 'Here is your analysis:\n{"a": 1}\nHope that helps!'
  check('finds object in prose', parseAiJson(prose).a === 1)
  const trailing = '{"list": [1, 2,], "x": "y",}'
  check('tolerates trailing commas', parseAiJson(trailing).x === 'y')
  let threw = false
  try { parseAiJson('no json here') } catch { threw = true }
  check('throws on no JSON', threw)
}

console.log('normalizeAnalysis:')
{
  const malformed = {
    summary: 'Test summary.',
    overall_risk: 'CRITICAL', // invalid enum → high
    key_takeaways: ['point one', { text: 'point two' }, '', null],
    clauses: [
      {
        title: 'Termination', category: 'terminashun', // invalid → other
        original_text: 'Either party may terminate.',
        risk_level: 'severe', // invalid → medium? mapped to high
      },
      { /* empty clause → dropped */ },
    ],
    red_flags: 'not-an-array', // → []
    important_dates: ['1 March 2026', { when: '1 April 2027', what: 'Salary review' }],
  }
  const { analysis, issues } = normalizeAnalysis(malformed)
  check('clamps overall risk', analysis.overall_risk === 'high', `got ${analysis.overall_risk}`)
  check('coerces takeaway objects', analysis.key_takeaways.length === 2, JSON.stringify(analysis.key_takeaways))
  check('maps unknown category → other', analysis.clauses[0].category === 'other')
  check('clamps clause risk (severe→high)', analysis.clauses[0].risk_level === 'high')
  check('drops empty clauses', analysis.clauses.length === 1)
  check('non-array red_flags → []', analysis.red_flags.length === 0)
  check('string dates normalized', analysis.important_dates[0].date === '1 March 2026')
  check('object dates mapped', analysis.important_dates[1].date === '1 April 2027' && analysis.important_dates[1].description === 'Salary review')

  const quoteValid = normalizeAnalysis({
    red_flags: [{
      title: 'Uncapped liability',
      severity: 'high',
      explanation: 'The company may be liable beyond the contract limit.',
      supporting_quote: 'The Employee shall indemnify and hold harmless the Company against any and all claims, damages, losses, costs, and expenses arising from acts or omissions of the Employee in the course of employment.',
    }],
  })
  check('supporting_quote kept', quoteValid.analysis.red_flags[0]?.supporting_quote === 'The Employee shall indemnify and hold harmless the Company against any and all claims, damages, losses, costs, and expenses arising from acts or omissions of the Employee in the course of employment.')
  check('missing supporting_quote normalizes to empty string', normalizeAnalysis({ red_flags: [{ explanation: 'No cap' }] }).analysis.red_flags[0].supporting_quote === '')
  const nonArrayFlags = normalizeAnalysis({ red_flags: 'not-an-array' })
  check('malformed red flags -> empty list', Array.isArray(nonArrayFlags.analysis.red_flags) && nonArrayFlags.analysis.red_flags.length === 0)
  check('issues reported', issues.length > 0)
  const empty = normalizeAnalysis(null)
  check('null input → safe empty shape', Array.isArray(empty.analysis.clauses) && typeof empty.analysis.summary === 'string')
  const rc = riskCounts(analysis)
  check('risk counts add up', rc.clauses.high === 1 && rc.clauses.medium === 0)
}

console.log('locateQuote:')
{
  const doc = 'The Company may terminate this Agreement with seven (7) days\' written notice. The Employee shall not solicit any client.'
  const exact = locateQuote(doc, 'terminate this Agreement with seven (7) days\' written notice')
  check('exact quote -> exact', exact.status === 'exact')

  const smart = locateQuote(doc, 'terminate this Agreement with seven (7) days\u2019 written notice')
  check('smart quotes/whitespace differences still found', smart.status === 'exact')

  const paraphrased = locateQuote(doc, 'terminate the agreement with a brief notice period')
  check('lightly reworded quote -> approximate', paraphrased.status === 'approximate')

  const invented = locateQuote(doc, 'The Company may instantly fire the employee without notice.')
  check('invented sentence -> not_found', invented.status === 'not_found')

  check('empty quote -> none', locateQuote(doc, '').status === 'none')
}

console.log('locateClauses:')
{
  const doc = SAMPLE_DOCUMENT.text
  const verbatim =
    'The Employee shall indemnify and hold harmless the Company against any and all claims, damages, losses, costs, and expenses arising from acts or omissions of the Employee in the course of employment.'
  const multiLine =
    'All work product, inventions, ideas, source code, and materials conceived by the Employee during the term of this Agreement, whether or not created during working hours and whether or not in the course of the Employee\'s duties, shall be the sole and exclusive property of the Company.'
  const ellipsis =
    'For a period of twenty-four (24) months following termination of this Agreement for any reason … The Employee shall also not solicit any client or employee of the Company during this period.'
  const paraphrased = 'The employee must never work for a competitor ever again in any country.' // not in doc

  const clauses = [
    { id: 'c1', original_text: verbatim, risk_level: 'high' },
    { id: 'c2', original_text: multiLine, risk_level: 'high' }, // note: line break in doc
    { id: 'c3', original_text: ellipsis, risk_level: 'medium' },
    { id: 'c4', original_text: paraphrased, risk_level: 'low' },
  ]
  const { highlights, located, citations, locatedCount, notFoundIds } = locateClauses(doc, clauses)
  const byId = Object.fromEntries(highlights.map((h) => [h.id, h]))

  check('verbatim clause located', !!byId.c1 && byId.c1.match === 'exact')
  check('located text round-trips', byId.c1 && doc.slice(byId.c1.start, byId.c1.end).includes('indemnify and hold harmless'))
  check('multiline clause located (exact, whitespace-normalized)', !!byId.c2 && byId.c2.match === 'exact')
  check('ellipsis clause located (partial)', !!byId.c3 && byId.c3.match === 'partial')
  check('paraphrased clause NOT highlighted', !byId.c4)
  check('located count = 3', located === 3, `got ${located}`)
  check('citations map has entry per clause', Object.keys(citations).length === clauses.length)
  check('locatedCount includes found clauses before overlap removal', locatedCount === 3)
  check('nonfound clause tracked separately', notFoundIds.includes('c4') && notFoundIds.length === 1)

  // Overlap resolution
  const overlap = locateClauses(doc, [
    { id: 'x1', original_text: 'All work product, inventions, ideas, source code, and materials conceived by the Employee', risk_level: 'low' },
    { id: 'x2', original_text: 'All work product, inventions, ideas, source code, and materials conceived by the Employee during the term of this Agreement, whether or not created during working hours', risk_level: 'high' },
  ])
  check('overlapping highlights resolve without crash', overlap.highlights.every((h, i, arr) => i === 0 || h.start >= arr[i - 1].end))
  check('overlap still counts both before drop', overlap.locatedCount === 2 && overlap.notFoundIds.length === 0)

  // Fuzzy path: slight wording drift
  const drifted = 'All work product, inventions, ideas, source code and materials conceived by the Employee during the term of this Agreement, whether or not created during working hours and whether or not in the course of the Employee duties, shall be the sole and exclusive property of the Company.'
  const fz = locateClauses(doc, [{ id: 'f1', original_text: drifted, risk_level: 'medium' }])
  check('drifted wording located via fuzzy', fz.highlights.length === 1 && fz.highlights[0].match === 'fuzzy', JSON.stringify(fz.highlights))
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
