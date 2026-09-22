import {
  COMBO_WINDOW,
  MAX_COMBO,
  MAX_SLOTS,
  START_LIVES,
  TURNO_SECS,
  clamp,
  pick,
  randInt,
  shuffleInPlace,
  PARTICLE_CAP,
} from "../config";
import { ARCHETYPES, IDLE_CHAT, PRODUCT_BY_ID, SHIFT_LINES, TOASTS, productsUnlocked } from "../data/catalog";
import type { ChaosKind, CustomerMood, ProductId, TurnGoal } from "../types";

export type Customer = {
  id: number;
  arch: string;
  slot: number;
  mood: CustomerMood;
  anim: number;
  patience: number;
  patienceMax: number;
  order: ProductId[];
  got: ProductId[];
  phrase: string;
  phraseT: number;
  special: boolean;
  /** Já soltou um resmungo casual neste atendimento. */
  chattered: boolean;
};

export type Chaos = {
  kind: ChaosKind;
  t: number;
  dur: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  text?: string;
  color: string;
  size: number;
  kind: "float" | "spark" | "star";
};

export type TurnSummary = {
  turno: number;
  stars: number;
  goals: TurnGoal[];
  nextTurno: number;
};

export type SimEvent =
  | { type: "spawn"; name: string }
  | { type: "pickup"; id: ProductId }
  | { type: "deliver"; score: number; combo: number; done: boolean; name: string; customerId: number }
  | { type: "wrong"; name: string; mixup?: string }
  | { type: "rage"; name: string }
  | { type: "shift"; turno: number }
  | { type: "turnEnd"; summary: TurnSummary }
  | { type: "chaos"; kind: ChaosKind }
  | { type: "over" }
  | { type: "blocked" };

export type Run = {
  t: number;
  score: number;
  combo: number;
  comboT: number;
  lives: number;
  turno: number;
  turnoT: number;
  spawnIn: number;
  customers: Customer[];
  holding: ProductId | null;
  chaos: Chaos | null;
  nextId: number;
  over: boolean;
  served: number;
  wrong: number;
  shelfOrder: ProductId[];
  hint: string | null;
  hintT: number;
  banner: string | null;
  bannerT: number;
  first: boolean;
  chaosIn: number;
  catX: number;
  catVx: number;
  shake: number;
  particles: Particle[];
  tutorial: boolean;
  lockQueue: boolean;
  /** Contadores do turno atual (metas). */
  turnServed: number;
  turnWrong: number;
  turnRage: number;
  turnMaxCombo: number;
  goals: TurnGoal[];
  runStars: number;
  awaitingSummary: TurnSummary | null;
  /** Punch visual breve após entrega certa. */
  punch: number;
};

const easyFirst: ProductId[] = ["pao", "leite", "biscoito", "macarrao"];

/** Metas justas no início, escalam com carinho. */
export function goalsForTurn(turno: number): TurnGoal[] {
  const serveTarget = turno <= 1 ? 2 : turno === 2 ? 3 : Math.min(4, 2 + turno);
  const comboTarget = turno <= 1 ? 2 : turno === 2 ? 3 : Math.min(5, 2 + turno);
  return [
    {
      kind: "serve",
      label: `Atender ${serveTarget} clientes`,
      target: serveTarget,
      current: 0,
      met: false,
    },
    {
      kind: "combo",
      label: `Chegar em combo ×${comboTarget}`,
      target: comboTarget,
      current: 0,
      met: false,
    },
    {
      kind: "clean",
      label: turno <= 2 ? "Não perder vida neste turno" : "Sem clientes furiosos",
      target: 0,
      current: 0,
      met: true,
    },
  ];
}

function refreshGoals(run: Run): void {
  for (const g of run.goals) {
    if (g.kind === "serve") {
      g.current = run.turnServed;
      g.met = run.turnServed >= g.target;
    } else if (g.kind === "combo") {
      g.current = run.turnMaxCombo;
      g.met = run.turnMaxCombo >= g.target;
    } else {
      g.current = run.turnRage;
      g.met = run.turnRage <= 0;
    }
  }
}

export function createRun(): Run {
  const unlocked = productsUnlocked(1).map((p) => p.id);
  const run: Run = {
    t: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    lives: START_LIVES,
    turno: 1,
    turnoT: 0,
    spawnIn: 0.55,
    customers: [],
    holding: null,
    chaos: null,
    nextId: 1,
    over: false,
    served: 0,
    wrong: 0,
    shelfOrder: unlocked.slice(),
    hint: null,
    hintT: 0,
    banner: null,
    bannerT: 0,
    first: true,
    chaosIn: 36,
    catX: 0.15,
    catVx: 0.22,
    shake: 0,
    particles: [],
    tutorial: true,
    lockQueue: false,
    turnServed: 0,
    turnWrong: 0,
    turnRage: 0,
    turnMaxCombo: 0,
    goals: goalsForTurn(1),
    runStars: 0,
    awaitingSummary: null,
    punch: 0,
  };
  return run;
}

export function maxSlotsFor(turno: number): number {
  if (turno <= 1) return 1;
  if (turno === 2) return 2;
  if (turno === 3) return 2;
  return clamp(turno - 1, 3, Math.min(3, MAX_SLOTS));
}

export function spawnInterval(turno: number): number {
  if (turno <= 1) return 8.6 + Math.random() * 1.2;
  if (turno === 2) return 6.0 + Math.random() * 1.0;
  if (turno === 3) return 4.8 + Math.random() * 0.9;
  return Math.max(2.8, 4.6 - (turno - 3) * 0.35) + Math.random() * 0.6;
}

export function patienceFor(turno: number, items: number, special: boolean): number {
  const base = turno <= 1 ? 44 : turno === 2 ? 28 : Math.max(14, 24 - turno * 1.35);
  const extra = (items - 1) * 4.4;
  return (base + extra) * (special ? 0.88 : 1);
}

function orderFor(run: Run): { items: ProductId[]; special: boolean } {
  const pool = productsUnlocked(run.turno).map((p) => p.id);
  let n = 1;
  if (run.first) return { items: [pick(easyFirst.filter((id) => pool.includes(id)))], special: false };
  if (run.turno >= 3 && Math.random() < 0.28) n = 2;
  if (run.turno >= 4 && Math.random() < 0.18) n = 3;
  if (run.turno >= 5 && Math.random() < 0.22) n = 2 + randInt(2);
  n = Math.min(n, 3, pool.length);
  const special = run.turno >= 4 && n >= 2 && Math.random() < 0.14;
  const items: ProductId[] = [];
  const bag = shuffleInPlace(pool.slice());
  for (let i = 0; i < n; i++) {
    const id = bag[i];
    if (id) items.push(id);
  }
  if (run.turno >= 2 && items.length === 1 && Math.random() < 0.35) {
    const p = PRODUCT_BY_ID[items[0]!];
    if (p.lookalike && pool.includes(p.lookalike) && Math.random() < 0.55) {
      /* keep the real one; lookalike sits on the shelf as a trap */
    }
  }
  return { items, special };
}

function freeSlot(run: Run): number {
  const used = new Set(run.customers.map((c) => c.slot));
  const max = maxSlotsFor(run.turno);
  for (let i = 0; i < max; i++) if (!used.has(i)) return i;
  return -1;
}

function say(c: Customer, list: string[]): void {
  c.phrase = pick(list);
  c.phraseT = 2.2;
}

export function spawnCustomer(run: Run): SimEvent | null {
  const slot = freeSlot(run);
  if (slot < 0) return null;
  const arch = pick(ARCHETYPES);
  const { items, special } = orderFor(run);
  const wait = patienceFor(run.turno, items.length, special);
  const c: Customer = {
    id: run.nextId++,
    arch: arch.id,
    slot,
    mood: "enter",
    anim: 0,
    patience: wait,
    patienceMax: wait,
    order: items,
    got: [],
    phrase: pick(arch.arrive),
    phraseT: 2.6,
    special,
    chattered: false,
  };
  if (run.first) {
    c.patienceMax *= 1.5;
    c.patience = c.patienceMax;
  }
  run.customers.push(c);
  run.first = false;
  run.spawnIn = spawnInterval(run.turno);
  return { type: "spawn", name: arch.name };
}

export function dropHolding(run: Run): boolean {
  if (run.over || run.tutorial || run.awaitingSummary || !run.holding) return false;
  run.holding = null;
  return true;
}

export function tryPickup(run: Run, id: ProductId): SimEvent | null {
  if (run.over || run.tutorial || run.awaitingSummary) return null;
  const unlocked = productsUnlocked(run.turno).some((p) => p.id === id);
  if (!unlocked) return null;
  run.holding = id;
  return { type: "pickup", id };
}

export function customerById(run: Run, customerId: number): Customer | undefined {
  return run.customers.find((x) => x.id === customerId);
}

function mixupLabel(given: ProductId, want: ProductId): string | undefined {
  const g = PRODUCT_BY_ID[given];
  const w = PRODUCT_BY_ID[want];
  if (!g || !w) return undefined;
  if (g.lookalike === want || w.lookalike === given) {
    return `${g.short} ≠ ${w.short}`;
  }
  return undefined;
}

export function tryDeliver(run: Run, customerId: number, at?: { x: number; y: number }): SimEvent | null {
  if (run.over || run.tutorial || run.awaitingSummary) return null;
  const c = customerById(run, customerId);
  if (!c || (c.mood !== "wait" && c.mood !== "enter")) return null;
  if (!run.holding) return null;
  const want = c.order[0];
  const arch = ARCHETYPES.find((a) => a.id === c.arch) ?? ARCHETYPES[0]!;
  if (run.holding !== want) {
    const mixup = want ? mixupLabel(run.holding, want) : undefined;
    run.wrong++;
    run.turnWrong++;
    run.combo = 0;
    run.comboT = 0;
    c.patience = Math.max(0.4, c.patience - c.patienceMax * 0.14);
    say(c, arch.wrong);
    run.holding = null;
    run.shake = Math.max(run.shake, 16);
    burst(run, at?.x ?? 0.5, at?.y ?? 0.28, "#c4491d", 8);
    return { type: "wrong", name: arch.name, mixup };
  }
  c.order.shift();
  c.got.push(run.holding);
  run.holding = null;
  const ratio = c.patience / c.patienceMax;
  run.combo = Math.min(MAX_COMBO, run.combo + 1);
  run.comboT = COMBO_WINDOW;
  run.turnMaxCombo = Math.max(run.turnMaxCombo, run.combo);
  const base = 80 + Math.round(ratio * 70) + (c.special ? 40 : 0);
  const gain = base + run.combo * 18;
  run.score += gain;
  const done = c.order.length === 0;
  if (done) {
    run.served++;
    run.turnServed++;
    run.score += 40 + (c.special ? 80 : 0);
    c.mood = "happy";
    c.anim = 0;
    say(c, arch.thanks);
  } else {
    say(c, ["Ainda falta um.", "Isso. O próximo.", "Segue a lista."]);
  }
  run.punch = Math.max(run.punch, 0.11);
  // Poucos sparks — sem spam de partículas.
  burst(run, at?.x ?? 0.5, at?.y ?? 0.28, c.special ? "#e3b23c" : "#4caf5a", run.combo >= 4 ? 10 : 6);
  if (run.combo >= 3) burst(run, at?.x ?? 0.5, (at?.y ?? 0.28) - 0.02, "#f6e27a", 4);
  refreshGoals(run);
  if (run.hint && run.t > 1.2) {
    run.hint = "Isso. Mantém o ritmo.";
    run.hintT = 2.4;
  }
  return { type: "deliver", score: gain, combo: run.combo, done, name: arch.name, customerId: c.id };
}

function burst(run: Run, x: number, y: number, color: string, n: number): void {
  const room = Math.max(0, PARTICLE_CAP - run.particles.length);
  const cap = Math.min(n, 12, room);
  for (let i = 0; i < cap; i++) {
    const life = 0.36 + Math.random() * 0.22;
    run.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.48,
      vy: -0.22 - Math.random() * 0.3,
      life,
      max: life,
      color,
      size: 3 + Math.random() * 4.5,
      kind: Math.random() < 0.4 ? "star" : "spark",
    });
  }
}

export function floatText(run: Run, x: number, y: number, text: string, color: string): void {
  run.particles.push({
    x,
    y,
    vx: 0,
    vy: -0.08,
    life: 1.05,
    max: 1.05,
    text,
    color,
    size: 22,
    kind: "float",
  });
}

function startChaos(run: Run, kind: ChaosKind): void {
  const dur = kind === "rush" ? 0.2 : kind === "apagao" ? 5.2 : kind === "gato" ? 6.4 : 7.2;
  run.chaos = { kind, t: dur, dur };
  if (kind === "liquidacao") {
    run.shelfOrder = shuffleInPlace(productsUnlocked(run.turno).map((p) => p.id));
  }
  if (kind === "rush") {
    spawnCustomer(run);
    spawnCustomer(run);
  }
  run.chaosIn = 28 + Math.random() * 14;
}

function endChaos(run: Run): void {
  if (run.chaos?.kind === "liquidacao") {
    run.shelfOrder = productsUnlocked(run.turno).map((p) => p.id);
  }
  run.chaos = null;
}


/** Avança o turno depois do overlay de estrelas. */
export function applyShift(run: Run): SimEvent {
  const next = Math.min(4, run.turno + 1);
  run.turno = next;
  run.turnoT = 0;
  run.turnServed = 0;
  run.turnWrong = 0;
  run.turnRage = 0;
  run.turnMaxCombo = 0;
  run.goals = goalsForTurn(run.turno);
  run.shelfOrder = productsUnlocked(run.turno).map((p) => p.id);
  run.banner = SHIFT_LINES[Math.min(SHIFT_LINES.length - 1, run.turno - 1)] ?? `Turno ${run.turno}`;
  run.bannerT = 2.4;
  run.spawnIn = Math.min(run.spawnIn, 2.8);
  run.awaitingSummary = null;
  return { type: "shift", turno: run.turno };
}

function maybeTurnEnd(run: Run): SimEvent | null {
  if (run.turno >= 4) return null;
  if (run.turnoT < TURNO_SECS) return null;
  if (run.awaitingSummary) return null;
  refreshGoals(run);
  const met = run.goals.filter((g) => g.met).length;
  const stars = clamp(met, 0, 3);
  // Sobreviveu ao turno: 0–3 estrelas honestas (sem forçar mínimo).
  const summary: TurnSummary = {
    turno: run.turno,
    stars,
    goals: run.goals.map((g) => ({ ...g })),
    nextTurno: run.turno + 1,
  };
  run.runStars += stars;
  run.awaitingSummary = summary;
  // Congela o relógio do turno até o jogador fechar o resumo.
  run.turnoT = TURNO_SECS;
  return { type: "turnEnd", summary };
}

function decayFx(run: Run, dt: number): void {
  run.shake = Math.max(0, run.shake - dt * 28);
  run.punch = Math.max(0, run.punch - dt);
  for (const p of run.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.35 * dt;
  }
  run.particles = run.particles.filter((p) => p.life > 0);
}

export function tick(run: Run, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  if (run.over) return events;
  if (run.tutorial || run.lockQueue || run.awaitingSummary) {
    decayFx(run, dt);
    return events;
  }
  const simDt = dt;
  run.t += simDt;
  run.turnoT += simDt;
  run.shake = Math.max(0, run.shake - dt * 28);
  run.punch = Math.max(0, run.punch - dt);
  if (run.comboT > 0) {
    run.comboT -= dt;
    if (run.comboT <= 0) run.combo = 0;
  }
  if (run.hintT > 0) {
    run.hintT -= dt;
    if (run.hintT <= 0) run.hint = null;
  }
  if (run.bannerT > 0) {
    run.bannerT -= dt;
    if (run.bannerT <= 0) run.banner = null;
  }

  if (run.chaos) {
    run.chaos.t -= dt;
    if (run.chaos.kind === "gato") {
      run.catX += run.catVx * dt;
      if (run.catX > 0.88 || run.catX < 0.1) run.catVx *= -1;
    }
    if (run.chaos.t <= 0) endChaos(run);
  } else if (run.turno >= 3) {
    run.chaosIn -= simDt;
    if (run.chaosIn <= 0) {
      const kinds: ChaosKind[] =
        run.turno >= 4 ? ["apagao", "liquidacao", "gato", "rush"] : ["liquidacao", "gato"];
      const kind = pick(kinds);
      startChaos(run, kind);
      events.push({ type: "chaos", kind });
    }
  }

  const turnEnd = maybeTurnEnd(run);
  if (turnEnd) {
    events.push(turnEnd);
    return events;
  }

  run.spawnIn -= simDt;
  const holdFirst = run.turno === 1 && run.served < 1 && run.customers.length >= 1;
  if (run.spawnIn <= 0 && !holdFirst) {
    const ev = spawnCustomer(run);
    if (ev) events.push(ev);
    else run.spawnIn = 0.45;
  }

  for (const c of run.customers) {
    if (c.phraseT > 0) c.phraseT -= dt;
    if (c.mood === "enter") {
      c.anim = Math.min(1, c.anim + dt * 3.2);
      if (c.anim >= 1) c.mood = "wait";
    } else if (c.mood === "wait") {
      const drain = run.turno <= 1 ? simDt * 0.4 : run.turno === 2 ? simDt * 0.82 : simDt;
      c.patience -= drain;
      const ratio = c.patience / c.patienceMax;
      if (ratio < 0.34 && c.phraseT <= 0) {
        const arch = ARCHETYPES.find((a) => a.id === c.arch);
        if (arch) say(c, arch.wait);
      } else if (!c.chattered && ratio > 0.55 && c.phraseT <= 0 && Math.random() < 0.004) {
        c.chattered = true;
        say(c, IDLE_CHAT);
        c.phraseT = Math.min(c.phraseT, 1.6);
      }
      if (c.patience <= 0) {
        c.mood = "rage";
        c.anim = 0;
        run.lives -= 1;
        run.turnRage += 1;
        run.combo = 0;
        run.shake = Math.max(run.shake, 11);
        refreshGoals(run);
        const arch = ARCHETYPES.find((a) => a.id === c.arch) ?? ARCHETYPES[0]!;
        say(c, arch.rage);
        events.push({ type: "rage", name: arch.name });
        if (run.lives <= 0) {
          run.over = true;
          run.banner = "Quatro clientes foram embora furiosos.";
          run.bannerT = 1.2;
          events.push({ type: "over" });
        }
      }
    } else if (c.mood === "happy") {
      c.anim = Math.min(1, c.anim + dt * 2.4);
      if (c.anim > 0.5) c.mood = "leave";
    } else if (c.mood === "rage") {
      c.anim = Math.min(1, c.anim + dt * 2.0);
    } else if (c.mood === "leave") {
      c.anim = Math.min(1, c.anim + dt * 2.2);
    }
  }
  run.customers = run.customers.filter((c) => {
    if ((c.mood === "leave" || c.mood === "rage") && c.anim >= 1) return false;
    return true;
  });

  for (const p of run.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.35 * dt;
  }
  run.particles = run.particles.filter((p) => p.life > 0);

  return events;
}

export function toastFor(kind: ChaosKind): string {
  return pick(TOASTS[kind]);
}

export function livesGlyph(n: number): string {
  return "❤".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, START_LIVES - n));
}

