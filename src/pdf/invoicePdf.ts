import i18next from 'i18next'
import pdfMake, { type CreatedPdf } from 'pdfmake/build/pdfmake'
import { generateFA3 } from 'ksef-pdf-generator/lib-public/FA3-generator'
import { i18nReady } from 'ksef-pdf-generator/lib-public/i18n/i18n-init'
import { parseXML } from 'ksef-pdf-generator/shared/XML-parser'

export interface InvoicePdfOptions {
  link: string | null
  ksefNumber: string | null
}

const MARK = 'Wizualizacja pomocnicza'
const NOTICE = 'To nie jest dokument pobrany z KSeF. Utworzono w przeglądarce z pliku XML.'
const TITLE = 'Wizualizacja pomocnicza faktury'
const CREATOR = 'ksef.michal-ziolek.dev'

const ready = i18nReady.then(() => {
  i18next.addResourceBundle(
    'pl',
    'translation',
    {
      invoice: {
        header: { ksefPart1: 'Wizualizacja', ksefPart2: ' ', ksefPart3: 'pomocnicza' },
        qr1: { withoutNumber: `${MARK}\nKSeF drukuje tu numer KSeF albo napis OFFLINE` },
        footer: { appName: 'program nie jest podany w pliku' },
      },
    },
    true,
    true,
  )
  pdfMake.setUrlAccessPolicy(() => false)
})

function invoiceOf(parsed: unknown): object {
  const invoice = (parsed as { Faktura?: { Naglowek?: { KodFormularza?: { _attributes?: { kodSystemowy?: unknown } } } } })
    ?.Faktura
  if (invoice?.Naglowek?.KodFormularza?._attributes?.kodSystemowy !== 'FA (3)') throw new Error('not an FA(3) invoice')
  return invoice
}

// The generator builds the document definition internally, so the title and page notice are added on its way out.
function withVisualisationMarks(generate: () => CreatedPdf): CreatedPdf {
  const createPdf = pdfMake.createPdf
  pdfMake.createPdf = (definition, options) =>
    createPdf.call(
      pdfMake,
      {
        ...definition,
        info: { ...definition.info, title: TITLE },
        header: { text: NOTICE, fontSize: 8, color: '#343A40', margin: [40, 20, 40, 0] },
      },
      options,
    )
  try {
    return generate()
  } finally {
    pdfMake.createPdf = createPdf
  }
}

export async function createInvoicePdf(bytes: Uint8Array<ArrayBuffer>, options: InvoicePdfOptions): Promise<Blob> {
  const [parsed] = await Promise.all([parseXML(new File([bytes], 'faktura.xml', { type: 'application/xml' })), ready])
  const invoice = invoiceOf(parsed)
  const pdf = withVisualisationMarks(() =>
    generateFA3(invoice, {
      nrKSeF: options.ksefNumber ?? '',
      qrCode: options.link ?? undefined,
      watermark: MARK,
      creator: CREATOR,
    }),
  )
  return pdf.getBlob()
}
