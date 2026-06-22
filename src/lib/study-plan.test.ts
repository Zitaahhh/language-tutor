import { describe, expect, it } from 'vitest'
import { generateStudyPlan } from './study-plan'

describe('generateStudyPlan', () => {
  it('creates one day per requested target day with vocabulary, grammar, and speaking tasks', () => {
    const plan = generateStudyPlan({
      currentLevel: 'A1',
      goal: 'Travel confidently in Spain',
      targetDays: 3,
    })

    expect(plan).toHaveLength(3)
    expect(plan[0]).toMatchObject({ day: 1 })
    expect(plan[2]).toMatchObject({ day: 3 })
    for (const day of plan) {
      expect(day.theme).toContain('Travel confidently in Spain')
      expect(day.tasks.map((task) => task.type)).toEqual(['vocabulary', 'grammar', 'speaking'])
      expect(day.tasks.every((task) => task.title.length > 0)).toBe(true)
    }
  })

  it('clamps invalid target days into a production-safe range', () => {
    expect(generateStudyPlan({ currentLevel: 'A0', goal: 'Basics', targetDays: 0 })).toHaveLength(1)
    expect(generateStudyPlan({ currentLevel: 'B1', goal: 'DELE', targetDays: 500 })).toHaveLength(180)
  })
})
