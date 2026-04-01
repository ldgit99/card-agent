# Harness 기반 교사용 수업설계 에이전트 연구

작성 기준일: 2026-04-01  
검증 기준: 로컬 자료 2종과 `tigerjk9/Harness-Engineering`, OpenAI 공식 문서, Vercel 공식 문서, GitHub 공식 문서를 함께 읽고 정리했다.

## 0. 문서 목적

이 문서는 현재 폴더의 자료인 [AI_교육카드.md](./AI_교육카드.md)와 [20260403 AI 시대, AI 리터러시 및 윤리.md](./20260403%20AI%20시대,%20AI%20리터러시%20및%20윤리.md), 그리고 `Harness-Engineering` 저장소를 함께 해석하여, 다음 두 가지를 동시에 만족하는 제품 청사진을 만드는 데 목적이 있다.

1. 교사의 수업 설계, 모의 수업 실행, 성찰 일지 작성을 돕는 교육용 웹 애플리케이션
2. 그 앱 자체를 안정적으로 개발하기 위한 하네스 기반 개발 프로젝트

핵심 결론은 단순하다.

- 이 프로젝트는 “AI 도구를 하나 더 붙인 수업 앱”이 아니라, `Human-AI Agency`와 `교사의 오케스트레이션`을 앱 구조로 구현해야 하는 제품이다.
- `Harness-Engineering`은 런타임 라이브러리나 npm 패키지처럼 설치하는 대상이 아니다. 이 저장소가 제공하는 것은 개발 프로세스용 하네스 템플릿과 검증 철학이다.
- 따라서 이 프로젝트는 **개발용 하네스**와 **런타임 앱 하네스**를 분리해서 설계해야 한다.

권장 아키텍처는 다음과 같다.

- 프론트엔드/서버: `Next.js App Router + TypeScript`
- 배포: `Vercel`
- 저장: `Postgres` 계열 DB
- AI 백엔드: `OpenAI Responses API + function calling + structured outputs`
- Page 1: 수업 설계 캔버스 + 오케스트레이션 카드 배치
- Page 2: 설계안 기반 멀티턴 모의수업 시뮬레이션 + 위험 포착 + 성찰 질문/일지

## 1. 최종 결론 요약

### 1.1 제품은 무엇을 해결하는가

교사는 이미 AI를 “도구”로 사용할 수 있다. 문제는 그 도구를 어떻게 수업의 흐름 안에 배치할지, 언제 AI를 개입시킬지, 언제 인간의 판단을 복원할지, 어떤 질문으로 사고를 깊게 만들지를 구조적으로 설계하기 어렵다는 점이다. 로컬 자료는 이 문제를 단순한 도구 사용의 문제가 아니라 `Human-AI Agency`와 `오케스트레이션`의 문제로 정의한다. [R1][R2]

즉, 이 앱은 다음을 지원해야 한다.

- 수업 전: AI와 인간의 역할, 개입 지점, 질문 흐름, 성공 증거를 설계한다.
- 수업 중: 설계된 흐름이 실제로 깊이 있는 학습을 유도하는지 모의 실행으로 검토한다.
- 수업 후: 어떤 개입이 효과적이었고 어떤 개입이 AI 의존, 판단 실패, 책임 불명확을 낳았는지 성찰한다.

### 1.2 하네스는 어떻게 해석해야 하는가

`Harness-Engineering`의 핵심은 “AI가 일관된 품질로 일하게 만드는 저장소 환경 설계”다. README와 PRD가 반복해서 강조하는 구조는 다음 네 축이다. [R3][R4]

- Constitution
- Work Structure
- Verification
- Execution Loop

이 프로젝트에서는 이를 다음처럼 해석하는 것이 가장 적절하다.

| 구분 | 역할 | 이 프로젝트에서의 위치 |
| --- | --- | --- |
| 개발용 하네스 | AI 개발 프로세스를 통제 | `CLAUDE.md`, `AGENTS.md`, `architecture.md`, `progress.md`, `.claude/skills/*`, 검증 루브릭 |
| 런타임 앱 하네스 | 실제 앱 안에서 설계-실행-성찰 흐름을 통제 | `Design Planner`, `Simulation Conductor`, `Risk Observer`, `Reflection Coach` |

이 둘을 혼동하면 안 된다. `Harness-Engineering`의 `Planner/Coder/Reviewer/Tester/Pedagogy Reviewer`는 사용자가 쓰는 앱 기능이 아니라, 이 앱을 만드는 과정의 통제 장치다. [R5][R6]

### 1.3 기본 권장안

- 모델 기본값
  - 실시간성, 반복 호출, 멀티턴 시뮬레이션: `gpt-5.4-mini`
  - 더 깊은 수업안 비평, 종합 진단, 최종 성찰 질문 생성: `gpt-5.4`
- 호출 방식
  - 브라우저 직접 호출 금지
  - 서버 Route Handler에서만 OpenAI 호출
  - 모든 핵심 결과는 JSON Schema 또는 Zod로 구조화
- 저장 방식
  - 브라우저 로컬 저장만으로 끝내지 않고 DB 저장 포함
  - 설계안은 버전형 저장
  - 시뮬레이션은 설계 스냅샷 기준으로 불변 저장
  - 성찰 일지는 시뮬레이션 결과와 연결 저장

## 2. 로컬 자료 해석: 문제를 “도구 사용”이 아닌 “Agency 설계”로 재정의

### 2.1 `AI 시대, AI 리터러시 및 윤리` 자료의 핵심

로컬 발표 자료는 기존 AI 활용 수업과 `Human-AI Agency` 관점 수업을 분명하게 구분한다. 기존 관점에서는 AI가 보조 도구이고, 인간은 의사결정 주체다. 반면 새로운 관점에서는 인간과 AI가 상호작용 속에서 의사결정과 행동을 공동으로 만들어내며, 교사는 그 관계와 흐름을 설계하고 조율해야 한다. [R2]

문서에서 중요한 포인트는 다음이다.

- AI의 핵심 쟁점은 “사용 여부”가 아니라 “역할, 책임, 통제권을 어떻게 설계하는가”이다.
- 목표 설정, 가치 판단, 최종 책임은 인간에게 남아 있어야 한다.
- `Human-AI Agency`는 수업 중 우연히 발생하는 것이 아니라 설계 단계에서 이미 구조화되어야 한다.
- 수업 실행 단계에서는 교사가 오케스트레이션을 통해 계속 판단하고 조율해야 한다.
- 수업 후에는 성찰을 통해 다음 수업 설계를 수정해야 한다.

즉, 제품의 상위 프레임은 단순한 두 페이지가 아니라 다음 3단 구조여야 한다.

1. 설계 `Pre-class orchestration`
2. 조율/실행 `In-class orchestration`
3. 성찰 `Post-class orchestration`

### 2.2 얕은 학습과 깊이 있는 학습의 차이

로컬 자료는 단순 AI 활용의 전형적 실패를 `복사`, `빠름`, `생각 없음`, `결과: 얕은 학습 · AI 의존`으로 설명한다. 반대로 오케스트레이션이 적용된 흐름은 `질문한다`, `비교한다`, `의심한다`, `선택한다`, `책임진다`, `토론`, `판단`, `재구성`, `결과: 깊은 학습 · 고차원적 사고 형성`으로 요약된다. [R2]

이 비교는 제품 요구사항으로 바로 번역된다.

- Page 1에서 사용자가 활동만 나열하면 안 된다.
- 각 활동은 반드시 질문, 비교, 판단, 책임 구조까지 포함하는지 점검되어야 한다.
- Page 2의 시뮬레이션은 “결과물이 생성되었는가”가 아니라 “판단과 재구성이 일어났는가”를 검사해야 한다.

### 2.3 교사의 오케스트레이션은 앱의 핵심 도메인 모델이다

로컬 자료가 제시한 교사의 오케스트레이션은 다음 3계층으로 정리할 수 있다. [R2]

- 설계: 학생은 무엇을 하는가, AI는 어디에서 개입하는가, 어떤 질문이 필요한가, 어떤 흐름으로 진행하는가
- 조율: 지금 개입할 것인가, 사고를 확장하는 질문은 무엇인가, AI가 학습을 방해하는가, 활동을 전환할 것인가
- 성찰: 어떤 개입이 효과적이었는가, AI 활용이 적절했는가, 다음 수업에서는 무엇을 바꿀 것인가

이 구조는 곧 앱 정보 구조의 기준이 된다.

- Page 1은 설계 계층을 구조화한다.
- Page 2 상단은 조율/실행을 시뮬레이션한다.
- Page 2 하단은 성찰 계층을 저장한다.

## 3. `AI_교육카드.md` 정규화: 카드 20장을 제품 입력 데이터로 변환

### 3.1 카드 자료의 본질

[AI_교육카드.md](./AI_교육카드.md)는 단순 참고 카드셋이 아니라, 오케스트레이션 개입 지점을 명시한 구조화 프롬프트 모음이다. 이 카드들을 앱에서는 정적 seed 데이터로 시작하는 것이 맞다.

초기 버전에서는 파일 업로드보다 이 카드셋을 먼저 정규화해야 한다.

- 이유 1: 이미 제품 핵심 개입 패턴이 충분히 정의되어 있다.
- 이유 2: 드래그앤드롭 UX의 목적은 자유 업로드가 아니라 설계 의도 구조화다.
- 이유 3: Page 2 시뮬레이션은 어떤 카드가 어떤 활동에 배치되었는지를 입력으로 사용해야 한다.

### 3.2 카드 분류

카드는 다음처럼 분류된다. [R1][R2]

- 교사 카드 14개
  - 사고 촉진: 1~4
  - AI 판단: 5~8
  - 협력: 9~10
  - 모니터링/지원/Agency: 11~14
- AI 카드 6개
  - 생성/분석/피드백/설명/탐구/한계

### 3.3 카드 정규화 표

아래 표는 초기 seed 데이터의 기준 정의다.

| ID | 주체 | 카드명 | 대표 질문/행동 | 교육 의도 | Page 1 역할 | Page 2 기대 신호 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | 교사 | 사고 확장 | 왜 그렇게 생각했나요? | 사고 심화 | 활동에 깊이 확장 장치 부여 | 학생 응답 근거 확장, 단순 정답 반복 감소 |
| T02 | 교사 | 비교 질문 | 다른 방법도 있을까요? | 대안 탐색 | 비교 기반 활동 설계 | 대안 비교, 전략 분기 발생 |
| T03 | 교사 | 관점 전환 | 다른 입장에서 보면 어떨까요? | 관점 확장 | 타자/역할 기반 재해석 설계 | 하나의 답에 고정되지 않음 |
| T04 | 교사 | 예측 질문 | 어떻게 될 것 같나요? | 가설 생성 | 탐구형 활동 설계 | 실행 전 예측과 사후 비교 발생 |
| T05 | 교사 | AI 비교 질문 | AI의 답과 우리의 생각은 어떻게 다른가요? | 인간-AI 비교 | 인간과 AI의 병렬 산출 설계 | AI 응답 비판적 비교 발생 |
| T06 | 교사 | AI 신뢰 점검 | 이 AI 결과를 얼마나 믿을 수 있을까요? | 비판적 판단 | 검증 단계 설계 | AI 출력 신뢰도 평가 발생 |
| T07 | 교사 | AI 선택 판단 | 여러 AI 답 중 어떤 것이 가장 적절한가요? | 선택 및 평가 | 다중 안 비교 설계 | 선택 기준 명시 |
| T08 | 교사 | AI 의존 조절 | AI 없이도 해결할 수 있을까요? | 학습 주도성 유지 | 비AI 단계 삽입 설계 | AI 의존 리스크 감쇠 |
| T09 | 교사 | 역할 재조정 | 역할을 바꿔서 다시 해봅시다 | 협력 유연성 | 재배치/역할전환 활동 설계 | 새로운 참여 구조 형성 |
| T10 | 교사 | 근거 기반 토론 | 왜 그렇게 생각하는지 설명해봅시다 | 논증 강화 | 토론 단계 설계 | 주장-근거 연결 강화 |
| T11 | 교사 | 이해 점검 | 여기까지 이해됐나요? | 학습 상태 확인 | 중간 체크포인트 설계 | 오개념 조기 발견 |
| T12 | 교사 | 전략 비교 | 어떤 방법이 더 효과적일까요? | 전략 판단 | 여러 풀이/도구 경로 설계 | 방법 간 장단점 평가 |
| T13 | 교사 | 최종 판단 | 최종 결정은 우리가 내려봅시다 | 인간 주도성 | 인간 최종 결정 단계 삽입 | AI 제안 이후 교사/학생 최종 결정 발생 |
| T14 | 교사 | 책임 인식 | 이 결과에 대해 우리는 어떻게 책임질 수 있을까요? | 책임 구조 형성 | 결과 책임 단계 설계 | 책임 주체 명시 |
| A15 | AI | 대안 생성 | 다양한 해결 방법을 제시합니다 | 선택 확장 | 교사 판단 전 대안 탐색용 | 대안 풀이/활동안 생성 |
| A16 | AI | 비교 분석 | 여러 답을 비교합니다 | 판단 지원 | 비교 자료 제공 | 선택 기준 정교화 |
| A17 | AI | 피드백 제공 | 결과에 대한 피드백을 제공합니다 | 개선 지원 | 형성 피드백 설계 | 수정 제안과 재시도 연결 |
| A18 | AI | 설명 제공 | 개념을 설명합니다 | 이해 지원 | 개념 보조 설명 | 개념 설명 보강 |
| A19 | AI | 질문 제안 | 더 좋은 질문을 제안합니다 | 탐구 촉진 | 교사 질문 생성 지원 | 탐구 질문 품질 향상 |
| A20 | AI | 한계 명시 | 이 답의 한계를 설명합니다 | 비판적 활용 | AI 한계 노출 설계 | 맹신 방지, 검증 촉진 |

### 3.4 제품에서 카드가 수행하는 역할

카드는 단순 태그가 아니라 다음 세 역할을 동시에 수행해야 한다.

1. 설계 의도 메타데이터
2. 시뮬레이션 개입 신호
3. 성찰 질문 생성 근거

예를 들어 `T13 최종 판단`이 어떤 활동에도 배치되지 않았다면, Page 2는 “인간 최종 판단 부재” 리스크를 더 강하게 탐지해야 한다. 반대로 `T05`, `T06`, `A20`이 함께 배치되었는데도 시뮬레이션 로그에서 비교/신뢰 점검/한계 검토가 나타나지 않으면 “카드-행동 불일치”를 띄워야 한다.

## 4. Harness-Engineering 해석과 이 프로젝트에의 채택 방식

### 4.1 무엇을 채택할 것인가

`Harness-Engineering` 저장소는 템플릿 저장소이자 개발 하네스 프레임워크다. README와 PRD는 이것을 “AI가 매번 맥락을 다시 설명받지 않아도 일관된 품질로 일할 수 있는 환경”으로 설명한다. [R3][R4]

이 프로젝트에서 채택할 대상은 다음이다.

- 루트 문서 템플릿
  - `CLAUDE.md`
  - `AGENTS.md`
  - `architecture.md`
  - `progress.md`
  - `HARNESS_CHANGELOG.md`
- `.claude/skills/` 내부 스킬
  - `harness`
  - `edu-harness`
  - `harness-init`
  - `execution-loop`
  - `objective-loop`
  - `verify`
- `docs/verification-rubric.md`
- `docs/example-walkthrough.md`

채택하지 않을 것은 다음이다.

- 런타임 의존성으로서의 “하네스 라이브러리”
- 사용자 앱 내부 기능을 직접 제공하는 코드 모듈
- Git submodule 형태의 그대로 붙여넣기

### 4.2 왜 “설치”가 아니라 “채택”인가

이 저장소는 앱 안에서 import 해서 쓰는 패키지가 아니라, 개발 프로세스를 규정하는 문서/스킬/검증 체계다. [R3][R4][R5]

따라서 실제 도입 방법은 다음 둘 중 하나다.

1. GitHub 템플릿으로 새 저장소를 만든 뒤 앱 코드를 그 위에 올리는 방식
2. 현재 저장소에 필요한 파일만 수동 이식하는 방식

현재 이 폴더는 2026-04-01 기준 `git status` 결과상 Git 저장소가 아니다. 즉 지금 시점에는 “설치 완료”보다 “채택 계획 수립”이 먼저이며, 실제 도입은 GitHub 저장소 초기화 또는 `git init` 이후가 맞다.

### 4.3 이 프로젝트에 맞는 하네스 매핑

| Harness-Engineering 요소 | 원래 의미 | 이 프로젝트의 개발용 적용 | 런타임 앱과의 관계 |
| --- | --- | --- | --- |
| Constitution | AI가 따라야 할 규칙 | 교육 도메인 규칙, OpenAI 보안 규칙, 접근성, 배포 기준 | 직접 사용자 기능은 아니지만 앱 품질을 통제 |
| Work Structure | 무엇을 어떻게 만들지에 대한 구조 | 페이지 구조, DB 모델, API 경로, 컴포넌트 경계 | 런타임 앱 하네스 설계를 문서화 |
| Verification | 결과 품질 판단 기준 | 교육학적 적절성, Agency, 접근성, 데이터 보호, 성능 | 생성된 기능이 수업 목적과 일치하는지 판단 |
| Execution Loop | 수정-검증-반복 자동화 | 구현 후 verify, objective-loop, harness update | 앱 완성도와 하네스 진화를 동시에 관리 |

### 4.4 채택 시 커스터마이즈해야 할 내용

`Harness-Engineering`은 교육 앱 일반을 위한 템플릿이지만, 본 프로젝트에는 다음 커스터마이즈가 필요하다.

- `CLAUDE.md`
  - 도메인 목적을 “교사용 수업 설계 에이전트”로 구체화
  - OpenAI 호출은 서버 전용이라는 규칙 추가
  - 카드 드래그앤드롭의 접근성 기준 추가
- `AGENTS.md`
  - 개발용 역할 외에 런타임 앱 에이전트 정의를 참고 문서로 분리
- `architecture.md`
  - Page 1/2, DB, Route Handler, OpenAI 호출 플로우 명시
- `verification-rubric.md`
  - 기존 교육 루브릭 위에 `Human-AI Agency` 축을 더 노골적으로 추가

## 5. 제품 비전: “교사의 오케스트레이션을 설계하고 시험해 보는 앱”

### 5.1 사용자

주 사용자:

- AI를 수업에 넣고 싶지만, 흐름 설계에 자신이 없는 교사
- 공개수업, 연수, 수업 공개, 수업 연구회용 시나리오를 준비하는 교사
- AI 활용 수업을 설계한 뒤 실제 문제를 미리 점검하고 싶은 교사

보조 사용자:

- 교사 연수 운영자
- AI 리터러시/교육공학 연구자
- 학교 현장 지원 장학사 또는 교육지원청 담당자

### 5.2 핵심 사용자 가치

사용자는 이 앱을 통해 다음 질문에 답해야 한다.

- 이 활동에서 학생은 무엇을 하는가?
- 이 지점에서 AI는 무엇을 주도하고 무엇을 지원하는가?
- 인간의 최종 판단은 어디에 남겨두는가?
- 깊이 있는 학습을 방해하는 구조는 없는가?
- 이 설계대로 가면 어떤 문제가 생길 수 있는가?
- 수업 후에는 무엇을 바꿔야 하는가?

### 5.3 제품의 한 문장 정의

이 앱은 **교사가 수업 전 오케스트레이션을 설계하고, 수업 중 발생할 위험을 시뮬레이션하며, 수업 후 성찰을 문서화하도록 돕는 하네스 기반 교육용 에이전트 시스템**이다.

## 6. 런타임 앱 하네스: 4개 에이전트 정의

개발용 하네스와 별도로, 앱 내부에는 다음 4개의 런타임 에이전트가 존재해야 한다.

### 6.1 Design Planner

역할:

- Page 1의 입력을 구조화한다.
- 카드 배치의 의미를 해석한다.
- 수업 흐름에서 비어 있는 판단 지점을 찾는다.
- 활동별 학습목표와 성공 증거를 정교화한다.

입력:

- 수업 메타데이터
- 활동 목록
- 카드 배치 결과
- 도구/AI 개입 지점

출력:

- 구조화된 `LessonDesign`
- 설계 요약
- 설계상 취약점 예비 진단

### 6.2 Simulation Conductor

역할:

- 설계안을 입력받아 멀티턴 모의수업을 생성한다.
- 각 턴에서 교사, 학생, AI의 상호작용을 모델링한다.
- 활동 전환, 개입 타이밍, 예상 학생 반응을 시뮬레이션한다.

입력:

- `LessonDesign`
- 이전 턴 로그
- 시뮬레이션 모드 설정

출력:

- `SimulationTurn[]`
- 교사 행동
- AI 행동
- 예상 학생 반응
- 다음 턴 제안

### 6.3 Risk Observer

역할:

- 시뮬레이션 로그를 별도 관점에서 해석한다.
- `AI 과의존`, `깊이 있는 학습 부족`, `근거 없는 판단`, `책임 주체 불명확`, `교사의 최종 판단 부재`, `심리적 안전 저해`, `카드-행동 불일치`를 탐지한다.

출력:

- `DetectedRisk[]`
- 위험 심각도
- 증거 턴
- 개선 권고

### 6.4 Reflection Coach

역할:

- 시뮬레이션과 탐지된 위험을 바탕으로 성찰 질문을 만든다.
- 일반론이 아니라 특정 이벤트와 연결된 성찰 질문을 생성한다.
- 교사의 일지 작성을 도와준다.

출력:

- `ReflectionQuestion[]`
- `ReflectionJournalEntry`
- 다음 수업 수정 포인트

## 7. Page 1 연구: 수업 설계 캔버스

### 7.1 목적

Page 1은 “수업안을 입력하는 폼”이 아니다. 오케스트레이션을 시각적으로 배치하는 설계 보드여야 한다.

핵심 목적은 다음이다.

- 활동 순서를 설계한다.
- 각 활동의 의도를 명시한다.
- AI 개입 지점을 명시한다.
- 카드 배치를 통해 사고, 판단, 책임 구조를 설계한다.
- Page 2 시뮬레이션이 읽을 수 있는 구조화 입력을 만든다.

### 7.2 화면 구조 권장안

주신 양식을 기준으로 보면, Page 1은 자유형 캔버스보다 **표 기반 수업 설계 양식 + 카드 배치 보조 영역**으로 설계하는 편이 더 적절하다. 즉 사용자는 먼저 교사가 익숙한 표 형식으로 수업안을 작성하고, 그 오른쪽에서 인간 활동 카드와 AI 카드를 활동 단위로 배치해야 한다.

권장 3단 레이아웃:

좌측 및 중앙: 표 기반 설계 양식

- 상단 메타 입력 영역
  - `주제`
  - `교과`
  - `대상`
- 하단 활동 설계 표
  - 열 1: `기능`
  - 열 2: `교과`
  - 열 3: `학습활동`
  - 열 4: `평가 방법`
  - 여러 행을 위에서 아래로 추가하며 수업 흐름을 만든다
  - 사용자는 각 셀에 직접 텍스트를 입력한다

우측: 카드 배치 영역

- 상단 박스: `인간 활동 카드`
- 하단 박스: `AI 카드`
- 두 박스는 현재 선택한 표의 행, 즉 특정 학습활동 row에 연결된다
- 사용자는 좌측 카드 라이브러리 또는 축약 카드 목록에서 카드를 끌어와 두 박스에 배치한다

보조 레이어:

- 카드 상세 정보 패널
- 현재 선택한 행의 설계 해설
- AI 개입 지점 요약
- 성공 증거 및 예상 위험 요약

즉 화면은 개념적으로 다음과 같이 해석된다.

1. 상단에서 수업 메타를 입력한다.
2. 중앙 표에서 활동 흐름을 텍스트로 작성한다.
3. 특정 행을 선택하면 오른쪽 두 박스가 그 행에 대한 카드 배치 슬롯으로 활성화된다.
4. `인간 활동 카드`와 `AI 카드` 배치 결과가 해당 행의 오케스트레이션 메타데이터가 된다.

### 7.2.1 상단 메타 입력 양식

상단 메타 입력은 사용자가 익숙한 문서 작성 흐름을 유지해야 하므로, 복잡한 폼보다 표형 입력이 좋다.

| 필드 | 설명 |
| --- | --- |
| `주제` | 차시 주제 또는 프로젝트 주제 |
| `교과` | 주 교과명 |
| `대상` | 학년, 수준, 대상 집단 |

필요하면 후속 버전에서 `차시`, `시간`, `성취기준`을 숨김 확장 필드로 추가할 수 있지만, MVP에서는 주신 양식에 맞춰 `주제`, `교과`, `대상` 3개를 우선 고정하는 편이 낫다.

### 7.2.2 활동 설계 표

각 row는 하나의 학습활동 또는 활동 단계다. 표의 목적은 복잡한 속성 편집이 아니라 교사가 이미 쓰던 수업안 양식을 그대로 디지털화하는 데 있다.

| 열 | 의미 |
| --- | --- |
| `기능` | 활동의 유형 또는 기능적 성격. 예: 조사하기, 토론하기, 발표하기 |
| `교과` | 해당 활동이 속한 세부 교과 또는 영역 |
| `학습활동` | 학생이 실제로 수행할 활동 텍스트 |
| `평가 방법` | 보고서 평가, 관찰 평가, 동료 평가 등 |

표는 최소 5행 정도를 기본으로 보여주고, 행 추가/삭제가 가능해야 한다.

### 7.2.3 우측 카드 배치 박스

오른쪽 두 칸은 단순 카드 보관함이 아니라, **현재 선택한 활동 row에 연결된 드롭존**이어야 한다.

- `인간 활동 카드`
  - 교사 카드 14장을 배치하는 영역
  - 이 row에서 교사가 어떤 질문, 판단, 조율을 수행할지 명시
- `AI 카드`
  - AI 카드 6장을 배치하는 영역
  - 이 row에서 AI가 어떤 방식으로 개입할지 명시

이 구조의 장점은 크다.

- 텍스트 기반 활동 설명과 카드 기반 개입 설계를 분리할 수 있다.
- 교사는 익숙한 수업안 표를 유지하면서도 AI 오케스트레이션을 추가할 수 있다.
- Page 2 시뮬레이션은 각 row의 텍스트 설명과 카드 배치 결과를 함께 읽을 수 있다.

### 7.3 활동 블록이 가져야 하는 필수 필드

주신 양식을 기준으로 하면, 각 활동 row는 최소 다음 필드를 가져야 한다.

- `functionLabel`
- `subjectLabel`
- `learningActivity`
- `assessmentMethod`
- `humanCardIds`
- `aiCardIds`
- `notes`

다만 제품 내부 모델은 Page 2 시뮬레이션과 후속 확장을 위해 아래처럼 조금 더 풍부하게 유지하는 편이 좋다.

- `title`
- `functionLabel`
- `subjectLabel`
- `learningObjective`
- `learningActivity`
- `assessmentMethod`
- `teacherMove`
- `tools`
- `humanCardIds`
- `aiCardIds`
- `evidenceOfSuccess`
- `notes`

즉 사용자에게는 표 기반의 간결한 입력을 보여주되, 내부적으로는 시뮬레이션에 필요한 의미 필드를 보강해서 저장해야 한다.

이 설계는 중요한데, 이유는 Page 2에서 활동 하나를 시뮬레이션할 때 카드만 보는 것이 아니라, 학습활동 텍스트와 평가 방법, 인간/AI 개입 구조를 함께 해석해야 하기 때문이다.

### 7.4 드래그앤드롭 UX 원칙

초기 권장 라이브러리는 `dnd-kit`이다. 이 선택 이유는 React 친화성보다도 접근성 문서가 비교적 명확하기 때문이다. `dnd-kit`는 드래그 가능한 요소에 대해 키보드 지원, 스크린리더 설명, live region 안내를 고려하도록 권장한다. [R15]

따라서 Page 1은 다음을 만족해야 한다.

- 마우스 드래그만 허용하지 않는다.
- 카드 포커스 이동이 가능해야 한다.
- 키보드로 집기, 이동, 놓기가 가능해야 한다.
- 현재 카드가 어느 활동 row의 `인간 활동 카드` 또는 `AI 카드` 박스로 이동했는지 스크린리더에 읽혀야 한다.
- 카드 라이브러리, 활동 설계 표, 우측 드롭존이 모두 명확한 role/label을 가져야 한다.
- 현재 선택된 row가 시각적으로 분명해야 하며, 오른쪽 두 박스가 어느 row에 연결되어 있는지 텍스트로 표시되어야 한다.

### 7.5 카드 배치의 의미론

카드 배치는 단순 태그가 아니라 구조적 신호다. 다음 규칙을 제품에 내장하는 것이 좋다.

- `T13 최종 판단`이 없으면 인간 주도성 경고 가중치 상승
- `T10 근거 기반 토론`이 없으면 근거 없음/논증 부족 경고 가중치 상승
- `T05`, `T06`, `A20`이 함께 없으면 AI 비판적 활용 경고 가중치 상승
- `T11 이해 점검`이 없으면 중간 진단 부재 경고
- `T14 책임 인식`이 없으면 책임 주체 불명확 경고

### 7.6 Page 1 출력 예시

```ts
type LessonActivity = {
  id: string;
  order: number;
  title: string;
  functionLabel: string;
  subjectLabel: string;
  learningObjective: string;
  learningActivity: string;
  assessmentMethod: string;
  teacherMove: string;
  tools: string[];
  humanCardIds: string[];
  aiCardIds: string[];
  evidenceOfSuccess: string[];
  notes?: string;
};
```

상단 메타 입력도 함께 직렬화되어야 한다.

```ts
type LessonDesignMeta = {
  topic: string;
  subject: string;
  target: string;
};
```

즉 Page 1의 실제 출력은 `LessonDesignMeta + LessonActivity[]` 구조가 된다. 이 활동 배열이 그대로 Page 2 시뮬레이션의 핵심 입력이 된다.

## 8. Page 2 연구: 멀티턴 모의수업 시뮬레이션 + 위험 포착 + 성찰 일지

### 8.1 목적

Page 2는 Page 1 결과를 읽어 다음을 수행한다.

- 이 설계가 실제 수업에서 어떻게 작동할지 시뮬레이션
- 문제를 턴 단위로 가시화
- 즉각 개입 제안
- 성찰 질문 생성
- 성찰 일지 저장

### 8.2 화면 구조 권장안

상단 좌측: 멀티턴 로그

- 턴 번호
- 현재 활동
- 교사 행동
- AI 행동
- 예상 학생 반응
- 관찰 메모

상단 우측: 위험 탐지 패널

- 현재 탐지 위험 목록
- 심각도
- 근거 턴
- 권장 개입

하단 전체: 성찰 패널

- 자동 생성 질문
- 교사 작성 답변
- 다음 차시 수정 메모
- 내보내기 버튼

### 8.3 위험 탐지 taxonomy

위험 종류는 초기 버전에서 고정하는 것이 좋다.

| 리스크 | 의미 | 대표 신호 | 관련 카드 |
| --- | --- | --- | --- |
| AI 과의존 | AI가 사고를 대체 | 교사/학생의 독자 판단 없이 AI 답 수용 | T08, T13, A20 |
| 깊이 있는 학습 부족 | 비교, 근거, 재구성 부재 | 단일 답변 생성 후 종료 | T01, T02, T10, T12 |
| 근거 없는 판단 | 주장-근거 연결 부재 | “좋다/맞다”만 있고 이유가 없음 | T10, T12 |
| 책임 주체 불명확 | 누가 최종 책임지는지 모호 | AI 제안이 그대로 결과가 됨 | T14, T13 |
| 교사의 최종 판단 부재 | 교사 주도성이 사라짐 | AI가 흐름을 사실상 주도 | T13 |
| 심리적 안전 저해 | 학습자를 위축시키는 흐름 | 평가/피드백이 처벌적 표현을 띰 | 성찰 규칙, 질문 방식 |
| 카드-행동 불일치 | 설계와 실행이 어긋남 | 카드가 배치되었는데 로그에 반영 안 됨 | 모든 카드 |

### 8.4 시뮬레이션 흐름 권장안

한 번의 시뮬레이션은 아래 순서로 진행한다.

1. `LessonDesign` 스냅샷 고정
2. 현재 활동 선택
3. `Simulation Conductor`가 다음 턴 생성
4. `Risk Observer`가 해당 턴과 누적 로그를 평가
5. 위험이 일정 수준 이상이면 즉시 개입 제안 생성
6. 모든 활동 종료 후 `Reflection Coach`가 성찰 질문 생성

### 8.5 턴 구조 권장안

```ts
type SimulationTurn = {
  id: string;
  turnIndex: number;
  activityId: string;
  teacherAction: string;
  aiAction: string;
  expectedStudentResponse: string;
  evidenceObserved: string[];
  missedOpportunities: string[];
  linkedCardIds: string[];
  observerNote: string;
};
```

이 구조가 중요한 이유는 단순 대화 로그보다 더 풍부한 관찰 정보를 담을 수 있기 때문이다.

### 8.6 성찰 질문의 생성 원칙

성찰 질문은 일반론이어서는 안 된다. 반드시 특정 턴과 특정 설계 요소를 참조해야 한다.

좋은 예:

- “3턴에서 AI가 제안한 답안을 바로 채택했습니다. 이 장면에서 `최종 판단` 카드를 실제 행동으로 바꾸려면 어떤 질문을 추가해야 했습니까?”
- “5턴에서 비교 없이 결론으로 넘어갔습니다. `비교 질문` 또는 `전략 비교` 카드 중 어느 쪽이 더 적합했습니까?”
- “7턴에서 학생 반응이 수동적으로 예측되었습니다. 이 활동의 `학생 과제`를 어떻게 바꾸면 더 깊은 재구성이 일어납니까?”

나쁜 예:

- “수업을 어떻게 개선하시겠습니까?”
- “AI를 잘 활용했습니까?”

## 9. OpenAI 아키텍처 연구

### 9.1 왜 Responses API인가

OpenAI 공식 문서 기준으로 `Responses`는 도구 호출과 구조화 출력, 멀티턴 상호작용을 포함하는 현재 중심 API다. 함수 호출 가이드도 Responses 기준 예시를 제공하며, 도구 호출은 모델 응답의 `output` 배열 안에서 여러 개가 나올 수 있으므로 애플리케이션이 이를 실행하고 다시 결과를 모델에 돌려줘야 한다고 설명한다. [R10]

이 앱은 아래 특성이 있다.

- 멀티턴 시뮬레이션
- 도구 호출 필요
- 구조화 출력 강제 필요
- 페이지 1/2 사이에서 상태를 이어가야 함

따라서 `Responses API + function calling + structured outputs` 조합이 가장 적절하다.

### 9.2 모델 선택

OpenAI의 현재 모델 목록에서 `GPT-5.4`는 “agentic, coding, professional workflows”를 위한 최고 지능 모델로 설명되고, `GPT-5.4 mini`는 “coding, computer use, subagents”에 강한 고성능 mini 모델로 제시된다. [R7][R8][R9]

이 프로젝트에서는 다음 매핑이 합리적이다.

| 작업 | 권장 모델 | 이유 |
| --- | --- | --- |
| 실시간 카드 추천, 활동 요약, 턴 생성 | `gpt-5.4-mini` | 속도와 비용 균형 |
| 설계안 종합 비평, 위험 종합 분석 | `gpt-5.4` | 더 높은 추론 품질 |
| 최종 성찰 질문 생성 | `gpt-5.4` | 사건 기반 종합 성찰에 유리 |

추론 강도 권장 기본값:

- Page 1 실시간 보조: `reasoning_effort: low` 또는 `medium`
- Page 2 종합 분석: `reasoning_effort: medium` 또는 `high`

### 9.3 구조화 출력 원칙

OpenAI 함수 호출 가이드는 strict schema 사용 시 모든 object에 `additionalProperties: false`, 모든 `properties`의 `required` 지정 같은 제약을 만족해야 한다고 설명한다. 또한 Responses에서는 strict 정규화가 기본 동작이 될 수 있으므로, 이 프로젝트는 애매한 기본값에 기대지 말고 명시적으로 strict schema를 작성하는 편이 안전하다. [R10][R11]

따라서 구현 원칙은 다음으로 고정한다.

- 모든 핵심 출력은 JSON Schema 기반으로 강제
- 자유 텍스트는 `summary`, `observerNote`, `reflectionPrompt` 정도에만 허용
- UI 상태에 반영되는 값은 enum/array/object로 제한

### 9.4 서버 전용 호출 원칙

OpenAI 키는 절대 브라우저로 보내지 않는다. Vercel 환경변수는 source code 밖에서 관리되며, 빌드 시점과 함수 실행 시점 모두에서 읽을 수 있다. 환경별로 값을 나눌 수 있으므로 Preview/Production을 분리하는 것이 맞다. [R13]

즉 다음 구조가 맞다.

- `app/api/design/analyze/route.ts`
- `app/api/simulation/step/route.ts`
- `app/api/simulation/risks/route.ts`
- `app/api/reflection/questions/route.ts`

브라우저는 이 Route Handler만 호출한다.

### 9.5 함수 도구 설계 권장안

#### 1) `analyze_lesson_design`

입력:

- 수업 메타
- 활동 배열
- 카드 배치 결과

출력:

- 설계 요약
- 누락된 개입 지점
- 예상 취약 리스크
- 개선 제안

#### 2) `simulate_lesson_turn`

입력:

- 설계 스냅샷
- 이전 턴 로그
- 현재 활동

출력:

- 교사 행동
- AI 행동
- 예상 학생 반응
- 관찰 포인트
- 링크된 카드

#### 3) `detect_orchestration_risks`

입력:

- 설계 스냅샷
- 누적 턴 로그

출력:

- 위험 타입
- 심각도
- 증거 턴
- 원인 설명
- 권장 개입

#### 4) `generate_reflection_questions`

입력:

- 설계 스냅샷
- 위험 리스트
- 턴 로그

출력:

- 질문 목록
- 질문별 근거 턴
- 다음 차시 수정 포인트

### 9.6 API 응답 구조 예시

```ts
type DetectedRisk = {
  id: string;
  riskType:
    | "AI_OVER_RELIANCE"
    | "SHALLOW_LEARNING"
    | "UNGROUNDED_JUDGMENT"
    | "UNCLEAR_ACCOUNTABILITY"
    | "NO_HUMAN_FINAL_DECISION"
    | "PSYCHOLOGICAL_SAFETY_RISK"
    | "CARD_BEHAVIOR_MISMATCH";
  severity: "low" | "medium" | "high";
  evidenceTurnIds: string[];
  rationale: string;
  recommendedIntervention: string;
  relatedCardIds: string[];
};
```

## 10. 정보 구조와 데이터 모델

### 10.1 최소 타입 집합

아래 타입은 초기 버전의 최소 공통 모델로 고정하는 것이 적절하다.

```ts
type OrchestrationCard = {
  id: string;
  actor: "teacher" | "ai";
  category: string;
  title: string;
  prompt: string;
  intent: string;
};

type CardPlacement = {
  id: string;
  activityId: string;
  cardId: string;
  slot: "human" | "ai";
  position: number;
  note?: string;
};

type LessonActivity = {
  id: string;
  order: number;
  title: string;
  functionLabel: string;
  subjectLabel: string;
  learningObjective: string;
  learningActivity: string;
  assessmentMethod: string;
  teacherMove: string;
  tools: string[];
  humanCardIds: string[];
  aiCardIds: string[];
  evidenceOfSuccess: string[];
  notes?: string;
};

type LessonDesign = {
  id: string;
  version: number;
  title: string;
  topic: string;
  subject: string;
  target: string;
  durationMinutes: number;
  learningGoals: string[];
  activities: LessonActivity[];
  placements: CardPlacement[];
  createdAt: string;
  updatedAt: string;
};

type SimulationTurn = {
  id: string;
  simulationRunId: string;
  turnIndex: number;
  activityId: string;
  teacherAction: string;
  aiAction: string;
  expectedStudentResponse: string;
  evidenceObserved: string[];
  missedOpportunities: string[];
  linkedCardIds: string[];
  observerNote: string;
};

type SimulationRun = {
  id: string;
  lessonDesignId: string;
  designVersion: number;
  mode: "step" | "full-run";
  turns: SimulationTurn[];
  createdAt: string;
};

type ReflectionQuestion = {
  id: string;
  simulationRunId: string;
  prompt: string;
  rationale: string;
  linkedTurnIds: string[];
  linkedRiskIds: string[];
};

type ReflectionJournalEntry = {
  id: string;
  simulationRunId: string;
  summary: string;
  answers: {
    questionId: string;
    answer: string;
  }[];
  nextRevisionNotes: string[];
  createdAt: string;
};
```

### 10.2 저장 전략

DB 저장을 권장하는 이유는 명확하다.

- 설계안은 버전이 쌓여야 한다.
- 시뮬레이션은 특정 설계 버전에 대한 증거로 남아야 한다.
- 성찰 일지는 설계와 실행 사이를 연결하는 지식 자산이다.

따라서 저장 규칙은 다음으로 고정한다.

- `LessonDesign`는 버전형 저장
- `SimulationRun`은 해당 버전의 스냅샷 기준 저장
- `ReflectionJournalEntry`는 `SimulationRun`에 종속
- 카드 seed 데이터는 정적 테이블 또는 코드 상수로 시작 가능

### 10.3 권장 테이블

- `lesson_designs`
- `lesson_activities`
- `card_placements`
- `simulation_runs`
- `simulation_turns`
- `detected_risks`
- `reflection_questions`
- `reflection_journal_entries`

## 11. API/컴포넌트 경계 제안

### 11.1 UI 컴포넌트

- `LessonMetaForm`
- `CardLibraryPanel`
- `ActivityCanvas`
- `ActivityBlock`
- `CardDropZone`
- `SimulationTimeline`
- `RiskPanel`
- `ReflectionJournalPanel`

### 11.2 API 경로

- `GET /api/cards`
- `POST /api/design/analyze`
- `POST /api/simulation/step`
- `POST /api/simulation/run`
- `POST /api/simulation/risks`
- `POST /api/reflection/questions`
- `POST /api/reflection/journal`

### 11.3 서버에서만 해야 하는 일

- OpenAI 호출
- 위험 탐지 결과 저장
- 설계 버전 생성
- 성찰 일지 저장

브라우저는 상태 편집과 렌더링만 담당해야 한다.

## 12. GitHub + Harness 채택 전략

### 12.1 현재 상태

2026-04-01 기준 현재 폴더는 Git 저장소가 아니다. 따라서 GitHub/Vercel 배포 이전에 먼저 저장소 초기화가 필요하다.

### 12.2 채택 순서

1. GitHub에 새 저장소 생성
2. 현재 폴더를 Git 저장소로 초기화하거나, GitHub 템플릿 기반 저장소를 먼저 만든 뒤 파일 이식
3. `Harness-Engineering`에서 다음 파일을 선택 이식
   - `CLAUDE.md`
   - `AGENTS.md`
   - `architecture.md`
   - `progress.md`
   - `HARNESS_CHANGELOG.md`
   - `.claude/skills/harness`
   - `.claude/skills/edu-harness`
   - `.claude/skills/harness-init`
   - `.claude/skills/execution-loop`
   - `.claude/skills/objective-loop`
   - `.claude/skills/verify`
   - `docs/verification-rubric.md`
4. 프로젝트 목적에 맞게 커스터마이즈
5. 이후 앱 코드를 구현

### 12.3 GitHub 템플릿 전략

GitHub 공식 문서 기준으로 템플릿 저장소는 동일한 디렉터리 구조와 파일을 바탕으로 새 저장소를 만들 수 있다. 이 점 때문에 `Harness-Engineering`은 “개발 스타터”로는 매우 적합하다. 다만 현재 프로젝트는 이미 도메인 문서와 자산이 있으므로, 완전 재생성보다 수동 이식이 더 현실적이다. [R16]

### 12.4 이 프로젝트에서의 권장안

권장안은 다음 둘 중 후자다.

- 덜 권장: `Harness-Engineering`을 그대로 템플릿 복제한 뒤 현재 파일을 이동
- 더 권장: 현재 프로젝트를 기준 저장소로 삼고, 필요한 하네스 파일만 선택 이식

이유:

- 현재 로컬 자료가 이미 프로젝트 핵심 도메인 근거다.
- 앱 설계 연구가 먼저 진행되고 있다.
- 런타임 앱 구조는 `Harness-Engineering`이 직접 제공하지 않는다.

## 13. Vercel 배포 전략

### 13.1 왜 Vercel인가

Next.js App Router 기반 앱을 배포할 때 Vercel은 가장 자연스러운 조합이다. 공식 문서는 Git provider와 연동하여 PR마다 preview URL을 생성할 수 있다고 설명한다. [R12][R14]

이 프로젝트에 Vercel이 적합한 이유:

- Next.js App Router와 자연스러운 통합
- Route Handler 배포 간단
- Preview 배포를 통한 Page 1/2 UX 검증 용이
- 환경변수 관리 분리

### 13.2 Preview/Production 분리

Vercel 공식 문서에 따르면 Preview 환경은 프로덕션에 영향을 주지 않고 변경 사항을 테스트할 수 있으며, 비생산 브랜치 푸시나 PR 생성 시 자동 URL이 부여된다. [R12]

이 프로젝트에서는 이를 다음과 같이 써야 한다.

- Preview
  - 새 Page 1/2 흐름 테스트
  - 드래그앤드롭 접근성 테스트
  - OpenAI 프롬프트 조정
- Production
  - 안정화된 설계/시뮬레이션 흐름

### 13.3 환경변수 전략

Vercel 공식 문서는 환경변수가 Environment별로 다르게 적용될 수 있고, Preview/Production/Development를 분리할 수 있다고 설명한다. [R13]

필수 환경변수 예시:

- `OPENAI_API_KEY`
- `DATABASE_URL`
- `DIRECT_URL` 또는 provider-specific admin URL
- `OPENAI_MODEL_FAST=gpt-5.4-mini`
- `OPENAI_MODEL_DEEP=gpt-5.4`

원칙:

- `OPENAI_API_KEY`는 Preview/Production에서 분리 관리
- 클라이언트 컴포넌트에는 절대 주입하지 않음
- 브라우저에 노출 가능한 `NEXT_PUBLIC_*` 변수로 옮기지 않음

### 13.4 저장소/DB 선택

Vercel 공식 문서는 Storage와 Marketplace 연동을 제공한다. 본 프로젝트는 정형 데이터와 시뮬레이션 로그 저장이 핵심이므로 Postgres가 기본값이어야 한다. [R14]

Neon 또는 Supabase 같은 Postgres 제공자는 충분히 적합하지만, 이는 Vercel 공식 문서가 특정 한 제공자를 강제한다기보다, Postgres 중심 저장이 본 프로젝트에 맞는다는 연구적 권고다.

이 판단은 공식 문서와 프로젝트 요구사항을 결합한 **추론**이다.

## 14. 품질 및 검증 체계

`Harness-Engineering`의 교육용 검증 철학은 그대로 가져오되, 이 프로젝트 도메인에 맞게 6축으로 재구성하는 것이 가장 적절하다. [R6]

### 14.1 6축

1. 기술 품질
2. 교육학적 적절성
3. Human-AI Agency
4. 접근성
5. 데이터 보호
6. 성능

### 14.2 각 축의 의미

기술 품질:

- 타입 안정성
- 테스트
- 라우트 핸들러 경계
- 오류 처리

교육학적 적절성:

- 활동 목표와 학생 과제가 연결되는가
- 성찰 질문이 실제 수업 사건과 연결되는가

Human-AI Agency:

- 인간의 최종 판단이 남아 있는가
- AI가 사고를 대체하지 않고 증폭하는가
- 역할과 책임이 구조화되어 있는가

접근성:

- 드래그앤드롭의 키보드 지원
- 스크린리더 안내
- 명확한 레이블

데이터 보호:

- API 키 브라우저 노출 금지
- 최소 데이터 수집
- 시뮬레이션 로그의 접근 제어

성능:

- Page 1 상호작용 지연 최소화
- Page 2 스트리밍 또는 단계별 처리

### 14.3 제품별 수용 기준

- `AI_교육카드.md` 20장이 누락 없이 구조화 데이터로 정규화된다.
- 카드 배치 결과가 Page 2 입력으로 직렬화된다.
- “AI가 답 제시, 교사는 결과 수용” 구조를 넣으면 `AI 과의존`, `교사의 최종 판단 부재`가 탐지된다.
- `비교 질문`, `근거 기반 토론`, `최종 판단` 카드가 있으면 시뮬레이션 로그에 관련 개입이 실제로 나타난다.
- 성찰 질문은 특정 턴과 연결된다.
- OpenAI 구조화 출력이 스키마를 어기면 안전한 오류 처리 또는 재시도 경로로 떨어진다.
- Vercel Preview에서 `OPENAI_API_KEY`가 브라우저 번들로 노출되지 않는다.

## 15. 구현 로드맵

### Phase 1. 연구문서와 seed 데이터 확정

- `research.md` 작성
- 카드 20장 정규화
- 리스크 taxonomy 확정

### Phase 2. 하네스 도입

- Git 저장소 초기화
- `Harness-Engineering`에서 문서/스킬/검증 체계 선택 이식
- `CLAUDE.md`, `AGENTS.md`, `architecture.md`, `progress.md` 커스터마이즈

### Phase 3. Page 1 구현

- 카드 라이브러리
- 활동 캔버스
- 키보드 접근 가능한 드래그앤드롭
- 설계 저장

### Phase 4. Page 2 구현

- 시뮬레이션 타임라인
- 위험 패널
- OpenAI 호출 경로
- 설계 스냅샷 기반 멀티턴 실행

### Phase 5. 성찰 기능

- 성찰 질문 생성
- 일지 작성/저장
- Markdown 내보내기

### Phase 6. 검증 자동화

- 하네스 verify 기준 프로젝트에 맞게 조정
- 접근성, 타입, 보안, Agency 체크

### Phase 7. GitHub + Vercel 배포

- Preview/Production 연결
- 환경변수 분리
- PR 기반 검증 흐름 운영

## 16. 실무적 권고안

### 16.1 바로 구현하지 말고 먼저 고정해야 하는 것

- 카드 seed JSON
- Page 1 activity schema
- Page 2 risk taxonomy
- OpenAI function schema
- DB 기본 테이블

이 다섯 가지가 흔들리면 UI를 먼저 만들어도 나중에 다시 갈아엎게 된다.

### 16.2 MVP에서 제외해도 되는 것

- 사용자가 임의의 카드셋 파일을 업로드하는 기능
- 음성 모의수업
- 멀티사용자 협업 편집
- 고급 분석 대시보드

### 16.3 MVP에서 반드시 있어야 하는 것

- 20개 카드의 정규화와 배치
- 활동-카드-위험 연결 구조
- 멀티턴 시뮬레이션
- 사건 기반 성찰 질문
- 서버 전용 OpenAI 호출

## 17. 최종 판단

이 프로젝트의 성공 여부는 디자인 완성도보다 먼저, 다음 세 가지를 얼마나 분명히 구현하느냐에 달려 있다.

1. 수업 설계가 `Human-AI Agency` 관점으로 구조화되는가
2. 시뮬레이션이 실제로 얕은 학습과 AI 의존을 포착하는가
3. 하네스가 개발 프로세스를 지속적으로 정교화하는가

따라서 가장 적절한 구현 방향은 다음으로 요약된다.

- 제품은 `설계 → 시뮬레이션 → 성찰` 3단 구조로 간다.
- 앱 내부에는 `Design Planner`, `Simulation Conductor`, `Risk Observer`, `Reflection Coach` 네 에이전트를 둔다.
- 개발 프로세스에는 `Harness-Engineering`의 문서/스킬/검증 체계를 채택한다.
- 인프라는 `Next.js + Vercel + Postgres + OpenAI Responses API`로 간다.

이 조합이 현재 로컬 자료의 교육학적 요구와 최신 OpenAI/Vercel/GitHub 배포 현실을 가장 자연스럽게 잇는다.

## 참고 자료

### 로컬 자료

- [R1] [AI_교육카드.md](./AI_교육카드.md)
- [R2] [20260403 AI 시대, AI 리터러시 및 윤리.md](./20260403%20AI%20시대,%20AI%20리터러시%20및%20윤리.md)

### Harness-Engineering

- [R3] `Harness-Engineering` 저장소: https://github.com/tigerjk9/Harness-Engineering
- [R4] README: https://github.com/tigerjk9/Harness-Engineering/blob/main/README.md
- [R5] PRD: https://github.com/tigerjk9/Harness-Engineering/blob/main/docs/PRD.md
- [R6] `edu-harness` 및 검증 루브릭:
  - https://github.com/tigerjk9/Harness-Engineering/blob/main/.claude/skills/edu-harness/SKILL.md
  - https://github.com/tigerjk9/Harness-Engineering/blob/main/docs/verification-rubric.md

### OpenAI 공식 문서

- [R7] Models overview: https://developers.openai.com/api/docs/models/all
- [R8] GPT-5.4: https://developers.openai.com/api/docs/models/gpt-5.4
- [R9] GPT-5.4 mini: https://developers.openai.com/api/docs/models/gpt-5.4-mini
- [R10] Function calling guide: https://platform.openai.com/docs/guides/function-calling?api-mode=responses
- [R11] Structured outputs / Responses reference:
  - https://platform.openai.com/docs/guides/structured-outputs?lang=javascript
  - https://platform.openai.com/docs/api-reference/responses/compact?api-mode=responses

### Vercel / GitHub 공식 문서

- [R12] Vercel Preview Environment: https://vercel.com/docs/deployments/environments#preview-environment-pre-production
- [R13] Vercel Environment Variables: https://vercel.com/docs/environment-variables
- [R14] Vercel Next.js / Storage:
  - https://vercel.com/docs/frameworks/full-stack/nextjs
  - https://vercel.com/docs/storage
  - https://vercel.com/docs/postgres
- [R15] dnd-kit accessibility guide: https://dndkit.com/legacy/guides/accessibility
- [R16] GitHub template repository docs:
  - https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository
  - https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template
