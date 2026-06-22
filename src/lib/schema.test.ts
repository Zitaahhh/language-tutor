import { describe, expect, it } from 'vitest'
import { getSchemaSql } from './schema'

describe('getSchemaSql', () => {
  it('contains all production tables and RLS policies', () => {
    const sql = getSchemaSql()

    for (const table of ['profiles', 'study_plans', 'daily_tasks', 'mistakes', 'telegram_archives']) {
      expect(sql).toContain(`create table if not exists public.${table}`)
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }

    expect(sql).toContain('handle_new_user')
    expect(sql).toContain('on_auth_user_created')
  })
})
