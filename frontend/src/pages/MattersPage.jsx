import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErrorCard from '../components/ui/ErrorCard.jsx'
import { createMatter, deleteMatter, listMatters, setMatterStatus } from '../services/mattersApi.js'

const TYPE_LABELS = {
  notice: 'Notice',
  agreement: 'Agreement',
  case: 'Case',
  other: 'Other',
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function MattersPage() {
  const navigate = useNavigate()
  const [matters, setMatters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('')
  const [matterType, setMatterType] = useState('other')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const rows = await listMatters()
      setMatters([...(rows || [])].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)))
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(event) {
    event.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const matter = await createMatter(title.trim(), matterType)
      navigate(`/matters/${encodeURIComponent(matter.id)}`)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus(event, matter) {
    event.stopPropagation()
    setBusyId(matter.id)
    setError(null)
    try {
      await setMatterStatus(matter.id, matter.status === 'closed' ? 'open' : 'closed')
      await refresh()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(event, matter) {
    event.stopPropagation()
    if (!window.confirm(`Delete “${matter.title}” and all its updates?`)) return
    setBusyId(matter.id)
    setError(null)
    try {
      await deleteMatter(matter.id)
      await refresh()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setBusyId(null)
    }
  }

  function openMatter(matter) {
    navigate(`/matters/${encodeURIComponent(matter.id)}`)
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="overline-label">Matters</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
          Your matters
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-600">
          Each matter keeps every notice and order in one flow, with a running summary of where things stand.
        </p>
      </div>

      {error && <ErrorCard error={{ code: error.code || 'MATTERS', message: error.message }} onRetry={refresh} className="mt-8" />}

      <form onSubmit={handleCreate} className="card mt-8 p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-ink-950">New matter</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px_auto] sm:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink-800">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
              placeholder="e.g. Northside lease dispute"
              className="w-full rounded-md border border-rule-strong bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink-800">Matter type</span>
            <select
              value={matterType}
              onChange={(event) => setMatterType(event.target.value)}
              className="w-full rounded-md border border-rule-strong bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={creating || !title.trim()} className="btn-primary disabled:cursor-wait disabled:opacity-60">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="card mt-5 p-6 text-sm text-ink-500" role="status">Loading matters…</div>
      ) : matters.length === 0 ? (
        <div className="card mt-5 p-6">
          <p className="font-display text-xl font-semibold text-ink-950">No matters yet.</p>
          <p className="mt-2 text-sm text-ink-500">Create one above and add the first notice or order.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {matters.map((matter) => {
            const closed = matter.status === 'closed'
            return (
              <article
                key={matter.id}
                onClick={() => openMatter(matter)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMatter(matter) } }}
                role="link"
                tabIndex={0}
                className={`card flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:border-rule-strong ${closed ? 'opacity-60' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-semibold text-ink-950">{matter.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="chip border-rule bg-paper text-ink-600">{TYPE_LABELS[matter.matter_type] || 'Other'}</span>
                    <span className={`chip ${closed ? 'border-rule bg-paper text-ink-500' : 'border-laurel-200 bg-laurel-50 text-laurel-900'}`}>
                      {closed ? 'Closed' : 'Open'}
                    </span>
                    <span className="text-xs text-ink-500">{matter.update_count || 0} updates</span>
                    <span className="text-xs text-ink-400">Updated {formatDate(matter.updated_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[13px] font-medium">
                  <button type="button" disabled={busyId === matter.id} onClick={(event) => toggleStatus(event, matter)} className="text-ink-600 hover:text-ink-950 disabled:opacity-50">
                    {closed ? 'Reopen' : 'Close'}
                  </button>
                  <button type="button" disabled={busyId === matter.id} onClick={(event) => handleDelete(event, matter)} className="text-attention-high hover:underline disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
