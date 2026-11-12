import { describe, expect, it } from 'vitest'
import type { Report } from '@/api/report'
import { issueDateForLink, linkAvailability, verificationLink } from '../verificationLink'

const HASH = 'UtQp9Gpc51y-u3xApZjIjgkpZ01js-J8KflSPW8WzIE'

describe('verificationLink', () => {
  it('builds the MF example for the test environment', () => {
    expect(
      verificationLink({ environment: 'TE', sellerNip: '1111111111', issueDate: '2026-02-01', hash: HASH }),
    ).toBe(`https://qr-test.ksef.mf.gov.pl/invoice/1111111111/01-02-2026/${HASH}`)
  })

  it('uses the address of each environment', () => {
    const link = (environment: 'TE' | 'DEMO' | 'PROD') =>
      verificationLink({ environment, sellerNip: '1111111111', issueDate: '2026-02-01', hash: HASH })

    expect(link('DEMO')).toMatch(/^https:\/\/qr-demo\.ksef\.mf\.gov\.pl\/invoice\//)
    expect(link('PROD')).toMatch(/^https:\/\/qr\.ksef\.mf\.gov\.pl\/invoice\//)
  })

  it('builds the link for the MF sample number 1 in production', () => {
    expect(
      verificationLink({
        environment: 'PROD',
        sellerNip: '9999999999',
        issueDate: '2026-02-15',
        hash: 'X-wQflQVyRs1fImlI-xDPnWk1V37hys4O1lkx9iJbSA',
      }),
    ).toBe('https://qr.ksef.mf.gov.pl/invoice/9999999999/15-02-2026/X-wQflQVyRs1fImlI-xDPnWk1V37hys4O1lkx9iJbSA')
  })

  it.each([
    ['NIP with a dash', { sellerNip: '111-111-11-11' }],
    ['NIP too short', { sellerNip: '111111111' }],
    ['date in Polish format', { issueDate: '01.02.2026' }],
    ['date with time', { issueDate: '2026-02-01T00:00:00Z' }],
    ['padded hash', { hash: `${HASH}=` }],
    ['standard Base64 hash', { hash: HASH.replace('-', '+') }],
  ])('gives no link for a %s', (_, override) => {
    const input = { environment: 'PROD', sellerNip: '1111111111', issueDate: '2026-02-01', hash: HASH } as const

    expect(verificationLink({ ...input, ...override })).toBeNull()
  })
})

describe('issueDateForLink', () => {
  it('reorders the date without a Date object, so the time zone cannot shift it', () => {
    expect(issueDateForLink('2026-01-01')).toBe('01-01-2026')
    expect(issueDateForLink('2025-12-31')).toBe('31-12-2025')
  })

  it.each(['2026-13-01', '2026-00-10', '2026-02-00', '2026-02-32', '26-02-01', ' 2026-02-01'])(
    'rejects %s',
    (value) => {
      expect(issueDateForLink(value)).toBeNull()
    },
  )
})

describe('linkAvailability', () => {
  const report = (result: Report['result'], sha256Base64Url = HASH) =>
    ({ result, document: { sha256Base64Url } }) as Report

  it('allows the link for a passed or warning result when both hashes agree', () => {
    expect(linkAvailability(report('PASSED'), HASH)).toBe('available')
    expect(linkAvailability(report('WARNINGS'), HASH)).toBe('available')
  })

  it('refuses the link for errors and unsupported documents', () => {
    expect(linkAvailability(report('ERRORS'), HASH)).toBe('not-for-result')
    expect(linkAvailability(report('UNSUPPORTED'), HASH)).toBe('not-for-result')
  })

  it('refuses the link when the browser hash differs from the server hash', () => {
    expect(linkAvailability(report('PASSED', 'qrs2gCLXnTUy6--AHwHuDxFuCj0BYUGRGtBuGnJwN-c'), HASH)).toBe(
      'hash-mismatch',
    )
  })
})
