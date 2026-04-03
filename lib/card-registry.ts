import { aiCards, orchestrationCards, teacherCards } from "@/data/cards";
import type { CardActor, CardLibraryGroup, OrchestrationCard } from "@/types/lesson";

const customCardSeeds: OrchestrationCard[] = [
  {
    id: "CF01",
    actor: "teacher",
    libraryGroup: "function",
    category: "사용자 정의",
    title: "기능카드 사용자 정의 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CF02",
    actor: "teacher",
    libraryGroup: "function",
    category: "사용자 정의",
    title: "기능카드 사용자 정의 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CF03",
    actor: "teacher",
    libraryGroup: "function",
    category: "사용자 정의",
    title: "기능카드 사용자 정의 3",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CE01",
    actor: "ai",
    libraryGroup: "ai_edutech",
    category: "사용자 정의",
    title: "AI에듀테크 사용자 정의 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CE02",
    actor: "ai",
    libraryGroup: "ai_edutech",
    category: "사용자 정의",
    title: "AI에듀테크 사용자 정의 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CE03",
    actor: "ai",
    libraryGroup: "ai_edutech",
    category: "사용자 정의",
    title: "AI에듀테크 사용자 정의 3",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CA01",
    actor: "teacher",
    libraryGroup: "assessment",
    category: "사용자 정의",
    title: "평가카드 사용자 정의 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CA02",
    actor: "teacher",
    libraryGroup: "assessment",
    category: "사용자 정의",
    title: "평가카드 사용자 정의 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CA03",
    actor: "teacher",
    libraryGroup: "assessment",
    category: "사용자 정의",
    title: "평가카드 사용자 정의 3",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CT01",
    actor: "teacher",
    libraryGroup: "teacher_intervention",
    category: "??? ??",
    title: "?????? ??? ?? 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CT02",
    actor: "teacher",
    libraryGroup: "teacher_intervention",
    category: "??? ??",
    title: "?????? ??? ?? 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CT03",
    actor: "teacher",
    libraryGroup: "teacher_intervention",
    category: "??? ??",
    title: "?????? ??? ?? 3",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CR01",
    actor: "ai",
    libraryGroup: "ai_role",
    category: "??? ??",
    title: "AI???? ??? ?? 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CR02",
    actor: "ai",
    libraryGroup: "ai_role",
    category: "??? ??",
    title: "AI???? ??? ?? 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "CR03",
    actor: "ai",
    libraryGroup: "ai_role",
    category: "??? ??",
    title: "AI???? ??? ?? 3",
    prompt: "",
    intent: "",
    isCustom: true,
  },
];

function cloneCard(card: OrchestrationCard): OrchestrationCard {
  return { ...card };
}

export function ensureCustomCards(cards?: OrchestrationCard[]): OrchestrationCard[] {
  const existing = cards ?? [];
  const merged = customCardSeeds.map((seed) => {
    const found = existing.find((card) => card.id === seed.id);
    return found
      ? {
          ...seed,
          ...found,
          id: seed.id,
          actor: seed.actor,
          libraryGroup: seed.libraryGroup,
          isCustom: true,
          category: found.category?.trim() || seed.category,
        }
      : cloneCard(seed);
  });

  const extras = existing
    .filter((card) => !customCardSeeds.some((seed) => seed.id === card.id))
    .map((card) => ({ ...card, isCustom: true }));

  return [...merged, ...extras];
}

export function getAvailableCards(customCards?: OrchestrationCard[]): OrchestrationCard[] {
  return [...orchestrationCards, ...ensureCustomCards(customCards)];
}

export function findCardById(cardId: string, customCards?: OrchestrationCard[]): OrchestrationCard | null {
  return getAvailableCards(customCards).find((card) => card.id === cardId) ?? null;
}

export function getCardsByActor(actor: CardActor, customCards?: OrchestrationCard[]): OrchestrationCard[] {
  const baseCards = actor === "teacher" ? teacherCards : aiCards;
  const customByActor = ensureCustomCards(customCards).filter((card) => card.actor === actor);
  return [...baseCards, ...customByActor];
}

export function getCardsByLibraryGroup(
  group: CardLibraryGroup,
  customCards?: OrchestrationCard[],
): OrchestrationCard[] {
  return getAvailableCards(customCards).filter((card) => card.libraryGroup === group);
}
