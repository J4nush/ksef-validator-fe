import { describe, expect, it } from 'vitest'
import { xmlSegments } from '../xmlSegments'

describe('xmlSegments', () => {
  it('splits a line into tags and values', () => {
    expect(xmlSegments('    <NIP>1111111112</NIP>', null)).toEqual([
      { text: '    ', tag: false, mark: false },
      { text: '<NIP>', tag: true, mark: false },
      { text: '1111111112', tag: false, mark: false },
      { text: '</NIP>', tag: true, mark: false },
    ])
  })

  it('marks the range inside a value', () => {
    expect(xmlSegments('<P_15>9594.10</P_15>', { start: 6, end: 13 })).toEqual([
      { text: '<P_15>', tag: true, mark: false },
      { text: '9594.10', tag: false, mark: true },
      { text: '</P_15>', tag: true, mark: false },
    ])
  })

  it('splits segments at the edges of a mark that crosses them', () => {
    expect(xmlSegments('<a>xy</a>', { start: 4, end: 6 })).toEqual([
      { text: '<a>', tag: true, mark: false },
      { text: 'x', tag: false, mark: false },
      { text: 'y', tag: false, mark: true },
      { text: '<', tag: true, mark: true },
      { text: '/a>', tag: true, mark: false },
    ])
  })

  it('keeps a line without tags as one value', () => {
    expect(xmlSegments('plain text', null)).toEqual([{ text: 'plain text', tag: false, mark: false }])
  })

  it('treats a cut tag at the end of a clipped line as a tag', () => {
    expect(xmlSegments('ab<Naz', null)).toEqual([
      { text: 'ab', tag: false, mark: false },
      { text: '<Naz', tag: true, mark: false },
    ])
  })

  it('returns nothing for an empty line', () => {
    expect(xmlSegments('', null)).toEqual([])
  })
})
