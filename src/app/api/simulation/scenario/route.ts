import { simulationScenarioSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createHeuristicScenario } from "@/lib/orchestration";
import type { DesignAnalysis, LessonDesign, SimulationScenario } from "@/types/lesson";
import { NextResponse } from "next/server";

function buildOpenAIPersonaIds(personas: Array<{ name: string; label: string }>) {
  return personas.map((persona, index) => ({
    id: `persona-${index + 1}`,
    name: persona.name,
    label: persona.label,
  }));
}

function resolvePersonaId(
  personas: Array<{ id: string; name: string; label: string }>,
  rawPersonaId: string,
) {
  const match = personas.find((persona) => {
    return persona.id === rawPersonaId || persona.name === rawPersonaId || persona.label === rawPersonaId;
  });

  return match?.id ?? personas[0]?.id ?? rawPersonaId;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      design?: LessonDesign;
      analysis?: DesignAnalysis | null;
      simulationRunId?: string;
    };

    const design = payload.design;
    const analysis = payload.analysis ?? null;
    const simulationRunId = payload.simulationRunId ?? crypto.randomUUID();

    if (!design) {
      return NextResponse.json({ error: "design is required" }, { status: 400 });
    }

    const fallbackDraft = createHeuristicScenario(design, simulationRunId);
    const fallback: SimulationScenario = {
      id: crypto.randomUUID(),
      simulationRunId,
      title: fallbackDraft.title,
      setting: fallbackDraft.setting,
      learningArc: fallbackDraft.learningArc,
      facilitatorBrief: fallbackDraft.facilitatorBrief,
      studentPersonas: fallbackDraft.studentPersonas,
      episodes: fallbackDraft.episodes,
      engine: "heuristic",
    };

    if (hasOpenAIKey()) {
      try {
        const response = await parseStructuredResponse({
          schema: simulationScenarioSchema,
          schemaName: "simulation_scenario",
          model: process.env.OPENAI_MODEL_DEEP ?? "gpt-5.4",
          system:
            "당신은 교사를 위한 한국어 모의수업 시나리오 설계자다. 주어진 수업설계를 엄격히 따르되, 각 활동마다 학생 페르소나가 어떻게 반응하는지 보여줘라. 모든 episode에는 잘되고 있는 모습, 보통의 실제 모습, 잘 안되는 모습을 모두 포함하고, 학생 산출물 예시, 교사 개입 추천, 교사와 AI가 어떤 질문을 던지고 어떤 행동을 하며 어떤 결과를 만드는지까지 명시하라. 출력의 모든 필드는 한국어로 작성하라.",
          payload: {
            design,
            analysis,
          },
        });

        if (response) {
          const personas = buildOpenAIPersonaIds(response.studentPersonas);

          return NextResponse.json({
            scenario: {
              id: crypto.randomUUID(),
              simulationRunId,
              title: response.title,
              setting: response.setting,
              learningArc: response.learningArc,
              facilitatorBrief: response.facilitatorBrief,
              studentPersonas: response.studentPersonas.map((persona, index) => ({
                id: personas[index].id,
                ...persona,
              })),
              episodes: response.episodes.map((episode) => ({
                id: crypto.randomUUID(),
                ...episode,
                featuredPersonaIds: episode.featuredPersonaIds.map((item) => resolvePersonaId(personas, item)),
                sampleArtifacts: episode.sampleArtifacts.map((artifact) => ({
                  id: crypto.randomUUID(),
                  ...artifact,
                  studentPersonaId: artifact.studentPersonaId
                    ? resolvePersonaId(personas, artifact.studentPersonaId)
                    : null,
                })),
                teacherInterventions: episode.teacherInterventions.map((item) => ({
                  id: crypto.randomUUID(),
                  ...item,
                })),
              })),
              engine: "openai" as const,
            } satisfies SimulationScenario,
          });
        }
      } catch (error) {
        console.error("simulation scenario fallback", error);
      }
    }

    return NextResponse.json({ scenario: fallback });
  } catch (error) {
    console.error("simulation scenario route error", error);
    return NextResponse.json({ error: "failed to create simulation scenario" }, { status: 500 });
  }
}


