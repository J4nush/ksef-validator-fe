import { expect, test, type Page } from '@playwright/test'
import { mockApi, report } from './support/api'
import { EXAMPLE_CLEAN, SAMPLE_KSEF_NUMBER, example, expectedLink, fixture } from './support/invoice'
import { largeInvoice } from './support/largeInvoice'
import { downloadPdf, pdfButton, readPdf, type DownloadedPdf } from './support/pdf'
import { openTool, resultHeading, upload } from './support/validator'
import { watchPage } from './support/watch'

const SELLER = 'Przykładowy Sprzedawca Sp. z o.o.'
const MARK = 'Wizualizacja pomocnicza'

const compact = (text: string) => text.replace(/\s+/gu, '')

function recordRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

function expectOnlyOwnAssetsLoaded(pdf: DownloadedPdf, before: string[], origin: string) {
  const code = pdf.requests.filter(({ url }) => url.endsWith('.js')).map(({ url }) => url)
  expect(code.length).toBeGreaterThan(0)
  for (const { method, url } of pdf.requests) {
    expect(method).toBe('GET')
    expect(new URL(url).origin).toBe(origin)
    expect(new URL(url).pathname).toMatch(/^\/assets\/[\w-]+\.(js|woff2)$/)
  }
  expect(before.filter((url) => code.includes(url))).toEqual([])
}

async function expectPdf(pdf: DownloadedPdf, name: string, texts: string[]) {
  expect(pdf.name).toBe(name)
  expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  const content = await readPdf(pdf.bytes)
  for (const text of [SELLER, MARK, ...texts]) expect(compact(content.text)).toContain(compact(text))
  return content
}

test.describe('PDF visualisation with a mocked API', () => {
  test('downloads the clean example with the KSeF number and the verification link', async ({ page }) => {
    const watch = await watchPage(page)
    const requests = recordRequests(page)
    await mockApi(page, report('report-ok.json'))
    await openTool(page)
    await page.getByRole('button', { name: 'Przykład bez błędów' }).click()
    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną')
    await page.getByLabel('Numer KSeF').fill(SAMPLE_KSEF_NUMBER)
    await page.getByLabel('Numer KSeF').blur()
    const before = [...requests]

    const pdf = await downloadPdf(page)

    const content = await expectPdf(pdf, 'wizualizacja-FV-2026-11-0001.pdf', ['Usługa przykładowa A', SAMPLE_KSEF_NUMBER])
    expect(content.links).toEqual([expectedLink(example(EXAMPLE_CLEAN))])
    expectOnlyOwnAssetsLoaded(pdf, before, new URL(page.url()).origin)
    await expect(page.locator('.res .say')).toHaveText('Pobieranie PDF rozpoczęte.')
    await watch.expectClean()
  })

  test('downloads a correction invoice', async ({ page }) => {
    const watch = await watchPage(page)
    const requests = recordRequests(page)
    const bytes = fixture('faktura-korygujaca.xml')
    await mockApi(page, report('report-correction.json'))
    await openTool(page)
    await upload(page, { name: 'faktura-korygujaca.xml', bytes })
    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną')
    const before = [...requests]

    const pdf = await downloadPdf(page)

    const content = await expectPdf(pdf, 'wizualizacja-FK-1-02-2026.pdf', ['Faktura korygująca', 'Obniżka ceny przykładowej usługi'])
    expect(content.links).toEqual([expectedLink(bytes)])
    expectOnlyOwnAssetsLoaded(pdf, before, new URL(page.url()).origin)
    await watch.expectClean()
  })

  test('downloads a file of almost 3 MB', async ({ page }) => {
    test.setTimeout(120_000)
    const watch = await watchPage(page)
    const bytes = largeInvoice()
    await mockApi(page, report('report-large.json'))
    await openTool(page)
    await upload(page, { name: 'faktura-duza.xml', bytes })
    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną, ale ma 1 ostrzeżenie')

    const pdf = await downloadPdf(page)

    test.info().annotations.push({ type: 'pdf-ms', description: String(pdf.milliseconds) })
    expect(bytes.length).toBeGreaterThanOrEqual(2_900_000)
    expect(bytes.length).toBeLessThanOrEqual(3_000_000)
    const lastRow = [...bytes.toString('utf8').matchAll(/Pozycja przykładowa \d+, usługa fikcyjna/g)].at(-1)?.[0] ?? ''
    await expectPdf(pdf, 'wizualizacja-FV-2026-11-0001.pdf', [lastRow])
    await watch.expectClean()
  })

  test('offers no PDF for a file with errors', async ({ page }) => {
    const watch = await watchPage(page)
    await mockApi(page, report('report-errors.json'))
    await openTool(page)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

    await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
    await expect(page.getByText('PDF utworzysz po poprawieniu błędów.')).toBeVisible()
    await expect(pdfButton(page)).toBeHidden()
    await watch.expectClean()
  })
})
