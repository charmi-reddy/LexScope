/**
 * Shared typed error for AI clients (both the backend-proxy client and the
 * browser Puter.js fallback client). Codes are a stable contract with the UI.
 */
export class AiClientError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'AiClientError'
    // AI_NOT_CONFIGURED | RATE_LIMITED | AI_TOKEN_INVALID | QUOTA | TIMEOUT |
    // NETWORK | AI_UPSTREAM_UNREACHABLE | AI_UPSTREAM | MODEL_UNAVAILABLE |
    // NO_RESPONSE | AUTH_REQUIRED | AUTH_DENIED | PUTER_LOAD_FAILED
    this.code = code
    this.details = details || {}
  }
}
