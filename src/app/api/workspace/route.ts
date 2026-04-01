import {
  getLatestSimulationSession,
  getWorkspaceStorageBackend,
  readWorkspaceSnapshot,
} from "@/lib/server/workspace-store";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const snapshot = await readWorkspaceSnapshot();
    const latestSession = await getLatestSimulationSession(snapshot.currentDesign?.id);

    return NextResponse.json({
      currentDesign: snapshot.currentDesign,
      designHistory: snapshot.designHistory,
      sessions: snapshot.sessions,
      latestSession,
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