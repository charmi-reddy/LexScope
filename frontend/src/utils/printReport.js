export function printTitle(source) {
  try {
    const rawName = String(source?.name || '')
    const withoutExt = rawName.replace(/\.[^.]+$/, '')
    let slug = withoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (slug.length > 60) {
      slug = slug.slice(0, 60).replace(/-+$/g, '')
    }

    if (!slug) slug = 'document'
    return `lexscope-report-${slug}`
  } catch {
    return 'lexscope-report-document'
  }
}
