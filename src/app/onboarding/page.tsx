import { redirect } from 'next/navigation'
import { OnboardingForm } from '@/components/onboarding-form'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return (
    <main className="min-h-screen bg-muted/30 px-6 py-12">
      <OnboardingForm />
    </main>
  )
}
