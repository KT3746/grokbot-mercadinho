export const GAME_TITLE = "MERCADINHO";
/** Mesmo nome do jogo: é o que o jogador lê no menu, no HUD e na aba. */
export const SHOP_NAME = GAME_TITLE;
export const HUD_H_PORTRAIT = 148;
export const HUD_H_LANDSCAPE = 100;
export const SAVE_KEY = "mercadinho-v1";
export const TOUCH_VIEWPORT_MAX = 820;
export const START_LIVES = 4;
export const MAX_SLOTS = 4;
export const MAX_COMBO = 12;
export const COMBO_WINDOW = 3.8;
export const TURNO_SECS = 62;
export const BUILD_ID = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

export const layoutWidth = (): number => {
  if (typeof window === "undefined") return 1280;
  const vis = window.visualViewport?.width;
  return typeof vis === "number" && vis > 0 ? vis : window.innerWidth;
};

export const isPhoneViewport = (): boolean => layoutWidth() < TOUCH_VIEWPORT_MAX;

export const wantsTouchControls = (): boolean => {
  if (typeof window === "undefined") return false;
  let coarse = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    coarse = false;
  }
  const points = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
  return isPhoneViewport() || coarse || points > 0;
};

/** Acessibilidade: reduz shake/partículas/animações CSS. */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** Cap de partículas no canvas (mobile + reduced-motion cortam mais). */
export const PARTICLE_CAP = 48;

/** Copy/toasts: mouse + tela larga = "clique", mesmo se o aparelho também tiver toque. */
export const wantsTouchCopy = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(pointer: fine)").matches && layoutWidth() >= TOUCH_VIEWPORT_MAX) return false;
  } catch {
    /* ignore */
  }
  return isPhoneViewport() || wantsTouchControls();
};

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)]!;
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
