# question-board

Claude가 올린 질문 옆에 바로 답을 적는 질문 보드 pane입니다. 설계 논의처럼 질문이 여러 개 쌓이는 작업에서, 채팅에 길게 답을 쓰는 대신 질문마다 답 칸에 적습니다. 답은 세션이 바뀌어도 남습니다.

## 설치

Claude Code에서 아래 두 명령을 차례로 실행합니다.

```
/plugin marketplace add impwy/question-board
/plugin install question-board@question-board
```

설치 뒤 새 세션에서 `/board`로 pane을 엽니다.

> **English.** A Claude Code mod that opens a pane beside the chat where you answer Claude's questions one by one. Answers persist across sessions. Install with the two commands above, then run `/board`.

## 사용

- `/board`: 질문 보드 pane을 엽니다. 미답 질문이 있으면 세션 시작 때 자동으로 열립니다.
- Claude는 `ask` 도구로 질문을 올립니다. 선택형이면 선택지가 버튼으로 보이고, 직접 입력도 됩니다.
- 답을 적고 Enter(저장)를 누르면 "답변함"으로 옮겨집니다. "Claude에게 보내기"를 누르면 Claude가 `read` 도구로 답을 읽어 반영하고 `mark_applied`로 표시합니다.
- "다시 답하기"로 답을 고칠 수 있습니다.

## 도구

| 도구 | 하는 일 |
| --- | --- |
| `ask` | 질문 올리기 (`id`, `topic`, `text`, `options`) |
| `read` | 질문과 답 읽기 (`status`: answered·open·applied·all) |
| `mark_applied` | 반영됨으로 표시 |
| `remove` | 질문 삭제 |

저장 위치는 플러그인의 store(`questions`)입니다.
