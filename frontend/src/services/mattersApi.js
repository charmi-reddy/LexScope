import supabaseClient from './supabaseClient.js'

async function request(path, options = {}) {
  if (!supabaseClient) throw new Error('Login is not configured on this deployment.')

  const { data, error: sessionError } = await supabaseClient.auth.getSession()
  if (sessionError) throw new Error(sessionError.message)
  const token = data?.session?.access_token
  if (!token) throw new Error('Please log in to access your matters.')

  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(path, { ...options, headers })
  } catch {
    throw new Error("Can't reach the LexScope backend. Check your connection and try again.")
  }

  if (response.status === 204) return null
  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Keep a useful HTTP fallback below when the server response is not JSON.
  }

  if (!response.ok) {
    const backendError = payload?.error || payload?.detail?.error
    throw new Error(backendError?.message || `The request failed (HTTP ${response.status}).`)
  }
  return payload
}

export function listMatters() {
  return request('/api/matters')
}

export function createMatter(title, matterType) {
  return request('/api/matters', {
    method: 'POST',
    body: JSON.stringify({ title, matter_type: matterType }),
  })
}

export function renameMatter(id, title) {
  return request(`/api/matters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export function setMatterStatus(id, status) {
  return request(`/api/matters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteMatter(id) {
  return request(`/api/matters/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function getMatter(id) {
  return request(`/api/matters/${encodeURIComponent(id)}`)
}

export function addUpdate(matterId, { file, label, updateType }) {
  const form = new FormData()
  form.append('file', file)
  form.append('label', label)
  form.append('update_type', updateType)
  return request(`/api/matters/${encodeURIComponent(matterId)}/updates`, {
    method: 'POST',
    body: form,
  })
}
