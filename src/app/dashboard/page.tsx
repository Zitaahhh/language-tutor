import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TaskToggle } from '@/components/task-toggle'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const [{ data: profile }, { data: tasks }, { data: mistakes }, { data: archives }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userData.user.id).single(),
    supabase.from('daily_tasks').select('*').eq('user_id', userData.user.id).order('day_number').limit(12),
    supabase.from('mistakes').select('*').eq('user_id', userData.user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('telegram_archives').select('*').eq('user_id', userData.user.id).order('created_at', { ascending: false }).limit(5),
  ])

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const totalTasks = tasks?.length ?? 0
  const completedTasks = tasks?.filter((task) => task.completed).length ?? 0
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Hola, {userData.user.email}</p>
            <h1 className="text-3xl font-bold">Your Spanish dashboard</h1>
          </div>
          <Button asChild><Link href="/onboarding">Regenerate plan</Link></Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Current streak</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{profile.current_streak ?? 0} days</CardContent></Card>
          <Card><CardHeader><CardTitle>Progress</CardTitle></CardHeader><CardContent><Progress value={progress} /><p className="mt-2 text-sm text-muted-foreground">{progress}% of visible tasks completed</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Completed tasks</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{completedTasks}/{totalTasks}</CardContent></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader><CardTitle>Daily tasks</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {tasks?.map((task) => (
                <div key={task.id} className="flex items-start gap-3 rounded-lg border p-4">
                  <TaskToggle taskId={task.id} completed={task.completed} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><Badge variant="secondary">Day {task.day_number}</Badge><Badge>{task.task_type}</Badge></div>
                    <h3 className="mt-2 font-semibold">{task.title}</h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Mistake book</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full"><Link href="/mistakes">Open mistake book</Link></Button>
                {mistakes?.map((mistake) => <p key={mistake.id} className="text-sm"><span className="font-medium">{mistake.category}:</span> {mistake.corrected_text}</p>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Telegram archive</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {archives?.map((archive) => <p key={archive.id} className="text-sm"><Badge variant="outline">{archive.status}</Badge> {archive.title}</p>)}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
