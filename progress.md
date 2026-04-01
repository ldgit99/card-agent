# progress.md

작성일: 2026-04-01

## 현재 상태

완료:
- `research.md` 작성 및 Page 1 양식 반영
- `plan.md` 작성
- Next.js App Router 프로젝트 구성
- 수업 설계 도메인 타입 정의
- 20개 카드 seed 데이터 정규화
- Page 1 표 기반 설계 UI 구현
- 인간 활동 카드 / AI 카드 드래그 앤 드롭 구현
- 브라우저 로컬 저장 구현
- 설계 분석 API 구현
- Page 2 모의수업 로그, 위험 패널, 성찰 일지 구현
- markdown 내보내기 구현
- 서버 파일 저장소 기반 영속 저장 구현
- 설계 버전 이력 저장 API 구현
- 시뮬레이션 세션 저장 API 구현
- 설계 버전 이력 UI 구현
- 실행 세션 이력 및 불러오기 UI 구현
- Postgres 저장 어댑터 구현
- `DATABASE_URL` 기반 파일/DB 이중 저장 계층 구현
- `npm run typecheck`, `npm run lint`, `npm run build` 통과

진행 중:
- 외부 인프라 연결 준비

미완료:
- 실제 Postgres 연결 검증
- GitHub 저장소 원격 연결
- Vercel 배포
- Preview / Production 환경 구성
- 접근성 고도화 검증
- 키보드 기반 카드 재정렬 UX 개선

## 구현 파일 핵심 목록

- `src/app/page.tsx`
- `src/app/simulation/page.tsx`
- `components/design-studio.tsx`
- `components/simulation-workspace.tsx`
- `src/app/api/design/analyze/route.ts`
- `src/app/api/simulation/step/route.ts`
- `src/app/api/simulation/risks/route.ts`
- `src/app/api/reflection/questions/route.ts`
- `src/app/api/workspace/route.ts`
- `src/app/api/workspace/design/route.ts`
- `src/app/api/workspace/session/route.ts`
- `types/lesson.ts`
- `types/workspace.ts`
- `data/cards.ts`
- `lib/design.ts`
- `lib/orchestration.ts`
- `lib/storage.ts`
- `lib/workspace-client.ts`
- `lib/server/workspace-store.ts`
- `lib/server/workspace-store-file.ts`
- `lib/server/workspace-store-postgres.ts`
- `lib/ai/schemas.ts`
- `lib/ai/openai.ts`
- `db/schema.sql`

## 다음 우선순위

1. 실제 `DATABASE_URL`로 Postgres 모드 검증
2. GitHub 원격 저장소 연결 및 첫 커밋 / 푸시
3. Vercel Preview 배포
4. 서버 저장 상태를 사용자별 분리 구조로 확장
5. 접근성 검증과 키보드 재정렬 UX 보강
6. 협업 또는 공유 기능 검토