import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface PdfContent {
  pages: string[]
  text: string
  links: string[]
  info: Record<string, unknown>
}

export async function readPdf(blob: Blob): Promise<PdfContent> {
  const data = new Uint8Array(await blob.arrayBuffer())
  const task = getDocument({ data, verbosity: 0 })
  const document = await task.promise
  const pages: string[] = []
  const links: string[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''))
    for (const annotation of await page.getAnnotations()) {
      const target = annotation.subtype === 'Link' ? String(annotation.unsafeUrl ?? annotation.url) : null
      if (target !== null && !links.includes(target)) links.push(target)
    }
  }
  const { info } = await document.getMetadata()
  await task.destroy()
  return { pages, text: pages.join('\n'), links, info: info as Record<string, unknown> }
}

export const compact = (text: string) => text.replace(/\s+/gu, '')

export function bytesOf(path: string): Uint8Array<ArrayBuffer> {
  const buffer = readFileSync(path)
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}

export const encode = (text: string) => new TextEncoder().encode(text)

export const examplePath = (name: string) => resolve(__dirname, '../../../public/przyklady', name)

export const fixturePath = (name: string) => resolve(__dirname, 'fixtures', name)

export const engineFixtures = resolve(
  process.env.BACKEND_DIR ?? resolve(__dirname, '../../../../backend'),
  'packages/ksef-fa3-validator/tests/Fixtures',
)

export const hasEngineFixtures = existsSync(engineFixtures)
