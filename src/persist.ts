import { SAVE_KEY } from "./config";
import type { SaveData } from "./types";

const empty = (): SaveData => ({
  best: 0,
  bestTurno: 1,
  muted: false,
  seenHow: false,
  plays: 0,
  bestStars: 0,
  totalStars: 0,
});

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
