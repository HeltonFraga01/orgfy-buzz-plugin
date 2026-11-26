// ─────────────────────────────────────────────────────────────────────────────
// ORGFY AGENT PROFILE TAB v17.3 (ctx.agents.registerTab)
// Aba nativa "OrgFy" dentro do perfil de cada agente no Buzz Desktop
// (Identity | Memory | Activity | Bestie | Attention | OrgFy | Settings)
// 100% conectada às APIs diretas do Buzz:
// - session.agentActivity + session.presence (turno ao vivo e presença)
// - ctx.agents.save() (reconciliação Eval R5.1 respeitando config + configBase)
// - ctx.agents.session() (Compactar, Nova sessão, Parar)
// - session.repositories (Issues & PRs NIP-34 ao vivo) + openBuzzRepoEntity (1 salto)
// - Variáveis nativas do tema do Buzz Desktop
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { PipelineCard } from "../types/orgfy";
import { fetchLiveKanbanCards, openIssueInBuzz } from "../services/orgfy-bridge";
import {
  DEFAULT_ORGFY_REPO_OWNER,
  loadLiveRepoSnapshot,
  openBuzzRepoEntity,
  openRepoTabInBuzz,
  type LiveRepoItemSummary,
} from "../services/buzz-repos-live";
import {
  interruptLiveTurn,
  readBuzzLiveTelemetry,
  type LiveAgentTurn,
} from "../factory/buzz-live-telemetry";
import { fetchGooseLoopRadar, type GooseLoopSession } from "../services/kpi-service";
import { getTelemetrySnapshot, subscribeTelemetry, type TelemetrySnapshot } from "../services/telemetry-otel";

const EVAL_R51_WINNERS = new Set(["claude-sonnet-5-5", "claude-sonnet-4-6", "gemini-2.5-flash"]);

const SURFACE_BG = "var(--affordance-subtle, rgba(255, 255, 255, 0.035))";
const CARD_BG = "var(--bg-panel, rgba(255, 255, 255, 0.03))";
const BORDER = "1px solid var(--border-primary, rgba(255, 255, 255, 0.09))";
const TEXT_PRIMARY = "var(--text-primary, #f3f4f6)";
const TEXT_MUTED = "var(--text-tertiary, #9ca3af)";
const ACCENT = "var(--accent-primary, var(--green-11, #3dd68c))";
const BLUE = "var(--blue-11, #60a5fa)";
const AMBER = "var(--amber-11, #fbbf24)";
const RED = "var(--red-11, #f87171)";

function normName(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
}

function recommendedModelForAgent(name: string): { provider: string; model: string; tierLabel: string } {
  const lower = normName(name);
  const isTier1 = /(iris|bento|arquit|teo|vera|hugo|lara|ceo|coo|revis|qa|segur|oraculo)/.test(lower);
  if (isTier1) {
    return { provider: "nexusmind_anthropic", model: "claude-sonnet-5-5", tierLabel: "Tier 1 (Liderança/Revisão)" };
  }
  return { provider: "nexusmind_antigravity", model: "gemini-2.5-flash", tierLabel: "Tier 2 (Execução rápida)" };
}

export function createAgentOrgfyTabComponent(ctx: Context) {
  const React = ctx?.react;
  if (!React?.createElement) {
    return function FallbackAgentOrgfyTab() {
      return null;
    };
  }
  const h = React.createElement;

  return function AgentOrgfyTab({ agent }: { agent: any }) {
    const [cards, setCards] = React.useState<PipelineCard[]>([]);
    const [repoItems, setRepoItems] = React.useState<LiveRepoItemSummary[]>([]);
    const [repoOwner, setRepoOwner] = React.useState<string>(DEFAULT_ORGFY_REPO_OWNER);
    const [sessions, setSessions] = React.useState<GooseLoopSession[]>([]);
    const [telemetry, setTelemetry] = React.useState<TelemetrySnapshot>(() => getTelemetrySnapshot());
    const [activityTick, setActivityTick] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [busyAction, setBusyAction] = React.useState<string | null>(null);
    const [statusBanner, setStatusBanner] = React.useState<{ ok: boolean; text: string } | null>(null);

    const agentName = String(agent?.name || agent?.key || "Agente");
    const agentKey = String(agent?.key || "");
    const agentPubkey = String(agent?.pubkey || "").toLowerCase();
    const agentCfg = (agent?.config && typeof agent.config === "object" ? agent.config : {}) as Record<string, any>;
    const currentModel = String(agentCfg.model || agent?.model || "padrão");
    const currentProvider = String(agentCfg.provider || agent?.provider || "padrão");
    const currentHarness = String(agentCfg.harness || agent?.harness || agent?.type || "goose");
    const shortModel = String(currentModel.split("/").pop() || currentModel).trim();
    const isCompliantR51 = EVAL_R51_WINNERS.has(shortModel);
    const recommended = recommendedModelForAgent(agentName);

    // Assina telemetria ao vivo nativa do Buzz (session.agentActivity)
    React.useEffect(() => {
      const session = (ctx as any)?.relay?.snapshot?.()?.session;
      if (!session?.agentActivity) return;
      const disposers: Array<() => void> = [];
      const bump = () => setActivityTick((n) => n + 1);
      try {
        if (typeof session.agentActivity.activate === "function") disposers.push(session.agentActivity.activate());
        if (typeof session.agentActivity.subscribe === "function") disposers.push(session.agentActivity.subscribe(bump));
        if (typeof session.agentActivity.subscribeWorking === "function") disposers.push(session.agentActivity.subscribeWorking(bump));
      } catch {}
      return () => {
        for (const d of disposers) {
          try { d(); } catch {}
        }
      };
    }, []);

    const liveTelemetry = React.useMemo(() => {
      const map = new Map<string, string>();
      if (agentPubkey) map.set(agentPubkey, agentName);
      return readBuzzLiveTelemetry(ctx, map);
    }, [agentPubkey, agentName, activityTick]);

    const liveTurn: LiveAgentTurn | null = agentPubkey ? liveTelemetry.byPubkey[agentPubkey] || null : null;
    const presence = agentPubkey ? liveTelemetry.presenceByPubkey[agentPubkey] : undefined;

    const loadAgentContext = React.useCallback(async () => {
      setLoading(true);
      try {
        const [allCards, radar, repoSnap] = await Promise.all([
          fetchLiveKanbanCards(ctx, { empresa: "all" }).catch(() => [] as PipelineCard[]),
          fetchGooseLoopRadar(ctx).catch(() => null),
          loadLiveRepoSnapshot(ctx, { dtag: "orgfy" }).catch(() => null),
        ]);

        const targetName = normName(agentName);
        const targetKey = normName(agentKey);
        const targetPk = normName(agentPubkey);

        const matchedCards = (allCards || []).filter((c) => {
          const ex = normName(c.executor);
          const rv = normName(c.revisor);
          const dc = normName(c.decisor);
          return (
            (targetName && (ex === targetName || rv === targetName || dc === targetName || ex.includes(targetName) || rv.includes(targetName))) ||
            (targetKey && (ex === targetKey || rv === targetKey))
          );
        });
        setCards(matchedCards);

        if (repoSnap?.available) {
          setRepoOwner(repoSnap.owner);
          const allNip34 = [...repoSnap.prs, ...repoSnap.issues].filter((it) => {
            if (targetPk && it.authorPubkey === targetPk) return true;
            if (targetName && it.content.toLowerCase().includes(targetName)) return true;
            return false;
          });
          setRepoItems(allNip34.slice(0, 10));
        }

        const matchedSessions = (radar?.sessoes || []).filter((s) => {
          const sn = normName(s.agente);
          const spk = normName(s.agent_pubkey);
          return (
            (targetPk && spk && spk === targetPk) ||
            (targetName && sn && (sn === targetName || sn.includes(targetName) || targetName.includes(sn)))
          );
        });
        setSessions(matchedSessions.slice(0, 6));
      } finally {
        setLoading(false);
      }
    }, [agentName, agentKey, agentPubkey]);

    React.useEffect(() => {
      loadAgentContext();
      const unsub = subscribeTelemetry(() => setTelemetry(getTelemetrySnapshot()));
      return () => unsub();
    }, [loadAgentContext]);

    const handleApplyEvalR51 = async () => {
      const agentsApi = (ctx as any)?.agents;
      if (!agentKey || typeof agentsApi?.save !== "function") {
        setStatusBanner({ ok: false, text: "API ctx.agents.save indisponível nesta versão do Buzz." });
        return;
      }
      setBusyAction("eval");
      setStatusBanner(null);
      try {
        await agentsApi.save(agentKey, {
          config: { ...agentCfg, provider: recommended.provider, model: recommended.model },
          ...(agent?.configBase ? { base: agent.configBase } : {}),
        });
        setStatusBanner({
          ok: true,
          text: `Modelo atualizado via ctx.agents.save(): ${recommended.provider}/${recommended.model} (${recommended.tierLabel}).`,
        });
        await loadAgentContext();
      } catch (err: any) {
        setStatusBanner({ ok: false, text: `Falha ao atualizar modelo: ${err?.message || err}` });
      } finally {
        setBusyAction(null);
      }
    };

    const handleSessionAction = async (action: "interrupt" | "compact" | "new") => {
      setBusyAction(action);
      setStatusBanner(null);
      try {
        if (action === "interrupt" && liveTurn?.stoppable) {
          const interrupted = await interruptLiveTurn(ctx, liveTurn);
          if (interrupted) {
            setStatusBanner({ ok: true, text: `Turno ao vivo de ${agentName} interrompido via session.agentActivity.` });
            return;
          }
        }
        const agentsApi = (ctx as any)?.agents;
        if (!agentKey || typeof agentsApi?.session !== "function") {
          setStatusBanner({ ok: false, text: "API ctx.agents.session indisponível nesta versão do Buzz." });
          return;
        }
        const place = liveTurn?.channelId ? { channelId: liveTurn.channelId } : {};
        await agentsApi.session(agentKey, place, action);
        const label = action === "interrupt" ? "interrompida" : action === "compact" ? "compactada" : "reiniciada";
        setStatusBanner({ ok: true, text: `Sessão de ${agentName} ${label} via ctx.agents.session().` });
      } catch (err: any) {
        setStatusBanner({ ok: false, text: `Erro ao executar ${action}: ${err?.message || err}` });
      } finally {
        setBusyAction(null);
      }
    };

    const handleOpenFactory = () => {
      try {
        const nav: any = (ctx as any)?.navigation;
        if (nav?.open) {
          nav.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
        } else if (nav?.navigate) {
          nav.navigate("orgfy");
        }
      } catch {}
    };

    const handleOpenDirectIssue = async (item: { id: string; kind?: "issue" | "pr"; owner?: string; dtag?: string }) => {
      const ok = await openBuzzRepoEntity(ctx, {
        type: item.kind === "pr" ? "pr" : "issue",
        owner: item.owner || repoOwner,
        dtag: item.dtag || "orgfy",
        id: item.id,
      }).catch(() => false);
      if (!ok) {
        await openIssueInBuzz(ctx, { id: item.id, owner: item.owner || repoOwner, dtag: item.dtag || "orgfy" }).catch(() => false);
      }
    };

    const targetLower = normName(agentName);
    const agentSpans = telemetry.recentSpans
      .filter((sp) => {
        const spName = normName(sp.agentName);
        return spName === targetLower || spName.includes(targetLower) || targetLower.includes(spName);
      })
      .slice(0, 6);

    const agentMetric = telemetry.agentMetrics.find((m) => {
      const mn = normName(m.agentName);
      return mn === targetLower || mn.includes(targetLower);
    });

    const activeCards = cards.filter((c) => c.stage !== "feito");
    const doneCards = cards.filter((c) => c.stage === "feito");

    const btnBase = {
      padding: "5px 9px",
      borderRadius: "7px",
      border: BORDER,
      backgroundColor: SURFACE_BG,
      color: TEXT_PRIMARY,
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
    } as const;

    return h(
      "div",
      {
        "data-agent-orgfy-tab": "v17.3",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "10px 0",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflowX: "hidden",
          color: TEXT_PRIMARY,
          fontFamily: "inherit",
          fontSize: "12px",
        },
      },

      // 1. Cabeçalho OrgFy Factory + Status ao vivo + Ações nativas Buzz API
      h(
        "div",
        {
          style: {
            padding: "12px",
            borderRadius: "11px",
            backgroundColor: CARD_BG,
            border: liveTurn ? `1px solid ${BLUE}` : BORDER,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "100%",
            boxSizing: "border-box",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: ACCENT } }, `OrgFy Factory · ${agentName}`),
            h(
              "span",
              {
                style: {
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "2px 7px",
                  borderRadius: "9999px",
                  backgroundColor: liveTurn ? "rgba(96, 165, 250, 0.16)" : "rgba(61, 214, 140, 0.14)",
                  color: liveTurn ? BLUE : ACCENT,
                },
              },
              liveTurn ? "⚡ Respondendo agora" : presence === "online" ? "Online" : "Disponível"
            ),
            !isCompliantR51 &&
              h(
                "span",
                {
                  "data-eval-r51-alert": "true",
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 7px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(248, 113, 113, 0.16)",
                    color: RED,
                  },
                },
                "Fora do Eval R5.1"
              ),
            agentMetric?.retryCascadeRisk &&
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 7px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(248, 113, 113, 0.2)",
                    color: RED,
                  },
                },
                "Retry Cascade"
              )
          ),
          h(
            "div",
            {
              style: {
                fontSize: "11px",
                color: TEXT_MUTED,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                lineHeight: "1.45",
                overflowWrap: "anywhere",
              },
            },
            `Harness: ${currentHarness} · Provider: ${currentProvider} · Modelo: ${currentModel}${agentPubkey ? ` · pk: ${agentPubkey.slice(0, 10)}…` : ""}`
          )
        ),

        // Turno em execução ao vivo (session.agentActivity)
        liveTurn &&
          h(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderRadius: "8px",
                backgroundColor: SURFACE_BG,
                border: `1px solid ${liveTurn.state === "error" ? RED : BLUE}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { minWidth: 0, flex: 1 } },
              h("div", { style: { fontSize: "11.5px", fontWeight: "600", color: liveTurn.state === "error" ? RED : BLUE } }, liveTurn.stepLabel),
              liveTurn.toolName &&
                h("div", { style: { fontSize: "10px", color: TEXT_MUTED, fontFamily: "monospace" } }, `tool: ${liveTurn.toolName}`)
            ),
            h(
              "button",
              {
                type: "button",
                disabled: busyAction === "interrupt",
                onClick: () => handleSessionAction("interrupt"),
                style: { ...btnBase, borderColor: "rgba(248, 113, 113, 0.45)", color: RED },
              },
              "Parar"
            )
          ),

        // Barra de ações nativas (Eval R5.1, Sessão, Factory, Repos)
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
          !isCompliantR51 &&
            h(
              "button",
              {
                type: "button",
                disabled: busyAction === "eval",
                onClick: handleApplyEvalR51,
                "data-apply-eval-r51": "true",
                style: {
                  ...btnBase,
                  borderColor: "rgba(96, 165, 250, 0.45)",
                  backgroundColor: "rgba(96, 165, 250, 0.14)",
                  color: BLUE,
                },
              },
              busyAction === "eval" ? "Salvando..." : `Aplicar ${recommended.model}`
            ),
          h(
            "button",
            { type: "button", disabled: busyAction === "compact", onClick: () => handleSessionAction("compact"), style: btnBase },
            "Compactar"
          ),
          h(
            "button",
            { type: "button", disabled: busyAction === "new", onClick: () => handleSessionAction("new"), style: btnBase },
            "Nova sessão"
          ),
          h(
            "button",
            { type: "button", disabled: loading, onClick: loadAgentContext, style: btnBase },
            loading ? "..." : "Atualizar"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => openRepoTabInBuzz(ctx, { owner: repoOwner, dtag: "orgfy", tab: "issues" }),
              style: btnBase,
            },
            "Buzz Repos ↗"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: handleOpenFactory,
              style: {
                ...btnBase,
                border: "none",
                backgroundColor: ACCENT,
                color: "var(--text-on-prominent, #08120c)",
              },
            },
            "Abrir OrgFy Factory"
          )
        )
      ),

      statusBanner &&
        h(
          "div",
          {
            style: {
              padding: "9px 11px",
              borderRadius: "8px",
              backgroundColor: statusBanner.ok ? "rgba(61, 214, 140, 0.12)" : "rgba(251, 191, 36, 0.12)",
              border: `1px solid ${statusBanner.ok ? ACCENT : AMBER}`,
              color: statusBanner.ok ? ACCENT : AMBER,
              fontSize: "11px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              overflowWrap: "anywhere",
            },
          },
          statusBanner.text
        ),

      // 2. 4 KPIs compactos
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "8px",
            width: "100%",
          },
        },
        [
          { label: "Cards Ativos", value: String(activeCards.length), color: BLUE },
          { label: "Concluídos", value: String(doneCards.length), color: ACCENT },
          { label: "NIP-34 (Repos)", value: String(repoItems.length), color: TEXT_PRIMARY },
          { label: "OTel Spans", value: agentMetric ? `${agentMetric.totalTurns} (${agentMetric.errorTurns} err)` : String(agentSpans.length), color: "#c084fc" },
        ].map((k) =>
          h(
            "div",
            {
              key: k.label,
              style: {
                padding: "9px 10px",
                borderRadius: "9px",
                backgroundColor: CARD_BG,
                border: BORDER,
                minWidth: 0,
              },
            },
            h("div", { style: { fontSize: "9.5px", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em" } }, k.label),
            h("div", { style: { fontSize: "15px", fontWeight: "700", color: k.color, fontFamily: "ui-monospace, monospace", marginTop: "3px" } }, k.value)
          )
        )
      ),

      // 3. Issues & PRs ao vivo do Buzz Repos (NIP-34) — abertura direta em 1 salto
      repoItems.length > 0 &&
        h(
          "div",
          {
            "data-agent-nip34-list": "true",
            style: {
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: CARD_BG,
              border: BORDER,
              display: "flex",
              flexDirection: "column",
              gap: "7px",
            },
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "12px", fontWeight: "700" } }, `Buzz Repos NIP-34 (${repoItems.length})`),
            h("span", { style: { fontSize: "10px", color: TEXT_MUTED, fontFamily: "monospace" } }, "session.repositories")
          ),
          repoItems.slice(0, 6).map((it) =>
            h(
              "div",
              {
                key: it.id,
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "7px 9px",
                  borderRadius: "7px",
                  backgroundColor: SURFACE_BG,
                  border: BORDER,
                },
              },
              h(
                "div",
                { style: { minWidth: 0, flex: 1 } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" } },
                  h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: BLUE, fontWeight: "700" } }, `#${String(it.id || "").slice(0, 8)}`),
                  h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: it.kind === "pr" ? "rgba(61, 214, 140, 0.16)" : "rgba(96, 165, 250, 0.16)", color: it.kind === "pr" ? ACCENT : BLUE, textTransform: "uppercase" } }, it.kind)
                ),
                h("div", { title: it.title, style: { fontSize: "11.5px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.title)
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: () => handleOpenDirectIssue({ id: it.id, kind: it.kind, owner: it.owner, dtag: it.dtag }),
                  style: { ...btnBase, color: BLUE, padding: "4px 8px", fontSize: "10px", flexShrink: 0 },
                },
                "Abrir ↗"
              )
            )
          )
        ),

      // 4. Cards OrgFy atribuídos na esteira
      h(
        "div",
        {
          style: {
            padding: "12px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700" } }, `Cards OrgFy Atribuídos (${cards.length})`),
          h("span", { style: { fontSize: "10px", color: TEXT_MUTED, fontFamily: "monospace" } }, "Executor / Revisor / Decisor")
        ),
        loading
          ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, "Carregando cards da esteira...")
          : cards.length === 0
          ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, `Nenhum card ativo ou recente vinculado a ${agentName}.`)
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" } },
              cards.slice(0, 12).map((c) => {
                const role =
                  normName(c.executor) === targetLower
                    ? "EXECUTOR"
                    : normName(c.revisor) === targetLower
                    ? "REVISOR"
                    : "DECISOR";
                return h(
                  "div",
                  {
                    key: c.id,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "7px",
                      backgroundColor: SURFACE_BG,
                      border: BORDER,
                      minWidth: 0,
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1 } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px" } },
                      h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: BLUE, fontWeight: "700" } }, `#${String(c.issueId || "").slice(0, 8)}`),
                      h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: role === "EXECUTOR" ? "rgba(61,214,140,0.16)" : "rgba(192,132,252,0.16)", color: role === "EXECUTOR" ? ACCENT : "#d8b4fe" } }, role),
                      h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(255,255,255,0.07)", color: TEXT_MUTED, textTransform: "uppercase" } }, c.stage)
                    ),
                    h("span", { title: c.title, style: { fontSize: "11.5px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.title)
                  ),
                  c.fullIssueId &&
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleOpenDirectIssue({ id: c.fullIssueId!, kind: "issue", owner: c.owner, dtag: c.empresa || "orgfy" }),
                        style: { ...btnBase, color: BLUE, padding: "4px 8px", fontSize: "10px", flexShrink: 0 },
                      },
                      "Abrir ↗"
                    )
                );
              })
            )
      ),

      // 5. Sessões Goose & Spans OTel GenAI
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "10px",
            width: "100%",
          },
        },
        h(
          "div",
          {
            style: {
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: CARD_BG,
              border: BORDER,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              minWidth: 0,
            },
          },
          h("span", { style: { fontSize: "12px", fontWeight: "700" } }, "Sessões Goose Recentes (3h)"),
          sessions.length === 0
            ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, "Nenhuma sessão recente no radar Goose.")
            : sessions.map((s) =>
                h(
                  "div",
                  {
                    key: s.session_id,
                    style: {
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: SURFACE_BG,
                      border: s.severidade === "critical" ? `1px solid ${RED}` : BORDER,
                      fontSize: "10px",
                      fontFamily: "monospace",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", gap: "4px" } },
                    h("span", { style: { color: s.ativa ? ACCENT : TEXT_MUTED, fontWeight: "700" } }, `${s.ativa ? "ATIVA" : "HIST"} · ${s.session_id}`),
                    h("span", { style: { color: TEXT_PRIMARY } }, `${s.duracao_min.toFixed(0)}m · ${s.shells} shells`)
                  ),
                  h("span", { style: { color: s.flags.length > 0 ? AMBER : ACCENT } }, s.flags.length > 0 ? s.flags.join(" · ") : "OK")
                )
              )
        ),
        h(
          "div",
          {
            style: {
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: CARD_BG,
              border: BORDER,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              minWidth: 0,
            },
          },
          h("span", { style: { fontSize: "12px", fontWeight: "700" } }, "Spans OTel GenAI deste Agente"),
          agentSpans.length === 0
            ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, "Nenhum span OTel capturado ainda nesta sessão do Buzz.")
            : agentSpans.map((sp) =>
                h(
                  "div",
                  {
                    key: sp.spanId,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      backgroundColor: SURFACE_BG,
                      fontSize: "10px",
                      fontFamily: "monospace",
                    },
                  },
                  h("span", { style: { color: BLUE, fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sp.toolName || sp.operationName),
                  h("span", { style: { color: sp.status === "error" ? RED : ACCENT, fontWeight: "700", flexShrink: 0 } }, `${sp.status.toUpperCase()} · ${sp.durationMs}ms`)
                )
              )
        )
      )
    );
  };
}
