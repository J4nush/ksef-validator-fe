import { describe, expect, it } from 'vitest'
import { findingDiff } from '../findingDiff'

const finding = (id: string, params: Record<string, string>) => ({ id, params })

describe('findingDiff', () => {
  it('marks the check digit of a NIP and names the expected digit', () => {
    expect(findingDiff(finding('TECH-NIP-CHECKSUM', { label: 'NIP sprzedawcy', value: '1111111112', expected: '1' }))).toEqual({
      kind: 'check-digit',
      is: [
        { text: '111111111', mark: false },
        { text: '2', mark: true },
      ],
      digit: '1',
    })
  })

  it('marks the check digit inside an internal identifier', () => {
    const diff = findingDiff(finding('TECH-INTERNAL-ID-CHECKSUM', { value: '2222222223-00001', expected: '2' }))

    expect(diff).toEqual({
      kind: 'check-digit',
      is: [
        { text: '222222222', mark: false },
        { text: '3', mark: true },
        { text: '-00001', mark: false },
      ],
      digit: '2',
    })
  })

  it('has nothing to compare when the check digit cannot be computed', () => {
    expect(findingDiff(finding('TECH-NIP-CHECKSUM', { value: '1000000000' }))).toBeNull()
  })

  it('marks only the differing characters of two amounts', () => {
    expect(findingDiff(finding('AMT-TOTAL', { value: '9594.10', expected: '9594.00' }))).toEqual({
      kind: 'value',
      is: [
        { text: '9594.', mark: false },
        { text: '1', mark: true },
        { text: '0', mark: false },
      ],
      should: [
        { text: '9594.', mark: false },
        { text: '0', mark: true },
        { text: '0', mark: false },
      ],
    })
  })

  it('marks a whole amount when nothing is shared', () => {
    expect(findingDiff(finding('AMT-LINE-NET', { value: '12.00', expected: '345.51' }))).toEqual({
      kind: 'value',
      is: [{ text: '12.00', mark: true }],
      should: [{ text: '345.51', mark: true }],
    })
  })

  it('handles an amount that only grows at the end', () => {
    expect(findingDiff(finding('AMT-RATE-NET', { value: '100', expected: '1000' }))).toEqual({
      kind: 'value',
      is: [{ text: '100', mark: false }],
      should: [
        { text: '100', mark: false },
        { text: '0', mark: true },
      ],
    })
  })

  it('lists the allowed values for a value outside the list', () => {
    expect(findingDiff(finding('XSD-ENUM', { label: 'stawka', value: '23%', allowed: '23, 22, 8' }))).toEqual({
      kind: 'allowed',
      is: [{ text: '23%', mark: true }],
      allowed: '23, 22, 8',
    })
  })

  it('does not treat a field name as an expected value', () => {
    expect(findingDiff(finding('XSD-ELEMENT-ORDER', { label: 'P_2', expected: 'data wystawienia' }))).toBeNull()
  })

  it('has nothing to compare without a value', () => {
    expect(findingDiff(finding('TECH-LINE-NUMBER-DUPLICATE', { label: 'numer wiersza' }))).toBeNull()
  })

  it('has nothing to compare when the values are equal', () => {
    expect(findingDiff(finding('AMT-TOTAL', { value: '1.00', expected: '1.00' }))).toBeNull()
  })
})
