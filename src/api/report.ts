import type { components } from './schema'

type Schemas = components['schemas']
type Defs = Schemas['Report']['$defs']

// openapi-typescript emits the nested JSON Schema $defs as if it were a report field.
export type Report = Omit<Schemas['Report'], '$defs'>
export type Problem = Schemas['Problem']
export type Finding = Defs['finding']
export type SkippedCheck = Defs['skippedCheck']
export type LayerResult = Defs['layerResult']
export type Layer = Defs['layer']
export type LayerStatus = LayerResult['status']
export type ReportResult = Report['result']
export type Severity = Finding['severity']
