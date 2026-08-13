import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRefinementPrompt, parseAiPlanning } from '@/lib/planning/ai'

// Correction IA du planning : DeepSeek (TEXTE uniquement). Tesseract fait l'OCR
// côté navigateur, on envoie le texte brut à DeepSeek qui corrige et structure
// en JSON. L'API DeepSeek ne supporte PAS les images (vérifié en réel) — ce
// mode texte est le seul utilisable avec une clé DeepSeek.
//
// NB : on n'utilise PAS la variable DEEPSEEK_API_KEY (l'environnement injecte une
// fausse clé sous ce nom). Seule DEEPSEEK_TEXT_API_KEY est valable.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const key = process.env.DEEPSEEK_TEXT_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'Clé IA non configurée (DEEPSEEK_TEXT_API_KEY).' },
      { status: 500 }
    )
  }
  const model = process.env.DEEPSEEK_TEXT_MODEL ?? 'deepseek-chat'

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const text = (body.text ?? '').trim()
  if (!text) {
    return NextResponse.json({ error: 'Aucun texte OCR reçu.' }, { status: 400 })
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: 'Texte OCR trop long.' }, { status: 400 })
  }

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
          content: `${buildRefinementPrompt()}\n\n--- OCR À CORRIGER ---\n${text}`,
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
