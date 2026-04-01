# postgres-migration.md

## 목적

현재 앱은 `lib/server/workspace-store.ts`에서 파일 저장소를 사용한다.
Vercel 배포 전에는 이 계층을 Postgres로 교체해야 한다.

## 교체 원칙

- Route Handler의 인터페이스는 유지한다.
- 클라이언트 코드는 바꾸지 않는다.
- 저장 계층만 교체한다.

## 교체 대상 함수

- `readWorkspaceSnapshot()`
- `saveCurrentDesign()`
- `saveSimulationSession()`
- `getLatestSimulationSession()`

## 제안 스키마

- `lesson_designs`
- `lesson_design_versions`
- `simulation_sessions`

구체 스키마 초안은 `db/schema.sql`에 있다.

## 매핑 규칙

### 현재 설계안

- `lesson_designs.payload`에 현재 설계 JSON 저장
- `current_version` 필드로 최신 버전 추적

### 설계 버전 이력

- `lesson_design_versions.payload`에 각 버전 JSON 저장
- `(lesson_design_id, version)` unique 제약 유지

### 실행 세션

- `simulation_sessions.analysis`
- `simulation_sessions.turns`
- `simulation_sessions.risks`
- `simulation_sessions.questions`
- `simulation_sessions.journal`

모두 JSONB로 저장

## 전환 순서

1. Postgres 연결 유틸 추가
2. `workspace-store.ts` 내부 구현을 SQL로 교체
3. 파일 저장소 대비 동등 동작 검증
4. Vercel Preview 환경변수에 `DATABASE_URL` 적용
5. 파일 저장소 fallback 제거 여부 결정

## 검증 기준

- `GET /api/workspace` 응답 구조가 바뀌지 않아야 함
- `POST /api/workspace/design` 이후 버전 이력이 증가해야 함
- `POST /api/workspace/session` 이후 최신 세션 정렬이 유지되어야 함
- 기존 UI는 수정 없이 그대로 동작해야 함