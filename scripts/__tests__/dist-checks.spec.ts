import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDist, headProblems, inlineProblems } from '../lib/dist-checks.mjs'

const page = (head: string, body = '') =>
  `<!doctype html><html lang="pl"><head>${head}</head><body>${body}</body></html>`

describe('headProblems', () => {
  it('accepts a page with a title and a description', () => {
    const html = page('<title>Walidator</title><meta name="description" content="Opis strony">')

    expect(headProblems(html)).toEqual([])
  })

  it('reports a missing title', () => {
    const html = page('<meta name="description" content="Opis strony">')

    expect(headProblems(html)).toEqual(['missing <title>'])
  })

  it('reports an empty title', () => {
    const html = page('<title>  </title><meta name="description" content="Opis strony">')

    expect(headProblems(html)).toEqual(['missing <title>'])
  })

  it('reports a missing or empty description', () => {
    expect(headProblems(page('<title>Walidator</title>'))).toEqual(['missing meta description'])
    expect(
      headProblems(page('<title>Walidator</title><meta name="description" content="">')),
    ).toEqual(['missing meta description'])
  })

  it('ignores a title that is only in the body', () => {
    const html = page('<meta name="description" content="Opis">', '<svg><title>Logo</title></svg>')

    expect(headProblems(html)).toEqual(['missing <title>'])
  })
})

describe('inlineProblems', () => {
  it('accepts external scripts and JSON-LD', () => {
    const html = page(
      '<script src="/theme.js"></script><script type="application/ld+json">{"@type":"WebSite"}</script>',
      '<script type="module" async src="/assets/app.js"></script>',
    )

    expect(inlineProblems(html)).toEqual([])
  })

  it('reports an inline script', () => {
    const html = page('', '<script>window.x = 1</script>')

    expect(inlineProblems(html)).toEqual(['inline <script>'])
  })

  it('reports an inline module script', () => {
    const html = page('', '<script type="module">import "/a.js"</script>')

    expect(inlineProblems(html)).toEqual(['inline <script>'])
  })

  it('reports style elements and style attributes', () => {
    const html = page('<style>body{}</style>', '<div style="color:red"></div>')

    expect(inlineProblems(html)).toEqual(['<style> element', 'style attribute on <div>'])
  })

  it('reports inline event handlers', () => {
    const html = page('', '<button onclick="go()">Go</button>')

    expect(inlineProblems(html)).toEqual(['onclick attribute on <button>'])
  })
})

describe('checkDist', () => {
  let dir = ''

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('checks every HTML file in nested directories and names the failing one', async () => {
    dir = await mkdtemp(join(tmpdir(), 'dist-'))
    await mkdir(join(dir, 'bledy', 'nip'), { recursive: true })
    await writeFile(join(dir, 'index.html'), page('<title>A</title><meta name="description" content="B">'))
    await writeFile(join(dir, 'bledy', 'nip', 'index.html'), page('<meta name="description" content="B">'))
    await writeFile(join(dir, 'app.js'), 'console.log(1)')

    const result = await checkDist(dir, headProblems)

    expect(result).toEqual({ files: 2, failures: [`${join('bledy', 'nip', 'index.html')}: missing <title>`] })
  })
})
