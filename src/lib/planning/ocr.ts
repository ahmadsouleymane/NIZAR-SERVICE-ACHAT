import { createWorker } from 'tesseract.js'
import type { OcrLine, OcrToken } from '@/lib/planning/parse'
import { prepareImage } from '@/lib/planning/preprocess'

// Moteur hébergé localement (aucune dépendance CDN) — fiable même en connexion lente
const WORKER_CONFIG = {
  langPath: '/tessdata',
  workerPath: '/tessdata/worker.min.js',
  corePath: '/tessdata/core',
}

export function linesFromTessData(data: unknown): OcrLine[] {
  const lines: OcrLine[] = []
  const blocks = (data as { blocks?: unknown[] })?.blocks ?? []
  for (const block of blocks) {
    const paragraphs = (block as { paragraphs?: unknown[] })?.paragraphs ?? []
    for (const paragraph of paragraphs) {
      const rawLines = (paragraph as { lines?: unknown[] })?.lines ?? []
      for (const rawLine of rawLines) {
        const rawWords = (rawLine as { words?: unknown[] })?.words ?? []
        const tokens: OcrToken[] = []
        for (const rawWord of rawWords) {
          // nettoie les traits verticaux du tableau (lus « | ») collés aux textes
          const raw = (rawWord as { text?: string })?.text ?? ''
          const text = raw.replace(/[|¦]/g, ' ').replace(/\s+/g, ' ').trim()
          if (!text) continue
          const bbox = (rawWord as { bbox?: { x0?: number; y0?: number; x1?: number; y1?: number } })?.bbox
          tokens.push({
            text,
            x0: bbox?.x0 ?? 0,
            y0: bbox?.y0 ?? 0,
            x1: bbox?.x1 ?? 0,
            y1: bbox?.y1 ?? 0,
          })
        }
        if (tokens.length === 0) continue
        const minY = Math.min(...tokens.map((t) => t.y0))
        const maxY = Math.max(...tokens.map((t) => t.y1))
        lines.push({ tokens, y: (minY + maxY) / 2 })
      }
    }
  }
  return lines.sort((a, b) => a.y - b.y)
}

export async function runOcr(image: File | Blob): Promise<OcrLine[]> {
  const worker = await createWorker('fra', 1, WORKER_CONFIG)
  try {
    const prepared = await prepareImage(image)
    // tesseract.js v7 : les blocs (coordonnées) ne sont remplis que si demandés
    const { data } = await worker.recognize(prepared, {}, { blocks: true, text: true })
    return linesFromTessData(data)
  } finally {
    await worker.terminate()
  }
}
