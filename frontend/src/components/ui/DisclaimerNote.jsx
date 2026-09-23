import { Scale } from 'lucide-react'

export const DISCLAIMER_TEXT =
  'LexScope provides AI-generated explanations and document insights for informational purposes only. It is not legal advice and does not replace a qualified legal professional.'

/**
 * The product-wide disclaimer. `variant`:
 *  - "strip": quiet inline band (landing, footer contexts)
 *  - "card":  boxed callout (results, analyzer)
 */
export default function DisclaimerNote({ variant = 'strip', className = '' }) {
  if (variant === 'card') {
    return (
      <div className={`card flex gap-3 p-4 ${className}`}>
        <Scale size={18} className="mt-0.5 shrink-0 text-ink-400" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-ink-800">Not legal advice</p>
          <p className="mt-1 text-[13px] leading-5 text-ink-500">{DISCLAIMER_TEXT}</p>
        </div>
      </div>
    )
  }
  return (
    <p className={`flex items-start gap-2 text-xs leading-5 text-ink-500 ${className}`}>
      <Scale size={14} className="mt-0.5 shrink-0 text-ink-400" aria-hidden />
      <span>{DISCLAIMER_TEXT}</span>
    </p>
  )
}
