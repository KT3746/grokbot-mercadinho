import { GAME_TITLE } from "../config";
import {
  BADGES,
  SHELVES,
  SIGNS,
  isCosmeticUnlocked,
  type CosmeticItem,
  type EquippedCosmetics,
} from "../data/cosmetics";
import type { RunRecord, SaveData, TurnGoal } from "../types";
import type { TurnSummary } from "../game/sim";

export type UiAction =
  | { type: "play" }
  | { type: "how" }
  | { type: "credits" }
  | { type: "shop" }
  | { type: "back" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "quit" }
  | { type: "retry" }
  | { type: "mute" }
  | { type: "menu" }
  | { type: "begin" }
  | { type: "tutorialNext" }
  | { type: "tutorialSkip" }
  | { type: "nextTurn" }
  | { type: "equip"; slot: "sign" | "shelf" | "badge"; id: string };

export class Screens {
  root: HTMLElement;
  onAction: (a: UiAction) => void = () => undefined;
  private lastFire = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement | null)?.closest("[data-act]") as HTMLElement | null;
      if (!t) return;
      const now = performance.now();
      if (now - this.lastFire < 220) return;
      this.lastFire = now;
      const act = t.dataset.act as UiAction["type"];
      if (act === "equip") {
        const slot = t.dataset.slot as "sign" | "shelf" | "badge" | undefined;
        const id = t.dataset.id;
        if (!slot || !id) return;
        if (t.classList.contains("locked") || (t as HTMLButtonElement).disabled) return;
        this.onAction({ type: "equip", slot, id });
        return;
      }
      this.onAction({ type: act });
    });
  }


  private diaryHtml(history: RunRecord[]): string {
    if (!history.length) return "";
    const rows = history
      .slice(0, 5)
      .map((r, i) => {
        const turnoLabel = r.turno >= 4 ? "hora extra" : `turno ${r.turno}`;
        const stars = r.stars > 0 ? "★".repeat(Math.min(r.stars, 9)) + (r.stars > 9 ? ` (${r.stars})` : "") : "—";
        let when = "";
        if (typeof r.at === "number" && r.at > 0) {
          try {
            when = new Date(r.at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
          } catch {
            when = "";
          }
        }
        return `<li class="diary-row">
            <span class="diary-rank">${i + 1}</span>
            <span class="diary-main"><b>${r.score}</b> pts · ${turnoLabel}</span>
            <span class="diary-stars" aria-label="${r.stars} estrelas">${stars}</span>
            ${when ? `<span class="diary-when">${when}</span>` : ""}
          </li>`;
      })
      .join("");
    return `<div class="diary premium-diary" aria-label="Diário da esquina">
        <div class="diary-head">
          <span class="eyebrow">Diário da esquina</span>
          <span class="diary-sub">Últimos expedientes</span>
        </div>
        <ol class="diary-list">${rows}</ol>
      </div>`;
  }

  private set(html: string): void {
    this.root.innerHTML = html;
  }

  title(muted: boolean, best: number, bestStars = 0, history: RunRecord[] = []): void {
    const starsLine =
      bestStars > 0 ? `<p class="best">Melhor estrelas: <b>${"★".repeat(Math.min(3, bestStars))}${bestStars > 3 ? ` (${bestStars})` : ""}</b></p>` : "";
    this.set(`
      <section class="screen title-screen">
        <div class="screen-body">
          <div class="topbar">
            <div class="brand">
              <div class="eyebrow">Lojinha de esquina</div>
              <h1>${GAME_TITLE}</h1>
              <p class="lede">Fila na porta. Produto certo na mão. Entrega antes da paciência estourar.</p>
              ${best > 0 ? `<p class="best">Recorde local: <b>${best}</b></p>` : ""}
              ${starsLine}
            </div>
            <button type="button" class="icon-btn mute-btn" data-act="mute" aria-label="${muted ? "Ativar som" : "Mudo"}">${muted ? "Som off" : "Som"}</button>
          </div>
          ${this.diaryHtml(history)}
        </div>
        <div class="screen-foot col">
          <button type="button" class="btn primary cta" data-act="play">Abrir a loja</button>
          <div class="row">
            <button type="button" class="btn ghost" data-act="shop">Loja da esquina</button>
            <button type="button" class="btn ghost" data-act="how">Como jogar</button>
            <button type="button" class="btn ghost" data-act="credits">Créditos</button>
          </div>
        </div>
      </section>`);
  }

  private cosmeticRow(title: string, items: readonly CosmeticItem[], equippedId: string, save: SaveData): string {
    const cards = items
      .map((c) => {
        const unlocked = isCosmeticUnlocked(c, save);
        const on = equippedId === c.id;
        const lock = unlocked ? "" : `<span class="cos-lock">${c.hint || "Bloqueado"}</span>`;
        return `<button type="button" class="cos-card${on ? " on" : ""}${unlocked ? "" : " locked"}" data-act="equip" data-slot="${c.slot}" data-id="${c.id}" ${unlocked ? "" : "disabled"} aria-pressed="${on}" aria-label="${c.name}">
          <span class="cos-swatch" style="--sw:${c.swatch}"></span>
          <span class="cos-meta"><b>${c.name}</b><small>${c.blurb}</small>${lock}</span>
        </button>`;
      })
      .join("");
    return `<div class="cos-section"><div class="cos-label">${title}</div><div class="cos-grid">${cards}</div></div>`;
  }

  shop(save: SaveData, equipped: EquippedCosmetics): void {
    this.set(`
      <section class="screen solid shop-screen">
        <div class="screen-body">
          <div class="eyebrow">Cosméticos · só visual</div>
          <h2>Loja da esquina</h2>
          <p class="lede">Desbloqueie com progresso. Sem paywall, sem mudar a dificuldade.</p>
          <div class="shop-panel premium-diary">
            ${this.cosmeticRow("Letreiro", SIGNS, equipped.sign, save)}
            ${this.cosmeticRow("Prateleira", SHELVES, equipped.shelf, save)}
            ${this.cosmeticRow("Crachá / avental", BADGES, equipped.badge, save)}
          </div>
        </div>
        <div class="screen-foot">
          <button type="button" class="btn primary" data-act="back">Voltar</button>
        </div>
      </section>`);
  }

  how(): void {
    this.set(`
      <section class="screen solid">
        <div class="screen-body">
          <div class="eyebrow">Manual do mercadinho</div>
          <h2>Como jogar</h2>
          <div class="sheet">
            <p><b>1.</b> O cliente chega com um (ou mais) produtos no balão.</p>
            <p><b>2.</b> Toque no produto na prateleira — ou arraste até a pessoa.</p>
            <p><b>3.</b> Toque no cliente para entregar. Errar gasta paciência e zera o combo.</p>
            <p><b>4.</b> Quatro clientes furiosos encerram o expediente. O ritmo sobe a cada turno.</p>
            <p><b>Metas:</b> cada turno tem 3 objetivos. Cumprir rende ★ estrelas no resumo.</p>
            <p><b>Celular:</b> só o dedo. Toque vazio ou <b>Soltar</b> larga o item. Use <b>1x/2x/3x</b> no topo pra acelerar.</p>
            <p><b>Computador:</b> clique, arraste, ou teclas <b>1–8</b> (e Q W E R) nos produtos. <b>3</b> pega o terceiro item, não pausa. ← → escolhe o cliente, <b>Espaço</b> entrega no cliente marcado, <b>Esc</b> solta o item (ou pausa se a mão estiver vazia), botão direito também solta, M muda o som. O botão <b>1x/2x/3x</b> acelera o expediente.</p>
            <p>Olho no sósia (forma + símbolo, não só cor): <b>Refri</b> ≠ <b>Zero</b>, <b>Leite</b> ≠ <b>Creme</b>, <b>Água</b> ≠ <b>c/ Gás</b>, <b>Detergente</b> ≠ <b>Amaciante</b>.</p>
          </div>
        </div>
        <div class="screen-foot">
          <button type="button" class="btn primary" data-act="back">Voltar</button>
        </div>
      </section>`);
  }

  credits(): void {
    this.set(`
      <section class="screen solid">
        <div class="screen-body">
          <div class="eyebrow">Ficha técnica</div>
          <h2>Créditos</h2>
          <div class="sheet">
            <p><b>${GAME_TITLE}</b> é um jogo original de atendimento no navegador. Nenhuma marca de mercado real, mascote emprestado ou IP de terceiros — só um mercadinho inventado e uma fila impaciente.</p>
            <p>Canvas 2D · TypeScript · Vite · áudio procedural (Web Audio). Feito para celular e computador.</p>
            <p>MIT · KT3746</p>
          </div>
        </div>
        <div class="screen-foot">
          <button type="button" class="btn primary" data-act="back">Voltar</button>
        </div>
      </section>`);
  }

  /** Tutorial guiado de 3 passos — só na primeira partida. */
  tutorial(step: number, touch: boolean): void {
    const steps = [
      {
        title: "A prateleira",
        body: touch
          ? "Toque o produto na prateleira (ou arraste até o cliente)."
          : "Clique o produto na prateleira (1–8 também pegam).",
        tip: "O pedido fica no balão da pessoa.",
        spot: "shelf",
      },
      {
        title: "Cuidado com sósias",
        body: "Sósias: Refri≠Zero, Leite≠Creme, Água≠c/Gás, Detergente≠Amaciante. Forma + símbolo.",
        tip: "Errar zera o combo e gasta paciência.",
        spot: "lookalike",
      },
      {
        title: "Acelerador 1x / 2x / 3x",
        body: "Botão 1x/2x/3x no HUD acelera o expediente quando estiver afiado.",
        tip: "Comece em 1x. Quatro vidas. Esc pausa · M muda o som.",
        spot: "speed",
      },
    ];
    const s = steps[Math.max(0, Math.min(2, step))]!;
    this.set(`
      <section class="overlay tutorial-overlay" data-spot="${s.spot}">
        <div class="tutorial-dim" aria-hidden="true"></div>
        <div class="panel tutorial-panel premium-panel">
          <div class="eyebrow">30s · ${step + 1}/3</div>
          <h2>${s.title}</h2>
          <p class="lede">${s.body}</p>
          <p class="tutorial-tip">${s.tip}</p>
          <div class="stack">
            <button type="button" class="btn primary cta" data-act="tutorialNext">${step >= 2 ? "Abrir o caixa" : "Próximo"}</button>
            <button type="button" class="btn ghost tutorial-skip" data-act="tutorialSkip">Já sei — pular</button>
          </div>
        </div>
      </section>`);
  }

  turnSummary(summary: TurnSummary): void {
    const stars = "★".repeat(summary.stars) + "☆".repeat(Math.max(0, 3 - summary.stars));
    const goalsHtml = summary.goals
      .map(
        (g: TurnGoal) =>
          `<li class="${g.met ? "met" : "miss"}"><span class="g-mark">${g.met ? "✓" : "✗"}</span> ${g.label}</li>`,
      )
      .join("");
    const nextLabel = summary.nextTurno >= 4 ? "Hora extra" : `Turno ${summary.nextTurno}`;
    this.set(`
      <section class="overlay summary-overlay">
        <div class="panel premium-panel summary-panel">
          <div class="eyebrow">Fim do turno ${summary.turno}</div>
          <h2 class="stars-line" aria-label="${summary.stars} estrelas">${stars}</h2>
          <p class="lede">${summary.stars === 3 ? "Expediente impecável." : summary.stars === 2 ? "Bom ritmo na esquina." : summary.stars === 1 ? "Deu pra manter a loja." : "O turno passou raspando."}</p>
          <ul class="goal-list">${goalsHtml}</ul>
          <div class="stack">
            <button type="button" class="btn primary cta" data-act="nextTurn">Seguir · ${nextLabel}</button>
            <p class="lede summary-hint">Toque em Seguir · Enter / Espaço também avança.</p>
          </div>
        </div>
      </section>`);
  }

  pause(muted: boolean): void {
    this.set(`
      <section class="overlay">
        <div class="panel premium-panel">
          <div class="eyebrow">Expediente interrompido</div>
          <h2>Pausa</h2>
          <p class="lede">A fila congelou. Você não.</p>
          <div class="stack">
            <button type="button" class="btn primary cta" data-act="resume">Continuar</button>
            <button type="button" class="btn" data-act="mute">${muted ? "Ativar som" : "Mudo"}</button>
            <button type="button" class="btn danger" data-act="quit">Fechar a loja</button>
          </div>
        </div>
      </section>`);
  }

  over(
    score: number,
    served: number,
    turno: number,
    best: number,
    isBest: boolean,
    runStars: number,
    bestStars: number,
    history: RunRecord[] = [],
  ): void {
    const starGlyph = runStars > 0 ? `<p><b>Estrelas:</b> ${"★".repeat(Math.min(runStars, 12))}${runStars > 12 ? ` (${runStars})` : ""}</p>` : "";
    this.set(`
      <section class="screen solid over-screen">
        <div class="screen-body">
          <div class="eyebrow">${isBest ? "Novo recorde da esquina" : "Caixa fechado"}</div>
          <h2>${score >= 2000 ? "Mercado com classe" : score >= 800 ? "Quase deu conta" : "A fila venceu"}</h2>
          <div class="sheet stats">
            <p><b>Pontos:</b> ${score}</p>
            <p><b>Clientes atendidos:</b> ${served}</p>
            <p><b>Turno:</b> ${turno === 4 ? "hora extra" : turno}</p>
            ${starGlyph}
            <p><b>Recorde:</b> ${best}</p>
            ${bestStars > 0 ? `<p><b>Melhor estrelas:</b> ${bestStars}</p>` : ""}
          </div>
          ${this.diaryHtml(history)}
        </div>
        <div class="screen-foot col">
          <button type="button" class="btn primary cta" data-act="retry">Outro expediente</button>
          <button type="button" class="btn ghost" data-act="menu">Menu</button>
        </div>
      </section>`);
  }
}
