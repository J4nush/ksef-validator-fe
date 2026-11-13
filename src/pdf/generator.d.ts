declare module 'pdfmake/build/pdfmake' {
  export interface DocumentDefinition {
    info?: Record<string, string>
    header?: unknown
    [key: string]: unknown
  }

  export interface CreatedPdf {
    getBlob(): Promise<Blob>
  }

  const pdfMake: {
    createPdf(definition: DocumentDefinition, options?: object): CreatedPdf
    setUrlAccessPolicy(policy: (url: string) => boolean): void
  }
  export default pdfMake
}

declare module 'ksef-pdf-generator/shared/XML-parser' {
  export function parseXML(file: File): Promise<unknown>
}

declare module 'ksef-pdf-generator/lib-public/i18n/i18n-init' {
  export const i18nReady: Promise<void>
}

declare module 'ksef-pdf-generator/lib-public/FA3-generator' {
  import type { CreatedPdf } from 'pdfmake/build/pdfmake'

  export interface AdditionalData {
    nrKSeF: string
    qrCode?: string
    watermark?: string
    creator?: string
  }

  export function generateFA3(invoice: object, additionalData: AdditionalData): CreatedPdf
}
