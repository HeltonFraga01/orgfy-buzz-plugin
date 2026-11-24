// ─────────────────────────────────────────────────────────────────────────────
// ORGFY CARD PROGRESS & CHECKPOINT ENGINE (v13.1)
// Transforma as etapas de `## O que fazer` e o grafo `## Fluxo` (Mermaid)
// em uma task list viva e persistente em `cards/<SLUG>.md`.
// - Retomada determinística pós-queda / compactação / failover de modelo
// - Barra de progresso real (`X/Y concluídas · ZZ%`) no Control Room
// - Colorização automática dos nós P1..Pn no Mermaid `## Fluxo`
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { ORGFY_ABS_PATH } from "./orgfy-bridge";

export type StepStatus = "todo" | "in_progress" | "done" | "blocked";

export interface CardChecklistStep {
  id: string;
  text: string;
  status: StepStatus;
  note?: string;
}

export interface CardProgressSummary {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  pct: number;
  steps: CardChecklistStep[];
  nextPendingStepId: string | null;
}

export interface CardProgressUpdateInput {
  slug: string;
  action?: "read" | "update";
  step_id?: string;
  status?: StepStatus;
  note?: string;
  agent?: string;
}

export interface CardProgressUpdateResult {
  ok: boolean;
  code: string;
  message: string;
  cardPath: string;
  progress: CardProgressSummary | null;
  updatedStepId?: string;
  writtenToDisk: boolean;
}

const MARK_TO_STATUS: Record<string, StepStatus> = {
  " ": "todo",
  "/": "in_progress",
  "x": "done",
  "X": "done",
  "!": "blocked",
};

const STATUS_TO_MARK: Record<StepStatus, string> = {
  todo: " ",
  in_progress: "/",
  done: "x",
  blocked: "!",
};

function decodeBytes(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return String(raw ?? "");
}

function summarizeSteps(steps: CardChecklistStep[]): CardProgressSummary {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const inProgress = steps.filter((s) => s.status === "in_progress").length;
  const blocked = steps.filter((s) => s.status === "blocked").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const nextPending =
    steps.find((s) => s.status === "in_progress") ||
    steps.find((s) => s.status === "todo") ||
    steps.find((s) => s.status === "blocked") ||
    null;

  return {
    total,
    done,
    inProgress,
    blocked,
    pct,
    steps,
    nextPendingStepId: nextPending ? nextPending.id : null,
  };
}

/**
 * Faz o parse das etapas em `## O que fazer` (suporta checkboxes `- [x] **P1:** ...`
 * e listas numeradas legadas `1. ...`).
 */
export function parseCardProgress(markdown: string | null | undefined): CardProgressSummary | null {
  if (!markdown) return null;
  const secMatch = markdown.match(/##\s*O que fazer\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (!secMatch?.[1]) return null;

  const lines = secMatch[1].split("\n");
  const steps: CardChecklistStep[] = [];
  let seq = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Formato 1: Checkbox `- [x] **P1:** texto — nota` ou `- [ ] P1: texto`
    const cb = line.match(/^-\s+\[([ xX\/!])\]\s+(?:\*\*)?(P\d+)(?::)?(?:\*\*)?:?\s*(.+)$/);
    if (cb) {
      seq += 1;
      const status = MARK_TO_STATUS[cb[1]] || "todo";
      const id = cb[2].toUpperCase();
      const rest = cb[3].trim();
      const noteSplit = rest.split(/\s+—\s+`?\[/);
      const text = noteSplit[0].trim();
      const note = noteSplit.length > 1 ? rest.slice(text.length).replace(/^\s*—\s*/, "").trim() : undefined;
      steps.push({ id, text, status, note });
      continue;
    }

    // Formato 2: Checkbox genérico `- [ ] texto`
    const cbSimple = line.match(/^-\s+\[([ xX\/!])\]\s+(.+)$/);
    if (cbSimple) {
      seq += 1;
      steps.push({
        id: `P${seq}`,
        text: cbSimple[2].trim(),
        status: MARK_TO_STATUS[cbSimple[1]] || "todo",
      });
      continue;
    }

    // Formato 3 (legado): Lista numerada `1. texto`
    const num = line.match(/^(\d+)\.\s+(.+)$/);
    if (num) {
      seq += 1;
      steps.push({
        id: `P${num[1]}`,
        text: num[2].trim(),
        status: "todo",
      });
    }
  }

  return steps.length > 0 ? summarizeSteps(steps) : null;
}

/**
 * Aplica atualização de etapa em `## O que fazer` e colore os nós no bloco `## Fluxo` (Mermaid).
 */
export function applyStepUpdateToMarkdown(
  markdown: string,
  stepId: string,
  status: StepStatus,
  note?: string,
  agent?: string
): { updatedMarkdown: string; progress: CardProgressSummary | null; matched: boolean } {
  const targetId = String(stepId || "").trim().toUpperCase();
  const parsed = parseCardProgress(markdown);
  if (!parsed) {
    return { updatedMarkdown: markdown, progress: null, matched: false };
  }

  let matched = false;
  const noteTag = note
    ? `[${agent ? `${agent}: ` : ""}${note.replace(/\n/g, " ").trim().slice(0, 120)}]`
    : undefined;

  const updatedSteps: CardChecklistStep[] = parsed.steps.map((s) => {
    if (s.id.toUpperCase() === targetId) {
      matched = true;
      return {
        ...s,
        status,
        note: noteTag ?? s.note,
      };
    }
    return s;
  });

  if (!matched) {
    return { updatedMarkdown: markdown, progress: parsed, matched: false };
  }

  // 1. Re-renderiza seção `## O que fazer` com checkboxes normalizados
  const newSectionBody = updatedSteps
    .map((s) => {
      const mark = STATUS_TO_MARK[s.status];
      const suffix = s.note ? ` — ${s.note}` : "";
      return `- [${mark}] **${s.id}:** ${s.text}${suffix}`;
    })
    .join("\n");

  let nextMd = markdown.replace(
    /(##\s*O que fazer\s*\n)([\s\S]*?)(?=\n##\s+|$)/i,
    `$1${newSectionBody}\n`
  );

  // 2. Colore nós no bloco Mermaid `## Fluxo` conforme status atual
  const mermaidMatch = nextMd.match(/(##\s*Fluxo\s*\n```mermaid\s*\n)([\s\S]*?)(```)/i);
  if (mermaidMatch) {
    const cleanMermaidLines = mermaidMatch[2]
      .split("\n")
      .filter((l) => !/^\s*style\s+P\d+\s+/i.test(l))
      .join("\n")
      .trimEnd();

    const styleLines: string[] = [];
    for (const s of updatedSteps) {
      if (s.status === "done") {
        styleLines.push(`    style ${s.id} fill:#064e3b,stroke:#10b981,color:#d1fae5`);
      } else if (s.status === "in_progress") {
        styleLines.push(`    style ${s.id} fill:#451a03,stroke:#f59e0b,color:#fef3c7`);
      } else if (s.status === "blocked") {
        styleLines.push(`    style ${s.id} fill:#450a0a,stroke:#ef4444,color:#fee2e2`);
      }
    }

    const rebuiltMermaid =
      styleLines.length > 0
        ? `${cleanMermaidLines}\n${styleLines.join("\n")}\n`
        : `${cleanMermaidLines}\n`;

    nextMd = nextMd.replace(
      /(##\s*Fluxo\s*\n```mermaid\s*\n)([\s\S]*?)(```)/i,
      `$1${rebuiltMermaid}$3`
    );
  }

  return {
    updatedMarkdown: nextMd,
    progress: summarizeSteps(updatedSteps),
    matched: true,
  };
}

/**
 * Lê ou atualiza o progresso de um card em `REPOS/orgfy/cards/<SLUG>.md`.
 */
export async function executeCardProgress(
  ctx: Context | any,
  input: CardProgressUpdateInput
): Promise<CardProgressUpdateResult> {
  const rawSlug = String(input.slug || "")
    .trim()
    .replace(/^cards\//i, "")
    .replace(/\.md$/i, "");

  if (!rawSlug) {
    return {
      ok: false,
      code: "MISSING_SLUG",
      message: "Informe o 'slug' do card (ex.: SPEC-0006-T020).",
      cardPath: "",
      progress: null,
      writtenToDisk: false,
    };
  }

  const host = ctx?.host;
  if (!host?.readFile) {
    return {
      ok: false,
      code: "HOST_READ_UNAVAILABLE",
      message: "ctx.host.readFile indisponível neste ambiente.",
      cardPath: `cards/${rawSlug.toUpperCase()}.md`,
      progress: null,
      writtenToDisk: false,
    };
  }

  const candidates = Array.from(
    new Set([`cards/${rawSlug.toUpperCase()}.md`, `cards/${rawSlug}.md`, `cards/${rawSlug.toLowerCase()}.md`])
  );

  let foundPath: string | null = null;
  let content: string | null = null;
  for (const rel of candidates) {
    try {
      const raw = await host.readFile(`${ORGFY_ABS_PATH}/${rel}`);
      content = decodeBytes(raw);
      foundPath = rel;
      break;
    } catch {
      // tenta próxima variação de case
    }
  }

  if (!foundPath || !content) {
    return {
      ok: false,
      code: "CARD_NOT_FOUND",
      message: `Card não encontrado em ${ORGFY_ABS_PATH}/cards/ (tentativas: ${candidates.join(", ")}).`,
      cardPath: candidates[0],
      progress: null,
      writtenToDisk: false,
    };
  }

  const action = input.action || (input.step_id && input.status ? "update" : "read");
  if (action === "read") {
    const progress = parseCardProgress(content);
    return {
      ok: Boolean(progress),
      code: progress ? "OK" : "NO_STEPS_FOUND",
      message: progress
        ? `Progresso de ${foundPath}: ${progress.done}/${progress.total} concluídas (${progress.pct}%). Próxima etapa: ${progress.nextPendingStepId || "nenhuma (concluído)"}.`
        : `Nenhuma etapa encontrada na seção '## O que fazer' de ${foundPath}.`,
      cardPath: foundPath,
      progress,
      writtenToDisk: false,
    };
  }

  if (!input.step_id || !input.status) {
    return {
      ok: false,
      code: "MISSING_STEP_OR_STATUS",
      message: "Para action='update', informe 'step_id' (ex.: 'P1') e 'status' ('todo' | 'in_progress' | 'done' | 'blocked').",
      cardPath: foundPath,
      progress: parseCardProgress(content),
      writtenToDisk: false,
    };
  }

  const applied = applyStepUpdateToMarkdown(content, input.step_id, input.status, input.note, input.agent);
  if (!applied.matched || !applied.progress) {
    return {
      ok: false,
      code: "STEP_NOT_FOUND",
      message: `Etapa '${input.step_id}' não encontrada em ${foundPath}.`,
      cardPath: foundPath,
      progress: applied.progress,
      writtenToDisk: false,
    };
  }

  let writtenToDisk = false;
  if (typeof host.writeFile === "function") {
    await host.writeFile(`${ORGFY_ABS_PATH}/${foundPath}`, applied.updatedMarkdown);
    writtenToDisk = true;
  }

  return {
    ok: true,
    code: "UPDATED",
    message: `Etapa ${input.step_id.toUpperCase()} marcada como '${input.status}' em ${foundPath} (${applied.progress.done}/${applied.progress.total} · ${applied.progress.pct}%).`,
    cardPath: foundPath,
    progress: applied.progress,
    updatedStepId: input.step_id.toUpperCase(),
    writtenToDisk,
  };
}
