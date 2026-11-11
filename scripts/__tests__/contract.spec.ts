import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bundleContract, checkContract, serialize, syncContract } from '../lib/contract.mjs'

const openapi = `openapi: 3.1.0
info:
  title: Example
  version: 1.0.0
paths:
  /api/internal/validate:
    post:
      responses:
        '200':
          description: Report
          content:
            application/json:
              schema:
                $ref: '../packages/engine/resources/report.schema.json'
`

const report = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['schemaVersion'],
  properties: { schemaVersion: { const: '1.1' } },
}

describe('contract', () => {
  let root = ''
  let backend = ''
  let target = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'contract-'))
    backend = join(root, 'backend')
    target = join(root, 'frontend', 'contract', 'openapi.json')
    await mkdir(join(backend, 'openapi'), { recursive: true })
    await mkdir(join(backend, 'packages', 'engine', 'resources'), { recursive: true })
    await writeFile(join(backend, 'openapi', 'openapi.yaml'), openapi)
    await writeFile(
      join(backend, 'packages', 'engine', 'resources', 'report.schema.json'),
      JSON.stringify(report),
    )
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('bundles the YAML document with external references inlined', async () => {
    const bundled = await bundleContract(join(backend, 'openapi', 'openapi.yaml'))

    const schema =
      bundled.paths['/api/internal/validate'].post.responses['200'].content['application/json'].schema
    expect(schema).toEqual(report)
    expect(JSON.stringify(bundled)).not.toContain('report.schema.json')
  })

  it('writes a stable JSON copy on sync', async () => {
    await syncContract(backend, target)

    const written = await readFile(target, 'utf8')
    expect(written).toBe(serialize(await bundleContract(join(backend, 'openapi', 'openapi.yaml'))))
    expect(written.endsWith('}\n')).toBe(true)
  })

  it('reports no drift right after sync', async () => {
    await syncContract(backend, target)

    expect(await checkContract(backend, target)).toEqual({ status: 'same' })
  })

  it('reports drift when the backend contract changes', async () => {
    await syncContract(backend, target)
    await writeFile(
      join(backend, 'openapi', 'openapi.yaml'),
      openapi.replace('version: 1.0.0', 'version: 1.1.0'),
    )

    expect(await checkContract(backend, target)).toEqual({ status: 'drift' })
  })

  it('reports drift when the local copy is missing', async () => {
    expect(await checkContract(backend, target)).toEqual({ status: 'drift' })
  })

  it('reports a backend without a contract instead of throwing', async () => {
    await rm(join(backend, 'openapi'), { recursive: true })

    expect(await checkContract(backend, target)).toEqual({ status: 'no-source' })
  })

  it('skips the check when the backend repository is not next to the frontend', async () => {
    expect(await checkContract(join(root, 'missing'), target)).toEqual({ status: 'skipped' })
  })
})
