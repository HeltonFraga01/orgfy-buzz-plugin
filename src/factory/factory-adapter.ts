// Adaptado de CodeDen (MIT) commit b0b2a5a: packages/contracts/src/factory-api.ts
import type { Context } from "@buzz/author";
import { FABRICA_STATUS_SCRIPT_PATH, getControlePath } from "../config";

export type AutonomyMode = "manual" | "assisted" | "software_factory" | "dark_factory";
export type FactoryLoopState = "idle" | "discovering" | "building" | "verifying" | "paused" | "stopped" | "draining";
export type FactoryItemStage =
  | "candidate"
  | "ignored"
  | "backlog"
  | "building"
  | "verifying"
  | "watching"
  | "merged"
  | "reverted"
  | "rejected"
  | "failed"
  | "escalated";

export interface FactoryWorkItem {
  id: string;
  title: string;
  workKey: string;
  stage: FactoryItemStage;
  step: string;
  type: "bug" | "feature" | "docs" | null;
  attempts: number;
  sessionId: string | null;
  activeSessionId: string | null;
  reason: string | null;
  note: string | null;
  updatedAt: number;
}

export interface AgentModelEvalRow {
  agente: string;
  papel: string | null;
  modelo: string | null;
  provider: string | null;
  toolcall_eval: string | null;
  abaixo_minimo: boolean;
}

export interface FactoryStatusPayload {
  projectId: string;
  mode: AutonomyMode;
  experimental: boolean;
  loopState: FactoryLoopState;
  pausedReason: string | null;
  killSwitch: boolean;
  globalKillSwitch: boolean;
  drain: { since: number; inFlight: number; total: number; deadline: number | null } | null;
  limits: {
    maxConcurrentSessions: number;
    maxMergesPerDay: number;
    dailyBudget: { tokens?: number; usd?: number };
    pauseAfterConsecutiveFailures: number;
    autoMerge: boolean;
    mergePolicy: "fast" | "strict";
  };
  spendToday: { tokens: number; usd: number };
  mergesToday: number;
  stats: {
    mergedToday: number;
    failedToday: number;
    revertedToday: number;
    medianMergeMs7d: number | null;
    merged7d: number;
  };
  consecutiveFailures: number;
  activeSessions: number;
  wip: { openPrs: number; limit: number; holding: boolean; waitingOnProvider: number; note: string | null };
  backlog: FactoryWorkItem[];
  inProgress: FactoryWorkItem[];
  mergeChecks: unknown[];
  pullRequests: unknown[];
  recent: FactoryWorkItem[];
  viewRecent: FactoryWorkItem[];
  ignored: FactoryWorkItem[];
  held: unknown[];
  visionExists: boolean;
  lessons: unknown[];
  lastDigest: unknown | null;
  lastTickAt: number | null;
  // Extensões OrgFy multi-tenant (PRD v15 §9)
  tenant: string;
  coordenador: "ativo" | "parado";
  launchAgent?: string;
  quarentenaCount?: number;
  kpis?: {
    disponivel: boolean;
    gerado_em?: string | null;
    fluxo?: Record<string, any> | null;
    qualidade?: Record<string, any> | null;
    economia?: Record<string, any> | null;
    higiene?: Record<string, any> | null;
  };
  modelos?: AgentModelEvalRow[];
  indisponivel: string[];
}

const VALID_MODES = new Set<string>(["manual", "assisted", "software_factory", "dark_factory"]);
const VALID_LOOP_STATES = new Set<string>(["idle", "discovering", "building", "verifying", "paused", "stopped", "draining"]);

export function parseFactoryStatus(raw: unknown): FactoryStatusPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("FactoryStatus inválido: objeto esperado");
  }
  const obj = raw as Record<string, any>;
  if (typeof obj.projectId !== "string" || !obj.projectId) {
    throw new Error("FactoryStatus inválido: projectId obrigatório");
  }
  if (!VALID_MODES.has(String(obj.mode))) {
    throw new Error(`FactoryStatus inválido: mode=${obj.mode}`);
  }
  if (!VALID_LOOP_STATES.has(String(obj.loopState))) {
    throw new Error(`FactoryStatus inválido: loopState=${obj.loopState}`);
  }
  if (typeof obj.killSwitch !== "boolean" || typeof obj.globalKillSwitch !== "boolean") {
    throw new Error("FactoryStatus inválido: killSwitch/globalKillSwitch boolean obrigatórios");
  }
  if (!obj.spendToday || typeof obj.spendToday.tokens !== "number" || typeof obj.spendToday.usd !== "number") {
    throw new Error("FactoryStatus inválido: spendToday.tokens/usd obrigatórios");
  }
  if (!Array.isArray(obj.backlog) || !Array.isArray(obj.inProgress) || !Array.isArray(obj.recent)) {
    throw new Error("FactoryStatus inválido: backlog/inProgress/recent devem ser arrays");
  }
  return obj as FactoryStatusPayload;
}

export function buildEmptyFactoryStatus(tenant: string, reason?: string): FactoryStatusPayload {
  return {
    projectId: tenant,
    mode: "software_factory",
    experimental: true,
    loopState: "stopped",
    pausedReason: reason || "Coordenador parado ou indisponível",
    killSwitch: false,
    globalKillSwitch: false,
    drain: null,
    limits: {
      maxConcurrentSessions: 2,
      maxMergesPerDay: 5,
      dailyBudget: {},
      pauseAfterConsecutiveFailures: 3,
      autoMerge: false,
      mergePolicy: "strict",
    },
    spendToday: { tokens: 0, usd: 0 },
    mergesToday: 0,
    stats: { mergedToday: 0, failedToday: 0, revertedToday: 0, medianMergeMs7d: null, merged7d: 0 },
    consecutiveFailures: 0,
    activeSessions: 0,
    wip: { openPrs: 0, limit: 2, holding: false, waitingOnProvider: 0, note: null },
    backlog: [],
    inProgress: [],
    mergeChecks: [],
    pullRequests: [],
    recent: [],
    viewRecent: [],
    ignored: [],
    held: [],
    visionExists: false,
    lessons: [],
    lastDigest: null,
    lastTickAt: null,
    tenant,
    coordenador: "parado",
    modelos: [],
    indisponivel: ["kpis-esteira.json", "lastDigest", "lessons", "mergeChecks", "pullRequests", "scout", "spotChecks"],
  };
}

export async function fetchFactoryStatus(ctx: Context, tenant = "orgfy"): Promise<{
  ok: boolean;
  status: FactoryStatusPayload;
  error: string | null;
}> {
  const slug = (tenant || "orgfy").trim().toLowerCase() || "orgfy";
  const host = (ctx as any)?.host;
  try {
    if (host?.spawn) {
      const proc = await host.spawn("python", {
        args: [FABRICA_STATUS_SCRIPT_PATH, "--empresa", slug, "--json"],
      });
      let out = "";
      if (proc?.stdout && typeof proc.stdout.getReader === "function") {
        const reader = proc.stdout.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          out += typeof value === "string" ? value : dec.decode(value, { stream: true });
        }
      } else if (typeof proc?.stdout === "string") {
        out = proc.stdout;
      }
      if (proc?.exited) {
        await Promise.race([proc.exited, new Promise((r) => setTimeout(r, 15_000))]);
      }
      if (out.trim()) {
        const parsed = parseFactoryStatus(JSON.parse(out.trim()));
        return { ok: true, status: parsed, error: null };
      }
    }
  } catch (err: any) {
    return {
      ok: false,
      status: buildEmptyFactoryStatus(slug, err?.message || "Falha ao consultar fabrica_status.py"),
      error: err?.message || String(err),
    };
  }
  return {
    ok: false,
    status: buildEmptyFactoryStatus(slug, "host.spawn indisponível"),
    error: "host.spawn indisponível",
  };
}

export async function writeTenantControl(
  ctx: Context,
  tenant: string,
  patch: {
    mode?: AutonomyMode;
    killSwitch?: boolean;
    drain?: boolean;
    pausedReason?: string | null;
    limits?: {
      gastoDiaUsd?: number;
      mergesDia?: number;
      agentes?: number;
      prsAbertos?: number;
      falhasSeguidas?: number;
    };
  }
): Promise<{ ok: boolean; path: string; control: Record<string, any> }> {
  const slug = (tenant || "orgfy").trim().toLowerCase() || "orgfy";
  const path = getControlePath(slug);
  const host = (ctx as any)?.host;
  let current: Record<string, any> = {
    tenant: slug,
    mode: "software_factory",
    killSwitch: false,
    drain: false,
    limits: { gastoDiaUsd: 50, mergesDia: 20, agentes: 4, prsAbertos: 6, falhasSeguidas: 3 },
    pausedReason: null,
  };
  try {
    if (host?.readFile) {
      const raw = await host.readFile(path);
      const txt = raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw || "");
      const parsed = JSON.parse(txt);
      if (parsed && typeof parsed === "object") current = { ...current, ...parsed };
    }
  } catch {
    // Arquivo ainda não existe
  }
  const next = {
    ...current,
    ...patch,
    limits: { ...(current.limits || {}), ...(patch.limits || {}) },
    tenant: slug,
    updatedAt: new Date().toISOString(),
  };
  if (host?.writeFile) {
    await host.writeFile(path, JSON.stringify(next, null, 2) + "\n");
    return { ok: true, path, control: next };
  }
  return { ok: false, path, control: next };
}
