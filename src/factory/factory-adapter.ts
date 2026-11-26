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

export interface TenantAgentSpec {
  name: string;
  papel: string;
  funcao: string;
  categoria: "lideranca" | "execucao" | "revisao" | "operacao";
  pubkey: string;
  model: string;
  provider: string;
  parallelism: number;
  running: boolean;
  inBuzz: boolean;
  agentKey: string;
}

export interface TenantManifestInfo {
  slug: string;
  nome: string;
  repoId: string;
  nivel: string;
  canal: string | null;
  ceoEmpresa: string;
  coo: string;
  modoExecucao: string;
  ciModo: string;
  ciCmd: string;
  probesObrigatorios: boolean;
  probesCount: number;
  budgetTokensDiario: number | null;
  tokensPorCard: number | null;
  cpiMinimo: number | null;
  revisoresPorSuperficie: Record<string, string>;
  agentes: TenantAgentSpec[];
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
  tenantManifest?: TenantManifestInfo;
  orgfyVision?: {
    projectMd: string | null;
    agentsMd: string | null;
    invariantes: string[];
    cadeiaComando: string[];
    fluxoEscalada: Record<string, string>;
    regrasProbatorias: Array<{ id: string; descricao: string; status: string; cardsAvaliados: number; janelaAlvo: number }>;
    canalBuzz: string | null;
    papeis: Record<string, string>;
  };
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

function describeOrgfyRole(papelRaw: string | null | undefined): {
  funcao: string;
  categoria: "lideranca" | "execucao" | "revisao" | "operacao";
} {
  const p = String(papelRaw || "").trim().toLowerCase();
  const map: Record<string, { funcao: string; categoria: "lideranca" | "execucao" | "revisao" | "operacao" }> = {
    ceo: { funcao: "CEO Master · Orquestrador da Holding", categoria: "lideranca" },
    ceo_holding: { funcao: "CEO Master · Orquestrador da Holding", categoria: "lideranca" },
    ceo_empresa: { funcao: "CEO da Empresa · Direção & Decisão", categoria: "lideranca" },
    coo: { funcao: "COO · Operações, Despacho & Auto-cura", categoria: "lideranca" },
    arquiteto: { funcao: "Arquiteto · Design Técnico & Revisão Estrutural", categoria: "lideranca" },
    backend: { funcao: "Executor Backend · APIs & Serviços", categoria: "execucao" },
    frontend: { funcao: "Executor Frontend · Interface & UX", categoria: "execucao" },
    infra: { funcao: "Executor Infra · CI/CD, Deploy & Runtime", categoria: "execucao" },
    executor: { funcao: "Executor · Implementação em Worktree", categoria: "execucao" },
    release: { funcao: "Release · Empacotamento & Entrega", categoria: "execucao" },
    prompts: { funcao: "Engenharia de Prompts & Regras", categoria: "execucao" },
    growth: { funcao: "Growth & Aquisição", categoria: "execucao" },
    pesquisa: { funcao: "Pesquisa Técnica & Descoberta", categoria: "execucao" },
    qa: { funcao: "Revisor de Código & QA (Gate L-01)", categoria: "revisao" },
    revisor_codigo: { funcao: "Revisor de Código & QA (Gate L-01)", categoria: "revisao" },
    revisor_metodo: { funcao: "Revisor de Método & Specsfy (L-01)", categoria: "revisao" },
    revisor_seguranca: { funcao: "Revisor de Segurança & Auditoria", categoria: "revisao" },
    seguranca: { funcao: "Revisor de Segurança & Auditoria", categoria: "revisao" },
    revisor_ui: { funcao: "Revisor de UI & Acessibilidade", categoria: "revisao" },
    oraculo: { funcao: "Oráculo · Scout & Inteligência", categoria: "operacao" },
    po: { funcao: "Product Owner · Escopo & Critérios L-22", categoria: "operacao" },
    cron: { funcao: "Cron · Rotinas Agendadas da Esteira", categoria: "operacao" },
  };
  return map[p] || { funcao: p ? `Agente · ${p}` : "Agente da Esteira", categoria: "execucao" };
}

/**
 * Hidratação direta 100% viva via ctx.host.readFile (sem depender de host.spawn).
 * Funciona sempre dentro do Buzz Desktop, lendo kpis-esteira.json, controle-<tenant>.json,
 * empresas/<tenant>.json, docs/eval-modelos-onda5.md e cards reais do Kanban.
 */
async function hydrateFactoryStatusFromFiles(ctx: Context, slug: string): Promise<FactoryStatusPayload> {
  const base = buildEmptyFactoryStatus(slug);
  const host = (ctx as any)?.host;

  const stateRelPath = slug === "orgfy" ? ".esteira/estado/esteira-minima-state.json" : `.esteira/estado/esteira-minima-${slug}-state.json`;
  const [kpiRes, cards, empresaJson, boardJson, evalMd, projectMd, agentsMd, regrasJson, esteiraState] = await Promise.all([
    fetchKpisEsteira(ctx).catch(() => ({ kpis: null, history: [], error: null })),
    fetchLiveKanbanCards(ctx, { empresa: slug }).catch(() => []),
    readOrgfyJson<any>(ctx, `empresas/${slug}.json`, null).catch(() => null),
    readOrgfyJson<any>(ctx, "empresas/board.json", null).catch(() => null),
    readOrgfyText(ctx, "docs/eval-modelos-onda5.md").catch(() => null),
    readOrgfyText(ctx, "PROJECT.md").catch(() => null),
    readOrgfyText(ctx, "AGENTS.md").catch(() => null),
    readOrgfyJson<any>(ctx, ".esteira/estado/regras-probatorias.json", null).catch(() => null),
    readOrgfyJson<any>(ctx, stateRelPath, null).catch(() => null),
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
  if (!controle && typeof localStorage !== "undefined") {
    try {
      const cached = localStorage.getItem(`orgfy_controle_cache_${slug}`);
      if (cached) controle = JSON.parse(cached);
    } catch {}
  }

  const snap = (ctx as any)?.agents?.snapshot?.() || {};
  const runningList: any[] = Array.isArray(snap.running) ? snap.running : [];
  const allAgents: any[] = Array.isArray(snap.agents) ? snap.agents : [];
  const runningKeys = new Set(runningList.map((a: any) => String(a?.key || a?.name || "").toLowerCase()));
  const runningPubkeys = new Set(runningList.map((a: any) => String(a?.pubkey || "").toLowerCase()).filter(Boolean));
  const liveByName = new Map<string, any>();
  const liveByPubkey = new Map<string, any>();
  for (const a of allAgents) {
    if (a?.name) liveByName.set(String(a.name).toLowerCase(), a);
    if (a?.pubkey) liveByPubkey.set(String(a.pubkey).toLowerCase(), a);
  }

  const evalMap = parseEvalTable(evalMd);
  const modelos: AgentModelEvalRow[] = [];
  const tenantAgents: TenantAgentSpec[] = [];
  const agentesObj = empresaJson?.agentes && typeof empresaJson.agentes === "object" ? empresaJson.agentes : {};
  for (const [agName, info] of Object.entries(agentesObj as Record<string, any>)) {
    const manifestPk = typeof info?.pubkey === "string" ? info.pubkey.trim() : "";
    const live =
      (manifestPk && liveByPubkey.get(manifestPk.toLowerCase())) ||
      liveByName.get(agName.toLowerCase()) ||
      null;
    const modelo = String(live?.config?.model || info?.model || "").trim() || null;
    const provider = String(live?.config?.provider || info?.provider || "").trim() || null;
    const ev = modelo ? evalMap.get(modelo.toLowerCase()) || evalMap.get((modelo.split("/").pop() || "").toLowerCase()) : undefined;
    const roleMeta = describeOrgfyRole(info?.papel);
    const liveKey = String(live?.key || "");
    const livePk = String(live?.pubkey || manifestPk || "");
    const isRunning = Boolean(
      (liveKey && runningKeys.has(liveKey.toLowerCase())) ||
      (livePk && runningPubkeys.has(livePk.toLowerCase())) ||
      runningKeys.has(agName.toLowerCase())
    );

    modelos.push({
      agente: agName,
      papel: info?.papel || null,
      modelo,
      provider,
      toolcall_eval: ev?.score || null,
      abaixo_minimo: Boolean(ev?.abaixo),
    });

    tenantAgents.push({
      name: agName,
      papel: String(info?.papel || "executor"),
      funcao: roleMeta.funcao,
      categoria: roleMeta.categoria,
      pubkey: livePk,
      model: modelo || "indisponível",
      provider: provider || "buzz",
      parallelism: Number(info?.parallelism ?? 1),
      running: isRunning,
      inBuzz: Boolean(live),
      agentKey: liveKey || `manifest:${slug}:${agName}`,
    });
  }

  const tenantManifest: TenantManifestInfo = {
    slug,
    nome: String(empresaJson?.hierarquia?.workspace_buzz || empresaJson?.empresa || slug),
    repoId: String(empresaJson?.repo_id || slug),
    nivel: String(empresaJson?.hierarquia?.nivel || "subsidiaria"),
    canal: typeof empresaJson?.canal === "string" ? empresaJson.canal : null,
    ceoEmpresa: String(empresaJson?.hierarquia?.ceo_empresa || empresaJson?.papeis?.ceo_empresa || "OrgFy Iris"),
    coo: String(empresaJson?.papeis?.coo || "OrgFy Bento"),
    modoExecucao: String(empresaJson?.modo_execucao_workers || "efemero_headless"),
    ciModo: String(empresaJson?.ci_runner?.modo_padrao || "local"),
    ciCmd: Array.isArray(empresaJson?.ci_runner?.cmd) ? empresaJson.ci_runner.cmd.join(" ") : "—",
    probesObrigatorios: Boolean(empresaJson?.probes_caixa_preta?.obrigatorio_no_gate),
    probesCount: Array.isArray(empresaJson?.probes_caixa_preta?.probes_padrao) ? empresaJson.probes_caixa_preta.probes_padrao.length : 0,
    budgetTokensDiario: typeof empresaJson?.governanca_orcamento?.budget_tokens_diario === "number" ? empresaJson.governanca_orcamento.budget_tokens_diario : null,
    tokensPorCard: typeof empresaJson?.governanca_orcamento?.tokens_planejados_por_card === "number" ? empresaJson.governanca_orcamento.tokens_planejados_por_card : null,
    cpiMinimo: typeof empresaJson?.governanca_orcamento?.cpi_minimo === "number" ? empresaJson.governanca_orcamento.cpi_minimo : null,
    revisoresPorSuperficie: empresaJson?.revisores_por_superficie && typeof empresaJson.revisores_por_superficie === "object" ? empresaJson.revisores_por_superficie : {},
    agentes: tenantAgents,
  };

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

  const kanbanBacklog = cards.filter((c) => c.stage === "triagem").map(toWorkItem);
  const kanbanInProgress = cards.filter((c) => c.stage === "despachado" || c.stage === "execucao" || c.stage === "revisao").map(toWorkItem);
  const recent = cards.filter((c) => c.stage === "feito").slice(0, 20).map(toWorkItem);

  // Mescla snapshot real do coordenador (esteira-minima-state.json) para refletir open_prs e open_issues reais no 3D e no WIP
  const boardSnap = esteiraState?.board_snapshot && typeof esteiraState.board_snapshot === "object" ? esteiraState.board_snapshot : null;
  const openPrsRaw: any[] = Array.isArray(boardSnap?.open_prs) ? boardSnap.open_prs : [];
  const openIssuesRaw: any[] = Array.isArray(boardSnap?.open_issues) ? boardSnap.open_issues : [];
  const seenIds = new Set<string>([...kanbanBacklog, ...kanbanInProgress].map((w) => w.id));
  const quarentenaMap =
    esteiraState?.quarentena && typeof esteiraState.quarentena === "object"
      ? (esteiraState.quarentena as Record<string, any>)
      : {};
  const prWorkItems: FactoryWorkItem[] = openPrsRaw
    .filter((p) => p?.id && !seenIds.has(String(p.id)))
    .map((p) => {
      const pid = String(p.id);
      const title = String(p.title || `PR ${pid.slice(0, 8)}`);
      const qEntry = quarentenaMap[pid];
      const isQuarantined = Boolean(p.quarentena || qEntry);
      const qReason =
        typeof qEntry?.motivo === "string" && qEntry.motivo.trim()
          ? `Quarentena (COO): ${qEntry.motivo.trim().slice(0, 180)}`
          : isQuarantined
          ? "PR em quarentena no coordenador (requer ação do COO OrgFy Bento)"
          : null;
      return {
        id: pid,
        title,
        workKey: `pr:${pid.slice(0, 12)}`,
        // Na governança OrgFy (board.json), falhas/quarentena da esteira vão para Problemas (COO Bento -> CEO Empresa -> Iris), nunca direto para "Aguardando você" (Fundador)
        stage: isQuarantined ? "failed" : "verifying",
        step: isQuarantined ? "quarantine" : "review",
        type: /fix|bug|hotfix/i.test(title) ? "bug" : /doc|readme|prd/i.test(title) ? "docs" : "feature",
        attempts: 1,
        sessionId: null,
        activeSessionId: null,
        reason: qReason,
        note: p.branch ? `PR aberto · ${p.branch}` : "PR aberto aguardando revisão/GATE",
        updatedAt: typeof p.created_at === "number" ? (p.created_at < 1e12 ? p.created_at * 1000 : p.created_at) : Date.now(),
      };
    });
  const issueBacklogItems: FactoryWorkItem[] = openIssuesRaw
    .filter((i) => i?.id && !i.assigned && !seenIds.has(String(i.id)))
    .map((i) => {
      const iid = String(i.id);
      const title = String(i.title || `Issue ${iid.slice(0, 8)}`);
      return {
        id: iid,
        title,
        workKey: `issue:${iid.slice(0, 12)}`,
        stage: "backlog",
        step: "intake",
        type: /fix|bug|hotfix/i.test(title) ? "bug" : /doc|readme|prd/i.test(title) ? "docs" : "feature",
        attempts: 0,
        sessionId: null,
        activeSessionId: null,
        reason: null,
        note: null,
        updatedAt: typeof i.created_at === "number" ? (i.created_at < 1e12 ? i.created_at * 1000 : i.created_at) : Date.now(),
      };
    });
  const issueActiveItems: FactoryWorkItem[] = openIssuesRaw
    .filter((i) => i?.id && i.assigned && !seenIds.has(String(i.id)))
    .map((i) => {
      const iid = String(i.id);
      const title = String(i.title || `Issue ${iid.slice(0, 8)}`);
      return {
        id: iid,
        title,
        workKey: `issue:${iid.slice(0, 12)}`,
        stage: "building",
        step: "implement",
        type: /fix|bug|hotfix/i.test(title) ? "bug" : /doc|readme|prd/i.test(title) ? "docs" : "feature",
        attempts: 1,
        sessionId: null,
        activeSessionId: null,
        reason: null,
        note: "Issue atribuída no coordenador",
        updatedAt: typeof i.created_at === "number" ? (i.created_at < 1e12 ? i.created_at * 1000 : i.created_at) : Date.now(),
      };
    });

  const backlog = kanbanBacklog.length > 0 ? kanbanBacklog : issueBacklogItems;
  const inProgress = [...kanbanInProgress, ...prWorkItems, ...(kanbanInProgress.length === 0 ? issueActiveItems.slice(0, 12) : [])];
  const wipLimit = Number(controle?.limits?.prsAbertos ?? 6);
  const realOpenPrs = openPrsRaw.length > 0 ? openPrsRaw.length : inProgress.length;
  const wipHolding = realOpenPrs >= wipLimit;
  const wipNote = wipHolding
    ? `WIP bloqueando novos despachos: ${realOpenPrs} PRs abertos (limite configurado: ${wipLimit})`
    : null;

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
    activeSessions: tenantAgents.filter((a) => a.running).length,
    wip: {
      openPrs: realOpenPrs,
      limit: wipLimit,
      holding: wipHolding,
      waitingOnProvider: 0,
      note: wipNote,
    },
    pullRequests: openPrsRaw,
    quarentenaCount: esteiraState?.quarentena && typeof esteiraState.quarentena === "object" ? Object.keys(esteiraState.quarentena).length : 0,
    backlog,
    inProgress,
    recent,
    viewRecent: recent,
    visionExists: Boolean(projectMd || boardJson || empresaJson),
    tenantManifest,
    orgfyVision: {
      projectMd: projectMd ? projectMd.slice(0, 2400) : null,
      agentsMd: agentsMd ? agentsMd.slice(0, 2400) : null,
      invariantes: Array.isArray(boardJson?.protocolo_governanca?.invariantes) ? boardJson.protocolo_governanca.invariantes : [],
      cadeiaComando: Array.isArray(boardJson?.protocolo_governanca?.cadeia_comando) ? boardJson.protocolo_governanca.cadeia_comando : [],
      fluxoEscalada: boardJson?.fluxo_escalada && typeof boardJson.fluxo_escalada === "object" ? boardJson.fluxo_escalada : {},
      regrasProbatorias: Object.entries((regrasJson?.regras || {}) as Record<string, any>).map(([id, r]) => ({
        id,
        descricao: String(r?.descricao || id),
        status: String(r?.status || "ATIVA"),
        cardsAvaliados: Number(r?.cards_avaliados || 0),
        janelaAlvo: Number(r?.janela_alvo || 10),
      })),
      canalBuzz: typeof empresaJson?.canal === "string" ? empresaJson.canal : null,
      papeis: empresaJson?.papeis && typeof empresaJson.papeis === "object" ? empresaJson.papeis : {},
    },
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
    autoMerge?: boolean;
    mergePolicy?: "fast" | "strict";
    pausedReason?: string | null;
    limits?: {
      gastoDiaUsd?: number;
      mergesDia?: number;
      agentes?: number;
      prsAbertos?: number;
      falhasSeguidas?: number;
    };
  }
): Promise<{ ok: boolean; path: string; control: Record<string, any>; error?: string }> {
  const slug = (tenant || "orgfy").trim().toLowerCase() || "orgfy";
  const path = getControlePath(slug);
  const host = (ctx as any)?.host;
  let current: Record<string, any> = {
    tenant: slug,
    mode: "software_factory",
    killSwitch: false,
    drain: false,
    autoMerge: false,
    mergePolicy: "strict",
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
  const mergedLimits = { ...(current.limits || {}), ...(patch.limits || {}) };
  const sanitizedLimits = {
    gastoDiaUsd: Math.max(0, Number.isFinite(Number(mergedLimits.gastoDiaUsd)) ? Number(mergedLimits.gastoDiaUsd) : 50),
    mergesDia: Math.max(0, Math.round(Number.isFinite(Number(mergedLimits.mergesDia)) ? Number(mergedLimits.mergesDia) : 20)),
    agentes: Math.max(1, Math.round(Number.isFinite(Number(mergedLimits.agentes)) ? Number(mergedLimits.agentes) : 4)),
    prsAbertos: Math.max(1, Math.round(Number.isFinite(Number(mergedLimits.prsAbertos)) ? Number(mergedLimits.prsAbertos) : 6)),
    falhasSeguidas: Math.max(1, Math.round(Number.isFinite(Number(mergedLimits.falhasSeguidas)) ? Number(mergedLimits.falhasSeguidas) : 3)),
  };
  const next = {
    ...current,
    ...patch,
    mergePolicy: (patch.mergePolicy || current.mergePolicy) === "fast" ? "fast" : "strict",
    limits: sanitizedLimits,
    tenant: slug,
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(next, null, 2) + "\n";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`orgfy_controle_cache_${slug}`, serialized);
    }
  } catch {}
  try {
    if (typeof (ctx as any)?.artifactStorage?.set === "function") {
      await (ctx as any).artifactStorage.set(`orgfy:controle:${slug}`, next);
    }
  } catch {}

  // 1) Caminho oficial no Buzz Desktop: host.runCommand("orgfy-controle-write", stdin)
  if (typeof host?.runCommand === "function") {
    try {
      const out = await host.runCommand(
        "orgfy-controle-write",
        JSON.stringify({ kind: "controle", tenant: slug, control: next })
      );
      if (out) {
        const parsed = JSON.parse(out);
        if (parsed?.ok) {
          return { ok: true, path: parsed.path || path, control: parsed.control || next };
        }
        return { ok: false, path, control: next, error: parsed?.error || "Falha em orgfy-controle-write" };
      }
    } catch (err: any) {
      if (!host?.writeFile) {
        return { ok: false, path, control: next, error: err?.message || String(err) };
      }
    }
  }

  // 2) Caminho direto para testes unitários / hosts com writeFile
  if (typeof host?.writeFile === "function") {
    try {
      await host.writeFile(path, serialized);
      return { ok: true, path, control: next };
    } catch (err: any) {
      return { ok: false, path, control: next, error: err?.message || String(err) };
    }
  }

  return { ok: true, path, control: next };
}
