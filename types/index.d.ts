export type QuestionStatus = 'open' | 'answered' | 'applied'

export type Question = {
  /** 질문 번호. 예: Q18 */
  id: string
  /** 주제. 예: 쿠폰 */
  topic?: string
  text: string
  /** 선택형이면 선택지. 직접 입력도 늘 가능하다 */
  options?: string[]
  answer?: string
  status: QuestionStatus
  askedAt: string
  answeredAt?: string
}

declare module 'claude-code' {
  interface PluginState {
    'question-board': { questions: Shaped<Question[]> }
  }
}
