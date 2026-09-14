import type { SaveData } from "../types";

export type CosmeticSlot = "sign" | "shelf" | "badge";

export type CosmeticItem = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  blurb: string;
  /** Accent / preview swatch */
  swatch: string;
  /** Always unlocked if omit unlock check */
  unlock?: (s: SaveData) => boolean;
  hint?: string;
};

/** Placa / letreiro da loja (menu + parede). */
export const SIGNS: readonly CosmeticItem[] = [
  {
    id: "sign-classic",
    slot: "sign",
    name: "Placa clássica",
    blurb: "Letreiro de sempre.",
    swatch: "#e3b23c",
  },
  {
    id: "sign-neon",
    slot: "sign",
    name: "Neon da esquina",
    blurb: "Brilho de madrugada.",
    swatch: "#7dff9a",
    unlock: (s) => s.best >= 500,
    hint: "Recorde 500+",
  },
  {
    id: "sign-madeira",
    slot: "sign",
    name: "Madeira de feira",
    blurb: "Tábua com carinho.",
    swatch: "#c68642",
    unlock: (s) => s.plays >= 3,
    hint: "3 expedientes",
  },
  {
    id: "sign-azulejo",
    slot: "sign",
    name: "Azulejo carioca",
    blurb: "Azul e branco na fachada.",
    swatch: "#4d8fbf",
    unlock: (s) => s.best >= 1200,
    hint: "Recorde 1200+",
  },
];

/** Cor de destaque da prateleira. */
export const SHELVES: readonly CosmeticItem[] = [
  {
    id: "shelf-verde",
    slot: "shelf",
    name: "Verde mercadinho",
    blurb: "O verde da esquina.",
    swatch: "#3d8f4a",
  },
  {
    id: "shelf-cobre",
    slot: "shelf",
    name: "Cobre quente",
    blurb: "Toque de metal velho.",
    swatch: "#c68642",
    unlock: (s) => (s.bestStars || 0) >= 3,
    hint: "3★ num expediente",
  },
  {
    id: "shelf-azul",
    slot: "shelf",
    name: "Azul geladeira",
    blurb: "Frio elegante.",
    swatch: "#4d8fbf",
    unlock: (s) => (s.totalStars || 0) >= 6,
    hint: "6★ no total",
  },
  {
    id: "shelf-vinho",
    slot: "shelf",
    name: "Vinho da tarde",
    blurb: "Acento aconchegante.",
    swatch: "#8a3a4a",
    unlock: (s) => s.plays >= 8,
    hint: "8 expedientes",
  },
];

/** Tint no HUD / título (avental / crachá). */
export const BADGES: readonly CosmeticItem[] = [
  {
    id: "badge-padrao",
    slot: "badge",
    name: "Crachá padrão",
    blurb: "Sem firula.",
    swatch: "#e3b23c",
  },
  {
    id: "badge-estrela",
    slot: "badge",
    name: "Estrela do mês",
    blurb: "Dourado no peito.",
    swatch: "#f6e27a",
    unlock: (s) => (s.totalStars || 0) >= 3,
    hint: "3★ no total",
  },
  {
    id: "badge-faixa",
    slot: "badge",
    name: "Faixa de turno",
    blurb: "Listra no avental.",
    swatch: "#e07a2a",
    unlock: (s) => (s.bestTurno || 1) >= 3,
    hint: "Chegar no turno 3",
  },
  {
    id: "badge-avental",
    slot: "badge",
    name: "Avental vermelho",
    blurb: "Clássico de balcão.",
    swatch: "#c4491d",
    unlock: (s) => s.best >= 800,
    hint: "Recorde 800+",
  },
];

export const ALL_COSMETICS: readonly CosmeticItem[] = [...SIGNS, ...SHELVES, ...BADGES];

export const DEFAULT_EQUIPPED = {
  sign: "sign-classic",
  shelf: "shelf-verde",
  badge: "badge-padrao",
} as const;

export type EquippedCosmetics = {
  sign: string;
  shelf: string;
  badge: string;
};

export function isCosmeticUnlocked(item: CosmeticItem, save: SaveData): boolean {
  if (!item.unlock) return true;
  try {
    return item.unlock(save);
  } catch {
    return false;
  }
}

export function resolveEquipped(save: SaveData): EquippedCosmetics {
  const eq = save.equipped || { ...DEFAULT_EQUIPPED };
  const pick = (id: string, list: readonly CosmeticItem[], fallback: string): string => {
    const item = list.find((c) => c.id === id);
    if (item && isCosmeticUnlocked(item, save)) return item.id;
    return fallback;
  };
  return {
    sign: pick(eq.sign, SIGNS, DEFAULT_EQUIPPED.sign),
    shelf: pick(eq.shelf, SHELVES, DEFAULT_EQUIPPED.shelf),
    badge: pick(eq.badge, BADGES, DEFAULT_EQUIPPED.badge),
  };
}

/** Desbloqueios novos desde a última visita (para toast opcional). */
export function newlyUnlocked(save: SaveData): CosmeticItem[] {
  const known = new Set(save.unlockedCosmetics || []);
  const out: CosmeticItem[] = [];
  for (const c of ALL_COSMETICS) {
    if (!c.unlock) continue;
    if (known.has(c.id)) continue;
    if (isCosmeticUnlocked(c, save)) out.push(c);
  }
  return out;
}

export function syncUnlocks(save: SaveData): string[] {
  const set = new Set(save.unlockedCosmetics || []);
  for (const c of ALL_COSMETICS) {
    if (!c.unlock || isCosmeticUnlocked(c, save)) set.add(c.id);
  }
  save.unlockedCosmetics = [...set];
  return save.unlockedCosmetics;
}

/** Cores aplicadas no canvas / CSS. */
export type CosmeticPalette = {
  signId: string;
  shelfAccent: string;
  shelfDeep: string;
  shelfStroke: string;
  badge: string;
  badgeSoft: string;
  signFill: string;
  signStroke: string;
  signGlow: string;
};

export function paletteFor(eq: EquippedCosmetics): CosmeticPalette {
  const shelfMap: Record<string, { accent: string; deep: string; stroke: string }> = {
    "shelf-verde": { accent: "#24362c", deep: "#16241c", stroke: "rgba(227, 178, 60, 0.22)" },
    "shelf-cobre": { accent: "#3a2a1c", deep: "#241810", stroke: "rgba(198, 134, 66, 0.45)" },
    "shelf-azul": { accent: "#1c2a3a", deep: "#121c28", stroke: "rgba(77, 143, 191, 0.4)" },
    "shelf-vinho": { accent: "#2e1a22", deep: "#1a1014", stroke: "rgba(138, 58, 74, 0.45)" },
  };
  const signMap: Record<string, { fill: string; stroke: string; glow: string }> = {
    "sign-classic": { fill: "#2a2218", stroke: "#e3b23c", glow: "rgba(227,178,60,0.35)" },
    "sign-neon": { fill: "#101814", stroke: "#7dff9a", glow: "rgba(125,255,154,0.55)" },
    "sign-madeira": { fill: "#3a2418", stroke: "#c68642", glow: "rgba(198,134,66,0.4)" },
    "sign-azulejo": { fill: "#1a2838", stroke: "#9fd4ee", glow: "rgba(77,143,191,0.5)" },
  };
  const badgeMap: Record<string, { badge: string; soft: string }> = {
    "badge-padrao": { badge: "#e3b23c", soft: "rgba(227,178,60,0.35)" },
    "badge-estrela": { badge: "#f6e27a", soft: "rgba(246,226,122,0.45)" },
    "badge-faixa": { badge: "#e07a2a", soft: "rgba(224,122,42,0.4)" },
    "badge-avental": { badge: "#c4491d", soft: "rgba(196,73,29,0.4)" },
  };
  const sh = shelfMap[eq.shelf] ?? shelfMap["shelf-verde"]!;
  const sg = signMap[eq.sign] ?? signMap["sign-classic"]!;
  const bd = badgeMap[eq.badge] ?? badgeMap["badge-padrao"]!;
  return {
    signId: eq.sign,
    shelfAccent: sh.accent,
    shelfDeep: sh.deep,
    shelfStroke: sh.stroke,
    badge: bd.badge,
    badgeSoft: bd.soft,
    signFill: sg.fill,
    signStroke: sg.stroke,
    signGlow: sg.glow,
  };
}
