/** Detecção mobile-first: corta sombra, DPR e geometria em aparelho fraco. */

export type FxProfile = {
  lowFx: boolean;
  mobile: boolean;
  reduceMotion: boolean;
  dprCap: number;
  antialias: boolean;
  shadows: boolean;
};

export function detectFx(): FxProfile {
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  const mobileUA = /android|iphone|ipad|ipod|mobile|opera mini|iemobile/.test(ua);
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  let coarse = false;
  let reduceMotion = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    /* ignore */
  }
  const mobile = mobileUA || w <= 700 || (coarse && w <= 900);
  const lowFx = reduceMotion || mobile || dpr >= 2.5;
  return {
    lowFx,
    mobile,
    reduceMotion,
    dprCap: lowFx ? 1.15 : mobile ? 1.25 : 1.5,
    antialias: !lowFx && !mobile,
    shadows: false,
  };
}

export function probeWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export function hexColor(c: string): number {
  const m = /^#?([0-9a-f]{6})/i.exec(c.trim());
  return m ? Number.parseInt(m[1]!, 16) : 0x888888;
}
