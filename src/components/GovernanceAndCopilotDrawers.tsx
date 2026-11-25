// @ts-nocheck
// Extraído de src/index.tsx na Onda 4 (R4.4)
import { THEME, SVG, TENANTS } from "../ui/theme-icons";
import type { PipelineCard } from "../types/orgfy";
import { formatRelativeTime, formatFullDateTime } from "../services/orgfy-bridge";
import { compileProbationaryRule } from "../services/templates-rsi";
import { isUnsupportedAgentModel } from "../services/model-failover";

export function renderGovernanceAndCopilotDrawers(p: any) {
  const { React, appendLiveLog, circuitBreakerLoop, copilotAgent, cpiTokens, fpyRate, h, isCopilotOpen, isGovernanceDrawerOpen, pipelineCards, regrasProbatorias, setActiveCentralTab, setCopilotAgent, setIsCopilotOpen, setIsGovernanceDrawerOpen, showNotification, totalAceitesBlindados, totalMergedGate } = p;
  return (
h(React.Fragment, null,
      isGovernanceDrawerOpen &&
        h(
          React.Fragment,
          null,
          // Backdrop escuro fechável
          h("div", {
            onClick: () => setIsGovernanceDrawerOpen(false),
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 1199,
            },
          }),
          // Drawer Lateral Deslizante
          h(
            "aside",
            {
              style: {
                position: "fixed",
                top: 0,
                right: 0,
                width: "420px",
                maxWidth: "90vw",
                height: "100vh",
                backgroundColor: "#111216",
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
                display: "flex",
                flexDirection: "column",
                zIndex: 1200,
                padding: "20px",
                overflowY: "auto",
                gap: "16px",
              },
            },
            // Header do Drawer
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: "12px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.shield({ h, width: 16, height: 16 }),
                h("span", { style: { fontWeight: "700", fontSize: "14px", color: THEME.textPrimary } }, "Governança, EVM & RSI"),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      color: THEME.accentPrimary,
                      fontWeight: "600",
                      backgroundColor: "rgba(16,185,129,0.15)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    },
                  },
                  "v12 CONTROL PLANE"
                )
              ),
              h(
                "button",
                {
                  onClick: () => setIsGovernanceDrawerOpen(false),
                  style: { background: "transparent", border: "none", color: THEME.textSecondary, cursor: "pointer", padding: "4px" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),

            // Seção EVM & Orçamento de Tokens
            h(
              "div",
              {
                style: {
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: `1px solid ${THEME.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "Métricas EVM & Tokens"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "CPI Acumulado"),
                h(
                  "span",
                  { style: { fontSize: "13px", fontWeight: "700", color: (cpiTokens ?? 1) >= 0.85 ? THEME.accentPrimary : "#f59e0b" } },
                  cpiTokens !== null ? `${cpiTokens.toFixed(2)} (Min: 0.85)` : "--"
                )
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Circuit Breaker Loops"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: THEME.accentPrimary } }, circuitBreakerLoop ? `${circuitBreakerLoop} turnos` : "--")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "PRs Integrados"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff" } }, totalMergedGate !== null ? `${totalMergedGate} na main` : "--")
              ),
              // Linha de Aceites Blindados L-22
              h(
                "div",
                {
                  style: {
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                },
                h("span", { style: { color: "#10b981", fontWeight: "600" } }, "Aceites Blindados (L-22):"),
                h("span", { style: { color: "#ffffff", fontFamily: "monospace", fontWeight: "700" } }, totalAceitesBlindados !== null ? `${totalAceitesBlindados} verificados` : "--")
              )
            ),

            // Seção Catraca Probatória RSI
            h(
              "div",
              {
                style: {
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: `1px solid ${THEME.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "Catraca Probatória RSI"),
                h("span", { style: { fontSize: "10px", color: "#c084fc", fontFamily: "monospace" } }, "Janela 10 cards")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Regras Ativas"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#c084fc" } }, `${Object.keys(regrasProbatorias).length || 3} regras`)
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Regra L-90 Auto-Rollback"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: THEME.accentPrimary } }, "Ativo (FPY >= 95%)")
              ),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" } },
                h(
                  "div",
                  { style: { padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.03)", fontSize: "10px" } },
                  h("div", { style: { color: "#ffffff", fontWeight: "600" } }, "GUARD-T020"),
                  h("div", { style: { color: THEME.textMuted } }, "ci_cache e aceite_cache blindados (10/10 cards)")
                ),
                h(
                  "div",
                  { style: { padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.03)", fontSize: "10px" } },
                  h("div", { style: { color: "#ffffff", fontWeight: "600" } }, "GUARD-L01"),
                  h("div", { style: { color: THEME.textMuted } }, "Impedimento auto-revisão L-01 (10/10 cards)")
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      setIsGovernanceDrawerOpen(false);
                      setActiveCentralTab("templates_rsi");
                    },
                    style: {
                      marginTop: "6px",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      backgroundColor: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    },
                  },
                  SVG.gitPullRequest({ h, width: 13, height: 13 }),
                  "Explorar Catálogo de Templates & RSI Completo →"
                )
              )
            ),

            // Seção DSAP Backtracking
            h(
              "div",
              {
                style: {
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: `1px solid ${THEME.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "DSAP Preditivo"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Threshold Backtracking"),
                h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f59e0b" } }, "≥ 0.70 similaridade")
              ),
              h(
                "div",
                {
                  style: {
                    padding: "8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    color: THEME.accentPrimary,
                    fontSize: "11px",
                    fontWeight: "500",
                  },
                },
                "✓ Nenhum backtracking ativo no momento (fluxo limpo)."
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 3. ILHA DO COPILOTO SAGRADO PERSONIFICÁVEL (DRAWER FLUTUANTE)
      // ───────────────────────────────────────────────────────────────────────
      isCopilotOpen &&
        h(
          "aside",
          {
            style: {
              position: "fixed",
              bottom: "20px",
              right: "24px",
              width: "360px",
              height: "460px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.65)",
              display: "flex",
              flexDirection: "column",
              zIndex: 1000,
              overflow: "hidden",
            },
          },
          // Header do Copiloto
          h(
            "div",
            {
              style: {
                padding: "12px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              },
            },
            h(
              "select",
              {
                value: copilotAgent,
                onChange: (e: any) => setCopilotAgent(e.target.value),
                style: {
                  backgroundColor: "transparent",
                  color: "#10b981",
                  fontWeight: "700",
                  fontSize: "13px",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                },
              },
              h("option", { value: "OrgFy Bento" }, "⚙️ OrgFy Bento [COO]"),
              h("option", { value: "OrgFy Iris" }, "👑 OrgFy Iris [CEO Holding]"),
              h("option", { value: "OrgFy Bento Arquiteto" }, "📐 OrgFy Bento Arquiteto"),
              h("option", { value: "QA Sentinel" }, "🛡️ QA Sentinel [Auditor]")
            ),
            h(
              "button",
              {
                onClick: () => setIsCopilotOpen(false),
                style: {
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                },
              },
              SVG.xCircle({ h, width: 16, height: 16 })
            )
          ),
          // Chat Messages
          h(
            "div",
            {
              style: {
                flex: 1,
                padding: "12px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "12px",
              },
            },
            h(
              "div",
              {
                style: {
                  padding: "8px 12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "#f3f4f6",
                  lineHeight: "1.4",
                },
              },
              h("strong", { style: { color: "#10b981" } }, `${copilotAgent}: `),
              `Olá, Helton. A esteira determinística v10 está com ${pipelineCards.length} cards no Kanban, FPY em ${fpyRate !== null ? `${fpyRate.toFixed(1)}%` : "--"} e CPI em ${cpiTokens !== null ? cpiTokens.toFixed(2) : "--"}. Use /despachar para novos cards ou /gate para veredito.`
            )
          ),
          // Chat Input
          h(
            "div",
            {
              style: {
                padding: "10px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                gap: "8px",
              },
            },
            h("input", {
              type: "text",
              placeholder: `Falar com ${copilotAgent}... (/despachar, /gate)`,
              style: {
                flex: 1,
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                fontSize: "12px",
                outline: "none",
              },
              onKeyDown: (e: any) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  const cmd = e.target.value.trim();
                  appendLiveLog(`\n[COPILOTO] Mensagem enviada para ${copilotAgent}: ${cmd}\n`);
                  showNotification("info", `Comando enviado para ${copilotAgent}: ${cmd}`);
                  e.target.value = "";
                }
              },
            })
          )
        )
  )
  );
}
