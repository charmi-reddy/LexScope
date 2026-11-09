export const HISTORY_KEY = 'lexscope.history.v1'
export const MAX_HISTORY_ENTRIES = 10

function defaultStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {
    // ignore
  }
  return null
}

export function loadHistory(storage = defaultStorage()) {
  if (!storage) return []

  try {
    const raw = storage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveToHistory(payload, storage = defaultStorage(), now = Date.now()) {
  const current = loadHistory(storage)
  const entry = {
    id: `h-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    analysis: payload?.analysis,
    meta: payload?.meta,
    source: payload?.source,
  }

  const next = [entry, ...current].slice(0, MAX_HISTORY_ENTRIES)
  if (!storage) return next

  let attempt = next
  while (attempt.length >= 1) {
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify(attempt))
      return attempt
    } catch {
      if (attempt.length === 1) break
      attempt = attempt.slice(0, -1)
    }
  }

  return attempt
}

export function removeFromHistory(id, storage = defaultStorage()) {
  const next = loadHistory(storage).filter((entry) => entry?.id !== id)
  if (!storage) return next

  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // ignore write failures; return in-memory result
  }

  return next
}
