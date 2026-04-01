import { reflectionQuestionsSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createReflectionQuestions } from "@/lib/orchestration";
import type { DetectedRisk, LessonDesign, SimulationTurn } from "@/types/lesson";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      design?: LessonDesign;
      turns?: SimulationTurn[];
      risks?: DetectedRisk[];
      simulationRunId?: string;
    };

    const design = payload.design;
    const turns = payload.turns ?? [];
    const risks = payload.risks ?? [];
    const simulationRunId = payload.simulationRunId ?? crypto.randomUUID();

    if (!design) {
      return NextResponse.json({ error: "design is required" }, { status: 400 });
    }

    const fallback = createReflectionQuestions(design, turns, risks).map((question) => ({
      ...question,
      simulationRunId,
    }));

    if (hasOpenAIKey()) {
      try {
        const response = await parseStructuredResponse({
          schema: reflectionQuestionsSchema,
          schemaName: "reflection_questions",
          model: process.env.OPENAI_MODEL_FAST ?? "gpt-5.4-mini",
          system:
            "당신은 교사의 성찰 코치다. 실제 시뮬레이션 장면과 탐지된 위험에 연결된 구체적 성찰 질문을 생성하라. 일반론이 아니라 특정 턴, 특정 판단 문제, 특정 카드 배치의 수정 방향을 묻는 질문이어야 한다.",
          payload: {
            design,
            turns,
            risks,
          },
        });

        if (response) {
          return NextResponse.json({
            questions: response.questions.map((question) => ({
              id: crypto.randomUUID(),
              simulationRunId,
              ...question,
            })),
          });
        }
      } catch (error) {
        console.error("reflection question fallback", error);
      }
    }

    return NextResponse.json({ questions: fallback });
  } catch (error) {
    console.error("reflection route error", error);
    return NextResponse.json(
      { error: "failed to generate reflection questions" },
      { status: 500 },
    );
  }
}
