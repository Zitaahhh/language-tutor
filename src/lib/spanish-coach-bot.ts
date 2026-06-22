export type CoachButton = { text: string; callback_data: string }
export type CoachMenu = { text: string; buttons: CoachButton[][] }
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

export function buildBotMainMenu(): CoachMenu {
  return {
    text: '🇪🇸 AI Spanish Coach\n\n请选择练习模式：',
    buttons: [
      [
        { text: '词汇测试', callback_data: 'menu:vocab' },
        { text: '语法测试', callback_data: 'menu:grammar' },
      ],
      [
        { text: '句子翻译', callback_data: 'menu:translate' },
        { text: '句子朗读', callback_data: 'menu:reading' },
      ],
      [
        { text: '学习进度', callback_data: 'menu:progress' },
        { text: '错题本', callback_data: 'menu:mistakes' },
      ],
    ],
  }
}

export function buildVocabularyModeMenu(): CoachMenu {
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

export function buildVocabularyQuestion(words: VocabularyItem[], index: number): VocabularyQuestion {
  const word = words[index % words.length]
  const distractors = a1Vocabulary.filter((item) => item.meaningZh !== word.meaningZh).slice(index + 1, index + 4)
  const fallback = a1Vocabulary.filter((item) => item.meaningZh !== word.meaningZh).slice(0, 4)
  const options = [word.meaningZh, ...[...distractors, ...fallback].slice(0, 3).map((item) => item.meaningZh)]

  return {
    type: 'vocabulary',
    prompt: `${index + 1}/${words.length}\n${word.spanish} 是什么意思？`,
    word,
    options,
    correctAnswer: word.meaningZh,
  }
}

export function evaluateVocabularyAnswer(question: VocabularyQuestion, answer: string) {
  const correct = answer === question.correctAnswer
  return {
    correct,
    addToMistakes: !correct,
    message: correct
      ? `✅ 正确！\n\n${question.word.spanish} = ${question.word.meaningZh}\n${question.word.exampleEs}\n${question.word.exampleZh}`
      : `❌ 不对。正确答案：${question.correctAnswer}\n\n${question.word.exampleEs}\n${question.word.exampleZh}\n已加入错题复习。`,
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

export function buildTranslationMenu(): CoachMenu {
  return {
    text: '请选择翻译方向：',
    buttons: [
      [{ text: '中文 → 西语', callback_data: 'translate:zh-es' }],
      [{ text: '西语 → 中文', callback_data: 'translate:es-zh' }],
      [{ text: '返回主菜单', callback_data: 'menu:main' }],
    ],
  }
}

export function callbackKeyboard(options: string[], prefix: string) {
  return options.map((option, index) => [{ text: `${String.fromCharCode(65 + index)}. ${option}`, callback_data: `${prefix}:${encodeURIComponent(option)}` }])
}
