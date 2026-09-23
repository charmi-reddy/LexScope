import { AlertOctagon, RefreshCw } from 'lucide-react'

/**
 * Consistent failure UI. `error` should have { code, message } — from
 * AiClientError or ApiError. Offers contextual guidance per error code.
 */
const GUIDANCE = {
  AI_NOT_CONFIGURED: 'The server has no Puter token configured. Add PUTER_AUTH_TOKEN to the backend .env (see README) — meanwhile the app falls back to the visitor sign-in flow.',
  RATE_LIMITED: 'Too many analyses from your network right now. Wait a few minutes and try again.',
  AI_TOKEN_INVALID: 'The server’s Puter token was rejected. Create a fresh one at puter.com/dashboard (Account → API token) and update the backend .env.',
  AI_SUBSCRIPTION_REQUIRED: 'The Puter account on this server is free-tier, which blocks server-side AI calls. Upgrade the Puter plan — or the app keeps working via the visitor sign-in fallback below.',
  AI_UPSTREAM_UNREACHABLE: 'The server couldn’t reach the AI service. Retrying usually helps; check the server’s internet connection.',
  AI_UPSTREAM: 'The AI service had a temporary problem — a retry usually fixes it.',
  PUTER_LOAD_FAILED: 'The fallback AI route needs js.puter.com in your browser. Check that the network allows it, then retry.',
  AUTH_REQUIRED: 'The fallback route needs a (free) Puter sign-in so AI usage bills to the visitor’s own account. Press retry and complete the popup.',
  AUTH_DENIED: 'The sign-in popup was closed or blocked. Allow popups for this page, then press retry.',
  QUOTA: 'AI usage limits have been reached. These reset over time — you can also retry with a shorter excerpt.',
  TIMEOUT: 'Long documents take longer. Retry, or analyse a shorter excerpt (e.g. the sections you care about most).',
  NETWORK: 'Check your connection and that the LexScope backend is running (port 8000).',
  INVALID_JSON: 'The model’s reply couldn’t be parsed — this is rare and a retry usually fixes it.',
  EMPTY_ANALYSIS: 'The model couldn’t find meaningful content. Make sure the text contains the full document.',
}

export default function ErrorCard({ error, onRetry, onDismiss, retryLabel = 'Try again', className = '' }) {
  const code = error?.code || 'UNKNOWN'
  const guidance = GUIDANCE[code]
  return (
    <div className={`card border-attention-high-border bg-attention-high-bg p-5 ${className}`} role="alert">
      <div className="flex items-start gap-3">
        <AlertOctagon size={20} className="mt-0.5 shrink-0 text-attention-high" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-attention-high">Analysis couldn’t be completed</h3>
          <p className="mt-1 text-sm leading-6 text-ink-800">{error?.message || 'Something went wrong.'}</p>
          {guidance && <p className="mt-2 text-[13px] leading-5 text-ink-600">{guidance}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <button type="button" onClick={onRetry} className="btn bg-ink-900 text-paper hover:bg-ink-700">
                <RefreshCw size={14} aria-hidden /> {retryLabel}
              </button>
            )}
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="btn border border-rule-strong bg-white text-ink-700 hover:bg-paper">
                Back to my document
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
