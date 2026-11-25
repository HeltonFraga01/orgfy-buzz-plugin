import type { Context } from "@buzz/author";
import { fetchKpisEsteira, fetchGooseLoopRadar, type KpisEsteiraPayload } from "./kpi-service";
import { executeSmartModelFailover } from "./model-failover";

export interface CheckoutLockRecord {
  issueId: string;
  agentKey: string;
  acquiredAt: number;
  expiresAt: number;
  title?: string;
  owner?: string;
  revisor?: string;
  acceptanceCommand?: string;
  branch?: string;
}

export interface LockMetadataInput {
  title?: string;
  owner?: string;
  revisor?: string;
  acceptanceCommand?: string;
  branch?: string;
}

async function resolveFullNostrIssueId(ctx: Context, rawId: string): Promise<string> {
  const clean = String(rawId || "").replace(/^#/, "").trim().toLowerCase();
  if (/^[0-9a-f]{64}$/i.test(clean)) return clean;
  if (!/^[0-9a-f]{6,63}$/i.test(clean)) return rawId.trim();
  const host = (ctx as any).host;
  if (!host?.readFile) return clean;
  const decode = (raw: any) =>
    typeof raw === "string"
      ? raw
      : raw instanceof Uint8Array
      ? new TextDecoder("utf-8").decode(raw)
      : String(raw ?? "");
  try {
    const rawT = await host.readFile("/Users/heltonfraga/.buzz/.scratch/esteira-transicoes.jsonl");
    const lines = decode(rawT).split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes(clean)) continue;
      const m = lines[i].match(new RegExp(`"issue_id"\\s*:\\s*"(${clean}[0-9a-f]{${64 - clean.length}})"`, "i"));
      if (m) return m[1].toLowerCase();
    }
  } catch {
    // Opcional
  }
  try {
    const rawE = await host.readFile("/Users/heltonfraga/.buzz/REPOS/orgfy/.esteira/estado/esteira-minima-state.json");
    const parsed = JSON.parse(decode(rawE));
    for (const k of Object.keys(parsed?.aceites || {})) {
      if (k.toLowerCase().startsWith(clean) && /^[0-9a-f]{64}$/i.test(k)) {
        return k.toLowerCase();
      }
    }
  } catch {
    // Opcional
  }
  return clean;
}

export interface LockActionResult {
  ok: boolean;
  code: "ACQUIRED" | "RENEWED" | "LOCK_CONFLICT" | "RELEASED" | "NOT_FOUND" | "OWNER_MISMATCH";
  lock?: CheckoutLockRecord;
  conflictOwner?: string;
  message: string;
}

export interface BudgetGateResult {
  allowed: boolean;
  code: "OK" | "SOFT_CAP_80" | "BUDGET_HARD_CAP_REACHED" | "OVERRIDE_ALLOWED";
  usoPct: number;
  statusOrcamento: "OK" | "ALERTA_80" | "BLOQUEADO_100";
  message: string;
}

export interface GovernanceEvalResult {
  ok: boolean;
  evaluatedAt: string;
  budget: BudgetGateResult;
  activeLocksCount: number;
  alertsDetected: number;
  notificationsSent: string[];
  wakesTriggered: string[];
  skippedByCooldown: string[];
}

export interface CardLintResult {
  approved: boolean;
  score: number;
  usedDecisionsApi: boolean;
  decisionSource: "decisions_api" | "deterministic_fallback";
  fallbackReason: string | null;
  riskLevel: "Z2" | "Z3" | "Z4" | "Z6";
  requiresHumanApproval: boolean;
  surface: string;
  issues: string[];
  recommendation: string;
}

export interface DsapHybridResult {
  decisionSource: "decisions_api" | "deterministic_fallback";
  fallbackReason: string | null;
  similarity: number;
  threshold: number;
  backtrackRequired: boolean;
  action: string;
}

export const LOCKS_FILE_PATH = "/Users/heltonfraga/.buzz/.scratch/orgfy-locks.json";
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000; // 30 min
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min

// Estado em memória (determinístico para runtime + testes unitários)
const memoryLocks = new Map<string, CheckoutLockRecord>();
const alertCooldowns = new Map<string, number>();
const lastHealedProviderErrorTs = new Map<string, number>();

export function resetGovernanceMemoryStateForTests(): void {
  memoryLocks.clear();
  alertCooldowns.clear();
  lastHealedProviderErrorTs.clear();
}

function purgeExpiredLocks(now: number): number {
  let removed = 0;
  for (const [key, rec] of memoryLocks.entries()) {
    if (rec.expiresAt <= now) {
      memoryLocks.delete(key);
      removed++;
    }
  }
  return removed;
}

async function syncLocksFromDisk(ctx: Context, nowMs: number = Date.now()): Promise<number> {
  const host = (ctx as any).host;
  if (!host?.readFile) return 0;
  let expiredOnDisk = 0;
  try {
    const raw = await host.readFile(LOCKS_FILE_PATH);
    const text =
      typeof raw === "string"
        ? raw
        : raw instanceof Uint8Array
        ? new TextDecoder("utf-8").decode(raw)
        : raw instanceof ArrayBuffer
        ? new TextDecoder("utf-8").decode(new Uint8Array(raw))
        : ArrayBuffer.isView(raw)
        ? new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength))
        : String(raw ?? "");
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
        if (v && typeof v.agentKey === "string" && typeof v.expiresAt === "number" && v.expiresAt > nowMs) {
          if (!memoryLocks.has(k)) {
            memoryLocks.set(k, {
              issueId: k,
              agentKey: v.agentKey,
              acquiredAt: Number(v.acquiredAt || nowMs),
              expiresAt: v.expiresAt,
              title: typeof v.title === "string" ? v.title : undefined,
              owner: typeof v.owner === "string" ? v.owner : undefined,
              revisor: typeof v.revisor === "string" ? v.revisor : undefined,
              acceptanceCommand: typeof v.acceptanceCommand === "string" ? v.acceptanceCommand : undefined,
              branch: typeof v.branch === "string" ? v.branch : undefined,
            });
          }
        } else {
          expiredOnDisk++;
        }
      }
    }
  } catch {
    // Arquivo pode ainda não existir
  }
  return expiredOnDisk;
}

async function persistLocksToDisk(ctx: Context): Promise<void> {
  const host = (ctx as any).host;
  if (!host) return;
  const obj: Record<string, CheckoutLockRecord> = {};
  for (const [k, v] of memoryLocks.entries()) {
    obj[k] = v;
  }
  const serialized = JSON.stringify(obj, null, 2);

  if (host.writeFile) {
    try {
      await host.writeFile(LOCKS_FILE_PATH, serialized);
      return;
    } catch {
      // Fallback para persistência via python3 abaixo
    }
  }

  if (host.spawn) {
    try {
      const pyCode =
        "import pathlib, sys; p = pathlib.Path(sys.argv[1]); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(sys.argv[2], encoding='utf-8')";
      const proc = await host.spawn("python", {
        args: ["-c", pyCode, LOCKS_FILE_PATH, serialized],
      });
      await proc.exited;
    } catch {
      // Ignora em ambientes de teste sem spawn real
    }
  }
}

export async function acquireCheckoutLock(
  ctx: Context,
  issueId: string,
  agentKey: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS,
  nowMs: number = Date.now(),
  meta?: LockMetadataInput
): Promise<LockActionResult> {
  const rawIssue = String(issueId || "").trim();
  const cleanIssue = await resolveFullNostrIssueId(ctx, rawIssue);
  const cleanAgent = String(agentKey || "").trim();
  // Defesa contra chamadores que passam minutos (ex: 30, 60) em vez de ms
  const normalizedTtlMs =
    typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0
      ? ttlMs <= 1440
        ? ttlMs * 60 * 1000
        : ttlMs
      : DEFAULT_LOCK_TTL_MS;
  if (!cleanIssue || !cleanAgent) {
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      message: "issueId e agentKey são obrigatórios para checkout atômico.",
    };
  }
  if (/^([0-9a-f]{4,16})\1+$/i.test(cleanIssue)) {
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      message: `INVALID_SYNTHETIC_ID: issueId '${cleanIssue}' parece um prefixo repetido artificialmente. Informe o ID Nostr real (64 hex) ou apenas o prefixo de 8 chars para resolução automática.`,
    };
  }

  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(nowMs);

  const shortKey = cleanIssue.slice(0, 8);
  const existing =
    memoryLocks.get(cleanIssue) ||
    (cleanIssue.length === 64 ? memoryLocks.get(shortKey) : undefined);

  if (existing && existing.expiresAt > nowMs) {
    if (existing.agentKey === cleanAgent) {
      if (existing.issueId !== cleanIssue) {
        memoryLocks.delete(existing.issueId);
      }
      const renewed: CheckoutLockRecord = {
        issueId: cleanIssue,
        agentKey: cleanAgent,
        acquiredAt: existing.acquiredAt,
        expiresAt: nowMs + normalizedTtlMs,
        title: meta?.title?.trim() || existing.title,
        owner: meta?.owner?.trim() || existing.owner,
        revisor: meta?.revisor?.trim() || existing.revisor,
        acceptanceCommand: meta?.acceptanceCommand?.trim() || existing.acceptanceCommand,
        branch: meta?.branch?.trim() || existing.branch,
      };
      memoryLocks.set(cleanIssue, renewed);
      await persistLocksToDisk(ctx);
      return {
        ok: true,
        code: "RENEWED",
        lock: renewed,
        message: `Lock de ${cleanIssue} renovado para ${cleanAgent}.`,
      };
    }
    // Handoff automático Executor -> Revisor designado (evita travar revisão L-01 esperando TTL de 30m)
    const designatedRevisor = String(existing.revisor || "").trim();
    let isDesignatedRevisor = false;
    if (designatedRevisor) {
      const candidates: string[] = [cleanAgent];
      if (meta?.owner) candidates.push(String(meta.owner));
      try {
        const snap = (ctx as any).agents?.snapshot?.();
        const pool = [...(Array.isArray(snap?.running) ? snap.running : []), ...(Array.isArray(snap?.agents) ? snap.agents : [])];
        const matched = pool.find(
          (a: any) =>
            String(a?.key || "").toLowerCase() === cleanAgent.toLowerCase() ||
            String(a?.pubkey || "").toLowerCase() === cleanAgent.toLowerCase()
        );
        if (matched?.name) candidates.push(String(matched.name));
      } catch {
        // Opcional
      }
      isDesignatedRevisor = candidates.some((c) => sameAgentName(c, designatedRevisor));
    }
    if (isDesignatedRevisor) {
      const handedOff: CheckoutLockRecord = {
        issueId: cleanIssue,
        agentKey: cleanAgent,
        acquiredAt: nowMs,
        expiresAt: nowMs + normalizedTtlMs,
        title: meta?.title?.trim() || existing.title,
        owner: existing.owner,
        revisor: existing.revisor,
        acceptanceCommand: meta?.acceptanceCommand?.trim() || existing.acceptanceCommand,
        branch: meta?.branch?.trim() || existing.branch,
      };
      memoryLocks.set(cleanIssue, handedOff);
      await persistLocksToDisk(ctx);
      return {
        ok: true,
        code: "ACQUIRED",
        lock: handedOff,
        message: `Handoff automático de lock para o revisor designado (${designatedRevisor}) no card ${cleanIssue}.`,
      };
    }
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      conflictOwner: existing.agentKey,
      lock: existing,
      message: `LOCK_CONFLICT: Card ${cleanIssue} já está reservado por ${existing.agentKey} até ${new Date(existing.expiresAt).toISOString()}.`,
    };
  }

  const created: CheckoutLockRecord = {
    issueId: cleanIssue,
    agentKey: cleanAgent,
    acquiredAt: nowMs,
    expiresAt: nowMs + normalizedTtlMs,
    title: meta?.title?.trim() || undefined,
    owner: meta?.owner?.trim() || undefined,
    revisor: meta?.revisor?.trim() || undefined,
    acceptanceCommand: meta?.acceptanceCommand?.trim() || undefined,
    branch: meta?.branch?.trim() || undefined,
  };
  memoryLocks.set(cleanIssue, created);
  await persistLocksToDisk(ctx);
  return {
    ok: true,
    code: "ACQUIRED",
    lock: created,
    message: `Lock atômico adquirido para ${cleanIssue} por ${cleanAgent}.`,
  };
}

export async function releaseCheckoutLock(
  ctx: Context,
  issueId: string,
  agentKey?: string,
  force: boolean = false
): Promise<LockActionResult> {
  const rawIssue = String(issueId || "").trim();
  const cleanIssue = await resolveFullNostrIssueId(ctx, rawIssue);
  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(Date.now());

  const shortKey = cleanIssue.slice(0, 8);
  const existing =
    memoryLocks.get(cleanIssue) ||
    memoryLocks.get(rawIssue) ||
    memoryLocks.get(shortKey);
  if (!existing) {
    return {
      ok: true,
      code: "NOT_FOUND",
      message: `Nenhum lock ativo encontrado para ${cleanIssue}.`,
    };
  }
  if (!force && agentKey && existing.agentKey !== agentKey) {
    return {
      ok: false,
      code: "OWNER_MISMATCH",
      conflictOwner: existing.agentKey,
      message: `Lock de ${cleanIssue} pertence a ${existing.agentKey}, não a ${agentKey}.`,
    };
  }

  memoryLocks.delete(existing.issueId);
  await persistLocksToDisk(ctx);
  return {
    ok: true,
    code: "RELEASED",
    message: `Lock de ${existing.issueId} liberado com sucesso.`,
  };
}

export async function listActiveLocks(ctx: Context, nowMs: number = Date.now()): Promise<CheckoutLockRecord[]> {
  const expiredOnDisk = await syncLocksFromDisk(ctx, nowMs);
  const removedInMem = purgeExpiredLocks(nowMs);
  if (expiredOnDisk > 0 || removedInMem > 0) {
    await persistLocksToDisk(ctx);
  }
  return Array.from(memoryLocks.values());
}

export function evaluateBudgetGate(
  kpis: KpisEsteiraPayload | null,
  boardOverride: boolean = false
): BudgetGateResult {
  const usoPct = kpis?.economia?.uso_teto_diario_pct ?? 0;
  const status = kpis?.economia?.status_orcamento ?? "OK";

  if (status === "BLOQUEADO_100" || usoPct >= 100) {
    if (boardOverride) {
      return {
        allowed: true,
        code: "OVERRIDE_ALLOWED",
        usoPct,
        statusOrcamento: "BLOQUEADO_100",
        message: `Teto diário de 100% atingido (${usoPct}%), liberado excepcionalmente via boardOverride.`,
      };
    }
    return {
      allowed: false,
      code: "BUDGET_HARD_CAP_REACHED",
      usoPct,
      statusOrcamento: "BLOQUEADO_100",
      message: `BUDGET_HARD_CAP_REACHED: Consumo diário em ${usoPct}% do teto. Informe boardOverride: true para liberar manualmente.`,
    };
  }

  if (status === "ALERTA_80" || usoPct >= 80) {
    return {
      allowed: true,
      code: "SOFT_CAP_80",
      usoPct,
      statusOrcamento: "ALERTA_80",
      message: `Alerta suave: consumo diário em ${usoPct}% do teto (priorizar modelos Tier 1).`,
    };
  }

  return {
    allowed: true,
    code: "OK",
    usoPct,
    statusOrcamento: "OK",
    message: `Orçamento diário saudável (${usoPct}% do teto).`,
  };
}

function canTriggerWithCooldown(
  key: string,
  nowMs: number,
  commit: boolean = true,
  cooldownMs: number = DEFAULT_COOLDOWN_MS
): boolean {
  const last = alertCooldowns.get(key);
  if (last !== undefined && nowMs - last < cooldownMs) {
    return false;
  }
  if (commit) {
    alertCooldowns.set(key, nowMs);
  }
  return true;
}

export const DEFAULT_ORGFY_CHANNEL = "e445491d-2fb3-4ebd-8e2e-f6813c33fb03";
const EMPRESAS_DIR = "/Users/heltonfraga/.buzz/REPOS/orgfy/empresas";
const KNOWN_COMPANY_SLUGS = ["orgfy", "lumen-iptv", "saas-tributario"];
const radarEscalationCounts = new Map<string, number>();

export interface EscalationResolution {
  empresaSlug: string;
  empresaNome: string;
  level: 1 | 2 | 3;
  roleLabel: string;
  targetAgent: string;
  nextEscalationAgent: string | null;
  holdingCeo: string;
  reason: string;
}

function decodeHostBytes(raw: any): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}

function sameAgentName(a: string, b: string): boolean {
  const na = String(a || "").trim().toLowerCase();
  const nb = String(b || "").trim().toLowerCase();
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}

export async function resolveEscalationTargetForChannel(
  ctx: Context,
  channelId: string | undefined,
  loopingAgents: string[] = [],
  escalationAttempt: number = 1
): Promise<EscalationResolution> {
  const host = (ctx as any).host;
  const targetChannel = String(channelId || DEFAULT_ORGFY_CHANNEL).trim();

  let matchedManifest: any = null;
  let defaultManifest: any = null;

  if (host?.readFile) {
    for (const slug of KNOWN_COMPANY_SLUGS) {
      try {
        const raw = await host.readFile(`${EMPRESAS_DIR}/${slug}.json`);
        const parsed = JSON.parse(decodeHostBytes(raw));
        if (slug === "orgfy") defaultManifest = parsed;
        if (parsed?.canal && String(parsed.canal).trim() === targetChannel) {
          matchedManifest = parsed;
          break;
        }
      } catch {
        // Manifesto opcional
      }
    }
  }

  const manifest = matchedManifest || defaultManifest || {};
  const empresaSlug = String(manifest.empresa || manifest.slug || "orgfy");
  const empresaNome = String(
    manifest.hierarquia?.workspace_buzz || manifest.nome || (empresaSlug === "orgfy" ? "OrgFy" : empresaSlug)
  );
  const papeis = manifest.papeis && typeof manifest.papeis === "object" ? manifest.papeis : {};
  const hierarquia = manifest.hierarquia && typeof manifest.hierarquia === "object" ? manifest.hierarquia : {};
  const agentesEntries: Array<{ nome: string; papel: string }> = Array.isArray(manifest.agentes)
    ? manifest.agentes.map((a: any) => ({ nome: String(a?.nome || ""), papel: String(a?.papel || "") }))
    : manifest.agentes && typeof manifest.agentes === "object"
    ? Object.entries(manifest.agentes).map(([nome, cfg]: [string, any]) => ({
        nome,
        papel: String(cfg?.papel || ""),
      }))
    : [];

  const findByRole = (role: string): string | undefined =>
    agentesEntries.find((a) => a.papel.toLowerCase() === role)?.nome;

  const coo =
    String(papeis.coo || findByRole("coo") || "OrgFy Bento").trim();
  const companyCeo =
    String(
      hierarquia.ceo_empresa ||
        papeis.ceo_empresa ||
        findByRole("ceo_empresa") ||
        papeis.ceo ||
        findByRole("ceo") ||
        "OrgFy Iris"
    ).trim();
  const holdingCeo =
    String(
      hierarquia.ceo_holding ||
        papeis.ceo_holding ||
        findByRole("ceo_holding") ||
        "OrgFy Iris"
    ).trim();

  const isCooLooping = loopingAgents.some((ag) => sameAgentName(ag, coo));
  const isCompanyCeoLooping = loopingAgents.some((ag) => sameAgentName(ag, companyCeo));
  const hasSeparateCompanyCeo = !sameAgentName(companyCeo, holdingCeo);

  // Nível 3: Holding CEO (Iris) apenas se CEO da empresa também estiver em loop ou falhou após N1 e N2
  if (hasSeparateCompanyCeo && (isCompanyCeoLooping || escalationAttempt >= 3)) {
    return {
      empresaSlug,
      empresaNome,
      level: 3,
      roleLabel: "CEO Holding",
      targetAgent: holdingCeo,
      nextEscalationAgent: null,
      holdingCeo,
      reason: isCompanyCeoLooping
        ? `CEO da empresa (${companyCeo}) está em loop`
        : `incidente persistiu após acionamento do COO (${coo}) e CEO (${companyCeo})`,
    };
  }

  // Nível 2: CEO da empresa específica se o COO estiver em loop ou não resolveu no ciclo anterior
  if (isCooLooping || escalationAttempt >= 2) {
    return {
      empresaSlug,
      empresaNome,
      level: 2,
      roleLabel: hasSeparateCompanyCeo ? `CEO ${empresaNome}` : "CEO Holding",
      targetAgent: companyCeo,
      nextEscalationAgent: hasSeparateCompanyCeo ? holdingCeo : null,
      holdingCeo,
      reason: isCooLooping
        ? `o próprio COO (${coo}) entrou em loop`
        : `COO (${coo}) não resolveu o loop no ciclo anterior`,
    };
  }

  // Nível 1 (padrão): COO da empresa/esteira específica — preserva a CEO da Holding (Iris)
  return {
    empresaSlug,
    empresaNome,
    level: 1,
    roleLabel: `COO · ${empresaNome}`,
    targetAgent: coo,
    nextEscalationAgent: companyCeo,
    holdingCeo,
    reason: "primeiro acionamento operacional de auto-cura na esteira",
  };
}

function resolveAgentKeyFromSnapshot(agentsApi: any, query: string): string {
  const clean = String(query || "").trim();
  if (!clean || !agentsApi?.snapshot) return clean;
  try {
    const snap = agentsApi.snapshot() || {};
    const pool: any[] = [];
    const seen = new Set<string>();
    for (const list of [snap.running, snap.agents]) {
      if (!Array.isArray(list)) continue;
      for (const a of list) {
        if (!a || !a.key || seen.has(a.key)) continue;
        seen.add(a.key);
        pool.push(a);
      }
    }
    const lower = clean.toLowerCase();
    const matched =
      pool.find((a) => String(a.key || "").toLowerCase() === lower) ||
      pool.find((a) => String(a.pubkey || "").toLowerCase() === lower) ||
      pool.find((a) => String(a.name || "").toLowerCase() === lower) ||
      pool.find((a) => String(a.name || "").toLowerCase().includes(lower));
    return matched?.key || clean;
  } catch {
    return clean;
  }
}

export async function evaluateGovernanceAndReact(
  ctx: Context,
  options: {
    dryRun?: boolean;
    autoWake?: boolean;
    bypassCooldown?: boolean;
    includeRadar?: boolean;
    reviewerAgentKey?: string;
    channel?: string;
    nowMs?: number;
  } = {}
): Promise<GovernanceEvalResult> {
  const nowMs = options.nowMs ?? Date.now();
  const kpiRes = await fetchKpisEsteira(ctx);
  const kpis = kpiRes.kpis;
  const locks = await listActiveLocks(ctx, nowMs);
  const budget = evaluateBudgetGate(kpis, false);

  const notificationsSent: string[] = [];
  const wakesTriggered: string[] = [];
  const skippedByCooldown: string[] = [];

  const alerts = [...(kpis?.alertas_ativos ?? [])];
  let radarChannelId: string | undefined;
  let radarThreadRoot: string | undefined;
  let radarLoopingAgents: string[] = [];
  let radarIncidentKey = "";

  // Integração ativa com o Radar de Loops & Sessões Zumbis (Goose Live)
  if (options.includeRadar !== false) {
    try {
      const radar = await fetchGooseLoopRadar(ctx);
      if (radar.ok && Array.isArray(radar.sessoes)) {
        const healedSessionIds = new Set<string>();

        // Auto-failover autônomo imediato no 1º erro fatal de provider/LLM (503/502/504/429/404/400/malformed_function_call)
        if (!options.dryRun && options.autoWake !== false) {
          const providerStormSessions = radar.sessoes.filter((s) => {
            const isActive = typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15;
            if (!isActive || s.ultima_atualizacao_min > 12) return false;
            const lastIsErr = Boolean(s.last_msg_is_provider_error);
            const recentErrs = Number(s.recent_provider_errors ?? 0);
            const hasStormFlag = Array.isArray(s.flags) && s.flags.includes("TEMPESTADE_5XX");
            return lastIsErr || recentErrs >= 2 || (hasStormFlag && Number(s.errors_5xx ?? 0) >= 1);
          });

          const seenAgentsForFailover = new Set<string>();
          for (const s of providerStormSessions) {
            const agentDedupKey = String(s.agent_pubkey || s.agente || "").trim().toLowerCase();
            if (!agentDedupKey || seenAgentsForFailover.has(agentDedupKey)) continue;
            seenAgentsForFailover.add(agentDedupKey);

            const errTs = typeof s.last_provider_error_ts === "number" ? s.last_provider_error_ts : null;
            const prevHealedTs = lastHealedProviderErrorTs.get(agentDedupKey);
            if (!options.bypassCooldown && errTs !== null && prevHealedTs !== undefined && errTs <= prevHealedTs) {
              skippedByCooldown.push(`auto_failover_already_healed:${s.agente}`);
              continue;
            }

            const failCooldownKey = `auto_model_failover:${agentDedupKey}`;
            if (!options.bypassCooldown && !canTriggerWithCooldown(failCooldownKey, nowMs, true, 30 * 1000)) {
              skippedByCooldown.push(`auto_failover:${s.agente}`);
              continue;
            }
            if (errTs !== null) {
              lastHealedProviderErrorTs.set(agentDedupKey, errTs);
            }

            try {
              const agentsApi = (ctx as any).agents;
              // Interrompe a sessão travada em 503 antes de trocar o modelo para que o retrigger use o novo modelo limpo
              if (agentsApi?.session && (s.agente || s.agent_pubkey)) {
                const targetKey = resolveAgentKeyFromSnapshot(agentsApi, s.agent_pubkey || s.agente);
                if (targetKey) {
                  try {
                    const place = s.thread_root
                      ? { channelId: s.channel_id || DEFAULT_ORGFY_CHANNEL, root: s.thread_root }
                      : { channelId: s.channel_id || DEFAULT_ORGFY_CHANNEL };
                    await agentsApi.session(targetKey, place, "interrupt");
                  } catch {
                    // Sessão pode já estar ociosa
                  }
                }
              }

              const failoverRes = await executeSmartModelFailover(ctx, {
                agente: s.agente,
                agent_pubkey: s.agent_pubkey || null,
                prefer_free: false,
                apply: true,
                retrigger: true,
                channel_id: s.channel_id || DEFAULT_ORGFY_CHANNEL,
                thread_root: s.thread_root || null,
              });

              if (failoverRes.ok && failoverRes.selectedModel) {
                wakesTriggered.push(
                  `auto_failover:${s.agente}:${failoverRes.previousModel || "padrao"}->${failoverRes.selectedModel}`
                );
                notificationsSent.push(`AUTO_MODEL_FAILOVER:${s.agente}`);
                try {
                  const notifApi = (ctx as any).notifications;
                  if (notifApi?.notify) {
                    await notifApi.notify({
                      title: `OrgFy Auto-Failover [${s.agente}]`,
                      body: failoverRes.message,
                    });
                  }
                } catch {
                  // Notificação nativa opcional
                }
                const otherFlags = (s.flags || []).filter((f) => f !== "TEMPESTADE_5XX");
                if (otherFlags.length === 0) {
                  healedSessionIds.add(s.session_id);
                }
              }
            } catch (err) {
              console.warn("[ORGFY] Falha no auto-failover direto de modelo:", { agente: s.agente, err });
            }
          }
        }

        const activeCrit = radar.sessoes.filter(
          (s) =>
            !healedSessionIds.has(s.session_id) &&
            (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15) &&
            s.severidade === "critical"
        );
        const activeDup = radar.sessoes.filter(
          (s) => (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15) && (s.flags || []).includes("SESSAO_DUPLICADA")
        );
        const anchorSession = activeCrit[0] || activeDup[0];
        if (anchorSession?.channel_id) radarChannelId = anchorSession.channel_id;
        if (anchorSession?.thread_root) radarThreadRoot = anchorSession.thread_root;
        radarLoopingAgents = Array.from(
          new Set([...activeCrit, ...activeDup].map((s) => String(s.agente || "").trim()).filter(Boolean))
        );
        radarIncidentKey = `${radarChannelId || DEFAULT_ORGFY_CHANNEL}:${activeCrit
          .map((s) => s.session_id)
          .sort()
          .join(",")}`;
        if (activeCrit.length > 0) {
          const top = activeCrit
            .slice(0, 4)
            .map((s) => `${s.agente} (${s.session_id}, ${s.shells} shells, ${s.duracao_min}m, flags=${(s.flags || []).join("+")})`)
            .join("; ");
          alerts.push({
            codigo: "GOOSE_ACTIVE_LOOP",
            severidade: "critical",
            mensagem: `${activeCrit.length} sessão(ões) ativa(s) em loop no Goose: ${top}.`,
            acao_sugerida:
              "Ciclo Fechado de Auto-Cura (PARAR NUNCA ENCERRA O TURNO): chame orgfy_loop_radar({ apenas_ativos: true }) e execute 1 dos 3 desfechos: (A) Erro de API/5xx/provider -> orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: 'interrupt', reason }) + orgfy_model_failover({ agente, agent_pubkey, channel_id, thread_root, prefer_free: false, apply: true, retrigger: true }); (B) Card ainda aberto (ESCOPO_ABERTO, COMPACTACAO_LOOP, ERRO_REPETIDO) -> orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: 'interrupt', relaunch: true, reset_session_before_relaunch: true, relaunch_instruction: '<o que fazer agora>', target_files: ['<1-3 arquivos>'], acceptance_command: '<comando L-22>', max_shells: 10, reason }); (C) PR/issue já na main -> orgfy_session_stop({ agente, action: 'interrupt', release_issue_id, reason }) sem relançar. Publique 'AUTO-CURA | agente | causa-raiz | ação' no canal.",
          });
        }
        if (activeDup.length >= 2) {
          const dupAgents = Array.from(new Set(activeDup.map((s) => s.agente))).join(", ");
          alerts.push({
            codigo: "GOOSE_DUPLICATE_SESSIONS",
            severidade: "warn",
            mensagem: `${activeDup.length} sessões duplicadas ativas nos agentes: ${dupAgents}.`,
            acao_sugerida:
              "Pausar cobranças/menções paralelas para esses agentes até concluírem o turno atual e designar dono único por card.",
          });
        }
      }
    } catch {
      // Radar opcional se o snapshot não estiver acessível
    }
  }

  for (const al of alerts) {
    const isRadarAlert = al.codigo === "GOOSE_ACTIVE_LOOP" || al.codigo === "GOOSE_DUPLICATE_SESSIONS";
    const cooldownKey = isRadarAlert && radarIncidentKey ? `alert:${al.codigo}:${radarIncidentKey}` : `alert:${al.codigo}`;
    if (!options.bypassCooldown && !canTriggerWithCooldown(cooldownKey, nowMs, !options.dryRun)) {
      skippedByCooldown.push(al.codigo);
      continue;
    }

    if (!options.dryRun) {
      try {
        const notifApi = (ctx as any).notifications;
        if (notifApi?.notify) {
          await notifApi.notify({
            title: `OrgFy [${al.codigo}]`,
            body: al.mensagem,
          });
        }
      } catch {
        // Notificação nativa opcional
      }
      notificationsSent.push(al.codigo);
    }

    if (
      options.autoWake &&
      !options.dryRun &&
      (al.codigo === "REVIEW_QUEUE_BOTTLENECK" || al.codigo === "STAGNATION_LEVEL_3" || isRadarAlert)
    ) {
      const wakeChannel = (isRadarAlert && radarChannelId) || options.channel || DEFAULT_ORGFY_CHANNEL;
      const attempt = isRadarAlert && radarIncidentKey ? (radarEscalationCounts.get(radarIncidentKey) || 0) + 1 : 1;
      const escalation = isRadarAlert
        ? await resolveEscalationTargetForChannel(ctx, wakeChannel, radarLoopingAgents, attempt)
        : null;
      const wakeKey = options.reviewerAgentKey || escalation?.targetAgent || "OrgFy Bento";
      const wakeRoot = isRadarAlert && radarThreadRoot ? radarThreadRoot : undefined;
      const wakeCooldownKey =
        isRadarAlert && radarIncidentKey
          ? `wake:${al.codigo}:${radarIncidentKey}:${wakeKey}`
          : `wake:${al.codigo}:${wakeKey}`;
      const threadGuard = checkThreadWakeAntiLoop({
        agentKey: wakeKey,
        threadRoot: wakeRoot,
        contextText: al.mensagem,
        nowMs,
        bypass: Boolean(options.bypassCooldown),
      });
      if (!threadGuard.allow) {
        skippedByCooldown.push(`wake_guard:${al.codigo}:${threadGuard.reason}`);
      } else if (options.bypassCooldown || canTriggerWithCooldown(wakeCooldownKey, nowMs)) {
        try {
          const agentsApi = (ctx as any).agents;
          if (agentsApi?.wake) {
            const targetAgentKey = resolveAgentKeyFromSnapshot(agentsApi, wakeKey);
            const escalationSuffix =
              escalation && escalation.nextEscalationAgent
                ? ` Se não conseguir resolver em 1 ciclo, escale para @${escalation.nextEscalationAgent} (nunca acione a CEO da Holding sem passar antes pela liderança da empresa).`
                : "";
            const headerLabel = escalation
              ? `Nível ${escalation.level} · ${escalation.roleLabel}`
              : al.codigo;
            await agentsApi.wake(targetAgentKey, {
              channel: wakeChannel,
              ...(wakeRoot ? { root: wakeRoot } : {}),
              text: isRadarAlert
                ? `@${wakeKey} ORDEM OPERACIONAL OBRIGATÓRIA [ORGFY RADAR AUTO-CURA · ${headerLabel} · ${al.codigo}] (Isto NÃO é telemetria passiva — execute agora e publique o resultado no canal). ${al.mensagem} Ação obrigatória agora: ${al.acao_sugerida}${escalationSuffix}`
                : `[ORGFY GOVERNANÇA] ${al.mensagem} Ação recomendada: ${al.acao_sugerida}`,
            });
            if (isRadarAlert && radarIncidentKey) {
              radarEscalationCounts.set(radarIncidentKey, attempt);
            }
            wakesTriggered.push(`${wakeKey}:${al.codigo}`);
          }
        } catch (err) {
          console.warn("[ORGFY] Falha ao acordar agente via ctx.agents.wake:", { wakeKey, err });
        }
      } else {
        skippedByCooldown.push(`wake:${al.codigo}`);
      }
    }
  }

  return {
    ok: true,
    evaluatedAt: new Date(nowMs).toISOString(),
    budget,
    activeLocksCount: locks.length,
    alertsDetected: alerts.length,
    notificationsSent,
    wakesTriggered,
    skippedByCooldown,
  };
}

function normalizeTextForFallback(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyFallbackRiskAndSurface(titulo: string, descricao: string): {
  riskLevel: "Z2" | "Z3" | "Z4" | "Z6";
  requiresHumanApproval: boolean;
  surface: string;
} {
  const blob = normalizeTextForFallback(`${titulo} ${descricao}`);
  const z6Terms = [
    "faturamento", "pagamento", "pix", "stripe", "billing", "sats",
    "secret", "segredo", "token", "oauth", "chmod", "credencial", "nsec", "rls", "auth",
    "deploy", "producao", "production", "swarm", "portainer", "stack", "migration", "migracao", "drop table",
  ];
  const isZ6 = z6Terms.some((t) => blob.includes(t));
  let surface = "codigo";
  if (["seguranca", "secret", "auth", "oauth", "token", "rls", "chmod"].some((t) => blob.includes(t))) {
    surface = "seguranca";
  } else if (["ui", "ux", "css", "tsx", "react", "kanban", "modal", "layout"].some((t) => blob.includes(t))) {
    surface = "ui";
  } else if (["docker", "swarm", "portainer", "deploy", "cron", "worktree"].some((t) => blob.includes(t))) {
    surface = "infra";
  } else if (["spec", "licao", "playbook", "governanca", "manifesto"].some((t) => blob.includes(t))) {
    surface = "metodo";
  }
  if (isZ6) return { riskLevel: "Z6", requiresHumanApproval: true, surface };
  if (surface === "seguranca" || surface === "infra") return { riskLevel: "Z4", requiresHumanApproval: false, surface };
  return { riskLevel: "Z2", requiresHumanApproval: false, surface };
}

export async function lintCardForDispatch(
  ctx: Context,
  input: {
    issueId?: string;
    titulo?: string;
    acceptanceCommand?: string;
    descricao?: string;
    executor?: string;
    revisor?: string;
    cardMarkdown?: string;
    specPath?: string;
  }
): Promise<CardLintResult> {
  const issues: string[] = [];
  const titulo = String(input.titulo || "").trim();
  const cmd = String(input.acceptanceCommand || "").trim();
  const desc = String(input.descricao || "").trim();
  const md = String(input.cardMarkdown || "").trim();

  if (!titulo || titulo.length < 10) {
    issues.push("Título muito curto ou ausente (mínimo 10 caracteres).");
  }
  if (!cmd) {
    issues.push("Regra L-22 violada: comando de aceite executável (acceptanceCommand) ausente.");
  } else if (
    /^(todo|tbd|none|n\/a|true|:|exit\s+0)$/i.test(cmd) ||
    (/^echo\b/i.test(cmd) && !/(pytest|node |npm |pnpm |cargo |shasum|python|curl |git )/i.test(cmd))
  ) {
    issues.push("Regra L-22 violada: acceptanceCommand é placeholder ou comando inócuo (carimbo).");
  }
  if (input.executor && input.revisor && input.executor.trim() === input.revisor.trim()) {
    issues.push("Regra L-01 violada: executor e revisor não podem ser o mesmo agente.");
  }
  if (md) {
    if (!/<!--\s*orgfy:card\s+(?:v3|v4|v7\.1|v7\.2)\s*-->/i.test(md)) {
      issues.push("Template OrgFy ausente: marcador '<!-- orgfy:card v4 -->' ou '<!-- orgfy:card v3 -->' obrigatório (use ./ferramentas/orgfy-card-new).");
    }
    if (!/(specs\/[a-z0-9_/-]+|SPEC-\d{4}|\*\*Autoridade:\*\*)/i.test(md) && !input.specPath?.trim()) {
      issues.push("Spec-Kit obrigatório: informe referência à spec ('specs/.../spec.md' ou 'SPEC-NNNN') e Autoridade.");
    }
    if (!/(?:\*\*Leitura:\*\*|Leitura:)/i.test(md) || !/(?:\*\*Escrita\s+exclusiva:\*\*|Escrita\s+exclusiva:)/i.test(md)) {
      issues.push("Paths obrigatórios ausentes: preencha 'Leitura:' e 'Escrita exclusiva:' conforme contratos/card.md.");
    }
    if (!/##\s+Pap[eé]is\s+e\s+ambiente/i.test(md)) {
      issues.push("Seção obrigatória ausente: '## Papéis e ambiente' (com Executor, Revisor, Decisor e Workspace).");
    }
  }

  const fallbackCls = classifyFallbackRiskAndSurface(titulo, desc);
  let usedDecisionsApi = false;
  let decisionSource: "decisions_api" | "deterministic_fallback" = "deterministic_fallback";
  let fallbackReason: string | null = "decisions_api_not_available";
  let score = issues.length === 0 ? 1.0 : Math.max(0.2, 1.0 - issues.length * 0.3);

  const decisionsApi = (ctx as any).decisions;
  if (decisionsApi?.decide && issues.length === 0 && (titulo || desc)) {
    try {
      const decisionRes = await decisionsApi.decide({
        state: {
          issueId: input.issueId || "draft",
          titulo,
          acceptanceCommand: cmd,
          descricao: desc,
          fallbackRisk: fallbackCls.riskLevel,
        },
        questions: [
          {
            id: "atomic_scope",
            type: "yes_no",
            prompt: "O escopo deste card é atômico e verificável pelo comando de aceite informado?",
          },
        ],
      });
      usedDecisionsApi = true;
      decisionSource = "decisions_api";
      fallbackReason = null;
      const ans = decisionRes?.answers?.atomic_scope ?? decisionRes?.atomic_scope;
      if (ans === false || ans === "no") {
        issues.push("Avaliação semântica (ctx.decisions): escopo amplo demais ou pouco verificável.");
        score = 0.55;
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "unknown_error");
      fallbackReason = /(402|429|quota|balance|credit|saldo|timeout)/i.test(msg)
        ? `decisions_api_quota_or_timeout:${msg.slice(0, 80)}`
        : `decisions_api_error:${msg.slice(0, 80)}`;
    }
  }

  const approved = issues.length === 0;
  return {
    approved,
    score: Number(score.toFixed(2)),
    usedDecisionsApi,
    decisionSource,
    fallbackReason,
    riskLevel: fallbackCls.riskLevel,
    requiresHumanApproval: fallbackCls.requiresHumanApproval,
    surface: fallbackCls.surface,
    issues,
    recommendation: approved
      ? usedDecisionsApi
        ? "Card aprovado via Decisions API + invariantes L-01/L-22."
        : "Card aprovado via fallback determinístico offline (L-01/L-22/Z6 preservados)."
      : "Corrija as pendências acima antes de despachar para evitar retrabalho no Gate.",
  };
}

export async function evaluateDsapWithFallback(
  ctx: Context,
  motivoR1: string,
  motivoR2: string,
  threshold: number = 0.7
): Promise<DsapHybridResult> {
  const t1 = new Set(normalizeTextForFallback(motivoR1).split(/[^a-z0-9_]+/).filter((w) => w.length >= 3));
  const t2 = new Set(normalizeTextForFallback(motivoR2).split(/[^a-z0-9_]+/).filter((w) => w.length >= 3));
  const union = new Set([...t1, ...t2]);
  let inter = 0;
  for (const w of t1) if (t2.has(w)) inter++;
  const lexicalSim = union.size > 0 ? Number((inter / union.size).toFixed(4)) : 0;

  let fallbackReason: string | null = "decisions_api_not_available";
  const decisionsApi = (ctx as any).decisions;
  if (decisionsApi?.decide) {
    try {
      const res = await decisionsApi.decide({
        state: { motivoR1, motivoR2, lexicalSim },
        questions: [
          {
            id: "same_root_cause",
            type: "yes_no",
            prompt: "A 2a recusa repete a mesma causa raiz da 1a e exige DSAP Backtracking para o COO re-escopar?",
          },
        ],
      });
      const same = res?.answers?.same_root_cause ?? res?.same_root_cause;
      const backtrack = same === true || same === "yes";
      return {
        decisionSource: "decisions_api",
        fallbackReason: null,
        similarity: lexicalSim,
        threshold,
        backtrackRequired: backtrack,
        action: backtrack
          ? "[DSAP BACKTRACKING] Recusa repetida (Decisions API) — devolver ao COO."
          : "Recusa distinta (Decisions API) — permitido seguir.",
      };
    } catch (err: any) {
      fallbackReason = `decisions_api_fallback:${String(err?.message || err).slice(0, 80)}`;
    }
  }

  const backtrack = lexicalSim >= threshold;
  return {
    decisionSource: "deterministic_fallback",
    fallbackReason,
    similarity: lexicalSim,
    threshold,
    backtrackRequired: backtrack,
    action: backtrack
      ? "[DSAP BACKTRACKING] Recusa repetida (fallback determinístico) — devolver ao COO."
      : "Recusa distinta (fallback determinístico) — permitido seguir.",
  };
}

export interface ConversationContextBindResult {
  ok: boolean;
  conversationId: string;
  folderAssigned: boolean;
  worktreePath: string | null;
  sectionsInjected: boolean;
  sectionsCount: number;
  fallbackContextFile?: string | null;
  degradedFallback?: boolean;
  notes: string[];
}

export async function bindConversationContextForCard(
  ctx: Context,
  input: {
    conversationId: string;
    issueId: string;
    worktreePath?: string;
    titulo?: string;
    acceptanceCommand?: string;
    acceptanceHash?: string;
    executor?: string;
    revisor?: string;
  }
): Promise<ConversationContextBindResult> {
  const agentsApi = (ctx as any).agents;
  const host = (ctx as any).host;
  const notes: string[] = [];
  let folderAssigned = false;
  let sectionsInjected = false;
  let remoteOrMissingAgent = false;
  const worktreePath = input.worktreePath?.trim() || null;
  const isMissingAgentErr = (msg: string) =>
    /(does not exist|not found|n[aã]o existe|unknown agent|agent.*missing|no such conversation)/i.test(msg);

  if (worktreePath && agentsApi?.assignConversationFolder) {
    try {
      await agentsApi.assignConversationFolder(input.conversationId, worktreePath);
      folderAssigned = true;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (isMissingAgentErr(msg)) remoteOrMissingAgent = true;
      notes.push(`Falha em assignConversationFolder: ${msg}`);
    }
  } else if (worktreePath) {
    notes.push("API ctx.agents.assignConversationFolder indisponível neste host.");
  }

  const sections = [
    {
      id: `orgfy-card-${input.issueId}`,
      title: `Contexto OrgFy — Card #${input.issueId}`,
      content: [
        input.titulo ? `Título: ${input.titulo}` : null,
        input.executor ? `Executor (L-01): ${input.executor}` : null,
        input.revisor ? `Revisor (L-01): ${input.revisor}` : null,
        worktreePath ? `Worktree Isolado: ${worktreePath}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      id: `orgfy-rules-${input.issueId}`,
      title: "Regras Vivas L-22 / L-90 (Injetadas Automaticamente)",
      content: [
        `Regra L-22 (Comando de Aceite Imutável): ${input.acceptanceCommand || "Não informado"}`,
        input.acceptanceHash ? `Hash SHA-256 L-22: ${input.acceptanceHash}` : null,
        "Regra L-01: Executor e revisor devem ser estritamente segregados.",
        "Regra L-90: Nunca afrouxe testes, critérios de aceite ou gates caixa-preta.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (agentsApi?.setConversationSections) {
    try {
      await agentsApi.setConversationSections(input.conversationId, sections);
      sectionsInjected = true;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (isMissingAgentErr(msg)) remoteOrMissingAgent = true;
      notes.push(`Falha em setConversationSections: ${msg}`);
    }
  } else {
    notes.push("API ctx.agents.setConversationSections indisponível neste host.");
  }

  let fallbackContextFile: string | null = null;
  let degradedFallback = false;
  if (!folderAssigned && !sectionsInjected && remoteOrMissingAgent) {
    const safeId = String(input.issueId || "card").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "card";
    const ctxPath = `/Users/heltonfraga/.buzz/.scratch/orgfy-context-${safeId}.json`;
    const payload = JSON.stringify(
      {
        issueId: input.issueId,
        conversationId: input.conversationId,
        worktreePath,
        sections,
        savedAt: new Date().toISOString(),
      },
      null,
      2
    );
    if (host?.writeFile) {
      try {
        await host.writeFile(ctxPath, payload);
        fallbackContextFile = ctxPath;
        degradedFallback = true;
        notes.push(`Fallback aplicado: agente/conversa não local neste aparelho; contexto L-22/L-90 persistido em ${ctxPath}.`);
      } catch (wErr: any) {
        notes.push(`Falha ao gravar fallback de contexto: ${wErr?.message || wErr}`);
      }
    }
  }

  return {
    ok: folderAssigned || sectionsInjected || degradedFallback,
    conversationId: input.conversationId,
    folderAssigned,
    worktreePath,
    sectionsInjected,
    sectionsCount: sectionsInjected || degradedFallback ? sections.length : 0,
    fallbackContextFile,
    degradedFallback,
    notes,
  };
}

export interface StopAgentSessionInput {
  agente: string;
  agent_pubkey?: string | null;
  channel_id?: string | null;
  thread_root?: string | null;
  action?: "interrupt" | "new" | "compact";
  release_issue_id?: string | null;
  reason?: string | null;
  relaunch?: boolean;
  reset_session_before_relaunch?: boolean;
  relaunch_instruction?: string | null;
  target_files?: string[] | null;
  acceptance_command?: string | null;
  max_shells?: number | null;
}

export interface StopAgentSessionResult {
  ok: boolean;
  action: "interrupt" | "new" | "compact";
  agentName: string | null;
  agentKey: string | null;
  agentPlace: string | null;
  place: { channelId: string; root?: string };
  previousState: string | null;
  lockReleased: boolean;
  relaunched: boolean;
  relaunchMessage?: string | null;
  next_required_action?: string | null;
  message: string;
}

export async function stopAgentSession(
  ctx: Context,
  input: StopAgentSessionInput
): Promise<StopAgentSessionResult> {
  const agentsApi = (ctx as any).agents;
  const action: "interrupt" | "new" | "compact" =
    input.action === "new" || input.action === "compact" ? input.action : "interrupt";
  const channelId = String(input.channel_id || DEFAULT_ORGFY_CHANNEL).trim() || DEFAULT_ORGFY_CHANNEL;
  const root = input.thread_root ? String(input.thread_root).trim() : undefined;
  const place: { channelId: string; root?: string } = root ? { channelId, root } : { channelId };

  if (!agentsApi?.snapshot || (!agentsApi?.session && !agentsApi?.interrupt)) {
    return {
      ok: false,
      action,
      agentName: null,
      agentKey: null,
      agentPlace: null,
      place,
      previousState: null,
      lockReleased: false,
      relaunched: false,
      message: "API nativa ctx.agents.session / snapshot indisponível neste host.",
    };
  }

  const snap = agentsApi.snapshot() || {};
  const pool: any[] = [];
  const seen = new Set<string>();
  for (const list of [snap.running, snap.agents]) {
    if (!Array.isArray(list)) continue;
    for (const a of list) {
      if (!a || !a.key || seen.has(a.key)) continue;
      seen.add(a.key);
      pool.push(a);
    }
  }

  const queryRaw = String(input.agente || "").trim();
  const queryLower = queryRaw.toLowerCase();
  const pubkeyLower = String(input.agent_pubkey || "").trim().toLowerCase();

  const matched =
    (pubkeyLower && pool.find((a) => String(a.pubkey || "").toLowerCase() === pubkeyLower)) ||
    pool.find((a) => String(a.key || "").toLowerCase() === queryLower) ||
    pool.find((a) => String(a.pubkey || "").toLowerCase() === queryLower) ||
    pool.find((a) => String(a.name || "").toLowerCase() === queryLower) ||
    (queryLower
      ? pool.find((a) => String(a.name || "").toLowerCase().includes(queryLower))
      : undefined);

  if (!matched) {
    const available = pool.map((a) => a.name || a.key).slice(0, 12).join(", ");
    return {
      ok: false,
      action,
      agentName: null,
      agentKey: null,
      agentPlace: null,
      place,
      previousState: null,
      lockReleased: false,
      relaunched: false,
      message: `Agente '${queryRaw || pubkeyLower}' não encontrado no Buzz Desktop. Disponíveis: ${available || "nenhum"}`,
    };
  }

  const resolvedName = String(matched.name || matched.key);
  let previousState: string | null = null;
  try {
    if (agentsApi.sessionState) {
      previousState = String(agentsApi.sessionState(matched.key, place));
    }
  } catch {
    previousState = null;
  }

  try {
    if (matched.place === "hosted" && action === "interrupt" && agentsApi.interrupt) {
      await agentsApi.interrupt(matched.key, {
        channelId: place.channelId,
        ...(place.root ? { threadRootId: place.root } : {}),
      });
    } else if (agentsApi.session) {
      await agentsApi.session(matched.key, place, action);
    } else if (action === "interrupt" && agentsApi.interrupt) {
      await agentsApi.interrupt(matched.key, {
        channelId: place.channelId,
        ...(place.root ? { threadRootId: place.root } : {}),
      });
    } else {
      return {
        ok: false,
        action,
        agentName: resolvedName,
        agentKey: matched.key,
        agentPlace: matched.place || null,
        place,
        previousState,
        lockReleased: false,
        relaunched: false,
        message: `Host não suporta ação '${action}' para ${resolvedName}.`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      action,
      agentName: resolvedName,
      agentKey: matched.key,
      agentPlace: matched.place || null,
      place,
      previousState,
      lockReleased: false,
      relaunched: false,
      message: `Falha ao executar '${action}' em ${resolvedName}: ${err?.message || err}`,
    };
  }

  let lockReleased = false;
  if (input.release_issue_id && String(input.release_issue_id).trim()) {
    try {
      const rel = await releaseCheckoutLock(ctx, String(input.release_issue_id).trim(), undefined, true);
      lockReleased = rel.ok && rel.code === "RELEASED";
    } catch {
      lockReleased = false;
    }
  }

  let relaunched = false;
  let relaunchMessage: string | null = null;
  const wantRelaunch = Boolean(input.relaunch);
  const relaunchInstr = String(input.relaunch_instruction || "").trim();
  if (wantRelaunch && agentsApi?.wake) {
    try {
      if (input.reset_session_before_relaunch && action !== "new" && agentsApi.session) {
        try {
          await agentsApi.session(matched.key, place, "new");
        } catch {
          // Opcional
        }
      }
      const files = Array.isArray(input.target_files)
        ? input.target_files.map((f) => String(f || "").trim()).filter(Boolean)
        : [];
      const maxShells = Number.isFinite(Number(input.max_shells)) && Number(input.max_shells) > 0
        ? Math.min(20, Math.max(3, Math.round(Number(input.max_shells))))
        : 10;
      const accCmd = String(input.acceptance_command || "").trim();
      const parts = [
        `@${resolvedName} [ORGFY AUTO-CURA · RELANÇAMENTO ESCOPO FECHADO]`,
        `Sua sessão anterior foi interrompida (${String(input.reason || "loop/travamento").trim()}).`,
        relaunchInstr ? `Objetivo único agora: ${relaunchInstr}` : "Retome a tarefa atual com foco estrito no escopo fechado.",
        files.length > 0 ? `Arquivos-alvo exclusivos: ${files.join(", ")}.` : null,
        accCmd ? `Comando de aceite L-22 obrigatório: ${accCmd}` : null,
        `Limite estrito: máximo ${maxShells} comandos shell (sem --help, sem explorar fora do escopo). Ao passar o aceite, entregue imediatamente; se bater 2 falhas consecutivas, publique BLOQUEADO.`,
      ].filter(Boolean);
      relaunchMessage = parts.join(" ");
      await agentsApi.wake(matched.key, {
        channel: place.channelId,
        ...(place.root ? { root: place.root } : {}),
        text: relaunchMessage,
      });
      relaunched = true;
    } catch (wakeErr: any) {
      relaunchMessage = `Falha no relaunch automático: ${wakeErr?.message || wakeErr}`;
    }
  }

  const nextRequiredAction = relaunched
    ? null
    : `AÇÃO OBRIGATÓRIA DO COO (parar nunca encerra o turno): escolha 1 dos 3 desfechos para ${resolvedName}: (1) Se erro de API/5xx, chame orgfy_model_failover({ agente: '${resolvedName}', channel_id: '${place.channelId}'${place.root ? `, thread_root: '${place.root}'` : ""}, prefer_free: false, apply: true, retrigger: true }); (2) Se a demanda ainda está aberta, chame orgfy_session_stop({ agente: '${resolvedName}', channel_id: '${place.channelId}'${place.root ? `, thread_root: '${place.root}'` : ""}, relaunch: true, relaunch_instruction: '<o que fazer>', target_files: ['...'], acceptance_command: '<L-22>', max_shells: 10 }); (3) Se o PR já foi integrado na main, apenas registre 'AUTO-CURA | ${resolvedName} | ITEM_JA_FECHADO | encerrado sem relançar'.`;

  const reasonSuffix = input.reason ? ` Motivo: ${String(input.reason).trim()}.` : "";
  return {
    ok: true,
    action,
    agentName: resolvedName,
    agentKey: matched.key,
    agentPlace: matched.place || null,
    place,
    previousState,
    lockReleased,
    relaunched,
    relaunchMessage,
    next_required_action: nextRequiredAction,
    message: `Comando '${action}' enviado com sucesso para ${resolvedName} (canal ${place.channelId.slice(0, 8)}${place.root ? `, thread ${place.root.slice(0, 8)}` : ""}).${lockReleased ? " Lock liberado." : ""}${relaunched ? " Agente relançado automaticamente com @menção e escopo fechado." : ""}${reasonSuffix}`,
  };
}

const DEFAULT_WATCHDOG_INTERVAL_MS = 45 * 1000; // 45s para detecção rápida de tempestade 5xx/429
const DEFAULT_WATCHDOG_INITIAL_DELAY_MS = 10 * 1000; // 10s após carregar o plugin
let radarWatchdogTimer: any = null;
let radarWatchdogInitialTimer: any = null;
let radarWatchdogRunning = false;

export function stopGovernanceRadarWatchdog(): void {
  if (radarWatchdogInitialTimer) {
    clearTimeout(radarWatchdogInitialTimer);
    radarWatchdogInitialTimer = null;
  }
  if (radarWatchdogTimer) {
    clearInterval(radarWatchdogTimer);
    radarWatchdogTimer = null;
  }
}

export function startGovernanceRadarWatchdog(
  ctx: Context,
  options: { intervalMs?: number; initialDelayMs?: number } = {}
): boolean {
  const agentsApi = (ctx as any).agents;
  if (!agentsApi?.wake) return false;

  stopGovernanceRadarWatchdog();
  const intervalMs = options.intervalMs ?? DEFAULT_WATCHDOG_INTERVAL_MS;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_WATCHDOG_INITIAL_DELAY_MS;

  const tick = async () => {
    if (radarWatchdogRunning) return;
    radarWatchdogRunning = true;
    try {
      await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: true, includeRadar: true });
    } catch {
      // Watchdog resiliente: nunca derruba o host
    } finally {
      radarWatchdogRunning = false;
    }
  };

  radarWatchdogInitialTimer = setTimeout(() => {
    radarWatchdogInitialTimer = null;
    void tick();
  }, initialDelayMs);
  if (typeof radarWatchdogInitialTimer?.unref === "function") {
    radarWatchdogInitialTimer.unref();
  }

  radarWatchdogTimer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof radarWatchdogTimer?.unref === "function") {
    radarWatchdogTimer.unref();
  }

  return true;
}

export interface ModelFailoverEntry {
  provider: string;
  model: string;
}

export interface ModelFailoverResult {
  ok: boolean;
  switched: boolean;
  code:
    | "SWITCHED"
    | "NOT_RATE_LIMIT"
    | "COOLDOWN_ACTIVE"
    | "STATE_NOT_FOUND"
    | "WRITE_FAILED";
  agentKey: string;
  previous: ModelFailoverEntry | null;
  current: ModelFailoverEntry | null;
  wokeAgent: boolean;
  message: string;
}

export const MODEL_FAILOVER_CHAIN: ModelFailoverEntry[] = [
  { provider: "nexusmind_openai", model: "antigravity/gemini-3.8-flash-medium" },
  { provider: "nexusmind_openai", model: "gpt-6.1-terra" },
  { provider: "nexusmind_anthropic", model: "claude-sonnet-5-5" },
  { provider: "nexusmind_grok", model: "grok-4.1-fast" },
];

const AGENT_STATE_DIR_DEFAULT =
  "/Users/heltonfraga/Library/Application Support/xyz.block.buzz.desktop/agents/state";
const FAILOVER_COOLDOWN_MS = 5 * 60 * 1000;

export function isRateLimitOrProviderError(text: string): boolean {
  const low = String(text || "").toLowerCase();
  return [
    "rate limit exceeded",
    "upstream rate limit",
    "too many requests",
    "429",
    "no available accounts",
    "model requires available accounts",
    "service temporarily unavailable",
    "503 service unavailable",
    "502 bad gateway",
    "504 gateway timeout",
    "resource not found (404)",
    "[404]:",
    "bad request (400)",
    "no target in combo",
    "supports tool calling",
    "upstream request failed",
    "upstream_malformed_function_call",
    "overloaded_error",
    "model is overloaded",
  ].some((marker) => low.includes(marker));
}

export function pickNextHealthyModel(
  currentProvider: string,
  currentModel: string
): ModelFailoverEntry {
  const p = String(currentProvider || "").trim();
  const m = String(currentModel || "").trim();
  const idx = MODEL_FAILOVER_CHAIN.findIndex(
    (entry) => entry.provider === p && entry.model === m
  );
  if (idx >= 0) {
    return MODEL_FAILOVER_CHAIN[(idx + 1) % MODEL_FAILOVER_CHAIN.length];
  }
  return MODEL_FAILOVER_CHAIN[0];
}

export async function executeAgentModelFailover(
  ctx: Context,
  options: {
    agentPubkey: string;
    agentName?: string;
    errorText: string;
    channel?: string;
    autoWake?: boolean;
    stateDir?: string;
    nowMs?: number;
  }
): Promise<ModelFailoverResult> {
  const agentKey = options.agentName || options.agentPubkey;
  const nowMs = options.nowMs ?? Date.now();

  if (!isRateLimitOrProviderError(options.errorText)) {
    return {
      ok: false,
      switched: false,
      code: "NOT_RATE_LIMIT",
      agentKey,
      previous: null,
      current: null,
      wokeAgent: false,
      message: "Erro informado não é rate limit/indisponibilidade transitória de provedor.",
    };
  }

  const cooldownKey = `model_failover:${options.agentPubkey}`;
  if (!canTriggerWithCooldown(cooldownKey, nowMs, true, FAILOVER_COOLDOWN_MS)) {
    return {
      ok: true,
      switched: false,
      code: "COOLDOWN_ACTIVE",
      agentKey,
      previous: null,
      current: null,
      wokeAgent: false,
      message: `Failover de modelo em cooldown (5 min) para ${agentKey}.`,
    };
  }

  const host = (ctx as any).host;
  const dir = options.stateDir || AGENT_STATE_DIR_DEFAULT;
  const statePath = `${dir}/buzz.agent.v1%3A${options.agentPubkey}`;

  try {
    const raw = await host.readFile(statePath);
    const text =
      typeof raw === "string"
        ? raw
        : raw instanceof Uint8Array
        ? new TextDecoder("utf-8").decode(raw)
        : raw instanceof ArrayBuffer
        ? new TextDecoder("utf-8").decode(new Uint8Array(raw))
        : String(raw ?? "");
    const parsed = JSON.parse(text);
    const cfg = (parsed.config = parsed.config || {});
    const previous: ModelFailoverEntry = {
      provider: String(cfg.provider || ""),
      model: String(cfg.model || ""),
    };
    const next = pickNextHealthyModel(previous.provider, previous.model);
    cfg.provider = next.provider;
    cfg.model = next.model;

    if (host?.writeFile) {
      await host.writeFile(statePath, JSON.stringify(parsed, null, 2));
    }

    try {
      const notifApi = (ctx as any).notifications;
      if (notifApi?.notify) {
        await notifApi.notify({
          title: `OrgFy Failover [${agentKey}]`,
          body: `Rate limit detectado. Modelo trocado de ${previous.model || "vazio"} para ${next.provider}/${next.model}.`,
        });
      }
    } catch {}

    let wokeAgent = false;
    if (options.autoWake !== false) {
      try {
        const agentsApi = (ctx as any).agents;
        if (agentsApi?.wake) {
          await agentsApi.wake(options.agentName || options.agentPubkey, {
            channel: options.channel || "#esteira-orgfy",
            text: `[ORGFY FAILOVER 429] Modelo rotacionado para ${next.provider}/${next.model} após rate limit upstream. Retome o turno anterior.`,
          });
          wokeAgent = true;
        }
      } catch {}
    }

    return {
      ok: true,
      switched: true,
      code: "SWITCHED",
      agentKey,
      previous,
      current: next,
      wokeAgent,
      message: `Modelo de ${agentKey} rotacionado: ${previous.model || "vazio"} -> ${next.provider}/${next.model}.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      switched: false,
      code: "STATE_NOT_FOUND",
      agentKey,
      previous: null,
      current: null,
      wokeAgent: false,
      message: `Falha ao ler/atualizar state do agente: ${err?.message || err}`,
    };
  }
}

export interface MentionIdentityCheckResult {
  isForMe: boolean;
  action: "PROCEED" | "[SILENT]";
  mentionedTargets: string[];
  reason: string;
}

function normalizeAgentAlias(raw: string): string {
  return String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkMentionTargetIdentity(input: {
  messageText: string;
  currentAgentName: string;
  currentAgentPubkey?: string;
}): MentionIdentityCheckResult {
  const text = String(input.messageText || "");
  const matches = Array.from(
    text.matchAll(/@((?:OrgFy|Lumen|Tributario)\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/g)
  ).map((m) => m[1].trim());
  const mentionedTargets = Array.from(new Set(matches));

  if (mentionedTargets.length === 0) {
    return {
      isForMe: true,
      action: "PROCEED",
      mentionedTargets: [],
      reason: "Sem menção nominal explícita a outro agente.",
    };
  }

  const meNorm = normalizeAgentAlias(input.currentAgentName);
  const isAddressedToMe = mentionedTargets.some((t) => {
    const tNorm = normalizeAgentAlias(t);
    return tNorm === meNorm || tNorm.includes(meNorm) || meNorm.includes(tNorm);
  });

  if (isAddressedToMe) {
    return {
      isForMe: true,
      action: "PROCEED",
      mentionedTargets,
      reason: `Menção compatível com o perfil ativo (${input.currentAgentName}).`,
    };
  }

  return {
    isForMe: false,
    action: "[SILENT]",
    mentionedTargets,
    reason: `Menção endereçada a [${mentionedTargets.join(", ")}], não a ${input.currentAgentName}. Responder [SILENT].`,
  };
}

const THREAD_WAKE_COOLDOWN_MS = 10 * 60 * 1000;
const threadWakeTimestamps = new Map<string, number>();

export function resetThreadWakeGuardForTests(): void {
  threadWakeTimestamps.clear();
}

export function checkThreadWakeAntiLoop(input: {
  agentKey: string;
  threadRoot?: string;
  contextText?: string;
  nowMs?: number;
  bypass?: boolean;
}): { allow: boolean; reason: string } {
  if (input.bypass) {
    return { allow: true, reason: "bypass" };
  }
  const nowMs = input.nowMs ?? Date.now();
  const ctxLow = String(input.contextText || "").toLowerCase();
  const waitingOtherGate =
    (ctxLow.includes("aguardando gate") || ctxLow.includes("waiting for gate")) &&
    !ctxLow.includes(normalizeAgentAlias(input.agentKey));

  if (waitingOtherGate && input.threadRoot) {
    return {
      allow: false,
      reason: "waiting_for_other_reviewer_gate",
    };
  }

  if (input.threadRoot) {
    const key = `thread_wake:${normalizeAgentAlias(input.agentKey)}:${input.threadRoot}`;
    const last = threadWakeTimestamps.get(key);
    if (last !== undefined && nowMs - last < THREAD_WAKE_COOLDOWN_MS) {
      return {
        allow: false,
        reason: "thread_wake_cooldown_10m",
      };
    }
    threadWakeTimestamps.set(key, nowMs);
  }

  return { allow: true, reason: "ok" };
}

export function registerGovernanceAgentHooks(ctx: Context): boolean {
  const agentsApi = (ctx as any).agents;
  let registered = false;
  if (agentsApi?.registerHook) {
    try {
      const handleProviderHookFailover = async (payload?: any) => {
        const errText = String(payload?.error || payload?.reason || payload?.output || payload?.message || "");
        const agentPubkey = String(payload?.agentPubkey || payload?.pubkey || "").trim();
        const agentName = String(payload?.agentName || payload?.agent || "").trim();
        if ((agentPubkey || agentName) && isRateLimitOrProviderError(errText)) {
          await executeSmartModelFailover(ctx, {
            agente: agentName || undefined,
            agent_pubkey: agentPubkey || null,
            failed_model: payload?.model ? String(payload.model) : null,
            prefer_free: false,
            apply: true,
            retrigger: true,
            channel_id: String(payload?.channelId || payload?.channel || DEFAULT_ORGFY_CHANNEL),
            thread_root: payload?.threadRoot || payload?.root || null,
          });
        }
      };
      agentsApi.registerHook({
        id: "orgfy-post-turn-governance",
        harness: "all",
        event: "turn.completed",
        run: async (payload?: any) => {
          await handleProviderHookFailover(payload);
          await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: true, includeRadar: true });
        },
      });
      agentsApi.registerHook({
        id: "orgfy-turn-failed-model-failover",
        harness: "all",
        event: "turn.failed",
        run: async (payload?: any) => {
          await handleProviderHookFailover(payload);
        },
      });
      registered = true;
    } catch {
      registered = false;
    }
  }
  const watchdogStarted = startGovernanceRadarWatchdog(ctx);
  return registered || watchdogStarted;
}
