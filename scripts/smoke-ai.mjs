const baseUrl = (process.env.LEXSCOPE_API_BASE || process.env.API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '')

const payload = {
  messages: [{ role: 'user', content: 'Reply with OK only if the AI proxy is healthy.' }],
  max_tokens: 32,
}

try {
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  if (response.status !== 200 || !body || typeof body.text !== 'string' || !body.text.trim()) {
    const detail = body && body.error ? JSON.stringify(body.error) : text || 'empty response'
    console.error(`Smoke check failed: HTTP ${response.status} ${detail}`)
    process.exit(1)
  }

  console.log(`Smoke check passed: HTTP ${response.status} model=${body.model || 'unknown'} response=${JSON.stringify(body.text.slice(0, 64))}`)
} catch (error) {
  console.error(`Smoke check failed: ${error.message}`)
  process.exit(1)
}
