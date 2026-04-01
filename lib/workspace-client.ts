import type { LessonDesign } from "@/types/lesson";
import type {
  SimulationSessionRecord,
  WorkspaceSnapshot,
  WorkspaceStorageBackend,
} from "@/types/workspace";

export async function fetchWorkspaceSnapshot() {
  const response = await fetch("/api/workspace", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("서버 저장소를 불러오지 못했습니다.");
  }

  return (await response.json()) as WorkspaceSnapshot & {
    latestSession: SimulationSessionRecord | null;
    storageBackend: WorkspaceStorageBackend;
  };
}

export async function saveDesignToWorkspace(input: {
  design: LessonDesign;
  persistVersion?: boolean;
}) {
  const response = await fetch("/api/workspace/design", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("설계안을 서버에 저장하지 못했습니다.");
  }

  return (await response.json()) as {
    currentDesign: LessonDesign;
    designHistory: LessonDesign[];
    updatedAt: string;
    storageBackend: WorkspaceStorageBackend;
  };
}

export async function saveSimulationSessionToWorkspace(session: SimulationSessionRecord) {
  const response = await fetch("/api/workspace/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session }),
  });

  if (!response.ok) {
    throw new Error("시뮬레이션 세션을 서버에 저장하지 못했습니다.");
  }

  return (await response.json()) as {
    session: SimulationSessionRecord;
    sessions: SimulationSessionRecord[];
    updatedAt: string;
    storageBackend: WorkspaceStorageBackend;
  };
}