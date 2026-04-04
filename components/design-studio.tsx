"use client";


import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { getAvailableCards, getCardsByLibraryGroup } from "@/lib/card-registry";
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
  CardLibraryGroup,
  LessonActivity,
  LessonDesign,
  OrchestrationCard,
} from "@/types/lesson";
import { useEffect, useMemo, useState } from "react";

interface DraggableCardProps {
  card: OrchestrationCard;
  numberLabel: string;
  onQuickAdd: (card: OrchestrationCard) => void;
  disabled?: boolean;
}

interface EditableCustomCardProps {
  card: OrchestrationCard;
  numberLabel: string;
  onQuickAdd: (card: OrchestrationCard) => void;
  onChange: (cardId: string, patch: Partial<OrchestrationCard>) => void;
  onSave: (cardId: string) => void;
  disabled?: boolean;
}

interface CardFaceProps {
  card: OrchestrationCard;
  numberLabel: string;
  compact?: boolean;
}

interface RowDropZoneProps {
  id: string;
  label: string;
  tone: CardLibraryGroup;
  cards: OrchestrationCard[];
  numberByCardId: Record<string, string>;
  onRemove: (cardId: string) => void;
  onSlotClick: () => void;
}

interface CardPickerPopupProps {
  group: CardLibraryGroup;
  groupLabel: string;
  cards: OrchestrationCard[];
  numberByCardId: Record<string, string>;
  placedCardIds: string[];
  isSingleSlot: boolean;
  onSelect: (card: OrchestrationCard) => void;
  onClose: () => void;
}

const libraryColumns: Array<{
  group: CardLibraryGroup;
  eyebrow: string;
  heading: string;
}> = [
  { group: "function", eyebrow: "Function", heading: "기능카드" },
  { group: "ai_edutech", eyebrow: "AI Edutech", heading: "AI에듀테크카드" },
  { group: "assessment", eyebrow: "Assessment", heading: "평가카드" },
  { group: "teacher_intervention", eyebrow: "Teacher Move", heading: "교사개입카드" },
  { group: "ai_role", eyebrow: "AI Role", heading: "AI역할카드" },
];

function formatCardNumber(value: number | string) {
  const numeric = typeof value === "number" ? value : Number(value.replace(/^[A-Za-z]+/, ""));
  return String(numeric).padStart(2, "0");
}

function getCardIcon(group: CardLibraryGroup) {
  if (group === "function") return "🧩";
  if (group === "ai_edutech") return "🛠️";
  if (group === "assessment") return "📝";
  if (group === "teacher_intervention") return "🧑‍🏫";
  return "🤖";
}

function getCardTone(card: OrchestrationCard) {
  return `promptCardGroup-${card.libraryGroup}`;
}

function getGroupDropHint(_label: string) {
  return "클릭 또는 하단의 카드를 드래그 앤 드롭합니다.";
}

function CardFace({ card, numberLabel, compact = false }: CardFaceProps) {
  return (
    <>
      <div className="promptCardHeader">
        <div className="promptCardIdentity">
          <span className={`promptCardIcon promptCardIcon-${card.libraryGroup}`} aria-hidden="true">
            {getCardIcon(card.libraryGroup)}
          </span>
          <span className={`promptCardBadge promptCardBadge-${card.libraryGroup}`}>{card.title}</span>
        </div>
        <span className="promptCardNumber">{numberLabel}</span>
      </div>
      <div className="promptCardBody">
        <p className={`promptCardQuestion ${compact ? "promptCardQuestion-compact" : ""}`}>{card.prompt}</p>
      </div>
      {compact ? null : (
        <>
          <div className="promptCardDivider" />
          <p className={`promptCardIntent ${compact ? "promptCardIntent-compact" : ""}`}>
            → {card.intent}
          </p>
        </>
      )}
    </>
  );
}

function DraggableCard({ card, numberLabel, onQuickAdd, disabled = false }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${card.id}`,
    data: { card },
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.62 : 1 }}
      className={`libraryCard promptCard promptCard-library promptCard-${card.actor} ${getCardTone(card)}`}
      {...listeners}
      {...attributes}
    >
      <CardFace card={card} numberLabel={numberLabel} />
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

function EditableCustomCard({
  card,
  numberLabel,
  onQuickAdd,
  onChange,
  onSave,
  disabled = false,
}: EditableCustomCardProps) {
  const ready = isCardReady(card);

  return (
    <article className={`libraryCard promptCard promptCard-library promptCard-${card.actor} ${getCardTone(card)} promptCard-custom`}>
      <div className="promptCardHeader">
        <div className="promptCardIdentity">
          <span className={`promptCardIcon promptCardIcon-${card.libraryGroup}`} aria-hidden="true">
            {getCardIcon(card.libraryGroup)}
          </span>
          <span className={`promptCardBadge promptCardBadge-${card.libraryGroup}`}>사용자 정의</span>
        </div>
        <span className="promptCardNumber">{numberLabel}</span>
      </div>
      <div className="promptCardCustomFields">
        <label className="promptCardField">
          <span>카드 제목</span>
          <input
            className="promptCardInput"
            value={card.title}
            onChange={(event) => onChange(card.id, { title: event.target.value })}
            placeholder={card.actor === "teacher" ? "예: 재질문" : "예: 비교 제안"}
          />
        </label>
        <label className="promptCardField">
          <span>질문·행동</span>
          <textarea
            className="promptCardTextarea"
            rows={3}
            value={card.prompt}
            onChange={(event) => onChange(card.id, { prompt: event.target.value })}
            placeholder={
              card.actor === "teacher"
                ? "예: 왜 그렇게 생각했나요?"
                : "예: 비교할 대안을 3가지로 정리합니다."
            }
          />
        </label>
        <label className="promptCardField">
          <span>의도</span>
          <input
            className="promptCardInput"
            value={card.intent}
            onChange={(event) => onChange(card.id, { intent: event.target.value })}
            placeholder="예: 학생 설명을 더 깊게 만든다"
          />
        </label>
      </div>
      <div className="promptCardCustomActions">
        <button
          type="button"
          className="ghostButton promptCardMiniButton"
          onClick={() => onSave(card.id)}
          disabled={!ready}
        >
          카드 저장
        </button>
        <button
          type="button"
          className="promptCardButton"
          onClick={() => onQuickAdd(card)}
          disabled={disabled || !ready}
        >
          현재 활동에 배치
        </button>
      </div>
    </article>
  );
}
function RowDropZone({ id, label, tone, cards, numberByCardId, onRemove, onSlotClick }: RowDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { tone } });

  return (
    <div
      ref={setNodeRef}
      className={`tableDropZone tableDropZone-${tone} ${isOver ? "tableDropZone-over" : ""}`}
      onClick={onSlotClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSlotClick(); } }}
      aria-label={`${label} 선택 팝업 열기`}
    >
      {cards.length ? (
        <div className="tableDropList">
          {cards.map((card) => (
            <article
              key={`${id}-${card.id}`}
              className={`tablePlacedCard promptCard promptCard-compact promptCard-${card.actor} ${getCardTone(card)}`}
            >
              <button
                type="button"
                className="tableChipRemove promptCardRemove"
                onClick={(e) => { e.stopPropagation(); onRemove(card.id); }}
                aria-label={`${card.title} 제거`}
              >
                ×
              </button>
              <CardFace
                card={card}
                numberLabel={numberByCardId[card.id] ?? formatCardNumber(card.id)}
                compact
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="tableDropZoneEmpty">
          <strong>{label}</strong>
          <span>{getGroupDropHint(label)}</span>
        </div>
      )}
    </div>
  );
}

function CardPickerPopup({ group, groupLabel, cards, numberByCardId, placedCardIds, isSingleSlot, onSelect, onClose }: CardPickerPopupProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="cardPickerOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${groupLabel} 카드 선택`}>
      <div className="cardPickerModal" onClick={(e) => e.stopPropagation()}>
        <div className="cardPickerHeader">
          <h3 className={`cardPickerTitle cardPickerTitle-${group}`}>{groupLabel}</h3>
          <button type="button" className="cardPickerClose" onClick={onClose} aria-label="닫기">×</button>
        </div>
        {isSingleSlot && placedCardIds.length > 0 && (
          <p className="cardPickerHint">새 카드를 선택하면 기존 카드가 교체됩니다.</p>
        )}
        <div className="cardPickerList">
          {cards.map((card) => {
            const alreadyPlaced = placedCardIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`cardPickerItem promptCard promptCard-${card.actor} ${getCardTone(card)} ${alreadyPlaced ? "cardPickerItem-placed" : ""}`}
                onClick={() => { if (!alreadyPlaced) { onSelect(card); onClose(); } }}
                disabled={alreadyPlaced}
                aria-pressed={alreadyPlaced}
              >
                <CardFace card={card} numberLabel={numberByCardId[card.id] ?? formatCardNumber(card.id)} />
                {alreadyPlaced && <span className="cardPickerItemBadge">배치됨</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getInitialDesign() {
  const stored = loadStoredDesign();
  return normalizeLessonDesignDraft(stored ?? createDefaultLessonDesign());
}

function findCards(cardIds: string[], cards: OrchestrationCard[]) {
  return cardIds
    .map((cardId) => cards.find((card) => card.id === cardId))
    .filter((card): card is OrchestrationCard => Boolean(card));
}

function isCardReady(card: OrchestrationCard) {
  return Boolean(card.title.trim() && card.prompt.trim());
}

function getActivityCardsByGroup(activity: LessonActivity, cards: OrchestrationCard[], group: CardLibraryGroup) {
  if (group === "function") {
    return activity.functionCardId ? findCards([activity.functionCardId], cards) : [];
  }

  if (group === "ai_edutech") {
    return findCards(activity.aiToolCardIds ?? [], cards);
  }

  if (group === "assessment") {
    return activity.assessmentCardId ? findCards([activity.assessmentCardId], cards) : [];
  }

  if (group === "teacher_intervention") {
    return findCards(activity.humanCardIds, cards);
  }

  return findCards(activity.aiCardIds, cards);
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
  );

  const [design, setDesign] = useState<LessonDesign>(getInitialDesign);
  const [learningGoalsInput, setLearningGoalsInput] = useState(() => getInitialDesign().learningGoals.join("\n"));
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSyncingWorkspace, setIsSyncingWorkspace] = useState(false);
  const [isNavigatingToSimulation, setIsNavigatingToSimulation] = useState(false);
  const [designHistory, setDesignHistory] = useState<LessonDesign[]>([]);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<{ activityId: string; group: CardLibraryGroup } | null>(null);
  const availableCards = useMemo(() => getAvailableCards(design.customCards), [design.customCards]);
  const libraryCardsByGroup = useMemo(
    () =>
      Object.fromEntries(
        libraryColumns.map(({ group }) => [group, getCardsByLibraryGroup(group, design.customCards)]),
      ) as Record<CardLibraryGroup, OrchestrationCard[]>,
    [design.customCards],
  );
  const cardNumberById = useMemo(
    () =>
      Object.fromEntries(
        libraryColumns.flatMap(({ group }) =>
          libraryCardsByGroup[group].map((card, index) => [card.id, formatCardNumber(index + 1)]),
        ),
      ) as Record<string, string>,
    [libraryCardsByGroup],
  );

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

  function updateCustomCard(cardId: string, patch: Partial<OrchestrationCard>) {
    commitDesign({
      ...design,
      customCards: design.customCards.map((card) =>
        card.id === cardId ? { ...card, ...patch, isCustom: true } : card,
      ),
    });
  }

  function saveCustomCard(cardId: string) {
    const card = design.customCards.find((item) => item.id === cardId);
    if (!card || !isCardReady(card)) {
      setStatusMessage("카드 제목과 질문·행동을 입력해 주세요.");
      return;
    }

    setStatusMessage(`'${card.title}' 카드를 저장했습니다.`);
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
    const activity = design.activities.find((item) => item.id === activityId);
    if (!activity) {
      return;
    }

    if (card.libraryGroup === "function") {
      updateActivity(activityId, { functionCardId: card.id, functionLabel: card.title });
      return;
    }

    if (card.libraryGroup === "ai_edutech") {
      if (activity.aiToolCardIds.includes(card.id)) {
        return;
      }

      const nextCardIds = [...activity.aiToolCardIds, card.id];
      updateActivity(activityId, {
        aiToolCardIds: nextCardIds,
        tools: findCards(nextCardIds, availableCards).map((item) => item.title),
      });
      return;
    }

    if (card.libraryGroup === "assessment") {
      updateActivity(activityId, { assessmentCardId: card.id, assessmentMethod: card.title });
      return;
    }

    if (card.libraryGroup === "teacher_intervention") {
      if (activity.humanCardIds.includes(card.id)) {
        return;
      }

      updateActivity(activityId, {
        humanCardIds: [...activity.humanCardIds, card.id],
        teacherMove: findCards([...activity.humanCardIds, card.id], availableCards)
          .map((item) => item.title)
          .join(", "),
      });
      return;
    }

    if (activity.aiCardIds.includes(card.id)) {
      return;
    }

    updateActivity(activityId, { aiCardIds: [...activity.aiCardIds, card.id] });
  }

  function removeCard(activityId: string, group: CardLibraryGroup, cardId: string) {
    const activity = design.activities.find((item) => item.id === activityId);
    if (!activity) {
      return;
    }

    if (group === "function") {
      updateActivity(activityId, { functionCardId: null, functionLabel: "" });
      return;
    }

    if (group === "ai_edutech") {
      const nextCardIds = activity.aiToolCardIds.filter((item) => item !== cardId);
      const nextTools = findCards(nextCardIds, availableCards).map((item) => item.title);
      updateActivity(activityId, { aiToolCardIds: nextCardIds, tools: nextTools });
      return;
    }

    if (group === "assessment") {
      updateActivity(activityId, { assessmentCardId: null, assessmentMethod: "" });
      return;
    }

    if (group === "teacher_intervention") {
      const nextCardIds = activity.humanCardIds.filter((item) => item !== cardId);
      updateActivity(activityId, {
        humanCardIds: nextCardIds,
        teacherMove: findCards(nextCardIds, availableCards)
          .map((item) => item.title)
          .join(", "),
      });
      return;
    }

    updateActivity(activityId, { aiCardIds: activity.aiCardIds.filter((item) => item !== cardId) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const card = event.active.data.current?.card as OrchestrationCard | undefined;
    const overId = String(event.over?.id ?? "");
    const match = overId.match(/^([a-z_]+)-slot-(.+)$/);

    if (!card || !match) {
      return;
    }

    const slot = match[1] as CardLibraryGroup;
    const activityId = match[2];

    if (slot === card.libraryGroup) {
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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <main className="appShell designStudioPage">
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
                <h1>AI 오케스트레이션 수업 설계</h1>
              </div>
            </div>
          </div>
        </section>

        <section className="designStack designPageSections">
          <div className="designPrimaryGrid">
          <section className="panel designPanel designSetupPanel">
            <div className="panelHeader">
              <div>
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

          <section className="panel designPanel designActivitiesPanel">
            <div className="panelHeader">
              <div>
                                <h2>학습 활동 설계</h2>
              </div>
              <div className="inlineActions">
                <span className="panelHint">기능 카드, AI에듀테크, 평가 방법, 교사 개입, AI 역할을 클릭 또는 드래그앤드롭으로 바로 배치합니다.</span>
                <button type="button" className="ghostButton" onClick={addActivity}>
                  활동 추가
                </button>
              </div>
            </div>

            <div className="tableWrap tableWrapWide">
              <table className="lessonTable lessonTableCards">
                <thead>
                  <tr>
                    <th className="colFunction">Activity</th>
                    <th className="colSubject">교과</th>
                    <th className="colLearningActivity">학습활동</th>
                    <th className="colAiTools">AI에듀테크</th>
                    <th className="colAssessment">평가 방법</th>
                    <th className="colTeacherCards">교사 개입</th>
                    <th className="colAiCards">AI 역할</th>
                    <th className="narrowCell">선택</th>
                  </tr>
                </thead>
                <tbody>
                  {design.activities.map((activity) => {
                    const isSelected = selectedActivity?.id === activity.id;
                    const functionCards = getActivityCardsByGroup(activity, availableCards, "function");
                    const aiEdutechCards = getActivityCardsByGroup(activity, availableCards, "ai_edutech");
                    const assessmentCards = getActivityCardsByGroup(activity, availableCards, "assessment");
                    const teacherInterventionCards = getActivityCardsByGroup(activity, availableCards, "teacher_intervention");
                    const rowAiCards = getActivityCardsByGroup(activity, availableCards, "ai_role");

                    return (
                      <tr
                        key={activity.id}
                        className={isSelected ? "selectedRow" : ""}
                        onClick={(event) => {
                          const tag = (event.target as HTMLElement).tagName;
                          if (tag === "INPUT" || tag === "TEXTAREA") return;
                          setSelectedActivityId(activity.id);
                        }}
                      >
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`function-slot-${activity.id}`}
                            label="기능 카드"
                            tone="function"
                            cards={functionCards}
                            numberByCardId={cardNumberById}
                            onRemove={(cardId) => removeCard(activity.id, "function", cardId)}
                            onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "function" }); }}
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
                            rows={5}
                            value={activity.learningActivity}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { learningActivity: event.target.value })}
                            placeholder="예: 지구온난화의 원인과 영향을 조사하고 AI 설명과 비교한다."
                          />
                        </td>
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`ai_edutech-slot-${activity.id}`}
                            label="AI에듀테크"
                            tone="ai_edutech"
                            cards={aiEdutechCards}
                            numberByCardId={cardNumberById}
                            onRemove={(cardId) => removeCard(activity.id, "ai_edutech", cardId)}
                            onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "ai_edutech" }); }}
                          />
                        </td>
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`assessment-slot-${activity.id}`}
                            label="평가 방법"
                            tone="assessment"
                            cards={assessmentCards}
                            numberByCardId={cardNumberById}
                            onRemove={(cardId) => removeCard(activity.id, "assessment", cardId)}
                            onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "assessment" }); }}
                          />
                        </td>
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`teacher_intervention-slot-${activity.id}`}
                            label="교사 개입"
                            tone="teacher_intervention"
                            cards={teacherInterventionCards}
                            numberByCardId={cardNumberById}
                            onRemove={(cardId) => removeCard(activity.id, "teacher_intervention", cardId)}
                            onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "teacher_intervention" }); }}
                          />
                        </td>
                        <td className="cardColumnCell">
                          <RowDropZone
                            id={`ai_role-slot-${activity.id}`}
                            label="AI 역할"
                            tone="ai_role"
                            cards={rowAiCards}
                            numberByCardId={cardNumberById}
                            onRemove={(cardId) => removeCard(activity.id, "ai_role", cardId)}
                            onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "ai_role" }); }}
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
                const functionCards = getActivityCardsByGroup(activity, availableCards, "function");
                const aiEdutechCards = getActivityCardsByGroup(activity, availableCards, "ai_edutech");
                const assessmentCards = getActivityCardsByGroup(activity, availableCards, "assessment");
                const teacherInterventionCards = getActivityCardsByGroup(activity, availableCards, "teacher_intervention");
                const rowAiCards = getActivityCardsByGroup(activity, availableCards, "ai_role");

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
                        <span>기능 카드</span>
                        <RowDropZone
                          id={`function-slot-${activity.id}`}
                          label="기능 카드"
                          tone="function"
                          cards={functionCards}
                          numberByCardId={cardNumberById}
                          onRemove={(cardId) => removeCard(activity.id, "function", cardId)}
                          onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "function" }); }}
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
                          rows={5}
                          value={activity.learningActivity}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { learningActivity: event.target.value })}
                          placeholder="예: 생성형 AI를 활용해 자료를 조사하고 비교합니다."
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>AI에듀테크</span>
                        <RowDropZone
                          id={`ai_edutech-slot-${activity.id}`}
                          label="AI에듀테크"
                          tone="ai_edutech"
                          cards={aiEdutechCards}
                          numberByCardId={cardNumberById}
                          onRemove={(cardId) => removeCard(activity.id, "ai_edutech", cardId)}
                          onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "ai_edutech" }); }}
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>평가 방법</span>
                        <RowDropZone
                          id={`assessment-slot-${activity.id}`}
                          label="평가 방법"
                          tone="assessment"
                          cards={assessmentCards}
                          numberByCardId={cardNumberById}
                          onRemove={(cardId) => removeCard(activity.id, "assessment", cardId)}
                          onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "assessment" }); }}
                        />
                      </label>
                    </div>
                    <div className="mobileDropGrid">
                      <div className="mobileDropColumn">
                        <span className="mobileDropLabel">교사 개입</span>
                        <RowDropZone
                          id={`teacher_intervention-slot-${activity.id}`}
                          label="교사 개입"
                          tone="teacher_intervention"
                          cards={teacherInterventionCards}
                          numberByCardId={cardNumberById}
                          onRemove={(cardId) => removeCard(activity.id, "teacher_intervention", cardId)}
                          onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "teacher_intervention" }); }}
                        />
                      </div>
                      <div className="mobileDropColumn">
                        <span className="mobileDropLabel">AI 역할</span>
                        <RowDropZone
                          id={`ai_role-slot-${activity.id}`}
                          label="AI 역할"
                          tone="ai_role"
                          cards={rowAiCards}
                          numberByCardId={cardNumberById}
                          onRemove={(cardId) => removeCard(activity.id, "ai_role", cardId)}
                          onSlotClick={() => { setSelectedActivityId(activity.id); setPickerState({ activityId: activity.id, group: "ai_role" }); }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          </div>


          <section className="panel designPanel designLibraryPanel">
            <div className="panelHeader">
              <div>
                                <h2>하단 카드 라이브러리</h2>
              </div>
              <p className="panelHint">
                필요한 활동의 카드 칸으로 직접 드래그하거나, 현재 선택한 활동에 빠르게 배치할 수 있습니다.
              </p>
            </div>
            <div className="cardLibraryGrid cardLibraryBottomGrid">
              {libraryColumns.map((column) => {
                const cards = libraryCardsByGroup[column.group];

                return (
                  <section key={`group-${column.group}`} className="libraryColumn libraryColumnGrouped">
                    <div className="libraryColumnHeader">
                      <div>
                        <p className="sectionMicroTag">{column.eyebrow}</p>
                        <h3 className="libraryHeading">{column.heading}</h3>
                      </div>
                      <span className="engineBadge">{cards.length}</span>
                    </div>
                    <div className="libraryList">
                      {cards.map((card) =>
                        card.isCustom ? (
                          <EditableCustomCard
                            key={card.id}
                            card={card}
                            numberLabel={cardNumberById[card.id] ?? formatCardNumber(card.id)}
                            disabled={!selectedActivity}
                            onChange={updateCustomCard}
                            onSave={saveCustomCard}
                            onQuickAdd={(nextCard) => {
                              if (selectedActivity) {
                                appendCard(selectedActivity.id, nextCard);
                              }
                            }}
                          />
                        ) : (
                          <DraggableCard
                            key={card.id}
                            card={card}
                            numberLabel={cardNumberById[card.id] ?? formatCardNumber(card.id)}
                            disabled={!selectedActivity}
                            onQuickAdd={(nextCard) => {
                              if (selectedActivity) {
                                appendCard(selectedActivity.id, nextCard);
                              }
                            }}
                          />
                        ),
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

          <section className="panel designPanel designHistoryPanel">
            <div className="panelHeader">
              <div>
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
      {pickerState && (() => {
        const pickerActivity = design.activities.find((a) => a.id === pickerState.activityId) ?? null;
        const col = libraryColumns.find((c) => c.group === pickerState.group);
        const isSingle = pickerState.group === "function" || pickerState.group === "assessment";
        const placedIds = pickerActivity
          ? pickerState.group === "function"
            ? pickerActivity.functionCardId ? [pickerActivity.functionCardId] : []
            : pickerState.group === "ai_edutech"
            ? pickerActivity.aiToolCardIds
            : pickerState.group === "assessment"
            ? pickerActivity.assessmentCardId ? [pickerActivity.assessmentCardId] : []
            : pickerState.group === "teacher_intervention"
            ? pickerActivity.humanCardIds
            : pickerActivity.aiCardIds
          : [];
        return (
          <CardPickerPopup
            group={pickerState.group}
            groupLabel={col?.heading ?? pickerState.group}
            cards={libraryCardsByGroup[pickerState.group] ?? []}
            numberByCardId={cardNumberById}
            placedCardIds={placedIds}
            isSingleSlot={isSingle}
            onSelect={(card) => appendCard(pickerState.activityId, card)}
            onClose={() => setPickerState(null)}
          />
        );
      })()}
    </DndContext>
  );
}
