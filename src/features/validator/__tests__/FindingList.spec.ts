import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Finding } from '@/api/report'
import FindingList from '../FindingList.vue'
import { ERRORS_FILE, errorsReport, sample, stubMatchMedia } from './support'

const bytes = sample(ERRORS_FILE)

function mountList(findings: Finding[] = errorsReport.findings, skipped = errorsReport.skipped) {
  return mount(FindingList, { props: { findings, skipped, bytes }, attachTo: document.body })
}

const rowTitles = (wrapper: ReturnType<typeof mountList>) => wrapper.findAll('.row .row__t').map((row) => row.text())
const shownHeadings = (wrapper: ReturnType<typeof mountList>) =>
  wrapper.findAll('article.f h4').map((heading) => heading.text())

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('FindingList', () => {
  it('groups findings into errors, warnings and checks not done, with counts', () => {
    stubMatchMedia(true)
    const wrapper = mountList()

    expect(wrapper.findAll('.fl__group').map((group) => group.text())).toEqual([
      'Błędy 1',
      'Ostrzeżenia 2',
      'Nie sprawdzono 1',
    ])
    expect(rowTitles(wrapper)).toEqual([
      'Błędny NIP',
      'Powtórzony numer wiersza',
      'Kwota należności nie zgadza się z sumami',
      'Duplikat w KSeF',
    ])
    expect(wrapper.findAll('.row .row__l').map((line) => line.text())).toEqual([
      'linia 11',
      'linia 68',
      'linia 40',
      'bez linii',
    ])
  })

  it('groups informational findings separately', () => {
    stubMatchMedia(true)
    const info: Finding = { ...errorsReport.findings[0]!, id: 'XSD-TRUNCATED', severity: 'INFO', title: 'Pokazano część błędów' }
    const wrapper = mountList([info], [])

    expect(wrapper.findAll('.fl__group').map((group) => group.text())).toEqual(['Informacje 1'])
  })

  describe('on a wide screen', () => {
    it('shows the first finding next to the list', () => {
      stubMatchMedia(true)
      const wrapper = mountList()

      expect(wrapper.findAll('.row')[0]!.attributes('aria-current')).toBe('true')
      expect(shownHeadings(wrapper)).toEqual(['Błędny NIP'])
    })

    it('shows the chosen finding and moves focus to its heading', async () => {
      stubMatchMedia(true)
      const wrapper = mountList()

      await wrapper.findAll('.row')[2]!.trigger('click')

      expect(shownHeadings(wrapper)).toEqual(['Kwota należności nie zgadza się z sumami'])
      expect(wrapper.findAll('.row')[2]!.attributes('aria-current')).toBe('true')
      expect(wrapper.findAll('.row')[0]!.attributes('aria-current')).toBeUndefined()
      expect(document.activeElement?.textContent).toBe('Kwota należności nie zgadza się z sumami')
    })

    it('moves through the list with arrow keys', async () => {
      stubMatchMedia(true)
      const wrapper = mountList()

      await wrapper.findAll('.row')[0]!.trigger('keydown', { key: 'ArrowDown' })

      expect(shownHeadings(wrapper)).toEqual(['Powtórzony numer wiersza'])
      expect(document.activeElement).toBe(wrapper.findAll('.row')[1]!.element)
    })

    it('goes to the next finding from the detail', async () => {
      stubMatchMedia(true)
      const wrapper = mountList()

      const next = wrapper.get('.f__next')
      expect(next.text()).toBe('Następne: Powtórzony numer wiersza')
      await next.trigger('click')

      expect(shownHeadings(wrapper)).toEqual(['Powtórzony numer wiersza'])
    })
  })

  describe('on a phone', () => {
    it('opens the first finding and keeps the others folded', () => {
      stubMatchMedia(false)
      const wrapper = mountList()

      expect(wrapper.findAll('.row').map((row) => row.attributes('aria-expanded'))).toEqual(['true', 'false', 'false', 'false'])
      expect(shownHeadings(wrapper)).toEqual(['Błędny NIP'])
    })

    it('unfolds and folds a row independently', async () => {
      stubMatchMedia(false)
      const wrapper = mountList()

      await wrapper.findAll('.row')[1]!.trigger('click')
      expect(shownHeadings(wrapper)).toEqual(['Błędny NIP', 'Powtórzony numer wiersza'])

      await wrapper.findAll('.row')[0]!.trigger('click')
      expect(shownHeadings(wrapper)).toEqual(['Powtórzony numer wiersza'])
    })

    it('keeps the open findings when the screen widens', async () => {
      const media = stubMatchMedia(false)
      const wrapper = mountList()
      await wrapper.findAll('.row')[1]!.trigger('click')
      await wrapper.findAll('.row')[0]!.trigger('click')

      media.change(true)
      await wrapper.vm.$nextTick()

      expect(shownHeadings(wrapper)).toEqual(['Powtórzony numer wiersza'])
    })
  })

  it('shows every finding at once and back', async () => {
    stubMatchMedia(true)
    const wrapper = mountList()
    const toggle = wrapper.get('button[aria-pressed]')

    await toggle.trigger('click')

    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.text()).toBe('Pokaż listę')
    expect(wrapper.findAll('.row')).toHaveLength(0)
    expect(shownHeadings(wrapper)).toEqual([
      'Błędny NIP',
      'Powtórzony numer wiersza',
      'Kwota należności nie zgadza się z sumami',
      'Duplikat w KSeF',
    ])

    await toggle.trigger('click')
    expect(toggle.text()).toBe('Pokaż wszystkie')
    expect(shownHeadings(wrapper)).toEqual(['Błędny NIP'])
  })
})
