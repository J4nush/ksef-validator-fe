import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { JSDOM } from 'jsdom'

/** @param {string} html */
function parse(html) {
  return new JSDOM(html).window.document
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function headProblems(html) {
  const head = parse(html).head
  const problems = []
  if (!head.querySelector('title')?.textContent?.trim()) problems.push('missing <title>')
  if (!head.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()) {
    problems.push('missing meta description')
  }
  return problems
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function inlineProblems(html) {
  const document = parse(html)
  const problems = []
  for (const script of document.querySelectorAll('script')) {
    if (script.getAttribute('type') === 'application/ld+json') continue
    if (!script.hasAttribute('src')) problems.push('inline <script>')
  }
  if (document.querySelector('style')) problems.push('<style> element')
  for (const element of document.querySelectorAll('*')) {
    for (const name of element.getAttributeNames()) {
      if (name === 'style' || name.startsWith('on')) {
        problems.push(`${name} attribute on <${element.localName}>`)
      }
    }
  }
  return problems
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function htmlFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

/**
 * @param {string} dir
 * @param {(html: string) => string[]} check
 * @returns {Promise<{ files: number, failures: string[] }>}
 */
export async function checkDist(dir, check) {
  const files = await htmlFiles(dir)
  const failures = []
  for (const file of files) {
    for (const problem of check(await readFile(file, 'utf8'))) {
      failures.push(`${relative(dir, file)}: ${problem}`)
    }
  }
  return { files: files.length, failures }
}

/**
 * @param {string} name
 * @param {(html: string) => string[]} check
 */
export async function runCli(name, check) {
  const dir = process.argv[2] ?? 'dist'
  const { files, failures } = await checkDist(dir, check)
  if (files === 0) {
    console.error(`${name}: no HTML files in ${dir}`)
    process.exit(1)
  }
  if (failures.length > 0) {
    console.error(`${name}: ${failures.length} problem(s)`)
    for (const failure of failures) console.error(`  ${failure}`)
    process.exit(1)
  }
  console.log(`${name}: ${files} HTML file(s) OK`)
}
