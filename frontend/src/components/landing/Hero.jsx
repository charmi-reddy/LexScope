import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, FileText, Lock, Sparkles } from 'lucide-react'
import RiskBadge from '../ui/RiskBadge'

/** Static, hand-built preview of an analysis — sets expectations instantly. */
function AnalysisPreview() {
  return (
    <div className="relative">
      <div className="card overflow-hidden shadow-[0_1px_0_rgba(47,31,16,0.05),0_16px_40px_-24px_rgba(47,31,16,0.4)]">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <div className="flex items-center gap-2.5">
            <FileText size={15} className="text-ink-400" aria-hidden />
            <span className="text-[13px] font-medium text-ink-800">Employment Agreement — Hopwell Analytics</span>
          </div>
          <RiskBadge level="high" short />
        </div>

        <div className="prose-legal bg-paper/60 px-5 py-4">
          <p className="text-ink-400">“8. LIABILITY AND INDEMNITY — The Employee shall indemnify and hold harmless the Company against any and all claims…”</p>
          <p className="mt-3">
            “…arising from acts or omissions of the Employee in the course of employment.{' '}
            <mark className="bg-attention-medium-bg px-0.5 text-attention-medium underline decoration-attention-medium-border decoration-2 underline-offset-2">
              This indemnity is not subject to any monetary cap
            </mark>
            .”
          </p>
        </div>

        <div className="border-t border-rule px-5 py-4">
          <p className="overline-label">In plain language</p>
          <p className="mt-2 text-[13.5px] leading-6 text-ink-800">
            If anything goes wrong at work, you could be personally responsible for paying the
            company’s losses — with <span className="font-semibold">no upper limit</span> on the amount.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip border-attention-high-border bg-attention-high-bg text-attention-high">
              <CircleAlert size={12} aria-hidden /> Uncapped liability
            </span>
            <span className="chip border-rule bg-paper-deep text-ink-600">One-sided obligation</span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-4 hidden items-center gap-2 rounded-md border border-rule bg-white px-3 py-2 shadow-sm sm:flex">
        <Sparkles size={14} className="text-laurel-700" aria-hidden />
        <span className="text-xs font-medium text-ink-700">13 clauses explained · 5 need attention</span>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="border-b border-rule">
      <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <p className="overline-label">AI-powered document comprehension</p>
          <h1 className="mt-4 font-display text-[42px] font-semibold leading-[1.08] tracking-tight text-ink-950 sm:text-[54px]">
            Understand what you're&nbsp;signing.
          </h1>
          <p className="mt-5 max-w-xl text-[16.5px] leading-7 text-ink-600">
            LexScope reads your contracts, leases and terms of service, then explains every clause
            in plain language — and flags the provisions that deserve a closer look before you commit.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/analyze" className="btn-accent px-5 py-3 text-[15px]">
              Analyze a document <ArrowRight size={16} aria-hidden />
            </Link>
            <a href="#example" className="btn-ghost px-5 py-3 text-[15px]">
              See an example analysis
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-500">
            <li className="flex items-center gap-1.5">
              <Lock size={13} aria-hidden /> Nothing is stored
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles size={13} aria-hidden /> Powered by Google Gemini
            </li>
            <li className="flex items-center gap-1.5">
              <FileText size={13} aria-hidden /> Not legal advice
            </li>
          </ul>
        </div>

        <AnalysisPreview />
      </div>
    </section>
  )
}
