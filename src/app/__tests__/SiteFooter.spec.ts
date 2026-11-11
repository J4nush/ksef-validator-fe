import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SiteFooter from '../SiteFooter.vue'

describe('SiteFooter', () => {
  it('credits the author with a link to the portfolio', () => {
    const wrapper = mount(SiteFooter)

    expect(wrapper.text()).toContain(`© ${__BUILD_YEAR__} Michał Ziółek`)
    const author = wrapper.get('a[href="https://michal-ziolek.dev"]')
    expect(author.text()).toBe('Michał Ziółek')
  })

  it('links the legal pages', () => {
    const wrapper = mount(SiteFooter)

    const links = wrapper.findAll('nav a').map((a) => [a.text(), a.attributes('href')])
    expect(links).toEqual([
      ['Polityka prywatności', '/polityka-prywatnosci'],
      ['Regulamin', '/regulamin'],
      ['Zastrzeżenia', '/zastrzezenia'],
      ['Dostępność', '/dostepnosc'],
      ['Kontakt', '/kontakt'],
    ])
  })

  it('says the tool is not related to the Ministry of Finance', () => {
    const wrapper = mount(SiteFooter)

    expect(wrapper.text()).toContain('Niezależne narzędzie, niezwiązane z Ministerstwem Finansów.')
  })
})
