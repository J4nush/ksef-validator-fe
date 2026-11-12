import { correction, generate, mode } from 'lean-qr'

export const QR_QUIET_ZONE = 4

export interface QrCode {
  modules: number
  size: number
  path: string
}

export function qrCode(text: string): QrCode {
  const code = generate(mode.bytes(new TextEncoder().encode(text)), {
    minCorrectionLevel: correction.M,
    maxCorrectionLevel: correction.M,
  })
  const runs: string[] = []
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) {
      if (!code.get(x, y)) continue
      const start = x
      while (x + 1 < code.size && code.get(x + 1, y)) x++
      runs.push(`M${start + QR_QUIET_ZONE} ${y + QR_QUIET_ZONE}.5h${x - start + 1}`)
    }
  }
  return { modules: code.size, size: code.size + 2 * QR_QUIET_ZONE, path: runs.join('') }
}
