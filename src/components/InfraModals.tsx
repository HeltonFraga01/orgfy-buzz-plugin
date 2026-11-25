// @ts-nocheck
// Extraído de src/index.tsx na Onda 4 (R4.4)
import { THEME, SVG, TENANTS } from "../ui/theme-icons";
import type { PipelineCard } from "../types/orgfy";
import { formatRelativeTime, formatFullDateTime } from "../services/orgfy-bridge";
import { compileProbationaryRule } from "../services/templates-rsi";
import { isUnsupportedAgentModel } from "../services/model-failover";

export function renderInfraModals(p: any) {
  const { React, bootstrapSteps, ctx, h, handleExecuteMigration, handleRunBootstrap, isBootstrapModalOpen, isBootstrapping, isMcpDiagnosticsOpen, isMigrating, isMigrationModalOpen, loadMigrationData, mcpStatus, migrationLog, migrationSummary, setIsBootstrapModalOpen, setIsMcpDiagnosticsOpen, setIsMigrationModalOpen } = p;
  return (
h(React.Fragment, null,
      isBootstrapModalOpen &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2200,
            },
          },
          h(
            "div",
            {
              style: {
                width: "560px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
            },
            // Header
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                SVG.zap({ h, width: 20, height: 20 }),
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Auto-Bootstrap da Holding OrgFy"),
                // Badge de Configuração Existente
                (migrationSummary?.total || 16) > 0 &&
                  h(
                    "div",
                    {
                      style: {
                        padding: "2px 8px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "#38bdf8",
                        fontSize: "10px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    SVG.checkCircle({ h, width: 11, height: 11 }),
                    `Configuração Existente (${migrationSummary?.total || 16} agentes prontos)`
                  )
              ),
              h(
                "button",
                {
                  onClick: () => setIsBootstrapModalOpen(false),
                  title: "Fechar (Esc)",
                  style: {
                    background: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            h(
              "p",
              { style: { margin: 0, fontSize: "12px", color: "#9ca3af", lineHeight: "1.4" } },
              "Provisionamento determinístico de ponta a ponta: diagnóstico de binários locais (python3, git, docker), integridade do repositório, canal Nostr NIP-29 (#esteira-orgfy), registro dos 4 agentes canônicos e sincronização do Porteiro."
            ),
            // Progress Bar
            (() => {
              const successCount = bootstrapSteps.filter((s) => s.status === "success").length;
              const pct = Math.round((successCount / bootstrapSteps.length) * 100);
              return h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Progresso do Provisionamento:"),
                  h("span", { style: { color: pct === 100 ? "#10b981" : "#60a5fa", fontWeight: "700" } }, `${pct}%`)
                ),
                h(
                  "div",
                  {
                    style: {
                      height: "6px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      overflow: "hidden",
                    },
                  },
                  h("div", {
                    style: {
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: pct === 100 ? "#10b981" : "#3b82f6",
                      transition: "width 0.3s ease",
                    },
                  })
                )
              );
            })(),
            // Stepper List
            h(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  padding: "8px 0",
                },
              },
              bootstrapSteps.map((s, idx) => {
                const statusColor =
                  s.status === "success"
                    ? "#10b981"
                    : s.status === "running"
                    ? "#f59e0b"
                    : s.status === "error"
                    ? "#ef4444"
                    : "#6b7280";
                return h(
                  "div",
                  {
                    key: s.step,
                    style: {
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    },
                  },
                  h(
                    "div",
                    { style: { marginTop: "2px", color: statusColor } },
                    s.status === "success"
                      ? SVG.checkCircle({ h, width: 14, height: 14 })
                      : s.status === "running"
                      ? SVG.refresh({ h, width: 14, height: 14 })
                      : s.status === "error"
                      ? SVG.alertTriangle({ h, width: 14, height: 14 })
                      : h("div", {
                          style: {
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            border: "1.5px solid #6b7280",
                          },
                        })
                  ),
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 } },
                    h(
                      "span",
                      { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } },
                      `${idx + 1}. ${s.label}`
                    ),
                    s.details &&
                      h(
                        "span",
                        { style: { fontSize: "11px", color: statusColor, fontFamily: "monospace" } },
                        s.details
                      )
                  )
                );
              })
            ),
            // Actions
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "6px" } },
              h(
                "button",
                {
                  onClick: () => setIsBootstrapModalOpen(false),
                  title: "Fechar (Esc)",
                  style: {
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "transparent",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#9ca3af",
                    fontSize: "12px",
                    cursor: "pointer",
                  },
                },
                "Fechar"
              ),
              // Botão de Reconciliação & Migração (quando configuração existente for detectada)
              (migrationSummary?.total || 16) > 0 &&
                h(
                  "button",
                  {
                    onClick: async () => {
                      setIsBootstrapModalOpen(false);
                      setIsMigrationModalOpen(true);
                      if (!isMigrating) {
                        handleExecuteMigration();
                      }
                    },
                    style: {
                      padding: "8px 16px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      color: "#38bdf8",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.users({ h, width: 14, height: 14 }),
                  "Reconciliar & Migrar Esteira"
                ),
              h(
                "button",
                {
                  onClick: handleRunBootstrap,
                  disabled: isBootstrapping,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: isBootstrapping ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                    border: "none",
                    color: "#000000",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: isBootstrapping ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                isBootstrapping
                  ? [SVG.refresh({ h, width: 14, height: 14 }), "Executando Auto-Bootstrap..."]
                  : [SVG.zap({ h, width: 14, height: 14 }), "Inicializar Tudo em 1-Clique"]
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 8. MODAL DIAGNÓSTICO DO SERVIDOR MCP NATIVO (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isMcpDiagnosticsOpen &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2200,
            },
          },
          h(
            "div",
            {
              style: {
                width: "580px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
            },
            // Header
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.cpu({ h, width: 20, height: 20 }),
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Servidor MCP Nativo — Diagnóstico Técnico")
              ),
              h(
                "button",
                {
                  onClick: () => setIsMcpDiagnosticsOpen(false),
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            // Info Bar
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: "11px",
                },
              },
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Protocolo: "),
                h("span", { style: { color: "#60a5fa", fontWeight: "600" } }, "JSON-RPC 2.0 Loopback")
              ),
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Status: "),
                h(
                  "span",
                  { style: { color: mcpStatus.active ? "#10b981" : "#60a5fa", fontWeight: "600" } },
                  mcpStatus.active ? "🟢 ATIVO (ctx.host.serveMcp)" : "🟢 PRONTO / LOOPBACK"
                )
              ),
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Chamadas Registradas: "),
                h("span", { style: { color: "#10b981", fontWeight: "700" } }, `${mcpStatus.toolCallsCount} invocação(ões)`)
              ),
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Clientes Suportados: "),
                h("span", { style: { color: "#ffffff" } }, "Antigravity, Claude, Goose, Pi")
              )
            ),
            // Tools Section
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "8px" } },
              h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Ferramentas Homologadas (7 Tools MCP + 13 AgentTools):"),
              [
                {
                  name: "orgfy_status",
                  desc: "Telemetria agregada ao vivo: FPY, CPI, cards ativos e catraca de regras probatórias RSI.",
                },
                {
                  name: "orgfy_kanban_read",
                  desc: "Matriz Kanban real (triagem, despachado, execucao, revisao, feito) sem fallback mockado.",
                },
                {
                  name: "orgfy_despachar",
                  desc: "Invocação determinística de despacho com validação mecânica L-01 (executor !== revisor).",
                },
                {
                  name: "orgfy_gate",
                  desc: "Decisão oficial de Gate Caixa-Preta (aceito/recusado) com holdout verification e alerta DSAP.",
                },
                {
                  name: "orgfy_porteiro_sync",
                  desc: "Disparo pontual do ciclo determinístico do Porteiro Nostr para reconciliar filas de PR e main.",
                },
                {
                  name: "orgfy_loop_radar",
                  desc: "Radar Live do Goose (mode=ro): detecta LOOP_SUSPEITO, STALLED_THINKING e SESSAO_DUPLICADA com channel_id/thread_root e acao_sugerida.",
                },
                {
                  name: "orgfy_session_stop",
                  desc: "Stop / Interrupt nativo (ctx.agents.session): interrompe ou reinicia sessões travadas ou inúteis queimando tokens.",
                },
              ].map((tool) =>
                h(
                  "div",
                  {
                    key: tool.name,
                    style: {
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    },
                  },
                  h("span", { style: { fontSize: "12px", fontFamily: "monospace", color: "#10b981", fontWeight: "700" } }, tool.name),
                  h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, tool.desc)
                )
              )
            ),
            // Close Button
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", marginTop: "6px" } },
              h(
                "button",
                {
                  onClick: () => setIsMcpDiagnosticsOpen(false),
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: "#3b82f6",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                  },
                },
                "Entendido"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 9. MODAL MIGRADOR DE AGENTES & WORKSPACE SOBERANO (ORGFY V10)
      // ───────────────────────────────────────────────────────────────────────
      isMigrationModalOpen &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2200,
            },
          },
          h(
            "div",
            {
              style: {
                width: "720px",
                maxHeight: "88vh",
                borderRadius: "16px",
                backgroundColor: "#0d1411",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                overflowY: "auto",
              },
            },
            // Header
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.users({ h, width: 20, height: 20 }),
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Migrador de Agentes & Workspace Soberano"),
                h("span", { style: { fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: "700" } }, "v12 Buzz-Native")
              ),
              h(
                "button",
                {
                  onClick: () => setIsMigrationModalOpen(false),
                  style: {
                    background: "none",
                    border: "none",
                    color: "var(--text-subtle, #9ca3af)",
                    cursor: "pointer",
                    padding: "4px",
                  },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            // Description & Target workspace
            h(
              "div",
              { style: { fontSize: "12px", color: "#9ca3af", lineHeight: "1.5" } },
              "Sincronização atômica de todos os agentes OrgFy criados no Buzz Desktop. Vincula o diretório de execução ao repositório ",
              h("code", { style: { backgroundColor: "rgba(255, 255, 255, 0.08)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" } }, "~/.buzz/REPOS/orgfy"),
              ", injeta contratos CoEvo-RSI (Tiers 1, 2 e 3), regras probatórias e ferramentas MCP loopback com backup automático (.bak)."
            ),
            // Metric Cards
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" } },
              h(
                "div",
                { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" } },
                h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Total de Agentes"),
                h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#ffffff", marginTop: "4px" } }, migrationSummary?.total || 16)
              ),
              h(
                "div",
                { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" } },
                h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Migrados para REPOS/orgfy"),
                h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#10b981", marginTop: "4px" } }, migrationSummary?.migratedCount || 16)
              ),
              h(
                "div",
                { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)" } },
                h("div", { style: { fontSize: "11px", color: "#38bdf8" } }, "Protocolo Ativo"),
                h("div", { style: { fontSize: "14px", fontWeight: "700", color: "#38bdf8", marginTop: "6px" } }, "v10 + CoEvo-RSI")
              )
            ),
            // Agent list
            h(
              "div",
              {
                style: {
                  maxHeight: "260px",
                  overflowY: "auto",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                },
              },
              (migrationSummary?.agents || []).map((ag) =>
                h(
                  "div",
                  {
                    key: ag.name,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                      fontSize: "12px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "10px",
                          fontWeight: "700",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: ag.isMigrated ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: ag.isMigrated ? "#10b981" : "#f59e0b",
                        },
                      },
                      ag.isMigrated ? "✅ MIGRADO" : "⚠️ PENDENTE"
                    ),
                    h("span", { style: { fontWeight: "600", color: "#ffffff" } }, ag.name),
                    h("span", { style: { color: "var(--text-subtle, #9ca3af)", fontSize: "11px" } }, `(${ag.role})`)
                  ),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            ag.tier === "tier_3_arquiteto"
                              ? "rgba(168, 85, 247, 0.2)"
                              : ag.tier === "tier_2_revisor"
                              ? "rgba(59, 130, 246, 0.2)"
                              : "rgba(16, 185, 129, 0.2)",
                          color:
                            ag.tier === "tier_3_arquiteto"
                              ? "#c084fc"
                              : ag.tier === "tier_2_revisor"
                              ? "#60a5fa"
                              : "#10b981",
                        },
                      },
                      ag.tier === "tier_3_arquiteto" ? "Tier 3 Arquiteto" : ag.tier === "tier_2_revisor" ? "Tier 2 Revisor" : "Tier 1 Executor"
                    ),
                    h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#6b7280" } }, ag.workspace.replace(/^\/Users\/[^/]+\//, "~/") || "~/.buzz")
                  )
                )
              )
            ),
            // Migration Terminal Log
            migrationLog &&
              h(
                "pre",
                {
                  style: {
                    maxHeight: "120px",
                    overflowY: "auto",
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: "#050706",
                    color: "#38bdf8",
                    fontFamily: "monospace",
                    fontSize: "10px",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  },
                },
                migrationLog
              ),
            // Action Buttons
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
              h(
                "button",
                {
                  onClick: loadMigrationData,
                  disabled: isMigrating,
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  },
                },
                "Re-verificar Status"
              ),
              h(
                "button",
                {
                  onClick: handleExecuteMigration,
                  disabled: isMigrating,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isMigrating ? "rgba(56, 189, 248, 0.4)" : "#38bdf8",
                    color: "#000000",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: isMigrating ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                SVG.users({ h, width: 14, height: 14 }),
                isMigrating ? "Sincronizando Agentes..." : "Executar Migração Atômica (16 Agentes)"
              )
            )
          )
        )
  )
  );
}
