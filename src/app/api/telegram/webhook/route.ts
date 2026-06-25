import { NextResponse } from 'next/server'
import {
  buildBotMainMenu,
  buildLanguageChangedMessage,
  buildLanguageMenu,
  buildTranslationMenu,
  buildVocabularyModeMenu,
  buildLeaderboardText,
  buildQuizQuestionMessage,
  buildQuizAnswerKeyboard,
  buildQuizReviewKeyboard,
  buildQuizReviewMessage,
  buildQuizSummary,
  buildStoppedQuizArchiveMessage,
  buildMistakeBookText,
  buildSpeakingFeedbackMessage,
  buildSpeakingModeMenu,
  buildSpeakingPromptMessage,
  callbackKeyboard,
  createQuizSession,
  createTelegramLearnerState,
  evaluateSpokenAttempt,
  findBestSpeakingPromptForTranscript,
  generateGrammarQuestion,
  generateGrammarQuestionSet,
  generateSpeakingPromptSet,
  generateTranslationQuestionSet,
  generateVocabularyQuestionSet,
  generateVocabularySet,
  getNextVocabularyQuestion,
  getNextQuizQuestion,
  parseSpeakingPromptMessage,
  recordCheckIn,
  recordQuizAnswer,
  recordVocabularyAnswer,
  toTelegramLearnerUpsert,
  toSpeakingExerciseInsert,
  type QuizSession,
  type InterfaceLanguage,
  type SpeakingExerciseInsert,
  type SpeakingMode,
  type SpeakingPrompt,
  type TelegramLearnerState,
  type VocabMode,
  type VocabularyQuestion,
} from '@/lib/spanish-coach-bot'

type TelegramMessage = {
  chat?: { id: number | string; type?: string }
  message_id?: number
  text?: string
  voice?: { file_id: string }
  reply_to_message?: TelegramMessage
  from?: { id?: number; username?: string; first_name?: string }
}

type TelegramCallbackQuery = {
  id: string
  data?: string
  message?: TelegramMessage
  from?: { id?: number; username?: string; first_name?: string }
}

type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

const questionCache = new Map<string, VocabularyQuestion>()
const learnerStates = new Map<string, TelegramLearnerState>()
const learnerWordSets = new Map<string, ReturnType<typeof generateVocabularySet>>()
const learnerLanguages = new Map<string, InterfaceLanguage>()
const quizSessions = new Map<string, QuizSession>()
const speakingSessions = new Map<string, { prompts: SpeakingPrompt[]; currentIndex: number; scores: number[]; mode: SpeakingMode; lastMessageId?: number }>()
const learnerLanguageLoadPromises = new Map<string, Promise<InterfaceLanguage | null>>()

const fallbackSpeakingPrompt: SpeakingPrompt = {
  mode: 'read_sentence',
  prompt: '请朗读 Day 1 句子：\nHola, me llamo Zita. Mucho gusto.\n你好，我叫 Zita。很高兴认识你。',
  targetAnswer: 'Hola, me llamo Zita. Mucho gusto.',
  guide: '注意 Hola 的 h 不发音；llamo 的 ll 按拉美通用音接近 y/ʝ；每个元音 a/e/i/o/u 要清楚。',
}

type PersistentSpeakingSession = {
  id: string
  mode: SpeakingMode
  total_questions: number
  correct_count: number
  status: string
}

function getLearner(from?: { id?: number; username?: string; first_name?: string }) {
  const telegramUserId = String(from?.id ?? 'anonymous')
  const displayName = from?.username ? `@${from.username}` : from?.first_name || telegramUserId
  let state = learnerStates.get(telegramUserId)
  if (!state) {
    state = createTelegramLearnerState(telegramUserId, displayName)
    learnerStates.set(telegramUserId, state)
  }
  state.displayName = displayName
  recordCheckIn(state)
  return state
}

function getLearnerLanguage(telegramUserId: string): InterfaceLanguage {
  return learnerStates.get(telegramUserId)?.interfaceLanguage ?? learnerLanguages.get(telegramUserId) ?? 'zh'
}

function setLearnerLanguage(telegramUserId: string, language: InterfaceLanguage, persist = true) {
  learnerLanguages.set(telegramUserId, language)
  const state = learnerStates.get(telegramUserId)
  if (state) {
    state.interfaceLanguage = language
    if (persist) void persistLearner(state)
  }
}

async function loadLearnerLanguage(telegramUserId: string) {
  if (learnerLanguages.has(telegramUserId)) return learnerLanguages.get(telegramUserId) ?? null
  let promise = learnerLanguageLoadPromises.get(telegramUserId)
  if (!promise) {
    promise = loadLearnerLanguageFromSupabase(telegramUserId).finally(() => learnerLanguageLoadPromises.delete(telegramUserId))
    learnerLanguageLoadPromises.set(telegramUserId, promise)
  }
  const language = await promise
  if (language) setLearnerLanguage(telegramUserId, language, false)
  return language
}

function getMainMenuForLearner(telegramUserId: string) {
  return buildBotMainMenu(getLearnerLanguage(telegramUserId))
}

function telegramApiUrl(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
  return `https://api.telegram.org/bot${token}/${method}`
}

async function callTelegram(method: string, body: Record<string, unknown>) {
  const response = await fetch(telegramApiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.json().catch(() => null)
}

function toInlineKeyboard(buttons: { text: string; callback_data: string }[][]) {
  return { inline_keyboard: buttons }
}

function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

async function persistLearner(learner: TelegramLearnerState) {
  const cfg = createServiceSupabase()
  if (!cfg) return
  await fetch(`${cfg.url}/rest/v1/telegram_learners`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(toTelegramLearnerUpsert(learner)),
  }).catch(() => null)
}

async function loadLearnerLanguageFromSupabase(telegramUserId: string) {
  const cfg = createServiceSupabase()
  if (!cfg) return null
  const response = await fetch(`${cfg.url}/rest/v1/telegram_learners?select=interface_language&telegram_user_id=eq.${encodeURIComponent(telegramUserId)}&limit=1`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  }).catch(() => null)
  if (!response?.ok) return null
  const rows = (await response.json().catch(() => [])) as Array<{ interface_language?: string }>
  return rows[0]?.interface_language === 'en' ? 'en' : rows[0]?.interface_language === 'zh' ? 'zh' : null
}

async function persistSpeakingExercise(exercise: SpeakingExerciseInsert) {
  const cfg = createServiceSupabase()
  if (!cfg) return
  await fetch(`${cfg.url}/rest/v1/speaking_exercises`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(exercise),
  }).catch(() => null)
}

async function persistSpeakingPromptExposure(telegramUserId: string, prompts: SpeakingPrompt[]) {
  if (!prompts.length) return
  const session = createQuizSession(
    telegramUserId,
    'reading',
    prompts.map((prompt) => ({
      prompt: prompt.prompt,
      options: [prompt.targetAnswer],
      correctAnswer: prompt.targetAnswer,
      explanation: prompt.guide,
    })),
    'Speaking exposure',
  )
  void persistQuizExposure(session)
}

async function createPersistentSpeakingSession(telegramUserId: string, mode: SpeakingMode, totalQuestions = 20) {
  const cfg = createServiceSupabase()
  if (!cfg) return null
  const response = await fetch(`${cfg.url}/rest/v1/quiz_sessions?select=id,mode,total_questions,correct_count,status`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
      quiz_type: 'speaking',
      mode,
      total_questions: totalQuestions,
      correct_count: 0,
      status: 'active',
    }),
  }).catch(() => null)
  if (!response?.ok) return null
  const rows = (await response.json().catch(() => [])) as PersistentSpeakingSession[]
  return rows[0] ?? null
}

async function loadPersistentSpeakingSession(telegramUserId: string) {
  const cfg = createServiceSupabase()
  if (!cfg) return null
  const response = await fetch(
    `${cfg.url}/rest/v1/quiz_sessions?select=id,mode,total_questions,correct_count,status&telegram_user_id=eq.${encodeURIComponent(telegramUserId)}&quiz_type=eq.speaking&status=eq.active&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  if (!response?.ok) return null
  const rows = (await response.json().catch(() => [])) as PersistentSpeakingSession[]
  return rows[0] ?? null
}

async function updatePersistentSpeakingSession(sessionId: string, correctCount: number, completed: boolean) {
  const cfg = createServiceSupabase()
  if (!cfg) return
  await fetch(`${cfg.url}/rest/v1/quiz_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      correct_count: correctCount,
      status: completed ? 'completed' : 'active',
      completed_at: completed ? new Date().toISOString() : null,
    }),
  }).catch(() => null)
}

async function persistSpeakingAnswer(sessionId: string, prompt: SpeakingPrompt, feedback: ReturnType<typeof evaluateSpokenAttempt>) {
  const cfg = createServiceSupabase()
  if (!cfg) return
  await fetch(`${cfg.url}/rest/v1/quiz_answers`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quiz_session_id: sessionId,
      prompt: prompt.prompt,
      selected_answer: feedback.transcript,
      correct_answer: prompt.targetAnswer,
      correct: feedback.score >= 80,
      explanation: feedback.guidance,
    }),
  }).catch(() => null)
}

async function loadLeaderboardFromSupabase() {
  const cfg = createServiceSupabase()
  if (!cfg) return [...learnerStates.values()]
  const response = await fetch(`${cfg.url}/rest/v1/telegram_learners?select=telegram_user_id,display_name,interface_language,learned_vocabulary_count,wrong_vocabulary_count,check_in_days,last_check_in_date&order=learned_vocabulary_count.desc,wrong_vocabulary_count.asc,check_in_days.desc&limit=20`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  }).catch(() => null)
  if (!response?.ok) return [...learnerStates.values()]
  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>
  return rows.map((row): TelegramLearnerState => ({
    telegramUserId: String(row.telegram_user_id ?? ''),
    displayName: String(row.display_name ?? row.telegram_user_id ?? ''),
    interfaceLanguage: row.interface_language === 'en' ? 'en' : 'zh',
    learnedVocabularyCount: Number(row.learned_vocabulary_count ?? 0),
    wrongVocabularyCount: Number(row.wrong_vocabulary_count ?? 0),
    checkInDays: Number(row.check_in_days ?? 0),
    currentQuestionIndex: 0,
    lastCheckInDate: row.last_check_in_date ? String(row.last_check_in_date) : undefined,
  }))
}

async function loadMistakeStatsFromSupabase(telegramUserId: string) {
  const fallback = learnerStates.get(telegramUserId)
  const cfg = createServiceSupabase()
  if (!cfg) return { vocabulary: fallback?.wrongVocabularyCount ?? 0 }

  const sessionsUrl = `${cfg.url}/rest/v1/quiz_sessions?select=id,quiz_type&telegram_user_id=eq.${encodeURIComponent(telegramUserId)}`
  const sessionsResponse = await fetch(sessionsUrl, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  }).catch(() => null)

  const stats = { vocabulary: fallback?.wrongVocabularyCount ?? 0, grammar: 0, translation: 0, reading: 0, speaking: 0 }
  if (!sessionsResponse?.ok) return stats

  const sessions = (await sessionsResponse.json().catch(() => [])) as Array<{ id?: string; quiz_type?: string }>
  if (!sessions.length) return stats

  const sessionTypeById = new Map(sessions.filter((session) => session.id).map((session) => [session.id as string, String(session.quiz_type ?? '')]))
  const ids = [...sessionTypeById.keys()]
  const answersUrl = `${cfg.url}/rest/v1/quiz_answers?select=quiz_session_id&correct=eq.false&quiz_session_id=in.(${ids.join(',')})`
  const answersResponse = await fetch(answersUrl, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  }).catch(() => null)

  if (answersResponse?.ok) {
    const answers = (await answersResponse.json().catch(() => [])) as Array<{ quiz_session_id?: string }>
    const countedVocabulary = answers.some((answer) => sessionTypeById.get(String(answer.quiz_session_id)) === 'vocabulary')
    stats.vocabulary = countedVocabulary ? 0 : stats.vocabulary
    for (const answer of answers) {
      const quizType = sessionTypeById.get(String(answer.quiz_session_id))
      if (quizType === 'vocabulary') stats.vocabulary += 1
      else if (quizType === 'grammar') stats.grammar += 1
      else if (quizType === 'translation') stats.translation += 1
      else if (quizType === 'reading') stats.reading += 1
    }
  }

  const speakingSessionIds = ids.filter((id) => sessionTypeById.get(id) === 'speaking')
  if (speakingSessionIds.length) {
    const speakingUrl = `${cfg.url}/rest/v1/quiz_answers?select=id&correct=eq.false&quiz_session_id=in.(${speakingSessionIds.join(',')})`
    const speakingResponse = await fetch(speakingUrl, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    }).catch(() => null)
    if (speakingResponse?.ok) {
      const speakingAnswers = (await speakingResponse.json().catch(() => [])) as unknown[]
      stats.speaking = speakingAnswers.length
    }
  }

  return stats
}

async function loadSeenVocabularyFromSupabase(telegramUserId: string) {
  const cfg = createServiceSupabase()
  if (!cfg) return []
  const response = await fetch(
    `${cfg.url}/rest/v1/user_vocabulary_progress?select=vocabulary_items(spanish)&telegram_user_id=eq.${encodeURIComponent(telegramUserId)}&last_seen_at=not.is.null&limit=1000`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  if (!response?.ok) return []
  const rows = (await response.json().catch(() => [])) as Array<{ vocabulary_items?: { spanish?: string } | { spanish?: string }[] }>
  return rows
    .map((row) => Array.isArray(row.vocabulary_items) ? row.vocabulary_items[0]?.spanish : row.vocabulary_items?.spanish)
    .filter((word): word is string => typeof word === 'string' && word.length > 0)
}


async function loadSeenQuizPromptsFromSupabase(telegramUserId: string, quizType: QuizSession['quizType']) {
  const cfg = createServiceSupabase()
  if (!cfg) return []
  const sessionsResponse = await fetch(
    `${cfg.url}/rest/v1/quiz_sessions?select=id&telegram_user_id=eq.${encodeURIComponent(telegramUserId)}&quiz_type=eq.${quizType}&limit=1000`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  if (!sessionsResponse?.ok) return []
  const sessions = (await sessionsResponse.json().catch(() => [])) as Array<{ id?: string }>
  const ids = sessions.map((session) => session.id).filter((id): id is string => Boolean(id))
  if (!ids.length) return []
  const answersResponse = await fetch(
    `${cfg.url}/rest/v1/quiz_answers?select=prompt&quiz_session_id=in.(${ids.join(',')})&limit=2000`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  if (!answersResponse?.ok) return []
  const answers = (await answersResponse.json().catch(() => [])) as Array<{ prompt?: string }>
  return [...new Set(answers.map((answer) => answer.prompt).filter((prompt): prompt is string => typeof prompt === 'string' && prompt.length > 0))]
}

async function persistVocabularyProgress(session: QuizSession) {
  if (session.quizType !== 'vocabulary' || !session.answers.length) return
  const cfg = createServiceSupabase()
  if (!cfg) return

  const words = [...new Set(session.questions.map((question) => question.vocabularySpanish).filter((word): word is string => Boolean(word)))]
  if (!words.length) return

  const vocabularyRows = session.questions
    .filter((question) => question.vocabularySpanish)
    .map((question) => ({
      spanish: question.vocabularySpanish!,
      meaning_zh: question.vocabularyMeaningZh ?? question.correctAnswer,
      example_es: question.vocabularyExampleEs ?? '',
      example_zh: question.vocabularyExampleZh ?? '',
      level: question.vocabularyLevel ?? 'A1',
    }))

  await fetch(`${cfg.url}/rest/v1/vocabulary_items?on_conflict=spanish`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(vocabularyRows),
  }).catch(() => null)

  const quotedWords = words.map((word) => `"${word.replace(/"/g, '\\"')}"`).join(',')
  const itemsResponse = await fetch(
    `${cfg.url}/rest/v1/vocabulary_items?select=id,spanish&spanish=in.(${encodeURIComponent(quotedWords)})`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  if (!itemsResponse?.ok) return
  const items = (await itemsResponse.json().catch(() => [])) as Array<{ id: string; spanish: string }>
  const itemIdBySpanish = new Map(items.map((item) => [item.spanish, item.id]))
  const now = new Date().toISOString()
  const progressRows = session.answers
    .map((answer, index) => {
      const spanish = session.questions[index]?.vocabularySpanish
      const itemId = spanish ? itemIdBySpanish.get(spanish) : null
      if (!itemId) return null
      return {
        telegram_user_id: session.telegramUserId,
        vocabulary_item_id: itemId,
        status: answer.correct ? 'learned' : 'mistake',
        correct_count: answer.correct ? 1 : 0,
        wrong_count: answer.correct ? 0 : 1,
        last_seen_at: now,
        next_review_at: answer.correct
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (!progressRows.length) return
  await fetch(`${cfg.url}/rest/v1/user_vocabulary_progress`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(progressRows),
  }).catch(() => null)
}


async function persistVocabularyExposure(session: QuizSession) {
  if (session.quizType !== 'vocabulary' || !session.questions.length) return
  const cfg = createServiceSupabase()
  if (!cfg) return

  const vocabularyRows = session.questions
    .filter((question) => question.vocabularySpanish)
    .map((question) => ({
      spanish: question.vocabularySpanish!,
      meaning_zh: question.vocabularyMeaningZh ?? question.correctAnswer,
      example_es: question.vocabularyExampleEs ?? '',
      example_zh: question.vocabularyExampleZh ?? '',
      level: question.vocabularyLevel ?? 'A1',
    }))
  const words = [...new Set(vocabularyRows.map((row) => row.spanish))]
  if (!words.length) return

  await fetch(`${cfg.url}/rest/v1/vocabulary_items?on_conflict=spanish`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(vocabularyRows),
  }).catch(() => null)

  const quotedWords = words.map((word) => `"${word.replace(/"/g, '\\"')}"`).join(',')
  const itemsResponse = await fetch(
    `${cfg.url}/rest/v1/vocabulary_items?select=id,spanish&spanish=in.(${encodeURIComponent(quotedWords)})`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  if (!itemsResponse?.ok) return

  const items = (await itemsResponse.json().catch(() => [])) as Array<{ id: string; spanish: string }>
  const itemIds = items.map((item) => item.id)
  if (!itemIds.length) return

  const existingResponse = await fetch(
    `${cfg.url}/rest/v1/user_vocabulary_progress?select=vocabulary_item_id&telegram_user_id=eq.${encodeURIComponent(session.telegramUserId)}&vocabulary_item_id=in.(${itemIds.join(',')})`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  ).catch(() => null)
  const existingRows = existingResponse?.ok
    ? ((await existingResponse.json().catch(() => [])) as Array<{ vocabulary_item_id?: string }>)
    : []
  const existingIds = new Set(existingRows.map((row) => row.vocabulary_item_id).filter(Boolean))

  const now = new Date().toISOString()
  const progressRows = items
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({
      telegram_user_id: session.telegramUserId,
      vocabulary_item_id: item.id,
      status: 'seen',
      correct_count: 0,
      wrong_count: 0,
      last_seen_at: now,
      next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }))

  if (!progressRows.length) return
  await fetch(`${cfg.url}/rest/v1/user_vocabulary_progress`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(progressRows),
  }).catch(() => null)
}

async function persistQuizExposure(session: QuizSession) {
  if (!session.questions.length) return
  const cfg = createServiceSupabase()
  if (!cfg) return
  const response = await fetch(`${cfg.url}/rest/v1/quiz_sessions?select=id`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      telegram_user_id: session.telegramUserId,
      quiz_type: session.quizType,
      total_questions: session.questions.length,
      correct_count: 0,
      status: 'started',
    }),
  }).catch(() => null)
  if (!response?.ok) return
  const rows = (await response.json().catch(() => [])) as Array<{ id?: string }>
  const sessionId = rows[0]?.id
  if (!sessionId) return
  await fetch(`${cfg.url}/rest/v1/quiz_answers`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(session.questions.map((question) => ({
      quiz_session_id: sessionId,
      prompt: question.prompt,
      selected_answer: null,
      correct_answer: question.correctAnswer,
      correct: true,
      explanation: question.explanation ? `曝光记录/Exposure: ${question.explanation}` : '曝光记录/Exposure',
    }))),
  }).catch(() => null)
}

async function persistCompletedQuizSession(session: QuizSession, status: 'completed' | 'stopped' = 'completed') {
  const cfg = createServiceSupabase()
  if (!cfg) return
  const response = await fetch(`${cfg.url}/rest/v1/quiz_sessions?select=id`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      telegram_user_id: session.telegramUserId,
      quiz_type: session.quizType,
      total_questions: session.answers.length,
      correct_count: session.correctCount,
      status,
      completed_at: new Date().toISOString(),
    }),
  }).catch(() => null)
  if (!response?.ok) return
  const rows = (await response.json().catch(() => [])) as Array<{ id?: string }>
  const sessionId = rows[0]?.id
  if (!sessionId) return
  await fetch(`${cfg.url}/rest/v1/quiz_answers`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(session.answers.map((answer) => ({
      quiz_session_id: sessionId,
      prompt: answer.prompt,
      selected_answer: answer.selectedAnswer,
      correct_answer: answer.correctAnswer,
      correct: answer.correct,
      explanation: answer.explanation,
    }))),
  }).catch(() => null)
  await persistVocabularyProgress(session)
}

async function sendMenu(chatId: number | string, menu: { text: string; buttons: { text: string; callback_data: string }[][] }) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: menu.text,
    reply_markup: toInlineKeyboard(menu.buttons),
  })
}

async function sendQuizQuestion(chatId: number | string, session: QuizSession) {
  const question = getNextQuizQuestion(session)
  if (!question) return null
  const language = getLearnerLanguage(session.telegramUserId)
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: buildQuizQuestionMessage(session, question, language),
    reply_markup: toInlineKeyboard(buildQuizAnswerKeyboard(session, question)),
  })
}

async function editQuizQuestion(chatId: number | string, messageId: number | undefined, session: QuizSession) {
  const question = getNextQuizQuestion(session)
  if (!question || !messageId) return null
  const language = getLearnerLanguage(session.telegramUserId)
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: buildQuizQuestionMessage(session, question, language),
    reply_markup: toInlineKeyboard(buildQuizAnswerKeyboard(session, question)),
  })
}

async function startQuiz(chatId: number | string, session: QuizSession) {
  quizSessions.set(session.id, session)
  return sendQuizQuestion(chatId, session)
}

async function stopActiveTests(chatId: number | string, telegramUserId: string, language: InterfaceLanguage) {
  const activeQuiz = [...quizSessions.values()].find((session) => session.telegramUserId === telegramUserId)
  const activeSpeaking = speakingSessions.get(telegramUserId)

  if (!activeQuiz && !activeSpeaking) {
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: language === 'en' ? 'No active test to stop.' : '当前没有正在进行的测试。',
    })
  }

  if (activeQuiz) {
    const archive = buildStoppedQuizArchiveMessage(activeQuiz, language)
    quizSessions.delete(activeQuiz.id)
    void persistCompletedQuizSession(activeQuiz, 'stopped')
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: archive.message,
    })
  }

  speakingSessions.delete(telegramUserId)
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: language === 'en' ? 'Speaking test stopped. Speaking mistakes already recorded during scoring.' : '已停止口语测试。口语错题会在评分时自动归档。',
  })
}

async function sendSpeakingPrompt(chatId: number | string, learnerId: string) {
  const session = speakingSessions.get(learnerId)
  const language = getLearnerLanguage(learnerId)
  if (!session) return null
  const prompt = session.prompts[session.currentIndex]
  if (!prompt) {
    const total = session.scores.length
    const average = total ? Math.round(session.scores.reduce((sum, score) => sum + score, 0) / total) : 0
    speakingSessions.delete(learnerId)
    return callTelegram('sendMessage', { chat_id: chatId, text: language === 'en' ? `🎉 Speaking test completed\nCompleted: ${total}/20\nAverage score: ${average}/100` : `🎉 口语测试完成\n完成：${total}/20\n平均分：${average}/100` })
  }
  const response = await callTelegram('sendMessage', {
    chat_id: chatId,
    text: buildSpeakingPromptMessage(prompt, session.currentIndex, session.prompts.length, language),
  })
  const messageId = typeof response?.result?.message_id === 'number' ? response.result.message_id : undefined
  if (messageId) session.lastMessageId = messageId
  return response
}

async function transcribeTelegramVoice(fileId: string, language?: string) {
  const provider = process.env.GROQ_API_KEY ? 'groq' : process.env.OPENAI_API_KEY ? 'openai' : null
  if (!provider) return ''
  const fileInfo = await callTelegram('getFile', { file_id: fileId })
  const filePath = fileInfo?.result?.file_path
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!filePath || !token) return ''
  const audio = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`).then((response) => response.blob()).catch(() => null)
  if (!audio) return ''
  const form = new FormData()
  form.append('model', provider === 'groq' ? 'whisper-large-v3-turbo' : 'whisper-1')
  if (language) form.append('language', language)
  form.append('file', audio, 'voice.ogg')
  const response = await fetch(
    provider === 'groq' ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY}` },
      body: form,
    },
  ).catch(() => null)
  if (!response?.ok) return ''
  const data = await response.json().catch(() => null)
  return typeof data?.text === 'string' ? data.text : ''
}

async function translateTranscriptToSpanish(transcript: string) {
  const cleaned = transcript.trim()
  if (!cleaned) return ''
  const openAiKey = process.env.OPENAI_API_KEY
  if (!openAiKey) return cleaned

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Translate the user utterance into natural beginner-friendly Spanish. Return only the Spanish translation, no quotes, no explanation.',
        },
        { role: 'user', content: cleaned },
      ],
    }),
  }).catch(() => null)
  if (!response?.ok) return cleaned
  const data = await response.json().catch(() => null)
  const translated = data?.choices?.[0]?.message?.content
  return typeof translated === 'string' && translated.trim() ? translated.trim() : cleaned
}

async function sendPronunciationAudio(chatId: number | string, text: string) {
  const openAiKey = process.env.OPENAI_API_KEY
  if (openAiKey) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1', voice: 'nova', input: text, response_format: 'mp3' }),
    }).catch(() => null)
    if (response?.ok) {
      const audio = await response.blob()
      const form = new FormData()
      form.append('chat_id', String(chatId))
      form.append('caption', `正确读音：${text}`)
      form.append('audio', audio, 'spanish-pronunciation.mp3')
      const telegramResponse = await fetch(telegramApiUrl('sendAudio'), { method: 'POST', body: form }).catch(() => null)
      if (telegramResponse?.ok) return telegramResponse.json().catch(() => null)
    }
  }

  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`
  const response = await callTelegram('sendAudio', {
    chat_id: chatId,
    audio: ttsUrl,
    caption: `正确读音：${text}`,
  })
  if (response?.ok) return response
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: `正确读音参考：${text}\n请注意：Hola 的 h 不发音；me llamo 中 ll 接近 y/ʝ；Mucho gusto 每个元音要清楚。`,
  })
}

async function answerCallback(callbackId: string) {
  return callTelegram('answerCallbackQuery', { callback_query_id: callbackId })
}

function isGroupMessage(message: TelegramMessage) {
  return message.chat?.type === 'group' || message.chat?.type === 'supergroup'
}

function mentionsBot(text = '') {
  return /@aispanishcoachbot\b/i.test(text)
}

async function handleTextMessage(message: TelegramMessage) {
  const chatId = message.chat?.id
  if (!chatId) return
  const text = message.text ?? ''
  const learner = getLearner(message.from)
  await loadLearnerLanguage(learner.telegramUserId)
  void persistLearner(learner)

  if (message.voice) {
    let session = speakingSessions.get(learner.telegramUserId)
    let persistentSession: PersistentSpeakingSession | null = null
    if (!session) {
      persistentSession = await loadPersistentSpeakingSession(learner.telegramUserId)
      if (persistentSession) {
        const mode = persistentSession.mode === 'answer_question' ? 'answer_question' : 'read_sentence'
        const prompts = generateSpeakingPromptSet(mode, 'A1', getLearnerLanguage(learner.telegramUserId))
        session = {
          prompts,
          currentIndex: Math.min(Number(persistentSession.correct_count ?? 0), prompts.length - 1),
          scores: [],
          mode,
        }
        speakingSessions.set(learner.telegramUserId, session)
      }
    } else {
      persistentSession = await loadPersistentSpeakingSession(learner.telegramUserId)
    }
    const repliedPrompt = message.reply_to_message?.text
      ? parseSpeakingPromptMessage(message.reply_to_message.text, getLearnerLanguage(learner.telegramUserId))
      : null
    const activePrompt = repliedPrompt?.prompt ?? session?.prompts[session.currentIndex]
    const transcript = await transcribeTelegramVoice(message.voice.file_id, activePrompt ? 'es' : undefined)
    const fallbackMatch = activePrompt ? null : findBestSpeakingPromptForTranscript(transcript, session?.prompts)

    if (!activePrompt && !fallbackMatch) {
      const translated = await translateTranscriptToSpanish(transcript)
      const translationPrompt: SpeakingPrompt = {
        mode: 'answer_question',
        prompt: getLearnerLanguage(learner.telegramUserId) === 'en' ? `Free voice translation: ${transcript}` : `自由语音翻译：${transcript}`,
        targetAnswer: translated,
        guide: getLearnerLanguage(learner.telegramUserId) === 'en' ? 'This is free voice translation, not a scored speaking-test item. Repeat the Spanish translation and keep vowels clear.' : '这是自由语音翻译，不按口语测试题评分；请跟读西语译文，注意元音清晰。',
      }
      void persistSpeakingExercise({
        telegram_user_id: learner.telegramUserId,
        target_sentence_es: translated,
        target_sentence_zh: transcript,
        transcript,
        feedback: getLearnerLanguage(learner.telegramUserId) === 'en' ? `Free voice translation: ${translated}` : `自由语音翻译：${translated}`,
        score: 0,
      })
      const freeVoiceLanguage = getLearnerLanguage(learner.telegramUserId)
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: freeVoiceLanguage === 'en'
          ? [
              'No active speaking test was detected, and I could not match this voice message to a question.',
              'I treated it as free speaking practice:',
              '',
              `Transcript: ${transcript || 'No clear speech recognized'}`,
              `Spanish: ${translated || 'Could not translate it yet. Please send a clearer voice message.'}`,
            ].join('\n')
          : [
              '没有检测到正在进行的口语测试，也没有匹配到相近题目。',
              '我把这条语音当作自由表达来处理：',
              '',
              `识别内容：${transcript || '未识别到清晰内容'}`,
              `西班牙语：${translated || '暂时无法翻译，请再发一次更清楚的语音。'}`,
            ].join('\n'),
      })
      if (translated) await sendPronunciationAudio(chatId, translationPrompt.targetAnswer)
      return
    }

    const prompt = activePrompt ?? fallbackMatch?.prompt ?? fallbackSpeakingPrompt
    const feedback = evaluateSpokenAttempt(prompt, transcript, getLearnerLanguage(learner.telegramUserId))
    session?.scores.push(feedback.score)
    void persistSpeakingExercise(toSpeakingExerciseInsert(learner.telegramUserId, prompt, feedback))
    if (persistentSession?.id) void persistSpeakingAnswer(persistentSession.id, prompt, feedback)
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: [
        activePrompt
          ? ''
          : fallbackMatch
            ? getLearnerLanguage(learner.telegramUserId) === 'en'
              ? `No active speaking test was detected; I matched your voice to question ${fallbackMatch.index + 1} for correction:`
              : `没有检测到正在进行的口语测试；我根据你的语音自动匹配到第 ${fallbackMatch.index + 1} 题来纠正：`
            : getLearnerLanguage(learner.telegramUserId) === 'en'
              ? 'No active speaking test was detected and no similar question was matched; I corrected it using the default Day 1 sentence:'
              : '没有检测到正在进行的口语测试，也没有匹配到相近题目；我先按 Day 1 默认句子给你纠正：',
        buildSpeakingFeedbackMessage(prompt, feedback, repliedPrompt?.index ?? (activePrompt ? session?.currentIndex ?? 0 : fallbackMatch?.index ?? 0), repliedPrompt?.total ?? session?.prompts.length ?? 1, getLearnerLanguage(learner.telegramUserId)),
      ].filter((line) => line.length > 0).join('\n\n'),
    })
    await sendPronunciationAudio(chatId, prompt.targetAnswer)
    if (session && activePrompt && !repliedPrompt) {
      session.currentIndex += 1
      const completed = session.currentIndex >= session.prompts.length
      if (persistentSession?.id) void updatePersistentSpeakingSession(persistentSession.id, session.currentIndex, completed)
      await sendSpeakingPrompt(chatId, learner.telegramUserId)
    }
    return
  }

  if (isGroupMessage(message) && !mentionsBot(text) && !text.startsWith('/')) {
    return
  }

  if (text.startsWith('/start') || mentionsBot(text)) {
    await sendMenu(chatId, getMainMenuForLearner(learner.telegramUserId))
    return
  }

  if (text.startsWith('/stop')) {
    await stopActiveTests(chatId, learner.telegramUserId, getLearnerLanguage(learner.telegramUserId))
    return
  }

  if (text.startsWith('/vocab')) {
    await sendMenu(chatId, buildVocabularyModeMenu(getLearnerLanguage(learner.telegramUserId)))
    return
  }

  if (text.startsWith('/grammar')) {
    const lang = getLearnerLanguage(learner.telegramUserId)
    const seenPrompts = await loadSeenQuizPromptsFromSupabase(learner.telegramUserId, 'grammar')
    const session = createQuizSession(learner.telegramUserId, 'grammar', generateGrammarQuestionSet('A1', lang, seenPrompts), lang === 'en' ? 'Grammar Quiz' : '语法测试')
    void persistQuizExposure(session)
    await startQuiz(chatId, session)
    return
  }

  if (text.startsWith('/translate')) {
    await sendMenu(chatId, buildTranslationMenu(getLearnerLanguage(learner.telegramUserId)))
    return
  }

  if (text.startsWith('/speak')) {
    await sendMenu(chatId, buildSpeakingModeMenu(getLearnerLanguage(learner.telegramUserId)))
    return
  }

  await sendMenu(chatId, getMainMenuForLearner(learner.telegramUserId))
}

async function handleCallback(callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat?.id
  if (!chatId || !callback.data) return
  await answerCallback(callback.id)

  const data = callback.data
  const learner = getLearner(callback.from)
  await loadLearnerLanguage(learner.telegramUserId)
  const language = getLearnerLanguage(learner.telegramUserId)

  if (data === 'menu:main') return sendMenu(chatId, getMainMenuForLearner(learner.telegramUserId))
  if (data === 'menu:language') return sendMenu(chatId, buildLanguageMenu())
  if (data.startsWith('lang:')) {
    const language: InterfaceLanguage = data.endsWith(':en') ? 'en' : 'zh'
    setLearnerLanguage(learner.telegramUserId, language)
    await callTelegram('sendMessage', { chat_id: chatId, text: buildLanguageChangedMessage(language) })
    return sendMenu(chatId, getMainMenuForLearner(learner.telegramUserId))
  }
  if (data === 'menu:vocab') return sendMenu(chatId, buildVocabularyModeMenu(language))
  if (data === 'menu:translate') return sendMenu(chatId, buildTranslationMenu(language))

  if (data === 'menu:grammar') {
    const seenPrompts = await loadSeenQuizPromptsFromSupabase(learner.telegramUserId, 'grammar')
    const session = createQuizSession(learner.telegramUserId, 'grammar', generateGrammarQuestionSet('A1', language, seenPrompts), language === 'en' ? 'Grammar Quiz' : '语法测试')
    void persistQuizExposure(session)
    return startQuiz(chatId, session)
  }

  if (data === 'menu:speaking' || data === 'menu:reading') return sendMenu(chatId, buildSpeakingModeMenu(language))

  if (data === 'menu:progress') {
    return callTelegram('sendMessage', { chat_id: chatId, text: language === 'en' ? 'Today’s progress:\nNew words: 0/20\nGrammar: 0/10\nTranslation: 0 sentences\nSpeaking/reading: 0 sentences' : '今日进度：\n新词：0/20\n语法：0/10\n翻译：0 句\n朗读：0 句' })
  }

  if (data === 'menu:mistakes') {
    const stats = await loadMistakeStatsFromSupabase(learner.telegramUserId)
    return callTelegram('sendMessage', { chat_id: chatId, text: buildMistakeBookText(learner.displayName, stats, language) })
  }

  if (data === 'menu:leaderboard') {
    return callTelegram('sendMessage', { chat_id: chatId, text: buildLeaderboardText(await loadLeaderboardFromSupabase(), language) })
  }

  if (data.startsWith('vocab:')) {
    const mode = data.split(':')[1] as VocabMode
    learner.currentQuestionIndex = 0
    const title = mode === 'new' ? (language === 'en' ? 'Learn 20 New Words' : '学习20个新词汇') : mode === 'old' ? (language === 'en' ? 'Review 20 Old Words' : '复习20个旧词汇') : (language === 'en' ? 'Review Mistakes' : '错题复习')
    const seenVocabulary = mode === 'new' ? await loadSeenVocabularyFromSupabase(learner.telegramUserId) : []
    const session = createQuizSession(learner.telegramUserId, 'vocabulary', generateVocabularyQuestionSet(mode, 'A1', language, seenVocabulary), title)
    if (mode === 'new') void persistVocabularyExposure(session)
    return startQuiz(chatId, session)
  }

  if (data.startsWith('quiz-answer:')) {
    const payload = data.slice('quiz-answer:'.length)
    const separatorIndex = payload.lastIndexOf(':')
    const sessionId = payload.slice(0, separatorIndex)
    const selectedIndex = Number(payload.slice(separatorIndex + 1))
    const session = quizSessions.get(sessionId)
    if (!session) return callTelegram('sendMessage', { chat_id: chatId, text: language === 'en' ? 'This question has expired. Please restart the test.' : '题目已过期，请重新开始测试。' })
    const question = getNextQuizQuestion(session)
    if (!question || !Number.isInteger(selectedIndex) || !question.options[selectedIndex]) {
      return callTelegram('sendMessage', { chat_id: chatId, text: language === 'en' ? 'Invalid answer. Please restart the test.' : '答案无效，请重新开始测试。' })
    }

    const result = recordQuizAnswer(session, question.options[selectedIndex])
    if (session.quizType === 'vocabulary') {
      if (result.correct) learner.learnedVocabularyCount += 1
      else learner.wrongVocabularyCount += 1
      learner.currentQuestionIndex = session.currentIndex
      void persistLearner(learner)
    }

    if (result.completed) {
      return callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: callback.message?.message_id,
        text: buildQuizReviewMessage(session, session.answers.length - 1, language),
        reply_markup: toInlineKeyboard(buildQuizReviewKeyboard(session, session.answers.length - 1, language)),
      })
    }

    return callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: callback.message?.message_id,
      text: buildQuizReviewMessage(session, session.answers.length - 1, language),
      reply_markup: toInlineKeyboard(buildQuizReviewKeyboard(session, session.answers.length - 1, language)),
    })
  }

  if (data.startsWith('quiz-review:')) {
    const payload = data.slice('quiz-review:'.length)
    const separatorIndex = payload.lastIndexOf(':')
    const sessionId = payload.slice(0, separatorIndex)
    const answerIndex = Number(payload.slice(separatorIndex + 1))
    const session = quizSessions.get(sessionId)
    if (!session || !Number.isInteger(answerIndex)) return callTelegram('sendMessage', { chat_id: chatId, text: language === 'en' ? 'This question has expired. Please restart the test.' : '题目已过期，请重新开始测试。' })
    return callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: callback.message?.message_id,
      text: buildQuizReviewMessage(session, answerIndex, language),
      reply_markup: toInlineKeyboard(buildQuizReviewKeyboard(session, answerIndex, language)),
    })
  }

  if (data.startsWith('quiz-next:')) {
    const sessionId = data.slice('quiz-next:'.length)
    const session = quizSessions.get(sessionId)
    if (!session) return callTelegram('sendMessage', { chat_id: chatId, text: language === 'en' ? 'This question has expired. Please restart the test.' : '题目已过期，请重新开始测试。' })
    if (session.currentIndex >= session.questions.length) {
      quizSessions.delete(sessionId)
      void persistCompletedQuizSession(session)
      return callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: callback.message?.message_id,
        text: buildQuizSummary(session, language),
      })
    }
    return editQuizQuestion(chatId, callback.message?.message_id, session)
  }

  if (data.startsWith('vocab-answer:')) {
    const payload = data.slice('vocab-answer:'.length)
    const separatorIndex = payload.lastIndexOf(':')
    const key = payload.slice(0, separatorIndex)
    const encodedAnswer = payload.slice(separatorIndex + 1)
    const question = questionCache.get(key)
    if (!question) return callTelegram('sendMessage', { chat_id: chatId, text: '题目已过期，请重新开始词汇测试。' })
    const result = recordVocabularyAnswer(learner, question, decodeURIComponent(encodedAnswer ?? ''))
    void persistLearner(learner)
    const words = learnerWordSets.get(learner.telegramUserId) ?? generateVocabularySet('new', 'A1')

    if (!result.nextQuestion) {
      return callTelegram('sendMessage', {
        chat_id: chatId,
        text: `${result.message}\n\n🎉 本轮20题完成！\n学会：${learner.learnedVocabularyCount}\n错题：${learner.wrongVocabularyCount}`,
      })
    }

    const nextQuestion = getNextVocabularyQuestion(learner, words)
    const nextKey = `${learner.telegramUserId}-vocab-${learner.currentQuestionIndex}`
    questionCache.set(nextKey, nextQuestion)
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: `${result.message}\n\n下一题：\n${nextQuestion.prompt}`,
      reply_markup: toInlineKeyboard(callbackKeyboard(nextQuestion.options, `vocab-answer:${nextKey}`)),
    })
  }

  if (data.startsWith('grammar:')) {
    const [, correctAnswer, encodedAnswer] = data.split(':')
    const answer = decodeURIComponent(encodedAnswer ?? '')
    const q = generateGrammarQuestion('A1')
    const correct = answer === correctAnswer
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: correct ? `✅ 正确！\n${q.explanation}` : `❌ 不对。正确答案：${correctAnswer}\n${q.explanation}`,
    })
  }

  if (data.startsWith('speaking:')) {
    const mode = data.split(':')[1] === 'answer_question' ? 'answer_question' : 'read_sentence'
    const seenPrompts = await loadSeenQuizPromptsFromSupabase(learner.telegramUserId, 'reading')
    const prompts = generateSpeakingPromptSet(mode, 'A1', language, seenPrompts)
    speakingSessions.set(learner.telegramUserId, {
      prompts,
      currentIndex: 0,
      scores: [],
      mode,
    })
    void persistSpeakingPromptExposure(learner.telegramUserId, prompts)
    await createPersistentSpeakingSession(learner.telegramUserId, mode, prompts.length)
    return sendSpeakingPrompt(chatId, learner.telegramUserId)
  }

  if (data.startsWith('translate:')) {
    const direction = data.split(':')[1] === 'es-zh' ? 'es-zh' : 'zh-es'
    const seenPrompts = await loadSeenQuizPromptsFromSupabase(learner.telegramUserId, 'translation')
    const session = createQuizSession(
      learner.telegramUserId,
      'translation',
      generateTranslationQuestionSet(direction, language, seenPrompts),
      direction === 'zh-es' ? (language === 'en' ? 'English/Chinese → Spanish' : '中文 → 西语') : (language === 'en' ? 'Spanish → English' : '西语 → 中文'),
    )
    void persistQuizExposure(session)
    return startQuiz(chatId, session)
  }
}

export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = (await request.json()) as TelegramUpdate

  if (update.callback_query) await handleCallback(update.callback_query)
  else if (update.message) await handleTextMessage(update.message)

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, name: 'AI Spanish Coach Telegram webhook' })
}
