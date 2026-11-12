import { expect, test, type Page, type Route } from '@playwright/test'
import {
  EXAMPLE_CLEAN,
  EXAMPLE_ERRORS,
  SAMPLE_KSEF_NUMBER,
  example,
  expectedLink,
  fixture,
  fixtureReport,
} from './support/invoice'
import { decodeQr } from './support/qr'
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
} from './support/validator'
import { failedStatusLog, watchPage } from './support/watch'

type Reply = Parameters<Route['fulfill']>[0] | 'abort' | 'hang'

const report = (name: string): Reply => ({ status: 200, contentType: 'application/json', json: fixtureReport(name) })

const problem = (status: number, title: string, detail: string, headers: Record<string, string> = {}): Reply => ({
  status,
  contentType: 'application/problem+json',
  headers,
  body: JSON.stringify({ type: `/api/problems/${status}`, title, status, detail }),
})

const nginxPage = (status: number, reason: string): Reply => ({
  status,
  contentType: 'text/html',
  body: `<html>\r\n<head><title>${status} ${reason}</title></head>\r\n<body>\r\n<center><h1>${status} ${reason}</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n`,
})

interface ApiCall {
  contentType: string | undefined
  body: Buffer
}

async function mockApi(page: Page, ...replies: Reply[]): Promise<ApiCall[]> {
  const calls: ApiCall[] = []
  await page.route('**/api/internal/validate', async (route) => {
    const request = route.request()
    calls.push({ contentType: request.headers()['content-type'], body: request.postDataBuffer() ?? Buffer.alloc(0) })
    const reply = replies[Math.min(calls.length, replies.length) - 1]
    if (reply === 'hang') return
    if (reply === 'abort' || reply === undefined) return route.abort('failed')
    await route.fulfill(reply)
  })
  return calls
}

const uploadMessage = (page: Page) => page.locator('.drop__msg')

test.describe('validator with a mocked API', () => {
  test('sends the raw file and walks through the errors', async ({ page }) => {
    const watch = await watchPage(page)
    const calls = await mockApi(page, report('report-errors.json'))
    await openTool(page)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

    await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
    await expect(resultHeading(page)).toBeFocused()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.contentType).toBe('application/xml')
    expect(calls[0]?.body.equals(example(EXAMPLE_ERRORS))).toBe(true)

    const nip = finding(page, 'Błędny NIP')
    await expect(nip).toContainText('NIP sprzedawcy')
    await expect(nip.getByText('Jest', { exact: true })).toBeVisible()
    await expect(nip.getByText('Powinno być', { exact: true })).toBeVisible()
    await expect(nip.locator('del')).toHaveText('2')
    await expect(nip.locator('ins')).toHaveText('1')
    await nip.getByText('Szczegóły techniczne').click()
    await expect(nip.getByRole('region', { name: 'Fragment pliku XML, linia 11' })).toContainText('<NIP>1111111112</NIP>')

    await nip.getByRole('button', { name: 'Następne: Powtórzony numer wiersza' }).click()
    await expect(finding(page, 'Powtórzony numer wiersza')).toBeVisible()

    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  test('shows invoice data, the verification link and a readable QR code for a clean file', async ({ page }) => {
    const watch = await watchPage(page)
    await mockApi(page, report('report-ok.json'))
    await openTool(page)

    await page.getByRole('button', { name: 'Przykład bez błędów' }).click()

    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną')
    await expect(page.getByText('Przykładowy Sprzedawca Sp. z o.o.').first()).toBeVisible()
    await expect(page.getByText('Wizualizacja pomocnicza')).toBeVisible()
    const link = expectedLink(example(EXAMPLE_CLEAN))
    await expect(verificationLinkText(page)).toHaveText(link)
    await expectNoAxeViolations(page)
    await watch.expectClean()

    expect(await decodeQr(await qrScreenshot(page))).toEqual([link])
  })

  test('accepts a KSeF number typed by hand and rejects a wrong checksum', async ({ page }) => {
    const watch = await watchPage(page)
    await mockApi(page, report('report-ok.json'))
    await openTool(page)
    await page.getByRole('button', { name: 'Przykład bez błędów' }).click()
    const number = page.getByLabel('Numer KSeF')

    await number.fill(SAMPLE_KSEF_NUMBER.replace(/65$/, '66'))
    await number.blur()
    await expect(page.getByText('Dwa ostatnie znaki nie zgadzają się z resztą numeru.', { exact: false })).toBeVisible()
    await expect(number).toHaveAttribute('aria-invalid', 'true')

    await number.fill(SAMPLE_KSEF_NUMBER)
    await number.blur()
    await expect(page.locator('.qr figcaption')).toHaveText(`Numer KSeF: ${SAMPLE_KSEF_NUMBER}`)
    await expect(page.getByText('Wizualizacja pomocnicza')).toBeHidden()
    await expect(number).not.toHaveAttribute('aria-invalid', 'true')

    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  test('passes a file with warnings and still offers the link', async ({ page }) => {
    const watch = await watchPage(page)
    const bytes = fixture('faktura-z-ostrzezeniem.xml')
    await mockApi(page, report('report-warnings.json'))
    await openTool(page)

    await upload(page, { name: 'faktura-z-ostrzezeniem.xml', bytes })

    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną, ale ma 1 ostrzeżenie')
    await expect(finding(page, 'Powtórzony numer wiersza')).toBeVisible()
    await expect(verificationLinkText(page)).toHaveText(expectedLink(bytes))

    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  test('explains an FA(2) file without invoice cards or link', async ({ page }) => {
    const watch = await watchPage(page)
    await mockApi(page, report('report-fa2.json'))
    await openTool(page)

    await upload(page, { name: 'faktura-fa2.xml', bytes: fixture('faktura-fa2.xml') })

    await expect(resultHeading(page)).toHaveText('Faktura w starszym wzorze FA(2)')
    await expect(page.getByRole('heading', { name: 'Kod QR i link weryfikacyjny' })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Co znaleźliśmy' })).toBeHidden()

    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  test('does not send a file over the size limit', async ({ page }) => {
    const watch = await watchPage(page)
    const calls = await mockApi(page, report('report-ok.json'))
    await openTool(page)

    await upload(page, { name: 'za-duza.xml', bytes: Buffer.alloc(3_000_001, ' ') })

    await expect(uploadMessage(page)).toContainText('Nie wysłaliśmy pliku.')
    await expect(page.getByRole('button', { name: 'Spróbuj ponownie' })).toBeHidden()
    expect(calls).toEqual([])

    await expectNoAxeViolations(page)
    await watch.expectClean()
  })

  const failures: { name: string; reply: Reply; status: number; message: string }[] = [
    {
      name: '413 from the API',
      reply: problem(413, 'Plik jest za duży', 'Plik może mieć najwyżej 3 000 000 bajtów.'),
      status: 413,
      message: 'Plik może mieć najwyżej 3 000 000 bajtów.',
    },
    {
      name: '413 HTML page from nginx',
      reply: nginxPage(413, 'Request Entity Too Large'),
      status: 413,
      message: 'Serwer nie przyjął pliku, bo jest za duży.',
    },
    {
      name: '415 from the API',
      reply: problem(415, 'Nieobsługiwany typ pliku', 'Wyślij plik XML z nagłówkiem Content-Type application/xml lub text/xml.'),
      status: 415,
      message: 'Wyślij plik XML z nagłówkiem Content-Type application/xml lub text/xml.',
    },
    {
      name: '429 from the API with Retry-After',
      reply: problem(429, 'Za dużo sprawdzeń', 'Przekroczono limit sprawdzeń z tego adresu.', { 'Retry-After': '30' }),
      status: 429,
      message: 'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 30 sekund.',
    },
    {
      name: '429 HTML page from nginx without Retry-After',
      reply: nginxPage(429, 'Too Many Requests'),
      status: 429,
      message: 'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za minutę.',
    },
    {
      name: '500 from the API',
      reply: problem(500, 'Błąd serwera', 'Nie udało się sprawdzić pliku. Spróbuj ponownie za chwilę.'),
      status: 500,
      message: 'Serwer nie mógł teraz sprawdzić pliku (błąd 500).',
    },
    {
      name: '502 HTML page from nginx',
      reply: nginxPage(502, 'Bad Gateway'),
      status: 502,
      message: 'Serwer nie mógł teraz sprawdzić pliku (błąd 502).',
    },
  ]

  for (const { name, reply, status, message } of failures) {
    test(`explains a ${name} and retries the same file`, async ({ page }) => {
      const watch = await watchPage(page, [failedStatusLog(status)])
      const calls = await mockApi(page, reply, report('report-errors.json'))
      await openTool(page)

      await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

      await expect(uploadMessage(page)).toContainText(message)
      await expect(uploadMessage(page)).toHaveClass(/is-err/)
      await expectNoAxeViolations(page)

      await page.getByRole('button', { name: 'Spróbuj ponownie' }).click()
      await expect(resultHeading(page)).toHaveText('Faktura ma 1 błąd do poprawienia')
      expect(calls).toHaveLength(2)
      expect(calls[1]?.body.equals(example(EXAMPLE_ERRORS))).toBe(true)
      await watch.expectClean()
    })
  }

  test('treats a 200 response that is not a report as unexpected', async ({ page }) => {
    const watch = await watchPage(page)
    await mockApi(page, { status: 200, contentType: 'application/json', json: { schemaVersion: '1.0' } })
    await openTool(page)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

    await expect(uploadMessage(page)).toContainText('Serwer odpowiedział w nieoczekiwany sposób.')
    await watch.expectClean()
  })

  test('explains a lost connection', async ({ page }) => {
    const watch = await watchPage(page, [/Failed to load resource/])
    await mockApi(page, 'abort')
    await openTool(page)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()

    await expect(uploadMessage(page)).toContainText('Nie udało się połączyć z serwerem.')
    await watch.expectClean()
  })

  test('gives up after 30 seconds without an answer', async ({ page }) => {
    const watch = await watchPage(page, [/Failed to load resource|cancelled/])
    await page.clock.install()
    await mockApi(page, 'hang')
    await openTool(page)

    await page.getByRole('button', { name: 'Wypróbuj na przykładzie' }).click()
    await expect(uploadMessage(page)).toContainText('Sprawdzamy plik faktura-z-bledami.xml.')
    await page.clock.runFor(30_000)

    await expect(uploadMessage(page)).toContainText('Serwer nie odpowiedział w ciągu 30 sekund.')
    await watch.expectClean()
  })

  test('goes back to the form and keeps the result out of the URL and storage', async ({ page }) => {
    const watch = await watchPage(page)
    await mockApi(page, report('report-ok.json'))
    await openTool(page)

    await page.getByRole('button', { name: 'Przykład bez błędów' }).click()
    await expect(resultHeading(page)).toHaveText('Plik przeszedł kontrolę techniczną')
    expect(new URL(page.url()).pathname).toBe('/')
    expect(new URL(page.url()).search).toBe('')
    await expectNothingStored(page, 'FV/2026/11/0001')
    await expectNothingStored(page, '1111111111')

    await page.goBack()
    await expect(resultHeading(page)).toHaveText(TOOL_HEADING)
    await watch.expectClean()
  })

  for (const [button, reportName, heading] of [
    ['Wypróbuj na przykładzie', 'report-errors.json', 'Faktura ma 1 błąd do poprawienia'],
    ['Przykład bez błędów', 'report-ok.json', 'Plik przeszedł kontrolę techniczną'],
  ] as const) {
    test(`has no axe violations in the light theme after "${button}"`, async ({ page }) => {
      const watch = await watchPage(page)
      await mockApi(page, report(reportName))
      await openTool(page)
      await page.getByRole('button', { name: /Przełącz motyw/ }).click()
      await expect(page.locator('html')).toHaveClass(/\blight\b/)

      await page.getByRole('button', { name: button }).click()

      await expect(resultHeading(page)).toHaveText(heading)
      await expectNoAxeViolations(page)
      await watch.expectClean()
    })
  }
})
