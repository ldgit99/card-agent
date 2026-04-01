import { risksResponseSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { detectHeuristicRisks } from "@/lib/orchestration";
import type { LessonDesign, SimulationTurn } from "@/types/lesson";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      design?: LessonDesign;
      turns?: SimulationTurn[];
    };

    const design = payload.design;
    const turns = payload.turns ?? [];

    if (!design) {
      return NextResponse.json({ error: "design is required" }, { status: 400 });
    }

    const fallback = detectHeuristicRisks(design, turns);

    if (hasOpenAIKey()) {
      try {
        const response = await parseStructuredResponse({
          schema: risksResponseSchema,
          schemaName: "simulation_risks",
          model: process.env.OPENAI_MODEL_DEEP ?? "gpt-5.4",
          system:
            "당신은 교사의 수업 시뮬레이션 관찰자다. 활동별로 AI 과의존, 깊이 있는 학습 부족, 근거 없는 판단, 책임 주체 불명확, 교사의 최종 판단 부재, 심리적 안전 저해, 카드-행동 불일치, 참여 편중, 평가 불일치를 탐지하라. 각 위험에는 활동명, 초점 영역, 학생에게 미치는 영향, 관찰 신호, 즉시 가능한 교사 개입을 포함하라.",
          payload: {
            design,
            turns,
          },
        });

        if (response) {
          return NextResponse.json({
            risks: response.risks.map((risk) => ({
              id: crypto.randomUUID(),
              ...risk,
            })),
          });
        }
      } catch (error) {
        console.error("risk detection fallback", error);
      }
    }

    return NextResponse.json({ risks: fallback });
  } catch (error) {
    console.error("risk route error", error);
    return NextResponse.json({ error: "failed to detect risks" }, { status: 500 });
  }
}
