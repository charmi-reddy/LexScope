import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import supabaseClient from '../services/supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabaseClient))

  useEffect(() => {
    if (!supabaseClient) {
      setSession(null)
      setLoading(false)
      return undefined
    }

    let mounted = true
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        setSession(error ? null : data.session)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) {
        setSession(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback((email, password) => (
    supabaseClient?.auth.signInWithPassword({ email, password })
  ), [])

  const signUp = useCallback((email, password) => (
    supabaseClient?.auth.signUp({ email, password })
  ), [])

  const signOut = useCallback(() => supabaseClient?.auth.signOut(), [])

  const value = useMemo(() => ({ session, loading, signIn, signUp, signOut }), [session, loading, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
