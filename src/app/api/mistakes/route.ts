import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildTelegramArchiveMessage, sendTelegramArchive } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'

const BodySchema = z.object({
  originalText: z.string().min(1),
  correctedText: z.string().min(1),
  explanation: z.string().optional(),
  category: z.string().default('general'),
})

export async function POST(request: Request) {
  const payload = BodySchema.parse(await request.json())
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: mistake, error } = await supabase
    .from('mistakes')
    .insert({
      user_id: userData.user.id,
      original_text: payload.originalText,
      corrected_text: payload.correctedText,
      explanation: payload.explanation,
      category: payload.category,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const message = buildTelegramArchiveMessage({
    type: 'mistake_added',
    userEmail: userData.user.email,
    title: `Mistake: ${payload.category}`,
    body: `Original: ${payload.originalText}\nCorrected: ${payload.correctedText}\n${payload.explanation ?? ''}`,
  })
  const telegram = await sendTelegramArchive(message)

  await supabase.from('telegram_archives').insert({
    user_id: userData.user.id,
    archive_type: 'mistake_added',
    title: `Mistake: ${payload.category}`,
    body: message,
    status: telegram.ok ? 'sent' : telegram.skipped ? 'skipped' : 'failed',
    error: telegram.error,
  })

  return NextResponse.json({ mistake })
}
