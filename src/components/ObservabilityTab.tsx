// ─────────────────────────────────────────────────────────────────────────────
// ORGFY OBSERVABILIDADE & EVENTOS TAB (v13 FRONTIER)
// Tela dedicada para OpenTelemetry GenAI, Economia da Decisions API,
// Saúde de Retry Cascades por Agente e Status das Integrações Nativas do Buzz.
// ─────────────────────────────────────────────────────────────────────────────

import type { TelemetrySnapshot, OTelGenAISpan } from "../services/telemetry-otel";
import type { BuzzNativeState } from "../services/buzz-native";

export interface ObservabilityTabProps {
  h: any;
  telemetry: TelemetrySnapshot;
  nativeState: BuzzNativeState;
  operationFilter: string;
  onFilterChange: (op: string) => void;
  isProbingDecision: boolean;
  lastProbeSummary: string | null;
  onRunDecisionProbe: () => void;
  onResetSpans: () => void;
  onRefresh: () => void;
}

const CARD_BG = "rgba(0, 0, 0, 0.28)";
const BORDER = "1px solid rgba(255, 255, 255, 0.08)";

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

export function renderObservabilityTab(props: ObservabilityTabProps) {
  const {
    h,
    telemetry,
    nativeState,
    operationFilter,
    onFilterChange,
    isProbingDecision,
    lastProbeSummary,
    onRunDecisionProbe,
    onResetSpans,
    onRefresh,
  } = props;

  const filteredSpans: OTelGenAISpan[] =
    operationFilter === "all"
      ? telemetry.recentSpans
      : telemetry.recentSpans.filter((s) => s.operationName === operationFilter);

  const integrationPills = [
    { label: "Relay Live", ok: nativeState.relayConnected },
    { label: "Slash Commands (/orgfy-*)", ok: nativeState.conversationRegistered },
    { label: "Sidebar Pulse", ok: nativeState.sidebarRegistered },
    { label: "Atalho ⌘⇧O", ok: nativeState.shortcutsRegistered },
    { label: "AttentionSource orgfy.pipeline", ok: nativeState.attentionSourceRegistered },
    { label: "OTel GenAI Hooks", ok: nativeState.otelHookRegistered },
    { label: "Aba OrgFy nos Agentes", ok: nativeState.agentTabRegistered },
  ];

  const activeCount = integrationPills.filter((p) => p.ok).length;

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "6px",
      },
    },
    // Barra Superior de Ações
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "10px",
          backgroundColor: CARD_BG,
          border: "1px solid rgba(56, 189, 248, 0.25)",
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        h(
          "span",
          { style: { fontSize: "13.5px", fontWeight: "700", color: "#f3f4f6" } },
          "Observabilidade Frontier — OpenTelemetry GenAI & Decisions API"
        ),
        h(
          "span",
          { style: { fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
          `${telemetry.totalSpans} spans em memória · ${telemetry.decisionsSavings.totalCalls} avaliações Decisions · ${activeCount}/${integrationPills.length} integrações Buzz nativas ativas`
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        h(
          "button",
          {
            onClick: onRunDecisionProbe,
            disabled: isProbingDecision,
            style: {
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#38bdf8",
              color: "#000000",
              fontSize: "11px",
              fontWeight: "700",
              cursor: isProbingDecision ? "wait" : "pointer",
            },
          },
          isProbingDecision ? "Testando Decisions API..." : "⚡ Testar Decisions API Agora"
        ),
        h(
          "button",
          {
            onClick: onRefresh,
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
          "Atualizar"
        ),
        h(
          "button",
          {
            onClick: onResetSpans,
            style: {
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#fca5a5",
              fontSize: "11px",
              cursor: "pointer",
            },
          },
          "Limpar Spans"
        )
      )
    ),

    lastProbeSummary &&
      h(
        "div",
        {
          style: {
            padding: "10px 14px",
            borderRadius: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontSize: "11px",
            color: "#a7f3d0",
            fontFamily: "monospace",
          },
        },
        lastProbeSummary
      ),

    // 4 KPI Cards de Observabilidade
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "10px",
        },
      },
      [
        {
          title: "1. Decisions API (Pré-LLM)",
          value: `${telemetry.decisionsSavings.decisionsApiCalls} nativas`,
          sub: `${telemetry.decisionsSavings.fallbackCalls} fallback · média ${telemetry.decisionsSavings.avgLatencyMs}ms`,
          color: "#10b981",
        },
        {
          title: "2. Wakes / Escalações Evitadas",
          value: String(telemetry.decisionsSavings.wakesOrEscalationsAvoided),
          sub: "Eventos filtrados antes de acordar LLM caro",
          color: "#38bdf8",
        },
        {
          title: "3. Tokens Economizados (Est.)",
          value: `~${Math.round(telemetry.decisionsSavings.estimatedTokensSaved / 1000)}k tok`,
          sub: `${telemetry.decisionsSavings.estimatedTokensSaved.toLocaleString("pt-BR")} tokens poupados`,
          color: "#c084fc",
        },
        {
          title: "4. Alertas Retry Cascade",
          value: String(telemetry.retryCascadeAlerts.length),
          sub:
            telemetry.retryCascadeAlerts.length > 0
              ? "Agentes com falhas consecutivas detectados"
              : "Nenhum agente em cascata de erro",
          color: telemetry.retryCascadeAlerts.length > 0 ? "#f87171" : "#10b981",
        },
      ].map((kpi) =>
        h(
          "div",
          {
            key: kpi.title,
            style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER },
          },
          h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, kpi.title),
          h("div", { style: { fontSize: "22px", fontWeight: "700", color: kpi.color, marginTop: "4px", fontFamily: "monospace" } }, kpi.value),
          h("div", { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } }, kpi.sub)
        )
      )
    ),

    // Barra de Sinergia Nativa Buzz Desktop
    h(
      "div",
      {
        style: {
          padding: "12px 14px",
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
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Sinergia Nativa com Buzz Desktop (@buzz/author)"),
        h("span", { style: { fontSize: "10.5px", color: "#10b981", fontFamily: "monospace" } }, `${activeCount}/${integrationPills.length} ativos`)
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        integrationPills.map((p) =>
          h(
            "span",
            {
              key: p.label,
              style: {
                fontSize: "10.5px",
                fontFamily: "monospace",
                fontWeight: "600",
                padding: "4px 10px",
                borderRadius: "9999px",
                backgroundColor: p.ok ? "rgba(16, 185, 129, 0.14)" : "rgba(156, 163, 175, 0.12)",
                border: p.ok ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(156, 163, 175, 0.25)",
                color: p.ok ? "#34d399" : "#9ca3af",
              },
            },
            `${p.ok ? "●" : "○"} ${p.label}`
          )
        )
      )
    ),

    // Grid Principal 2 Colunas: Stream de Spans OTel + Saúde por Agente
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "12px",
          alignItems: "start",
        },
      },
      // Coluna Esquerda: Live Event & Span Stream
      h(
        "div",
        {
          style: {
            padding: "14px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, `Live Event & Span Stream (${filteredSpans.length})`),
          h(
            "div",
            { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
            [
              { id: "all", label: "Todos" },
              { id: "invoke_agent", label: "Agentes" },
              { id: "execute_tool", label: "Tools" },
              { id: "decisions.evaluate", label: "Decisions" },
              { id: "relay.event", label: "Relay" },
            ].map((f) =>
              h(
                "button",
                {
                  key: f.id,
                  onClick: () => onFilterChange(f.id),
                  style: {
                    padding: "3px 8px",
                    borderRadius: "5px",
                    border: operationFilter === f.id ? "1px solid rgba(56, 189, 248, 0.5)" : BORDER,
                    backgroundColor: operationFilter === f.id ? "rgba(56, 189, 248, 0.16)" : "rgba(255,255,255,0.03)",
                    color: operationFilter === f.id ? "#38bdf8" : "#9ca3af",
                    fontSize: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                  },
                },
                f.label
              )
            )
          )
        ),
        filteredSpans.length === 0
          ? h(
              "div",
              {
                style: {
                  padding: "24px 12px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "11.5px",
                  lineHeight: "1.5",
                },
              },
              "Nenhum span capturado neste filtro ainda. Clique em '⚡ Testar Decisions API Agora' ou execute uma tool/agente para ver o stream OTel ao vivo."
            )
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "5px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" } },
              filteredSpans.map((sp) =>
                h(
                  "div",
                  {
                    key: sp.spanId,
                    style: {
                      display: "grid",
                      gridTemplateColumns: "62px 112px 1fr 78px 54px",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(255,255,255,0.025)",
                      border: sp.status === "error" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.04)",
                      fontSize: "10.5px",
                      fontFamily: "monospace",
                      alignItems: "center",
                    },
                  },
                  h("span", { style: { color: "#6b7280" } }, formatTime(sp.timestamp)),
                  h("span", { style: { color: "#38bdf8", fontWeight: "700" } }, sp.operationName),
                  h(
                    "span",
                    {
                      style: { color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                      title: `${sp.agentName} ${sp.toolName || ""} ${sp.model || ""} ${sp.finishReason || ""}`,
                    },
                    `${sp.agentName}${sp.toolName ? ` · ${sp.toolName}` : ""}${sp.model ? ` (${sp.model})` : ""}`
                  ),
                  h(
                    "span",
                    {
                      style: {
                        color: sp.status === "error" ? "#f87171" : sp.status === "filtered_out" ? "#c084fc" : "#10b981",
                        fontWeight: "700",
                        textAlign: "center",
                      },
                    },
                    sp.status.toUpperCase()
                  ),
                  h("span", { style: { color: "#9ca3af", textAlign: "right" } }, `${sp.durationMs}ms`)
                )
              )
            )
      ),

      // Coluna Direita: Saúde & Retry Cascades por Agente + Distribuição Decisions
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "div",
          { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER, display: "flex", flexDirection: "column", gap: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Saúde & Retry Cascade por Agente"),
          telemetry.agentMetrics.length === 0
            ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Aguardando turnos dos agentes via hook OTel (turn.completed / turn.failed).")
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                telemetry.agentMetrics.map((m) =>
                  h(
                    "div",
                    {
                      key: m.agentName,
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "7px 9px",
                        borderRadius: "6px",
                        backgroundColor: m.retryCascadeRisk ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.025)",
                        border: m.retryCascadeRisk ? "1px solid rgba(239, 68, 68, 0.35)" : BORDER,
                        fontSize: "10.5px",
                        fontFamily: "monospace",
                      },
                    },
                    h("span", { style: { color: "#f3f4f6", fontWeight: "700" } }, m.agentName),
                    h(
                      "span",
                      { style: { color: m.retryCascadeRisk ? "#f87171" : "#10b981" } },
                      `${m.totalTurns} turnos · ${m.errorTurns} err · ${m.avgDurationMs}ms`
                    )
                  )
                )
              )
        ),

        h(
          "div",
          { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER, display: "flex", flexDirection: "column", gap: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Chamadas Decisions API por Modo"),
          Object.keys(telemetry.decisionsSavings.byMode).length === 0
            ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Nenhuma avaliação registrada ainda.")
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                Object.entries(telemetry.decisionsSavings.byMode).map(([mode, count]) =>
                  h(
                    "div",
                    {
                      key: mode,
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(255,255,255,0.025)",
                        fontSize: "11px",
                        fontFamily: "monospace",
                      },
                    },
                    h("span", { style: { color: "#cbd5e1" } }, mode),
                    h("span", { style: { color: "#38bdf8", fontWeight: "700" } }, `${count}x`)
                  )
                )
              )
        )
      )
    )
  );
}
