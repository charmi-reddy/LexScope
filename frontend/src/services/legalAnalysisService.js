/**
 * Legal analysis orchestration: prompt construction, JSON parsing, retry.
 *
 * Primary AI route: the FastAPI backend proxy (developer-pays — your Puter
 * token on the server, no user sign-in). If the proxy is unavailable or not
 * configured, it automatically falls back to the browser Puter.js client
 * (user-pays) so the app still works.
 *
 * Provider-agnostic: it talks exclusively to the two client modules.
 */
import { chat as backendChat } from './backendAiClient.js'
import { AiClientError } from './aiErrors.js'
import { normalizeAnalysis } from '../utils/analysisSchema.js'

/** Preferred Gemini models, tried in order. */
export const MODEL_CHAIN = ['google/gemini-2.5-flash', 'google/gemini-2.0-flash']

const TEMPERATURE = 0.2
const ANALYSIS_TIMEOUT_MS = 180000

// Proxy-level failures worth falling back to the browser (user-pays) route.
const FALLBACK_CODES = new Set([
  'AI_NOT_CONFIGURED',
  'NETWORK',
  'AI_TOKEN_INVALID',
  'AI_SUBSCRIPTION_REQUIRED',
  'AI_UPSTREAM_UNREACHABLE',
  'AI_UPSTREAM',
  'QUOTA',
])

/**
 * Tries the backend proxy first; on proxy-level failure, falls back to the
 * in-browser Puter client. Both expose the same `chat()` interface.
 */
async function chatViaPrimaryRoute(params) {
  try {
    return await backendChat(params)
  } catch (err) {
    const fallbackWorthy = err instanceof AiClientError && FALLBACK_CODES.has(err.code)
    if (!fallbackWorthy) throw err
    const puter = await import('./puterClient.js')
    // Runs within the original click-handler chain, so the popup is allowed.
    await puter.ensureSignedIn()
    return puter.chat(params)
  }
}

export const ANALYSIS_STAGES = {
  connect: 'Connecting to Gemini',
  analyzing: 'Reading the document & identifying clauses',
  parsing: 'Compiling your report',
}

const SYSTEM_PROMPT = `You are LexScope, a meticulous legal-document analyst helping ordinary people understand contracts they are about to sign. You explain legal language in plain, everyday English and surface provisions that deserve a closer look.

Core rules you must always follow:
- NEVER invent clauses, dates, obligations, or details that are not in the provided document.
- Quote ONLY text that appears verbatim in the document. If you cannot quote it, do not claim it.
- Clearly separate what the document says (fact) from your reading of it (interpretation).
- Explain legal jargon in plain English a non-lawyer understands. Define terms like "indemnify", "liquidated damages", or "sole discretion" when you use them in explanations.
- Identify provisions that are potentially unfavorable, unusual, one-sided, or easy to miss — but analyze the ACTUAL wording: do not treat a provision as problematic merely because of its category.
- Never claim something is definitively illegal or unlawful. Say it "deserves attention", "may be unenforceable in some jurisdictions", or "is worth questioning".
- Express uncertainty openly when the wording is ambiguous or you are unsure.
- Never fabricate missing information. If the document omits something important (e.g. no notice period, no liability cap), say it is absent rather than guessing.
- The document may not be a legal document at all — if so, say so plainly in the summary and document_type, and analyze whatever structure it does have.

Output format — this is critical:
- Respond with ONE valid JSON object and NOTHING else: no markdown fences, no commentary before or after.
- Every string value must be plain text (no markdown syntax inside).
- "original_text" of each clause MUST be a contiguous excerpt copied CHARACTER-FOR-CHARACTER from the document (typically 8–80 words). It is used to highlight the document, so any paraphrasing breaks it. Do not merge sentences that are not adjacent in the document.

JSON schema:
{
  "summary": "2-5 sentence plain-English explanation of what this document is and what it commits the reader to",
  "document_type": "e.g. Employment agreement | Rental/lease agreement | Terms & Conditions | Privacy policy | Service agreement | NDA | Loan agreement | Not a legal document",
  "overall_risk": "low | medium | high  (how much careful attention this document deserves, not a legal judgment)",
  "key_takeaways": ["3-7 concise points a busy person must know before signing"],
  "clauses": [
    {
      "title": "short clause name, e.g. 'Limitation of liability'",
      "category": "payment | termination | liability | indemnity | privacy | confidentiality | renewal | dispute_resolution | intellectual_property | other",
      "original_text": "VERBATIM contiguous excerpt from the document (8-80 words)",
      "plain_language": "what this clause actually says, in plain English",
      "risk_level": "low | medium | high  (how much ATTENTION this deserves — high = could cost the reader significantly or is unusually one-sided)",
      "why_it_matters": "the practical consequence for the reader, with concrete scenarios where helpful",
      "suggested_action": "one concrete, non-advisory thing to check, negotiate, or clarify"
    }
  ],
  "red_flags": [
    {
      "title": "e.g. 'Unlimited liability', 'Automatic renewal', 'Broad IP transfer'",
      "severity": "low | medium | high",
      "explanation": "WHY this specific wording deserves attention, citing what the document actually says — presence alone is not a problem",
      "related_clause": "title of the related clause if one exists, else empty string"
    }
  ],
  "obligations": ["short statements of what each party must do or not do, prefixed with the party, e.g. 'Employee: must report any side income'"],
  "important_dates": [{"date": "the date/deadline exactly as written, e.g. '1 March 2026'", "description": "what happens on it"}],
  "questions_to_ask": ["4-8 practical questions the reader may want to raise with the other party or a professional before signing"]
}

Scope: cover the 4-12 most significant clauses (all high-attention ones, plus representative low/medium ones). Write for a reader with zero legal background.`

function buildUserPrompt(documentText, documentName) {
  return `Analyse the legal document below.

Document name: ${documentName || 'Unnamed document'}

=== DOCUMENT START ===
${documentText}
=== DOCUMENT END ===

Remember: respond with a single valid JSON object only. Quote clause excerpts character-for-character from the document. Never invent anything not present.`
}

const REPAIR_PROMPT = `Your previous response was not parseable as JSON. Return the SAME analysis again as ONE valid raw JSON object only — no markdown fences, no prose, no trailing commas. Start with { and end with }.`

/** Strips code fences / stray prose and parses the first JSON object found. */
export function parseAiJson(text) {
  if (!text) throw new AiClientError('INVALID_JSON', 'The AI response was empty.')
  let candidate = text.trim()
  candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    throw new AiClientError('INVALID_JSON', 'The AI response did not contain a JSON object.')
  }
  candidate = candidate.slice(first, last + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    // One common LLM slip: trailing commas. Try a conservative cleanup.
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      throw new AiClientError('INVALID_JSON', 'The AI response was not valid JSON.')
    }
  }
}

/**
 * Runs the full analysis pipeline.
 *
 * @param {object} params
 * @param {string} params.text        cleaned document text
 * @param {string} params.name        document name
 * @param {(stageKey: string) => void} [params.onStage]  progress callback
 * @returns {Promise<{analysis: object, meta: object}>}
 */
export async function analyzeLegalDocument({ text, name, onStage }) {
  const notify = onStage || (() => {})
  const startedAt = Date.now()

  notify('connect')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(text, name) },
  ]

  let lastError = null
  for (const model of MODEL_CHAIN) {
    try {
      notify('analyzing')
      const raw = await chatViaPrimaryRoute({
        messages,
        model,
        temperature: TEMPERATURE,
        timeoutMs: ANALYSIS_TIMEOUT_MS,
      })

      notify('parsing')
      let parsed
      try {
        parsed = parseAiJson(raw)
      } catch (err) {
        if (err instanceof AiClientError && err.code === 'INVALID_JSON') {
          // One automatic repair round with the same conversation.
          const repaired = await chatViaPrimaryRoute({
            messages: [...messages, { role: 'assistant', content: String(raw).slice(0, 4000) }, { role: 'user', content: REPAIR_PROMPT }],
            model,
            temperature: TEMPERATURE,
            timeoutMs: ANALYSIS_TIMEOUT_MS,
          })
          parsed = parseAiJson(repaired)
        } else {
          throw err
        }
      }

      const { analysis, issues } = normalizeAnalysis(parsed)
      if (!analysis.summary && analysis.clauses.length === 0) {
        throw new AiClientError('EMPTY_ANALYSIS', 'The AI could not extract meaningful analysis from this document. Try a longer or more complete excerpt.')
      }
      return {
        analysis,
        meta: { model, durationMs: Date.now() - startedAt, issues, analyzedAt: new Date().toISOString() },
      }
    } catch (err) {
      const retryableWithNextModel =
        err instanceof AiClientError &&
        ['MODEL_UNAVAILABLE', 'NO_RESPONSE', 'PROVIDER_ERROR', 'INVALID_JSON', 'EMPTY_ANALYSIS'].includes(err.code)
      lastError = err
      if (!retryableWithNextModel) throw err
      // else: fall through and try the next model in the chain
    }
  }
  throw lastError || new AiClientError('PROVIDER_ERROR', 'The AI service is unavailable right now. Please try again shortly.')
}
