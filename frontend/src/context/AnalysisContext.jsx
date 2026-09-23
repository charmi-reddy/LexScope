/**
 * Holds the current analysis in memory (and mirrors it to sessionStorage so a
 * tab refresh on /results doesn't lose the report). Deliberately NOT
 * localStorage: sessions end when the tab closes, so documents never outlive
 * the visit — part of LexScope's privacy stance.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AnalysisContext = createContext(null)
const SESSION_KEY = 'lexscope.analysis.v1'
const MAX_PERSIST_BYTES = 3_500_000 // stay well under sessionStorage quota

export function AnalysisProvider({ children }) {
  const [result, setResult] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const saveAnalysis = useCallback((payload) => {
    setResult(payload)
    try {
      const serialized = JSON.stringify(payload)
      if (serialized.length <= MAX_PERSIST_BYTES) sessionStorage.setItem(SESSION_KEY, serialized)
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* storage full/blocked — memory copy still works */
    }
  }, [])

  const clearAnalysis = useCallback(() => {
    setResult(null)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({ result, saveAnalysis, clearAnalysis }),
    [result, saveAnalysis, clearAnalysis],
  )
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used inside <AnalysisProvider>')
  return ctx
}
