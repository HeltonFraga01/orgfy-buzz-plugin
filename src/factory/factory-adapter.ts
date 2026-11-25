// Adaptado de CodeDen (MIT) commit b0b2a5a: packages/contracts/src/factory-api.ts
import type { Context } from "@buzz/author";
import { FABRICA_STATUS_SCRIPT_PATH, getControlePath } from "../config";
import { fetchKpisEsteira } from "../services/kpi-service";
import { fetchLiveKanbanCards, readOrgfyJson, readOrgfyText } from "../services/orgfy-bridge";

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
    pausedReason: reason || null,
    killSwitch: false,
    globalKillSwitch: false,
    drain: null,
    limits: {
      maxConcurrentSessions: 4,
      maxMergesPerDay: 20,
      dailyBudget: { usd: 50 },
      pauseAfterConsecutiveFailures: 3,
      autoMerge: false,
      mergePolicy: "strict",
    },
    spendToday: { tokens: 0, usd: 0 },
    mergesToday: 0,
    stats: { mergedToday: 0, failedToday: 0, revertedToday: 0, medianMergeMs7d: null, merged7d: 0 },
    consecutiveFailures: 0,
    activeSessions: 0,
    wip: { openPrs: 0, limit: 6, holding: false, waitingOnProvider: 0, note: null },
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
    indisponivel: ["lastDigest", "lessons", "mergeChecks", "pullRequests", "scout", "spotChecks"],
  };
}

function parseEvalTable(md: string | null): Map<string, { score: string; abaixo: boolean }> {
  const map = new Map<string, { score: string; abaixo: boolean }>();
  if (!md) return map;
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cols.length < 3) continue;
    const model = cols[0].replace(/`/g, "").trim();
    const m = line.match(/(\d+)\s*\/\s*10/g);
    if (model && m && m.length >= 1) {
      const toolStr = m.length >= 2 ? m[1] : m[0];
      const num = parseInt(toolStr.split("/")[0], 10);
      if (!Number.isNaN(num)) {
        const shortName = model.includes("/") ? model.split("/").pop()! : model;
        map.set(model.toLowerCase(), { score: `${num}/10`, abaixo: num < 8 });
        map.set(shortName.toLowerCase(), { score: `${num}/10`, abaixo: num < 8 });
      }
    }
  }
  return map;
}

/**
 * Hidratação direta 100% viva via ctx.host.readFile (sem depender de host.spawn).
 * Funciona sempre dentro do Buzz Desktop, lendo kpis-esteira.json, controle-<tenant>.json,
 * empresas/<tenant>.json, docs/eval-modelos-onda5.md e cards reais do Kanban.
 */
async function hydrateFactoryStatusFromFiles(ctx: Context, slug: string): Promise<FactoryStatusPayload> {
  const base = buildEmptyFactoryStatus(slug);
  const host = (ctx as any)?.host;

  const [kpiRes, cards, empresaJson, evalMd, visionMd] = await Promise.all([
    fetchKpisEsteira(ctx).catch(() => ({ kpis: null, history: [], error: null })),
    fetchLiveKanbanCards(ctx, { empresa: slug }).catch(() => []),
    readOrgfyJson<any>(ctx, `empresas/${slug}.json`, null).catch(() => null),
    readOrgfyText(ctx, "docs/eval-modelos-onda5.md").catch(() => null),
    readOrgfyText(ctx, "docs/VISION.md").catch(() => null),
  ]);

  let controle: Record<string, any> | null = null;
  try {
    if (host?.readFile) {
      const raw = await host.readFile(getControlePath(slug));
      const txt = raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw || "");
      controle = JSON.parse(txt);
    }
  } catch {
    controle = null;
  }

  const snap = (ctx as any)?.agents?.snapshot?.() || {};
  const runningList: any[] = Array.isArray(snap.running) ? snap.running : [];
  const allAgents: any[] = Array.isArray(snap.agents) ? snap.agents : [];
  const liveByName = new Map<string, any>();
  for (const a of allAgents) {
    if (a?.name) liveByName.set(String(a.name).toLowerCase(), a);
  }

  const evalMap = parseEvalTable(evalMd);
  const modelos: AgentModelEvalRow[] = [];
  const agentesObj = empresaJson?.agentes && typeof empresaJson.agentes === "object" ? empresaJson.agentes : {};
  for (const [agName, info] of Object.entries(agentesObj as Record<string, any>)) {
    const live = liveByName.get(agName.toLowerCase());
    const modelo = String(live?.config?.model || info?.model || "").trim() || null;
    const provider = String(live?.config?.provider || info?.provider || "").trim() || null;
    const ev = modelo ? evalMap.get(modelo.toLowerCase()) || evalMap.get((modelo.split("/").pop() || "").toLowerCase()) : undefined;
    modelos.push({
      agente: agName,
      papel: info?.papel || null,
      modelo,
      provider,
      toolcall_eval: ev?.score || null,
      abaixo_minimo: Boolean(ev?.abaixo),
    });
  }

  const toWorkItem = (c: any): FactoryWorkItem => ({
    id: String(c.fullIssueId || c.issueId || c.id),
    title: String(c.title || "Card"),
    workKey: String(c.issueId || c.id),
    stage:
      c.stage === "feito"
        ? "merged"
        : c.stage === "revisao"
        ? "verifying"
        : c.stage === "execucao" || c.stage === "despachado"
        ? "building"
        : "backlog",
    step:
      c.stage === "feito"
        ? "done"
        : c.stage === "revisao"
        ? "review"
        : c.stage === "execucao"
        ? "implement"
        : "intake",
    type: /fix|bug|hotfix/i.test(String(c.title || "")) ? "bug" : /doc|readme|prd/i.test(String(c.title || "")) ? "docs" : "feature",
    attempts: Array.isArray(c.rejectionHistory) ? c.rejectionHistory.length + 1 : 1,
    sessionId: null,
    activeSessionId: null,
    reason: null,
    note: c.executor ? `Executor: ${c.executor}${c.revisor ? ` · Revisor: ${c.revisor}` : ""}` : null,
    updatedAt: Date.now(),
  });

  const backlog = cards.filter((c) => c.stage === "triagem").map(toWorkItem);
  const inProgress = cards.filter((c) => c.stage === "despachado" || c.stage === "execucao" || c.stage === "revisao").map(toWorkItem);
  const recent = cards.filter((c) => c.stage === "feito").slice(0, 20).map(toWorkItem);

  const kpis = kpiRes.kpis;
  const killSwitch = Boolean(controle?.killSwitch);
  const drainOn = Boolean(controle?.drain);
  const mode: AutonomyMode = VALID_MODES.has(String(controle?.mode)) ? controle!.mode : "software_factory";

  return {
    ...base,
    mode,
    killSwitch,
    drain: drainOn ? { since: Date.now(), inFlight: inProgress.length, total: inProgress.length, deadline: null } : null,
    loopState: killSwitch ? "stopped" : drainOn ? "draining" : inProgress.length > 0 || runningList.length > 0 ? "building" : "idle",
    pausedReason: controle?.pausedReason || null,
    limits: {
      maxConcurrentSessions: Number(controle?.limits?.agentes ?? 4),
      maxMergesPerDay: Number(controle?.limits?.mergesDia ?? 20),
      dailyBudget: { usd: Number(controle?.limits?.gastoDiaUsd ?? 50) },
      pauseAfterConsecutiveFailures: Number(controle?.limits?.falhasSeguidas ?? 3),
      autoMerge: Boolean(controle?.autoMerge ?? false),
      mergePolicy: controle?.mergePolicy === "fast" ? "fast" : "strict",
    },
    spendToday: {
      tokens: Number((kpis as any)?.economia?.tokens_hoje ?? 0),
      usd: Number((kpis as any)?.economia?.custo_hoje_usd ?? 0),
    },
    mergesToday: Number((kpis as any)?.fluxo?.vazao_hoje ?? 0),
    stats: {
      mergedToday: Number((kpis as any)?.fluxo?.vazao_hoje ?? 0),
      failedToday: 0,
      revertedToday: 0,
      medianMergeMs7d: null,
      merged7d: Number((kpis as any)?.fluxo?.vazao_7d ?? recent.length),
    },
    activeSessions: runningList.length,
    wip: {
      openPrs: inProgress.length,
      limit: Number(controle?.limits?.prsAbertos ?? 6),
      holding: inProgress.length >= Number(controle?.limits?.prsAbertos ?? 6),
      waitingOnProvider: 0,
      note: null,
    },
    backlog,
    inProgress,
    recent,
    viewRecent: recent,
    visionExists: Boolean(visionMd && visionMd.trim().length > 0),
    lastTickAt: Date.now(),
    coordenador: killSwitch ? "parado" : "ativo",
    kpis: kpis
      ? {
          disponivel: true,
          gerado_em: kpis.gerado_em || null,
          fluxo: kpis.fluxo || null,
          qualidade: kpis.qualidade || null,
          economia: kpis.economia || null,
          higiene: kpis.higiene || null,
        }
      : { disponivel: false },
    modelos,
    indisponivel: kpis ? ["lastDigest", "lessons", "mergeChecks", "pullRequests", "scout", "spotChecks"] : ["kpis-esteira.json", "lastDigest", "lessons"],
  };
}

export async function fetchFactoryStatus(ctx: Context, tenant = "orgfy"): Promise<{
  ok: boolean;
  status: FactoryStatusPayload;
  error: string | null;
}> {
  const slug = (tenant || "orgfy").trim().toLowerCase() || "orgfy";
  const host = (ctx as any)?.host;

  // 1) Tenta host.spawn quando disponível (CLI/ambiente com subprocessos)
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
  } catch {
    // Cai para leitura direta via host.readFile abaixo (sem mostrar erro ao usuário!)
  }

  // 2) Hidratação direta nativa via ctx.host.readFile (100% real dentro do Buzz Desktop)
  try {
    const hydrated = await hydrateFactoryStatusFromFiles(ctx, slug);
    return { ok: true, status: hydrated, error: null };
  } catch (err: any) {
    return {
      ok: false,
      status: buildEmptyFactoryStatus(slug, err?.message || "Falha ao ler dados do tenant"),
      error: err?.message || String(err),
    };
  }
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
