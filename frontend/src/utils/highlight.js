/**
 * Locates clause excerpts inside the original document text so the Document
 * view can highlight them. Matching strategy (in order):
 *
 *   1. EXACT — whitespace/case/quote-normalised substring match, with an index
 *      map back to original character offsets.
 *   2. SEGMENTED — for excerpts containing "…"/"...", locate each part and
 *      span from first to last.
 *   3. FUZZY — sliding token window (Jaccard-style ratio ≥ 0.78, unambiguous
 *      best) as a last resort.
 *
 * Anything unlocated simply isn't highlighted — never highlighted wrongly.
 */

const CHAR_NORMALIZATIONS = {
  '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u00a0': ' ',
  '\u00ad': '', '\u2026': '...',
}

export function normalizeChars(s) {
  let out = ''
  for (const ch of s) out += CHAR_NORMALIZATIONS[ch] ?? ch
  return out
}

export function normalizeForMatch(s) {
  return normalizeChars(s).toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Normalises text while remembering each output char's original offset. */
function normalizeWithMap(text) {
  const normalized = normalizeChars(text).toLowerCase()
  const chars = []
  const map = []
  let pendingSpaceAt = -1
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (/\s/.test(ch)) {
      if (chars.length && pendingSpaceAt === -1) pendingSpaceAt = i
      continue
    }
    if (pendingSpaceAt !== -1) {
      chars.push(' ')
      map.push(pendingSpaceAt)
      pendingSpaceAt = -1
    }
    chars.push(ch)
    map.push(i)
  }
  return { normalized: chars.join(''), map }
}

function tokenizeWithOffsets(text) {
  const tokens = []
  const re = /[\p{L}\p{N}]+/gu
  let m
  while ((m = re.exec(text)) !== null) {
    tokens.push({ token: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length })
    if (m.index === re.lastIndex) re.lastIndex++
  }
  return tokens
}

function clampByWordBoundaries(text, start, end) {
  while (start > 0 && !/\s/.test(text[start - 1])) start--
  while (end < text.length && !/\s/.test(text[end])) end++
  return [start, end]
}

function exactLocate(docState, excerpt) {
  const needle = normalizeForMatch(excerpt)
  if (needle.length < 8) return null
  const idx = docState.normalized.indexOf(needle)
  if (idx === -1) return null
  const start = docState.map[idx]
  const last = docState.map[Math.min(idx + needle.length - 1, docState.map.length - 1)]
  const [s, e] = clampByWordBoundaries(docState.text, start, last + 1)
  return { start: s, end: e, match: 'exact' }
}

function segmentedLocate(docState, excerpt) {
  const parts = normalizeChars(excerpt)
    .split(/\s*(?:\.\.\.+|…)\s*/)
    .map((p) => p.trim())
    .filter((p) => normalizeForMatch(p).length >= 8)
  if (parts.length < 2) return null
  const found = []
  for (const part of parts) {
    const hit = exactLocate(docState, part)
    if (!hit) return null
    found.push(hit)
  }
  found.sort((a, b) => a.start - b.start)
  return { start: found[0].start, end: found[found.length - 1].end, match: 'partial' }
}

function fuzzyLocate(docState, excerpt) {
  const excerptTokens = tokenizeWithOffsets(normalizeForMatch(excerpt))
  const m = excerptTokens.length
  if (m < 6 || m > docState.tokens.length) return null

  const windowCounts = new Map()
  let matched = 0
  const excerptCounts = new Map()
  for (const { token } of excerptTokens) excerptCounts.set(token, (excerptCounts.get(token) || 0) + 1)

  const addToken = (tok, delta) => {
    const prev = windowCounts.get(tok) || 0
    windowCounts.set(tok, prev + delta)
    if (delta > 0 && prev < (excerptCounts.get(tok) || 0)) matched++
    if (delta < 0 && prev <= (excerptCounts.get(tok) || 0)) matched--
  }

  let best = { ratio: 0, start: -1, ties: 0 }
  for (let i = 0; i < docState.tokens.length; i++) {
    addToken(docState.tokens[i].token, +1)
    if (i >= m) addToken(docState.tokens[i - m].token, -1)
    if (i >= m - 1) {
      const ratio = matched / m
      const winStart = docState.tokens[i - m + 1].start
      if (ratio > best.ratio + 0.001) best = { ratio, start: winStart, ties: 0 }
      else if (Math.abs(ratio - best.ratio) <= 0.001 && ratio > 0.5) best.ties++
    }
  }
  if (best.ratio < 0.78 || best.ties > 2 || best.start === -1) return null
  // Find the window end by replaying m tokens from the winning start offset.
  let count = 0
  let end = docState.text.length
  for (const tok of docState.tokens) {
    if (tok.start >= best.start) {
      count++
      if (count === m) {
        end = tok.end
        break
      }
    }
  }
  return { start: best.start, end, match: 'fuzzy' }
}

/**
 * @param {string} docText
 * @param {Array} clauses  normalized clauses (id, original_text, risk_level)
 * @returns {{ highlights: Array<{id, start, end, riskLevel, match}>, located: number }}
 */
export function locateClauses(docText, clauses) {
  if (!docText) return { highlights: [], located: 0 }
  const docState = {
    text: docText,
    ...normalizeWithMap(docText),
    tokens: tokenizeWithOffsets(docText),
  }

  const highlights = []
  for (const clause of clauses) {
    const excerpt = (clause.original_text || '').trim()
    if (excerpt.length < 8) continue
    const hit =
      exactLocate(docState, excerpt) ||
      segmentedLocate(docState, excerpt) ||
      fuzzyLocate(docState, excerpt)
    if (hit) highlights.push({ id: clause.id, start: hit.start, end: hit.end, riskLevel: clause.risk_level, match: hit.match })
  }

  // Resolve overlaps: sort by start, prefer longer/high-attention spans.
  const priority = { high: 3, medium: 2, low: 1 }
  highlights.sort((a, b) => a.start - b.start || a.end - b.end)
  const kept = []
  for (const h of highlights) {
    const prev = kept[kept.length - 1]
    if (prev && h.start < prev.end) {
      // Overlap: keep the higher-priority (longer, then higher risk) span.
      const prevLen = prev.end - prev.start
      const hLen = h.end - h.start
      if (hLen > prevLen || (hLen === prevLen && priority[h.riskLevel] > priority[prev.riskLevel])) {
        kept[kept.length - 1] = h
      }
    } else {
      kept.push(h)
    }
  }

  return { highlights: kept, located: kept.length }
}
