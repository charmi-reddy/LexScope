import {
  CalendarClock,
  FileSearch,
  ListChecks,
  MessageCircleQuestion,
  Scale,
  TriangleAlert,
} from 'lucide-react'

const CAPABILITIES = [
  {
    Icon: FileSearch,
    title: 'Plain-English summary',
    body: 'A short, honest description of what the document is and what it commits you to — no jargon, no skipping.',
  },
  {
    Icon: Scale,
    title: 'Clause-by-clause explorer',
    body: 'Every significant clause shown side by side: the original legal text next to what it actually means.',
  },
  {
    Icon: TriangleAlert,
    title: 'Attention indicators',
    body: 'High / medium / low attention levels on each clause and an overall rating — AI-generated signals, clearly not legal judgments.',
  },
  {
    Icon: ListChecks,
    title: 'Red-flag detection',
    body: 'Uncapped liability, auto-renewals, broad IP transfer, tough exits — the AI explains why specific wording deserves attention.',
  },
  {
    Icon: CalendarClock,
    title: 'Dates & obligations',
    body: 'Deadlines, notice periods, renewal windows and what each party must (or must never) do, pulled into one place.',
  },
  {
    Icon: MessageCircleQuestion,
    title: 'Questions to ask',
    body: 'A ready list of sharp questions to raise with the other party — or a professional — before you commit.',
  },
]

export default function Capabilities() {
  return (
    <section id="capabilities" className="scroll-mt-20 border-b border-rule bg-white">
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="overline-label">Capabilities</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
            A careful second pair of eyes
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-ink-600">
            LexScope doesn’t tell you whether to sign. It makes sure you know what you’d be signing.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ Icon, title, body }) => (
            <div key={title} className="bg-white p-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-paper">
                <Icon size={17} className="text-laurel-800" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ink-950">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-6 text-ink-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
