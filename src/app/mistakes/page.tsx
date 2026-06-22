import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MistakeForm } from '@/components/mistake-form'
import { createClient } from '@/lib/supabase/server'

export default async function MistakesPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: mistakes } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Add a mistake</CardTitle></CardHeader>
          <CardContent><MistakeForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mistake book</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mistakes?.map((mistake) => (
              <div key={mistake.id} className="rounded-lg border p-4">
                <Badge>{mistake.category}</Badge>
                <p className="mt-3 text-sm text-muted-foreground">Original</p>
                <p>{mistake.original_text}</p>
                <p className="mt-3 text-sm text-muted-foreground">Corrected</p>
                <p className="font-medium text-green-700">{mistake.corrected_text}</p>
                {mistake.explanation ? <p className="mt-3 text-sm">{mistake.explanation}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
