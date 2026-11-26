// ─────────────────────────────────────────────────────────────────────────────
// ORGFY MESSAGE ACTION MODAL (ONDA 3 — ctx.conversation.registerMessageAction)
// Lê o contexto real da mensagem clicada no chat do Buzz e oferece:
// 1. Abrir diretamente a Issue ou PR citado no Buzz Repos (1 salto)
// 2. Criar um Card OrgFy schema-first pré-preenchido a partir da mensagem
// 3. Disparar Gate (aceito / recusado) quando a mensagem referencia um PR/Issue
// 4. Abrir a OrgFy Factory mantendo o visual 100% nativo do tema do Buzz
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import {
  openBuzzRepoEntity,
  resolveBuzzIdentityName,
  DEFAULT_ORGFY_REPO_OWNER,
} from "../services/buzz-repos-live";
import { createCanonicalCard } from "../services/card-creator";
import { executeGate } from "../services/orgfy-bridge";

export interface ParsedMessageOrgfyContext {
  messageId: string;
  channelId: string;
  authorId: string;
  excerpt: string;
  suggestedTitle: string;
  citedEntity: {
    type: "issue" | "pr";
    id: string;
    owner: string;
    dtag: string;
  } | null;
  citedSlug: string | null;
  hasGateKeyword: boolean;
  hasDecidedKeyword: boolean;
}

/**
 * Extrai de forma determinística entidades OrgFy/NIP-34 de uma mensagem do chat.
 */
export function parseOrgfyMessageContext(message: any): ParsedMessageOrgfyContext {
  const content = String(message?.content || "").trim();
  const firstLine =
    content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "Nova tarefa via chat";

  const cleanTitle = firstLine
    .replace(/^#+\s*/, "")
    .replace(/`+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim()
    .slice(0, 110);

  // 1. Deep link explícito buzz://issue ou buzz://pr
  let citedEntity: ParsedMessageOrgfyContext["citedEntity"] = null;
  const deepLinkMatch = /buzz:\/\/(issue|pr)\?([^\s)>\]"']+)/i.exec(content);
  if (deepLinkMatch) {
    const type = deepLinkMatch[1].toLowerCase() as "issue" | "pr";
    const qs = new URLSearchParams(deepLinkMatch[2]);
    const id = (qs.get("id") || "").toLowerCase().trim();
    const owner = (qs.get("owner") || DEFAULT_ORGFY_REPO_OWNER).toLowerCase().trim();
    const dtag = (qs.get("d") || "orgfy").trim() || "orgfy";
    if (/^[0-9a-f]{64}$/i.test(id)) {
      citedEntity = { type, id, owner, dtag };
    }
  }

  // 2. Fallback para menção de PR/Issue com ID hex de 64 caracteres
  if (!citedEntity) {
    const prHex = /\bPR\b[^0-9a-f]{0,12}([0-9a-f]{64})\b/i.exec(content);
    const issueHex = /\b(?:issue|card)\b[^0-9a-f]{0,12}([0-9a-f]{64})\b/i.exec(content);
    const anyHex = /\b([0-9a-f]{64})\b/i.exec(content);
    if (prHex) {
      citedEntity = {
        type: "pr",
        id: prHex[1].toLowerCase(),
        owner: DEFAULT_ORGFY_REPO_OWNER,
        dtag: "orgfy",
      };
    } else if (issueHex || anyHex) {
      citedEntity = {
        type: "issue",
        id: (issueHex ? issueHex[1] : anyHex![1]).toLowerCase(),
        owner: DEFAULT_ORGFY_REPO_OWNER,
        dtag: "orgfy",
      };
    }
  }

  // 3. Slug de card canônico (SPEC-XXXX-TXXX, ESTEIRA-XXXX, PMBOK-XX)
  const slugMatch = /\b((?:SPEC|ESTEIRA|PMBOK|OPS|SEC)-\d{1,4}(?:[- ]T\d{3})?)\b/i.exec(content);
  const citedSlug = slugMatch ? slugMatch[1].replace(/\s+/g, "-").toUpperCase() : null;

  return {
    messageId: String(message?.id || ""),
    channelId: String(message?.channelId || ""),
    authorId: String(message?.authorId || ""),
    excerpt: content.slice(0, 280),
    suggestedTitle: cleanTitle || "Card via mensagem do Buzz",
    citedEntity,
    citedSlug,
    hasGateKeyword: /\b(?:GATE|PR|ENTREGUE_PARA_REVISAO|REVISAO|REVISÃO)\b/i.test(content),
    hasDecidedKeyword: /\bDECIDIDO\b/i.test(content),
  };
}

export function createOrgfyMessageActionComponent(ctx: Context | any) {
  const React = ctx?.react;
  if (!React) return () => null;
  const h = React.createElement;

  return function OrgfyMessageActionModal(props: {
    message: any;
    session: any;
    close: () => void;
    canOpen?: (target: string) => boolean;
    open?: (target: string) => boolean;
  }) {
    const parsed = React.useMemo(() => parseOrgfyMessageContext(props?.message), [props?.message]);
    const authorName = React.useMemo(
      () => resolveBuzzIdentityName(ctx, parsed.authorId),
      [parsed.authorId]
    );

    const [mode, setMode] = React.useState("menu" as "menu" | "card" | "gate");
    const [cardTitle, setCardTitle] = React.useState(parsed.suggestedTitle);
    const [cardExecutor, setCardExecutor] = React.useState("OrgFy Otto");
    const [cardRevisor, setCardRevisor] = React.useState("OrgFy Teo");
    const [cardPaths, setCardPaths] = React.useState("src/");
    const [cardAcceptance, setCardAcceptance] = React.useState("npm test");
    const [gateDecision, setGateDecision] = React.useState("aceito" as "aceito" | "recusado");
    const [gateReason, setGateReason] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [feedback, setFeedback] = React.useState(null as { ok: boolean; text: string } | null);

    React.useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") props?.close?.();
      };
      if (typeof window !== "undefined") {
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }
      return undefined;
    }, [props?.close]);

    const handleOpenCited = async () => {
      if (!parsed.citedEntity) return;
      setBusy(true);
      try {
        const ok = await openBuzzRepoEntity(ctx, parsed.citedEntity);
        if (ok) {
          props?.close?.();
        } else {
          setFeedback({ ok: false, text: "Não foi possível navegar para a entidade no Buzz Repos." });
        }
      } finally {
        setBusy(false);
      }
    };

    const handleOpenFactory = () => {
      try {
        if (ctx?.navigation?.open) {
          ctx.navigation.open({
            version: 1,
            kind: "page",
            pluginId: "digital.cortexx.orgfy",
            pageId: "orgfy",
          });
        } else if (ctx?.navigation?.navigate) {
          ctx.navigation.navigate("orgfy");
        }
      } catch {}
      props?.close?.();
    };

    const handleCreateCard = async () => {
      if (!cardTitle.trim()) {
        setFeedback({ ok: false, text: "Informe um título para o card." });
        return;
      }
      setBusy(true);
      setFeedback(null);
      try {
        const slug =
          parsed.citedSlug ||
          `CHAT-${(parsed.messageId || String(Date.now())).slice(0, 8).toUpperCase()}`;
        const paths = cardPaths
          .split(/[,;]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        const res = await createCanonicalCard(ctx, {
          slug,
          titulo: cardTitle.trim(),
          objetivo: parsed.excerpt || cardTitle.trim(),
          autoridade: `Mensagem Buzz ${parsed.messageId.slice(0, 8)} (${authorName})`,
          decisao: parsed.hasDecidedKeyword
            ? `DECIDIDO em mensagem ${parsed.messageId.slice(0, 8)}`
            : `Solicitado por ${authorName} no canal ${parsed.channelId.slice(0, 8)}`,
          executor: cardExecutor.trim(),
          revisor: cardRevisor.trim(),
          escrita_exclusiva: paths.length > 0 ? paths : ["src/"],
          feito_quando: `Comando de aceite passa com exit 0 (${cardAcceptance.trim() || "npm test"})`,
          acceptance_command: cardAcceptance.trim() || "npm test",
        });
        if (!res.ok) {
          setFeedback({ ok: false, text: (res as any).message || (res as any).error || "Falha ao validar card (verifique regra L-01)." });
        } else {
          setFeedback({
            ok: true,
            text: `Card ${res.slug} gerado (SHA L-22: ${res.acceptanceHashSha256.slice(0, 12)}). Comando de publicação pronto.`,
          });
          try {
            ctx?.notifications?.notify?.({
              title: "OrgFy · Card gerado",
              body: `${res.slug} pronto para publicação (${cardExecutor} -> ${cardRevisor}).`,
            });
          } catch {}
        }
      } catch (err: any) {
        setFeedback({ ok: false, text: String(err?.message || err) });
      } finally {
        setBusy(false);
      }
    };

    const handleTriggerGate = async () => {
      if (!parsed.citedEntity) return;
      if (gateDecision === "recusado" && !gateReason.trim()) {
        setFeedback({ ok: false, text: "Informe o motivo da recusa do Gate." });
        return;
      }
      setBusy(true);
      setFeedback(null);
      try {
        const res = await executeGate(ctx, {
          empresa: parsed.citedEntity.dtag || "orgfy",
          prId: parsed.citedEntity.id,
          acao: gateDecision,
          revisor: authorName || "OrgFy Teo",
          motivo:
            gateReason.trim() ||
            `Gate ${gateDecision} disparado a partir da mensagem ${parsed.messageId.slice(0, 8)}`,
        });
        setFeedback({
          ok: res.code === 0,
          text:
            res.code === 0
              ? `Gate ${gateDecision.toUpperCase()} registrado para #${parsed.citedEntity.id.slice(0, 8)}.`
              : `Gate retornou código ${res.code}: ${(res.output || "").slice(0, 140)}`,
        });
      } catch (err: any) {
        setFeedback({ ok: false, text: String(err?.message || err) });
      } finally {
        setBusy(false);
      }
    };

    const fieldStyle = {
      width: "100%",
      padding: "7px 10px",
      borderRadius: "6px",
      border: "1px solid var(--border-primary, rgba(255,255,255,0.14))",
      background: "var(--surface-inset, rgba(0,0,0,0.22))",
      color: "var(--text-primary, #f4f4f5)",
      fontSize: "12.5px",
      boxSizing: "border-box" as const,
      outline: "none",
    };

    const actionRowStyle = {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      padding: "9px 12px",
      borderRadius: "8px",
      border: "1px solid var(--border-primary, rgba(255,255,255,0.1))",
      background: "var(--affordance-subtle, rgba(255,255,255,0.04))",
      color: "var(--text-primary, #f4f4f5)",
      fontSize: "12.5px",
      fontWeight: 500,
      cursor: "pointer",
      textAlign: "left" as const,
    };

    return h(
      "div",
      {
        "data-orgfy-message-action-modal": "true",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Ações OrgFy na mensagem",
        onClick: (e: any) => {
          if (e.target === e.currentTarget) props?.close?.();
        },
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0, 0, 0, 0.48)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        },
      },
      h(
        "div",
        {
          style: {
            width: "min(460px, 100%)",
            background: "var(--bg-panel, #18181b)",
            border: "1px solid var(--border-primary, rgba(255,255,255,0.14))",
            borderRadius: "12px",
            boxShadow: "0 18px 42px rgba(0,0,0,0.45)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            color: "var(--text-primary, #f4f4f5)",
          },
        },
        // Header
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            },
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "2px" } },
            h("span", { style: { fontSize: "14px", fontWeight: 600 } }, "Ações OrgFy"),
            h(
              "span",
              { style: { fontSize: "11.5px", color: "var(--text-subtle, #a1a1aa)" } },
              `Mensagem de ${authorName}${parsed.citedSlug ? ` · ${parsed.citedSlug}` : ""}${
                parsed.citedEntity
                  ? ` · ${parsed.citedEntity.type.toUpperCase()} #${parsed.citedEntity.id.slice(0, 8)}`
                  : ""
              }`
            )
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => props?.close?.(),
              "aria-label": "Fechar",
              style: {
                background: "transparent",
                border: "none",
                color: "var(--text-subtle, #a1a1aa)",
                cursor: "pointer",
                fontSize: "16px",
                padding: "4px 6px",
                lineHeight: 1,
              },
            },
            "×"
          )
        ),

        // Context excerpt
        parsed.excerpt &&
          h(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderRadius: "8px",
                background: "var(--surface-inset, rgba(0,0,0,0.22))",
                border: "1px solid var(--border-primary, rgba(255,255,255,0.08))",
                fontSize: "12px",
                color: "var(--text-subtle, #a1a1aa)",
                maxHeight: "76px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              },
            },
            parsed.excerpt
          ),

        // Feedback banner
        feedback &&
          h(
            "div",
            {
              role: "status",
              style: {
                padding: "8px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                background: feedback.ok
                  ? "rgba(16, 185, 129, 0.14)"
                  : "rgba(239, 68, 68, 0.14)",
                border: `1px solid ${
                  feedback.ok ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"
                }`,
                color: feedback.ok ? "var(--green-11, #34d399)" : "var(--red-11, #f87171)",
              },
            },
            feedback.text
          ),

        // Mode: Menu principal
        mode === "menu" &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            parsed.citedEntity &&
              h(
                "button",
                {
                  type: "button",
                  disabled: busy,
                  onClick: handleOpenCited,
                  style: actionRowStyle,
                },
                h(
                  "span",
                  null,
                  `Abrir ${parsed.citedEntity.type === "pr" ? "PR" : "Issue"} #${parsed.citedEntity.id.slice(
                    0,
                    8
                  )} no Buzz Repos`
                ),
                h("span", { style: { color: "var(--text-subtle, #a1a1aa)", fontSize: "11px" } }, "1 salto ↗")
              ),
            h(
              "button",
              {
                type: "button",
                disabled: busy,
                onClick: () => {
                  setFeedback(null);
                  setMode("card");
                },
                style: actionRowStyle,
              },
              h("span", null, "Criar Card OrgFy a partir desta mensagem"),
              h("span", { style: { color: "var(--text-subtle, #a1a1aa)", fontSize: "11px" } }, "L-01 / L-22 →")
            ),
            parsed.citedEntity &&
              h(
                "button",
                {
                  type: "button",
                  disabled: busy,
                  onClick: () => {
                    setFeedback(null);
                    setMode("gate");
                  },
                  style: actionRowStyle,
                },
                h(
                  "span",
                  null,
                  `Disparar Gate para #${parsed.citedEntity.id.slice(0, 8)}`
                ),
                h("span", { style: { color: "var(--text-subtle, #a1a1aa)", fontSize: "11px" } }, "Aceitar / Recusar →")
              ),
            h(
              "button",
              {
                type: "button",
                disabled: busy,
                onClick: handleOpenFactory,
                style: actionRowStyle,
              },
              h("span", null, "Abrir OrgFy Factory"),
              h("span", { style: { color: "var(--text-subtle, #a1a1aa)", fontSize: "11px" } }, "↗")
            )
          ),

        // Mode: Criar Card
        mode === "card" &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h("input", {
              type: "text",
              value: cardTitle,
              onChange: (e: any) => setCardTitle(e.target.value),
              placeholder: "Título do card",
              style: fieldStyle,
            }),
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
              h("input", {
                type: "text",
                value: cardExecutor,
                onChange: (e: any) => setCardExecutor(e.target.value),
                placeholder: "Executor (ex: OrgFy Otto)",
                style: fieldStyle,
              }),
              h("input", {
                type: "text",
                value: cardRevisor,
                onChange: (e: any) => setCardRevisor(e.target.value),
                placeholder: "Revisor L-01 (ex: OrgFy Teo)",
                style: fieldStyle,
              })
            ),
            h("input", {
              type: "text",
              value: cardPaths,
              onChange: (e: any) => setCardPaths(e.target.value),
              placeholder: "Escrita exclusiva (separada por vírgula)",
              style: fieldStyle,
            }),
            h("input", {
              type: "text",
              value: cardAcceptance,
              onChange: (e: any) => setCardAcceptance(e.target.value),
              placeholder: "Comando de aceite L-22 (ex: npm test)",
              style: fieldStyle,
            }),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "4px" } },
              h(
                "button",
                {
                  type: "button",
                  onClick: () => setMode("menu"),
                  style: { ...actionRowStyle, width: "auto", padding: "7px 12px" },
                },
                "← Voltar"
              ),
              h(
                "button",
                {
                  type: "button",
                  disabled: busy,
                  onClick: handleCreateCard,
                  style: {
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--accent-primary, #10b981)",
                    color: "#09090b",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: busy ? "wait" : "pointer",
                  },
                },
                busy ? "Gerando..." : "Gerar Card Canônico"
              )
            )
          ),

        // Mode: Disparar Gate
        mode === "gate" &&
          parsed.citedEntity &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h(
              "div",
              { style: { display: "flex", gap: "8px" } },
              (["aceito", "recusado"] as const).map((dec) =>
                h(
                  "button",
                  {
                    key: dec,
                    type: "button",
                    onClick: () => setGateDecision(dec),
                    style: {
                      flex: 1,
                      padding: "7px 10px",
                      borderRadius: "7px",
                      border:
                        gateDecision === dec
                          ? "1px solid var(--accent-primary, #10b981)"
                          : "1px solid var(--border-primary, rgba(255,255,255,0.12))",
                      background:
                        gateDecision === dec
                          ? "var(--affordance-selected, rgba(16,185,129,0.16))"
                          : "transparent",
                      color: "var(--text-primary, #f4f4f5)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    },
                  },
                  dec === "aceito" ? "GATE: Aceito" : "GATE: Recusado"
                )
              )
            ),
            h("textarea", {
              rows: 3,
              value: gateReason,
              onChange: (e: any) => setGateReason(e.target.value),
              placeholder:
                gateDecision === "aceito"
                  ? "Observação opcional (ex: L-22 validado com exit 0)"
                  : "Motivo obrigatório da recusa",
              style: { ...fieldStyle, resize: "vertical" as const },
            }),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "4px" } },
              h(
                "button",
                {
                  type: "button",
                  onClick: () => setMode("menu"),
                  style: { ...actionRowStyle, width: "auto", padding: "7px 12px" },
                },
                "← Voltar"
              ),
              h(
                "button",
                {
                  type: "button",
                  disabled: busy,
                  onClick: handleTriggerGate,
                  style: {
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--accent-primary, #10b981)",
                    color: "#09090b",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: busy ? "wait" : "pointer",
                  },
                },
                busy ? "Enviando..." : "Confirmar Gate"
              )
            )
          )
      )
    );
  };
}
