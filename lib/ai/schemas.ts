import { z } from "zod";

export const designAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const studentPersonaSchema = z.object({
  name: z.string(),
  label: z.string(),
  profile: z.string(),
  strength: z.string(),
  watchPoint: z.string(),
  aiTendency: z.string(),
  supportNeed: z.string(),
  likelyUtterance: z.string(),
});

export const simulationArtifactSchema = z.object({
  type: z.enum(["student_note", "discussion_quote", "ai_prompt", "ai_output", "assessment_excerpt"]),
  title: z.string(),
  studentPersonaId: z.string().nullable(),
  content: z.string(),
  quality: z.enum(["strong", "mixed", "weak"]),
  insight: z.string(),
});

export const teacherInterventionSchema = z.object({
  title: z.string(),
  timing: z.string(),
  move: z.string(),
  expectedImpact: z.string(),
  linkedCardIds: z.array(z.string()),
});

export const cardOutcomeLinkSchema = z.object({
  cardId: z.string(),
  cardTitle: z.string(),
  actor: z.enum(["teacher", "ai"]),
  influence: z.string(),
  resultingChange: z.string(),
});

export const simulationEpisodeSchema = z.object({
  title: z.string(),
  lens: z.string(),
  narrative: z.string(),
  successScene: z.string(),
  ordinaryScene: z.string(),
  challengeScene: z.string(),
  humanAgencyFocus: z.string(),
  aiAgencyFocus: z.string(),
  studentLearningSignal: z.string(),
  possibleTension: z.string(),
  relatedActivityId: z.string().nullable(),
  linkedCardIds: z.array(z.string()),
  featuredPersonaIds: z.array(z.string()),
  sampleArtifacts: z.array(simulationArtifactSchema),
  teacherInterventions: z.array(teacherInterventionSchema),
  cardOutcomeLinks: z.array(cardOutcomeLinkSchema),
});

export const simulationScenarioSchema = z.object({
  title: z.string(),
  setting: z.string(),
  learningArc: z.string(),
  facilitatorBrief: z.string(),
  studentPersonas: z.array(studentPersonaSchema),
  episodes: z.array(simulationEpisodeSchema),
});

export const personaResponseSchema = z.object({
  personaId: z.string(),
  personaName: z.string(),
  response: z.string(),
  learningSignal: z.string(),
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
  studentPersonaResponses: z.array(personaResponseSchema),
  sampleArtifacts: z.array(simulationArtifactSchema),
  teacherInterventions: z.array(teacherInterventionSchema),
  cardOutcomeLinks: z.array(cardOutcomeLinkSchema),
  activityRiskSignals: z.array(z.string()),
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
    "PARTICIPATION_IMBALANCE",
    "ASSESSMENT_MISMATCH",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  evidenceTurnIds: z.array(z.string()),
  rationale: z.string(),
  recommendedIntervention: z.string(),
  relatedCardIds: z.array(z.string()),
  activityId: z.string().nullable(),
  activityTitle: z.string().nullable(),
  scenarioEpisodeId: z.string().nullable(),
  focusArea: z.string(),
  studentImpact: z.string(),
  watchSignals: z.array(z.string()),
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
