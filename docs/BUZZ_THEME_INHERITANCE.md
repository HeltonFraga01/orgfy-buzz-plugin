# Regra Canônica de Herança de Tema, Cores e Fontes no Buzz Desktop

Todo plugin do ecossistema OrgFy / Cortexx / NexusMind que roda dentro do **Buzz Desktop** DEVE herdar 100% da personalização de tema, cor de destaque (*accent*) e tipografia do Buzz em tempo real — sem cores primárias fixas (`#f59e0b`, `#22c55e`, `#ffffff`, etc.) e sem fontes inventadas.

---

## 1. Como o Buzz Desktop expõe o tema real

O Buzz aplica os atributos de tema diretamente em `document.documentElement`:

- `data-color-mode="dark" | "light"`
- `data-accent="bee" | "citrus" | "cobalt" | "iris" | "magenta" | "mono"`
- `data-color-level="touch" | "high"`

Esses atributos recalculam automaticamente os CSS Custom Properties oficiais definidos em `buzz-app/src/shared/design-system/styles/tokens.css`.

---

## 2. Tokens oficiais que DEVEM ser usados

### 2.1 Cor de Destaque (*Accent*) — NUNCA hardcode hex

| Papel visual | Token oficial do Buzz | Fallback seguro |
|---|---|---|
| Fundo de botão primário / toggle ativo / destaque 3D | `var(--affordance-accent-prominent, var(--accent-9, #3dd68c))` | `#3dd68c` |
| Hover de botão primário | `var(--affordance-accent-prominent-hover, var(--accent-10, #2fc87e))` | `#2fc87e` |
| Pressed de botão primário | `var(--affordance-accent-prominent-pressed, var(--accent-pressed, #27b370))` | `#27b370` |
| Texto/ícone sobre fundo primário (contraste automático claro/escuro por accent) | `var(--text-on-accent, var(--accent-contrast, #08120c))` | `#08120c` |
| Fundo suave (badges, cards selecionados, banners) | `var(--accent-3, rgba(61, 214, 140, 0.14))` | `rgba(61, 214, 140, 0.14)` |
| Borda suave de foco/seleção | `var(--accent-7, rgba(61, 214, 140, 0.42))` | `rgba(61, 214, 140, 0.42)` |
| Texto/ícone de destaque sobre fundo neutro | `var(--accent-link, var(--accent-11, var(--affordance-accent-prominent, #3dd68c)))` | `#3dd68c` |

### 2.2 Superfícies, Texto e Bordas

| Papel visual | Token oficial do Buzz |
|---|---|
| Fundo da página | `var(--bg-app, var(--surface-app))` |
| Fundo de cards / painéis | `var(--bg-panel, var(--surface-panel))` |
| Fundo rebaixado / inputs | `var(--surface-inset, var(--bg-app))` |
| Superfície interativa sutil / hover / selecionado | `var(--affordance-subtle)`, `var(--affordance-subtle-hover)`, `var(--affordance-selected)` |
| Texto primário / secundário / metadado | `var(--text-primary, var(--text-standard))`, `var(--text-secondary, var(--text-subtle))`, `var(--text-tertiary, var(--text-metadata))` |
| Borda padrão / proeminente | `var(--border-primary, var(--border-standard))`, `var(--border-prominent)` |

---

## 3. Tokens PROIBIDOS (erros históricos já corrigidos)

- **NUNCA usar `--accent-primary` ou `--brand-primary`**: esses tokens **não existem** no Buzz Desktop. Quando usados, caem no fallback hardcoded (por isso o Andar 3D ficava verde fixo mesmo com Buzz em Citrus/Cobalt/Iris).
- **NUNCA usar `--affordance-prominent` + `--text-on-prominent` em CTAs principais** quando a intenção é usar a cor personalizada do Buzz: `--affordance-prominent` é monocromático (branco/preto). Use `--affordance-accent-prominent` + `--text-on-accent`.
- **NUNCA usar `--green-11`, `#f59e0b` ou `rgba(245, 158, 11, ...)`** para controles de marca, toggles, bordas de seleção, chips ativos ou botões primários. Reserve âmbar/verde/vermelho **estritamente** para estados semânticos reais (alerta, sucesso de CI, erro/perigo).

---

## 4. Tipografia (Regra de Ouro)

- **NUNCA definir `font-family` customizada** (como `Inter`, `Geist` ou `system-ui` sobrescrevendo o host) no root do plugin.
- Use sempre `font-family: inherit` no container raiz e garanta `font-family: inherit; font-size: inherit;` em `button, input, select, textarea` (pois navegadores resetam a fonte de controles de formulário nativos).
- Use `font-variant-numeric: tabular-nums` em contadores, KPIs, preços e latências.

---

## 5. Regras para Shadow DOM e Canvas / Three.js

1. **Shadow DOM**: CSS Custom Properties atravessam a fronteira do Shadow DOM automaticamente. Mapeie seus tokens internos (`--primary`, `--primary-foreground`, `--primary-soft`, `--primary-border`, `--primary-text`) no `:host` diretamente para os tokens do Buzz da seção 2.1.
2. **Canvas / WebGL / Three.js (ex.: Andar 3D)**:
   - Leia a cor computada via `getComputedStyle(document.documentElement).getPropertyValue("--affordance-accent-prominent")` (com fallback `--accent-9` → `--primary`).
   - Detecte modo claro checando `root.dataset.colorMode === "light"` além de `classList.contains("light")` e `colorScheme === "light"`.
   - Observe mutações em `document.documentElement` com `MutationObserver({ attributes: true, attributeFilter: ["class", "style", "data-accent", "data-color-mode", "data-color-level"] })` para atualizar a cena 3D instantaneamente quando o usuário trocar o tema no Buzz.

---

## 6. Checklist rápido antes de subir qualquer PR de UI

- [ ] Nenhum `#f59e0b`, `#22c55e` ou `--green-11` em botões primários, toggles, bordas ativas ou banners de destaque.
- [ ] Nenhum `--accent-primary` ou `--brand-primary`.
- [ ] Botões primários usam `--affordance-accent-prominent` + `--text-on-accent` (contraste legível em Bee/Citrus/Cobalt/Iris/Magenta/Mono).
- [ ] `button, input, select, textarea` herdam `font-family: inherit; font-size: inherit;`.
- [ ] Trocar o accent nas configurações do Buzz reflete imediatamente em todas as abas e no Canvas 3D sem recarregar o plugin.
