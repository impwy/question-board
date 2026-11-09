import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Question, QuestionStatus } from '../types'

const PANE = 'question-board'
const TITLE = '질문 보드'
const STORE_KEY = 'questions'

// 질문 목록. 세션 안에서는 $.state, 세션 사이에는 $.store에 같은 값을 둔다.
// 질문의 필드가 바뀌면 shape 태그를 올린다.
const questions = atom({ plugin: 'question-board', key: 'questions' } as const, [], {
  shape: 'questions-1',
})

type AskInput = {
  questions?: { id?: string; topic?: string; text?: string; options?: string[] }[]
}
type IdsInput = { ids?: string[] }
type ReadInput = { status?: QuestionStatus | 'all' }

// 플러그인이 등록한 MCP 도구의 인자는 e에 바로 실린다(e.title처럼). input 아래에 오는 경우도 받는다.
const args = <T,>(e: unknown): T => {
  const held = e as { input?: unknown }
  return (typeof held.input === 'object' && held.input !== null ? held.input : e) as T
}

const isQuestion = (value: unknown): value is Question =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Question).id === 'string' &&
  typeof (value as Question).text === 'string' &&
  typeof (value as Question).status === 'string'

const nextId = (list: readonly Question[]): string => {
  let max = 0
  for (const q of list) {
    const m = /^Q(\d+)$/.exec(q.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `Q${max + 1}`
}

// $.state에 쓴 뒤 $.store에도 같은 값을 남긴다.
async function save($: EngineInterface, fn: (list: readonly Question[]) => Question[]) {
  const list = await update($, questions, fn)
  await $.store.set(STORE_KEY, list)
  return list
}

// MCP 도구의 결과는 문자열(또는 content block 배열)이어야 한다. JSON 문자열로 돌려준다.
const text = (value: unknown) => JSON.stringify(value, null, 1)

const summary = (q: Question) => ({
  id: q.id,
  topic: q.topic,
  text: q.text,
  options: q.options,
  answer: q.answer,
  status: q.status,
  askedAt: q.askedAt,
  answeredAt: q.answeredAt,
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_KEY)
    if (Array.isArray(saved) && saved.every(isQuestion)) {
      await update($, questions, () => saved)
    }

    await $.command.register({
      name: 'board',
      description: '질문 보드 pane을 연다',
    })

    await $.tool.register({
      name: 'ask',
      description:
        '질문 보드에 질문을 올린다. 사람이 pane에서 질문 옆에 답을 적는다. ' +
        '선택형이면 options를 준다(직접 입력도 늘 가능). id를 비우면 Q번호를 이어서 붙인다. ' +
        '올린 뒤에는 사람이 답을 적고 "보드 읽어"라고 할 때까지 기다린다.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '예: Q18. 비우면 자동' },
                topic: { type: 'string', description: '예: 쿠폰' },
                text: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
              },
              required: ['text'],
            },
          },
        },
        required: ['questions'],
      },
    })

    await $.tool.register({
      name: 'read',
      description:
        '질문 보드의 질문과 답을 읽는다. status: answered(답변됨, 기본)·open(미답)·applied(반영됨)·all',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['answered', 'open', 'applied', 'all'] },
        },
      },
    })

    await $.tool.register({
      name: 'mark_applied',
      description: '답을 문서·코드에 반영한 뒤 그 질문을 "반영됨"으로 표시한다',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
    })

    await $.tool.register({
      name: 'remove',
      description: '질문을 보드에서 지운다',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
    })

    const list = await read($, questions)
    if (list.some(q => q.status === 'open')) {
      void $.ui.open({ id: PANE, title: TITLE })
    }

    return next(e)
  })

  on('command.run', { command: 'board' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    const list = await read($, questions)
    const open = list.filter(q => q.status === 'open').length
    const answered = list.filter(q => q.status === 'answered').length

    return { text: `질문 보드를 열었습니다. 미답 ${open}, 답변 ${answered}.` }
  })

  on('tool.call', { tool: 'mcp__question-board__ask' }, async ($, e) => {
    const input = args<AskInput>(e)
    const asked: string[] = []
    const now = new Date(await $.clock.now()).toISOString()

    await save($, list => {
      const next = [...list]
      for (const q of input.questions ?? []) {
        const text = q.text?.trim()
        if (!text) continue
        const id = q.id?.trim() || nextId(next)
        const item: Question = {
          id,
          topic: q.topic?.trim() || undefined,
          text,
          options: q.options?.filter(o => o.trim()),
          status: 'open',
          askedAt: now,
        }
        const at = next.findIndex(one => one.id === id)
        if (at >= 0) next[at] = { ...item }
        else next.push(item)
        asked.push(id)
      }
      return next
    })

    // focus: 열자마자 키보드가 pane으로 가서 바로 답을 적을 수 있게 한다. Esc로 프롬프트로 돌아간다.
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    $.ui.toast(`질문 ${asked.length}개가 보드에 올라왔습니다. Esc로 프롬프트, ctrl+x tab으로 보드`)

    return { result: text({ asked, note: '사람이 pane에서 답을 적습니다. 답이 오면 read로 읽습니다.' }) }
  })

  on('tool.call', { tool: 'mcp__question-board__read' }, async ($, e) => {
    const status = args<ReadInput>(e).status ?? 'answered'
    const list = await read($, questions)
    const picked = status === 'all' ? list : list.filter(q => q.status === status)

    return { result: text({ status, questions: picked.map(summary) }) }
  })

  on('tool.call', { tool: 'mcp__question-board__mark_applied' }, async ($, e) => {
    const ids = new Set(args<IdsInput>(e).ids ?? [])
    const list = await save($, list =>
      list.map(q => (ids.has(q.id) ? { ...q, status: 'applied' as const } : q)),
    )

    return { result: text({ applied: list.filter(q => ids.has(q.id)).map(q => q.id) }) }
  })

  on('tool.call', { tool: 'mcp__question-board__remove' }, async ($, e) => {
    const ids = new Set(args<IdsInput>(e).ids ?? [])
    await save($, list => list.filter(q => !ids.has(q.id)))

    return { result: text({ removed: [...ids] }) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const list = await read($, questions)
    const open = list.filter(q => q.status === 'open')
    const answered = list.filter(q => q.status === 'answered')
    const applied = list.filter(q => q.status === 'applied')

    const answer = (id: string, value: string) => {
      const text = value.trim()
      if (!text) return
      void (async () => {
        const now = new Date(await $.clock.now()).toISOString()
        await save($, list =>
          list.map(q =>
            q.id === id ? { ...q, answer: text, status: 'answered' as const, answeredAt: now } : q,
          ),
        )
      })()
    }

    const reopen = (id: string) => {
      void save($, list =>
        list.map(q =>
          q.id === id ? { ...q, answer: undefined, answeredAt: undefined, status: 'open' as const } : q,
        ),
      )
    }

    const send = () => {
      const ids = answered.map(q => q.id).join(', ')
      void $.prompt.submit({
        text: `질문 보드의 답변(${ids})을 read 도구로 읽고, 반영한 뒤 mark_applied로 표시해 줘.`,
      })
    }

    const head = (q: Question) => (
      <Text bold>
        {q.id}
        {q.topic ? ` [${q.topic}]` : ''}
      </Text>
    )

    return (
      <Box flexDirection="column" gap={1}>
        {list.length === 0 && (
          <Text dimColor>질문이 없습니다. Claude가 ask 도구로 올리면 여기에 보입니다.</Text>
        )}

        {open.map((q, i) => (
          <Box flexDirection="column">
            {head(q)}
            <Text wrap="wrap">{q.text}</Text>
            {q.options && q.options.length > 0 && (
              <Box flexWrap="wrap" gap={1}>
                {q.options.map(option => (
                  <Button key={`${q.id}:${option}`} label={option} onPress={() => answer(q.id, option)} />
                ))}
              </Box>
            )}
            <Input
              key={`${q.id}:answer`}
              placeholder={q.options?.length ? '직접 입력' : '답변'}
              submitLabel="저장"
              rows={q.options?.length ? 1 : 2}
              {...(i === 0 ? { autoFocus: true as const } : {})}
              onSubmit={value => answer(q.id, value)}
            />
          </Box>
        ))}

        {answered.length > 0 && (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>── 답변함 (아직 반영 전) ──</Text>
            {answered.map(q => (
              <Box flexDirection="column">
                {head(q)}
                <Text dimColor wrap="wrap">
                  {q.text}
                </Text>
                <Text color="green" wrap="wrap">
                  → {q.answer}
                </Text>
                <Box gap={1}>
                  <Button key={`${q.id}:reopen`} label="다시 답하기" dimColor onPress={() => reopen(q.id)} />
                </Box>
              </Box>
            ))}
            <Button key="send" variant="primary" label="Claude에게 보내기" onPress={send} />
          </Box>
        )}

        {applied.length > 0 && (
          <Box flexDirection="column">
            <Text dimColor>── 반영됨 {applied.length} ──</Text>
            {applied.slice(-5).map(q => (
              <Text dimColor wrap="truncate">
                ✓ {q.id} {q.answer ?? ''}
              </Text>
            ))}
          </Box>
        )}

        <Text dimColor>미답 {open.length} · 답변 {answered.length} · 반영 {applied.length}</Text>
        <Text dimColor>키: ctrl+x tab 보드로 · Tab 다음 칸 · Enter 저장 · Esc 프롬프트로</Text>
      </Box>
    )
  })
}
