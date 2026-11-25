// @ts-nocheck
// Extraído de src/index.tsx na Onda 4 (R4.4)
import { THEME, SVG, TENANTS } from "../ui/theme-icons";
import type { PipelineCard } from "../types/orgfy";
import { formatRelativeTime, formatFullDateTime } from "../services/orgfy-bridge";
import { compileProbationaryRule } from "../services/templates-rsi";
import { isUnsupportedAgentModel } from "../services/model-failover";

export function renderIssueDetailModal(p: any) {
  const { activeIssueDetailCard, ctx, h, handleAcceptGate, handleCopyDeepLink, handleOpenIssueDeepLink, hydratedIssueDetail, isHydratingIssueDetail, setActiveIssueDetailCard, setActiveLogsCard, setDispatchIssueId, setIsDispatchModalOpen, setIsLogsDrawerOpen, showNotification } = p;
  return (
      activeIssueDetailCard &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2150,
            },
            onClick: () => setActiveIssueDetailCard(null),
          },
          h(
            "div",
            {
              style: {
                width: "920px",
                maxWidth: "94vw",
                maxHeight: "88vh",
                borderRadius: "14px",
                backgroundColor: "#0d1117",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              },
              onClick: (e: any) => e.stopPropagation(),
            },
            // ── HEADER DO MODAL (ESTILO HERMES / LINEAR) ──
            h(
              "div",
              {
                style: {
                  padding: "18px 24px 14px 24px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  backgroundColor: "rgba(255, 255, 255, 0.015)",
                },
              },
              // Breadcrumbs + Badges + Fechar
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#9ca3af" } },
                  h("span", { style: { fontWeight: "600", color: "#cbd5e1" } }, "Holding OrgFy"),
                  h("span", { style: { color: "#4b5563" } }, "/"),
                  h("span", {}, "Repositório orgfy"),
                  h("span", { style: { color: "#4b5563" } }, "/"),
                  h("span", {}, "Issues"),
                  h("span", { style: { color: "#4b5563" } }, "/"),
                  h(
                    "code",
                    {
                      style: {
                        fontFamily: "monospace",
                        color: "#38bdf8",
                        backgroundColor: "rgba(56, 189, 248, 0.1)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        fontWeight: "700",
                      },
                      title: activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId,
                    },
                    `#${(activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId).slice(0, 10)}...`
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  // Badge Prioridade
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        backgroundColor:
                          activeIssueDetailCard.priority === "P0"
                            ? "rgba(239, 68, 68, 0.2)"
                            : activeIssueDetailCard.priority === "P1"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(59, 130, 246, 0.2)",
                        color:
                          activeIssueDetailCard.priority === "P0"
                            ? "#ef4444"
                            : activeIssueDetailCard.priority === "P1"
                            ? "#f59e0b"
                            : "#60a5fa",
                      },
                    },
                    activeIssueDetailCard.priority
                  ),
                  // Badge Stage
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        backgroundColor:
                          activeIssueDetailCard.stage === "feito"
                            ? "rgba(16, 185, 129, 0.2)"
                            : activeIssueDetailCard.stage === "revisao"
                            ? "rgba(249, 115, 22, 0.2)"
                            : activeIssueDetailCard.stage === "execucao"
                            ? "rgba(168, 85, 247, 0.2)"
                            : "rgba(56, 189, 248, 0.2)",
                        color:
                          activeIssueDetailCard.stage === "feito"
                            ? "#10b981"
                            : activeIssueDetailCard.stage === "revisao"
                            ? "#f97316"
                            : activeIssueDetailCard.stage === "execucao"
                            ? "#c084fc"
                            : "#38bdf8",
                        textTransform: "uppercase",
                      },
                    },
                    activeIssueDetailCard.stage
                  ),
                  // Botão Fechar
                  h(
                    "button",
                    {
                      onClick: () => setActiveIssueDetailCard(null),
                      style: {
                        background: "transparent",
                        border: "none",
                        color: "#9ca3af",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                      },
                      title: "Fechar (Esc)",
                    },
                    SVG.xCircle({ h, width: 18, height: 18 })
                  )
                )
              ),
              // Título Principal
              h(
                "h2",
                {
                  style: {
                    margin: "4px 0 2px 0",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#ffffff",
                    lineHeight: "1.4",
                  },
                },
                activeIssueDetailCard.title
              ),
              // Sublinha: Datas Reais e Autoridade (FIM DE TIMESTAMPS FALSOS)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "11px",
                    color: "#9ca3af",
                    flexWrap: "wrap",
                  },
                },
                h(
                  "span",
                  { style: { display: "flex", alignItems: "center", gap: "4px" } },
                  SVG.clock({ h, width: 12, height: 12 }),
                  `Criado em: ${formatFullDateTime(activeIssueDetailCard.createdAt)}`
                ),
                h(
                  "span",
                  {
                    style: {
                      fontFamily: "monospace",
                      color: "#34d399",
                      backgroundColor: "rgba(52, 211, 153, 0.12)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                    },
                  },
                  formatRelativeTime(activeIssueDetailCard.createdAt || activeIssueDetailCard.updatedAt || activeIssueDetailCard.elapsedTime)
                ),
                h("span", { style: { color: "#4b5563" } }, "•"),
                h("span", { style: { color: "#cbd5e1" } }, `Autoridade: ${activeIssueDetailCard.decisor || "OrgFy Iris"}`),
                h("span", { style: { color: "#4b5563" } }, "•"),
                h("span", { style: { color: "#9ca3af" } }, `Branch: ${activeIssueDetailCard.branch || "main"}`)
              )
            ),

            // ── CORPO BI-PARTIDO DO MODAL (ESQUERDA: SPEC / DIREITA: ATRIBUTOS & PROBES) ──
            h(
              "div",
              {
                style: {
                  padding: "18px 24px",
                  overflowY: "auto",
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "1.55fr 1fr",
                  gap: "18px",
                },
              },
              // ── COLUNA ESQUERDA: ESPECIFICAÇÃO TÉCNICA E GOVERNANÇA (CARD HERMES V3) ──
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "12px" } },
                // 1. Objetivo do Card
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.025)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderLeft: "3px solid #38bdf8",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Objetivo do Card"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "12px", color: "#f1f5f9", lineHeight: "1.5" } },
                    hydratedIssueDetail?.objetivo || activeIssueDetailCard.objetivo || activeIssueDetailCard.title
                  ),
                  hydratedIssueDetail?.cardFileFound &&
                    h(
                      "div",
                      { style: { fontSize: "10px", color: "#64748b", fontFamily: "monospace", marginTop: "2px" } },
                      `Fonte real: ${hydratedIssueDetail.cardFileFound}`
                    )
                ),

                // 1.5 Progresso & Checklist Vivo (Checkpoint Persistente em cards/<SLUG>.md)
                hydratedIssueDetail?.progress &&
                  hydratedIssueDetail.progress.total > 0 &&
                  h(
                    "div",
                    {
                      style: {
                        borderRadius: "8px",
                        backgroundColor: "rgba(255, 255, 255, 0.025)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                      h(
                        "span",
                        { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                        "Progresso & Checklist de Execução"
                      ),
                      h(
                        "span",
                        { style: { fontSize: "10.5px", fontFamily: "monospace", fontWeight: "700", color: hydratedIssueDetail.progress.pct === 100 ? "#10b981" : "#38bdf8" } },
                        `${hydratedIssueDetail.progress.done}/${hydratedIssueDetail.progress.total} concluídas (${hydratedIssueDetail.progress.pct}%)`
                      )
                    ),
                    h(
                      "div",
                      {
                        style: {
                          height: "6px",
                          width: "100%",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          overflow: "hidden",
                        },
                      },
                      h("div", {
                        style: {
                          height: "100%",
                          width: `${hydratedIssueDetail.progress.pct}%`,
                          backgroundColor: hydratedIssueDetail.progress.blocked > 0 ? "#ef4444" : hydratedIssueDetail.progress.pct === 100 ? "#10b981" : "#38bdf8",
                          transition: "width 0.25s ease",
                        },
                      })
                    ),
                    h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                      hydratedIssueDetail.progress.steps.map((st) => {
                        const badge =
                          st.status === "done"
                            ? { icon: "✓", color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" }
                            : st.status === "in_progress"
                            ? { icon: "▶", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" }
                            : st.status === "blocked"
                            ? { icon: "!", color: "#ef4444", bg: "rgba(239, 68, 68, 0.14)" }
                            : { icon: "○", color: "#6b7280", bg: "rgba(255, 255, 255, 0.05)" };
                        return h(
                          "div",
                          {
                            key: st.id,
                            style: {
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              padding: "5px 8px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(0, 0, 0, 0.28)",
                              fontSize: "11px",
                            },
                          },
                          h(
                            "span",
                            {
                              style: {
                                fontFamily: "monospace",
                                fontWeight: "700",
                                fontSize: "10px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                backgroundColor: badge.bg,
                                color: badge.color,
                                flexShrink: 0,
                              },
                            },
                            `${badge.icon} ${st.id}`
                          ),
                          h(
                            "div",
                            { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                            h(
                              "span",
                              {
                                style: {
                                  color: st.status === "done" ? "#9ca3af" : "#f3f4f6",
                                  textDecoration: st.status === "done" ? "line-through" : "none",
                                  lineHeight: "1.4",
                                },
                              },
                              st.text
                            ),
                            st.note &&
                              h(
                                "span",
                                { style: { fontSize: "10px", fontFamily: "monospace", color: "#38bdf8" } },
                                st.note
                              )
                          )
                        );
                      })
                    )
                  ),

                // 2. Estado & Autoridade Decisória (100% real, sem fallback genérico)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Estado & Autoridade Decisória"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                    h("strong", { style: { color: "#ffffff" } }, "Contexto: "),
                    hydratedIssueDetail?.contexto || activeIssueDetailCard.contexto || (isHydratingIssueDetail ? "Carregando card em disco..." : "Não declarado no card.")
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                    h("strong", { style: { color: "#ffffff" } }, "Decisão / Autoridade: "),
                    hydratedIssueDetail?.decisao || hydratedIssueDetail?.autoridade || activeIssueDetailCard.decisao || activeIssueDetailCard.autoridade || "Não declarada no card."
                  ),
                  hydratedIssueDetail?.escritaExclusiva && hydratedIssueDetail.escritaExclusiva.length > 0 &&
                    h(
                      "div",
                      { style: { fontSize: "10px", color: "#93c5fd", fontFamily: "monospace", marginTop: "2px" } },
                      `Escrita exclusiva: ${hydratedIssueDetail.escritaExclusiva.join(", ")}`
                    )
                ),

                // 3. Invariante L-22: Comando de Aceite Congelado
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "#060907",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h(
                      "span",
                      { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                      "Comando de Aceite Congelado (Invariante L-22)"
                    ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "8px" } },
                      h(
                        "span",
                        { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } },
                        "Blindagem SHA-256"
                      ),
                      h(
                        "button",
                        {
                          onClick: () => {
                            const cmd = hydratedIssueDetail?.acceptanceCommand || activeIssueDetailCard.acceptanceCommand || "";
                            if (cmd && typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
                              navigator.clipboard.writeText(cmd);
                              showNotification("success", "Comando de aceite L-22 copiado!");
                            }
                          },
                          style: {
                            padding: "2px 6px",
                            borderRadius: "4px",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            fontSize: "10px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          },
                          title: "Copiar comando de aceite",
                        },
                        SVG.copy({ h, width: 10, height: 10 }),
                        "Copiar"
                      )
                    )
                  ),
                  h(
                    "code",
                    {
                      style: {
                        fontSize: "11px",
                        fontFamily: "monospace",
                        backgroundColor: "#020403",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        color: hydratedIssueDetail?.acceptanceCommand || activeIssueDetailCard.acceptanceCommand ? "#34d399" : "#9ca3af",
                        display: "block",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        border: "1px solid rgba(16, 185, 129, 0.15)",
                      },
                    },
                    hydratedIssueDetail?.acceptanceCommand || activeIssueDetailCard.acceptanceCommand || "Comando de aceite ainda não registrado."
                  ),
                  h(
                    "div",
                    { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace", display: "flex", justifyContent: "space-between", gap: "8px" } },
                    h(
                      "span",
                      {},
                      hydratedIssueDetail?.acceptanceHash
                        ? `Hash de Aceite: ${hydratedIssueDetail.acceptanceHash.slice(0, 28)}...`
                        : "Hash de Aceite: não gerado"
                    ),
                    h(
                      "span",
                      { style: { color: hydratedIssueDetail?.acceptanceFrozenValid ? "#10b981" : "#f59e0b", fontWeight: "600" } },
                      hydratedIssueDetail?.acceptanceFrozenValid
                        ? "✓ Congelamento Válido (Anti-Bypass)"
                        : "Pendente de congelamento L-22"
                    )
                  )
                ),

                // 4. Critérios de Feito & Provas Exigidas
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Critérios de Feito & Provas Exigidas"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                    h("strong", { style: { color: "#ffffff" } }, "Feito quando: "),
                    hydratedIssueDetail?.feitoQuando || activeIssueDetailCard.feitoQuando || "Não declarado no card."
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5", whiteSpace: "pre-wrap" } },
                    h("strong", { style: { color: "#ffffff" } }, "Prova exigida: "),
                    hydratedIssueDetail?.provaExigida || activeIssueDetailCard.provaExigida || "Não declarada no card."
                  )
                ),

                // 5. Histórico de Ciclos & DSAP Backtracking (100% real)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#f59e0b", textTransform: "uppercase" } }, "Histórico de Ciclos & DSAP Backtracking"),
                    h("span", { style: { fontSize: "10px", color: "#6b7280" } }, "Threshold: similaridade >= 0.70")
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#9ca3af" } },
                    activeIssueDetailCard.rejectionHistory && activeIssueDetailCard.rejectionHistory.length > 0
                      ? `Recusa recente: ${activeIssueDetailCard.rejectionHistory[0].reason} (${Math.round((activeIssueDetailCard.rejectionHistory[0].similarityToFirst || 0) * 100)}% similaridade)`
                      : hydratedIssueDetail && hydratedIssueDetail.rejectionsCount > 0
                      ? `${hydratedIssueDetail.rejectionsCount} recusa(s)/conflito(s) registrados em esteira-transicoes.jsonl.`
                      : activeIssueDetailCard.stage === "feito"
                      ? "Concluída sem recusas registradas (FPY 100% real)."
                      : hydratedIssueDetail && hydratedIssueDetail.transitions.length > 0
                      ? `${hydratedIssueDetail.transitions.length} transição(ões) registrada(s); última: ${hydratedIssueDetail.transitions[hydratedIssueDetail.transitions.length - 1].de} -> ${hydratedIssueDetail.transitions[hydratedIssueDetail.transitions.length - 1].para}.`
                      : "Em andamento — aguardando conclusão e veredito do Gate (FPY ainda não fechado)."
                  )
                )
              ),

              // ── COLUNA DIREITA: SIDEBAR DE ATRIBUTOS, RUNTIME BUZZ & PROBES ──
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "12px" } },
                // Box A: Papéis & Atribuição
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#c084fc", textTransform: "uppercase" } }, "Papéis & Atribuição"),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Decisor"),
                    h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(192, 132, 252, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.decisor || "OrgFy Iris")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Revisor"),
                    h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(56, 189, 248, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.revisor || "QA Sentinel")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Executor"),
                    h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.executor || "Não atribuído")
                  )
                ),

                // Box B: Execução Buzz Runtime
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase" } }, "Execução Buzz Runtime (Real)"),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Modo"),
                    h(
                      "span",
                      { style: { color: "#ffffff", fontFamily: "monospace" } },
                      hydratedIssueDetail?.modoBuzz
                        ? `${hydratedIssueDetail.modoBuzz}${hydratedIssueDetail.goalMaxTurns ? ` (${hydratedIssueDetail.goalMaxTurns} turns max)` : ""}`
                        : "Não declarado"
                    )
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Tempo Máximo"),
                    h("span", { style: { color: "#ffffff", fontFamily: "monospace" } }, hydratedIssueDetail?.maxRuntime || "Não declarado")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Checkout Lock"),
                    h(
                      "span",
                      { style: { color: hydratedIssueDetail?.lockActive ? "#10b981" : "#9ca3af", fontFamily: "monospace", fontSize: "10px" } },
                      hydratedIssueDetail?.lockActive
                        ? `Ativo (${hydratedIssueDetail.lockAgent} · ${hydratedIssueDetail.lockExpiresInMin}m)`
                        : "Sem lock ativo"
                    )
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Worktree / Branch"),
                    h(
                      "span",
                      { style: { color: "#10b981", fontFamily: "monospace", fontSize: "10px" } },
                      hydratedIssueDetail?.worktreePath || hydratedIssueDetail?.branch || "Não definida"
                    )
                  )
                ),

                // Box C: Modelo Real do Executor (agents/state/ — Zero Hardcode)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase" } }, "Modelo Real do Executor (Buzz Desktop)"),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#ffffff", fontWeight: "600", fontFamily: "monospace" } },
                    hydratedIssueDetail?.executorModel
                      ? `${hydratedIssueDetail.executorProvider ? hydratedIssueDetail.executorProvider + "/" : ""}${hydratedIssueDetail.executorModel}`
                      : isHydratingIssueDetail
                      ? "Lendo agents/state/..."
                      : "Modelo não identificado no state local"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "10px", color: "#9ca3af" } },
                    activeIssueDetailCard.tokens
                      ? `Telemetria: ${activeIssueDetailCard.tokens}k tokens${activeIssueDetailCard.estimatedCost ? ` · $${activeIssueDetailCard.estimatedCost}` : ""}`
                      : "Telemetria de custo/tokens da issue: indisponível (use aba Inteligência & Saúde para média real)."
                  )
                ),

                // Box D: Probes Caixa-Preta do Gate (Manifesto Real — Zero PASS Falso)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase" } }, "Probes & Validações do Gate"),
                    h("span", { style: { fontSize: "9px", color: "#6b7280", fontFamily: "monospace" } }, hydratedIssueDetail?.probesSource || "")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                    ...(hydratedIssueDetail?.probes || []).map((pr, idx) =>
                      h(
                        "div",
                        { key: idx, style: { display: "flex", justifyContent: "space-between", gap: "8px", color: "#d1d5db" } },
                        h("span", { title: pr.detail || "" }, `• ${pr.label}`),
                        h(
                          "span",
                          {
                            style: {
                              color:
                                pr.status === "PASS"
                                  ? "#10b981"
                                  : pr.status === "FAIL"
                                  ? "#ef4444"
                                  : pr.status === "PENDENTE"
                                  ? "#f59e0b"
                                  : "#6b7280",
                              fontWeight: "700",
                              fontFamily: "monospace",
                            },
                          },
                          pr.status
                        )
                      )
                    ),
                    (!hydratedIssueDetail || hydratedIssueDetail.probes.length === 0) &&
                      h("div", { style: { color: "#6b7280" } }, isHydratingIssueDetail ? "Lendo probes reais..." : "Nenhum probe registrado para esta issue.")
                  )
                ),

                // Box E: Transcript & Diffs Nativos do Agente (ctx.agents.ui.Transcript)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase" } }, "Transcript & Diffs do Agente (Nativo)"),
                  (ctx.agents as any)?.ui?.Transcript && (activeIssueDetailCard as any)?.conversationId
                    ? h((ctx.agents as any).ui.Transcript, {
                        conversationId: (activeIssueDetailCard as any).conversationId,
                        compact: true,
                      })
                    : h(
                        "div",
                        { style: { fontSize: "10px", color: "#9ca3af", lineHeight: "1.4" } },
                        "Nenhuma sessão ativa vinculada a este card ainda. Ao despachar com conversation_id (ou via orgfy_bind_context), o transcript e os diffs nativos do Buzz aparecem aqui."
                      )
                )
              )
            ),

            // ── FOOTER DE AÇÕES (1-CLIQUE ASSERTIVO) ──
            h(
              "div",
              {
                style: {
                  padding: "14px 24px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.015)",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "button",
                  {
                    onClick: (e: any) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const card = activeIssueDetailCard;
                      setActiveIssueDetailCard(null);
                      handleOpenIssueDeepLink(card);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    },
                    title: "Navegar diretamente para a Issue na tela nativa de Repos do Buzz Desktop",
                  },
                  SVG.externalLink({ h, width: 13, height: 13 }),
                  "Abrir no Buzz Desktop"
                ),
                h(
                  "button",
                  {
                    onClick: (e: any) => handleCopyDeepLink(e, activeIssueDetailCard),
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.copy({ h, width: 13, height: 13 }),
                  "Copiar Link"
                )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "button",
                  {
                    onClick: () => {
                      const c = activeIssueDetailCard;
                      setActiveIssueDetailCard(null);
                      setDispatchIssueId(c.issueId);
                      setIsDispatchModalOpen(true);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "rgba(245, 158, 11, 0.18)",
                      color: "#f59e0b",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.zap({ h, width: 12, height: 12 }),
                  "Despachar"
                ),
                activeIssueDetailCard.stage === "revisao" &&
                  h(
                    "button",
                    {
                      onClick: () => {
                        const c = activeIssueDetailCard;
                        setActiveIssueDetailCard(null);
                        handleAcceptGate(c);
                      },
                      style: {
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#10b981",
                        color: "#000000",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      },
                    },
                    SVG.checkCircle({ h, width: 12, height: 12 }),
                    "Aceitar Gate"
                  ),
                h(
                  "button",
                  {
                    onClick: () => {
                      const c = activeIssueDetailCard;
                      setActiveIssueDetailCard(null);
                      setActiveLogsCard(c);
                      setIsLogsDrawerOpen(true);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      color: "#9ca3af",
                      fontSize: "11px",
                      fontWeight: "500",
                      cursor: "pointer",
                    },
                  },
                  "Ver Logs"
                ),
                h(
                  "button",
                  {
                    onClick: () => setActiveIssueDetailCard(null),
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "transparent",
                      color: "#9ca3af",
                      fontSize: "11px",
                      cursor: "pointer",
                    },
                  },
                  "Fechar"
                )
              )
            )
          )
        )
  );
}
