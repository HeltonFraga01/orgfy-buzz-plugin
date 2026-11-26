// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/inbox.tsx e components/question-card.tsx
// Question Cards estruturados no Inbox ("Aguardando você") sincronizados via OrgfyCrdtStore (ctx.artifactStorage.open)
// e conectados ao retorno ao vivo para o agente solicitante via ctx.agents.wake.

import type { Context } from "@buzz/author";
import type { CrdtBackendInfo, OrgfyQuestionCard, QuestionCardAnswer } from "../services/orgfy-crdt-store";

export interface QuestionCardsPanelProps {
  cards: OrgfyQuestionCard[];
  backendInfo?: CrdtBackendInfo;
  onAnswer: (card: OrgfyQuestionCard, answer: QuestionCardAnswer) => Promise<void> | void;
  onDismiss: (card: OrgfyQuestionCard) => Promise<void> | void;
}

function formatExpiryLabel(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Expirado";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `Expira em ${mins}m`;
  const hrs = Math.round(mins / 60);
  return `Expira em ${hrs}h`;
}

export function createQuestionCardsPanel(React: Context["react"]) {
  const h = React.createElement;

  return function QuestionCardsPanel(props: QuestionCardsPanelProps) {
    const { cards, backendInfo, onAnswer, onDismiss } = props;
    const [selectedByCard, setSelectedByCard] = React.useState<Record<string, string[]>>({});
    const [noteByCard, setNoteByCard] = React.useState<Record<string, string>>({});
    const [submittingId, setSubmittingId] = React.useState<string | null>(null);

    const pendingCards = cards.filter((c) => c.status === "pending");
    const resolvedCards = cards.filter((c) => c.status !== "pending").slice(0, 6);

    const toggleOption = (card: OrgfyQuestionCard, optionId: string) => {
      setSelectedByCard((prev: Record<string, string[]>) => {
        const cur = prev[card.id] || [];
        if (card.selectionMode === "single") {
          return { ...prev, [card.id]: [optionId] };
        }
        const exists = cur.includes(optionId);
        return {
          ...prev,
          [card.id]: exists ? cur.filter((x) => x !== optionId) : [...cur, optionId],
        };
      });
    };

    const handleSubmit = async (card: OrgfyQuestionCard) => {
      const selectedIds = selectedByCard[card.id] || [];
      const freeText = (noteByCard[card.id] || "").trim();
      if (selectedIds.length === 0 && !freeText) return;
      setSubmittingId(card.id);
      try {
        await onAnswer(card, {
          selectedIds,
          freeText: freeText || undefined,
          answeredBy: "Fundador",
        });
      } finally {
        setSubmittingId(null);
      }
    };

    if (cards.length === 0) return null;

    return h(
      "div",
      {
        "data-orgfy-question-cards": "true",
        style: { display: "flex", flexDirection: "column", gap: "10px" },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
          h("span", { style: { fontSize: "12.5px", fontWeight: 700 } }, `Question Cards (${pendingCards.length} pendente${pendingCards.length === 1 ? "" : "s"})`),
          backendInfo &&
            h(
              "span",
              {
                className: "of-pill",
                "data-tone": backendInfo.mode === "buzz_artifact_collection" ? "done" : "idle",
                title: backendInfo.scope
                  ? `Relay sync ativo: ${backendInfo.scope.relay}`
                  : "Sincronização local ativa (aguardando relay do Buzz)",
              },
              backendInfo.mode === "buzz_artifact_collection" ? "CRDT Sync · Buzz" : "Sync Local"
            )
        )
      ),

      pendingCards.map((card) => {
        const selected = selectedByCard[card.id] || [];
        const freeText = noteByCard[card.id] || "";
        const canSubmit = selected.length > 0 || freeText.trim().length > 0;
        const expiry = formatExpiryLabel(card.expiresAt);
        const busy = submittingId === card.id;

        return h(
          "div",
          {
            key: card.id,
            className: "of-card-pad",
            "data-question-card-id": card.id,
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              borderColor: "rgba(245, 158, 11, 0.45)",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" } },
            h(
              "div",
              null,
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "3px" } },
                h("span", { className: "of-pill", "data-tone": "waiting" }, card.requestedBy),
                h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px" } }, card.tenant),
                expiry && h("span", { className: "of-pill", "data-tone": expiry === "Expirado" ? "failed" : "idle" }, expiry)
              ),
              h("div", { style: { fontSize: "13.5px", fontWeight: 700, color: "var(--foreground)" } }, card.title)
            ),
            h(
              "span",
              { className: "of-mono of-muted", style: { fontSize: "10.5px", flexShrink: 0 } },
              card.selectionMode === "multi" ? "Múltipla escolha" : "Escolha única"
            )
          ),

          card.question &&
            h("div", { style: { fontSize: "12.5px", lineHeight: 1.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap" } }, card.question),

          card.options.length > 0 &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              card.options.map((opt) => {
                const isSelected = selected.includes(opt.id);
                return h(
                  "button",
                  {
                    key: opt.id,
                    type: "button",
                    onClick: () => toggleOption(card, opt.id),
                    style: {
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "9px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: isSelected ? "var(--primary-soft, rgba(16, 185, 129, 0.12))" : "var(--surface)",
                      color: "var(--foreground)",
                      textAlign: "left",
                      cursor: "pointer",
                    },
                  },
                  h(
                    "span",
                    {
                      style: {
                        width: "15px",
                        height: "15px",
                        marginTop: "1px",
                        borderRadius: card.selectionMode === "single" ? "9999px" : "4px",
                        border: isSelected ? "2px solid var(--primary)" : "1.5px solid var(--muted-foreground)",
                        background: isSelected ? "var(--primary)" : "transparent",
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        color: "#000",
                        fontWeight: 800,
                      },
                    },
                    isSelected ? "✓" : ""
                  ),
                  h(
                    "div",
                    { style: { minWidth: 0, flex: 1 } },
                    h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, opt.label),
                    opt.description && h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "2px" } }, opt.description)
                  )
                );
              })
            ),

          card.allowFreeText &&
            h("textarea", {
              className: "of-textarea",
              style: { minHeight: "52px", fontSize: "12px" },
              placeholder: "Observação ou diretriz adicional para o agente (opcional)...",
              value: freeText,
              onChange: (e: any) => setNoteByCard((prev: Record<string, string>) => ({ ...prev, [card.id]: e.target.value })),
            }),

          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" } },
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                disabled: busy,
                onClick: () => void onDismiss(card),
              },
              "Adiar"
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                disabled: !canSubmit || busy,
                onClick: () => void handleSubmit(card),
              },
              busy ? "Enviando..." : `Responder e acordar ${card.requestedBy} ↗`
            )
          )
        );
      }),

      resolvedCards.length > 0 &&
        h(
          "details",
          { style: { fontSize: "11.5px", color: "var(--muted-foreground)" } },
          h("summary", { style: { cursor: "pointer", userSelect: "none", padding: "4px 2px" } }, `Decisões recentes (${resolvedCards.length})`),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" } },
            resolvedCards.map((c) => {
              const chosenLabels = (c.answer?.selectedIds || [])
                .map((id) => c.options.find((o) => o.id === id)?.label || id)
                .join(", ");
              return h(
                "div",
                { key: c.id, className: "of-surface", style: { padding: "8px 10px", display: "flex", flexDirection: "column", gap: "3px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                  h("strong", { style: { fontSize: "12px", color: "var(--foreground)" } }, c.title),
                  h("span", { className: "of-pill", "data-tone": c.status === "answered" ? "done" : "idle" }, c.status === "answered" ? "Respondido" : c.status)
                ),
                (chosenLabels || c.answer?.freeText) &&
                  h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, [chosenLabels, c.answer?.freeText].filter(Boolean).join(" · "))
              );
            })
          )
        )
    );
  };
}
