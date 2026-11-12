export const FA3_NAMESPACE = 'http://crd.gov.pl/wzor/2025/06/25/13775/'

export interface Address {
  countryCode: string | null
  line1: string | null
  line2: string | null
}

export interface Party {
  name: string | null
  nip: string | null
  address: Address
}

export interface InvoiceLine {
  number: string | null
  name: string | null
  unit: string | null
  quantity: string | null
  unitNetPrice: string | null
  netValue: string | null
  rate: string | null
}

export interface RateTotal {
  key: string
  net: string | null
  vat: string | null
}

export interface InvoiceData {
  seller: Party
  buyer: Party
  number: string | null
  issueDate: string | null
  saleDate: string | null
  salePeriod: { from: string | null; to: string | null } | null
  currency: string | null
  payment: { dueDates: string[]; form: string | null; otherForm: string | null }
  lines: InvoiceLine[]
  rateTotals: RateTotal[]
  total: string | null
}

export type InvoiceReadResult =
  | { ok: true; invoice: InvoiceData }
  | { ok: false; reason: 'encoding' | 'doctype' | 'malformed' | 'unrecognized' }

const RATE_TOTAL_KEYS = ['1', '2', '3', '4', '5', '6_1', '6_2', '6_3', '7', '8', '9', '10', '11']
const RATE_TOTAL_KEYS_WITH_VAT = new Set(['1', '2', '3', '4', '5'])

function children(parent: Element | null, name: string): Element[] {
  if (parent === null) return []
  return Array.from(parent.children).filter(
    (child) => child.namespaceURI === FA3_NAMESPACE && child.localName === name,
  )
}

function at(parent: Element | null, path: string): Element | null {
  return path.split('/').reduce<Element | null>((node, name) => children(node, name)[0] ?? null, parent)
}

function valueOf(element: Element | null): string | null {
  const value = element?.textContent?.trim() ?? ''
  return value === '' ? null : value
}

function text(parent: Element | null, path: string): string | null {
  return valueOf(at(parent, path))
}

function party(element: Element | null): Party {
  return {
    name: text(element, 'DaneIdentyfikacyjne/Nazwa'),
    nip: text(element, 'DaneIdentyfikacyjne/NIP'),
    address: {
      countryCode: text(element, 'Adres/KodKraju'),
      line1: text(element, 'Adres/AdresL1'),
      line2: text(element, 'Adres/AdresL2'),
    },
  }
}

function line(row: Element): InvoiceLine {
  return {
    number: text(row, 'NrWierszaFa'),
    name: text(row, 'P_7'),
    unit: text(row, 'P_8A'),
    quantity: text(row, 'P_8B'),
    unitNetPrice: text(row, 'P_9A'),
    netValue: text(row, 'P_11'),
    rate: text(row, 'P_12'),
  }
}

function rateTotals(fa: Element | null): RateTotal[] {
  return RATE_TOTAL_KEYS.flatMap((key) => {
    const net = at(fa, `P_13_${key}`)
    if (net === null) return []
    return [{ key, net: valueOf(net), vat: RATE_TOTAL_KEYS_WITH_VAT.has(key) ? text(fa, `P_14_${key}`) : null }]
  })
}

function invoice(root: Element): InvoiceData {
  const fa = at(root, 'Fa')
  const period = at(fa, 'OkresFa')
  const payment = at(fa, 'Platnosc')
  return {
    seller: party(at(root, 'Podmiot1')),
    buyer: party(at(root, 'Podmiot2')),
    number: text(fa, 'P_2'),
    issueDate: text(fa, 'P_1'),
    saleDate: text(fa, 'P_6'),
    salePeriod: period === null ? null : { from: text(period, 'P_6_Od'), to: text(period, 'P_6_Do') },
    currency: text(fa, 'KodWaluty'),
    payment: {
      dueDates: children(payment, 'TerminPlatnosci').flatMap((term) => text(term, 'Termin') ?? []),
      form: text(payment, 'FormaPlatnosci'),
      otherForm: text(payment, 'OpisPlatnosci'),
    },
    lines: children(fa, 'FaWiersz').map(line),
    rateTotals: rateTotals(fa),
    total: text(fa, 'P_15'),
  }
}

export function readInvoice(bytes: Uint8Array): InvoiceReadResult {
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { ok: false, reason: 'encoding' }
  }
  if (/<!DOCTYPE/i.test(source)) return { ok: false, reason: 'doctype' }

  const document = new DOMParser().parseFromString(source, 'application/xml')
  if (document.getElementsByTagNameNS('*', 'parsererror').length > 0) return { ok: false, reason: 'malformed' }

  const root = document.documentElement
  if (root.namespaceURI !== FA3_NAMESPACE || root.localName !== 'Faktura') return { ok: false, reason: 'unrecognized' }
  return { ok: true, invoice: invoice(root) }
}
