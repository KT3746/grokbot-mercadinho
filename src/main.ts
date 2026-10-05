import "./style.css";
import { Game } from "./game/Game";

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
const ui = document.getElementById("ui");
if (!canvas || !ui) throw new Error("MERCADINHO: DOM incompleto");

const game = new Game(canvas, ui);
game.start();
if (import.meta.env.DEV) (window as unknown as { __MERC?: Game }).__MERC = game;
