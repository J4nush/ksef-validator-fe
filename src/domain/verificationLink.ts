import type { Report } from '@/api/report'

export type KsefEnvironment = 'TE' | 'DEMO' | 'PROD'

export const VERIFICATION_HOSTS: Record<KsefEnvironment, string> = {
  TE: 'https://qr-test.ksef.mf.gov.pl',
  DEMO: 'https://qr-demo.ksef.mf.gov.pl',
  PROD: 'https://qr.ksef.mf.gov.pl',
}

export interface VerificationLinkInput {
  environment: KsefEnvironment
  sellerNip: string
  issueDate: string
  hash: string
}

export type LinkAvailability = 'available' | 'not-for-result' | 'hash-mismatch'

export function issueDateForLink(issueDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return null
  const [year, month, day] = [issueDate.slice(0, 4), issueDate.slice(5, 7), issueDate.slice(8, 10)]
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null
  return `${day}-${month}-${year}`
}

export function verificationLink({ environment, sellerNip, issueDate, hash }: VerificationLinkInput): string | null {
  const date = issueDateForLink(issueDate)
  if (date === null || !/^\d{10}$/.test(sellerNip) || !/^[A-Za-z0-9_-]{43}$/.test(hash)) return null
  return `${VERIFICATION_HOSTS[environment]}/invoice/${sellerNip}/${date}/${hash}`
}

export function linkAvailability(report: Pick<Report, 'result' | 'document'>, browserHash: string): LinkAvailability {
  if (report.result !== 'PASSED' && report.result !== 'WARNINGS') return 'not-for-result'
  return report.document.sha256Base64Url === browserHash ? 'available' : 'hash-mismatch'
}
