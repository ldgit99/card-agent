# AGENTS.md

## 목적

이 저장소는 교사의 수업 설계를 지원하는 하네스 기반 에이전트 앱이다.
개발 에이전트는 다음 우선순위를 따른다.

1. `research.md`의 교육학적 근거 유지
2. `plan.md`의 구현 순서 유지
3. `architecture.md`의 계층 구조 유지
4. `docs/verification-rubric.md`의 검증 기준 유지

## 개발 규칙

- 브라우저는 UI와 상태 편집만 담당한다.
- OpenAI 호출은 `src/app/api/*`에서만 수행한다.
- 핵심 상태는 구조화 타입으로 관리한다.
- 카드 배치는 반드시 시뮬레이션 입력으로 이어져야 한다.
- 휴리스틱 폴백은 항상 유지한다.

## 런타임 역할 모델

- Design Planner: Page 1 설계 구조화
- Simulation Conductor: 턴 생성
- Risk Observer: 위험 탐지
- Reflection Coach: 성찰 질문 생성

## 검증 명령

- `npm run typecheck`
- `npm run lint`
- `npm run build`