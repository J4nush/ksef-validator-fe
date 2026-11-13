import type { Page, Route } from '@playwright/test'
import { fixtureReport } from './invoice'

export type Reply = Parameters<Route['fulfill']>[0] | 'abort' | 'hang'

export const report = (name: string): Reply => ({ status: 200, contentType: 'application/json', json: fixtureReport(name) })

export const problem = (status: number, title: string, detail: string, headers: Record<string, string> = {}): Reply => ({
  status,
  contentType: 'application/problem+json',
  headers,
  body: JSON.stringify({ type: `/api/problems/${status}`, title, status, detail }),
})

export const nginxPage = (status: number, reason: string): Reply => ({
  status,
  contentType: 'text/html',
  body: `<html>\r\n<head><title>${status} ${reason}</title></head>\r\n<body>\r\n<center><h1>${status} ${reason}</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n`,
})

interface ApiCall {
  contentType: string | undefined
  body: Buffer
}

export async function mockApi(page: Page, ...replies: Reply[]): Promise<ApiCall[]> {
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
