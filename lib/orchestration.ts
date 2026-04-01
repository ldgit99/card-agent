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
    !activity.humanCardIds.includes("T10") && "학생이 자신의 근거를 설명하는 시간이 충분히 보이지 않습니다.",
    activity.aiCardIds.length > 0 && !hasAnyCard(activity, ["T05", "T06", "T08"]) && "AI 결과를 비교하거나 신뢰를 점검하는 질문이 비어 있습니다.",
    activity.aiCardIds.length > activity.humanCardIds.length && "AI 지원에 비해 교사의 조율 장치가 늦게 설계되어 있습니다.",
  ].filter(Boolean) as string[];
}

function buildStudentLearningSignal(activity: LessonActivity) {
  if (hasAnyCard(activity, ["T10", "T12"])) {
    return "학생이 서로의 근거를 비교하며 어떤 전략이 더 적절한지 말로 설명하는 장면이 나타납니다.";
  }

  if (hasAnyCard(activity, ["T05", "T06", "A20"])) {
    return "학생이 AI 응답을 그대로 받아들이지 않고, 자신의 판단과 나란히 두고 검토하려는 신호가 보입니다.";
  }

  return "학생은 과제를 수행하지만 질문, 비교, 수정이 약하면 결과 제출 중심으로 흐를 가능성이 있습니다.";
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
    return `교사는 '${teacherCardTitle}' 카드를 통해 학생 판단의 속도를 조절하고, 질문의 방향을 다시 세웁니다.`;
  }

  return "교사의 개입은 보이지만 판단 기준을 명시하거나 다시 묻는 장면은 상대적으로 약합니다.";
}

function buildAiAgencyFocus(activity: LessonActivity, aiCardTitle?: string) {
  if (aiCardTitle) {
    return `AI는 '${aiCardTitle}' 역할로 자료 생성이나 비교를 돕지만, 최종 해석과 선택은 교사와 학생이 다시 맡아야 합니다.`;
  }

  return "AI는 직접적인 행위자라기보다 배경 도구에 머물며, 수업의 판단 주체는 여전히 인간에게 있습니다.";
}

function buildPossibleTension(activity: LessonActivity) {
  if (activity.aiCardIds.length > 0 && !hasAnyCard(activity, ["T05", "T06", "T08"])) {
    return "AI 결과가 빠르게 채택되면 학생이 왜 그 답을 골랐는지 설명할 기회를 놓칠 수 있습니다.";
  }

  if (!activity.humanCardIds.includes("T13")) {
    return "학생이 AI와 교사 발화를 따라가더라도 마지막 판단의 책임 주체가 흐려질 수 있습니다.";
  }

  if (!hasAnyCard(activity, ["T10", "T12"])) {
    return "활동은 진행되지만 비교와 추론이 충분히 길어지지 않으면 깊이 있는 학습으로 이어지기 어렵습니다.";
  }

  return "교사의 조율과 AI 지원은 균형을 이루지만, 근거 설명과 판단 마감이 어디까지 확인되는지가 핵심 관찰 포인트입니다.";
}

function buildSuccessScene(activity: LessonActivity, teacherCardTitle?: string, aiCardTitle?: string) {
  const title = getActivityTitle(activity);
  const teacherLead = teacherCardTitle
    ? `교사는 '${teacherCardTitle}' 질문으로 학생의 생각을 다시 묻고`
    : "교사는 학생의 발화를 다시 묻고";
  const aiSupport = aiCardTitle
    ? `AI는 '${aiCardTitle}' 역할로 비교 자료나 대안을 제시하며`
    : "AI는 배경 자료를 보조적으로 제공하며";

  if (hasAnyCard(activity, ["T10", "T12", "T13"])) {
    return `${teacherLead} ${aiSupport} 학생은 '${title}' 활동에서 자신의 근거를 비교한 뒤 최종 판단을 스스로 정리합니다.`;
  }

  if (activity.aiCardIds.length > 0) {
    return `${teacherLead} ${aiSupport} 학생은 AI 제안을 참고하되 그대로 수용하지 않고 선택 이유를 말로 드러냅니다.`;
  }

  return `${teacherLead} 학생은 '${title}' 활동의 결과보다 사고 과정에 더 오래 머물며, 서로의 해석을 비교합니다.`;
}

function buildChallengeScene(activity: LessonActivity, teacherCardTitle?: string, aiCardTitle?: string) {
  const title = getActivityTitle(activity);

  if (activity.aiCardIds.length > 0 && !hasAnyCard(activity, ["T05", "T06", "T08"])) {
    return `'${title}' 활동에서 ${aiCardTitle ? `'${aiCardTitle}'가 만든 답` : "AI 결과"}이 빠르게 채택되며, 학생이 왜 그 답을 골랐는지 설명하지 못한 채 다음 단계로 넘어갈 수 있습니다.`;
  }

  if (!hasAnyCard(activity, ["T10", "T12"])) {
    return `'${title}' 활동이 산출물 작성 중심으로 흘러 학생이 비교, 반론, 재설계 없이 정답형 수행으로 멈출 수 있습니다.`;
  }

  if (!activity.humanCardIds.includes("T13")) {
    return `${teacherCardTitle ? `'${teacherCardTitle}' 질문 이후에도` : "활동 말미에도"} 최종 결정 주체가 흐려져, 학생이 교사나 AI의 판단을 그대로 따를 가능성이 있습니다.`;
  }

  return `같은 설계 안에서도 일부 학생은 '${title}' 활동의 의도를 이해하지 못하고, 카드가 요구한 질문과 비교 단계를 건너뛰며 결과만 빠르게 정리할 수 있습니다.`;
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
    strengths.push("최종 판단 카드가 포함되어 인간의 의사결정 책임이 비교적 분명합니다.");
  } else {
    gaps.push("AI 개입은 보이지만 교사의 최종 판단을 명시하는 장치가 부족합니다.");
    recommendations.push("정리 또는 평가 단계에 '최종 판단' 카드를 배치해 교사가 결정의 마감을 책임지도록 하세요.");
  }

  if (hasGroundedDiscussion) {
    strengths.push("학생이 근거를 말하고 비교하는 깊이 있는 학습 장치가 포함되어 있습니다.");
  } else {
    gaps.push("결과 제출은 보이지만 학생이 왜 그렇게 판단했는지 설명하는 장면이 약합니다.");
    recommendations.push("'근거 기반 토론' 또는 '전략 비교' 카드를 추가해 설명과 비교를 길게 가져가세요.");
  }

  if (hasAiTrustCheck) {
    strengths.push("AI 결과를 그대로 수용하지 않고 신뢰를 점검하는 흐름이 설계되어 있습니다.");
  } else {
    gaps.push("AI 산출물의 한계와 신뢰도를 묻는 질문이 충분히 드러나지 않습니다.");
    recommendations.push("AI를 사용하는 활동마다 'AI 신뢰 점검' 또는 'AI 비교 질문' 카드를 함께 배치하세요.");
  }

  if (!hasAccountability) {
    gaps.push("결과에 대한 책임 주체와 역할 분담을 확인하는 장면이 부족합니다.");
    recommendations.push("마무리 단계에 '책임 인식' 카드를 배치해 결과에 대한 책임 구조를 명시하세요.");
  }

  if (design.activities.some((activity) => activity.aiCardIds.length > 0)) {
    strengths.push("AI 카드가 실제 활동과 연결되어 도구 사용이 아닌 역할 분담으로 설계되어 있습니다.");
  }

  return {
    summary: `${design.meta.topic || "이번 수업"} 설계는 ${design.activities.length}개의 활동으로 구성되어 있으며, 교사 조율과 AI 지원이 어떻게 분담되는지가 핵심 관찰 포인트입니다.`,
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
      narrative: `이 에피소드는 '${title}' 활동이 설계한 흐름대로 작동하는지 점검하는 장면입니다. 교사는 ${activity.learningActivity || activity.learningObjective || title}에 학생을 참여시키고, ${aiCard ? "AI 지원을 병행하며" : "AI보다 인간 상호작용을 우선하며"} 판단의 흐름을 조율합니다.`,
      successScene: buildSuccessScene(activity, teacherCard?.title, aiCard?.title),
      challengeScene: buildChallengeScene(activity, teacherCard?.title, aiCard?.title),
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
    setting: `${subject} 수업 맥락에서 ${target} 학습자를 대상으로 진행합니다. 교사는 AI를 보조 주체로 두되, 판단의 기준과 최종 선택은 인간이 다시 붙잡는 수업 장면을 설계합니다.`,
    learningArc: activityTitles.length
      ? `${activityTitles.join(" → ")}의 흐름으로 전개되며, 각 장면마다 설계가 잘 작동하는 모습과 흔들리는 모습을 함께 관찰합니다.`
      : "도입, 탐구, 정리 흐름 속에서 인간과 AI의 역할 분담이 어떻게 작동하는지 관찰합니다.",
    facilitatorBrief:
      "각 에피소드는 설계를 그대로 따르되, 같은 활동 안에서도 잘 작동하는 장면과 잘 안되는 장면을 나란히 제시합니다. 이를 통해 human-AI agency, 깊이 있는 학습, 책임 구조가 실제로 살아나는지 점검합니다.",
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

  const expectedStudentResponse = scenarioEpisode
    ? `잘 풀리면 ${scenarioEpisode.successScene} 반면 흔들리면 ${scenarioEpisode.challengeScene}`
    : buildStudentLearningSignal(activity);

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
      ? "도입 장면에서는 활동 목표뿐 아니라 인간의 조율 책임을 분명히 하는 것이 중요합니다."
      : "앞선 장면의 학생 반응을 다시 받아 비교와 근거 설명으로 이어지는지가 핵심입니다.";

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
      "AI가 개입하는 활동은 있지만 교사의 최종 판단을 명시하는 카드가 보이지 않습니다.",
      "정리 또는 평가 직전 단계에 '최종 판단' 카드를 배치해 인간이 결정의 마감을 책임지도록 하세요.",
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
        "AI를 사용하지만 비교, 신뢰 점검, 의존 조절 카드가 함께 배치되지 않아 결과 수용이 빨라질 수 있습니다.",
        "AI가 등장하는 활동마다 'AI 비교 질문', 'AI 신뢰 점검', 'AI 의존 조절' 중 최소 하나를 함께 연결하세요.",
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
      "학생이 왜 그런 판단을 했는지 근거를 말하도록 요구하는 구조가 부족합니다.",
      "최소 한 번 이상 학생이 자신의 판단 근거를 설명하도록 질문을 설계하세요.",
      activityIds,
      ["T10"],
    );
  }

  if (!hasAccountability) {
    pushRisk(
      risks,
      "UNCLEAR_ACCOUNTABILITY",
      "medium",
      "결과에 대한 책임 주체를 확인하는 장면이 드러나지 않습니다.",
      "마무리 활동에 '책임 인식' 카드를 추가해 누가 어떤 판단을 책임지는지 분명히 하세요.",
      activityIds,
      ["T14"],
    );
  }

  const mismatchTurns = turns.filter(
    (turn) => turn.linkedCardIds.length >= 3 && turn.missedOpportunities.some((item) => item.includes("부족") || item.includes("비어")),
  );

  if (mismatchTurns.length > 0) {
    pushRisk(
      risks,
      "CARD_BEHAVIOR_MISMATCH",
      "medium",
      "여러 카드를 배치했지만 실제 활동 장면에서는 카드 의도가 충분한 행동으로 드러나지 않습니다.",
      "활동마다 핵심 카드 1~2장에 집중하고, 교사 개입 문장과 질문을 카드 의도에 맞게 더 구체화하세요.",
      mismatchTurns.map((turn) => turn.id),
      mismatchTurns.flatMap((turn) => turn.linkedCardIds),
    );
  }

  const psychologicalSignals = design.activities.some((activity) =>
    /정답|오답|점수만|채점/.test([activity.learningActivity, activity.assessmentMethod, activity.notes].join(" ")),
  );

  if (psychologicalSignals) {
    pushRisk(
      risks,
      "PSYCHOLOGICAL_SAFETY_RISK",
      "low",
      "평가 또는 활동 설명에 결과 중심, 정답 중심 표현이 포함되어 있어 심리적 안전을 해칠 수 있습니다.",
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
        ? `${turn.turnIndex}차 '${turn.activityTitle}' 장면에서 ${riskLabels[risk.riskType]}가 포착되었습니다. 다음 차시에서는 어떤 질문 또는 카드 배치를 바꾸겠습니까?`
        : `${riskLabels[risk.riskType]}를 줄이기 위해 다음 설계안에서 무엇을 바꾸겠습니까?`,
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
      rationale: "명시적인 위험이 없더라도 설계의 강점을 다음 수업 자산으로 남기는 것이 중요합니다.",
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
            `- 장면 설명: ${episode.narrative}`,
            `- 잘되고 있는 모습: ${episode.successScene}`,
            `- 잘 안되는 모습: ${episode.challengeScene}`,
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