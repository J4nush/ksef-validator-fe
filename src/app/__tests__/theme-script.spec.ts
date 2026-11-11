import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../../public/theme.js'), 'utf8')
const run = () => new Function(source)()
const root = document.documentElement

describe('public/theme.js', () => {
  afterEach(() => {
    root.className = ''
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('marks the document as running scripts and keeps the dark default', () => {
    run()

    expect(root.classList.contains('js')).toBe(true)
    expect(root.classList.contains('light')).toBe(false)
  })

  it('restores a saved light theme before the first paint', () => {
    localStorage.setItem('theme', 'light')

    run()

    expect(root.classList.contains('light')).toBe(true)
  })

  it('ignores any other stored value', () => {
    localStorage.setItem('theme', 'dark')

    run()

    expect(root.classList.contains('light')).toBe(false)
  })

  it('never writes to storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    run()

    expect(setItem).not.toHaveBeenCalled()
  })

  it('keeps the dark theme when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(run).not.toThrow()
    expect(root.classList.contains('js')).toBe(true)
    expect(root.classList.contains('light')).toBe(false)
  })
})
