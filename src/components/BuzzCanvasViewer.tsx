// Renderizador e Editor nativo de Canvas do Buzz dentro do plugin OrgFy:
// Espelha 1:1 a experiência nativa do Buzz Canvas (View | Edit | History),
// renderizando Markdown (títulos, blockquotes, tabelas GFM, código inline, listas e links buzz://)
// com as variáveis CSS do tema do Buzz e salvando direto via session.canvas.save().

import type { BuzzCanvasHistoryEntry } from "../factory/buzz-live-telemetry";

export interface BuzzCanvasViewerProps {
  h: any;
  tenant: string;
  channelName?: string;
  channelId?: string | null;
  content: string | null;
  draft: string;
  onChangeDraft: (v: string) => void;
  writable: boolean;
  saving: boolean;
  onSave: () => void;
  onReload?: () => void;
  history: BuzzCanvasHistoryEntry[];
  resolveAuthor?: (pubkey: string) => string;
  mode: "view" | "edit" | "history";
  onChangeMode: (m: "view" | "edit" | "history") => void;
  onOpenBuzzLink?: (href: string) => void;
  onOpenChannelInBuzz?: () => void;
}

function renderInlineMarkdown(h: any, text: string, onOpenBuzzLink?: (href: string) => void): any[] {
  const nodes: any[] = [];
  // Tokeniza links [label](url), inline code `code` e bold **text**
  const regex = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("[")) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (m) {
        const [, label, href] = m;
        const isBuzz = /^buzz:\/\//i.test(href);
        nodes.push(
          h(
            "a",
            {
              key: `lnk-${keyIdx++}`,
              href: isBuzz ? "#" : href,
              target: isBuzz ? undefined : "_blank",
              rel: isBuzz ? undefined : "noreferrer",
              style: {
                color: "var(--primary)",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
                cursor: "pointer",
              },
              onClick: (e: any) => {
                if (isBuzz) {
                  e.preventDefault();
                  onOpenBuzzLink?.(href);
                }
              },
            },
            label
          )
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("`")) {
      nodes.push(
        h(
          "code",
          {
            key: `code-${keyIdx++}`,
            className: "of-mono",
            style: {
              fontSize: "0.9em",
              padding: "1px 5px",
              borderRadius: "4px",
              background: "var(--muted)",
              border: "1px solid var(--border)",
            },
          },
          token.slice(1, -1)
        )
      );
    } else if (token.startsWith("**")) {
      nodes.push(h("strong", { key: `b-${keyIdx++}`, style: { fontWeight: 700, color: "var(--foreground)" } }, token.slice(2, -2)));
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderMarkdownBlocks(h: any, markdown: string, onOpenBuzzLink?: (href: string) => void): any[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: any[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        h(
          "pre",
          {
            key: `pre-${blockKey++}`,
            className: "of-mono",
            style: {
              margin: "6px 0",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "var(--muted)",
              border: "1px solid var(--border)",
              fontSize: "11.5px",
              overflowX: "auto",
              lineHeight: 1.5,
            },
          },
          codeLines.join("\n")
        )
      );
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? "20px" : level === 2 ? "15.5px" : level === 3 ? "13.5px" : "12.5px";
      blocks.push(
        h(
          `h${level}`,
          {
            key: `h-${blockKey++}`,
            style: {
              margin: level === 1 ? "4px 0 10px" : "14px 0 6px",
              fontSize,
              fontWeight: 700,
              lineHeight: 1.3,
              color: "var(--foreground)",
              letterSpacing: level === 1 ? "-0.015em" : undefined,
            },
          },
          ...renderInlineMarkdown(h, headingMatch[2], onOpenBuzzLink)
        )
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        h(
          "blockquote",
          {
            key: `bq-${blockKey++}`,
            style: {
              margin: "8px 0",
              padding: "6px 12px",
              borderLeft: "3px solid var(--border)",
              color: "var(--muted-foreground)",
              fontSize: "12.5px",
              lineHeight: 1.55,
            },
          },
          ...renderInlineMarkdown(h, quoteLines.join(" "), onOpenBuzzLink)
        )
      );
      continue;
    }

    // GFM Table
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|?[\s:-]+\|/.test(lines[i + 1].trim())) {
      const parseCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

      const headers = parseCells(lines[i]);
      i += 2; // Pula linha separadora |---|---|
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseCells(lines[i]));
        i += 1;
      }
      blocks.push(
        h(
          "div",
          {
            key: `tbl-${blockKey++}`,
            style: {
              margin: "8px 0",
              overflowX: "auto",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            },
          },
          h(
            "table",
            { className: "of-table", style: { margin: 0, minWidth: "420px" } },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                headers.map((col, idx) => h("th", { key: idx, style: { whiteSpace: "nowrap" } }, col))
              )
            ),
            h(
              "tbody",
              null,
              rows.map((r, rIdx) =>
                h(
                  "tr",
                  { key: rIdx },
                  r.map((cell, cIdx) =>
                    h("td", { key: cIdx, style: { fontSize: "12px", verticalAlign: "top" } }, ...renderInlineMarkdown(h, cell, onOpenBuzzLink))
                  )
                )
              )
            )
          )
        )
      );
      continue;
    }

    // Bullet list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        h(
          "ul",
          {
            key: `ul-${blockKey++}`,
            style: { margin: "6px 0", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", lineHeight: 1.5 },
          },
          items.map((it, idx) => h("li", { key: idx }, ...renderInlineMarkdown(h, it, onOpenBuzzLink)))
        )
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push(h("div", { key: `hr-${blockKey++}`, style: { height: "1px", background: "var(--border)", margin: "10px 0" } }));
      i += 1;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4}\s|```|>|\||[-*•]\s)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      h(
        "p",
        { key: `p-${blockKey++}`, style: { margin: "6px 0", fontSize: "12.5px", lineHeight: 1.55, color: "var(--foreground)" } },
        ...renderInlineMarkdown(h, paraLines.join(" "), onOpenBuzzLink)
      )
    );
  }

  return blocks;
}

export function renderBuzzCanvasViewer(props: BuzzCanvasViewerProps) {
  const { h, mode, onChangeMode, content, draft, onChangeDraft, writable, saving, onSave, onReload, history, resolveAuthor } = props;
  const effectiveContent = content || "";
  const isDirty = draft !== effectiveContent;

  return h(
    "section",
    {
      className: "of-card-pad",
      "data-buzz-canvas-native": "true",
      "data-canvas-live-editor": "true",
      style: { display: "flex", flexDirection: "column", gap: "12px" },
    },
    // Barra superior estilo Buzz Canvas (View | Edit | History + ações)
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          paddingBottom: "8px",
          borderBottom: "1px solid var(--border)",
        },
      },
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "14px", flexWrap: "wrap" } },
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
          ([
            { id: "view", label: "Visualizar" },
            { id: "edit", label: isDirty ? "Editar •" : "Editar" },
            { id: "history", label: `Histórico (${history.length})` },
          ] as const).map((t) =>
            h(
              "button",
              {
                key: t.id,
                type: "button",
                onClick: () => onChangeMode(t.id),
                style: {
                  background: "transparent",
                  border: "none",
                  borderBottom: mode === t.id ? "2px solid var(--foreground)" : "2px solid transparent",
                  color: mode === t.id ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: mode === t.id ? 600 : 500,
                  fontSize: "12.5px",
                  padding: "4px 6px 6px",
                  cursor: "pointer",
                },
              },
              t.label
            )
          )
        ),
        h(
          "span",
          { className: "of-mono of-muted", style: { fontSize: "10.5px" } },
          `Canvas · #${props.channelName || props.tenant}${props.channelId ? ` (${props.channelId.slice(0, 8)}…)` : ""}`
        )
      ),
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
        onReload &&
          h(
            "button",
            { type: "button", className: "of-btn", style: { padding: "4px 9px", fontSize: "11px" }, onClick: onReload },
            "Recarregar"
          ),
        mode === "edit" &&
          writable &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "primary",
              disabled: saving || !isDirty,
              style: { padding: "4px 10px", fontSize: "11px" },
              onClick: onSave,
            },
            saving ? "Salvando..." : "Salvar no Buzz"
          ),
        props.onOpenChannelInBuzz &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { padding: "4px 9px", fontSize: "11px" },
              onClick: props.onOpenChannelInBuzz,
            },
            "Abrir no Buzz ↗"
          )
      )
    ),

    // Conteúdo por modo
    mode === "view"
      ? effectiveContent.trim()
        ? h(
            "div",
            {
              style: {
                maxHeight: "520px",
                overflowY: "auto",
                padding: "4px 2px",
              },
            },
            ...renderMarkdownBlocks(h, effectiveContent, props.onOpenBuzzLink)
          )
        : h(
            "div",
            { className: "of-surface", style: { padding: "18px", textAlign: "center" } },
            h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "Canvas vazio neste canal"),
            h("div", { className: "of-muted", style: { marginTop: "4px", fontSize: "11.5px" } }, "Clique em Editar para criar o Canvas sincronizado diretamente no canal do Buzz.")
          )
      : mode === "edit"
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          h("textarea", {
            className: "of-textarea of-mono",
            style: { minHeight: "340px", fontSize: "12px", lineHeight: 1.5, resize: "vertical" },
            placeholder: "Escreva o Markdown do Canvas do canal no Buzz...",
            value: draft,
            onChange: (e: any) => onChangeDraft(e.target.value),
          }),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
            h(
              "span",
              { className: "of-muted", style: { fontSize: "11px" } },
              writable
                ? `${draft.length} caracteres · sincronizado em tempo real via session.canvas.save()`
                : "Modo somente leitura neste canal (session.canvas.save indisponível)."
            ),
            h(
              "div",
              { style: { display: "inline-flex", gap: "6px" } },
              isDirty &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    style: { padding: "4px 9px", fontSize: "11px" },
                    onClick: () => onChangeDraft(effectiveContent),
                  },
                  "Descartar alterações"
                ),
              writable &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    disabled: saving || !isDirty,
                    style: { padding: "4px 10px", fontSize: "11px" },
                    onClick: onSave,
                  },
                  saving ? "Salvando no Buzz..." : "Salvar Canvas no Buzz"
                )
            )
          )
        )
      : // History mode
        history.length === 0
        ? h("div", { className: "of-muted", style: { padding: "14px 4px", fontSize: "12px" } }, "Nenhuma revisão anterior encontrada via session.canvas.history().")
        : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "420px", overflowY: "auto" } },
            history.map((rev, idx) =>
              h(
                "div",
                {
                  key: rev.id || String(idx),
                  className: "of-surface",
                  style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
                  h(
                    "div",
                    { style: { fontSize: "12px" } },
                    h("strong", null, resolveAuthor ? resolveAuthor(rev.authorPubkey) : rev.authorPubkey.slice(0, 10)),
                    h(
                      "span",
                      { className: "of-muted", style: { marginLeft: "6px", fontSize: "11px" } },
                      rev.createdAt ? new Date(rev.createdAt).toLocaleString("pt-BR") : ""
                    ),
                    idx === 0 && h("span", { className: "of-pill", "data-tone": "done", style: { marginLeft: "6px" } }, "Atual")
                  ),
                  writable &&
                    rev.fullContent !== undefined &&
                    idx > 0 &&
                    h(
                      "button",
                      {
                        type: "button",
                        className: "of-btn",
                        style: { padding: "3px 8px", fontSize: "10.5px" },
                        onClick: () => {
                          onChangeDraft(rev.fullContent || "");
                          onChangeMode("edit");
                        },
                      },
                      "Restaurar no editor"
                    )
                ),
                h(
                  "div",
                  { className: "of-muted", style: { fontSize: "11.5px", lineHeight: 1.45 } },
                  rev.preview || "(sem conteúdo)"
                )
              )
            )
          )
  );
}
