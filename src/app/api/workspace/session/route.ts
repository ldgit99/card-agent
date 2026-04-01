import {
  getWorkspaceStorageBackend,
  saveSimulationSession,
} from "@/lib/server/workspace-store";
import type { SimulationSessionRecord } from "@/types/workspace";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      session?: SimulationSessionRecord;
    };

    if (!payload.session) {
      return NextResponse.json({ error: "session is required" }, { status: 400 });
    }

    const snapshot = await saveSimulationSession(payload.session);

    return NextResponse.json({
      session: payload.session,
      sessions: snapshot.sessions,
      updatedAt: snapshot.updatedAt,
      storageBackend: getWorkspaceStorageBackend(),
    });
  } catch (error) {
    console.error("save session route error", error);
    return NextResponse.json(
      { error: "failed to save simulation session" },
      { status: 500 },
    );
  }
}