"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizeLessonDesignDraft, parseMultilineField } from "@/lib/design";
import { riskLabels } from "@/lib/constants";
import { buildSimulationReportSnapshot } from "@/lib/report";
import {
  loadStoredDesign,
  loadStoredReport,
  loadStoredSimulation,
  saveStoredDesign,
  saveStoredReport,
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
  SimulationScenario,
  SimulationTurn,
} from "@/types/lesson";
import type { SimulationSessionRecord, StoredSimulationState } from "@/types/workspace";

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
    answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
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
  scenario: SimulationScenario | null;
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
    scenario: input.scenario,
    turns: input.turns,
    risks: input.risks,
    questions: input.questions,
    journal: buildJournal(input.simulationRunId, input.summary, input.answers, input.nextRevisionText),
    updatedAt: new Date().toISOString(),
  };
}

function formatSessionLabel(session: SimulationSessionRecord) {
  return `실행 ${session.id.slice(0, 8)} · v${session.designVersion}`;
}

export function SimulationWorkspace() {
  const [design, setDesign] = useState<LessonDesign | null>(null);
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [scenario, setScenario] = useState<SimulationScenario | null>(null);
  const [turns, setTurns] = useState<SimulationTurn[]>([]);
  const [risks, setRisks] = useState<DetectedRisk[]>([]);
  const [questions, setQuestions] = useState<ReflectionQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [nextRevisionText, setNextRevisionText] = useState("");
  const [simulationRunId, setSimulationRunId] = useState<string | null>(null);
  const [message, setMessage] = useState("설계본을 불러오는 중입니다.");
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

  const episodeTitleById = useMemo(() => {
    return new Map((scenario?.episodes ?? []).map((episode) => [episode.id, episode.title]));
  }, [scenario]);

  function applyStoredSimulationState(state: StoredSimulationState) {
    setAnalysis(state.analysis);
    setScenario(state.scenario);
    setTurns(state.turns);
    setRisks(state.risks);
    setQuestions(state.questions);
    setSimulationRunId(
      state.turns[0]?.simulationRunId ??
        state.questions[0]?.simulationRunId ??
        state.scenario?.simulationRunId ??
        state.journal?.simulationRunId ??
        null,
    );

    if (state.journal) {
      setSummary(state.journal.summary);
      setAnswers(Object.fromEntries(state.journal.answers.map((answer) => [answer.questionId, answer.answer])));
      setNextRevisionText(state.journal.nextRevisionNotes.join("\n"));
    } else {
      setSummary("");
      setAnswers({});
      setNextRevisionText("");
    }
  }

  function applySessionRecord(session: SimulationSessionRecord) {
    setAnalysis(session.analysis);
    setScenario(session.scenario);
    setTurns(session.turns);
    setRisks(session.risks);
    setQuestions(session.questions);
    setSimulationRunId(session.id);

    if (session.journal) {
      setSummary(session.journal.summary);
      setAnswers(Object.fromEntries(session.journal.answers.map((answer) => [answer.questionId, answer.answer])));
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
      const storedReport = loadStoredReport();

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
              ? "서버 저장본과 가장 최근 시뮬레이션 세션을 불러왔습니다."
              : storedReport
                ? "브라우저에 저장된 리포트와 설계 상태가 있습니다. 필요하면 리포트를 다시 저장해 보세요."
                : "설계본을 불러왔습니다. 이제 모의수업을 실행해 보세요."
            : "저장된 설계가 없습니다. 1페이지에서 수업 설계를 먼저 작성해 주세요.",
        );
      } catch {
        if (!active) {
          return;
        }

        setDesign(storedDesign ? normalizeLessonDesignDraft(storedDesign) : null);
        if (storedSimulation) {
          applyStoredSimulationState(storedSimulation);
        }
        setMessage(
          storedDesign
            ? "서버 연결 없이 브라우저 저장본을 불러왔습니다."
            : "저장된 설계가 없습니다. 1페이지에서 수업 설계를 먼저 작성해 주세요.",
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
      scenario,
      turns,
      risks,
      questions,
      journal: buildJournal(simulationRunId, summary, answers, nextRevisionText),
    });
  }, [analysis, scenario, turns, risks, questions, simulationRunId, summary, answers, nextRevisionText]);

  async function runSimulation() {
    if (!design) {
      return;
    }

    setIsRunning(true);
    setMessage("설계본을 기준으로 시뮬레이션을 준비합니다.");

    try {
      const nextDesign = normalizeLessonDesignDraft(design, { version: design.version + 1 });
      setDesign(nextDesign);
      saveStoredDesign(nextDesign);
      setSummary("");
      setAnswers({});
      setNextRevisionText("");
      setScenario(null);
      setTurns([]);
      setRisks([]);
      setQuestions([]);

      try {
        const savedDesign = await saveDesignToWorkspace({ design: nextDesign, persistVersion: true });
        setLastServerSyncAt(savedDesign.updatedAt);
      } catch {
        setMessage("서버 저장 없이 시뮬레이션을 계속 진행합니다.");
      }

      const analysisResponse = await fetch("/api/design/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: nextDesign }),
      });
      if (!analysisResponse.ok) {
        throw new Error("설계 분석 단계가 실패했습니다.");
      }

      const analysisPayload = (await analysisResponse.json()) as { analysis: DesignAnalysis };
      setAnalysis(analysisPayload.analysis);

      const runId = crypto.randomUUID();
      setSimulationRunId(runId);
      setMessage("수업 시나리오와 핵심 에피소드를 구성하는 중입니다.");

      const scenarioResponse = await fetch("/api/simulation/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design: nextDesign,
          analysis: analysisPayload.analysis,
          simulationRunId: runId,
        }),
      });
      if (!scenarioResponse.ok) {
        throw new Error("수업 시나리오 생성 단계가 실패했습니다.");
      }

      const scenarioPayload = (await scenarioResponse.json()) as { scenario: SimulationScenario };
      setScenario(scenarioPayload.scenario);

      const generatedTurns: SimulationTurn[] = [];
      for (const activity of nextDesign.activities) {
        setMessage(`${activity.order}차 활동을 시뮬레이션하는 중입니다.`);

        const response = await fetch("/api/simulation/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            design: nextDesign,
            activity,
            scenario: scenarioPayload.scenario,
            previousTurns: generatedTurns,
            simulationRunId: runId,
          }),
        });

        if (!response.ok) {
          throw new Error(`${activity.order}차 활동 시뮬레이션이 실패했습니다.`);
        }

        const payload = (await response.json()) as { turn: SimulationTurn };
        generatedTurns.push(payload.turn);
        setTurns([...generatedTurns]);
      }

      setMessage("위험 요소와 성찰 질문을 생성하는 중입니다.");

      const riskResponse = await fetch("/api/simulation/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: nextDesign, turns: generatedTurns }),
      });
      if (!riskResponse.ok) {
        throw new Error("위험 분석 단계가 실패했습니다.");
      }

      const riskPayload = (await riskResponse.json()) as { risks: DetectedRisk[] };
      setRisks(riskPayload.risks);

      const questionResponse = await fetch("/api/reflection/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const questionPayload = (await questionResponse.json()) as { questions: ReflectionQuestion[] };
      setQuestions(questionPayload.questions);

      const session = buildSessionRecord({
        design: nextDesign,
        simulationRunId: runId,
        analysis: analysisPayload.analysis,
        scenario: scenarioPayload.scenario,
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
          setMessage("시뮬레이션은 완료됐지만 서버 저장에는 실패했습니다.");
        }
      }

      setMessage("모의수업 시나리오, 에피소드, 실행 로그, 성찰 질문 생성이 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "모의수업 실행 중 오류가 발생했습니다.");
    } finally {
      setIsRunning(false);
    }
  }

  async function persistReflectionToServer() {
    const session = buildSessionRecord({
      design,
      simulationRunId,
      analysis,
      scenario,
      turns,
      risks,
      questions,
      summary,
      answers,
      nextRevisionText,
    });

    if (!session) {
      setMessage("먼저 모의수업을 실행하고 성찰 응답을 작성해 주세요.");
      return;
    }

    setIsSavingReflection(true);
    try {
      const savedSession = await saveSimulationSessionToWorkspace(session);
      setServerSessions(savedSession.sessions);
      setLastServerSyncAt(savedSession.updatedAt);
      setMessage("성찰 응답을 서버 저장소에 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "성찰 응답 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingReflection(false);
    }
  }

  function loadSessionFromHistory(session: SimulationSessionRecord) {
    applySessionRecord(session);
    setMessage(`${formatSessionLabel(session)} 세션을 작업 화면으로 불러왔습니다.`);
  }

  function saveReport() {
    if (!design) {
      return;
    }

    if (!scenario && !turns.length && !questions.length) {
      setMessage("먼저 모의수업 실행 후 리포트를 저장해 주세요.");
      return;
    }

    const report = buildSimulationReportSnapshot({
      design,
      analysis,
      scenario,
      turns,
      risks,
      questions,
      answers,
      summary,
      nextRevisionNotes: parseMultilineField(nextRevisionText),
    });

    saveStoredReport(report);
    const opened = window.open("/report", "_blank", "noopener,noreferrer");

    if (!opened) {
      setMessage("팝업이 차단되어 리포트를 새 탭으로 열지 못했습니다. /report 페이지를 직접 열어 주세요.");
      return;
    }

    setMessage("리포트를 새 탭에서 열었습니다. 페이지에서 PDF로 저장하거나 HTML을 다운로드할 수 있습니다.");
  }

  const highRiskCount = risks.filter((risk) => risk.severity === "high").length;
  const mediumRiskCount = risks.filter((risk) => risk.severity === "medium").length;
  const lowRiskCount = risks.filter((risk) => risk.severity === "low").length;

  if (!design) {
    return (
      <main className="appShell">
        <section className="heroPanel">
          <div>
            <p className="eyebrow">Simulation Workspace</p>
            <h1>저장된 설계가 없습니다.</h1>
            <p className="heroCopy">
              먼저 1페이지에서 수업 활동과 카드 배치를 설계해야 모의수업과 성찰 일지를 실행할 수 있습니다.
            </p>
          </div>
          <div className="heroActions">
            <Link href="/" className="secondaryButton">1페이지로 이동</Link>
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
            설계안을 바탕으로 Human-AI agency, 깊이 있는 학습, 책임 구조가 실제 수업에서 어떻게 드러나는지 시뮬레이션합니다.
            먼저 수업 시나리오와 에피소드를 제시하고, 이어서 실행 로그와 위험, 성찰 질문을 생성합니다.
          </p>
          <div className="heroActions">
            <button type="button" className="primaryButton" onClick={runSimulation}>
              {isRunning ? "실행 중..." : "모의수업 실행"}
            </button>
            <button type="button" className="secondaryButton" onClick={persistReflectionToServer}>
              {isSavingReflection ? "성찰 저장 중..." : "성찰 서버 저장"}
            </button>
            <button type="button" className="secondaryButton" onClick={saveReport}>
              리포트 저장하기
            </button>
            <Link href="/" className="ghostButton">1페이지로 돌아가기</Link>
          </div>
        </div>
        <div className="heroStatRack">
          <article className="heroStatCard"><span>모의 활동</span><strong>{design.activities.length}</strong></article>
          <article className="heroStatCard"><span>에피소드</span><strong>{scenario?.episodes.length ?? 0}</strong></article>
          <article className="heroStatCard"><span>포착 위험</span><strong>{risks.length}</strong></article>
        </div>
      </section>

      <section className="statusCards">
        <article className="summaryCard"><span>활동 수</span><strong>{design.activities.length}</strong></article>
        <article className="summaryCard"><span>배치 카드</span><strong>{design.placements.length}</strong></article>
        <article className="summaryCard"><span>에피소드</span><strong>{scenario?.episodes.length ?? 0}</strong></article>
        <article className="summaryCard"><span>성찰 질문</span><strong>{questions.length}</strong></article>
      </section>

      <section className="workspaceGrid simulationGrid">
        <div className="mainColumn">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Lesson Scenario</p>
                <h2>수업 시나리오와 에피소드</h2>
              </div>
              <p className="panelHint">모의수업 실행을 누르면 설계를 따른 장면이 먼저 구성되고, 각 에피소드마다 잘되는 모습과 잘 안되는 모습이 함께 제시됩니다.</p>
            </div>

            {scenario ? (
              <div className="scenarioStack">
                <article className="scenarioHeroCard">
                  <div>
                    <p className="sectionMicroTag">Simulation Storyline</p>
                    <h3>{scenario.title}</h3>
                    <p>{scenario.setting}</p>
                  </div>
                  <div className="scenarioMetaGrid">
                    <article className="scenarioMetaCard">
                      <span>학습 흐름</span>
                      <strong>{scenario.learningArc}</strong>
                    </article>
                    <article className="scenarioMetaCard">
                      <span>관찰 포인트</span>
                      <strong>{scenario.facilitatorBrief}</strong>
                    </article>
                    <article className="scenarioMetaCard">
                      <span>엔진</span>
                      <strong>{scenario.engine}</strong>
                    </article>
                  </div>
                </article>

                <div className="scenarioEpisodeList">
                  {scenario.episodes.map((episode, index) => (
                    <article key={episode.id} className="scenarioEpisodeCard">
                      <div className="scenarioEpisodeHeader">
                        <span className="scenarioEpisodeIndex">Episode {index + 1}</span>
                        <span className="scenarioLensBadge">{episode.lens}</span>
                      </div>
                      <h3>{episode.title}</h3>
                      <p className="scenarioEpisodeNarrative">{episode.narrative}</p>
                      <div className="scenarioContrastGrid">
                        <div className="scenarioContrastCard scenarioContrastCard-positive">
                          <strong>잘되고 있는 모습</strong>
                          <p>{episode.successScene || "설계를 따라갈 때 드러나는 긍정 장면이 여기에 제시됩니다."}</p>
                        </div>
                        <div className="scenarioContrastCard scenarioContrastCard-negative">
                          <strong>잘 안되는 모습</strong>
                          <p>{episode.challengeScene || "같은 설계 안에서도 흔들릴 수 있는 장면이 여기에 제시됩니다."}</p>
                        </div>
                      </div>
                      <div className="scenarioEpisodeDetails">
                        <div>
                          <strong>Human agency</strong>
                          <p>{episode.humanAgencyFocus}</p>
                        </div>
                        <div>
                          <strong>AI agency</strong>
                          <p>{episode.aiAgencyFocus}</p>
                        </div>
                        <div>
                          <strong>학생 학습 신호</strong>
                          <p>{episode.studentLearningSignal}</p>
                        </div>
                        <div>
                          <strong>잠재 긴장</strong>
                          <p>{episode.possibleTension}</p>
                        </div>
                      </div>
                      {episode.linkedCardIds.length ? (
                        <div className="linkedCardList">
                          {episode.linkedCardIds.map((cardId) => (
                            <span key={`${episode.id}-${cardId}`} className="linkedCardChip">{cardId}</span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p className="emptyPanelText">아직 시뮬레이션 시나리오가 없습니다. `모의수업 실행` 버튼으로 시작해 주세요.</p>
            )}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Simulation Log</p>
                <h2>모의 수업 실행 결과</h2>
              </div>
              <p className="panelHint">{message}</p>
            </div>
            <div className="tableStageBar simulationStageBar">
              <article className="stageChip"><span>현재 세션</span><strong>{simulationRunId ? simulationRunId.slice(0, 8) : "실행 전"}</strong></article>
              <article className="stageChip"><span>분석 엔진</span><strong>{analysis?.engine ?? "대기 중"}</strong></article>
              <article className="stageChip"><span>마지막 서버 동기화</span><strong>{formatSyncTime(lastServerSyncAt)}</strong></article>
            </div>

            {turns.length ? (
              <div className="timelineList timelineRail">
                {turns.map((turn) => (
                  <article key={turn.id} className="timelineCard">
                    <div className="timelineMarker">{turn.turnIndex}</div>
                    <div className="timelineBody">
                      <div className="timelineHeader">
                        <div className="timelineTitleBlock">
                          <h3>{turn.activityTitle}</h3>
                          {turn.scenarioEpisodeId ? (
                            <span className="scenarioLinkBadge">{episodeTitleById.get(turn.scenarioEpisodeId) ?? "연결 에피소드"}</span>
                          ) : null}
                        </div>
                        <span className="engineBadge">{turn.engine}</span>
                      </div>
                      <dl className="timelineFacts">
                        <div><dt>교사 행동</dt><dd>{turn.teacherAction}</dd></div>
                        <div><dt>AI 행동</dt><dd>{turn.aiAction}</dd></div>
                        <div><dt>예상 학생 반응</dt><dd>{turn.expectedStudentResponse}</dd></div>
                        <div><dt>놓친 기회</dt><dd>{turn.missedOpportunities.length ? turn.missedOpportunities.join(" / ") : "특별한 누락 없음"}</dd></div>
                      </dl>
                      <div className="evidenceList">
                        {turn.evidenceObserved.map((item) => (
                          <span key={`${turn.id}-${item}`} className="evidenceChip">{item}</span>
                        ))}
                      </div>
                      {turn.linkedCardIds.length ? (
                        <div className="linkedCardList">
                          {turn.linkedCardIds.map((cardId) => (
                            <span key={`${turn.id}-${cardId}`} className="linkedCardChip">{cardId}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="timelineObserverNote">
                        <strong>관찰 메모</strong>
                        <p>{turn.observerNote}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">아직 시뮬레이션 결과가 없습니다. `모의수업 실행` 버튼으로 시작해 주세요.</p>
            )}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Reflection Journal</p>
                <h2>성찰 질문과 응답</h2>
              </div>
              <p className="panelHint">응답은 브라우저에 자동 저장되며 서버 저장 버튼으로 세션 이력에 남길 수 있습니다.</p>
            </div>
            <div className="reflectionSplit">
              <div className="reflectionColumn">
                <div className="reflectionColumnHeader">
                  <p className="sectionMicroTag">AI Reflection Questions</p>
                  <h3>성찰 질문</h3>
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
                          onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                          placeholder="이 장면에서 무엇을 수정할지, 어떤 질문을 더 추가할지 적어 주세요."
                        />
                      </label>
                    ))
                  ) : (
                    <p className="emptyPanelText">성찰 질문은 시뮬레이션 실행 후 생성됩니다.</p>
                  )}
                </div>
              </div>
              <div className="reflectionStack">
                <label className="reflectionQuestionCard reflectionSummaryCard">
                  <span>종합 메모</span>
                  <small>이번 설계에서 유지할 강점과 수정이 필요한 지점을 요약합니다.</small>
                  <textarea
                    rows={5}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="예: AI의 초안 생성은 유지하되, 최종 판단과 근거 토론은 교사 질문으로 다시 배치한다."
                  />
                </label>
                <label className="reflectionQuestionCard reflectionSummaryCard">
                  <span>다음 수정 체크리스트</span>
                  <small>한 줄에 하나씩 적으면 리포트에도 그대로 반영됩니다.</small>
                  <textarea
                    rows={5}
                    value={nextRevisionText}
                    onChange={(event) => setNextRevisionText(event.target.value)}
                    placeholder="예: 도입 활동에 AI 신뢰 점검 카드 추가"
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        <aside className="sideColumn">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Design Snapshot</p>
                <h2>{design.meta.topic || "제목 미입력"}</h2>
              </div>
              <span className="engineBadge">v{design.version}</span>
            </div>
            <div className="snapshotMetricGrid">
              <article className="snapshotMetric"><span>교과</span><strong>{design.meta.subject || "-"}</strong></article>
              <article className="snapshotMetric"><span>대상</span><strong>{design.meta.target || "-"}</strong></article>
              <article className="snapshotMetric"><span>세션 수</span><strong>{designSessions.length}</strong></article>
            </div>
            <div className="snapshotList">
              <div>
                <strong>학습 목표</strong>
                <span>{design.learningGoals.length ? design.learningGoals.join(" / ") : "아직 입력된 학습 목표가 없습니다."}</span>
              </div>
            </div>
            {analysis ? (
              <div className="compactAnalysis">
                <h3>설계 분석 요약</h3>
                <p>{analysis.summary}</p>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Risk Observer</p>
                <h2>포착된 문제점</h2>
              </div>
              <p className="panelHint">Human-AI agency와 깊이 있는 학습 관점에서 점검합니다.</p>
            </div>
            <div className="riskSummaryGrid">
              <article className="riskSummaryCard riskSummaryCard-high"><span>High</span><strong>{highRiskCount}</strong></article>
              <article className="riskSummaryCard riskSummaryCard-medium"><span>Medium</span><strong>{mediumRiskCount}</strong></article>
              <article className="riskSummaryCard riskSummaryCard-low"><span>Low</span><strong>{lowRiskCount}</strong></article>
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
              <p className="emptyPanelText">아직 포착된 위험은 없습니다.</p>
            )}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Session History</p>
                <h2>저장된 실행 기록</h2>
              </div>
              <p className="panelHint">이전 세션을 불러와 성찰 일지를 이어서 수정할 수 있습니다.</p>
            </div>
            {designSessions.length ? (
              <div className="historyList">
                {designSessions.map((session) => (
                  <article key={session.id} className="historyCard">
                    <div className="historyCardBody">
                      <strong>{formatSessionLabel(session)}</strong>
                      <p>에피소드 {session.scenario?.episodes.length ?? 0}개 · 턴 {session.turns.length}개 · 위험 {session.risks.length}개</p>
                      <span>{formatSyncTime(session.updatedAt)}</span>
                    </div>
                    <button type="button" className="tableActionButton" onClick={() => loadSessionFromHistory(session)}>
                      이 세션 불러오기
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">아직 서버에 저장된 실행 세션이 없습니다.</p>
            )}
          </section>
        </aside>
      </section>

      <footer className="statusBar statusBarFull">
        <div>
          <strong>현재 세션</strong>
          <span>{simulationRunId ?? "아직 실행 전"}</span>
        </div>
        <div>
          <strong>에피소드 수</strong>
          <span>{scenario?.episodes.length ?? 0}개</span>
        </div>
        <div>
          <strong>서버 저장 세션</strong>
          <span>{designSessions.length}개</span>
        </div>
        <div>
          <strong>상태 메시지</strong>
          <span>{message}</span>
        </div>
      </footer>
    </main>
  );
}