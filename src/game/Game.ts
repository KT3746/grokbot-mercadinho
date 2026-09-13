import { Sfx } from "../audio/sfx";
import { BUILD_ID, COMBO_WINDOW, GAME_TITLE, HUD_H_LANDSCAPE, HUD_H_PORTRAIT, wantsTouchCopy } from "../config";
import { PRODUCT_BY_ID, TOASTS, productsUnlocked } from "../data/catalog";
import {
  applyShift,
  createRun,
  dropHolding,
  floatText,
  livesGlyph,
  maxSlotsFor,
  tick,
  toastFor,
  tryDeliver,
  tryPickup,
  type Run,
  type SimEvent,
} from "./sim";
import { loadSave, writeSave } from "../persist";
import { computeLayout, contains, type PlayLayout } from "../render/layout";
import { drawProduct, drawShop, hitCustomer, hitProduct, type PointerGhost } from "../render/draw";
import type { ProductId, SaveData, View } from "../types";
import { Screens, type UiAction } from "../ui/screens";

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ui: Screens;
  audio = new Sfx();
  save: SaveData;
  view: View = "title";
  run: Run | null = null;
  layout: PlayLayout | null = null;
  ghost: PointerGhost = null;
  selected: number | null = null;
  private last = 0;
  private hidden = false;
  private dpr = 1;
  private toastEl: HTMLElement;
  private bannerEl: HTMLElement;
  private hud: HTMLElement;
  private hurtEl: HTMLElement | null = null;
  private dragging: ProductId | null = null;
  /** 1 | 2 | 3 — acelerador do expediente */
  private speedScale: 1 | 2 | 3 = 1;
  private pointerId: number | null = null;
  private cssW = 0;
  private cssH = 0;
  private layoutKey = "";
  private hudBand = 0;
  private hidePauseTimer = 0;
  private ignorePauseUiUntil = 0;
  private ignoreVisibilityUntil = 0;
  private guardTimer = 0;
  /** Hitstop residual (segundos de relógio real). */
  private hitstop = 0;
  private tutorialStep = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("MERCADINHO: canvas 2D indisponível");
    this.canvas = canvas;
    this.ctx = ctx;
    this.ui = new Screens(uiRoot);
    this.ui.onAction = (a) => this.handle(a);
    this.save = loadSave();
    this.audio.setMuted(this.save.muted);
    this.toastEl = document.getElementById("toasts")!;
    this.bannerEl = document.getElementById("banner")!;
    this.hud = document.getElementById("hud")!;
    this.hurtEl = document.getElementById("hurt");
    const shop = document.getElementById("hud-shop");
    if (shop) shop.textContent = GAME_TITLE;
    this.bind();
    this.showTitle();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => this.resize());
    document.addEventListener("visibilitychange", () => this.onVisibility());
    const unlock = () => {
      void this.audio.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    this.resize();
    console.info(`MERCADINHO build ${BUILD_ID}`);
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      if (this.hidden) {
        this.last = now;
        return;
      }
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.12) dt = 0.12;
      // Hitstop: congela a simulação por um instante (clock real).
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        if (this.view === "play" && this.run) {
          this.paint();
          return;
        }
      }
      if (this.view === "play") dt *= this.speedScale;
      try {
        this.tick(dt);
      } catch (err) {
        console.error("MERCADINHO: falha no frame", err);
      }
    };
    requestAnimationFrame(loop);
  }

  /** Bloqueia Pausa (HUD) e, se pedido, o auto-pause de aba por alguns ms. */
  private playGuard(pauseUiMs: number, visibilityMs = 0): void {
    const now = performance.now();
    this.ignorePauseUiUntil = Math.max(this.ignorePauseUiUntil, now + pauseUiMs);
    if (visibilityMs > 0) {
      this.ignoreVisibilityUntil = Math.max(this.ignoreVisibilityUntil, now + visibilityMs);
    }
    this.hud.classList.add("play-guard");
    document.body.classList.add("play-guard");
    const pauseBtn = document.getElementById("btn-pause") as HTMLButtonElement | null;
    if (pauseBtn) pauseBtn.disabled = true;
    this.scheduleGuardClear();
  }

  private scheduleGuardClear(): void {
    window.clearTimeout(this.guardTimer);
    const wait = Math.max(this.ignorePauseUiUntil, this.ignoreVisibilityUntil) - performance.now();
    this.guardTimer = window.setTimeout(() => this.clearPlayGuard(), Math.max(0, wait));
  }

  private clearPlayGuard(): void {
    this.hud.classList.remove("play-guard");
    document.body.classList.remove("play-guard");
    const pauseBtn = document.getElementById("btn-pause") as HTMLButtonElement | null;
    if (pauseBtn) pauseBtn.disabled = false;
  }

  private pauseUiBlocked(): boolean {
    return performance.now() < this.ignorePauseUiUntil;
  }

  private onVisibility(): void {
    if (document.visibilityState !== "hidden") {
      window.clearTimeout(this.hidePauseTimer);
      this.hidden = false;
      return;
    }
    if (performance.now() < this.ignoreVisibilityUntil) return;
    window.clearTimeout(this.hidePauseTimer);
    this.hidePauseTimer = window.setTimeout(() => {
      if (document.visibilityState !== "hidden") return;
      if (performance.now() < this.ignoreVisibilityUntil) return;
      this.hidden = true;
      if (this.view === "play" && !this.run?.tutorial && !this.run?.awaitingSummary) this.pause();
    }, 2500);
  }

  private swallowPauseHit(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    if (!t?.closest("#btn-pause")) return false;
    if (!this.pauseUiBlocked()) return false;
    e.preventDefault();
    e.stopPropagation();
    if (typeof (e as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
    return true;
  }

  private bind(): void {
    document.getElementById("btn-speed")?.addEventListener("click", () => this.cycleSpeed());
    document.getElementById("btn-drop")?.addEventListener("click", () => this.drop());

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.drop();
    });
    this.canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onUp(e));
    this.canvas.addEventListener("pointercancel", () => this.clearDrag());
    this.canvas.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.canvas.addEventListener(
      "touchstart",
      () => {
        this.playGuard(500, 500);
      },
      { passive: true },
    );
    this.canvas.addEventListener(
      "touchend",
      (e) => {
        if (this.view !== "play") return;
        e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => this.onKey(e), true);

    for (const type of ["click", "pointerdown", "pointerup", "touchend"] as const) {
      document.addEventListener(type, (e) => this.swallowPauseHit(e), true);
    }

    document.body.addEventListener(
      "touchmove",
      (ev) => {
        if (!document.body.classList.contains("is-play")) return;
        const t = ev.target as HTMLElement | null;
        if (t?.closest("#ui, .btn, .icon-btn")) return;
        ev.preventDefault();
      },
      { passive: false },
    );
  }

  private pos(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    if (this.view !== "play" || !this.run || !this.layout) return;
    if (this.run.tutorial || this.run.over || this.run.awaitingSummary) return;
    if (e.button === 2) {
      this.drop();
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.playGuard(500, 500);
    void this.audio.unlock();
    this.run.lockQueue = true;
    const p = this.pos(e);
    const cust = hitCustomer(this.layout, this.run, p.x, p.y);
    const prod = hitProduct(this.layout, this.run, p.x, p.y);
    if (!prod && this.tappedBlockedShelf(p.x, p.y)) {
      this.toast("O gato da loja assumiu a prateleira.", 1100);
      this.audio.wrong();
      return;
    }
    if (prod) {
      const ev = tryPickup(this.run, prod);
      if (ev) {
        this.audio.pickup();
        this.dragging = prod;
        this.pointerId = e.pointerId;
        this.ghost = { x: p.x, y: p.y, id: prod };
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (cust != null) {
      this.selected = cust;
      if (this.run.holding) this.deliver(cust, p);
      return;
    }
    if (this.run.holding) this.drop();
  }

  private tappedBlockedShelf(x: number, y: number): boolean {
    if (!this.run || !this.layout || this.run.chaos?.kind !== "gato") return false;
    const cx = this.layout.shelves.x + this.run.catX * this.layout.shelves.w;
    const cy = this.layout.catY;
    for (const cell of this.layout.cells) {
      if (contains(cell.rect, x, y, 2) && contains(cell.rect, cx, cy, 18)) return true;
    }
    return false;
  }

  private onMove(e: PointerEvent): void {
    if (this.view !== "play" || !this.dragging || e.pointerId !== this.pointerId) return;
    const p = this.pos(e);
    if (this.ghost) {
      this.ghost.x = p.x;
      this.ghost.y = p.y;
    }
  }

  private onUp(e: PointerEvent): void {
    if (this.view !== "play" || !this.run || !this.layout) {
      this.clearDrag();
      return;
    }
    if (this.dragging && e.pointerId === this.pointerId) {
      const p = this.pos(e);
      const cust = hitCustomer(this.layout, this.run, p.x, p.y);
      if (cust != null) this.deliver(cust, p);
    }
    this.clearDrag();
  }

  private clearDrag(): void {
    this.dragging = null;
    this.pointerId = null;
    this.ghost = null;
    if (this.run) this.run.lockQueue = false;
  }

  private deliver(customerId: number, at: { x: number; y: number }): void {
    if (!this.run || this.run.tutorial || this.run.awaitingSummary) return;
    const ev = tryDeliver(this.run, customerId, {
      x: at.x / Math.max(1, this.cssW),
      y: at.y / Math.max(1, this.cssH),
    });
    if (!ev) return;
    this.applyEvent(ev, at);
  }

  private drop(): void {
    if (!this.run || this.view !== "play") return;
    if (dropHolding(this.run)) this.audio.click();
  }

  private waitingCustomers(): { id: number }[] {
    if (!this.run) return [];
    return this.run.customers.filter((c) => c.mood === "wait" || c.mood === "enter");
  }

  private selectedId(): number | null {
    const waiting = this.waitingCustomers();
    if (!waiting.length) return null;
    if (this.selected != null && waiting.some((c) => c.id === this.selected)) return this.selected;
    this.selected = waiting[0]!.id;
    return this.selected;
  }

  private onKey(e: KeyboardEvent): void {
    const playing = this.view === "play" && this.run && !this.run.tutorial && !this.run.awaitingSummary;
    const gameKey =
      e.code === "Space" ||
      e.code === "Enter" ||
      e.code === "Escape" ||
      e.code.startsWith("Digit") ||
      e.code.startsWith("Numpad") ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "KeyM" ||
      e.code === "KeyX";
    if (playing && gameKey) {
      e.preventDefault();
      e.stopPropagation();
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && ae.closest("#hud, button")) ae.blur();
    }

    if (e.code === "Digit3" || e.code === "Numpad3" || e.key === "3") {
      if (!playing || !this.run || !this.layout) return;
      const order = this.run.shelfOrder;
      const ids =
        order.length === this.layout.cells.length ? order.slice() : this.layout.cells.map((c) => c.id);
      const third = ids[2];
      if (third) {
        const ev = tryPickup(this.run, third);
        if (ev) this.audio.pickup();
      }
      return;
    }
    if (e.code === "Escape") {
      if (this.view === "play" && (this.run?.tutorial || this.run?.awaitingSummary)) return;
      if (this.view === "summary" || this.view === "tutorial") return;
      if (playing && this.run?.holding) {
        this.drop();
        return;
      }
      if (this.view === "play") this.pause();
      else if (this.view === "paused") this.resume();
      return;
    }
    if (e.code === "KeyM") {
      this.handle({ type: "mute" });
      return;
    }
    if (!playing || !this.run || !this.layout) return;
    if (e.code === "KeyX") {
      this.drop();
      return;
    }
    const order = this.run.shelfOrder;
    const ids =
      order.length === this.layout.cells.length ? order.slice() : this.layout.cells.map((c) => c.id);
    const map: Record<string, number> = {
      Digit1: 0,
      Digit2: 1,
      Digit3: 2,
      Digit4: 3,
      Digit5: 4,
      Digit6: 5,
      Digit7: 6,
      Digit8: 7,
      Numpad1: 0,
      Numpad2: 1,
      Numpad3: 2,
      Numpad4: 3,
      Numpad5: 4,
      Numpad6: 5,
      Numpad7: 6,
      Numpad8: 7,
      KeyQ: 8,
      KeyW: 9,
      KeyE: 10,
      KeyR: 11,
      KeyA: 12,
      KeyS: 13,
      KeyD: 14,
      KeyF: 15,
    };
    const idx = map[e.code];
    if (idx != null && ids[idx]) {
      const ev = tryPickup(this.run, ids[idx]!);
      if (ev) this.audio.pickup();
      return;
    }
    const waiting = this.waitingCustomers();
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      if (!waiting.length) return;
      const i = waiting.findIndex((c) => c.id === this.selected);
      const next = e.code === "ArrowRight" ? i + 1 : i - 1;
      const wrap = (next + waiting.length) % waiting.length;
      this.selected = waiting[wrap]!.id;
      return;
    }
    if (e.code === "Space" || e.code === "Enter") {
      const id = this.selectedId();
      if (id != null) {
        const c = this.run.customers.find((x) => x.id === id);
        const slot = c ? this.layout.slots[c.slot] : null;
        const at = slot
          ? { x: slot.x + slot.w / 2, y: slot.y + slot.h * 0.4 }
          : { x: this.cssW / 2, y: this.cssH * 0.28 };
        this.deliver(id, at);
      }
    }
  }

  private applyEvent(ev: SimEvent, at?: { x: number; y: number }): void {
    if (!this.run) return;
    switch (ev.type) {
      case "spawn":
        this.audio.bell();
        if (this.selected == null) this.selected = this.selectedId();
        break;
      case "deliver": {
        this.audio.punch();
        this.audio.cash();
        this.hitstop = Math.max(this.hitstop, ev.combo >= 4 ? 0.07 : 0.045);
        if (this.run) this.run.punch = Math.max(this.run.punch, 0.09);
        if (ev.combo >= 3) {
          this.audio.combo(ev.combo);
          this.buzz([12, 30, 18]);
        } else {
          this.buzz(18);
        }
        this.popScore(ev.score, ev.combo, ev.customerId, at);
        this.flashCombo();
        break;
      }
      case "wrong": {
        this.audio.wrong();
        this.buzz([30, 40, 45]);
        if (this.run) this.run.shake = Math.max(this.run.shake, 14);
        const msg = ev.mixup
          ? `Ops — ${ev.mixup}. Era o outro.`
          : (TOASTS.wrong[Math.floor(Math.random() * TOASTS.wrong.length)] ?? "Ops. Era o outro.");
        this.toast(msg, 1700);
        this.popWrong(ev.mixup ? `Mistura: ${ev.mixup}` : msg, at);
        break;
      }
      case "rage":
        this.audio.slam();
        this.toast(
          `${ev.name} foi embora — você perdeu uma vida. Restam ${Math.max(0, this.run.lives)}.`,
          1400,
        );
        this.flashLifeLost();
        break;
      case "shift":
        this.audio.shift();
        break;
      case "turnEnd":
        this.showTurnSummary(ev.summary);
        break;
      case "chaos":
        this.audio.chaos();
        this.toast(toastFor(ev.kind), 1200);
        break;
      case "over":
        this.audio.over();
        this.finish();
        break;
      default:
        break;
    }
  }

  private showTurnSummary(summary: import("./sim").TurnSummary): void {
    this.clearDrag();
    this.view = "summary";
    this.ui.turnSummary(summary);
    this.syncChrome();
    this.audio.shift();
  }

  private continueAfterSummary(): void {
    if (!this.run?.awaitingSummary) return;
    const ev = applyShift(this.run);
    this.view = "play";
    this.ui.root.innerHTML = "";
    this.syncChrome();
    this.ensureLayout(true);
    this.applyEvent(ev);
    this.resize();
    this.syncHud();
    this.playGuard(300, 500);
    document.getElementById("btn-speed")?.blur();
  }

  private tick(dt: number): void {
    this.resizeIfNeeded();
    if ((this.view === "play" || this.view === "summary") && this.run) {
      this.ensureLayout();
      if (this.view === "play" && !this.run.awaitingSummary) {
        const beforeTurno = this.run.turno;
        const events = tick(this.run, dt);
        if (this.run.turno !== beforeTurno) this.ensureLayout(true);
        for (const ev of events) this.applyEvent(ev);
        if (this.run.over && this.view === "play") this.finish();
        this.selectedId();
        this.syncHud();
        this.syncBanner();
      } else if (this.run.awaitingSummary) {
        // Mantém partículas/shake amortecendo sob o overlay.
        tick(this.run, dt);
        this.syncHud();
      }
    }
    this.paint();
  }

  private paint(): void {
    const { ctx, cssW, cssH } = this;
    if (
      (this.view === "play" || this.view === "paused" || this.view === "summary" || this.view === "tutorial") &&
      this.run &&
      this.layout
    ) {
      ctx.save();
      if (this.run.punch > 0) {
        const s = 1 + this.run.punch * 0.55;
        ctx.translate(cssW / 2, cssH / 2);
        ctx.scale(s, s);
        ctx.translate(-cssW / 2, -cssH / 2);
      }
      drawShop(ctx, this.run, this.layout, this.run.t, this.view === "play" ? this.ghost : null, this.selected);
      ctx.restore();
      return;
    }
    this.paintMenuBg(cssW, cssH);
  }

  private paintMenuBg(w: number, h: number): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1a1410");
    g.addColorStop(1, "#0e0a08");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const tile = 36;
    ctx.globalAlpha = 0.12;
    for (let y = h * 0.45; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        ctx.fillStyle = ((x / tile) | 0) % 2 === ((y / tile) | 0) % 2 ? "#2a2218" : "#3a2418";
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#241810";
    ctx.fillRect(0, h * 0.58, w, 28);
    const ids = productsUnlocked(3).map((p) => p.id);
    const t = performance.now() / 1000;
    ids.slice(0, 8).forEach((id, i) => {
      const x = w * 0.12 + i * ((w * 0.76) / 8);
      drawProduct(ctx, id, x, h * 0.52, 28, t, false);
    });
  }

  private resizeIfNeeded(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (w === this.cssW && h === this.cssH) return;
    this.resize();
  }

  private resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.remeasureHud(true);
  }

  private remeasureHud(forceLayout = false): void {
    this.hudBand = 0;
    if (!this.hud.hidden) {
      const box = this.hud.getBoundingClientRect().height;
      if (box > 40) this.hudBand = Math.ceil(box) + 8;
    }
    document.documentElement.style.setProperty(
      "--hud-band",
      `${Math.max(72, this.hudBand || 96)}px`,
    );
    this.ensureLayout(forceLayout);
  }

  private ensureLayout(force = false): void {
    if (!this.run) return;
    const landscape = this.cssW > this.cssH * 1.12 && this.cssH < 620;
    const band = this.hudBand || (landscape ? HUD_H_LANDSCAPE : HUD_H_PORTRAIT);
    const slots = maxSlotsFor(this.run.turno);
    const key = `${this.cssW}x${this.cssH}:${this.run.turno}:${slots}:${band}`;
    if (!force && this.layout && this.layoutKey === key) return;
    this.layoutKey = key;
    this.layout = computeLayout(this.cssW, this.cssH, this.run.turno, slots, band);
  }

  private showTitle(): void {
    this.view = "title";
    this.run = null;
    document.body.classList.remove("tutor-shelf", "tutor-lookalike", "tutor-speed");
    this.ui.title(this.save.muted, this.save.best, this.save.bestStars);
    this.syncChrome();
  }

  private play(): void {
    this.run = createRun();
    this.selected = null;
    this.speedScale = 1;
    this.hitstop = 0;
    this.syncSpeedBtn();
    this.save.plays += 1;
    writeSave(this.save);
    this.resize();

    if (!this.save.seenHow) {
      this.tutorialStep = 0;
      this.view = "tutorial";
      this.run.tutorial = true;
      this.ui.tutorial(0, wantsTouchCopy());
      this.syncChrome();
      this.syncTutorialChrome();
      this.ensureLayout(true);
      return;
    }

    // Já viu o tour: abre direto o caixa.
    this.view = "play";
    this.beginShift();
  }

  private finishTutorial(skipped: boolean): void {
    this.save.seenHow = true;
    writeSave(this.save);
    this.tutorialStep = 0;
    document.body.classList.remove("tutor-shelf", "tutor-lookalike", "tutor-speed");
    if (!this.run) return;
    this.view = "play";
    this.beginShift();
    if (skipped) {
      this.toast("Tutorial pulado. Bom expediente!", 1600);
    }
  }

  private beginShift(): void {
    if (!this.run) return;
    this.run.tutorial = false;
    this.run.lockQueue = false;
    this.run.spawnIn = 0.55;
    this.run.hint = null;
    this.run.hintT = 0;
    this.run.banner = "A loja abriu.";
    this.run.bannerT = 2;
    this.ui.root.innerHTML = "";
    this.view = "play";
    this.syncChrome();
    this.resize();
    document.getElementById("btn-speed")?.blur();
    this.toast(
      wantsTouchCopy()
        ? "Toque no produto, depois no cliente. Ou arraste."
        : "Clique no produto, depois no cliente. 1–8 pega o item. Espaço entrega.",
      2400,
    );
    this.audio.shift();
    this.playGuard(300, 500);
  }

  private pause(): void {
    if (this.view !== "play" || this.run?.tutorial || this.run?.awaitingSummary) return;
    if (this.pauseUiBlocked()) return;
    this.clearDrag();
    this.view = "paused";
    this.ui.pause(this.save.muted);
    this.syncChrome();
  }

  private resume(): void {
    if (this.view !== "paused") return;
    this.view = "play";
    this.ui.root.innerHTML = "";
    this.syncChrome();
    this.playGuard(300, 500);
    document.getElementById("btn-speed")?.blur();
  }

  private finish(): void {
    if (!this.run) return;
    if (this.view === "over") return;
    const score = this.run.score;
    const served = this.run.served;
    const turno = this.run.turno;
    const runStars = this.run.runStars;
    const isBest = score > this.save.best;
    if (isBest) this.save.best = score;
    if (turno > this.save.bestTurno) this.save.bestTurno = turno;
    this.save.totalStars = (this.save.totalStars || 0) + runStars;
    if (runStars > (this.save.bestStars || 0)) this.save.bestStars = runStars;
    writeSave(this.save);
    this.view = "over";
    this.ui.over(score, served, turno, this.save.best, isBest, runStars, this.save.bestStars);
    this.syncChrome();
  }

  private handle(a: UiAction): void {
    void this.audio.unlock();
    switch (a.type) {
      case "play":
        this.play();
        break;
      case "how":
        this.view = "how";
        this.ui.how();
        this.syncChrome();
        break;
      case "credits":
        this.view = "credits";
        this.ui.credits();
        this.syncChrome();
        break;
      case "back":
      case "menu":
        this.showTitle();
        break;
      case "pause":
        this.pause();
        break;
      case "resume":
        this.resume();
        break;
      case "quit":
        this.showTitle();
        break;
      case "retry":
        this.play();
        break;
      case "begin":
        this.beginShift();
        break;
      case "tutorialNext":
        if (this.tutorialStep >= 2) this.finishTutorial(false);
        else {
          this.tutorialStep += 1;
          this.ui.tutorial(this.tutorialStep, wantsTouchCopy());
          this.syncTutorialChrome();
          this.audio.click();
        }
        break;
      case "tutorialSkip":
        this.finishTutorial(true);
        break;
      case "nextTurn":
        this.continueAfterSummary();
        break;
      case "mute": {
        const muted = this.audio.toggleMute();
        this.save.muted = muted;
        writeSave(this.save);
        this.syncMuteButtons();
        if (this.view === "title") this.ui.title(muted, this.save.best, this.save.bestStars);
        if (this.view === "paused") this.ui.pause(muted);
        this.audio.click();
        break;
      }
      default:
        break;
    }
  }

  private syncChrome(): void {
    const playing = this.view === "play";
    const showHud =
      (playing || this.view === "summary" || this.view === "tutorial") &&
      !!this.run &&
      !this.run.tutorial &&
      this.view !== "tutorial";
    document.body.classList.toggle("is-play", playing && !this.run?.tutorial && !this.run?.awaitingSummary);
    document.body.dataset.view = this.view;
    this.hud.hidden = !showHud;
    if (showHud) {
      const hand = document.getElementById("hud-hand");
      if (hand) hand.hidden = false;
      this.remeasureHud(true);
    }
    if (this.view === "title" || this.view === "how" || this.view === "credits" || this.view === "over") {
      this.bannerEl.hidden = true;
      this.toastEl.hidden = true;
      this.toastEl.replaceChildren();
      if (this.hurtEl) this.hurtEl.hidden = true;
    }
    this.syncMuteButtons();
  }

  private syncTutorialChrome(): void {
    document.body.classList.remove("tutor-shelf", "tutor-lookalike", "tutor-speed");
    if (this.view !== "tutorial") return;
    const spot = this.tutorialStep === 0 ? "shelf" : this.tutorialStep === 1 ? "lookalike" : "speed";
    document.body.classList.add(`tutor-${spot}`);
    // No passo da velocidade, mostra o HUD pra o botão 1x/2x/3x aparecer.
    if (spot === "speed" && this.run) {
      this.run.tutorial = true;
      this.hud.hidden = false;
      this.syncSpeedBtn();
      this.remeasureHud(true);
    } else {
      this.hud.hidden = true;
    }
  }

  private cycleSpeed(): void {
    if (this.view !== "play" || this.run?.awaitingSummary) return;
    this.speedScale = this.speedScale === 1 ? 2 : this.speedScale === 2 ? 3 : 1;
    this.syncSpeedBtn();
    this.audio.click();
  }

  private syncSpeedBtn(): void {
    const btn = document.getElementById("btn-speed");
    if (!btn) return;
    btn.textContent = `${this.speedScale}x`;
    btn.setAttribute("aria-label", `Velocidade ${this.speedScale}x`);
    btn.classList.toggle("speed-fast", this.speedScale > 1);
  }

  private syncMuteButtons(): void {
    const label = this.save.muted ? "Som off" : "Som";
    const btn = document.getElementById("btn-mute");
    if (btn) btn.textContent = label;
  }

  private syncHud(): void {
    if (!this.run) return;
    this.syncSpeedBtn();
    const score = document.getElementById("hud-score");
    const combo = document.getElementById("hud-combo");
    const comboVal = document.getElementById("hud-combo-val");
    const comboFill = document.getElementById("hud-combo-fill");
    const turno = document.getElementById("hud-turno");
    const lives = document.getElementById("hud-lives");
    const goals = document.getElementById("hud-goals");
    if (score) score.textContent = String(this.run.score);
    if (turno) turno.textContent = this.run.turno >= 4 ? "Hora extra" : `Turno ${this.run.turno}`;
    if (lives) lives.textContent = livesGlyph(this.run.lives);
    if (combo) {
      if (this.run.combo >= 2) {
        combo.hidden = false;
        if (comboVal) comboVal.textContent = `×${this.run.combo}`;
        if (comboFill) {
          const pct = Math.max(0, Math.min(1, this.run.comboT / COMBO_WINDOW));
          comboFill.style.width = `${Math.round(pct * 100)}%`;
        }
        combo.classList.toggle("combo-hot", this.run.combo >= 5);
      } else combo.hidden = true;
    }
    if (goals) {
      const bits = this.run.goals
        .map((g) => {
          const mark = g.met ? "★" : "☆";
          if (g.kind === "serve") return `${mark}${g.current}/${g.target}`;
          if (g.kind === "combo") return `${mark}×${Math.max(g.current, 0)}`;
          return `${mark}${g.met ? "ok" : "vida"}`;
        })
        .join(" · ");
      goals.hidden = false;
      goals.textContent = bits;
    }
    const hand = document.getElementById("hud-hand");
    const handName = document.getElementById("hud-hand-name");
    if (hand && handName) {
      hand.hidden = false;
      handName.textContent = this.run.holding ? PRODUCT_BY_ID[this.run.holding].short : "—";
    }
  }

  private flashCombo(): void {
    const combo = document.getElementById("hud-combo");
    if (!combo || combo.hidden) return;
    combo.classList.remove("combo-punch");
    void combo.offsetWidth;
    combo.classList.add("combo-punch");
  }

  private buzz(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* ignore unsupported / blocked vibration */
    }
  }

  private popScore(score: number, combo: number, customerId: number, at?: { x: number; y: number }): void {
    if (!this.run || !this.layout) return;
    const c = this.run.customers.find((x) => x.id === customerId);
    const slot = c ? this.layout.slots[c.slot] : null;
    let x = 0.5;
    let y = 0.22;
    if (slot) {
      x = (slot.x + slot.w / 2) / Math.max(1, this.cssW);
      y = (slot.y + 18) / Math.max(1, this.cssH);
    } else if (at) {
      x = at.x / Math.max(1, this.cssW);
      y = at.y / Math.max(1, this.cssH) - 0.04;
    }
    floatText(this.run, x, y, `+${score}`, "#e3b23c");
    if (combo >= 2) floatText(this.run, x, y - 0.045, `Combo ×${combo}`, "#7dff9a");
  }

  private popWrong(msg: string, at?: { x: number; y: number }): void {
    if (!this.run) return;
    let x = 0.5;
    let y = 0.26;
    if (at) {
      x = at.x / Math.max(1, this.cssW);
      y = Math.max(0.12, at.y / Math.max(1, this.cssH) - 0.06);
    }
    floatText(this.run, x, y, msg, "#ffb4a2");
  }

  private syncBanner(): void {
    if (!this.run) return;
    if (this.run.banner && this.run.bannerT > 0) {
      this.bannerEl.hidden = false;
      this.bannerEl.textContent = this.run.banner;
    } else this.bannerEl.hidden = true;
  }

  private toast(text: string, ms = 1100): void {
    this.toastEl.hidden = false;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    this.toastEl.appendChild(el);
    while (this.toastEl.childElementCount > 3) this.toastEl.firstElementChild?.remove();
    window.setTimeout(() => {
      el.remove();
      if (!this.toastEl.childElementCount) this.toastEl.hidden = true;
    }, ms);
  }

  private flashLifeLost(): void {
    const lives = document.getElementById("hud-lives");
    lives?.classList.remove("pulse-lost");
    void lives?.offsetWidth;
    lives?.classList.add("pulse-lost");
    if (this.hurtEl) {
      this.hurtEl.hidden = true;
      void this.hurtEl.offsetWidth;
      this.hurtEl.hidden = false;
    }
    window.setTimeout(() => {
      lives?.classList.remove("pulse-lost");
      if (this.hurtEl) this.hurtEl.hidden = true;
    }, 700);
  }
}
