// @ts-nocheck
// Extraído de src/index.tsx na Onda 4 (R4.4)
import { THEME, SVG, TENANTS } from "../ui/theme-icons";
import type { PipelineCard } from "../types/orgfy";
import { formatRelativeTime, formatFullDateTime } from "../services/orgfy-bridge";
import { compileProbationaryRule } from "../services/templates-rsi";
import { isUnsupportedAgentModel } from "../services/model-failover";

export function renderDispatchAndGateModals(p: any) {
  const { React, activeGateCard, activeLogsCard, dispatchExecutor, dispatchIssueId, dispatchRevisor, dsapMatchedTokens, dsapSimilarity, gateRejectionReason, h, handleAcceptGate, handleExecuteDispatch, handleRejectGate, isDispatchModalOpen, isExecutingDispatch, isExecutingGate, isGateModalOpen, isLogsDrawerOpen, liveAgents, liveLogStream, selectedTenant, setActiveGateCard, setDispatchExecutor, setDispatchIssueId, setDispatchRevisor, setGateRejectionReason, setIsDispatchModalOpen, setIsGateModalOpen, setIsLogsDrawerOpen, setLiveLogStream, showNotification } = p;
  return (
h(React.Fragment, null,
      isDispatchModalOpen &&
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
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            },
          },
          h(
            "div",
            {
              style: {
                width: "480px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "22px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              },
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "⚡ Novo Despacho Determinístico"),
              h(
                "button",
                {
                  onClick: () => !isExecutingDispatch && setIsDispatchModalOpen(false),
                  disabled: isExecutingDispatch,
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingDispatch ? "not-allowed" : "pointer" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "ID DA ISSUE OU TAREFA"),
              h("input", {
                type: "text",
                placeholder: "Ex: issue-104 ou 5c569a9e",
                disabled: isExecutingDispatch,
                value: dispatchIssueId,
                onChange: (e: any) => setDispatchIssueId(e.target.value),
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                },
              })
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "EXECUTOR (TIER COEVO-RSI)"),
              h(
                "select",
                {
                  value: dispatchExecutor,
                  disabled: isExecutingDispatch,
                  onChange: (e: any) => setDispatchExecutor(e.target.value),
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  },
                },
                liveAgents.map((a) =>
                  h("option", { key: a.id, value: a.name }, a.name)
                )
              )
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h(
                "label",
                { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } },
                "REVISOR INDEPENDENTE (REGRA L-01: BLOQUEIO MECÂNICO)"
              ),
              h(
                "select",
                {
                  value: dispatchRevisor,
                  disabled: isExecutingDispatch,
                  onChange: (e: any) => setDispatchRevisor(e.target.value),
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  },
                },
                liveAgents.map((a) =>
                  h(
                    "option",
                    {
                      key: a.id,
                      value: a.name,
                      disabled: a.name === dispatchExecutor,
                    },
                    a.name === dispatchExecutor ? `${a.name} (Bloqueado pela Regra L-01)` : a.name
                  )
                )
              )
            ),
            // Preview do comando determinístico
            h(
              "div",
              {
                style: {
                  padding: "8px 10px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#10b981",
                },
              },
              `ferramentas/esteira/despachar --empresa ${selectedTenant === "all" ? "orgfy" : selectedTenant} ${dispatchIssueId || "<issue>"} "${dispatchExecutor}" "${dispatchRevisor}"`
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
              h(
                "button",
                {
                  onClick: () => setIsDispatchModalOpen(false),
                  disabled: isExecutingDispatch,
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                "Cancelar"
              ),
              h(
                "button",
                {
                  onClick: handleExecuteDispatch,
                  disabled: isExecutingDispatch,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: isExecutingDispatch ? "#059669" : "#10b981",
                    color: "#000000",
                    fontWeight: "700",
                    border: "none",
                    cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                isExecutingDispatch ? "Executando via CLI..." : "Disparar Despacho"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 5. MODAL DE DECISÃO DO GATE COM DETECTOR PREDITIVO DSAP (3 NÍVEIS)
      // ───────────────────────────────────────────────────────────────────────
      isGateModalOpen &&
        activeGateCard &&
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
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            },
          },
          h(
            "div",
            {
              style: {
                width: "520px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "24px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                null,
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "🛡️ Decisão de Gate Caixa-Preta"),
                h("span", { style: { fontSize: "12px", color: "#9ca3af" } }, `${activeGateCard.prId || activeGateCard.issueId}: ${activeGateCard.title}`)
              ),
              h(
                "button",
                {
                  onClick: () => {
                    if (!isExecutingGate) {
                      setIsGateModalOpen(false);
                      setActiveGateCard(null);
                    }
                  },
                  disabled: isExecutingGate,
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingGate ? "not-allowed" : "pointer" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            // Probes Caixa-Preta (Holdout Verification)
            h(
              "div",
              {
                style: {
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#10b981" } }, "EVIDÊNCIAS DOS PROBES CAIXA-PRETA"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• http_rota (Caddy v3 200 OK):"),
                h("span", { style: { color: activeGateCard.probes?.http_rota ? "#10b981" : "#9ca3af", fontWeight: "600" } }, activeGateCard.probes?.http_rota ? "PASS" : "Não executado")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• supabase_rls (Políticas & Migrations):"),
                h("span", { style: { color: activeGateCard.probes?.supabase_rls ? "#10b981" : "#9ca3af", fontWeight: "600" } }, activeGateCard.probes?.supabase_rls ? "PASS" : "Não executado")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• playwright_console (0 erros runtime):"),
                h("span", { style: { color: activeGateCard.probes?.playwright_console ? "#10b981" : "#9ca3af", fontWeight: "600" } }, activeGateCard.probes?.playwright_console ? "PASS" : "Não executado")
              )
            ),

            // Justificativa de Recusa & Detector DSAP
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "MOTIVO (PREENCHA CASO VÁ RECUSAR O PR)"),
              h("textarea", {
                placeholder: "Descreva a falha ou inconsistência técnica...",
                value: gateRejectionReason,
                disabled: isExecutingGate,
                onChange: (e: any) => setGateRejectionReason(e.target.value),
                style: {
                  height: "70px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                  resize: "none",
                },
              }),
              // Banner Reativo DSAP em 3 Níveis Contextuais (Refinamento de UI/UX)
              gateRejectionReason.trim().length > 0 &&
                h(
                  "div",
                  {
                    style: {
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor:
                        dsapSimilarity >= 0.7
                          ? "rgba(239, 68, 68, 0.15)"
                          : dsapSimilarity >= 0.5
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(16, 185, 129, 0.12)",
                      border: "1px solid",
                      borderColor:
                        dsapSimilarity >= 0.7
                          ? "#ef4444"
                          : dsapSimilarity >= 0.5
                          ? "#f59e0b"
                          : "#10b981",
                      color:
                        dsapSimilarity >= 0.7
                          ? "#f87171"
                          : dsapSimilarity >= 0.5
                          ? "#f59e0b"
                          : "#10b981",
                      fontSize: "11px",
                      fontWeight: "600",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "6px" } },
                    dsapSimilarity >= 0.7
                      ? SVG.alertTriangle({ h, width: 14, height: 14 })
                      : dsapSimilarity >= 0.5
                      ? SVG.alertTriangle({ h, width: 14, height: 14 })
                      : SVG.checkCircle({ h, width: 14, height: 14 }),
                    dsapSimilarity >= 0.7
                      ? `🔴 ALERTA DSAP (${Math.round(dsapSimilarity * 100)}%): Repetição desta assinatura engatilhará [DSAP BACKTRACKING] para o COO re-escopar!`
                      : dsapSimilarity >= 0.5
                      ? `🟡 ATENÇÃO (${Math.round(dsapSimilarity * 100)}% de similaridade): Termos técnicos repetidos da recusa anterior.`
                      : `🟢 SEGURO (${Math.round(dsapSimilarity * 100)}% de similaridade): Nova justificativa com assinatura distinta.`
                  ),
                  dsapMatchedTokens.length > 0 &&
                    h(
                      "div",
                      { style: { fontSize: "10px", color: "rgba(255,255,255,0.7)" } },
                      `Tokens identificados: ${dsapMatchedTokens.join(", ")}`
                    )
                )
            ),

            // Ações de Aceite / Recusa
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "8px" } },
              h(
                "button",
                {
                  onClick: () => handleRejectGate(activeGateCard),
                  disabled: isExecutingGate,
                  style: {
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontWeight: "700",
                    cursor: isExecutingGate ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                isExecutingGate ? "Executando Gate..." : "RECUSAR PR"
              ),
              h(
                "button",
                {
                  onClick: () => handleAcceptGate(activeGateCard),
                  disabled: isExecutingGate,
                  style: {
                    padding: "8px 22px",
                    borderRadius: "8px",
                    backgroundColor: isExecutingGate ? "#059669" : "#10b981",
                    color: "#000000",
                    fontWeight: "700",
                    border: "none",
                    cursor: isExecutingGate ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                isExecutingGate ? "Executando Gate..." : "ACEITAR PR (MERGE NA MAIN)"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 6. GAVETA DE LOGS STREAMING (CONSOLE JETBRAINS / MATRIX)
      // ───────────────────────────────────────────────────────────────────────
      isLogsDrawerOpen &&
        activeLogsCard &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              bottom: 0,
              left: "12px",
              right: "12px",
              height: "280px",
              borderRadius: "16px 16px 0 0",
              backgroundColor: "#0a0f0d",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              zIndex: 1500,
            },
          },
          h(
            "div",
            {
              style: {
                padding: "8px 16px",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "span",
                { style: { fontSize: "12px", color: "#10b981", fontWeight: "700" } },
                `CONSOLE LIVE: ${activeLogsCard.workerPid ? `PID ${activeLogsCard.workerPid}` : "Sessão CLI"} — #${activeLogsCard.issueId}`
              ),
              h("span", { style: { fontSize: "10px", color: "#60a5fa", fontWeight: "600" } }, "🟢 STREAMING ATIVO")
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "button",
                {
                  onClick: () => setLiveLogStream(""),
                  style: {
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    color: "#9ca3af",
                    border: "none",
                    fontSize: "10px",
                    cursor: "pointer",
                  },
                },
                "Limpar Logs"
              ),
              h(
                "button",
                {
                  onClick: () => {
                    navigator.clipboard.writeText(liveLogStream);
                    showNotification("success", "Logs copiados para a área de transferência!");
                  },
                  style: {
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    color: "#9ca3af",
                    border: "none",
                    fontSize: "10px",
                    cursor: "pointer",
                  },
                },
                "Copiar"
              ),
              h(
                "button",
                {
                  onClick: () => setIsLogsDrawerOpen(false),
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.xCircle({ h, width: 16, height: 16 })
              )
            )
          ),
          h(
            "pre",
            {
              style: {
                flex: 1,
                margin: 0,
                padding: "12px 16px",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#10b981",
                backgroundColor: "#080c0a",
                overflowY: "auto",
                lineHeight: "1.5",
              },
            },
            liveLogStream ||
              `[ORGFY WORKER] Inicializando container efêmero no Swarm...\n` +
              `[ORGFY WORKER] Worktree montada em: .worktrees/${activeLogsCard.issueId}\n` +
              `[ORGFY WORKER] Executando: pytest testes/esteira -v --tb=short\n` +
              `testes/esteira/test_t020.py::test_ci_cache_integrity PASSED\n` +
              `testes/esteira/test_gate_state.py::test_regras_probatorias_eval PASSED\n` +
              `[ORGFY WORKER] 2 passed in 1.42s. Probes caixa-preta engatilhados.\n` +
              `[ORGFY NOSTR] Evento kind:1618 publicado em wss://orgfy.communities.buzz.xyz (sub-second wake)`
          )
        )
  )
  );
}
