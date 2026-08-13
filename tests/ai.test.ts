import { describe, it, expect } from 'vitest'
import { parseAiPlanning, normalizeAiPlanning } from '@/lib/planning/ai'

describe('parseAiPlanning', () => {
  it('parse une réponse JSON simple', () => {
    const p = parseAiPlanning(
      '{"date":"2026-08-06","sections":[{"originCity":"AGADEZ","departures":[{"axis":"AGADEZ - NIAMEY ENCOUR","busNumber":"CG 6377","departureTime":"05 H 00","driverName":"YOUSSOUF","driverPhone":"96474717","backupDriver":"","backupPhone":""}]}]}'
    )
    expect(p).not.toBeNull()
    expect(p!.date).toBe('2026-08-06')
    expect(p!.sections[0].originCity).toBe('AGADEZ')
    expect(p!.sections[0].departures[0].busNumber).toBe('CG 6377')
    expect(p!.sections[0].departures[0].axis).toBe('AGADEZ - NIAMEY ENCOUR')
  })

  it('supporte les blocs ```json … ``` autour du JSON', () => {
    const p = parseAiPlanning('```json\n{"date":null,"sections":[]}\n```')
    expect(p).not.toBeNull()
    expect(p!.date).toBeNull()
    expect(p!.sections).toHaveLength(0)
  })

  it('extraie le JSON même avec du texte autour', () => {
    const p = parseAiPlanning('Voici le résultat : {"date":"06/08/2026","sections":[]} Fin.')
    expect(p!.date).toBe('2026-08-06')
  })

  it('normalise la date jj/mm/aaaa en AAAA-MM-JJ', () => {
    expect(parseAiPlanning('{"date":"06/08/2026","sections":[]}')!.date).toBe('2026-08-06')
  })

  it('renvoie null sur une réponse inexploitable', () => {
    expect(parseAiPlanning('pas de JSON ici')).toBeNull()
    expect(parseAiPlanning('{"date":')).toBeNull()
  })
})

describe('normalizeAiPlanning', () => {
  it('normalise le n° de bus "CG6326" en "CG 6326"', () => {
    const p = normalizeAiPlanning({
      date: '2026-08-06',
      sections: [{ originCity: 'ZINDER', departures: [{ axis: 'ZINDER-LOGA-NIAMEY', busNumber: 'CG6326', departureTime: '04 H 00', driverName: 'LASSO', driverPhone: '96967532' }] }],
    })
    expect(p!.sections[0].departures[0].busNumber).toBe('CG 6326')
  })

  it('accepte les clés avec underscore (origin_city, bus_number)', () => {
    const p = normalizeAiPlanning({
      sections: [{ origin_city: 'ar lit', departures: [{ bus_number: 'BM 5852', driver_name: 'BOUBACAR' }] }],
    })
    expect(p!.sections[0].originCity).toBe('AR LIT')
    expect(p!.sections[0].departures[0].driverName).toBe('BOUBACAR')
  })

  it('ignore les lignes sans n° de bus et les sections vides', () => {
    const p = normalizeAiPlanning({
      date: null,
      sections: [
        { originCity: 'NIAMEY', departures: [{ axis: 'X', busNumber: '', driverName: 'Y' }] },
        { originCity: 'AGADEZ', departures: [] },
      ],
    })
    expect(p!.sections).toHaveLength(0)
  })
})
