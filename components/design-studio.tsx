"use client";


import { useRouter } from "next/navigation";
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
import {
  loadStoredDesign,
  loadStoredDesignHistory,
  saveStoredDesign,
  saveStoredDesignHistory,
  saveStoredDesignVersion,
} from "@/lib/storage";
import { WorkspaceTopbar } from "@/components/workspace-topbar";
import { fetchWorkspaceSnapshot, saveDesignToWorkspace } from "@/lib/workspace-client";
import type {
  CardActor,
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

interface CardFaceProps {
  card: OrchestrationCard;
  compact?: boolean;
}

interface RowDropZoneProps {
  id: string;
  actor: CardActor;
  cards: OrchestrationCard[];
  onRemove: (cardId: string) => void;
}

function formatCardNumber(cardId: string) {
  const numeric = cardId.replace(/^[A-Za-z]+/, "");
  return numeric.padStart(2, "0");
}

function getCardIcon(actor: CardActor) {
  return actor === "teacher" ? "🧑‍🏫" : "🤖";
}

function CardFace({ card, compact = false }: CardFaceProps) {
  return (
    <>
      <div className="promptCardHeader">
        <div className="promptCardIdentity">
          <span className={`promptCardIcon promptCardIcon-${card.actor}`} aria-hidden="true">
            {getCardIcon(card.actor)}
          </span>
          <span className={`promptCardBadge promptCardBadge-${card.actor}`}>{card.title}</span>
        </div>
        <span className="promptCardNumber">{formatCardNumber(card.id)}</span>
      </div>
      <div className="promptCardBody">
        <p className={`promptCardQuestion ${compact ? "promptCardQuestion-compact" : ""}`}>{card.prompt}</p>
      </div>
      <div className="promptCardDivider" />
      <p className={`promptCardIntent ${compact ? "promptCardIntent-compact" : ""}`}>
        → {card.intent}
      </p>
    </>
  );
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
      className={`libraryCard promptCard promptCard-library promptCard-${card.actor}`}
      {...listeners}
      {...attributes}
    >
      <CardFace card={card} />
      <button
        type="button"
        className="promptCardButton"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onQuickAdd(card)}
        disabled={disabled}
      >
        현재 활동에 배치
      </button>
    </article>
  );
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
            <article
              key={`${id}-${card.id}`}
              className={`tablePlacedCard promptCard promptCard-compact promptCard-${card.actor}`}
            >
              <button
                type="button"
                className="tableChipRemove promptCardRemove"
                onClick={() => onRemove(card.id)}
                aria-label={`${card.title} 제거`}
              >
                ×
              </button>
              <CardFace card={card} compact />
            </article>
          ))}
        </div>
      ) : (
        <div className="tableDropZoneEmpty">
          <strong>{actor === "teacher" ? "교사 카드" : "AI 카드"}</strong>
          <span>하단 라이브러리에서 드래그해 배치합니다.</span>
        </div>
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


export function DesignStudio() {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const [design, setDesign] = useState<LessonDesign>(getInitialDesign);
  const [learningGoalsInput, setLearningGoalsInput] = useState(() => getInitialDesign().learningGoals.join("\n"));
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSyncingWorkspace, setIsSyncingWorkspace] = useState(false);
  const [isNavigatingToSimulation, setIsNavigatingToSimulation] = useState(false);
  const [designHistory, setDesignHistory] = useState<LessonDesign[]>([]);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);

  const selectedActivity =
    design.activities.find((activity) => activity.id === selectedActivityId) ?? design.activities[0] ?? null;

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
    const localHistory = loadStoredDesignHistory();

    if (localHistory.length) {
      setDesignHistory(localHistory);
    }

    async function hydrateFromWorkspace() {
      try {
        const snapshot = await fetchWorkspaceSnapshot();
        if (!active) {
          return;
        }

        const nextHistory = snapshot.designHistory.length ? snapshot.designHistory : localHistory;
        if (nextHistory.length) {
          setDesignHistory(saveStoredDesignHistory(nextHistory));
        }

        const latestSaved = snapshot.designHistory[0] ?? snapshot.currentDesign ?? localHistory[0] ?? null;
        if (latestSaved) {
          const nextDesign = normalizeLessonDesignDraft(latestSaved, { version: latestSaved.version });
          setDesign(nextDesign);
          setLearningGoalsInput(nextDesign.learningGoals.join("\n"));
          setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
          saveStoredDesign(nextDesign);
          setStatusMessage("최신 저장본을 불러왔습니다.");
        } else {
          setStatusMessage("저장된 설계가 없어 현재 작업본으로 시작합니다.");
        }

        setLastServerSyncAt(snapshot.updatedAt);
      } catch {
        if (!active) {
          return;
        }

        const latestLocal = localHistory[0] ?? loadStoredDesign();
        if (latestLocal) {
          const nextDesign = normalizeLessonDesignDraft(latestLocal, { version: latestLocal.version });
          setDesign(nextDesign);
          setLearningGoalsInput(nextDesign.learningGoals.join("\n"));
          setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
          saveStoredDesign(nextDesign);
          setStatusMessage("브라우저 저장본을 불러왔습니다.");
        } else {
          setStatusMessage("저장된 설계가 없어 현재 작업본으로 시작합니다.");
        }
      }
    }

    void hydrateFromWorkspace();

    return () => {
      active = false;
    };
  }, []);

  function applyDesignToEditor(nextDesign: LessonDesign) {
    setDesign(nextDesign);
    setLearningGoalsInput(nextDesign.learningGoals.join("\n"));
    setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
  }

  function syncHistory(nextHistory: LessonDesign[]) {
    setDesignHistory(saveStoredDesignHistory(nextHistory));
  }

  function commitDesign(nextDesign: LessonDesign) {
    setDesign(normalizeLessonDesignDraft(nextDesign));
  }

  function updateMeta(field: keyof LessonDesign["meta"], value: string) {
    commitDesign({ ...design, meta: { ...design.meta, [field]: value } });
  }

  function updateLearningGoals(value: string) {
    setLearningGoalsInput(value);
    commitDesign({
      ...design,
      learningGoals: parseMultilineField(value),
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

  async function persistDesign() {
    setIsSyncingWorkspace(true);

    const nextDesign = normalizeLessonDesignDraft(design, { version: design.version + 1 });
    applyDesignToEditor(nextDesign);
    saveStoredDesign(nextDesign);
    const localHistory = saveStoredDesignVersion(nextDesign);
    setDesignHistory(localHistory);

    try {
      const response = await saveDesignToWorkspace({ design: nextDesign, persistVersion: true });
      syncHistory(response.designHistory.length ? response.designHistory : localHistory);
      setLastServerSyncAt(response.updatedAt);
      setStatusMessage(`v${nextDesign.version} 설계를 저장했습니다.`);
    } catch {
      setStatusMessage(`v${nextDesign.version} 설계를 브라우저에 저장했습니다. 서버 저장소 연결이 없으면 이 저장본으로 계속 작업할 수 있습니다.`);
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  async function reloadFromServer() {
    setIsSyncingWorkspace(true);
    const localHistory = loadStoredDesignHistory();

    try {
      const snapshot = await fetchWorkspaceSnapshot();
      const nextHistory = snapshot.designHistory.length ? snapshot.designHistory : localHistory;
      if (nextHistory.length) {
        syncHistory(nextHistory);
      }

      const latestSaved = snapshot.designHistory[0] ?? snapshot.currentDesign ?? localHistory[0] ?? loadStoredDesign();
      if (!latestSaved) {
        setStatusMessage("불러올 저장본이 없습니다.");
        return;
      }

      const nextDesign = normalizeLessonDesignDraft(latestSaved, { version: latestSaved.version });
      applyDesignToEditor(nextDesign);
      saveStoredDesign(nextDesign);
      setLastServerSyncAt(snapshot.updatedAt);
      setStatusMessage(`${formatDesignLabel(latestSaved)} 저장본을 불러왔습니다.`);
    } catch {
      const latestLocal = localHistory[0] ?? loadStoredDesign();
      if (!latestLocal) {
        setStatusMessage("브라우저에도 저장된 설계가 없습니다.");
        return;
      }

      const nextDesign = normalizeLessonDesignDraft(latestLocal, { version: latestLocal.version });
      applyDesignToEditor(nextDesign);
      saveStoredDesign(nextDesign);
      syncHistory(localHistory);
      setStatusMessage(`${formatDesignLabel(latestLocal)} 브라우저 저장본을 불러왔습니다.`);
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  async function navigateToSimulation() {
    if (isNavigatingToSimulation) {
      return;
    }

    setIsNavigatingToSimulation(true);
    setStatusMessage("수업 설계를 저장한 뒤 모의 수업 실행 화면으로 이동합니다.");

    try {
      saveStoredDesign(design);
      const response = await saveDesignToWorkspace({ design, persistVersion: true });
      setDesignHistory(response.designHistory);
      setLastServerSyncAt(response.updatedAt);
      router.push("/simulation");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `${error.message} 브라우저 저장본으로 모의 수업 실행 화면으로 이동합니다.`
          : "서버 저장 없이 브라우저 저장본으로 모의 수업 실행 화면으로 이동합니다.",
      );
      router.push("/simulation");
    } finally {
      setIsNavigatingToSimulation(false);
    }
  }
  function loadDesignVersion(versionDesign: LessonDesign) {
    const nextDesign = normalizeLessonDesignDraft(versionDesign, { version: versionDesign.version });
    applyDesignToEditor(nextDesign);
    saveStoredDesign(nextDesign);
    setStatusMessage(`${formatDesignLabel(versionDesign)} 버전을 작업 화면으로 불러왔습니다.`);
  }

  const latestSavedAt = designHistory[0]?.updatedAt ?? lastServerSyncAt;

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
          <div className="heroPanelStack">
            <WorkspaceTopbar
              active="design"
              navigationHandlers={{ simulation: navigateToSimulation }}
              disabledSection={isNavigatingToSimulation ? "simulation" : null}
              actions={
                <>
                  <button type="button" className="primaryButton" onClick={persistDesign}>
                    {isSyncingWorkspace ? "저장 중..." : "설계 저장"}
                  </button>
                  <button type="button" className="ghostButton" onClick={reloadFromServer}>
                    최신 저장본 불러오기
                  </button>
                </>
              }
            />
            <div className="heroPanelMain">
              <div>
                <p className="eyebrow">Lesson Design Workspace</p>
                <h1>수업 설계 스튜디오</h1>
                <p className="heroCopy">
                  주제, 교과, 대상, 학습 목표를 먼저 정리하고 활동 표 안에서 바로 교사 카드와 AI 카드를 배치합니다.
                  카드 라이브러리는 하단에 두고, 각 활동 행의 카드 칸에 직접 드래그해 연결하도록 구성했습니다.
                </p>
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
            </div>
          </div>
        </section>

        <section className="designStack">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Lesson Setup</p>
                <h2>수업 개요 입력</h2>
              </div>
              <p className="panelHint">교과와 대상 아래에 학습 목표를 먼저 정리합니다.</p>
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
              <label className="metaSupplementCard metaSupplementCardWide">
                <span>학습 목표</span>
                <textarea
                  rows={4}
                  value={learningGoalsInput}
                  onChange={(event) => updateLearningGoals(event.target.value)}
                  placeholder="한 줄에 하나씩 입력해 주세요."
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Activity Design</p>
                <h2>학습 활동 설계</h2>
              </div>
              <div className="inlineActions">
                <span className="panelHint">AI도구와 평가 방법을 적고, 오른쪽 카드 칸에 드래그앤드롭으로 바로 배치합니다.</span>
                <button type="button" className="ghostButton" onClick={addActivity}>
                  활동 추가
                </button>
              </div>
            </div>

            <div className="tableWrap tableWrapWide">
              <table className="lessonTable lessonTableCards">
                <thead>
                  <tr>
                    <th className="colFunction">기능</th>
                    <th className="colSubject">교과</th>
                    <th className="colLearningActivity">학습활동</th>
                    <th className="colAiTools">AI도구</th>
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
                            onChange={(event) => updateActivity(activity.id, { functionLabel: event.target.value })}
                            placeholder="예: 조사하기"
                          />
                        </td>
                        <td>
                          <input
                            value={activity.subjectLabel}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { subjectLabel: event.target.value })}
                            placeholder="예: 과학"
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.learningActivity}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { learningActivity: event.target.value })}
                            placeholder="예: 지구온난화의 원인과 영향을 조사하고 AI 설명과 비교한다."
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.tools.join(", ")}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) =>
                              updateActivity(activity.id, { tools: parseMultilineField(event.target.value) })
                            }
                            placeholder="예: ChatGPT, NotebookLM"
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.assessmentMethod}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { assessmentMethod: event.target.value })}
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
            <div className="mobileActivityList" aria-label="모바일 활동 카드 목록">
              {design.activities.map((activity) => {
                const isSelected = selectedActivity?.id === activity.id;
                const humanCards = findCards(activity.humanCardIds);
                const rowAiCards = findCards(activity.aiCardIds);

                return (
                  <article
                    key={`mobile-${activity.id}`}
                    className={`mobileActivityCard ${isSelected ? "mobileActivityCard-selected" : ""}`}
                    onClick={() => setSelectedActivityId(activity.id)}
                  >
                    <div className="mobileActivityHeader">
                      <div>
                        <p className="sectionMicroTag">Activity {activity.order}</p>
                        <h3>{activity.functionLabel || `활동 ${activity.order}`}</h3>
                      </div>
                      <div className="mobileActivityActions">
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
                      </div>
                    </div>
                    <div className="mobileActivityFields">
                      <label className="mobileActivityField">
                        <span>기능</span>
                        <input
                          value={activity.functionLabel}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { functionLabel: event.target.value })}
                          placeholder="예: 조사하기"
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>교과</span>
                        <input
                          value={activity.subjectLabel}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { subjectLabel: event.target.value })}
                          placeholder="예: 과학"
                        />
                      </label>
                      <label className="mobileActivityField mobileActivityField-wide">
                        <span>학습활동</span>
                        <textarea
                          rows={4}
                          value={activity.learningActivity}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { learningActivity: event.target.value })}
                          placeholder="예: 생성형 AI를 활용해 자료를 조사하고 비교합니다."
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>AI도구</span>
                        <textarea
                          rows={3}
                          value={activity.tools.join(", ")}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { tools: parseMultilineField(event.target.value) })}
                          placeholder="예: ChatGPT, NotebookLM"
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>평가 방법</span>
                        <textarea
                          rows={3}
                          value={activity.assessmentMethod}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { assessmentMethod: event.target.value })}
                          placeholder="예: 보고서 평가, 토론 참여 관찰"
                        />
                      </label>
                    </div>
                    <div className="mobileDropGrid">
                      <div className="mobileDropColumn">
                        <span className="mobileDropLabel">교사 카드</span>
                        <RowDropZone
                          id={`human-slot-${activity.id}`}
                          actor="teacher"
                          cards={humanCards}
                          onRemove={(cardId) => removeCard(activity.id, "teacher", cardId)}
                        />
                      </div>
                      <div className="mobileDropColumn">
                        <span className="mobileDropLabel">AI 카드</span>
                        <RowDropZone
                          id={`ai-slot-${activity.id}`}
                          actor="ai"
                          cards={rowAiCards}
                          onRemove={(cardId) => removeCard(activity.id, "ai", cardId)}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>


          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Card Library</p>
                <h2>하단 카드 라이브러리</h2>
              </div>
              <p className="panelHint">
                필요한 활동의 카드 칸으로 직접 드래그하거나, 현재 선택한 활동에 빠르게 배치할 수 있습니다.
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
                      onQuickAdd={(nextCard) => {
                        if (selectedActivity) {
                          appendCard(selectedActivity.id, nextCard);
                        }
                      }}
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
                      onQuickAdd={(nextCard) => {
                        if (selectedActivity) {
                          appendCard(selectedActivity.id, nextCard);
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Saved Versions</p>
                <h2>저장된 버전</h2>
              </div>
              <p className="panelHint">브라우저 또는 서버에 저장된 버전을 작업 화면으로 복원할 수 있습니다.</p>
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
                    <button type="button" className="tableActionButton" onClick={() => loadDesignVersion(historyItem)}>
                      이 버전 불러오기
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">아직 저장된 설계 버전이 없습니다.</p>
            )}
          </section>
        </section>

        <footer className="statusBar statusBarFull">
          <div>
            <strong>저장 상태</strong>
            <span>브라우저에는 자동 저장되고, 설계 저장 버튼으로 버전 이력을 남깁니다.</span>
          </div>
          <div>
            <strong>저장된 설계 버전</strong>
            <span>{designHistory.length}개</span>
          </div>
          <div>
            <strong>마지막 저장</strong>
            <span>{formatSyncTime(latestSavedAt)}</span>
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
