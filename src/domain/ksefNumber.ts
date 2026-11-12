export type KsefNumberCheck =
  | { valid: true; value: string }
  | { valid: false; reason: 'empty' | 'length' | 'format' | 'checksum' }

const LENGTH = 35
const DATA_LENGTH = 32
const FORMAT = /^\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2}$/
const IN_TEXT = /(?<![0-9A-Za-z])\d{10}-\d{8}-[0-9A-Fa-f]{12}-[0-9A-Fa-f]{2}(?![0-9A-Za-z])/g

export function ksefNumberChecksum(data: string): string {
  let crc = 0
  for (const byte of new TextEncoder().encode(data)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff
    }
  }
  return crc.toString(16).toUpperCase().padStart(2, '0')
}

export function checkKsefNumber(input: string): KsefNumberCheck {
  const value = input.trim().toUpperCase()
  if (value === '') return { valid: false, reason: 'empty' }
  if (value.length !== LENGTH) return { valid: false, reason: 'length' }
  if (!FORMAT.test(value)) return { valid: false, reason: 'format' }
  if (ksefNumberChecksum(value.slice(0, DATA_LENGTH)) !== value.slice(-2)) return { valid: false, reason: 'checksum' }
  return { valid: true, value }
}

export function ksefNumberFromFileName(fileName: string): string | null {
  for (const [candidate] of fileName.matchAll(IN_TEXT)) {
    const check = checkKsefNumber(candidate)
    if (check.valid) return check.value
  }
  return null
}
