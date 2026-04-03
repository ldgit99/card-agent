export type CardActor = "teacher" | "ai";

export type CardLibraryGroup =
  | "function"
  | "ai_edutech"
  | "assessment"
  | "teacher_intervention"
  | "ai_role";

export type RiskType =
  | "AI_OVER_RELIANCE"
  | "SHALLOW_LEARNING"
  | "UNGROUNDED_JUDGMENT"
  | "UNCLEAR_ACCOUNTABILITY"
  | "NO_HUMAN_FINAL_DECISION"
  | "PSYCHOLOGICAL_SAFETY_RISK"
  | "CARD_BEHAVIOR_MISMATCH"
  | "PARTICIPATION_IMBALANCE"
  | "ASSESSMENT_MISMATCH";

export type InferenceEngine = "heuristic" | "openai";

export interface LessonDesignMeta {
  topic: string;
  subject: string;
  target: string;
}

export interface OrchestrationCard {
  id: string;
  actor: CardActor;
  libraryGroup: CardLibraryGroup;
  category: string;
  title: string;
  prompt: string;
  intent: string;
  isCustom?: boolean;
}

export interface LessonActivity {
  id: string;
  order: number;
  title: string;
  functionLabel: string;
  subjectLabel: string;
  learningObjective: string;
  learningActivity: string;
  assessmentMethod: string;
  teacherMove: string;
  tools: string[];
  humanCardIds: string[];
  aiCardIds: string[];
  evidenceOfSuccess: string[];
  notes: string;
}

export interface CardPlacement {
  id: string;
  activityId: string;
  cardId: string;
  slot: "human" | "ai";
  position: number;
  note?: string;
}

export interface LessonDesign {
  id: string;
  version: number;
  title: string;
  meta: LessonDesignMeta;
  durationMinutes: number | null;
  achievementStandards: string[];
  learningGoals: string[];
  customCards: OrchestrationCard[];
  activities: LessonActivity[];
  placements: CardPlacement[];
  createdAt: string;
  updatedAt: string;
}

export interface DesignAnalysis {
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  engine: InferenceEngine;
}

export interface StudentPersona {
  id: string;
  name: string;
  label: string;
  profile: string;
  strength: string;
  watchPoint: string;
  aiTendency: string;
  supportNeed: string;
  likelyUtterance: string;
}

export interface SimulationArtifactExample {
  id: string;
  type: "student_note" | "discussion_quote" | "ai_prompt" | "ai_output" | "assessment_excerpt";
  title: string;
  studentPersonaId: string | null;
  content: string;
  quality: "strong" | "mixed" | "weak";
  insight: string;
}

export interface TeacherInterventionOption {
  id: string;
  title: string;
  timing: string;
  move: string;
  expectedImpact: string;
  linkedCardIds: string[];
}

export interface CardOutcomeLink {
  cardId: string;
  cardTitle: string;
  actor: CardActor;
  influence: string;
  resultingChange: string;
}

export interface PersonaResponse {
  personaId: string;
  personaName: string;
  response: string;
  learningSignal: string;
}

export interface SimulationEpisode {
  id: string;
  title: string;
  lens: string;
  narrative: string;
  successScene: string;
  ordinaryScene: string;
  challengeScene: string;
  humanAgencyFocus: string;
  aiAgencyFocus: string;
  studentLearningSignal: string;
  possibleTension: string;
  relatedActivityId: string | null;
  linkedCardIds: string[];
  featuredPersonaIds: string[];
  sampleArtifacts: SimulationArtifactExample[];
  teacherInterventions: TeacherInterventionOption[];
  cardOutcomeLinks: CardOutcomeLink[];
}

export interface SimulationScenario {
  id: string;
  simulationRunId: string;
  title: string;
  setting: string;
  learningArc: string;
  facilitatorBrief: string;
  studentPersonas: StudentPersona[];
  episodes: SimulationEpisode[];
  engine: InferenceEngine;
}

export interface SimulationTurn {
  id: string;
  simulationRunId: string;
  turnIndex: number;
  activityId: string;
  activityTitle: string;
  scenarioEpisodeId: string | null;
  teacherAction: string;
  aiAction: string;
  expectedStudentResponse: string;
  evidenceObserved: string[];
  missedOpportunities: string[];
  linkedCardIds: string[];
  observerNote: string;
  studentPersonaResponses: PersonaResponse[];
  sampleArtifacts: SimulationArtifactExample[];
  teacherInterventions: TeacherInterventionOption[];
  cardOutcomeLinks: CardOutcomeLink[];
  activityRiskSignals: string[];
  engine: InferenceEngine;
}

export interface DetectedRisk {
  id: string;
  riskType: RiskType;
  severity: "low" | "medium" | "high";
  evidenceTurnIds: string[];
  rationale: string;
  recommendedIntervention: string;
  relatedCardIds: string[];
  activityId: string | null;
  activityTitle: string | null;
  scenarioEpisodeId: string | null;
  focusArea: string;
  studentImpact: string;
  watchSignals: string[];
}

export interface SimulationRun {
  id: string;
  lessonDesignId: string;
  designVersion: number;
  mode: "step" | "full-run";
  turns: SimulationTurn[];
  createdAt: string;
}

export interface ReflectionQuestion {
  id: string;
  simulationRunId: string;
  prompt: string;
  rationale: string;
  linkedTurnIds: string[];
  linkedRiskIds: string[];
}

export interface ReflectionJournalEntry {
  id: string;
  simulationRunId: string;
  summary: string;
  answers: {
    questionId: string;
    answer: string;
  }[];
  nextRevisionNotes: string[];
  createdAt: string;
}
