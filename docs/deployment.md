# deployment.md

## 목적

현재 앱은 두 가지 저장 모드를 지원한다.

- `DATABASE_URL` 없음: 파일 저장소 모드
- `DATABASE_URL` 있음: Postgres 모드

Vercel 배포 시에는 Postgres 모드를 사용해야 한다.

## 1. GitHub 준비

1. 현재 폴더를 Git 저장소로 유지한다.
2. 기본 브랜치는 `main`이다.
3. 원격 저장소를 연결한다.
4. 첫 커밋에는 아래 파일들이 포함되어야 한다.
   - 앱 코드
   - 문서
   - `.env.example`
   - `storage/.gitkeep`
   - `db/schema.sql`

## 2. Vercel 준비

Vercel에서 GitHub 저장소를 연결한다.

권장 설정:
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`

## 3. 환경변수

Preview / Production 모두 최소 아래 변수가 필요하다.

- `OPENAI_API_KEY`
- `OPENAI_MODEL_FAST`
- `OPENAI_MODEL_DEEP`
- `DATABASE_URL`

로컬 파일 저장소 전용 변수:
- `WORKSPACE_STORAGE_FILE`

주의:
- Vercel에서는 파일 시스템이 영구 저장소가 아니므로 `WORKSPACE_STORAGE_FILE` 전략을 운영 저장소로 쓰면 안 된다.

## 4. Postgres 준비

1. `db/schema.sql` 기준으로 테이블을 생성한다.
2. `DATABASE_URL`을 Vercel 환경변수에 등록한다.
3. Preview 환경에서 `/api/workspace`가 Postgres 모드로 동작하는지 확인한다.

## 5. Preview 검증

PR 단위로 아래 흐름을 점검한다.

1. `/`에서 설계 입력이 되는지
2. 카드 배치가 되는지
3. 설계 버전 저장과 복원이 되는지
4. `/simulation`에서 실행이 되는지
5. 실행 세션 저장과 복원이 되는지
6. API 키가 없을 때 휴리스틱 폴백이 동작하는지
7. API 키가 있을 때 OpenAI 구조화 출력이 동작하는지

## 6. Production 전 최종 체크

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `DATABASE_URL`이 Preview / Production에 각각 분리되었는지
- `OPENAI_API_KEY`가 클라이언트로 노출되지 않는지
- `/api/workspace` 응답의 `storageBackend`가 `postgres`인지 확인했는지