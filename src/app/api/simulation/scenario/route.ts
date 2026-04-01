import { simulationScenarioSchema } from "@/lib/ai/schemas";
import { hasOpenAIKey, parseStructuredResponse } from "@/lib/ai/openai";
import { createHeuristicScenario } from "@/lib/orchestration";
import type { DesignAnalysis, LessonDesign, SimulationScenario } from "@/types/lesson";
import { NextResponse } from "next/server";

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
            "You are designing a Korean mock lesson scenario for teachers. Follow the given lesson design closely. For each episode, show both a successful scene and a struggling scene that could emerge from the same design. Keep the activity and card placements intact, and write every field in Korean. Make the contrast useful for observing human-AI agency, depth of learning, and responsibility.",
          payload: {
            design,
            analysis,
          },
        });

        if (response) {
          return NextResponse.json({
            scenario: {
              id: crypto.randomUUID(),
              simulationRunId,
              title: response.title,
              setting: response.setting,
              learningArc: response.learningArc,
              facilitatorBrief: response.facilitatorBrief,
              episodes: response.episodes.map((episode) => ({
                id: crypto.randomUUID(),
                ...episode,
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