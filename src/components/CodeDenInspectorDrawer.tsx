// ─────────────────────────────────────────────────────────────────────────────
// CODEDEN 1:1 RIGHT-SIDE INSPECTOR DRAWER (Diff | Arquivos | Issue / PR | Detalhes)
// Espelha 1:1 os componentes do CodeDen:
//   - workbench/right-panel.tsx (barra superior compacta com ícones + fechar ×)
//   - workbench/diff-panel.tsx (seletor de commit + diff unificado por arquivo com cores + / -)
//   - workbench/files-panel.tsx (árvore de arquivos colapsável + leitor com números de linha)
//   - workbench/github-panel.tsx + github/pr-details.tsx + github/pr-files.tsx (Pull Requests state-of-the-art)
//   - workbench/details-panel.tsx (metadados 2 colunas, janela de contexto + Compactar agora, Carregado no agente)
// 100% conectado às APIs oficiais do Buzz: session.repositories, session.projectGit, ctx.agents, ctx.navigation.open.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { FactoryWorkItem } from "../factory/factory-adapter";
import type { LiveAgentTurn } from "../factory/buzz-live-telemetry";
import type { LiveCrewAgent } from "../factory/FactoryBoardAndFloor";
import {
  type BuzzGitSnapshot,
  type LiveRepoEntityDetail,
  type LiveRepoItemSummary,
  type ParsedDiffFile,
  parseUnifiedDiff,
  readBuzzProjectGit,
} from "../services/buzz-repos-live";

export type InspectorTab = "diff" | "files" | "pr" | "details";

export interface CodeDenInspectorDrawerProps {
  ctx: Context | any;
  item: FactoryWorkItem | null;
  tenant: string;
  repoOwner?: string;
  repoDtag?: string;
  repoDetail?: LiveRepoEntityDetail | null;
  repoLoading?: boolean;
  linkedPr?: LiveRepoItemSummary | null;
  liveCrew?: LiveCrewAgent[];
  liveTurnsByPubkey?: Record<string, LiveAgentTurn>;
  resolveAuthor?: (pubkey: string) => string;
  EmbeddedThread?: any;
  threadChannelId?: string | null;
  relaySession?: any;
  relayScope?: string | null;
  onOpenInBuzz?: (item: FactoryWorkItem) => void;
  onOpenPrInBuzz?: (pr: LiveRepoItemSummary) => void;
  onOpenRepoPrsInBuzz?: () => void;
  onOpenCommitInBuzz?: (commit: string) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onSessionAction?: (agentKey: string, action: "interrupt" | "compact" | "new") => void;
  onToggleChecklistStep?: (stepId: string, nextDone: boolean, item: FactoryWorkItem) => void;
  onClose: () => void;
}

// ── INLINE LUCIDE-STYLE SVGS (1:1 CodeDen) ──
function Icon({ h, name, size = 14, color }: { h: any; name: string; size?: number; color?: string }) {
  const base = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0 },
    "aria-hidden": "true",
  };
  switch (name) {
    case "diff":
      return h("svg", base, h("path", { d: "M12 3v14" }), h("path", { d: "M5 10h14" }), h("path", { d: "M5 21h14" }));
    case "files":
      return h("svg", base, h("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }), h("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }));
    case "pr":
      return h("svg", base, h("circle", { cx: 18, cy: 18, r: 3 }), h("circle", { cx: 6, cy: 6, r: 3 }), h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }), h("line", { x1: 6, y1: 9, x2: 6, y2: 21 }));
    case "info":
      return h("svg", base, h("circle", { cx: 12, cy: 12, r: 10 }), h("path", { d: "M12 16v-4" }), h("path", { d: "M12 8h.01" }));
    case "close":
      return h("svg", base, h("path", { d: "M18 6 6 18" }), h("path", { d: "m6 6 12 12" }));
    case "chevron":
      return h("svg", base, h("path", { d: "m9 18 6-6-6-6" }));
    case "folder":
      return h("svg", base, h("path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }));
    case "fileCode":
      return h("svg", base, h("path", { d: "M10 12.5 8 15l2 2.5" }), h("path", { d: "m14 12.5 2 2.5-2 2.5" }), h("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }), h("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }));
    case "checkCircle":
      return h("svg", base, h("circle", { cx: 12, cy: 12, r: 10 }), h("path", { d: "m9 12 2 2 4-4" }));
    case "clock":
      return h("svg", base, h("circle", { cx: 12, cy: 12, r: 10 }), h("polyline", { points: "12 6 12 12 16 14" }));
    case "xCircle":
      return h("svg", base, h("circle", { cx: 12, cy: 12, r: 10 }), h("path", { d: "m15 9-6 6" }), h("path", { d: "m9 9 6 6" }));
    case "external":
      return h("svg", base, h("path", { d: "M15 3h6v6" }), h("path", { d: "M10 14 21 3" }), h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }));
    case "message":
      return h("svg", base, h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
    case "refresh":
      return h("svg", base, h("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }), h("path", { d: "M21 3v5h-5" }));
    case "compact":
      return h("svg", base, h("path", { d: "M12 22v-6" }), h("path", { d: "M12 8V2" }), h("path", { d: "M4 12H2" }), h("path", { d: "M10 12H8" }), h("path", { d: "M16 12h-2" }), h("path", { d: "M22 12h-2" }), h("path", { d: "m15 19-3-3-3 3" }), h("path", { d: "m15 5-3 3-3-3" }));
    case "plug":
      return h("svg", base, h("path", { d: "M12 22v-5" }), h("path", { d: "M9 8V2" }), h("path", { d: "M15 8V2" }), h("path", { d: "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" }));
    case "sparkles":
      return h("svg", base, h("path", { d: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" }));
    case "bot":
      return h("svg", base, h("path", { d: "M12 8V4H8" }), h("rect", { width: 16, height: 12, x: 4, y: 8, rx: 2 }), h("path", { d: "M2 14h2" }), h("path", { d: "M20 14h2" }), h("path", { d: "M15 13v2" }), h("path", { d: "M9 13v2" }));
    default:
      return null;
  }
}

interface TreeNodeData {
  name: string;
  path: string;
  kind: "dir" | "file";
  size?: number;
  children?: TreeNodeData[];
}

function buildFileTree(files: Array<{ path: string; size: number }>): TreeNodeData[] {
  const root: TreeNodeData[] = [];
  const dirMap = new Map<string, TreeNodeData>();

  const getOrCreateDir = (parts: string[]): TreeNodeData[] => {
    if (parts.length === 0) return root;
    const key = parts.join("/");
    const existing = dirMap.get(key);
    if (existing) return existing.children!;
    const parentList = getOrCreateDir(parts.slice(0, -1));
    const node: TreeNodeData = {
      name: parts[parts.length - 1],
      path: key,
      kind: "dir",
      children: [],
    };
    parentList.push(node);
    dirMap.set(key, node);
    return node.children!;
  };

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    const parentList = getOrCreateDir(parts.slice(0, -1));
    parentList.push({
      name: parts[parts.length - 1],
      path: f.path,
      kind: "file",
      size: f.size,
    });
  }

  const sortNodes = (list: TreeNodeData[]) => {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of list) {
      if (n.children) sortNodes(n.children);
    }
  };
  sortNodes(root);
  return root;
}

function cleanCardMarkdown(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*\n+/, "")
    .trim();
}

export interface OrgfyStructuredCard {
  objetivo: string;
  estado: {
    contexto?: string;
    autoridade?: string;
    decisao?: string;
  };
  papeis: {
    tipo?: string;
    executor?: string;
    revisor?: string;
    decisor?: string;
    workspace?: string;
    effort?: string;
    spec?: string;
  };
  escopo: {
    leitura: string[];
    escritaExclusiva: string[];
    passos: Array<{ id: string; text: string; done: boolean }>;
  };
  aceite: {
    feitoQuando?: string;
    comandoAceite?: string;
  };
}

export function parseOrgfyCardStructure(raw: string): OrgfyStructuredCard | null {
  const cleaned = cleanCardMarkdown(raw || "");
  if (!cleaned) return null;

  const pickField = (labelPattern: string): string | undefined => {
    const rx = new RegExp(`(?:^|\\n)\\s*(?:[-*•]\\s*)?(?:\\*\\*)?(?:${labelPattern})(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*(.+)`, "i");
    const m = rx.exec(cleaned);
    if (!m) return undefined;
    return m[1].replace(/\*\*/g, "").replace(/^`|`$/g, "").trim() || undefined;
  };

  const lines = cleaned.replace(/\r\n/g, "\n").split("\n");
  let currentSection = "intro";
  const introLines: string[] = [];
  const objetivoLines: string[] = [];
  const leitura: string[] = [];
  const escritaExclusiva: string[] = [];
  const passos: Array<{ id: string; text: string; done: boolean }> = [];
  let subListMode: "none" | "leitura" | "escrita" = "none";
  let comandoAceite: string | undefined;
  let feitoQuando: string | undefined;
  let inCodeBlock = false;
  const codeBlockLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        if (currentSection === "aceite" && !comandoAceite && codeBlockLines.length > 0) {
          comandoAceite = codeBlockLines.join("\n").trim();
        }
        codeBlockLines.length = 0;
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    const secMatch = /^#{1,4}\s+(.+)$/.exec(trimmed) || /^\*\*([^*]{2,40})\*\*$/.exec(trimmed);
    if (secMatch) {
      const heading = secMatch[1].toLowerCase();
      subListMode = "none";
      if (/objetivo/.test(heading)) currentSection = "objetivo";
      else if (/estado/.test(heading)) currentSection = "estado";
      else if (/pap[eé]is|ambiente/.test(heading)) currentSection = "papeis";
      else if (/escopo|plano|checklist|passos/.test(heading)) currentSection = "escopo";
      else if (/aceite|crit[eé]rio|l-22/.test(heading)) currentSection = "aceite";
      else currentSection = "other";
      continue;
    }

    const checkMatch = /^[-*•]\s*\[([ xX])\]\s*(?:(P\d+)\s*[:\-–]?\s*)?(.+)$/.exec(trimmed);
    if (checkMatch) {
      passos.push({
        id: checkMatch[2] || `P${passos.length + 1}`,
        done: checkMatch[1].toLowerCase() === "x",
        text: checkMatch[3].trim(),
      });
      continue;
    }

    if (/^(?:[-*•]\s*)?(?:\*\*)?escrita\s+exclusiva(?:\*\*)?\s*:/i.test(trimmed)) {
      subListMode = "escrita";
      const inlineVal = trimmed.replace(/^(?:[-*•]\s*)?(?:\*\*)?escrita\s+exclusiva(?:\*\*)?\s*:\s*(?:\*\*)?\s*/i, "").trim();
      if (inlineVal) {
        for (const p of inlineVal.split(/[,;]/)) {
          const cleanP = p.replace(/`/g, "").replace(/^\*\*\s*|\s*\*\*$/g, "").trim();
          if (cleanP) escritaExclusiva.push(cleanP);
        }
      }
      continue;
    }
    if (/^(?:[-*•]\s*)?(?:\*\*)?(?:leitura|arquivos\s+de\s+refer[eê]ncia)(?:\*\*)?\s*:/i.test(trimmed)) {
      subListMode = "leitura";
      const inlineVal = trimmed.replace(/^(?:[-*•]\s*)?(?:\*\*)?(?:leitura|arquivos\s+de\s+refer[eê]ncia)(?:\*\*)?\s*:\s*(?:\*\*)?\s*/i, "").trim();
      if (inlineVal) {
        for (const p of inlineVal.split(/[,;]/)) {
          const cleanP = p.replace(/`/g, "").replace(/^\*\*\s*|\s*\*\*$/g, "").trim();
          if (cleanP) leitura.push(cleanP);
        }
      }
      continue;
    }
    if (subListMode !== "none" && /^[-*•]\s+/.test(trimmed)) {
      const itemVal = trimmed.replace(/^[-*•]\s+/, "").replace(/`/g, "").trim();
      if (itemVal) {
        if (subListMode === "escrita") escritaExclusiva.push(itemVal);
        else leitura.push(itemVal);
      }
      continue;
    }

    if (currentSection === "objetivo" && trimmed) {
      objetivoLines.push(trimmed);
    } else if (currentSection === "intro" && trimmed && !/^\*\*[^*]+\*\*:/.test(trimmed)) {
      introLines.push(trimmed);
    }
  }

  feitoQuando = pickField("feito\\s+quando|crit[eé]rio\\s+de\\s+aceite");
  if (!comandoAceite) {
    comandoAceite = pickField("comando\\s+de\\s+aceite|comando\\s+l-22|aceite\\s+l-22|aceite");
  }

  const result: OrgfyStructuredCard = {
    objetivo: (objetivoLines.length > 0 ? objetivoLines : introLines).join(" ").trim(),
    estado: {
      contexto: pickField("contexto"),
      autoridade: pickField("autoridade"),
      decisao: pickField("decis[aã]o"),
    },
    papeis: {
      tipo: pickField("tipo"),
      executor: pickField("executor"),
      revisor: pickField("revisor"),
      decisor: pickField("decisor"),
      workspace: pickField("workspace"),
      effort: pickField("effort|esfor[cç]o"),
      spec: pickField("spec"),
    },
    escopo: {
      leitura,
      escritaExclusiva,
      passos,
    },
    aceite: {
      feitoQuando,
      comandoAceite,
    },
  };

  const hasStructuredSignal = Boolean(
    result.estado.contexto ||
      result.estado.autoridade ||
      result.estado.decisao ||
      result.papeis.executor ||
      result.papeis.revisor ||
      result.papeis.tipo ||
      result.escopo.escritaExclusiva.length > 0 ||
      result.escopo.passos.length > 0 ||
      result.aceite.comandoAceite
  );
  return hasStructuredSignal ? result : null;
}

function renderSimpleMarkdown(h: any, raw: string) {
  const cleaned = cleanCardMarkdown(raw);
  if (!cleaned) return null;
  const lines = cleaned.replace(/\r\n/g, "\n").split("\n");
  const blocks: any[] = [];
  let i = 0;
  let k = 0;

  const renderInline = (text: string): any[] => {
    const out: any[] = [];
    const rx = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let ik = 0;
    while ((m = rx.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("`")) {
        out.push(
          h(
            "code",
            {
              key: `c${ik++}`,
              className: "of-mono",
              style: {
                fontSize: "11px",
                padding: "1px 4px",
                borderRadius: "4px",
                background: "var(--muted)",
                border: "1px solid var(--border)",
              },
            },
            tok.slice(1, -1)
          )
        );
      } else {
        out.push(h("strong", { key: `b${ik++}`, style: { color: "var(--foreground)", fontWeight: 600 } }, tok.slice(2, -2)));
      }
      last = rx.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    const hm = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (hm) {
      const lvl = hm[1].length;
      blocks.push(
        h(
          `h${Math.min(4, lvl + 1)}`,
          {
            key: `h${k++}`,
            style: {
              margin: lvl === 1 ? "2px 0 6px" : "10px 0 4px",
              fontSize: lvl === 1 ? "13.5px" : "12px",
              fontWeight: 600,
              color: "var(--foreground)",
            },
          },
          ...renderInline(hm[2])
        )
      );
      i++;
      continue;
    }
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      blocks.push(
        h(
          "ul",
          {
            key: `ul${k++}`,
            style: { margin: "4px 0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px", lineHeight: 1.45, color: "var(--muted-foreground)" },
          },
          items.map((it, idx) => h("li", { key: idx }, ...renderInline(it)))
        )
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*•]\s)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(
      h(
        "p",
        { key: `p${k++}`, style: { margin: "4px 0", fontSize: "12px", lineHeight: 1.5, color: "var(--muted-foreground)" } },
        ...renderInline(para.join(" "))
      )
    );
  }
  return blocks;
}

function renderUnifiedFileDiff(h: any, file: ParsedDiffFile, isOpen: boolean, onToggle: () => void) {
  const displayName = file.previousPath ? `${file.previousPath} → ${file.path}` : file.path;
  const statusColor =
    file.status === "added"
      ? "var(--status-done, #3dd68c)"
      : file.status === "deleted"
      ? "var(--status-failed, #ff9592)"
      : "var(--status-waiting, #ffca16)";

  return h(
    "div",
    {
      key: file.path,
      style: {
        borderRadius: "8px",
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--card)",
      },
    },
    h(
      "button",
      {
        type: "button",
        "aria-expanded": isOpen,
        onClick: onToggle,
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "7px 10px",
          background: "var(--surface-inset, rgba(255,255,255,0.02))",
          border: "none",
          borderRadius: 0,
          color: "var(--foreground)",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "12px",
        },
      },
      h(
        "span",
        {
          style: {
            display: "inline-flex",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.12s ease",
            color: "var(--muted-foreground)",
          },
        },
        Icon({ h, name: "chevron", size: 13 })
      ),
      Icon({ h, name: "fileCode", size: 13, color: statusColor }),
      h(
        "span",
        {
          className: "of-mono",
          title: displayName,
          style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11.5px" },
        },
        displayName
      ),
      h("span", { style: { fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase" } }, file.status[0]),
      file.additions > 0 &&
        h("span", { className: "of-mono", style: { fontSize: "11px", color: "var(--status-done, #3dd68c)" } }, `+${file.additions}`),
      file.deletions > 0 &&
        h("span", { className: "of-mono", style: { fontSize: "11px", color: "var(--status-failed, #ff9592)" } }, `−${file.deletions}`)
    ),
    isOpen &&
      h(
        "div",
        { style: { borderTop: "1px solid var(--border)", overflowX: "auto", fontFamily: "var(--font-mono)", fontSize: "11px", lineHeight: 1.5 } },
        file.hunks.length === 0
          ? h("div", { className: "of-muted", style: { padding: "8px 12px" } }, "Sem linhas de diff textual (arquivo binário ou renomeado).")
          : file.hunks.map((hunk, hIdx) =>
              h(
                "div",
                { key: hIdx },
                h(
                  "div",
                  {
                    style: {
                      padding: "3px 10px",
                      background: "rgba(96, 165, 250, 0.08)",
                      color: "var(--muted-foreground)",
                      fontSize: "10.5px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    },
                  },
                  hunk.header
                ),
                hunk.lines.map((ln, lIdx) => {
                  const bg =
                    ln.type === "add"
                      ? "rgba(61, 214, 140, 0.12)"
                      : ln.type === "del"
                      ? "rgba(255, 149, 146, 0.12)"
                      : "transparent";
                  const color =
                    ln.type === "add"
                      ? "var(--status-done, #3dd68c)"
                      : ln.type === "del"
                      ? "var(--status-failed, #ff9592)"
                      : "var(--foreground)";
                  const prefix = ln.type === "add" ? "+" : ln.type === "del" ? "-" : " ";
                  return h(
                    "div",
                    {
                      key: lIdx,
                      style: {
                        display: "grid",
                        gridTemplateColumns: "36px 36px 14px 1fr",
                        background: bg,
                        padding: "0 8px",
                        whiteSpace: "pre",
                      },
                    },
                    h("span", { style: { color: "var(--muted-foreground)", opacity: 0.55, textAlign: "right", paddingRight: "6px", userSelect: "none" } }, ln.oldLine ?? ""),
                    h("span", { style: { color: "var(--muted-foreground)", opacity: 0.55, textAlign: "right", paddingRight: "6px", userSelect: "none" } }, ln.newLine ?? ""),
                    h("span", { style: { color, fontWeight: 600, userSelect: "none" } }, prefix),
                    h("span", { style: { color } }, ln.text)
                  );
                })
              )
            )
      )
  );
}

export function createCodeDenInspectorDrawer(React: Context["react"]) {
  const h = React.createElement;

  return function CodeDenInspectorDrawer(props: CodeDenInspectorDrawerProps) {
    const {
      ctx,
      item,
      tenant,
      repoOwner,
      repoDtag,
      repoDetail,
      repoLoading,
      linkedPr,
      liveCrew = [],
      liveTurnsByPubkey = {},
      resolveAuthor,
      EmbeddedThread,
      threadChannelId,
      relaySession,
      relayScope,
      onOpenInBuzz,
      onOpenPrInBuzz,
      onOpenRepoPrsInBuzz,
      onOpenCommitInBuzz,
      onOpenAgentDm,
      onSessionAction,
      onToggleChecklistStep,
      onClose,
    } = props;

    const [activeTab, setActiveTab] = React.useState<InspectorTab>("pr");
    const [localChecklistOverrides, setLocalChecklistOverrides] = React.useState<Record<string, boolean>>({});
    const [showLiveThread, setShowLiveThread] = React.useState<boolean>(false);
    const [gitSnap, setGitSnap] = React.useState<BuzzGitSnapshot | null>(null);
    const [gitLoading, setGitLoading] = React.useState<boolean>(false);
    const [selectedCommit, setSelectedCommit] = React.useState<string>("");
    const [selectedCommitDiff, setSelectedCommitDiff] = React.useState<string | null>(null);
    const [openDiffFiles, setOpenDiffFiles] = React.useState<Record<string, boolean>>({});
    const [expandedDirs, setExpandedDirs] = React.useState<Record<string, boolean>>({});
    const [selectedFilePath, setSelectedFilePath] = React.useState<string | null>(null);
    const [fileContent, setFileContent] = React.useState<{ path: string; content: string | null; loading: boolean; error?: string } | null>(null);
    const [openLoadedSection, setOpenLoadedSection] = React.useState<string | null>("mcp");

    // Reset state when switching to a different card/item
    React.useEffect(() => {
      if (!item) return;
      setActiveTab("pr");
      setSelectedCommit(repoDetail?.commit || "");
      setSelectedCommitDiff(repoDetail?.commitDiff || null);
      setOpenDiffFiles({});
      setSelectedFilePath(null);
      setFileContent(null);
      setLocalChecklistOverrides({});
    }, [item?.id]);

    // Sync commit diff when repoDetail hydrates
    React.useEffect(() => {
      if (repoDetail?.commit && !selectedCommit) {
        setSelectedCommit(repoDetail.commit);
      }
      if (repoDetail?.commitDiff) {
        setSelectedCommitDiff(repoDetail.commitDiff);
      }
    }, [repoDetail?.commit, repoDetail?.commitDiff]);

    const repoDetailRef = React.useRef(repoDetail);
    repoDetailRef.current = repoDetail;

    // Load Buzz Repos Git tree + commits lazily when drawer opens (deps estáveis para nunca travar em loading)
    const loadGitOverview = React.useCallback(async () => {
      if (!item?.id) return;
      setGitLoading(true);
      try {
        const snap = await readBuzzProjectGit(ctx, {
          owner: repoOwner,
          dtag: repoDtag || tenant,
        });
        setGitSnap(snap);
        const currentDetail = repoDetailRef.current;
        const targetCommit = currentDetail?.commit || snap?.head || snap?.commits?.[0]?.hash || "";
        if (targetCommit && !currentDetail?.commitDiff) {
          setSelectedCommit(targetCommit);
          const commitSnap = await readBuzzProjectGit(ctx, {
            owner: repoOwner,
            dtag: repoDtag || tenant,
            commit: targetCommit,
          });
          if (commitSnap?.diff) setSelectedCommitDiff(commitSnap.diff);
        }
      } catch {
        setGitSnap(null);
      } finally {
        setGitLoading(false);
      }
    }, [ctx, item?.id, repoOwner, repoDtag, tenant]);

    React.useEffect(() => {
      if (!item?.id) return;
      void loadGitOverview();
    }, [item?.id, loadGitOverview]);

    const handleSelectCommit = async (hash: string) => {
      setSelectedCommit(hash);
      setOpenDiffFiles({});
      setGitLoading(true);
      try {
        const snap = await readBuzzProjectGit(ctx, {
          owner: repoOwner,
          dtag: repoDtag || tenant,
          commit: hash,
        });
        setSelectedCommitDiff(snap?.diff || null);
      } finally {
        setGitLoading(false);
      }
    };

    const handleSelectFile = async (filePath: string) => {
      setSelectedFilePath(filePath);
      setFileContent({ path: filePath, content: null, loading: true });
      const snap = await readBuzzProjectGit(ctx, {
        owner: repoOwner,
        dtag: repoDtag || tenant,
        path: filePath,
      });
      if (snap?.file) {
        setFileContent({ path: snap.file.path, content: snap.file.content, loading: false });
      } else {
        setFileContent({ path: filePath, content: null, loading: false, error: "Arquivo indisponível via session.projectGit." });
      }
    };

    const parsedDiffFiles = React.useMemo(
      () => parseUnifiedDiff(selectedCommitDiff || repoDetail?.commitDiff),
      [selectedCommitDiff, repoDetail?.commitDiff]
    );

    const totalAdditions = React.useMemo(
      () => parsedDiffFiles.reduce((acc, f) => acc + f.additions, 0),
      [parsedDiffFiles]
    );
    const totalDeletions = React.useMemo(
      () => parsedDiffFiles.reduce((acc, f) => acc + f.deletions, 0),
      [parsedDiffFiles]
    );

    const fileTree = React.useMemo(
      () => buildFileTree(gitSnap?.files || []),
      [gitSnap?.files]
    );

    if (!item) return null;

    // Resolve executor & reviewer from item.note or liveCrew
    const noteStr = String(item.note || "");
    const execMatch = /Executor:\s*([^·\n]+)/i.exec(noteStr);
    const revMatch = /Revisor:\s*([^·\n]+)/i.exec(noteStr);
    const executorName = execMatch ? execMatch[1].trim() : "";
    const reviewerName = revMatch ? revMatch[1].trim() : "";
    const executorAgent = liveCrew.find((a) => executorName && a.name.toLowerCase().includes(executorName.toLowerCase())) || null;
    const reviewerAgent = liveCrew.find((a) => reviewerName && a.name.toLowerCase().includes(reviewerName.toLowerCase())) || null;
    const executorTurn = executorAgent?.pubkey ? liveTurnsByPubkey[executorAgent.pubkey.toLowerCase()] || null : null;

    const steps = ["Entrada", "Tipo", "Execução", "Revisão + CI", "Merge"];
    const activeIdx =
      item.stage === "merged" ? 4 : item.stage === "verifying" || item.stage === "watching" ? 3 : item.stage === "building" ? 2 : item.stage === "candidate" ? 1 : 0;

    // Checks reais derivados do estágio da esteira OrgFy + estado do PR
    const checksList = [
      {
        name: "CI / Pytest da Esteira",
        state: item.stage === "merged" ? "passed" : item.stage === "verifying" || item.stage === "watching" ? "running" : "pending",
      },
      {
        name: "Revisão Cross-Provider (L-01)",
        state: item.stage === "merged" ? "passed" : reviewerName ? "running" : "pending",
      },
      {
        name: "Aceite Congelado (L-22)",
        state: item.stage === "merged" ? "passed" : "pending",
      },
      {
        name: "Conflitos de Merge (main)",
        state: item.stage === "merged" ? "passed" : item.reason?.toLowerCase().includes("conflito") ? "failed" : "passed",
      },
    ];
    const checksPassed = checksList.filter((c) => c.state === "passed").length;

    const allDiffsOpen = parsedDiffFiles.length > 0 && parsedDiffFiles.every((f) => openDiffFiles[f.path] !== false);
    const toggleAllDiffs = () => {
      const next: Record<string, boolean> = {};
      const target = !allDiffsOpen;
      for (const f of parsedDiffFiles) next[f.path] = target;
      setOpenDiffFiles(next);
    };

    const toggleSingleDiff = (path: string) => {
      setOpenDiffFiles((prev: Record<string, boolean>) => ({
        ...prev,
        [path]: prev[path] === false ? true : !(prev[path] ?? true),
      }));
    };

    const TABS: Array<{ id: InspectorTab; label: string; icon: string; count?: number }> = [
      { id: "diff", label: "Diff", icon: "diff", count: parsedDiffFiles.length || undefined },
      { id: "files", label: "Arquivos", icon: "files", count: gitSnap?.files?.length || undefined },
      { id: "pr", label: "Issue / PR", icon: "pr" },
      { id: "details", label: "Detalhes", icon: "info" },
    ];

    // ── RENDER TREE NODE (Files tab) ──
    const renderTreeNode = (node: TreeNodeData, depth: number): any => {
      const isDir = node.kind === "dir";
      const isOpen = Boolean(expandedDirs[node.path]);
      const isSelected = selectedFilePath === node.path;
      return h(
        React.Fragment,
        { key: node.path },
        h(
          "button",
          {
            type: "button",
            onClick: () => {
              if (isDir) {
                setExpandedDirs((prev: Record<string, boolean>) => ({ ...prev, [node.path]: !prev[node.path] }));
              } else {
                void handleSelectFile(node.path);
              }
            },
            style: {
              width: "100%",
              height: "26px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              paddingLeft: `${8 + depth * 14}px`,
              paddingRight: "8px",
              borderRadius: "6px",
              border: "none",
              background: isSelected ? "var(--affordance-selected, rgba(255,255,255,0.08))" : "transparent",
              color: isSelected ? "var(--foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "12px",
            },
          },
          isDir
            ? h(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.12s ease",
                  },
                },
                Icon({ h, name: "chevron", size: 12 })
              )
            : h("span", { style: { width: "12px", display: "inline-block" } }),
          Icon({ h, name: isDir ? "folder" : "files", size: 13, color: isDir ? "var(--status-waiting, #f59e0b)" : undefined }),
          h(
            "span",
            { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            node.name
          )
        ),
        isDir && isOpen && node.children?.map((c) => renderTreeNode(c, depth + 1))
      );
    };

    const renderSectionHeader = (title: string, action?: any) =>
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" } },
        h(
          "div",
          { style: { fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" } },
          title
        ),
        action
      );

    const renderDetailRow = (label: string, value: any) =>
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "112px 1fr",
            alignItems: "baseline",
            gap: "12px",
            padding: "8px 0",
            borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            fontSize: "12.5px",
          },
        },
        h("span", { style: { fontSize: "11.5px", color: "var(--muted-foreground)" } }, label),
        h("div", { style: { minWidth: 0, wordBreak: "break-word", color: "var(--foreground)" } }, value)
      );

    return h(
      "div",
      {
        className: "of-sheet-backdrop",
        "data-item-sheet-drawer": "true",
        "data-codeden-inspector": "true",
        onClick: (e: any) => {
          if (e.target === e.currentTarget) onClose();
        },
      },
      h(
        "aside",
        {
          className: "of-sheet-panel",
          style: {
            width: "min(620px, 95vw)",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            overflow: "hidden",
          },
        },

        // ── BARRA SUPERIOR 1:1 CODEDEN (Diff | Arquivos | Issue / PR | Detalhes | ×) ──
        h(
          "div",
          {
            style: {
              height: "46px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "0 10px",
              borderBottom: "1px solid var(--border)",
              background: "var(--card)",
            },
          },
          h(
            "div",
            {
              role: "tablist",
              style: { display: "flex", alignItems: "center", gap: "3px", flex: 1, minWidth: 0, overflowX: "auto" },
            },
            TABS.map((t) => {
              const active = activeTab === t.id;
              return h(
                "button",
                {
                  key: t.id,
                  type: "button",
                  role: "tab",
                  "aria-selected": active,
                  onClick: () => setActiveTab(t.id),
                  style: {
                    height: "28px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0 9px",
                    borderRadius: "6px",
                    border: active ? "1px solid var(--border)" : "1px solid transparent",
                    background: active ? "var(--affordance-selected, rgba(255,255,255,0.08))" : "transparent",
                    color: active ? "var(--foreground)" : "var(--muted-foreground)",
                    fontSize: "12px",
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  },
                },
                Icon({ h, name: t.icon, size: 13 }),
                h("span", null, t.label),
                t.count !== undefined &&
                  h(
                    "span",
                    {
                      className: "of-mono",
                      style: {
                        fontSize: "10px",
                        padding: "0 5px",
                        borderRadius: "4px",
                        background: "var(--muted)",
                        color: "var(--muted-foreground)",
                      },
                    },
                    String(t.count)
                  )
              );
            })
          ),
          h(
            "button",
            {
              type: "button",
              onClick: onClose,
              title: "Fechar painel",
              "aria-label": "Fechar painel",
              style: {
                width: "28px",
                height: "28px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: "var(--muted-foreground)",
                cursor: "pointer",
                flexShrink: 0,
              },
            },
            Icon({ h, name: "close", size: 15 })
          )
        ),

        // ── CONTEÚDO DA ABA SELECIONADA ──
        h(
          "div",
          {
            style: {
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            },
          },

          // ── ABA 1: DIFF (1:1 CodeDen DiffPanel) ──
          activeTab === "diff" &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", flex: 1 } },
              // Git bar
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "11.5px",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                  gitSnap && gitSnap.commits.length > 0
                    ? h(
                        "select",
                        {
                          value: selectedCommit,
                          onChange: (e: any) => void handleSelectCommit(e.target.value),
                          style: {
                            background: "var(--muted)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            padding: "3px 8px",
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            maxWidth: "260px",
                          },
                        },
                        gitSnap.commits.slice(0, 25).map((c) =>
                          h("option", { key: c.hash, value: c.hash }, `${c.hash.slice(0, 8)} · ${c.subject.slice(0, 42)}`)
                        )
                      )
                    : h("span", { className: "of-mono of-muted" }, selectedCommit ? selectedCommit.slice(0, 10) : "main"),
                  parsedDiffFiles.length > 0 &&
                    h(
                      "span",
                      { className: "of-mono", style: { fontSize: "11px", color: "var(--muted-foreground)" } },
                      `${parsedDiffFiles.length} arq · `,
                      h("span", { style: { color: "var(--status-done, #3dd68c)" } }, `+${totalAdditions}`),
                      " ",
                      h("span", { style: { color: "var(--status-failed, #ff9592)" } }, `−${totalDeletions}`)
                    )
                ),
                h(
                  "div",
                  { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
                  parsedDiffFiles.length > 0 &&
                    h(
                      "button",
                      {
                        type: "button",
                        className: "of-btn",
                        style: { padding: "3px 8px", fontSize: "11px" },
                        onClick: toggleAllDiffs,
                      },
                      allDiffsOpen ? "Recolher" : "Expandir"
                    ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      title: "Recarregar diff",
                      style: { padding: "4px 6px" },
                      onClick: () => void loadGitOverview(),
                    },
                    Icon({ h, name: "refresh", size: 12 })
                  ),
                  selectedCommit &&
                    onOpenCommitInBuzz &&
                    h(
                      "button",
                      {
                        type: "button",
                        className: "of-btn",
                        style: { padding: "3px 8px", fontSize: "11px" },
                        onClick: () => onOpenCommitInBuzz(selectedCommit),
                      },
                      "Buzz Repos ↗"
                    )
                )
              ),
              h(
                "div",
                { style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" } },
                gitLoading && h("div", { className: "of-muted", style: { fontSize: "12px" } }, "Carregando diff via session.projectGit..."),
                !gitLoading && parsedDiffFiles.length === 0
                  ? h(
                      "div",
                      { className: "of-surface", style: { padding: "24px 16px", textAlign: "center", fontSize: "12px" } },
                      h("div", { style: { fontWeight: 600, color: "var(--foreground)" } }, "Nenhum diff disponível para este commit"),
                      h("div", { className: "of-muted", style: { marginTop: "4px" } }, "Selecione outro commit acima ou abra o repositório diretamente no Buzz Repos.")
                    )
                  : parsedDiffFiles.map((f) =>
                      renderUnifiedFileDiff(h, f, openDiffFiles[f.path] !== false, () => toggleSingleDiff(f.path))
                    )
              )
            ),

          // ── ABA 2: ARQUIVOS (1:1 CodeDen FilesPanel) ──
          activeTab === "files" &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } },
              h(
                "div",
                {
                  style: {
                    maxHeight: "42%",
                    flexShrink: 0,
                    overflowY: "auto",
                    borderBottom: "1px solid var(--border)",
                    padding: "8px",
                  },
                },
                gitLoading && fileTree.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "10px", fontSize: "12px" } }, "Carregando árvore de arquivos do Buzz Repos...")
                  : fileTree.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "10px", fontSize: "12px" } }, "Árvore de arquivos indisponível (session.projectGit não retornou arquivos).")
                  : fileTree.map((n) => renderTreeNode(n, 0))
              ),
              h(
                "div",
                { style: { flex: 1, minHeight: 0, overflow: "auto" } },
                !fileContent
                  ? h(
                      "div",
                      { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px", textAlign: "center", color: "var(--muted-foreground)", gap: "6px" } },
                      Icon({ h, name: "files", size: 22 }),
                      h("div", { style: { fontSize: "13px", fontWeight: 600, color: "var(--foreground)" } }, "Escolha um arquivo"),
                      h("div", { style: { fontSize: "12px" } }, "Navegue pelos arquivos reais do repositório sincronizado no Buzz.")
                    )
                  : fileContent.loading
                  ? h("div", { className: "of-muted", style: { padding: "16px", fontSize: "12px" } }, `Carregando ${fileContent.path}...`)
                  : fileContent.error || fileContent.content === null
                  ? h("div", { className: "of-muted", style: { padding: "16px", fontSize: "12px" } }, fileContent.error || "Arquivo binário ou vazio.")
                  : h(
                      "div",
                      null,
                      h(
                        "div",
                        {
                          className: "of-mono",
                          style: {
                            position: "sticky",
                            top: 0,
                            padding: "7px 12px",
                            background: "var(--card)",
                            borderBottom: "1px solid var(--border)",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          },
                        },
                        Icon({ h, name: "fileCode", size: 13 }),
                        fileContent.path
                      ),
                      h(
                        "div",
                        { style: { padding: "8px 0", fontFamily: "var(--font-mono)", fontSize: "11px", lineHeight: 1.55 } },
                        fileContent.content.replace(/\r\n/g, "\n").split("\n").slice(0, 400).map((ln, idx) =>
                          h(
                            "div",
                            { key: idx, style: { display: "grid", gridTemplateColumns: "42px 1fr", padding: "0 12px 0 6px", whiteSpace: "pre" } },
                            h("span", { style: { color: "var(--muted-foreground)", opacity: 0.45, textAlign: "right", paddingRight: "10px", userSelect: "none" } }, String(idx + 1)),
                            h("span", { style: { color: "var(--foreground)" } }, ln)
                          )
                        )
                      )
                    )
              )
            ),

          // ── ABA 3: ISSUE / PR (State-of-the-Art 1:1 CodeDen PrDetailsView + PrFiles + IssueSection) ──
          activeTab === "pr" &&
            h(
              "div",
              { style: { padding: "16px", display: "flex", flexDirection: "column", gap: "18px" } },

              // Cabeçalho principal da Issue / PR
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" } },
                  h(
                    "div",
                    { style: { minWidth: 0, flex: 1 } },
                    h(
                      "div",
                      { className: "of-mono", style: { fontSize: "11px", color: "var(--primary)", marginBottom: "3px" } },
                      `${linkedPr ? "PR" : "Issue"} #${(linkedPr?.id || item.id).slice(0, 10)} · ${tenant}`
                    ),
                    h(
                      "div",
                      { style: { fontSize: "15px", fontWeight: 700, lineHeight: 1.3, color: "var(--foreground)" } },
                      linkedPr?.title || repoDetail?.title || item.title
                    )
                  ),
                  (onOpenPrInBuzz && linkedPr
                    ? h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          title: "Abrir PR no Buzz Repos",
                          style: { padding: "5px 9px", fontSize: "11px", flexShrink: 0 },
                          onClick: () => onOpenPrInBuzz(linkedPr),
                        },
                        "Buzz PR ↗"
                      )
                    : onOpenInBuzz &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          title: "Abrir no Buzz Repos",
                          style: { padding: "5px 9px", fontSize: "11px", flexShrink: 0 },
                          onClick: () => onOpenInBuzz(item),
                        },
                        "Buzz Repos ↗"
                      ))
                ),

                // Badges de Estado, Checks, Revisão, +add/-del e Branch/Commit (1:1 CodeDen)
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", fontSize: "11px" } },
                  h(
                    "span",
                    {
                      className: "of-pill",
                      "data-tone": item.stage === "merged" ? "done" : item.stage === "building" || item.stage === "verifying" ? "running" : "waiting",
                    },
                    item.stage === "merged" ? "Integrado" : repoDetail?.status || item.stage
                  ),
                  h(
                    "span",
                    { className: "of-pill", "data-tone": checksPassed === checksList.length ? "done" : "waiting" },
                    `Checks ${checksPassed}/${checksList.length}`
                  ),
                  item.type && h("span", { className: "of-pill" }, item.type),
                  parsedDiffFiles.length > 0 &&
                    h("span", { className: "of-mono", style: { color: "var(--status-done, #3dd68c)", fontWeight: 600 } }, `+${totalAdditions}`),
                  parsedDiffFiles.length > 0 &&
                    h("span", { className: "of-mono", style: { color: "var(--status-failed, #ff9592)", fontWeight: 600 } }, `−${totalDeletions}`),
                  (repoDetail?.commit || selectedCommit) &&
                    h(
                      "code",
                      { className: "of-mono of-muted", style: { fontSize: "10.5px" } },
                      `${(repoDetail?.commit || selectedCommit).slice(0, 8)} → main`
                    )
                ),

                // Trilha da pipeline compacta horizontal (substitui bloco vertical pesado)
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexWrap: "wrap",
                      padding: "6px 8px",
                      borderRadius: "8px",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      fontSize: "11px",
                    },
                  },
                  steps.map((st, idx) =>
                    h(
                      React.Fragment,
                      { key: st },
                      h(
                        "span",
                        {
                          style: {
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            color: idx <= activeIdx ? "var(--foreground)" : "var(--muted-foreground)",
                            fontWeight: idx === activeIdx ? 600 : 400,
                          },
                        },
                        h("span", { className: "of-dot", "data-tone": idx < activeIdx ? "done" : idx === activeIdx ? "running" : "idle" }),
                        st
                      ),
                      idx < steps.length - 1 && h("span", { className: "of-muted", style: { opacity: 0.45 } }, "›")
                    )
                  )
                )
              ),

              // ── SEÇÃO CHECKS · N (1:1 CodeDen PrDetailsView) ──
              h(
                "section",
                null,
                renderSectionHeader(`Checks · ${checksList.length}`),
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      overflow: "hidden",
                      background: "var(--card)",
                    },
                  },
                  checksList.map((chk, idx) => {
                    const tone =
                      chk.state === "passed"
                        ? "var(--status-done, #3dd68c)"
                        : chk.state === "failed"
                        ? "var(--status-failed, #ff9592)"
                        : "var(--status-waiting, #ffca16)";
                    const iconName = chk.state === "passed" ? "checkCircle" : chk.state === "failed" ? "xCircle" : "clock";
                    const label = chk.state === "passed" ? "Aprovado" : chk.state === "failed" ? "Falhou" : chk.state === "running" ? "Em andamento" : "Pendente";
                    return h(
                      "div",
                      {
                        key: chk.name,
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "7px 11px",
                          borderTop: idx > 0 ? "1px solid var(--border)" : "none",
                          fontSize: "12px",
                        },
                      },
                      Icon({ h, name: iconName, size: 13, color: tone }),
                      h("span", { className: "of-mono", style: { flex: 1, fontSize: "11.5px" } }, chk.name),
                      h("span", { style: { fontSize: "11px", color: tone, fontWeight: 500 } }, label)
                    );
                  })
                )
              ),

              // ── SEÇÃO ARQUIVOS ALTERADOS · N (1:1 CodeDen PrFiles) ──
              h(
                "section",
                null,
                renderSectionHeader(
                  `Arquivos alterados · ${parsedDiffFiles.length}`,
                  parsedDiffFiles.length > 0 &&
                    h(
                      "button",
                      {
                        type: "button",
                        style: {
                          background: "transparent",
                          border: "none",
                          color: "var(--muted-foreground)",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "0 4px",
                        },
                        onClick: toggleAllDiffs,
                      },
                      allDiffsOpen ? "Recolher todos" : "Expandir todos"
                    )
                ),
                parsedDiffFiles.length === 0
                  ? h(
                      "div",
                      {
                        style: {
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px dashed var(--border)",
                          fontSize: "12px",
                          color: "var(--muted-foreground)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        },
                      },
                      h("span", null, repoLoading || gitLoading ? "Carregando diff do Pull Request..." : "Nenhum diff de arquivo anexado a esta issue."),
                      onOpenRepoPrsInBuzz &&
                        h(
                          "button",
                          { type: "button", className: "of-btn", style: { padding: "3px 8px", fontSize: "11px" }, onClick: onOpenRepoPrsInBuzz },
                          "Ver PRs ↗"
                        )
                    )
                  : h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                      parsedDiffFiles.map((f) =>
                        renderUnifiedFileDiff(h, f, Boolean(openDiffFiles[f.path]), () => toggleSingleDiff(f.path))
                      )
                    )
              ),

              // ── SEÇÃO REVISÕES & DISCUSSÃO NIP-34 · N (1:1 CodeDen Reviews + Thread nativa sob demanda) ──
              h(
                "section",
                null,
                renderSectionHeader(
                  `Revisões & Comentários NIP-34 · ${repoDetail?.comments?.length || 0}`,
                  h(
                    "div",
                    { style: { display: "inline-flex", alignItems: "center", gap: "10px" } },
                    EmbeddedThread &&
                      threadChannelId &&
                      relaySession &&
                      typeof relayScope === "string" &&
                      relayScope.length > 0 &&
                      h(
                        "button",
                        {
                          type: "button",
                          style: { background: "transparent", border: "none", color: "var(--muted-foreground)", fontSize: "11px", cursor: "pointer", padding: 0 },
                          onClick: () => setShowLiveThread((v: boolean) => !v),
                        },
                        showLiveThread ? "Ocultar thread" : "Thread do canal"
                      ),
                    onOpenInBuzz &&
                      h(
                        "button",
                        {
                          type: "button",
                          style: { background: "transparent", border: "none", color: "var(--primary)", fontSize: "11px", cursor: "pointer", padding: 0 },
                          onClick: () => onOpenInBuzz(item),
                        },
                        "Responder no Buzz ↗"
                      )
                  )
                ),
                showLiveThread &&
                  EmbeddedThread &&
                  threadChannelId &&
                  relaySession &&
                  typeof relayScope === "string" &&
                  relayScope.length > 0 &&
                  h(
                    "div",
                    {
                      "data-embedded-buzz-thread": "true",
                      style: { marginBottom: "10px", padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", minHeight: "180px" },
                    },
                    h(EmbeddedThread, {
                      session: relaySession,
                      scope: relayScope,
                      channelId: threadChannelId,
                      channelName: tenant,
                      messageId: item.id,
                    })
                  ),
                !repoDetail || repoDetail.comments.length === 0
                  ? h("div", { className: "of-muted", style: { fontSize: "12px" } }, "Nenhuma revisão ou comentário NIP-34 registrado ainda.")
                  : h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                      repoDetail.comments.slice(-10).map((c) =>
                        h(
                          "div",
                          {
                            key: c.id,
                            style: {
                              padding: "9px 11px",
                              borderRadius: "8px",
                              border: "1px solid var(--border)",
                              background: "var(--card)",
                              fontSize: "12px",
                            },
                          },
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px", fontSize: "11px" } },
                            Icon({ h, name: "message", size: 12, color: "var(--muted-foreground)" }),
                            h("strong", { style: { color: "var(--foreground)" } }, resolveAuthor ? resolveAuthor(c.authorPubkey) : c.authorPubkey.slice(0, 10)),
                            h(
                              "span",
                              { className: "of-muted", style: { marginLeft: "auto", fontSize: "10.5px" } },
                              c.createdAt ? new Date(c.createdAt).toLocaleString("pt-BR") : ""
                            )
                          ),
                          h("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.45, color: "var(--muted-foreground)" } }, c.content)
                        )
                      )
                    )
              ),

              // ── DESCRIÇÃO ESTRUTURADA DO CARD ORGFY (campos nativos + Markdown original colapsável) ──
              repoDetail?.content &&
                (() => {
                  const structured = parseOrgfyCardStructure(repoDetail.content);
                  if (!structured) {
                    return h(
                      "section",
                      { "data-buzz-repo-detail": "true" },
                      renderSectionHeader("Descrição"),
                      h(
                        "div",
                        {
                          style: {
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: "var(--card)",
                            maxHeight: "260px",
                            overflowY: "auto",
                          },
                        },
                        renderSimpleMarkdown(h, repoDetail.content)
                      )
                    );
                  }
                  const resolveCrewByName = (name?: string) =>
                    name ? liveCrew.find((a) => a.name.toLowerCase().includes(name.toLowerCase())) || { name } : null;
                  const doneCount = structured.escopo.passos.filter((p) => p.done).length;
                  return h(
                    "section",
                    { "data-buzz-repo-detail": "true", "data-orgfy-structured-card": "true", style: { display: "flex", flexDirection: "column", gap: "10px" } },
                    renderSectionHeader("Contrato do Card OrgFy"),
                    structured.objetivo &&
                      h(
                        "div",
                        { style: { padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" } },
                        h("div", { style: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: "4px" } }, "Objetivo"),
                        h("div", { style: { fontSize: "12.5px", lineHeight: 1.5, color: "var(--foreground)" } }, structured.objetivo)
                      ),
                    (structured.papeis.tipo || structured.papeis.executor || structured.papeis.revisor || structured.papeis.decisor || structured.papeis.effort) &&
                      h(
                        "div",
                        { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" } },
                        structured.papeis.executor &&
                          h(
                            "div",
                            { style: { padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" } },
                            h("div", { style: { fontSize: "10px", color: "var(--muted-foreground)", marginBottom: "4px" } }, "Executor"),
                            h(
                              "button",
                              {
                                type: "button",
                                className: "of-btn",
                                style: { padding: "2px 8px", fontSize: "11.5px" },
                                onClick: () => {
                                  const ag = resolveCrewByName(structured.papeis.executor);
                                  if (ag) onOpenAgentDm?.(ag);
                                },
                              },
                              `${structured.papeis.executor} ↗`
                            )
                          ),
                        structured.papeis.revisor &&
                          h(
                            "div",
                            { style: { padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" } },
                            h("div", { style: { fontSize: "10px", color: "var(--muted-foreground)", marginBottom: "4px" } }, "Revisor (L-01)"),
                            h(
                              "button",
                              {
                                type: "button",
                                className: "of-btn",
                                style: { padding: "2px 8px", fontSize: "11.5px" },
                                onClick: () => {
                                  const ag = resolveCrewByName(structured.papeis.revisor);
                                  if (ag) onOpenAgentDm?.(ag);
                                },
                              },
                              `${structured.papeis.revisor} ↗`
                            )
                          ),
                        structured.papeis.decisor &&
                          h(
                            "div",
                            { style: { padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" } },
                            h("div", { style: { fontSize: "10px", color: "var(--muted-foreground)", marginBottom: "2px" } }, "Decisor / Autoridade"),
                            h("div", { style: { fontSize: "12px", fontWeight: 600 } }, structured.papeis.decisor)
                          ),
                        (structured.papeis.tipo || structured.papeis.effort) &&
                          h(
                            "div",
                            { style: { padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                            structured.papeis.tipo && h("span", { className: "of-pill" }, structured.papeis.tipo),
                            structured.papeis.effort && h("span", { className: "of-pill", "data-tone": "waiting" }, `Effort ${structured.papeis.effort}`)
                          )
                      ),
                    (structured.estado.contexto || structured.estado.decisao || structured.estado.autoridade) &&
                      h(
                        "div",
                        { style: { padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" } },
                        h("div", { style: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" } }, "Estado & Governança"),
                        structured.estado.contexto && h("div", null, h("strong", null, "Contexto: "), h("span", { className: "of-muted" }, structured.estado.contexto)),
                        structured.estado.decisao && h("div", null, h("strong", null, "Decisão: "), h("span", { className: "of-muted" }, structured.estado.decisao)),
                        structured.estado.autoridade && h("div", null, h("strong", null, "Autoridade: "), h("span", { className: "of-muted" }, structured.estado.autoridade))
                      ),
                    structured.escopo.escritaExclusiva.length > 0 &&
                      h(
                        "div",
                        { style: { padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" } },
                        h("div", { style: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: "6px" } }, `Escrita exclusiva (${structured.escopo.escritaExclusiva.length})`),
                        h(
                          "div",
                          { style: { display: "flex", flexWrap: "wrap", gap: "5px" } },
                          structured.escopo.escritaExclusiva.map((p) =>
                            h("code", { key: p, className: "of-mono", style: { fontSize: "11px", padding: "2px 6px", borderRadius: "5px", background: "var(--muted)", border: "1px solid var(--border)" } }, p)
                          )
                        )
                      ),
                    structured.escopo.passos.length > 0 &&
                      (() => {
                        const resolvedPassos = structured.escopo.passos.map((p) => ({
                          ...p,
                          done: localChecklistOverrides[p.id] !== undefined ? localChecklistOverrides[p.id] : p.done,
                        }));
                        const liveDone = resolvedPassos.filter((p) => p.done).length;
                        return h(
                          "div",
                          { "data-interactive-checklist": "true", style: { padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" } },
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" } },
                            h("span", { style: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" } }, "Checklist do Card (clique para marcar)"),
                            h("span", { className: "of-pill", "data-tone": liveDone === resolvedPassos.length ? "done" : "waiting" }, `${liveDone}/${resolvedPassos.length}`)
                          ),
                          h(
                            "div",
                            { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" } },
                            resolvedPassos.map((p) =>
                              h(
                                "button",
                                {
                                  key: `${p.id}-${p.text.slice(0, 12)}`,
                                  type: "button",
                                  onClick: () => {
                                    const nextDone = !p.done;
                                    setLocalChecklistOverrides((prev: Record<string, boolean>) => ({ ...prev, [p.id]: nextDone }));
                                    onToggleChecklistStep?.(p.id, nextDone, item);
                                  },
                                  style: {
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "7px",
                                    padding: "4px 6px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "transparent",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    color: "inherit",
                                  },
                                },
                                Icon({ h, name: p.done ? "checkCircle" : "clock", size: 13, color: p.done ? "var(--status-done, #3dd68c)" : "var(--muted-foreground)" }),
                                h("span", { className: "of-mono", style: { fontSize: "11px", color: "var(--primary)", flexShrink: 0 } }, p.id),
                                h("span", { style: { color: p.done ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: p.done ? "line-through" : "none" } }, p.text)
                              )
                            )
                          )
                        );
                      })(),
                    (structured.aceite.feitoQuando || structured.aceite.comandoAceite) &&
                      h(
                        "div",
                        { style: { padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(61,214,140,0.3)", background: "rgba(61,214,140,0.06)", display: "flex", flexDirection: "column", gap: "6px" } },
                        h("div", { style: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--status-done, #3dd68c)" } }, "Aceite Congelado (L-22)"),
                        structured.aceite.feitoQuando && h("div", { style: { fontSize: "12px", color: "var(--foreground)" } }, structured.aceite.feitoQuando),
                        structured.aceite.comandoAceite &&
                          h("code", { className: "of-mono", style: { fontSize: "11px", padding: "6px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.28)", display: "block", overflowX: "auto" } }, structured.aceite.comandoAceite)
                      ),
                    h(
                      "details",
                      { style: { fontSize: "11.5px", color: "var(--muted-foreground)" } },
                      h("summary", { style: { cursor: "pointer", userSelect: "none", padding: "4px 2px" } }, "Ver Markdown original"),
                      h(
                        "div",
                        { style: { marginTop: "6px", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", maxHeight: "220px", overflowY: "auto" } },
                        renderSimpleMarkdown(h, repoDetail.content)
                      )
                    )
                  );
                })()
            ),

          // ── ABA 4: DETALHES (1:1 CodeDen DetailsPanel) ──
          activeTab === "details" &&
            h(
              "div",
              { style: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "18px" } },
              h(
                "section",
                null,
                renderDetailRow(
                  "Status",
                  h(
                    "div",
                    null,
                    h("span", { style: { fontWeight: 600 } }, repoDetail?.status || item.stage),
                    executorTurn &&
                      h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, executorTurn.stepLabel)
                  )
                ),
                renderDetailRow("Propósito", repoDetail?.title || item.title),
                renderDetailRow("Work key", h("code", { className: "of-mono", style: { fontSize: "11.5px" } }, item.workKey || item.id.slice(0, 12))),
                renderDetailRow(
                  "Iniciado por",
                  repoDetail?.authorPubkey
                    ? `${resolveAuthor ? resolveAuthor(repoDetail.authorPubkey) : repoDetail.authorPubkey.slice(0, 10)}${repoDetail.createdAt ? ` · ${new Date(repoDetail.createdAt).toLocaleDateString("pt-BR")}` : ""}`
                    : "OrgFy Esteira"
                ),
                renderDetailRow(
                  "Provedor",
                  h(
                    "span",
                    { className: "of-mono", style: { fontSize: "11.5px" } },
                    executorAgent
                      ? `${executorAgent.provider || "nexusmind"} · ${executorAgent.model || "padrão"}`
                      : "nexusmind · goose"
                  )
                ),
                renderDetailRow(
                  "Autonomia",
                  h("span", { className: "of-pill", "data-tone": "waiting" }, "Autônoma (Esteira)")
                ),
                renderDetailRow(
                  "Commit / Branch",
                  h(
                    "span",
                    { className: "of-mono", style: { fontSize: "11.5px" } },
                    repoDetail?.commit ? `${repoDetail.commit.slice(0, 10)} ` : "main ",
                    h("span", { className: "of-muted" }, `em ${repoDtag || tenant}`)
                  )
                ),
                (executorName || reviewerName) &&
                  renderDetailRow(
                    "Equipe",
                    h(
                      "div",
                      { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
                      executorName &&
                        h(
                          "button",
                          {
                            type: "button",
                            className: "of-btn",
                            style: { padding: "2px 8px", fontSize: "11px" },
                            onClick: () => onOpenAgentDm?.(executorAgent || { name: executorName }),
                          },
                          `Executor: ${executorName}`
                        ),
                      reviewerName &&
                        h(
                          "button",
                          {
                            type: "button",
                            className: "of-btn",
                            style: { padding: "2px 8px", fontSize: "11px" },
                            onClick: () => onOpenAgentDm?.(reviewerAgent || { name: reviewerName }),
                          },
                          `Revisor: ${reviewerName}`
                        )
                    )
                  )
              ),

              // ── JANELA DE CONTEXTO (1:1 CodeDen ContextWindow + Compact now) ──
              h(
                "section",
                null,
                renderSectionHeader(
                  "Janela de contexto",
                  executorAgent &&
                    onSessionAction &&
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => onSessionAction(executorAgent.key, "compact"),
                        style: {
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "transparent",
                          border: "none",
                          color: "var(--muted-foreground)",
                          fontSize: "11.5px",
                          cursor: "pointer",
                          padding: "2px 4px",
                        },
                      },
                      Icon({ h, name: "compact", size: 12 }),
                      "Compactar agora"
                    )
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--muted-foreground)" } },
                  h("span", null, executorAgent ? `${executorAgent.name} · sessão ativa` : "—"),
                  h("span", null, "Gateway NexusMind")
                )
              ),

              // ── O QUE ESTÁ CARREGADO (1:1 CodeDen LoadedConfig) ──
              h(
                "section",
                { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                renderSectionHeader("O que está carregado"),
                [
                  {
                    id: "memory",
                    icon: "files",
                    label: "Memória & Estado",
                    count: 2,
                    items: ["kpis-esteira.json (FPY/CPI)", "empresas/orgfy.json (Roster)"],
                  },
                  {
                    id: "skills",
                    icon: "sparkles",
                    label: "Regras & Habilidades",
                    count: 3,
                    items: ["Eval R5.1 (Modelos)", "Revisão Cross-Provider (L-01)", "Aceite Congelado (L-22)"],
                  },
                  {
                    id: "subagents",
                    icon: "bot",
                    label: "Agentes Vinculados",
                    count: (executorName ? 1 : 0) + (reviewerName ? 1 : 0),
                    items: [executorName && `Executor: ${executorName}`, reviewerName && `Revisor: ${reviewerName}`].filter(Boolean) as string[],
                  },
                  {
                    id: "mcp",
                    icon: "plug",
                    label: "Servidores MCP & APIs",
                    count: 3,
                    items: ["orgfy (21 tools · built in)", "nexusmind (5 tools · built in)", "buzz.repos (NIP-34 · built in)"],
                  },
                ].map((box) => {
                  const open = openLoadedSection === box.id;
                  return h(
                    "div",
                    {
                      key: box.id,
                      style: {
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        overflow: "hidden",
                      },
                    },
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => setOpenLoadedSection(open ? null : box.id),
                        style: {
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 11px",
                          background: "transparent",
                          border: "none",
                          color: "var(--foreground)",
                          fontSize: "12px",
                          cursor: "pointer",
                          textAlign: "left",
                        },
                      },
                      Icon({ h, name: box.icon, size: 13, color: "var(--muted-foreground)" }),
                      h("span", { style: { flex: 1, fontWeight: 500 } }, box.label),
                      h("span", { className: "of-mono of-muted", style: { fontSize: "11px" } }, String(box.count))
                    ),
                    open &&
                      h(
                        "div",
                        { style: { borderTop: "1px solid var(--border)", padding: "8px 11px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--muted-foreground)" } },
                        box.items.length === 0
                          ? h("span", null, "Nenhum")
                          : box.items.map((it) => h("div", { key: it, className: "of-mono", style: { fontSize: "11px" } }, it))
                      )
                  );
                })
              ),

              // Rodapé de sessão (1:1 CodeDen)
              h(
                "div",
                { className: "of-mono of-muted", style: { fontSize: "10.5px", opacity: 0.75, paddingTop: "4px" } },
                `Item ${item.id} · NIP-34 sincronizado`
              )
            )
        )
      )
    );
  };
}
