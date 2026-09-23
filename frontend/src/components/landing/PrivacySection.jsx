import { EyeOff, KeyRound, Trash2 } from 'lucide-react'

const POINTS = [
  {
    Icon: Trash2,
    title: 'Nothing is stored',
    body: 'LexScope has no document database. Your text is processed in the moment and released when you leave the page — refreshing the tab later starts fresh.',
  },
  {
    Icon: KeyRound,
    title: 'No sign-ups, no exposed keys',
    body: 'You never create an account or see credentials. AI requests are relayed by the LexScope server to Google’s Gemini using a server-side token that never reaches your browser.',
  },
  {
    Icon: EyeOff,
    title: 'Use judgment with sensitive data',
    body: 'Documents pass through the LexScope server and the model provider in transit — nothing is stored or logged, but avoid pasting anything you wouldn’t forward by email.',
  },
]

export default function PrivacySection() {
  return (
    <section id="privacy" className="scroll-mt-20 bg-ink-950 text-paper">
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="overline-label text-ink-400!">Privacy &amp; security</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built to forget your document
          </h2>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-ink-800 bg-ink-800 md:grid-cols-3">
          {POINTS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-ink-950 p-7">
              <Icon size={19} className="text-laurel-500" aria-hidden />
              <h3 className="mt-4 text-[15px] font-semibold text-paper">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-6 text-ink-400">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-xs leading-5 text-ink-500">
          Documents are sent over HTTPS to the model provider for analysis and are subject to the
          Puter and Google AI terms. Avoid uploading information you are not comfortable sharing
          with those services.
        </p>
      </div>
    </section>
  )
}
