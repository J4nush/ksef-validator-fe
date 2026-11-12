import { expect, type Page } from '@playwright/test'

export interface PageWatch {
  messages: string[]
  expectClean(): Promise<void>
}

type CspWindow = Window & { __csp?: string[] }

export async function watchPage(page: Page, allowedErrors: RegExp[] = []): Promise<PageWatch> {
  const messages: string[] = []
  const problems: string[] = []

  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as CspWindow).__csp = seen
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  page.on('console', (message) => {
    messages.push(message.text())
    const allowed = allowedErrors.some((pattern) => pattern.test(message.text()))
    if (message.type() === 'error' && !allowed) problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`))

  return {
    messages,
    async expectClean() {
      expect(problems).toEqual([])
      expect(await page.evaluate(() => (window as CspWindow).__csp ?? null)).toEqual([])
    },
  }
}

export const failedStatusLog = (status: number) => new RegExp(`status of ${status}\\b`)
