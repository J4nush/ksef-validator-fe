import { describe, expectTypeOf, it } from 'vitest'
import type { Finding, Layer, LayerStatus, Problem, Report, ReportResult, Severity, SkippedCheck } from '../report'
import type { components } from '../schema'

type Schemas = components['schemas']
type Defs = Schemas['Report']['$defs']

describe('report types', () => {
  it('follow the contract generated from the backend', () => {
    expectTypeOf<Report>().toEqualTypeOf<Omit<Schemas['Report'], '$defs'>>()
    expectTypeOf<Problem>().toEqualTypeOf<Schemas['Problem']>()
    expectTypeOf<Finding>().toEqualTypeOf<Defs['finding']>()
    expectTypeOf<SkippedCheck>().toEqualTypeOf<Defs['skippedCheck']>()
  })

  it('keep the value sets the interface relies on', () => {
    expectTypeOf<Layer>().toEqualTypeOf<'security' | 'recognition' | 'schema' | 'rules' | 'amounts'>()
    expectTypeOf<LayerStatus>().toEqualTypeOf<
      'passed' | 'warnings' | 'errors' | 'unsupported' | 'not_run' | 'not_checked'
    >()
    expectTypeOf<ReportResult>().toEqualTypeOf<'PASSED' | 'WARNINGS' | 'ERRORS' | 'UNSUPPORTED'>()
    expectTypeOf<Severity>().toEqualTypeOf<'ERROR' | 'WARNING' | 'INFO'>()
  })

  it('carry no schema definitions as a report field', () => {
    expectTypeOf<Report>().not.toHaveProperty('$defs')
  })
})
