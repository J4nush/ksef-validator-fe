import { correction, generate } from 'lean-qr'
import { describe, expect, it } from 'vitest'
import { QR_QUIET_ZONE, qrCode } from '../qrCode'

const LINK = 'https://qr.ksef.mf.gov.pl/invoice/1111111111/06-11-2026/b8qszSEPu6hXsqhnASHPUoJEaNYCcta5YsaZswoBq44'

function paint(size: number, path: string): boolean[][] {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  for (const [, x, y, length] of path.matchAll(/M(\d+) (\d+)\.5h(\d+)/g)) {
    for (let dx = 0; dx < Number(length); dx++) grid[Number(y)]![Number(x) + dx] = true
  }
  return grid
}

// ISO/IEC 18004 format information next to the top left finder, unmasked with 0x5412.
function correctionLevel(dark: (x: number, y: number) => boolean): string {
  const cells: [number, number][] = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
    [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ]
  const bits = cells.reduce((value, [x, y]) => (value << 1) | (dark(x, y) ? 1 : 0), 0) ^ 0x5412
  return (['M', 'L', 'H', 'Q'] as const)[bits >> 13]!
}

describe('qrCode', () => {
  it('adds a quiet zone of four modules on every side', () => {
    const code = qrCode(LINK)
    const grid = paint(code.size, code.path)

    expect(QR_QUIET_ZONE).toBe(4)
    expect(code.size).toBe(code.modules + 2 * QR_QUIET_ZONE)
    for (let i = 0; i < code.size; i++) {
      for (const [x, y] of [[i, 0], [i, 3], [0, i], [3, i], [i, code.size - 1], [code.size - 1, i]] as const) {
        expect(grid[y]![x]).toBe(false)
      }
    }
  })

  it('draws the three finder patterns where a scanner expects them', () => {
    const { size, modules, path } = qrCode(LINK)
    const grid = paint(size, path)
    const at = (x: number, y: number) => grid[y + QR_QUIET_ZONE]![x + QR_QUIET_ZONE]

    for (const [ox, oy] of [[0, 0], [modules - 7, 0], [0, modules - 7]] as const) {
      expect([0, 1, 2, 3, 4, 5, 6].map((i) => at(ox + i, oy))).toEqual(Array(7).fill(true))
      expect([1, 2, 3, 4, 5].map((i) => at(ox + i, oy + 1))).toEqual([false, false, false, false, false])
      expect(at(ox + 3, oy + 3)).toBe(true)
    }
  })

  it('reads the correction level the way a scanner does', () => {
    const low = generate(LINK, { minCorrectionLevel: correction.L, maxCorrectionLevel: correction.L })

    expect(correctionLevel((x, y) => low.get(x, y))).toBe('L')
  })

  it('uses error correction level M', () => {
    const { size, path } = qrCode(LINK)
    const grid = paint(size, path)

    expect(correctionLevel((x, y) => grid[y + QR_QUIET_ZONE]![x + QR_QUIET_ZONE]!)).toBe('M')
  })

  it('draws each row as horizontal runs of dark modules', () => {
    expect(qrCode(LINK).path).toMatch(/^(M\d+ \d+\.5h\d+)+$/)
  })

  it('gives the same code for the same text', () => {
    expect(qrCode(LINK)).toEqual(qrCode(LINK))
  })

  it('gives a different code for a different link', () => {
    expect(qrCode(LINK.replace('qr.ksef', 'qr-test.ksef')).path).not.toBe(qrCode(LINK).path)
  })
})
