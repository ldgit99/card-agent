"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizeLessonDesignDraft, parseMultilineField } from "@/lib/design";
import { WorkspaceTopbar } from "@/components/workspace-topbar";
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
  return value ? new Date(value).toLocaleString("ko-KR") : "없음";
}

function qualityLabel(value: "strong" | "mixed" | "weak") {
  if (value === "strong") {
    return "강점";
  }
  if (value === "weak") {
    return "취약";
  }
  return "관찰";
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

function pickNewerDesign(left: LessonDesign | null, right: LessonDesign | null) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  if (left.version !== right.version) {
    return left.version > right.version ? left : right;
  }

  return new Date(left.updatedAt).getTime() >= new Date(right.updatedAt).getTime() ? left : right;
}

type SimStep = "idle" | "analysis" | "scenario" | "turns" | "risks" | "questions" | "saving" | "done" | "error";

const SIM_STEPS: Array<{ id: SimStep; label: string }> = [
  { id: "analysis", label: "설계 분석" },
  { id: "scenario", label: "시나리오 생성" },
  { id: "turns", label: "수업 전개" },
  { id: "risks", label: "위험 분석" },
  { id: "questions", label: "성찰 질문" },
];

function SimulationStepIndicator({ currentStep, activityCount, currentActivityIndex }: { currentStep: SimStep; activityCount: number; currentActivityIndex: number }) {
  const stepOrder: SimStep[] = ["analysis", "scenario", "turns", "risks", "questions", "saving", "done"];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="simStepIndicator">
      {SIM_STEPS.map((step, index) => {
        const stepIdx = stepOrder.indexOf(step.id);
        const isDone = currentIndex > stepIdx || currentStep === "done";
        const isActive = currentStep === step.id || (step.id === "turns" && currentStep === "saving" && currentIndex >= stepOrder.indexOf("turns"));
        const isTurns = step.id === "turns";
        const status = isDone ? "done" : isActive ? "active" : "pending";

        return (
          <div key={step.id} className={`simStep simStep-${status}`}>
            <div className="simStepDot">
              {isDone ? "✓" : isActive ? <span className="simStepSpinner" /> : index + 1}
            </div>
            <span className="simStepLabel">
              {isTurns && isActive && activityCount > 0
                ? `${step.label} (${currentActivityIndex}/${activityCount})`
                : step.label}
            </span>
            {index < SIM_STEPS.length - 1 && <div className={`simStepLine simStepLine-${isDone ? "done" : "pending"}`} />}
          </div>
        );
      })}
    </div>
  );
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
  const [runProgressLabel, setRunProgressLabel] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [serverSessions, setServerSessions] = useState<SimulationSessionRecord[]>([]);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);
  const [expandedIssueTurns, setExpandedIssueTurns] = useState<Record<string, boolean>>({});
  const [currentSimStep, setCurrentSimStep] = useState<SimStep>("idle");
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [historyTab, setHistoryTab] = useState<"sessions" | "journal">("sessions");

  const designSessions = useMemo(() => {
    if (!design) {
      return [];
    }
    return serverSessions.filter((session) => session.lessonDesignId === design.id);
  }, [design, serverSessions]);

  const episodeById = useMemo(() => {
    return new Map((scenario?.episodes ?? []).map((episode) => [episode.id, episode]));
  }, [scenario]);

  const personaById = useMemo(() => {
    return new Map((scenario?.studentPersonas ?? []).map((persona) => [persona.id, persona]));
  }, [scenario]);

  const majorActivities = useMemo(() => {
    if (!design) {
      return [];
    }

    return design.activities
      .map((activity) => {
        const heading = activity.functionLabel || activity.title || `활동 ${activity.order}`;
        const detail = activity.learningActivity?.trim();
        return detail ? `${heading}: ${detail}` : heading;
      })
      .filter(Boolean);
  }, [design]);

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
      setAnswers(Object.fromEntries(state.journal.answers.map((item) => [item.questionId, item.answer])));
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
      setAnswers(Object.fromEntries(session.journal.answers.map((item) => [item.questionId, item.answer])));
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

        const nextDesign = pickNewerDesign(snapshot.currentDesign ?? null, storedDesign ?? null);
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
              ? "서버 저장본과 최근 시뮬레이션 세션을 불러왔습니다."
              : storedReport
                ? "저장된 리포트와 설계 상태가 있습니다. 필요하면 리포트를 다시 열어 보세요."
                : "설계본을 불러왔습니다. 모의 수업을 실행해 보세요."
            : "저장된 설계가 없습니다. 수업 설계 화면에서 설계를 먼저 작성해 주세요.",
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
            : "저장된 설계가 없습니다. 수업 설계 화면에서 설계를 먼저 작성해 주세요.",
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
    setCurrentSimStep("analysis");
    setCurrentActivityIndex(0);
    setRunProgressLabel("실행 준비 중...");
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

      setCurrentSimStep("analysis");
      setRunProgressLabel("설계 분석 중...");
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
      setCurrentSimStep("scenario");
      setRunProgressLabel("시나리오 작성 중...");
      setMessage("수업 시나리오와 학생 페르소나를 생성하고 있습니다.");

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
      setCurrentSimStep("turns");
      for (const activity of nextDesign.activities) {
        setCurrentActivityIndex(activity.order);
        setRunProgressLabel(`${activity.order}차시 수업 전개 작성 중...`);
        setMessage(`${activity.order}차 활동의 실행 장면을 생성하고 있습니다.`);

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

      setMessage("활동별 위험과 성찰 질문을 생성하고 있습니다.");

      setCurrentSimStep("risks");
      setRunProgressLabel("문제점 작성 중...");
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

      setCurrentSimStep("questions");
      setRunProgressLabel("성찰 질문 작성 중...");
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
        setCurrentSimStep("saving");
        setRunProgressLabel("결과 저장 중...");
        try {
          const savedSession = await saveSimulationSessionToWorkspace(session);
          setServerSessions(savedSession.sessions);
          setLastServerSyncAt(savedSession.updatedAt);
        } catch {
          setMessage("시뮬레이션은 완료됐지만 서버 저장에는 실패했습니다.");
        }
      }

      setCurrentSimStep("done");
      setMessage("모의수업 시나리오, 실행 로그, 위험, 성찰 질문 생성이 완료됐습니다.");
      setRunProgressLabel("실행 완료");
    } catch (error) {
      setCurrentSimStep("error");
      setRunProgressLabel("실행 중 오류 발생");
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
      setMessage("성찰 응답을 서버에 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "성찰 응답 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingReflection(false);
    }
  }

  function loadSessionFromHistory(session: SimulationSessionRecord) {
    applySessionRecord(session);
    setMessage(`${formatSessionLabel(session)} 세션을 불러왔습니다.`);
  }

  function saveReport() {
    if (!design) {
      return;
    }

    if (!scenario && !turns.length && !questions.length) {
      setMessage("먼저 모의수업을 실행한 뒤 리포트를 저장해 주세요.");
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
      setMessage("팝업이 차단되어 리포트를 열지 못했습니다. /report 페이지를 직접 열어 주세요.");
      return;
    }

    setMessage("리포트를 새 탭에서 열었습니다. 페이지에서 PDF 저장 또는 HTML 다운로드가 가능합니다.");
  }

  const highRiskCount = risks.filter((risk) => risk.severity === "high").length;
  const mediumRiskCount = risks.filter((risk) => risk.severity === "medium").length;
  const lowRiskCount = risks.filter((risk) => risk.severity === "low").length;

  const risksByTurnId = useMemo(() => {
    const next = new Map<string, DetectedRisk[]>();

    for (const risk of risks) {
      for (const turnId of risk.evidenceTurnIds ?? []) {
        const current = next.get(turnId) ?? [];
        current.push(risk);
        next.set(turnId, current);
      }
    }

    return next;
  }, [risks]);

  const questionsByTurnId = useMemo(() => {
    const next = new Map<string, ReflectionQuestion[]>();

    for (const question of questions) {
      for (const turnId of question.linkedTurnIds ?? []) {
        const current = next.get(turnId) ?? [];
        current.push(question);
        next.set(turnId, current);
      }
    }

    return next;
  }, [questions]);

  const simulationRows = useMemo(() => {
    const severityRank = { high: 0, medium: 1, low: 2 } as const;

    return turns.map((turn) => {
      const episode = turn.scenarioEpisodeId ? episodeById.get(turn.scenarioEpisodeId) ?? null : null;
      const linkedRisks = [...(risksByTurnId.get(turn.id) ?? [])].sort(
        (left, right) => severityRank[left.severity] - severityRank[right.severity],
      );

      return {
        turn,
        episode,
        linkedRisks,
        linkedQuestions: questionsByTurnId.get(turn.id) ?? [],
      };
    });
  }, [turns, episodeById, risksByTurnId, questionsByTurnId]);

  if (!design) {
    return (
      <main className="appShell simulationPage">
        <section className="heroPanel">
          <div className="heroPanelStack">
            <WorkspaceTopbar
              active="simulation"
              actions={<Link href="/" className="secondaryButton">수업 설계로 이동</Link>}
            />
            <div className="heroPanelMain">
              <div>

                <h1>저장된 설계가 없습니다.</h1>
                <p className="heroCopy">먼저 수업 설계 화면에서 설계를 작성해야 모의수업을 실행할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell simulationPage">
      <section className="heroPanel">
        <div className="heroPanelStack">
          <WorkspaceTopbar
            active="simulation"
            sectionStatus={{
              design: "done",
              simulation: "idle",
              report: simulationRunId ? "idle" : "locked",
            }}
            actions={
              <>
                <button type="button" className="primaryButton" onClick={runSimulation}>
                  {isRunning ? "실행 중..." : "모의 수업 실행"}
                </button>
                <button type="button" className="secondaryButton" onClick={persistReflectionToServer}>
                  {isSavingReflection ? "저장 중..." : "성찰 저장"}
                </button>
                <button type="button" className="secondaryButton" onClick={saveReport}>
                  리포트 저장하기
                </button>
              </>
            }
          />
          {isRunning || currentSimStep === "done" || currentSimStep === "error" ? (
            <SimulationStepIndicator
              currentStep={currentSimStep}
              activityCount={design?.activities.length ?? 0}
              currentActivityIndex={currentActivityIndex}
            />
          ) : null}
          {runProgressLabel ? <p className="heroCopy simulationProgressCopy">{runProgressLabel}</p> : null}
          <div className="heroPanelMain">
            <div>
              <h1>모의수업 실행과 성찰</h1>
              <p className="heroCopy">
                자연스러운 수업 이야기, Human-AI 에이전시 관점의 문제점, 활동별 분석과 성찰을 한 화면에서 나란히 비교합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel simulationOverviewPanel">
        <div className="panelHeader">
          <div>

            <h2>{scenario?.title ?? "수업 실행 개요"}</h2>
          </div>
          <p className="panelHint">{message}</p>
        </div>
        <div className="tableStageBar simulationStageBar">
          <article className="stageChip"><span>현재 세션</span><strong>{simulationRunId ? simulationRunId.slice(0, 8) : "실행 전"}</strong></article>
          <article className="stageChip"><span>분석 엔진</span><strong>{analysis?.engine ?? "대기 중"}</strong></article>
          <article className="stageChip"><span>마지막 서버 동기화</span><strong>{formatSyncTime(lastServerSyncAt)}</strong></article>
        </div>
        <div className="simulationOverviewGrid">
          <article className="detailSection detailSectionSoft">
            <div className="detailSectionHeader">
              <div>
                <p className="sectionMicroTag">Lesson Snapshot</p>
                <h3>수업 설계 요약</h3>
              </div>
                            <span className="engineBadge">v{design.version}</span>
            </div>
            <div className="snapshotList snapshotListStacked">
              <div className="snapshotBlock">
                <strong>주제</strong>
                <span className="snapshotBlockValue">{design.meta.topic || "-"}</span>
              </div>
              <div className="snapshotBlock">
                <strong>교과</strong>
                <span className="snapshotBlockValue">{design.meta.subject || "-"}</span>
              </div>
              <div className="snapshotBlock">
                <strong>대상</strong>
                <span className="snapshotBlockValue">{design.meta.target || "-"}</span>
              </div>
              <div className="snapshotBlock">
                <strong>학습 목표</strong>
                <span className="snapshotBlockValue">
                  {design.learningGoals.length
                    ? design.learningGoals.join("\n")
                    : "아직 입력된 학습 목표가 없습니다."}
                </span>
              </div>
              <div className="snapshotBlock">
                <strong>주요 활동</strong>
                <span className="snapshotBlockValue">
                  {majorActivities.length
                    ? majorActivities.join("\n")
                    : "아직 입력된 활동이 없습니다."}
                </span>
              </div>
            </div>
          </article>
          <article className="detailSection detailSectionSoft">
            <div className="detailSectionHeader">
              <div>
                <p className="sectionMicroTag">Storyline</p>
                <h3>수업 배경과 관찰 포인트</h3>
              </div>
            </div>
            <p className="overviewLead">{scenario?.setting ?? "모의 수업을 실행하면 여기에서 수업 배경과 맥락이 제시됩니다."}</p>
            <div className="snapshotList">
              <div><strong>학습 흐름</strong><span>{scenario?.learningArc ?? "아직 수업 흐름이 없습니다."}</span></div>
              <div><strong>관찰 포인트</strong><span>{scenario?.facilitatorBrief ?? "모의 수업 실행 뒤 관찰 포인트가 채워집니다."}</span></div>
            </div>
          </article>
          <article className="detailSection detailSectionSoft">
            <div className="detailSectionHeader">
              <div>
                <p className="sectionMicroTag">Analysis</p>
                <h3>설계 분석과 위험 분포</h3>
              </div>
            </div>
            <p className="overviewLead">{analysis?.summary ?? "설계 분석은 모의 수업 실행 뒤 생성됩니다."}</p>
            <div className="riskSummaryGrid">
              <article className="riskSummaryCard riskSummaryCard-high"><span>High</span><strong>{highRiskCount}</strong></article>
              <article className="riskSummaryCard riskSummaryCard-medium"><span>Medium</span><strong>{mediumRiskCount}</strong></article>
              <article className="riskSummaryCard riskSummaryCard-low"><span>Low</span><strong>{lowRiskCount}</strong></article>
            </div>
          </article>
        </div>
        {scenario?.studentPersonas.length ? (
          <div className="personaStrip">
            {scenario.studentPersonas.map((persona) => (
              <article key={persona.id} className="personaStripCard">
                <div className="personaStripHead">
                  <strong>{persona.name}</strong>
                  <span>{persona.label}</span>
                </div>
                <p>{persona.profile}</p>
                <small>자주 보이는 말: "{persona.likelyUtterance}"</small>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel simulationBoardPanel">
        <div className="panelHeader">
          <div>

            <h2>모의 수업 실행 결과 · 문제점 · 분석 및 성찰</h2>
          </div>
          <p className="panelHint">각 활동을 하나의 행으로 정리해 수업 이야기, agency 문제점, 성찰을 같은 높이에서 비교합니다.</p>
        </div>

        {simulationRows.length ? (
          <div className="simulationTriBoard">
            <div className="triBoardHeader">
              <div className="triBoardHeadCell">
                <p className="sectionMicroTag">Lesson Story</p>
                <h3>모의 수업 실행 결과</h3>
              </div>
              <div className="triBoardHeadCell">
                <p className="sectionMicroTag">Agency Issues</p>
                <h3>Human-AI 에이전시 관점 문제점</h3>
              </div>
              <div className="triBoardHeadCell">
                <p className="sectionMicroTag">Analysis & Reflection</p>
                <h3>분석 및 성찰 쓰기</h3>
              </div>
            </div>

            {simulationRows.map(({ turn, episode, linkedRisks, linkedQuestions }) => {
              const prioritizedHighRisks = linkedRisks.filter((risk) => risk.severity === "high");
              const defaultVisibleRisks = prioritizedHighRisks.length ? prioritizedHighRisks.slice(0, 2) : linkedRisks.slice(0, 2);
              const visibleRiskIds = new Set(defaultVisibleRisks.map((risk) => risk.id));
              const hiddenRisks = linkedRisks.filter((risk) => !visibleRiskIds.has(risk.id));
              const isIssueExpanded = expandedIssueTurns[turn.id] ?? false;
              const displayedRisks = isIssueExpanded ? linkedRisks : defaultVisibleRisks;

              return (
                <article key={turn.id} className="simulationTriRow">
                <section className="triColumn triColumn-story">
                  <div className="triColumnHeader">
                    <div className="timelineTitleBlock">
                      <span className="scenarioEpisodeIndex">Activity {turn.turnIndex}</span>
                      {episode ? <span className="scenarioLensBadge">{episode.lens}</span> : null}
                    </div>
                    <span className="engineBadge">{turn.engine}</span>
                  </div>
                  <h3>{turn.activityTitle}</h3>
                  <p className="storyLead">{episode?.narrative ?? turn.expectedStudentResponse}</p>
                  <div className="storyDialogueList">
                    <article className="storyDialogueCard storyDialogueCard-teacher">
                      <strong>선생님 발문·행동</strong>
                      <p>{turn.teacherAction}</p>
                    </article>
                    {(turn.studentPersonaResponses ?? []).slice(0, 2).map((item) => {
                      const persona = personaById.get(item.personaId);
                      return (
                        <article key={`${turn.id}-${item.personaId}`} className="storyDialogueCard storyDialogueCard-student">
                          <strong>{item.personaName}</strong>
                          <span>{persona?.label ?? "학생 페르소나"}</span>
                          <p>{item.response}</p>
                        </article>
                      );
                    })}
                    <article className="storyDialogueCard storyDialogueCard-ai">
                      <strong>AI 활용</strong>
                      <p>{turn.aiAction}</p>
                    </article>
                  </div>
                  <div className="storySceneGrid">
                    <div className="scenarioContrastCard scenarioContrastCard-positive">
                      <strong>잘되고 있는 모습</strong>
                      <p>{episode?.successScene ?? "이 활동이 잘 풀릴 때의 장면이 여기에 제시됩니다."}</p>
                    </div>
                    <div className="scenarioContrastCard scenarioContrastCard-neutral">
                      <strong>보통의 실제 모습</strong>
                      <p>{episode?.ordinaryScene ?? turn.expectedStudentResponse}</p>
                    </div>
                    <div className="scenarioContrastCard scenarioContrastCard-negative">
                      <strong>잘 안되는 모습</strong>
                      <p>{episode?.challengeScene ?? (turn.missedOpportunities.length ? turn.missedOpportunities.join(" / ") : "아직 뚜렷한 위험 장면이 없습니다.")}</p>
                    </div>
                  </div>
                </section>

                <section className="triColumn triColumn-issues">
                  <div className="triColumnHeader">
                    <div>
                      <p className="sectionMicroTag">Issue Reading</p>
                      <h3>문제점과 위험 신호</h3>
                    </div>
                  </div>
                  <p className="issueLead">{turn.observerNote}</p>
                  <div className="signalList signalList-compact">
                    {(turn.activityRiskSignals ?? []).map((signal) => (
                      <span key={`${turn.id}-${signal}`} className="linkedCardChip linkedCardChip-risk">{signal}</span>
                    ))}
                  </div>
                  {linkedRisks.length ? (
                    <>
                      <div className="issueMetaRow">
                        <span className="issueMetaLabel">
                          {prioritizedHighRisks.length
                            ? `HIGH ${Math.min(2, prioritizedHighRisks.length)}개 우선 표시`
                            : `우선순위 문제점 ${Math.min(2, linkedRisks.length)}개 표시`}
                        </span>
                        {hiddenRisks.length ? (
                          <button
                            type="button"
                            className="tableActionButton issueToggleButton"
                            onClick={() =>
                              setExpandedIssueTurns((current) => ({ ...current, [turn.id]: !isIssueExpanded }))
                            }
                          >
                            {isIssueExpanded ? "접기" : `문제점 더 보기 (${hiddenRisks.length})`}
                          </button>
                        ) : null}
                      </div>
                      <div className="issueRiskList">
                        {displayedRisks.map((risk) => (
                          <article key={risk.id} className={`riskCard risk-${risk.severity} riskCardCompact`}>
                          <div className="riskHeader">
                            <h3>{riskLabels[risk.riskType]}</h3>
                            <span>{risk.severity}</span>
                          </div>
                          <p className="riskActivityLabel">{risk.focusArea}</p>
                          <p>{risk.rationale}</p>
                          <div className="riskMetaBlock">
                            <strong>학생 영향</strong>
                            <p>{risk.studentImpact}</p>
                          </div>
                          <strong>권장 개입</strong>
                          <p>{risk.recommendedIntervention}</p>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="emptyPanelText">이 활동에서는 큰 위험보다 안정적으로 유지할 설계 포인트가 더 두드러집니다.</p>
                  )}
                  {turn.cardOutcomeLinks.length ? (
                    <section className="detailSection detailSectionSoft compactTraceSection">
                      <div className="detailSectionHeader">
                        <div>
                          <p className="sectionMicroTag">Design Trace</p>
                          <h3>설계와 실행의 연결</h3>
                        </div>
                      </div>
                      <div className="compactTraceList">
                        {turn.cardOutcomeLinks.slice(0, 3).map((link) => (
                          <article key={`${turn.id}-${link.cardId}`} className="traceCard">
                            <strong>{link.actor === "teacher" ? "교사 질문·행동" : "AI 질문·행동"} · {link.cardTitle}</strong>
                            <p>{link.resultingChange}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </section>

                <section className="triColumn triColumn-reflection">
                  <div className="triColumnHeader">
                    <div>
                      <p className="sectionMicroTag">Evidence & Writing</p>
                      <h3>분석 근거와 성찰 쓰기</h3>
                    </div>
                  </div>
                  <div className="reflectionEvidenceList">
                    {(turn.sampleArtifacts ?? []).slice(0, 2).map((artifact) => (
                      <article key={artifact.id} className={`artifactCard artifactCard-${artifact.quality} artifactCardCompact`}>
                        <div className="artifactHead">
                          <strong>{artifact.title}</strong>
                          <span>{qualityLabel(artifact.quality)}</span>
                        </div>
                        <p>{artifact.content}</p>
                        <small>{artifact.insight}</small>
                      </article>
                    ))}
                    {(turn.teacherInterventions ?? []).slice(0, 2).map((item) => (
                      <article key={item.id} className="interventionCard interventionCardCompact">
                        <strong>{item.title}</strong>
                        <span>{item.timing}</span>
                        <p>{item.move}</p>
                        <small>{item.expectedImpact}</small>
                      </article>
                    ))}
                  </div>
                  <div className="reflectionInlineList">
                    {linkedQuestions.length ? (
                      linkedQuestions.slice(0, 1).map((question) => (
                        <label key={question.id} className="reflectionQuestionCard reflectionInlineCard">
                          <span>{question.prompt}</span>
                          <small>{question.rationale}</small>
                          <textarea
                            rows={4}
                            value={answers[question.id] ?? ""}
                            onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                            placeholder="이 활동에서 유지할 점, 수정할 교사 질문, AI 활용 조정점을 적어 주세요."
                          />
                        </label>
                      ))
                    ) : (
                      <p className="emptyPanelText">이 활동과 직접 연결된 성찰 질문이 아직 없습니다.</p>
                    )}
                  </div>
                </section>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="emptyPanelText">아직 실행 결과가 없습니다. `모의 수업 실행` 버튼으로 시작해 주세요.</p>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>실행 기록 &amp; 성찰 일지</h2>
          </div>
        </div>
        <div className="historyTabBar">
          <button
            type="button"
            className={`historyTabBtn ${historyTab === "sessions" ? "historyTabBtn-active" : ""}`}
            onClick={() => setHistoryTab("sessions")}
          >
            📋 저장된 세션 {designSessions.length > 0 ? `(${designSessions.length})` : ""}
          </button>
          <button
            type="button"
            className={`historyTabBtn ${historyTab === "journal" ? "historyTabBtn-active" : ""}`}
            onClick={() => setHistoryTab("journal")}
          >
            ✍️ 성찰 일지 {simulationRunId ? "" : "(시뮬레이션 후 작성)"}
          </button>
        </div>

        {historyTab === "sessions" ? (
          designSessions.length ? (
            <div className="historyList">
              {designSessions.map((session) => (
                <article key={session.id} className="historyCard">
                  <div className="historyCardBody">
                    <strong>{formatSessionLabel(session)}</strong>
                    <p>페르소나 {session.scenario?.studentPersonas.length ?? 0}명 · 활동 {session.turns.length}개 · 위험 {session.risks.length}개</p>
                    <span>{formatSyncTime(session.updatedAt)}</span>
                  </div>
                  <button type="button" className="tableActionButton" onClick={() => loadSessionFromHistory(session)}>세션 불러오기</button>
                </article>
              ))}
            </div>
          ) : (
            <p className="emptyPanelText">아직 서버에 저장된 실행 세션이 없습니다. 모의 수업을 실행하면 자동으로 저장됩니다.</p>
          )
        ) : (
          <div className="journalPanel">
            {!simulationRunId ? (
              <p className="emptyPanelText">모의 수업을 실행한 뒤 이 곳에서 전체 성찰을 작성할 수 있습니다.</p>
            ) : (
              <>
                <div className="journalField">
                  <label className="journalLabel" htmlFor="journalSummary">수업 전체 총평</label>
                  <textarea
                    id="journalSummary"
                    rows={4}
                    className="journalTextarea"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="이번 모의 수업에서 가장 인상적이었던 점, 예상과 달랐던 부분, 전체적인 수업 흐름을 적어 주세요."
                  />
                </div>
                <div className="journalField">
                  <label className="journalLabel" htmlFor="journalRevision">다음 수정 계획</label>
                  <textarea
                    id="journalRevision"
                    rows={4}
                    className="journalTextarea"
                    value={nextRevisionText}
                    onChange={(e) => setNextRevisionText(e.target.value)}
                    placeholder="다음 설계에서 바꾸고 싶은 카드, 활동 순서, AI 활용 방식 등을 한 줄씩 적어 주세요."
                  />
                </div>
                <button
                  type="button"
                  className="primaryButton"
                  style={{ marginTop: 8 }}
                  onClick={() => void persistReflectionToServer()}
                  disabled={isSavingReflection}
                >
                  {isSavingReflection ? "저장 중..." : "성찰 일지 저장"}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <footer className="statusBar statusBarFull">
        <div><strong>현재 세션</strong><span>{simulationRunId ?? "아직 실행 전"}</span></div>
        <div><strong>실행 활동</strong><span>{simulationRows.length}개</span></div>
        <div><strong>서버 저장 세션</strong><span>{designSessions.length}개</span></div>
        <div><strong>상태 메시지</strong><span>{message}</span></div>
      </footer>
    </main>
  );
}
