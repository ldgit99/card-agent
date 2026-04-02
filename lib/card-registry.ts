import { aiCards, orchestrationCards, teacherCards } from "@/data/cards";
import type { CardActor, OrchestrationCard } from "@/types/lesson";

const customCardSeeds: OrchestrationCard[] = [
  {
    id: "TC01",
    actor: "teacher",
    category: "사용자 정의",
    title: "교사 빈 카드 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "TC02",
    actor: "teacher",
    category: "사용자 정의",
    title: "교사 빈 카드 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "TC03",
    actor: "teacher",
    category: "사용자 정의",
    title: "교사 빈 카드 3",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "AC01",
    actor: "ai",
    category: "사용자 정의",
    title: "AI 빈 카드 1",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "AC02",
    actor: "ai",
    category: "사용자 정의",
    title: "AI 빈 카드 2",
    prompt: "",
    intent: "",
    isCustom: true,
  },
  {
    id: "AC03",
    actor: "ai",
    category: "사용자 정의",
    title: "AI 빈 카드 3",
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