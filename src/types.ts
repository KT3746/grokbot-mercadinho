export type ProductId =
  | "refri"
  | "refriZero"
  | "suco"
  | "leite"
  | "agua"
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

export type View = "title" | "how" | "credits" | "play" | "paused" | "over" | "summary" | "tutorial";

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
};

export type GoalKind = "serve" | "combo" | "clean";

export type TurnGoal = {
  kind: GoalKind;
  label: string;
  target: number;
  current: number;
  met: boolean;
};
