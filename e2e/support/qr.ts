import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

let ready: Promise<unknown> | null = null

function prepare() {
  const wasm = createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm')
  // The default loader downloads the binary from a CDN, tests stay offline.
  return readFile(wasm).then((binary) =>
    prepareZXingModule({ overrides: { wasmBinary: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) }, fireImmediately: true }),
  )
}

export async function decodeQr(png: Buffer): Promise<string[]> {
  ready ??= prepare()
  await ready
  const results = await readBarcodes(new Blob([new Uint8Array(png)]), { formats: ['QRCode'], tryHarder: true })
  return results.filter((result) => result.isValid).map((result) => result.text)
}
