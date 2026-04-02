import { ensureCustomCards } from "@/lib/card-registry";
import type {
  CardPlacement,
  LessonActivity,
  LessonDesign,
  LessonDesignMeta,
} from "@/types/lesson";

export function createEmptyActivity(order: number): LessonActivity {
  return {
    id: crypto.randomUUID(),
    order,
    title: "",
    functionLabel: "",
    subjectLabel: "",
    learningObjective: "",
    learningActivity: "",
    assessmentMethod: "",
    teacherMove: "",
    tools: [],
    humanCardIds: [],
    aiCardIds: [],
    evidenceOfSuccess: [],
    notes: "",
  };
}

export function createEmptyMeta(): LessonDesignMeta {
  return {
    topic: "",
    subject: "",
    target: "",
  };
}

export function buildPlacements(activities: LessonActivity[]): CardPlacement[] {
  return activities.flatMap((activity) => {
    const humanPlacements = activity.humanCardIds.map((cardId, index) => ({
      id: `${activity.id}-human-${cardId}-${index}`,
      activityId: activity.id,
      cardId,
      slot: "human" as const,
      position: index,
    }));
    const aiPlacements = activity.aiCardIds.map((cardId, index) => ({
      id: `${activity.id}-ai-${cardId}-${index}`,
      activityId: activity.id,
      cardId,
      slot: "ai" as const,
      position: index,
    }));

    return [...humanPlacements, ...aiPlacements];
  });
}

export function createLessonDesign(
  meta: LessonDesignMeta,
  activities: LessonActivity[],
): LessonDesign {
  const now = new Date().toISOString();
  const normalizedActivities = activities.map((activity, index) => ({
    ...activity,
    order: index + 1,
    title: activity.title.trim() || activity.functionLabel.trim() || `활동 ${index + 1}`,
  }));

  return {
    id: crypto.randomUUID(),
    version: 1,
    title: meta.topic.trim() || "새 수업 설계",
    meta,
    durationMinutes: null,
    achievementStandards: [],
    learningGoals: [],
    customCards: ensureCustomCards(),
    activities: normalizedActivities,
    placements: buildPlacements(normalizedActivities),
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultLessonDesign(activityCount = 5): LessonDesign {
  const activities = Array.from({ length: activityCount }, (_, index) =>
    createEmptyActivity(index + 1),
  );

  return createLessonDesign(createEmptyMeta(), activities);
}

export function normalizeLessonDesignDraft(
  draft: LessonDesign,
  overrides?: Partial<Pick<LessonDesign, "version">>,
): LessonDesign {
  const normalizedActivities = draft.activities.map((activity, index) => ({
    ...activity,
    order: index + 1,
    title: activity.title.trim() || activity.functionLabel.trim() || `활동 ${index + 1}`,
  }));

  const fallbackLearningGoals = normalizedActivities
    .map((activity) => activity.learningObjective.trim())
    .filter(Boolean);

  return {
    ...draft,
    version: overrides?.version ?? draft.version,
    title: draft.meta.topic.trim() || "새 수업 설계",
    achievementStandards: (draft.achievementStandards ?? []).filter(Boolean),
    learningGoals: (draft.learningGoals?.length ? draft.learningGoals : fallbackLearningGoals).filter(
      Boolean,
    ),
    customCards: ensureCustomCards(draft.customCards),
    activities: normalizedActivities,
    placements: buildPlacements(normalizedActivities),
    updatedAt: new Date().toISOString(),
  };
}

export function parseMultilineField(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}