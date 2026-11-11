import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

function watchForProblems(page: Page) {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`))
  return problems
}

async function cspViolations(page: Page) {
  return page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __csp: string[] }).__csp = seen
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
})

test('serves a prerendered Polish page with title and description', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page).toHaveTitle('Walidator XML faktur KSeF: sprawdź plik FA(3) bez konta')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /FA\(3\)/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Walidator XML faktur KSeF: sprawdź plik FA(3) bez konta',
  )
})

test('loads without console errors and CSP violations', async ({ page }) => {
  const problems = watchForProblems(page)

  await page.goto('/')
  await page.getByRole('button', { name: /Przełącz motyw/ }).click()

  expect(problems).toEqual([])
  expect(await cspViolations(page)).toEqual([])
})

test('credits the author in the footer', async ({ page }) => {
  await page.goto('/')

  const author = page.getByRole('contentinfo').getByRole('link', { name: 'Michał Ziółek' })
  await expect(author).toHaveAttribute('href', 'https://michal-ziolek.dev')
  await expect(page.getByRole('contentinfo')).toContainText(`© ${new Date().getFullYear()} Michał Ziółek`)
})

test('starts dark and remembers light only after a click', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  const toggle = page.getByRole('button', { name: /Przełącz motyw/ })

  await expect(html).not.toHaveClass(/\blight\b/)
  expect(await page.evaluate(() => localStorage.length)).toBe(0)

  await toggle.click()
  await expect(html).toHaveClass(/\blight\b/)
  await expect(page.getByRole('status')).toContainText('Zapamiętaliśmy jasny motyw w tej przeglądarce.')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')

  await page.reload()
  await expect(html).toHaveClass(/\blight\b/)

  await page.getByRole('button', { name: /Przełącz motyw/ }).click()
  await expect(html).not.toHaveClass(/\blight\b/)
  await expect(page.getByRole('status')).toHaveText('Wróciliśmy do ciemnego motywu i usunęliśmy zapisany wybór.')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test('has no axe violations in the dark theme', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/\bjs\b/)

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})

test('has no axe violations in the light theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/\blight\b/)

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})
