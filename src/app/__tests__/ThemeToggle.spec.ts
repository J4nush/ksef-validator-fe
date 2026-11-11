import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from '../ThemeToggle.vue'

const root = document.documentElement
const HINT = 'Przełącz motyw. Wybór zapamiętamy w tej przeglądarce.'
const SAVED = 'Zapamiętaliśmy jasny motyw w tej przeglądarce.'
const REMOVED = 'Wróciliśmy do ciemnego motywu i usunęliśmy zapisany wybór.'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#0b0f14">'
  })

  afterEach(() => {
    root.className = ''
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('describes what the button does and that the choice is remembered', () => {
    const wrapper = mount(ThemeToggle)

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe(HINT)
    expect(button.attributes('title')).toBe(HINT)
  })

  it('stores nothing until the button is clicked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    mount(ThemeToggle)

    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('switches to light, saves only theme=light and announces it', async () => {
    const wrapper = mount(ThemeToggle)

    await wrapper.get('button').trigger('click')

    expect(root.classList.contains('light')).toBe(true)
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('theme')).toBe('light')
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toContain(SAVED)
    expect(status.get('a').attributes('href')).toBe('/polityka-prywatnosci#motyw')
    expect(status.get('a').text()).toBe('Jak to działa')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f6f8fa')
  })

  it('goes back to dark by removing the key instead of saving dark', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const wrapper = mount(ThemeToggle)

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')

    expect(root.classList.contains('light')).toBe(false)
    expect(localStorage.getItem('theme')).toBeNull()
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="status"]').text()).toBe(REMOVED)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b0f14')
  })

  it('picks up a light theme restored before mounting', async () => {
    root.classList.add('light')
    localStorage.setItem('theme', 'light')
    const wrapper = mount(ThemeToggle)

    await wrapper.get('button').trigger('click')

    expect(root.classList.contains('light')).toBe(false)
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('hides the message after a few seconds', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ThemeToggle)

    await wrapper.get('button').trigger('click')
    vi.advanceTimersByTime(8000)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  it('still switches the theme when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const wrapper = mount(ThemeToggle)

    await wrapper.get('button').trigger('click')

    expect(root.classList.contains('light')).toBe(true)
  })
})
