import { simulationTurnSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createHeuristicTurn } from "@/lib/orchestration";
import type { LessonActivity, LessonDesign, SimulationTurn } from "@/types/lesson";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      design?: LessonDesign;
      activity?: LessonActivity;
      previousTurns?: SimulationTurn[];
      simulationRunId?: string;
    };

    const design = payload.design;
    const activity = payload.activity;
    const previousTurns = payload.previousTurns ?? [];
    const simulationRunId = payload.simulationRunId ?? crypto.randomUUID();

    if (!design || !activity) {
      return NextResponse.json(
        { error: "design and activity are required" },
        { status: 400 },
      );
    }

    const fallback = {
      ...createHeuristicTurn(design, activity, previousTurns),
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
            "당신은 교사의 모의수업 시뮬레이션 코치다. 주어진 활동과 카드 배치를 바탕으로 교사 행동, AI 행동, 학생 반응, 증거, 놓친 기회를 구체적으로 생성하라. 인간의 최종 판단과 깊이 있는 학습 여부를 계속 추적하라.",
          payload: {
            designMeta: design.meta,
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
    return NextResponse.json(
      { error: "failed to simulate lesson turn" },
      { status: 500 },
    );
  }
}
