// OCR dans le navigateur avec Tesseract.js (gratuit, aucun serveur).
// Produit le même format que l'ancien service PaddleOCR :
//   { lines: [{ y, tokens: [{ text, x0, y0, x1, y1 }] }] }
// consommé tel quel par parsePlanning().

import { createWorker, PSM } from 'tesseract.js'
import type { OcrLine, OcrToken } from './parse'

// Un seul worker réutilisé d'un scan à l'autre (le modèle n'est chargé qu'une fois).
let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null

async function getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (!workerPromise) {
    workerPromise = createWorker('fra', undefined, { logger: () => {} }).then(
      async (worker) => {
        // Le tableau entier est traité comme un seul bloc : ordre de lecture
        // gauche→droite, ligne par ligne (idéal pour le template à 7 colonnes).
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
        return worker
      }
    )
  }
  return workerPromise
}

interface BboxLike {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface WordLike {
  text?: string
  bbox?: BboxLike
}

interface LineLike {
  bbox?: BboxLike
  words?: WordLike[]
}

// Caractères parasites que Tesseract colle parfois aux mots (traits du tableau,
// ponctuation) : « 96474717] » → « 96474717 », « |05H00 » → « 05H00 ».
// On retire uniquement en début/fin de mot, jamais le « - » intérieur des axes.
const EDGE_JUNK_RE = /^[\s"'`[\]{}()!?;,:.|/\\]+|[\s"'`[\]{}()!?;,:.|/\\]+$/g

function cleanTokenText(text: string): string {
  return text.replace(EDGE_JUNK_RE, '').trim()
}

function toToken(w: WordLike): OcrToken | null {
  const text = cleanTokenText(w.text ?? '')
  if (!text) return null
  return {
    text,
    x0: w.bbox?.x0 ?? 0,
    y0: w.bbox?.y0 ?? 0,
    x1: w.bbox?.x1 ?? 0,
    y1: w.bbox?.y1 ?? 0,
  }
}

function toOcrTokens(ts: (OcrToken & { cy: number })[]): OcrToken[] {
  return ts.map((t) => ({ text: t.text, x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1 }))
}

// Regroupe des mots plats en lignes par hauteur Y (secours si l'API ne
// fournit pas de blocs structurés).
function groupWordsByLine(words: WordLike[]): OcrLine[] {
  const tokens: (OcrToken & { cy: number })[] = []
  for (const w of words) {
    const t = toToken(w)
    if (!t || !w.bbox) continue
    tokens.push({ ...t, cy: (w.bbox.y0 + w.bbox.y1) / 2 })
  }
  tokens.sort((a, b) => a.cy - b.cy)

  const lines: OcrLine[] = []
  let current: typeof tokens = []
  let lastY: number | null = null
  for (const t of tokens) {
    if (lastY !== null && Math.abs(t.cy - lastY) > 12) {
      lines.push({ y: current[0].cy, tokens: toOcrTokens(current) })
      current = []
    }
    current.push(t)
    lastY = t.cy
  }
  if (current.length) {
    lines.push({ y: current[0].cy, tokens: toOcrTokens(current) })
  }
  return lines
}

function collectLines(data: {
  blocks?: { paragraphs?: { lines?: LineLike[] }[] }[]
  words?: WordLike[]
}): OcrLine[] {
  const lines: OcrLine[] = []
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const tokens: OcrToken[] = (line.words ?? [])
          .map(toToken)
          .filter((t): t is OcrToken => t !== null)
        if (tokens.length === 0) continue
        const b = line.bbox
        lines.push({ y: b ? (b.y0 + b.y1) / 2 : tokens[0].y0, tokens })
      }
    }
  }
  if (lines.length === 0 && data.words?.length) {
    return groupWordsByLine(data.words)
  }
  return lines
}

/** Reconnaît le texte d'une photo (Blob déjà préparé) et renvoie les lignes. */
export async function ocrImageToLines(image: Blob): Promise<OcrLine[]> {
  const worker = await getWorker()
  // `blocks: true` est obligatoire en v7 : sans lui, data.blocks est vide et
  // on n'obtient aucune coordonnée de mot.
  const { data } = await worker.recognize(image, {}, { blocks: true })
  return collectLines(data as Parameters<typeof collectLines>[0])
}

/** Met fin au worker (appelé au démontage du composant, rarement nécessaire). */
export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise
    await w.terminate()
    workerPromise = null
  }
}
