import { describe, expect, it } from 'vitest'
import { formatAmount, formatDate, formatNumber, paymentFormLabel, rateLabel, rateTotalLabel } from '../format'

const nbsp = ' '

describe('formatAmount', () => {
  it.each([
    ['0', '0,00'],
    ['5', '5,00'],
    ['430.5', '430,50'],
    ['1234.00', `1${nbsp}234,00`],
    ['1234567.89', `1${nbsp}234${nbsp}567,89`],
    ['-1234.5', `-1${nbsp}234,50`],
    ['0.123', '0,123'],
    ['+12.00', '12,00'],
  ])('shows %s as %s', (value, expected) => {
    expect(formatAmount(value)).toBe(expected)
  })

  it.each(['1 234,00', '12,5', 'abc', '', '1.2.3', '1e3'])(
    'leaves %j unchanged when it is not an XSD decimal',
    (value) => {
      expect(formatAmount(value)).toBe(value)
    },
  )

  it('keeps precision beyond what a float can hold', () => {
    expect(formatAmount('12345678901234567.01')).toBe(`12${nbsp}345${nbsp}678${nbsp}901${nbsp}234${nbsp}567,01`)
  })
})

describe('formatNumber', () => {
  it('groups thousands and keeps the decimals as written', () => {
    expect(formatNumber('2')).toBe('2')
    expect(formatNumber('1500.125')).toBe(`1${nbsp}500,125`)
    expect(formatNumber('0.50')).toBe('0,50')
  })
})

describe('formatDate', () => {
  it('shows an XSD date as DD.MM.YYYY', () => {
    expect(formatDate('2026-02-15')).toBe('15.02.2026')
  })

  it('shows only the date of a date time', () => {
    expect(formatDate('2026-02-15T09:30:00Z')).toBe('15.02.2026')
  })

  it.each(['15.02.2026', '2026-2-15', ''])('leaves %j unchanged', (value) => {
    expect(formatDate(value)).toBe(value)
  })
})

describe('rateLabel', () => {
  it.each([
    ['23', '23%'],
    ['5', '5%'],
    ['0 KR', '0% (kraj)'],
    ['0 WDT', '0% (WDT)'],
    ['0 EX', '0% (eksport)'],
    ['zw', 'zwolnione'],
    ['oo', 'odwrotne obciążenie'],
    ['np I', 'niepodlegające (np I)'],
    ['np II', 'niepodlegające (np II)'],
  ])('labels %s as %s', (code, label) => {
    expect(rateLabel(code)).toBe(label)
  })

  it('shows an unknown value as it is', () => {
    expect(rateLabel('17')).toBe('17')
  })
})

describe('rateTotalLabel', () => {
  it.each([
    ['1', 'stawka 23% lub 22%'],
    ['2', 'stawka 8% lub 7%'],
    ['3', 'stawka 5%'],
    ['4', 'ryczałt dla taksówek osobowych'],
    ['5', 'procedura OSS'],
    ['6_1', 'stawka 0% w kraju'],
    ['6_2', 'stawka 0%, WDT'],
    ['6_3', 'stawka 0%, eksport'],
    ['7', 'zwolniona od podatku'],
    ['8', 'poza terytorium kraju'],
    ['9', 'usługi z art. 100 ust. 1 pkt 4 ustawy'],
    ['10', 'odwrotne obciążenie'],
    ['11', 'procedura marży'],
  ])('labels P_13_%s as %s', (key, label) => {
    expect(rateTotalLabel(key)).toBe(label)
  })
})

describe('paymentFormLabel', () => {
  it.each([
    ['1', 'Gotówka'],
    ['2', 'Karta'],
    ['3', 'Bon'],
    ['4', 'Czek'],
    ['5', 'Kredyt'],
    ['6', 'Przelew'],
    ['7', 'Mobilna'],
  ])('labels form %s as %s', (code, label) => {
    expect(paymentFormLabel(code)).toBe(label)
  })

  it('shows an unknown code as it is', () => {
    expect(paymentFormLabel('9')).toBe('9')
  })
})
