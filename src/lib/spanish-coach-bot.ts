export type CoachButton = { text: string; callback_data: string }
export type CoachMenu = { text: string; buttons: CoachButton[][] }
export type InterfaceLanguage = 'zh' | 'en'
export type VocabMode = 'new' | 'old' | 'mistakes'

export type VocabularyItem = {
  spanish: string
  meaningZh: string
  exampleEs: string
  exampleZh: string
  level: string
}

export type VocabularyQuestion = {
  type: 'vocabulary'
  prompt: string
  word: VocabularyItem
  options: string[]
  correctAnswer: string
}

export type GrammarQuestion = {
  prompt: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export type TranslationEvaluation = {
  corrected: string
  score: number
  feedback: string
  addToMistakes: boolean
}

export type ReadingPrompt = {
  sentenceEs: string
  sentenceZh: string
  instructions: string
}

export type TelegramLearnerState = {
  telegramUserId: string
  displayName: string
  interfaceLanguage: InterfaceLanguage
  learnedVocabularyCount: number
  wrongVocabularyCount: number
  checkInDays: number
  currentQuestionIndex: number
  lastCheckInDate?: string
}

const a1Vocabulary: VocabularyItem[] = [
  ['viaje', '旅行', 'Mi viaje a España fue increíble.', '我的西班牙旅行非常棒。'],
  ['calle', '街道', 'La calle es muy bonita.', '这条街很漂亮。'],
  ['agua', '水', 'Quiero un vaso de agua.', '我想要一杯水。'],
  ['café', '咖啡', 'Quisiera un café, por favor.', '请给我一杯咖啡。'],
  ['azúcar', '糖', 'Prefiero café sin azúcar.', '我更喜欢不加糖的咖啡。'],
  ['baño', '洗手间', '¿Dónde está el baño?', '洗手间在哪里？'],
  ['estación', '车站', 'La estación está cerca.', '车站很近。'],
  ['tren', '火车', 'El tren sale a las ocho.', '火车八点出发。'],
  ['comida', '食物', 'La comida está deliciosa.', '食物很好吃。'],
  ['cuenta', '账单', 'La cuenta, por favor.', '请结账。'],
  ['mañana', '明天/早上', 'Nos vemos mañana.', '我们明天见。'],
  ['ayer', '昨天', 'Ayer estudié español.', '昨天我学了西班牙语。'],
  ['hoy', '今天', 'Hoy tengo clase.', '今天我有课。'],
  ['tienda', '商店', 'La tienda está abierta.', '商店开着。'],
  ['precio', '价格', '¿Cuál es el precio?', '价格是多少？'],
  ['amigo', '朋友', 'Mi amigo habla español.', '我的朋友说西语。'],
  ['familia', '家庭', 'Mi familia vive en China.', '我的家人住在中国。'],
  ['trabajo', '工作', 'Tengo mucho trabajo.', '我有很多工作。'],
  ['escuela', '学校', 'La escuela es grande.', '学校很大。'],
  ['tiempo', '时间/天气', 'No tengo tiempo.', '我没有时间。'],
  ['libro', '书', 'Leo un libro en español.', '我读一本西语书。'],
  ['mesa', '桌子', 'El libro está en la mesa.', '书在桌子上。'],
  ['leche', '牛奶', 'Quiero café con leche.', '我要牛奶咖啡。'],
  ['pan', '面包', 'Compro pan cada mañana.', '我每天早上买面包。'],
].map(([spanish, meaningZh, exampleEs, exampleZh]) => ({ spanish, meaningZh, exampleEs, exampleZh, level: 'A1' }))

const vocabularyEnglish: Record<string, { meaning: string; example: string }> = {
  viaje: { meaning: 'trip', example: 'My trip to Spain was incredible.' },
  calle: { meaning: 'street', example: 'The street is very pretty.' },
  agua: { meaning: 'water', example: 'I want a glass of water.' },
  café: { meaning: 'coffee', example: 'I would like a coffee, please.' },
  azúcar: { meaning: 'sugar', example: 'I prefer coffee without sugar.' },
  baño: { meaning: 'bathroom', example: 'Where is the bathroom?' },
  estación: { meaning: 'station', example: 'The station is nearby.' },
  tren: { meaning: 'train', example: 'The train leaves at eight.' },
  comida: { meaning: 'food', example: 'The food is delicious.' },
  cuenta: { meaning: 'bill/check', example: 'The bill, please.' },
  mañana: { meaning: 'tomorrow/morning', example: 'See you tomorrow.' },
  ayer: { meaning: 'yesterday', example: 'Yesterday I studied Spanish.' },
  hoy: { meaning: 'today', example: 'Today I have class.' },
  tienda: { meaning: 'store', example: 'The store is open.' },
  precio: { meaning: 'price', example: 'What is the price?' },
  amigo: { meaning: 'friend', example: 'My friend speaks Spanish.' },
  familia: { meaning: 'family', example: 'My family lives in China.' },
  trabajo: { meaning: 'work/job', example: 'I have a lot of work.' },
  escuela: { meaning: 'school', example: 'The school is big.' },
  tiempo: { meaning: 'time/weather', example: 'I do not have time.' },
  libro: { meaning: 'book', example: 'I read a book in Spanish.' },
  mesa: { meaning: 'table', example: 'The book is on the table.' },
  leche: { meaning: 'milk', example: 'I want coffee with milk.' },
  pan: { meaning: 'bread', example: 'I buy bread every morning.' },
}

function meaningFor(item: VocabularyItem, language: InterfaceLanguage = 'zh') {
  return language === 'en' ? vocabularyEnglish[item.spanish]?.meaning ?? item.meaningZh : item.meaningZh
}

function exampleFor(item: VocabularyItem, language: InterfaceLanguage = 'zh') {
  return language === 'en' ? vocabularyEnglish[item.spanish]?.example ?? item.exampleZh : item.exampleZh
}

export function buildBotMainMenu(language: InterfaceLanguage = 'zh'): CoachMenu {
  if (language === 'en') {
    return {
      text: '🇪🇸 AI Spanish Coach\n\nChoose a practice mode:',
      buttons: [
        [
          { text: 'Vocabulary Quiz', callback_data: 'menu:vocab' },
          { text: 'Grammar Quiz', callback_data: 'menu:grammar' },
        ],
        [
          { text: 'Sentence Translation', callback_data: 'menu:translate' },
          { text: 'Speaking Test', callback_data: 'menu:speaking' },
        ],
        [
          { text: 'Progress', callback_data: 'menu:progress' },
          { text: 'Mistake Book', callback_data: 'menu:mistakes' },
        ],
        [{ text: 'Leaderboard', callback_data: 'menu:leaderboard' }],
        [{ text: '🌐 中文 / English', callback_data: 'menu:language' }],
      ],
    }
  }

  return {
    text: '🇪🇸 AI Spanish Coach\n\n请选择练习模式：',
    buttons: [
      [
        { text: '词汇测试', callback_data: 'menu:vocab' },
        { text: '语法测试', callback_data: 'menu:grammar' },
      ],
      [
        { text: '句子翻译', callback_data: 'menu:translate' },
        { text: '口语测试', callback_data: 'menu:speaking' },
      ],
      [
        { text: '学习进度', callback_data: 'menu:progress' },
        { text: '错题本', callback_data: 'menu:mistakes' },
      ],
      [{ text: '排行榜', callback_data: 'menu:leaderboard' }],
      [{ text: '🌐 中文 / English', callback_data: 'menu:language' }],
    ],
  }
}

export function buildLanguageMenu(): CoachMenu {
  return {
    text: '请选择界面语言 / Choose interface language:',
    buttons: [
      [{ text: '中文', callback_data: 'lang:zh' }],
      [{ text: 'English', callback_data: 'lang:en' }],
      [{ text: '返回主菜单 / Back', callback_data: 'menu:main' }],
    ],
  }
}

export function buildLanguageChangedMessage(language: InterfaceLanguage) {
  return language === 'en' ? 'Language switched to English.' : '已切换为中文。'
}

export function buildVocabularyModeMenu(language: InterfaceLanguage = 'zh'): CoachMenu {
  if (language === 'en') {
    return {
      text: 'Choose a vocabulary practice type:',
      buttons: [
        [{ text: 'Learn 20 New Words', callback_data: 'vocab:new' }],
        [{ text: 'Review 20 Old Words', callback_data: 'vocab:old' }],
        [{ text: 'Review Mistakes', callback_data: 'vocab:mistakes' }],
        [{ text: 'Back to Main Menu', callback_data: 'menu:main' }],
      ],
    }
  }

  return {
    text: '请选择词汇练习类型：',
    buttons: [
      [{ text: '学习20个新词汇', callback_data: 'vocab:new' }],
      [{ text: '复习20个旧词汇', callback_data: 'vocab:old' }],
      [{ text: '错题复习', callback_data: 'vocab:mistakes' }],
      [{ text: '返回主菜单', callback_data: 'menu:main' }],
    ],
  }
}

export function generateVocabularySet(mode: VocabMode, level = 'A1'): VocabularyItem[] {
  const offset = mode === 'old' ? 2 : mode === 'mistakes' ? 4 : 0
  return Array.from({ length: 20 }, (_, index) => a1Vocabulary[(index + offset) % a1Vocabulary.length]).map((item) => ({
    ...item,
    level,
  }))
}

export function buildVocabularyQuestion(words: VocabularyItem[], index: number, language: InterfaceLanguage = 'zh'): VocabularyQuestion {
  const word = words[index % words.length]
  const correctMeaning = meaningFor(word, language)
  const distractors = a1Vocabulary.filter((item) => meaningFor(item, language) !== correctMeaning).slice(index + 1, index + 4)
  const fallback = a1Vocabulary.filter((item) => meaningFor(item, language) !== correctMeaning).slice(0, 4)
  const options = [correctMeaning, ...[...distractors, ...fallback].slice(0, 3).map((item) => meaningFor(item, language))]

  return {
    type: 'vocabulary',
    prompt: language === 'en' ? `${index + 1}/${words.length}\nWhat does ${word.spanish} mean?` : `${index + 1}/${words.length}\n${word.spanish} 是什么意思？`,
    word,
    options,
    correctAnswer: correctMeaning,
  }
}

export function evaluateVocabularyAnswer(question: VocabularyQuestion, answer: string, language: InterfaceLanguage = 'zh') {
  const correct = answer === question.correctAnswer
  const meaning = language === 'en' ? meaningFor(question.word, 'en') : question.word.meaningZh
  const example = language === 'en' ? exampleFor(question.word, 'en') : question.word.exampleZh
  return {
    correct,
    addToMistakes: !correct,
    message: correct
      ? language === 'en'
        ? `✅ Correct!\n\n${question.word.spanish} = ${meaning}\n${question.word.exampleEs}\n${example}`
        : `✅ 正确！\n\n${question.word.spanish} = ${meaning}\n${question.word.exampleEs}\n${example}`
      : language === 'en'
        ? `❌ Not quite. Correct answer: ${question.correctAnswer}\n\n${question.word.exampleEs}\n${example}\nAdded to mistake review.`
        : `❌ 不对。正确答案：${question.correctAnswer}\n\n${question.word.exampleEs}\n${example}\n已加入错题复习。`,
  }
}

export function generateGrammarQuestion(level = 'A1'): GrammarQuestion {
  if (level === 'A0' || level === 'A1') {
    return {
      prompt: '选择正确答案：\n\nYo ___ en Madrid.',
      options: ['soy', 'estoy', 'es', 'está'],
      correctAnswer: 'estoy',
      explanation: '“在 Madrid” 表示位置，用 estar。正确句子：Yo estoy en Madrid.',
    }
  }

  return {
    prompt: '选择正确答案：\n\nSi tuviera tiempo, ___ más español.',
    options: ['estudio', 'estudié', 'estudiaría', 'estudiaba'],
    correctAnswer: 'estudiaría',
    explanation: '条件句 Si + imperfecto de subjuntivo，主句常用 condicional：estudiaría。',
  }
}

export function evaluateTranslation(sourceZh: string, attempt: string): TranslationEvaluation {
  const normalized = attempt.toLowerCase()
  const needsSugarFix = sourceZh.includes('不加糖') && !normalized.includes('sin azúcar')
  const corrected = sourceZh.includes('咖啡') ? 'Quisiera un café sin azúcar, por favor.' : 'Necesito practicar esta frase en español.'
  const score = needsSugarFix ? 7 : 9
  return {
    corrected,
    score,
    feedback: needsSugarFix
      ? '意思基本清楚，但“不加糖”更自然的说法是 sin azúcar。Quisiera 比 Quiero 更礼貌。'
      : '表达清楚，可以继续注意重音和礼貌表达。',
    addToMistakes: score < 9,
  }
}

export function buildReadingPrompt(level = 'A1'): ReadingPrompt {
  const sentenceEs = level === 'A0' ? 'Hola, me llamo Zita.' : 'Quisiera un café sin azúcar, por favor.'
  const sentenceZh = level === 'A0' ? '你好，我叫 Zita。' : '请给我一杯不加糖的咖啡。'
  return {
    sentenceEs,
    sentenceZh,
    instructions: '🎧 请先听/看句子，然后跟读。发送语音后，我会根据转写内容给你纠正建议。',
  }
}

export function buildTranslationMenu(language: InterfaceLanguage = 'zh'): CoachMenu {
  if (language === 'en') {
    return {
      text: 'Choose translation direction:',
      buttons: [
        [{ text: 'English/Chinese → Spanish', callback_data: 'translate:zh-es' }],
        [{ text: 'Spanish → English', callback_data: 'translate:es-zh' }],
        [{ text: 'Back to Main Menu', callback_data: 'menu:main' }],
      ],
    }
  }
  return {
    text: '请选择翻译方向：',
    buttons: [
      [{ text: '中文 → 西语', callback_data: 'translate:zh-es' }],
      [{ text: '西语 → 中文', callback_data: 'translate:es-zh' }],
      [{ text: '返回主菜单', callback_data: 'menu:main' }],
    ],
  }
}

export function createTelegramLearnerState(telegramUserId: string, displayName: string): TelegramLearnerState {
  return {
    telegramUserId,
    displayName,
    interfaceLanguage: 'zh',
    learnedVocabularyCount: 0,
    wrongVocabularyCount: 0,
    checkInDays: 0,
    currentQuestionIndex: 0,
  }
}

export function getNextVocabularyQuestion(state: TelegramLearnerState, words: VocabularyItem[]): VocabularyQuestion {
  return buildVocabularyQuestion(words, state.currentQuestionIndex % words.length)
}

export function recordVocabularyAnswer(state: TelegramLearnerState, question: VocabularyQuestion, answer: string) {
  const result = evaluateVocabularyAnswer(question, answer)
  if (result.correct) state.learnedVocabularyCount += 1
  else state.wrongVocabularyCount += 1
  state.currentQuestionIndex += 1
  return { ...result, nextQuestion: state.currentQuestionIndex < 20 }
}

export function recordCheckIn(state: TelegramLearnerState, isoDate = new Date().toISOString().slice(0, 10)) {
  if (state.lastCheckInDate !== isoDate) {
    state.checkInDays += 1
    state.lastCheckInDate = isoDate
  }
  return state
}

export function buildLeaderboardText(learners: TelegramLearnerState[], language: InterfaceLanguage = 'zh') {
  const rows = [...learners].sort((a, b) =>
    b.learnedVocabularyCount - a.learnedVocabularyCount ||
    a.wrongVocabularyCount - b.wrongVocabularyCount ||
    b.checkInDays - a.checkInDays,
  )

  if (!rows.length) return language === 'en' ? '🏆 Leaderboard\n\nNo learning records yet.' : '🏆 排行榜\n\n还没有学习记录。'

  return [
    language === 'en' ? '🏆 Leaderboard' : '🏆 排行榜',
    '',
    ...rows.map((learner, index) =>
      language === 'en'
        ? `${index + 1}. ${learner.displayName} — learned ${learner.learnedVocabularyCount} | mistakes ${learner.wrongVocabularyCount} | check-ins ${learner.checkInDays} days`
        : `${index + 1}. ${learner.displayName} — 学会 ${learner.learnedVocabularyCount}｜错题 ${learner.wrongVocabularyCount}｜打卡 ${learner.checkInDays} 天`,
    ),
  ].join('\n')
}

export function toTelegramLearnerUpsert(learner: TelegramLearnerState) {
  return {
    telegram_user_id: learner.telegramUserId,
    display_name: learner.displayName,
    interface_language: learner.interfaceLanguage,
    learned_vocabulary_count: learner.learnedVocabularyCount,
    wrong_vocabulary_count: learner.wrongVocabularyCount,
    check_in_days: learner.checkInDays,
    last_check_in_date: learner.lastCheckInDate ?? null,
  }
}

export type QuizQuestion = {
  prompt: string
  options: string[]
  correctAnswer: string
  explanation?: string
}

export type QuizSession = {
  id: string
  telegramUserId: string
  quizType: 'vocabulary' | 'grammar' | 'translation' | 'reading'
  title?: string
  questions: QuizQuestion[]
  currentIndex: number
  correctCount: number
  answers: Array<{
    prompt: string
    selectedAnswer: string
    correctAnswer: string
    correct: boolean
    explanation?: string
  }>
}

export type MistakeStats = {
  vocabulary: number
  grammar: number
  translation: number
  reading: number
  speaking: number
}

export const emptyMistakeStats: MistakeStats = {
  vocabulary: 0,
  grammar: 0,
  translation: 0,
  reading: 0,
  speaking: 0,
}

export function createQuizSession(
  telegramUserId: string,
  quizType: QuizSession['quizType'],
  questions: QuizQuestion[],
  title?: string,
): QuizSession {
  return {
    id: `${telegramUserId}-${quizType}-${Date.now()}`,
    telegramUserId,
    quizType,
    title,
    questions: questions.slice(0, 20),
    currentIndex: 0,
    correctCount: 0,
    answers: [],
  }
}

export function getNextQuizQuestion(session: QuizSession) {
  return session.currentIndex >= session.questions.length ? null : session.questions[session.currentIndex]
}

export function recordQuizAnswer(session: QuizSession, selectedAnswer: string) {
  const question = getNextQuizQuestion(session)
  if (!question) return { correct: false, shouldContinue: false, completed: true }
  const correct = selectedAnswer === question.correctAnswer
  if (correct) session.correctCount += 1
  session.answers.push({
    prompt: question.prompt,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    correct,
    explanation: question.explanation,
  })
  session.currentIndex += 1
  return { correct, shouldContinue: session.currentIndex < session.questions.length, completed: session.currentIndex >= session.questions.length }
}

export function buildQuizSummary(session: QuizSession, language: InterfaceLanguage = 'zh') {
  const total = session.answers.length
  const accuracy = total ? Math.round((session.correctCount / total) * 100) : 0
  const rows = session.answers.map((answer, index) =>
    language === 'en'
      ? `${index + 1}. ${answer.correct ? '✅' : '❌'} ${answer.prompt.replace(/\n/g, ' ')}\nYour answer: ${answer.selectedAnswer}\nCorrect answer: ${answer.correctAnswer}${answer.explanation ? `\nExplanation: ${answer.explanation}` : ''}`
      : `${index + 1}. ${answer.correct ? '✅' : '❌'} ${answer.prompt.replace(/\n/g, ' ')}\n你的答案：${answer.selectedAnswer}\n正确答案：${answer.correctAnswer}${answer.explanation ? `\n解析：${answer.explanation}` : ''}`,
  )
  return language === 'en'
    ? [`🎉 ${session.title ?? 'Round'} completed: ${total} questions`, `Correct: ${session.correctCount}/${total}`, `Accuracy: ${accuracy}%`, '', 'Results:', ...rows].join('\n')
    : [`🎉 ${session.title ?? '本轮'}${total}题完成`, `正确：${session.correctCount}/${total}`, `正确率：${accuracy}%`, '', '答题结果：', ...rows].join('\n')
}

export function buildStoppedQuizArchiveMessage(session: QuizSession, language: InterfaceLanguage = 'zh') {
  const wrongAnswers = session.answers.filter((answer) => !answer.correct)
  const rows = wrongAnswers.map((answer, index) =>
    language === 'en'
      ? `${index + 1}. ${answer.prompt.replace(/\n/g, ' ')}\nYour answer: ${answer.selectedAnswer}\nCorrect answer: ${answer.correctAnswer}${answer.explanation ? `\nExplanation: ${answer.explanation}` : ''}`
      : `${index + 1}. ${answer.prompt.replace(/\n/g, ' ')}\n你的答案：${answer.selectedAnswer}\n正确答案：${answer.correctAnswer}${answer.explanation ? `\n解析：${answer.explanation}` : ''}`,
  )
  const message = language === 'en'
    ? [
        `⏹ Test stopped: ${session.title ?? getQuizTypeTitle(session.quizType, language)}`,
        `Answered: ${session.answers.length}/${session.questions.length}`,
        `Archived mistakes: ${wrongAnswers.length}`,
        '',
        wrongAnswers.length ? 'Mistakes archived:' : 'No mistakes to archive.',
      ]
    : [
        `⏹ 已停止测试：${session.title ?? getQuizTypeTitle(session.quizType, language)}`,
        `已答：${session.answers.length}/${session.questions.length}`,
        `已归档错题：${wrongAnswers.length}`,
        '',
        wrongAnswers.length ? '已归档错题：' : '没有需要归档的错题。',
      ]
  return { wrongAnswers, message: [...message.filter((line) => line !== 'MIST'), ...rows].join('\n') }
}

export function buildMistakeBookText(displayName: string, stats: Partial<MistakeStats> = {}, language: InterfaceLanguage = 'zh') {
  const merged = { ...emptyMistakeStats, ...stats }
  const total = merged.vocabulary + merged.grammar + merged.translation + merged.reading + merged.speaking
  if (language === 'en') {
    return [
      `Mistake Book: ${displayName}`,
      `Current total mistakes: ${total}`,
      '',
      `Vocabulary mistakes: ${merged.vocabulary}`,
      `Grammar mistakes: ${merged.grammar}`,
      `Translation mistakes: ${merged.translation}`,
      `Reading mistakes: ${merged.reading}`,
      `Speaking review items: ${merged.speaking}`,
      '',
      total > 0 ? 'Tap the matching test mode to review mistakes.' : 'No mistakes recorded yet.',
    ].join('\n')
  }
  return [
    `错题本：${displayName}`,
    `当前错题总数：${total}`,
    '',
    `词汇错题：${merged.vocabulary}`,
    `语法错题：${merged.grammar}`,
    `翻译错题：${merged.translation}`,
    `朗读/阅读错题：${merged.reading}`,
    `口语复习项：${merged.speaking}`,
    '',
    total > 0 ? '继续点击对应测试模式复习错题。' : '目前没有记录到错题。',
  ].join('\n')
}

export function generateVocabularyQuestionSet(mode: VocabMode, level = 'A1', language: InterfaceLanguage = 'zh'): QuizQuestion[] {
  const words = generateVocabularySet(mode, level)
  return words.map((_, index) => {
    const question = buildVocabularyQuestion(words, index, language)
    const meaning = meaningFor(question.word, language)
    const example = exampleFor(question.word, language)
    return {
      prompt: language === 'en' ? `What does ${question.word.spanish} mean?` : `${question.word.spanish} 是什么意思？`,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: `${question.word.spanish} = ${meaning}\n${question.word.exampleEs}\n${example}`,
    }
  })
}

export function generateGrammarQuestionSet(level = 'A1', language: InterfaceLanguage = 'zh'): QuizQuestion[] {
  return Array.from({ length: 20 }, (_, index) => {
    const question = generateGrammarQuestion(index % 2 === 0 ? level : level === 'A1' ? 'A2' : level)
    return {
      prompt: language === 'en' ? question.prompt.replace('选择正确答案：', 'Choose the correct answer:') : question.prompt,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: language === 'en' ? translateFixedGrammarExplanation(question.explanation) : question.explanation,
    }
  })
}

function translateFixedGrammarExplanation(explanation: string) {
  if (explanation.includes('位置，用 estar')) return 'Location uses estar. Correct sentence: Yo estoy en Madrid.'
  if (explanation.includes('condicional')) return 'In this conditional pattern, use condicional in the main clause: estudiaría.'
  return explanation
}

export function generateTranslationQuestionSet(direction: 'zh-es' | 'es-zh' = 'zh-es', language: InterfaceLanguage = 'zh'): QuizQuestion[] {
  return generateVocabularySet('new', 'A1').map((word, index) => {
    const options = [word.exampleEs, ...a1Vocabulary.filter((item) => item.exampleEs !== word.exampleEs).slice(index + 1, index + 4).map((item) => item.exampleEs)]
    const sourceText = language === 'en' ? exampleFor(word, 'en') : word.exampleZh
    const fallbackOptions = [sourceText, ...a1Vocabulary.filter((item) => item.exampleZh !== word.exampleZh).slice(index + 1, index + 4).map((item) => language === 'en' ? exampleFor(item, 'en') : item.exampleZh)]
    return direction === 'zh-es'
      ? {
          prompt: language === 'en' ? `Choose the correct Spanish translation:\n\n${sourceText}` : `请选择正确的西语翻译：\n\n${sourceText}`,
          options,
          correctAnswer: word.exampleEs,
          explanation: `${sourceText}\n${word.exampleEs}`,
        }
      : {
          prompt: language === 'en' ? `Choose the correct English meaning:\n\n${word.exampleEs}` : `请选择正确的中文意思：\n\n${word.exampleEs}`,
          options: fallbackOptions,
          correctAnswer: sourceText,
          explanation: `${word.exampleEs}\n${sourceText}`,
        }
  })
}

export function generateReadingQuestionSet(level = 'A1', language: InterfaceLanguage = 'zh'): QuizQuestion[] {
  return generateVocabularySet('new', level).map((word, index) => {
    const options = [word.exampleEs, ...a1Vocabulary.filter((item) => item.exampleEs !== word.exampleEs).slice(index + 1, index + 4).map((item) => item.exampleEs)]
    const meaning = language === 'en' ? exampleFor(word, 'en') : word.exampleZh
    return {
      prompt: language === 'en' ? `Reading aloud: choose the sentence for this prompt.\n\n${meaning}` : `句子朗读：请选择本题要朗读的句子。\n\n${meaning}`,
      options,
      correctAnswer: word.exampleEs,
      explanation: language === 'en' ? `Read aloud: ${word.exampleEs}\nMeaning: ${meaning}` : `请朗读：${word.exampleEs}\n意思：${meaning}`,
    }
  })
}

export function getQuizTypeTitle(quizType: QuizSession['quizType'], language: InterfaceLanguage = 'zh') {
  if (language === 'en') {
    return quizType === 'vocabulary' ? 'Vocabulary Quiz' : quizType === 'grammar' ? 'Grammar Quiz' : quizType === 'translation' ? 'Sentence Translation' : 'Reading Aloud'
  }
  return quizType === 'vocabulary' ? '词汇测试' : quizType === 'grammar' ? '语法测试' : quizType === 'translation' ? '句子翻译' : '句子朗读'
}

export function buildQuizQuestionMessage(session: QuizSession, question: QuizQuestion, language: InterfaceLanguage = 'zh') {
  return [
    session.title ?? getQuizTypeTitle(session.quizType, language),
    language === 'en' ? `Question ${session.currentIndex + 1}/${session.questions.length}` : `第 ${session.currentIndex + 1}/${session.questions.length} 题`,
    '',
    question.prompt,
  ].join('\n')
}

export function buildQuizAnswerKeyboard(session: QuizSession, question: QuizQuestion) {
  return question.options.map((option, index) => [
    { text: `${String.fromCharCode(65 + index)}. ${option}`, callback_data: `quiz-answer:${session.id}:${index}` },
  ])
}

export function buildQuizReviewMessage(session: QuizSession, answerIndex: number, language: InterfaceLanguage = 'zh') {
  const answer = session.answers[answerIndex]
  if (!answer) return language === 'en' ? 'This question has no answer record yet.' : '这道题还没有答题记录。'
  if (language === 'en') {
    return [
      `${session.title ?? getQuizTypeTitle(session.quizType, language)} | Question ${answerIndex + 1}/${session.questions.length}`,
      '',
      answer.correct ? '✅ Correct' : '❌ Incorrect',
      '',
      answer.prompt.replace(/\n/g, ' '),
      `Your answer: ${answer.selectedAnswer}`,
      `Correct answer: ${answer.correctAnswer}`,
      '',
      `Key point: ${answer.explanation ?? 'Review the correct answer.'}`,
    ].join('\n')
  }
  return [
    `${session.title ?? getQuizTypeTitle(session.quizType)}｜第 ${answerIndex + 1}/${session.questions.length} 题`,
    '',
    answer.correct ? '✅ 回答正确' : '❌ 回答错误',
    '',
    answer.prompt.replace(/\n/g, ' '),
    `你的答案：${answer.selectedAnswer}`,
    `正确答案：${answer.correctAnswer}`,
    '',
    `知识点：${answer.explanation ?? '请对照正确答案复习。'}`,
  ].join('\n')
}

export function buildQuizReviewKeyboard(session: QuizSession, answerIndex: number, language: InterfaceLanguage = 'zh') {
  return [[
    { text: language === 'en' ? 'Previous' : '上一题', callback_data: `quiz-review:${session.id}:${Math.max(0, answerIndex - 1)}` },
    { text: language === 'en' ? 'Next' : '下一题', callback_data: `quiz-next:${session.id}` },
  ]]
}

export type SpeakingMode = 'read_sentence' | 'answer_question'

export type SpeakingPrompt = {
  mode: SpeakingMode
  prompt: string
  targetAnswer: string
  guide: string
}

export type SpeakingFeedback = {
  score: number
  transcript: string
  guidance: string
  corrected: string
  missingWords: string[]
  recognizedWords: string[]
  needsReview: boolean
}

export type SpeakingExerciseInsert = {
  telegram_user_id: string
  target_sentence_es: string
  target_sentence_zh: string | null
  transcript: string
  feedback: string
  score: number
}

export function buildSpeakingModeMenu(language: InterfaceLanguage = 'zh'): CoachMenu {
  if (language === 'en') {
    return {
      text: 'Choose a speaking test type:',
      buttons: [
        [{ text: 'Read Sentences', callback_data: 'speaking:read_sentence' }],
        [{ text: 'Answer Questions', callback_data: 'speaking:answer_question' }],
        [{ text: 'Back to Main Menu', callback_data: 'menu:main' }],
      ],
    }
  }
  return {
    text: '请选择口语测试类型：',
    buttons: [
      [{ text: '读句子', callback_data: 'speaking:read_sentence' }],
      [{ text: '回答问题', callback_data: 'speaking:answer_question' }],
      [{ text: '返回主菜单', callback_data: 'menu:main' }],
    ],
  }
}

export function generateSpeakingPromptSet(mode: SpeakingMode, level = 'A1', language: InterfaceLanguage = 'zh'): SpeakingPrompt[] {
  return generateVocabularySet('new', level).map((word) =>
    mode === 'read_sentence'
      ? {
          mode,
          prompt: language === 'en' ? `Read this sentence aloud:\n${word.exampleEs}\n${exampleFor(word, 'en')}` : `请朗读这个句子：\n${word.exampleEs}\n${word.exampleZh}`,
          targetAnswer: word.exampleEs,
          guide: language === 'en' ? 'Pay attention to stress, clear vowels, and smooth sentence flow.' : '注意重音、元音清晰度和整句连贯度。',
        }
      : {
          mode,
          prompt: language === 'en' ? `Answer this question in Spanish by voice:\nWhat does “${word.spanish}” mean?` : `请用西语语音回答问题：\n¿Qué significa “${word.spanish}”?`,
          targetAnswer: language === 'en' ? `${word.spanish} means ${meaningFor(word, 'en')}.` : word.meaningZh,
          guide: language === 'en' ? `You can answer: ${word.spanish} means ${meaningFor(word, 'en')}.` : `可以回答：${word.spanish} significa ${word.meaningZh}.`,
        },
  )
}

export function buildSpeakingPromptMessage(prompt: SpeakingPrompt, index: number, total: number, language: InterfaceLanguage = 'zh') {
  return [language === 'en' ? `Speaking Test | Question ${index + 1}/${total}` : `口语测试｜第 ${index + 1}/${total} 题`, '', prompt.prompt, '', language === 'en' ? 'Please send a voice message.' : '请发送语音回答。'].join('\n')
}

function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zñáéíóúü0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function evaluateSpokenAttempt(prompt: SpeakingPrompt, transcript: string, language: InterfaceLanguage = 'zh'): SpeakingFeedback {
  const target = normalizeSpeech(prompt.targetAnswer)
  const spoken = normalizeSpeech(transcript)
  const targetTokens = target.split(' ').filter(Boolean)
  const spokenTokens = new Set(spoken.split(' ').filter(Boolean))
  const recognizedWords = targetTokens.filter((token) => spokenTokens.has(token))
  const missingWords = targetTokens.filter((token) => !spokenTokens.has(token))
  const score = targetTokens.length ? Math.max(30, Math.round((recognizedWords.length / targetTokens.length) * 100)) : 60
  const needsReview = score < 80
  const guidance = buildSpeakingGuidance(prompt, score, missingWords, language)
  return {
    score,
    transcript,
    corrected: prompt.targetAnswer,
    guidance,
    missingWords,
    recognizedWords,
    needsReview,
  }
}

export function findBestSpeakingPromptForTranscript(
  transcript: string,
  prompts = generateSpeakingPromptSet('read_sentence', 'A1'),
): { prompt: SpeakingPrompt; index: number; score: number } | null {
  const spokenTokens = new Set(normalizeSpeech(transcript).split(' ').filter(Boolean))
  if (!spokenTokens.size) return null

  let bestPrompt: SpeakingPrompt | null = null
  let bestIndex = -1
  let bestScore = 0

  for (let index = 0; index < prompts.length; index += 1) {
    const prompt = prompts[index]
    const targetTokens = normalizeSpeech(prompt.targetAnswer).split(' ').filter(Boolean)
    if (!targetTokens.length) continue
    const overlap = targetTokens.filter((token) => spokenTokens.has(token)).length
    const score = overlap / targetTokens.length
    if (score > bestScore) {
      bestPrompt = prompt
      bestIndex = index
      bestScore = score
    }
  }

  return bestPrompt && bestScore >= 0.25 ? { prompt: bestPrompt, index: bestIndex, score: bestScore } : null
}

function buildSpeakingGuidance(prompt: SpeakingPrompt, score: number, missingWords: string[], language: InterfaceLanguage = 'zh') {
  if (!prompt.targetAnswer.trim()) return language === 'en' ? 'No reference answer. Please restart this question.' : '没有标准答案，请重新开始本题。'
  if (language === 'en') {
    if (score >= 90) return `Great! The transcription is very close to the target sentence. ${prompt.guide}`
    if (score >= 80) return `Good, you basically said it correctly. ${prompt.guide}`
    const missing = missingWords.length ? `\nFocus on: ${missingWords.join(' / ')}` : ''
    return `Please practice once more. ${prompt.guide}${missing}\nReference: ${prompt.targetAnswer}`
  }
  if (score >= 90) return `很好！语音识别和目标句高度一致。${prompt.guide}`
  if (score >= 80) return `不错，基本读对了。${prompt.guide}`
  const missing = missingWords.length ? `\n需要重点重读：${missingWords.join(' / ')}` : ''
  return `建议再练一遍。${prompt.guide}${missing}\n标准参考：${prompt.targetAnswer}`
}

export function buildSpeakingFeedbackMessage(prompt: SpeakingPrompt, feedback: SpeakingFeedback, index: number, total: number, language: InterfaceLanguage = 'zh') {
  const reviewLine = feedback.needsReview
    ? language === 'en' ? 'Added to speaking review/mistake queue.' : '已加入口语复习/错题队列。'
    : language === 'en' ? 'Passed. Continue to the next question.' : '本题通过，继续下一题。'
  const missingLine = feedback.missingWords.length ? `${language === 'en' ? 'Practice again' : '需要重读'}：${feedback.missingWords.join(' / ')}` : undefined
  if (language === 'en') {
    return [
      `Speaking Score | Question ${index + 1}/${total}`,
      '',
      `Score: ${feedback.score}/100`,
      `Transcript: ${feedback.transcript || 'No clear speech recognized'}`,
      `Reference answer: ${feedback.corrected}`,
      missingLine,
      '',
      `Guidance: ${buildSpeakingGuidance(prompt, feedback.score, feedback.missingWords, 'en')}`,
      reviewLine,
    ].filter(Boolean).join('\n')
  }
  return [
    `口语评分｜第 ${index + 1}/${total} 题`,
    '',
    `分数：${feedback.score}/100`,
    `识别文本：${feedback.transcript || '未识别到语音内容'}`,
    `参考答案：${feedback.corrected}`,
    missingLine,
    '',
    `指导：${feedback.guidance}`,
    reviewLine,
  ].filter(Boolean).join('\n')
}

export function toSpeakingExerciseInsert(
  telegramUserId: string,
  prompt: SpeakingPrompt,
  feedback: SpeakingFeedback,
): SpeakingExerciseInsert {
  return {
    telegram_user_id: telegramUserId,
    target_sentence_es: prompt.targetAnswer,
    target_sentence_zh: prompt.prompt,
    transcript: feedback.transcript,
    feedback: buildSpeakingFeedbackMessage(prompt, feedback, 0, 1),
    score: feedback.score,
  }
}

export function callbackKeyboard(options: string[], prefix: string) {
  return options.map((option, index) => [{ text: `${String.fromCharCode(65 + index)}. ${option}`, callback_data: `${prefix}:${encodeURIComponent(option)}` }])
}
