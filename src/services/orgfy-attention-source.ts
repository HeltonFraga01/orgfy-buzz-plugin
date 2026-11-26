// ─────────────────────────────────────────────────────────────────────────────
// ORGFY PIPELINE ATTENTION SOURCE (ONDA 3 — ctx.agents.addAttentionSource)
// Produtor real de eventos estruturados da esteira OrgFy para o sistema nativo
// de Attention do Buzz Desktop:
// 1. Escuta em tempo real o barramento `subscribeOrgfyPipelineEvents`
//    (card.ready_for_review, gate.rejected_dsap, loop.detected, ci.failed,
//    budget.80pct, lock.orphaned_released, card.auto_dispatched, card.escalated_coo).
// 2. Faz polling leve de transições reais de estado (KPIs, Radar de Loops e
//    Kanban em revisão), emitindo cada ocorrência uma única vez (dedup por chave).
// 3. Respeita `signal.abort` com limpeza total de timers e listeners.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import {
  subscribeOrgfyPipelineEvents,
  type OrgfyPipelineEvent,
  type OrgfyPipelineEventType,
} from "./presence-dispatcher";
import { fetchKpisEsteira, fetchGooseLoopRadar } from "./kpi-service";
import { fetchLiveKanbanCards } from "./orgfy-bridge";
import { recordGenAISpan } from "./telemetry-otel";

export const DEFAULT_ATTENTION_POLL_MS = 30_000;
const MIN_ATTENTION_POLL_MS = 5_000;

export interface OrgfyAttentionWatchConfig {
  empresa?: string;
  events?: string[];
  pollMs?: number;
}

export function formatOrgfyAttentionText(ev: OrgfyPipelineEvent): string {
  const parts = [
    `[ORGFY ATTENTION · ${ev.type}]`,
    `empresa=${ev.empresa}`,
    ...(ev.issueId ? [`issue=${ev.issueId}`] : []),
    ...(ev.agent ? [`agente=${ev.agent}`] : []),
    `resumo=${ev.summary}`,
    `em=${ev.timestamp}`,
  ];
  return parts.join(" | ");
}

function matchesWatchFilter(
  ev: OrgfyPipelineEvent,
  empresaFilter: string,
  allowedEvents: Set<string> | null
): boolean {
  if (empresaFilter && empresaFilter !== "all" && ev.empresa && ev.empresa !== "all") {
    if (ev.empresa.toLowerCase() !== empresaFilter.toLowerCase()) {
      return false;
    }
  }
  if (allowedEvents && allowedEvents.size > 0 && !allowedEvents.has(ev.type)) {
    return false;
  }
  return true;
}

export function createOrgfyPipelineAttentionSource(ctx: Context | any) {
  return {
    id: "orgfy.pipeline",
    description:
      "Emite eventos reais e estruturados da esteira OrgFy (PR/card pronto para revisão, loop detectado no Goose, falha de CI/alerta crítico, teto de orçamento >=80%, lock órfão liberado e despacho/escalação) para o Attention nativo do Buzz.",
    configExample: {
      empresa: "orgfy",
      events: [
        "card.ready_for_review",
        "loop.detected",
        "ci.failed",
        "gate.rejected_dsap",
        "budget.80pct",
      ],
      pollMs: DEFAULT_ATTENTION_POLL_MS,
    },
    present: (watch: any, title: string) => {
      const cfg = (watch?.config || {}) as OrgfyAttentionWatchConfig;
      const empresa = String(cfg.empresa || "orgfy");
      const evCount = Array.isArray(cfg.events) && cfg.events.length > 0 ? `${cfg.events.length} sinais` : "todos os sinais";
      return {
        type: "OrgFy Esteira",
        target: empresa,
        subtitle: title || `Monitoramento ao vivo (${evCount}: revisão, loops, CI e orçamento)`,
      };
    },
    run: (input: {
      id: string;
      agent: string;
      watch?: { config?: OrgfyAttentionWatchConfig };
      signal?: AbortSignal;
      emit?: (text: string) => void;
    }): Promise<void> =>
      new Promise<void>((resolve) => {
        if (input?.signal?.aborted) {
          resolve();
          return;
        }

        const cfg = (input?.watch?.config || {}) as OrgfyAttentionWatchConfig;
        const empresaFilter = String(cfg.empresa || "orgfy").trim() || "orgfy";
        const allowedEvents =
          Array.isArray(cfg.events) && cfg.events.length > 0
            ? new Set(cfg.events.map((e) => String(e).trim()).filter(Boolean))
            : null;
        const rawPoll = typeof cfg.pollMs === "number" ? cfg.pollMs : DEFAULT_ATTENTION_POLL_MS;
        const pollMs = rawPoll <= 0 ? 0 : Math.max(MIN_ATTENTION_POLL_MS, rawPoll);

        const seenKeys = new Set<string>();
        let done = false;
        let pollTimer: ReturnType<typeof setTimeout> | undefined;
        let polling = false;

        const safeEmit = (dedupKey: string, ev: OrgfyPipelineEvent) => {
          if (done || input?.signal?.aborted) return;
          if (!matchesWatchFilter(ev, empresaFilter, allowedEvents)) return;
          if (seenKeys.has(dedupKey)) return;
          seenKeys.add(dedupKey);
          if (seenKeys.size > 400) {
            const first = seenKeys.values().next().value;
            if (first) seenKeys.delete(first);
          }

          const text = formatOrgfyAttentionText(ev);
          try {
            input?.emit?.(text);
            recordGenAISpan({
              operationName: "attention.emit",
              agentName: String(input?.agent || "orgfy-attention"),
              durationMs: 0,
              status: "ok",
              attributes: {
                "orgfy.attention.watch_id": String(input?.id || ""),
                "orgfy.event.type": ev.type,
                "orgfy.empresa": ev.empresa,
              },
            });
          } catch (err: any) {
            recordGenAISpan({
              operationName: "attention.emit",
              agentName: String(input?.agent || "orgfy-attention"),
              durationMs: 0,
              status: "error",
              finishReason: String(err?.message || "emit_failed").slice(0, 120),
              attributes: {
                "orgfy.attention.watch_id": String(input?.id || ""),
                "orgfy.event.type": ev.type,
              },
            });
          }
        };

        // 1. Entrega imediata de eventos publicados no barramento interno da esteira
        const unsubscribeBus = subscribeOrgfyPipelineEvents((ev) => {
          safeEmit(`bus:${ev.id}`, ev);
        });

        // 2. Varredura periódica de sinais reais em disco (revisão, loops, CI/alertas e orçamento)
        const pollOnce = async () => {
          if (done || input?.signal?.aborted || polling) return;
          if (!ctx?.host?.readFile) return;
          polling = true;
          try {
            const nowIso = new Date().toISOString();

            // 2a. Cards/PRs em revisão aguardando Gate
            if (!allowedEvents || allowedEvents.has("card.ready_for_review")) {
              const cards = await fetchLiveKanbanCards(ctx, { empresa: empresaFilter }).catch(() => []);
              for (const card of cards) {
                if (card.stage !== "revisao") continue;
                const issueRef = card.fullIssueId || card.issueId || card.id;
                safeEmit(`review:${card.empresa}:${issueRef}`, {
                  id: `poll-review-${issueRef}`,
                  type: "card.ready_for_review",
                  timestamp: nowIso,
                  empresa: card.empresa || empresaFilter,
                  issueId: issueRef,
                  agent: card.revisor || card.executor,
                  summary: `PR/Card "${card.title}" pronto para revisão (executor: ${card.executor || "n/d"} -> revisor: ${card.revisor || "n/d"}).`,
                });
              }
            }

            // 2b. Loops ativos no Radar Goose
            if (!allowedEvents || allowedEvents.has("loop.detected")) {
              const radar = await fetchGooseLoopRadar(ctx).catch(() => null);
              if (radar?.ok && Array.isArray(radar.sessoes)) {
                for (const s of radar.sessoes) {
                  const isActiveCritical =
                    (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15) &&
                    (s.severidade === "critical" || Boolean(s.last_msg_is_provider_error));
                  if (!isActiveCritical) continue;
                  const flags = Array.isArray(s.flags) && s.flags.length > 0 ? s.flags.join(",") : "CRITICO";
                  safeEmit(`loop:${s.session_id}:${flags}`, {
                    id: `poll-loop-${s.session_id}`,
                    type: "loop.detected",
                    timestamp: nowIso,
                    empresa: empresaFilter,
                    agent: s.agente,
                    summary: `Loop/erro crítico detectado em ${s.agente} (sessão ${s.session_id}, ${s.duracao_min}m, ${s.shells} shells, flags: ${flags}).`,
                  });
                }
              }
            }

            // 2c. Alertas de CI / saúde e teto diário de orçamento (>= 80%)
            if (
              !allowedEvents ||
              allowedEvents.has("ci.failed") ||
              allowedEvents.has("budget.80pct")
            ) {
              const kpisRes = await fetchKpisEsteira(ctx).catch(() => null);
              const kpis = kpisRes?.kpis;
              if (kpis) {
                const pct = Number(kpis?.economia?.uso_teto_diario_pct ?? 0);
                if (pct >= 80 && (!allowedEvents || allowedEvents.has("budget.80pct"))) {
                  const bucket = Math.floor(pct / 10) * 10;
                  safeEmit(`budget:${empresaFilter}:${bucket}`, {
                    id: `poll-budget-${bucket}`,
                    type: "budget.80pct",
                    timestamp: nowIso,
                    empresa: empresaFilter,
                    summary: `Uso do teto diário de orçamento atingiu ${pct.toFixed(1)}% (status: ${kpis.economia?.status_orcamento || "ALERTA"}).`,
                  });
                }

                const alertas = Array.isArray(kpis.alertas_ativos) ? kpis.alertas_ativos : [];
                for (const al of alertas) {
                  const sev = String(al?.severidade || "").toLowerCase();
                  const cod = String(al?.codigo || "ALERTA");
                  if (sev !== "critical" && sev !== "error" && !/CI|FAIL|BROKEN/i.test(cod)) continue;
                  safeEmit(`ci:${cod}:${al.mensagem || ""}`, {
                    id: `poll-ci-${cod}`,
                    type: "ci.failed",
                    timestamp: nowIso,
                    empresa: empresaFilter,
                    summary: `[${cod}] ${al.mensagem || "Falha crítica detectada na esteira"} (${al.acao_sugerida || "verificar CI"}).`,
                  });
                }
              }
            }
          } finally {
            polling = false;
          }
        };

        const scheduleNext = () => {
          if (done || input?.signal?.aborted || pollMs <= 0) return;
          pollTimer = setTimeout(async () => {
            await pollOnce();
            scheduleNext();
          }, pollMs);
        };

        const finish = () => {
          if (done) return;
          done = true;
          if (pollTimer) clearTimeout(pollTimer);
          unsubscribeBus();
          input?.signal?.removeEventListener?.("abort", finish);
          resolve();
        };

        input?.signal?.addEventListener?.("abort", finish, { once: true });

        if (pollMs > 0) {
          void pollOnce().finally(() => scheduleNext());
        }
      }),
  };
}
