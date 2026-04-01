import { orchestrationCards } from "@/data/cards";
import { riskLabels } from "@/lib/constants";
import type {
  DesignAnalysis,
  DetectedRisk,
  LessonActivity,
  LessonDesign,
  ReflectionQuestion,
  RiskType,
  SimulationTurn,
} from "@/types/lesson";

function getCard(id: string) {
  return orchestrationCards.find((card) => card.id === id);
}

function hasAnyCard(activity: LessonActivity, ids: string[]) {
  return ids.some(
    (id) => activity.humanCardIds.includes(id) || activity.aiCardIds.includes(id),
  );
}

function getTeacherFocus(activity: LessonActivity) {
  const card = activity.humanCardIds[0] ? getCard(activity.humanCardIds[0]) : null;
  return card ?? null;
}

function getAiFocus(activity: LessonActivity) {
  const card = activity.aiCardIds[0] ? getCard(activity.aiCardIds[0]) : null;
  return card ?? null;
}

export function createHeuristicAnalysis(
  design: LessonDesign,
): Omit<DesignAnalysis, "engine"> {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];

  const hasFinalDecision = design.activities.some((activity) =>
    activity.humanCardIds.includes("T13"),
  );
  const hasGroundedDiscussion = design.activities.some((activity) =>
    activity.humanCardIds.includes("T10"),
  );
  const hasAiTrustCheck = design.activities.some((activity) =>
    activity.humanCardIds.includes("T06"),
  );
  const hasAccountability = design.activities.some((activity) =>
    activity.humanCardIds.includes("T14"),
  );

  if (hasFinalDecision) {
    strengths.push("최종 판단 카드가 포함되어 인간 주도성을 구조화하고 있습니다.");
  } else {
    gaps.push("최종 판단 카드가 없어 AI 제안 이후 인간의 결정 장면이 약합니다.");
    recommendations.push("적어도 한 활동에는 `최종 판단` 카드를 배치해 교사의 결정을 드러내세요.");
  }

  if (hasGroundedDiscussion) {
    strengths.push("근거 기반 토론 또는 설명 중심 개입이 포함되어 깊이 있는 학습 가능성이 있습니다.");
  } else {
    gaps.push("근거를 묻는 장치가 적어 결과 중심 활동으로 흐를 수 있습니다.");
    recommendations.push("`근거 기반 토론` 또는 `전략 비교` 카드를 추가해 판단 근거를 말하게 하세요.");
  }

  if (hasAiTrustCheck) {
    strengths.push("AI 신뢰 점검 카드가 있어 비판적 활용 설계가 보입니다.");
  } else {
    gaps.push("AI 결과의 신뢰도를 검토하는 장치가 부족합니다.");
    recommendations.push("AI를 쓰는 활동에는 `AI 신뢰 점검` 또는 `AI 비교 질문` 카드를 함께 배치하세요.");
  }

  if (!hasAccountability) {
    gaps.push("결과에 대한 책임 주체를 묻는 단계가 부족합니다.");
    recommendations.push("마지막 활동 또는 평가 단계에 `책임 인식` 카드를 배치하세요.");
  }

  if (design.activities.some((activity) => activity.aiCardIds.length > 0)) {
    strengths.push("AI 카드가 배치되어 도구 수준을 넘어 역할 기반 설계를 시도하고 있습니다.");
  }

  return {
    summary: `${design.meta.topic || "이 수업"} 설계는 ${
      design.activities.length
    }개 활동으로 구성되어 있으며, 인간과 AI의 역할 분리가 핵심 점검 포인트입니다.`,
    strengths,
    gaps,
    recommendations,
  };
}

export function createHeuristicTurn(
  design: LessonDesign,
  activity: LessonActivity,
  previousTurns: SimulationTurn[],
): Omit<SimulationTurn, "id" | "simulationRunId" | "engine"> {
  const teacherCard = getTeacherFocus(activity);
  const aiCard = getAiFocus(activity);

  const teacherAction = teacherCard
    ? `교사는 '${teacherCard.prompt}'를 중심 질문으로 사용하며 ${activity.learningActivity || activity.title} 활동을 조율한다.`
    : `교사는 ${activity.learningActivity || activity.title} 활동을 안내하지만, 사고를 깊게 여는 질문은 아직 약하다.`;

  const aiAction = aiCard
    ? `AI는 '${aiCard.title}' 역할로 개입하여 ${aiCard.intent}`
    : "AI는 직접 개입하지 않거나, 보조 설명 수준에서만 머무른다.";

  const expectedStudentResponse = hasAnyCard(activity, ["T10", "T12"])
    ? "학생은 자신의 선택 근거를 말하고, 다른 방법과 비교하며 답을 재구성하려고 시도한다."
    : hasAnyCard(activity, ["T05", "T06", "A20"])
      ? "학생은 AI의 제안과 자신의 생각을 비교하지만, 추가 근거 질문이 없으면 빠르게 수용할 가능성도 있다."
      : "학생은 과제를 수행하지만 질문, 비교, 재구성 없이 결과 제출로 빨리 넘어갈 수 있다.";

  const evidenceObserved = [
    activity.functionLabel && `기능: ${activity.functionLabel}`,
    activity.assessmentMethod && `평가: ${activity.assessmentMethod}`,
    teacherCard && `교사 카드: ${teacherCard.title}`,
    aiCard && `AI 카드: ${aiCard.title}`,
  ].filter(Boolean) as string[];

  const missedOpportunities = [
    !activity.humanCardIds.includes("T13") && "인간의 최종 판단 단계가 충분히 드러나지 않는다.",
    !activity.humanCardIds.includes("T10") && "근거를 말하게 하는 장면이 부족하다.",
    activity.aiCardIds.length > 0 &&
      !hasAnyCard(activity, ["T05", "T06", "T08"]) &&
      "AI를 비판적으로 검토하는 장치가 약하다.",
  ].filter(Boolean) as string[];

  const observerNote =
    previousTurns.length === 0
      ? "도입 턴에서는 활동 목표와 인간의 주도권을 명시하는 것이 중요하다."
      : "이 턴은 앞선 활동에서 생긴 판단 흐름을 이어받기 때문에, 비교와 재구성이 누적되는지 봐야 한다.";

  return {
    turnIndex: previousTurns.length + 1,
    activityId: activity.id,
    activityTitle: activity.title || activity.functionLabel || "활동",
    teacherAction,
    aiAction,
    expectedStudentResponse,
    evidenceObserved,
    missedOpportunities,
    linkedCardIds: [...activity.humanCardIds, ...activity.aiCardIds],
    observerNote,
  };
}

function pushRisk(
  risks: DetectedRisk[],
  riskType: RiskType,
  severity: "low" | "medium" | "high",
  rationale: string,
  recommendedIntervention: string,
  evidenceTurnIds: string[],
  relatedCardIds: string[],
) {
  risks.push({
    id: crypto.randomUUID(),
    riskType,
    severity,
    rationale,
    recommendedIntervention,
    evidenceTurnIds,
    relatedCardIds,
  });
}

export function detectHeuristicRisks(
  design: LessonDesign,
  turns: SimulationTurn[],
): DetectedRisk[] {
  const risks: DetectedRisk[] = [];
  const activityIds = turns.map((turn) => turn.id);

  const hasFinalDecision = design.activities.some((activity) =>
    activity.humanCardIds.includes("T13"),
  );
  const hasDeepLearningScaffold = design.activities.some((activity) =>
    hasAnyCard(activity, ["T01", "T02", "T10", "T12"]),
  );
  const hasAccountability = design.activities.some((activity) =>
    activity.humanCardIds.includes("T14"),
  );

  const aiHeavyActivities = design.activities.filter(
    (activity) => activity.aiCardIds.length > 0,
  );

  if (aiHeavyActivities.length > 0 && !hasFinalDecision) {
    pushRisk(
      risks,
      "NO_HUMAN_FINAL_DECISION",
      "high",
      "AI가 개입하는 활동은 있으나 인간의 최종 판단을 구조화한 카드가 없습니다.",
      "`최종 판단` 카드를 평가 직전 또는 정리 단계에 배치하세요.",
      activityIds,
      ["T13"],
    );
  }

  if (aiHeavyActivities.length > 0) {
    const weakChecks = aiHeavyActivities.filter(
      (activity) => !hasAnyCard(activity, ["T05", "T06", "T08"]),
    );

    if (weakChecks.length > 0) {
      pushRisk(
        risks,
        "AI_OVER_RELIANCE",
        "high",
        "AI를 쓰는 활동에 비교, 신뢰 점검, 의존 조절 카드가 충분히 연결되지 않았습니다.",
        "`AI 비교 질문`, `AI 신뢰 점검`, `AI 의존 조절` 카드 중 최소 하나를 각 AI 활동에 연결하세요.",
        turns
          .filter((turn) => weakChecks.some((activity) => activity.id === turn.activityId))
          .map((turn) => turn.id),
        ["T05", "T06", "T08"],
      );
    }
  }

  if (!hasDeepLearningScaffold) {
    pushRisk(
      risks,
      "SHALLOW_LEARNING",
      "high",
      "비교, 근거, 사고 확장, 전략 판단을 유도하는 카드가 거의 보이지 않습니다.",
      "`사고 확장`, `비교 질문`, `근거 기반 토론`, `전략 비교` 카드를 최소 두 개 이상 포함하세요.",
      activityIds,
      ["T01", "T02", "T10", "T12"],
    );
  }

  if (!design.activities.some((activity) => activity.humanCardIds.includes("T10"))) {
    pushRisk(
      risks,
      "UNGROUNDED_JUDGMENT",
      "medium",
      "근거를 설명하도록 요구하는 설계가 부족합니다.",
      "한 번 이상은 학생이 자신의 판단 근거를 설명하도록 설계하세요.",
      activityIds,
      ["T10"],
    );
  }

  if (!hasAccountability) {
    pushRisk(
      risks,
      "UNCLEAR_ACCOUNTABILITY",
      "medium",
      "결과에 대한 책임 주체를 묻는 단계가 없습니다.",
      "마무리 활동에 `책임 인식` 카드를 추가하세요.",
      activityIds,
      ["T14"],
    );
  }

  const mismatchTurns = turns.filter(
    (turn) =>
      turn.linkedCardIds.length >= 3 &&
      turn.missedOpportunities.some((item) => item.includes("부족")),
  );

  if (mismatchTurns.length > 0) {
    pushRisk(
      risks,
      "CARD_BEHAVIOR_MISMATCH",
      "medium",
      "카드를 여러 장 배치했지만 실제 시뮬레이션 행동에서는 일부 의도가 드러나지 않습니다.",
      "각 활동마다 핵심 카드 1~2장만 우선 선택하거나, teacherMove를 카드 의도에 맞게 더 구체화하세요.",
      mismatchTurns.map((turn) => turn.id),
      mismatchTurns.flatMap((turn) => turn.linkedCardIds),
    );
  }

  const psychologicalSignals = design.activities.some((activity) =>
    /정답|오답|점수만|틀렸/.test(
      [activity.learningActivity, activity.assessmentMethod, activity.notes].join(" "),
    ),
  );

  if (psychologicalSignals) {
    pushRisk(
      risks,
      "PSYCHOLOGICAL_SAFETY_RISK",
      "low",
      "평가 또는 활동 설명에 결과 중심, 정답 중심 표현이 섞여 있습니다.",
      "피드백 표현을 성장 중심으로 바꾸고, 수정 기회를 명시하세요.",
      activityIds,
      [],
    );
  }

  return risks;
}

export function createReflectionQuestions(
  design: LessonDesign,
  turns: SimulationTurn[],
  risks: DetectedRisk[],
): ReflectionQuestion[] {
  const questions = risks.slice(0, 4).map((risk) => {
    const turn = turns.find((item) => risk.evidenceTurnIds.includes(item.id));
    return {
      id: crypto.randomUUID(),
      simulationRunId: turn?.simulationRunId ?? "draft-run",
      prompt: turn
        ? `${turn.turnIndex}턴의 '${turn.activityTitle}'에서 ${riskLabels[risk.riskType]}가 탐지되었습니다. 이 장면을 바꾸려면 어떤 질문 또는 카드 배치를 추가하시겠습니까?`
        : `${riskLabels[risk.riskType]}를 줄이기 위해 다음 차시의 설계를 어떻게 수정하시겠습니까?`,
      rationale: risk.rationale,
      linkedTurnIds: risk.evidenceTurnIds,
      linkedRiskIds: [risk.id],
    };
  });

  if (questions.length === 0) {
    questions.push({
      id: crypto.randomUUID(),
      simulationRunId: "draft-run",
      prompt: `${design.meta.topic || "이번 수업"} 설계에서 가장 잘 작동할 것으로 보이는 질문 또는 개입은 무엇이며, 왜 그렇게 판단하셨습니까?`,
      rationale: "명시적 위험이 크지 않아도 설계의 강점을 성찰 자산으로 남기는 것이 중요합니다.",
      linkedTurnIds: turns.map((turn) => turn.id),
      linkedRiskIds: [],
    });
  }

  return questions;
}

export function buildReflectionMarkdown(input: {
  design: LessonDesign;
  analysis: DesignAnalysis | null;
  turns: SimulationTurn[];
  risks: DetectedRisk[];
  questions: ReflectionQuestion[];
  answers: Record<string, string>;
  summary: string;
  nextRevisionNotes: string[];
}) {
  const sections = [
    `# ${input.design.meta.topic || "수업 설계"} 성찰 일지`,
    "",
    `- 교과: ${input.design.meta.subject || "-"}`,
    `- 대상: ${input.design.meta.target || "-"}`,
    `- 활동 수: ${input.design.activities.length}`,
    "",
    "## 설계 분석",
    "",
    input.analysis?.summary || "분석 결과 없음",
    "",
    "## 모의수업 로그",
    "",
    ...input.turns.flatMap((turn) => [
      `### ${turn.turnIndex}. ${turn.activityTitle}`,
      `- 교사 행동: ${turn.teacherAction}`,
      `- AI 행동: ${turn.aiAction}`,
      `- 예상 학생 반응: ${turn.expectedStudentResponse}`,
      `- 관찰 메모: ${turn.observerNote}`,
      "",
    ]),
    "## 탐지된 위험",
    "",
    ...(input.risks.length
      ? input.risks.flatMap((risk) => [
          `### ${riskLabels[risk.riskType]} (${risk.severity})`,
          `- 근거: ${risk.rationale}`,
          `- 권장 개입: ${risk.recommendedIntervention}`,
          "",
        ])
      : ["- 탐지된 주요 위험 없음", ""]),
    "## 성찰 질문 응답",
    "",
    ...input.questions.flatMap((question) => [
      `### ${question.prompt}`,
      input.answers[question.id] || "- 답변 없음",
      "",
    ]),
    "## 종합 메모",
    "",
    input.summary || "- 요약 없음",
    "",
    "## 다음 수정 포인트",
    "",
    ...(input.nextRevisionNotes.length
      ? input.nextRevisionNotes.map((note) => `- ${note}`)
      : ["- 다음 수정 포인트 없음"]),
  ];

  return sections.join("\n");
}

