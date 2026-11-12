import process from 'node:process'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  EXAMPLE_CLEAN,
  EXAMPLE_ERRORS,
  SAMPLE_KSEF_NUMBER,
  example,
  expectedLink,
  fixture,
  fixtureReport,
  markedInvoice,
} from '../support/invoice'
import { decodeQr } from '../support/qr'
import {
  TOOL_HEADING,
  expectNoAxeViolations,
  expectNothingStored,
  finding,
  openTool,
  qrScreenshot,
  resultHeading,
  upload,
  verificationLinkText,
} from '../support/validator'
import { watchPage } from '../support/watch'

const VALIDATE = '/api/internal/validate'

function countApiCalls(page: Page) {
  const calls: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === VALIDATE) calls.push(request.method())
  })
  return calls
}

async function tabTo(page: Page, target: Locator) {
  // WebKit on macOS moves Tab focus between form fields only, like Safari with default settings.
  const key = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab'
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press(key)
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('target never received focus from the keyboard')
}

test.describe('validator against the running API', () => {
  test('keeps the mocked reports equal to what the API returns', async ({ request }) => {
    const cases = [
      [example(EXAMPLE_ERRORS), 'report-errors.json'],
      [example(EXAMPLE_CLEAN), 'report-ok.json'],
      [fixture('faktura-z-ostrzezeniem.xml'), 'report-warnings.json'],
      [fixture('faktura-fa2.xml'), 'report-fa2.json'],
      [fixture('notatka.txt'), 'report-malformed.json'],
    ] as const

    for (const [bytes, name] of cases) {
      const response = await request.post(VALIDATE, { headers: { 'Content-Type': 'application/xml' }, data: bytes })
      expect(response.status(), name).toBe(200)
      expect(await response.json(), name).toEqual(fixtureReport(name))
    }
  })

  test('shows the errors of the example with the diff and the XML fragment', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

    await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
    await expect(page.getByRole('heading', { name: 'Co znaleźliśmy' })).toBeVisible()
    const nip = finding(page, 'Błędny NIP')
    await expect(nip.getByText('Jest', { exact: true })).toBeVisible()
    await expect(nip.getByText('Powinno być', { exact: true })).toBeVisible()
    await expect(nip.locator('del')).toHaveText('2')
    await nip.getByText('Szczegóły techniczne').click()
    await expect(nip.getByRole('region', { name: 'Fragment pliku XML, linia 11' })).toContainText('<NIP>1111111112</NIP>')
    await nip.getByRole('button', { name: 'Następne: Powtórzony numer wiersza' }).click()
    await expect(finding(page, 'Powtórzony numer wiersza')).toBeVisible()

    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  test('shows invoice cards, the link and a QR code that decodes to the link computed from the file', async ({ page }) => {
    const watch = await watchPage(page)
    const bytes = example(EXAMPLE_CLEAN)
    const link = expectedLink(bytes)
    await openTool(page)

    await upload(page, { name: EXAMPLE_CLEAN, bytes })

    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną')
    await expect(page.getByRole('heading', { name: 'Sprzedawca' })).toBeVisible()
    await expect(page.getByText('Przykładowy Nabywca Sp. z o.o.').first()).toBeVisible()
    await expect(verificationLinkText(page)).toHaveText(link)
    await expectNoAxeViolations(page)
    await watch.expectClean()

    expect(await decodeQr(await qrScreenshot(page))).toEqual([link])
  })

  test('does not send a file over the size limit', async ({ page }) => {
    const watch = await watchPage(page)
    const calls = countApiCalls(page)
    await openTool(page)

    await upload(page, { name: 'za-duza.xml', bytes: Buffer.alloc(3_000_001, ' ') })

    await expect(page.locator('.drop__msg')).toContainText('Nie wysłaliśmy pliku.')
    expect(calls).toEqual([])
    await watch.expectClean()
  })

  test('reports a file that is not XML', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)

    await upload(page, { name: 'notatka.txt', bytes: fixture('notatka.txt'), mimeType: 'text/plain' })

    await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
    await expect(finding(page, 'Uszkodzony plik XML')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kod QR i link weryfikacyjny' })).toBeHidden()
    await watch.expectClean()
  })

  test('explains an FA(2) invoice', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)

    await upload(page, { name: 'faktura-fa2.xml', bytes: fixture('faktura-fa2.xml') })

    await expect(resultHeading(page)).toHaveText('Faktura w starszym wzorze FA(2)')
    await expect(page.getByRole('heading', { name: 'Sprzedawca' })).toBeHidden()
    await watch.expectClean()
  })

  test('puts a KSeF number typed by hand under the QR code', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)
    await page.getByRole('button', { name: 'Przykład bez błędów' }).click()
    const number = page.getByLabel('Numer KSeF')

    await number.fill(SAMPLE_KSEF_NUMBER)
    await number.blur()

    await expect(page.locator('.qr figcaption')).toHaveText(`Numer KSeF: ${SAMPLE_KSEF_NUMBER}`)
    await expect(page.getByText('Wizualizacja pomocnicza')).toBeHidden()
    await watch.expectClean()
  })

  test('copies the link or selects it for manual copying', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)
    await page.getByRole('button', { name: 'Przykład bez błędów' }).click()
    await expect(verificationLinkText(page)).toHaveText(expectedLink(example(EXAMPLE_CLEAN)))

    await page.getByRole('button', { name: 'Skopiuj link' }).click()

    await expect(page.locator('.res .say')).toHaveText(
      /^(Link skopiowany\.|Nie udało się skopiować\. Link jest zaznaczony, skopiuj go ręcznie\.)$/,
    )
    await watch.expectClean()
  })

  test('works in the light theme', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)
    await page.getByRole('button', { name: /Przełącz motyw/ }).click()
    await expect(page.locator('html')).toHaveClass(/\blight\b/)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

    await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  test('runs the whole flow from the keyboard', async ({ page }) => {
    const watch = await watchPage(page)
    await openTool(page)

    const tryExample = page.getByRole('button', { name: 'Wypróbuj na przykładzie' })
    await tabTo(page, tryExample)
    await page.keyboard.press('Enter')

    await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
    await expect(resultHeading(page)).toBeFocused()
    const again = page.getByRole('button', { name: 'Sprawdź poprawiony plik' })
    await tabTo(page, again)
    await page.keyboard.press('Enter')

    await expect(resultHeading(page)).toHaveText(TOOL_HEADING)
    await expect(page.getByLabel('Wybierz plik')).toBeFocused()
    await watch.expectClean()
  })

  test('keeps a marked invoice and its file name out of the console, URL and storage', async ({ page }) => {
    const watch = await watchPage(page)
    const invoice = markedInvoice()
    await openTool(page)

    await upload(page, invoice)

    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną')
    await expect(page.getByText(invoice.name)).toBeVisible()
    await expect(verificationLinkText(page)).toHaveText(expectedLink(invoice.bytes))
    await expectNothingStored(page, invoice.marker)
    expect(watch.messages.join('\n')).not.toContain(invoice.marker)
    await watch.expectClean()
  })
})
