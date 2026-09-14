import type { ProductId } from "../types";

export type Product = {
  id: ProductId;
  name: string;
  short: string;
  shelf: string;
  color: string;
  lookalike?: ProductId;
  unlock: number;
};

export type Archetype = {
  id: string;
  name: string;
  shirt: string;
  hair: string;
  skin: string;
  hairStyle: "short" | "bun" | "bald" | "puff" | "side" | "cap";
  arrive: string[];
  wait: string[];
  wrong: string[];
  thanks: string[];
  rage: string[];
};

export const PRODUCTS: readonly Product[] = [
  { id: "refri", name: "Refri Guaraná", short: "Refri", shelf: "Geladeira", color: "#3d8f4a", lookalike: "refriZero", unlock: 1 },
  { id: "refriZero", name: "Refri Zero", short: "Zero", shelf: "Geladeira", color: "#1f3d28", lookalike: "refri", unlock: 2 },
  { id: "suco", name: "Suco de Caixinha", short: "Suco", shelf: "Geladeira", color: "#e07a2a", unlock: 1 },
  { id: "leite", name: "Leite Caixinha", short: "Leite", shelf: "Geladeira", color: "#f6f3ea", lookalike: "cremeLeite", unlock: 1 },
  { id: "cremeLeite", name: "Creme de Leite", short: "Creme", shelf: "Geladeira", color: "#e8d4a8", lookalike: "leite", unlock: 3 },
  { id: "agua", name: "Água Mineral", short: "Água", shelf: "Geladeira", color: "#4d8fbf", lookalike: "aguaGas", unlock: 2 },
  { id: "aguaGas", name: "Água com Gás", short: "c/ Gás", shelf: "Geladeira", color: "#2a6f9a", lookalike: "agua", unlock: 3 },
  { id: "pao", name: "Pão Francês", short: "Pão", shelf: "Padaria", color: "#e8c49a", unlock: 1 },
  { id: "biscoito", name: "Biscoito Recheado", short: "Biscoito", shelf: "Doces", color: "#c4491d", unlock: 1 },
  { id: "salgadinho", name: "Salgadinho", short: "Salgad.", shelf: "Salgados", color: "#e3b23c", unlock: 1 },
  { id: "chocolate", name: "Barra de Chocolate", short: "Chocolate", shelf: "Doces", color: "#6b3a24", unlock: 2 },
  { id: "ovos", name: "Ovos (dúzia)", short: "Ovos", shelf: "Geladeira", color: "#f0e6c8", unlock: 2 },
  { id: "macarrao", name: "Macarrão", short: "Macarrão", shelf: "Secos", color: "#f0c44c", unlock: 1 },
  { id: "arroz", name: "Arroz 1kg", short: "Arroz", shelf: "Secos", color: "#f6f3ea", unlock: 2 },
  { id: "feijao", name: "Feijão 1kg", short: "Feijão", shelf: "Secos", color: "#8a4a2a", unlock: 3 },
  { id: "cafe", name: "Café Torrado", short: "Café", shelf: "Secos", color: "#7a1f16", unlock: 2 },
  { id: "detergente", name: "Detergente", short: "Deterg.", shelf: "Limpeza", color: "#3b6fb6", lookalike: "amaciante", unlock: 1 },
  { id: "amaciante", name: "Amaciante", short: "Amac.", shelf: "Limpeza", color: "#e07a8d", lookalike: "detergente", unlock: 2 },
];

export const PRODUCT_BY_ID: Record<ProductId, Product> = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p]),
) as Record<ProductId, Product>;

export function productsUnlocked(turno: number): Product[] {
  return PRODUCTS.filter((p) => p.unlock <= turno);
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "neuza",
    name: "Dona Neuza",
    shirt: "#c4491d",
    hair: "#2a1d12",
    skin: "#d8a07a",
    hairStyle: "bun",
    arrive: ["Menino, é o da lista.", "Não me faça repetir."],
    wait: ["A fila não perdoa.", "Eu tenho feijão no fogo."],
    wrong: ["Isso não é o que eu pedi.", "Quase. Quase não serve."],
    thanks: ["Assim, sim. Até amanhã.", "Rápido. Gostei."],
    rage: ["Vou no outro balcão. O imaginário.", "Cansei. Tchau."],
  },
  {
    id: "caco",
    name: "Caco da Bike",
    shirt: "#2f6b4f",
    hair: "#1a120c",
    skin: "#c6865a",
    hairStyle: "cap",
    arrive: ["Rápido que o sinal abre.", "É pra levar na bagagem."],
    wait: ["A fila tá pensando em derreter.", "Buzinei sem querer. Foi o nervoso."],
    wrong: ["Não era esse, chefia.", "Quase atropelo o pedido."],
    thanks: ["Valeu. Pedalei pra cá.", "Isso. Tô pago."],
    rage: ["Perdi o sinal. E a paciência.", "Vou de fome. De bike."],
  },
  {
    id: "armando",
    name: "Seu Armando",
    shirt: "#3b4a6b",
    hair: "#cfc6b8",
    skin: "#e2b896",
    hairStyle: "bald",
    arrive: ["Sem pressa. Mentira: com pressa.", "O de sempre. O de hoje."],
    wait: ["No meu tempo o pão chegava quente.", "Estou meditanto na fila. Não estou."],
    wrong: ["Errou com classe.", "Isso aí é outro planeta."],
    thanks: ["Serviço digno de esquina.", "Anotado. Mentalmente."],
    rage: ["Vou reclamar no caderninho.", "Fechei a conta. A da paciência."],
  },
  {
    id: "lila",
    name: "Lila",
    shirt: "#7a4aa8",
    hair: "#3b2218",
    skin: "#f0c9a8",
    hairStyle: "puff",
    arrive: ["Isso aqui é conteúdo.", "Me dá o mais amarelo da prateleira. Brincadeira. Esse."],
    wait: ["Tô narrando a espera.", "A luz do balcão tá ótima. A fila, não."],
    wrong: ["Corte. Take dois.", "Produto errado, vibe errada."],
    thanks: ["Postei. Mentira, só agradeço.", "Caos com qualidade."],
    rage: ["Desligo a câmera. E o humor.", "Foi mal, loja. Foi mal, eu."],
  },
  {
    id: "cida",
    name: "Tia Cida",
    shirt: "#d48a2a",
    hair: "#5a3a28",
    skin: "#c98b62",
    hairStyle: "side",
    arrive: ["Só um item. Só. Talvez dois.", "Meu Deus, a fila."],
    wait: ["Eu só queria pão.", "Conta até dez. Cheguei no vinte."],
    wrong: ["Ai, filho. Não.", "Esse é o primo do que eu pedi."],
    thanks: ["Beijo na testa. Sem contato.", "Você salvou o jantar."],
    rage: ["Vou fazer miojo sem miojo.", "Cansei de ser educada."],
  },
  {
    id: "juca",
    name: "Juca Estagiário",
    shirt: "#4d8fbf",
    hair: "#2c2118",
    skin: "#e8c4a0",
    hairStyle: "short",
    arrive: ["O chefe mandou comprar isso. Acho.", "Se errar, a culpa é do balcão."],
    wait: ["Tô no expediente. Da vida.", "O Slack tá piscando. Ignoro."],
    wrong: ["O relatório vai ficar feio.", "Troca? Sem nota fiscal emocional."],
    thanks: ["Missão cumprida. Quase.", "Vou fingir que foi estratégico."],
    rage: ["Vou dizer que a loja fechou.", "Meu estágio acabou. O humor também."],
  },
  {
    id: "nelio",
    name: "Vovô Nélio",
    shirt: "#6b7a3a",
    hair: "#d9d3c7",
    skin: "#d2a07a",
    hairStyle: "bald",
    arrive: ["Bom dia. Ou tarde. Enfim.", "Tem o de sempre? Tem o de agora."],
    wait: ["Eu tenho tempo. A paciência, não.", "Conta piada na fila. Ninguém ri. Eu rio."],
    wrong: ["Quase, neto. Quase.", "Esse não. O outro outro."],
    thanks: ["Serviço de esquina antiga.", "Vou contar no bar. O elogio."],
    rage: ["No meu tempo isso não passava.", "Vou sentar lá fora. De raiva."],
  },
  {
    id: "bia",
    name: "Bia do PIX",
    shirt: "#c45c7a",
    hair: "#1e1612",
    skin: "#8d5524",
    hairStyle: "bun",
    arrive: ["É no PIX. O pedido, não o sentimento.", "Rápido que o QR some."],
    wait: ["Caiu a conexão. A da paciência.", "Tô transferindo boa vontade."],
    wrong: ["Estorno emocional.", "Código errado. Produto errado."],
    thanks: ["Pago e feliz.", "PIX confirmado. Sorriso também."],
    rage: ["Cancelo a transferência de humor.", "Vou no app do concorrente. O imaginário."],
  },
  {
    id: "ravi",
    name: "Ravi",
    shirt: "#2a6f6b",
    hair: "#24180f",
    skin: "#b06a3c",
    hairStyle: "short",
    arrive: ["Lista mental. Confia.", "Não esquece o gelado."],
    wait: ["Tô bem. Tô mentindo.", "A música ambiente sou eu resmungando."],
    wrong: ["Recalculando a lista.", "Esse eu já tenho. Em outro universo."],
    thanks: ["Fechou. Literalmente.", "Caos: 0. Você: 1."],
    rage: ["Vou respirar na calçada.", "A lista venceu. Eu não."],
  },
  {
    id: "duda",
    name: "Duda",
    shirt: "#e07a8d",
    hair: "#4a2e1c",
    skin: "#f3c7a4",
    hairStyle: "puff",
    arrive: ["Se tiver o amarelo, eu levo o amarelo.", "Promoção de paciência: acabou."],
    wait: ["Tô na fila e na filosofia.", "Conta os azulejos. Tem vinte."],
    wrong: ["Quase uma vitória.", "Produto sósia. Eu vi."],
    thanks: ["Você é o funcionário do mês. Do minuto.", "Levo e recomendo. Baixinho."],
    rage: ["Vou fazer cara de paisagem.", "Foi bonito enquanto durou."],
  },
];

export function archetypeById(id: string): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0]!;
}

/** Frases curtas ocasionais (balão de fala) — não spam. */
export const IDLE_CHAT = [
  "Hmm…",
  "Só um minutinho.",
  "Olha a fila.",
  "Tô de boa. Quase.",
  "Cadê o certo?",
];

export const TOASTS = {
  wrong: ["Ops. Era o outro.", "Quase. O primo do pedido.", "Produto sósia. Tenta de novo."],
  nice: ["Isso.", "Segue o ritmo.", "Balcão quente."],
  combo: ["Combo!", "Tá voando!", "Caos controlado!"],
  rage: ["Cliente foi embora.", "A porta bateu. A paciência também."],
  gato: ["O gato da loja assumiu a prateleira.", "Miau. Tradução: não agora."],
  apagao: ["Apagão na esquina. Os rótulos ainda valem.", "Luz fraca, pedido igual."],
  liquidacao: ["Liquidação: as coisas trocaram de lugar.", "Prateleira embaralhada. Olha com carinho."],
  rush: ["Hora do rush. Respire. Depois atenda.", "Dois de uma vez. Clássico."],
};

export const SHIFT_LINES = [
  "Turno 1 — A loja acabou de abrir.",
  "Turno 2 — A fila descobriu a porta.",
  "Turno 3 — Paciência em promoção (acabando).",
  "Hora extra — Ninguém vai embora. Quase.",
];
