import type { Context } from "@buzz/author";

export interface ResolvedIssueItem {
  issueId: string;
  fullIssueId: string;
  code: string;
  titulo: string;
  spec: string;
  commitSha: string | null;
  resolvidoEm: string;
  causaRaiz: string;
  arquivosAlterados: string[];
  deepLink: string;
}

export interface ResolvedArchivePayload {
  schema_version: string;
  atualizado_em: string;
  total_resolvidas: number;
  itens: ResolvedIssueItem[];
}

export interface ResolvedArchiveReadResult {
  disponivel: boolean;
  error: string | null;
  total: number;
  atualizado_em: string | null;
  itens: ResolvedIssueItem[];
}

import { joinHome } from "../config";
export const RESOLVED_ARCHIVE_PATH = joinHome(".buzz", ".scratch", "resolved-issues-archive.json");

function decodeHostBytes(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (ArrayBuffer.isView(raw)) {
      return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
    }
  }
  return String(raw ?? "");
}

export async function fetchResolvedArchive(ctx: Context): Promise<ResolvedArchiveReadResult> {
  const host = (ctx as any).host;
  if (!host?.readFile) {
    return {
      disponivel: false,
      error: "ctx.host.readFile indisponível.",
      total: 0,
      atualizado_em: null,
      itens: [],
    };
  }

  try {
    const raw = await host.readFile(RESOLVED_ARCHIVE_PATH);
    const parsed = JSON.parse(decodeHostBytes(raw)) as ResolvedArchivePayload;
    const itens = Array.isArray(parsed?.itens) ? parsed.itens : [];
    return {
      disponivel: true,
      error: null,
      total: itens.length,
      atualizado_em: parsed?.atualizado_em || null,
      itens,
    };
  } catch (err: any) {
    return {
      disponivel: false,
      error: err?.message || "Arquivo resolved-issues-archive.json não encontrado.",
      total: 0,
      atualizado_em: null,
      itens: [],
    };
  }
}

export async function searchResolvedArchive(
  ctx: Context,
  options: { query?: string; spec?: string; limit?: number } = {}
): Promise<{
  disponivel: boolean;
  error: string | null;
  total_arquivo: number;
  total_encontrados: number;
  resultados: ResolvedIssueItem[];
}> {
  const loaded = await fetchResolvedArchive(ctx);
  if (!loaded.disponivel) {
    return {
      disponivel: false,
      error: loaded.error,
      total_arquivo: 0,
      total_encontrados: 0,
      resultados: [],
    };
  }

  const q = String(options.query || "").trim().toLowerCase();
  const specFilter = String(options.spec || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(options.limit || 10)));

  const matched = loaded.itens.filter((item) => {
    if (specFilter && specFilter !== "all" && item.spec.toLowerCase() !== specFilter) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      item.issueId,
      item.fullIssueId,
      item.code,
      item.titulo,
      item.spec,
      item.commitSha || "",
      item.causaRaiz,
      ...(item.arquivosAlterados || []),
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((tok) => haystack.includes(tok));
  });

  return {
    disponivel: true,
    error: null,
    total_arquivo: loaded.total,
    total_encontrados: matched.length,
    resultados: matched.slice(0, limit),
  };
}
