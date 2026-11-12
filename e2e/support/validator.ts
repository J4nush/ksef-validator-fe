import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

export const TOOL_HEADING = 'Walidator XML faktur KSeF: sprawdź plik FA(3) bez konta'

export async function openTool(page: Page) {
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/\bjs\b/)
}

export async function upload(page: Page, file: { name: string; bytes: Buffer; mimeType?: string }) {
  await page.getByLabel('Wybierz plik').setInputFiles({
    name: file.name,
    mimeType: file.mimeType ?? 'text/xml',
    buffer: file.bytes,
  })
}

export const resultHeading = (page: Page) => page.getByRole('heading', { level: 1 })
export const finding = (page: Page, title: string) => page.getByRole('article', { name: title })
export const verificationLinkText = (page: Page) => page.locator('#vlink')
// Playwright injects an inline style for screenshots that WebKit reports under CSP, so take it after the clean check.
export const qrScreenshot = (page: Page) => page.locator('.qr__plate').screenshot()

export async function expectNoAxeViolations(page: Page) {
  // Playwright Firefox 1.65 crashes its content process inside axe after form input, axe runs in the other engines.
  if (page.context().browser()?.browserType().name() === 'firefox') {
    test.info().annotations.push({ type: 'axe', description: 'skipped in Firefox' })
    return
  }
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

export async function expectNothingStored(page: Page, needle: string) {
  expect(page.url()).not.toContain(needle)
  const stored = await page.evaluate(() => [
    ...Object.entries(localStorage),
    ...Object.entries(sessionStorage),
    ...document.cookie.split(';'),
  ])
  expect(stored.flat().join('\n')).not.toContain(needle)
}
