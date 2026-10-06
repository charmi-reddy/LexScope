/**
 * Shared typed error for AI clients. Codes are a stable contract with the UI.
 */
export class AiClientError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'AiClientError'
    // AI_NOT_CONFIGURED | RATE_LIMITED | AI_TOKEN_INVALID | QUOTA | TIMEOUT |
    // NETWORK | AI_UPSTREAM_UNREACHABLE | AI_UPSTREAM | MODEL_UNAVAILABLE |
    // NO_RESPONSE | INVALID_JSON | EMPTY_ANALYSIS | PROVIDER_ERROR
    this.code = code
    this.details = details || {}
  }
}
