import { headProblems, runCli } from './lib/dist-checks.mjs'

await runCli('check:head', headProblems)
