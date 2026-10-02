/** Meta suave do dia (BRT) — localStorage, sem punir se falhar. */

export type DailyMeta = {
  /** YYYY-MM-DD no fuso America/Sao_Paulo */
  date: string;
  bestScore: number;
  bestServed: number;
};

export const DAILY_KEY = "mercadinho-daily-v1";

const BASE_SCORE = 400;
const BASE_SERVED = 8;

export function brtDateKey(now = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  } catch {
    const d = new Date(now);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

function empty(date = brtDateKey()): DailyMeta {
  return { date, bestScore: 0, bestServed: 0 };
}

export function loadDailyMeta(): DailyMeta {
  const today = brtDateKey();
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return empty(today);
    const parsed = JSON.parse(raw) as Partial<DailyMeta>;
    const date = typeof parsed.date === "string" ? parsed.date : today;
    if (date !== today) return empty(today);
    return {
      date: today,
      bestScore:
        typeof parsed.bestScore === "number" && Number.isFinite(parsed.bestScore)
          ? Math.max(0, Math.floor(parsed.bestScore))
          : 0,
      bestServed:
        typeof parsed.bestServed === "number" && Number.isFinite(parsed.bestServed)
          ? Math.max(0, Math.floor(parsed.bestServed))
          : 0,
    };
  } catch {
    return empty(today);
  }
}

export function writeDailyMeta(data: DailyMeta): void {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

/** Atualiza o melhor do dia (pontos = faturamento suave; clientes atendidos). */
export function recordDailyRun(score: number, served: number): DailyMeta {
  const cur = loadDailyMeta();
  const next: DailyMeta = {
    date: brtDateKey(),
    bestScore: Math.max(cur.bestScore, Math.max(0, Math.floor(score))),
    bestServed: Math.max(cur.bestServed, Math.max(0, Math.floor(served))),
  };
  writeDailyMeta(next);
  return next;
}

/**
 * Meta suave do dia: um pouco acima do melhor de hoje, ou base se ainda não jogou.
 * Não é hard-fail — só orientação PT-BR.
 */
export function softDailyTargets(daily: DailyMeta): { scoreGoal: number; servedGoal: number } {
  const scoreGoal =
    daily.bestScore > 0 ? Math.max(BASE_SCORE, daily.bestScore + 50) : BASE_SCORE;
  const servedGoal =
    daily.bestServed > 0 ? Math.max(BASE_SERVED, daily.bestServed + 1) : BASE_SERVED;
  return { scoreGoal, servedGoal };
}

export function dailyMetaLines(daily: DailyMeta): { today: string; soft: string } {
  const { scoreGoal, servedGoal } = softDailyTargets(daily);
  const today =
    daily.bestScore > 0 || daily.bestServed > 0
      ? `Hoje: melhor <b>${daily.bestScore}</b> pts · <b>${daily.bestServed}</b> clientes`
      : `Hoje: ainda sem expediente — meta suave te espera`;
  const soft = `Meta suave: <b>${scoreGoal}</b> pts · <b>${servedGoal}</b> clientes`;
  return { today, soft };
}
