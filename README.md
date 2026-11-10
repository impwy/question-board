# question-board

question-board는 Claude Code 채팅 옆에 질문 보드 pane을 띄우는 mod입니다. Claude가 올린 질문이 pane에 쌓이고, 질문마다 답 칸이 있습니다. mod가 답을 플러그인 store에 저장하므로 세션을 새로 열어도 답이 남습니다. 설계 논의처럼 질문이 열 개 넘게 쌓이는 작업에서 씁니다.

> **English.** question-board is a Claude Code mod that opens a pane beside the chat. Claude posts questions to the pane with the `ask` tool, and you answer each one in place. The mod stores the answers, so they survive a new session. Install it with the two commands below, then run `/board`.

## 설치

Claude Code 프롬프트에서 두 명령을 차례로 실행합니다.

```
/plugin marketplace add impwy/question-board
/plugin install question-board@question-board
```

설치가 끝나면 새 세션을 열고 `/board`를 입력합니다. 오른쪽에 **질문 보드** pane이 열립니다.

## 답하기

1. Claude가 `ask` 도구로 질문을 올리면 pane이 열리고, 질문이 "미답" 칸에 들어갑니다. 선택지가 있는 질문은 선택지를 버튼으로 보여 줍니다.
2. 버튼을 누르거나 입력 칸에 답을 적고 **저장**을 누릅니다. 질문이 "답변함" 칸으로 옮겨집니다.
3. 답을 다 적었으면 **Claude에게 보내기**를 누릅니다. Claude가 `read` 도구로 답을 읽고, 문서나 코드에 반영한 뒤 `mark_applied`로 표시합니다. 질문이 "반영됨" 칸으로 옮겨집니다.

답을 고치려면 **다시 답하기**를 누릅니다. 질문이 "미답" 칸으로 돌아갑니다.

pane이 열리면 키 입력이 pane으로 갑니다. `Tab`은 다음 입력 칸, `Enter`는 저장, `Esc`는 프롬프트로 돌아가기입니다. 프롬프트에서 pane으로 다시 가려면 `ctrl+x tab`을 누릅니다.

## Claude에게 시키기

Claude가 질문을 보드에 올리게 하려면 "질문 보드에 올려 줘"라고 말합니다. **Claude에게 보내기** 버튼은 아래 문장을 프롬프트로 보냅니다.

```
질문 보드의 답변(Q1, Q2)을 read 도구로 읽고, 반영한 뒤 mark_applied로 표시해 줘.
```

## 도구

Claude는 MCP 도구 네 개를 씁니다. 도구 이름 앞에는 `mcp__question-board__`가 붙습니다.

| 도구 | 하는 일 | 입력 |
| --- | --- | --- |
| `ask` | 질문을 올린다. `id`를 비우면 `Q1`, `Q2` 순서로 번호를 붙인다. | `questions[]`(`id`, `topic`, `text`, `options[]`) |
| `read` | 질문과 답을 읽는다. 기본은 답변한 질문이다. | `status`(`answered`, `open`, `applied`, `all`) |
| `mark_applied` | 질문을 반영됨으로 표시한다. | `ids[]` |
| `remove` | 질문을 지운다. | `ids[]` |

mod는 질문을 플러그인 store의 `questions`에 저장합니다. 질문 하나의 모양은 `types/index.d.ts`의 `Question` 타입입니다.

## 고치기

| 파일 | 역할 |
| --- | --- |
| `hooks/register.tsx` | `/board` 명령, 도구 네 개, pane 그리기 |
| `hooks/board.test.tsx` | pane 동작 테스트 |
| `types/index.d.ts` | `Question` 타입과 store 선언 |
| `.claude-plugin/plugin.json` | 플러그인 매니페스트 |
| `.claude-plugin/marketplace.json` | 이 저장소를 marketplace로 쓰기 위한 목록 |

코드를 고친 뒤에는 저장소 폴더에서 두 명령을 실행합니다.

```
claude plugin test .
claude plugin validate .
```

버그와 제안은 [GitHub Issues](https://github.com/impwy/question-board/issues)에 올립니다.

## 라이선스

[MIT](LICENSE)
