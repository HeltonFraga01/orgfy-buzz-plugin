// ─────────────────────────────────────────────────────────────────────────────
// ORGFY AGENT PROFILE TAB (ctx.agents.registerTab)
// Renderiza a aba nativa "OrgFy" dentro do perfil de cada agente no Buzz Desktop
// (Identity | Memory | Activity | OrgFy | Attention | Settings)
// Dados 100% vivos: modelo atual, cards atribuídos, Radar Goose, OTel & Failover.
// Layout 100% responsivo para o drawer estreito do perfil do agente.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { PipelineCard } from "../types/orgfy";
import { fetchLiveKanbanCards, openIssueInBuzz } from "../services/orgfy-bridge";
import { fetchGooseLoopRadar, type GooseLoopSession } from "../services/kpi-service";
import { getTelemetrySnapshot, subscribeTelemetry, type TelemetrySnapshot } from "../services/telemetry-otel";
import { requestModelFailover } from "../services/model-failover";

const CARD_BG = "rgba(255, 255, 255, 0.03)";
const BORDER = "1px solid rgba(255, 255, 255, 0.08)";

function normName(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
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
    const [sessions, setSessions] = React.useState<GooseLoopSession[]>([]);
    const [telemetry, setTelemetry] = React.useState<TelemetrySnapshot>(() => getTelemetrySnapshot());
    const [loading, setLoading] = React.useState<boolean>(true);
    const [failoverBusy, setFailoverBusy] = React.useState<boolean>(false);
    const [statusBanner, setStatusBanner] = React.useState<{ ok: boolean; text: string } | null>(null);

    const agentName = String(agent?.name || agent?.key || "Agente");
    const agentKey = String(agent?.key || "");
    const agentPubkey = String(agent?.pubkey || "");
    const agentCfg = (agent?.config && typeof agent.config === "object" ? agent.config : {}) as Record<string, any>;
    const currentModel = String(agentCfg.model || agent?.model || "padrão");
    const currentProvider = String(agentCfg.provider || agent?.provider || "padrão");
    const currentHarness = String(agentCfg.harness || agent?.harness || "goose");

    const loadAgentContext = React.useCallback(async () => {
      setLoading(true);
      try {
        const [allCards, radar] = await Promise.all([
          fetchLiveKanbanCards(ctx, { empresa: "all" }).catch(() => [] as PipelineCard[]),
          fetchGooseLoopRadar(ctx).catch(() => null),
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

    const handleFailover = async () => {
      setFailoverBusy(true);
      setStatusBanner(null);
      try {
        const res = await requestModelFailover(ctx, {
          agente: agentName,
          agent_pubkey: agentPubkey || undefined,
          failed_model: currentModel !== "padrão" ? currentModel : undefined,
          prefer_free: false,
          apply: true,
          retrigger: false,
        });
        setStatusBanner({ ok: res.ok, text: res.message });
        if (res.ok) {
          await loadAgentContext();
        }
      } catch (err: any) {
        setStatusBanner({ ok: false, text: `Erro no failover: ${err?.message || err}` });
      } finally {
        setFailoverBusy(false);
      }
    };

    const handleOpenCockpit = () => {
      try {
        const nav: any = (ctx as any)?.navigation;
        if (nav?.open) {
          nav.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
        } else if (nav?.navigate) {
          nav.navigate("orgfy");
        } else if (typeof window !== "undefined") {
          window.location.hash = "#/orgfy";
        }
      } catch {}
    };

    const targetLower = normName(agentName);
    const agentSpans = telemetry.recentSpans
      .filter((sp) => {
        const spName = normName(sp.agentName);
        return spName === targetLower || spName.includes(targetLower) || targetLower.includes(spName);
      })
      .slice(0, 8);

    const agentMetric = telemetry.agentMetrics.find((m) => {
      const mn = normName(m.agentName);
      return mn === targetLower || mn.includes(targetLower);
    });

    const activeCards = cards.filter((c) => c.stage !== "feito");
    const doneCards = cards.filter((c) => c.stage === "feito");

    return h(
      "div",
      {
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
          color: "#f3f4f6",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "12px",
        },
      },
      // Header do Perfil OrgFy
      h(
        "div",
        {
          style: {
            padding: "12px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: "1px solid rgba(16, 185, 129, 0.28)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, width: "100%" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", minWidth: 0 } },
            h(
              "span",
              {
                style: {
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#10b981",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                },
              },
              `OrgFy Control Plane · ${agentName}`
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
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    color: "#f87171",
                    flexShrink: 0,
                  },
                },
                "RISCO RETRY CASCADE"
              )
          ),
          h(
            "div",
            {
              style: {
                fontSize: "11px",
                color: "#9ca3af",
                fontFamily: "monospace",
                lineHeight: "1.45",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              },
            },
            `Harness: ${currentHarness} · Provider: ${currentProvider} · Modelo: ${currentModel}${agentPubkey ? ` · pk: ${agentPubkey.slice(0, 10)}…` : ""}`
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", width: "100%" } },
          h(
            "button",
            {
              onClick: handleFailover,
              disabled: failoverBusy,
              style: {
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "700",
                cursor: failoverBusy ? "wait" : "pointer",
                maxWidth: "100%",
              },
            },
            failoverBusy ? "Testando NexusMind..." : "⚡ Melhor Modelo"
          ),
          h(
            "button",
            {
              onClick: loadAgentContext,
              disabled: loading,
              style: {
                padding: "6px 10px",
                borderRadius: "6px",
                border: BORDER,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#cbd5e1",
                fontSize: "11px",
                cursor: "pointer",
              },
            },
            loading ? "..." : "Atualizar"
          ),
          h(
            "button",
            {
              onClick: handleOpenCockpit,
              style: {
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#10b981",
                color: "#000000",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer",
              },
            },
            "Abrir Control Room"
          )
        )
      ),

      statusBanner &&
        h(
          "div",
          {
            style: {
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor: statusBanner.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
              border: statusBanner.ok ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(245, 158, 11, 0.35)",
              color: statusBanner.ok ? "#a7f3d0" : "#fde68a",
              fontSize: "11px",
              fontFamily: "monospace",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              boxSizing: "border-box",
              width: "100%",
            },
          },
          statusBanner.text
        ),

      // 4 KPIs do Agente (2x2 em drawers estreitos, 4x1 em telas largas)
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
            gap: "8px",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          },
        },
        [
          { label: "Cards Ativos", value: String(activeCards.length), color: "#38bdf8" },
          { label: "Cards Concluídos", value: String(doneCards.length), color: "#10b981" },
          { label: "Sessões Goose (3h)", value: String(sessions.length), color: sessions.some((s) => s.severidade === "critical") ? "#f87171" : "#cbd5e1" },
          { label: "Turnos OTel", value: agentMetric ? `${agentMetric.totalTurns} (${agentMetric.errorTurns} err)` : `${agentSpans.length} spans`, color: "#c084fc" },
        ].map((k) =>
          h(
            "div",
            {
              key: k.label,
              style: {
                padding: "9px 10px",
                borderRadius: "8px",
                backgroundColor: CARD_BG,
                border: BORDER,
                minWidth: 0,
                boxSizing: "border-box",
              },
            },
            h("div", { style: { fontSize: "9.5px", color: "#9ca3af", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, k.label),
            h("div", { style: { fontSize: "15px", fontWeight: "700", color: k.color, fontFamily: "monospace", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, k.value)
          )
        )
      ),

      // Cards Atribuídos na Esteira
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
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px", minWidth: 0 } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, `Cards OrgFy Atribuídos (${cards.length})`),
          h("span", { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } }, "Executor / Revisor / Decisor")
        ),
        loading
          ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Carregando cards da esteira...")
          : cards.length === 0
          ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, `Nenhum card ativo ou recente vinculado a ${agentName} no Kanban atual.`)
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto", overflowX: "hidden", minWidth: 0 } },
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
                      borderRadius: "6px",
                      backgroundColor: "rgba(0,0,0,0.28)",
                      border: BORDER,
                      minWidth: 0,
                      width: "100%",
                      boxSizing: "border-box",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1, overflow: "hidden" } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px", minWidth: 0 } },
                      h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#38bdf8", fontWeight: "700" } }, `#${c.issueId.slice(0, 8)}`),
                      h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: role === "EXECUTOR" ? "rgba(16,185,129,0.18)" : "rgba(192,132,252,0.18)", color: role === "EXECUTOR" ? "#34d399" : "#d8b4fe" } }, role),
                      h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(255,255,255,0.08)", color: "#cbd5e1", textTransform: "uppercase" } }, c.stage)
                    ),
                    h(
                      "span",
                      {
                        title: c.title,
                        style: {
                          fontSize: "11.5px",
                          fontWeight: "600",
                          color: "#f3f4f6",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                          maxWidth: "100%",
                        },
                      },
                      c.title
                    )
                  ),
                  c.fullIssueId &&
                    h(
                      "button",
                      {
                        onClick: () => openIssueInBuzz(ctx, { id: c.fullIssueId!, owner: c.owner, dtag: c.empresa || "orgfy" }),
                        style: {
                          padding: "4px 8px",
                          borderRadius: "5px",
                          border: "1px solid rgba(56, 189, 248, 0.35)",
                          backgroundColor: "rgba(56, 189, 248, 0.1)",
                          color: "#38bdf8",
                          fontSize: "10px",
                          fontWeight: "600",
                          cursor: "pointer",
                          flexShrink: 0,
                        },
                      },
                      "Abrir ↗"
                    )
                );
              })
            )
      ),

      // Sessões Goose & OTel Spans (empilha em 1 coluna no drawer estreito, 2 colunas em telas largas)
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          },
        },
        // Sessões Goose
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
              boxSizing: "border-box",
              overflow: "hidden",
            },
          },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Sessões Goose Recentes (3h)"),
          sessions.length === 0
            ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Nenhuma sessão recente no radar Goose.")
            : sessions.map((s) =>
                h(
                  "div",
                  {
                    key: s.session_id,
                    style: {
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0,0,0,0.28)",
                      border: s.severidade === "critical" ? "1px solid rgba(239,68,68,0.35)" : BORDER,
                      fontSize: "10px",
                      fontFamily: "monospace",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      minWidth: 0,
                      overflow: "hidden",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px", minWidth: 0 } },
                    h("span", { style: { color: s.ativa ? "#34d399" : "#9ca3af", fontWeight: "700", overflowWrap: "anywhere" } }, `${s.ativa ? "ATIVA" : "HIST"} · ${s.session_id}`),
                    h("span", { style: { color: "#cbd5e1", flexShrink: 0 } }, `${s.duracao_min.toFixed(0)}m · ${s.shells} shells`)
                  ),
                  h(
                    "span",
                    { style: { color: s.flags.length > 0 ? "#fbbf24" : "#10b981", overflowWrap: "anywhere", wordBreak: "break-word" } },
                    s.flags.length > 0 ? s.flags.join(" · ") : "OK"
                  )
                )
              )
        ),
        // Spans OTel GenAI
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
              boxSizing: "border-box",
              overflow: "hidden",
            },
          },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Spans OTel GenAI deste Agente"),
          agentSpans.length === 0
            ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Nenhum span OTel capturado ainda nesta sessão do Buzz.")
            : agentSpans.map((sp) =>
                h(
                  "div",
                  {
                    key: sp.spanId,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "6px",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0,0,0,0.28)",
                      fontSize: "10px",
                      fontFamily: "monospace",
                      minWidth: 0,
                    },
                  },
                  h("span", { style: { color: "#38bdf8", fontWeight: "600", overflowWrap: "anywhere", minWidth: 0 } }, sp.toolName || sp.operationName),
                  h("span", { style: { color: sp.status === "error" ? "#f87171" : "#10b981", fontWeight: "700", flexShrink: 0 } }, `${sp.status.toUpperCase()} · ${sp.durationMs}ms`)
                )
              )
        )
      )
    );
  };
}
