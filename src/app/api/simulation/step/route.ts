import { simulationTurnSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createHeuristicTurn } from "@/lib/orchestration";
import type { LessonActivity, LessonDesign, SimulationScenario, SimulationTurn } from "@/types/lesson";
import { NextResponse } from "next/server";

function resolvePersonaId(
  scenario: SimulationScenario | null,
  rawPersonaId: string,
) {
  if (!scenario) {
    return rawPersonaId;
  }

  const match = scenario.studentPersonas.find((persona) => {
    return persona.id === rawPersonaId || persona.name === rawPersonaId || persona.label === rawPersonaId;
  });

  return match?.id ?? rawPersonaId;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      design?: LessonDesign;
      activity?: LessonActivity;
      scenario?: SimulationScenario | null;
      previousTurns?: SimulationTurn[];
      simulationRunId?: string;
    };

    const design = payload.design;
    const activity = payload.activity;
    const scenario = payload.scenario ?? null;
    const previousTurns = payload.previousTurns ?? [];
    const simulationRunId = payload.simulationRunId ?? crypto.randomUUID();

    if (!design || !activity) {
      return NextResponse.json({ error: "design and activity are required" }, { status: 400 });
    }

    const fallback = {
      ...createHeuristicTurn(design, activity, previousTurns, scenario),
      id: crypto.randomUUID(),
      simulationRunId,
      engine: "heuristic" as const,
    };

    if (hasOpenAIKey()) {
      try {
        const turn = await parseStructuredResponse({
          schema: simulationTurnSchema,
          schemaName: "simulation_turn",
          model: process.env.OPENAI_MODEL_FAST ?? "gpt-5.4-mini",
          system:
            "당신은 교사를 위한 한국어 모의수업 코치다. 주어진 활동, 카드 배치, 시나리오 episode를 바탕으로 교사 행동, AI 행동, 학생 페르소나 반응, 학생 산출물 예시, 활동별 위험 신호, 교사 개입 추천을 구체적으로 생성하라. 모든 출력은 한국어로 작성하고, 카드 배치가 실제 결과에 어떤 영향을 주는지 드러내라.",
          payload: {
            designMeta: design.meta,
            scenario,
            activity,
            previousTurns,
          },
        });

        if (turn) {
          return NextResponse.json({
            turn: {
              ...turn,
              id: crypto.randomUUID(),
              simulationRunId,
              studentPersonaResponses: turn.studentPersonaResponses.map((item) => ({
                ...item,
                personaId: resolvePersonaId(scenario, item.personaId),
              })),
              sampleArtifacts: turn.sampleArtifacts.map((artifact) => ({
                id: crypto.randomUUID(),
                ...artifact,
                studentPersonaId: artifact.studentPersonaId ? resolvePersonaId(scenario, artifact.studentPersonaId) : null,
              })),
              teacherInterventions: turn.teacherInterventions.map((item) => ({
                id: crypto.randomUUID(),
                ...item,
              })),
              engine: "openai" as const,
            },
          });
        }
      } catch (error) {
        console.error("simulation step fallback", error);
      }
    }

    return NextResponse.json({ turn: fallback });
  } catch (error) {
    console.error("simulation step route error", error);
    return NextResponse.json({ error: "failed to simulate lesson turn" }, { status: 500 });
  }
}
