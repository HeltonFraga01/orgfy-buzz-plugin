// ─────────────────────────────────────────────────────────────────────────────
// ORGFY BUZZ-NATIVE SYNERGY LAYER (v13 FRONTIER)
// Integrações nativas com a plataforma Buzz Desktop (@buzz/author):
// 1. ctx.relay.subscribe() — refresh reativo sem polling
// 2. ctx.conversation — slash commands (/orgfy-*) + MessageAction no chat
// 3. ctx.sidebarSections — contadores vivos na barra lateral do Buzz
// 4. ctx.shortcuts — atalho global Cmd/Ctrl+Shift+O para Control Room
// 5. ctx.agents.addAttentionSource() — produtor nativo `orgfy.pipeline`
// 6. ctx.agents.registerHook() — instrumentação OTel GenAI (invoke_agent)
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { recordGenAISpan } from "./telemetry-otel";

export interface BuzzNativeState {
  relayConnected: boolean;
  conversationRegistered: boolean;
  sidebarRegistered: boolean;
  shortcutsRegistered: boolean;
  attentionSourceRegistered: boolean;
  otelHookRegistered: boolean;
}

export interface LiveSidebarCounts {
  triagem: number;
  execucao: number;
  revisao: number;
  loopsAtivos: number;
}

let sidebarCounts: LiveSidebarCounts = {
  triagem: 0,
  execucao: 0,
  revisao: 0,
  loopsAtivos: 0,
};

const sidebarListeners = new Set<() => void>();
const relayChangeListeners = new Set<() => void>();

export function updateOrgfySidebarCounts(next: Partial<LiveSidebarCounts>) {
  sidebarCounts = { ...sidebarCounts, ...next };
  for (const fn of sidebarListeners) {
    try {
      fn();
    } catch {}
  }
}

export function subscribeRelayUpdates(listener: () => void): () => void {
  relayChangeListeners.add(listener);
  return () => relayChangeListeners.delete(listener);
}

/**
 * Registra todas as integrações nativas do Buzz Desktop de forma 100% defensiva
 * (cada serviço só é ativado se o host o expuser — nunca quebra hosts antigos ou testes).
 */
export function registerBuzzNativeIntegrations(ctx: Context | any): BuzzNativeState {
  const state: BuzzNativeState = {
    relayConnected: false,
    conversationRegistered: false,
    sidebarRegistered: false,
    shortcutsRegistered: false,
    attentionSourceRegistered: false,
    otelHookRegistered: false,
  };

  // 1. RELAY LIVE SUBSCRIPTION (Event-Driven Refresh)
  try {
    const relay = ctx?.relay;
    if (relay?.subscribe && typeof relay.subscribe === "function") {
      let lastGen = relay.snapshot?.()?.generation ?? -1;
      const unsub = relay.subscribe(() => {
        const snap = relay.snapshot?.();
        const gen = snap?.generation ?? -1;
        if (gen !== lastGen) {
          lastGen = gen;
          recordGenAISpan({
            operationName: "relay.event",
            agentName: "buzz-relay",
            durationMs: 0,
            status: snap?.status === "error" ? "error" : "ok",
            attributes: {
              "buzz.relay.status": String(snap?.status || "unknown"),
              "buzz.relay.generation": gen,
            },
          });
          for (const fn of relayChangeListeners) {
            try {
              fn();
            } catch {}
          }
        }
      });
      if (ctx?.on && typeof unsub === "function") {
        ctx.on("dispose", unsub);
      }
      state.relayConnected = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao assinar ctx.relay:", err);
  }

  // 2. CONVERSATION EXTENSIONS (Slash Commands + MessageAction)
  try {
    const conv = ctx?.conversation;
    if (conv?.registerCompletion) {
      conv.registerCompletion({
        id: "orgfy-slash-commands",
        trigger: "/",
        complete: (query: any) => {
          const text = String(query?.text || query?.query || "").toLowerCase();
          const commands = [
            {
              id: "orgfy-card",
              label: "/orgfy-card",
              description: "Abrir card OrgFy schema-first (L-22 + Buzz Attention)",
              insertText: "Chame `orgfy_card_create` para abrir um novo card com escopo fechado, Escrita exclusiva e comando de aceite L-22.",
            },
            {
              id: "orgfy-despachar",
              label: "/orgfy-despachar",
              description: "Despachar issue para executor + revisor independente (L-01)",
              insertText: "Chame `orgfy_despachar` passando issue_id, executor e revisor.",
            },
            {
              id: "orgfy-gate",
              label: "/orgfy-gate",
              description: "Emitir veredito de Gate Caixa-Preta (aceito/recusado)",
              insertText: "Chame `orgfy_gate` com pr_id, decisao e motivo.",
            },
            {
              id: "orgfy-triage",
              label: "/orgfy-triage",
              description: "Rodar triagem rápida via Decisions API (card ou diff)",
              insertText: "Chame `orgfy_decision_triage` (mode: 'card' ou 'diff') para avaliação rápida.",
            },
            {
              id: "orgfy-radar",
              label: "/orgfy-radar",
              description: "Inspecionar Radar de Loops & sessões travadas no Goose",
              insertText: "Chame `orgfy_loop_radar({ apenas_ativos: true })` e reporte sessões críticas.",
            },
          ];
          const filtered = text
            ? commands.filter((c) => c.label.includes(text) || c.description.toLowerCase().includes(text))
            : commands;
          return { suggestions: filtered };
        },
      });
      state.conversationRegistered = true;
    }

    if (conv?.registerMessageAction) {
      conv.registerMessageAction({
        id: "orgfy-open-control-room",
        label: "Abrir no OrgFy Control Room",
        run: () => {
          try {
            if (ctx?.navigation?.open) {
              ctx.navigation.open({ version: 1, kind: "page", page: "orgfy" });
            } else if (ctx?.navigation?.navigate) {
              ctx.navigation.navigate("orgfy");
            }
          } catch {}
        },
      });
      state.conversationRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar extensões de conversa:", err);
  }

  // 3. SIDEBAR SECTIONS (Contadores vivos na barra lateral do Buzz)
  try {
    const sidebar = ctx?.reflect?.get?.("sidebarSections") || ctx?.sidebarSections;
    if (sidebar?.register) {
      const h = ctx?.react?.createElement;
      sidebar.register({
        version: 1,
        id: "orgfy-live-pulse",
        title: "OrgFy Esteira",
        icon: h ? h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, "◈") : null,
        rows: {
          snapshot: () => [
            {
              id: "orgfy-revisao",
              label: "Em Revisão (Gate)",
              count: sidebarCounts.revisao,
              status: sidebarCounts.revisao > 0 ? "active" : "idle",
            },
            {
              id: "orgfy-execucao",
              label: "Em Execução",
              count: sidebarCounts.execucao,
              status: sidebarCounts.execucao > 0 ? "active" : "idle",
            },
            {
              id: "orgfy-loops",
              label: "Loops Ativos",
              count: sidebarCounts.loopsAtivos,
              badge: sidebarCounts.loopsAtivos > 0 ? "ALERTA" : undefined,
              status: sidebarCounts.loopsAtivos > 0 ? "error" : "ok",
            },
          ],
          subscribe: (listener: () => void) => {
            sidebarListeners.add(listener);
            return () => sidebarListeners.delete(listener);
          },
        },
        select: () => ({ version: 1, kind: "page", page: "orgfy" }),
      });
      state.sidebarRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar sidebarSections:", err);
  }

  // 4. KEYBOARD SHORTCUTS (Cmd/Ctrl+Shift+O -> OrgFy Control Room)
  try {
    const shortcuts = ctx?.shortcuts;
    if (shortcuts?.register) {
      shortcuts.register({
        id: "orgfy-open-cockpit",
        title: "Abrir OrgFy Control Room",
        binding: "Mod+Shift+O",
        run: () => {
          try {
            if (ctx?.navigation?.open) {
              ctx.navigation.open({ version: 1, kind: "page", page: "orgfy" });
            } else if (ctx?.navigation?.navigate) {
              ctx.navigation.navigate("orgfy");
            }
          } catch {}
        },
      });
      state.shortcutsRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar shortcuts:", err);
  }

  // 5. NATIVE BUZZ ATTENTION SOURCE PRODUCER (`orgfy.pipeline`)
  try {
    const agents = ctx?.agents;
    if (agents?.addAttentionSource) {
      agents.addAttentionSource({
        id: "orgfy.pipeline",
        label: "OrgFy Esteira & Gate",
        description:
          "Emite eventos estruturados da esteira OrgFy (card.ready_for_review, gate.rejected_dsap, loop.detected, budget.80pct) compatíveis com classifier pré-LLM.",
        present: (watch: any, title: string) => ({
          type: "OrgFy Esteira",
          target: String(watch?.config?.empresa || "orgfy"),
          subtitle: title || "Monitoramento determinístico de cards, PRs e loops",
        }),
      });
      state.attentionSourceRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar AttentionSource:", err);
  }

  // 6. OPENTELEMETRY GENAI AGENT HOOK (`invoke_agent`)
  try {
    const agents = ctx?.agents;
    if (agents?.registerHook) {
      const registerOtel = (event: string, status: "ok" | "error") => {
        agents.registerHook({
          id: `orgfy-otel-${event}`,
          harness: "goose",
          event,
          run: (input: any, hookCtx: any) => {
            const errMsg = input?.error ? String(input.error).slice(0, 140) : undefined;
            recordGenAISpan({
              operationName: "invoke_agent",
              agentName: String(hookCtx?.agent || input?.agent || "unknown-agent"),
              model: input?.model ? String(input.model) : null,
              provider: input?.provider ? String(input.provider) : null,
              durationMs: Number(input?.durationMs || input?.duration_ms || 0),
              status: errMsg ? "error" : status,
              finishReason: errMsg || (status === "ok" ? "stop" : "error"),
              attributes: {
                "gen_ai.operation.name": "invoke_agent",
                "buzz.hook.event": event,
                "buzz.session.id": String(hookCtx?.session || ""),
              },
            });
            return undefined;
          },
        });
      };
      registerOtel("turn.completed", "ok");
      registerOtel("turn.failed", "error");
      state.otelHookRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar OTel AgentHook:", err);
  }

  return state;
}
