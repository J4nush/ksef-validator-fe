import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { bundle } from '@apidevtools/json-schema-ref-parser'

export const CONTRACT_SOURCE = join('openapi', 'openapi.yaml')

/**
 * @param {string} sourcePath
 * @returns {Promise<any>}
 */
export async function bundleContract(sourcePath) {
  return bundle(sourcePath, { resolve: { http: false } })
}

/** @param {unknown} contract */
export function serialize(contract) {
  return `${JSON.stringify(contract, null, 2)}\n`
}

/** @param {string} path */
async function exists(path) {
  return access(path).then(
    () => true,
    () => false,
  )
}

/**
 * @param {string} backendDir
 * @param {string} targetPath
 */
export async function syncContract(backendDir, targetPath) {
  const contract = await bundleContract(join(backendDir, CONTRACT_SOURCE))
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, serialize(contract))
}

/**
 * @param {string} backendDir
 * @param {string} targetPath
 * @returns {Promise<{ status: 'same' | 'drift' | 'skipped' | 'no-source' }>}
 */
export async function checkContract(backendDir, targetPath) {
  if (!(await exists(backendDir))) return { status: 'skipped' }
  if (!(await exists(join(backendDir, CONTRACT_SOURCE)))) return { status: 'no-source' }
  const expected = serialize(await bundleContract(join(backendDir, CONTRACT_SOURCE)))
  const current = (await exists(targetPath)) ? await readFile(targetPath, 'utf8') : ''
  return { status: current === expected ? 'same' : 'drift' }
}
