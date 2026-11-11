import { relative, resolve } from 'node:path'
import { CONTRACT_SOURCE, checkContract, syncContract } from './lib/contract.mjs'

const backendDir = resolve(process.env.BACKEND_DIR ?? '../backend')
const targetPath = resolve('contract', 'openapi.json')
const command = process.argv[2]

if (command === 'sync') {
  await syncContract(backendDir, targetPath)
  console.log(`sync:contract: wrote ${relative(process.cwd(), targetPath)}`)
} else if (command === 'check') {
  const { status } = await checkContract(backendDir, targetPath)
  if (status === 'skipped') {
    console.log(`check:contract: skipped, ${backendDir} not found`)
  } else if (status === 'no-source') {
    console.error(`check:contract: ${CONTRACT_SOURCE} not found in ${backendDir}`)
    process.exit(1)
  } else if (status === 'drift') {
    console.error('check:contract: contract/openapi.json differs from the backend, run npm run sync:contract')
    process.exit(1)
  } else {
    console.log('check:contract: contract/openapi.json matches the backend')
  }
} else {
  console.error('usage: node scripts/contract.mjs sync|check')
  process.exit(2)
}
