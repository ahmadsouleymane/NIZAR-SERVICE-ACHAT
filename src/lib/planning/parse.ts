export interface OcrToken {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrLine {
  tokens: OcrToken[]
  y: number
}

export interface ParsedDeparture {
  axis: string
  busNumber: string
  departureTime: string
  driverName: string
  driverPhone: string
  backupDriver: string
  backupPhone: string
}

export interface ParsedSection {
  originCity: string
  departures: ParsedDeparture[]
}

export interface ParsedPlanning {
  date: string | null
  sections: ParsedSection[]
}

const PHONE_RE = /^\d{7,8}$/
const BUS_TOKEN_RE = /^[A-Z]{2}\s?\d{3,4}$/
const LETTERS_RE = /^[A-Z]{1,2}$/
const DIGITS3_RE = /^\d{3,4}$/
const TIME_PART_RE = /^(\d{1,2}|H|H\d{2}|\d{1,2}H\d{2}|\d{1,2}H|NUIT)$/i
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const HEADER_SKIP_RE = /^(axe|axes|n°|num|heure|chauffeur|tel|télé|depart)/i
const NEANT_RE = /^(NEANT|NÉANT)$/i

// Mots de l'en-tête du tableau (jamais des villes) : une ligne « DEPART X » qui
// en contient un est un en-tête de colonne, pas un début de section.
const HEADER_WORDS = ['TITULAIRE', 'SUPPLEANT', 'SUPPLEMENTAIRE', 'SUPPLÉANT', 'HEURE', 'CHAUFFEUR', 'TELEPHONE', 'TÉLÉPHONE', 'NUMERO']

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1)
      )
    }
    prev = cur
  }
  return prev[n]
}

// Ville de section ressemblant à un mot d'en-tête (tolère les erreurs OCR :
// « IITULIAIRE » ≈ « TITULAIRE »).
function isHeaderCity(city: string): boolean {
  return HEADER_WORDS.some((h) => levenshtein(city, h) <= 2)
}

// Nettoie un token OCR : retire traits/soulignés/tirets aux extrémités
// (« -NEANT » → « NEANT »), mais conserve le séparateur d'axe (« - », « — »).
function cleanToken(t: string): string {
  const trimmed = t.trim()
  if (/^[-—–]$/.test(trimmed)) return trimmed
  return trimmed.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

export function lineText(line: OcrLine): string {
  return line.tokens.map((t) => t.text).join(' ').trim()
}

export function parseDateFromLines(lines: OcrLine[]): string | null {
  for (const line of lines) {
    for (const token of line.tokens) {
      const m = token.text.match(DATE_RE)
      if (m) {
        const [, dd, mm, yyyy] = m
        return `${yyyy}-${mm}-${dd}`
      }
    }
  }
  return null
}

export function detectSectionHeader(line: OcrLine): string | null {
  const text = lineText(line)
  const m = text.match(/(?:^|\s)DEPART\s+([A-ZÀ-Ü]+)/i)
  if (!m) return null
  const city = m[1].toUpperCase()
  // ignore la 2e ligne d'en-tête du tableau (« DEPART » sous la colonne HEURE)
  if (isHeaderCity(city)) return null
  if (HEADER_WORDS.some((hw) => text.toUpperCase().includes(hw))) return null
  return city
}

export function originOf(axis: string): string {
  const parts = axis.split(/\s*[-—–]\s*/).map((s) => s.trim()).filter(Boolean)
  return (parts[0] ?? 'Autre').toUpperCase()
}

function findBus(tokens: OcrToken[]): { bus: string; start: number; end: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (BUS_TOKEN_RE.test(tokens[i].text)) {
      return { bus: tokens[i].text.trim(), start: i, end: i + 1 }
    }
    if (
      LETTERS_RE.test(tokens[i].text) &&
      i + 1 < tokens.length &&
      DIGITS3_RE.test(tokens[i + 1].text) &&
      tokens[i + 1].x0 - tokens[i].x1 < 15
    ) {
      return { bus: `${tokens[i].text} ${tokens[i + 1].text}`, start: i, end: i + 2 }
    }
  }
  return null
}

export function classifyRow(line: OcrLine): ParsedDeparture | null {
  const tokens = line.tokens
    .map((t) => ({ ...t, text: cleanToken(t.text) }))
    .filter((t) => t.text.length > 0)
    .sort((a, b) => a.x0 - b.x0)
  const joined = lineText({ tokens, y: line.y })
  if (HEADER_SKIP_RE.test(joined.trim())) return null
  if (joined.replace(/[^\p{L}\p{N}]/gu, '').trim().length === 0) return null

  const bus = findBus(tokens)
  if (!bus) return null
  // N° de bus normalisé : « CG6326 » → « CG 6326 » (matching prédiction + affichage).
  const busNumber = bus.bus.replace(/^([A-Z]{2})\s?(\d{3,4})$/, '$1 $2')

  // Colonne 1 — AXE (tout ce qui est avant le n° de bus)
  const axis = tokens.slice(0, bus.start).map((t) => t.text).join(' ').trim()

  // Colonne 3 — HEURE (ex. « 05 H 00 », « 05H00 », « NUIT »)
  const timeParts: string[] = []
  let i = bus.end
  while (i < tokens.length && TIME_PART_RE.test(tokens[i].text)) {
    timeParts.push(tokens[i].text)
    i++
  }
  const departureTime = normalizeTime(timeParts.join(' '))

  // Colonnes 6 et 7 — TÉLÉPHONES (8 chiffres) : titulaire à gauche, suppléant à droite
  const phones = tokens.filter((t) => PHONE_RE.test(t.text))
  const phoneT = phones[0]?.text ?? ''
  const phoneS = phones[1]?.text ?? ''

  // Colonnes 4 et 5 — CHAUFFEURS (entre l'heure et le 1er téléphone)
  const firstPhoneIdx = phones.length ? tokens.indexOf(phones[0]) : tokens.length
  const driverRegion = tokens.slice(i, firstPhoneIdx)
  const driverTokens = driverRegion.filter((t) => !NEANT_RE.test(t.text))

  let driverName = driverTokens.map((t) => t.text).join(' ').trim()
  let backupDriver = ''

  const hasNeant = driverRegion.some((t) => NEANT_RE.test(t.text))
  if (!hasNeant && phones.length >= 2 && driverTokens.length > 1) {
    // deux chauffeurs réels (titulaire + suppléant) : couper au plus grand écart horizontal
    let split = 1
    let maxGap = 0
    for (let k = 0; k < driverTokens.length - 1; k++) {
      const gap = driverTokens[k + 1].x0 - driverTokens[k].x1
      if (gap > maxGap) {
        maxGap = gap
        split = k + 1
      }
    }
    driverName = driverTokens.slice(0, split).map((t) => t.text).join(' ').trim()
    backupDriver = driverTokens.slice(split).map((t) => t.text).join(' ').trim()
  }

  return {
    axis,
    busNumber,
    departureTime,
    driverName,
    driverPhone: phoneT,
    backupDriver,
    backupPhone: phoneS,
  }
}

// Normalise « 05H00 » / «05 H 00» → « 05 H 00 » (format des feuilles)
export function normalizeTime(t: string): string {
  const m = t.match(/^(\d{1,2})\s*H\s*(\d{2})$/)
  return m ? `${m[1]} H ${m[2]}` : t
}

export function parsePlanning(lines: OcrLine[]): ParsedPlanning {
  const date = parseDateFromLines(lines)
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null

  const sorted = [...lines].sort((a, b) => a.y - b.y)
  for (const line of sorted) {
    const header = detectSectionHeader(line)
    if (header) {
      // éviter un doublon vide (ex. titre « PLANNING ... DEPART X » puis « DEPART X »)
      if (!(current && current.originCity === header && current.departures.length === 0)) {
        current = { originCity: header, departures: [] }
        sections.push(current)
      }
      continue
    }
    const row = classifyRow(line)
    if (row) {
      if (!current) {
        current = { originCity: originOf(row.axis), departures: [] }
        sections.push(current)
      }
      current.departures.push(row)
    }
  }
  // On retire les sections sans départ (en-têtes isolés, « 0 ligne »).
  return { date, sections: sections.filter((s) => s.departures.length > 0) }
}
