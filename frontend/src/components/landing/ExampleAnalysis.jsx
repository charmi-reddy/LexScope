import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert } from 'lucide-react'
import RiskBadge from '../ui/RiskBadge'

/** Illustrative example with fictional text — mirrors the real results UI. */
export default function ExampleAnalysis() {
  return (
    <section id="example" className="scroll-mt-20 border-b border-rule bg-paper-deep/60">
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="overline-label">Example analysis</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
            What “fine print” looks like, translated
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-ink-600">
            Fictional text, shown the way LexScope presents it: the original wording, the plain
            meaning, why it matters, and what to check.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* Original clause */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-rule px-5 py-3">
              <span className="overline-label">In the document</span>
              <span className="text-xs italic text-ink-400">fictional clause</span>
            </div>
            <div className="prose-legal bg-white px-6 py-5">
              <p>
                “9. The Tenant shall be responsible for all maintenance and repairs to the
                premises, however arising, and shall reimburse the Landlord for any costs incurred
                within{' '}
                <mark className="bg-attention-medium-bg px-0.5 text-attention-medium underline decoration-attention-medium-border decoration-2 underline-offset-2">
                  seven (7) days of written demand
                </mark>
                . The Landlord shall have no obligation to repair or maintain the premises.”
              </p>
            </div>
            <div className="border-t border-rule px-5 py-3">
              <RiskBadge level="high" />
            </div>
          </div>

          {/* Explanation */}
          <div className="card overflow-hidden">
            <div className="border-b border-rule px-5 py-3">
              <span className="overline-label">In plain language</span>
            </div>
            <div className="space-y-5 bg-white px-6 py-5">
              <div>
                <h4 className="text-[13px] font-semibold text-ink-950">What it says</h4>
                <p className="mt-1.5 text-[13.5px] leading-6 text-ink-700">
                  You pay for <em>every</em> repair — even a broken boiler that’s the landlord’s
                  responsibility anywhere else — and must pay the landlord back within a week of
                  being asked. The landlord commits to maintaining nothing.
                </p>
              </div>
              <div>
                <h4 className="text-[13px] font-semibold text-ink-950">Why it matters</h4>
                <p className="mt-1.5 text-[13.5px] leading-6 text-ink-700">
                  Structural repairs can cost thousands, and “however arising” may even cover
                  damage you didn’t cause. In many jurisdictions landlords have legal duties that
                  this clause can’t override — but you’d be arguing that after the fact.
                </p>
              </div>
              <div className="flex gap-3 rounded-md border border-attention-high-border bg-attention-high-bg px-4 py-3">
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-attention-high" aria-hidden />
                <p className="text-[13px] leading-5 text-ink-800">
                  <span className="font-semibold">Worth checking:</span> ask for structural and
                  appliance repairs to be the landlord’s duty, and a longer repayment window — and
                  confirm what local tenant-protection law already guarantees.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link to="/analyze" className="text-[14px] font-medium text-laurel-800 hover:text-laurel-900">
            Try it on your own document <ArrowRight size={14} className="inline" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
