/**
 * Holds the current analysis in memory (and mirrors it to sessionStorage so a
 * tab refresh on /results doesn't lose the report). sessionStorage is still
 * refresh-only, but completed analyses are also kept in localStorage history
 * on this device (newest 10), deletable from the History page.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { saveToHistory } from '../utils/historyStorage.js'

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

  const saveAnalysis = useCallback((payload, options) => {
    const { addToHistory = true } = options || {}

    setResult(payload)
    try {
      const serialized = JSON.stringify(payload)
      if (serialized.length <= MAX_PERSIST_BYTES) sessionStorage.setItem(SESSION_KEY, serialized)
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* storage full/blocked — memory copy still works */
    }

    if (addToHistory) {
      try {
        saveToHistory(payload)
      } catch {
        /* history failures must never block analysis flow */
      }
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
