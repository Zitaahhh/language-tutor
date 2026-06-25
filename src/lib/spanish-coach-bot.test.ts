import { describe, expect, it } from 'vitest'
import {
  buildBotMainMenu,
  buildLanguageChangedMessage,
  buildLanguageMenu,
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
  buildStoppedQuizArchiveMessage,
  buildMistakeBookText,
  getNextQuizQuestion,
  buildQuizQuestionMessage,
  buildQuizAnswerKeyboard,
  buildQuizReviewMessage,
  buildQuizReviewKeyboard,
  buildSpeakingModeMenu,
  buildSpeakingPromptMessage,
  buildSpeakingFeedbackMessage,
  evaluateSpokenAttempt,
  findBestSpeakingPromptForTranscript,
  generateSpeakingPromptSet,
  generateGrammarQuestionSet,
  generateTranslationQuestionSet,
  generateReadingQuestionSet,
  generateVocabularyQuestionSet,
  parseSpeakingPromptMessage,
  toSpeakingExerciseInsert,
} from './spanish-coach-bot'

describe('AI Spanish Coach bot flows', () => {
  it('builds the main menu with the requested learning modes and language switch', () => {
    const menu = buildBotMainMenu()
    const englishMenu = buildBotMainMenu('en')
    const languageMenu = buildLanguageMenu()

    expect(menu.text).toContain('AI Spanish Coach')
    expect(menu.buttons.flat().map((button) => button.text)).toEqual([
      '词汇测试',
      '语法测试',
      '句子翻译',
      '口语测试',
      '学习进度',
      '错题本',
      '排行榜',
      '🌐 中文 / English',
    ])
    expect(englishMenu.text).toContain('Choose a practice mode')
    expect(englishMenu.buttons.flat().map((button) => button.text)).toContain('Speaking Test')
    expect(languageMenu.buttons.flat().map((button) => button.callback_data)).toContain('lang:en')
    expect(buildLanguageChangedMessage('en')).toContain('English')
  })

  it('builds vocabulary sub-menu for new, old, and mistake review modes', () => {
    const menu = buildVocabularyModeMenu()
    const englishMenu = buildVocabularyModeMenu('en')

    expect(menu.buttons.flat().map((button) => button.text)).toEqual([
      '学习20个新词汇',
      '复习20个旧词汇',
      '错题复习',
      '返回主菜单',
    ])
    expect(englishMenu.text).toBe('Choose a vocabulary practice type:')
    expect(englishMenu.buttons.flat().map((button) => button.text)).toEqual([
      'Learn 20 New Words',
      'Review 20 Old Words',
      'Review Mistakes',
      'Back to Main Menu',
    ])
  })

  it('generates a 20-word vocabulary set and multiple-choice question', () => {
    const words = generateVocabularySet('new', 'A1')
    const question = buildVocabularyQuestion(words, 0)

    expect(words).toHaveLength(20)
    expect(new Set(words.map((word) => word.spanish)).size).toBe(20)
    expect(question.options).toHaveLength(4)
    expect(question.options).toContain(words[0].meaningZh)
    expect(question.prompt).toContain(words[0].spanish)
  })

  it('excludes previously tested words from a new 20-word vocabulary round', () => {
    const previouslySeen = generateVocabularySet('new', 'A1').slice(0, 20).map((word) => word.spanish)
    const questions = generateVocabularyQuestionSet('new', 'A1', 'zh', previouslySeen)
    const promptedWords = questions.map((question) => question.prompt.split(' ')[0])

    expect(questions).toHaveLength(20)
    expect(new Set(promptedWords).size).toBe(20)
    expect(promptedWords.some((word) => previouslySeen.includes(word))).toBe(false)
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
      interface_language: 'zh',
    })
  })

  it('persists the selected Telegram interface language with learner stats', () => {
    const learner = {
      ...createTelegramLearnerState('43', '@english'),
      interfaceLanguage: 'en' as const,
    }

    expect(toTelegramLearnerUpsert(learner)).toMatchObject({
      telegram_user_id: '43',
      interface_language: 'en',
    })
  })

  it('builds a mistake book summary across quiz types', () => {
    const text = buildMistakeBookText('@zita', { vocabulary: 2, grammar: 4, speaking: 1 })

    expect(text).toContain('当前错题总数：7')
    expect(text).toContain('词汇错题：2')
    expect(text).toContain('语法错题：4')
    expect(text).toContain('口语复习项：1')
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

  it('builds a stop message and archives only wrong answers from an unfinished quiz', () => {
    const session = createQuizSession('telegram-stop-1', 'grammar', generateGrammarQuestionSet('A1'), '语法测试')
    const first = getNextQuizQuestion(session)!
    recordQuizAnswer(session, first.options.find((option) => option !== first.correctAnswer)!)
    const second = getNextQuizQuestion(session)!
    recordQuizAnswer(session, second.correctAnswer)

    const archive = buildStoppedQuizArchiveMessage(session)

    expect(archive.wrongAnswers).toHaveLength(1)
    expect(archive.message).toContain('已停止测试')
    expect(archive.message).toContain('已归档错题：1')
    expect(archive.message).toContain('正确答案')
  })

  it('localizes stopped quiz archive messages in English', () => {
    const session = createQuizSession('telegram-stop-2', 'translation', generateTranslationQuestionSet('es-zh', 'en'), 'Spanish → English')
    const first = getNextQuizQuestion(session)!
    recordQuizAnswer(session, first.options.find((option) => option !== first.correctAnswer)!)

    const archive = buildStoppedQuizArchiveMessage(session, 'en')

    expect(archive.wrongAnswers).toHaveLength(1)
    expect(archive.message).toContain('Test stopped')
    expect(archive.message).toContain('Archived mistakes: 1')
    expect(archive.message).toContain('Correct answer')
  })

  it('applies English to every quiz question, review navigation, and final feedback', () => {
    const grammarQuestions = generateGrammarQuestionSet('A1', 'en')
    const grammarSession = createQuizSession('telegram-en-1', 'grammar', grammarQuestions, 'Grammar Quiz')
    const firstGrammar = getNextQuizQuestion(grammarSession)!
    expect(buildQuizQuestionMessage(grammarSession, firstGrammar, 'en')).toContain('Question 1/20')
    recordQuizAnswer(grammarSession, firstGrammar.options.find((option) => option !== firstGrammar.correctAnswer)!)

    expect(buildQuizQuestionMessage(grammarSession, firstGrammar, 'en')).toContain('Choose the correct answer')
    expect(buildQuizReviewMessage(grammarSession, 0, 'en')).toContain('Correct answer')
    expect(buildQuizReviewMessage(grammarSession, 0, 'en')).toContain('Key point: Location uses estar')
    expect(buildQuizReviewKeyboard(grammarSession, 0, 'en').flat().map((button) => button.text)).toEqual(['Previous', 'Next'])

    const translationSession = createQuizSession('telegram-en-2', 'translation', generateTranslationQuestionSet('es-zh', 'en'), 'Spanish → English')
    const firstTranslation = getNextQuizQuestion(translationSession)!
    recordQuizAnswer(translationSession, firstTranslation.correctAnswer)

    expect(firstTranslation.prompt).toContain('Choose the correct English meaning')
    expect(firstTranslation.correctAnswer).toBe('My trip to Spain was incredible.')
    expect(buildQuizSummary(translationSession, 'en')).toContain('Correct: 1/1')
    expect(buildQuizSummary(translationSession, 'en')).toContain('Results:')
    expect(buildQuizSummary(translationSession, 'en')).not.toMatch(/[\u4e00-\u9fff]/)
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
    const insert = toSpeakingExerciseInsert('telegram-voice-1', prompts[0], feedback)

    expect(menu.buttons.flat().map((button) => button.text)).toEqual(['读句子', '回答问题', '返回主菜单'])
    expect(prompts).toHaveLength(20)
    expect(buildSpeakingPromptMessage(prompts[0], 0, 20)).toContain('请发送语音')
    expect(feedback.score).toBeGreaterThanOrEqual(80)
    expect(feedback.needsReview).toBe(false)
    expect(feedback.recognizedWords).toContain('viaje')
    expect(buildSpeakingFeedbackMessage(prompts[0], feedback, 0, 20)).toContain('口语评分')
    expect(insert).toMatchObject({
      telegram_user_id: 'telegram-voice-1',
      target_sentence_es: prompts[0].targetAnswer,
      transcript: 'Mi viaje a España fue increible',
      score: feedback.score,
    })
  })

  it('marks low-score spoken attempts for review with missing words', () => {
    const [prompt] = generateSpeakingPromptSet('read_sentence', 'A1')
    const feedback = evaluateSpokenAttempt(prompt, 'Mi viaje')

    expect(feedback.needsReview).toBe(true)
    expect(feedback.missingWords.length).toBeGreaterThan(0)
    expect(buildSpeakingFeedbackMessage(prompt, feedback, 0, 20)).toContain('已加入口语复习/错题队列')
  })

  it('parses a replied speaking prompt so voice scoring uses the replied question', () => {
    const prompt = generateSpeakingPromptSet('read_sentence', 'A1')[1]
    const message = buildSpeakingPromptMessage(prompt, 1, 20)
    const parsed = parseSpeakingPromptMessage(message)

    expect(parsed?.index).toBe(1)
    expect(parsed?.total).toBe(20)
    expect(parsed?.prompt.targetAnswer).toBe(prompt.targetAnswer)
    expect(evaluateSpokenAttempt(parsed!.prompt, 'La calle es muy bonita').score).toBeGreaterThanOrEqual(90)
  })

  it('uses a speakable Spanish reference answer for question-answer speaking mode', () => {
    const [prompt] = generateSpeakingPromptSet('answer_question', 'A1')
    const parsed = parseSpeakingPromptMessage(buildSpeakingPromptMessage(prompt, 0, 20))

    expect(prompt.targetAnswer).toContain('significa')
    expect(prompt.targetAnswer).not.toMatch(/[\u4e00-\u9fff]/)
    expect(parsed?.prompt.targetAnswer).toBe(prompt.targetAnswer)
  })

  it('keeps generating speaking prompts after the first 20 exposed items and loops only after all are exhausted', () => {
    const firstRoundPrompts = generateSpeakingPromptSet('read_sentence', 'A1').map((prompt) => prompt.prompt)
    const nextRoundPrompts = generateSpeakingPromptSet('read_sentence', 'A1', 'zh', firstRoundPrompts).map((prompt) => prompt.prompt)
    const exhaustedPrompts: string[] = []

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const round = generateSpeakingPromptSet('read_sentence', 'A1', 'zh', exhaustedPrompts).map((prompt) => prompt.prompt)
      const newlySeen = round.filter((prompt) => !exhaustedPrompts.includes(prompt))
      if (!newlySeen.length) break
      exhaustedPrompts.push(...newlySeen)
    }

    const loopedPrompts = generateSpeakingPromptSet('read_sentence', 'A1', 'zh', exhaustedPrompts)

    expect(firstRoundPrompts).toHaveLength(20)
    expect(nextRoundPrompts).toHaveLength(20)
    expect(nextRoundPrompts[0]).not.toBe(firstRoundPrompts[0])
    expect(nextRoundPrompts.some((prompt) => firstRoundPrompts.includes(prompt))).toBe(false)
    expect(exhaustedPrompts.length).toBeGreaterThan(20)
    expect(loopedPrompts).toHaveLength(20)
  })

  it('matches a transcript back to the closest speaking prompt when serverless state is missing', () => {
    const match = findBestSpeakingPromptForTranscript('Mi viaje a España playing clay play')

    expect(match).not.toBeNull()
    expect(match?.index).toBe(0)
    expect(match?.prompt.targetAnswer).toContain('Mi viaje a España')
  })
})
