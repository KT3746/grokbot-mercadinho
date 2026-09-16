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
  unlockedCosmetics: ["sign-classic", "shelf-verde", "badge-padrao"],
  equipped: { sign: "sign-classic", shelf: "shelf-verde", badge: "badge-padrao" },
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
    const equippedRaw = parsed.equipped && typeof parsed.equipped === "object" ? parsed.equipped as Partial<SaveData["equipped"]> : {};
    const unlocked = Array.isArray(parsed.unlockedCosmetics)
      ? parsed.unlockedCosmetics.filter((x): x is string => typeof x === "string").slice(0, 64)
      : ["sign-classic", "shelf-verde", "badge-padrao"];
    const starters = ["sign-classic", "shelf-verde", "badge-padrao"];
    const unlockedMerged = [...new Set([...starters, ...(unlocked.length ? unlocked : [])])].slice(0, 64);
    const best = typeof parsed.best === "number" && Number.isFinite(parsed.best) ? Math.max(0, parsed.best) : 0;
    const bestTurno =
      typeof parsed.bestTurno === "number" && Number.isFinite(parsed.bestTurno)
        ? Math.max(1, Math.floor(parsed.bestTurno))
        : 1;
    const plays =
      typeof parsed.plays === "number" && Number.isFinite(parsed.plays) ? Math.max(0, Math.floor(parsed.plays)) : 0;
    const bestStars =
      typeof parsed.bestStars === "number" && Number.isFinite(parsed.bestStars)
        ? Math.max(0, Math.floor(parsed.bestStars))
        : 0;
    const totalStars =
      typeof parsed.totalStars === "number" && Number.isFinite(parsed.totalStars)
        ? Math.max(0, Math.floor(parsed.totalStars))
        : 0;
    return {
      best,
      bestTurno,
      muted: parsed.muted === true,
      seenHow: parsed.seenHow === true,
      plays,
      bestStars,
      totalStars,
      history: sanitizeHistory(parsed.history),
      unlockedCosmetics: unlockedMerged,
      equipped: {
        sign: typeof equippedRaw.sign === "string" ? equippedRaw.sign : "sign-classic",
        shelf: typeof equippedRaw.shelf === "string" ? equippedRaw.shelf : "shelf-verde",
        badge: typeof equippedRaw.badge === "string" ? equippedRaw.badge : "badge-padrao",
      },
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
