// @ts-nocheck
// Extraído de src/index.tsx na Onda 4 (R4.4)
import { THEME, SVG, TENANTS } from "../ui/theme-icons";
import type { PipelineCard } from "../types/orgfy";
import { formatRelativeTime, formatFullDateTime } from "../services/orgfy-bridge";
import { compileProbationaryRule } from "../services/templates-rsi";
import { isUnsupportedAgentModel } from "../services/model-failover";

export function renderTemplatesRsiSection(p: any) {
  const { ctx, h, holdingData, kpisData, loadHolding, regrasProbatorias, showNotification } = p;
      const templatesReais = holdingData?.templatesReais || [];
      const regrasReais = holdingData?.regrasProbatorias || [];
      const fpyReal = kpisData?.qualidade?.fpy_real_pct;
      const totalIntegrados = kpisData?.fluxo?.vazao_total_feito;

      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            overflowY: "auto",
            paddingRight: "6px",
          },
        },
        h(
          "div",
          {
            style: {
              padding: "14px 18px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.025)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            },
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, "Templates Reais do Repositório & Motor RSI (Zero Mockups)"),
            h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, "Arquivos lidos diretamente de REPOS/orgfy/templates/ e regras-probatorias.json.")
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "span",
              { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.14)", color: "#10b981", fontWeight: "700", fontFamily: "monospace" } },
              `FPY Real: ${typeof fpyReal === "number" ? `${fpyReal.toFixed(1)}%` : "--"}`
            ),
            h(
              "span",
              { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(56, 189, 248, 0.14)", color: "#38bdf8", fontWeight: "700", fontFamily: "monospace" } },
              `${typeof totalIntegrados === "number" ? totalIntegrados : "--"} integrados`
            )
          )
        ),

        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" } },
          templatesReais.map((tmpl) =>
            h(
              "div",
              {
                key: tmpl.id,
                style: {
                  borderRadius: "10px",
                  backgroundColor: "#15161a",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                  h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, tmpl.name),
                  h("span", { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } }, tmpl.path)
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontWeight: "700",
                      backgroundColor: tmpl.exists ? "rgba(16, 185, 129, 0.16)" : "rgba(239, 68, 68, 0.16)",
                      color: tmpl.exists ? "#10b981" : "#f87171",
                      fontFamily: "monospace",
                    },
                  },
                  tmpl.exists ? `${tmpl.versionTag} · ${tmpl.linesCount} linhas` : "AUSENTE"
                )
              ),
              h("p", { style: { fontSize: "11px", color: "#9ca3af", margin: 0, lineHeight: "1.4" } }, tmpl.preview),
              h(
                "div",
                { style: { display: "flex", gap: "8px", marginTop: "auto" } },
                h(
                  "button",
                  {
                    onClick: () => {
                      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(tmpl.path);
                      }
                      showNotification("success", `Caminho copiado: ${tmpl.path}`);
                    },
                    style: {
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      color: "#cbd5e1",
                      fontSize: "10px",
                      fontWeight: "600",
                      cursor: "pointer",
                    },
                  },
                  "Copiar Caminho"
                ),
                tmpl.exists &&
                  h(
                    "button",
                    {
                      onClick: () => {
                        if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
                          navigator.clipboard.writeText(tmpl.content);
                        }
                        showNotification("success", `Conteúdo real de ${tmpl.path} copiado!`);
                      },
                      style: {
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        backgroundColor: "rgba(56, 189, 248, 0.1)",
                        color: "#38bdf8",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: "pointer",
                      },
                    },
                    "Copiar Template"
                  )
              )
            )
          )
        ),

        h(
          "div",
          {
            style: {
              borderRadius: "10px",
              backgroundColor: "#15161a",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            },
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, `Regras Probatórias L-90 (${regrasReais.length} ativas em regras-probatorias.json)`),
            h(
              "button",
              {
                onClick: async () => {
                  showNotification("info", "Disparando retro.py para compilação probatória...");
                  const res = await compileProbationaryRule(ctx, {
                    erroId: "auto-" + Date.now().toString().slice(-4),
                    descricao: "Prevenção compilada via Control Plane v2",
                    comandoCheck: "python3 -m pytest -q testes/esteira -v",
                  });
                  if (res.success) {
                    await loadHolding();
                    showNotification("success", "Regra probatória compilada com sucesso!");
                  } else {
                    showNotification("warning", "Falha na compilação da regra probatória.");
                  }
                },
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#c084fc",
                  color: "#000000",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                },
              },
              "+ Compilar Regra"
            )
          ),
          regrasReais.length === 0
            ? h(
                "div",
                { style: { padding: "14px", textAlign: "center", color: "#9ca3af", fontSize: "11px" } },
                "Nenhuma regra probatória registrada em .esteira/estado/regras-probatorias.json no momento."
              )
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                regrasReais.map((r) =>
                  h(
                    "div",
                    {
                      key: r.id,
                      style: {
                        display: "grid",
                        gridTemplateColumns: "110px 1fr 120px 100px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(0,0,0,0.25)",
                        fontSize: "11px",
                        alignItems: "center",
                      },
                    },
                    h("span", { style: { fontFamily: "monospace", color: "#f3f4f6", fontWeight: "600" } }, r.id),
                    h("span", { style: { color: "#9ca3af" } }, r.descricao),
                    h("span", { style: { fontFamily: "monospace", color: "#60a5fa" } }, `${r.cardsAvaliados}/${r.janelaAlvo} cards`),
                    h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981" } }, r.status)
                  )
                )
              )
        )
      );

}
