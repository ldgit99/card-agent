import type {
  DesignAnalysis,
  DetectedRisk,
  LessonDesign,
  ReflectionQuestion,
  SimulationScenario,
  SimulationTurn,
} from "@/types/lesson";

export interface SimulationReportSnapshot {
  generatedAt: string;
  reportTitle: string;
  design: LessonDesign;
  analysis: DesignAnalysis | null;
  scenario: SimulationScenario | null;
  turns: SimulationTurn[];
  risks: DetectedRisk[];
  questions: ReflectionQuestion[];
  answers: Record<string, string>;
  summary: string;
  nextRevisionNotes: string[];
}