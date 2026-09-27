import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import DisclaimerNote from '../ui/DisclaimerNote'

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950 text-ink-300">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1.4fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-paper">
                <Scale size={17} className="text-ink-900" aria-hidden />
              </span>
              <span className="font-display text-lg font-semibold text-paper">LexScope</span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-6 text-ink-400">
              Understand what you're signing. AI-powered legal document comprehension for
              everyone — clause by clause, in plain language.
            </p>
          </div>

          <div>
            <h3 className="overline-label text-ink-400!">Product</h3>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <li><Link to="/" className="transition-colors hover:text-paper">Home</Link></li>
              <li><Link to="/analyze" className="transition-colors hover:text-paper">Analyze a document</Link></li>
              <li><a href="/#how-it-works" className="transition-colors hover:text-paper">How it works</a></li>
              <li><a href="/#privacy" className="transition-colors hover:text-paper">Privacy &amp; security</a></li>
            </ul>
          </div>

          <div>
            <h3 className="overline-label text-ink-400!">Disclaimer</h3>
            <p className="mt-4 max-w-md text-xs leading-5 text-ink-400">
              LexScope provides AI-generated explanations and document insights for informational
              purposes only. It is not legal advice and does not replace a qualified legal
              professional.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-ink-800 pt-6 text-xs text-ink-500">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <DisclaimerNote />
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-ink-500">
              <span>Made by</span>
              <a
                href="https://www.linkedin.com/in/charmi-reddy-p-b2aaa2294"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink-300 transition-colors hover:text-paper hover:underline underline-offset-2"
              >
                P Charmi Reddy
              </a>
            </div>
            <span className="whitespace-nowrap">© 2026 LexScope</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
