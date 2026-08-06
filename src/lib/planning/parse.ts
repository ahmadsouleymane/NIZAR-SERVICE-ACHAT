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
  return m[1].toUpperCase()
}

export function originOf(axis: string): string {
  const first = axis.split(' - ')[0].trim()
  return first.toUpperCase() || 'Autre'
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
  const tokens = [...line.tokens].sort((a, b) => a.x0 - b.x0)
  const joined = lineText({ tokens, y: line.y })
  if (HEADER_SKIP_RE.test(joined.trim())) return null

  const bus = findBus(tokens)
  if (!bus) return null

  const axisTokens = tokens.slice(0, bus.start)
  const axis = axisTokens.map((t) => t.text).join(' ').trim()

  const timeParts: string[] = []
  let i = bus.end
  while (i < tokens.length && TIME_PART_RE.test(tokens[i].text)) {
    timeParts.push(tokens[i].text)
    i++
  }
  const departureTime = timeParts.join(' ')

  const phones = tokens.filter((t) => PHONE_RE.test(t.text)).map((t) => t.text)
  const driverTokens = tokens.slice(i).filter((t) => !PHONE_RE.test(t.text))
  const driverName = driverTokens.map((t) => t.text).join(' ').trim()

  return {
    axis,
    busNumber: bus.bus,
    departureTime,
    driverName,
    driverPhone: phones[0] ?? '',
    backupDriver: '',
    backupPhone: phones[1] ?? '',
  }
}

export function parsePlanning(lines: OcrLine[]): ParsedPlanning {
  const date = parseDateFromLines(lines)
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null

  const sorted = [...lines].sort((a, b) => a.y - b.y)
  for (const line of sorted) {
    const header = detectSectionHeader(line)
    if (header) {
      current = { originCity: header, departures: [] }
      sections.push(current)
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
  return { date, sections }
}
