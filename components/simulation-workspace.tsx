"use client";

import Link from "next/link";
import { normalizeLessonDesignDraft, parseMultilineField } from "@/lib/design";
import { riskLabels } from "@/lib/constants";
import { buildReflectionMarkdown } from "@/lib/orchestration";
import {
  loadStoredDesign,
  loadStoredSimulation,
  saveStoredDesign,
  saveStoredSimulation,
} from "@/lib/storage";
import {
  fetchWorkspaceSnapshot,
  saveDesignToWorkspace,
  saveSimulationSessionToWorkspace,
} from "@/lib/workspace-client";
import type {
  DesignAnalysis,
  DetectedRisk,
  LessonDesign,
  ReflectionJournalEntry,
  ReflectionQuestion,
  SimulationTurn,
} from "@/types/lesson";
import type {
  SimulationSessionRecord,
  StoredSimulationState,
} from "@/types/workspace";
import { useEffect, useMemo, useState } from "react";

function buildJournal(
  simulationRunId: string | null,
  summary: string,
  answers: Record<string, string>,
  nextRevisionText: string,
): ReflectionJournalEntry | null {
  if (!simulationRunId) {
    return null;
  }

  const hasAnswers = Object.values(answers).some((answer) => answer.trim().length > 0);
  const hasSummary = summary.trim().length > 0;
  const hasNextRevision = parseMultilineField(nextRevisionText).length > 0;

  if (!hasAnswers && !hasSummary && !hasNextRevision) {
    return null;
  }

  return {
    id: `journal-${simulationRunId}`,
    simulationRunId,
    summary,
    answers: Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    })),
    nextRevisionNotes: parseMultilineField(nextRevisionText),
    createdAt: new Date().toISOString(),
  };
}

function formatSyncTime(value: string | null) {
  if (!value) {
    return "없음";
  }

  return new Date(value).toLocaleString("ko-KR");
}

function buildSessionRecord(input: {
  design: LessonDesign | null;
  simulationRunId: string | null;
  analysis: DesignAnalysis | null;
  turns: SimulationTurn[];
  risks: DetectedRisk[];
  questions: ReflectionQuestion[];
  summary: string;
  answers: Record<string, string>;
  nextRevisionText: string;
}): SimulationSessionRecord | null {
  if (!input.design || !input.simulationRunId) {
    return null;
  }

  return {
    id: input.simulationRunId,
    lessonDesignId: input.design.id,
    designVersion: input.design.version,
    analysis: input.analysis,
    turns: input.turns,
    risks: input.risks,
    questions: input.questions,
    journal: buildJournal(
      input.simulationRunId,
      input.summary,
      input.answers,
      input.nextRevisionText,
    ),
    updatedAt: new Date().toISOString(),
  };
}

function formatSessionLabel(session: SimulationSessionRecord) {
  return `실행 ${session.id.slice(0, 8)} · v${session.designVersion}`;
}

export function SimulationWorkspace() {
  const [design, setDesign] = useState<LessonDesign | null>(null);
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [turns, setTurns] = useState<SimulationTurn[]>([]);
  const [risks, setRisks] = useState<DetectedRisk[]>([]);
  const [questions, setQuestions] = useState<ReflectionQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [nextRevisionText, setNextRevisionText] = useState("");
  const [simulationRunId, setSimulationRunId] = useState<string | null>(null);
  const [message, setMessage] = useState("설계안을 불러오는 중입니다.");
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [serverSessions, setServerSessions] = useState<SimulationSessionRecord[]>([]);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);

  const designSessions = useMemo(() => {
    if (!design) {
      return [];
    }

    return serverSessions.filter((session) => session.lessonDesignId === design.id);
  }, [design, serverSessions]);

  function applyStoredSimulationState(state: StoredSimulationState) {
    setAnalysis(state.analysis);
    setTurns(state.turns);
    setRisks(state.risks);
    setQuestions(state.questions);
    setSimulationRunId(
      state.turns[0]?.simulationRunId ??
        state.questions[0]?.simulationRunId ??
        state.journal?.simulationRunId ??
        null,
    );

    if (state.journal) {
      setSummary(state.journal.summary);
      setAnswers(
        Object.fromEntries(
          state.journal.answers.map((answer) => [answer.questionId, answer.answer]),
        ),
      );
      setNextRevisionText(state.journal.nextRevisionNotes.join("\n"));
    }
  }

  function applySessionRecord(session: SimulationSessionRecord) {
    setAnalysis(session.analysis);
    setTurns(session.turns);
    setRisks(session.risks);
    setQuestions(session.questions);
    setSimulationRunId(session.id);

    if (session.journal) {
      setSummary(session.journal.summary);
      setAnswers(
        Object.fromEntries(
          session.journal.answers.map((answer) => [answer.questionId, answer.answer]),
        ),
      );
      setNextRevisionText(session.journal.nextRevisionNotes.join("\n"));
    } else {
      setSummary("");
      setAnswers({});
      setNextRevisionText("");
    }
  }

  useEffect(() => {
    let active = true;

    async function hydrateWorkspace() {
      const storedDesign = loadStoredDesign();
      const storedSimulation = loadStoredSimulation();

      try {
        const snapshot = await fetchWorkspaceSnapshot();
        if (!active) {
          return;
        }

        const nextDesign = snapshot.currentDesign ?? storedDesign;
        setDesign(nextDesign ? normalizeLessonDesignDraft(nextDesign) : null);
        setServerSessions(snapshot.sessions);
        setLastServerSyncAt(snapshot.updatedAt);

        if (snapshot.latestSession) {
          applySessionRecord(snapshot.latestSession);
        } else if (storedSimulation) {
          applyStoredSimulationState(storedSimulation);
        }

        setMessage(
          nextDesign
            ? snapshot.latestSession
              ? "서버 저장본과 최근 실행 세션을 불러왔습니다."
              : "설계안을 불러왔습니다. 모의수업을 실행해 보세요."
            : "저장된 설계안이 없습니다. 1페이지에서 설계를 먼저 작성하세요.",
        );
      } catch {
        if (!active) {
          return;
        }

        setDesign(storedDesign);
        if (storedSimulation) {
          applyStoredSimulationState(storedSimulation);
        }
        setMessage(
          storedDesign
            ? "서버 저장소 대신 브라우저 저장본을 불러왔습니다."
            : "저장된 설계안이 없습니다. 1페이지에서 설계를 먼저 작성하세요.",
        );
      }
    }

    void hydrateWorkspace();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveStoredSimulation({
      analysis,
      turns,
      risks,
      questions,
      journal: buildJournal(simulationRunId, summary, answers, nextRevisionText),
    });
  }, [analysis, turns, risks, questions, simulationRunId, summary, answers, nextRevisionText]);

  async function runSimulation() {
    if (!design) {
      return;
    }

    setIsRunning(true);
    setMessage("설계안을 기준으로 시뮬레이션을 준비합니다.");

    try {
      const nextDesign = normalizeLessonDesignDraft(design, {
        version: design.version + 1,
      });
      setDesign(nextDesign);
      saveStoredDesign(nextDesign);
      setSummary("");
      setAnswers({});
      setNextRevisionText("");

      try {
        const savedDesign = await saveDesignToWorkspace({
          design: nextDesign,
          persistVersion: true,
        });
        setLastServerSyncAt(savedDesign.updatedAt);
      } catch {
        setMessage("서버 저장 없이 시뮬레이션을 계속 진행합니다.");
      }

      const analysisResponse = await fetch("/api/design/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ design: nextDesign }),
      });

      if (!analysisResponse.ok) {
        throw new Error("설계 분석 단계가 실패했습니다.");
      }

      const analysisPayload = (await analysisResponse.json()) as {
        analysis: DesignAnalysis;
      };
      setAnalysis(analysisPayload.analysis);

      const runId = crypto.randomUUID();
      setSimulationRunId(runId);
      setTurns([]);
      setRisks([]);
      setQuestions([]);

      const generatedTurns: SimulationTurn[] = [];

      for (const activity of nextDesign.activities) {
        setMessage(`${activity.order}번째 활동을 시뮬레이션하는 중입니다.`);

        const response = await fetch("/api/simulation/step", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            design: nextDesign,
            activity,
            previousTurns: generatedTurns,
            simulationRunId: runId,
          }),
        });

        if (!response.ok) {
          throw new Error(`${activity.order}번째 활동 시뮬레이션이 실패했습니다.`);
        }

        const payload = (await response.json()) as { turn: SimulationTurn };
        generatedTurns.push(payload.turn);
        setTurns([...generatedTurns]);
      }

      setMessage("위험 탐지와 성찰 질문을 생성하고 있습니다.");

      const riskResponse = await fetch("/api/simulation/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ design: nextDesign, turns: generatedTurns }),
      });

      if (!riskResponse.ok) {
        throw new Error("위험 탐지 단계가 실패했습니다.");
      }

      const riskPayload = (await riskResponse.json()) as { risks: DetectedRisk[] };
      setRisks(riskPayload.risks);

      const questionResponse = await fetch("/api/reflection/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          design: nextDesign,
          turns: generatedTurns,
          risks: riskPayload.risks,
          simulationRunId: runId,
        }),
      });

      if (!questionResponse.ok) {
        throw new Error("성찰 질문 생성 단계가 실패했습니다.");
      }

      const questionPayload = (await questionResponse.json()) as {
        questions: ReflectionQuestion[];
      };
      setQuestions(questionPayload.questions);

      const session = buildSessionRecord({
        design: nextDesign,
        simulationRunId: runId,
        analysis: analysisPayload.analysis,
        turns: generatedTurns,
        risks: riskPayload.risks,
        questions: questionPayload.questions,
        summary: "",
        answers: {},
        nextRevisionText: "",
      });

      if (session) {
        try {
          const savedSession = await saveSimulationSessionToWorkspace(session);
          setServerSessions(savedSession.sessions);
          setLastServerSyncAt(savedSession.updatedAt);
        } catch {
          setMessage("시뮬레이션은 완료되었지만 서버 저장은 실패했습니다.");
        }
      }

      setMessage("모의수업 실행과 성찰 질문 생성이 완료되었습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "모의수업 실행 중 오류가 발생했습니다.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  async function persistReflectionToServer() {
    const session = buildSessionRecord({
      design,
      simulationRunId,
      analysis,
      turns,
      risks,
      questions,
      summary,
      answers,
      nextRevisionText,
    });

    if (!session) {
      setMessage("먼저 모의수업을 실행한 뒤 성찰 응답을 저장하세요.");
      return;
    }

    setIsSavingReflection(true);

    try {
      const savedSession = await saveSimulationSessionToWorkspace(session);
      setServerSessions(savedSession.sessions);
      setLastServerSyncAt(savedSession.updatedAt);
      setMessage("성찰 응답을 서버 저장소에 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "성찰 응답 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSavingReflection(false);
    }
  }

  function loadSessionFromHistory(session: SimulationSessionRecord) {
    applySessionRecord(session);
    setMessage(`${formatSessionLabel(session)} 세션을 작업 화면에 불러왔습니다.`);
  }

  function exportReflection() {
    if (!design) {
      return;
    }

    const markdown = buildReflectionMarkdown({
      design,
      analysis,
      turns,
      risks,
      questions,
      answers,
      summary,
      nextRevisionNotes: parseMultilineField(nextRevisionText),
    });

    const blob = new Blob([markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${design.meta.topic || "수업-성찰"}-reflection.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("성찰 일지를 markdown 파일로 저장했습니다.");
  }

  if (!design) {
    return (
      <main className="appShell">
        <section className="heroPanel">
          <div>
            <p className="eyebrow">Simulation Workspace</p>
            <h1>저장된 설계안이 없습니다.</h1>
            <p className="heroCopy">
              먼저 1페이지에서 수업 활동과 카드 배치를 설계해야 시뮬레이션을 실행할 수
              있습니다.
            </p>
          </div>
          <div className="heroActions">
            <Link href="/" className="secondaryButton">
              1페이지로 이동
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <section className="heroPanel">
        <div>
          <p className="eyebrow">Step 2</p>
          <h1>모의수업 실행과 성찰 일지</h1>
          <p className="heroCopy">
            설계안을 토대로 인간-AI agency, 깊이 있는 학습, 책임 구조가 실제 수업에서 어떻게
            드러나는지 시뮬레이션합니다. 이어서 위험 장면을 바탕으로 성찰 질문에 응답하고
            수정 포인트를 정리합니다.
          </p>
        </div>
        <div className="heroActions">
          <button type="button" className="primaryButton" onClick={runSimulation}>
            {isRunning ? "실행 중..." : "모의수업 실행"}
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={persistReflectionToServer}
          >
            {isSavingReflection ? "성찰 저장 중..." : "성찰 서버 저장"}
          </button>
          <button type="button" className="secondaryButton" onClick={exportReflection}>
            성찰 일지 저장
          </button>
          <Link href="/" className="ghostButton">
            1페이지로 돌아가기
          </Link>
        </div>
      </section>

      <section className="statusCards">
        <article className="summaryCard">
          <span>활동 수</span>
          <strong>{design.activities.length}</strong>
        </article>
        <article className="summaryCard">
          <span>배치 카드</span>
          <strong>{design.placements.length}</strong>
        </article>
        <article className="summaryCard">
          <span>탐지 위험</span>
          <strong>{risks.length}</strong>
        </article>
        <article className="summaryCard">
          <span>성찰 질문</span>
          <strong>{questions.length}</strong>
        </article>
      </section>

      <section className="workspaceGrid simulationGrid">
        <div className="mainColumn">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">모의수업 로그</p>
                <h2>턴별 실행 기록</h2>
              </div>
              <p className="panelHint">{message}</p>
            </div>

            {turns.length ? (
              <div className="timelineList">
                {turns.map((turn) => (
                  <article key={turn.id} className="timelineCard">
                    <div className="timelineMarker">{turn.turnIndex}</div>
                    <div className="timelineBody">
                      <div className="timelineHeader">
                        <h3>{turn.activityTitle}</h3>
                        <span className="engineBadge">{turn.engine}</span>
                      </div>
                      <dl className="timelineFacts">
                        <div>
                          <dt>교사 행동</dt>
                          <dd>{turn.teacherAction}</dd>
                        </div>
                        <div>
                          <dt>AI 행동</dt>
                          <dd>{turn.aiAction}</dd>
                        </div>
                        <div>
                          <dt>예상 학생 반응</dt>
                          <dd>{turn.expectedStudentResponse}</dd>
                        </div>
                        <div>
                          <dt>놓친 기회</dt>
                          <dd>
                            {turn.missedOpportunities.length
                              ? turn.missedOpportunities.join(" / ")
                              : "두드러진 누락 없음"}
                          </dd>
                        </div>
                      </dl>
                      <div className="evidenceList">
                        {turn.evidenceObserved.map((item) => (
                          <span key={`${turn.id}-${item}`} className="evidenceChip">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">
                아직 시뮬레이션 결과가 없습니다. `모의수업 실행` 버튼으로 시작하세요.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">성찰 일지</p>
                <h2>질문 응답과 수정 계획</h2>
              </div>
              <p className="panelHint">
                질문 응답은 브라우저에 자동 저장되며, 서버 저장 버튼으로 이력을 남길 수 있습니다.
              </p>
            </div>
            <div className="reflectionForm">
              {questions.length ? (
                questions.map((question) => (
                  <label key={question.id} className="reflectionQuestionCard">
                    <span>{question.prompt}</span>
                    <small>{question.rationale}</small>
                    <textarea
                      rows={4}
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                      placeholder="이 장면을 어떻게 수정할지, 어떤 질문을 추가할지 적으세요."
                    />
                  </label>
                ))
              ) : (
                <p className="emptyPanelText">성찰 질문은 시뮬레이션 실행 후 생성됩니다.</p>
              )}

              <label className="reflectionQuestionCard">
                <span>종합 메모</span>
                <small>이번 설계에서 유지할 점과 가장 크게 수정할 점을 함께 정리하세요.</small>
                <textarea
                  rows={5}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="예: AI 제안은 초안 생성에 한정하고, 최종 판단은 근거 토론 뒤에 배치한다."
                />
              </label>

              <label className="reflectionQuestionCard">
                <span>다음 수정 포인트</span>
                <small>한 줄에 하나씩 적으면 markdown 일지의 체크포인트로 저장됩니다.</small>
                <textarea
                  rows={4}
                  value={nextRevisionText}
                  onChange={(event) => setNextRevisionText(event.target.value)}
                  placeholder="예: 도입 활동에 AI 신뢰 점검 카드 추가"
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="sideColumn">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">설계 스냅샷</p>
                <h2>{design.meta.topic || "제목 미입력"}</h2>
              </div>
              <span className="engineBadge">v{design.version}</span>
            </div>
            <div className="snapshotList">
              <div>
                <strong>교과</strong>
                <span>{design.meta.subject || "-"}</span>
              </div>
              <div>
                <strong>대상</strong>
                <span>{design.meta.target || "-"}</span>
              </div>
              <div>
                <strong>학습목표</strong>
                <span>
                  {design.learningGoals.length
                    ? design.learningGoals.join(" / ")
                    : "아직 입력되지 않았습니다."}
                </span>
              </div>
              <div>
                <strong>서버 저장 세션</strong>
                <span>{designSessions.length}개</span>
              </div>
            </div>

            {analysis ? (
              <div className="compactAnalysis">
                <h3>설계 분석</h3>
                <p>{analysis.summary}</p>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">세션 이력</p>
                <h2>저장된 실행 기록</h2>
              </div>
              <p className="panelHint">특정 실행 세션을 다시 불러와 성찰 내용을 이어서 수정할 수 있습니다.</p>
            </div>
            {designSessions.length ? (
              <div className="historyList">
                {designSessions.map((session) => (
                  <article key={session.id} className="historyCard">
                    <div className="historyCardBody">
                      <strong>{formatSessionLabel(session)}</strong>
                      <p>
                        턴 {session.turns.length}개 · 위험 {session.risks.length}개 · 질문 {session.questions.length}개
                      </p>
                      <span>{formatSyncTime(session.updatedAt)}</span>
                    </div>
                    <button
                      type="button"
                      className="tableActionButton"
                      onClick={() => loadSessionFromHistory(session)}
                    >
                      이 세션 불러오기
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">아직 서버에 저장된 실행 세션이 없습니다.</p>
            )}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">위험 탐지</p>
                <h2>포착된 문제점</h2>
              </div>
              <p className="panelHint">Human-AI agency와 깊이 있는 학습 관점</p>
            </div>

            {risks.length ? (
              <div className="riskList">
                {risks.map((risk) => (
                  <article key={risk.id} className={`riskCard risk-${risk.severity}`}>
                    <div className="riskHeader">
                      <h3>{riskLabels[risk.riskType]}</h3>
                      <span>{risk.severity}</span>
                    </div>
                    <p>{risk.rationale}</p>
                    <strong>권장 개입</strong>
                    <p>{risk.recommendedIntervention}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">아직 탐지된 위험이 없습니다.</p>
            )}
          </section>
        </aside>
      </section>

      <footer className="statusBar">
        <div>
          <strong>현재 세션</strong>
          <span>{simulationRunId ?? "아직 실행 전"}</span>
        </div>
        <div>
          <strong>서버 저장 세션</strong>
          <span>{designSessions.length}개</span>
        </div>
        <div>
          <strong>마지막 서버 저장</strong>
          <span>{formatSyncTime(lastServerSyncAt)}</span>
        </div>
        <div>
          <strong>상태 메시지</strong>
          <span>{message}</span>
        </div>
      </footer>
    </main>
  );
}