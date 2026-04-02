import { orchestrationCards } from "@/data/cards";
import { riskLabels } from "@/lib/constants";
import type {
  CardOutcomeLink,
  DesignAnalysis,
  DetectedRisk,
  LessonActivity,
  LessonDesign,
  PersonaResponse,
  ReflectionQuestion,
  RiskType,
  SimulationArtifactExample,
  SimulationScenario,
  SimulationTurn,
  StudentPersona,
  TeacherInterventionOption,
} from "@/types/lesson";

const deepLearningCardIds = ["T01", "T02", "T03", "T04", "T10", "T12"];
const aiCheckCardIds = ["T05", "T06", "T07", "T08", "A20"];
const agencyCardIds = ["T13", "T14"];

function getCard(cardId: string) {
  return orchestrationCards.find((card) => card.id === cardId) ?? null;
}

function getActivityTitle(activity: LessonActivity) {
  return activity.title || activity.learningActivity || activity.functionLabel || `활동 ${activity.order}`;
}

function hasAnyCard(activity: LessonActivity, ids: string[]) {
  return ids.some((id) => activity.humanCardIds.includes(id) || activity.aiCardIds.includes(id));
}

function getPrimaryTeacherCard(activity: LessonActivity) {
  return activity.humanCardIds.length ? getCard(activity.humanCardIds[0]) : null;
}

function getPrimaryAiCard(activity: LessonActivity) {
  return activity.aiCardIds.length ? getCard(activity.aiCardIds[0]) : null;
}

function summarizeTools(activity: LessonActivity) {
  return activity.tools.length ? activity.tools.join(", ") : "교실 대화와 활동지";
}

function createStudentPersonas(design: LessonDesign): StudentPersona[] {
  const target = design.meta.target || "해당 학급";
  const subject = design.meta.subject || "교과 수업";

  return [
    {
      id: "persona-evidence-seeker",
      name: "민서",
      label: "근거 탐구형",
      profile: `${target}에서 자신의 판단 근거를 또렷하게 말하려는 학생이다. ${subject}에서 개념 연결을 스스로 설명하려는 편이다.`,
      strength: "핵심 주장과 근거를 연결해 말한다.",
      watchPoint: "AI가 제시한 문장을 그대로 인용하면 자기 설명이 줄어들 수 있다.",
      aiTendency: "AI를 초안 도구로 보지만 마지막 판단은 직접 하려 한다.",
      supportNeed: "근거를 비교하는 질문과 반론 기회를 주면 더 깊어진다.",
      likelyUtterance: "AI 답도 참고했지만, 저는 이 자료의 근거가 더 설득력 있다고 생각해요.",
    },
    {
      id: "persona-fast-adopter",
      name: "지호",
      label: "빠른 수용형",
      profile: `${target}에서 과제를 빨리 끝내려는 학생이다. 속도는 빠르지만 판단 과정 설명은 짧을 때가 많다.`,
      strength: "도구 사용과 초안 생성이 빠르다.",
      watchPoint: "AI 답변을 검토 없이 채택할 가능성이 크다.",
      aiTendency: "AI가 준 문장을 정답처럼 받아들일 때가 있다.",
      supportNeed: "왜 그 답을 골랐는지 말하게 하는 교사 개입이 필요하다.",
      likelyUtterance: "AI가 이렇게 정리해 줬으니까 이걸로 제출하면 될 것 같아요.",
    },
    {
      id: "persona-quiet-observer",
      name: "서연",
      label: "조용한 관찰형",
      profile: `${target}에서 이해는 하고 있지만 먼저 말하지는 않는 학생이다. 질문 구조가 분명할수록 참여가 살아난다.`,
      strength: "타인의 의견 차이를 세심하게 본다.",
      watchPoint: "발화 기회가 적으면 학습 신호가 드러나지 않는다.",
      aiTendency: "AI보다 친구 설명을 먼저 참고하려는 편이다.",
      supportNeed: "짧은 쓰기, 짝 토의, 선택형 질문이 필요하다.",
      likelyUtterance: "저는 두 의견이 다른 이유를 먼저 비교해 보고 싶어요.",
    },
    {
      id: "persona-tool-driver",
      name: "도윤",
      label: "도구 주도형",
      profile: `${target}에서 디지털 도구 사용에 익숙한 학생이다. 도구 활용은 능숙하지만 개념 점검을 건너뛸 수 있다.`,
      strength: "AI 프롬프트를 빠르게 조정해 여러 결과를 만든다.",
      watchPoint: "결과를 많이 만들수록 오히려 비교 기준이 흐려질 수 있다.",
      aiTendency: "여러 AI 결과를 돌려보지만, 고르는 이유는 약할 때가 있다.",
      supportNeed: "비교 기준과 선택 기준을 표로 말하게 해야 한다.",
      likelyUtterance: "결과는 여러 개 나왔는데, 어떤 기준으로 고를지 아직 정리가 안 됐어요.",
    },
  ];
}

function getEpisodeLens(activity: LessonActivity) {
  if (hasAnyCard(activity, agencyCardIds)) {
    return "Human-AI Agency";
  }

  if (hasAnyCard(activity, deepLearningCardIds)) {
    return "Deep Learning";
  }

  if (hasAnyCard(activity, aiCheckCardIds)) {
    return "Critical AI Use";
  }

  return "Classroom Orchestration";
}

function buildMissedOpportunities(activity: LessonActivity) {
  return [
    !hasAnyCard(activity, deepLearningCardIds) && "비교, 근거 설명, 재질문이 부족해 학습이 결과 제출 중심으로 흘러갈 수 있습니다.",
    activity.aiCardIds.length > 0 && !hasAnyCard(activity, aiCheckCardIds) && "AI 결과를 검증하거나 다른 대안과 비교하는 구조가 약합니다.",
    activity.aiCardIds.length > 0 && !activity.humanCardIds.includes("T13") && "교사의 최종 판단 장치가 없어 학생이 AI를 최종 답으로 오해할 수 있습니다.",
    !activity.humanCardIds.includes("T14") && "결과의 책임 주체를 확인하는 장면이 보이지 않습니다.",
    !/토론|토의|짝|모둠|공유|발표/.test([activity.learningActivity, activity.notes].join(" ")) && "조용한 학생의 참여 신호를 확인할 장면이 부족합니다.",
  ].filter(Boolean) as string[];
}

function buildStudentLearningSignal(activity: LessonActivity) {
  if (hasAnyCard(activity, ["T10", "T12"])) {
    return "학생이 결과보다 근거와 비교 기준을 말하는 장면이 생기며, 서로 다른 답을 비교하는 대화가 가능해집니다.";
  }

  if (activity.aiCardIds.length > 0) {
    return "학생이 AI 결과를 빠르게 받아들이지만, 교사가 질문을 걸어 주지 않으면 자기 판단의 언어가 약해질 수 있습니다.";
  }

  return "학생이 활동을 수행하지만 무엇을 배웠는지보다 무엇을 완성했는지에 초점이 이동할 수 있습니다.";
}

function buildHumanAgencyFocus(activity: LessonActivity, teacherCardTitle?: string) {
  if (teacherCardTitle) {
    return `교사는 '${teacherCardTitle}'와 같은 질문을 던지며 학생의 사고를 다시 열고, 판단 기준을 수업 안에 붙잡아 둡니다.`;
  }

  return "교사의 개입은 보이지만 어떤 질문으로 판단을 조율할지 더 분명해질 필요가 있습니다.";
}

function buildAiAgencyFocus(activity: LessonActivity, aiCardTitle?: string) {
  if (aiCardTitle) {
    return `AI는 '${aiCardTitle}' 역할로 자료, 대안, 피드백을 제공하지만 최종 선택과 설명은 학생과 교사가 다시 맡아야 합니다.`;
  }

  return "AI는 보조 자료 수준에 머물며, 수업의 판단 구조는 교사와 학생의 상호작용이 결정합니다.";
}

function buildPossibleTension(activity: LessonActivity) {
  if (activity.aiCardIds.length > 0 && !hasAnyCard(activity, aiCheckCardIds)) {
    return "AI 결과를 빠르게 수용하는 학생이 늘어나면 교사의 질문이 늦을수록 근거 없는 채택이 발생할 수 있습니다.";
  }

  if (!hasAnyCard(activity, deepLearningCardIds)) {
    return "활동은 돌아가지만 비교와 설명이 부족해 깊이 있는 학습보다 과제 완수 중심으로 흐를 위험이 있습니다.";
  }

  if (!activity.humanCardIds.includes("T13")) {
    return "교사와 AI가 모두 제안을 내는 상황에서 마지막 판단의 주체가 흐려질 수 있습니다.";
  }

  return "좋은 설계라도 참여가 빠른 학생 몇 명에게 집중되면 나머지 학생의 학습 신호가 묻힐 수 있습니다.";
}

function buildSuccessScene(activity: LessonActivity, teacherCardTitle?: string, aiCardTitle?: string) {
  const title = getActivityTitle(activity);
  const teacherLead = teacherCardTitle
    ? `교사가 '${teacherCardTitle}' 질문으로 학생의 생각을 다시 묻고`
    : "교사가 학생의 선택 이유를 다시 묻고";
  const aiSupport = aiCardTitle
    ? `AI는 '${aiCardTitle}' 역할로 비교 자료를 제공하며`
    : "AI 없이도 학생 대화와 자료를 중심으로";

  return `${teacherLead} ${aiSupport} '${title}' 활동에서 학생들이 답만 고르지 않고 기준을 말한다. 빠른 학생은 초안을 제시하고, 다른 학생은 근거를 보완하며, 마지막에는 교사가 판단의 기준을 정리한다.`;
}

function buildOrdinaryScene(activity: LessonActivity, teacherCardTitle?: string, aiCardTitle?: string) {
  const title = getActivityTitle(activity);

  if (activity.aiCardIds.length > 0) {
    return `'${title}' 활동에서 일부 학생은 AI 결과를 먼저 참고하고, 일부 학생은 자신의 의견을 늦게 꺼낸다. ${teacherCardTitle ? `교사가 '${teacherCardTitle}'와 같은 질문을 던지면` : "교사가 중간에 질문을 넣으면"} 수업이 다시 비교와 설명 쪽으로 돌아오지만, 그렇지 않으면 결과 정리로 빨라질 수 있다.`;
  }

  return `'${title}' 활동은 대체로 안정적으로 진행되지만, 참여가 빠른 학생 중심으로 논의가 이어질 수 있다. 교사가 한두 번 근거를 묻고 조용한 학생의 생각을 드러내면 학습의 깊이가 유지된다.`;
}

function buildChallengeScene(activity: LessonActivity, teacherCardTitle?: string, aiCardTitle?: string) {
  const title = getActivityTitle(activity);

  if (activity.aiCardIds.length > 0 && !hasAnyCard(activity, aiCheckCardIds)) {
    return `'${title}' 활동에서 ${aiCardTitle ? `'${aiCardTitle}'가 제안한 결과가` : "AI 결과가"} 빠르게 정답처럼 채택된다. 학생은 왜 그 답을 골랐는지 설명하지 못하고, 교사도 기준을 다시 묻지 못한 채 다음 단계로 넘어간다.`;
  }

  if (!hasAnyCard(activity, deepLearningCardIds)) {
    return `'${title}' 활동이 산출물 작성 중심으로 흘러 학생이 비교, 반론, 재설명 없이 정리만 하게 된다. 학습목표보다 제출 형식이 더 크게 남는다.`;
  }

  return `${teacherCardTitle ? `'${teacherCardTitle}'와 같은 질문이 들어가더라도` : "활동이 진행되더라도"} 조용한 학생은 참여하지 못하고 몇몇 학생만 답을 주도한다. 결과는 나오지만 학급 전체의 학습 신호는 충분히 드러나지 않는다.`;
}

function selectFeaturedPersonas(activity: LessonActivity, personas: StudentPersona[]) {
  if (activity.aiCardIds.length > 0) {
    return [personas[0], personas[1], personas[3]];
  }

  if (hasAnyCard(activity, ["T03", "T11", "T12"])) {
    return [personas[0], personas[2], personas[3]];
  }

  return [personas[0], personas[1], personas[2]];
}

function buildArtifacts(
  activity: LessonActivity,
  featuredPersonas: StudentPersona[],
  aiCardTitle?: string,
): SimulationArtifactExample[] {
  const title = getActivityTitle(activity);
  const primaryPersona = featuredPersonas[0] ?? null;
  const secondaryPersona = featuredPersonas[1] ?? null;

  const artifacts: SimulationArtifactExample[] = [
    {
      id: crypto.randomUUID(),
      type: "student_note",
      title: `${title} 근거 메모`,
      studentPersonaId: primaryPersona?.id ?? null,
      content: `${primaryPersona?.name ?? "학생"}이(가) 자신의 판단 기준 두 가지와 선택 이유를 짧게 적었다.`,
      quality: hasAnyCard(activity, ["T10", "T12"]) ? "strong" : "mixed",
      insight: hasAnyCard(activity, ["T10", "T12"])
        ? "근거를 말하게 하는 질문이 실제 학생 메모 품질을 끌어올린다."
        : "메모는 있지만 선택 기준이 분명하지 않아 교사 질문이 더 필요하다.",
    },
  ];

  if (activity.aiCardIds.length > 0) {
    artifacts.push(
      {
        id: crypto.randomUUID(),
        type: "ai_prompt",
        title: `${title} AI 요청 문장`,
        studentPersonaId: secondaryPersona?.id ?? null,
        content: `${secondaryPersona?.name ?? "학생"}이(가) "세 가지 대안을 비교할 수 있게 정리해 줘"와 같이 AI에 요청했다.`,
        quality: hasAnyCard(activity, aiCheckCardIds) ? "strong" : "weak",
        insight: hasAnyCard(activity, aiCheckCardIds)
          ? "AI를 단순 정답 생성기가 아니라 비교 자료 생성기로 사용한다."
          : "AI 요청은 있었지만 검증 질문이 없어 결과 채택으로 바로 이어질 수 있다.",
      },
      {
        id: crypto.randomUUID(),
        type: "ai_output",
        title: `${aiCardTitle ?? "AI"} 결과 일부`,
        studentPersonaId: null,
        content: "AI가 한 줄 요약과 근거 후보를 제시했지만, 일부 내용은 학생 맥락과 정확히 맞지 않는다.",
        quality: hasAnyCard(activity, ["T06", "A20"]) ? "mixed" : "weak",
        insight: "교사가 그대로 사용하지 말고 무엇을 취하고 무엇을 버릴지 묻게 해야 한다.",
      },
    );
  } else {
    artifacts.push({
      id: crypto.randomUUID(),
      type: "discussion_quote",
      title: `${title} 토의 발화`,
      studentPersonaId: secondaryPersona?.id ?? null,
      content: `${secondaryPersona?.name ?? "학생"}이(가) "두 의견이 다른 이유부터 비교해 보자"라고 말했다.`,
      quality: "mixed",
      insight: "학생 간 비교 대화가 생기면 교사는 근거를 명확히 말하게 하는 후속 질문이 필요하다.",
    });
  }

  artifacts.push({
    id: crypto.randomUUID(),
    type: "assessment_excerpt",
    title: `${title} 평가 흔적`,
    studentPersonaId: null,
    content: activity.assessmentMethod || "관찰과 메모를 통해 학생의 설명 과정을 확인한다.",
    quality: /근거|설명|비교|토론|판단/.test(activity.assessmentMethod) ? "strong" : "mixed",
    insight: /근거|설명|비교|토론|판단/.test(activity.assessmentMethod)
      ? "평가가 결과뿐 아니라 사고 과정을 포착할 가능성이 있다."
      : "평가 문구가 산출물 중심이라면 실제 사고 과정은 놓칠 수 있다.",
  });

  return artifacts;
}

function buildTeacherInterventions(
  activity: LessonActivity,
  teacherCardTitle?: string,
  aiCardTitle?: string,
): TeacherInterventionOption[] {
  const title = getActivityTitle(activity);

  return [
    {
      id: crypto.randomUUID(),
      title: "근거를 다시 묻기",
      timing: `${title} 활동 중 학생이 답을 고른 직후`,
      move: teacherCardTitle
        ? `교사가 '${teacherCardTitle}'에 담긴 질문처럼 "왜 그렇게 판단했는지"를 다시 묻는다.`
        : "교사가 답을 확인하는 대신 선택 이유와 비교 기준을 다시 묻는다.",
      expectedImpact: "학생이 결과가 아니라 근거를 말하게 되어 깊이 있는 학습 신호가 드러난다.",
      linkedCardIds: activity.humanCardIds.slice(0, 2),
    },
    {
      id: crypto.randomUUID(),
      title: activity.aiCardIds.length > 0 ? "AI 결과 검증으로 전환" : "조용한 학생 발화 끌어내기",
      timing: `${title} 활동이 빨라지거나 일부 학생에 편중될 때`,
      move: activity.aiCardIds.length > 0
        ? `교사가 ${aiCardTitle ? `'${aiCardTitle}' 결과` : "AI 결과"}를 그대로 채택하지 말고 무엇을 버릴지 먼저 말하게 한다.`
        : "교사가 짝 토의나 짧은 쓰기를 넣어 조용한 학생의 판단을 먼저 수면 위로 올린다.",
      expectedImpact: activity.aiCardIds.length > 0
        ? "AI 과의존을 줄이고 인간의 최종 판단을 다시 세운다."
        : "참여 편중을 줄이고 학급 전체의 학습 신호를 확인할 수 있다.",
      linkedCardIds: [...activity.humanCardIds.slice(0, 1), ...activity.aiCardIds.slice(0, 1)],
    },
  ];
}

function buildCardOutcomeLinks(activity: LessonActivity): CardOutcomeLink[] {
  return [...activity.humanCardIds, ...activity.aiCardIds]
    .slice(0, 4)
    .map((cardId) => {
      const card = getCard(cardId);
      return {
        cardId,
        cardTitle: card?.title ?? cardId,
        actor: card?.actor ?? (cardId.startsWith("A") ? "ai" : "teacher"),
        influence: card?.intent ?? "활동의 판단 흐름을 조절한다.",
        resultingChange: card?.actor === "ai"
          ? "학생이 더 빠르게 초안과 비교 자료를 얻지만, 교사의 검증 질문이 함께 붙어야 한다."
          : "교사의 질문이 학생의 설명, 비교, 최종 판단을 수업 안에 붙잡는다.",
      };
    });
}

function buildPersonaResponses(activity: LessonActivity, personas: StudentPersona[]): PersonaResponse[] {
  const title = getActivityTitle(activity);
  const featured = selectFeaturedPersonas(activity, personas);

  return featured.map((persona, index) => {
    if (index === 0) {
      return {
        personaId: persona.id,
        personaName: persona.name,
        response: `${persona.name}은(는) "${persona.likelyUtterance}"라고 답하며 '${title}' 활동에서 왜 그렇게 판단했는지 근거를 덧붙여 설명한다.`,
        learningSignal: "근거와 판단의 연결이 보이는 신호",
      };
    }

    if (index === 1 && activity.aiCardIds.length > 0) {
      return {
        personaId: persona.id,
        personaName: persona.name,
        response: `${persona.name}은(는) "AI가 이렇게 정리해 줬는데 이걸로 해도 되나요?"라고 묻는다. 속도는 빠르지만 선택 이유는 짧게 말하는 편이다.`,
        learningSignal: "AI를 빠르게 수용하려는 신호",
      };
    }

    return {
      personaId: persona.id,
      personaName: persona.name,
      response: `${persona.name}은(는) "${persona.likelyUtterance}"라고 말하며 다른 학생의 답과 기준을 비교해 보자고 제안한다.`,
      learningSignal: "참여 확장 또는 비교 사고의 신호",
    };
  });
}

function buildActivityRiskSignals(activity: LessonActivity) {
  return [
    activity.aiCardIds.length > 0 && !hasAnyCard(activity, aiCheckCardIds) && "AI 결과 검증 질문이 부족함",
    !hasAnyCard(activity, deepLearningCardIds) && "비교와 근거 설명 장치가 약함",
    !activity.humanCardIds.includes("T13") && activity.aiCardIds.length > 0 && "교사의 최종 판단 장치가 약함",
    !activity.humanCardIds.includes("T14") && "책임 주체 확인이 없음",
    !/토론|토의|짝|모둠|공유|발표/.test([activity.learningActivity, activity.notes].join(" ")) && "참여 편중 가능성 있음",
    !/근거|설명|비교|토론|판단/.test(activity.assessmentMethod) && "평가가 사고 과정을 충분히 보지 못할 수 있음",
  ].filter(Boolean) as string[];
}

export function createHeuristicAnalysis(design: LessonDesign): Omit<DesignAnalysis, "engine"> {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];

  const hasFinalDecision = design.activities.some((activity) => activity.humanCardIds.includes("T13"));
  const hasDeepLearning = design.activities.some((activity) => hasAnyCard(activity, deepLearningCardIds));
  const hasAiCheck = design.activities.some((activity) => hasAnyCard(activity, aiCheckCardIds));
  const hasAccountability = design.activities.some((activity) => activity.humanCardIds.includes("T14"));

  if (hasFinalDecision) {
    strengths.push("교사의 최종 판단을 분명히 하는 장면이 포함되어 인간의 책임과 수업 마감 구조가 비교적 분명합니다.");
  } else {
    gaps.push("AI를 쓰는 활동이 있지만 교사의 최종 판단 장치가 약합니다.");
    recommendations.push("정리 또는 평가 직전에 교사가 최종 판단을 언어화하는 질문을 넣어 누가 결정을 마무리하는지 분명히 하세요.");
  }

  if (hasDeepLearning) {
    strengths.push("비교, 근거 설명, 재질문과 같은 깊이 있는 학습 장치가 일부 활동에 보입니다.");
  } else {
    gaps.push("학생이 왜 그렇게 판단했는지 설명하도록 만드는 질문과 행동이 부족합니다.");
    recommendations.push("두 개 이상의 활동에서 비교 질문, 근거 기반 토론, 관점 전환이 실제로 일어나도록 설계하세요.");
  }

  if (hasAiCheck) {
    strengths.push("AI 결과를 그대로 수용하지 않고 비교하거나 점검하는 장치가 포함되어 있습니다.");
  } else if (design.activities.some((activity) => activity.aiCardIds.length > 0)) {
    gaps.push("AI를 사용하는 활동에 검증 질문과 신뢰 점검이 충분히 드러나지 않습니다.");
    recommendations.push("AI를 쓰는 모든 활동에서 AI 결과를 비교하거나 신뢰도를 묻는 질문이 실제로 나오도록 설계하세요.");
  }

  if (!hasAccountability) {
    gaps.push("결과의 책임 주체를 확인하는 질문과 마무리 행동이 부족합니다.");
    recommendations.push("마무리 활동에서 결과와 판단의 책임을 다시 묻게 하는 질문을 추가하세요.");
  }

  if (design.activities.some((activity) => activity.evidenceOfSuccess.length > 0)) {
    strengths.push("성공 증거가 일부 기록되어 있어 시뮬레이션에서 학생 학습 신호를 포착하기 좋습니다.");
  }

  return {
    summary: `${design.meta.topic || "이 수업"}은(는) ${design.activities.length}개의 활동으로 구성되어 있으며, 교사의 질문과 AI의 보조 역할이 어떻게 균형을 이루는지가 핵심 관찰 포인트입니다.`,
    strengths,
    gaps,
    recommendations,
  };
}

export function createHeuristicScenario(
  design: LessonDesign,
  simulationRunId: string,
): Omit<SimulationScenario, "id" | "engine"> {
  const topic = design.meta.topic || "AI 활용 수업";
  const subject = design.meta.subject || design.activities[0]?.subjectLabel || "교과 미입력";
  const target = design.meta.target || "대상 미입력";
  const studentPersonas = createStudentPersonas(design);

  const episodes = design.activities.map((activity) => {
    const teacherCard = getPrimaryTeacherCard(activity);
    const aiCard = getPrimaryAiCard(activity);
    const title = getActivityTitle(activity);
    const featuredPersonas = selectFeaturedPersonas(activity, studentPersonas);

    return {
      id: crypto.randomUUID(),
      title: `${activity.order}차 활동 · ${title}`,
      lens: getEpisodeLens(activity),
      narrative: `이 장면은 '${title}' 활동에서 교사의 질문, 학생의 판단, AI 도구 사용이 실제 교실 안에서 어떻게 맞물리는지 살펴보는 시뮬레이션이다. 사용 도구는 ${summarizeTools(activity)}이며, 학습활동은 ${activity.learningActivity || title}을 중심으로 전개된다.`,
      successScene: buildSuccessScene(activity, teacherCard?.title, aiCard?.title),
      ordinaryScene: buildOrdinaryScene(activity, teacherCard?.title, aiCard?.title),
      challengeScene: buildChallengeScene(activity, teacherCard?.title, aiCard?.title),
      humanAgencyFocus: buildHumanAgencyFocus(activity, teacherCard?.title),
      aiAgencyFocus: buildAiAgencyFocus(activity, aiCard?.title),
      studentLearningSignal: buildStudentLearningSignal(activity),
      possibleTension: buildPossibleTension(activity),
      relatedActivityId: activity.id,
      linkedCardIds: [...activity.humanCardIds, ...activity.aiCardIds],
      featuredPersonaIds: featuredPersonas.map((persona) => persona.id),
      sampleArtifacts: buildArtifacts(activity, featuredPersonas, aiCard?.title),
      teacherInterventions: buildTeacherInterventions(activity, teacherCard?.title, aiCard?.title),
      cardOutcomeLinks: buildCardOutcomeLinks(activity),
    };
  });

  const activityTitles = design.activities.map((activity) => getActivityTitle(activity));

  return {
    simulationRunId,
    title: `${topic} 모의수업 시나리오`,
    setting: `${subject} 수업에서 ${target} 학습자를 대상으로 진행한다. 교사는 학생의 판단 언어를 살리고, AI는 초안·비교 자료·설명 보조의 역할에 머문다는 전제를 둔다.`,
    learningArc: activityTitles.length
      ? `${activityTitles.join(" → ")}의 흐름으로 진행되며, 각 활동마다 잘되는 모습·보통의 실제 모습·잘 안되는 모습을 함께 관찰한다.`
      : "도입, 탐구, 정리 흐름 속에서 인간과 AI의 역할이 어떻게 달라지는지 관찰한다.",
    facilitatorBrief:
      "교사는 각 장면에서 누가 말하고, 누가 판단하고, 누가 책임을 지는지 본다. 또한 학생 산출물, 조용한 학생의 참여 신호, AI 사용의 검증 수준까지 함께 본다.",
    studentPersonas,
    episodes,
  };
}

export function createHeuristicTurn(
  design: LessonDesign,
  activity: LessonActivity,
  previousTurns: SimulationTurn[],
  scenario?: SimulationScenario | null,
): Omit<SimulationTurn, "id" | "simulationRunId" | "engine"> {
  const teacherCard = getPrimaryTeacherCard(activity);
  const aiCard = getPrimaryAiCard(activity);
  const title = getActivityTitle(activity);
  const scenarioEpisode = scenario?.episodes.find((episode) => episode.relatedActivityId === activity.id) ?? null;
  const personas = scenario?.studentPersonas ?? createStudentPersonas(design);
  const personaResponses = buildPersonaResponses(activity, personas);
  const sampleArtifacts = scenarioEpisode?.sampleArtifacts ?? buildArtifacts(activity, selectFeaturedPersonas(activity, personas), aiCard?.title);
  const teacherInterventions = scenarioEpisode?.teacherInterventions ?? buildTeacherInterventions(activity, teacherCard?.title, aiCard?.title);
  const cardOutcomeLinks = scenarioEpisode?.cardOutcomeLinks ?? buildCardOutcomeLinks(activity);
  const activityRiskSignals = buildActivityRiskSignals(activity);

  const teacherAction = teacherCard
    ? `선생님은 "${teacherCard.prompt}"라고 묻고 ${title} 활동을 연다. ${activity.teacherMove || "학생이 답만 고르지 말고 왜 그렇게 생각했는지 한 번 더 말하게 한다."}`
    : `선생님은 ${title} 활동에서 학생이 먼저 생각을 꺼내게 하고, 결과보다 판단의 근거를 다시 묻게 한다.`;

  const aiAction = aiCard
    ? `AI는 '${aiCard.title}' 역할로 초안과 비교 자료를 보여 준다. 학생은 이를 참고하지만, 선생님은 그대로 채택하지 말고 무엇을 취할지 말하게 한다.`
    : "AI는 전면에 나서지 않고, 교실 대화와 자료 탐구가 활동의 중심이 된다.";

  const expectedStudentResponse = scenarioEpisode
    ? scenarioEpisode.ordinaryScene
    : buildStudentLearningSignal(activity);

  const evidenceObserved = [
    activity.functionLabel ? `기능: ${activity.functionLabel}` : null,
    activity.assessmentMethod ? `평가: ${activity.assessmentMethod}` : null,
    teacherCard ? `교사 질문/행동: ${teacherCard.title}` : null,
    aiCard ? `AI 역할/행동: ${aiCard.title}` : null,
    activity.learningObjective ? `목표: ${activity.learningObjective}` : null,
  ].filter(Boolean) as string[];

  const missedOpportunities = buildMissedOpportunities(activity);

  const observerNote = scenarioEpisode
    ? `${scenarioEpisode.lens} 관점에서 보면 ${scenarioEpisode.possibleTension}`
    : previousTurns.length === 0
      ? "첫 활동에서는 학생이 무엇을 배우는지보다 누가 판단을 끝맺는지가 먼저 드러나야 합니다."
      : "이전 활동의 결과를 이어받아 근거 설명과 판단 마감 장치를 확인해야 합니다.";

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
    studentPersonaResponses: personaResponses,
    sampleArtifacts,
    teacherInterventions,
    cardOutcomeLinks,
    activityRiskSignals,
  };
}

function pushRisk(
  risks: DetectedRisk[],
  input: Omit<DetectedRisk, "id">,
) {
  risks.push({
    id: crypto.randomUUID(),
    ...input,
  });
}

function createRiskPayload(
  turn: SimulationTurn,
  riskType: RiskType,
  severity: "low" | "medium" | "high",
  rationale: string,
  recommendedIntervention: string,
  focusArea: string,
  studentImpact: string,
  watchSignals: string[],
): Omit<DetectedRisk, "id"> {
  return {
    riskType,
    severity,
    evidenceTurnIds: [turn.id],
    rationale,
    recommendedIntervention,
    relatedCardIds: turn.linkedCardIds,
    activityId: turn.activityId,
    activityTitle: turn.activityTitle,
    scenarioEpisodeId: turn.scenarioEpisodeId,
    focusArea,
    studentImpact,
    watchSignals,
  };
}

export function detectHeuristicRisks(design: LessonDesign, turns: SimulationTurn[]): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  for (const turn of turns) {
    const activity = design.activities.find((item) => item.id === turn.activityId);
    if (!activity) {
      continue;
    }

    if (activity.aiCardIds.length > 0 && !hasAnyCard(activity, aiCheckCardIds)) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "AI_OVER_RELIANCE",
          "high",
          "AI를 쓰는 활동이지만 결과를 비교하거나 신뢰도를 묻는 질문이 부족해 학생이 AI 답을 정답처럼 채택할 수 있습니다.",
          "학생이 AI 결과를 그대로 고르기 전에 무엇을 믿고 무엇을 보류할지 먼저 말하게 하세요.",
          "AI 검증 구조",
          "학생의 자기 판단 언어가 약해지고, AI 결과를 그대로 제출할 가능성이 커집니다.",
          ["AI 결과를 그대로 인용한다.", "선택 이유보다 결과 요약만 말한다.", "교사 질문 전에 다음 단계로 넘어간다."],
        ),
      );
    }

    if (!hasAnyCard(activity, deepLearningCardIds)) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "SHALLOW_LEARNING",
          activity.assessmentMethod ? "medium" : "high",
          "비교, 재질문, 근거 설명 행동이 약해 학생이 과제를 수행해도 학습의 깊이가 충분히 드러나지 않을 수 있습니다.",
          "학생이 두 대안을 비교하거나 선택 기준을 말하는 짧은 질문을 반드시 넣으세요.",
          "깊이 있는 학습",
          "학생은 결과는 내지만 왜 그렇게 판단했는지를 설명하지 못할 수 있습니다.",
          ["정답만 말하고 이유를 말하지 않는다.", "활동이 제출 중심으로 빨라진다.", "친구 답과의 차이를 비교하지 않는다."],
        ),
      );
    }

    if (!activity.humanCardIds.includes("T10")) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "UNGROUNDED_JUDGMENT",
          "medium",
          "학생의 주장과 근거를 연결해 묻는 장면이 부족해 판단이 직관이나 AI 문장 복사에 기대기 쉽습니다.",
          "'왜 그렇게 생각했는지'와 '어떤 증거를 썼는지'를 연속으로 묻는 교사 질문을 넣으세요.",
          "근거 기반 판단",
          "학생은 자신의 판단을 설명하지 못하고, 교사는 사고 과정을 평가하기 어려워집니다.",
          ["근거보다 결론을 먼저 말한다.", "증거 출처를 명확히 말하지 못한다."],
        ),
      );
    }

    if (activity.aiCardIds.length > 0 && !activity.humanCardIds.includes("T13")) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "NO_HUMAN_FINAL_DECISION",
          "high",
          "AI가 개입하는 활동인데 교사의 최종 판단이 드러나는 장면이 없어 누가 결정을 마무리하는지 흐려질 수 있습니다.",
          "정리 직전에 교사가 선택 기준을 다시 묻고 마지막 판단은 학생과 교사가 함께 언어화하세요.",
          "최종 판단 구조",
          "학생이 AI를 최종 권위로 오해하거나, 판단 책임을 외부로 넘길 수 있습니다.",
          ["마무리 발화에서 기준보다 답만 정리한다.", "AI 제안을 그대로 정답처럼 부른다."],
        ),
      );
    }

    if (!activity.humanCardIds.includes("T14")) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "UNCLEAR_ACCOUNTABILITY",
          "medium",
          "결과의 책임 주체를 확인하는 질문이 없어 누가 판단했고 누가 책임지는지 흐릴 수 있습니다.",
          "마지막에 '이 판단을 누가 책임질 것인가'를 짧게라도 묻게 하세요.",
          "책임 구조",
          "학생은 결과를 만들고도 자신의 판단 책임을 자각하지 못할 수 있습니다.",
          ["'AI가 그렇게 말했다'는 표현이 나온다.", "결정의 주체를 학생이 아닌 도구로 설명한다."],
        ),
      );
    }

    if (!/토론|토의|짝|모둠|공유|발표/.test([activity.learningActivity, activity.notes].join(" ")) && turn.studentPersonaResponses.length < 3) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "PARTICIPATION_IMBALANCE",
          "medium",
          "활동 설계와 개입 방식상 발화가 빠른 학생 중심으로 진행될 가능성이 큽니다.",
          "짧은 쓰기, 짝 점검, 조용한 학생 우선 발화 순서를 넣어 참여 신호를 넓히세요.",
          "참여 구조",
          "학급 일부만 학습 신호를 드러내고 나머지 학생의 이해 상태는 가려질 수 있습니다.",
          ["같은 학생만 연속으로 말한다.", "조용한 학생의 산출물이나 발화가 보이지 않는다."],
        ),
      );
    }

    if (!/근거|설명|비교|토론|판단/.test(activity.assessmentMethod)) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "ASSESSMENT_MISMATCH",
          "medium",
          "평가 방법이 결과물 중심으로 적혀 있어 실제로 보고 싶은 판단과 근거 설명을 충분히 측정하지 못할 수 있습니다.",
          "평가 문구에 근거 제시, 비교 설명, 최종 판단 근거를 명시적으로 추가하세요.",
          "평가 정합성",
          "학생은 사고 과정보다 산출물 형식에만 집중할 수 있습니다.",
          ["평가가 보고서 제출만 강조한다.", "좋은 질문이나 비교 과정이 평가 기준에 없다."],
        ),
      );
    }

    if (/정답|오답|즉시 채점|실수/.test([activity.assessmentMethod, activity.notes].join(" "))) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "PSYCHOLOGICAL_SAFETY_RISK",
          "low",
          "정답/오답 중심의 표현이 강해 학생이 실수나 미완성 의견을 드러내기 어려울 수 있습니다.",
          "정답 확인보다 수정과 재설명의 기회를 주는 언어로 바꾸세요.",
          "심리적 안전",
          "조용한 학생이 발화를 더 회피하고, AI 결과 뒤에 숨을 수 있습니다.",
          ["실수 방지와 정답 여부가 먼저 언급된다.", "불완전한 초안을 꺼내기 어려워한다."],
        ),
      );
    }

    if (turn.linkedCardIds.length > 1 && turn.missedOpportunities.length >= 2) {
      pushRisk(
        risks,
        createRiskPayload(
          turn,
          "CARD_BEHAVIOR_MISMATCH",
          "medium",
          "설계 의도는 분명하지만 실제 활동 장면에서는 그 의도가 충분히 질문과 행동으로 드러나지 않습니다.",
          "한 활동에서 실제로 실행할 질문과 행동 1~2개를 골라 교사 발화 문장으로 다시 구체화하세요.",
          "설계-실행 일치",
          "좋은 설계가 있어도 학생은 그 효과를 체감하지 못하고, 수업 장면은 평면적으로 진행될 수 있습니다.",
          ["설계 요소는 많지만 교사 질문은 일반적이다.", "설계 의도와 활동 장면이 느슨하게 연결된다."],
        ),
      );
    }
  }

  return risks;
}

export function createReflectionQuestions(
  design: LessonDesign,
  turns: SimulationTurn[],
  risks: DetectedRisk[],
): ReflectionQuestion[] {
  const severityRank = { high: 0, medium: 1, low: 2 } as const;

  const questions = turns.flatMap((turn) => {
    const relatedRisks = risks
      .filter((risk) => risk.evidenceTurnIds.includes(turn.id))
      .sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);

    const primaryRisk = relatedRisks[0] ?? null;
    const secondaryRisk = relatedRisks[1] ?? null;

    if (primaryRisk) {
      return [
        {
          id: crypto.randomUUID(),
          simulationRunId: turn.simulationRunId ?? "draft-run",
          prompt: `${turn.activityTitle}에서 ${riskLabels[primaryRisk.riskType]}가 드러났습니다. 다음 차시에는 선생님의 질문과 학생의 판단 과정을 어떻게 다시 설계하겠습니까?`,
          rationale: `${primaryRisk.focusArea} 관점에서 ${primaryRisk.studentImpact}`,
          linkedTurnIds: [turn.id],
          linkedRiskIds: secondaryRisk ? [primaryRisk.id, secondaryRisk.id] : [primaryRisk.id],
        },
        {
          id: crypto.randomUUID(),
          simulationRunId: turn.simulationRunId ?? "draft-run",
          prompt: `${turn.activityTitle}에서 AI는 어느 시점까지 돕고, 마지막 판단은 학생과 교사가 어떻게 확인하게 하겠습니까?`,
          rationale: "AI의 지원 범위와 인간의 최종 판단 지점을 분명히 해야 Human-AI 에이전시가 선명해집니다.",
          linkedTurnIds: [turn.id],
          linkedRiskIds: [primaryRisk.id],
        },
      ];
    }

    return [
      {
        id: crypto.randomUUID(),
        simulationRunId: turn.simulationRunId ?? "draft-run",
        prompt: `${turn.activityTitle}에서 유지할 만한 교사 질문 또는 학생 참여 장면은 무엇입니까?`,
        rationale: "잘 된 장면을 분명히 잡아야 다음 수업에서도 유지할 수 있습니다.",
        linkedTurnIds: [turn.id],
        linkedRiskIds: [],
      },
      {
        id: crypto.randomUUID(),
        simulationRunId: turn.simulationRunId ?? "draft-run",
        prompt: `${turn.activityTitle}에서 학생이 AI 답을 그대로 받지 않고 근거를 말하게 하려면 어떤 추가 질문이 필요합니까?`,
        rationale: "위험이 크지 않더라도 학생의 설명, 비교, 판단을 더 선명하게 만드는 질문이 필요합니다.",
        linkedTurnIds: [turn.id],
        linkedRiskIds: [],
      },
    ];
  });

  if (!questions.length) {
    return [
      {
        id: crypto.randomUUID(),
        simulationRunId: "draft-run",
        prompt: `${design.meta.topic || "이번 수업"}에서 유지할 설계 요소 하나를 적어 보세요.`,
        rationale: "먼저 무엇이 잘 작동했는지 분명히 해야 다음 수정이 선명해집니다.",
        linkedTurnIds: turns.map((turn) => turn.id),
        linkedRiskIds: [],
      },
      {
        id: crypto.randomUUID(),
        simulationRunId: "draft-run",
        prompt: `${design.meta.topic || "이번 수업"}에서 학생 판단과 AI 활용의 경계를 더 분명히 하려면 무엇을 바꾸겠습니까?`,
        rationale: "교사 질문, 학생 판단, AI 지원의 경계를 분명히 하는 것이 핵심입니다.",
        linkedTurnIds: turns.map((turn) => turn.id),
        linkedRiskIds: [],
      },
    ];
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
    "## 모의수업 시나리오",
    "",
    ...(input.scenario
      ? [
          `### ${input.scenario.title}`,
          `- 배경: ${input.scenario.setting}`,
          `- 학습 흐름: ${input.scenario.learningArc}`,
          `- 관찰 포인트: ${input.scenario.facilitatorBrief}`,
          "",
          "#### 학생 페르소나",
          ...input.scenario.studentPersonas.flatMap((persona) => [
            `- ${persona.name} (${persona.label}): ${persona.profile}`,
            `  강점: ${persona.strength}`,
            `  관찰 포인트: ${persona.watchPoint}`,
          ]),
          "",
          ...input.scenario.episodes.flatMap((episode) => [
            `#### ${episode.title}`,
            `- 렌즈: ${episode.lens}`,
            `- 장면 설명: ${episode.narrative}`,
            `- 잘되고 있는 모습: ${episode.successScene}`,
            `- 보통의 실제 모습: ${episode.ordinaryScene}`,
            `- 잘 안되는 모습: ${episode.challengeScene}`,
            `- 학생 학습 신호: ${episode.studentLearningSignal}`,
            `- 잠재 긴장: ${episode.possibleTension}`,
            ...episode.sampleArtifacts.map((artifact) => `- 산출물 예시(${artifact.title}): ${artifact.content}`),
            ...episode.teacherInterventions.map((item) => `- 교사 개입 추천(${item.title}): ${item.move}`),
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
      `- 활동별 위험 신호: ${turn.activityRiskSignals.join(" / ") || "없음"}`,
      ...turn.studentPersonaResponses.map((item) => `- ${item.personaName}: ${item.response} (${item.learningSignal})`),
      ...turn.sampleArtifacts.map((artifact) => `- 산출물(${artifact.title}): ${artifact.content}`),
      ...turn.teacherInterventions.map((item) => `- 개입 추천(${item.title}): ${item.move}`),
      `- 관찰 메모: ${turn.observerNote}`,
      "",
    ]),
    "## 탐지된 위험",
    "",
    ...(input.risks.length
      ? input.risks.flatMap((risk) => [
          `### ${riskLabels[risk.riskType]} (${risk.severity})`,
          `- 활동: ${risk.activityTitle || "-"}`,
          `- 초점: ${risk.focusArea}`,
          `- 근거: ${risk.rationale}`,
          `- 학생 영향: ${risk.studentImpact}`,
          `- 관찰 신호: ${risk.watchSignals.join(" / ")}`,
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
