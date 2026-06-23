import { NextResponse } from 'next/server'
import {
  buildBotMainMenu,
  buildTranslationMenu,
  buildVocabularyModeMenu,
  buildLeaderboardText,
  buildQuizQuestionMessage,
  buildQuizAnswerKeyboard,
  buildQuizReviewKeyboard,
  buildQuizReviewMessage,
  buildQuizSummary,
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
  recordCheckIn,
  recordQuizAnswer,
  recordVocabularyAnswer,
  toTelegramLearnerUpsert,
  toSpeakingExerciseInsert,
  type QuizSession,
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
const quizSessions = new Map<string, QuizSession>()
const speakingSessions = new Map<string, { prompts: SpeakingPrompt[]; currentIndex: number; scores: number[]; mode: SpeakingMode; lastMessageId?: number }>()

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
  void persistLearner(state)
  return state
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
  const response = await fetch(`${cfg.url}/rest/v1/telegram_learners?select=telegram_user_id,display_name,learned_vocabulary_count,wrong_vocabulary_count,check_in_days,last_check_in_date&order=learned_vocabulary_count.desc,wrong_vocabulary_count.asc,check_in_days.desc&limit=20`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  }).catch(() => null)
  if (!response?.ok) return [...learnerStates.values()]
  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    telegramUserId: String(row.telegram_user_id ?? ''),
    displayName: String(row.display_name ?? row.telegram_user_id ?? ''),
    learnedVocabularyCount: Number(row.learned_vocabulary_count ?? 0),
    wrongVocabularyCount: Number(row.wrong_vocabulary_count ?? 0),
    checkInDays: Number(row.check_in_days ?? 0),
    currentQuestionIndex: 0,
    lastCheckInDate: row.last_check_in_date ? String(row.last_check_in_date) : undefined,
  }))
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
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: buildQuizQuestionMessage(session, question),
    reply_markup: toInlineKeyboard(buildQuizAnswerKeyboard(session, question)),
  })
}

async function editQuizQuestion(chatId: number | string, messageId: number | undefined, session: QuizSession) {
  const question = getNextQuizQuestion(session)
  if (!question || !messageId) return null
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: buildQuizQuestionMessage(session, question),
    reply_markup: toInlineKeyboard(buildQuizAnswerKeyboard(session, question)),
  })
}

async function startQuiz(chatId: number | string, session: QuizSession) {
  quizSessions.set(session.id, session)
  return sendQuizQuestion(chatId, session)
}

async function sendSpeakingPrompt(chatId: number | string, learnerId: string) {
  const session = speakingSessions.get(learnerId)
  if (!session) return null
  const prompt = session.prompts[session.currentIndex]
  if (!prompt) {
    const total = session.scores.length
    const average = total ? Math.round(session.scores.reduce((sum, score) => sum + score, 0) / total) : 0
    speakingSessions.delete(learnerId)
    return callTelegram('sendMessage', { chat_id: chatId, text: `🎉 口语测试完成\n完成：${total}/20\n平均分：${average}/100` })
  }
  const response = await callTelegram('sendMessage', {
    chat_id: chatId,
    text: buildSpeakingPromptMessage(prompt, session.currentIndex, session.prompts.length),
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

  if (message.voice) {
    let session = speakingSessions.get(learner.telegramUserId)
    let persistentSession: PersistentSpeakingSession | null = null
    if (!session) {
      persistentSession = await loadPersistentSpeakingSession(learner.telegramUserId)
      if (persistentSession) {
        const mode = persistentSession.mode === 'answer_question' ? 'answer_question' : 'read_sentence'
        const prompts = generateSpeakingPromptSet(mode, 'A1')
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
    const activePrompt = session?.prompts[session.currentIndex]
    const transcript = await transcribeTelegramVoice(message.voice.file_id, activePrompt ? 'es' : undefined)
    const fallbackMatch = activePrompt ? null : findBestSpeakingPromptForTranscript(transcript)

    if (!activePrompt && !fallbackMatch) {
      const translated = await translateTranscriptToSpanish(transcript)
      const translationPrompt: SpeakingPrompt = {
        mode: 'answer_question',
        prompt: `自由语音翻译：${transcript}`,
        targetAnswer: translated,
        guide: '这是自由语音翻译，不按口语测试题评分；请跟读西语译文，注意元音清晰。',
      }
      void persistSpeakingExercise({
        telegram_user_id: learner.telegramUserId,
        target_sentence_es: translated,
        target_sentence_zh: transcript,
        transcript,
        feedback: `自由语音翻译：${translated}`,
        score: 0,
      })
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: [
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
    const feedback = evaluateSpokenAttempt(prompt, transcript)
    session?.scores.push(feedback.score)
    void persistSpeakingExercise(toSpeakingExerciseInsert(learner.telegramUserId, prompt, feedback))
    if (persistentSession?.id) void persistSpeakingAnswer(persistentSession.id, prompt, feedback)
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: [
        activePrompt
          ? ''
          : fallbackMatch
            ? `没有检测到正在进行的口语测试；我根据你的语音自动匹配到第 ${fallbackMatch.index + 1} 题来纠正：`
            : '没有检测到正在进行的口语测试，也没有匹配到相近题目；我先按 Day 1 默认句子给你纠正：',
        buildSpeakingFeedbackMessage(prompt, feedback, activePrompt ? session?.currentIndex ?? 0 : fallbackMatch?.index ?? 0, session?.prompts.length ?? 1),
      ].filter((line) => line.length > 0).join('\n\n'),
    })
    await sendPronunciationAudio(chatId, prompt.targetAnswer)
    if (session && activePrompt) {
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
    await sendMenu(chatId, buildBotMainMenu())
    return
  }

  if (text.startsWith('/vocab')) {
    await sendMenu(chatId, buildVocabularyModeMenu())
    return
  }

  if (text.startsWith('/grammar')) {
    const session = createQuizSession(learner.telegramUserId, 'grammar', generateGrammarQuestionSet('A1'), '语法测试')
    await startQuiz(chatId, session)
    return
  }

  if (text.startsWith('/translate')) {
    await sendMenu(chatId, buildTranslationMenu())
    return
  }

  if (text.startsWith('/speak')) {
    await sendMenu(chatId, buildSpeakingModeMenu())
    return
  }

  await sendMenu(chatId, buildBotMainMenu())
}

async function handleCallback(callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat?.id
  if (!chatId || !callback.data) return
  await answerCallback(callback.id)

  const data = callback.data
  const learner = getLearner(callback.from)

  if (data === 'menu:main') return sendMenu(chatId, buildBotMainMenu())
  if (data === 'menu:vocab') return sendMenu(chatId, buildVocabularyModeMenu())
  if (data === 'menu:translate') return sendMenu(chatId, buildTranslationMenu())

  if (data === 'menu:grammar') {
    const session = createQuizSession(learner.telegramUserId, 'grammar', generateGrammarQuestionSet('A1'), '语法测试')
    return startQuiz(chatId, session)
  }

  if (data === 'menu:speaking' || data === 'menu:reading') return sendMenu(chatId, buildSpeakingModeMenu())

  if (data === 'menu:progress') {
    return callTelegram('sendMessage', { chat_id: chatId, text: '今日进度：\n新词：0/20\n语法：0/10\n翻译：0 句\n朗读：0 句' })
  }

  if (data === 'menu:mistakes') {
    return callTelegram('sendMessage', { chat_id: chatId, text: `错题本：${learner.displayName}\n当前词汇错题：${learner.wrongVocabularyCount}\n继续点击“词汇测试 → 错题复习”复习。` })
  }

  if (data === 'menu:leaderboard') {
    return callTelegram('sendMessage', { chat_id: chatId, text: buildLeaderboardText(await loadLeaderboardFromSupabase()) })
  }

  if (data.startsWith('vocab:')) {
    const mode = data.split(':')[1] as VocabMode
    learner.currentQuestionIndex = 0
    const title = mode === 'new' ? '学习20个新词汇' : mode === 'old' ? '复习20个旧词汇' : '错题复习'
    const session = createQuizSession(learner.telegramUserId, 'vocabulary', generateVocabularyQuestionSet(mode, 'A1'), title)
    return startQuiz(chatId, session)
  }

  if (data.startsWith('quiz-answer:')) {
    const payload = data.slice('quiz-answer:'.length)
    const separatorIndex = payload.lastIndexOf(':')
    const sessionId = payload.slice(0, separatorIndex)
    const selectedIndex = Number(payload.slice(separatorIndex + 1))
    const session = quizSessions.get(sessionId)
    if (!session) return callTelegram('sendMessage', { chat_id: chatId, text: '题目已过期，请重新开始测试。' })
    const question = getNextQuizQuestion(session)
    if (!question || !Number.isInteger(selectedIndex) || !question.options[selectedIndex]) {
      return callTelegram('sendMessage', { chat_id: chatId, text: '答案无效，请重新开始测试。' })
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
        text: buildQuizReviewMessage(session, session.answers.length - 1),
        reply_markup: toInlineKeyboard(buildQuizReviewKeyboard(session, session.answers.length - 1)),
      })
    }

    return callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: callback.message?.message_id,
      text: buildQuizReviewMessage(session, session.answers.length - 1),
      reply_markup: toInlineKeyboard(buildQuizReviewKeyboard(session, session.answers.length - 1)),
    })
  }

  if (data.startsWith('quiz-review:')) {
    const payload = data.slice('quiz-review:'.length)
    const separatorIndex = payload.lastIndexOf(':')
    const sessionId = payload.slice(0, separatorIndex)
    const answerIndex = Number(payload.slice(separatorIndex + 1))
    const session = quizSessions.get(sessionId)
    if (!session || !Number.isInteger(answerIndex)) return callTelegram('sendMessage', { chat_id: chatId, text: '题目已过期，请重新开始测试。' })
    return callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: callback.message?.message_id,
      text: buildQuizReviewMessage(session, answerIndex),
      reply_markup: toInlineKeyboard(buildQuizReviewKeyboard(session, answerIndex)),
    })
  }

  if (data.startsWith('quiz-next:')) {
    const sessionId = data.slice('quiz-next:'.length)
    const session = quizSessions.get(sessionId)
    if (!session) return callTelegram('sendMessage', { chat_id: chatId, text: '题目已过期，请重新开始测试。' })
    if (session.currentIndex >= session.questions.length) {
      quizSessions.delete(sessionId)
      return callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: callback.message?.message_id,
        text: buildQuizSummary(session),
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
    const prompts = generateSpeakingPromptSet(mode, 'A1')
    speakingSessions.set(learner.telegramUserId, {
      prompts,
      currentIndex: 0,
      scores: [],
      mode,
    })
    await createPersistentSpeakingSession(learner.telegramUserId, mode, prompts.length)
    return sendSpeakingPrompt(chatId, learner.telegramUserId)
  }

  if (data.startsWith('translate:')) {
    const direction = data.split(':')[1] === 'es-zh' ? 'es-zh' : 'zh-es'
    const session = createQuizSession(
      learner.telegramUserId,
      'translation',
      generateTranslationQuestionSet(direction),
      direction === 'zh-es' ? '中文 → 西语' : '西语 → 中文',
    )
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
