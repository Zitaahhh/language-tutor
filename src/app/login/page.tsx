import { redirect } from 'next/navigation'
import { EmailPasswordAuthForm } from '@/components/email-password-auth-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data.user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in or create an account with email and password to continue your Spanish learning streak.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailPasswordAuthForm />
        </CardContent>
      </Card>
    </main>
  )
}
