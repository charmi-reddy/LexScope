/**
 * Browser Puter.js client — the FALLBACK AI route (user-pays).
 *
 * The primary route is the backend proxy (services/backendAiClient.js) using
 * the developer's Puter token — users never sign in. This module is used
 * only when the proxy is unavailable/unconfigured, and is ALSO the only
 * module that knows Puter's browser SDK exists. To swap providers, replace
 * this file and backendAiClient.js while keeping their exported surface:
 * `chat`, `ensureSignedIn`, `AiClientError` (re-exported from aiErrors.js).
 *
 * Verified against https://docs.puter.com/AI/chat/ :
 *   puter.ai.chat([messages], testMode, options)
 *   → response.message.content   (string when `normalize: true`)
 * Gemini models are namespaced `google/…`, e.g. "google/gemini-2.5-flash".
 */

import { AiClientError } from './aiErrors.js'
export { AiClientError }

const PUTER_SCRIPT_URL = 'https://js.puter.com/v2/'
const SCRIPT_LOAD_TIMEOUT_MS = 20000

let scriptPromise = null

function injectPuterScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PUTER_SCRIPT_URL}"]`)
    const onLoad = () => {
      if (window.puter) resolve(window.puter)
      else reject(new AiClientError('PUTER_LOAD_FAILED', 'The Puter library loaded but did not initialise. Disable content blockers and retry.'))
    }
    const onError = () => reject(new AiClientError('PUTER_LOAD_FAILED', 'Could not load the Puter library (js.puter.com). Check your internet connection or content blocker and try again.'))

    const el = existing || document.createElement('script')
    el.addEventListener('load', onLoad, { once: true })
    el.addEventListener('error', onError, { once: true })
    if (!existing) {
      el.src = PUTER_SCRIPT_URL
      el.async = true
      document.head.appendChild(el)
    } else if (window.puter) {
      resolve(window.puter)
    }
    // Guard against a hung load (offline proxies, blocked CDNs).
    setTimeout(() => {
      if (window.puter) resolve(window.puter)
      else reject(new AiClientError('PUTER_LOAD_FAILED', 'Loading the Puter library timed out. Check your connection and try again.'))
    }, SCRIPT_LOAD_TIMEOUT_MS)
  })
}

/** Loads (once) and returns the global `puter` object. */
export async function getPuter() {
  if (typeof window !== 'undefined' && window.puter) return window.puter
  if (!scriptPromise) {
    scriptPromise = injectPuterScript().catch((err) => {
      scriptPromise = null // allow retry on next call
      throw err
    })
  }
  return scriptPromise
}

/**
 * Ensures the visitor has a Puter session. Puter's AI is "user pays": the
 * end user signs into their own free Puter account — no API keys anywhere.
 * Must be called from a user-gesture call chain so the popup isn't blocked.
 */
export async function ensureSignedIn() {
  const puter = await getPuter()
  try {
    if (puter.auth?.isSignedIn?.()) return puter
  } catch {
    /* fall through to explicit sign-in */
  }
  try {
    // Don't hang forever if the popup is abandoned without being closed.
    await withTimeout(puter.auth.signIn(), 120000, 'sign-in')
  } catch (err) {
    if (err instanceof AiClientError && err.code === 'TIMEOUT') {
      throw new AiClientError('AUTH_DENIED', 'Puter sign-in didn’t complete. Press “Try again” and finish signing in via the popup (or allow popups for this page).')
    }
    throw new AiClientError(
      'AUTH_DENIED',
      'Puter sign-in was cancelled or blocked. LexScope uses your free Puter account to reach Gemini — no API keys needed. Allow popups for this page and try again.',
    )
  }
  try {
    if (puter.auth.isSignedIn?.()) return puter
  } catch {
    /* treat as signed in — the chat call will surface auth errors if not */
  }
  return puter
}

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new AiClientError('TIMEOUT', `The AI didn't respond within ${Math.round(ms / 1000)}s${label ? ` (${label})` : ''}. Long documents can take a while — try again, or analyse a shorter excerpt.`)),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Best-effort mapping of raw provider errors to typed, human-readable ones. */
function mapProviderError(err) {
  const msg = String(err?.message || err?.error?.message || err || '')
  if (/sign|login|auth|permission|401|403/i.test(msg)) {
    return new AiClientError('AUTH_REQUIRED', 'Puter needs you to sign in before using AI. Press “Analyze” again and complete the sign-in popup.', { cause: msg })
  }
  if (/quota|credit|limit|exceed|429/i.test(msg)) {
    return new AiClientError('QUOTA', 'Your Puter account has hit its AI usage limit for now. Try again later or use a shorter document.', { cause: msg })
  }
  if (/model/i.test(msg) && /(not|unavail|invalid|unknown|found)/i.test(msg)) {
    return new AiClientError('MODEL_UNAVAILABLE', 'The Gemini model is unavailable through Puter right now.', { cause: msg })
  }
  if (/network|failed to fetch|load failed/i.test(msg)) {
    return new AiClientError('NETWORK', 'A network error interrupted the AI request. Check your connection and try again.', { cause: msg })
  }
  return new AiClientError('PROVIDER_ERROR', 'The AI service returned an unexpected error. Please try again.', { cause: msg.slice(0, 300) })
}

/**
 * Sends a chat request. `messages` uses the standard
 * [{ role: 'system'|'user'|'assistant', content: string }] shape.
 * Returns the assistant's text content as a string.
 */
export async function chat({ messages, model, temperature, maxTokens, timeoutMs = 180000 }) {
  const puter = await getPuter()
  const options = { model, normalize: true }
  if (typeof temperature === 'number') options.temperature = temperature
  if (maxTokens) options.max_tokens = maxTokens

  let response
  try {
    // Documented overload: chat([messages], testMode, options)
    response = await withTimeout(puter.ai.chat(messages, false, options), timeoutMs, model)
  } catch (err) {
    if (err instanceof AiClientError) throw err
    throw mapProviderError(err)
  }

  const text = extractText(response)
  if (!text || !text.trim()) {
    throw new AiClientError('NO_RESPONSE', 'The AI returned an empty response. Trying again usually fixes this.')
  }
  return text
}

/**
 * Normalises the many possible Puter response shapes into plain text:
 * string | { message: { content: string | contentBlocks[] } } | { text }.
 */
export function extractText(response) {
  if (response == null) return ''
  if (typeof response === 'string') return response
  const content = response?.message?.content ?? response?.text ?? response?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block === 'string' ? block : block?.text || ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
