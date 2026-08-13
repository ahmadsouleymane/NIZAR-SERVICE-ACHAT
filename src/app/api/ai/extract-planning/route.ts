import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAiPrompt, parseAiPlanning, AI_MAX_IMAGES, AI_MODEL_DEFAULT } from '@/lib/planning/ai'

// Extraction du planning par vision IA (DeepSeek V4 Pro, endpoint OpenAI-compatible).
// La clé ne sort jamais du serveur. En cas d'échec, l'utilisateur peut toujours
// revenir à la lecture classique Tesseract.
//
// NB : on n'utilise PAS la variable DEEPSEEK_API_KEY (l'environnement injecte une
// fausse clé sous ce nom). Seule DEEPSEEK_VISION_API_KEY est valable.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const key = process.env.DEEPSEEK_VISION_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'Clé IA non configurée (DEEPSEEK_VISION_API_KEY).' },
      { status: 500 }
    )
  }

  let body: { images?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const images = (body.images ?? []).filter(
    (u): u is string => typeof u === 'string' && u.startsWith('data:image/')
  )
  if (images.length === 0) {
    return NextResponse.json({ error: 'Aucune image valide.' }, { status: 400 })
  }
  if (images.length > AI_MAX_IMAGES) {
    return NextResponse.json(
      { error: `Trop de photos (max ${AI_MAX_IMAGES}). Scannez en plusieurs fois.` },
      { status: 400 }
    )
  }

  const model = process.env.DEEPSEEK_VISION_MODEL ?? AI_MODEL_DEFAULT
  const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'Tu es un extracteur de données fiable. Réponds uniquement avec un JSON valide.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildAiPrompt() },
            ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
    }),
  })

  if (!apiRes.ok) {
    const t = (await apiRes.text()).slice(0, 300)
    return NextResponse.json(
      { error: `L'API IA a répondu ${apiRes.status} : ${t}` },
      { status: 502 }
    )
  }

  const data = await apiRes.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'Réponse IA inattendue.' }, { status: 502 })
  }

  const parsed = parseAiPlanning(content)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Impossible d’interpréter la réponse IA. Réessayez ou utilisez la lecture classique.' },
      { status: 422 }
    )
  }
  return NextResponse.json(parsed)
}
