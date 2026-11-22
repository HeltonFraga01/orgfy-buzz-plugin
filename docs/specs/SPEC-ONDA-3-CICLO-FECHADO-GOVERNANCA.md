# SPEC-ONDA-3 — Ciclo Fechado de Governança (Lock Atômico, Budget 80%/100%, Hooks, Wake & Notificações)

**Versão:** 1.0  
**Escopo:** `orgfy-buzz-plugin` (`src/services/governance-engine.ts`, `src/index.tsx`, `manifest.json`, `verify_plugin.test.mjs`)  
**Dependências:** `SPEC-ONDA-1`, `SPEC-ONDA-2` e API Buzz v1 (`agents.registerHook`, `agents.wake`, `notifications.register`, `decisions.decide`)

## 1. Objetivo
Importar os diferenciais de governança operacional do Paperclip (teto de gasto 80%/100% com trava e checkout atômico) e conectá-los às APIs nativas do Buzz v1 para que o OrgFy reaja automaticamente a anomalias sem intervenção humana constante.

## 2. Componentes de Governança Ativa (`src/services/governance-engine.ts`)
1. **Checkout Atômico de Tarefas (`orgfy_checkout_lock`):**
   - Mantém registro de locks ativos em `/Users/heltonfraga/.buzz/.scratch/orgfy-locks.json` (com TTL configurável, padrão `30 min`) e em memória.
   - `acquireLock(issueId, agentKey, ttlMs)`: falha deterministicamente (`LOCK_CONFLICT`) se outro agente já detém lock válido para o mesmo `issueId`, impedindo trabalho duplicado e queima dupla de tokens.
   - `releaseLock(issueId, agentKey)` e `listLocks()`: liberação explícita ou expiração automática por TTL.
   - Integrado ao MCP `orgfy_despachar`: recusa dispatch duplicado se o card já estiver bloqueado por outro executor ativo.
2. **Guardrail Econômico 80% / 100% (Estilo Paperclip):**
   - Avalia `economia.uso_teto_diario_pct` (e override manual do board).
   - **>= 80% e < 100% (`ALERTA_80`):** emite notificação nativa (`ctx.notifications`) uma vez por ciclo e marca alerta no Control Room.
   - **>= 100% (`BLOQUEADO_100`):** bloqueia novos dispatches automáticos via `orgfy_despachar` (retornando erro claro `BUDGET_HARD_CAP_REACHED`), exceto quando `boardOverride: true` for informado explicitamente pelo operador humano.
3. **Hooks de Agentes + Despertar Autônomo (`registerHook` + `wake`):**
   - Registra hook defensivo (`ctx.agents.registerHook`) quando disponível no host para monitorar conclusão de turnos e acionar avaliação de SLA de revisão/conflito.
   - Exposição da tool `orgfy_governanca_avaliar({ dryRun?, autoWake? })`: avalia os KPIs reais (orçamento 80%/100%, fila de revisão acima do SLA, estagnação nível 3, locks expirados), emite notificações nativas quando necessário e, se `autoWake: true`, aciona `ctx.agents.wake` com cooldown anti-spam (mínimo 15 min por chave).
4. **Lint Semântico de Card via `ctx.decisions.decide`:**
   - Exposição da tool `orgfy_lint_card({ issueId, titulo, acceptanceCommand, descricao })`: usa `ctx.decisions.decide` (quando disponível no host) com fallback determinístico local para validar se o card possui critério de aceite verificável (L-22) e escopo atômico antes do despacho.

## 3. Critérios de Aceite (Gate L-22)
1. **Atomicidade de Lock:** dois chamadores tentando `acquireLock("CARD-X", "agent-a")` e `acquireLock("CARD-X", "agent-b")` resultam em sucesso para `agent-a` e `LOCK_CONFLICT` para `agent-b`; após `releaseLock` ou expiração do TTL, `agent-b` consegue adquirir.
2. **Budget Hard Cap 100% + Override:** com orçamento >= 100%, `evaluateBudgetGate` bloqueia dispatch padrão e libera somente com `boardOverride: true`.
3. **Cooldown Anti-Spam de Wake/Notificação:** duas avaliações consecutivas dentro da janela de cooldown não disparam alertas ou `wake` duplicados.
4. **Testes Automatizados Verdes:** `node verify_plugin.test.mjs` testa todas as tools (`orgfy_status`, `orgfy_kanban_read`, `orgfy_kpis`, `orgfy_checkout_lock`, `orgfy_governanca_avaliar`, `orgfy_lint_card`) e `npm run build` compila limpo.
