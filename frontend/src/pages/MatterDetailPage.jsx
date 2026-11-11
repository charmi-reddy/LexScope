import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorCard from '../components/ui/ErrorCard.jsx'
import { addUpdate, getMatter } from '../services/mattersApi.js'

const FILE_ACCEPT = '.txt,.text,.md,.markdown,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TYPE_LABELS = {
  notice: 'Notice',
  agreement: 'Agreement',
  case: 'Case',
  other: 'Other',
  reply: 'Reply',
  'hearing-order': 'Hearing order',
  order: 'Order',
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

export default function MatterDetailPage() {
  const { id } = useParams()
  const [matter, setMatter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [updateError, setUpdateError] = useState(null)
  const [label, setLabel] = useState('')
  const [updateType, setUpdateType] = useState('other')
  const [file, setFile] = useState(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    getMatter(id)
      .then((result) => { if (active) setMatter(result) })
      .catch((error) => { if (active) setLoadError(error) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const updates = useMemo(
    () => [...(matter?.updates || [])].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)),
    [matter],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (!file || !label.trim() || posting) return
    setPosting(true)
    setUpdateError(null)
    try {
      const updatedMatter = await addUpdate(id, { file, label: label.trim(), updateType })
      setMatter(updatedMatter)
      setLabel('')
      setUpdateType('other')
      setFile(null)
      const input = document.getElementById('matter-update-file')
      if (input) input.value = ''
    } catch (error) {
      setUpdateError(error)
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return <div className="container-page max-w-3xl py-10 sm:py-14"><div className="card p-6 text-sm text-ink-500" role="status">Loading matter…</div></div>
  }

  if (loadError || !matter) {
    return (
      <div className="container-page max-w-3xl py-10 sm:py-14">
        <ErrorCard error={{ code: loadError?.code || 'MATTER_NOT_FOUND', message: loadError?.message || 'Matter not found.' }} />
        <Link to="/matters" className="mt-4 inline-flex text-sm font-medium text-ink-700 underline underline-offset-2 hover:text-ink-950">
          Back to matters
        </Link>
      </div>
    )
  }

  const closed = matter.status === 'closed'

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <Link to="/matters" className="text-[13px] font-medium text-ink-600 hover:text-ink-950">← Back to matters</Link>

      <header className="mt-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">{matter.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip border-rule bg-paper text-ink-600">{TYPE_LABELS[matter.matter_type] || 'Other'}</span>
          <span className={`chip ${closed ? 'border-rule bg-paper text-ink-500' : 'border-laurel-200 bg-laurel-50 text-laurel-900'}`}>
            {closed ? 'Closed' : 'Open'}
          </span>
        </div>
      </header>

      <section className="card mt-7 p-6 sm:p-7">
        <p className="overline-label">Where things stand</p>
        {matter.current_summary ? (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-ink-800">{matter.current_summary}</p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink-500">Add the first document below and the summary will appear here.</p>
        )}
      </section>

      <section className="mt-9" aria-labelledby="timeline-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="overline-label">Matter history</p>
            <h2 id="timeline-heading" className="mt-2 font-display text-2xl font-semibold text-ink-950">Timeline</h2>
          </div>
        </div>

        {updates.length === 0 ? (
          <div className="card mt-5 p-6 text-sm text-ink-500">No updates yet.</div>
        ) : (
          <ol className="ml-3 mt-5 space-y-5 border-l border-rule-strong pl-6">
            {updates.map((update) => (
              <li key={update.id} className="relative">
                <span className="absolute -left-[32px] top-5 h-3 w-3 rounded-full border-2 border-laurel-700 bg-paper" aria-hidden />
                <article className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold text-ink-950">{update.label}</h3>
                    <time className="text-xs text-ink-500" dateTime={update.created_at || undefined}>{formatDate(update.created_at)}</time>
                  </div>
                  <span className="chip mt-2 border-rule bg-paper text-ink-600">{TYPE_LABELS[update.update_type] || 'Other'}</span>
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-ink-800">{update.summary}</p>
                  {update.what_changed && (
                    <p className="mt-3 border-t border-rule pt-3 text-[13px] italic leading-6 text-ink-600">
                      What changed: {update.what_changed}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      {closed ? (
        <p className="card mt-9 p-5 text-sm leading-6 text-ink-600">
          This matter is closed. Reopen it from the matters list to add updates.
        </p>
      ) : (
        <section className="mt-9">
          {updateError && <ErrorCard error={{ code: updateError.code || 'UPDATE_FAILED', message: updateError.message }} className="mb-4" />}
          <form onSubmit={handleSubmit} className="card space-y-4 p-5 sm:p-6">
            <div>
              <p className="overline-label">Keep the record current</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink-950">Add update</h2>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink-800">Document</span>
              <input
                id="matter-update-file"
                type="file"
                accept={FILE_ACCEPT}
                required
                disabled={posting}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-paper-deep file:px-3.5 file:py-2 file:text-[13px] file:font-medium file:text-ink-800 hover:file:bg-laurel-100"
              />
              <span className="mt-1.5 block text-xs text-ink-500">Accepted: .txt, .md, .pdf, .docx</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-800">Label</span>
                <input
                  type="text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  maxLength={120}
                  required
                  placeholder="Reply to legal notice"
                  disabled={posting}
                  className="w-full rounded-md border border-rule-strong bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-800">Update type</span>
                <select
                  value={updateType}
                  onChange={(event) => setUpdateType(event.target.value)}
                  disabled={posting}
                  className="w-full rounded-md border border-rule-strong bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
                >
                  <option value="notice">Notice</option>
                  <option value="reply">Reply</option>
                  <option value="hearing-order">Hearing order</option>
                  <option value="order">Order</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={posting || !file || !label.trim()} className="btn-primary">
              {posting ? 'Analyzing…' : 'Add to matter'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
