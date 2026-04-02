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
import { getAvailableCards, getCardsByActor } from "@/lib/card-registry";
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
import { useEffect, useMemo, useState } from "react";

interface DraggableCardProps {
  card: OrchestrationCard;
  onQuickAdd: (card: OrchestrationCard) => void;
  disabled?: boolean;
}

interface EditableCustomCardProps {
  card: OrchestrationCard;
  onQuickAdd: (card: OrchestrationCard) => void;
  onChange: (cardId: string, patch: Partial<OrchestrationCard>) => void;
  onSave: (cardId: string) => void;
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
  return actor === "teacher" ? "?쭛?랅윆? : "?쨼";
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
        ??{card.intent}
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
        ?꾩옱 ?쒕룞??諛곗튂
      </button>
    </article>
  );
}

function EditableCustomCard({
  card,
  onQuickAdd,
  onChange,
  onSave,
  disabled = false,
}: EditableCustomCardProps) {
  const ready = isCardReady(card);

  return (
    <article className={`libraryCard promptCard promptCard-library promptCard-${card.actor} promptCard-custom`}>
      <div className="promptCardHeader">
        <div className="promptCardIdentity">
          <span className={`promptCardIcon promptCardIcon-${card.actor}`} aria-hidden="true">
            {getCardIcon(card.actor)}
          </span>
          <span className={`promptCardBadge promptCardBadge-${card.actor}`}>?ъ슜???뺤쓽</span>
        </div>
        <span className="promptCardNumber">{formatCardNumber(card.id)}</span>
      </div>
      <div className="promptCardCustomFields">
        <label className="promptCardField">
          <span>移대뱶 ?쒕ぉ</span>
          <input
            className="promptCardInput"
            value={card.title}
            onChange={(event) => onChange(card.id, { title: event.target.value })}
            placeholder={card.actor === "teacher" ? "?? ?ъ쭏臾? : "?? 鍮꾧탳 ?쒖븞"}
          />
        </label>
        <label className="promptCardField">
          <span>吏덈Ц쨌?됰룞</span>
          <textarea
            className="promptCardTextarea"
            rows={3}
            value={card.prompt}
            onChange={(event) => onChange(card.id, { prompt: event.target.value })}
            placeholder={
              card.actor === "teacher"
                ? "?? ??洹몃젃寃??앷컖?덈굹??"
                : "?? 鍮꾧탳????덉쓣 3媛吏濡??뺣━?⑸땲??"
            }
          />
        </label>
        <label className="promptCardField">
          <span>?섎룄</span>
          <input
            className="promptCardInput"
            value={card.intent}
            onChange={(event) => onChange(card.id, { intent: event.target.value })}
            placeholder="?? ?숈깮 ?ㅻ챸????源딄쾶 留뚮뱺??
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
          移대뱶 ???        </button>
        <button
          type="button"
          className="promptCardButton"
          onClick={() => onQuickAdd(card)}
          disabled={disabled || !ready}
        >
          ?꾩옱 ?쒕룞??諛곗튂
        </button>
      </div>
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
                aria-label={`${card.title} ?쒓굅`}
              >
                횞
              </button>
              <CardFace card={card} compact />
            </article>
          ))}
        </div>
      ) : (
        <div className="tableDropZoneEmpty">
          <strong>{actor === "teacher" ? "援먯궗 移대뱶" : "AI 移대뱶"}</strong>
          <span>?섎떒 ?쇱씠釉뚮윭由ъ뿉???쒕옒洹명빐 諛곗튂?⑸땲??</span>
        </div>
      )}
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

function formatSyncTime(value: string | null) {
  if (!value) {
    return "?놁쓬";
  }

  return new Date(value).toLocaleString("ko-KR");
}

function formatDesignLabel(design: LessonDesign) {
  return `${design.meta.topic || "?쒕ぉ 誘몄엯??} 쨌 v${design.version}`;
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

  const availableCards = useMemo(() => getAvailableCards(design.customCards), [design.customCards]);
  const teacherLibraryCards = useMemo(() => getCardsByActor("teacher", design.customCards), [design.customCards]);
  const aiLibraryCards = useMemo(() => getCardsByActor("ai", design.customCards), [design.customCards]);

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
          setStatusMessage("理쒖떊 ??λ낯??遺덈윭?붿뒿?덈떎.");
        } else {
          setStatusMessage("??λ맂 ?ㅺ퀎媛 ?놁뼱 ?꾩옱 ?묒뾽蹂몄쑝濡??쒖옉?⑸땲??");
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
          setStatusMessage("釉뚮씪?곗? ??λ낯??遺덈윭?붿뒿?덈떎.");
        } else {
          setStatusMessage("??λ맂 ?ㅺ퀎媛 ?놁뼱 ?꾩옱 ?묒뾽蹂몄쑝濡??쒖옉?⑸땲??");
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
      setStatusMessage("移대뱶 ?쒕ぉ怨?吏덈Ц쨌?됰룞???낅젰??二쇱꽭??");
      return;
    }

    setStatusMessage(`'${card.title}' 移대뱶瑜???ν뻽?듬땲??`);
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
      setStatusMessage(`v${nextDesign.version} ?ㅺ퀎瑜???ν뻽?듬땲??`);
    } catch {
      setStatusMessage(`v${nextDesign.version} ?ㅺ퀎瑜?釉뚮씪?곗?????ν뻽?듬땲?? ?쒕쾭 ??μ냼 ?곌껐???놁쑝硫?????λ낯?쇰줈 怨꾩냽 ?묒뾽?????덉뒿?덈떎.`);
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
        setStatusMessage("遺덈윭????λ낯???놁뒿?덈떎.");
        return;
      }

      const nextDesign = normalizeLessonDesignDraft(latestSaved, { version: latestSaved.version });
      applyDesignToEditor(nextDesign);
      saveStoredDesign(nextDesign);
      setLastServerSyncAt(snapshot.updatedAt);
      setStatusMessage(`${formatDesignLabel(latestSaved)} ??λ낯??遺덈윭?붿뒿?덈떎.`);
    } catch {
      const latestLocal = localHistory[0] ?? loadStoredDesign();
      if (!latestLocal) {
        setStatusMessage("釉뚮씪?곗??먮룄 ??λ맂 ?ㅺ퀎媛 ?놁뒿?덈떎.");
        return;
      }

      const nextDesign = normalizeLessonDesignDraft(latestLocal, { version: latestLocal.version });
      applyDesignToEditor(nextDesign);
      saveStoredDesign(nextDesign);
      syncHistory(localHistory);
      setStatusMessage(`${formatDesignLabel(latestLocal)} 釉뚮씪?곗? ??λ낯??遺덈윭?붿뒿?덈떎.`);
    } finally {
      setIsSyncingWorkspace(false);
    }
  }

  async function navigateToSimulation() {
    if (isNavigatingToSimulation) {
      return;
    }

    setIsNavigatingToSimulation(true);
    setStatusMessage("?섏뾽 ?ㅺ퀎瑜???ν븳 ??紐⑥쓽 ?섏뾽 ?ㅽ뻾 ?붾㈃?쇰줈 ?대룞?⑸땲??");

    try {
      saveStoredDesign(design);
      const response = await saveDesignToWorkspace({ design, persistVersion: true });
      setDesignHistory(response.designHistory);
      setLastServerSyncAt(response.updatedAt);
      router.push("/simulation");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `${error.message} 釉뚮씪?곗? ??λ낯?쇰줈 紐⑥쓽 ?섏뾽 ?ㅽ뻾 ?붾㈃?쇰줈 ?대룞?⑸땲??`
          : "?쒕쾭 ????놁씠 釉뚮씪?곗? ??λ낯?쇰줈 紐⑥쓽 ?섏뾽 ?ㅽ뻾 ?붾㈃?쇰줈 ?대룞?⑸땲??",
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
    setStatusMessage(`${formatDesignLabel(versionDesign)} 踰꾩쟾???묒뾽 ?붾㈃?쇰줈 遺덈윭?붿뒿?덈떎.`);
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
                    {isSyncingWorkspace ? "???以?.." : "?ㅺ퀎 ???}
                  </button>
                  <button type="button" className="ghostButton" onClick={reloadFromServer}>
                    理쒖떊 ??λ낯 遺덈윭?ㅺ린
                  </button>
                </>
              }
            />
            <div className="heroPanelMain">
              <div>
                <p className="eyebrow">AI ORCHESTRATION LESSON DESIGN</p>
                <h1>AI ?ㅼ??ㅽ듃?덉씠???섏뾽 ?ㅺ퀎</h1>
                <p className="heroCopy">
                  二쇱젣, 援먭낵, ??? ?숈뒿 紐⑺몴瑜?癒쇱? ?뺣━?섍퀬 ?쒕룞 ???덉뿉??諛붾줈 援먯궗 移대뱶? AI 移대뱶瑜?諛곗튂?⑸땲??
                  移대뱶 ?쇱씠釉뚮윭由щ뒗 ?섎떒???먭퀬, 媛??쒕룞 ?됱쓽 移대뱶 移몄뿉 吏곸젒 ?쒕옒洹명빐 ?곌껐?섎룄濡?援ъ꽦?덉뒿?덈떎.
                </p>
              </div>
              <div className="heroStatRack">
                <article className="heroStatCard">
                  <span>?ㅺ퀎 ?쒕룞</span>
                  <strong>{design.activities.length}</strong>
                </article>
                <article className="heroStatCard">
                  <span>援먯궗 移대뱶 諛곗튂</span>
                  <strong>{totalHumanAssignments}</strong>
                </article>
                <article className="heroStatCard">
                  <span>AI 移대뱶 諛곗튂</span>
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
                <h2>?섏뾽 媛쒖슂 ?낅젰</h2>
              </div>
              <p className="panelHint">援먭낵? ????꾨옒???숈뒿 紐⑺몴瑜?癒쇱? ?뺣━?⑸땲??</p>
            </div>
            <div className="metaTable metaTableExtended">
              <div className="metaCell metaLabel">二쇱젣</div>
              <div className="metaCell metaValue metaWide">
                <input
                  value={design.meta.topic}
                  onChange={(event) => updateMeta("topic", event.target.value)}
                  placeholder="?? ?앹꽦??AI瑜??쒖슜??湲고썑 ?꾧린 ?먭뎄 ?섏뾽"
                />
              </div>
              <div className="metaCell metaLabel">援먭낵</div>
              <div className="metaCell metaValue">
                <input
                  value={design.meta.subject}
                  onChange={(event) => updateMeta("subject", event.target.value)}
                  placeholder="?? 怨쇳븰"
                />
              </div>
              <div className="metaCell metaLabel">???/div>
              <div className="metaCell metaValue">
                <input
                  value={design.meta.target}
                  onChange={(event) => updateMeta("target", event.target.value)}
                  placeholder="?? 以묓븰援?3?숇뀈"
                />
              </div>
            </div>
            <div className="metaSupplementGrid">
              <label className="metaSupplementCard metaSupplementCardWide">
                <span>?숈뒿 紐⑺몴</span>
                <textarea
                  rows={4}
                  value={learningGoalsInput}
                  onChange={(event) => updateLearningGoals(event.target.value)}
                  placeholder="??以꾩뿉 ?섎굹???낅젰??二쇱꽭??"
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Activity Design</p>
                <h2>?숈뒿 ?쒕룞 ?ㅺ퀎</h2>
              </div>
              <div className="inlineActions">
                <span className="panelHint">AI?꾧뎄? ?됯? 諛⑸쾿???곴퀬, ?ㅻⅨ履?移대뱶 移몄뿉 ?쒕옒洹몄븻?쒕∼?쇰줈 諛붾줈 諛곗튂?⑸땲??</span>
                <button type="button" className="ghostButton" onClick={addActivity}>
                  ?쒕룞 異붽?
                </button>
              </div>
            </div>

            <div className="tableWrap tableWrapWide">
              <table className="lessonTable lessonTableCards">
                <thead>
                  <tr>
                    <th className="colFunction">湲곕뒫</th>
                    <th className="colSubject">援먭낵</th>
                    <th className="colLearningActivity">?숈뒿?쒕룞</th>
                    <th className="colAiTools">AI?꾧뎄</th>
                    <th className="colAssessment">?됯? 諛⑸쾿</th>
                    <th className="colTeacherCards">援먯궗 移대뱶</th>
                    <th className="colAiCards">AI 移대뱶</th>
                    <th className="narrowCell">?좏깮</th>
                  </tr>
                </thead>
                <tbody>
                  {design.activities.map((activity) => {
                    const isSelected = selectedActivity?.id === activity.id;
                    const humanCards = findCards(activity.humanCardIds, availableCards);
                    const rowAiCards = findCards(activity.aiCardIds, availableCards);

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
                            placeholder="?? 議곗궗?섍린"
                          />
                        </td>
                        <td>
                          <input
                            value={activity.subjectLabel}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { subjectLabel: event.target.value })}
                            placeholder="?? 怨쇳븰"
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.learningActivity}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { learningActivity: event.target.value })}
                            placeholder="?? 吏援ъ삩?쒗솕???먯씤怨??곹뼢??議곗궗?섍퀬 AI ?ㅻ챸怨?鍮꾧탳?쒕떎."
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
                            placeholder="?? ChatGPT, NotebookLM"
                          />
                        </td>
                        <td>
                          <textarea
                            rows={3}
                            value={activity.assessmentMethod}
                            onFocus={() => setSelectedActivityId(activity.id)}
                            onChange={(event) => updateActivity(activity.id, { assessmentMethod: event.target.value })}
                            placeholder="?? 蹂닿퀬???됯?, ?좊줎 李몄뿬 愿李?
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
                            ?좏깮
                          </button>
                          <button
                            type="button"
                            className="tableActionButton tableActionDanger"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeActivity(activity.id);
                            }}
                          >
                            ??젣
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobileActivityList" aria-label="紐⑤컮???쒕룞 移대뱶 紐⑸줉">
              {design.activities.map((activity) => {
                const isSelected = selectedActivity?.id === activity.id;
                const humanCards = findCards(activity.humanCardIds, availableCards);
                const rowAiCards = findCards(activity.aiCardIds, availableCards);

                return (
                  <article
                    key={`mobile-${activity.id}`}
                    className={`mobileActivityCard ${isSelected ? "mobileActivityCard-selected" : ""}`}
                    onClick={() => setSelectedActivityId(activity.id)}
                  >
                    <div className="mobileActivityHeader">
                      <div>
                        <p className="sectionMicroTag">Activity {activity.order}</p>
                        <h3>{activity.functionLabel || `?쒕룞 ${activity.order}`}</h3>
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
                          ?좏깮
                        </button>
                        <button
                          type="button"
                          className="tableActionButton tableActionDanger"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeActivity(activity.id);
                          }}
                        >
                          ??젣
                        </button>
                      </div>
                    </div>
                    <div className="mobileActivityFields">
                      <label className="mobileActivityField">
                        <span>湲곕뒫</span>
                        <input
                          value={activity.functionLabel}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { functionLabel: event.target.value })}
                          placeholder="?? 議곗궗?섍린"
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>援먭낵</span>
                        <input
                          value={activity.subjectLabel}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { subjectLabel: event.target.value })}
                          placeholder="?? 怨쇳븰"
                        />
                      </label>
                      <label className="mobileActivityField mobileActivityField-wide">
                        <span>?숈뒿?쒕룞</span>
                        <textarea
                          rows={4}
                          value={activity.learningActivity}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { learningActivity: event.target.value })}
                          placeholder="?? ?앹꽦??AI瑜??쒖슜???먮즺瑜?議곗궗?섍퀬 鍮꾧탳?⑸땲??"
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>AI?꾧뎄</span>
                        <textarea
                          rows={3}
                          value={activity.tools.join(", ")}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { tools: parseMultilineField(event.target.value) })}
                          placeholder="?? ChatGPT, NotebookLM"
                        />
                      </label>
                      <label className="mobileActivityField">
                        <span>?됯? 諛⑸쾿</span>
                        <textarea
                          rows={3}
                          value={activity.assessmentMethod}
                          onFocus={() => setSelectedActivityId(activity.id)}
                          onChange={(event) => updateActivity(activity.id, { assessmentMethod: event.target.value })}
                          placeholder="?? 蹂닿퀬???됯?, ?좊줎 李몄뿬 愿李?
                        />
                      </label>
                    </div>
                    <div className="mobileDropGrid">
                      <div className="mobileDropColumn">
                        <span className="mobileDropLabel">援먯궗 移대뱶</span>
                        <RowDropZone
                          id={`human-slot-${activity.id}`}
                          actor="teacher"
                          cards={humanCards}
                          onRemove={(cardId) => removeCard(activity.id, "teacher", cardId)}
                        />
                      </div>
                      <div className="mobileDropColumn">
                        <span className="mobileDropLabel">AI 移대뱶</span>
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
                <h2>?섎떒 移대뱶 ?쇱씠釉뚮윭由?/h2>
              </div>
              <p className="panelHint">
                ?꾩슂???쒕룞??移대뱶 移몄쑝濡?吏곸젒 ?쒕옒洹명븯嫄곕굹, ?꾩옱 ?좏깮???쒕룞??鍮좊Ⅴ寃?諛곗튂?????덉뒿?덈떎.
              </p>
            </div>
            <div className="cardLibraryGrid cardLibraryBottomGrid">
              <section className="libraryColumn">
                <div className="libraryColumnHeader">
                  <div>
                    <p className="sectionMicroTag">Teacher Cards</p>
                    <h3 className="libraryHeading">援먯궗 移대뱶</h3>
                  </div>
                  <span className="engineBadge">{teacherLibraryCards.length}</span>
                </div>
                <div className="libraryList">
                  {teacherLibraryCards.map((card) =>
                    card.isCustom ? (
                      <EditableCustomCard
                        key={card.id}
                        card={card}
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
                        disabled={!selectedActivity}
                        onQuickAdd={(nextCard) => {
                          if (selectedActivity) {
                            appendCard(selectedActivity.id, nextCard);
                          }
                        }}
                      />
                    )
                  )}
                </div>
              </section>
              <section className="libraryColumn">
                <div className="libraryColumnHeader">
                  <div>
                    <p className="sectionMicroTag">AI Cards</p>
                    <h3 className="libraryHeading">AI 移대뱶</h3>
                  </div>
                  <span className="engineBadge">{aiLibraryCards.length}</span>
                </div>
                <div className="libraryList">
                  {aiLibraryCards.map((card) =>
                    card.isCustom ? (
                      <EditableCustomCard
                        key={card.id}
                        card={card}
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
                        disabled={!selectedActivity}
                        onQuickAdd={(nextCard) => {
                          if (selectedActivity) {
                            appendCard(selectedActivity.id, nextCard);
                          }
                        }}
                      />
                    )
                  )}
                </div>
              </section>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="sectionTag">Saved Versions</p>
                <h2>??λ맂 踰꾩쟾</h2>
              </div>
              <p className="panelHint">釉뚮씪?곗? ?먮뒗 ?쒕쾭????λ맂 踰꾩쟾???묒뾽 ?붾㈃?쇰줈 蹂듭썝?????덉뒿?덈떎.</p>
            </div>
            {designHistory.length ? (
              <div className="historyList">
                {designHistory.map((historyItem) => (
                  <article key={`${historyItem.id}-${historyItem.version}`} className="historyCard">
                    <div className="historyCardBody">
                      <strong>{formatDesignLabel(historyItem)}</strong>
                      <p>
                        ?쒕룞 {historyItem.activities.length}媛?쨌 移대뱶 諛곗튂 {historyItem.placements.length}媛?                      </p>
                      <span>{formatSyncTime(historyItem.updatedAt)}</span>
                    </div>
                    <button type="button" className="tableActionButton" onClick={() => loadDesignVersion(historyItem)}>
                      ??踰꾩쟾 遺덈윭?ㅺ린
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="emptyPanelText">?꾩쭅 ??λ맂 ?ㅺ퀎 踰꾩쟾???놁뒿?덈떎.</p>
            )}
          </section>
        </section>

        <footer className="statusBar statusBarFull">
          <div>
            <strong>????곹깭</strong>
            <span>釉뚮씪?곗??먮뒗 ?먮룞 ??λ릺怨? ?ㅺ퀎 ???踰꾪듉?쇰줈 踰꾩쟾 ?대젰???④퉩?덈떎.</span>
          </div>
          <div>
            <strong>??λ맂 ?ㅺ퀎 踰꾩쟾</strong>
            <span>{designHistory.length}媛?/span>
          </div>
          <div>
            <strong>留덉?留????/strong>
            <span>{formatSyncTime(latestSavedAt)}</span>
          </div>
          <div>
            <strong>?곹깭 硫붿떆吏</strong>
            <span>{statusMessage || "?湲?以?}</span>
          </div>
        </footer>
      </main>
    </DndContext>
  );
}
