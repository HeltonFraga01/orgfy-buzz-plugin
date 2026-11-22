# OrgFy Control Room / Cockpit (Buzz Desktop Plugin)

Plugin nativo oficial do **OrgFy Control Room** para o Buzz Desktop (`digital.cortexx.orgfy`).
Desenvolvido para governança determinística, observabilidade em tempo real e orquestração autônoma da esteira OrgFy v10 na Holding Cortexx e suas verticais de negócio (`orgfy`, `lumen-iptv`, `saas-tributario`).

---

## 🏛️ A Tríade Soberana de Design System

Projetado em conformidade estrita com os padrões arquiteturais do fundador Helton Fraga:
- **Oceano Esmeralda (`bg-sidebar`)**: Fundo imersivo com gradiente radial verde-escuro profundo (`#0d1a14` a `#080d0b`), banhando as superfícies com gutters respiráveis de 12px e anulação de caixas opacas (`data-project-context-detached="true"`).
- **Ilha Central Flutuante (`rounded-2xl`)**: Live Pipeline Matrix exibindo as **5 Raias Determinísticas** da esteira v10:
  1. *Triagem & Backlog* (`kind:1621`)
  2. *Despachados & Alocados* (Tier CoEvo-RSI: Tier 1 Barato, Tier 2 Revisor, Tier 3 Arquiteto)
  3. *Em Execução* (Workers Headless efêmeros com logs de console streaming)
  4. *Em Revisão* (Gate Caixa-Preta com probes Caddy, Supabase RLS e Playwright)
  5. *Concluído / FPY* (Commits integrados na branch `main`)
- **Costa Direita Utilitária (Zero Card-ception)**: Métricas EVM (CPI de tokens, Circuit Breaker contra loops), Catraca Probatória RSI (Harness² com janela de 10 cards) e Detector Preditivo DSAP na 2ª recusa.
- **Ilha do Copiloto Sagrado**: Gaveta flutuante com seletor de personificação no topo (`OrgFy Iris [CEO]`, `OrgFy Bento [COO]`, `OrgFy Bento Arquiteto` e `QA Sentinel`) e micro-comandos de terminal (`/status`, `/despachar`, `/gate`, `/rsi`).

---

## 🔒 Invariantes Determinísticas e Governança

- **Regra L-01 (Bloqueio Mecânico)**: O agente selecionado como executor é desabilitado programaticamente na lista de revisores, impedindo auto-aprovação de PRs.
- **Regra L-90 (Catraca de Não Regressão)**: Regras probatórias são monitoradas durante uma janela probatória de 10 cards, revertendo automaticamente em caso de queda de FPY.
- **Detector Preditivo DSAP**: Analisa em tempo real a similaridade semântica da justificativa de recusa. Se a repetição do erro for `>= 0.70`, dispara alerta sonoro/visual de `[DSAP BACKTRACKING]` para o COO re-escopar o card.

---

## 📦 Compilação e Deploy

```bash
# Compilar TypeScript e Vite bundle
pnpm build

# Validar contrato Buzz Cordis
python3 ~/.buzz/.agents/skills/buzz-plugin-authoring/scripts/validate_buzz_plugin.py .
```
