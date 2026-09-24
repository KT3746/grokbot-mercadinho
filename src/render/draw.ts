import { GAME_TITLE, prefersReducedMotion, wantsTouchCopy } from "../config";
import { ARCHETYPES, PRODUCT_BY_ID } from "../data/catalog";
import type { CosmeticPalette } from "../data/cosmetics";
import type { Customer, Particle, Run } from "../game/sim";
import type { ProductId } from "../types";
import { applyShelfOrder, contains, type PlayLayout, type Rect } from "./layout";

export type PointerGhost = { x: number; y: number; id: ProductId } | null;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const DEFAULT_PALETTE: CosmeticPalette = {
  signId: "sign-classic",
  shelfAccent: "#24362c",
  shelfDeep: "#16241c",
  shelfStroke: "rgba(227, 178, 60, 0.22)",
  badge: "#e3b23c",
  badgeSoft: "rgba(227,178,60,0.35)",
  signFill: "#2a2218",
  signStroke: "#e3b23c",
  signGlow: "rgba(227,178,60,0.35)",
};

export function drawShop(
  ctx: CanvasRenderingContext2D,
  run: Run,
  layout: PlayLayout,
  t: number,
  ghost: PointerGhost,
  selectedId: number | null,
  cosmetics: CosmeticPalette = DEFAULT_PALETTE,
  overlay = false,
): void {
  const { w, h } = layout;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  const reduce = prefersReducedMotion();
  if (run.shake > 0.4) {
    const amp = reduce ? run.shake * 0.2 : run.shake;
    ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
  }

  if (!overlay) {
    paintWall(ctx, w, h, layout, t, cosmetics);
    paintFloor(ctx, layout);
    paintQueueZone(ctx, layout);
  }
  for (const c of run.customers) drawCustomer(ctx, c, layout, t, overlay);
  paintShelves(ctx, layout, run, t, cosmetics, overlay);
  if (!overlay && run.chaos?.kind === "gato") drawCat(ctx, layout, run, t);
  drawParticles(ctx, run.particles, layout);
  // Urgência: vinheta vermelha quando alguém está no limite.
  let critical = 0;
  for (const c of run.customers) {
    if (c.mood !== "wait" && c.mood !== "enter") continue;
    const r = c.patience / Math.max(0.001, c.patienceMax);
    if (r < 0.22) critical = Math.max(critical, 1 - r / 0.22);
  }
  if (critical > 0.05 && !prefersReducedMotion()) {
    const a = 0.1 + critical * 0.28;
    const g = ctx.createRadialGradient(layout.w * 0.5, layout.h * 0.4, layout.w * 0.2, layout.w * 0.5, layout.h * 0.45, layout.w * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(180, 40, 28, ${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, layout.w, layout.h);
  }
  if (ghost) drawProduct(ctx, ghost.id, ghost.x, ghost.y, Math.min(84, layout.w * 0.14), t, true);
  if (run.chaos?.kind === "apagao") {
    ctx.fillStyle = "rgba(12, 8, 6, 0.46)";
    ctx.fillRect(0, 0, w, h);
    const gx = w * (0.35 + Math.sin(t * 0.7) * 0.08);
    const gy = h * 0.42;
    const g = ctx.createRadialGradient(gx, gy, 20, gx, gy, 220);
    g.addColorStop(0, "rgba(255, 220, 140, 0.16)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (selectedId != null) {
    const c = run.customers.find((x) => x.id === selectedId);
    if (c) {
      const r = layout.slots[c.slot];
      if (r) {
        ctx.save();
        ctx.shadowColor = "rgba(227, 178, 60, 0.65)";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "rgba(227, 178, 60, 1)";
        ctx.lineWidth = 4;
        roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 16);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(247, 236, 212, 0.35)";
        ctx.lineWidth = 1.5;
        roundRect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 14);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function paintWall(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layout: PlayLayout,
  t: number,
  cos: CosmeticPalette,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1c1612");
  g.addColorStop(0.45, "#15110e");
  g.addColorStop(1, "#0c0a08");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#12100e";
  ctx.fillRect(0, 0, w, layout.hud.h + 6);
  // Placa pequena na parede (acima da fila) — cosmético visual.
  const signW = Math.min(168, w * 0.36);
  const signH = 22;
  const sx = layout.queue.x + (layout.queue.w - signW) / 2;
  const sy = layout.queue.y - 4;
  if (sy > layout.hud.h + 2) {
    ctx.save();
    ctx.shadowColor = cos.signGlow;
    ctx.shadowBlur = cos.signId === "sign-neon" ? 10 + Math.sin(t * 4) * 2 : 4;
    ctx.fillStyle = cos.signFill;
    roundRect(ctx, sx, sy, signW, signH, 6);
    ctx.fill();
    ctx.strokeStyle = cos.signStroke;
    ctx.lineWidth = cos.signId === "sign-neon" ? 2.4 : 1.8;
    roundRect(ctx, sx, sy, signW, signH, 6);
    ctx.stroke();
    if (cos.signId === "sign-azulejo") {
      ctx.fillStyle = "rgba(159, 212, 238, 0.18)";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(sx + 6 + i * (signW / 4), sy + 3, signW / 5 - 4, signH - 6);
      }
    }
    if (cos.signId === "sign-madeira") {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 8, sy + signH * 0.35);
      ctx.lineTo(sx + signW - 8, sy + signH * 0.35);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = cos.signStroke;
    ctx.font = `800 ${Math.max(11, Math.min(14, signW * 0.09))}px Lilita One, Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(GAME_TITLE, sx + signW / 2, sy + signH * 0.72, signW - 12);
    ctx.restore();
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, layout: PlayLayout): void {
  // Fundo liso escuro — sem xadrez que polui a tela pequena.
  ctx.fillStyle = "#12100e";
  ctx.fillRect(0, layout.queue.y, layout.w, layout.h - layout.queue.y);
}

function paintQueueZone(ctx: CanvasRenderingContext2D, layout: PlayLayout): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  roundRect(ctx, layout.queue.x, layout.queue.y, layout.queue.w, layout.queue.h, 18);
  ctx.fill();
}


function paintShelves(
  ctx: CanvasRenderingContext2D,
  layout: PlayLayout,
  run: Run,
  t: number,
  cos: CosmeticPalette = DEFAULT_PALETTE,
  overlay = false,
): void {
  const s = layout.shelves;
  if (!overlay) {
    ctx.fillStyle = "#12100c";
    roundRect(ctx, s.x - 8, s.y - 8, s.w + 16, s.h + 16, 16);
    ctx.fill();
    const shelfGrad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
    shelfGrad.addColorStop(0, cos.shelfAccent);
    shelfGrad.addColorStop(1, cos.shelfDeep);
    ctx.fillStyle = shelfGrad;
    roundRect(ctx, s.x, s.y, s.w, s.h, 13);
    ctx.fill();
    ctx.strokeStyle = cos.shelfStroke;
    ctx.lineWidth = 2;
    roundRect(ctx, s.x + 1, s.y + 1, s.w - 2, s.h - 2, 12);
    ctx.stroke();
  }
  const cells = applyShelfOrder(layout.cells, run.shelfOrder.length === layout.cells.length ? run.shelfOrder : layout.cells.map((c) => c.id));
  const showKeys = !wantsTouchCopy();
  cells.forEach((cell, i) => {
    const blocked = catBlocks(run, layout, cell.rect);
    if (!overlay) {
      const cellGrad = ctx.createLinearGradient(cell.rect.x, cell.rect.y, cell.rect.x, cell.rect.y + cell.rect.h);
      if (blocked) {
        cellGrad.addColorStop(0, "rgba(10, 10, 10, 0.72)");
        cellGrad.addColorStop(1, "rgba(6, 6, 6, 0.8)");
      } else {
        cellGrad.addColorStop(0, "rgba(48, 38, 28, 0.98)");
        cellGrad.addColorStop(1, "rgba(28, 22, 16, 0.98)");
      }
      ctx.fillStyle = cellGrad;
      roundRect(ctx, cell.rect.x, cell.rect.y, cell.rect.w, cell.rect.h, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(227, 178, 60, 0.34)";
      ctx.lineWidth = 2;
      roundRect(ctx, cell.rect.x, cell.rect.y, cell.rect.w, cell.rect.h, 12);
      ctx.stroke();
      ctx.strokeStyle = "rgba(247, 236, 212, 0.08)";
      ctx.lineWidth = 1;
      roundRect(ctx, cell.rect.x + 2, cell.rect.y + 2, cell.rect.w - 4, cell.rect.h - 4, 10);
      ctx.stroke();
    } else {
      ctx.strokeStyle = blocked ? "rgba(10, 10, 10, 0.45)" : "rgba(247, 236, 212, 0.16)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, cell.rect.x, cell.rect.y, cell.rect.w, cell.rect.h, 12);
      ctx.stroke();
    }
    if (run.holding === cell.id) {
      ctx.save();
      ctx.shadowColor = "rgba(227, 178, 60, 0.7)";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "#e3b23c";
      ctx.lineWidth = 4;
      roundRect(ctx, cell.rect.x + 1, cell.rect.y + 1, cell.rect.w - 2, cell.rect.h - 2, 11);
      ctx.stroke();
      ctx.restore();
    }
    const cx = cell.rect.x + cell.rect.w / 2;
    if (!overlay) {
      const cy = cell.rect.y + cell.rect.h * 0.36;
      const size = Math.min(cell.rect.w, cell.rect.h) * 0.72;
      drawProduct(ctx, cell.id, cx, cy, size, t, run.holding === cell.id);
    }
    const p = PRODUCT_BY_ID[cell.id];
    const labelSize = Math.max(12, Math.min(16, cell.rect.w * 0.2));
    ctx.font = `800 ${labelSize}px Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(10,8,6,0.85)";
    ctx.strokeText(p.short, cx, cell.rect.y + cell.rect.h - 8, cell.rect.w - 6);
    ctx.fillStyle = "#f7ecd4";
    ctx.fillText(p.short, cx, cell.rect.y + cell.rect.h - 8, cell.rect.w - 6);
    const key = showKeys ? shelfKeyLabel(i) : null;
    if (key) {
      ctx.fillStyle = "rgba(232,220,200,0.55)";
      ctx.font = "800 11px Nunito, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(key, cell.rect.x + 6, cell.rect.y + 14);
    }
  });
}

function shelfKeyLabel(i: number): string | null {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "Q", "W", "E", "R", "A", "S", "D", "F"];
  return keys[i] ?? null;
}

function catBlocks(run: Run, layout: PlayLayout, rect: Rect): boolean {
  if (run.chaos?.kind !== "gato") return false;
  const cx = layout.shelves.x + run.catX * layout.shelves.w;
  const cy = layout.catY;
  return contains(rect, cx, cy, 18);
}

function drawCat(ctx: CanvasRenderingContext2D, layout: PlayLayout, run: Run, t: number): void {
  const x = layout.shelves.x + run.catX * layout.shelves.w;
  const y = layout.catY + Math.sin(t * 8) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#2a1d12";
  roundRect(ctx, -18, -8, 36, 16, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(14, -10, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -16);
  ctx.lineTo(12, -24);
  ctx.lineTo(16, -14);
  ctx.moveTo(18, -14);
  ctx.lineTo(24, -22);
  ctx.lineTo(22, -10);
  ctx.fill();
  ctx.fillStyle = "#e3b23c";
  ctx.beginPath();
  ctx.arc(16, -11, 1.6, 0, Math.PI * 2);
  ctx.arc(20, -11, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a1d12";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.quadraticCurveTo(-28, -16 + Math.sin(t * 10) * 6, -10, -8);
  ctx.stroke();
  ctx.restore();
}


function drawCustomer(
  ctx: CanvasRenderingContext2D,
  c: Customer,
  layout: PlayLayout,
  t: number,
  overlay = false,
): void {
  const slot = layout.slots[c.slot];
  if (!slot) return;
  const arch = ARCHETYPES.find((a) => a.id === c.arch) ?? ARCHETYPES[0]!;
  let ox = 0;
  let oy = 0;
  let scale = 1;
  let rot = 0;
  let alpha = 1;
  // Entrada: desliza + bounce curto (legível no celular).
  if (c.mood === "enter") {
    const k = 1 - c.anim;
    const bounce = Math.sin(c.anim * Math.PI) * 10;
    oy = k * (layout.landscape ? 0 : -48) - bounce * (1 - k);
    if (layout.landscape) ox = k * -64;
    scale = 0.82 + c.anim * 0.18;
  }
  // Saída feliz: sobe/sai com hop.
  if (c.mood === "leave") {
    const hop = Math.sin(c.anim * Math.PI) * 14;
    oy += c.anim * (layout.landscape ? -8 : -56) - hop * (1 - c.anim);
    if (layout.landscape) ox -= c.anim * 72;
    scale = 1 - c.anim * 0.22;
    alpha = 1 - c.anim * 0.55;
  }
  // Furioso: treme + desce batendo o pé.
  if (c.mood === "rage") {
    const shake = (1 - c.anim) * Math.sin(t * 38 + c.id) * 6;
    ox += shake;
    oy += c.anim * 36 + Math.abs(Math.sin(t * 22)) * 3 * (1 - c.anim);
    rot = shake * 0.03;
    scale = 1 + (1 - c.anim) * 0.06;
  }
  // Feliz: pulinho + leve scale.
  if (c.mood === "happy") {
    const hop = Math.sin(Math.min(1, c.anim * 2) * Math.PI) * 16;
    oy -= hop;
    scale = 1 + Math.sin(Math.min(1, c.anim * 2) * Math.PI) * 0.1;
  }
  const cx = slot.x + slot.w / 2 + ox;
  const cy = slot.y + slot.h * 0.62 + oy + Math.sin(t * 3 + c.id) * (c.mood === "wait" ? 2 : 0.5);
  if (!overlay) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 26, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = arch.shirt;
    roundRect(ctx, -16, 0, 32, 26, 8);
    ctx.fill();
    ctx.strokeStyle = arch.shirt;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    if (c.mood === "happy") {
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(-22, -6);
      ctx.moveTo(14, 6);
      ctx.lineTo(22, -6);
      ctx.stroke();
    } else if (c.mood === "rage") {
      ctx.beginPath();
      ctx.moveTo(-12, 8);
      ctx.lineTo(-18, 18);
      ctx.moveTo(12, 8);
      ctx.lineTo(18, 18);
      ctx.stroke();
    }
    ctx.fillStyle = arch.skin;
    ctx.beginPath();
    ctx.arc(0, -12, 13, 0, Math.PI * 2);
    ctx.fill();
    drawHair(ctx, arch.hairStyle, arch.hair);
    const impatient = c.mood === "wait" && c.patience / c.patienceMax < 0.35;
    ctx.fillStyle = "#2a1d12";
    ctx.beginPath();
    ctx.arc(-4.5, -13, impatient ? 2.1 : 1.7, 0, Math.PI * 2);
    ctx.arc(4.5, -13, impatient ? 2.1 : 1.7, 0, Math.PI * 2);
    ctx.fill();
    if (c.mood === "rage") {
      ctx.strokeStyle = "#2a1d12";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -17);
      ctx.lineTo(-2, -15);
      ctx.moveTo(7, -17);
      ctx.lineTo(2, -15);
      ctx.stroke();
    }
    ctx.strokeStyle = "#2a1d12";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (c.mood === "happy") ctx.arc(0, -8, 5, 0.15, Math.PI - 0.15);
    else if (c.mood === "rage") ctx.arc(0, -4, 5, Math.PI + 0.2, -0.2);
    else if (impatient) {
      ctx.moveTo(-5, -7);
      ctx.lineTo(5, -7);
    } else ctx.arc(0, -8, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.restore();
  }

  const barH = 15;
  const barW = Math.min(slot.w - 12, 148);
  const barX = slot.x + (slot.w - barW) / 2 + ox;
  const barY = slot.y + 7 + oy;
  const ratio = clamp01(c.patience / c.patienceMax);
  const barColor = ratio > 0.55 ? "#4caf5a" : ratio > 0.32 ? "#e3b23c" : "#e05228";
  const barEdge = ratio > 0.55 ? "rgba(76,175,90,0.7)" : ratio > 0.32 ? "rgba(227,178,60,0.85)" : "rgba(224,82,40,0.95)";
  ctx.fillStyle = "rgba(12, 10, 8, 0.88)";
  roundRect(ctx, barX, barY, barW, barH, 7);
  ctx.fill();
  ctx.strokeStyle = barEdge;
  ctx.lineWidth = ratio > 0.32 ? 2 : 2.6;
  roundRect(ctx, barX, barY, barW, barH, 7);
  ctx.stroke();
  const fillW = Math.max(5, (barW - 4) * ratio);
  ctx.fillStyle = barColor;
  roundRect(ctx, barX + 2, barY + 2, fillW, barH - 4, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  roundRect(ctx, barX + 2, barY + 2, fillW, Math.max(2, (barH - 4) * 0.35), 4);
  ctx.fill();

  ctx.fillStyle = "#e8dcc8";
  ctx.font = "800 12px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(c.special ? `${arch.name} ★` : arch.name, slot.x + slot.w / 2 + ox, barY + 26, slot.w - 8);

  const bubbleW = slot.w - 8;
  const bubbleH = Math.min(88, Math.max(58, slot.h * 0.4));
  const bx = slot.x + 4 + ox;
  const by = slot.y + 32 + oy;
  // Urgência no pedido: borda do balão lê em ~1s (verde → amarelo → vermelho).
  const urg =
    c.mood === "rage"
      ? 0
      : c.mood === "happy"
        ? 1
        : ratio;
  const urgStroke =
    urg > 0.55 ? "rgba(76, 175, 90, 0.95)" : urg > 0.32 ? "rgba(227, 178, 60, 0.98)" : "rgba(224, 82, 40, 1)";
  const urgGlow =
    urg > 0.55 ? "rgba(76, 175, 90, 0.18)" : urg > 0.32 ? "rgba(227, 178, 60, 0.22)" : "rgba(224, 82, 40, 0.32)";
  const urgPulse = prefersReducedMotion() ? 0 : (urg < 0.2 ? Math.sin(t * 12) * 0.85 : urg < 0.32 ? Math.sin(t * 8) * 0.35 : 0);
  const urgWidth = urg > 0.55 ? 2.5 : urg > 0.32 ? 3.2 : 3.9 + urgPulse;
  ctx.fillStyle = c.mood === "rage" ? "#3a241c" : "#2a2218";
  roundRect(ctx, bx, by, bubbleW, bubbleH, 10);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = urgGlow;
  ctx.shadowBlur = urg > 0.55 ? 0 : urg > 0.32 ? 6 : 12;
  ctx.strokeStyle = urgStroke;
  ctx.lineWidth = urgWidth;
  roundRect(ctx, bx, by, bubbleW, bubbleH, 10);
  ctx.stroke();
  ctx.restore();
  const need = c.order;
  const icon = Math.min(44, (bubbleW - 8) / Math.max(1, need.length) - 4);
  need.forEach((id, i) => {
    const ix = bx + bubbleW / 2 + (i - (need.length - 1) / 2) * (icon + 10);
    drawProduct(ctx, id, ix, by + bubbleH * 0.36, icon * 0.92, t, false);
    ctx.fillStyle = "#f7ecd4";
    ctx.font = `800 ${Math.max(10, Math.min(13, bubbleW * 0.14))}px Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(PRODUCT_BY_ID[id].short, ix, by + bubbleH - 7, icon + 12);
  });
  if (need.length === 0) {
    ctx.fillStyle = "#7dff9a";
    ctx.font = "800 12px Nunito, sans-serif";
    ctx.fillText("Obrigado!", bx + bubbleW / 2, by + bubbleH * 0.6);
  }
  // Balão de fala curto (PT-BR) — ocasional, não polui o pedido.
  if (c.phraseT > 0 && c.phrase) {
    drawSpeechBubble(ctx, c.phrase, slot.x + slot.w / 2 + ox, Math.max(slot.y + 4 + oy, barY - 4), slot.w - 6, c.mood);
  }
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  bottomY: number,
  maxW: number,
  mood: string,
): void {
  const padX = 8;
  const padY = 5;
  ctx.save();
  ctx.font = "700 11px Nunito, sans-serif";
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  const wrapW = Math.min(maxW - 8, 150);
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > wrapW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 2);
  const tw = Math.max(...shown.map((l) => ctx.measureText(l).width), 24);
  const bw = Math.min(maxW, tw + padX * 2);
  const bh = shown.length * 13 + padY * 2;
  const bx = cx - bw / 2;
  const by = bottomY - bh - 6;
  const fill = mood === "rage" ? "#3a241c" : mood === "happy" ? "#1e2a1c" : "#241c14";
  const stroke = mood === "rage" ? "#e05228" : mood === "happy" ? "#4caf5a" : "#e3b23c";
  ctx.fillStyle = fill;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.6;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.stroke();
  // Rabicho
  ctx.beginPath();
  ctx.moveTo(cx - 5, by + bh);
  ctx.lineTo(cx, by + bh + 6);
  ctx.lineTo(cx + 5, by + bh);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = "#f7ecd4";
  ctx.textAlign = "center";
  shown.forEach((l, i) => {
    ctx.fillText(l, cx, by + padY + 11 + i * 13, bw - 6);
  });
  ctx.restore();
}

function drawHair(ctx: CanvasRenderingContext2D, style: string, color: string): void {
  ctx.fillStyle = color;
  if (style === "bald") {
    ctx.beginPath();
    ctx.arc(0, -18, 8, Math.PI, 0);
    ctx.fill();
    return;
  }
  if (style === "bun") {
    ctx.beginPath();
    ctx.arc(0, -22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -16, 12, Math.PI, 0);
    ctx.fill();
    return;
  }
  if (style === "cap") {
    ctx.fillStyle = "#c4491d";
    roundRect(ctx, -14, -22, 28, 10, 4);
    ctx.fill();
    ctx.fillRect(-16, -14, 32, 4);
    return;
  }
  if (style === "puff") {
    ctx.beginPath();
    ctx.arc(-8, -18, 9, 0, Math.PI * 2);
    ctx.arc(8, -18, 9, 0, Math.PI * 2);
    ctx.arc(0, -22, 8, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(0, -16, 13, Math.PI, 0);
  ctx.fill();
  if (style === "side") {
    roundRect(ctx, 6, -16, 8, 16, 4);
    ctx.fill();
  }
}

export function drawProduct(
  ctx: CanvasRenderingContext2D,
  id: ProductId,
  x: number,
  y: number,
  s: number,
  t: number,
  glow: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  if (glow) {
    ctx.shadowColor = "rgba(227,178,60,0.75)";
    ctx.shadowBlur = 18;
  }
  const bob = Math.sin(t * 3 + x * 0.01) * (glow ? 2 : 0.45);
  ctx.translate(0, bob);
  switch (id) {
    case "refri":
      // Garrafa curva + folha (forma diferente do Zero).
      bottle(ctx, s, "#2f8f4a", "#e3b23c");
      leaf(ctx, s);
      ctx.fillStyle = "#e3b23c";
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, s * 0.08);
      ctx.lineTo(0, -s * 0.06);
      ctx.lineTo(s * 0.08, s * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    case "refriZero":
      // Corpo mais reto + faixa prata + "0" grande (símbolo, não só cor).
      bottle(ctx, s, "#1a3324", "#d8d8d8");
      ctx.fillStyle = "#c8c8c8";
      roundRect(ctx, -s * 0.2, -s * 0.02, s * 0.4, s * 0.1, 2);
      ctx.fill();
      ctx.fillStyle = "#f6f3ea";
      ctx.font = `800 ${s * 0.28}px Nunito`;
      ctx.textAlign = "center";
      ctx.fillText("0", 0, s * 0.22);
      // Tampinha hexagonal (≠ redonda do guaraná)
      ctx.fillStyle = "#d8d8d8";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * s * 0.1;
        const py = -s * 0.38 + Math.sin(a) * s * 0.06;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case "suco":
      carton(ctx, s, "#e07a2a", "#f6e27a");
      ctx.fillStyle = "#c4491d";
      ctx.beginPath();
      ctx.arc(0, s * 0.06, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "leite":
      // Caixa alta + faixa azul + "L" (≠ losango do creme).
      carton(ctx, s, "#f6f3ea", "#3b6fb6");
      ctx.fillStyle = "#3b6fb6";
      roundRect(ctx, -s * 0.22, s * 0.18, s * 0.44, s * 0.08, 2);
      ctx.fill();
      ctx.font = `800 ${s * 0.2}px Nunito`;
      ctx.textAlign = "center";
      ctx.fillText("L", 0, s * 0.1);
      break;
    case "cremeLeite":
      // Caixa mais baixa + losango dourado (forma ≠ leite).
      ctx.fillStyle = "#e8d4a8";
      roundRect(ctx, -s * 0.24, -s * 0.16, s * 0.48, s * 0.44, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      roundRect(ctx, -s * 0.24, -s * 0.16, s * 0.48, s * 0.44, 5);
      ctx.stroke();
      ctx.fillStyle = "#c68642";
      roundRect(ctx, -s * 0.24, -s * 0.3, s * 0.48, s * 0.14, 3);
      ctx.fill();
      ctx.fillStyle = "#e3b23c";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.06);
      ctx.lineTo(s * 0.12, s * 0.06);
      ctx.lineTo(0, s * 0.18);
      ctx.lineTo(-s * 0.12, s * 0.06);
      ctx.closePath();
      ctx.fill();
      break;
    case "agua":
      // Garrafa lisa + gota (≠ ondas/bolhas do gás).
      bottle(ctx, s, "#9fd4ee", "#2f6b9a");
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(-s * 0.06, 0, s * 0.05, 0, Math.PI * 2);
      ctx.arc(s * 0.08, -s * 0.06, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // Gota
      ctx.fillStyle = "#2f6b9a";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.12);
      ctx.quadraticCurveTo(s * 0.1, s * 0.02, 0, s * 0.14);
      ctx.quadraticCurveTo(-s * 0.1, s * 0.02, 0, -s * 0.12);
      ctx.fill();
      break;
    case "aguaGas":
      // Garrafa azul-escura + ondas + bolhas (símbolo ≠ gota).
      bottle(ctx, s, "#2a6f9a", "#e3b23c");
      ctx.strokeStyle = "#9fd4ee";
      ctx.lineWidth = Math.max(1.4, s * 0.035);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.14, -s * 0.08 + i * s * 0.1);
        ctx.quadraticCurveTo(0, -s * 0.14 + i * s * 0.1, s * 0.14, -s * 0.08 + i * s * 0.1);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const [ox, oy, r] of [[-0.08, 0.18, 0.035], [0.06, 0.12, 0.045], [0.02, 0.22, 0.028]]) {
        ctx.beginPath();
        ctx.arc(s * ox, s * oy, s * r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "pao": {
      // pão francês
      ctx.fillStyle = "#c68642";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.04, s * 0.34, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c49a";
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.3, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a86a30";
      ctx.lineWidth = Math.max(1.2, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 0.02);
      ctx.quadraticCurveTo(0, -s * 0.1, s * 0.18, -s * 0.02);
      ctx.stroke();
      break;
    }
    case "biscoito": {
      // pilha de biscoitos redondos
      for (const [ox, oy, r] of [[-0.12, 0.06, 0.16], [0.12, 0.08, 0.15], [0, -0.08, 0.17]]) {
        ctx.fillStyle = "#d4a05a";
        ctx.beginPath();
        ctx.arc(s * ox, s * oy, s * r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c4491d";
        ctx.beginPath();
        ctx.arc(s * ox, s * oy, s * r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "salgadinho": {
      // pacote aberto de salgadinho
      pack(ctx, s, "#e3b23c");
      ctx.fillStyle = "#c4491d";
      roundRect(ctx, -s * 0.22, -s * 0.3, s * 0.44, s * 0.14, 3);
      ctx.fill();
      ctx.fillStyle = "#f6e27a";
      for (let i = 0; i < 4; i++) {
        const a = -0.4 + i * 0.28;
        ctx.beginPath();
        ctx.ellipse(s * a, s * 0.05, s * 0.07, s * 0.04, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "chocolate": {
      // barra segmentada
      ctx.fillStyle = "#5a2a18";
      roundRect(ctx, -s * 0.3, -s * 0.18, s * 0.6, s * 0.36, 4);
      ctx.fill();
      ctx.strokeStyle = "#3a1810";
      ctx.lineWidth = Math.max(1.2, s * 0.03);
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.3 + (s * 0.6 * i) / 3, -s * 0.18);
        ctx.lineTo(-s * 0.3 + (s * 0.6 * i) / 3, s * 0.18);
        ctx.stroke();
      }
      ctx.fillStyle = "#e3b23c";
      roundRect(ctx, -s * 0.12, -s * 0.08, s * 0.24, s * 0.1, 2);
      ctx.fill();
      break;
    }
    case "ovos": {
      // cartela com ovos
      ctx.fillStyle = "#3d8f4a";
      roundRect(ctx, -s * 0.32, -s * 0.22, s * 0.64, s * 0.44, 6);
      ctx.fill();
      ctx.fillStyle = "#f0e6c8";
      for (const [ox, oy] of [[-0.14, -0.02], [0.14, -0.02], [0, 0.08]]) {
        ctx.beginPath();
        ctx.ellipse(s * ox, s * oy, s * 0.09, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "macarrao":
      pack(ctx, s, "#f0c44c");
      ctx.strokeStyle = "#c4491d";
      ctx.lineWidth = Math.max(1.5, s * 0.035);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, i * s * 0.07);
        ctx.quadraticCurveTo(0, i * s * 0.07 - s * 0.05, s * 0.2, i * s * 0.07);
        ctx.stroke();
      }
      break;
    case "arroz": {
      // saco branco
      ctx.fillStyle = "#f6f3ea";
      roundRect(ctx, -s * 0.26, -s * 0.3, s * 0.52, s * 0.6, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1.5, s * 0.035);
      roundRect(ctx, -s * 0.26, -s * 0.3, s * 0.52, s * 0.6, 8);
      ctx.stroke();
      ctx.fillStyle = "#2f6b4f";
      roundRect(ctx, -s * 0.18, -s * 0.08, s * 0.36, s * 0.2, 4);
      ctx.fill();
      break;
    }
    case "feijao": {
      ctx.fillStyle = "#6b341f";
      roundRect(ctx, -s * 0.26, -s * 0.3, s * 0.52, s * 0.6, 8);
      ctx.fill();
      ctx.fillStyle = "#c9a06a";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(-s * 0.12 + (i % 3) * s * 0.12, -s * 0.05 + Math.floor(i / 3) * s * 0.14, s * 0.05, s * 0.035, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "cafe": {
      pack(ctx, s, "#5a1810");
      ctx.fillStyle = "#e3b23c";
      ctx.beginPath();
      ctx.arc(0, -s * 0.02, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a1810";
      ctx.beginPath();
      ctx.arc(0, -s * 0.02, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "detergente":
      // Triângulo amarelo + bico reto (≠ flor do amaciante).
      bottle(ctx, s, "#3b6fb6", "#f6f3ea");
      ctx.fillStyle = "#f6e27a";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.lineTo(s * 0.12, s * 0.1);
      ctx.lineTo(-s * 0.12, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#f6f3ea";
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 0.2);
      ctx.lineTo(s * 0.12, -s * 0.2);
      ctx.stroke();
      break;
    case "amaciante":
      // Flor / pétalas (forma ≠ triângulo) + rosa.
      bottle(ctx, s, "#e07a8d", "#f6f3ea");
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * s * 0.08, Math.sin(a) * s * 0.08 + s * 0.02, s * 0.06, s * 0.045, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f6e27a";
      ctx.beginPath();
      ctx.arc(0, s * 0.02, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function bottle(ctx: CanvasRenderingContext2D, s: number, body: string, cap: string): void {
  ctx.fillStyle = body;
  roundRect(ctx, -s * 0.2, -s * 0.3, s * 0.4, s * 0.64, s * 0.14);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  roundRect(ctx, -s * 0.2, -s * 0.3, s * 0.4, s * 0.64, s * 0.14);
  ctx.stroke();
  ctx.fillStyle = cap;
  roundRect(ctx, -s * 0.11, -s * 0.44, s * 0.22, s * 0.14, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  roundRect(ctx, -s * 0.12, -s * 0.18, s * 0.09, s * 0.34, 2);
  ctx.fill();
}

function carton(ctx: CanvasRenderingContext2D, s: number, body: string, top: string): void {
  ctx.fillStyle = body;
  roundRect(ctx, -s * 0.22, -s * 0.2, s * 0.44, s * 0.52, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  roundRect(ctx, -s * 0.22, -s * 0.2, s * 0.44, s * 0.52, 5);
  ctx.stroke();
  ctx.fillStyle = top;
  roundRect(ctx, -s * 0.22, -s * 0.36, s * 0.44, s * 0.16, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-s * 0.16, -s * 0.08, s * 0.1, s * 0.28);
}

function pack(ctx: CanvasRenderingContext2D, s: number, color: string): void {
  ctx.fillStyle = color;
  roundRect(ctx, -s * 0.3, -s * 0.34, s * 0.6, s * 0.64, 9);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  roundRect(ctx, -s * 0.3, -s * 0.34, s * 0.6, s * 0.64, 9);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(ctx, -s * 0.22, -s * 0.26, s * 0.18, s * 0.12, 3);
  ctx.fill();
}

function leaf(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = "#1f5a32";
  ctx.beginPath();
  ctx.ellipse(s * 0.16, -s * 0.28, s * 0.1, s * 0.16, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSparkStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const b = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(b) * r * 0.42, y + Math.sin(b) * r * 0.42);
  }
  ctx.closePath();
  ctx.fill();
}

function drawParticles(ctx: CanvasRenderingContext2D, parts: Particle[], layout: PlayLayout): void {
  const reduce = prefersReducedMotion();
  const list = reduce ? parts.filter((p) => p.kind === "float" || p.text) : parts;
  for (const p of list) {
    const x = p.x * layout.w;
    const y = p.y * layout.h;
    const a = clamp01(p.life / p.max);
    ctx.save();
    ctx.globalAlpha = a;
    if (p.text) {
      ctx.fillStyle = p.color;
      ctx.font = `800 ${Math.max(20, p.size)}px Nunito, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(12,10,8,0.75)";
      ctx.lineWidth = 5;
      ctx.strokeText(p.text, x, y);
      ctx.fillText(p.text, x, y);
    } else {
      ctx.fillStyle = p.color;
      if (!reduce) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.kind === "star" ? 10 : 6;
      }
      if (p.kind === "star") {
        drawSparkStar(ctx, x, y, Math.max(3, p.size * 1.15));
      } else {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, p.size * 0.55), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.45;
        ctx.beginPath();
        ctx.arc(x - p.size * 0.35, y + p.size * 0.2, Math.max(1.2, p.size * 0.28), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function hitProduct(layout: PlayLayout, run: Run, x: number, y: number): ProductId | null {
  const cells = applyShelfOrder(layout.cells, run.shelfOrder.length === layout.cells.length ? run.shelfOrder : layout.cells.map((c) => c.id));
  for (const cell of cells) {
    if (!contains(cell.rect, x, y, 8)) continue;
    if (run.chaos?.kind === "gato") {
      const cx = layout.shelves.x + run.catX * layout.shelves.w;
      if (contains(cell.rect, cx, layout.catY, 18)) return null;
    }
    return cell.id;
  }
  return null;
}

export function hitCustomer(layout: PlayLayout, run: Run, x: number, y: number): number | null {
  let bestId: number | null = null;
  let bestD = Infinity;
  for (let i = run.customers.length - 1; i >= 0; i--) {
    const c = run.customers[i]!;
    if (c.mood !== "wait" && c.mood !== "enter") continue;
    const r = layout.slots[c.slot];
    if (!r || !contains(r, x, y, 6)) continue;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h * 0.62;
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) {
      bestD = d;
      bestId = c.id;
    }
  }
  return bestId;
}
