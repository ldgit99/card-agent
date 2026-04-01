import { z } from "zod";

export const designAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const simulationEpisodeSchema = z.object({
  title: z.string(),
  lens: z.string(),
  narrative: z.string(),
  successScene: z.string(),
  challengeScene: z.string(),
  humanAgencyFocus: z.string(),
  aiAgencyFocus: z.string(),
  studentLearningSignal: z.string(),
  possibleTension: z.string(),
  relatedActivityId: z.string().nullable(),
  linkedCardIds: z.array(z.string()),
});

export const simulationScenarioSchema = z.object({
  title: z.string(),
  setting: z.string(),
  learningArc: z.string(),
  facilitatorBrief: z.string(),
  episodes: z.array(simulationEpisodeSchema),
});

export const simulationTurnSchema = z.object({
  turnIndex: z.number(),
  activityId: z.string(),
  activityTitle: z.string(),
  scenarioEpisodeId: z.string().nullable(),
  teacherAction: z.string(),
  aiAction: z.string(),
  expectedStudentResponse: z.string(),
  evidenceObserved: z.array(z.string()),
  missedOpportunities: z.array(z.string()),
  linkedCardIds: z.array(z.string()),
  observerNote: z.string(),
});

export const riskSchema = z.object({
  riskType: z.enum([
    "AI_OVER_RELIANCE",
    "SHALLOW_LEARNING",
    "UNGROUNDED_JUDGMENT",
    "UNCLEAR_ACCOUNTABILITY",
    "NO_HUMAN_FINAL_DECISION",
    "PSYCHOLOGICAL_SAFETY_RISK",
    "CARD_BEHAVIOR_MISMATCH",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  evidenceTurnIds: z.array(z.string()),
  rationale: z.string(),
  recommendedIntervention: z.string(),
  relatedCardIds: z.array(z.string()),
});

export const risksResponseSchema = z.object({
  risks: z.array(riskSchema),
});

export const reflectionQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      rationale: z.string(),
      linkedTurnIds: z.array(z.string()),
      linkedRiskIds: z.array(z.string()),
    }),
  ),
});