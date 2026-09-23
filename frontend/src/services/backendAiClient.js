/**
 * Backend AI proxy client — the PRIMARY AI route (developer-pays).
 *
 * Talks to the FastAPI backend (`POST /api/ai/chat`), which relays requests
 * to Google Gemini via Puter using a server-side token. End users never
 * sign in and never see credentials.
 *
 * Interface matches services/puterClient.js (`chat`, `AiClientError`), so
 * legalAnalysisService can switch between them without knowing the provider.
 */
import { AiClientError } from './aiErrors.js'

function mapBackendCode(code) {
  const map = {
    ai_not_configured: 'AI_NOT_CONFIGURED',
    rate_limited: 'RATE_LIMITED',
    ai_token_invalid: 'AI_TOKEN_INVALID',
    ai_subscription_required: 'AI_SUBSCRIPTION_REQUIRED',
    quota: 'QUOTA',
    timeout: 'TIMEOUT',
    ai_upstream_unreachable: 'AI_UPSTREAM_UNREACHABLE',
    ai_upstream: 'AI_UPSTREAM',
    model_unavailable: 'MODEL_UNAVAILABLE',
    document_too_large: 'DOCUMENT_TOO_LARGE',
  }
  return map[code] || 'AI_UPSTREAM'
}

/**
 * Sends a chat request through the backend proxy.
 * `messages`: [{ role: 'system'|'user'|'assistant', content: string }]
 * Returns the assistant's text content as a string.
 *
 * Timeout is enforced via AbortController: when `timeoutMs` elapses, the
 * in-flight fetch is aborted and rejects with an AbortError, which we map to
 * a typed TIMEOUT error.
 */
export async function chat({ messages, model, temperature, maxTokens, timeoutMs = 180000 }) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const abortTimer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  let response
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model,
        ...(typeof temperature === 'number' ? { temperature } : {}),
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal: controller?.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AiClientError(
        'TIMEOUT',
        `The AI didn't respond within ${Math.round(timeoutMs / 1000)}s. Long documents can take a while — try again, or analyse a shorter excerpt.`,
      )
    }
    throw new AiClientError(
      'NETWORK',
      "Can't reach the LexScope backend. Make sure it's running on port 8000 (see README), then try again.",
    )
  } finally {
    if (abortTimer) clearTimeout(abortTimer)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    /* handled below */
  }

  if (!response.ok) {
    const err = payload?.error || {}
    throw new AiClientError(
      mapBackendCode(err.code),
      err.message || `The AI request failed (HTTP ${response.status}).`,
    )
  }

  const text = typeof payload?.text === 'string' ? payload.text : ''
  if (!text.trim()) {
    throw new AiClientError('NO_RESPONSE', 'The AI returned an empty response. Trying again usually fixes this.')
  }
  return text
}
