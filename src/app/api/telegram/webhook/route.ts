import { NextResponse } from 'next/server'
import {
  buildBotMainMenu,
  buildReadingPrompt,
  buildTranslationMenu,
  buildVocabularyModeMenu,
  buildLeaderboardText,
  callbackKeyboard,
  createTelegramLearnerState,
  evaluateTranslation,
  generateGrammarQuestion,
  generateVocabularySet,
  getNextVocabularyQuestion,
  recordCheckIn,
  recordVocabularyAnswer,
  type TelegramLearnerState,
  type VocabMode,
  type VocabularyQuestion,
} from '@/lib/spanish-coach-bot'

type TelegramMessage = {
  chat?: { id: number | string; type?: string }
  message_id?: number
  text?: string
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

async function sendMenu(chatId: number | string, menu: { text: string; buttons: { text: string; callback_data: string }[][] }) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: menu.text,
    reply_markup: toInlineKeyboard(menu.buttons),
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
  getLearner(message.from)

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
    const q = generateGrammarQuestion('A1')
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `${q.prompt}\n\n${q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')}`,
      reply_markup: toInlineKeyboard(callbackKeyboard(q.options, `grammar:${q.correctAnswer}`)),
    })
    return
  }

  if (text.startsWith('/translate')) {
    await sendMenu(chatId, buildTranslationMenu())
    return
  }

  if (text.startsWith('/speak')) {
    const prompt = buildReadingPrompt('A1')
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `句子朗读：\n\n${prompt.sentenceEs}\n${prompt.sentenceZh}\n\n${prompt.instructions}`,
    })
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
    const q = generateGrammarQuestion('A1')
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: `${q.prompt}\n\n${q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')}`,
      reply_markup: toInlineKeyboard(callbackKeyboard(q.options, `grammar:${q.correctAnswer}`)),
    })
  }

  if (data === 'menu:reading') {
    const prompt = buildReadingPrompt('A1')
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: `句子朗读：\n\n${prompt.sentenceEs}\n${prompt.sentenceZh}\n\n${prompt.instructions}`,
    })
  }

  if (data === 'menu:progress') {
    return callTelegram('sendMessage', { chat_id: chatId, text: '今日进度：\n新词：0/20\n语法：0/10\n翻译：0 句\n朗读：0 句' })
  }

  if (data === 'menu:mistakes') {
    return callTelegram('sendMessage', { chat_id: chatId, text: `错题本：${learner.displayName}\n当前词汇错题：${learner.wrongVocabularyCount}\n继续点击“词汇测试 → 错题复习”复习。` })
  }

  if (data === 'menu:leaderboard') {
    return callTelegram('sendMessage', { chat_id: chatId, text: buildLeaderboardText([...learnerStates.values()]) })
  }

  if (data.startsWith('vocab:')) {
    const mode = data.split(':')[1] as VocabMode
    const words = generateVocabularySet(mode, 'A1')
    learner.currentQuestionIndex = 0
    learnerWordSets.set(learner.telegramUserId, words)
    const question = getNextVocabularyQuestion(learner, words)
    const key = `${learner.telegramUserId}-vocab-${learner.currentQuestionIndex}`
    questionCache.set(key, question)
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: `${mode === 'new' ? '学习20个新词汇' : mode === 'old' ? '复习20个旧词汇' : '错题复习'}\n\n${question.prompt}`,
      reply_markup: toInlineKeyboard(callbackKeyboard(question.options, `vocab-answer:${key}`)),
    })
  }

  if (data.startsWith('vocab-answer:')) {
    const payload = data.slice('vocab-answer:'.length)
    const separatorIndex = payload.lastIndexOf(':')
    const key = payload.slice(0, separatorIndex)
    const encodedAnswer = payload.slice(separatorIndex + 1)
    const question = questionCache.get(key)
    if (!question) return callTelegram('sendMessage', { chat_id: chatId, text: '题目已过期，请重新开始词汇测试。' })
    const result = recordVocabularyAnswer(learner, question, decodeURIComponent(encodedAnswer ?? ''))
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

  if (data.startsWith('translate:')) {
    const result = evaluateTranslation('我想要一杯咖啡，不加糖。', 'Quiero un café, no azúcar.')
    return callTelegram('sendMessage', {
      chat_id: chatId,
      text: `翻译练习：\n请翻译：我想要一杯咖啡，不加糖。\n\n示例纠正：${result.corrected}\n${result.feedback}`,
    })
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
