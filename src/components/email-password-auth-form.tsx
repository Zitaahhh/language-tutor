'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { AUTH_COPY, isValidPassword } from '@/lib/auth'

type AuthMode = 'sign-in' | 'sign-up'

export function EmailPasswordAuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    if (!isValidPassword(password)) {
      setError('Password must be at least 8 characters.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const result =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
            })

      if (result.error) {
        setError(result.error.message)
        return
      }

      if (mode === 'sign-up' && !result.data.session) {
        setMessage('Account created. Please check your email to confirm your account, then sign in.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
        <Button type="button" variant={mode === 'sign-in' ? 'default' : 'ghost'} onClick={() => setMode('sign-in')}>
          {AUTH_COPY.primaryAction}
        </Button>
        <Button type="button" variant={mode === 'sign-up' ? 'default' : 'ghost'} onClick={() => setMode('sign-up')}>
          {AUTH_COPY.secondaryAction}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Button type="button" onClick={submit} disabled={isPending} className="w-full">
        {isPending ? 'Please wait...' : mode === 'sign-in' ? AUTH_COPY.primaryAction : AUTH_COPY.secondaryAction}
      </Button>
    </div>
  )
}
