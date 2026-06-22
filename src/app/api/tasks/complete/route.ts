import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildTelegramArchiveMessage, sendTelegramArchive } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'

const BodySchema = z.object({ taskId: z.string().uuid(), completed: z.boolean().default(true) })

export async function POST(request: Request) {
  const { taskId, completed } = BodySchema.parse(await request.json())
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: task, error } = await supabase
    .from('daily_tasks')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', taskId)
    .eq('user_id', userData.user.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (completed) {
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('profiles').update({ last_completed_on: today }).eq('id', userData.user.id)

    const message = buildTelegramArchiveMessage({
      type: 'task_completed',
      userEmail: userData.user.email,
      title: task.title,
      body: task.description,
    })
    const telegram = await sendTelegramArchive(message)
    await supabase.from('telegram_archives').insert({
      user_id: userData.user.id,
      archive_type: 'task_completed',
      title: task.title,
      body: message,
      status: telegram.ok ? 'sent' : telegram.skipped ? 'skipped' : 'failed',
      error: telegram.error,
    })
  }

  return NextResponse.json({ task })
}
