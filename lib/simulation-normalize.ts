import type {
  DetectedRisk,
  SimulationArtifactExample,
  SimulationScenario,
  SimulationTurn,
  StudentPersona,
  TeacherInterventionOption,
} from "@/types/lesson";
import type { SimulationReportSnapshot } from "@/types/report";
import type { SimulationSessionRecord, StoredSimulationState, WorkspaceSnapshot } from "@/types/workspace";

function normalizePersona(input: Partial<StudentPersona>): StudentPersona {
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name ?? "학생",
    label: input.label ?? "기본 페르소나",
    profile: input.profile ?? "학생의 기본 반응을 관찰합니다.",
    strength: input.strength ?? "활동에 참여할 수 있습니다.",
    watchPoint: input.watchPoint ?? "학습 신호를 더 구체적으로 볼 필요가 있습니다.",
    aiTendency: input.aiTendency ?? "AI 활용 경향 정보 없음",
    supportNeed: input.supportNeed ?? "추가 지원 정보 없음",
    likelyUtterance: input.likelyUtterance ?? "생각을 더 말해 볼게요.",
  };
}

function normalizeArtifact(input: Partial<SimulationArtifactExample>): SimulationArtifactExample {
  return {
    id: input.id ?? crypto.randomUUID(),
    type: input.type ?? "student_note",
    title: input.title ?? "학생 산출물",
    studentPersonaId: input.studentPersonaId ?? null,
    content: input.content ?? "산출물 내용 없음",
    quality: input.quality ?? "mixed",
    insight: input.insight ?? "추가 해석 없음",
  };
}

function normalizeIntervention(input: Partial<TeacherInterventionOption>): TeacherInterventionOption {
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title ?? "교사 개입",
    timing: input.timing ?? "활동 중",
    move: input.move ?? "학생의 판단 근거를 다시 묻습니다.",
    expectedImpact: input.expectedImpact ?? "학습 신호를 더 분명하게 볼 수 있습니다.",
    linkedCardIds: input.linkedCardIds ?? [],
  };
}

export function normalizeScenario(scenario: SimulationScenario | null): SimulationScenario | null {
  if (!scenario) {
    return null;
  }

  const personas = (scenario.studentPersonas ?? []).map((persona) => normalizePersona(persona));

  return {
    ...scenario,
    studentPersonas: personas,
    episodes: (scenario.episodes ?? []).map((episode) => ({
      ...episode,
      successScene: episode.successScene ?? "설계를 따라갈 때 드러나는 긍정 장면이 제시됩니다.",
      ordinaryScene:
        (episode as SimulationScenario["episodes"][number] & { ordinaryScene?: string }).ordinaryScene ??
        episode.narrative ??
        episode.challengeScene ??
        episode.successScene ??
        "실제 교실에서 흔히 나타나는 평균적 장면이 제시됩니다.",
      challengeScene: episode.challengeScene ?? "같은 설계 안에서도 흔들릴 수 있는 장면이 제시됩니다.",
      humanAgencyFocus: episode.humanAgencyFocus ?? "교사의 판단 구조를 다시 봅니다.",
      aiAgencyFocus: episode.aiAgencyFocus ?? "AI의 역할을 제한적으로 봅니다.",
      studentLearningSignal: episode.studentLearningSignal ?? "학생 학습 신호를 추가로 관찰합니다.",
      possibleTension: episode.possibleTension ?? "잠재 긴장을 추가로 확인합니다.",
      relatedActivityId: episode.relatedActivityId ?? null,
      linkedCardIds: episode.linkedCardIds ?? [],
      featuredPersonaIds: (episode as SimulationScenario["episodes"][number] & { featuredPersonaIds?: string[] }).featuredPersonaIds ?? personas.slice(0, 2).map((persona) => persona.id),
      sampleArtifacts: ((episode as SimulationScenario["episodes"][number] & { sampleArtifacts?: SimulationArtifactExample[] }).sampleArtifacts ?? []).map((artifact) => normalizeArtifact(artifact)),
      teacherInterventions: ((episode as SimulationScenario["episodes"][number] & { teacherInterventions?: TeacherInterventionOption[] }).teacherInterventions ?? []).map((item) => normalizeIntervention(item)),
      cardOutcomeLinks: (episode as SimulationScenario["episodes"][number] & { cardOutcomeLinks?: SimulationScenario["episodes"][number]["cardOutcomeLinks"] }).cardOutcomeLinks ?? [],
    })),
  };
}

export function normalizeTurn(turn: SimulationTurn): SimulationTurn {
  return {
    ...turn,
    scenarioEpisodeId: turn.scenarioEpisodeId ?? null,
    evidenceObserved: turn.evidenceObserved ?? [],
    missedOpportunities: turn.missedOpportunities ?? [],
    linkedCardIds: turn.linkedCardIds ?? [],
    studentPersonaResponses: turn.studentPersonaResponses ?? [],
    sampleArtifacts: (turn.sampleArtifacts ?? []).map((artifact) => normalizeArtifact(artifact)),
    teacherInterventions: (turn.teacherInterventions ?? []).map((item) => normalizeIntervention(item)),
    cardOutcomeLinks: turn.cardOutcomeLinks ?? [],
    activityRiskSignals: turn.activityRiskSignals ?? [],
  };
}

export function normalizeRisk(risk: DetectedRisk): DetectedRisk {
  return {
    ...risk,
    relatedCardIds: risk.relatedCardIds ?? [],
    evidenceTurnIds: risk.evidenceTurnIds ?? [],
    activityId: risk.activityId ?? null,
    activityTitle: risk.activityTitle ?? null,
    scenarioEpisodeId: risk.scenarioEpisodeId ?? null,
    focusArea: risk.focusArea ?? "수업 운영",
    studentImpact: risk.studentImpact ?? "학생 학습에 미치는 영향을 추가로 확인합니다.",
    watchSignals: risk.watchSignals ?? [],
  };
}

export function normalizeStoredSimulationState(state: StoredSimulationState | null): StoredSimulationState | null {
  if (!state) {
    return null;
  }

  return {
    ...state,
    scenario: normalizeScenario(state.scenario),
    turns: (state.turns ?? []).map((turn) => normalizeTurn(turn)),
    risks: (state.risks ?? []).map((risk) => normalizeRisk(risk)),
    questions: state.questions ?? [],
    journal: state.journal ?? null,
  };
}

export function normalizeSimulationSessionRecord(session: SimulationSessionRecord): SimulationSessionRecord {
  return {
    ...session,
    scenario: normalizeScenario(session.scenario),
    turns: (session.turns ?? []).map((turn) => normalizeTurn(turn)),
    risks: (session.risks ?? []).map((risk) => normalizeRisk(risk)),
    questions: session.questions ?? [],
    journal: session.journal ?? null,
  };
}

export function normalizeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...snapshot,
    sessions: (snapshot.sessions ?? []).map((session) => normalizeSimulationSessionRecord(session)),
  };
}

export function normalizeReportSnapshot(report: SimulationReportSnapshot | null): SimulationReportSnapshot | null {
  if (!report) {
    return null;
  }

  return {
    ...report,
    scenario: normalizeScenario(report.scenario),
    turns: (report.turns ?? []).map((turn) => normalizeTurn(turn)),
    risks: (report.risks ?? []).map((risk) => normalizeRisk(risk)),
    questions: report.questions ?? [],
    answers: report.answers ?? {},
    nextRevisionNotes: report.nextRevisionNotes ?? [],
  };
}
