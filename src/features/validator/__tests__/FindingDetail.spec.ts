import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Finding } from '@/api/report'
import FindingDetail from '../FindingDetail.vue'
import type { ListEntry } from '../findingEntries'
import { ERRORS_FILE, errorsReport, sample } from './support'

const bytes = sample(ERRORS_FILE)
const [nip, duplicate, total] = errorsReport.findings as [Finding, Finding, Finding]

function entry(finding: Finding, position = 1, of = 1): ListEntry {
  const sev = finding.severity === 'ERROR' ? 'err' : finding.severity === 'WARNING' ? 'warn' : 'info'
  return { key: finding.id, sev, title: finding.title, line: finding.line, position, of, finding, skipped: null }
}

function mountDetail(item: ListEntry, next: ListEntry | null = null) {
  return mount(FindingDetail, { props: { entry: item, next, bytes } })
}

describe('FindingDetail', () => {
  it('says what is wrong, where, and what to do', () => {
    const wrapper = mountDetail(entry(nip))

    expect(wrapper.get('.f__meta').text()).toBe('Błąd 1 z 1NIP sprzedawcyLinia 11')
    expect(wrapper.get('h4').text()).toBe('Błędny NIP')
    expect(wrapper.get('.f__why').text()).toBe(nip.message)
    expect(wrapper.get('.f__do').text()).toBe(`Co zrobić${nip.fix}`)
  })

  it('compares the NIP with its correct check digit', () => {
    const wrapper = mountDetail(entry(nip))
    const [is, should] = wrapper.findAll('.diff__row')

    expect(is!.get('dt').text()).toBe('Jest')
    expect(is!.get('dd').text()).toBe('1111111112')
    expect(is!.get('del').text()).toBe('2')
    expect(should!.get('dt').text()).toBe('Powinno być')
    expect(should!.get('dd').text()).toContain('cyfra kontrolna 1')
    expect(should!.get('ins').text()).toBe('1')
  })

  it('compares an amount with the expected sum', () => {
    const wrapper = mountDetail(entry(total, 2, 2))
    const [is, should] = wrapper.findAll('.diff__row')

    expect(wrapper.get('.f__meta').text()).toContain('Ostrzeżenie 2 z 2')
    expect(is!.get('dd').text()).toBe('9594.10')
    expect(is!.get('del').text()).toBe('1')
    expect(should!.get('dd').text()).toBe('9594.00')
    expect(should!.get('ins').text()).toBe('0')
  })

  it('lists the allowed values when the value is outside the list', () => {
    const finding: Finding = { ...nip, id: 'XSD-ENUM', params: { label: 'stawka podatku', value: '23%', allowed: '23, 22, 8' } }
    const wrapper = mountDetail(entry(finding))
    const [is, should] = wrapper.findAll('.diff__row')

    expect(is!.get('del').text()).toBe('23%')
    expect(should!.get('dd').text()).toBe('jedna z wartości: 23, 22, 8')
  })

  it('shows only what to do when there is nothing to compare', () => {
    const wrapper = mountDetail(entry(duplicate))

    expect(wrapper.find('.diff').exists()).toBe(false)
    expect(wrapper.get('.f__do').text()).toContain(duplicate.fix)
  })

  it('keeps the field, line, rule and an XML excerpt under technical details', () => {
    const wrapper = mountDetail(entry(nip))
    const tech = wrapper.get('details.tech')

    expect(tech.get('summary').text()).toBe('Szczegóły techniczne')
    expect(tech.findAll('.kv dt').map((dt) => dt.text())).toEqual(['Pole', 'Linia', 'Reguła'])
    expect(tech.findAll('.kv dd').map((dd) => dd.text())).toEqual([nip.field, '11', 'TECH-NIP-CHECKSUM'])

    const excerpt = tech.get('pre.xml')
    expect(excerpt.attributes('aria-label')).toBe('Fragment pliku XML, linia 11')
    expect(excerpt.findAll('.xml__n').map((n) => n.text())).toEqual(['9', '10', '11', '12', '13'])
    expect(excerpt.get('.xml__l.is-del').text()).toBe('11      <NIP>1111111112</NIP>')
    expect(excerpt.get('mark').text()).toBe('1111111112')
  })

  it('marks a warning line differently from an error line', () => {
    const wrapper = mountDetail(entry(total))

    expect(wrapper.get('.xml__l.is-warn .xml__n').text()).toBe('40')
  })

  it('does not link to rule descriptions', () => {
    const wrapper = mountDetail(entry(nip))

    expect(wrapper.find(`a[href="${nip.docsUrl}"]`).exists()).toBe(false)
  })

  it('shows text from the report as text, never as markup', () => {
    const wrapper = mountDetail(entry({ ...nip, message: '<img src=x onerror=alert(1)>' }))

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.f__why').text()).toBe('<img src=x onerror=alert(1)>')
  })

  it('offers the next finding', async () => {
    const wrapper = mountDetail(entry(nip), entry(duplicate, 1, 2))

    await wrapper.get('.f__next').trigger('click')

    expect(wrapper.get('.f__next').text()).toBe('Następne: Powtórzony numer wiersza')
    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('explains a check that was not done', () => {
    const skipped = errorsReport.skipped[0]!
    const wrapper = mountDetail({
      key: skipped.id,
      sev: 'skip',
      title: 'Duplikat w KSeF',
      line: null,
      position: 1,
      of: 1,
      finding: null,
      skipped,
    })

    expect(wrapper.get('.f__meta').text()).toBe('Nie sprawdzono 1 z 1Cała fakturaBez linii')
    expect(wrapper.get('.f__why').text()).toBe(skipped.message)
    expect(wrapper.get('.f__do').text()).toContain('KSeF odrzuca duplikaty.')
    expect(wrapper.findAll('.kv dd').map((dd) => dd.text())).toEqual(['KSEF-DUPLICATE'])
  })
})
