import {
  getLatestSimulationSession,
  getWorkspaceStorageBackend,
  readWorkspaceSnapshot,
} from "@/lib/server/workspace-store";
import {
  normalizeSimulationSessionRecord,
  normalizeWorkspaceSnapshot,
} from "@/lib/simulation-normalize";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rawSnapshot = await readWorkspaceSnapshot();
    const snapshot = normalizeWorkspaceSnapshot(rawSnapshot);
    const latestSession = await getLatestSimulationSession(snapshot.currentDesign?.id);

    return NextResponse.json({
      currentDesign: snapshot.currentDesign,
      designHistory: snapshot.designHistory,
      sessions: snapshot.sessions,
      latestSession: latestSession ? normalizeSimulationSessionRecord(latestSession) : null,
      updatedAt: snapshot.updatedAt,
      storageBackend: getWorkspaceStorageBackend(),
    });
  } catch (error) {
    console.error("workspace route error", error);
    return NextResponse.json(
      { error: "failed to read workspace" },
      { status: 500 },
    );
  }
}
