import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Description du template des plannings (voir docs/planning-template.md)
const SYSTEM_PROMPT = `Tu es un expert qui lit des plannings de départs de bus au Niger et renvoie les données au format JSON.

Le planning est une grille de 7 colonnes (séparées par des traits verticaux) :
1. AXES : trajet "Origine - Destination" (texte long, peut finir par REPOS ou NUIT)
2. N° BUS : code du bus (ex. CG 6377, BZ 5942, BM 5840, BH 8210, BM 4970)
3. HEURE : heure de départ au format "05 H 00" ou le texte "NUIT"
4. CHAUFFEUR TITULAIRE : nom du chauffeur principal
5. CHAUFFEUR SUPPLÉANT : nom du remplaçant, souvent "NEANT"
6. TÉLÉPHONE TITULAIRE : 8 chiffres
7. TÉLÉPHONE SUPPLÉANT : 8 chiffres ou "NEANT"

La page contient des blocs "DEPART VILLE" (ex. DEPART AGADEZ, DEPART ARLIT, DEPART NIAMEY).
La date est au format JJ/MM/AAAA en haut.

Renvoie UNIQUEMENT un JSON valide, sans texte autour, au format :
{"date":"AAAA-MM-JJ","sections":[{"originCity":"VILLE","departures":[{"axis":"...","busNumber":"...","departureTime":"...","driverName":"...","driverPhone":"...","backupDriver":"...","backupPhone":"..."}]}]}

Règles :
- "NEANT" dans les colonnes 5 ou 7 → chaîne vide "" dans backupDriver/backupPhone
- Heures normalisées en "05 H 00"
- N'oublie aucune ligne de données.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Clé Gemini non configurée (GEMINI_API_KEY).' },
      { status: 500 }
    )
  }

  const body = await req.json()
  const image = body?.image as string | undefined
  if (!image) {
    return NextResponse.json({ error: 'image manquante' }, { status: 400 })
  }

  // L'image arrive en data URI : "data:image/jpeg;base64,XXXX"
  const m = image.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!m) {
    return NextResponse.json({ error: 'format d’image invalide' }, { status: 400 })
  }
  const [, mimeType, base64] = m

  const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: 'Analyse ce planning et renvoie le JSON.' },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        max_output_tokens: 4000,
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const msg = data?.error?.message ?? `Erreur Gemini (${response.status})`
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const content = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')

  const parsed = extractJson(content ?? '')
  if (!parsed) {
    return NextResponse.json({ error: 'Réponse illisible du modèle.' }, { status: 502 })
  }
  return NextResponse.json(parsed)
}

// Extrait un objet JSON du texte renvoyé par le modèle (tolère du texte autour)
function extractJson(content: string): unknown | null {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}
