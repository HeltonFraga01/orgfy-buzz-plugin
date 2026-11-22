import type { ResolvedIssueItem } from "../services/resolved-archive";

export interface ResolvedArchiveTabProps {
  h: any;
  items: ResolvedIssueItem[];
  error: string | null;
  searchQuery: string;
  specFilter: string;
  copiedId: string | null;
  onSearchChange: (q: string) => void;
  onSpecFilterChange: (spec: string) => void;
  onCopyLink: (item: ResolvedIssueItem) => void;
  onReopenFollowUp: (item: ResolvedIssueItem) => void;
  onRefresh: () => void;
}

export function renderResolvedArchiveTab(props: ResolvedArchiveTabProps) {
  const {
    h,
    items,
    error,
    searchQuery,
    specFilter,
    copiedId,
    onSearchChange,
    onSpecFilterChange,
    onCopyLink,
    onReopenFollowUp,
    onRefresh,
  } = props;

  if (error) {
    return h(
      "div",
      {
        style: {
          padding: "28px",
          borderRadius: "10px",
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "12px",
        },
      },
      h("div", { style: { color: "#f8fafc", fontWeight: "700", marginBottom: "6px" } }, "Arquivo de Issues Resolvidas indisponível"),
      h("div", { style: { marginBottom: "12px" } }, error),
      h(
        "button",
        {
          onClick: onRefresh,
          style: {
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            color: "#10b981",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
          },
        },
        "Tentar novamente"
      )
    );
  }

  const specs = Array.from(new Set(items.map((i) => i.spec).filter(Boolean)));
  const q = searchQuery.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (specFilter !== "all" && item.spec !== specFilter) return false;
    if (!q) return true;
    const hay = [
      item.issueId,
      item.code,
      item.titulo,
      item.causaRaiz,
      item.commitSha || "",
      ...(item.arquivosAlterados || []),
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        paddingBottom: "24px",
      },
    },
    // Barra de busca e filtros
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "10px",
          backgroundColor: "rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flex: "1 1 320px" } },
        h("input", {
          type: "text",
          value: searchQuery,
          onChange: (e: any) => onSearchChange(e.target.value),
          placeholder: "Buscar issue resolvida por código, causa raiz, arquivo ou SHA...",
          style: {
            flex: 1,
            padding: "7px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(0,0,0,0.35)",
            color: "#f8fafc",
            fontSize: "12px",
            outline: "none",
          },
        }),
        h(
          "select",
          {
            value: specFilter,
            onChange: (e: any) => onSpecFilterChange(e.target.value),
            style: {
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(0,0,0,0.45)",
              color: "#e2e8f0",
              fontSize: "12px",
            },
          },
          h("option", { value: "all" }, `Todas as Specs (${items.length})`),
          ...specs.map((sp) => h("option", { key: sp, value: sp }, sp))
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "#9ca3af" } },
        h("span", {}, `Exibindo ${filtered.length} de ${items.length} resolvidas (consulta sob demanda — zero poluição no Kanban ativo)`),
        h(
          "button",
          {
            onClick: onRefresh,
            style: {
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#e2e8f0",
              fontSize: "11px",
              cursor: "pointer",
            },
          },
          "Atualizar"
        )
      )
    ),

    // Lista de cards resolvidos
    filtered.length === 0
      ? h(
          "div",
          {
            style: {
              padding: "24px",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "12px",
              borderRadius: "10px",
              border: "1px dashed rgba(255,255,255,0.08)",
            },
          },
          "Nenhuma issue resolvida corresponde ao filtro atual."
        )
      : h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "10px",
            },
          },
          ...filtered.slice(0, 60).map((item) =>
            h(
              "div",
              {
                key: item.issueId + item.code,
                style: {
                  borderRadius: "10px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 7px",
                        borderRadius: "5px",
                        backgroundColor: "rgba(16,185,129,0.15)",
                        color: "#10b981",
                        fontFamily: "monospace",
                      },
                    },
                    item.code
                  ),
                  h(
                    "span",
                    { style: { fontSize: "10px", color: "#38bdf8", fontFamily: "monospace" } },
                    `#${item.issueId}`
                  ),
                  item.commitSha &&
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "10px",
                          color: "#c084fc",
                          fontFamily: "monospace",
                          backgroundColor: "rgba(168,85,247,0.14)",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        },
                      },
                      `SHA ${item.commitSha}`
                    )
                ),
                h(
                  "span",
                  { style: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase" } },
                  item.spec
                )
              ),
              h(
                "div",
                { style: { fontSize: "12px", fontWeight: "600", color: "#f8fafc", lineHeight: "1.35" } },
                item.titulo
              ),
              h(
                "div",
                { style: { fontSize: "11px", color: "#9ca3af", lineHeight: "1.4" } },
                item.causaRaiz
              ),
              item.arquivosAlterados &&
                item.arquivosAlterados.length > 0 &&
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                  ...item.arquivosAlterados.slice(0, 4).map((f) =>
                    h(
                      "span",
                      {
                        key: f,
                        style: {
                          fontSize: "10px",
                          fontFamily: "monospace",
                          color: "#cbd5e1",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        },
                      },
                      f
                    )
                  )
                ),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginTop: "4px",
                    paddingTop: "8px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  },
                },
                h(
                  "button",
                  {
                    onClick: () => onCopyLink(item),
                    style: {
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(56,189,248,0.35)",
                      backgroundColor: "rgba(56,189,248,0.12)",
                      color: "#38bdf8",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                    },
                  },
                  copiedId === item.issueId ? "Deep-Link Copiado!" : "Copiar Deep-Link"
                ),
                h(
                  "button",
                  {
                    onClick: () => onReopenFollowUp(item),
                    style: {
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(245,158,11,0.35)",
                      backgroundColor: "rgba(245,158,11,0.12)",
                      color: "#fbbf24",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                    },
                  },
                  "Reabrir / Follow-up"
                )
              )
            )
          )
        )
  );
}
