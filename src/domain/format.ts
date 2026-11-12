const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/
const XSD_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/
const NBSP = ' '

const RATES: Record<string, string> = {
  ...Object.fromEntries(['23', '22', '8', '7', '5', '4', '3'].map((rate) => [rate, `${rate}%`])),
  '0 KR': '0% (kraj)',
  '0 WDT': '0% (WDT)',
  '0 EX': '0% (eksport)',
  zw: 'zwolnione',
  oo: 'odwrotne obciążenie',
  'np I': 'niepodlegające (np I)',
  'np II': 'niepodlegające (np II)',
}

const RATE_TOTALS: Record<string, string> = {
  '1': 'stawka 23% lub 22%',
  '2': 'stawka 8% lub 7%',
  '3': 'stawka 5%',
  '4': 'ryczałt dla taksówek osobowych',
  '5': 'procedura OSS',
  '6_1': 'stawka 0% w kraju',
  '6_2': 'stawka 0%, WDT',
  '6_3': 'stawka 0%, eksport',
  '7': 'zwolniona od podatku',
  '8': 'poza terytorium kraju',
  '9': 'usługi z art. 100 ust. 1 pkt 4 ustawy',
  '10': 'odwrotne obciążenie',
  '11': 'procedura marży',
}

const PAYMENT_FORMS: Record<string, string> = {
  '1': 'Gotówka',
  '2': 'Karta',
  '3': 'Bon',
  '4': 'Czek',
  '5': 'Kredyt',
  '6': 'Przelew',
  '7': 'Mobilna',
}

function formatDecimal(value: string, minFractionDigits: number): string {
  const match = DECIMAL.exec(value)
  if (!match) return value
  const sign = match[1] === '-' ? '-' : ''
  const integer = (match[2] ?? '').replace(/\B(?=(\d{3})+$)/g, NBSP)
  const fraction = (match[3] ?? '').padEnd(minFractionDigits, '0')
  return fraction === '' ? `${sign}${integer}` : `${sign}${integer},${fraction}`
}

export function formatAmount(value: string): string {
  return formatDecimal(value, 2)
}

export function formatNumber(value: string): string {
  return formatDecimal(value, 0)
}

export function formatDate(value: string): string {
  const match = XSD_DATE.exec(value)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value
}

export function rateLabel(code: string): string {
  return RATES[code] ?? code
}

export function rateTotalLabel(key: string): string {
  return RATE_TOTALS[key] ?? key
}

export function paymentFormLabel(code: string): string {
  return PAYMENT_FORMS[code] ?? code
}
