export type ProductId =
  | "refri"
  | "refriZero"
  | "suco"
  | "leite"
  | "cremeLeite"
  | "agua"
  | "aguaGas"
  | "pao"
  | "biscoito"
  | "salgadinho"
  | "chocolate"
  | "ovos"
  | "macarrao"
  | "arroz"
  | "feijao"
  | "cafe"
  | "detergente"
  | "amaciante";

export type CustomerMood = "enter" | "wait" | "happy" | "leave" | "rage";

export type ChaosKind = "apagao" | "liquidacao" | "gato" | "rush";

export type View = "title" | "how" | "credits" | "shop" | "play" | "paused" | "over" | "summary" | "tutorial";

/** Uma entrada do Diário da esquina (últimos expedientes). */
export type RunRecord = {
  score: number;
  turno: number;
  stars: number;
  /** epoch ms; opcional em saves antigos */
  at?: number;
};

export type EquippedCosmetics = {
  sign: string;
  shelf: string;
  badge: string;
};

export type SaveData = {
  best: number;
  bestTurno: number;
  muted: boolean;
  seenHow: boolean;
  plays: number;
  /** Melhor estrelas num único expediente (soma dos turnos). */
  bestStars: number;
  /** Estrelas acumuladas em todos os expedientes. */
  totalStars: number;
  /** Até 5 últimos expedientes (mais recente primeiro). */
  history: RunRecord[];
  /** IDs de cosméticos já desbloqueados (persistidos). */
  unlockedCosmetics: string[];
  /** Seleção atual (só visuais). */
  equipped: EquippedCosmetics;
};

export type GoalKind = "serve" | "combo" | "clean";

export type TurnGoal = {
  kind: GoalKind;
  label: string;
  target: number;
  current: number;
  met: boolean;
};
