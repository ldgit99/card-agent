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
import {
  fetchWorkspaceSnapshot,
  saveDesignToWorkspace,
} from "@/lib/workspace-client";
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
}

function DraggableCard({ card, onQuickAdd }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${card.id}`,
    data: { card },
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
      }}
      className={`libraryCard libraryCard-${card.actor}`}
      {...listeners}
      {...attributes}
    >
      <div>
        <p className="libraryCardCategory">{card.category}</p>
        <h4>{card.title}</h4>
        <p className="libraryCardPrompt">{card.prompt}</p>
      </div>
      <button type="button" className="ghostButton" onClick={() => onQuickAdd(card)}>
        배치
      </button>
    </article>
  );
}

interface DropZoneProps {
  id: string;
  title: string;
  description: string;
  actor: CardActor;
  cards: OrchestrationCard[];
  onRemove: (cardId: string) => void;
}

function DropZone({ id, title, description, actor, cards, onRemove }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { actor } });

  return (
    <section
      ref={setNodeRef}
      className={`dropZone dropZone-${actor} ${isOver ? "dropZone-over" : ""}`}
    >
      <header className="dropZoneHeader">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="dropZoneCount">{cards.length}</span>
      </header>
      <div className="dropZoneBody">
        {cards.length ? (
          cards.map((card) => (
            <div key={`${id}-${card.id}`} className={`placedCard placedCard-${card.actor}`}>
              <div>
                <strong>{card.title}</strong>
                <p>{card.intent}</p>
              </div>
              <button type="button" className="iconButton" onClick={() => onRemove(card.id)}>
                제거
              </button>
            </div>
          ))
        ) : (
          <p className="dropZoneEmpty">
            {actor === "teacher"
              ? "왼쪽 카드 라이브러리에서 인간 활동 카드를 이 칸으로 끌어오세요."
              : "왼쪽 카드 라이브러리에서 AI 카드를 이 칸으로 끌어오세요."}
          </p>
        )}
      </div>
    </section>
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );
  const [design, setDesign] = useState<LessonDesign>(getInitialDesign);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
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
          setStatusMessage("서버 저장본을 불러왔습니다.");
        } else {
          setStatusMessage("서버 저장본이 없어 브라우저 임시 저장본으로 시작합니다.");
        }

        setDesignHistory(snapshot.designHistory);
        setLastServerSyncAt(snapshot.updatedAt);
      } catch {
        if (active) {
          setStatusMessage("서버 저장소 연결 전: 브라우저 임시 저장본으로 시작합니다.");
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
    commitDesign({
      ...design,
      meta: {
        ...design.meta,
        [field]: value,
      },
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
    commitDesign({
      ...design,
      activities: [...design.activities, nextActivity],
    });
    setSelectedActivityId(nextActivity.id);
  }

  function removeActivity(activityId: string) {
    if (design.activities.length === 1) {
      return;
    }

    const remainingActivities = design.activities.filter(
      (activity) => activity.id !== activityId,
    );

    commitDesign({
      ...design,
      activities: remainingActivities,
    });

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

    updateActivity(activityId, {
      [slot]: [...activity[slot], card.id],
    });
  }

  function removeCard(activityId: string, actor: CardActor, cardId: string) {
    const slot = actor === "teacher" ? "humanCardIds" : "aiCardIds";
    const activity = design.activities.find((item) => item.id === activityId);
    if (!activity) {
      return;
    }

    updateActivity(activityId, {
      [slot]: activity[slot].filter((item) => item !== cardId),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const card = event.active.data.current?.card as OrchestrationCard | undefined;
    const overId = String(event.over?.id ?? "");

    if (!card || !selectedActivity) {
      return;
    }

    if (overId === `human-slot-${selectedActivity.id}` && card.actor === "teacher") {
      appendCard(selectedActivity.id, card);
    }

    if (overId === `ai-slot-${selectedActivity.id}` && card.actor === "ai") {
      appendCard(selectedActivity.id, card);
    }
  }

  async function analyzeDesign() {
    setIsAnalyzing(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/design/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ design }),
      });

      if (!response.ok) {
        throw new Error("설계 분석 요청이 실패했습니다.");
      }

      const payload = (await response.json()) as { analysis: DesignAnalysis };
      setAnalysis(payload.analysis);
      setStatusMessage(
        payload.analysis.engine === "openai"
          ? "OpenAI 기반 설계 점검을 완료했습니다."
          : "휴리스틱 기반 설계 점검을 완료했습니다.",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "설계 분석 중 오류가 발생했습니다.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function persistDesign() {
    setIsSyncingWorkspace(true);

    try {
      const response = await saveDesignToWorkspace({
        design,
        persistVersion: true,
      });
      setDesignHistory(response.designHistory);
      setLastServerSyncAt(response.updatedAt);
      setStatusMessage("현재 설계안을 서버 저장소에 저장했습니다.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "서버 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  async function reloadFromServer() {
    setIsSyncingWorkspace(true);

    try {
      const snapshot = await fetchWorkspaceSnapshot();
      if (!snapshot.currentDesign) {
        setStatusMessage("서버에 저장된 설계안이 없습니다.");
        return;
      }

      const nextDesign = normalizeLessonDesignDraft(snapshot.currentDesign);
      setDesign(nextDesign);
      setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
      setDesignHistory(snapshot.designHistory);
      setLastServerSyncAt(snapshot.updatedAt);
      setAnalysis(null);
      setStatusMessage("서버 저장본을 다시 불러왔습니다.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "서버 저장본을 불러오지 못했습니다.",
      );
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  function loadDesignVersion(versionDesign: LessonDesign) {
    const nextDesign = normalizeLessonDesignDraft(versionDesign);
    setDesign(nextDesign);
    setSelectedActivityId(nextDesign.activities[0]?.id ?? null);
    setAnalysis(null);
    setStatusMessage(`${formatDesignLabel(versionDesign)} 버전을 작업 화면에 불러왔습니다.`);
  }

  const selectedHumanCards = selectedActivity ? findCards(selectedActivity.humanCardIds) : [];
  const selectedAiCards = selectedActivity ? findCards(selectedActivity.aiCardIds) : [];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="appShell">
        <section className="heroPanel">
          <div>
            <p className="eyebrow">Harness-Based Teacher Agent</p>
            <h1>수업 설계 오케스트레이션 스튜디오</h1>
            <p className="heroCopy">
              1페이지에서는 수업 활동의 구조를 입력하고, 선택한 활동에 인간 활동 카드와
              AI 카드를 배치합니다. 카드 배치는 다음 페이지의 모의수업 시뮬레이션 입력이
              됩니다.
            </p>
          </div>
          <div className="heroActions">
            <button type="button" className="primaryButton" onClick={analyzeDesign}>
              {isAnalyzing ? "설계 점검 중..." : "설계 점검 실행"}
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
        </section>

        <section className="workspaceGrid">
          <div className="mainColumn">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="sectionTag">Step 1</p>
                  <h2>수업 개요 입력</h2>
                </div>
                <p className="panelHint">주제, 교과, 대상을 먼저 고정합니다.</p>
              </div>
              <div className="metaTable">
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
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="sectionTag">Step 2</p>
                  <h2>수업 활동 표 설계</h2>
                </div>
                <div className="inlineActions">
                  <span className="panelHint">
                    행을 선택하면 오른쪽 카드 배치 영역이 해당 활동과 연결됩니다.
                  </span>
                  <button type="button" className="ghostButton" onClick={addActivity}>
                    활동 추가
                  </button>
                </div>
              </div>
              <div className="tableWrap">
                <table className="lessonTable">
                  <thead>
                    <tr>
                      <th>기능</th>
                      <th>교과</th>
                      <th>학습활동</th>
                      <th>평가 방법</th>
                      <th className="narrowCell">선택</th>
                    </tr>
                  </thead>
                  <tbody>
                    {design.activities.map((activity) => {
                      const isSelected = selectedActivity?.id === activity.id;

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
                                updateActivity(activity.id, {
                                  functionLabel: event.target.value,
                                })
                              }
                              placeholder="예: 조사하기"
                            />
                          </td>
                          <td>
                            <input
                              value={activity.subjectLabel}
                              onFocus={() => setSelectedActivityId(activity.id)}
                              onChange={(event) =>
                                updateActivity(activity.id, {
                                  subjectLabel: event.target.value,
                                })
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
                                updateActivity(activity.id, {
                                  learningActivity: event.target.value,
                                })
                              }
                              placeholder="예: 지구온난화 원인과 영향을 조사하고 AI가 제시한 해석을 비교하기"
                            />
                          </td>
                          <td>
                            <textarea
                              rows={3}
                              value={activity.assessmentMethod}
                              onFocus={() => setSelectedActivityId(activity.id)}
                              onChange={(event) =>
                                updateActivity(activity.id, {
                                  assessmentMethod: event.target.value,
                                })
                              }
                              placeholder="예: 보고서 평가, 토론 관찰"
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
            </section>

            {analysis ? (
              <section className="panel analysisPanel">
                <div className="panelHeader">
                  <div>
                    <p className="sectionTag">Step 3</p>
                    <h2>설계 점검 결과</h2>
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
                  <p className="sectionTag">서버 설계 이력</p>
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
                          활동 {historyItem.activities.length}개 · 카드 {historyItem.placements.length}개
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
          </div>

          <aside className="sideColumn">
            <section className="panel stickyPanel">
              <div className="panelHeader">
                <div>
                  <p className="sectionTag">선택된 활동</p>
                  <h2>
                    {selectedActivity?.title || selectedActivity?.functionLabel || "활동을 선택하세요"}
                  </h2>
                </div>
                <p className="panelHint">
                  {selectedActivity
                    ? `${selectedActivity.order}번째 활동`
                    : "활동 표에서 한 행을 선택하세요."}
                </p>
              </div>

              {selectedActivity ? (
                <>
                  <DropZone
                    id={`human-slot-${selectedActivity.id}`}
                    title="인간 활동 카드"
                    description="교사의 질문, 조율, 판단 책임을 드러내는 카드"
                    actor="teacher"
                    cards={selectedHumanCards}
                    onRemove={(cardId) => removeCard(selectedActivity.id, "teacher", cardId)}
                  />
                  <DropZone
                    id={`ai-slot-${selectedActivity.id}`}
                    title="AI 카드"
                    description="생성, 분석, 피드백 등 AI 역할을 정의하는 카드"
                    actor="ai"
                    cards={selectedAiCards}
                    onRemove={(cardId) => removeCard(selectedActivity.id, "ai", cardId)}
                  />

                  <div className="detailForm">
                    <label>
                      <span>학습목표</span>
                      <textarea
                        rows={3}
                        value={selectedActivity.learningObjective}
                        onChange={(event) =>
                          updateActivity(selectedActivity.id, {
                            learningObjective: event.target.value,
                          })
                        }
                        placeholder="학생이 이 활동에서 무엇을 이해하거나 판단해야 하는지 적으세요."
                      />
                    </label>
                    <label>
                      <span>교사 개입 메모</span>
                      <textarea
                        rows={3}
                        value={selectedActivity.teacherMove}
                        onChange={(event) =>
                          updateActivity(selectedActivity.id, {
                            teacherMove: event.target.value,
                          })
                        }
                        placeholder="교사가 어느 시점에 어떤 질문 또는 피드백을 줄지 적으세요."
                      />
                    </label>
                    <label>
                      <span>사용 도구</span>
                      <textarea
                        rows={2}
                        value={selectedActivity.tools.join("\n")}
                        onChange={(event) =>
                          updateActivity(selectedActivity.id, {
                            tools: parseMultilineField(event.target.value),
                          })
                        }
                        placeholder="예: ChatGPT, 패들렛, 교과서"
                      />
                    </label>
                    <label>
                      <span>성공 증거</span>
                      <textarea
                        rows={2}
                        value={selectedActivity.evidenceOfSuccess.join("\n")}
                        onChange={(event) =>
                          updateActivity(selectedActivity.id, {
                            evidenceOfSuccess: parseMultilineField(event.target.value),
                          })
                        }
                        placeholder="학생이 보여야 할 말, 행동, 산출물"
                      />
                    </label>
                    <label>
                      <span>메모</span>
                      <textarea
                        rows={3}
                        value={selectedActivity.notes}
                        onChange={(event) =>
                          updateActivity(selectedActivity.id, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="심리적 안전, 역할 분담, 시간 운영 등 추가 메모"
                      />
                    </label>
                  </div>
                </>
              ) : null}
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="sectionTag">카드 라이브러리</p>
                  <h2>드래그 앤 드롭 배치</h2>
                </div>
                <p className="panelHint">드래그가 어려우면 각 카드의 `배치` 버튼을 사용하세요.</p>
              </div>
              <div className="cardLibraryGrid">
                <div>
                  <h3 className="libraryHeading">인간 활동 카드</h3>
                  <div className="libraryList">
                    {teacherCards.map((card) => (
                      <DraggableCard
                        key={card.id}
                        card={card}
                        onQuickAdd={(nextCard) =>
                          selectedActivity ? appendCard(selectedActivity.id, nextCard) : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="libraryHeading">AI 카드</h3>
                  <div className="libraryList">
                    {aiCards.map((card) => (
                      <DraggableCard
                        key={card.id}
                        card={card}
                        onQuickAdd={(nextCard) =>
                          selectedActivity ? appendCard(selectedActivity.id, nextCard) : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </section>

        <footer className="statusBar">
          <div>
            <strong>저장 상태</strong>
            <span>브라우저에는 자동 저장, 서버에는 수동 저장됩니다.</span>
          </div>
          <div>
            <strong>서버 저장 버전</strong>
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