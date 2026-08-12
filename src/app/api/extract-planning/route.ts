import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePlanning } from '@/lib/planning/parse'

// Le premier scan après un redémarrage du service OCR peut être lent
// (chargement des modèles PaddleOCR) ; on laisse de la marge avant d'abandonner.
export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const image = body?.image as string | undefined
  if (!image) {
    return NextResponse.json({ error: 'image manquante' }, { status: 400 })
  }

  const m = image.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!m) {
    return NextResponse.json({ error: 'format d’image invalide' }, { status: 400 })
  }
  const [, mimeType, base64] = m

  // Service OCR auto-hébergé (PaddleOCR, gratuit) — seul moteur utilisé, pas d'API payante.
  const ocrUrl = process.env.OCR_SERVICE_URL
  if (!ocrUrl) {
    return NextResponse.json(
      { error: 'Service de lecture non configuré : définissez OCR_SERVICE_URL.' },
      { status: 500 }
    )
  }

  const buf = Buffer.from(base64, 'base64')
  const fd = new FormData()
  fd.append('file', new Blob([buf], { type: mimeType }), 'planning.jpg')

  let ocrRes: Response
  try {
    ocrRes = await fetch(`${ocrUrl.replace(/\/$/, '')}/extract`, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(55000),
    })
  } catch {
    return NextResponse.json(
      { error: 'Service de lecture injoignable. Vérifiez qu’il est bien démarré (OCR_SERVICE_URL).' },
      { status: 502 }
    )
  }
  if (!ocrRes.ok) {
    return NextResponse.json(
      { error: `Erreur du service de lecture (${ocrRes.status}).` },
      { status: 502 }
    )
  }

  const json = (await ocrRes.json()) as { lines?: unknown[] }
  const parsed = parsePlanning((json.lines ?? []) as Parameters<typeof parsePlanning>[0])
  if (parsed.sections.length === 0) {
    return NextResponse.json(
      { error: 'Aucune ligne détectée sur cette photo. Réessayez avec une photo bien à plat, nette et bien éclairée.' },
      { status: 422 }
    )
  }
  return NextResponse.json(parsed)
}
