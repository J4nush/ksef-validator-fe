import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { sha256Base64Url } from '../hash'

const bytes = (text: string) => new TextEncoder().encode(text)

function seededBytes(seed: number, length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length)
  let state = seed
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) >>> 0
    out[i] = state >>> 24
  }
  return out
}

describe('sha256Base64Url', () => {
  it('matches the vector computed with the MF algorithm', async () => {
    expect(await sha256Base64Url(bytes('<root>test</root>'))).toBe(
      'qrs2gCLXnTUy6--AHwHuDxFuCj0BYUGRGtBuGnJwN-c',
    )
  })

  it('hashes the exact bytes, so a trailing newline changes the result', async () => {
    expect(await sha256Base64Url(bytes('<root>test</root>\n'))).not.toBe(
      'qrs2gCLXnTUy6--AHwHuDxFuCj0BYUGRGtBuGnJwN-c',
    )
  })

  it('gives 43 Base64URL characters equal to an independent implementation', async () => {
    for (let seed = 1; seed <= 200; seed++) {
      const input = seededBytes(seed, seed * 7)
      const hash = await sha256Base64Url(input)

      expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(hash).toBe(createHash('sha256').update(input).digest('base64url'))
    }
  })
})
