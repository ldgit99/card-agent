import { orchestrationCards } from "@/data/cards";
import { riskLabels } from "@/lib/constants";
import type {
  DesignAnalysis,
  DetectedRisk,
  LessonActivity,
  LessonDesign,
  ReflectionQuestion,
  RiskType,
  SimulationScenario,
  SimulationTurn,
} from "@/types/lesson";

function getCard(id: string) {
  return orchestrationCards.find((card) => card.id === id) ?? null;
}

function getActivityTitle(activity: LessonActivity) {
  return activity.title || activity.learningActivity || activity.functionLabel || `활동 ${activity.order}`;
}

function hasAnyCard(activity: LessonActivity, ids: string[]) {
  return ids.some((id) => activity.humanCardIds.includes(id) || activity.aiCardIds.includes(id));
}

function getTeacherFocus(activity: LessonActivity) {
  return activity.humanCardIds[0] ? getCard(activity.humanCardIds[0]) : null;
}

function getAiFocus(activity: LessonActivity) {
  return activity.aiCardIds[0] ? getCard(activity.aiCardIds[0]) : null;
}

function buildMissedOpportunities(activity: LessonActivity) {
  return [
    !activity.humanCardIds.includes("T13") && "교사의 최종 판단이 분명하게 드러나는 장면이 부족합니다.",
    !activity.humanCardIds.includes("T10") && "학생이 판단의 근거를 설명하도록 요구하는 순간이 약합니다.",
    activity.aiCardIds.length > 0 && !hasAnyCard(activity, ["T05", "T06", "T08"]) && "AI 제안을 비판적으로 검토하는 질문이 빠져 있습니다.",
    activity.aiCardIds.length > activity.humanCardIds.length && "AI 지원의 속도에 비해 인간의 조율 장치가 얇게 설계되어 있습니다.",
  ].filter(Boolean) as string[];
}

function buildStudentLearningSignal(activity: LessonActivity) {
  if (hasAnyCard(activity, ["T10", "T12"])) {
    return "학생이 답을 내는 데서 멈추지 않고, 서로의 근거를 비교하며 판단 이유를 말하려는 장면이 나타납니다.";
  }

  if (hasAnyCard(activity, ["T05", "T06", "A20"])) {
    return "학생이 AI 제안과 자신의 생각을 나란히 두고 검토하지만, 교사의 추가 질문이 없으면 빠르게 수용할 가능성도 남아 있습니다.";
  }

  return "학생은 과제를 수행하지만 질문, 비교, 수정 없이 결과 제출 중심으로 흘러갈 가능성이 큽니다.";
}

function getEpisodeLens(activity: LessonActivity) {
  if (hasAnyCard(activity, ["T13", "T14"])) {
    return "Human Agency";
  }

  if (hasAnyCard(activity, ["T05", "T06", "T07", "T08", "A20"])) {
    return "Human-AI Agency";
  }

  if (hasAnyCard(activity, ["T01", "T02", "T10", "T12"])) {
    return "Deep Learning";
  }

  return "Orchestration";
}

function buildHumanAgencyFocus(activity: LessonActivity, teacherCardTitle?: string) {
  if (teacherCardTitle) {
    return `교사는 '${teacherCardTitle}' 카드를 통해 학생 판단의 속도를 조절하고, 질문의 방향을 다시 잡습니다.`;
  }

  return "교사의 개입이 활동 운영에는 보이지만, 판단 기준을 명시하는 장면은 상대적으로 약합니다.";
}

function buildAiAgencyFocus(activity: LessonActivity, aiCardTitle?: string) {
  if (aiCardTitle) {
    return `AI는 '${aiCardTitle}' 역할로 자료 생성 또는 비교를 돕지만, 최종 해석과 선택은 교사와 학생이 다시 맡아야 합니다.`;
  }

  return "AI는 직접적인 행위자라기보다 배경 도구에 머물며, 수업 흐름을 바꾸는 핵심 주체는 아닙니다.";
}

function buildPossibleTension(activity: LessonActivity) {
  if (activity.aiCardIds.length > 0 && !hasAnyCard(activity, ["T05", "T06", "T08"])) {
    return "AI 결과가 빠르게 채택되면서 학생의 근거 점검이 생략될 수 있습니다.";
  }

  if (!activity.humanCardIds.includes("T13")) {
    return "학생이 AI와 교사 발화를 따라가더라도 마지막 판단의 책임 주체가 흐려질 수 있습니다.";
  }

  if (!hasAnyCard(activity, ["T10", "T12"])) {
    return "활동은 진행되지만 비교와 추론이 충분히 길어지지 않아 깊이 있는 학습이 약화될 수 있습니다.";
  }

  return "교사의 조율과 AI 지원이 균형을 이루지만, 근거 설명의 밀도를 끝까지 유지하는지가 핵심 관찰 포인트입니다.";
}

export function createHeuristicAnalysis(design: LessonDesign): Omit<DesignAnalysis, "engine"> {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];

  const hasFinalDecision = design.activities.some((activity) => activity.humanCardIds.includes("T13"));
  const hasGroundedDiscussion = design.activities.some((activity) => activity.humanCardIds.includes("T10"));
  const hasAiTrustCheck = design.activities.some((activity) => activity.humanCardIds.includes("T06"));
  const hasAccountability = design.activities.some((activity) => activity.humanCardIds.includes("T14"));

  if (hasFinalDecision) {
    strengths.push("최종 판단 카드가 포함되어 인간의 의사결정 책임이 비교적 선명합니다.");
  } else {
    gaps.push("AI 개입은 보이지만 교사의 최종 판단을 명시하는 장치가 부족합니다.");
    recommendations.push("정리 또는 평가 단계에 '최종 판단' 카드를 배치해 교사가 결정을 마감하도록 하세요.");
  }

  if (hasGroundedDiscussion) {
    strengths.push("학생이 근거를 말하고 비교하는 깊이 있는 학습 장치가 포함되어 있습니다.");
  } else {
    gaps.push("결과 산출은 보이지만 학생이 왜 그렇게 판단했는지 설명하는 장면이 약합니다.");
    recommendations.push("'근거 기반 토론' 또는 '전략 비교' 카드를 추가해 설명과 비교를 길게 가져가세요.");
  }

  if (hasAiTrustCheck) {
    strengths.push("AI 결과를 그대로 수용하지 않고 신뢰 점검을 거치도록 설계되어 있습니다.");
  } else {
    gaps.push("AI 산출물의 신뢰도와 한계를 묻는 질문이 충분하지 않습니다.");
    recommendations.push("AI를 활용하는 활동에는 'AI 신뢰 점검' 또는 'AI 비교 질문' 카드를 함께 배치하세요.");
  }

  if (!hasAccountability) {
    gaps.push("결과에 대한 책임 주체와 역할 분담을 확인하는 장면이 부족합니다.");
    recommendations.push("마무리 단계에 '책임 인식' 카드를 배치해 결과와 판단의 책임을 명시하세요.");
  }

  if (design.activities.some((activity) => activity.aiCardIds.length > 0)) {
    strengths.push("AI 카드가 실제 활동과 연결되어 도구 사용을 넘어 역할 설계가 시도되고 있습니다.");
  }

  return {
    summary: `${design.meta.topic || "이번 수업"} 설계는 ${design.activities.length}개의 활동으로 구성되어 있으며, 교사의 조율과 AI 지원이 어떻게 분담되는지가 핵심 관찰 포인트입니다.`,
    strengths,
    gaps,
    recommendations,
  };
}

export function createHeuristicScenario(
  design: LessonDesign,
  simulationRunId: string,
): Omit<SimulationScenario, "id" | "engine"> {
  const topic = design.meta.topic || "AI 협력 수업";
  const subject = design.meta.subject || design.activities[0]?.subjectLabel || "교과 미입력";
  const target = design.meta.target || "학습 대상 미입력";

  const episodes = design.activities.map((activity) => {
    const teacherCard = getTeacherFocus(activity);
    const aiCard = getAiFocus(activity);
    const title = getActivityTitle(activity);

    return {
      id: crypto.randomUUID(),
      title: `${activity.order}차 활동 · ${title}`,
      lens: getEpisodeLens(activity),
      narrative: `수업은 '${title}' 장면으로 전개됩니다. 교사는 ${activity.learningActivity || activity.learningObjective || title}에 학생을 참여시키고, ${aiCard ? "AI 지원을 병행하며" : "AI보다 인간 상호작용을 우선하며"} 판단의 흐름을 조절합니다.`,
      humanAgencyFocus: buildHumanAgencyFocus(activity, teacherCard?.title),
      aiAgencyFocus: buildAiAgencyFocus(activity, aiCard?.title),
      studentLearningSignal: buildStudentLearningSignal(activity),
      possibleTension: buildPossibleTension(activity),
      relatedActivityId: activity.id,
      linkedCardIds: [...activity.humanCardIds, ...activity.aiCardIds],
    };
  });

  const activityTitles = design.activities.map((activity) => getActivityTitle(activity)).filter(Boolean);

  return {
    simulationRunId,
    title: `${topic} 모의수업 시나리오`,
    setting: `${subject} 수업 맥락에서 ${target} 학습자를 대상으로 진행됩니다. 교사는 AI를 보조 주체로 배치하되, 판단의 근거와 최종 선택은 인간이 다시 점검해야 하는 수업 장면을 설계합니다.`,
    learningArc: activityTitles.length
      ? `${activityTitles.join(" → ")}의 흐름으로 수업이 전개되며, 각 장면에서 질문·비교·근거·판단이 어떻게 이어지는지를 살펴봅니다.`
      : "도입, 탐구, 정리 흐름 속에서 인간과 AI의 역할 분담이 어떻게 일어나는지 점검합니다.",
    facilitatorBrief: "아래 에피소드는 Human-AI agency, 깊이 있는 학습, 책임 구조 관점에서 관찰해야 할 핵심 장면입니다. 각 에피소드는 활동 자체보다 '누가 판단하고, 무엇을 근거로 삼으며, AI는 어디까지 개입하는가'를 드러내도록 구성됩니다.",
    episodes,
  };
}

export function createHeuristicTurn(
  design: LessonDesign,
  activity: LessonActivity,
  previousTurns: SimulationTurn[],
  scenario?: SimulationScenario | null,
): Omit<SimulationTurn, "id" | "simulationRunId" | "engine"> {
  const teacherCard = getTeacherFocus(activity);
  const aiCard = getAiFocus(activity);
  const scenarioEpisode = scenario?.episodes.find((episode) => episode.relatedActivityId === activity.id) ?? null;
  const title = getActivityTitle(activity);

  const teacherAction = teacherCard
    ? `교사는 '${teacherCard.prompt}' 질문으로 ${title} 활동을 열고, ${activity.teacherMove || "학생의 판단 근거를 다시 말하게 하며"} 수업 흐름을 조율합니다.`
    : `교사는 ${title} 활동을 안내하지만, 판단을 늦추거나 재질문하는 장치는 상대적으로 약하게 드러납니다.`;

  const aiAction = aiCard
    ? `AI는 '${aiCard.title}' 역할로 개입해 ${aiCard.intent}`
    : "AI는 직접 개입하지 않고 자료 보조 또는 배경 도구 수준에 머뭅니다.";

  const expectedStudentResponse = scenarioEpisode?.studentLearningSignal ?? buildStudentLearningSignal(activity);

  const evidenceObserved = [
    activity.functionLabel ? `기능: ${activity.functionLabel}` : null,
    activity.assessmentMethod ? `평가: ${activity.assessmentMethod}` : null,
    teacherCard ? `교사 카드: ${teacherCard.title}` : null,
    aiCard ? `AI 카드: ${aiCard.title}` : null,
  ].filter(Boolean) as string[];

  const missedOpportunities = buildMissedOpportunities(activity);

  const observerNote = scenarioEpisode
    ? `${scenarioEpisode.lens} 관점에서 보면 ${scenarioEpisode.possibleTension}`
    : previousTurns.length === 0
      ? "도입 장면에서는 활동 목표뿐 아니라 인간의 조율 책임을 분명히 여는 것이 중요합니다."
      : "앞선 장면에서 나온 학생 반응을 다시 받아 비교와 근거 설명으로 연결하는지가 핵심입니다.";

  return {
    turnIndex: previousTurns.length + 1,
    activityId: activity.id,
    activityTitle: title,
    scenarioEpisodeId: scenarioEpisode?.id ?? null,
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

export function detectHeuristicRisks(design: LessonDesign, turns: SimulationTurn[]): DetectedRisk[] {
  const risks: DetectedRisk[] = [];
  const activityIds = turns.map((turn) => turn.id);

  const hasFinalDecision = design.activities.some((activity) => activity.humanCardIds.includes("T13"));
  const hasDeepLearningScaffold = design.activities.some((activity) => hasAnyCard(activity, ["T01", "T02", "T10", "T12"]));
  const hasAccountability = design.activities.some((activity) => activity.humanCardIds.includes("T14"));

  const aiHeavyActivities = design.activities.filter((activity) => activity.aiCardIds.length > 0);

  if (aiHeavyActivities.length > 0 && !hasFinalDecision) {
    pushRisk(
      risks,
      "NO_HUMAN_FINAL_DECISION",
      "high",
      "AI가 개입하는 활동이 있지만 교사의 최종 판단을 명시하는 카드가 보이지 않습니다.",
      "정리 또는 평가 직전 단계에 '최종 판단' 카드를 배치해 인간이 결정을 마감하도록 하세요.",
      activityIds,
      ["T13"],
    );
  }

  if (aiHeavyActivities.length > 0) {
    const weakChecks = aiHeavyActivities.filter((activity) => !hasAnyCard(activity, ["T05", "T06", "T08"]));

    if (weakChecks.length > 0) {
      pushRisk(
        risks,
        "AI_OVER_RELIANCE",
        "high",
        "AI를 활용하지만 비교, 신뢰 점검, 역할 조정 카드가 함께 배치되지 않아 결과 수용이 빨라질 수 있습니다.",
        "AI를 쓰는 활동마다 'AI 비교 질문', 'AI 신뢰 점검', 'AI 의존 조절' 중 최소 하나를 연결하세요.",
        turns.filter((turn) => weakChecks.some((activity) => activity.id === turn.activityId)).map((turn) => turn.id),
        ["T05", "T06", "T08"],
      );
    }
  }

  if (!hasDeepLearningScaffold) {
    pushRisk(
      risks,
      "SHALLOW_LEARNING",
      "high",
      "질문 확장, 비교, 근거 설명, 전략 비교를 유도하는 카드가 거의 보이지 않습니다.",
      "'사고 확장', '비교 질문', '근거 기반 토론', '전략 비교' 카드를 최소 두 활동 이상에 배치하세요.",
      activityIds,
      ["T01", "T02", "T10", "T12"],
    );
  }

  if (!design.activities.some((activity) => activity.humanCardIds.includes("T10"))) {
    pushRisk(
      risks,
      "UNGROUNDED_JUDGMENT",
      "medium",
      "학생이 왜 그런 판단을 했는지 근거를 말하도록 요구하는 구조가 약합니다.",
      "최소 한 번 이상 학생이 자신의 판단 근거를 설명하도록 수업 질문을 재설계하세요.",
      activityIds,
      ["T10"],
    );
  }

  if (!hasAccountability) {
    pushRisk(
      risks,
      "UNCLEAR_ACCOUNTABILITY",
      "medium",
      "결과에 대한 책임 주체를 확인하는 장면이 보이지 않습니다.",
      "마무리 활동에 '책임 인식' 카드를 추가해 누가 어떤 판단을 맡는지 분명히 하세요.",
      activityIds,
      ["T14"],
    );
  }

  const mismatchTurns = turns.filter(
    (turn) => turn.linkedCardIds.length >= 3 && turn.missedOpportunities.some((item) => item.includes("부족") || item.includes("빠져")),
  );

  if (mismatchTurns.length > 0) {
    pushRisk(
      risks,
      "CARD_BEHAVIOR_MISMATCH",
      "medium",
      "여러 카드를 배치했지만 실제 시뮬레이션 장면에서는 카드 의도가 충분히 행동으로 드러나지 않습니다.",
      "활동마다 핵심 카드 1~2장에 집중하고, teacherMove와 질문 문장을 카드 의도에 맞게 더 구체화하세요.",
      mismatchTurns.map((turn) => turn.id),
      mismatchTurns.flatMap((turn) => turn.linkedCardIds),
    );
  }

  const psychologicalSignals = design.activities.some((activity) =>
    /정답|오답|실수만|채점/.test([activity.learningActivity, activity.assessmentMethod, activity.notes].join(" ")),
  );

  if (psychologicalSignals) {
    pushRisk(
      risks,
      "PSYCHOLOGICAL_SAFETY_RISK",
      "low",
      "평가 또는 활동 설명에 결과 중심, 정답 중심 표현이 포함되어 있어 심리적 안전이 약해질 수 있습니다.",
      "피드백 표현을 성장 중심 언어로 바꾸고, 수정 기회를 명시하세요.",
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
        ? `${turn.turnIndex}차 '${turn.activityTitle}' 장면에서 ${riskLabels[risk.riskType]}가 포착되었습니다. 다음 차시에서는 어떤 질문 또는 카드 배치를 바꾸시겠습니까?`
        : `${riskLabels[risk.riskType]}를 줄이기 위해 다음 설계안에서 무엇을 바꾸시겠습니까?`,
      rationale: risk.rationale,
      linkedTurnIds: risk.evidenceTurnIds,
      linkedRiskIds: [risk.id],
    };
  });

  if (questions.length === 0) {
    questions.push({
      id: crypto.randomUUID(),
      simulationRunId: "draft-run",
      prompt: `${design.meta.topic || "이번 수업"} 설계에서 가장 유지하고 싶은 교사 개입은 무엇이며, 그 이유는 무엇입니까?`,
      rationale: "명시적 위험이 적더라도 설계의 강점을 성찰 자산으로 남기는 것이 중요합니다.",
      linkedTurnIds: turns.map((turn) => turn.id),
      linkedRiskIds: [],
    });
  }

  return questions;
}

export function buildReflectionMarkdown(input: {
  design: LessonDesign;
  analysis: DesignAnalysis | null;
  scenario: SimulationScenario | null;
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
    "## 시뮬레이션 시나리오",
    "",
    ...(input.scenario
      ? [
          `### ${input.scenario.title}`,
          `- 배경: ${input.scenario.setting}`,
          `- 학습 흐름: ${input.scenario.learningArc}`,
          `- 관찰 포인트: ${input.scenario.facilitatorBrief}`,
          "",
          ...input.scenario.episodes.flatMap((episode) => [
            `#### ${episode.title}`,
            `- 렌즈: ${episode.lens}`,
            `- 장면: ${episode.narrative}`,
            `- 인간 agency: ${episode.humanAgencyFocus}`,
            `- AI agency: ${episode.aiAgencyFocus}`,
            `- 학생 학습 신호: ${episode.studentLearningSignal}`,
            `- 잠재 긴장: ${episode.possibleTension}`,
            "",
          ]),
        ]
      : ["- 시나리오 없음", ""]),
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
    "## 포착된 위험",
    "",
    ...(input.risks.length
      ? input.risks.flatMap((risk) => [
          `### ${riskLabels[risk.riskType]} (${risk.severity})`,
          `- 근거: ${risk.rationale}`,
          `- 권장 개입: ${risk.recommendedIntervention}`,
          "",
        ])
      : ["- 주요 위험 없음", ""]),
    "## 성찰 질문 응답",
    "",
    ...input.questions.flatMap((question) => [
      `### ${question.prompt}`,
      input.answers[question.id] || "- 응답 없음",
      "",
    ]),
    "## 종합 메모",
    "",
    input.summary || "- 요약 없음",
    "",
    "## 다음 수정 체크리스트",
    "",
    ...(input.nextRevisionNotes.length
      ? input.nextRevisionNotes.map((note) => `- ${note}`)
      : ["- 다음 수정 체크리스트 없음"]),
  ];

  return sections.join("\n");
}