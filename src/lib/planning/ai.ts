// Extraction IA du planning (vision DeepSeek) : prompt + parsing/validation de
// la réponse JSON. La route API appelle le modèle vision ; ce module ne contient
// que de la logique pure et testable.
import type { ParsedPlanning } from './parse'

export const AI_MODEL_DEFAULT = 'deepseek-v4-pro'

// Nombre max de photos envoyées à l'IA en une requête (limite de taille de
// corps + latence). Au-delà, l'utilisateur fait plusieurs scans.
export const AI_MAX_IMAGES = 6

export function buildAiPrompt(): string {
  return `Tu es un extracteur de données pour des plannings de départs d'autocars (Niger).
Le planning est un tableau à 7 colonnes :
1. AXE (ex. "AGADEZ - NIAMEY", peut contenir "SPECIAL", "ENCOUR", "REPOS")
2. N° BUS (ex. "CG 6377", "BM 5769")
3. HEURE (ex. "05 H 00", "NUIT")
4. CHAUFFEUR TITULAIRE
5. CHAUFFEUR SUPPLÉANT (souvent "NEANT")
6. TÉLÉPHONE TITULAIRE (8 chiffres)
7. TÉLÉPHONE SUPPLÉANT
Des sections commencent par "DEPART <VILLE>". La date figure en haut à gauche au format jj/mm/aaaa.

Extrais TOUTES les lignes de TOUTES les photos, en JSON strict (aucun texte autour, aucun marqueur de bloc) :
{"date":"AAAA-MM-JJ","sections":[{"originCity":"NIAMEY","departures":[{"axis":"AGADEZ - NIAMEY ENCOUR","busNumber":"CG 6377","departureTime":"05 H 00","driverName":"YOUSSOUF","driverPhone":"96474717","backupDriver":"","backupPhone":""}]}]}

Règles :
- axis : texte exact tel qu'imprimé (garde "SPECIAL" / "ENCOUR" s'ils y figurent).
- busNumber : normalise "CG6326" en "CG 6326" (2 lettres + espace + 3-4 chiffres).
- departureTime : "HH H MM" (ex. "05 H 00") ou "NUIT".
- NEANT → champ vide "".
- Si une cellule est illisible, renvoie "" plutôt que d'inventer.
- N'invente JAMAIS de ligne : renvoie uniquement ce qui est réellement lisible.
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
    departureTime: str(o.departureTime ?? o.departure_time ?? o.heure),
    driverName: str(o.driverName ?? o.driver_name),
    driverPhone: str(o.driverPhone ?? o.driver_phone),
    backupDriver: str(o.backupDriver ?? o.backup_driver),
    backupPhone: str(o.backupPhone ?? o.backup_phone),
  }
}
