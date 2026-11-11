import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { securityHeaders } from '../lib/security-headers.mjs'

const nginx = readFileSync('docker/nginx/security-headers.conf', 'utf8')

function nginxHeaders(conf: string) {
  return Object.fromEntries(
    [...conf.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"\s+always;$/gm)].map((m) => [m[1], m[2]]),
  )
}

describe('security headers', () => {
  it('locks scripts, styles, fonts and connections to the own origin', () => {
    const csp = securityHeaders['Content-Security-Policy']

    expect(csp).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
    )
  })

  it('turns off powerful browser features', () => {
    const policy = securityHeaders['Permissions-Policy']

    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(policy).toContain(`${feature}=()`)
    }
  })

  it('sends the same headers from nginx and from the preview server', () => {
    expect(nginxHeaders(nginx)).toEqual(securityHeaders)
  })
})
