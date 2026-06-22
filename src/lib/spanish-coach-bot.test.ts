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
  createQuizSession,
  recordQuizAnswer,
  buildQuizSummary,
  getNextQuizQuestion,
  buildQuizQuestionMessage,
  buildQuizAnswerKeyboard,
  buildQuizReviewMessage,
  buildQuizReviewKeyboard,
  buildSpeakingModeMenu,
  buildSpeakingPromptMessage,
  buildSpeakingFeedbackMessage,
  evaluateSpokenAttempt,
  generateSpeakingPromptSet,
  generateGrammarQuestionSet,
  generateTranslationQuestionSet,
  generateReadingQuestionSet,
  generateVocabularyQuestionSet,
} from './spanish-coach-bot'

describe('AI Spanish Coach bot flows', () => {
  it('builds the main menu with the four requested learning modes', () => {
    const menu = buildBotMainMenu()

    expect(menu.text).toContain('AI Spanish Coach')
    expect(menu.buttons.flat().map((button) => button.text)).toEqual([
      '词汇测试',
      '语法测试',
      '句子翻译',
      '口语测试',
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

  it('runs any quiz type for exactly 20 answers then returns a result summary', () => {
    const session = createQuizSession('telegram-1', 'grammar', Array.from({ length: 20 }, (_, index) => generateGrammarQuestion(index % 2 ? 'A2' : 'A1')))

    for (let index = 0; index < 20; index += 1) {
      const question = getNextQuizQuestion(session)!
      const answer = index % 2 === 0 ? question.correctAnswer : question.options.find((option) => option !== question.correctAnswer)!
      const result = recordQuizAnswer(session, answer)
      expect(result.shouldContinue).toBe(index < 19)
    }

    expect(getNextQuizQuestion(session)).toBeNull()
    expect(session.answers).toHaveLength(20)
    expect(session.correctCount).toBe(10)
    expect(buildQuizSummary(session)).toContain('正确率：50%')
  })

  it('builds 20-question vocabulary and grammar quiz sets with question numbering', () => {
    const vocabQuestions = generateVocabularyQuestionSet('new', 'A1')
    const grammarQuestions = generateGrammarQuestionSet('A1')
    const session = createQuizSession('telegram-2', 'vocabulary', vocabQuestions)

    expect(vocabQuestions).toHaveLength(20)
    expect(grammarQuestions).toHaveLength(20)
    expect(vocabQuestions[0].prompt).not.toMatch(/^1\/20/)
    expect(buildQuizQuestionMessage(session, vocabQuestions[0])).toContain('第 1/20 题')
    expect(buildQuizQuestionMessage(session, vocabQuestions[0])).toContain('词汇测试')
  })

  it('uses compact answer-index callback data for Telegram quiz buttons', () => {
    const session = createQuizSession('123456789', 'vocabulary', generateVocabularyQuestionSet('new', 'A1'))
    const keyboard = buildQuizAnswerKeyboard(session, session.questions[0])

    expect(keyboard).toHaveLength(4)
    expect(keyboard[0][0].callback_data).toMatch(/^quiz-answer:123456789-vocabulary-\d+:0$/)
    expect(Math.max(...keyboard.flat().map((button) => button.callback_data.length))).toBeLessThanOrEqual(64)
  })

  it('builds translation and reading as 20-answerable quiz sets too', () => {
    expect(generateTranslationQuestionSet('zh-es')).toHaveLength(20)
    expect(generateTranslationQuestionSet('es-zh')[0].options).toHaveLength(4)
    expect(generateReadingQuestionSet('A1')).toHaveLength(20)
    expect(generateReadingQuestionSet('A1')[0].correctAnswer).toContain('viaje')
  })

  it('shows answer review with correctness, knowledge point, previous and next controls', () => {
    const session = createQuizSession('telegram-3', 'grammar', generateGrammarQuestionSet('A1'), '语法测试')
    const question = getNextQuizQuestion(session)!
    recordQuizAnswer(session, question.options.find((option) => option !== question.correctAnswer)!)

    const review = buildQuizReviewMessage(session, 0)
    const keyboard = buildQuizReviewKeyboard(session, 0)

    expect(review).toContain('❌')
    expect(review).toContain('正确答案')
    expect(review).toContain('知识点')
    expect(keyboard.flat().map((button) => button.text)).toEqual(['上一题', '下一题'])
  })

  it('builds oral test modes and scores spoken attempts from transcripts', () => {
    const menu = buildSpeakingModeMenu()
    const prompts = generateSpeakingPromptSet('read_sentence', 'A1')
    const feedback = evaluateSpokenAttempt(prompts[0], 'Mi viaje a España fue increible')

    expect(menu.buttons.flat().map((button) => button.text)).toEqual(['读句子', '回答问题', '返回主菜单'])
    expect(prompts).toHaveLength(20)
    expect(buildSpeakingPromptMessage(prompts[0], 0, 20)).toContain('请发送语音')
    expect(feedback.score).toBeGreaterThanOrEqual(80)
    expect(buildSpeakingFeedbackMessage(prompts[0], feedback, 0, 20)).toContain('口语评分')
  })
})
