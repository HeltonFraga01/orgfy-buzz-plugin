// ─────────────────────────────────────────────────────────────────────────────
// ORGFY COMPOSER PICKER (ONDA 3 — ctx.conversation.registerTool)
// Picker nativo no composer do Buzz para inserir Cards, Issues, PRs, Specs e
// templates de Gate diretamente na mensagem usando `insertResource` / `insertText`.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import {
  loadLiveRepoSnapshot,
  DEFAULT_ORGFY_REPO_OWNER,
} from "../services/buzz-repos-live";
import { fetchLiveKanbanCards } from "../services/orgfy-bridge";

export type ComposerPickerCategory = "all" | "repos" | "cards" | "gates";

export interface OrgfyPickerEntry {
  id: string;
  category: Exclude<ComposerPickerCategory, "all">;
  badge: string;
  title: string;
  subtitle: string;
  resource?: { uri: string; label: string };
  insertText: string;
}

export const ORGFY_GATE_SNIPPETS: readonly OrgfyPickerEntry[] = [
  {
    id: "snippet-gate-aceito",
    category: "gates",
    badge: "GATE",
    title: "GATE: aceito (L-01 / L-22)",
    subtitle: "Template canônico de aprovação após comando de aceite",
    insertText:
      "GATE: aceito — L-22 validado com exit 0, escopo respeitado e sem regressões. ",
  },
  {
    id: "snippet-gate-recusado",
    category: "gates",
    badge: "GATE",
    title: "GATE: recusado (devolução ao executor)",
    subtitle: "Devolve o PR com motivo objetivo e critério de correção",
    insertText:
      "GATE: recusado — Motivo: <descrever falha objetiva>. Correção exigida: <ajuste fechado + reexecutar L-22>. ",
  },
  {
    id: "snippet-decidido",
    category: "gates",
    badge: "SPEC",
    title: "DECIDIDO (Autoridade / Escopo Fechado)",
    subtitle: "Deliberação executiva para destravar card Z3/Z4",
    insertText:
      "DECIDIDO — Alvo: <1-3 arquivos> | Critério L-22: `<comando>` | Não refazer: <escopo preservado>. ",
  },
  {
    id: "snippet-bloqueado",
    category: "gates",
    badge: "ALERTA",
    title: "BLOQUEADO | por | motivo | falta | resolve",
    subtitle: "Sinalização padronizada de impedimento na esteira",
    insertText:
      "BLOQUEADO | por: <agente> | motivo: <causa objetiva> | falta: <insumo> | resolve: <próximo passo>. ",
  },
];

export function buildBuzzEntityUri(
  type: "issue" | "pr",
  id: string,
  owner: string = DEFAULT_ORGFY_REPO_OWNER,
  dtag: string = "orgfy"
): string {
  return `buzz://${type}?id=${id.toLowerCase()}&owner=${owner.toLowerCase()}&d=${encodeURIComponent(
    dtag || "orgfy"
  )}`;
}

export function insertOrgfyPickerEntry(
  entry: OrgfyPickerEntry,
  callbacks: {
    insertResource?: (resource: { uri: string; label: string }) => true | string;
    insertText?: (text: string) => boolean;
    focus?: () => void;
  }
): { ok: boolean; reason?: string } {
  if (entry.resource && typeof callbacks.insertResource === "function") {
    const res = callbacks.insertResource(entry.resource);
    if (res === true) {
      callbacks.focus?.();
      return { ok: true };
    }
    // Se o host rejeitar o recurso, cai suavemente para insertText com o link Markdown
    if (typeof callbacks.insertText === "function" && callbacks.insertText(entry.insertText)) {
      callbacks.focus?.();
      return { ok: true };
    }
    return { ok: false, reason: typeof res === "string" ? res : "Não foi possível inserir o recurso." };
  }

  if (typeof callbacks.insertText === "function") {
    const ok = callbacks.insertText(entry.insertText);
    if (ok) callbacks.focus?.();
    return { ok, ...(ok ? {} : { reason: "Composer indisponível para inserção." }) };
  }

  return { ok: false, reason: "Callbacks de inserção indisponíveis." };
}

export function createOrgfyComposerPickerComponent(ctx: Context | any) {
  const React = ctx?.react;
  if (!React) return () => null;
  const h = React.createElement;

  return function OrgfyComposerPicker(props: {
    session?: any;
    scope?: string;
    channelId?: string;
    disabled?: boolean;
    insertText?: (text: string) => boolean;
    insertResource?: (resource: { uri: string; label: string }) => true | string;
    focus?: () => void;
  }) {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [category, setCategory] = React.useState("all" as ComposerPickerCategory);
    const [entries, setEntries] = React.useState(() => [...ORGFY_GATE_SNIPPETS] as OrgfyPickerEntry[]);
    const [errorMsg, setErrorMsg] = React.useState(null as string | null);
    const containerRef = React.useRef(null as any);
    const searchRef = React.useRef(null as any);

    // Fecha automaticamente se o composer ficar desabilitado (padrão ResourcePicker oficial)
    React.useEffect(() => {
      if (props?.disabled && open) {
        setOpen(false);
      }
    }, [props?.disabled, open]);

    // Fecha ao clicar fora ou pressionar Escape
    React.useEffect(() => {
      if (!open || typeof document === "undefined") return;
      const onPointerDown = (ev: any) => {
        if (containerRef.current && !containerRef.current.contains(ev.target)) {
          setOpen(false);
        }
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          setOpen(false);
          props?.focus?.();
        }
      };
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [open, props?.focus]);

    // Carrega Issues/PRs NIP-34 ao vivo + Cards do Kanban ao abrir o popover
    React.useEffect(() => {
      if (!open) return;
      let cancelled = false;
      setLoading(true);
      setErrorMsg(null);

      setTimeout(() => {
        try {
          searchRef.current?.focus?.();
        } catch {}
      }, 20);

      Promise.all([
        loadLiveRepoSnapshot(ctx, { channelId: props?.channelId }).catch(() => null),
        fetchLiveKanbanCards(ctx, { empresa: "all" }).catch(() => []),
      ])
        .then(([repoSnap, cards]) => {
          if (cancelled) return;
          const next: OrgfyPickerEntry[] = [];
          const seenIds = new Set<string>();

          if (repoSnap?.available) {
            for (const pr of repoSnap.prs.slice(0, 20)) {
              const uri = buildBuzzEntityUri("pr", pr.id, pr.owner, pr.dtag);
              seenIds.add(pr.id);
              next.push({
                id: `pr-${pr.id}`,
                category: "repos",
                badge: "PR",
                title: pr.title,
                subtitle: `${pr.dtag} · #${pr.id.slice(0, 8)}`,
                resource: { uri, label: `PR: ${pr.title}` },
                insertText: `[PR: ${pr.title}](${uri}) `,
              });
            }
            for (const issue of repoSnap.issues.slice(0, 25)) {
              const uri = buildBuzzEntityUri("issue", issue.id, issue.owner, issue.dtag);
              seenIds.add(issue.id);
              next.push({
                id: `issue-${issue.id}`,
                category: "repos",
                badge: "ISSUE",
                title: issue.title,
                subtitle: `${issue.dtag} · #${issue.id.slice(0, 8)}`,
                resource: { uri, label: issue.title },
                insertText: `[${issue.title}](${uri}) `,
              });
            }
          }

          for (const card of (cards || []).slice(0, 30)) {
            const fullId =
              card.fullIssueId && /^[0-9a-f]{64}$/i.test(card.fullIssueId)
                ? card.fullIssueId.toLowerCase()
                : null;
            if (fullId && seenIds.has(fullId)) continue;
            const uri = fullId
              ? buildBuzzEntityUri("issue", fullId, card.owner || DEFAULT_ORGFY_REPO_OWNER, card.empresa || "orgfy")
              : undefined;
            next.push({
              id: `card-${card.id}`,
              category: "cards",
              badge: card.stage.toUpperCase(),
              title: card.title,
              subtitle: `${card.empresa || "orgfy"} · #${card.issueId} · ${card.executor || "sem executor"}`,
              ...(uri ? { resource: { uri, label: card.title } } : {}),
              insertText: uri
                ? `[${card.title}](${uri}) `
                : `Card #${card.issueId} — ${card.title} (${card.stage}) `,
            });
          }

          next.push(...ORGFY_GATE_SNIPPETS);
          setEntries(next);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [open, props?.channelId]);

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return entries.filter((item: OrgfyPickerEntry) => {
        if (category !== "all" && item.category !== category) return false;
        if (!q) return true;
        return `${item.title} ${item.subtitle} ${item.badge}`.toLowerCase().includes(q);
      });
    }, [entries, category, query]);

    const handleSelect = (item: OrgfyPickerEntry) => {
      const result = insertOrgfyPickerEntry(item, {
        insertResource: props?.insertResource,
        insertText: props?.insertText,
        focus: props?.focus,
      });
      if (result.ok) {
        setErrorMsg(null);
        setOpen(false);
      } else {
        setErrorMsg(result.reason || "Não foi possível inserir o item.");
      }
    };

    const tabs: Array<{ id: ComposerPickerCategory; label: string }> = [
      { id: "all", label: "Tudo" },
      { id: "repos", label: "Issues/PRs" },
      { id: "cards", label: "Cards" },
      { id: "gates", label: "Specs/Gates" },
    ];

    return h(
      "div",
      {
        ref: containerRef,
        "data-orgfy-composer-picker": "true",
        style: { position: "relative", display: "inline-flex", alignItems: "center" },
      },
      h(
        "button",
        {
          type: "button",
          disabled: Boolean(props?.disabled),
          "aria-label": "OrgFy: Inserir Card, Issue, PR, Spec ou Gate",
          "aria-expanded": open,
          title: "OrgFy · Cards, Issues, Specs e Gates",
          onClick: () => setOpen((v: boolean) => !v),
          style: {
            width: "28px",
            height: "28px",
            padding: 0,
            borderRadius: "6px",
            border: "none",
            background: open ? "var(--affordance-selected, rgba(255,255,255,0.12))" : "transparent",
            color: "var(--text-subtle, #a1a1aa)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: props?.disabled ? "not-allowed" : "pointer",
            opacity: props?.disabled ? 0.45 : 1,
          },
        },
        h(
          "svg",
          {
            viewBox: "0 0 24 24",
            width: 17,
            height: 17,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.85,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
          },
          h("polygon", { points: "12 2 20 6.5 20 17.5 12 22 4 17.5 4 6.5 12 2" }),
          h("polyline", { points: "4 6.5 12 11.5 20 6.5" }),
          h("line", { x1: 12, y1: 11.5, x2: 12, y2: 22 })
        )
      ),
      open &&
        h(
          "div",
          {
            role: "dialog",
            "aria-label": "Selecionar recurso OrgFy",
            style: {
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              width: "372px",
              maxWidth: "min(372px, 90vw)",
              maxHeight: "360px",
              zIndex: 80,
              background: "var(--bg-panel, #18181b)",
              border: "1px solid var(--border-primary, rgba(255,255,255,0.14))",
              borderRadius: "10px",
              boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              color: "var(--text-primary, #f4f4f5)",
            },
          },
          // Busca + abas
          h(
            "div",
            {
              style: {
                padding: "10px 10px 8px",
                borderBottom: "1px solid var(--border-primary, rgba(255,255,255,0.1))",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              },
            },
            h("input", {
              ref: searchRef,
              type: "text",
              value: query,
              onChange: (e: any) => setQuery(e.target.value),
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === "Enter" && filtered.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(filtered[0]);
                }
              },
              placeholder: "Buscar card, issue, PR, spec ou gate...",
              style: {
                width: "100%",
                padding: "6px 10px",
                borderRadius: "999px",
                border: "1px solid var(--border-primary, rgba(255,255,255,0.14))",
                background: "var(--surface-inset, rgba(0,0,0,0.22))",
                color: "var(--text-primary, #f4f4f5)",
                fontSize: "12px",
                outline: "none",
                boxSizing: "border-box",
              },
            }),
            h(
              "div",
              { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
              tabs.map((t) =>
                h(
                  "button",
                  {
                    key: t.id,
                    type: "button",
                    onClick: () => setCategory(t.id),
                    style: {
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "none",
                      background:
                        category === t.id
                          ? "var(--affordance-selected, rgba(255,255,255,0.14))"
                          : "transparent",
                      color:
                        category === t.id
                          ? "var(--text-primary, #f4f4f5)"
                          : "var(--text-subtle, #a1a1aa)",
                      fontSize: "11px",
                      fontWeight: category === t.id ? 600 : 400,
                      cursor: "pointer",
                    },
                  },
                  t.label
                )
              )
            )
          ),

          errorMsg &&
            h(
              "div",
              {
                role: "alert",
                style: {
                  padding: "6px 10px",
                  fontSize: "11.5px",
                  color: "var(--red-11, #f87171)",
                  borderBottom: "1px solid var(--border-primary, rgba(255,255,255,0.08))",
                },
              },
              errorMsg
            ),

          // Lista de resultados
          h(
            "div",
            {
              style: {
                flex: 1,
                overflowY: "auto",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              },
            },
            loading &&
              h(
                "div",
                {
                  style: {
                    padding: "10px",
                    fontSize: "11.5px",
                    color: "var(--text-subtle, #a1a1aa)",
                  },
                },
                "Carregando issues, PRs e cards..."
              ),
            filtered.length === 0 && !loading
              ? h(
                  "div",
                  {
                    style: {
                      padding: "14px 10px",
                      fontSize: "12px",
                      color: "var(--text-subtle, #a1a1aa)",
                      textAlign: "center",
                    },
                  },
                  "Nenhum item encontrado para esse filtro."
                )
              : filtered.map((item: OrgfyPickerEntry) =>
                  h(
                    "button",
                    {
                      key: item.id,
                      type: "button",
                      onClick: () => handleSelect(item),
                      style: {
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        padding: "7px 8px",
                        borderRadius: "7px",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-primary, #f4f4f5)",
                        cursor: "pointer",
                        textAlign: "left",
                      },
                    },
                    h(
                      "span",
                      {
                        style: {
                          flexShrink: 0,
                          marginTop: "2px",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontSize: "9.5px",
                          fontWeight: 700,
                          letterSpacing: "0.03em",
                          background: "var(--affordance-subtle, rgba(255,255,255,0.08))",
                          color: "var(--text-subtle, #a1a1aa)",
                        },
                      },
                      item.badge
                    ),
                    h(
                      "span",
                      {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          minWidth: 0,
                          gap: "1px",
                        },
                      },
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "12px",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        },
                        item.title
                      ),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "11px",
                            color: "var(--text-subtle, #a1a1aa)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        },
                        item.subtitle
                      )
                    )
                  )
                )
          )
        )
    );
  };
}
