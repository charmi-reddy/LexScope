/**
 * Thin client for the LexScope backend (FastAPI).
 * The backend never stores documents — it extracts, cleans, validates.
 *
 * Errors from the API use the envelope:
 *   { "error": { "code", "message", "details" } }
 */

export class ApiError extends Error {
  constructor(code, message, { status, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(path, options)
  } catch {
    throw new ApiError('NETWORK', "Can't reach the LexScope backend. Make sure it's running on port 8000 (see README), then try again.")
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    /* non-JSON body — handled below */
  }

  if (!response.ok) {
    const err = payload?.error
    throw new ApiError(
      err?.code || 'HTTP_ERROR',
      err?.message || `The request failed (HTTP ${response.status}).`,
      { status: response.status, details: err?.details },
    )
  }
  return payload
}

/** POST /api/documents/extract — upload a file, get cleaned text + stats. */
export async function extractDocument(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/api/documents/extract', { method: 'POST', body: form })
}

/** POST /api/documents/validate — validate pasted text, get stats. */
export async function validateDocument(text, name) {
  return request('/api/documents/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, name }),
  })
}

/** GET /api/health */
export async function getHealth() {
  return request('/api/health')
}
