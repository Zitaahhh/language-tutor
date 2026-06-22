'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export function OnboardingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [level, setLevel] = useState('A0')
  const [goal, setGoal] = useState('Speak confidently while traveling in Spain')
  const [days, setDays] = useState(30)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const response = await fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLevel: level, goal, targetDays: days }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Could not generate plan')
        return
      }

      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Create your Spanish plan</CardTitle>
        <CardDescription>Tell the coach where you are and what you want to achieve.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Spanish level</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['A0', 'A1', 'A2', 'B1', 'B2', 'C1'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Learning goal</Label>
          <Textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Target days</Label>
          <Input type="number" min={1} max={180} value={days} onChange={(event) => setDays(Number(event.target.value))} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={submit} disabled={isPending} className="w-full">
          {isPending ? 'Generating...' : 'Generate AI study plan'}
        </Button>
      </CardContent>
    </Card>
  )
}
