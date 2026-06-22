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
})
