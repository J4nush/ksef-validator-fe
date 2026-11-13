const MAX_LENGTH = 60

export function pdfFileName(invoiceNumber: string | null): string {
  const safe = (invoiceNumber ?? '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '')
  return safe === '' ? 'wizualizacja-faktury.pdf' : `wizualizacja-${safe}.pdf`
}
