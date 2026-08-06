import { describe, it, expect } from 'vitest'
import { linesFromTessData } from '@/lib/planning/ocr'

// Simule la structure data de tesseract.js (blocks > paragraphs > lines > words)
function tessWord(text: string, x0: number, y0: number): unknown {
  return { text, bbox: { x0, y0, x1: x0 + text.length * 9, y1: y0 + 20 } }
}

describe('linesFromTessData', () => {
  it('aplatit les blocs/paragraphes/lignes en OcrLine triées par Y', () => {
    const data = {
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                { words: [tessWord('DEPART', 0, 0), tessWord('AGADEZ', 60, 0)] },
                { words: [tessWord('AGADEZ', 0, 100), tessWord('-', 70, 100), tessWord('NIAMEY', 80, 100)] },
              ],
            },
          ],
        },
      ],
    }
    const lines = linesFromTessData(data)
    expect(lines).toHaveLength(2)
    expect(lines[0].y).toBeLessThan(lines[1].y)
    expect(lines[0].tokens.map((t) => t.text)).toEqual(['DEPART', 'AGADEZ'])
  })

  it('ignore les lignes vides', () => {
    const data = {
      blocks: [
        {
          paragraphs: [
            { lines: [{ words: [] }, { words: [{ text: '  ', bbox: { x0: 0, y0: 0, x1: 4, y1: 20 } }] }] },
          ],
        },
      ],
    }
    expect(linesFromTessData(data)).toHaveLength(0)
  })

  it('renvoie [] si données absentes', () => {
    expect(linesFromTessData({})).toEqual([])
  })
})
