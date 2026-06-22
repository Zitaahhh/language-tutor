import { describe, expect, it } from 'vitest'
import { buildTelegramArchiveMessage } from './telegram'

describe('buildTelegramArchiveMessage', () => {
  it('formats progress records for Telegram archival', () => {
    const message = buildTelegramArchiveMessage({
      type: 'task_completed',
      userEmail: 'zita@example.com',
      title: 'Day 1 Vocabulary',
      body: 'Completed 10 travel words',
    })

    expect(message).toContain('AI Spanish Coach')
    expect(message).toContain('zita@example.com')
    expect(message).toContain('Day 1 Vocabulary')
    expect(message).toContain('Completed 10 travel words')
  })
})
