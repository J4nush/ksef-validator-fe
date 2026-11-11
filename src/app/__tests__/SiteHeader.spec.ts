import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import SiteHeader from '../SiteHeader.vue'

async function mountHeader() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  return mount(SiteHeader, { global: { plugins: [router] }, attachTo: document.body })
}

describe('SiteHeader', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('links the brand to the home page with an accessible name', async () => {
    const wrapper = await mountHeader()

    const brand = wrapper.get('a.brand')
    expect(brand.attributes('href')).toBe('/')
    expect(brand.attributes('aria-label')).toBe('Walidator KSeF, strona główna')
  })

  it('marks the current page in the navigation', async () => {
    const wrapper = await mountHeader()

    const current = wrapper.findAll('a[aria-current="page"]').map((a) => a.text())
    expect(current).toContain('Walidator')
  })

  it('closes the phone menu on Escape and returns focus to its button', async () => {
    const wrapper = await mountHeader()
    const menu = wrapper.get('details.menu').element as HTMLDetailsElement
    menu.open = true

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('details.menu summary').element)
  })

  it('closes the phone menu on a click outside it', async () => {
    const wrapper = await mountHeader()
    const menu = wrapper.get('details.menu').element as HTMLDetailsElement
    menu.open = true

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(menu.open).toBe(false)
  })

  it('keeps the phone menu open on a click inside it', async () => {
    const wrapper = await mountHeader()
    const menu = wrapper.get('details.menu').element as HTMLDetailsElement
    menu.open = true

    wrapper.get('.menu__panel').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(menu.open).toBe(true)
  })
})
