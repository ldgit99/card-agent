import { STORAGE_KEYS } from "@/lib/constants";
import {
  normalizeReportSnapshot,
  normalizeStoredSimulationState,
} from "@/lib/simulation-normalize";
import type { LessonDesign } from "@/types/lesson";
import type { SimulationReportSnapshot } from "@/types/report";
import type { StoredSimulationState } from "@/types/workspace";

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function sortDesignHistory(items: LessonDesign[]) {
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function dedupeDesignHistory(items: LessonDesign[]) {
  const byVersion = new Map<string, LessonDesign>();

  for (const item of items) {
    byVersion.set(`${item.id}:${item.version}`, item);
  }

  return sortDesignHistory([...byVersion.values()]);
}

export function loadStoredDesign(): LessonDesign | null {
  return readJSON<LessonDesign>(STORAGE_KEYS.design);
}

export function saveStoredDesign(value: LessonDesign) {
  writeJSON(STORAGE_KEYS.design, value);
}

export function loadStoredDesignHistory(): LessonDesign[] {
  return dedupeDesignHistory(readJSON<LessonDesign[]>(STORAGE_KEYS.designHistory) ?? []);
}

export function saveStoredDesignHistory(values: LessonDesign[]) {
  const nextHistory = dedupeDesignHistory(values);
  writeJSON(STORAGE_KEYS.designHistory, nextHistory);
  return nextHistory;
}

export function saveStoredDesignVersion(value: LessonDesign) {
  const nextHistory = dedupeDesignHistory([value, ...loadStoredDesignHistory()]);
  writeJSON(STORAGE_KEYS.designHistory, nextHistory);
  return nextHistory;
}

export function loadStoredSimulation(): StoredSimulationState | null {
  return normalizeStoredSimulationState(readJSON<StoredSimulationState>(STORAGE_KEYS.simulation));
}

export function saveStoredSimulation(value: StoredSimulationState) {
  writeJSON(STORAGE_KEYS.simulation, value);
}

export function loadStoredReport(): SimulationReportSnapshot | null {
  return normalizeReportSnapshot(readJSON<SimulationReportSnapshot>(STORAGE_KEYS.report));
}

export function saveStoredReport(value: SimulationReportSnapshot) {
  writeJSON(STORAGE_KEYS.report, value);
}