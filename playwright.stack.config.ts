import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'
import base from './playwright.config.ts'

function webPort(): string {
  if (process.env.WEB_PORT) return process.env.WEB_PORT
  const env = resolve(process.env.BACKEND_DIR ?? '../backend', '.env')
  const line = existsSync(env) ? /^WEB_PORT=(\d+)\s*$/m.exec(readFileSync(env, 'utf8')) : null
  return line?.[1] ?? '18080'
}

export default defineConfig({
  ...base,
  testDir: './e2e/stack',
  testIgnore: undefined,
  retries: 0,
  use: { ...base.use, baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${webPort()}` },
  webServer: undefined,
})
