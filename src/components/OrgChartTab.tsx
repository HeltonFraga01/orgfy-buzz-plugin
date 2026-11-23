// ─────────────────────────────────────────────────────────────────────────────
// ORG CHART TAB (ESTILO PAPERCLIP — HIERARQUIA REAL LIDA DE empresas/*.json)
// ─────────────────────────────────────────────────────────────────────────────

import type { HoldingControlPlaneSnapshot } from "../services/holding-service";

export function renderOrgChartTab(props: {
  h: any;
  holding: HoldingControlPlaneSnapshot | null;
  selectedTenant: string;
}) {
  const { h, holding, selectedTenant } = props;

  if (!holding) {
    return h(
      "div",
      { style: { padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: "13px" } },
      "Carregando organograma real da holding..."
    );
  }

  const visibleCompanies =
    selectedTenant === "all" || selectedTenant === "board"
      ? holding.empresas
      : holding.empresas.filter((e) => e.slug === selectedTenant);

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
    // Topo da Hierarquia: Fundador -> CEO Holding (Board)
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        },
      },
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(16,185,129,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          },
        },
        h("span", { style: { fontSize: "10px", color: "#10b981", fontWeight: "700", textTransform: "uppercase" } }, "Nível 0 · Presidente do Conselho"),
        h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, holding.fundador.nome),
        h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, holding.fundador.papel)
      ),
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(56,189,248,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          },
        },
        h("span", { style: { fontSize: "10px", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase" } }, "Nível 1 · CEO da Holding (Board)"),
        h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, holding.ceoHolding.nome),
        h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, holding.ceoHolding.papel)
      )
    ),

    // Empresas e Times
    visibleCompanies.map((emp) =>
      h(
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
            gap: "12px",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, emp.nome),
            h(
              "span",
              { style: { fontSize: "10px", fontFamily: "monospace", color: "#9ca3af" } },
              `Reporta a ${emp.reportaA} · ${emp.agentesProntos}/${emp.agentesTotal} prontos`
            )
          ),
          h(
            "span",
            {
              style: {
                fontSize: "10px",
                fontFamily: "monospace",
                color: emp.nivel === "core" ? "#38bdf8" : "#c084fc",
                textTransform: "uppercase",
              },
            },
            emp.nivel === "core" ? "Fábrica de Método" : "Subsidiária"
          )
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "8px",
            },
          },
          emp.agentes.map((ag) => {
            const isBusy = ag.activeLock !== null;
            const badgeColor = isBusy ? "#f59e0b" : ag.pubkeyReady ? "#10b981" : "#6b7280";
            const badgeText = isBusy ? "EM EXECUÇÃO" : ag.pubkeyReady ? "PRONTO" : "PUBKEY PENDENTE";
            return h(
              "div",
              {
                key: `${emp.slug}-${ag.name}`,
                style: {
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  border: isBusy ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, ag.name),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "9px",
                      fontWeight: "700",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      backgroundColor: `${badgeColor}22`,
                      color: badgeColor,
                    },
                  },
                  badgeText
                )
              ),
              h("span", { style: { fontSize: "10px", color: "#9ca3af" } }, `Papel: ${ag.papel} · Paralelismo: ${ag.parallelism}x`),
              h("span", { style: { fontSize: "10px", fontFamily: "monospace", color: "#60a5fa" } }, ag.model),
              ag.activeLock &&
                h(
                  "span",
                  { style: { fontSize: "9.5px", fontFamily: "monospace", color: "#fbbf24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  `Lock #${ag.activeLock.issueId.slice(0, 8)}${ag.activeLock.title ? ` · ${ag.activeLock.title}` : ""}`
                )
            );
          })
        )
      )
    )
  );
}
