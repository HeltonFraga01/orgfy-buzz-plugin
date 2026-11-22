# SPEC-ONDA-2 — Aba "Inteligência & Saúde" + Sidebar `#esteira-orgfy` + `artifactStorage`

**Versão:** 1.0  
**Escopo:** `orgfy-buzz-plugin` (`src/services/kpi-service.ts`, `src/components/IntelligenceTab.tsx`, `src/index.tsx`, `manifest.json`)  
**Dependência:** Contrato `kpis-esteira.json` da `SPEC-ONDA-1`

## 1. Objetivo
Transformar o `OrgFy Control Room` de uma fotografia estática de cards em um **painel de decisão orientado a melhoria contínua**, expondo os 4 pilares de alto sinal (Fluxo, Qualidade, Economia/ROI por Modelo e Higiene) tanto em uma aba dedicada quanto na sidebar do canal via API nativa do Buzz v1 (`ctx.panels.register` + `ctx.artifactStorage`).

## 2. Superfícies & Contratos Buzz v1
1. **`inject` atualizado em `src/index.tsx`:** adicionar `"panels"` e `"artifactStorage"` (com guard defensivo caso o host de teste não forneça o módulo, preservando 100% de retrocompatibilidade).
2. **Nova Tool de Agente (`orgfy_kpis`):**
   - Lê `/Users/heltonfraga/.buzz/.scratch/kpis-esteira.json` via `ctx.host.readFile`.
   - Se o arquivo estiver ausente ou desatualizado (>15 min) e `ctx.host.exec` estiver disponível, pode acionar `python3 scripts/gerar_kpis_esteira.py` sob demanda (com fallback limpo sem mock).
   - Retorna o JSON estruturado + histórico recente de snapshots salvo em `ctx.artifactStorage`.
3. **Aba `Inteligência` no `OrgFy Control Room`:**
   - **Bloco 1 — Fluxo & Gargalo de Revisão (DORA/Faros):** P50/P90 de espera em revisão, Lead Time, Taxa de Conflito e gráfico SVG nativo de 14 dias (Merges vs. Retrabalhos/Conflitos).
   - **Bloco 2 — Qualidade & Precisão:** FPY real vs. retrabalho, loops `revisao -> execucao` e conflitos de integração.
   - **Bloco 3 — Economia & ROI por Modelo (DX/Paperclip):** barra de consumo diário com marcações de **80% (alerta)** e **100% (trava)**, CPI real (tokens/card integrado), taxa de cache hit e tabela comparativa dos modelos NexusMind (`custo_usd`, `tokens`, `cache_hit_pct`, `latencia_media_ms`).
   - **Bloco 4 — Higiene Operacional:** contador de Orphan WIP (`bola == "nenhum"`), worktrees estagnados nível 2/3 e lista acionável de alertas ativos.
   - Botão **Recalcular KPIs agora** que executa o motor da Onda 1 e persiste um ponto na série temporal em `ctx.artifactStorage` (`orgfy-kpi-history`, retenção dos últimos 60 snapshots).
4. **Sidebar no Canal (`ctx.panels.register`):**
   - `id: "orgfy-channel-pulse"`, `channelPlacement: "side"`, `channelLauncher` com badge compacto.
   - Exibe em tempo real: status do orçamento (`OK | 80% | 100%`), FPY real, fila de revisão, Orphan WIP e alertas críticos ativos.

## 3. Critérios de Aceite (Gate L-22)
1. **Zero Hardcodes / Zero Mock:** quando `kpis-esteira.json` não existe, a aba e a tool `orgfy_kpis` exibem estado vazio explícito (`disponivel: false`), nunca números inventados.
2. **SVG Nativo Puro:** gráficos de tendência e medidor de orçamento renderizados em SVG puro (sem bibliotecas pesadas de chart), responsivos a tema claro/escuro usando tokens CSS do Buzz.
3. **Compatibilidade de Harness:** `verify_plugin.test.mjs` valida tanto o cenário positivo (`orgfy_kpis` com dados reais) quanto o cenário negativo (`failReads = true` -> `disponivel: false`).
4. **Build limpo:** `npm run build` (`tsc && vite build`) conclui com `0` erros TypeScript e gera `plugin.js` íntegro.
