# 수업 설계 오케스트레이션 에이전트

교사의 수업 설계를 `설계 -> 모의수업 실행 -> 성찰` 흐름으로 지원하는 하네스 기반 Next.js 앱이다.

기준 문서:
- `research.md`
- `plan.md`
- `architecture.md`
- `progress.md`
- `docs/verification-rubric.md`

## 현재 구현 범위

- Page 1 수업 설계 스튜디오
  - `주제 / 교과 / 대상` 입력
  - 활동 표 입력
  - 인간 활동 카드 / AI 카드 드래그 앤 드롭
  - 설계 분석 호출
  - 서버 설계 버전 이력 저장 및 복원
- Page 2 모의수업 실행 및 성찰
  - 턴 로그 생성
  - 위험 탐지
  - 성찰 질문 생성
  - markdown 내보내기
  - 실행 세션 이력 저장 및 재불러오기
- 서버 API
  - OpenAI Responses API 사용
  - 구조화 출력 실패 시 휴리스틱 폴백
- 영속 저장
  - `DATABASE_URL`이 있으면 Postgres 사용
  - 없으면 서버 파일 저장소 사용

## 기술 스택

- Next.js App Router
- TypeScript
- React 19
- dnd-kit
- OpenAI SDK
- Zod
- pg

## 시작 방법

1. 의존성 설치

```bash
npm install
```

2. 환경변수 파일 준비

```bash
copy .env.example .env.local
```

3. 개발 서버 실행

```bash
npm run dev
```

4. 검증 명령

```bash
npm run typecheck
npm run lint
npm run build
```

## 주요 경로

- `/` : 수업 설계 스튜디오
- `/simulation` : 모의수업 실행과 성찰 일지

## 주요 API

- `POST /api/design/analyze`
- `POST /api/simulation/step`
- `POST /api/simulation/risks`
- `POST /api/reflection/questions`
- `GET /api/workspace`
- `POST /api/workspace/design`
- `POST /api/workspace/session`

## 저장 전략

### 파일 저장소 모드

조건:
- `DATABASE_URL`이 비어 있을 때

특징:
- 저장 파일 경로는 `WORKSPACE_STORAGE_FILE`
- 기본 경로는 `storage/workspace.json`
- 로컬 개발용으로 적합

### Postgres 모드

조건:
- `DATABASE_URL`이 설정되어 있을 때

특징:
- `lib/server/workspace-store-postgres.ts` 사용
- 서버 API 응답 구조는 동일하게 유지
- Vercel 배포용 기본 권장 모드

## 배포 준비 상태

완료:
- App Router 구조 확정
- OpenAI 서버 호출 분리
- 빌드 / 타입체크 / 린트 통과
- 파일 저장소 / Postgres 이중 어댑터 구현
- 설계 버전 / 실행 세션 이력 UI 구현

남은 작업:
- 실제 Postgres 연결 검증
- GitHub 원격 저장소 연결
- Vercel 프로젝트 연결
- Preview / Production 환경변수 설정

배포 가이드는 `docs/deployment.md`, Postgres 전환 참고 문서는 `docs/postgres-migration.md`, SQL 초안은 `db/schema.sql`에 있다.