// Onda 2 — Chat Vivo no Buzz (registerLink, registerLinkPreview, registerCodeBlock)
// Transforma links buzz://issue, buzz://pr e blocos ```orgfy-card``` no chat do Buzz em cards interativos.

import type { Context } from "@buzz/author";
import { parseOrgfyCardStructure } from "./CodeDenInspectorDrawer";
import { DEFAULT_ORGFY_REPO_OWNER, openBuzzRepoEntity } from "../services/buzz-repos-live";

export interface ParsedBuzzEntityLink {
  kind: "issue" | "pr";
  id: string;
  owner: string;
  dtag: string;
  url: string;
}

export function parseBuzzOrgfyEntityUrl(rawUrl: string): ParsedBuzzEntityLink | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol.toLowerCase() !== "buzz:") return null;
    const host = u.hostname.toLowerCase();
    if (host !== "issue" && host !== "pr") return null;
    const id = (u.searchParams.get("id") || "").trim();
    if (!id) return null;
    const owner = (u.searchParams.get("owner") || "").trim();
    const dtag = (u.searchParams.get("d") || "orgfy").trim();
    return { kind: host, id, owner, dtag, url: rawUrl };
  } catch {
    return null;
  }
}

export function registerOrgfyLiveChatRenderers(ctx: Context | any): {
  linkRegistered: boolean;
  linkPreviewRegistered: boolean;
  codeBlockRegistered: boolean;
} {
  const conv = ctx?.conversation;
  const React = ctx?.react;
  if (!conv || !React) {
    return { linkRegistered: false, linkPreviewRegistered: false, codeBlockRegistered: false };
  }
  const h = React.createElement;
  let linkRegistered = false;
  let linkPreviewRegistered = false;
  let codeBlockRegistered = false;

  // 1. registerLink: pílula inline clicável para buzz://issue e buzz://pr
  if (typeof conv.registerLink === "function") {
    try {
      conv.registerLink({
        id: "orgfy-entity-link",
        title: "OrgFy Issue / PR",
        matches: (url: string) => Boolean(parseBuzzOrgfyEntityUrl(url)),
        order: -1,
        component: ({ url }: { url: string }) => {
          const parsed = parseBuzzOrgfyEntityUrl(url);
          if (!parsed) return h("span", null, url);
          const isPr = parsed.kind === "pr";
          return h(
            "button",
            {
              type: "button",
              "data-orgfy-live-link": parsed.kind,
              onClick: (e: any) => {
                e?.preventDefault?.();
                e?.stopPropagation?.();
                void openBuzzRepoEntity(ctx, {
                  type: parsed.kind,
                  id: parsed.id,
                  owner: parsed.owner || DEFAULT_ORGFY_REPO_OWNER,
                  dtag: parsed.dtag,
                });
              },
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "1px 7px",
                borderRadius: "6px",
                border: `1px solid ${isPr ? "rgba(192,132,252,0.45)" : "rgba(61,214,140,0.4)"}`,
                background: isPr ? "rgba(192,132,252,0.12)" : "rgba(61,214,140,0.12)",
                color: isPr ? "#d8b4fe" : "#3dd68c",
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                cursor: "pointer",
                verticalAlign: "baseline",
              },
            },
            h("span", null, isPr ? "PR" : "Issue"),
            h("span", null, `#${parsed.id.slice(0, 8)}`),
            h("span", { style: { opacity: 0.75, fontSize: "10.5px" } }, `· ${parsed.dtag}`)
          );
        },
      });
      linkRegistered = true;
    } catch {}
  }

  // 2. registerLinkPreview: card rico abaixo de mensagens com buzz://issue ou buzz://pr
  if (typeof conv.registerLinkPreview === "function") {
    try {
      conv.registerLinkPreview({
        id: "orgfy-entity-preview",
        title: "OrgFy Card Preview",
        matches: (url: string) => Boolean(parseBuzzOrgfyEntityUrl(url)),
        order: -1,
        component: ({ url }: { url: string }) => {
          const parsed = parseBuzzOrgfyEntityUrl(url);
          if (!parsed) return null;
          const isPr = parsed.kind === "pr";
          return h(
            "div",
            {
              "data-orgfy-link-preview": parsed.kind,
              style: {
                marginTop: "6px",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.11)",
                background: "rgba(24,24,27,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                maxWidth: "460px",
              },
            },
            h(
              "div",
              { style: { minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" } },
                h(
                  "span",
                  {
                    style: {
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      fontSize: "10px",
                      fontWeight: 700,
                      background: isPr ? "rgba(192,132,252,0.18)" : "rgba(61,214,140,0.18)",
                      color: isPr ? "#d8b4fe" : "#3dd68c",
                    },
                  },
                  isPr ? "PULL REQUEST · NIP-34" : "ISSUE · NIP-34"
                ),
                h("span", { style: { fontFamily: "monospace", opacity: 0.7 } }, parsed.dtag)
              ),
              h("div", { style: { fontSize: "12.5px", fontWeight: 600, fontFamily: "monospace" } }, `#${parsed.id.slice(0, 12)}`)
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () =>
                  void openBuzzRepoEntity(ctx, {
                    type: parsed.kind,
                    id: parsed.id,
                    owner: parsed.owner || DEFAULT_ORGFY_REPO_OWNER,
                    dtag: parsed.dtag,
                  }),
                style: {
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f3f4f6",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                },
              },
              isPr ? "Revisar PR ↗" : "Abrir Issue ↗"
            )
          );
        },
      });
      linkPreviewRegistered = true;
    } catch {}
  }

  // 3. registerCodeBlock: renderiza blocos ```orgfy-card``` como contrato estruturado inline
  if (typeof conv.registerCodeBlock === "function") {
    try {
      conv.registerCodeBlock({
        id: "orgfy-card-block",
        title: "OrgFy Card",
        matches: (language: string) => /^(orgfy-card|orgfy:card)$/i.test(String(language || "").trim()),
        component: ({ code }: { code: string }) => {
          const card = parseOrgfyCardStructure(code || "");
          if (!card) {
            return h("pre", { style: { fontSize: "11.5px", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.28)", overflowX: "auto" } }, code);
          }
          const done = card.escopo.passos.filter((p) => p.done).length;
          return h(
            "div",
            {
              "data-orgfy-codeblock-card": "true",
              style: {
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(61,214,140,0.32)",
                background: "rgba(18,22,20,0.92)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "12px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
              h("strong", { style: { color: "#3dd68c", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" } }, "Contrato OrgFy Card"),
              card.escopo.passos.length > 0 &&
                h("span", { style: { fontFamily: "monospace", fontSize: "11px", opacity: 0.85 } }, `Checklist ${done}/${card.escopo.passos.length}`)
            ),
            card.objetivo && h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, card.objetivo),
            (card.papeis.executor || card.papeis.revisor) &&
              h(
                "div",
                { style: { display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "11px" } },
                card.papeis.executor && h("span", { style: { padding: "2px 7px", borderRadius: "6px", background: "rgba(255,255,255,0.06)" } }, `Executor: ${card.papeis.executor}`),
                card.papeis.revisor && h("span", { style: { padding: "2px 7px", borderRadius: "6px", background: "rgba(255,255,255,0.06)" } }, `Revisor L-01: ${card.papeis.revisor}`),
                card.papeis.tipo && h("span", { style: { padding: "2px 7px", borderRadius: "6px", background: "rgba(255,255,255,0.06)" } }, card.papeis.tipo)
              ),
            card.aceite.comandoAceite &&
              h("code", { style: { display: "block", padding: "5px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.35)", fontSize: "11px", fontFamily: "monospace" } }, `L-22: ${card.aceite.comandoAceite}`)
          );
        },
      });
      codeBlockRegistered = true;
    } catch {}
  }

  return { linkRegistered, linkPreviewRegistered, codeBlockRegistered };
}
