import { Link } from 'react-router-dom'
import { ArrowRight, FileQuestion } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-md border border-rule bg-white">
        <FileQuestion size={24} className="text-ink-400" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink-950">Page not found</h1>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-ink-600">
        The page you’re looking for doesn’t exist. Head back home, or start analyzing a document.
      </p>
      <div className="mt-7 flex gap-3">
        <Link to="/" className="btn-ghost">Go home</Link>
        <Link to="/analyze" className="btn-primary">
          Analyze a document <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
