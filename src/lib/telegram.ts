export type ArchiveEvent = {
  type: 'onboarding' | 'plan_generated' | 'task_completed' | 'mistake_added'
  userEmail?: string | null
  title: string
  body: string
}

export function buildTelegramArchiveMessage(event: ArchiveEvent) {
  const label = event.type.replaceAll('_', ' ')
  return [
    '🇪🇸 AI Spanish Coach',
    `Type: ${label}`,
    event.userEmail ? `Learner: ${event.userEmail}` : undefined,
    `Title: ${event.title}`,
    '',
    event.body,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function sendTelegramArchive(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  const threadId = process.env.TELEGRAM_THREAD_ID

  if (!token || !chatId) {
    return { ok: false, skipped: true, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing' }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: threadId ? Number(threadId) : undefined,
      text: message,
      parse_mode: 'HTML',
    }),
  })

  const data = await response.json().catch(() => null)
  return { ok: response.ok, skipped: false, data, error: response.ok ? undefined : JSON.stringify(data) }
}
