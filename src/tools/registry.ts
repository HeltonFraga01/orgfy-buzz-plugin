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
import { executeSmartModelFailover } from "../services/model-failover";
import { fetchResolvedArchive, searchResolvedArchive } from "../services/resolved-archive";
import { createCanonicalCard } from "../services/card-creator";
import { executeCardProgress } from "../services/card-progress";
import {
  triageCardWithDecisions,
  triageDiffWithDecisions,
  buildBuzzAttentionContract,
} from "../services/decision-router";
import { recordGenAISpan } from "../services/telemetry-otel";

export interface UnifiedOrgfyTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (args: any) => Promise<{ text: string; isError?: boolean }>;
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
        return {
          text: JSON.stringify({ status: res.code === 0 ? "ok" : "error", exitCode: res.code, output: res.output }, null, 2),
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
        const res = await executeSmartModelFailover(ctx, {
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
  ];

  // Instrumentação OTel GenAI automática (execute_tool) em todas as 17 tools
  return rawTools.map((tool) => ({
    ...tool,
    execute: async (args: any) => {
      const t0 = Date.now();
      try {
        const out = await tool.execute(args);
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
