import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function CtaBanner() {
  return (
    <section className="bg-paper">
      <div className="container-page py-16 text-center sm:py-20">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
          Read it before you sign it.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-ink-600">
          Free, in your browser, with a sample agreement if you just want to look around.
        </p>
        <Link to="/analyze" className="btn-accent mt-8 px-6 py-3 text-[15px]">
          Analyze a document <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
