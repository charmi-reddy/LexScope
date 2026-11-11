import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErrorCard from '../components/ui/ErrorCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import supabaseClient from '../services/supabaseClient.js'

export default function AuthPage() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!supabaseClient) {
    return (
      <div className="container-page max-w-3xl py-10 sm:py-14">
        <ErrorCard error={{ code: 'AUTH', message: 'Login is not configured on this deployment.' }} />
      </div>
    )
  }

  const isLogin = mode === 'login'

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = isLogin
        ? await signIn(email, password)
        : await signUp(email, password)
      if (result?.error) throw result.error
      navigate('/matters')
    } catch (authError) {
      setError({ code: 'AUTH', message: authError?.message || 'Authentication failed. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="overline-label">Account</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
          {isLogin ? 'Log in' : 'Sign up'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card mt-8 space-y-5 p-6 sm:p-8">
        {error && <ErrorCard error={error} />}
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-800">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-rule-strong bg-white px-3 py-2.5 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-200"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-800">Password</span>
          <input
            type="password"
            name="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-rule-strong bg-white px-3 py-2.5 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-200"
          />
        </label>
        <button type="submit" disabled={submitting} className="btn-primary disabled:cursor-wait disabled:opacity-60">
          {submitting ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
        </button>
        <p className="text-sm text-ink-600">
          {isLogin ? 'New to LexScope?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setError(null); setMode(isLogin ? 'signup' : 'login') }}
            className="font-medium text-ink-900 underline underline-offset-2 hover:text-ink-600"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  )
}
