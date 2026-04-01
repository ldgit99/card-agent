import type {
  DesignAnalysis,
  DetectedRisk,
  LessonDesign,
  ReflectionJournalEntry,
  ReflectionQuestion,
  SimulationTurn,
} from "@/types/lesson";

export type WorkspaceStorageBackend = "file" | "postgres";

export interface StoredSimulationState {
  analysis: DesignAnalysis | null;
  turns: SimulationTurn[];
  risks: DetectedRisk[];
  questions: ReflectionQuestion[];
  journal: ReflectionJournalEntry | null;
}

export interface SimulationSessionRecord extends StoredSimulationState {
  id: string;
  lessonDesignId: string;
  designVersion: number;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  currentDesign: LessonDesign | null;
  designHistory: LessonDesign[];
  sessions: SimulationSessionRecord[];
  updatedAt: string;
}