// Correction IA du planning par DeepSeek (TEXTE uniquement — l'API DeepSeek ne
// supporte pas les images, vérifié en réel). Tesseract « voit » (OCR local),
// DeepSeek « corrige et structure » en JSON. Module purement testable.
import { lineText, normalizeTime, type OcrLine, type ParsedPlanning } from './parse'

// Série les lignes OCR de toutes les photos en un bloc texte lisible par l'IA :
// une ligne par sortie OCR, triées verticalement, séparées par photo.
export function serializeOcrLines(photos: OcrLine[][]): string {
  return photos
    .map((lines, idx) => {
      const block = [...lines]
        .sort((a, b) => a.y - b.y)
        .map(lineText)
        .filter(Boolean)
        .join('\n')
      if (!block) return ''
      return photos.length > 1 ? `--- PHOTO ${idx + 1} ---\n${block}` : block
    })
    .filter(Boolean)
    .join('\n\n')
}

export function buildRefinementPrompt(): string {
  return `Voici l'OCR (reconnaissance de caractères) d'un planning de départs d'autocars (Niger), photo par photo.
Le tableau a 7 colonnes : AXE | N° BUS | HEURE | CHAUFFEUR TITULAIRE | CHAUFFEUR SUPPLÉANT | TÉLÉPHONE TITULAIRE | TÉLÉPHONE SUPPLÉANT.
Des sections commencent par "DEPART <VILLE>". L'OCR est imparfait : les colonnes peuvent être mélangées, avec des caractères parasites ("|", "_", "-", "—"). Corrige et structure le tout en JSON strict, sans texte autour, sans marqueur de bloc :
{"date":"AAAA-MM-JJ","sections":[{"originCity":"NIAMEY","departures":[{"axis":"AGADEZ - NIAMEY ENCOUR","busNumber":"CG 6377","departureTime":"05 H 00","driverName":"YOUSSOUF","driverPhone":"96474717","backupDriver":"","backupPhone":""}]}]}
Règles :
- Rétablis les colonnes grâce au contexte : un n° de bus = 2 lettres + 3-4 chiffres ; un téléphone = 7-8 chiffres.
- axis : texte exact tel qu'imprimé (garde SPECIAL / ENCOUR / REPOS s'ils y figurent).
- busNumber : normalise "CG6326" en "CG 6326".
- departureTime : "HH H MM" (ex. "05 H 00") ou "NUIT".
- NEANT → champ vide "".
- Si une donnée est illisible ou absente, renvoie "" plutôt que d'inventer.
- N'invente JAMAIS de ligne : ne garde que ce qui ressemble réellement à un départ (il faut un n° de bus).
- date : "AAAA-MM-JJ" ; si absente, null.`
}

// Nettoie la réponse (supprime les éventuels blocs ```json … ```) et renvoie le
// planning structuré, ou null si la réponse est inexploitable.
export function parseAiPlanning(text: string): ParsedPlanning | null {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let obj: unknown
  try {
    obj = JSON.parse(cleaned)
  } catch {
    // La réponse peut contenir du texte autour du JSON : on extrait le 1er objet.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      obj = JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return normalizeAiPlanning(obj)
}

export function normalizeAiPlanning(obj: unknown): ParsedPlanning | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>

  const date = coerceDate(o.date)
  const rawSections = Array.isArray(o.sections) ? o.sections : []
  const sections = rawSections
    .map((s) => {
      const so = (s ?? {}) as Record<string, unknown>
      const originCity = String(so.originCity ?? so.origin_city ?? '').trim().toUpperCase()
      const deps = Array.isArray(so.departures) ? so.departures : []
      const departures = deps
        .map((d) => normalizeDeparture(d))
        .filter((d): d is NonNullable<typeof d> => d !== null)
      return departures.length > 0 ? { originCity: originCity || 'Autre', departures } : null
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  return { date, sections }
}

function coerceDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  const dm = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dm) return `${dm[3]}-${dm[2]}-${dm[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function normalizeDeparture(d: unknown) {
  if (!d || typeof d !== 'object') return null
  const o = d as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const busNumber = str(o.busNumber ?? o.bus_number).replace(/^([A-Z]{2})\s?(\d{3,4})$/, '$1 $2')
  // Sans n° de bus, la ligne n'est pas exploitable.
  if (!busNumber) return null
  return {
    axis: str(o.axis),
    busNumber,
    departureTime: normalizeTime(str(o.departureTime ?? o.departure_time ?? o.heure)),
    driverName: str(o.driverName ?? o.driver_name),
    driverPhone: str(o.driverPhone ?? o.driver_phone),
    backupDriver: str(o.backupDriver ?? o.backup_driver),
    backupPhone: str(o.backupPhone ?? o.backup_phone),
  }
}
