import type { WorkspaceStorageBackend } from "@/types/workspace";
import {
  getLatestSimulationSessionFile,
  readWorkspaceSnapshotFile,
  saveCurrentDesignFile,
  saveSimulationSessionFile,
} from "@/lib/server/workspace-store-file";
import {
  getLatestSimulationSessionPostgres,
  readWorkspaceSnapshotPostgres,
  saveCurrentDesignPostgres,
  saveSimulationSessionPostgres,
} from "@/lib/server/workspace-store-postgres";

function usesPostgres() {
  return Boolean(process.env.DATABASE_URL);
}

export function getWorkspaceStorageBackend(): WorkspaceStorageBackend {
  return usesPostgres() ? "postgres" : "file";
}

export async function readWorkspaceSnapshot() {
  return usesPostgres()
    ? readWorkspaceSnapshotPostgres()
    : readWorkspaceSnapshotFile();
}

export async function saveCurrentDesign(
  design: Parameters<typeof saveCurrentDesignFile>[0],
  persistVersion = false,
) {
  return usesPostgres()
    ? saveCurrentDesignPostgres(design, persistVersion)
    : saveCurrentDesignFile(design, persistVersion);
}

export async function saveSimulationSession(
  session: Parameters<typeof saveSimulationSessionFile>[0],
) {
  return usesPostgres()
    ? saveSimulationSessionPostgres(session)
    : saveSimulationSessionFile(session);
}

export async function getLatestSimulationSession(lessonDesignId?: string) {
  return usesPostgres()
    ? getLatestSimulationSessionPostgres(lessonDesignId)
    : getLatestSimulationSessionFile(lessonDesignId);
}