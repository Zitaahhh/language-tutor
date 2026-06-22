import { describe, expect, it } from 'vitest'
import {
  buildBotMainMenu,
  buildVocabularyModeMenu,
  buildVocabularyQuestion,
  evaluateVocabularyAnswer,
  generateVocabularySet,
  generateGrammarQuestion,
  evaluateTranslation,
  buildReadingPrompt,
  buildLeaderboardText,
  createTelegramLearnerState,
  recordVocabularyAnswer,
  getNextVocabularyQuestion,
  toTelegramLearnerUpsert,
} from './spanish-coach-bot'

describe('AI Spanish Coach bot flows', () => {
  it('builds the main menu with the four requested learning modes', () => {
    const menu = buildBotMainMenu()

    expect(menu.text).toContain('AI Spanish Coach')
    expect(menu.buttons.flat().map((button) => button.text)).toEqual([
      '词汇测试',
      '语法测试',
      '句子翻译',
      '句子朗读',
      '学习进度',
      '错题本',
      '排行榜',
    ])
  })

  it('builds vocabulary sub-menu for new, old, and mistake review modes', () => {
    const menu = buildVocabularyModeMenu()

    expect(menu.buttons.flat().map((button) => button.text)).toEqual([
      '学习20个新词汇',
      '复习20个旧词汇',
      '错题复习',
      '返回主菜单',
    ])
  })

  it('generates a 20-word vocabulary set and multiple-choice question', () => {
    const words = generateVocabularySet('new', 'A1')
    const question = buildVocabularyQuestion(words, 0)

    expect(words).toHaveLength(20)
    expect(question.options).toHaveLength(4)
    expect(question.options).toContain(words[0].meaningZh)
    expect(question.prompt).toContain(words[0].spanish)
  })

  it('evaluates vocabulary answers and marks mistakes for review', () => {
    const words = generateVocabularySet('new', 'A1')
    const question = buildVocabularyQuestion(words, 0)
    const wrongOption = question.options.find((option) => option !== question.correctAnswer)!

    expect(evaluateVocabularyAnswer(question, question.correctAnswer)).toMatchObject({ correct: true, addToMistakes: false })
    expect(evaluateVocabularyAnswer(question, wrongOption)).toMatchObject({ correct: false, addToMistakes: true })
  })

  it('generates grammar questions with four options and an explanation', () => {
    const question = generateGrammarQuestion('A1')

    expect(question.options).toHaveLength(4)
    expect(question.explanation.length).toBeGreaterThan(10)
  })

  it('evaluates translation attempts with correction and score', () => {
    const result = evaluateTranslation('我想要一杯咖啡，不加糖。', 'Quiero un café, no azúcar.')

    expect(result.corrected).toContain('sin azúcar')
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(10)
    expect(result.feedback).toContain('sin azúcar')
  })

  it('builds a reading prompt for sentence朗读 practice', () => {
    const prompt = buildReadingPrompt('A1')

    expect(prompt.sentenceEs.length).toBeGreaterThan(0)
    expect(prompt.sentenceZh.length).toBeGreaterThan(0)
    expect(prompt.instructions).toContain('跟读')
  })

  it('builds per-user progress and continues after wrong vocabulary answers', () => {
    const userA = createTelegramLearnerState('101', 'Ana')
    const userB = createTelegramLearnerState('202', 'Bao')
    const words = generateVocabularySet('new', 'A1')
    const first = getNextVocabularyQuestion(userA, words)
    const wrong = first.options.find((option) => option !== first.correctAnswer)!

    const result = recordVocabularyAnswer(userA, first, wrong)
    const second = getNextVocabularyQuestion(userA, words)

    expect(result.correct).toBe(false)
    expect(result.nextQuestion).toBe(true)
    expect(userA.wrongVocabularyCount).toBe(1)
    expect(userA.currentQuestionIndex).toBe(1)
    expect(second.prompt).toContain('2/20')
    expect(userB.currentQuestionIndex).toBe(0)
    expect(userB.wrongVocabularyCount).toBe(0)
  })

  it('builds leaderboard sorted by learned words, mistakes, and check-in days', () => {
    const learners = [
      { ...createTelegramLearnerState('1', 'A'), learnedVocabularyCount: 10, wrongVocabularyCount: 3, checkInDays: 2 },
      { ...createTelegramLearnerState('2', 'B'), learnedVocabularyCount: 20, wrongVocabularyCount: 1, checkInDays: 5 },
    ]

    const text = buildLeaderboardText(learners)

    expect(text).toContain('排行榜')
    expect(text.indexOf('B')).toBeLessThan(text.indexOf('A'))
    expect(text).toContain('学会 20')
    expect(text).toContain('错题 1')
    expect(text).toContain('打卡 5 天')
  })

  it('builds Supabase upsert payload for persistent Telegram learner stats', () => {
    const learner = {
      ...createTelegramLearnerState('42', '@zita'),
      learnedVocabularyCount: 8,
      wrongVocabularyCount: 2,
      checkInDays: 3,
      lastCheckInDate: '2026-06-22',
    }

    expect(toTelegramLearnerUpsert(learner)).toEqual({
      telegram_user_id: '42',
      display_name: '@zita',
      learned_vocabulary_count: 8,
      wrong_vocabulary_count: 2,
      check_in_days: 3,
      last_check_in_date: '2026-06-22',
    })
  })
})
