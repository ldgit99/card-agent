import type { LessonDesign } from "@/types/lesson";
import type {
  SimulationSessionRecord,
  WorkspaceSnapshot,
} from "@/types/workspace";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const configuredWorkspaceFile =
  process.env.WORKSPACE_STORAGE_FILE ?? "storage/workspace.json";
const WORKSPACE_FILE = path.isAbsolute(configuredWorkspaceFile)
  ? configuredWorkspaceFile
  : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredWorkspaceFile);
const DATA_DIR = path.dirname(WORKSPACE_FILE);
const TEMP_FILE = `${WORKSPACE_FILE}.tmp`;

function createEmptyWorkspace(): WorkspaceSnapshot {
  return {
    currentDesign: null,
    designHistory: [],
    sessions: [],
    updatedAt: new Date().toISOString(),
  };
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function writeWorkspace(snapshot: WorkspaceSnapshot) {
  await ensureDataDir();
  const content = JSON.stringify(snapshot, null, 2);
  await writeFile(TEMP_FILE, content, "utf8");
  await rename(TEMP_FILE, WORKSPACE_FILE);
}

function sortDesignHistory(items: LessonDesign[]) {
  return [...items].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function sortSessions(items: SimulationSessionRecord[]) {
  return [...items].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export async function readWorkspaceSnapshotFile(): Promise<WorkspaceSnapshot> {
  await ensureDataDir();

  try {
    const raw = await readFile(WORKSPACE_FILE, "utf8");
    return JSON.parse(raw) as WorkspaceSnapshot;
  } catch {
    const empty = createEmptyWorkspace();
    await writeWorkspace(empty);
    return empty;
  }
}

export async function saveCurrentDesignFile(
  design: LessonDesign,
  persistVersion = false,
): Promise<WorkspaceSnapshot> {
  const snapshot = await readWorkspaceSnapshotFile();
  const nextDesignHistory = [...snapshot.designHistory];

  if (persistVersion) {
    const existingIndex = nextDesignHistory.findIndex(
      (item) => item.id === design.id && item.version === design.version,
    );

    if (existingIndex >= 0) {
      nextDesignHistory[existingIndex] = design;
    } else {
      nextDesignHistory.push(design);
    }
  }

  const nextSnapshot: WorkspaceSnapshot = {
    ...snapshot,
    currentDesign: design,
    designHistory: sortDesignHistory(nextDesignHistory),
    updatedAt: new Date().toISOString(),
  };

  await writeWorkspace(nextSnapshot);
  return nextSnapshot;
}

export async function saveSimulationSessionFile(
  session: SimulationSessionRecord,
): Promise<WorkspaceSnapshot> {
  const snapshot = await readWorkspaceSnapshotFile();
  const nextSessions = [...snapshot.sessions];
  const existingIndex = nextSessions.findIndex((item) => item.id === session.id);

  if (existingIndex >= 0) {
    nextSessions[existingIndex] = session;
  } else {
    nextSessions.push(session);
  }

  const nextSnapshot: WorkspaceSnapshot = {
    ...snapshot,
    sessions: sortSessions(nextSessions),
    updatedAt: new Date().toISOString(),
  };

  await writeWorkspace(nextSnapshot);
  return nextSnapshot;
}

export async function getLatestSimulationSessionFile(lessonDesignId?: string) {
  const snapshot = await readWorkspaceSnapshotFile();
  const sessions = lessonDesignId
    ? snapshot.sessions.filter((item) => item.lessonDesignId === lessonDesignId)
    : snapshot.sessions;

  return sortSessions(sessions)[0] ?? null;
}