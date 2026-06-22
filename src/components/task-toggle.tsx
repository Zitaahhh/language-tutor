'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'

type TaskToggleProps = {
  taskId: string
  completed: boolean
}

export function TaskToggle({ taskId, completed }: TaskToggleProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Checkbox
      checked={completed}
      disabled={isPending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, completed: Boolean(checked) }),
          })
          router.refresh()
        })
      }}
    />
  )
}
