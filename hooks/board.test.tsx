import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'question-board',
  component: 'Pane',
  requestId: 'question-board',
  props: {
    title: '질문 보드',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('질문을 올리고, 답을 적고, 읽고, 반영 표시한다', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'board' } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__question-board__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const asked = await $.tool.call({
    tool: 'mcp__question-board__ask',
    questions: [
      { id: 'Q18', topic: '쿠폰', text: '자동 적용인가 회원 선택인가?', options: ['자동', '선택'] },
      { text: '사용 기간 기준은?' },
    ],
  })
  const parse = (r: unknown) => JSON.parse((r as { result: string }).result)
  expect(parse(asked).asked).toEqual(['Q18', 'Q19'])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Q18/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Q19/ })).toBeDefined()

  // 선택형은 버튼으로, 서술형은 Input으로 답한다.
  await ui.press({ key: 'Q18:자동' })
  await ui.input({ key: 'Q19:answer', text: '발급일 + 30일' })

  expect(await ui.find({ type: 'Text', text: /→ 자동/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /→ 발급일 \+ 30일/ })).toBeDefined()

  const read = parse(await $.tool.call({ tool: 'mcp__question-board__read' })) as {
    questions: { id: string; answer?: string; status: string }[]
  }
  expect(read.questions.map(q => [q.id, q.answer, q.status])).toEqual([
    ['Q18', '자동', 'answered'],
    ['Q19', '발급일 + 30일', 'answered'],
  ])

  await $.tool.call({ tool: 'mcp__question-board__mark_applied', ids: ['Q18'] })
  const left = parse(await $.tool.call({ tool: 'mcp__question-board__read' })) as {
    questions: { id: string }[]
  }
  expect(left.questions.map(q => q.id)).toEqual(['Q19'])
  expect(await ui.find({ type: 'Text', text: /✓ Q18/ })).toBeDefined()

  await ui.unmount()
})
