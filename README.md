# MERCADINHO

Atenda o **MERCADINHO** antes da paciência da fila acabar. Jogo **original** no navegador — nenhuma marca real, mascote emprestado ou IP de terceiros.

**Jogar agora:** [https://kt3746.github.io/grokbot-mercadinho/](https://kt3746.github.io/grokbot-mercadinho/)

## Como jogar

1. Abra o link (ou rode localmente).
2. Toque ou clique uma vez para liberar o áudio (obrigatório no Safari do iPhone).
3. Toque em **Abrir a loja**.
4. Leia o recado e toque em **Entendi — abrir o caixa**. Enquanto o recado está aberto, a fila **não anda** e ninguém perde vida.
5. O cliente mostra o pedido num balão. Pegue o produto na prateleira e entregue nele.
6. Três clientes que vão embora furiosos encerram o expediente. O ritmo sobe a cada turno.

Dá para **tocar** o produto e depois o cliente, ou **arrastar** o item até a pessoa. Combo aumenta se você acerta em sequência. Produto errado zera o combo e come paciência.

Olho no sósia: **Refri** não é **Refri Zero**. **Detergente** não é **Amaciante**.

O jogo detecta celular e computador. No telefone, só o dedo. No desktop, mouse e teclado juntos.

## Controles

### Toque (iPhone / Android)

- Toque no produto para pegar.
- Toque no cliente para entregar.
- Arraste o produto até o cliente.
- **Na mão** mostra o item; **Soltar** (ou toque vazio) larga.
- **Pausa** e **Som** ficam no topo.

### Teclado (desktop)

| Ação | Teclas |
| --- | --- |
| Pegar produto | `1`–`8` (e `Q` `W` `E` `R` `A` `S` `D` `F`) |
| O `3` | pega o 3º item da prateleira — **nunca pausa** |
| Escolher cliente | `←` `→` (entrega no cliente com aquele id) |
| Entregar | Espaço ou Enter no cliente marcado |
| Soltar item | Esc (se a mão estiver ocupada), `X`, botão direito, ou **Soltar** no HUD |
| Pausar | Esc (mão vazia) ou o botão **Pausa** |
| Som | M |

## O que vai acontecendo

- **Turno 1** — recado inicial (tempo parado), depois um cliente por vez e paciência folgada.
- **Turno 2** — mais gente, produtos parecidos.
- **Turno 3** — pedidos longos e eventos de caos.
- **Hora extra** — a fila não fecha até três clientes pirarem.

Eventos: **apagão** (a loja escurece), **liquidação** (as prateleiras trocam de lugar), **gato** (bloqueia uma gôndola) e **hora do rush** (dois clientes de uma vez).

O recorde fica salvo neste navegador. O visual da loja é **3D baixo-poli** (Three.js no próprio repositório, sem CDN). Se o WebGL não ligar, o jogo segue no canvas 2D clássico.

## Rodar localmente

Precisa de Node 20+.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173/grokbot-mercadinho/` (o `base` do Vite é `/grokbot-mercadinho/`, o mesmo do GitHub Pages).

```bash
npm run build
npm run preview
```

## Publicação

O workflow em `.github/workflows/deploy.yml` gera o site e publica no GitHub Pages a cada push em `main`. Assets saem com hash no nome; o `index.html` leva um `build-id` e `dist/version.txt` com o commit — isso evita ficar preso numa versão antiga no cache.

Pages já está em **GitHub Actions**. Depois do merge em `main`, o endereço é [https://kt3746.github.io/grokbot-mercadinho/](https://kt3746.github.io/grokbot-mercadinho/). Se o navegador mostrar a versão antiga, abra com `?v=` + o SHA do commit (está em `dist/version.txt` e no meta `build-id` da página), por exemplo `https://kt3746.github.io/grokbot-mercadinho/?v=abc123`.

## Licença

MIT. Áudio é sintético (Web Audio). Nenhum sample protegido.
