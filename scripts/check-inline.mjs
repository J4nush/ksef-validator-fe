import { inlineProblems, runCli } from './lib/dist-checks.mjs'

await runCli('check:inline', inlineProblems)
