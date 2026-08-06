import { describe, it, expect } from 'vitest'
import { parsePlanning, parseDateFromLines, detectSectionHeader, classifyRow, originOf } from '@/lib/planning/parse'
import type { OcrLine, OcrToken } from '@/lib/planning/parse'

// Helper : construit une ligne depuis des mots espacés sur la même ligne Y
function line(xBase: number, y: number, words: [string, number][]): OcrLine {
  const tokens: OcrToken[] = []
  let x = xBase
  for (const [text, w] of words) {
    tokens.push({ text, x0: x, y0: y, x1: x + w, y1: y + 20 })
    x += w + 4
  }
  return { tokens, y: y + 10 }
}

function w(text: string): [string, number] {
  return [text, text.length * 9]
}

describe('parseDateFromLines', () => {
  it('extrait une date au format jj/mm/aaaa', () => {
    const lines = [line(0, 0, [w('PLANNING'), w('DU'), w('VOYAGE'), w('DEPART'), w('NIAMEY'), w('06/08/2026')])]
    expect(parseDateFromLines(lines)).toBe('2026-08-06')
  })
  it('renvoie null sans date', () => {
    expect(parseDateFromLines([line(0, 0, [w('AGADEZ')])])).toBeNull()
  })
})

describe('detectSectionHeader', () => {
  it('reconnaît DEPART AGADEZ', () => {
    expect(detectSectionHeader(line(0, 0, [w('DEPART'), w('AGADEZ')]))).toBe('AGADEZ')
  })
  it('reconnaît PLANNING DU VOYAGE DEPART NIAMEY', () => {
    const l = line(0, 0, [w('PLANNING'), w('DU'), w('VOYAGE'), w('DEPART'), w('NIAMEY')])
    expect(detectSectionHeader(l)).toBe('NIAMEY')
  })
  it('ne reconnaît pas une ligne de données', () => {
    expect(detectSectionHeader(line(0, 0, [w('AGADEZ'), w('-'), w('NIAMEY')]))).toBeNull()
  })
})

describe('classifyRow', () => {
  it('reconnaît une ligne classique AGADEZ - NIAMEY', () => {
    const l = line(0, 0, [
      w('AGADEZ'), w('-'), w('NIAMEY'), w('SPECIAL'),
      w('CG'), w('6377'),
      w('05'), w('H'), w('00'),
      w('YOUSSOUF'),
      w('96474717'),
    ])
    const row = classifyRow(l)
    expect(row).not.toBeNull()
    expect(row!.axis).toBe('AGADEZ - NIAMEY SPECIAL')
    expect(row!.busNumber).toBe('CG 6377')
    expect(row!.departureTime).toBe('05 H 00')
    expect(row!.driverName).toBe('YOUSSOUF')
    expect(row!.driverPhone).toBe('96474717')
  })

  it('gère une heure NUIT et un axe en une seule plage', () => {
    const l = line(0, 0, [
      w('NUIT'), w('-'), w('GAYA'),
      w('BH'), w('8210'),
      w('NUIT'),
      w('MANSOUR'),
      w('96856627'),
    ])
    const row = classifyRow(l)
    expect(row).not.toBeNull()
    expect(row!.axis).toBe('NUIT - GAYA')
    expect(row!.busNumber).toBe('BH 8210')
    expect(row!.departureTime).toBe('NUIT')
    expect(row!.driverName).toBe('MANSOUR')
  })

  it('ignore la ligne d’en-tête du tableau', () => {
    const l = line(0, 0, [w('Axes'), w('N°'), w('Bus'), w('Heure'), w('Chauffeur')])
    expect(classifyRow(l)).toBeNull()
  })
})

describe('originOf', () => {
  it('extrait la ville d’origine de l’axe', () => {
    expect(originOf('AGADEZ - NIAMEY SPECIAL')).toBe('AGADEZ')
    expect(originOf('ZINDER - LOGA - NIAMEY')).toBe('ZINDER')
    expect(originOf('INGAL - AGADEZ')).toBe('INGAL')
  })
})

describe('parsePlanning', () => {
  it('découpe les sections et rassemble les départs', () => {
    const lines = [
      line(0, 0, [w('DEPART'), w('AGADEZ')]),
      line(0, 100, [w('AGADEZ'), w('-'), w('NIAMEY'), w('CG'), w('6377'), w('05'), w('H'), w('00'), w('YOUSSOUF'), w('96474717')]),
      line(0, 200, [w('DEPART'), w('ARLIT')]),
      line(0, 300, [w('ARLIT'), w('-'), w('AGADEZ'), w('BM'), w('5852'), w('05'), w('H'), w('00'), w('BOUBACAR'), w('97065041')]),
    ]
    const parsed = parsePlanning(lines)
    expect(parsed.sections).toHaveLength(2)
    expect(parsed.sections[0].originCity).toBe('AGADEZ')
    expect(parsed.sections[0].departures).toHaveLength(1)
    expect(parsed.sections[1].departures[0].busNumber).toBe('BM 5852')
  })

  it('ne crée pas de section vide en doublon (titre + en-tête)', () => {
    const lines = [
      line(0, 0, [w('PLANNING'), w('DU'), w('VOYAGE'), w('DEPART'), w('AGADEZ')]),
      line(0, 100, [w('DEPART'), w('AGADEZ')]),
      line(0, 200, [w('AGADEZ'), w('-'), w('NIAMEY'), w('CG'), w('6377'), w('05'), w('H'), w('00'), w('YOUSSOUF'), w('96474717')]),
    ]
    const parsed = parsePlanning(lines)
    expect(parsed.sections).toHaveLength(1)
    expect(parsed.sections[0].originCity).toBe('AGADEZ')
    expect(parsed.sections[0].departures).toHaveLength(1)
  })
})
