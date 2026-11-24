import type { Context } from "@buzz/author";

export interface ModelCandidateScore {
  model: string;
  provider: string;
  isFree: boolean;
  intelligenceScore: number;
  latencyMs: number | null;
  combinedScore: number;
  online: boolean;
  calls?: number;
  source?: "live_probe" | "nexusmind_ranking" | "gateway_usage";
  error?: string;
}

export interface ModelFailoverInput {
  agente?: string;
  agent_pubkey?: string | null;
  failed_model?: string | null;
  prefer_free?: boolean;
  apply?: boolean;
  retrigger?: boolean;
  channel_id?: string | null;
  thread_root?: string | null;
  retrigger_text?: string | null;
  max_probes?: number;
}

export interface ModelFailoverResult {
  ok: boolean;
  mode: "dry_run" | "applied";
  agentName: string | null;
  agentKey: string | null;
  previousModel: string | null;
  selectedModel: string | null;
  selectedProvider: string | null;
  selectedLatencyMs: number | null;
  selectedIntelligenceScore: number | null;
  retriggered: boolean;
  candidatesTested: number;
  ranking: ModelCandidateScore[];
  message: string;
}

interface ProviderGroupConfig {
  id: string;
  apiKey: string;
  baseUrl: string;
  isAnthropic: boolean;
}

const NEXUSMIND_PROVIDERS: ProviderGroupConfig[] = [
  {
    id: "nexusmind_openai",
    apiKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    baseUrl: "https://api.nexusmind.digital/v1",
    isAnthropic: false,
  },
  {
    id: "nexusmind_antigravity",
    apiKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    baseUrl: "https://api.nexusmind.digital/v1",
    isAnthropic: false,
  },
  {
    id: "nexusmind_grok",
    apiKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    baseUrl: "https://api.nexusmind.digital/v1",
    isAnthropic: false,
  },
  {
    id: "nexusmind_anthropic",
    apiKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    baseUrl: "https://api.nexusmind.digital",
    isAnthropic: true,
  },
];

const DEFAULT_ORGFY_CHANNEL = "e445491d-2fb3-4ebd-8e2e-f6813c33fb03";
const SHARED_RANKING_PATHS = [
  "/Users/heltonfraga/.buzz/.scratch/nexusmind-model-ranking.json",
  "~/.buzz/.scratch/nexusmind-model-ranking.json",
];
const SHARED_USAGE_PATHS = [
  "/Users/heltonfraga/.buzz/.scratch/nm_usage.json",
  "~/.buzz/.scratch/nm_usage.json",
];
export const MODEL_QUARANTINE_PATH = "/Users/heltonfraga/.buzz/.scratch/orgfy-model-quarantine.json";
const DEFAULT_QUARANTINE_TTL_MS = 20 * 60 * 1000;

export interface QuarantinedModelRecord {
  model: string;
  failedAt: number;
  expiresAt: number;
  reason?: string;
}

const modelQuarantineMemory = new Map<string, QuarantinedModelRecord>();

export function clearModelQuarantineForTests(): void {
  modelQuarantineMemory.clear();
}

export async function quarantineFailedModel(
  ctx: Context,
  modelId: string,
  reason: string = "provider_5xx_or_429",
  ttlMs: number = DEFAULT_QUARANTINE_TTL_MS,
  nowMs: number = Date.now()
): Promise<void> {
  const norm = String(modelId || "").trim().toLowerCase();
  if (!norm) return;
  modelQuarantineMemory.set(norm, {
    model: String(modelId).trim(),
    failedAt: nowMs,
    expiresAt: nowMs + ttlMs,
    reason,
  });
  const host = (ctx as any)?.host;
  if (typeof host?.writeFile === "function") {
    try {
      const obj: Record<string, QuarantinedModelRecord> = {};
      for (const [k, v] of modelQuarantineMemory.entries()) {
        if (v.expiresAt > nowMs) obj[k] = v;
      }
      await host.writeFile(MODEL_QUARANTINE_PATH, JSON.stringify(obj, null, 2));
    } catch {
      // Persistência opcional
    }
  }
}

export async function getQuarantinedModels(
  ctx: Context,
  nowMs: number = Date.now()
): Promise<Set<string>> {
  const host = (ctx as any)?.host;
  if (typeof host?.readFile === "function") {
    try {
      const raw = await host.readFile(MODEL_QUARANTINE_PATH);
      if (raw) {
        const parsed = JSON.parse(decodeHostBytes(raw));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
            if (
              v &&
              typeof v.expiresAt === "number" &&
              v.expiresAt > nowMs &&
              !modelQuarantineMemory.has(k.toLowerCase())
            ) {
              modelQuarantineMemory.set(k.toLowerCase(), {
                model: String(v.model || k),
                failedAt: Number(v.failedAt || nowMs),
                expiresAt: v.expiresAt,
                reason: typeof v.reason === "string" ? v.reason : undefined,
              });
            }
          }
        }
      }
    } catch {
      // Arquivo pode não existir ainda
    }
  }
  const active = new Set<string>();
  for (const [k, v] of modelQuarantineMemory.entries()) {
    if (v.expiresAt <= nowMs) {
      modelQuarantineMemory.delete(k);
    } else {
      active.add(k);
    }
  }
  return active;
}

function decodeHostBytes(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}

function inferProviderId(modelId: string): string {
  const m = String(modelId || "").toLowerCase();
  if (m.includes("grok")) return "nexusmind_grok";
  if (
    m.includes("gemini") ||
    m.includes("antigravity") ||
    m.includes("thinking")
  ) {
    return "nexusmind_antigravity";
  }
  if (m.includes("claude")) return "nexusmind_anthropic";
  return "nexusmind_openai";
}

export function isFreeModelId(modelId: string): boolean {
  const lower = String(modelId || "").toLowerCase();
  return lower.includes(":free") || lower.includes("-free") || lower.includes("/free") || lower.endsWith("free");
}

/**
 * Pontuação heurística determinística de inteligência (0..100) para priorizar
 * modelos mais capazes entre os candidatos online (ex.: reasoning/pro/coder/large > mini/nano).
 */
export function estimateModelIntelligence(modelId: string): number {
  const m = String(modelId || "").toLowerCase();
  let score = 50;

  if (/(opus|o3|gpt-5|gpt-6|claude-sonnet-4-6|claude-sonnet-5|gemini-3\.?5?-pro|gemini-2\.5-pro|deepseek-r1|deepseek-v3|qwen3-coder|mistral-large|grok-4)/.test(m)) {
    score += 32;
  } else if (/(sonnet|pro|large|coder|r1|reasoning|thinking|v3|nemotron-ultra|llama-4|glm-4\.5|kimi-k2)/.test(m)) {
    score += 22;
  } else if (/(flash|haiku|medium|70b|72b|32b|devstral|codestral)/.test(m)) {
    score += 12;
  }

  if (/(nano|tiny|1b|3b|7b|8b|fast-free|lite)/.test(m)) {
    score -= 12;
  }
  if (/(thinking|reasoning|high)/.test(m)) {
    score += 6;
  }

  return Math.max(10, Math.min(100, score));
}

/**
 * Combina inteligência (peso principal) com penalidade de latência real (ms)
 * para eleger o modelo mais inteligente e rápido disponível agora.
 */
export function computeCombinedModelScore(intelligenceScore: number, latencyMs: number | null): number {
  if (latencyMs === null || !Number.isFinite(latencyMs)) return -1;
  const latencyPenalty = Math.min(35, (latencyMs / 1000) * 4);
  return Number((intelligenceScore - latencyPenalty).toFixed(2));
}

function getDisabledModelsFromLocalStorage(): Set<string> {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.("nexusmind_disabled_models");
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((x) => String(x))) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Lê o ranking real compartilhado gravado pelo plugin NexusMind Gateway
 * (localStorage["nexusmind_model_ranking"] ou ~/.buzz/.scratch/nexusmind-model-ranking.json),
 * contornando o isolamento de networkOrigins do OrgFy sem perder precisão real.
 */
async function loadSharedNexusMindRanking(
  ctx: Context,
  excludeSet: Set<string>,
  preferFree: boolean
): Promise<ModelCandidateScore[]> {
  const disabled = getDisabledModelsFromLocalStorage();
  let parsed: any = null;

  // 1. Snapshot em disco gravado pelo NexusMind Gateway (mais recente e cross-webview)
  const host = (ctx as any)?.host;
  if (typeof host?.readFile === "function") {
    for (const p of SHARED_RANKING_PATHS) {
      try {
        const raw = await host.readFile(p);
        if (!raw) continue;
        const txt = decodeHostBytes(raw);
        const obj = JSON.parse(txt);
        if (obj && Array.isArray(obj.models) && obj.models.length > 0) {
          parsed = obj;
          break;
        }
      } catch {}
    }
  }

  // 2. Fallback em localStorage
  if (!parsed) {
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.("nexusmind_model_ranking");
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && Array.isArray(obj.models) && obj.models.length > 0) {
          parsed = obj;
        }
      }
    } catch {}
  }

  if (parsed && Array.isArray(parsed.models)) {
    const policy = parsed.policy && typeof parsed.policy === "object" ? parsed.policy : {};
    const effectivePreferFree = preferFree || Boolean(policy.forceFree);
    const blockedAuto = new Set(
      (Array.isArray(policy.autoAssignBlocked) ? policy.autoAssignBlocked : []).map((x: any) =>
        String(x || "").trim().toLowerCase()
      )
    );
    const maxCost =
      typeof policy.maxCostPerReqUsd === "number" && policy.maxCostPerReqUsd > 0
        ? policy.maxCostPerReqUsd
        : null;
    const pinnedModel =
      policy.tierPins && typeof policy.tierPins === "object"
        ? String(policy.tierPins.geral || policy.tierPins.tier2_balanced || "").trim()
        : "";

    const candidates: ModelCandidateScore[] = [];
    for (const m of parsed.models) {
      const mid = String(m?.model || "").trim();
      if (!mid || m.isDisabled || m.autoAssignBlocked || disabled.has(mid) || excludeSet.has(mid.toLowerCase())) continue;
      if (blockedAuto.has(mid.toLowerCase())) continue;
      if (m.online === false) continue; // Pula modelos que falharam no ping real do NexusMind
      if (maxCost !== null && typeof m.avgCostUsd === "number" && m.avgCostUsd > 0 && m.avgCostUsd > maxCost) continue;
      const free = isFreeModelId(mid);
      if (effectivePreferFree && !free) continue;
      if (!effectivePreferFree && free) continue;
      const isPinned = Boolean(pinnedModel && mid === pinnedModel);
      candidates.push({
        model: mid,
        provider: String(m.group || inferProviderId(mid)),
        isFree: free,
        intelligenceScore: Number(m.capabilityScore || estimateModelIntelligence(mid)),
        latencyMs:
          typeof m.pingLatencyMs === "number"
            ? m.pingLatencyMs
            : typeof m.avgFirstTokenMs === "number"
            ? m.avgFirstTokenMs
            : typeof m.avgDurationMs === "number"
            ? m.avgDurationMs
            : null,
        combinedScore: isPinned ? 1000 : Number(m.score ?? estimateModelIntelligence(mid)),
        online: true,
        calls: Number(m.calls || 0),
        source: "nexusmind_ranking",
      });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.combinedScore - a.combinedScore);
      return candidates;
    }
  }

  // 3. Fallback direto em ~/.buzz/.scratch/nm_usage.json (telemetria bruta do Gateway)
  if (typeof host?.readFile === "function") {
    for (const p of SHARED_USAGE_PATHS) {
      try {
        const raw = await host.readFile(p);
        if (!raw) continue;
        const txt = decodeHostBytes(raw);
        const obj = JSON.parse(txt);
        const items: any[] = Array.isArray(obj?.data?.items)
          ? obj.data.items
          : Array.isArray(obj?.items)
          ? obj.items
          : [];
        if (items.length === 0) continue;

        const acc = new Map<string, { calls: number; durSum: number; durN: number }>();
        for (const it of items) {
          const mid = String(it?.model || "").trim();
          if (!mid || disabled.has(mid) || excludeSet.has(mid.toLowerCase())) continue;
          const free = isFreeModelId(mid);
          if (preferFree && !free) continue;
          if (!preferFree && free) continue;
          let st = acc.get(mid);
          if (!st) {
            st = { calls: 0, durSum: 0, durN: 0 };
            acc.set(mid, st);
          }
          st.calls += 1;
          const dur = Number(it?.first_token_ms ?? it?.duration_ms);
          if (Number.isFinite(dur) && dur > 0 && dur < 180000) {
            st.durSum += dur;
            st.durN += 1;
          }
        }

        const fromUsage: ModelCandidateScore[] = [];
        for (const [mid, st] of acc.entries()) {
          if (st.calls < 5) continue;
          const intel = estimateModelIntelligence(mid);
          const avgMs = st.durN > 0 ? Math.round(st.durSum / st.durN) : null;
          const adoption = Math.min(25, Math.log10(st.calls + 1) * 6.5);
          const speedBonus = avgMs !== null ? Math.max(0, 15 - (avgMs / 1000) * 0.5) : 5;
          fromUsage.push({
            model: mid,
            provider: inferProviderId(mid),
            isFree: isFreeModelId(mid),
            intelligenceScore: intel,
            latencyMs: avgMs,
            combinedScore: Number((intel * 0.65 + adoption + speedBonus).toFixed(2)),
            online: true,
            calls: st.calls,
            source: "gateway_usage",
          });
        }
        if (fromUsage.length > 0) {
          fromUsage.sort((a, b) => b.combinedScore - a.combinedScore);
          return fromUsage.slice(0, 10);
        }
      } catch {}
    }
  }

  return [];
}

async function discoverNexusMindCatalog(ctx: Context): Promise<Array<{ id: string; provider: ProviderGroupConfig }>> {
  const host = (ctx as any)?.host;
  const disabled = getDisabledModelsFromLocalStorage();
  const seen = new Map<string, { id: string; provider: ProviderGroupConfig }>();

  if (typeof host?.request === "function") {
    await Promise.all(
      NEXUSMIND_PROVIDERS.map(async (prov) => {
        try {
          const res = await host.request({
            url: "https://api.nexusmind.digital/v1/models",
            method: "GET",
            headers: {
              Authorization: `Bearer ${prov.apiKey}`,
              "User-Agent": "BuzzDesktop/OrgFyFailover",
            },
            timeoutMs: 8000,
          });
          if (res?.status >= 200 && res?.status < 300 && res?.body) {
            const parsed = JSON.parse(res.body);
            const list = Array.isArray(parsed?.data) ? parsed.data : [];
            for (const m of list) {
              const mid = String(m?.id || "").trim();
              if (!mid || disabled.has(mid) || seen.has(mid)) continue;
              seen.set(mid, { id: mid, provider: prov });
            }
          }
        } catch {
          // Grupo indisponível ou origem bloqueada no OrgFy
        }
      })
    );
  }

  if (seen.size === 0) {
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.("nexusmind_cached_models");
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached)) {
          for (const m of cached) {
            const mid = String(m?.id || "").trim();
            if (!mid || disabled.has(mid) || seen.has(mid)) continue;
            const prov =
              NEXUSMIND_PROVIDERS.find((p) => p.id === m?.primaryGroup) || NEXUSMIND_PROVIDERS[0];
            seen.set(mid, { id: mid, provider: prov });
          }
        }
      }
    } catch {}
  }

  return Array.from(seen.values());
}

async function probeModelLive(
  ctx: Context,
  modelId: string,
  prov: ProviderGroupConfig
): Promise<{ online: boolean; latencyMs: number | null; error?: string }> {
  const host = (ctx as any)?.host;
  if (typeof host?.request !== "function") {
    return { online: false, latencyMs: null, error: "ctx.host.request indisponível" };
  }
  const url = prov.isAnthropic
    ? "https://api.nexusmind.digital/v1/messages"
    : "https://api.nexusmind.digital/v1/chat/completions";
  const headers: Record<string, string> = prov.isAnthropic
    ? {
        "x-api-key": prov.apiKey,
        Authorization: `Bearer ${prov.apiKey}`,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/OrgFyFailover",
      }
    : {
        Authorization: `Bearer ${prov.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/OrgFyFailover",
      };

  const t0 = Date.now();
  try {
    const res = await host.request({
      url,
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: prov.isAnthropic ? 16 : 5,
      }),
      timeoutMs: 9000,
    });
    const latencyMs = Date.now() - t0;
    if (res?.status >= 200 && res?.status < 300) {
      return { online: true, latencyMs };
    }
    return { online: false, latencyMs, error: `HTTP ${res?.status ?? "erro"}` };
  } catch (err: any) {
    return { online: false, latencyMs: Date.now() - t0, error: String(err?.message || err).slice(0, 100) };
  }
}

function findAgentInSnapshot(agentsApi: any, query?: string, pubkey?: string | null): any | undefined {
  if (!agentsApi?.snapshot) return undefined;
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
  const qLower = String(query || "").trim().toLowerCase();
  const pkLower = String(pubkey || "").trim().toLowerCase();
  return (
    (pkLower && pool.find((a) => String(a.pubkey || "").toLowerCase() === pkLower)) ||
    (qLower && pool.find((a) => String(a.key || "").toLowerCase() === qLower)) ||
    (qLower && pool.find((a) => String(a.name || "").toLowerCase() === qLower)) ||
    (qLower ? pool.find((a) => String(a.name || "").toLowerCase().includes(qLower)) : undefined)
  );
}

/**
 * Integração nativa OrgFy Control Room ↔ NexusMind Gateway:
 * 1. Tenta ping ao vivo via ctx.host.request (quando permitido);
 * 2. Se o OrgFy estiver sem origem de rede do NexusMind (CSP/manifest), consome automaticamente
 *    o Ranking Real compartilhado pelo NexusMind Gateway (~/.buzz/.scratch/nexusmind-model-ranking.json
 *    ou telemetria real de 30k chamadas em ~/.buzz/.scratch/nm_usage.json);
 * 3. Por padrão evita modelos :free (propensos a HTTP 429), salvo se prefer_free: true;
 * 4. Opcionalmente (apply: true) salva o novo modelo no agente via ctx.agents.save().
 */
export async function executeSmartModelFailover(
  ctx: Context,
  input: ModelFailoverInput = {}
): Promise<ModelFailoverResult> {
  const preferFree = Boolean(input.prefer_free);
  const applyChange = Boolean(input.apply);
  const retrigger = input.retrigger !== false;
  const maxProbes = Math.max(1, Math.min(10, Number(input.max_probes || 6)));
  const failedNorm = String(input.failed_model || "").trim().toLowerCase();

  const agentsApi = (ctx as any).agents;
  const matchedAgent = input.agente || input.agent_pubkey
    ? findAgentInSnapshot(agentsApi, input.agente, input.agent_pubkey)
    : undefined;

  const previousModel =
    (matchedAgent?.config && typeof matchedAgent.config === "object"
      ? String((matchedAgent.config as any).model || "")
      : "") || (input.failed_model || null);

  // Quarentena (20 min) dos modelos que acabaram de falhar para eliminar ping-pong entre dois modelos em 503
  if (failedNorm) {
    await quarantineFailedModel(ctx, input.failed_model || failedNorm, "reported_failed");
  }
  if (applyChange && previousModel) {
    await quarantineFailedModel(ctx, previousModel, "agent_failover_source");
  }
  const quarantined = await getQuarantinedModels(ctx);

  const excludeSet = new Set<string>(quarantined);
  if (failedNorm) excludeSet.add(failedNorm);
  if (previousModel) excludeSet.add(previousModel.toLowerCase());

  // 1. Primeiro verifica o ranking real compartilhado pelo NexusMind Gateway
  let sharedRanking = await loadSharedNexusMindRanking(ctx, excludeSet, preferFree);
  // Se todos os modelos do ranking estiverem em quarentena, relaxa quarentena mantendo apenas o modelo atual excluído
  if (sharedRanking.length === 0 && quarantined.size > 0) {
    const minimalExclude = new Set<string>();
    if (failedNorm) minimalExclude.add(failedNorm);
    if (previousModel) minimalExclude.add(previousModel.toLowerCase());
    sharedRanking = await loadSharedNexusMindRanking(ctx, minimalExclude, preferFree);
  }

  // 1b. Quando ctx.host.request está disponível, valida ao vivo os top candidatos do ranking compartilhado
  // para NUNCA migrar o agente para um modelo que também esteja retornando 503/429 neste momento.
  const host = (ctx as any)?.host;
  let verifiedShared: ModelCandidateScore[] = [];
  if (sharedRanking.length > 0 && typeof host?.request === "function") {
    const toVerify = sharedRanking.slice(0, maxProbes);
    let gotAnyHttpResponse = false;
    for (const cand of toVerify) {
      const prov =
        NEXUSMIND_PROVIDERS.find((p) => p.id === cand.provider) ||
        NEXUSMIND_PROVIDERS.find((p) => p.id === inferProviderId(cand.model)) ||
        NEXUSMIND_PROVIDERS[0];
      const res = await probeModelLive(ctx, cand.model, prov);
      if (res.online || (res.error && /^HTTP\s+\d{3}/.test(res.error))) {
        gotAnyHttpResponse = true;
      }
      if (res.online) {
        verifiedShared.push({
          ...cand,
          provider: prov.id,
          latencyMs: res.latencyMs,
          online: true,
          source: "live_probe",
        });
        // Primeiro candidato mais bem ranqueado que respondeu HTTP 200 vence imediatamente
        break;
      } else {
        if (res.error && /^HTTP\s+(400|404|429|502|503|504)/.test(res.error)) {
          await quarantineFailedModel(ctx, cand.model, res.error);
        }
        verifiedShared.push({
          ...cand,
          latencyMs: res.latencyMs,
          online: false,
          source: "live_probe",
          error: res.error,
        });
      }
    }
    if (!gotAnyHttpResponse) {
      // Host bloqueou rede/CSP (offline) -> mantém ranking compartilhado sem descartar
      verifiedShared = [];
    }
  }

  // 2. Se não houver ranking compartilhado OU se nenhum dos top candidatos respondeu HTTP 200, descobre catálogo direto e faz probe ao vivo
  let probed: ModelCandidateScore[] = [];
  const hasVerifiedOnline = verifiedShared.some((v) => v.online);
  if (sharedRanking.length === 0 || (verifiedShared.length > 0 && !hasVerifiedOnline)) {
    const catalog = await discoverNexusMindCatalog(ctx);
    let pool = catalog.filter((c) => !excludeSet.has(c.id.toLowerCase()));
    if (preferFree) {
      const freeOnly = pool.filter((c) => isFreeModelId(c.id));
      if (freeOnly.length > 0) pool = freeOnly;
    } else {
      const paidOnly = pool.filter((c) => !isFreeModelId(c.id));
      if (paidOnly.length > 0) pool = paidOnly;
    }

    const preRanked = pool
      .map((c) => ({ ...c, intelligenceScore: estimateModelIntelligence(c.id) }))
      .sort((a, b) => b.intelligenceScore - a.intelligenceScore)
      .slice(0, maxProbes);

    if (preRanked.length > 0) {
      probed = await Promise.all(
        preRanked.map(async (cand) => {
          const res = await probeModelLive(ctx, cand.id, cand.provider);
          if (!res.online && res.error && /^HTTP\s+(400|404|429|502|503|504)/.test(res.error)) {
            await quarantineFailedModel(ctx, cand.id, res.error);
          }
          const combinedScore = res.online
            ? computeCombinedModelScore(cand.intelligenceScore, res.latencyMs)
            : -1;
          return {
            model: cand.id,
            provider: cand.provider.id,
            isFree: isFreeModelId(cand.id),
            intelligenceScore: cand.intelligenceScore,
            latencyMs: res.latencyMs,
            combinedScore,
            online: res.online,
            source: "live_probe" as const,
            error: res.error,
          };
        })
      );
      probed.sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
        return (a.latencyMs ?? 999999) - (b.latencyMs ?? 999999);
      });
    }
  }

  const finalRanking =
    verifiedShared.some((v) => v.online)
      ? verifiedShared
      : probed.some((p) => p.online)
      ? probed
      : verifiedShared.length > 0
      ? verifiedShared
      : sharedRanking.length > 0
      ? sharedRanking
      : probed;
  const winner = finalRanking.find((p) => p.online) || null;

  if (!winner) {
    return {
      ok: false,
      mode: applyChange ? "applied" : "dry_run",
      agentName: matchedAgent?.name || input.agente || null,
      agentKey: matchedAgent?.key || null,
      previousModel,
      selectedModel: null,
      selectedProvider: null,
      selectedLatencyMs: null,
      selectedIntelligenceScore: null,
      retriggered: false,
      candidatesTested: finalRanking.length,
      ranking: finalRanking,
      message:
        finalRanking.length > 0
          ? `Nenhum dos ${finalRanking.length} modelos testados respondeu HTTP 200 no ping real do NexusMind. Abra a aba "Ranking de Modelos" no plugin NexusMind Gateway para atualizar o ranking.`
          : "Ranking do NexusMind indisponível. Abra o plugin NexusMind Gateway > Ranking de Modelos para gerar o ranking em tempo real.",
    };
  }

  let appliedOk = false;
  let retriggered = false;
  let applyNote = "";
  const sourceTag =
    winner.source === "nexusmind_ranking"
      ? `Ranking NexusMind · score ${winner.combinedScore}${winner.calls ? ` · ${winner.calls} chamadas reais` : ""}`
      : winner.source === "gateway_usage"
      ? `Telemetria Gateway · score ${winner.combinedScore}${winner.calls ? ` · ${winner.calls} chamadas reais` : ""}`
      : `${winner.latencyMs}ms · score ${winner.combinedScore}`;

  if (applyChange) {
    if (!matchedAgent) {
      return {
        ok: false,
        mode: "applied",
        agentName: input.agente || null,
        agentKey: null,
        previousModel,
        selectedModel: winner.model,
        selectedProvider: winner.provider,
        selectedLatencyMs: winner.latencyMs,
        selectedIntelligenceScore: winner.intelligenceScore,
        retriggered: false,
        candidatesTested: finalRanking.length,
        ranking: finalRanking,
        message: `Melhor modelo eleito (${winner.model}, ${sourceTag}), mas agente '${input.agente || input.agent_pubkey || ""}' não encontrado no Buzz Desktop.`,
      };
    }

    if (typeof agentsApi?.save !== "function") {
      return {
        ok: false,
        mode: "applied",
        agentName: matchedAgent.name || matchedAgent.key,
        agentKey: matchedAgent.key,
        previousModel,
        selectedModel: winner.model,
        selectedProvider: winner.provider,
        selectedLatencyMs: winner.latencyMs,
        selectedIntelligenceScore: winner.intelligenceScore,
        retriggered: false,
        candidatesTested: finalRanking.length,
        ranking: finalRanking,
        message: `Melhor modelo eleito (${winner.model}, ${sourceTag}), mas ctx.agents.save indisponível neste host.`,
      };
    }

    const currentCfg =
      matchedAgent.config && typeof matchedAgent.config === "object"
        ? { ...(matchedAgent.config as Record<string, any>) }
        : {};
    currentCfg.model = winner.model;
    if ("provider" in currentCfg || winner.provider) {
      currentCfg.provider = winner.provider;
    }

    try {
      await agentsApi.save(matchedAgent.key, { config: currentCfg });
      appliedOk = true;
      applyNote = `Modelo de ${matchedAgent.name || matchedAgent.key} atualizado de '${previousModel || "padrão"}' para '${winner.model}' (${winner.provider} · ${sourceTag}).`;
    } catch (err: any) {
      return {
        ok: false,
        mode: "applied",
        agentName: matchedAgent.name || matchedAgent.key,
        agentKey: matchedAgent.key,
        previousModel,
        selectedModel: winner.model,
        selectedProvider: winner.provider,
        selectedLatencyMs: winner.latencyMs,
        selectedIntelligenceScore: winner.intelligenceScore,
        retriggered: false,
        candidatesTested: finalRanking.length,
        ranking: finalRanking,
        message: `Falha ao salvar novo modelo '${winner.model}' em ${matchedAgent.name || matchedAgent.key}: ${err?.message || err}`,
      };
    }

    if (appliedOk && retrigger && typeof agentsApi?.wake === "function") {
      try {
        const channel = String(input.channel_id || DEFAULT_ORGFY_CHANNEL).trim() || DEFAULT_ORGFY_CHANNEL;
        const root = input.thread_root ? String(input.thread_root).trim() : undefined;
        await agentsApi.wake(matchedAgent.key, {
          channel,
          ...(root ? { root } : {}),
          text:
            input.retrigger_text ||
            `[ORGFY FAILOVER AUTOMÁTICO] Seu modelo foi migrado para '${winner.model}' (${winner.provider} · ${sourceTag}) após erro de API no modelo anterior. Retome imediatamente o último passo da tarefa com escopo fechado.`,
        });
        retriggered = true;
        applyNote += " Agente re-disparado automaticamente.";
      } catch (wErr: any) {
        applyNote += ` (Aviso: falha no re-disparo wake: ${wErr?.message || wErr})`;
      }
    }
  }

  return {
    ok: true,
    mode: applyChange ? "applied" : "dry_run",
    agentName: matchedAgent?.name || input.agente || null,
    agentKey: matchedAgent?.key || null,
    previousModel,
    selectedModel: winner.model,
    selectedProvider: winner.provider,
    selectedLatencyMs: winner.latencyMs,
    selectedIntelligenceScore: winner.intelligenceScore,
    retriggered,
    candidatesTested: finalRanking.length,
    ranking: finalRanking,
    message:
      applyNote ||
      `Melhor modelo disponível (${preferFree ? "FREE" : "PRODUÇÃO"}): ${winner.model} (${winner.provider} · ${sourceTag}).`,
  };
}
