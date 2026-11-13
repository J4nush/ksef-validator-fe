import { readFile } from 'node:fs/promises'
import { expect, type Page, type Request } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface DownloadedPdf {
  name: string
  bytes: Buffer
  milliseconds: number
  requests: { method: string; url: string }[]
}

export interface PdfContent {
  text: string
  links: string[]
}

export const pdfButton = (page: Page) => page.getByRole('button', { name: 'Pobierz PDF' })

export async function downloadPdf(page: Page): Promise<DownloadedPdf> {
  const requests: DownloadedPdf['requests'] = []
  const record = (request: Request) => requests.push({ method: request.method(), url: request.url() })
  page.on('request', record)
  const started = Date.now()
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), pdfButton(page).click()])
  const milliseconds = Date.now() - started
  page.off('request', record)
  await expect(pdfButton(page)).toBeEnabled()
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()), milliseconds, requests }
}

export async function readPdf(bytes: Buffer): Promise<PdfContent> {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
  const document = await task.promise
  const pages: string[] = []
  const links = new Set<string>()
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''))
    for (const annotation of await page.getAnnotations()) {
      if (annotation.subtype === 'Link') links.add(String(annotation.unsafeUrl ?? annotation.url))
    }
  }
  await task.destroy()
  return { text: pages.join('\n'), links: [...links] }
}
