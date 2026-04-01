"use client";

import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { aiCards, orchestrationCards, teacherCards } from "@/data/cards";
import {
  createDefaultLessonDesign,
  createEmptyActivity,
  normalizeLessonDesignDraft,
  parseMultilineField,
} from "@/lib/design";
import { loadStoredDesign, saveStoredDesign } from "@/lib/storage";
import { fetchWorkspaceSnapshot, saveDesignToWorkspace } from "@/lib/workspace-client";
import type {
  CardActor,
  DesignAnalysis,
  LessonActivity,
  LessonDesign,
  OrchestrationCard,
} from "@/types/lesson";
import { useEffect, useState } from "react";

interface DraggableCardProps {
  card: OrchestrationCard;
  onQuickAdd: (card: OrchestrationCard) => void;
  disabled?: boolean;
}

function DraggableCard({ card, onQuickAdd, disabled = false }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${card.id}`,
    data: { card },
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.62 : 1 }}
      className={`libraryCard libraryCard-${card.actor}`}
      {...listeners}
      {...attributes}
    >
      <div>
        <p className="libraryCardCategory">{card.category}</p>
        <h4>{card.title}</h4>
        <p className="libraryCardPrompt">{card.prompt}</p>
      </div>
      <button
        type="button"
        className="ghostButton"
        onClick={() => onQuickAdd(card)}
        disabled={disabled}
      >
        배치
      </button>
    </article>
  );
}

interface RowDropZoneProps {
  id: string;
  actor: CardActor;
  cards: OrchestrationCard[];
  onRemove: (cardId: string) => void;
}

function RowDropZone({ id, actor, cards, onRemove }: RowDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { actor } });

  return (
    <div
      ref={setNodeRef}
      className={`tableDropZone tableDropZone-${actor} ${isOver ? "tableDropZone-over" : ""}`}
    >
      {cards.length ? (
        <div className="tableDropList">
          {cards.map((card) => (
            <div key={`${id}-${card.id}`} className={`tablePlacedCard tablePlacedCard-${card.actor}`}>
              <span>{card.title}</span>
              <button type="button" className="tableChipRemove" onClick={() => onRemove(card.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="tableDropZoneEmpty">{actor === "teacher" ? "교사 카드" : "AI 카드"}</p>
      )}
    </div>
  );
}

function getInitialDesign() {
  const stored = loadStoredDesign();
  return normalizeLessonDesignDraft(stored ?? createDefaultLessonDesign());
}

function findCards(cardIds: string[]) {
  return cardIds
    .map((cardId) => orchestrationCards.find((card) => card.id === cardId))
    .filter((card): card is OrchestrationCard => Boolean(card));
}

function formatSyncTime(value: string | null) {
  if (!value) {
    return "없음";
  }

  return new Date(value).toLocaleString("ko-KR");
}

function formatDesignLabel(design: LessonDesign) {
  return `${design.meta.topic || "제목 미입력"} · v${design.version}`;
}

function getActivityHeading(activity: LessonActivity | null) {
  if (!activity) {
    return "활동을 선택해 주세요";
  }

  return activity.title || activity.functionLabel || `활동 ${activity.order}`;
}

export function DesignStudio() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [design, setDesign] = useState<LessonDesign>(getInitialDesign);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncingWorkspace, setIsSyncingWorkspace] = useState(false);
  const [designHistory, setDesignHistory] = useState<LessonDesign[]>([]);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);

  const selectedActivity =
    design.activities.find((activity) => activity.id === selectedActivityId) ??
    design.activities[0] ??
    null;

  useEffect(() => {
    if (!selectedActivity && design.activities[0]) {
      setSelectedActivityId(design.activities[0].id);
    }
  }, [design.activities, selectedActivity]);

  useEffect(() => {
    saveStoredDesign(design);
  }, [design]);

  useEffect(() => {
    let active = true;

    async function hydrateFromWorkspace() {
      try {
        const snapshot = await fetchWorkspaceSnapshot();
        if (!active) {
          return;
        }

        if (snapshot.currentDesign) {
          const nextDesign = normalizeLessonDesignDraft(snapshot.currentDesign);
          setDesign(nextDesign);
          setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
          setStatusMessage("서버에 저장된 최신 설계를 불러왔습니다.");
        } else {
          setStatusMessage("서버 설계가 없어 브라우저 임시 저장본으로 시작합니다.");
        }

        setDesignHistory(snapshot.designHistory);
        setLastServerSyncAt(snapshot.updatedAt);
      } catch {
        if (active) {
          setStatusMessage("서버 저장소에 연결하지 못해 브라우저 임시 저장본으로 시작합니다.");
        }
      }
    }

    void hydrateFromWorkspace();

    return () => {
      active = false;
    };
  }, []);
  function commitDesign(nextDesign: LessonDesign) {
    setDesign(normalizeLessonDesignDraft(nextDesign));
  }

  function updateMeta(field: keyof LessonDesign["meta"], value: string) {
    commitDesign({ ...design, meta: { ...design.meta, [field]: value } });
  }

  function updateDesignList(field: "achievementStandards" | "learningGoals", value: string) {
    commitDesign({
      ...design,
      [field]: parseMultilineField(value),
    });
  }

  function updateActivity(activityId: string, patch: Partial<LessonActivity>) {
    commitDesign({
      ...design,
      activities: design.activities.map((activity) =>
        activity.id === activityId ? { ...activity, ...patch } : activity,
      ),
    });
  }

  function addActivity() {
    const nextActivity = createEmptyActivity(design.activities.length + 1);
    commitDesign({ ...design, activities: [...design.activities, nextActivity] });
    setSelectedActivityId(nextActivity.id);
  }

  function removeActivity(activityId: string) {
    if (design.activities.length === 1) {
      return;
    }

    const remainingActivities = design.activities.filter((activity) => activity.id !== activityId);
    commitDesign({ ...design, activities: remainingActivities });

    if (selectedActivityId === activityId) {
      setSelectedActivityId(remainingActivities[0]?.id ?? null);
    }
  }

  function appendCard(activityId: string, card: OrchestrationCard) {
    const slot = card.actor === "teacher" ? "humanCardIds" : "aiCardIds";
    const activity = design.activities.find((item) => item.id === activityId);
    if (!activity || activity[slot].includes(card.id)) {
      return;
    }

    updateActivity(activityId, { [slot]: [...activity[slot], card.id] });
  }

  function removeCard(activityId: string, actor: CardActor, cardId: string) {
    const slot = actor === "teacher" ? "humanCardIds" : "aiCardIds";
    const activity = design.activities.find((item) => item.id === activityId);
    if (!activity) {
      return;
    }

    updateActivity(activityId, { [slot]: activity[slot].filter((item) => item !== cardId) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const card = event.active.data.current?.card as OrchestrationCard | undefined;
    const overId = String(event.over?.id ?? "");
    const match = overId.match(/^(human|ai)-slot-(.+)$/);

    if (!card || !match) {
      return;
    }

    const slot = match[1] as "human" | "ai";
    const activityId = match[2];

    if (slot === "human" && card.actor === "teacher") {
      appendCard(activityId, card);
      return;
    }

    if (slot === "ai" && card.actor === "ai") {
      appendCard(activityId, card);
    }
  }

  async function analyzeDesign() {
    setIsAnalyzing(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/design/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design }),
      });

      if (!response.ok) {
        throw new Error("설계 분석 요청이 실패했습니다.");
      }

      const payload = (await response.json()) as { analysis: DesignAnalysis };
      setAnalysis(payload.analysis);
      setStatusMessage(
        payload.analysis.engine === "openai"
          ? "OpenAI 기반 설계 분석이 완료되었습니다."
          : "휴리스틱 기반 설계 분석이 완료되었습니다.",
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "설계 분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function persistDesign() {
    setIsSyncingWorkspace(true);

    try {
      const response = await saveDesignToWorkspace({ design, persistVersion: true });
      setDesignHistory(response.designHistory);
      setLastServerSyncAt(response.updatedAt);
      setStatusMessage("현재 설계를 서버 저장소에 저장했습니다.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "서버 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  async function reloadFromServer() {
    setIsSyncingWorkspace(true);

    try {
      const snapshot = await fetchWorkspaceSnapshot();
      if (!snapshot.currentDesign) {
        setStatusMessage("서버에 저장된 설계가 없습니다.");
        return;
      }

      const nextDesign = normalizeLessonDesignDraft(snapshot.currentDesign);
      setDesign(nextDesign);
      setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
      setDesignHistory(snapshot.designHistory);
      setLastServerSyncAt(snapshot.updatedAt);
      setAnalysis(null);
      setStatusMessage("서버 최신 설계를 다시 불러왔습니다.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "서버 저장본을 불러오지 못했습니다.");
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  function loadDesignVersion(versionDesign: LessonDesign) {
    const nextDesign = normalizeLessonDesignDraft(versionDesign);
    setDesign(nextDesign);
    setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
    setAnalysis(null);
    setStatusMessage(`${formatDesignLabel(versionDesign)} 버전을 작업 화면으로 불러왔습니다.`);
  }

  const selectedCardTotal = selectedActivity
    ? selectedActivity.humanCardIds.length + selectedActivity.aiCardIds.length
    : 0;
  const totalHumanAssignments = design.activities.reduce(
    (count, activity) => count + activity.humanCardIds.length,
    0,
  );
  const totalAiAssignments = design.activities.reduce(
    (count, activity) => count + activity.aiCardIds.length,
    0,
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="appShell">
        <section className="heroPanel">
          <div>
            <p className="eyebrow">Harness-Based Teacher Agent</p>
            <h1>수업 설계 오케스트레이션 스튜디오</h1>
            <p className="heroCopy">
              상단에서 주제, 교과, 대상, 성취기준, 학습 목표를 정리하고 활동 표 안에서 바로 교사 카드와 AI 카드를 배치합니다.
              카드 라이브러리는 하단에 두고, 각 활동 행의 카드 열에 직접 드래그해 배치하도록 구성했습니다.
            </p>
            <div className="heroActions">
              <button type="button" className="primaryButton" onClick={analyzeDesign}>
                {isAnalyzing ? "설계 분석 중..." : "설계 분석 실행"}
              </button>
              <button type="button" className="secondaryButton" onClick={persistDesign}>
                {isSyncingWorkspace ? "서버 저장 중..." : "설계 서버 저장"}
              </button>
              <button type="button" className="ghostButton" onClick={reloadFromServer}>
                서버 저장본 불러오기
              </button>
              <Link href="/simulation" className="secondaryButton">
                2페이지로 이동
              </Link>
            </div>
          </div>
          <div className="heroStatRack">
            <article className="heroStatCard">
              <span>설계 활동</span>
              <strong>{design.activities.length}</strong>
            </article>
            <article className="heroStatCard">
              <span>교사 카드 배치</span>
              <strong>{totalHumanAssignments}</strong>
            </article>
            <article className="heroStatCard">
              <span>AI 카드 배치</span>
              <strong>{totalAiAssignments}</strong>
            </article>
          </div>
        </section>

        <section className="designStack">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Step 1</p>
                <h2>수업 개요 입력</h2>
              </div>
              <p className="panelHint">교과와 대상 아래에 성취기준과 학습 목표를 바로 연결합니다.</p>
            </div>
            <div className="metaTable metaTableExtended">
              <div className="metaCell metaLabel">주제</div>
              <div className="metaCell metaValue metaWide">
                <input
                  value={design.meta.topic}
                  onChange={(event) => updateMeta("topic", event.target.value)}
                  placeholder="예: 생성형 AI를 활용한 기후 위기 탐구 수업"
                />
              </div>
              <div className="metaCell metaLabel">교과</div>
              <div className="metaCell metaValue">
                <input
                  value={design.meta.subject}
                  onChange={(event) => updateMeta("subject", event.target.value)}
                  placeholder="예: 과학"
                />
              </div>
              <div className="metaCell metaLabel">대상</div>
              <div className="metaCell metaValue">
                <input
                  value={design.meta.target}
                  onChange={(event) => updateMeta("target", event.target.value)}
                  placeholder="예: 중학교 3학년"
                />
              </div>
            </div>
            <div className="metaSupplementGrid">
              <label className="metaSupplementCard">
                <span>성취기준</span>
                <textarea
                  rows={4}
                  value={design.achievementStandards.join("\n")}
                  onChange={(event) => updateDesignList("achievementStandards", event.target.value)}
                  placeholder="한 줄에 하나씩 입력하세요. 예: 과학적 현상을 다양한 자료를 활용해 설명할 수 있다."
                />
              </label>
              <label className="metaSupplementCard">
                <span>학습 목표</span>
                <textarea
                  rows={4}
                  value={design.learningGoals.join("\n")}
                  onChange={(event) => updateDesignList("learningGoals", event.target.value)}
                  placeholder="한 줄에 하나씩 입력하세요. 예: AI의 제안을 비판적으로 비교해 자신의 판단을 말할 수 있다."
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Step 2</p>
                <h2>학습 활동 설계</h2>
              </div>
              <div className="inlineActions">
                <span className="panelHint">평가 방법 옆 카드 열에서 행 단위 드래그 앤 드롭 배치를 수행합니다.</span>
                <button type="button" className="ghostButton" onClick={addActivity}>
                  활동 추가
                </button>
              </div>
            </div>
            <div className="tableStageBar">
              <article className="stageChip">
                <span>현재 선택 활동</span>
                <strong>
                  {selectedActivity
                    ? `${selectedActivity.order}차 활동 · ${getActivityHeading(selectedActivity)}`
                    : "활동을 선택해 주세요"}
                </strong>
              </article>
              <article className="stageChip">
                <span>선택 활동 카드</span>
                <strong>{selectedCardTotal}장 배치</strong>
              </article>
              <article className="stageChip">
                <span>설계 분석 상태</span>
                <strong>{analysis ? "분석 완료" : "설계 작성 중"}</strong>
              </article>
            </div>
            <div className="tableWrap tableWrapWide">
              <table className="lessonTable lessonTableCards">
                <thead>
                  <tr>
                    <th className="colFunction">기능</th>
                    <th className="colSubject">교과</th>
                    <th className="colLearningActivity">학습활동</th>
                    <th className="colAssessment">평가 방법</th>
                    <th className="colTeacherCards">교사 카드</th>
                    <th className="colAiCards">AI 카드</th>
                    <th className="narrowCell">선택</th>
                  </tr>
                </thead>
                <tbody>
                  {design.activities.map((activity) => {
                    const isSelected = selectedActivity?.id === activity.id;
                    const humanCards = findCards(activity.humanCardIds);
                    const rowAiCards = findCards(activity.aiCardIds);

                    return (
                      <tr
                        key={activity.id}
                        className={isSelected ? "selectedRow" : ""}
                        onClick={() => setSelectedActivityId(activity.id)}
                      >
                        <td>
                          <input
                            value={activity.functionLabel}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) =>
                              updateActivity(activity.id, { functionLabel: event.target.value })
                            }
                            placeholder="예: 조사하기"
                          />
                        </td>
                        <td>
                          <input
                            value={activity.subjectLabel}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) =>
                              updateActivity(activity.id, { subjectLabel: event.target.value })
                            }
                            placeholder="예: 과학(3)"
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.learningActivity}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) =>
                              updateActivity(activity.id, { learningActivity: event.target.value })
                            }
                            placeholder="예: 지구온난화 원인과 영향을 조사하고 AI의 해석과 비교한다."
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.assessmentMethod}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) =>
                              updateActivity(activity.id, { assessmentMethod: event.target.value })
                            }
                            placeholder="예: 보고서 평가, 토론 참여 관찰"
                          />
                        </td>
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`human-slot-${activity.id}`}
                            actor="teacher"
                            cards={humanCards}
                            onRemove={(cardId) => removeCard(activity.id, "teacher", cardId)}
                          />
                        </td>
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`ai-slot-${activity.id}`}
                            actor="ai"
                            cards={rowAiCards}
                            onRemove={(cardId) => removeCard(activity.id, "ai", cardId)}
                          />
                        </td>
                        <td className="actionCell">
                          <button
                            type="button"
                            className="tableActionButton"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedActivityId(activity.id);
                            }}
                          >
                            선택
                          </button>
                          <button
                            type="button"
                            className="tableActionButton tableActionDanger"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeActivity(activity.id);
                            }}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedActivity ? (
              <section className="detailSection detailSectionSoft selectedActivityPanel">
                <div className="detailSectionHeader">
                  <div>
                    <p className="sectionMicroTag">Selected Activity</p>
                    <h3>{getActivityHeading(selectedActivity)}</h3>
                  </div>
                  <p>선택한 활동의 목표와 메모를 보강합니다. 카드 라이브러리는 아래 하단에 있습니다.</p>
                </div>
                <div className="detailForm detailFormWide">
                  <label>
                    <span>학습목표</span>
                    <textarea
                      rows={3}
                      value={selectedActivity.learningObjective}
                      onChange={(event) =>
                        updateActivity(selectedActivity.id, { learningObjective: event.target.value })
                      }
                      placeholder="학생이 이 활동에서 무엇을 이해하거나 판단해야 하는지 적어 주세요."
                    />
                  </label>
                  <label>
                    <span>교사 개입 메모</span>
                    <textarea
                      rows={3}
                      value={selectedActivity.teacherMove}
                      onChange={(event) =>
                        updateActivity(selectedActivity.id, { teacherMove: event.target.value })
                      }
                      placeholder="교사가 어느 시점에 어떤 질문과 피드백으로 조율할지 적습니다."
                    />
                  </label>
                  <label>
                    <span>사용 도구</span>
                    <textarea
                      rows={3}
                      value={selectedActivity.tools.join("\n")}
                      onChange={(event) =>
                        updateActivity(selectedActivity.id, {
                          tools: parseMultilineField(event.target.value),
                        })
                      }
                      placeholder="예: ChatGPT, Padlet, 교과서"
                    />
                  </label>
                  <label>
                    <span>성공 증거</span>
                    <textarea
                      rows={3}
                      value={selectedActivity.evidenceOfSuccess.join("\n")}
                      onChange={(event) =>
                        updateActivity(selectedActivity.id, {
                          evidenceOfSuccess: parseMultilineField(event.target.value),
                        })
                      }
                      placeholder="예: 학생 발화, 산출물, 근거 제시, 토론 참여"
                    />
                  </label>
                  <label className="detailFormSpan2">
                    <span>메모</span>
                    <textarea
                      rows={3}
                      value={selectedActivity.notes}
                      onChange={(event) => updateActivity(selectedActivity.id, { notes: event.target.value })}
                      placeholder="시간 운영, 안전, 역할 분담, 추가 유의사항을 적습니다."
                    />
                  </label>
                </div>
              </section>
            ) : null}
          </section>

          {analysis ? (
            <section className="panel analysisPanel">
              <div className="panelHeader">
                <div>
                  <p className="sectionTag">Step 3</p>
                  <h2>설계 분석 결과</h2>
                </div>
                <p className="panelHint">엔진: {analysis.engine}</p>
              </div>
              <p className="analysisSummary">{analysis.summary}</p>
              <div className="analysisGrid">
                <article>
                  <h3>강점</h3>
                  <ul>
                    {analysis.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article>
                  <h3>보완점</h3>
                  <ul>
                    {analysis.gaps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article>
                  <h3>권장 수정</h3>
                  <ul>
                    {analysis.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </section>
          ) : null}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Card Library</p>
                <h2>하단 카드 라이브러리</h2>
              </div>
              <p className="panelHint">
                원하는 활동 행의 카드 열로 바로 드래그하거나, 선택한 활동에 빠르게 배치할 수 있습니다.
              </p>
            </div>
            <div className="cardLibraryGrid cardLibraryBottomGrid">
              <section className="libraryColumn">
                <div className="libraryColumnHeader">
                  <div>
                    <p className="sectionMicroTag">Teacher Cards</p>
                    <h3 className="libraryHeading">교사 카드</h3>
                  </div>
                  <span className="engineBadge">{teacherCards.length}</span>
                </div>
                <div className="libraryList">
                  {teacherCards.map((card) => (
                    <DraggableCard
                      key={card.id}
                      card={card}
                      disabled={!selectedActivity}
                      onQuickAdd={(nextCard) =>
                        selectedActivity ? appendCard(selectedActivity.id, nextCard) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
              <section className="libraryColumn">
                <div className="libraryColumnHeader">
                  <div>
                    <p className="sectionMicroTag">AI Cards</p>
                    <h3 className="libraryHeading">AI 카드</h3>
                  </div>
                  <span className="engineBadge">{aiCards.length}</span>
                </div>
                <div className="libraryList">
                  {aiCards.map((card) => (
                    <DraggableCard
                      key={card.id}
                      card={card}
                      disabled={!selectedActivity}
                      onQuickAdd={(nextCard) =>
                        selectedActivity ? appendCard(selectedActivity.id, nextCard) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Server History</p>
                <h2>저장된 버전</h2>
              </div>
              <p className="panelHint">필요한 버전을 작업 화면으로 복원할 수 있습니다.</p>
            </div>
            {designHistory.length ? (
              <div className="historyList">
                {designHistory.map((historyItem) => (
                  <article key={`${historyItem.id}-${historyItem.version}`} className="historyCard">
                    <div className="historyCardBody">
                      <strong>{formatDesignLabel(historyItem)}</strong>
                      <p>
                        활동 {historyItem.activities.length}개 · 카드 배치 {historyItem.placements.length}개
                      </p>
                      <span>{formatSyncTime(historyItem.updatedAt)}</span>
                    </div>
                    <button
                      type="button"
                      className="tableActionButton"
                      onClick={() => loadDesignVersion(historyItem)}
                    >
                      이 버전 불러오기
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">아직 서버에 저장된 설계 버전이 없습니다.</p>
            )}
          </section>
        </section>

        <footer className="statusBar statusBarFull">
          <div>
            <strong>저장 상태</strong>
            <span>브라우저에는 자동 저장되고, 서버 저장은 버튼으로 수행됩니다.</span>
          </div>
          <div>
            <strong>서버 설계 버전</strong>
            <span>{designHistory.length}개</span>
          </div>
          <div>
            <strong>마지막 서버 저장</strong>
            <span>{formatSyncTime(lastServerSyncAt)}</span>
          </div>
          <div>
            <strong>상태 메시지</strong>
            <span>{statusMessage || "대기 중"}</span>
          </div>
        </footer>
      </main>
    </DndContext>
  );
}