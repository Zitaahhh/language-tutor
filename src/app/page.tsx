import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6 rounded-full border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
          AI-powered Spanish learning with Telegram archival
        </div>
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">
          AI Spanish Coach
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Generate a personal Spanish plan from your level, goal, and target days. Practice vocabulary, grammar, speaking, mistake review, and archive every learning record to Telegram.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link href="/login">Start with email</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/dashboard">Open dashboard</Link></Button>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ['Adaptive plans', 'Daily vocabulary, grammar, and speaking tasks based on level and goals.'],
            ['Mistake book', 'Save corrections and explanations for spaced review.'],
            ['Telegram archive', 'Send plans, completed tasks, and mistakes to your Telegram group.'],
          ].map(([title, description]) => (
            <Card key={title} className="text-left">
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent><CardDescription>{description}</CardDescription></CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
