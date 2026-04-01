# verification-rubric.md

## 1. 기술 검증

- `npm run typecheck` 통과
- `npm run lint` 통과
- `npm run build` 통과
- App Router 페이지와 API 라우트가 모두 빌드 결과에 포함됨

## 2. 교육학 검증

- Page 1에서 카드 배치가 단순 장식이 아니라 활동 row와 연결됨
- Page 2에서 카드 배치가 턴 생성과 위험 탐지에 반영됨
- 인간 최종 판단, 근거 기반 토론, 책임 인식이 핵심 체크 항목으로 유지됨

## 3. Human-AI Agency 검증

- 인간 활동 카드와 AI 카드는 별도 드롭존에 분리됨
- AI 카드가 있는 활동에서 비판적 점검 카드가 없으면 위험 탐지가 가능해야 함
- `최종 판단` 카드가 없을 때 관련 위험이 포착되어야 함

## 4. 접근성 검증

- 마우스 드래그 없이 `배치` 버튼으로도 카드 배치 가능
- 모바일 화면에서 주요 레이아웃이 1열로 재배치됨
- 표 입력, 우측 패널, 성찰 질문이 모두 폼 요소로 접근 가능

## 5. 데이터 보호 검증

- OpenAI 호출은 서버 Route Handler에서만 수행됨
- `.env.example`에 필요한 환경변수가 문서화됨
- 브라우저 번들에 API 키를 직접 넣지 않음

## 6. 저장 계층 검증

- `GET /api/workspace`로 현재 설계안과 최근 세션을 읽을 수 있음
- `POST /api/workspace/design`로 설계 버전 이력을 저장할 수 있음
- `POST /api/workspace/session`로 실행 세션과 성찰 응답을 저장할 수 있음
- 기본 저장 경로는 `WORKSPACE_STORAGE_FILE`로 조정 가능함

## 7. 배포 전환 검증

- 현재 파일 저장소 구현은 로컬 및 단일 서버 개발용으로 명시되어야 함
- Vercel 배포 전에는 Postgres 계층 전환 계획이 문서화되어야 함