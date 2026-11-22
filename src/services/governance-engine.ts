import type { Context } from "@buzz/author";
import { fetchKpisEsteira, type KpisEsteiraPayload } from "./kpi-service";

export interface CheckoutLockRecord {
  issueId: string;
  agentKey: string;
  acquiredAt: number;
  expiresAt: number;
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
  issues: string[];
  recommendation: string;
}

export const LOCKS_FILE_PATH = "/Users/heltonfraga/.buzz/.scratch/orgfy-locks.json";
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000; // 30 min
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min

// Estado em memória (determinístico para runtime + testes unitários)
const memoryLocks = new Map<string, CheckoutLockRecord>();
const alertCooldowns = new Map<string, number>();

export function resetGovernanceMemoryStateForTests(): void {
  memoryLocks.clear();
  alertCooldowns.clear();
}

function purgeExpiredLocks(now: number): void {
  for (const [key, rec] of memoryLocks.entries()) {
    if (rec.expiresAt <= now) {
      memoryLocks.delete(key);
    }
  }
}

async function syncLocksFromDisk(ctx: Context): Promise<void> {
  const host = (ctx as any).host;
  if (!host?.readFile) return;
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
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
        if (v && typeof v.agentKey === "string" && typeof v.expiresAt === "number" && v.expiresAt > now) {
          if (!memoryLocks.has(k)) {
            memoryLocks.set(k, {
              issueId: k,
              agentKey: v.agentKey,
              acquiredAt: Number(v.acquiredAt || now),
              expiresAt: v.expiresAt,
            });
          }
        }
      }
    }
  } catch {
    // Arquivo pode ainda não existir
  }
}

async function persistLocksToDisk(ctx: Context): Promise<void> {
  const host = (ctx as any).host;
  if (!host?.writeFile) return;
  try {
    const obj: Record<string, CheckoutLockRecord> = {};
    for (const [k, v] of memoryLocks.entries()) {
      obj[k] = v;
    }
    await host.writeFile(LOCKS_FILE_PATH, JSON.stringify(obj, null, 2));
  } catch {
    // Ignora caso writeFile não esteja habilitado
  }
}

export async function acquireCheckoutLock(
  ctx: Context,
  issueId: string,
  agentKey: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS,
  nowMs: number = Date.now()
): Promise<LockActionResult> {
  const cleanIssue = String(issueId || "").trim();
  const cleanAgent = String(agentKey || "").trim();
  if (!cleanIssue || !cleanAgent) {
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      message: "issueId e agentKey são obrigatórios para checkout atômico.",
    };
  }

  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(nowMs);

  const existing = memoryLocks.get(cleanIssue);
  if (existing && existing.expiresAt > nowMs) {
    if (existing.agentKey === cleanAgent) {
      const renewed: CheckoutLockRecord = {
        issueId: cleanIssue,
        agentKey: cleanAgent,
        acquiredAt: existing.acquiredAt,
        expiresAt: nowMs + ttlMs,
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
    expiresAt: nowMs + ttlMs,
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
  const cleanIssue = String(issueId || "").trim();
  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(Date.now());

  const existing = memoryLocks.get(cleanIssue);
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

  memoryLocks.delete(cleanIssue);
  await persistLocksToDisk(ctx);
  return {
    ok: true,
    code: "RELEASED",
    message: `Lock de ${cleanIssue} liberado com sucesso.`,
  };
}

export async function listActiveLocks(ctx: Context, nowMs: number = Date.now()): Promise<CheckoutLockRecord[]> {
  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(nowMs);
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

export async function evaluateGovernanceAndReact(
  ctx: Context,
  options: {
    dryRun?: boolean;
    autoWake?: boolean;
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

  const alerts = kpis?.alertas_ativos ?? [];

  for (const al of alerts) {
    const cooldownKey = `alert:${al.codigo}`;
    if (!canTriggerWithCooldown(cooldownKey, nowMs, !options.dryRun)) {
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
      (al.codigo === "REVIEW_QUEUE_BOTTLENECK" || al.codigo === "STAGNATION_LEVEL_3")
    ) {
      const wakeKey = options.reviewerAgentKey || "OrgFy Bento";
      const wakeCooldownKey = `wake:${al.codigo}:${wakeKey}`;
      if (canTriggerWithCooldown(wakeCooldownKey, nowMs)) {
        try {
          const agentsApi = (ctx as any).agents;
          if (agentsApi?.wake) {
            await agentsApi.wake(wakeKey, {
              channel: options.channel || "#esteira-orgfy",
              text: `[ORGFY GOVERNANÇA] ${al.mensagem} Ação recomendada: ${al.acao_sugerida}`,
            });
            wakesTriggered.push(`${wakeKey}:${al.codigo}`);
          }
        } catch {
          // Wake opcional conforme capacidades do host
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

export async function lintCardForDispatch(
  ctx: Context,
  input: {
    issueId?: string;
    titulo?: string;
    acceptanceCommand?: string;
    descricao?: string;
    executor?: string;
    revisor?: string;
  }
): Promise<CardLintResult> {
  const issues: string[] = [];
  const titulo = String(input.titulo || "").trim();
  const cmd = String(input.acceptanceCommand || "").trim();
  const desc = String(input.descricao || "").trim();

  if (!titulo || titulo.length < 10) {
    issues.push("Título muito curto ou ausente (mínimo 10 caracteres).");
  }
  if (!cmd) {
    issues.push("Regra L-22 violada: comando de aceite executável (acceptanceCommand) ausente.");
  } else if (/^(todo|tbd|none|n\/a)$/i.test(cmd)) {
    issues.push("Regra L-22 violada: acceptanceCommand contém placeholder não executável.");
  }
  if (input.executor && input.revisor && input.executor.trim() === input.revisor.trim()) {
    issues.push("Regra L-01 violada: executor e revisor não podem ser o mesmo agente.");
  }

  let usedDecisionsApi = false;
  let score = issues.length === 0 ? 1.0 : Math.max(0.2, 1.0 - issues.length * 0.3);

  try {
    const decisionsApi = (ctx as any).decisions;
    if (decisionsApi?.decide && issues.length === 0 && (titulo || desc)) {
      const decisionRes = await decisionsApi.decide({
        state: {
          issueId: input.issueId || "draft",
          titulo,
          acceptanceCommand: cmd,
          descricao: desc,
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
      const ans = decisionRes?.answers?.atomic_scope ?? decisionRes?.atomic_scope;
      if (ans === false || ans === "no") {
        issues.push("Avaliação semântica (ctx.decisions): escopo amplo demais ou pouco verificável.");
        score = 0.55;
      }
    }
  } catch {
    // Fallback determinístico já aplicado
  }

  const approved = issues.length === 0;
  return {
    approved,
    score: Number(score.toFixed(2)),
    usedDecisionsApi,
    issues,
    recommendation: approved
      ? "Card aprovado no pré-voo L-01/L-22 e pronto para despacho atômico."
      : "Corrija as pendências acima antes de despachar para evitar retrabalho no Gate.",
  };
}

export interface ConversationContextBindResult {
  ok: boolean;
  conversationId: string;
  folderAssigned: boolean;
  worktreePath: string | null;
  sectionsInjected: boolean;
  sectionsCount: number;
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
  const notes: string[] = [];
  let folderAssigned = false;
  let sectionsInjected = false;
  const worktreePath = input.worktreePath?.trim() || null;

  if (worktreePath && agentsApi?.assignConversationFolder) {
    try {
      await agentsApi.assignConversationFolder(input.conversationId, worktreePath);
      folderAssigned = true;
    } catch (err: any) {
      notes.push(`Falha em assignConversationFolder: ${err?.message || err}`);
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
      notes.push(`Falha em setConversationSections: ${err?.message || err}`);
    }
  } else {
    notes.push("API ctx.agents.setConversationSections indisponível neste host.");
  }

  return {
    ok: folderAssigned || sectionsInjected,
    conversationId: input.conversationId,
    folderAssigned,
    worktreePath,
    sectionsInjected,
    sectionsCount: sectionsInjected ? sections.length : 0,
    notes,
  };
}

export function registerGovernanceAgentHooks(ctx: Context): boolean {
  const agentsApi = (ctx as any).agents;
  if (!agentsApi?.registerHook) return false;
  try {
    agentsApi.registerHook({
      id: "orgfy-post-turn-governance",
      harness: "all",
      event: "turn.completed",
      run: async () => {
        await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: false });
      },
    });
    return true;
  } catch {
    return false;
  }
}
