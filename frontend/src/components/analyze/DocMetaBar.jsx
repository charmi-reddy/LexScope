import { AlertCircle, Clock3 } from 'lucide-react'
import { formatNumber, readingMinutes } from '../../utils/text.js'

/** Shows document stats + soft warnings returned by the backend. */
export default function DocMetaBar({ stats, warnings, name }) {
  if (!stats) return null
  return (
    <div className="rounded-md border border-rule bg-paper/70 px-4 py-3.5">
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px]">
        <div className="flex items-center gap-1.5">
          <dt className="text-ink-500">Document</dt>
          <dd className="max-w-[220px] truncate font-medium text-ink-900" title={name}>{name || 'Untitled'}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-ink-500">Words</dt>
          <dd className="font-medium tabular-nums text-ink-900">{formatNumber(stats.word_count)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-ink-500">Characters</dt>
          <dd className="font-medium tabular-nums text-ink-900">{formatNumber(stats.char_count)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock3 size={13} className="text-ink-400" aria-hidden />
          <dt className="sr-only">Reading time</dt>
          <dd className="text-ink-600">~{readingMinutes(stats.word_count)} min read</dd>
        </div>
      </dl>

      {warnings?.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-rule pt-3">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-5 text-attention-medium">
              <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
