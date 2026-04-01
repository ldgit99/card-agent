import { designAnalysisSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createHeuristicAnalysis } from "@/lib/orchestration";
import type { LessonDesign } from "@/types/lesson";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { design?: LessonDesign };
    const design = payload.design;

    if (!design) {
      return NextResponse.json({ error: "design is required" }, { status: 400 });
    }

    const fallback = {
      ...createHeuristicAnalysis(design),
      engine: "heuristic" as const,
    };

    if (hasOpenAIKey()) {
      try {
        const analysis = await parseStructuredResponse({
          schema: designAnalysisSchema,
          schemaName: "lesson_design_analysis",
          model: process.env.OPENAI_MODEL_DEEP ?? "gpt-5.4",
          system:
            "당신은 교사의 수업 설계를 검토하는 교육학 전문가다. 인간-AI agency, 깊이 있는 학습, 책임성, 비판적 AI 활용을 중심으로 강점, 결손, 권장 수정을 구조화해라.",
          payload: {
            design,
            requiredFocus: [
              "human-ai agency",
              "deep learning",
              "grounded judgment",
              "teacher final decision",
              "accountability",
            ],
          },
        });

        if (analysis) {
          return NextResponse.json({
            analysis: {
              ...analysis,
              engine: "openai" as const,
            },
          });
        }
      } catch (error) {
        console.error("design analyze fallback", error);
      }
    }

    return NextResponse.json({ analysis: fallback });
  } catch (error) {
    console.error("design analyze route error", error);
    return NextResponse.json(
      { error: "failed to analyze design" },
      { status: 500 },
    );
  }
}
