# architecture.md

## 개요

이 프로젝트는 교사의 수업 설계를 돕는 하네스 기반 웹 앱이다.
핵심 흐름은 `설계 -> 모의수업 실행 -> 성찰` 이며, Page 1과 Page 2가 같은 데이터 모델을 공유한다.

## 기술 스택

- Next.js App Router
- TypeScript
- React 19
- dnd-kit
- OpenAI Responses API
- Zod
- pg
- Vercel 배포 전제 구조

## 화면 구조

### Page 1 `/`

역할:
- 수업 주제, 교과, 대상 입력
- 활동 표 입력
- 선택된 활동 row에 인간 활동 카드와 AI 카드 배치
- 설계 분석 호출
- 서버 설계 저장 및 최신 저장본 불러오기
- 설계 버전 이력 복원

주요 컴포넌트:
- `components/design-studio.tsx`

### Page 2 `/simulation`

역할:
- Page 1 설계를 입력으로 모의수업 실행
- 턴 로그 렌더링
- 위험 탐지 결과 제시
- 성찰 질문 응답 및 markdown 내보내기
- 시뮬레이션 세션 서버 저장
- 저장된 실행 세션 복원

주요 컴포넌트:
- `components/simulation-workspace.tsx`

## 데이터 계층

주요 타입:
- `LessonDesign`
- `LessonActivity`
- `OrchestrationCard`
- `CardPlacement`
- `SimulationTurn`
- `DetectedRisk`
- `ReflectionQuestion`
- `ReflectionJournalEntry`
- `SimulationSessionRecord`
- `WorkspaceSnapshot`

주요 파일:
- `types/lesson.ts`
- `types/workspace.ts`
- `data/cards.ts`
- `lib/design.ts`
- `lib/orchestration.ts`
- `lib/storage.ts`
- `lib/workspace-client.ts`

## API 계층

서버 Route Handler는 모두 App Router 내부에 둔다.
브라우저는 OpenAI API 키를 직접 알지 못한다.

엔드포인트:
- `POST /api/design/analyze`
- `POST /api/simulation/step`
- `POST /api/simulation/risks`
- `POST /api/reflection/questions`
- `GET /api/workspace`
- `POST /api/workspace/design`
- `POST /api/workspace/session`

동작 원칙:
- OpenAI 키가 있으면 구조화 출력 사용
- 키가 없거나 파싱 실패 시 휴리스틱 폴백 사용

## AI 계층

모델 역할 분리:
- `OPENAI_MODEL_FAST`: 턴 생성, 성찰 질문 생성
- `OPENAI_MODEL_DEEP`: 설계 분석, 위험 탐지

스키마 파일:
- `lib/ai/schemas.ts`
- `lib/ai/openai.ts`

## 저장 계층

저장 계층은 어댑터 패턴으로 분리했다.

공통 진입점:
- `lib/server/workspace-store.ts`

파일 저장소 어댑터:
- `lib/server/workspace-store-file.ts`
- 조건: `DATABASE_URL` 미설정

Postgres 어댑터:
- `lib/server/workspace-store-postgres.ts`
- 조건: `DATABASE_URL` 설정
- `pg` 사용
- 스키마 초안: `db/schema.sql`

저장되는 데이터:
- 현재 설계안
- 설계 버전 이력
- 모의수업 실행 세션
- 성찰 응답이 포함된 저널

## 하네스 적용 방식

개발용 하네스와 런타임 하네스를 분리한다.

개발용 하네스:
- `research.md`
- `plan.md`
- `architecture.md`
- `progress.md`
- `docs/verification-rubric.md`
- `docs/deployment.md`
- `docs/postgres-migration.md`
- `CLAUDE.md`
- `AGENTS.md`

런타임 하네스:
- Design Planner: Page 1 설계 구조화
- Simulation Conductor: 턴 생성
- Risk Observer: 위험 탐지
- Reflection Coach: 성찰 질문 생성

## 검증 명령

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## 배포 전 체크포인트

- `OPENAI_API_KEY`는 서버 환경변수로만 제공
- Preview와 Production 환경변수 분리
- Vercel에서는 `DATABASE_URL` 사용을 기본값으로 둔다
- 성찰 markdown 내보내기 동작 확인