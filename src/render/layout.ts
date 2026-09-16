import { HUD_H_LANDSCAPE, HUD_H_PORTRAIT } from "../config";
import { productsUnlocked } from "../data/catalog";
import type { ProductId } from "../types";

export type Rect = { x: number; y: number; w: number; h: number };

export type ShelfCell = { id: ProductId; rect: Rect };

export type PlayLayout = {
  w: number;
  h: number;
  landscape: boolean;
  hud: Rect;
  queue: Rect;
  slots: Rect[];
  /** Mantido por compat; balcão visual removido. */
  counter: Rect;
  clerk: { x: number; y: number };
  hand: Rect;
  shelves: Rect;
  cells: ShelfCell[];
  catY: number;
};

export function contains(r: Rect, x: number, y: number, pad = 0): boolean {
  return x >= r.x - pad && y >= r.y - pad && x <= r.x + r.w + pad && y <= r.y + r.h + pad;
}

export function measureHudHeight(landscape: boolean): number {
  const fallback = landscape ? HUD_H_LANDSCAPE : HUD_H_PORTRAIT;
  if (typeof document === "undefined") return fallback;
  const el = document.getElementById("hud");
  if (el && !el.hidden) {
    const box = el.getBoundingClientRect().height;
    if (box > 40) return Math.max(fallback, Math.ceil(box) + 8);
  }
  let safe = 0;
  try {
    const pad = getComputedStyle(document.documentElement).getPropertyValue("--safe-t");
    const n = Number.parseFloat(pad);
    if (Number.isFinite(n)) safe = n;
  } catch {
    safe = 0;
  }
  return fallback + safe;
}

export function computeLayout(w: number, h: number, turno: number, slotCount: number, hudBand?: number): PlayLayout {
  const landscape = w > h * 1.12 && h < 620;
  const safeT = 6;
  const hudH = hudBand && hudBand > 40 ? hudBand : measureHudHeight(landscape);
  const hud: Rect = { x: 0, y: 0, w, h: hudH };
  const maxSlots = Math.max(1, slotCount);
  const stubCounter: Rect = { x: 0, y: 0, w: 0, h: 0 };

  if (landscape) {
    const queue: Rect = { x: 8, y: hudH + 6, w: Math.min(260, w * 0.3), h: h - hudH - 14 };
    const shelves: Rect = { x: queue.x + queue.w + 10, y: hudH + 8, w: w - (queue.x + queue.w + 18), h: h - hudH - 16 };
    const slots: Rect[] = [];
    const inner = queue.h - 12;
    const sh = Math.min(150, inner / maxSlots - 6);
    for (let i = 0; i < maxSlots; i++) {
      slots.push({
        x: queue.x + 8,
        y: queue.y + 8 + i * (sh + 6),
        w: queue.w - 16,
        h: sh,
      });
    }
    return {
      w,
      h,
      landscape,
      hud,
      queue,
      slots,
      counter: stubCounter,
      clerk: { x: shelves.x, y: shelves.y },
      hand: { x: shelves.x, y: shelves.y, w: 1, h: 1 },
      shelves,
      cells: gridCells(shelves, turno, landscape),
      catY: shelves.y + shelves.h * 0.55,
    };
  }

  // Retrato / celular: fila compacta no topo, prateleira ocupa o resto (sem balcão).
  const queueH = Math.min(168, Math.max(110, h * 0.22));
  const queue: Rect = { x: 8, y: hudH + safeT, w: w - 16, h: queueH };
  const gap = 8;
  // Mais folga inferior no celular — grade densa (turno 2+) não cola na borda.
  const bottomPad = 24;
  const shelves: Rect = {
    x: 8,
    y: queue.y + queue.h + gap,
    w: w - 16,
    h: Math.max(200, h - (queue.y + queue.h + gap + bottomPad)),
  };
  const slots: Rect[] = [];
  const sw = (queue.w - 8) / maxSlots;
  for (let i = 0; i < maxSlots; i++) {
    slots.push({
      x: queue.x + 4 + i * sw,
      y: queue.y + 6,
      w: sw - 6,
      h: queue.h - 12,
    });
  }
  return {
    w,
    h,
    landscape,
    hud,
    queue,
    slots,
    counter: stubCounter,
    clerk: { x: w * 0.5, y: queue.y + queue.h },
    hand: { x: 0, y: 0, w: 1, h: 1 },
    shelves,
    cells: gridCells(shelves, turno, false),
    catY: shelves.y + 28,
  };
}

function gridCells(shelves: Rect, turno: number, landscape: boolean): ShelfCell[] {
  const ids = productsUnlocked(turno).map((p) => p.id);
  const n = ids.length;
  const cols = landscape ? (n > 12 ? 8 : 6) : n > 8 ? 4 : Math.min(4, Math.max(2, n));
  const rows = Math.ceil(n / cols);
  const gap = landscape ? 8 : 6;
  const cw = (shelves.w - gap * (cols + 1)) / cols;
  const fillCh = (shelves.h - gap * (rows + 1)) / rows;
  // Celular denso (4 colunas): tiles um pouco mais baixos, alvo mínimo ~44px, ar embaixo.
  const shrink = !landscape && n > 8 ? 0.92 : !landscape ? 0.96 : 1;
  const ch = Math.max(44, fillCh * shrink);
  const usedH = rows * ch + (rows + 1) * gap;
  const y0 = shelves.y + gap + Math.max(0, (shelves.h - usedH) * 0.08);
  const cells: ShelfCell[] = [];
  ids.forEach((id, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    cells.push({
      id,
      rect: {
        x: shelves.x + gap + c * (cw + gap),
        y: y0 + r * (ch + gap),
        w: cw,
        h: ch,
      },
    });
  });
  return cells;
}

export function applyShelfOrder(cells: ShelfCell[], order: ProductId[]): ShelfCell[] {
  if (order.length !== cells.length) return cells;
  return cells.map((cell, i) => ({ ...cell, id: order[i] ?? cell.id }));
}
