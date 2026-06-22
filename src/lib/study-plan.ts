export type SpanishLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

export type StudyTaskType = 'vocabulary' | 'grammar' | 'speaking'

export type StudyPlanInput = {
  currentLevel: SpanishLevel | string
  goal: string
  targetDays: number
}

export type GeneratedStudyTask = {
  type: StudyTaskType
  title: string
  description: string
  estimatedMinutes: number
}

export type GeneratedStudyDay = {
  day: number
  theme: string
  objective: string
  tasks: GeneratedStudyTask[]
}

const clampDays = (days: number) => Math.min(Math.max(Math.trunc(Number.isFinite(days) ? days : 1), 1), 180)

const focusByLevel: Record<string, string> = {
  A0: 'survival phrases, pronunciation, and confidence building',
  A1: 'everyday vocabulary, present tense, and short answers',
  A2: 'past/future basics, travel scenarios, and longer replies',
  B1: 'fluency, opinions, storytelling, and listening precision',
  B2: 'natural phrasing, nuance, idioms, and media comprehension',
  C1: 'advanced accuracy, debate, professional Spanish, and style',
}

const scenarios = [
  'introductions and personal identity',
  'ordering food and coffee',
  'travel, directions, and transport',
  'daily routine and time expressions',
  'shopping and prices',
  'health, feelings, and needs',
  'work, study, and hobbies',
  'opinions, preferences, and comparisons',
  'storytelling about yesterday and last week',
  'social media, vlog, and TV expressions',
]

export function generateStudyPlan(input: StudyPlanInput): GeneratedStudyDay[] {
  const days = clampDays(input.targetDays)
  const level = input.currentLevel || 'A0'
  const goal = input.goal.trim() || 'Build practical Spanish confidence'
  const focus = focusByLevel[level] ?? focusByLevel.A0

  return Array.from({ length: days }, (_, index) => {
    const day = index + 1
    const scenario = scenarios[index % scenarios.length]

    return {
      day,
      theme: `${goal}: ${scenario}`,
      objective: `At ${level}, practice ${focus} through ${scenario}.`,
      tasks: [
        {
          type: 'vocabulary',
          title: `Learn 8 words for ${scenario}`,
          description: 'Create example sentences, mark hard words, and archive new words to Telegram.',
          estimatedMinutes: 15,
        },
        {
          type: 'grammar',
          title: `Grammar pattern for day ${day}`,
          description: 'Study one useful pattern, rewrite 3 examples, and save mistakes to the mistake book.',
          estimatedMinutes: 20,
        },
        {
          type: 'speaking',
          title: `Speak for 60 seconds about ${scenario}`,
          description: 'Record your answer, compare with the suggested correction, then archive the final version.',
          estimatedMinutes: 15,
        },
      ],
    }
  })
}
