export type CardActor = "teacher" | "ai";

export type RiskType =
  | "AI_OVER_RELIANCE"
  | "SHALLOW_LEARNING"
  | "UNGROUNDED_JUDGMENT"
  | "UNCLEAR_ACCOUNTABILITY"
  | "NO_HUMAN_FINAL_DECISION"
  | "PSYCHOLOGICAL_SAFETY_RISK"
  | "CARD_BEHAVIOR_MISMATCH";

export type InferenceEngine = "heuristic" | "openai";

export interface LessonDesignMeta {
  topic: string;
  subject: string;
  target: string;
}

export interface OrchestrationCard {
  id: string;
  actor: CardActor;
  category: string;
  title: string;
  prompt: string;
  intent: string;
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
  learningGoals: string[];
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

export interface SimulationTurn {
  id: string;
  simulationRunId: string;
  turnIndex: number;
  activityId: string;
  activityTitle: string;
  teacherAction: string;
  aiAction: string;
  expectedStudentResponse: string;
  evidenceObserved: string[];
  missedOpportunities: string[];
  linkedCardIds: string[];
  observerNote: string;
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

