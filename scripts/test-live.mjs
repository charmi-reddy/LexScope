/**
 * LIVE end-to-end test: real pipeline code → real backend proxy → real Gemini.
 * Requires: backend running with a working provider (check /api/ai/status).
 *
 *   node scripts/test-live.mjs            (defaults to http://127.0.0.1:8000)
 *   LEXSCOPE_API_BASE=http://localhost:8000 node scripts/test-live.mjs
 *
 * Uses one analysis worth of free-tier quota.
 */
import { analyzeLegalDocument } from '../frontend/src/services/legalAnalysisService.js'
import { locateClauses } from '../frontend/src/utils/highlight.js'
import { SAMPLE_DOCUMENT } from '../frontend/src/utils/sampleDocument.js'

const BASE = process.env.LEXSCOPE_API_BASE || 'http://127.0.0.1:8000'
const realFetch = globalThis.fetch
globalThis.fetch = (url, options) => realFetch(BASE + url, options)

// Stub browser globals in case the fallback client is ever touched (it
// shouldn't be when the server route is healthy).
globalThis.window = globalThis
globalThis.document = { querySelector: () => null, createElement: () => ({}), head: { appendChild() {} } }

const status = await (await realFetch(`${BASE}/api/ai/status`)).json()
console.log(`provider: ${status.provider} · model: ${status.model}`)
if (!status.configured) {
  console.error('Backend has no AI provider configured — set GEMINI_API_KEY in backend/.env')
  process.exit(1)
}

console.log('Running a REAL analysis of the sample agreement…')
const t0 = Date.now()
const { analysis, meta } = await analyzeLegalDocument({
  text: SAMPLE_DOCUMENT.text,
  name: SAMPLE_DOCUMENT.name,
  onStage: (s) => process.stdout.write(`  stage: ${s}\n`),
})
const seconds = ((Date.now() - t0) / 1000).toFixed(1)

let failures = 0
const check = (label, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.error(`  ✗ ${label} ${extra}`) }
}

check('analysis returned via backend proxy', !!analysis && status.provider === 'gemini', `status.provider=${status.provider}`)
check('summary present', analysis.summary.length > 80)
check('document type identified', analysis.document_type.length > 3)
check('overall risk is a valid level', ['low', 'medium', 'high'].includes(analysis.overall_risk))
check('clauses extracted', analysis.clauses.length >= 3, `got ${analysis.clauses.length}`)
check('clauses have plain-language explanations', analysis.clauses.every((c) => c.plain_language.length > 20))
check('clauses quote verbatim text', analysis.clauses.filter((c) => c.original_text.length > 20).length >= 3)
check('takeaways present', analysis.key_takeaways.length >= 3)
check('questions generated', analysis.questions_to_ask.length >= 3)

const { highlights, located } = locateClauses(SAMPLE_DOCUMENT.text, analysis.clauses)
check('majority of quoted clauses locate in the document', located >= Math.min(3, analysis.clauses.length - 1), `located=${located}/${analysis.clauses.length}`)

console.log(`\nGemini says: "${analysis.document_type}" · overall attention: ${analysis.overall_risk} · ${analysis.clauses.length} clauses · ${analysis.red_flags.length} red flags · ${analysis.important_dates.length} dates · ${seconds}s via ${meta.model}`)

// Show one clause as a human-readable sample
const sample = analysis.clauses.find((c) => c.risk_level === 'high') || analysis.clauses[0]
if (sample) {
  console.log(`\nSample clause — ${sample.title} [${sample.risk_level}]`)
  console.log(`  plain: ${sample.plain_language.slice(0, 160)}…`)
}

console.log(failures === 0 ? '\nLIVE E2E TEST PASSED' : `\n${failures} LIVE CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
