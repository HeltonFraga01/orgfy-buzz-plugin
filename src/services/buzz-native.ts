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
import { createAgentOrgfyTabComponent } from "../components/AgentOrgfyTab";

export interface BuzzNativeState {
  relayConnected: boolean;
  conversationRegistered: boolean;
  sidebarRegistered: boolean;
  shortcutsRegistered: boolean;
  attentionSourceRegistered: boolean;
  otelHookRegistered: boolean;
  agentTabRegistered: boolean;
}

let lastNativeState: BuzzNativeState = {
  relayConnected: false,
  conversationRegistered: false,
  sidebarRegistered: false,
  shortcutsRegistered: false,
  attentionSourceRegistered: false,
  otelHookRegistered: false,
  agentTabRegistered: false,
};

export function getBuzzNativeState(): BuzzNativeState {
  return { ...lastNativeState };
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

function buildSidebarRows(counts: LiveSidebarCounts) {
  return [
    {
      id: "orgfy-revisao",
      label: "Em Revisão",
      count: counts.revisao > 0 ? counts.revisao : undefined,
    },
    {
      id: "orgfy-execucao",
      label: "Em Execução",
      count: counts.execucao > 0 ? counts.execucao : undefined,
    },
    {
      id: "orgfy-loops",
      label: "Loops Ativos",
      count: counts.loopsAtivos > 0 ? counts.loopsAtivos : undefined,
    },
  ] as const;
}

// Referência estável obrigatória para React useSyncExternalStore no Buzz Desktop
let sidebarRowsSnapshot = buildSidebarRows(sidebarCounts);

const sidebarListeners = new Set<() => void>();
const relayChangeListeners = new Set<() => void>();

export function updateOrgfySidebarCounts(next: Partial<LiveSidebarCounts>) {
  const merged: LiveSidebarCounts = { ...sidebarCounts, ...next };
  if (
    merged.triagem === sidebarCounts.triagem &&
    merged.execucao === sidebarCounts.execucao &&
    merged.revisao === sidebarCounts.revisao &&
    merged.loopsAtivos === sidebarCounts.loopsAtivos
  ) {
    return;
  }
  sidebarCounts = merged;
  sidebarRowsSnapshot = buildSidebarRows(sidebarCounts);
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
    agentTabRegistered: false,
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

  // 2. CONVERSATION EXTENSIONS (Slash Commands + MessageAction — contrato @buzz/author)
  try {
    const conv = ctx?.conversation;
    const React = ctx?.react;
    if (conv?.registerCompletion) {
      const ORGFY_SLASH_COMMANDS = [
        {
          id: "orgfy-card",
          label: "/orgfy-card",
          detail: "Abrir card OrgFy schema-first (L-22 + Buzz Attention)",
          text: "Chame `orgfy_card_create` para abrir um novo card com escopo fechado, Escrita exclusiva e comando de aceite L-22. ",
        },
        {
          id: "orgfy-despachar",
          label: "/orgfy-despachar",
          detail: "Despachar issue para executor + revisor independente (L-01)",
          text: "Chame `orgfy_despachar` passando issue_id, executor e revisor. ",
        },
        {
          id: "orgfy-gate",
          label: "/orgfy-gate",
          detail: "Emitir veredito de Gate Caixa-Preta (aceito/recusado)",
          text: "Chame `orgfy_gate` com pr_id, decisao e motivo. ",
        },
        {
          id: "orgfy-triage",
          label: "/orgfy-triage",
          detail: "Rodar triagem rápida via Decisions API (card ou diff)",
          text: "Chame `orgfy_decision_triage` (mode: 'card' ou 'diff') para avaliação rápida. ",
        },
        {
          id: "orgfy-radar",
          label: "/orgfy-radar",
          detail: "Inspecionar Radar de Loops & sessões travadas no Goose",
          text: "Chame `orgfy_loop_radar({ apenas_ativos: true })` e reporte sessões críticas. ",
        },
      ];
      const OrgfySlashCompletion = (props: any) => {
        const q = String(props?.query?.query || "").toLowerCase();
        React?.useEffect?.(() => {
          const filtered = ORGFY_SLASH_COMMANDS.filter(
            (c) => !q || c.label.slice(1).includes(q) || c.detail.toLowerCase().includes(q)
          );
          const items = filtered.map((c) => ({
            id: c.id,
            label: c.label,
            detail: c.detail,
            edit: { text: c.text },
          }));
          const withdraw = props?.publish?.({ items });
          return () => {
            if (typeof withdraw === "function") withdraw();
          };
        }, [q, props?.publish]);
        return null;
      };
      conv.registerCompletion({
        id: "orgfy-slash-commands",
        title: "Comandos OrgFy",
        match: (observation: any) => {
          const text = String(observation?.text || "");
          const end = typeof observation?.end === "number" ? observation.end : text.length;
          const before = text.slice(0, end);
          const m = /(?:^|\s)(\/orgfy[-a-z]*)$/i.exec(before) || /(?:^|\s)(\/)$/i.exec(before);
          if (!m) return null;
          const token = m[1];
          return { start: end - token.length, end, query: token.slice(1) };
        },
        component: OrgfySlashCompletion,
      });
      state.conversationRegistered = true;
    }

    if (conv?.registerMessageAction) {
      const OpenControlRoomAction = (props: any) => {
        React?.useEffect?.(() => {
          try {
            if (ctx?.navigation?.open) {
              ctx.navigation.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
            } else if (ctx?.navigation?.navigate) {
              ctx.navigation.navigate("orgfy");
            }
          } catch {}
          props?.close?.();
        }, []);
        return null;
      };
      conv.registerMessageAction({
        id: "orgfy-open-control-room",
        title: "Abrir no OrgFy Control Room",
        matches: () => true,
        component: OpenControlRoomAction,
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
      const sidebarIcon = h
        ? h(
            "svg",
            {
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 1.8,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              width: 14,
              height: 14,
              style: { marginRight: "6px", flexShrink: 0, opacity: 0.75 },
            },
            h("polygon", { points: "12 2 20 6.5 20 17.5 12 22 4 17.5 4 6.5 12 2" }),
            h("polyline", { points: "4 6.5 12 11.5 20 6.5" }),
            h("line", { x1: 12, y1: 11.5, x2: 12, y2: 22 })
          )
        : null;
      sidebar.register({
        version: 1,
        id: "orgfy-live-pulse",
        title: "OrgFy",
        icon: sidebarIcon,
        rows: {
          snapshot: () => sidebarRowsSnapshot,
          subscribe: (listener: () => void) => {
            sidebarListeners.add(listener);
            return () => sidebarListeners.delete(listener);
          },
        },
        select: () => ({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" }),
      });
      state.sidebarRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar sidebarSections:", err);
  }

  // 4. KEYBOARD SHORTCUTS (Cmd/Ctrl+Shift+O -> OrgFy Control Room — KeyBinding objeto)
  try {
    const shortcuts = ctx?.shortcuts;
    if (shortcuts?.register) {
      shortcuts.register({
        id: "orgfy-open-cockpit",
        title: "Abrir OrgFy Control Room",
        binding: { key: "o", mod: true, shift: true },
        run: () => {
          try {
            if (ctx?.navigation?.open) {
              ctx.navigation.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
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

  // 5. NATIVE BUZZ ATTENTION SOURCE PRODUCER (`orgfy.pipeline` — inclui run(input) obrigatório)
  try {
    const agents = ctx?.agents;
    if (agents?.addAttentionSource) {
      agents.addAttentionSource({
        id: "orgfy.pipeline",
        description:
          "Emite eventos estruturados da esteira OrgFy (card.ready_for_review, gate.rejected_dsap, loop.detected, budget.80pct) compatíveis com classifier pré-LLM.",
        configExample: { empresa: "orgfy" },
        present: (watch: any, title: string) => ({
          type: "OrgFy Esteira",
          target: String(watch?.config?.empresa || "orgfy"),
          subtitle: title || "Monitoramento determinístico de cards, PRs e loops",
        }),
        run: (input: any) =>
          new Promise<void>((resolve) => {
            if (input?.signal?.aborted) {
              resolve();
              return;
            }
            input?.signal?.addEventListener?.("abort", () => resolve(), { once: true });
          }),
      });
      state.attentionSourceRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar AttentionSource:", err);
  }

  // 6. OPENTELEMETRY GENAI AGENT HOOK (`execute_tool` nos harnesses válidos do Buzz Desktop)
  try {
    const agents = ctx?.agents;
    if (agents?.registerHook) {
      const registerOtel = (harness: string, event: string) => {
        agents.registerHook({
          id: `orgfy-otel-${harness.replace(/[^a-z0-9]/gi, "-")}-${event}`,
          harness,
          event,
          run: (input: any, hookCtx: any) => {
            const errMsg = input?.error || input?.isError ? String(input?.error || "tool_error").slice(0, 140) : undefined;
            recordGenAISpan({
              operationName: "execute_tool",
              agentName: String(hookCtx?.agent || input?.agent || "unknown-agent"),
              toolName: input?.toolName || input?.tool ? String(input.toolName || input.tool) : undefined,
              durationMs: Number(input?.durationMs || input?.duration_ms || 0),
              status: errMsg ? "error" : "ok",
              finishReason: errMsg || "ok",
              attributes: {
                "gen_ai.operation.name": "execute_tool",
                "buzz.hook.harness": harness,
                "buzz.hook.event": event,
                "buzz.session.id": String(hookCtx?.session || ""),
              },
            });
            return undefined;
          },
        });
      };
      registerOtel("buzz.pi/pi", "beforeTool");
      registerOtel("buzz.pi/pi", "afterTool");
      registerOtel("buzz.claude-code/claude-code", "beforeTool");
      registerOtel("buzz.claude-code/claude-code", "afterTool");
      state.otelHookRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar OTel AgentHook:", err);
  }

  // 7. NATIVE AGENT PROFILE TAB (`OrgFy` entre Activity e Attention)
  try {
    const agents = ctx?.agents;
    if (agents?.registerTab && typeof agents.registerTab === "function") {
      const AgentOrgfyTab = createAgentOrgfyTabComponent(ctx);
      agents.registerTab({
        id: "orgfy",
        title: "OrgFy",
        component: AgentOrgfyTab,
      });
      state.agentTabRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar aba OrgFy no perfil dos agentes:", err);
  }

  lastNativeState = { ...state };
  return state;
}
