// @ts-nocheck
// Extraído de src/index.tsx na Onda 4 (R4.4)
import { THEME, SVG, TENANTS } from "../ui/theme-icons";
import type { PipelineCard } from "../types/orgfy";
import { formatRelativeTime, formatFullDateTime } from "../services/orgfy-bridge";
import { compileProbationaryRule } from "../services/templates-rsi";
import { isUnsupportedAgentModel } from "../services/model-failover";

export function renderKanbanColumn(p: any, title: string, cards: PipelineCard[], badgeBg: string, badgeColor: string, renderAction: (card: PipelineCard) => any, emptyText?: string) {
  const { h, handleOpenIssueDeepLink, hasValidNostrIssueId, setActiveIssueDetailCard } = p;
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            borderRadius: "10px",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            border: `1px solid ${THEME.hairline}`,
            padding: "10px",
            minHeight: 0,
            height: "100%",
            maxHeight: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
          },
        },
        // Column Header
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "8px",
              borderBottom: `1px solid ${THEME.hairline}`,
              marginBottom: "10px",
              flexShrink: 0,
            },
          },
          h("span", { style: { fontWeight: "600", fontSize: "12px", color: THEME.textPrimary } }, title),
          h(
            "span",
            {
              style: {
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: badgeBg,
                color: badgeColor,
                fontWeight: "700",
              },
            },
            cards.length
          )
        ),
        // Cards List (Face Limpa e Escaneável com Scroll Vertical Independente)
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px" } },
          cards.length === 0
            ? h(
                "div",
                {
                  style: {
                    padding: "24px 10px",
                    textAlign: "center",
                    color: THEME.textMuted,
                    fontSize: "11px",
                  },
                },
                "Nenhum card nesta raia"
              )
            : cards.map((c) =>
                h(
                  "div",
                  {
                    key: c.id,
                    onClick: () => setActiveIssueDetailCard(c),
                    style: {
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: THEME.cardBg,
                      border: `1px solid ${THEME.borderCard}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      cursor: "pointer",
                      transition: "background 0.15s ease, border-color 0.15s ease",
                    },
                    onMouseEnter: (e: any) => (e.currentTarget.style.backgroundColor = THEME.cardHover),
                    onMouseLeave: (e: any) => (e.currentTarget.style.backgroundColor = THEME.cardBg),
                  },
                  // Card Top (Tenant + Issue ID + Priority + Stage)
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "6px" } },
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "9px",
                            fontFamily: "monospace",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            color: "#8b949e",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                            fontWeight: "600",
                          },
                        },
                        c.empresa || "orgfy"
                      ),
                      h(
                        "span",
                        {
                          onClick: (e: any) => {
                            e.stopPropagation();
                            if (hasValidNostrIssueId(c)) {
                              handleOpenIssueDeepLink(c);
                            } else {
                              setActiveIssueDetailCard(c);
                            }
                          },
                          title: hasValidNostrIssueId(c)
                            ? "Abrir issue diretamente no Buzz Desktop"
                            : "Worktree local — clique para ver detalhes no Cockpit",
                          style: {
                            fontSize: "11px",
                            fontFamily: "monospace",
                            color: hasValidNostrIssueId(c) ? "#58a6ff" : "#f59e0b",
                            fontWeight: "700",
                            cursor: "pointer",
                            textDecoration: hasValidNostrIssueId(c) ? "underline" : "none",
                            textUnderlineOffset: "2px",
                          },
                        },
                        hasValidNostrIssueId(c)
                          ? `#${(c.issueId || c.id).slice(0, 8)} ↗`
                          : `#${(c.issueId || c.id).slice(0, 12)}`
                      )
                    ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "5px" } },
                      c.ciStatus &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "9px",
                              fontFamily: "monospace",
                              fontWeight: "700",
                              color: c.ciStatus === "pass" ? "#10b981" : c.ciStatus === "running" ? "#f59e0b" : "#ef4444",
                              backgroundColor:
                                c.ciStatus === "pass"
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : c.ciStatus === "running"
                                  ? "rgba(245, 158, 11, 0.12)"
                                  : "rgba(239, 68, 68, 0.12)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            },
                          },
                          `CI:${c.ciStatus.toUpperCase()}`
                        ),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor:
                              c.priority === "P0"
                                ? "rgba(239, 68, 68, 0.2)"
                                : c.priority === "P1"
                                ? "rgba(245, 158, 11, 0.2)"
                                : "rgba(59, 130, 246, 0.2)",
                            color:
                              c.priority === "P0"
                                ? "#f87171"
                                : c.priority === "P1"
                                ? "#fbbf24"
                                : "#60a5fa",
                          },
                        },
                        c.priority
                      )
                    )
                  ),
                  // Card Title
                  h(
                    "div",
                    {
                      style: {
                        fontSize: "12px",
                        fontWeight: "600",
                        color: THEME.textPrimary,
                        lineHeight: "1.4",
                      },
                    },
                    c.title
                  ),
                  // Informações Hermes: L-22 Aceite + Worktree Chips
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                    c.acceptanceCommand &&
                      h(
                        "div",
                        {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            backgroundColor: "rgba(16, 185, 129, 0.08)",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            color: "#34d399",
                            fontFamily: "monospace",
                            fontSize: "9.5px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                          title: `Comando Invariante L-22: ${c.acceptanceCommand}`,
                        },
                        h("span", { style: { fontWeight: "700", color: "#10b981" } }, "L-22:"),
                        h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, c.acceptanceCommand)
                      ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                      h(
                        "span",
                        {
                          style: {
                            color: "#38bdf8",
                            fontFamily: "monospace",
                            fontSize: "9.5px",
                            backgroundColor: "rgba(56, 189, 248, 0.08)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          },
                          title: `Worktree Isolada: ${c.worktreePath || `.worktrees/${c.issueId}`}`,
                        },
                        h(
                          "span",
                          { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                          SVG.folder({ h, width: 10, height: 10 }),
                          (c.worktreePath || `.worktrees/${c.issueId}`).replace(".worktrees/", "")
                        )
                      ),
                      h(
                        "span",
                        {
                          style: {
                            color: "#c084fc",
                            fontSize: "9.5px",
                            fontFamily: "monospace",
                          },
                        },
                        c.branch || c.tier
                      )
                    )
                  ),
                  // Card Footer (Papéis + Relative Elapsed Time)
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10px",
                        color: THEME.textMuted,
                        borderTop: `1px solid ${THEME.hairline}`,
                        paddingTop: "6px",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "5px" } },
                      h(
                        "span",
                        {
                          style: {
                            color: "#cbd5e1",
                            fontWeight: "600",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          },
                        },
                        c.executor || "Não atribuído"
                      ),
                      c.revisor &&
                        h(
                          "span",
                          { style: { color: "#8b949e", fontSize: "9px" } },
                          `→ ${c.revisor}`
                        )
                    ),
                    h(
                      "span",
                      {
                        style: {
                          fontFamily: "monospace",
                          fontSize: "10px",
                          color: "#34d399",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        },
                        title: c.createdAt ? formatFullDateTime(c.createdAt) : undefined,
                      },
                      SVG.clock({ h, width: 10, height: 10 }),
                      formatRelativeTime(c.createdAt || c.updatedAt || c.elapsedTime)
                    )
                  ),
                  // Ação Rápida da Raia (Despachar / Ver Logs / Decidir Gate)
                  renderAction &&
                    h(
                      "div",
                      { onClick: (e: any) => e.stopPropagation() },
                      renderAction(c)
                    )
                )
              )
        )
      );

}
