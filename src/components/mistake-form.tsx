'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function MistakeForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [originalText, setOriginalText] = useState('')
  const [correctedText, setCorrectedText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [category, setCategory] = useState('grammar')

  const submit = () => {
    startTransition(async () => {
      await fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText, correctedText, explanation, category }),
      })
      setOriginalText('')
      setCorrectedText('')
      setExplanation('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Original</Label>
        <Textarea value={originalText} onChange={(event) => setOriginalText(event.target.value)} placeholder="Yo soy en Madrid" />
      </div>
      <div className="space-y-2">
        <Label>Correction</Label>
        <Textarea value={correctedText} onChange={(event) => setCorrectedText(event.target.value)} placeholder="Estoy en Madrid" />
      </div>
      <div className="space-y-2">
        <Label>Explanation</Label>
        <Textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Use estar for location." />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Input value={category} onChange={(event) => setCategory(event.target.value)} />
      </div>
      <Button onClick={submit} disabled={isPending || !originalText || !correctedText}>Save mistake</Button>
    </div>
  )
}
