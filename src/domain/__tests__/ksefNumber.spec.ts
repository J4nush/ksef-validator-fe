import { describe, expect, it } from 'vitest'
import { checkKsefNumber, ksefNumberChecksum, ksefNumberFromFileName } from '../ksefNumber'

const MF_EXAMPLE = '5265877635-20250826-0100001AF629-AF'
const SAMPLE = '1111111111-20260215-0100001AF629-2E'

describe('ksefNumberChecksum', () => {
  it('computes CRC-8 with polynomial 0x07 and initial value 0 over the first 32 characters', () => {
    expect(ksefNumberChecksum('5265877635-20250826-0100001AF629')).toBe('AF')
    expect(ksefNumberChecksum('1111111111-20260215-0100001AF629')).toBe('2E')
  })

  it('pads the result to two hex digits', () => {
    expect(ksefNumberChecksum('')).toBe('00')
  })
})

describe('checkKsefNumber', () => {
  it('accepts the MF documentation example', () => {
    expect(checkKsefNumber(MF_EXAMPLE)).toEqual({ valid: true, value: MF_EXAMPLE })
  })

  it('trims spaces and upper cases hex digits typed by hand', () => {
    expect(checkKsefNumber(`  ${SAMPLE.toLowerCase()} `)).toEqual({ valid: true, value: SAMPLE })
  })

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1111111111-20260215-0100001AF629-2', 'length'],
    ['1111111111-20260215-0100001AF629-2EE', 'length'],
    ['1111111111 20260215 0100001AF629 2E', 'format'],
    ['111111111X-20260215-0100001AF629-2E', 'format'],
    ['1111111111-20260215-0100001AG629-2E', 'format'],
    ['1111111111-20260215-0100001AF629-2F', 'checksum'],
    ['1111111111-20260216-0100001AF629-2E', 'checksum'],
  ])('rejects %j as %s', (input, reason) => {
    expect(checkKsefNumber(input)).toEqual({ valid: false, reason })
  })
})

describe('ksefNumberFromFileName', () => {
  it('finds a number with a valid checksum in the file name', () => {
    expect(ksefNumberFromFileName(`${SAMPLE}.xml`)).toBe(SAMPLE)
    expect(ksefNumberFromFileName(`faktura_${SAMPLE.toLowerCase()}_kopia.xml`)).toBe(SAMPLE)
  })

  it('skips a candidate with a wrong checksum and takes the next one', () => {
    expect(ksefNumberFromFileName(`1111111111-20260215-0100001AF629-2F ${MF_EXAMPLE}.xml`)).toBe(MF_EXAMPLE)
  })

  it('ignores a number glued to other digits or letters', () => {
    expect(ksefNumberFromFileName(`9${SAMPLE}.xml`)).toBeNull()
    expect(ksefNumberFromFileName(`${SAMPLE}5.xml`)).toBeNull()
  })

  it('gives nothing when the name has no number', () => {
    expect(ksefNumberFromFileName('FV-2-02-2026.xml')).toBeNull()
  })
})
