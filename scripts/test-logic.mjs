/**
 * Quick sanity tests for the pure frontend logic (no browser needed).
 * Run: node scripts/test-logic.mjs
 */
import { parseAiJson } from '../frontend/src/services/legalAnalysisService.js'
import { normalizeAnalysis, riskCounts } from '../frontend/src/utils/analysisSchema.js'
import { locateClauses, locateQuote } from '../frontend/src/utils/highlight.js'
import { pickTopFindings } from '../frontend/src/utils/topFindings.js'
import { printTitle } from '../frontend/src/utils/printReport.js'
import {
  loadHistory,
  saveToHistory,
  removeFromHistory,
  MAX_HISTORY_ENTRIES,
} from '../frontend/src/utils/historyStorage.js'
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

console.log('pickTopFindings:')
{
  const doc = 'Payment due in 7 days. Confidential terms apply. Liability is unlimited in scope.'

  const noFlags = pickTopFindings({ red_flags: [] }, doc)
  check('0 flags returns []', Array.isArray(noFlags) && noFlags.length === 0)

  const twoFlags = pickTopFindings(
    {
      red_flags: [
        { id: 'f1', title: 'A', severity: 'medium', explanation: 'A.', supporting_quote: 'Payment due in 7 days.' },
        { id: 'f2', title: 'B', severity: 'low', explanation: 'B.', supporting_quote: '' },
      ],
    },
    doc,
  )
  check('2 flags returns 2 items', twoFlags.length === 2)

  const fiveFlags = pickTopFindings(
    {
      red_flags: [
        { id: 'f-low-1', title: 'Low 1', severity: 'low', explanation: 'Low.', supporting_quote: '' },
        { id: 'f-med-1', title: 'Med 1', severity: 'medium', explanation: 'Med.', supporting_quote: '' },
        { id: 'f-high-1', title: 'High 1', severity: 'high', explanation: 'High.', supporting_quote: '' },
        { id: 'f-low-2', title: 'Low 2', severity: 'low', explanation: 'Low.', supporting_quote: '' },
        { id: 'f-med-2', title: 'Med 2', severity: 'medium', explanation: 'Med.', supporting_quote: '' },
      ],
    },
    doc,
  )
  check('5 flags returns 3 items', fiveFlags.length === 3)
  check('high before medium before low', fiveFlags.map((f) => f.severity).join(',') === 'high,medium,medium')

  const exactQuote = pickTopFindings(
    {
      red_flags: [
        {
          id: 'f-exact',
          title: 'Exact quote',
          severity: 'high',
          explanation: 'Exact quote explanation.',
          supporting_quote: 'Confidential terms apply.',
        },
      ],
    },
    doc,
  )[0]
  const start = doc.indexOf('Confidential terms apply.')
  const end = start + 'Confidential terms apply.'.length
  check('exact quote gets span with correct start/end', exactQuote.span?.start === start && exactQuote.span?.end === end)

  const notInDoc = pickTopFindings(
    {
      red_flags: [
        {
          id: 'f-miss',
          title: 'Missing quote',
          severity: 'medium',
          explanation: 'Missing quote explanation.',
          supporting_quote: 'This sentence does not exist in the source text.',
        },
      ],
    },
    doc,
  )[0]
  check('quote not in document gets span null', notInDoc.span === null)

  const noQuote = pickTopFindings(
    {
      red_flags: [
        {
          id: 'f-no-quote',
          title: 'No quote',
          severity: 'low',
          explanation: 'No quote explanation.',
          supporting_quote: '',
        },
      ],
    },
    doc,
  )[0]
  check('no quote gets span null', noQuote.span === null)
}

console.log('historyStorage:')
{
  function createFakeStorage() {
    const data = new Map()
    return {
      getItem(key) {
        return data.has(key) ? data.get(key) : null
      },
      setItem(key, value) {
        data.set(key, String(value))
      },
      removeItem(key) {
        data.delete(key)
      },
    }
  }

  function makePayload(i, text = `Doc ${i}`) {
    return {
      analysis: { summary: `Summary ${i}`, overall_risk: 'medium', document_type: 'agreement' },
      meta: { model: 'test-model' },
      source: { name: `Document ${i}`, text },
    }
  }

  const storage = createFakeStorage()
  check('loadHistory on empty storage returns []', Array.isArray(loadHistory(storage)) && loadHistory(storage).length === 0)

  saveToHistory(makePayload(1), storage, 1001)
  const one = loadHistory(storage)
  check('save/load round-trip keeps source.name', one.length === 1 && one[0].source.name === 'Document 1')
  check('save/load round-trip keeps analysis', one.length === 1 && one[0].analysis.summary === 'Summary 1')

  saveToHistory(makePayload('A'), storage, 2001)
  saveToHistory(makePayload('B'), storage, 2002)
  const newestFirst = loadHistory(storage)
  check('saving entry A then B puts B first', newestFirst[0]?.source?.name === 'Document B')

  const cappedStorage = createFakeStorage()
  for (let i = 0; i < MAX_HISTORY_ENTRIES + 2; i++) {
    saveToHistory(makePayload(i), cappedStorage, 3000 + i)
  }
  const capped = loadHistory(cappedStorage)
  check('history keeps exactly MAX_HISTORY_ENTRIES', capped.length === MAX_HISTORY_ENTRIES)
  check('history drops oldest entries', capped[capped.length - 1]?.source?.name === 'Document 2')

  const removeStorage = createFakeStorage()
  const r1 = saveToHistory(makePayload('x1'), removeStorage, 4101)
  saveToHistory(makePayload('x2'), removeStorage, 4102)
  const removed = removeFromHistory(r1[0].id, removeStorage)
  check('removeFromHistory removes only matching id', removed.length === 1 && removed[0].source.name === 'Document x2')

  const invalidJsonStorage = {
    getItem() {
      return '{broken-json'
    },
    setItem() {},
    removeItem() {},
  }
  check('invalid JSON returns []', Array.isArray(loadHistory(invalidJsonStorage)) && loadHistory(invalidJsonStorage).length === 0)

  const alwaysThrowStorage = {
    getItem() {
      return null
    },
    setItem() {
      throw new Error('quota')
    },
    removeItem() {},
  }
  let throwResult = null
  let throwCrashed = false
  try {
    throwResult = saveToHistory(makePayload('throw'), alwaysThrowStorage, 5001)
  } catch {
    throwCrashed = true
  }
  check('setItem throwing does not crash saveToHistory', !throwCrashed)
  check('setItem throwing still returns a list', Array.isArray(throwResult) && throwResult.length >= 1)

  const limitedMap = new Map()
  const limitedStorage = {
    getItem(key) {
      return limitedMap.has(key) ? limitedMap.get(key) : null
    },
    setItem(key, value) {
      if (String(value).length > 2000) throw new Error('too big')
      limitedMap.set(key, String(value))
    },
    removeItem(key) {
      limitedMap.delete(key)
    },
  }
  let largeText = 'x'.repeat(100)
  while (true) {
    const oneSize = JSON.stringify([{ ...makePayload('probe-1', largeText), id: 'id-1', createdAt: 1 }]).length
    const twoSize = JSON.stringify([
      { ...makePayload('probe-2', largeText), id: 'id-2', createdAt: 2 },
      { ...makePayload('probe-1', largeText), id: 'id-1', createdAt: 1 },
    ]).length
    if (oneSize < 2000 && twoSize > 2000) break
    largeText += 'x'.repeat(25)
    if (largeText.length > 5000) break
  }
  saveToHistory(makePayload('big-1', largeText), limitedStorage, 6001)
  saveToHistory(makePayload('big-2', largeText), limitedStorage, 6002)
  saveToHistory(makePayload('big-3', largeText), limitedStorage, 6003)
  const limited = loadHistory(limitedStorage)
  check('size-limited storage keeps newest after dropping oldest', limited.length === 1 && limited[0].source.name === 'Document big-3')
}

console.log('printTitle:')
{
  check('pdf extension removed and slugified', printTitle({ name: 'My Lease.pdf' }) === 'lexscope-report-my-lease')
  check('spaces and punctuation collapse to single hyphens', printTitle({ name: 'NDA   !!! draft (v2).PDF' }) === 'lexscope-report-nda-draft-v2')
  check('missing name falls back to document', printTitle({}) === 'lexscope-report-document')

  const longTitle = printTitle({ name: `A ${'very '.repeat(40)}long-document-name.pdf` })
  const slug = longTitle.replace('lexscope-report-', '')
  check('slug length is at most 60', slug.length <= 60)
  check('slug has no trailing hyphen', !slug.endsWith('-'))

  check('name without extension remains intact', printTitle({ name: 'nda' }) === 'lexscope-report-nda')
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
