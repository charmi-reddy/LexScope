import { Link, useLocation } from 'react-router-dom'
import { Scale } from 'lucide-react'

const LANDING_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#capabilities', label: 'Capabilities' },
  { href: '/#example', label: 'Example' },
  { href: '/#privacy', label: 'Privacy' },
]

export default function SiteHeader() {
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur no-print">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5" aria-label="LexScope home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900">
            <Scale size={17} className="text-[#f0e6d0]" aria-hidden />
          </span>
          <span className="font-display text-[19px] font-semibold tracking-tight text-ink-950">
            LexScope
          </span>
        </Link>

        {onLanding && (
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            {LANDING_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-ink-600 transition-colors hover:text-ink-950"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {pathname !== '/analyze' && (
            <Link
              to="/analyze"
              className="btn-primary px-3.5! py-2! text-[13px]"
            >
              Analyze a document
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
