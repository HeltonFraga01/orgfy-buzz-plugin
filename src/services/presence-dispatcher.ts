// ─────────────────────────────────────────────────────────────────────────────
// ORGFY PRESENCE & LEASE RECONCILER + ONE-SHOT DECISION DISPATCHER (v13.5)
// 1. Presence & Lease Reconciler: mata o estado "trabalhando zumbi" cruzando
//    orgfy-locks.json x ctx.agents.snapshot().running x sessionState x radar.
// 2. orgfy_roster_live: Raio-X unificado de presença/capacidade em 1 chamada.
// 3. orgfy_handoff_pack: Pacote compacto de retomada/revisão (P1..Pn + git).
// 4. orgfy_smart_dispatch: Dispatcher híbrido Zero-Token + ctx.decisions one-shot.
// 5. Event Bus `orgfy.pipeline` + Auto-limpeza de Buzz Attention/Watch.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import {
  listActiveLocks,
  acquireCheckoutLock,
  releaseCheckoutLock,
  findWriteSetOverlap,
  DEFAULT_ORGFY_CHANNEL,
  type CheckoutLockRecord,
} from "./governance-engine";
import { fetchGooseLoopRadar } from "./kpi-service";
import { parseCardProgress, type CardProgressSummary } from "./card-progress";
import {
  triageCardWithDecisions,
  buildBuzzAttentionContract,
  type BuzzAttentionContract,
} from "./decision-router";
import { recordGenAISpan, recordDecisionTelemetry } from "./telemetry-otel";
import { isUnsupportedAgentModel } from "./model-failover";

export const DEFAULT_LEASE_MS = 8 * 60 * 1000; // 8 min lease curto renovável
export const DEFAULT_ORPHAN_GRACE_MS = 3 * 60 * 1000; // 3 min sem sessão ativa => órfão
import { ORGFY_CARDS_DIR as CARDS_DIR, ORGFY_EMPRESAS_DIR as EMPRESAS_DIR } from "../config";

export type OrgfyPipelineEventType =
  | "lock.orphaned_released"
  | "presence.reconciled"
  | "card.auto_dispatched"
  | "card.escalated_coo"
  | "card.ready_for_review"
  | "gate.rejected_dsap"
  | "loop.detected"
  | "ci.failed"
  | "budget.80pct"
  | "attention.cleaned_up"
  | "question_card.created";

export interface OrgfyPipelineEvent {
  id: string;
  type: OrgfyPipelineEventType;
  timestamp: string;
  empresa: string;
  issueId?: string;
  agent?: string;
  summary: string;
  payload?: Record<string, any>;
}

const pipelineEventsBuffer: OrgfyPipelineEvent[] = [];
const pipelineEventListeners = new Set<(ev: OrgfyPipelineEvent) => void>();
const MAX_PIPELINE_EVENTS = 80;

export function emitOrgfyPipelineEvent(
  event: Omit<OrgfyPipelineEvent, "id" | "timestamp">
): OrgfyPipelineEvent {
  const full: OrgfyPipelineEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  pipelineEventsBuffer.push(full);
  if (pipelineEventsBuffer.length > MAX_PIPELINE_EVENTS) {
    pipelineEventsBuffer.splice(0, pipelineEventsBuffer.length - MAX_PIPELINE_EVENTS);
  }
  recordGenAISpan({
    operationName: "attention.emit",
    agentName: event.agent || "orgfy-presence-engine",
    durationMs: 0,
    status: "ok",
    attributes: {
      "orgfy.event.type": event.type,
      "orgfy.empresa": event.empresa,
      ...(event.issueId ? { "orgfy.issue_id": event.issueId } : {}),
    },
  });
  for (const fn of pipelineEventListeners) {
    try {
      fn(full);
    } catch {
      // Listener isolado
    }
  }
  return full;
}

export function getOrgfyPipelineEvents(limit: number = 30): OrgfyPipelineEvent[] {
  return pipelineEventsBuffer.slice(-Math.max(1, limit)).reverse();
}

export function subscribeOrgfyPipelineEvents(
  listener: (ev: OrgfyPipelineEvent) => void
): () => void {
  pipelineEventListeners.add(listener);
  return () => pipelineEventListeners.delete(listener);
}

export function resetPresenceStateForTests(): void {
  pipelineEventsBuffer.length = 0;
}

function decodeText(raw: any): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}

function normName(v: string): string {
  return String(v || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}

export interface OrphanedLockRelease {
  issueId: string;
  agentKey: string;
  title?: string;
  exclusivePaths?: string[];
  reason: string;
  releasedAt: string;
}

export interface PresenceReconcileResult {
  ok: boolean;
  reconciledAt: string;
  checkedLocks: number;
  renewedCount: number;
  activeLocks: CheckoutLockRecord[];
  orphanedReleased: OrphanedLockRelease[];
}

/**
 * Cruza orgfy-locks.json x ctx.agents.snapshot().running x ctx.agents.sessionState
 * x goose-loop-radar.json. Libera imediatamente locks zumbis de agentes que pararam,
 * caíram ou ficaram para trás após reinício do Buzz Desktop.
 */
export async function reconcileAgentPresenceAndLocks(
  ctx: Context | any,
  options: {
    nowMs?: number;
    orphanGraceMs?: number;
    leaseMs?: number;
    isStartup?: boolean;
    bootMs?: number;
    empresa?: string;
  } = {}
): Promise<PresenceReconcileResult> {
  const nowMs = options.nowMs ?? Date.now();
  const orphanGraceMs = options.orphanGraceMs ?? DEFAULT_ORPHAN_GRACE_MS;
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const empresa = options.empresa || "orgfy";

  const locks = await listActiveLocks(ctx, nowMs);
  const agentsApi = ctx?.agents;
  const snap = agentsApi?.snapshot?.() || {};
  const runningList: any[] = Array.isArray(snap.running) ? snap.running : [];
  const allAgents: any[] = Array.isArray(snap.agents) ? snap.agents : [];

  const radar = await fetchGooseLoopRadar(ctx).catch(() => null);
  const activeRadarSessions = (radar?.ok && Array.isArray(radar.sessoes) ? radar.sessoes : []).filter(
    (s) => (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 5)
  );

  let renewedCount = 0;
  const orphanedReleased: OrphanedLockRelease[] = [];
  const remainingActive: CheckoutLockRecord[] = [];

  for (const lock of locks) {
    const matchedAgent =
      runningList.find(
        (a) =>
          namesMatch(a?.key || "", lock.agentKey) ||
          namesMatch(a?.name || "", lock.agentKey) ||
          namesMatch(a?.pubkey || "", lock.agentKey)
      ) ||
      allAgents.find(
        (a) =>
          namesMatch(a?.key || "", lock.agentKey) ||
          namesMatch(a?.name || "", lock.agentKey) ||
          namesMatch(a?.pubkey || "", lock.agentKey)
      );

    const isInRunning = runningList.some(
      (a) =>
        namesMatch(a?.key || "", lock.agentKey) ||
        namesMatch(a?.name || "", lock.agentKey) ||
        namesMatch(a?.pubkey || "", lock.agentKey)
    );

    let sessionStateVal: string | null = null;
    if (matchedAgent?.key && typeof agentsApi?.sessionState === "function") {
      try {
        sessionStateVal = String(
          agentsApi.sessionState(matchedAgent.key, { channelId: DEFAULT_ORGFY_CHANNEL }) || ""
        ).toLowerCase();
      } catch {
        sessionStateVal = null;
      }
    }

    const recentRadarSession = activeRadarSessions.find(
      (s) =>
        namesMatch(s.agente || "", lock.agentKey) ||
        (s.agent_pubkey && namesMatch(s.agent_pubkey, lock.agentKey))
    );
    const hasRecentRadarActivity = Boolean(
      recentRadarSession &&
        Number(recentRadarSession.ultima_atualizacao_min ?? 99) <= Math.max(2, orphanGraceMs / 60000) &&
        !recentRadarSession.last_msg_is_provider_error
    );

    const isActuallyWorking =
      isInRunning || sessionStateVal === "active" || sessionStateVal === "running" || hasRecentRadarActivity;

    const lastBeat = Number((lock as any).lastHeartbeatAt || lock.acquiredAt || nowMs);
    const idleMs = Math.max(0, nowMs - lastBeat);
    const isPreBootStale = Boolean(options.isStartup && options.bootMs && lock.acquiredAt < options.bootMs);

    if (isActuallyWorking) {
      // Renova lease curto automaticamente enquanto o agente estiver realmente vivo
      const renewed = await acquireCheckoutLock(ctx, lock.issueId, lock.agentKey, leaseMs, nowMs, {
        title: lock.title,
        owner: lock.owner,
        revisor: lock.revisor,
        acceptanceCommand: lock.acceptanceCommand,
        branch: lock.branch,
        exclusivePaths: lock.exclusivePaths,
      });
      if (renewed.ok && renewed.lock) {
        (renewed.lock as any).lastHeartbeatAt = nowMs;
        remainingActive.push(renewed.lock);
        renewedCount++;
      } else {
        remainingActive.push(lock);
      }
    } else if (isPreBootStale || idleMs >= orphanGraceMs) {
      const reason = isPreBootStale
        ? "ORPHANED_AFTER_RESTART: lock anterior ao boot sem sessão ativa no Buzz Desktop"
        : `ORPHANED_IDLE_${Math.round(idleMs / 60000)}M: agente sem sessão ativa/heartbeat no Buzz Desktop`;
      await releaseCheckoutLock(ctx, lock.issueId, undefined, true);
      const releasedItem: OrphanedLockRelease = {
        issueId: lock.issueId,
        agentKey: lock.agentKey,
        title: lock.title,
        exclusivePaths: lock.exclusivePaths,
        reason,
        releasedAt: new Date(nowMs).toISOString(),
      };
      orphanedReleased.push(releasedItem);
      emitOrgfyPipelineEvent({
        type: "lock.orphaned_released",
        empresa,
        issueId: lock.issueId,
        agent: lock.agentKey,
        summary: `Lock órfão de ${lock.agentKey} em ${lock.issueId.slice(0, 8)} liberado automaticamente (${reason}).`,
        payload: releasedItem,
      });
    } else {
      remainingActive.push(lock);
    }
  }

  return {
    ok: true,
    reconciledAt: new Date(nowMs).toISOString(),
    checkedLocks: locks.length,
    renewedCount,
    activeLocks: remainingActive,
    orphanedReleased,
  };
}

export interface LiveRosterAgent {
  name: string;
  key: string;
  pubkey?: string;
  role: string;
  status: "FREE" | "WORKING_REAL" | "ALERT_RADAR" | "MODEL_UNSUPPORTED";
  model: string | null;
  provider: string | null;
  isRunningInBuzz: boolean;
  sessionState: string | null;
  activeLock: {
    issueId: string;
    title?: string;
    exclusivePaths?: string[];
    leaseRemainingMin: number;
  } | null;
  radarFlags: string[];
  lastRadarUpdateMin: number | null;
}

export interface LiveAgentRosterResult {
  ok: boolean;
  empresa: string;
  generatedAt: string;
  resumo: {
    total: number;
    livres: number;
    trabalhando_real: number;
    em_alerta_radar: number;
    modelo_invalido: number;
    locks_orfaos_liberados: number;
  };
  agentes: LiveRosterAgent[];
  orphanedReleased: OrphanedLockRelease[];
}

async function loadEmpresaRoles(ctx: Context | any, empresa: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const host = ctx?.host;
  if (!host?.readFile) return map;
  try {
    const raw = await host.readFile(`${EMPRESAS_DIR}/${empresa}.json`);
    const parsed = JSON.parse(decodeText(raw));
    if (Array.isArray(parsed?.agentes)) {
      for (const a of parsed.agentes) {
        if (a?.nome) map.set(normName(a.nome), String(a.papel || "executor"));
      }
    } else if (parsed?.agentes && typeof parsed.agentes === "object") {
      for (const [nome, cfg] of Object.entries(parsed.agentes as Record<string, any>)) {
        map.set(normName(nome), String(cfg?.papel || "executor"));
      }
    }
  } catch {
    // Manifesto opcional
  }
  return map;
}

/**
 * Tool `orgfy_roster_live`: devolve em 1 única chamada a verdade real de quem está
 * livre, trabalhando de fato ou em alerta — já reconciliando locks zumbis.
 */
export async function buildLiveAgentRoster(
  ctx: Context | any,
  options: { empresa?: string; nowMs?: number; reconcile?: boolean } = {}
): Promise<LiveAgentRosterResult> {
  const nowMs = options.nowMs ?? Date.now();
  const empresa = String(options.empresa || "orgfy").trim() || "orgfy";

  const recon =
    options.reconcile !== false
      ? await reconcileAgentPresenceAndLocks(ctx, { nowMs, empresa })
      : {
          activeLocks: await listActiveLocks(ctx, nowMs),
          orphanedReleased: [],
        };

  const rolesMap = await loadEmpresaRoles(ctx, empresa);
  const agentsApi = ctx?.agents;
  const snap = agentsApi?.snapshot?.() || {};
  const runningList: any[] = Array.isArray(snap.running) ? snap.running : [];
  const allList: any[] = Array.isArray(snap.agents) ? snap.agents : [];

  const radar = await fetchGooseLoopRadar(ctx).catch(() => null);
  const radarSessions = radar?.ok && Array.isArray(radar.sessoes) ? radar.sessoes : [];

  const seen = new Set<string>();
  const pool: any[] = [];
  for (const a of [...runningList, ...allList]) {
    if (!a) continue;
    const id = String(a.key || a.name || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    pool.push(a);
  }

  const agentes: LiveRosterAgent[] = pool.map((a) => {
    const name = String(a.name || a.key || "unknown").trim();
    const key = String(a.key || name).trim();
    const pubkey = a.pubkey ? String(a.pubkey) : undefined;
    const model = a?.config?.model ? String(a.config.model) : null;
    const provider = a?.config?.provider ? String(a.config.provider) : null;
    const isRunningInBuzz = runningList.some(
      (r) => String(r?.key || "") === key || namesMatch(r?.name || "", name)
    );

    let sessionState: string | null = null;
    if (typeof agentsApi?.sessionState === "function") {
      try {
        sessionState = String(
          agentsApi.sessionState(key, { channelId: DEFAULT_ORGFY_CHANNEL }) || ""
        ).toLowerCase() || null;
      } catch {
        sessionState = null;
      }
    }

    const activeLockRec = recon.activeLocks.find(
      (l) => namesMatch(l.agentKey, name) || namesMatch(l.agentKey, key) || (pubkey && namesMatch(l.agentKey, pubkey))
    );

    const agentRadar = radarSessions.find(
      (s) =>
        (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15) &&
        (namesMatch(s.agente || "", name) || (pubkey && s.agent_pubkey && namesMatch(s.agent_pubkey, pubkey)))
    );

    const radarFlags = Array.isArray(agentRadar?.flags) ? agentRadar.flags : [];
    const hasCriticalRadar = Boolean(
      agentRadar && (agentRadar.severidade === "critical" || agentRadar.last_msg_is_provider_error)
    );
    const badModel = Boolean(model && isUnsupportedAgentModel(model));

    let status: LiveRosterAgent["status"] = "FREE";
    if (badModel) {
      status = "MODEL_UNSUPPORTED";
    } else if (hasCriticalRadar) {
      status = "ALERT_RADAR";
    } else if (isRunningInBuzz || sessionState === "active" || Boolean(activeLockRec)) {
      status = "WORKING_REAL";
    }

    const role =
      rolesMap.get(normName(name)) ||
      (normName(name).includes("iris")
        ? "ceo_holding"
        : normName(name).includes("bento arquiteto")
        ? "arquiteto"
        : normName(name).includes("bento")
        ? "coo"
        : normName(name).includes("teo") || normName(name).includes("vera") || normName(name).includes("sentinel")
        ? "revisor"
        : "executor");

    return {
      name,
      key,
      pubkey,
      role,
      status,
      model,
      provider,
      isRunningInBuzz,
      sessionState,
      activeLock: activeLockRec
        ? {
            issueId: activeLockRec.issueId,
            title: activeLockRec.title,
            exclusivePaths: activeLockRec.exclusivePaths,
            leaseRemainingMin: Math.max(0, Math.round((activeLockRec.expiresAt - nowMs) / 60000)),
          }
        : null,
      radarFlags,
      lastRadarUpdateMin: agentRadar ? Number(agentRadar.ultima_atualizacao_min ?? null) : null,
    };
  });

  return {
    ok: true,
    empresa,
    generatedAt: new Date(nowMs).toISOString(),
    resumo: {
      total: agentes.length,
      livres: agentes.filter((a) => a.status === "FREE").length,
      trabalhando_real: agentes.filter((a) => a.status === "WORKING_REAL").length,
      em_alerta_radar: agentes.filter((a) => a.status === "ALERT_RADAR").length,
      modelo_invalido: agentes.filter((a) => a.status === "MODEL_UNSUPPORTED").length,
      locks_orfaos_liberados: recon.orphanedReleased.length,
    },
    agentes,
    orphanedReleased: recon.orphanedReleased,
  };
}

export interface HandoffPackResult {
  ok: boolean;
  slug: string | null;
  issueId: string | null;
  cardFile: string | null;
  progress: CardProgressSummary | null;
  exclusivePaths: string[];
  acceptanceCommand: string | null;
  gitSummary: {
    worktreePath: string | null;
    statusShort: string | null;
    recentCommits: string | null;
    diffStat: string | null;
  };
  resumePrompt: string;
  error?: string;
}

function extractFieldFromCardMd(md: string, regex: RegExp): string | null {
  const m = md.match(regex);
  return m && m[1] ? m[1].trim() : null;
}

function extractExclusivePathsFromMd(md: string): string[] {
  const m = md.match(/\*\*Escrita\s+exclusiva:\*\*\s*([^\n]+)/i);
  if (!m || !m[1]) return [];
  return m[1]
    .split(/[,;]+/)
    .map((s) => s.replace(/`/g, "").trim())
    .filter((s) => Boolean(s) && !/^nenhum/i.test(s));
}

async function runQuickGit(host: any, cwd: string, args: string[]): Promise<string | null> {
  if (!host?.spawn) return null;
  try {
    const proc = await host.spawn("git", { args: ["-C", cwd, ...args] });
    const out = proc.stdout ? await new Response(proc.stdout).text() : "";
    const code = await proc.exited;
    return code === 0 ? out.trim() || "(limpo)" : null;
  } catch {
    return null;
  }
}

/**
 * Tool `orgfy_handoff_pack`: gera pacote mínimo estruturado de retomada ou revisão
 * (progresso P1..Pn, L-22, Escrita exclusiva, git status/commits/diff) para zero desperdício de shells.
 */
export async function buildHandoffPack(
  ctx: Context | any,
  input: {
    slug?: string;
    issue_id?: string;
    worktree_path?: string;
    card_markdown?: string;
  }
): Promise<HandoffPackResult> {
  const host = ctx?.host;
  const slug = input.slug ? String(input.slug).trim().replace(/\.md$/i, "") : null;
  const issueId = input.issue_id ? String(input.issue_id).trim() : null;

  let md = input.card_markdown ? String(input.card_markdown) : "";
  let cardFile: string | null = null;

  if (!md && slug && host?.readFile) {
    const candidate = `${CARDS_DIR}/${slug}.md`;
    try {
      md = decodeText(await host.readFile(candidate));
      cardFile = `cards/${slug}.md`;
    } catch {
      cardFile = null;
    }
  }

  const progress = md ? parseCardProgress(md) : null;
  const exclusivePaths = md ? extractExclusivePathsFromMd(md) : [];
  const acceptanceCommand = md
    ? extractFieldFromCardMd(md, /(?:\*\*Comando de aceite(?:\s*\(L-22\))?:\*\*|Comando de aceite:)\s*`?([^\n`]+)`?/i)
    : null;

  const worktreePath = input.worktree_path?.trim() || null;
  let statusShort: string | null = null;
  let recentCommits: string | null = null;
  let diffStat: string | null = null;

  if (worktreePath && host?.spawn) {
    [statusShort, recentCommits, diffStat] = await Promise.all([
      runQuickGit(host, worktreePath, ["status", "--short"]),
      runQuickGit(host, worktreePath, ["log", "-n", "3", "--oneline"]),
      runQuickGit(host, worktreePath, ["diff", "--stat"]),
    ]);
  }

  const nextStep = progress?.nextPendingStepId
    ? progress.steps.find((s) => s.id === progress.nextPendingStepId)
    : null;

  const resumeLines = [
    `[HANDOFF PACK · ${slug || issueId || "card"}]`,
    progress
      ? `Progresso: ${progress.done}/${progress.total} (${progress.pct}%). Próximo passo: ${
          nextStep ? `${nextStep.id} — ${nextStep.text}` : "todos concluídos (rodar L-22 e entregar)"
        }.`
      : "Progresso: checklist não encontrado no card.",
    exclusivePaths.length > 0 ? `Escrita exclusiva: ${exclusivePaths.join(", ")}.` : null,
    acceptanceCommand ? `Aceite L-22: ${acceptanceCommand}` : null,
    worktreePath ? `Worktree: ${worktreePath}` : null,
    recentCommits ? `Últimos commits: ${recentCommits.replace(/\n/g, " | ")}` : null,
    statusShort && statusShort !== "(limpo)" ? `Alterações pendentes: ${statusShort.replace(/\n/g, ", ")}` : null,
  ].filter(Boolean);

  return {
    ok: Boolean(md || worktreePath || issueId),
    slug,
    issueId,
    cardFile,
    progress,
    exclusivePaths,
    acceptanceCommand,
    gitSummary: {
      worktreePath,
      statusShort,
      recentCommits,
      diffStat,
    },
    resumePrompt: resumeLines.join("\n"),
    ...(md || worktreePath || issueId ? {} : { error: "Informe slug, issue_id, card_markdown ou worktree_path." }),
  };
}

export interface SmartDispatchInput {
  issue_id: string;
  slug?: string;
  titulo: string;
  objetivo?: string;
  revisor: string;
  exclusive_paths: string[];
  acceptance_command: string;
  empresa?: string;
  dry_run?: boolean;
  auto_execute?: boolean;
  min_confidence?: number;
  channel_id?: string;
  thread_root?: string;
  nowMs?: number;
}

export interface SmartDispatchResult {
  ok: boolean;
  action: "AUTO_DISPATCHED" | "RECOMMENDED_DRY_RUN" | "ESCALATE_COO" | "BLOCKED_WRITE_SET" | "NO_FREE_AGENTS";
  decisionSource: "decisions_api" | "deterministic_fallback";
  selectedAgent: string | null;
  confidence: number;
  riscoScore: number;
  writeSetConflict?: { issueId: string; owner: string; paths: string[] } | null;
  candidatesEvaluated: string[];
  lockAcquired?: CheckoutLockRecord | null;
  wokeAgent: boolean;
  attentionContract?: BuzzAttentionContract | null;
  eventEmitted?: OrgfyPipelineEvent | null;
  reason: string;
}

/**
 * Dispatcher Híbrido (Fase A Zero-Token + Fase B One-Shot ctx.decisions.decide):
 * 1. Reconcilia presença real (limpa locks zumbis).
 * 2. Verifica WRITE_SET_CONFLICT antes de gastar 1 único token.
 * 3. Filtra agentes realmente livres respeitando L-01 (executor != revisor) e modelo saudável.
 * 4. Faz 1 chamada one-shot a ctx.decisions.decide para eleger o melhor executor.
 * 5. Se auto_execute=true, confiança>=min_confidence e risco<=3 -> adquire lease curto + wake + evento `orgfy.pipeline`.
 */
export async function runOneShotDecisionDispatch(
  ctx: Context | any,
  input: SmartDispatchInput
): Promise<SmartDispatchResult> {
  const t0 = Date.now();
  const nowMs = input.nowMs ?? Date.now();
  const empresa = String(input.empresa || "orgfy").trim() || "orgfy";
  const minConfidence = typeof input.min_confidence === "number" ? input.min_confidence : 0.8;
  const dryRun = input.auto_execute ? false : input.dry_run !== false;

  // Fase A.1: Reconciliar presença + Roster real
  const roster = await buildLiveAgentRoster(ctx, { empresa, nowMs, reconcile: true });

  // Fase A.2: Checar WRITE_SET_CONFLICT contra locks realmente ativos
  const activeLocks = await listActiveLocks(ctx, nowMs);
  const wsConflict = findWriteSetOverlap(input.exclusive_paths, activeLocks, input.issue_id, nowMs);
  if (wsConflict) {
    return {
      ok: false,
      action: "BLOCKED_WRITE_SET",
      decisionSource: "deterministic_fallback",
      selectedAgent: null,
      confidence: 1,
      riscoScore: 0,
      writeSetConflict: {
        issueId: wsConflict.lock.issueId,
        owner: wsConflict.lock.agentKey,
        paths: wsConflict.overlappingPaths,
      },
      candidatesEvaluated: [],
      wokeAgent: false,
      reason: `WRITE_SET_CONFLICT com ${wsConflict.lock.agentKey} (${wsConflict.lock.issueId.slice(0, 8)}) em ${wsConflict.overlappingPaths.join(", ")}.`,
    };
  }

  // Fase A.3: Filtrar candidatos livres elegíveis (L-01: != revisor, não CEO/COO se houver executores livres)
  const freeAll = roster.agentes.filter(
    (a) => a.status === "FREE" && !namesMatch(a.name, input.revisor) && !namesMatch(a.key, input.revisor)
  );
  const freeExecutors = freeAll.filter((a) => !["ceo_holding", "ceo", "coo"].includes(a.role));
  const candidates = freeExecutors.length > 0 ? freeExecutors : freeAll;

  if (candidates.length === 0) {
    return {
      ok: false,
      action: "NO_FREE_AGENTS",
      decisionSource: "deterministic_fallback",
      selectedAgent: null,
      confidence: 0,
      riscoScore: 0,
      candidatesEvaluated: [],
      wokeAgent: false,
      reason: "Nenhum agente livre e saudável elegível (respeitando L-01) no momento.",
    };
  }

  // Fase B: Triagem rápida de risco + escolha one-shot via ctx.decisions.decide
  const triage = await triageCardWithDecisions(ctx, {
    slug: input.slug,
    titulo: input.titulo,
    objetivo: input.objetivo,
    escrita_exclusiva: input.exclusive_paths,
    acceptance_command: input.acceptance_command,
    revisor: input.revisor,
  });

  let selectedAgent = candidates[0].name;
  let confidence = 0.85;
  let decisionSource: "decisions_api" | "deterministic_fallback" = "deterministic_fallback";

  const decisionsApi = ctx?.decisions;
  if (decisionsApi?.decide && candidates.length > 1) {
    const optionsMap: Record<string, string> = {};
    for (const c of candidates) {
      optionsMap[c.name] = `Papel: ${c.role} | Modelo: ${c.model || "padrão"} | Livre no Buzz`;
    }
    try {
      const dec = await decisionsApi.decide({
        state: `Card: ${input.titulo}\nEscrita exclusiva: ${input.exclusive_paths.join(", ")}\nRevisor L-01: ${input.revisor}`,
        timeoutMs: 8000,
        questions: {
          best_executor: {
            type: "choice",
            instructions: "Escolha o agente livre com maior aderência técnica para executar este card com alta taxa de acerto.",
            options: optionsMap,
          },
        },
      });
      const ans = dec?.answers?.best_executor;
      if (dec?.outcome === "answered" && ans?.type === "choice" && optionsMap[ans.choice]) {
        selectedAgent = ans.choice;
        confidence = Number(ans.confidence ?? 0.85);
        decisionSource = "decisions_api";
        recordDecisionTelemetry({
          mode: "smart_dispatch",
          source: "decisions_api",
          model: dec.model || null,
          backend: dec.backend || null,
          durationMs: Date.now() - t0,
          preventedExpensiveWake: true,
        });
      }
    } catch {
      decisionSource = "deterministic_fallback";
    }
  } else if (candidates.length === 1) {
    confidence = 0.92;
  }

  const attentionContract = buildBuzzAttentionContract({
    slug: input.slug || input.issue_id.slice(0, 16),
    titulo: input.titulo,
    executor: selectedAgent,
    revisor: input.revisor,
    policy: triage.attentionPolicy,
    channel: input.channel_id || DEFAULT_ORGFY_CHANNEL,
    threadRoot: input.thread_root,
  });

  const needsCooEscalation = triage.riscoScore >= 4 || confidence < minConfidence;

  if (needsCooEscalation) {
    const ev = emitOrgfyPipelineEvent({
      type: "card.escalated_coo",
      empresa,
      issueId: input.issue_id,
      agent: selectedAgent,
      summary: `Card ${input.issue_id.slice(0, 8)} recomendado para ${selectedAgent} (conf=${confidence.toFixed(2)}, risco=${triage.riscoScore}/5) — escalado ao COO.`,
    });
    return {
      ok: true,
      action: "ESCALATE_COO",
      decisionSource,
      selectedAgent,
      confidence,
      riscoScore: triage.riscoScore,
      candidatesEvaluated: candidates.map((c) => c.name),
      wokeAgent: false,
      attentionContract,
      eventEmitted: ev,
      reason: `Risco ${triage.riscoScore}/5 ou confiança ${confidence.toFixed(2)} < ${minConfidence}: escalar decisão final para OrgFy Bento (COO).`,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      action: "RECOMMENDED_DRY_RUN",
      decisionSource,
      selectedAgent,
      confidence,
      riscoScore: triage.riscoScore,
      candidatesEvaluated: candidates.map((c) => c.name),
      wokeAgent: false,
      attentionContract,
      reason: `Dry-run: melhor agente livre é ${selectedAgent} (confiança ${confidence.toFixed(2)}, risco ${triage.riscoScore}/5). Passe auto_execute: true para despachar.`,
    };
  }

  // Auto-execute: adquire lock com lease curto (8m) + exclusivePaths + acorda agente escolhido
  const lockRes = await acquireCheckoutLock(ctx, input.issue_id, selectedAgent, DEFAULT_LEASE_MS, nowMs, {
    title: input.titulo,
    revisor: input.revisor,
    acceptanceCommand: input.acceptance_command,
    exclusivePaths: input.exclusive_paths,
  });

  if (!lockRes.ok) {
    return {
      ok: false,
      action: lockRes.code === "WRITE_SET_CONFLICT" ? "BLOCKED_WRITE_SET" : "ESCALATE_COO",
      decisionSource,
      selectedAgent,
      confidence,
      riscoScore: triage.riscoScore,
      candidatesEvaluated: candidates.map((c) => c.name),
      wokeAgent: false,
      reason: lockRes.message,
    };
  }

  let wokeAgent = false;
  const agentsApi = ctx?.agents;
  if (agentsApi?.wake) {
    const matched = candidates.find((c) => c.name === selectedAgent);
    try {
      await agentsApi.wake(matched?.key || selectedAgent, {
        channel: input.channel_id || DEFAULT_ORGFY_CHANNEL,
        ...(input.thread_root ? { root: input.thread_root } : {}),
        text: `@${selectedAgent} [ORGFY ONE-SHOT DISPATCH] Card ${input.issue_id.slice(0, 8)} ("${input.titulo}") atribuído com lease curto (8m). Escrita exclusiva: ${input.exclusive_paths.join(", ")}. Revisor L-01: ${input.revisor}. Aceite L-22: ${input.acceptance_command}`,
      });
      wokeAgent = true;
    } catch {
      wokeAgent = false;
    }
  }

  const ev = emitOrgfyPipelineEvent({
    type: "card.auto_dispatched",
    empresa,
    issueId: input.issue_id,
    agent: selectedAgent,
    summary: `Card ${input.issue_id.slice(0, 8)} despachado via One-Shot Decision para ${selectedAgent} (conf=${confidence.toFixed(2)}).`,
  });

  return {
    ok: true,
    action: "AUTO_DISPATCHED",
    decisionSource,
    selectedAgent,
    confidence,
    riscoScore: triage.riscoScore,
    candidatesEvaluated: candidates.map((c) => c.name),
    lockAcquired: lockRes.lock || null,
    wokeAgent,
    attentionContract,
    eventEmitted: ev,
    reason: `Card despachado para ${selectedAgent} via ${decisionSource} (confiança ${confidence.toFixed(2)}, lease 8m).`,
  };
}

/**
 * Auto-limpeza de Attention/Watch e Lock quando um card entra em `revisao` ou `feito`.
 */
export async function cleanupAttentionOnStageChange(
  ctx: Context | any,
  input: { issueId: string; slug?: string; newStage: "revisao" | "feito"; empresa?: string }
): Promise<{ ok: boolean; lockReleased: boolean; interestId: string; event: OrgfyPipelineEvent }> {
  const rel = await releaseCheckoutLock(ctx, input.issueId, undefined, true);
  const interestId = `orgfy-card-${String(input.slug || input.issueId).toLowerCase().slice(0, 40)}`;
  const event = emitOrgfyPipelineEvent({
    type: "attention.cleaned_up",
    empresa: input.empresa || "orgfy",
    issueId: input.issueId,
    summary: `Stage '${input.newStage}' atingido em ${input.issueId.slice(0, 8)}: lock liberado (${rel.code}) e interest '${interestId}' marcado para encerramento.`,
    payload: { interestId, newStage: input.newStage, lockCode: rel.code },
  });
  return {
    ok: true,
    lockReleased: rel.ok && rel.code === "RELEASED",
    interestId,
    event,
  };
}
