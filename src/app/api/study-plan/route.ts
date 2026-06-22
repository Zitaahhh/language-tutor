import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateStudyPlan } from '@/lib/study-plan'
import { buildTelegramArchiveMessage, sendTelegramArchive } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'

const BodySchema = z.object({
  currentLevel: z.string().min(1),
  goal: z.string().min(2),
  targetDays: z.coerce.number().int().min(1).max(180),
})

export async function POST(request: Request) {
  const payload = BodySchema.parse(await request.json())
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plan = generateStudyPlan(payload)

  const { data: studyPlan, error: planError } = await supabase
    .from('study_plans')
    .insert({
      user_id: userData.user.id,
      current_level: payload.currentLevel,
      goal: payload.goal,
      target_days: payload.targetDays,
      plan,
    })
    .select('id')
    .single()

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 })
  }

  const tasks = plan.flatMap((day) =>
    day.tasks.map((task) => ({
      user_id: userData.user.id,
      study_plan_id: studyPlan.id,
      day_number: day.day,
      task_type: task.type,
      title: task.title,
      description: task.description,
    })),
  )

  const { error: tasksError } = await supabase.from('daily_tasks').insert(tasks)
  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 })
  }

  await supabase
    .from('profiles')
    .update({
      spanish_level: payload.currentLevel,
      learning_goal: payload.goal,
      target_days: payload.targetDays,
      onboarding_completed: true,
    })
    .eq('id', userData.user.id)

  const archiveMessage = buildTelegramArchiveMessage({
    type: 'plan_generated',
    userEmail: userData.user.email,
    title: `${payload.targetDays}-day plan generated`,
    body: `Level: ${payload.currentLevel}\nGoal: ${payload.goal}\nTasks: ${tasks.length}`,
  })
  const telegram = await sendTelegramArchive(archiveMessage)

  await supabase.from('telegram_archives').insert({
    user_id: userData.user.id,
    archive_type: 'plan_generated',
    title: `${payload.targetDays}-day plan generated`,
    body: archiveMessage,
    status: telegram.ok ? 'sent' : telegram.skipped ? 'skipped' : 'failed',
    error: telegram.error,
  })

  return NextResponse.json({ plan, studyPlanId: studyPlan.id })
}
