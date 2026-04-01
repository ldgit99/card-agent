import type { RiskType } from "@/types/lesson";

export const STORAGE_KEYS = {
  design: "teacher-orchestration-agent:design",
  simulation: "teacher-orchestration-agent:simulation",
  report: "teacher-orchestration-agent:report",
} as const;

export const riskLabels: Record<RiskType, string> = {
  AI_OVER_RELIANCE: "AI 과의존",
  SHALLOW_LEARNING: "깊이 있는 학습 부족",
  UNGROUNDED_JUDGMENT: "근거 없는 판단",
  UNCLEAR_ACCOUNTABILITY: "책임 주체 불명확",
  NO_HUMAN_FINAL_DECISION: "교사의 최종 판단 부재",
  PSYCHOLOGICAL_SAFETY_RISK: "심리적 안전 저해",
  CARD_BEHAVIOR_MISMATCH: "카드-행동 불일치",
  PARTICIPATION_IMBALANCE: "참여 편중",
  ASSESSMENT_MISMATCH: "평가 불일치",
};

export const humanCriticalCards = ["T05", "T06", "T08", "T10", "T13", "T14"];
