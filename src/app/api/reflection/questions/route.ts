import { reflectionQuestionsSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createReflectionQuestions } from "@/lib/orchestration";
import type { DetectedRisk, LessonDesign, ReflectionQuestion, SimulationTurn } from "@/types/lesson";
import { NextResponse } from "next/server";

function ensureQuestionCoverage(
  candidateQuestions: Omit<ReflectionQuestion, "id" | "simulationRunId">[],
  fallbackQuestions: ReflectionQuestion[],
  turns: SimulationTurn[],
  simulationRunId: string,
) {
  const normalized: ReflectionQuestion[] = candidateQuestions.map((question) => ({
    id: crypto.randomUUID(),
    simulationRunId,
    ...question,
  }));

  for (const turn of turns) {
    let count = normalized.filter((question) => question.linkedTurnIds.includes(turn.id)).length;
    if (count >= 2) {
      continue;
    }

    const fallbackForTurn = fallbackQuestions.filter((question) => question.linkedTurnIds.includes(turn.id));
    for (const fallbackQuestion of fallbackForTurn) {
      const exists = normalized.some(
        (question) =>
          question.prompt === fallbackQuestion.prompt &&
          question.linkedTurnIds.join("|") === fallbackQuestion.linkedTurnIds.join("|"),
      );

      if (!exists) {
        normalized.push({
          ...fallbackQuestion,
          id: crypto.randomUUID(),
          simulationRunId,
        });
        count += 1;
      }

      if (count >= 2) {
        break;
      }
    }
  }

  return normalized;
}

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
            "당신은 교사의 성찰 코치다. 실제 시뮬레이션 장면과 탐지된 위험에 연결된 구체적 성찰 질문을 생성하라. 각 활동마다 최소 2개의 질문이 필요하다. 하나는 교사의 질문과 학생 판단을, 다른 하나는 AI의 지원 범위와 인간의 최종 판단을 다루어야 한다.",
          payload: {
            design,
            turns,
            risks,
          },
        });

        if (response) {
          return NextResponse.json({
            questions: ensureQuestionCoverage(response.questions, fallback, turns, simulationRunId),
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