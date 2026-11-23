// ─────────────────────────────────────────────────────────────────────────────
// BOARD & HOLDING TAB (CONTROL PLANE V2 — VISÃO EXECUTIVA PAPERCLIP/LINEAR)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  HoldingControlPlaneSnapshot,
  BoardApprovalItem,
} from "../services/holding-service";
import type { KpisEsteiraPayload } from "../services/kpi-service";

export interface BoardHoldingTabProps {
  h: any;
  holding: HoldingControlPlaneSnapshot | null;
  kpis: KpisEsteiraPayload | null;
  onSelectTenant: (slug: string) => void;
  onCreateApproval: (input: {
    empresa: string;
    tipo: BoardApprovalItem["tipo"];
    titulo: string;
    descricao: string;
  }) => Promise<void>;
  onDecideApproval: (id: string, decision: "aprovado" | "recusado") => Promise<void>;
  onRefresh: () => void;
  newApprovalTitle: string;
  setNewApprovalTitle: (v: string) => void;
  newApprovalDesc: string;
  setNewApprovalDesc: (v: string) => void;
  newApprovalCompany: string;
  setNewApprovalCompany: (v: string) => void;
  newApprovalType: BoardApprovalItem["tipo"];
  setNewApprovalType: (v: BoardApprovalItem["tipo"]) => void;
}

const fmtTokens = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return "--";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
};

export function renderBoardHoldingTab(props: BoardHoldingTabProps) {
  const { h, holding, kpis } = props;

  if (!holding) {
    return h(
      "div",
      {
        style: {
          padding: "32px",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "13px",
        },
      },
      "Carregando estado real da Holding e do Conselho (empresas/board.json)..."
    );
  }

  const pendingApprovals = holding.approvals.filter((a) => a.status === "pendente");
  const workflowOk = holding.workflows.every((w) => w.exists && w.enabled === true);

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "4px",
      },
    },

    // 1. Cabeçalho Executivo da Holding
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderRadius: "10px",
          backgroundColor: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          flexWrap: "wrap",
          gap: "12px",
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          h("span", { style: { fontSize: "15px", fontWeight: "700", color: "#f3f4f6" } }, holding.boardNome),
          h(
            "span",
            {
              style: {
                fontSize: "10px",
                fontFamily: "monospace",
                padding: "2px 7px",
                borderRadius: "9999px",
                backgroundColor: workflowOk ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.18)",
                color: workflowOk ? "#10b981" : "#f87171",
                fontWeight: "700",
              },
            },
            workflowOk ? "WORKFLOW ATIVO" : "ALERTA WORKFLOW"
          )
        ),
        h(
          "span",
          { style: { fontSize: "11px", color: "#9ca3af" } },
          `Fundador: ${holding.fundador.nome} · CEO Holding: ${holding.ceoHolding.nome} · ${holding.empresas.length} empresas no portfólio · ${pendingApprovals.length} aprovação(ões) pendente(s)`
        )
      ),
      h(
        "button",
        {
          onClick: props.onRefresh,
          style: {
            padding: "6px 12px",
            borderRadius: "7px",
            border: "1px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "#e5e7eb",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer",
          },
        },
        "Atualizar Holding"
      )
    ),

    // 2. Portfólio de Empresas (Core + Subsidiárias)
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "8px" } },
      h(
        "div",
        { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" } },
        "Portfólio de Empresas & Prontidão Operacional"
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: "12px",
          },
        },
        holding.empresas.map((emp) => {
          const isOp = emp.estagio === "operacional";
          const statusColor = isOp ? "#10b981" : emp.estagio === "onboarding" ? "#f59e0b" : "#60a5fa";
          return h(
            "div",
            {
              key: emp.slug,
              style: {
                padding: "14px 16px",
                borderRadius: "10px",
                backgroundColor: "#15161a",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              },
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, emp.nome),
                h(
                  "span",
                  { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } },
                  `Workspace: ${emp.workspaceBuzz} · Liderança: ${emp.ceoEmpresa}`
                )
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                    textTransform: "uppercase",
                  },
                },
                emp.estagio
              )
            ),
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  fontSize: "11px",
                },
              },
              h(
                "div",
                null,
                h("div", { style: { fontSize: "9px", color: "#6b7280" } }, "AGENTES"),
                h("div", { style: { fontWeight: "700", color: "#f3f4f6", fontFamily: "monospace" } }, `${emp.agentesProntos}/${emp.agentesTotal}`)
              ),
              h(
                "div",
                null,
                h("div", { style: { fontSize: "9px", color: "#6b7280" } }, "TETO/DIA"),
                h("div", { style: { fontWeight: "700", color: "#f3f4f6", fontFamily: "monospace" } }, `${fmtTokens(emp.budgetTokensDiario)} tok`)
              ),
              h(
                "div",
                null,
                h("div", { style: { fontSize: "9px", color: "#6b7280" } }, "EM EXECUÇÃO"),
                h("div", { style: { fontWeight: "700", color: emp.locksAtivos > 0 ? "#f59e0b" : "#10b981", fontFamily: "monospace" } }, `${emp.locksAtivos} ativo(s)`)
              )
            ),
            emp.slug === "orgfy" && kpis
              ? h(
                  "div",
                  { style: { fontSize: "11px", color: "#9ca3af", display: "flex", gap: "10px", fontFamily: "monospace" } },
                  h("span", { style: { color: "#10b981" } }, `FPY: ${kpis.qualidade.fpy_real_pct ?? "--"}%`),
                  h("span", null, `30d: ${kpis.fluxo.vazao_30d} merges`),
                  h("span", null, `Alertas: ${kpis.alertas_ativos.length}`)
                )
              : null,
            emp.pendenciasOnboarding.length > 0
              ? h(
                  "div",
                  {
                    style: {
                      padding: "8px 10px",
                      borderRadius: "7px",
                      backgroundColor: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.22)",
                      fontSize: "10px",
                      color: "#fbbf24",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    },
                  },
                  h("strong", null, "Pendências para virar a chave:"),
                  emp.pendenciasOnboarding.map((p, i) => h("span", { key: i }, `• ${p}`))
                )
              : h(
                  "div",
                  { style: { fontSize: "10px", color: "#10b981" } },
                  "✓ Manifesto, canal e chaves operacionais validados."
                ),
            h(
              "button",
              {
                onClick: () => props.onSelectTenant(emp.slug),
                style: {
                  marginTop: "auto",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: "#e5e7eb",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                },
              },
              `Abrir Esteira de ${emp.nome} →`
            )
          );
        })
      )
    ),

    // 3. Linha inferior: Conselho Funcional + Fila de Aprovações do Board
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1.35fr",
          gap: "12px",
        },
      },
      // Conselho Funcional + Fluxo de Escalada
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          },
        },
        h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "Conselho Funcional (Board)"),
        holding.conselho.map((c) =>
          h(
            "div",
            {
              key: c.id,
              style: {
                padding: "8px 10px",
                borderRadius: "7px",
                backgroundColor: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "2px" } },
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } }, c.area),
              h("span", { style: { fontSize: "10px", color: "#9ca3af" } }, c.responsavel)
            ),
            h(
              "span",
              {
                style: {
                  fontSize: "9px",
                  fontWeight: "700",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: c.status === "ativo" ? "rgba(16,185,129,0.16)" : "rgba(96,165,250,0.16)",
                  color: c.status === "ativo" ? "#10b981" : "#60a5fa",
                  textTransform: "uppercase",
                },
              },
              c.status
            )
          )
        ),
        Object.keys(holding.fluxoEscalada).length > 0 &&
          h(
            "div",
            {
              style: {
                marginTop: "4px",
                padding: "10px",
                borderRadius: "7px",
                backgroundColor: "rgba(56,189,248,0.06)",
                border: "1px solid rgba(56,189,248,0.18)",
                fontSize: "10px",
                color: "#cbd5e1",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              },
            },
            h("strong", { style: { color: "#38bdf8" } }, "Roteamento de Autonomia:"),
            Object.entries(holding.fluxoEscalada).map(([k, v]) =>
              h("span", { key: k }, `• ${k.replace(/_/g, " ")}: ${v}`)
            )
          )
      ),

      // Fila de Aprovações do Board (Persistida em board-approvals.json)
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "Fila de Aprovações do Board (Z5 / Z6 / Investimentos)"),
          h("span", { style: { fontSize: "10px", fontFamily: "monospace", color: "#9ca3af" } }, `${pendingApprovals.length} pendente(s)`)
        ),
        // Formulário rápido de nova deliberação
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "1fr 120px 130px",
              gap: "6px",
            },
          },
          h("input", {
            type: "text",
            placeholder: "Nova pauta ou aprovação para o Board...",
            value: props.newApprovalTitle,
            onChange: (e: any) => props.setNewApprovalTitle(e.target.value),
            style: {
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f3f4f6",
              fontSize: "11px",
              outline: "none",
            },
          }),
          h(
            "select",
            {
              value: props.newApprovalCompany,
              onChange: (e: any) => props.setNewApprovalCompany(e.target.value),
              style: {
                padding: "6px 8px",
                borderRadius: "6px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f3f4f6",
                fontSize: "11px",
              },
            },
            h("option", { value: "board" }, "Board"),
            holding.empresas.map((e) => h("option", { key: e.slug, value: e.slug }, e.nome))
          ),
          h(
            "select",
            {
              value: props.newApprovalType,
              onChange: (e: any) => props.setNewApprovalType(e.target.value),
              style: {
                padding: "6px 8px",
                borderRadius: "6px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f3f4f6",
                fontSize: "11px",
              },
            },
            h("option", { value: "investimento" }, "Investimento"),
            h("option", { value: "orcamento" }, "Orçamento"),
            h("option", { value: "metodo_z5_z6" }, "Método Z5/Z6"),
            h("option", { value: "intervencao" }, "Intervenção"),
            h("option", { value: "onboarding" }, "Onboarding")
          )
        ),
        h(
          "div",
          { style: { display: "flex", gap: "6px" } },
          h("input", {
            type: "text",
            placeholder: "Contexto objetivo ou impacto esperado...",
            value: props.newApprovalDesc,
            onChange: (e: any) => props.setNewApprovalDesc(e.target.value),
            style: {
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f3f4f6",
              fontSize: "11px",
              outline: "none",
            },
          }),
          h(
            "button",
            {
              onClick: () => {
                if (!props.newApprovalTitle.trim()) return;
                props.onCreateApproval({
                  empresa: props.newApprovalCompany,
                  tipo: props.newApprovalType,
                  titulo: props.newApprovalTitle,
                  descricao: props.newApprovalDesc || "Registrado via OrgFy Control Plane",
                });
              },
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#10b981",
                color: "#000000",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer",
              },
            },
            "+ Registrar"
          )
        ),
        holding.approvals.length === 0
          ? h(
              "div",
              { style: { padding: "18px", textAlign: "center", color: "#6b7280", fontSize: "11px" } },
              "Nenhuma deliberação registrada em board-approvals.json ainda."
            )
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "230px", overflowY: "auto" } },
              holding.approvals.map((ap) =>
                h(
                  "div",
                  {
                    key: ap.id,
                    style: {
                      padding: "8px 10px",
                      borderRadius: "7px",
                      backgroundColor: "rgba(0,0,0,0.28)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "6px" } },
                      h("span", { style: { fontSize: "9px", fontFamily: "monospace", color: "#38bdf8", textTransform: "uppercase" } }, `${ap.empresa} · ${ap.tipo}`),
                      h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } }, ap.titulo)
                    ),
                    h("span", { style: { fontSize: "10px", color: "#9ca3af" } }, ap.descricao)
                  ),
                  ap.status === "pendente"
                    ? h(
                        "div",
                        { style: { display: "flex", gap: "6px", flexShrink: 0 } },
                        h(
                          "button",
                          {
                            onClick: () => props.onDecideApproval(ap.id, "aprovado"),
                            style: {
                              padding: "4px 8px",
                              borderRadius: "5px",
                              border: "none",
                              backgroundColor: "rgba(16,185,129,0.2)",
                              color: "#10b981",
                              fontSize: "10px",
                              fontWeight: "700",
                              cursor: "pointer",
                            },
                          },
                          "Aprovar"
                        ),
                        h(
                          "button",
                          {
                            onClick: () => props.onDecideApproval(ap.id, "recusado"),
                            style: {
                              padding: "4px 8px",
                              borderRadius: "5px",
                              border: "none",
                              backgroundColor: "rgba(239,68,68,0.18)",
                              color: "#f87171",
                              fontSize: "10px",
                              fontWeight: "700",
                              cursor: "pointer",
                            },
                          },
                          "Recusar"
                        )
                      )
                    : h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            fontWeight: "700",
                            color: ap.status === "aprovado" ? "#10b981" : "#f87171",
                            textTransform: "uppercase",
                            flexShrink: 0,
                          },
                        },
                        ap.status
                      )
                )
              )
            )
      )
    )
  );
}
