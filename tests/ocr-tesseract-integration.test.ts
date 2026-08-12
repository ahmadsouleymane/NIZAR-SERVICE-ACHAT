import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parsePlanning, type OcrLine } from '@/lib/planning/parse'

// Sortie réelle de Tesseract.js (v7, blocks:true) capturée depuis Node sur
// l'image de test, avec le nettoyage de bruit appliqué dans ocr.ts.
const EDGE_JUNK_RE = /^[\s"'`[\]{}()!?;,:.|/\\]+|[\s"'`[\]{}()!?;,:.|/\\]+$/g

function clean(text: string): string {
  return text.replace(EDGE_JUNK_RE, '').trim()
}

function loadLines(): OcrLine[] {
  const raw = JSON.parse(readFileSync('tests/fixtures/ocr-lines.json', 'utf8')) as {
    y: number
    tokens: { text: string; x0: number; y0: number; x1: number; y1: number }[]
  }[]
  return raw.map((l) => ({
    y: l.y,
    tokens: l.tokens
      .map((t) => ({ ...t, text: clean(t.text) }))
      .filter((t) => t.text.length > 0),
  }))
}

describe('OCR Tesseract (intégration réelle)', () => {
  it('parses le planning de test en 2 départs corrects', () => {
    const lines = loadLines()
    expect(lines.length).toBeGreaterThanOrEqual(5)
    const parsed = parsePlanning(lines)

    expect(parsed.date).toBe('2026-08-12')
    expect(parsed.sections.length).toBeGreaterThanOrEqual(1)
    expect(parsed.sections[0].originCity).toBe('AGADEZ')

    const deps = parsed.sections[0].departures
    expect(deps.length).toBe(2)

    const first = deps.find((d) => d.busNumber === 'CG 6377')
    expect(first).toBeDefined()
    expect(first?.axis).toContain('AGADEZ')
    expect(first?.departureTime).toBe('05 H 00')
    expect(first?.driverPhone).toBe('96474717')

    const second = deps.find((d) => d.busNumber === 'BZ 1234')
    expect(second).toBeDefined()
    expect(second?.departureTime).toBe('07 H 30')
    expect(second?.driverName).toContain('IBRAHIM')
    expect(second?.driverPhone).toBe('90112233')
  })
})
