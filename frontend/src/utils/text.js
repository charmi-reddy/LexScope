/** Small text helpers shared by input + results views. */

export function countWords(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString()
}

export function readingMinutes(words) {
  return Math.max(1, Math.round((words || 0) / 200))
}
