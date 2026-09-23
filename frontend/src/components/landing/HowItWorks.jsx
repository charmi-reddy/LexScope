import { ClipboardPaste, MessageSquareWarning, ScanSearch } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    Icon: ClipboardPaste,
    title: 'Add your document',
    body: 'Paste the text or upload a .txt file — an employment contract, lease, terms of service, or any agreement you’ve been handed.',
  },
  {
    n: '02',
    Icon: ScanSearch,
    title: 'Gemini reads every clause',
    body: 'Your document is relayed to Google’s Gemini for a structured, clause-by-clause breakdown — never stored along the way, and no account needed.',
  },
  {
    n: '03',
    Icon: MessageSquareWarning,
    title: 'Review before you sign',
    body: 'Read the plain-language summary, walk through each clause, check the attention indicators, and take a list of sharp questions back to the other party.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-rule bg-paper">
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="overline-label">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
            From wall of text to clear picture, in three steps
          </h2>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-3">
          {STEPS.map(({ n, Icon, title, body }) => (
            <li key={n} className="bg-paper p-7">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold tracking-widest text-laurel-700">{n}</span>
                <Icon size={20} className="text-ink-400" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink-950">{title}</h3>
              <p className="mt-2.5 text-[13.5px] leading-6 text-ink-600">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
