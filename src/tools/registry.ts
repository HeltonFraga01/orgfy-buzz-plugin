// ─────────────────────────────────────────────────────────────────────────────
// ORGFY UNIFIED TOOL REGISTRY (v13 — SINGLE SOURCE OF TRUTH)
// Fonte única para todas as 16 ferramentas OrgFy, servindo simultaneamente:
// 1. Buzz Harness AgentTools (ctx.agents.addTool)
// 2. Servidor MCP Nativo JSON-RPC 2.0 (ctx.host.serveMcp)
// Instrumentado automaticamente com spans OTel GenAI (execute_tool).
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import {
  executeDespachar,
  executeGate,
  executePorteiroSync,
  buildOrgfyStatus,
  fetchLiveKanbanSnapshot,
} from "../services/orgfy-bridge";
import {
  fetchKpisEsteira,
  fetchGooseLoopRadar,
  filterGooseLoopRadar,
  recalculateKpisNow,
} from "../services/kpi-service";
import {
  acquireCheckoutLock,
  releaseCheckoutLock,
  listActiveLocks,
  evaluateBudgetGate,
  evaluateGovernanceAndReact,
  lintCardForDispatch,
  bindConversationContextForCard,
  stopAgentSession,
} from "../services/governance-engine";
import { requestModelFailover, reconcileAgentsViaBuzzApi } from "../services/model-failover";
import { fetchResolvedArchive, searchResolvedArchive } from "../services/resolved-archive";
import { createCanonicalCard } from "../services/card-creator";
import { executeCardProgress } from "../services/card-progress";
import {
  triageCardWithDecisions,
  triageDiffWithDecisions,
  buildBuzzAttentionContract,
} from "../services/decision-router";
import {
  buildLiveAgentRoster,
  buildHandoffPack,
  runOneShotDecisionDispatch,
  cleanupAttentionOnStageChange,
  emitOrgfyPipelineEvent,
} from "../services/presence-dispatcher";
import { getOrgfyCrdtStore } from "../services/orgfy-crdt-store";
import { sendDesktopNotification } from "../services/mcp-server";
import { recordGenAISpan } from "../services/telemetry-otel";

export interface UnifiedOrgfyTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (args: any, meta?: { client?: any; context?: any }) => Promise<{ text: string; isError?: boolean }>;
}

/**
 * Constrói o catálogo unificado de 16 ferramentas do OrgFy Control Room v13.
 */
export function buildUnifiedOrgfyTools(ctx: Context | any): UnifiedOrgfyTool[] {
  const rawTools: UnifiedOrgfyTool[] = [
    {
      name: "orgfy_status",
      description:
        "Retorna a telemetria em tempo real da esteira OrgFy com cards_por_raia derivados do Kanban real e métricas de placar/runtime separadas (sem fallbacks hardcoded).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
        },
      },
      execute: async (args) => {
        const status = await buildOrgfyStatus(ctx, args?.empresa || "orgfy");
        return { text: JSON.stringify(status, null, 2) };
      },
    },
    {
      name: "orgfy_kanban_read",
      description:
        "Lê a matriz Kanban real da esteira OrgFy categorizada pelas 5 raias determinísticas (triagem, despachado, execucao, revisao, feito), sem fallback para cards mockados.",
      inputSchema: {
        type: "object",
        properties: {
          stage: { type: "string", description: "'triagem' | 'despachado' | 'execucao' | 'revisao' | 'feito' | 'all'" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
        },
      },
      execute: async (args) => {
        const snapshot = await fetchLiveKanbanSnapshot(ctx, {
          stage: args?.stage || "all",
          empresa: args?.empresa || "orgfy",
        });
        const summarized = snapshot.cards.map((c) => ({
          id: c.id,
          issueId: c.issueId,
          fullIssueId: c.fullIssueId,
          title: c.title,
          stage: c.stage,
          priority: c.priority,
          empresa: c.empresa,
          executor: c.executor,
          revisor: c.revisor ?? null,
          decisor: c.decisor ?? null,
          acceptanceCommand: c.acceptanceCommand ?? null,
          acceptanceHash: c.acceptanceHash ?? null,
          worktreePath: c.worktreePath ?? null,
          objetivo: c.objetivo ?? null,
          feitoQuando: c.feitoQuando ?? null,
          provaExigida: c.provaExigida ?? null,
          deepLink: `buzz://issue?id=${c.fullIssueId || c.issueId}&owner=${c.owner || "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20"}&d=${c.empresa || "orgfy"}`,
        }));
        return {
          text: JSON.stringify(
            {
              ok: snapshot.ok,
              error: snapshot.error,
              sources: snapshot.sources,
              total: summarized.length,
              cards: summarized,
            },
            null,
            2
          ),
          isError: !snapshot.ok,
        };
      },
    },
    {
      name: "orgfy_despachar",
      description:
        "Despacha um card de issue para execução em worktree isolado, validando Hard Cap orçamentário (100%), checkout lock atômico e retornando o contrato nativo Buzz Attention/Watch.",
      inputSchema: {
        type: "object",
        properties: {
          issue_id: { type: "string", description: "Identificador curto ou completo da issue (ex: '5c569a9e')" },
          issueId: { type: "string", description: "Alias camelCase para issue_id" },
          executor: { type: "string", description: "Nome do agente executor (ex: 'OrgFy Val')" },
          revisor: { type: "string", description: "Nome do agente revisor independente (L-01)" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
          board_override: { type: "boolean", description: "Autorização explícita do board para ultrapassar 100% do teto" },
        },
        required: ["issue_id", "executor", "revisor"],
      },
      execute: async (args) => {
        const issueId = String(args?.issue_id || args?.issueId || "").trim();
        const executor = String(args?.executor || "").trim();
        const revisor = String(args?.revisor || "").trim();
        if (!issueId || !executor || !revisor) {
          return { text: "Erro: issue_id, executor e revisor são obrigatórios.", isError: true };
        }

        const kpiRes = await fetchKpisEsteira(ctx);
        const budgetGate = evaluateBudgetGate(kpiRes.kpis, Boolean(args?.board_override));
        if (!budgetGate.allowed) {
          return {
            text: JSON.stringify({ status: "blocked", code: "BUDGET_HARD_CAP_REACHED", budgetGate }, null, 2),
            isError: true,
          };
        }

        const lockRes = await acquireCheckoutLock(ctx, issueId, executor, 60);
        if (!lockRes.ok) {
          return {
            text: JSON.stringify(
              { status: "blocked", code: lockRes.code, message: lockRes.message, lock: lockRes.lock },
              null,
              2
            ),
            isError: true,
          };
        }

        const res = await executeDespachar(ctx, {
          empresa: args?.empresa || "orgfy",
          issueId,
          executor,
          revisor,
        });
        if (res.code !== 0) {
          await releaseCheckoutLock(ctx, issueId, executor, true);
        }
        const attentionContract = buildBuzzAttentionContract({
          slug: issueId.slice(0, 24),
          titulo: `Issue ${issueId}`,
          executor,
          revisor,
          policy: "event_driven",
        });
        return {
          text: JSON.stringify(
            {
              status: res.code === 0 ? "ok" : "error",
              exitCode: res.code,
              budgetGate,
              lock: res.code === 0 ? lockRes.lock : null,
              lockReleasedOnFailure: res.code !== 0,
              attentionContract: res.code === 0 ? attentionContract : null,
              output: res.output,
            },
            null,
            2
          ),
          isError: res.code !== 0,
        };
      },
    },
    {
      name: "orgfy_gate",
      description:
        "Aplica o Gate Caixa-Preta da esteira OrgFy a um PR (aceito ou recusado) com validação de probes e checagem DSAP.",
      inputSchema: {
        type: "object",
        properties: {
          pr_id: { type: "string", description: "ID ou hash do PR" },
          prId: { type: "string", description: "Alias camelCase para pr_id" },
          decisao: { type: "string", enum: ["aceito", "recusado"] },
          acao: { type: "string", enum: ["aceito", "recusado"] },
          motivo: { type: "string", description: "Justificativa técnica" },
          revisor: { type: "string", description: "Nome do revisor independente" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
        },
        required: ["pr_id", "decisao"],
      },
      execute: async (args) => {
        const prId = String(args?.pr_id || args?.prId || "").trim();
        const acao = String(args?.decisao || args?.acao || "").trim();
        if (!prId || (acao !== "aceito" && acao !== "recusado")) {
          return { text: "Erro: pr_id e decisao ('aceito' | 'recusado') são obrigatórios.", isError: true };
        }
        const res = await executeGate(ctx, {
          empresa: args?.empresa || "orgfy",
          prId,
          acao: acao as "aceito" | "recusado",
          motivo: args?.motivo || "Decisão emitida via OrgFy Control Room",
          revisor: args?.revisor || "QA Sentinel",
        });
        let attentionCleanup = null;
        if (res.code === 0 && acao === "aceito") {
          attentionCleanup = await cleanupAttentionOnStageChange(ctx, {
            issueId: prId,
            newStage: "feito",
            empresa: args?.empresa || "orgfy",
          });
        }
        return {
          text: JSON.stringify({ status: res.code === 0 ? "ok" : "error", exitCode: res.code, attentionCleanup, output: res.output }, null, 2),
          isError: res.code !== 0,
        };
      },
    },
    {
      name: "orgfy_porteiro_sync",
      description: "Dispara uma rodada determinística do Porteiro (porteiro.py --uma-vez) para reconciliar eventos Nostr e PRs.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
        },
      },
      execute: async (args) => {
        const res = await executePorteiroSync(ctx, { empresa: args?.empresa || "orgfy" });
        return {
          text: JSON.stringify({ status: res.code === 0 ? "ok" : "error", exitCode: res.code, output: res.output }, null, 2),
          isError: res.code !== 0,
        };
      },
    },
    {
      name: "orgfy_kpis",
      description:
        "Retorna os KPIs determinísticos reais da esteira OrgFy (Fluxo, Qualidade, Economia, Higiene e Alertas) a partir de kpis-esteira.json.",
      inputSchema: {
        type: "object",
        properties: {
          recalcular: { type: "boolean", description: "Se true, recalcula antes de ler" },
        },
      },
      execute: async (args) => {
        let recalcOutput: string | null = null;
        if (args?.recalcular) {
          const recalc = await recalculateKpisNow(ctx);
          recalcOutput = recalc.output;
        }
        const res = await fetchKpisEsteira(ctx);
        return {
          text: JSON.stringify(
            {
              disponivel: res.disponivel,
              error: res.error,
              recalcOutput,
              kpis: res.kpis,
              history_points: res.history.length,
            },
            null,
            2
          ),
          isError: !res.disponivel,
        };
      },
    },
    {
      name: "orgfy_checkout_lock",
      description: "Gerencia locks atômicos de checkout por issue_id Nostr (64 hex): action 'acquire' | 'release' | 'list'.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["acquire", "release", "list"] },
          issue_id: { type: "string" },
          agent_id: { type: "string" },
          ttl_minutes: { type: "number" },
          title: { type: "string" },
          owner: { type: "string" },
          revisor: { type: "string" },
          acceptance_command: { type: "string" },
          branch: { type: "string" },
          exclusive_paths: { type: "array", items: { type: "string" }, description: "Paths de Escrita exclusiva para detectar colisão paralela (WRITE_SET_CONFLICT)" },
        },
        required: ["action"],
      },
      execute: async (args) => {
        const action = args?.action;
        if (action === "list") {
          const locks = await listActiveLocks(ctx);
          return { text: JSON.stringify({ ok: true, total: locks.length, locks }, null, 2) };
        }
        if (action === "acquire") {
          if (!args?.issue_id || !args?.agent_id) {
            return { text: JSON.stringify({ ok: false, code: "MISSING_FIELDS" }, null, 2), isError: true };
          }
          const res = await acquireCheckoutLock(ctx, args.issue_id, args.agent_id, args?.ttl_minutes || 60, Date.now(), {
            title: args?.title,
            owner: args?.owner,
            revisor: args?.revisor,
            acceptanceCommand: args?.acceptance_command,
            branch: args?.branch,
            exclusivePaths: Array.isArray(args?.exclusive_paths) ? args.exclusive_paths : undefined,
          });
          return { text: JSON.stringify(res, null, 2), isError: !res.ok };
        }
        if (action === "release") {
          if (!args?.issue_id) {
            return { text: JSON.stringify({ ok: false, code: "MISSING_FIELDS" }, null, 2), isError: true };
          }
          const res = await releaseCheckoutLock(ctx, args.issue_id, args?.agent_id);
          return { text: JSON.stringify(res, null, 2), isError: !res.ok };
        }
        return { text: JSON.stringify({ ok: false, code: "INVALID_ACTION" }, null, 2), isError: true };
      },
    },
    {
      name: "orgfy_governanca_avaliar",
      description:
        "Avalia orçamento, fila de revisão, WIP órfão e estagnação nível 3, disparando alertas/wakes com cooldown anti-spam.",
      inputSchema: {
        type: "object",
        properties: {
          dry_run: { type: "boolean" },
          auto_wake: { type: "boolean" },
        },
      },
      execute: async (args) => {
        const res = await evaluateGovernanceAndReact(ctx, {
          dryRun: Boolean(args?.dry_run),
          autoWake: args?.auto_wake !== false,
          includeRadar: true,
        });
        return { text: JSON.stringify(res, null, 2) };
      },
    },
    {
      name: "orgfy_lint_card",
      description: "Audita template OrgFy/Spec-Kit, qualidade semântica e regras L-01/L-22 antes do despacho.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          objective: { type: "string" },
          done_when: { type: "string" },
          acceptance_command: { type: "string" },
          executor: { type: "string" },
          revisor: { type: "string" },
          card_markdown: { type: "string" },
          spec_path: { type: "string" },
        },
        required: ["title"],
      },
      execute: async (args) => {
        const descParts = [args?.objective, args?.done_when ? `Feito quando: ${args.done_when}` : ""].filter(Boolean).join("\n");
        const res = await lintCardForDispatch(ctx, {
          titulo: args?.title ?? args?.titulo,
          descricao: args?.descricao || descParts || undefined,
          acceptanceCommand: args?.acceptance_command ?? args?.acceptanceCommand,
          executor: args?.executor,
          revisor: args?.revisor,
          cardMarkdown: args?.card_markdown ?? args?.cardMarkdown,
          specPath: args?.spec_path ?? args?.specPath,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.approved };
      },
    },
    {
      name: "orgfy_bind_context",
      description: "Vincula o worktree e injeta regras vivas L-22/L-90 direto na conversa do agente.",
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          issue_id: { type: "string" },
          worktree_path: { type: "string" },
          title: { type: "string" },
          acceptance_command: { type: "string" },
          acceptance_hash: { type: "string" },
          executor: { type: "string" },
          revisor: { type: "string" },
        },
        required: ["conversation_id", "issue_id"],
      },
      execute: async (args) => {
        const res = await bindConversationContextForCard(ctx, {
          conversationId: args?.conversation_id ?? args?.conversationId,
          issueId: args?.issue_id ?? args?.issueId,
          worktreePath: args?.worktree_path ?? args?.worktreePath,
          titulo: args?.title ?? args?.titulo,
          acceptanceCommand: args?.acceptance_command ?? args?.acceptanceCommand,
          acceptanceHash: args?.acceptance_hash ?? args?.acceptanceHash,
          executor: args?.executor,
          revisor: args?.revisor,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_historico_buscar",
      description: "Busca just-in-time no Arquivo de Issues Resolvidas por código, causa raiz, arquivo ou SHA.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          spec: { type: "string" },
          limit: { type: "number" },
        },
      },
      execute: async (args) => {
        const res = await searchResolvedArchive(ctx, {
          query: args?.query,
          spec: args?.spec,
          limit: Math.max(1, Math.min(50, Number(args?.limit || 10))),
        });
        return {
          text: JSON.stringify(res, null, 2),
          isError: !res.disponivel,
        };
      },
    },
    {
      name: "orgfy_loop_radar",
      description:
        "Consulta o Radar de Loops & Sessões Zumbis do Goose em tempo real (mode=ro), identificando LOOP_SUSPEITO, STALLED_THINKING, SESSAO_DUPLICADA e EXPLORACAO_CLI_HELP.",
      inputSchema: {
        type: "object",
        properties: {
          apenas_ativos: { type: "boolean" },
          agente: { type: "string" },
        },
      },
      execute: async (args) => {
        const radar = await fetchGooseLoopRadar(ctx);
        const filtered = filterGooseLoopRadar(radar, {
          apenas_ativos: args?.apenas_ativos,
          agente: args?.agente,
        });
        return { text: JSON.stringify(filtered, null, 2), isError: !radar.ok };
      },
    },
    {
      name: "orgfy_session_stop",
      description:
        "Interrompe (Stop) ou reinicia um turno/sessão de agente via API nativa do Buzz Desktop (interrupt/new/compact), com relaunch atômico opcional.",
      inputSchema: {
        type: "object",
        properties: {
          agente: { type: "string" },
          agent_pubkey: { type: "string" },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
          action: { type: "string", enum: ["interrupt", "new", "compact"] },
          release_issue_id: { type: "string" },
          reason: { type: "string" },
          relaunch: { type: "boolean" },
          reset_session_before_relaunch: { type: "boolean" },
          relaunch_instruction: { type: "string" },
          target_files: { type: "array", items: { type: "string" } },
          acceptance_command: { type: "string" },
          max_shells: { type: "number" },
        },
        required: ["agente"],
      },
      execute: async (args) => {
        const agente = String(args?.agente || args?.agent_pubkey || "").trim();
        if (!agente) {
          return { text: "Erro: 'agente' (ou 'agent_pubkey') é obrigatório.", isError: true };
        }
        const res = await stopAgentSession(ctx, {
          agente,
          agent_pubkey: args?.agent_pubkey,
          channel_id: args?.channel_id,
          thread_root: args?.thread_root,
          action: args?.action,
          release_issue_id: args?.release_issue_id,
          reason: args?.reason,
          relaunch: Boolean(args?.relaunch),
          reset_session_before_relaunch: Boolean(args?.reset_session_before_relaunch),
          relaunch_instruction: args?.relaunch_instruction,
          target_files: Array.isArray(args?.target_files) ? args.target_files : undefined,
          acceptance_command: args?.acceptance_command,
          max_shells: typeof args?.max_shells === "number" ? args.max_shells : undefined,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_model_failover",
      description:
        "Integração OrgFy ↔ NexusMind Gateway: faz ping real nos candidatos mais inteligentes, elege o melhor online (inteligência + menor latência), atualiza via ctx.agents.save() e re-dispara na thread.",
      inputSchema: {
        type: "object",
        properties: {
          agente: { type: "string" },
          agent_pubkey: { type: "string" },
          failed_model: { type: "string" },
          prefer_free: { type: "boolean" },
          apply: { type: "boolean" },
          retrigger: { type: "boolean" },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
          retrigger_text: { type: "string" },
          max_probes: { type: "number" },
        },
      },
      execute: async (args) => {
        const res = await requestModelFailover(ctx, {
          agente: args?.agente,
          agent_pubkey: args?.agent_pubkey,
          failed_model: args?.failed_model,
          prefer_free: args?.prefer_free,
          apply: args?.apply,
          retrigger: args?.retrigger,
          channel_id: args?.channel_id,
          thread_root: args?.thread_root,
          retrigger_text: args?.retrigger_text,
          max_probes: args?.max_probes,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_card_create",
      description:
        "Abertura schema-first de card OrgFy: valida L-01, executa triagem em cascata via Decisions API (risco, tier modelo, política Attention), congela SHA-256 (L-22), gera contrato nativo Buzz Attention/Watch (interest_set + watch_add) e grava/valida opcionalmente.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string" },
          id_tarefa: { type: "string" },
          titulo: { type: "string" },
          objetivo: { type: "string" },
          contexto: { type: "string" },
          autoridade: { type: "string" },
          decisao: { type: "string" },
          tipo: { type: "string", enum: ["execucao", "revisao", "infraestrutura", "seguranca", "spec", "pesquisa"] },
          executor: { type: "string" },
          revisor: { type: "string" },
          decisor: { type: "string" },
          escrita_exclusiva: { type: "array", items: { type: "string" } },
          leitura: { type: "array", items: { type: "string" } },
          passos: { type: "array", items: { type: "string" } },
          fora_escopo: { type: "array", items: { type: "string" } },
          feito_quando: { type: "string" },
          prova_positiva: { type: "string" },
          prova_negativa: { type: "string" },
          acceptance_command: { type: "string" },
          effort: { type: "number", description: "Escala Specsfy Effort 1..10 (1-2: Z2 hotfix cirúrgico; 3-6: Z3 exige spec.md + Definition/Plan Gate Passed; 7-10: Z4 exige + DECIDIDO)" },
          spec_path: { type: "string", description: "Caminho real da spec pai (specs/<estado>/<NNNN>-<slug>/spec.md ou specs/inbox/<slug>.md)" },
          ato: { type: "string", enum: ["ato_1", "ato_2", "ato_3"], description: "Ato Specsfy (ato_1: Definir, ato_2: Planejar/RED, ato_3: Implementar/GREEN)" },
          skills: { type: "string", description: "Skills Specsfy do Ato (auto-preenchidas conforme matriz-skills-ato.json se omitido)" },
          attention_policy: { type: "string", enum: ["timer_curto", "event_driven", "watchdog_longo"] },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
          write_file: { type: "boolean" },
          run_lint: { type: "boolean" },
          empresa: { type: "string" },
        },
        required: [
          "slug",
          "titulo",
          "autoridade",
          "decisao",
          "executor",
          "revisor",
          "escrita_exclusiva",
          "feito_quando",
          "acceptance_command",
        ],
      },
      execute: async (args) => {
        const res = await createCanonicalCard(ctx, args || {});
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_decision_triage",
      description:
        "Classificador rápido em batch via ctx.decisions.decide (yes_no + score + choice) com fallback determinístico offline para triagem de card (mode='card') ou pre-flight de diff/entrega (mode='diff').",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["card", "diff"] },
          slug: { type: "string" },
          issue_id: { type: "string" },
          titulo: { type: "string" },
          objetivo: { type: "string" },
          tipo: { type: "string" },
          escrita_exclusiva: { type: "array", items: { type: "string" } },
          arquivos_alterados: { type: "array", items: { type: "string" } },
          acceptance_command: { type: "string" },
          passos: { type: "array", items: { type: "string" } },
          resumo_entrega: { type: "string" },
          saida_aceite: { type: "string" },
          recusas_anteriores: { type: "number" },
        },
        required: ["mode"],
      },
      execute: async (args) => {
        const mode = String(args?.mode || "card");
        const res =
          mode === "diff"
            ? await triageDiffWithDecisions(ctx, {
                issue_id: args?.issue_id,
                titulo: args?.titulo,
                escrita_exclusiva: Array.isArray(args?.escrita_exclusiva) ? args.escrita_exclusiva : [],
                arquivos_alterados: Array.isArray(args?.arquivos_alterados) ? args.arquivos_alterados : [],
                resumo_entrega: args?.resumo_entrega,
                saida_aceite: args?.saida_aceite,
                recusas_anteriores: args?.recusas_anteriores,
              })
            : await triageCardWithDecisions(ctx, {
                slug: args?.slug,
                titulo: String(args?.titulo || ""),
                objetivo: args?.objetivo,
                tipo: args?.tipo,
                escrita_exclusiva: Array.isArray(args?.escrita_exclusiva) ? args.escrita_exclusiva : [],
                acceptance_command: args?.acceptance_command,
                passos: Array.isArray(args?.passos) ? args.passos : [],
              });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_card_progress",
      description:
        "Lê ou atualiza o checklist vivo de etapas (P1..Pn) em cards/<SLUG>.md e colore automaticamente o grafo Mermaid '## Fluxo'. Permite retomada determinística após queda, compactação ou failover de modelo.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Slug do card (ex.: 'SPEC-0006-T020' ou 'wave4-attention')" },
          action: { type: "string", enum: ["read", "update"], description: "'read' para inspecionar progresso/próxima etapa ou 'update' para marcar etapa" },
          step_id: { type: "string", description: "ID da etapa (ex.: 'P1', 'P2', 'P3')" },
          status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
          note: { type: "string", description: "Nota curta de evidência ou commit SHA" },
          agent: { type: "string", description: "Nome do agente que atualizou a etapa" },
        },
        required: ["slug"],
      },
      execute: async (args) => {
        const res = await executeCardProgress(ctx, {
          slug: String(args?.slug || ""),
          action: args?.action,
          step_id: args?.step_id,
          status: args?.status,
          note: args?.note,
          agent: args?.agent,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_roster_live",
      description:
        "Raio-X real de presença em 1 chamada: reconcilia locks zumbis (lease 8m x snapshot/sessionState) e retorna quem está realmente FREE, WORKING_REAL, ALERT_RADAR ou MODEL_UNSUPPORTED.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
          reconcile: { type: "boolean", description: "Se true (padrão), limpa locks órfãos antes de listar" },
        },
      },
      execute: async (args) => {
        const res = await buildLiveAgentRoster(ctx, {
          empresa: args?.empresa || "orgfy",
          reconcile: args?.reconcile !== false,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_handoff_pack",
      description:
        "Gera pacote compacto de retomada ou revisão (checklist P1..Pn, Escrita exclusiva, comando L-22, git status/commits/diff e resumePrompt pronto) para zero desperdício de shells.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Slug do card (ex.: 'SPEC-0006-T020')" },
          issue_id: { type: "string" },
          worktree_path: { type: "string" },
          card_markdown: { type: "string" },
        },
      },
      execute: async (args) => {
        const res = await buildHandoffPack(ctx, {
          slug: args?.slug,
          issue_id: args?.issue_id,
          worktree_path: args?.worktree_path,
          card_markdown: args?.card_markdown,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_smart_dispatch",
      description:
        "Dispatcher Híbrido SOTA (Fase A Zero-Token: presença real + WRITE_SET_CONFLICT + L-01; Fase B One-Shot ctx.decisions.decide): recomenda ou despacha automaticamente para o melhor agente livre.",
      inputSchema: {
        type: "object",
        properties: {
          issue_id: { type: "string" },
          slug: { type: "string" },
          titulo: { type: "string" },
          objetivo: { type: "string" },
          revisor: { type: "string" },
          exclusive_paths: { type: "array", items: { type: "string" } },
          acceptance_command: { type: "string" },
          empresa: { type: "string" },
          dry_run: { type: "boolean", description: "Padrão true (seguro): retorna recomendação sem despachar" },
          auto_execute: { type: "boolean", description: "Se true, adquire lease curto 8m e acorda o agente escolhido quando confiança >= min_confidence e risco <= 3" },
          min_confidence: { type: "number" },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
        },
        required: ["issue_id", "titulo", "revisor", "exclusive_paths", "acceptance_command"],
      },
      execute: async (args) => {
        const res = await runOneShotDecisionDispatch(ctx, {
          issue_id: String(args?.issue_id || ""),
          slug: args?.slug,
          titulo: String(args?.titulo || ""),
          objetivo: args?.objetivo,
          revisor: String(args?.revisor || ""),
          exclusive_paths: Array.isArray(args?.exclusive_paths) ? args.exclusive_paths : [],
          acceptance_command: String(args?.acceptance_command || ""),
          empresa: args?.empresa || "orgfy",
          dry_run: args?.dry_run,
          auto_execute: Boolean(args?.auto_execute),
          min_confidence: typeof args?.min_confidence === "number" ? args.min_confidence : undefined,
          channel_id: args?.channel_id,
          thread_root: args?.thread_root,
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      },
    },
    {
      name: "orgfy_reconciliar_agentes",
      description:
        "Reconcilia configs de agentes do Buzz Desktop via ctx.agents.save() (R5.2/R4.1), migrando agentes com :free, provider nulo ou modelos reprovados no eval R5.1 para gemini-2.5-flash / claude-sonnet-4-6.",
      inputSchema: {
        type: "object",
        properties: {
          dry_run: { type: "boolean", description: "Se true (padrão), apenas audita sem salvar" },
        },
      },
      execute: async (args: any) => {
        const dryRun = args?.dry_run !== false;
        const res = await reconcileAgentsViaBuzzApi(ctx, { dryRun });
        return { text: JSON.stringify({ ok: true, dryRun, ...res }, null, 2) };
      },
    },
    {
      name: "orgfy_question_card",
      description:
        "Envia um Question Card estruturado para o Inbox do Fundador ('Aguardando você') sincronizado via ctx.artifactStorage.open(), substituindo blocos de texto longos por opções clicáveis (single/multi) + comentário livre + timeout. Quando respondido, acorda automaticamente o agente solicitante via ctx.agents.wake.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da decisão solicitada" },
          question: { type: "string", description: "Contexto objetivo da pergunta" },
          requested_by: { type: "string", description: "Nome do agente solicitante (ex: 'OrgFy Bento')" },
          requested_by_pubkey: { type: "string", description: "Pubkey opcional do agente solicitante" },
          tenant: { type: "string", description: "Empresa/tenant (default: 'orgfy')" },
          channel_id: { type: "string", description: "Canal onde o agente será acordado ao receber resposta" },
          thread_root: { type: "string", description: "Thread root opcional" },
          selection_mode: { type: "string", enum: ["single", "multi"], description: "'single' (radio) ou 'multi' (checkbox)" },
          allow_free_text: { type: "boolean", description: "Permite observação em texto livre (default: true)" },
          timeout_minutes: { type: "number", description: "Prazo opcional em minutos para expiração" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                description: { type: "string" },
              },
              required: ["label"],
            },
            description: "Opções estruturadas para escolha rápida",
          },
        },
        required: ["title", "question"],
      },
      execute: async (args: any, meta?: { client?: any; context?: any }) => {
        const title = String(args?.title || "").trim();
        const question = String(args?.question || "").trim();
        if (!title || !question) {
          return { text: JSON.stringify({ ok: false, error: "title e question são obrigatórios." }), isError: true };
        }
        const isUuidLike = (v: unknown) =>
          typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
        const isHex64 = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/i.test(v.trim());
        const ctxChannel = meta?.context?.channel;
        const argChannel = args?.channel_id || args?.channelId;
        const resolvedChannelId = isUuidLike(ctxChannel)
          ? String(ctxChannel).trim()
          : isUuidLike(argChannel)
            ? String(argChannel).trim()
            : undefined;
        const ctxRoot = meta?.context?.root;
        const argRoot = args?.thread_root || args?.threadRoot;
        const resolvedThreadRoot = isHex64(ctxRoot)
          ? String(ctxRoot).trim().toLowerCase()
          : isHex64(argRoot)
            ? String(argRoot).trim().toLowerCase()
            : undefined;
        const resolvedPubkey = isHex64(meta?.client?.pubkey)
          ? String(meta?.client?.pubkey).trim().toLowerCase()
          : isHex64(args?.requested_by_pubkey || args?.requestedByPubkey)
            ? String(args?.requested_by_pubkey || args?.requestedByPubkey).trim().toLowerCase()
            : undefined;
        const resolvedRequestedBy = String(
          args?.requested_by || args?.requestedBy || meta?.client?.name || "OrgFy Bento"
        ).trim();

        const store = getOrgfyCrdtStore(ctx);
        const card = await store.createQuestionCard({
          tenant: args?.tenant || "orgfy",
          title,
          question,
          requestedBy: resolvedRequestedBy,
          requestedByPubkey: resolvedPubkey,
          channelId: resolvedChannelId,
          threadRoot: resolvedThreadRoot,
          selectionMode: args?.selection_mode === "multi" ? "multi" : "single",
          allowFreeText: args?.allow_free_text !== false,
          timeoutMinutes: typeof args?.timeout_minutes === "number" ? args.timeout_minutes : undefined,
          options: Array.isArray(args?.options) ? args.options : [],
        });
        emitOrgfyPipelineEvent({
          type: "question_card.created",
          issueId: card.id,
          empresa: card.tenant,
          agent: card.requestedBy,
          summary: `Question Card: ${card.title} (${card.options.length} opções aguardando Fundador)`,
        });
        try {
          sendDesktopNotification(ctx, `OrgFy Inbox · ${card.requestedBy}`, card.title);
        } catch {}
        return {
          text: JSON.stringify(
            {
              ok: true,
              card,
              sync: store.getBackendInfo(),
            },
            null,
            2
          ),
        };
      },
    },
  ];

  // Instrumentação OTel GenAI automática (execute_tool) em todas as tools
  return rawTools.map((tool) => ({
    ...tool,
    execute: async (args: any, meta?: { client?: any; context?: any }) => {
      const t0 = Date.now();
      try {
        const out = await tool.execute(args, meta);
        recordGenAISpan({
          operationName: "execute_tool",
          agentName: "orgfy-tool-registry",
          toolName: tool.name,
          durationMs: Date.now() - t0,
          status: out.isError ? "error" : "ok",
          attributes: {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": tool.name,
          },
        });
        return out;
      } catch (err: any) {
        recordGenAISpan({
          operationName: "execute_tool",
          agentName: "orgfy-tool-registry",
          toolName: tool.name,
          durationMs: Date.now() - t0,
          status: "error",
          finishReason: String(err?.message || err).slice(0, 120),
          attributes: {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": tool.name,
          },
        });
        throw err;
      }
    },
  }));
}
