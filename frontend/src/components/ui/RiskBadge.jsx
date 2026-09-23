import { AlertTriangle, CircleAlert, MinusCircle } from 'lucide-react'

const STYLES = {
  high: {
    label: 'High attention',
    short: 'High',
    cls: 'bg-attention-high-bg text-attention-high border-attention-high-border',
    dot: 'bg-attention-high',
    Icon: CircleAlert,
  },
  medium: {
    label: 'Medium attention',
    short: 'Medium',
    cls: 'bg-attention-medium-bg text-attention-medium border-attention-medium-border',
    dot: 'bg-attention-medium',
    Icon: AlertTriangle,
  },
  low: {
    label: 'Low attention',
    short: 'Low',
    cls: 'bg-attention-low-bg text-attention-low border-attention-low-border',
    dot: 'bg-attention-low',
    Icon: MinusCircle,
  },
}

export function riskStyle(level) {
  return STYLES[level] || STYLES.medium
}

/**
 * Attention/risk badge. Always framed as an "attention" indicator, never a
 * legal judgment.
 */
export default function RiskBadge({ level, short = false, withIcon = true, className = '' }) {
  const s = riskStyle(level)
  const Icon = s.Icon
  return (
    <span
      className={`chip ${s.cls} ${className}`}
      title="AI-generated attention indicator — not a legal judgment"
    >
      {withIcon && <Icon size={13} strokeWidth={2.2} aria-hidden />}
      {short ? s.short : s.label}
    </span>
  )
}
