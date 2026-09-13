import { SAVE_KEY } from "./config";
import type { RunRecord, SaveData } from "./types";

const empty = (): SaveData => ({
  best: 0,
  bestTurno: 1,
  muted: false,
  seenHow: false,
  plays: 0,
  bestStars: 0,
  totalStars: 0,
  history: [],
});

function sanitizeHistory(raw: unknown): RunRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: RunRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<RunRecord>;
    if (typeof r.score !== "number" || typeof r.turno !== "number") continue;
    out.push({
      score: Math.max(0, Math.floor(r.score)),
      turno: Math.max(1, Math.floor(r.turno)),
      stars: typeof r.stars === "number" ? Math.max(0, Math.floor(r.stars)) : 0,
      at: typeof r.at === "number" ? r.at : undefined,
    });
    if (out.length >= 5) break;
  }
  return out;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      best: typeof parsed.best === "number" ? parsed.best : 0,
      bestTurno: typeof parsed.bestTurno === "number" ? parsed.bestTurno : 1,
      muted: parsed.muted === true,
      seenHow: parsed.seenHow === true,
      plays: typeof parsed.plays === "number" ? parsed.plays : 0,
      bestStars: typeof parsed.bestStars === "number" ? parsed.bestStars : 0,
      totalStars: typeof parsed.totalStars === "number" ? parsed.totalStars : 0,
      history: sanitizeHistory(parsed.history),
    };
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

/** Empilha o expediente no diário (máx. 5, mais recente primeiro). */
export function pushRunHistory(
  data: SaveData,
  entry: { score: number; turno: number; stars: number; at?: number },
): SaveData {
  const next: RunRecord = {
    score: Math.max(0, Math.floor(entry.score)),
    turno: Math.max(1, Math.floor(entry.turno)),
    stars: Math.max(0, Math.floor(entry.stars)),
    at: entry.at ?? Date.now(),
  };
  data.history = [next, ...(data.history || [])].slice(0, 5);
  return data;
}
