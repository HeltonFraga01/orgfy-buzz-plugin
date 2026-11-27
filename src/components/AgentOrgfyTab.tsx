// ─────────────────────────────────────────────────────────────────────────────
// ORGFY AGENT PROFILE TAB v17.3 (ctx.agents.registerTab)
// Aba nativa "OrgFy" dentro do perfil de cada agente no Buzz Desktop
// (Identity | Memory | Activity | Bestie | Attention | OrgFy | Settings)
// 100% conectada às APIs diretas do Buzz:
// - session.agentActivity + session.presence (turno ao vivo e presença)
// - ctx.agents.save() (reconciliação Eval R5.1 respeitando config + configBase)
// - ctx.agents.session() (Compactar, Nova sessão, Parar)
// - session.repositories (Issues & PRs NIP-34 ao vivo) + openBuzzRepoEntity (1 salto)
// - Variáveis nativas do tema do Buzz Desktop
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { PipelineCard } from "../types/orgfy";
import { fetchLiveKanbanCards, openIssueInBuzz } from "../services/orgfy-bridge";
import {
  DEFAULT_ORGFY_REPO_OWNER,
  loadLiveRepoSnapshot,
  openBuzzRepoEntity,
  openRepoTabInBuzz,
  type LiveRepoItemSummary,
} from "../services/buzz-repos-live";
import {
  interruptLiveTurn,
  readBuzzLiveTelemetry,
  type LiveAgentTurn,
} from "../factory/buzz-live-telemetry";
import { fetchGooseLoopRadar, type GooseLoopSession } from "../services/kpi-service";
import { getTelemetrySnapshot, subscribeTelemetry, type TelemetrySnapshot } from "../services/telemetry-otel";

const FALLBACK_EVAL_WINNERS = new Set(["gemini-2.5-flash", "gpt-6.1-terra", "claude-opus-4-6-thinking"]);

export interface AgentModelOption {
  provider: string;
  model: string;
  label: string;
  group: "eval_approved" | "nexusmind_online" | "fallback";
  isFree?: boolean;
  mode?: string;
  qualityScore?: number;
  rankingScore?: number;
  latencyMs?: number;
}

export interface LiveGatewayModelCatalog {
  hasLiveData: boolean;
  approvedOptions: AgentModelOption[];
  onlineOtherOptions: AgentModelOption[];
  approvedModels: Set<string>;
  offlineModels: Set<string>;
  forceFree: boolean;
  updatedAt?: string;
}

const FALLBACK_MODEL_PRESETS: AgentModelOption[] = [
  {
    provider: "nexusmind_antigravity",
    model: "gemini-2.5-flash",
    label: "gemini-2.5-flash · Fallback (Rápido)",
    group: "fallback",
  },
  {
    provider: "nexusmind_openai",
    model: "gpt-6.1-terra",
    label: "gpt-6.1-terra · Fallback (Qualidade)",
    group: "fallback",
  },
  {
    provider: "nexusmind_antigravity",
    model: "claude-opus-4-6-thinking",
    label: "claude-opus-4-6-thinking · Fallback (Complexo)",
    group: "fallback",
  },
];

function modelOptionKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

function inferProviderForModel(modelId: string): string {
  const m = String(modelId || "").toLowerCase();
  if (m.includes("/") || m.includes(":free")) return "nexusmind_openai";
  if (m.includes("grok")) return "nexusmind_grok";
  if (m.includes("gemini") || m.includes("antigravity") || m.includes("thinking")) return "nexusmind_antigravity";
  if (m.includes("claude")) return "nexusmind_anthropic";
  return "nexusmind_openai";
}

function decodeTextBytes(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}

function isBlockedGatewayCatalogModel(modelId: string): boolean {
  const m = String(modelId || "").trim().toLowerCase();
  if (!m) return true;
  return (
    m === "haiku" ||
    m === "grok-4.5" ||
    m.includes("gemini-3.8-flash-medium") ||
    m.includes("gemini-3-pro-low") ||
    m.includes("gemini-3-pro-high") ||
    m.includes("mistral-large-4-1t-a52b") ||
    m.includes("claude-opus-5-5") ||
    m.includes("minimax-m3.1-flash") ||
    m.includes("pol/community/") ||
    m.includes("pollinations/community/") ||
    m.startsWith("auto/")
  );
}

export function isVipOrLeadershipAgent(roleOrName: string): boolean {
  const lower = normName(roleOrName);
  return /(iris|bento|arquit|teo|vera|hugo|lara|ceo|coo|revis|qa|segur|secur|oraculo|conselho|board)/.test(lower);
}

function formatLatencyShort(ms?: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export async function loadLiveGatewayModelCatalog(ctx: Context): Promise<LiveGatewayModelCatalog> {
  const host = (ctx as any)?.host;
  const approvedModels = new Set<string>();
  const offlineModels = new Set<string>();
  const benchByModel = new Map<
    string,
    {
      model: string;
      toolCallOk: boolean;
      online: boolean;
      qualityScore?: number;
      latencyMs?: number;
      group?: string;
    }
  >();

  // 1. Lê resultados do Eval manual do Gateway (nexusmind-quality-bench.json)
  let benchParsed: any = null;
  let updatedAt: string | undefined;
  if (typeof host?.readFile === "function") {
    for (const p of [
      "~/.buzz/.scratch/nexusmind-quality-bench.json",
      "/Users/heltonfraga/.buzz/.scratch/nexusmind-quality-bench.json",
    ]) {
      try {
        const raw = await host.readFile(p);
        if (!raw) continue;
        const obj = JSON.parse(decodeTextBytes(raw));
        if (obj && typeof obj === "object") {
          if (typeof obj.updatedAt === "string") updatedAt = obj.updatedAt;
          benchParsed = obj.results && typeof obj.results === "object" ? obj.results : obj;
          break;
        }
      } catch {}
    }
  }
  if (!benchParsed) {
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.("nexusmind_quality_bench_v1");
      if (raw) {
        const obj = JSON.parse(raw);
        benchParsed = obj?.results && typeof obj.results === "object" ? obj.results : obj;
      }
    } catch {}
  }
  if (benchParsed && typeof benchParsed === "object") {
    for (const [mid, rec] of Object.entries(benchParsed as Record<string, any>)) {
      if (!rec || typeof rec !== "object") continue;
      const online = Boolean(rec.online);
      const toolCallOk = Boolean(rec.toolCallOk);
      const keyLower = mid.toLowerCase();
      const shortId = String(mid.split("/").pop() || mid).trim().toLowerCase();
      const latencyMs =
        typeof rec.avgLatencyMs === "number"
          ? rec.avgLatencyMs
          : typeof rec.latencyMs === "number"
          ? rec.latencyMs
          : undefined;
      benchByModel.set(keyLower, {
        model: mid,
        toolCallOk,
        online,
        qualityScore: typeof rec.qualityScore === "number" ? rec.qualityScore : undefined,
        latencyMs,
        group: typeof rec.group === "string" ? rec.group : undefined,
      });
      if (online && toolCallOk) {
        approvedModels.add(keyLower);
        if (shortId) approvedModels.add(shortId);
      } else {
        offlineModels.add(keyLower);
        if (shortId) offlineModels.add(shortId);
      }
    }
  }

  // 2. Lê o Ranking do Gateway (nexusmind-model-ranking.json)
  let rankingParsed: any = null;
  if (typeof host?.readFile === "function") {
    for (const p of [
      "~/.buzz/.scratch/nexusmind-model-ranking.json",
      "/Users/heltonfraga/.buzz/.scratch/nexusmind-model-ranking.json",
    ]) {
      try {
        const raw = await host.readFile(p);
        if (!raw) continue;
        const obj = JSON.parse(decodeTextBytes(raw));
        if (obj && Array.isArray(obj.models) && obj.models.length > 0) {
          rankingParsed = obj;
          if (!updatedAt && typeof obj.updatedAt === "string") updatedAt = obj.updatedAt;
          break;
        }
      } catch {}
    }
  }
  if (!rankingParsed) {
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.("nexusmind_model_ranking");
      if (raw) rankingParsed = JSON.parse(raw);
    } catch {}
  }

  const rankingByModel = new Map<string, any>();
  if (rankingParsed && Array.isArray(rankingParsed.models)) {
    for (const m of rankingParsed.models) {
      const mid = String(m?.model || "").trim();
      if (mid) rankingByModel.set(mid.toLowerCase(), m);
    }
  }

  const approvedOptions: AgentModelOption[] = [];
  const onlineOtherOptions: AgentModelOption[] = [];
  const seen = new Set<string>();

  // 2a. Primeiro: todos os modelos online + TC ✓ (Eval ao vivo + Ranking)
  const candidateApproved = new Map<
    string,
    {
      model: string;
      provider: string;
      qualityScore?: number;
      rankingScore?: number;
      latencyMs?: number;
      mode?: string;
      isFree: boolean;
    }
  >();

  for (const [keyLower, b] of benchByModel.entries()) {
    if (!b.online || !b.toolCallOk) continue;
    const rankRec = rankingByModel.get(keyLower);
    if (rankRec?.isDisabled) continue;
    const provider = String(rankRec?.group || b.group || inferProviderForModel(b.model)).trim() || inferProviderForModel(b.model);
    candidateApproved.set(keyLower, {
      model: b.model,
      provider,
      qualityScore: b.qualityScore,
      rankingScore: typeof rankRec?.score === "number" ? rankRec.score : undefined,
      latencyMs: b.latencyMs ?? (typeof rankRec?.latencyMs === "number" ? rankRec.latencyMs : undefined),
      mode: typeof rankRec?.mode === "string" ? rankRec.mode : undefined,
      isFree: b.model.toLowerCase().includes(":free") || Boolean(rankRec?.isFree),
    });
  }

  if (rankingParsed && Array.isArray(rankingParsed.models)) {
    for (const m of rankingParsed.models) {
      const mid = String(m?.model || "").trim();
      if (!mid || m?.isDisabled) continue;
      const keyLower = mid.toLowerCase();
      const bench = benchByModel.get(keyLower);
      if (bench && (!bench.online || !bench.toolCallOk)) continue;
      if (m?.online === false) continue;

      const tcOk = m?.toolCallOk === true || bench?.toolCallOk === true;
      const provider = String(m?.group || bench?.group || inferProviderForModel(mid)).trim() || inferProviderForModel(mid);
      const isFree = mid.toLowerCase().includes(":free") || Boolean(m?.isFree);
      const latencyMs = bench?.latencyMs ?? (typeof m?.latencyMs === "number" ? m.latencyMs : undefined);

      if (tcOk) {
        approvedModels.add(keyLower);
        const shortId = String(mid.split("/").pop() || mid).trim().toLowerCase();
        if (shortId) approvedModels.add(shortId);
        if (!candidateApproved.has(keyLower)) {
          candidateApproved.set(keyLower, {
            model: mid,
            provider,
            qualityScore: bench?.qualityScore,
            rankingScore: typeof m?.score === "number" ? m.score : undefined,
            latencyMs,
            mode: typeof m?.mode === "string" ? m.mode : undefined,
            isFree,
          });
        }
      }
    }
  }

  const sortedApproved = Array.from(candidateApproved.values()).sort((a, b) => {
    const aQ = a.qualityScore ?? -1;
    const bQ = b.qualityScore ?? -1;
    if (aQ !== bQ) return bQ - aQ;
    const aS = a.rankingScore ?? -1;
    const bS = b.rankingScore ?? -1;
    if (aS !== bS) return bS - aS;
    return (a.latencyMs ?? 999999) - (b.latencyMs ?? 999999);
  });

  for (const item of sortedApproved) {
    const keyLower = item.model.toLowerCase();
    if (seen.has(keyLower)) continue;
    seen.add(keyLower);
    const parts = [item.model, "TC ✓"];
    if (typeof item.qualityScore === "number") parts.push(`Q${Math.round(item.qualityScore)}`);
    else if (typeof item.rankingScore === "number") parts.push(`score ${item.rankingScore.toFixed(1)}`);
    const latStr = formatLatencyShort(item.latencyMs);
    if (latStr) parts.push(latStr);
    if (item.isFree) parts.push("FREE");
    else if (item.mode === "vip") parts.push("VIP");
    approvedOptions.push({
      provider: item.provider,
      model: item.model,
      label: parts.join(" · "),
      group: "eval_approved",
      isFree: item.isFree,
      mode: item.mode,
      qualityScore: item.qualityScore,
      rankingScore: item.rankingScore,
      latencyMs: item.latencyMs,
    });
    if (approvedOptions.length >= 20) break;
  }

  // 2b. Demais modelos online no Ranking (não reprovados no Eval)
  if (rankingParsed && Array.isArray(rankingParsed.models)) {
    const sortedOther = [...rankingParsed.models].sort(
      (a: any, b: any) => Number(b?.score || 0) - Number(a?.score || 0)
    );
    for (const m of sortedOther) {
      const mid = String(m?.model || "").trim();
      if (!mid || m?.isDisabled || m?.online === false) continue;
      const keyLower = mid.toLowerCase();
      if (seen.has(keyLower)) continue;
      const bench = benchByModel.get(keyLower);
      if (bench && (!bench.online || !bench.toolCallOk)) continue;
      seen.add(keyLower);
      const provider = String(m?.group || inferProviderForModel(mid)).trim() || inferProviderForModel(mid);
      const scoreTxt = typeof m?.score === "number" ? ` · score ${m.score.toFixed(1)}` : "";
      onlineOtherOptions.push({
        provider,
        model: mid,
        label: `${mid}${scoreTxt}`,
        group: "nexusmind_online",
        isFree: mid.toLowerCase().includes(":free") || Boolean(m?.isFree),
        mode: typeof m?.mode === "string" ? m.mode : undefined,
        rankingScore: typeof m?.score === "number" ? m.score : undefined,
      });
      if (onlineOtherOptions.length >= 10) break;
    }
  }

  // 0. Prioridade máxima: Control Plane Único (model-control-plane.json) gerado pelo Eval SOTA v2
  let controlPlaneParsed: any = null;
  if (typeof host?.readFile === "function") {
    for (const p of [
      "~/.buzz/.scratch/model-control-plane.json",
      "/Users/heltonfraga/.buzz/.scratch/model-control-plane.json",
    ]) {
      try {
        const raw = await host.readFile(p);
        if (!raw) continue;
        const obj = JSON.parse(decodeTextBytes(raw));
        if (obj && Array.isArray(obj.models) && obj.models.length > 0) {
          controlPlaneParsed = obj;
          if (typeof obj.updatedAt === "string") updatedAt = obj.updatedAt;
          break;
        }
      } catch {}
    }
  }

  if (controlPlaneParsed && Array.isArray(controlPlaneParsed.models)) {
    const cpForceFree = Boolean(controlPlaneParsed?.policy?.forceFree);
    const cpApproved: AgentModelOption[] = [];
    for (const m of controlPlaneParsed.models) {
      const mid = String(m?.model || "").trim();
      if (!mid) continue;
      const keyLower = mid.toLowerCase();
      const shortId = String(mid.split("/").pop() || mid).trim().toLowerCase();
      const evalApproved = Boolean(m.evalApproved);
      const isOnline = Boolean(m.online);
      const policyState = String(m.policyState || "auto");
      const provider = String(m.provider || inferProviderForModel(mid)).trim();
      const score = typeof m.evalScore === "number" ? m.evalScore : undefined;
      const latencyMs = typeof m.latencyMs === "number" ? m.latencyMs : undefined;
      const isFree = Boolean(m.isFree);

      const blockedByPolicy = isBlockedGatewayCatalogModel(mid) || (!cpForceFree && isFree) || policyState === "blocked";
      if (evalApproved && !blockedByPolicy) {
        approvedModels.add(keyLower);
        if (shortId) approvedModels.add(shortId);
        const parts = [mid, "Eval ✓"];
        if (typeof score === "number") parts.push(`${score.toFixed(1)}`);
        const latStr = formatLatencyShort(latencyMs);
        if (latStr) parts.push(latStr);
        if (policyState === "vip") parts.push("VIP");
        if (isFree) parts.push("FREE");
        cpApproved.push({
          provider,
          model: mid,
          label: parts.join(" · "),
          group: "eval_approved",
          isFree,
          mode: policyState,
          qualityScore: score,
          rankingScore: score,
          latencyMs,
        });
      } else if (!isOnline || blockedByPolicy) {
        approvedModels.delete(keyLower);
        if (shortId) approvedModels.delete(shortId);
        offlineModels.add(keyLower);
        if (shortId) offlineModels.add(shortId);
      }
    }
    if (cpApproved.length > 0) {
      return {
        hasLiveData: true,
        approvedOptions: cpApproved,
        onlineOtherOptions: [],
        approvedModels,
        offlineModels,
        forceFree: cpForceFree,
        updatedAt,
      };
    }
  }

  const filteredApproved = approvedOptions.filter(
    (o) => !isBlockedGatewayCatalogModel(o.model) && (Boolean(rankingParsed?.policy?.forceFree) || !o.isFree)
  );
  return {
    hasLiveData: filteredApproved.length > 0 || onlineOtherOptions.length > 0 || benchByModel.size > 0,
    approvedOptions: filteredApproved,
    onlineOtherOptions: onlineOtherOptions.filter((o) => !isBlockedGatewayCatalogModel(o.model) && !o.isFree),
    approvedModels,
    offlineModels,
    forceFree: Boolean(rankingParsed?.policy?.forceFree ?? rankingParsed?.forceFree),
    updatedAt,
  };
}

export function pickLiveRecommendedModel(
  roleOrName: string,
  catalog: LiveGatewayModelCatalog | null
): { provider: string; model: string; tierLabel: string } {
  const isTier1 = isVipOrLeadershipAgent(roleOrName);
  const tierLabel = isTier1 ? "Tier 1 (VIP · Somente Pago)" : "Tier 2 (Execução/Rápido)";

  if (catalog && catalog.approvedOptions.length > 0) {
    const unblocked = catalog.approvedOptions.filter((o) => !isBlockedGatewayCatalogModel(o.model) && o.mode !== "blocked");
    if (isTier1) {
      // Regra estrita VIP: NUNCA usa :free quando houver qualquer modelo pago disponível, mesmo com forceFree ligado.
      const paidPool = unblocked.filter((o) => !o.isFree);
      if (paidPool.length > 0) {
        const preferredPaid =
          paidPool.find((o) => o.mode === "vip") ||
          paidPool.find((o) => /(gpt-6\.1|claude-sonnet-4-6|claude-opus-4-6|gemini-4-hydrogen|gemini-2\.5-flash)/.test(o.model.toLowerCase())) ||
          paidPool[0];
        return { provider: preferredPaid.provider, model: preferredPaid.model, tierLabel };
      }
      if (unblocked.length > 0) {
        return { provider: unblocked[0].provider, model: unblocked[0].model, tierLabel };
      }
    } else {
      const pool = unblocked.filter((o) => catalog.forceFree || !o.isFree);
      if (pool.length > 0) {
        const preferredFast =
          (catalog.forceFree ? pool.find((o) => o.isFree) : null) ||
          pool.find((o) => !o.isFree && o.model.toLowerCase() === "gemini-2.5-flash") ||
          pool.find((o) => !o.isFree && o.model.toLowerCase().includes("gemini-4-hydrogen")) ||
          pool.find((o) => !o.isFree) ||
          pool[0];
        return { provider: preferredFast.provider, model: preferredFast.model, tierLabel };
      }
    }
  }

  return isTier1
    ? { provider: "nexusmind_openai", model: "gpt-6.1-terra", tierLabel }
    : { provider: "nexusmind_antigravity", model: "gemini-2.5-flash", tierLabel };
}

const SURFACE_BG = "var(--affordance-subtle, rgba(255, 255, 255, 0.035))";
const CARD_BG = "var(--bg-panel, rgba(255, 255, 255, 0.03))";
const BORDER = "1px solid var(--border-primary, rgba(255, 255, 255, 0.09))";
const TEXT_PRIMARY = "var(--text-primary, #f3f4f6)";
const TEXT_MUTED = "var(--text-tertiary, #9ca3af)";
const ACCENT = "var(--accent-primary, var(--green-11, #3dd68c))";
const BLUE = "var(--blue-11, #60a5fa)";
const AMBER = "var(--amber-11, #fbbf24)";
const RED = "var(--red-11, #f87171)";

function normName(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
}

export function createAgentOrgfyTabComponent(ctx: Context) {
  const React = ctx?.react;
  if (!React?.createElement) {
    return function FallbackAgentOrgfyTab() {
      return null;
    };
  }
  const h = React.createElement;

  return function AgentOrgfyTab({ agent }: { agent: any }) {
    const [cards, setCards] = React.useState<PipelineCard[]>([]);
    const [repoItems, setRepoItems] = React.useState<LiveRepoItemSummary[]>([]);
    const [repoOwner, setRepoOwner] = React.useState<string>(DEFAULT_ORGFY_REPO_OWNER);
    const [sessions, setSessions] = React.useState<GooseLoopSession[]>([]);
    const [telemetry, setTelemetry] = React.useState<TelemetrySnapshot>(() => getTelemetrySnapshot());
    const [activityTick, setActivityTick] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [busyAction, setBusyAction] = React.useState<string | null>(null);
    const [statusBanner, setStatusBanner] = React.useState<{ ok: boolean; text: string } | null>(null);
    const [gatewayCatalog, setGatewayCatalog] = React.useState<LiveGatewayModelCatalog | null>(null);

    const agentName = String(agent?.name || agent?.key || "Agente");
    const agentKey = String(agent?.key || "");
    const agentPubkey = String(agent?.pubkey || "").toLowerCase();
    const agentCfg = (agent?.config && typeof agent.config === "object" ? agent.config : {}) as Record<string, any>;
    const currentModel = String(agentCfg.model || agent?.model || "padrão");
    const currentProvider = String(agentCfg.provider || agent?.provider || "padrão");
    const currentHarness = String(agentCfg.harness || agent?.harness || agent?.type || "goose");
    const shortModel = String(currentModel.split("/").pop() || currentModel).trim();
    const isCurrentOffline = Boolean(
      gatewayCatalog?.offlineModels.has(currentModel.toLowerCase()) ||
        gatewayCatalog?.offlineModels.has(shortModel.toLowerCase())
    );
    const isCompliantR51 = gatewayCatalog?.hasLiveData
      ? gatewayCatalog.approvedModels.has(currentModel.toLowerCase()) ||
        gatewayCatalog.approvedModels.has(shortModel.toLowerCase())
      : FALLBACK_EVAL_WINNERS.has(shortModel);
    const recommended = React.useMemo(
      () => pickLiveRecommendedModel(agentName, gatewayCatalog),
      [agentName, gatewayCatalog]
    );

    const modelOptions = React.useMemo<AgentModelOption[]>(() => {
      if (gatewayCatalog?.hasLiveData && (gatewayCatalog.approvedOptions.length > 0 || gatewayCatalog.onlineOtherOptions.length > 0)) {
        return [...gatewayCatalog.approvedOptions, ...gatewayCatalog.onlineOtherOptions];
      }
      return FALLBACK_MODEL_PRESETS;
    }, [gatewayCatalog]);

    const resolveDefaultModelKey = React.useCallback(() => {
      const exactMatch = modelOptions.find(
        (o) =>
          o.model.toLowerCase() === currentModel.toLowerCase() ||
          o.model.toLowerCase() === shortModel.toLowerCase()
      );
      if (exactMatch) return modelOptionKey(exactMatch.provider, exactMatch.model);
      return modelOptionKey(recommended.provider, recommended.model);
    }, [modelOptions, currentModel, shortModel, recommended.provider, recommended.model]);

    const [selectedModelKey, setSelectedModelKey] = React.useState<string>(() => resolveDefaultModelKey());

    React.useEffect(() => {
      setSelectedModelKey(resolveDefaultModelKey());
    }, [agentKey, currentModel, currentProvider, resolveDefaultModelKey]);

    const refreshGatewayCatalog = React.useCallback(async () => {
      try {
        const cat = await loadLiveGatewayModelCatalog(ctx);
        setGatewayCatalog(cat);
      } catch {}
    }, []);

    React.useEffect(() => {
      void refreshGatewayCatalog();
    }, [refreshGatewayCatalog]);

    // Assina telemetria ao vivo nativa do Buzz (session.agentActivity)
    React.useEffect(() => {
      const session = (ctx as any)?.relay?.snapshot?.()?.session;
      if (!session?.agentActivity) return;
      const disposers: Array<() => void> = [];
      const bump = () => setActivityTick((n) => n + 1);
      try {
        if (typeof session.agentActivity.activate === "function") disposers.push(session.agentActivity.activate());
        if (typeof session.agentActivity.subscribe === "function") disposers.push(session.agentActivity.subscribe(bump));
        if (typeof session.agentActivity.subscribeWorking === "function") disposers.push(session.agentActivity.subscribeWorking(bump));
      } catch {}
      return () => {
        for (const d of disposers) {
          try { d(); } catch {}
        }
      };
    }, []);

    const liveTelemetry = React.useMemo(() => {
      const map = new Map<string, string>();
      if (agentPubkey) map.set(agentPubkey, agentName);
      return readBuzzLiveTelemetry(ctx, map);
    }, [agentPubkey, agentName, activityTick]);

    const liveTurn: LiveAgentTurn | null = agentPubkey ? liveTelemetry.byPubkey[agentPubkey] || null : null;
    const presence = agentPubkey ? liveTelemetry.presenceByPubkey[agentPubkey] : undefined;

    const loadAgentContext = React.useCallback(async () => {
      setLoading(true);
      try {
        const [allCards, radar, repoSnap] = await Promise.all([
          fetchLiveKanbanCards(ctx, { empresa: "all" }).catch(() => [] as PipelineCard[]),
          fetchGooseLoopRadar(ctx).catch(() => null),
          loadLiveRepoSnapshot(ctx, { dtag: "orgfy" }).catch(() => null),
          refreshGatewayCatalog(),
        ]);

        const targetName = normName(agentName);
        const targetKey = normName(agentKey);
        const targetPk = normName(agentPubkey);

        const matchedCards = (allCards || []).filter((c) => {
          const ex = normName(c.executor);
          const rv = normName(c.revisor);
          const dc = normName(c.decisor);
          return (
            (targetName && (ex === targetName || rv === targetName || dc === targetName || ex.includes(targetName) || rv.includes(targetName))) ||
            (targetKey && (ex === targetKey || rv === targetKey))
          );
        });
        setCards(matchedCards);

        if (repoSnap?.available) {
          setRepoOwner(repoSnap.owner);
          const allNip34 = [...repoSnap.prs, ...repoSnap.issues].filter((it) => {
            if (targetPk && it.authorPubkey === targetPk) return true;
            if (targetName && it.content.toLowerCase().includes(targetName)) return true;
            return false;
          });
          setRepoItems(allNip34.slice(0, 10));
        }

        const matchedSessions = (radar?.sessoes || []).filter((s) => {
          const sn = normName(s.agente);
          const spk = normName(s.agent_pubkey);
          return (
            (targetPk && spk && spk === targetPk) ||
            (targetName && sn && (sn === targetName || sn.includes(targetName) || targetName.includes(sn)))
          );
        });
        setSessions(matchedSessions.slice(0, 6));
      } finally {
        setLoading(false);
      }
    }, [agentName, agentKey, agentPubkey]);

    React.useEffect(() => {
      loadAgentContext();
      const unsub = subscribeTelemetry(() => setTelemetry(getTelemetrySnapshot()));
      return () => unsub();
    }, [loadAgentContext]);

    const selectedModelOption = React.useMemo(() => {
      return (
        modelOptions.find((o) => modelOptionKey(o.provider, o.model) === selectedModelKey) || {
          provider: recommended.provider,
          model: recommended.model,
          label: `${recommended.model} (${recommended.tierLabel})`,
          group: "fallback" as const,
        }
      );
    }, [modelOptions, selectedModelKey, recommended.provider, recommended.model, recommended.tierLabel]);

    const isSelectedAlreadyActive =
      selectedModelOption.model.toLowerCase() === currentModel.toLowerCase() &&
      selectedModelOption.provider.toLowerCase() === currentProvider.toLowerCase();

    const handleApplySelectedModel = async () => {
      const agentsApi = (ctx as any)?.agents;
      if (!agentKey || typeof agentsApi?.save !== "function") {
        setStatusBanner({ ok: false, text: "API ctx.agents.save indisponível nesta versão do Buzz." });
        return;
      }
      setBusyAction("eval");
      setStatusBanner(null);
      try {
        // Omite `base` para que o Buzz resolva automaticamente `editorConfig().base`
        // (passar `configBase` vazio `{}` faz o Buzz rejeitar com "config isn't synced here yet").
        const freshList = (agentsApi.snapshot?.()?.agents || []) as any[];
        const freshAgent = freshList.find((x: any) => x?.key === agentKey) || agent;
        const baseCfg =
          freshAgent?.config && typeof freshAgent.config === "object"
            ? freshAgent.config
            : agentCfg;
        await agentsApi.save(agentKey, {
          config: { ...baseCfg, provider: selectedModelOption.provider, model: selectedModelOption.model },
        });
        setStatusBanner({
          ok: true,
          text: `Modelo atualizado via ctx.agents.save(): ${selectedModelOption.provider}/${selectedModelOption.model}.`,
        });
        await loadAgentContext();
      } catch (err: any) {
        setStatusBanner({ ok: false, text: `Falha ao atualizar modelo: ${err?.message || err}` });
      } finally {
        setBusyAction(null);
      }
    };

    const handleSessionAction = async (action: "interrupt" | "compact" | "new") => {
      setBusyAction(action);
      setStatusBanner(null);
      try {
        if (action === "interrupt" && liveTurn?.stoppable) {
          const interrupted = await interruptLiveTurn(ctx, liveTurn);
          if (interrupted) {
            setStatusBanner({ ok: true, text: `Turno ao vivo de ${agentName} interrompido via session.agentActivity.` });
            return;
          }
        }
        const agentsApi = (ctx as any)?.agents;
        if (!agentKey || typeof agentsApi?.session !== "function") {
          setStatusBanner({ ok: false, text: "API ctx.agents.session indisponível nesta versão do Buzz." });
          return;
        }
        const place = liveTurn?.channelId ? { channelId: liveTurn.channelId } : {};
        await agentsApi.session(agentKey, place, action);
        const label = action === "interrupt" ? "interrompida" : action === "compact" ? "compactada" : "reiniciada";
        setStatusBanner({ ok: true, text: `Sessão de ${agentName} ${label} via ctx.agents.session().` });
      } catch (err: any) {
        setStatusBanner({ ok: false, text: `Erro ao executar ${action}: ${err?.message || err}` });
      } finally {
        setBusyAction(null);
      }
    };

    const handleOpenFactory = () => {
      try {
        const nav: any = (ctx as any)?.navigation;
        if (nav?.open) {
          nav.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
        } else if (nav?.navigate) {
          nav.navigate("orgfy");
        }
      } catch {}
    };

    const handleOpenDirectIssue = async (item: { id: string; kind?: "issue" | "pr"; owner?: string; dtag?: string }) => {
      const ok = await openBuzzRepoEntity(ctx, {
        type: item.kind === "pr" ? "pr" : "issue",
        owner: item.owner || repoOwner,
        dtag: item.dtag || "orgfy",
        id: item.id,
      }).catch(() => false);
      if (!ok) {
        await openIssueInBuzz(ctx, { id: item.id, owner: item.owner || repoOwner, dtag: item.dtag || "orgfy" }).catch(() => false);
      }
    };

    const targetLower = normName(agentName);
    const agentSpans = telemetry.recentSpans
      .filter((sp) => {
        const spName = normName(sp.agentName);
        return spName === targetLower || spName.includes(targetLower) || targetLower.includes(spName);
      })
      .slice(0, 6);

    const agentMetric = telemetry.agentMetrics.find((m) => {
      const mn = normName(m.agentName);
      return mn === targetLower || mn.includes(targetLower);
    });

    const activeCards = cards.filter((c) => c.stage !== "feito");
    const doneCards = cards.filter((c) => c.stage === "feito");

    const btnBase = {
      padding: "5px 9px",
      borderRadius: "7px",
      border: BORDER,
      backgroundColor: SURFACE_BG,
      color: TEXT_PRIMARY,
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
    } as const;

    return h(
      "div",
      {
        "data-agent-orgfy-tab": "v17.3",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "10px 0",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflowX: "hidden",
          color: TEXT_PRIMARY,
          fontFamily: "inherit",
          fontSize: "12px",
        },
      },

      // 1. Cabeçalho OrgFy Factory + Status ao vivo + Ações nativas Buzz API
      h(
        "div",
        {
          style: {
            padding: "12px",
            borderRadius: "11px",
            backgroundColor: CARD_BG,
            border: liveTurn ? `1px solid ${BLUE}` : BORDER,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "100%",
            boxSizing: "border-box",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: ACCENT } }, `OrgFy Factory · ${agentName}`),
            h(
              "span",
              {
                style: {
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "2px 7px",
                  borderRadius: "9999px",
                  backgroundColor: liveTurn ? "rgba(96, 165, 250, 0.16)" : "rgba(61, 214, 140, 0.14)",
                  color: liveTurn ? BLUE : ACCENT,
                },
              },
              liveTurn ? "⚡ Respondendo agora" : presence === "online" ? "Online" : "Disponível"
            ),
            !isCompliantR51 &&
              h(
                "span",
                {
                  "data-eval-r51-alert": "true",
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 7px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(248, 113, 113, 0.16)",
                    color: RED,
                  },
                },
                isCurrentOffline ? "Modelo offline no Gateway" : "Fora do Eval"
              ),
            agentMetric?.retryCascadeRisk &&
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 7px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(248, 113, 113, 0.2)",
                    color: RED,
                  },
                },
                "Retry Cascade"
              )
          ),
          h(
            "div",
            {
              style: {
                fontSize: "11px",
                color: TEXT_MUTED,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                lineHeight: "1.45",
                overflowWrap: "anywhere",
              },
            },
            `Harness: ${currentHarness} · Provider: ${currentProvider} · Modelo: ${currentModel}${agentPubkey ? ` · pk: ${agentPubkey.slice(0, 10)}…` : ""}`
          )
        ),

        // Turno em execução ao vivo (session.agentActivity)
        liveTurn &&
          h(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderRadius: "8px",
                backgroundColor: SURFACE_BG,
                border: `1px solid ${liveTurn.state === "error" ? RED : BLUE}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { minWidth: 0, flex: 1 } },
              h("div", { style: { fontSize: "11.5px", fontWeight: "600", color: liveTurn.state === "error" ? RED : BLUE } }, liveTurn.stepLabel),
              liveTurn.toolName &&
                h("div", { style: { fontSize: "10px", color: TEXT_MUTED, fontFamily: "monospace" } }, `tool: ${liveTurn.toolName}`)
            ),
            h(
              "button",
              {
                type: "button",
                disabled: busyAction === "interrupt",
                onClick: () => handleSessionAction("interrupt"),
                style: { ...btnBase, borderColor: "rgba(248, 113, 113, 0.45)", color: RED },
              },
              "Parar"
            )
          ),

        // Seletor rápido de modelo (Eval R5.1 + NexusMind Ranking)
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            },
          },
          h(
            "select",
            {
              "data-agent-model-select": "true",
              "aria-label": "Escolher modelo do agente",
              value: selectedModelKey,
              disabled: busyAction === "eval",
              onChange: (e: any) => setSelectedModelKey(String(e?.target?.value || "")),
              style: {
                padding: "5px 8px",
                borderRadius: "7px",
                border: BORDER,
                backgroundColor: SURFACE_BG,
                color: TEXT_PRIMARY,
                fontSize: "11px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                flex: "1 1 220px",
                minWidth: "180px",
                maxWidth: "100%",
                cursor: "pointer",
              },
            },
            gatewayCatalog?.hasLiveData && (gatewayCatalog.approvedOptions.length > 0 || gatewayCatalog.onlineOtherOptions.length > 0)
              ? [
                  gatewayCatalog.approvedOptions.length > 0 &&
                    h(
                      "optgroup",
                      { key: "eval-approved", label: "Aprovados no Eval (NexusMind)" },
                      gatewayCatalog.approvedOptions.map((opt) =>
                        h(
                          "option",
                          { key: modelOptionKey(opt.provider, opt.model), value: modelOptionKey(opt.provider, opt.model) },
                          opt.label
                        )
                      )
                    ),
                  gatewayCatalog.onlineOtherOptions.length > 0 &&
                    h(
                      "optgroup",
                      { key: "nexusmind-online", label: "Ranking NexusMind (Online)" },
                      gatewayCatalog.onlineOtherOptions.map((opt) =>
                        h(
                          "option",
                          { key: modelOptionKey(opt.provider, opt.model), value: modelOptionKey(opt.provider, opt.model) },
                          opt.label
                        )
                      )
                    ),
                ]
              : h(
                  "optgroup",
                  { label: "Fallback (sem Eval ao vivo)" },
                  FALLBACK_MODEL_PRESETS.map((opt) =>
                    h(
                      "option",
                      { key: modelOptionKey(opt.provider, opt.model), value: modelOptionKey(opt.provider, opt.model) },
                      opt.label
                    )
                  )
                )
          ),
          h(
            "button",
            {
              type: "button",
              disabled: busyAction === "eval" || isSelectedAlreadyActive,
              onClick: handleApplySelectedModel,
              "data-apply-eval-r51": "true",
              style: {
                ...btnBase,
                borderColor: isSelectedAlreadyActive ? BORDER : "rgba(96, 165, 250, 0.45)",
                backgroundColor: isSelectedAlreadyActive ? SURFACE_BG : "rgba(96, 165, 250, 0.14)",
                color: isSelectedAlreadyActive ? TEXT_MUTED : BLUE,
                opacity: isSelectedAlreadyActive ? 0.65 : 1,
                cursor: isSelectedAlreadyActive ? "default" : "pointer",
              },
            },
            busyAction === "eval" ? "Salvando..." : isSelectedAlreadyActive ? "Modelo ativo" : "Aplicar modelo"
          )
        ),

        // Barra de ações nativas (Sessão, Factory, Repos)
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
          h(
            "button",
            { type: "button", disabled: busyAction === "compact", onClick: () => handleSessionAction("compact"), style: btnBase },
            "Compactar"
          ),
          h(
            "button",
            { type: "button", disabled: busyAction === "new", onClick: () => handleSessionAction("new"), style: btnBase },
            "Nova sessão"
          ),
          h(
            "button",
            { type: "button", disabled: loading, onClick: loadAgentContext, style: btnBase },
            loading ? "..." : "Atualizar"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => openRepoTabInBuzz(ctx, { owner: repoOwner, dtag: "orgfy", tab: "issues" }),
              style: btnBase,
            },
            "Buzz Repos ↗"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: handleOpenFactory,
              style: {
                ...btnBase,
                border: "none",
                backgroundColor: ACCENT,
                color: "var(--text-on-prominent, #08120c)",
              },
            },
            "Abrir OrgFy Factory"
          )
        )
      ),

      statusBanner &&
        h(
          "div",
          {
            style: {
              padding: "9px 11px",
              borderRadius: "8px",
              backgroundColor: statusBanner.ok ? "rgba(61, 214, 140, 0.12)" : "rgba(251, 191, 36, 0.12)",
              border: `1px solid ${statusBanner.ok ? ACCENT : AMBER}`,
              color: statusBanner.ok ? ACCENT : AMBER,
              fontSize: "11px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              overflowWrap: "anywhere",
            },
          },
          statusBanner.text
        ),

      // 2. 4 KPIs compactos
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "8px",
            width: "100%",
          },
        },
        [
          { label: "Cards Ativos", value: String(activeCards.length), color: BLUE },
          { label: "Concluídos", value: String(doneCards.length), color: ACCENT },
          { label: "NIP-34 (Repos)", value: String(repoItems.length), color: TEXT_PRIMARY },
          { label: "OTel Spans", value: agentMetric ? `${agentMetric.totalTurns} (${agentMetric.errorTurns} err)` : String(agentSpans.length), color: "#c084fc" },
        ].map((k) =>
          h(
            "div",
            {
              key: k.label,
              style: {
                padding: "9px 10px",
                borderRadius: "9px",
                backgroundColor: CARD_BG,
                border: BORDER,
                minWidth: 0,
              },
            },
            h("div", { style: { fontSize: "9.5px", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em" } }, k.label),
            h("div", { style: { fontSize: "15px", fontWeight: "700", color: k.color, fontFamily: "ui-monospace, monospace", marginTop: "3px" } }, k.value)
          )
        )
      ),

      // 3. Issues & PRs ao vivo do Buzz Repos (NIP-34) — abertura direta em 1 salto
      repoItems.length > 0 &&
        h(
          "div",
          {
            "data-agent-nip34-list": "true",
            style: {
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: CARD_BG,
              border: BORDER,
              display: "flex",
              flexDirection: "column",
              gap: "7px",
            },
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "12px", fontWeight: "700" } }, `Buzz Repos NIP-34 (${repoItems.length})`),
            h("span", { style: { fontSize: "10px", color: TEXT_MUTED, fontFamily: "monospace" } }, "session.repositories")
          ),
          repoItems.slice(0, 6).map((it) =>
            h(
              "div",
              {
                key: it.id,
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "7px 9px",
                  borderRadius: "7px",
                  backgroundColor: SURFACE_BG,
                  border: BORDER,
                },
              },
              h(
                "div",
                { style: { minWidth: 0, flex: 1 } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" } },
                  h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: BLUE, fontWeight: "700" } }, `#${String(it.id || "").slice(0, 8)}`),
                  h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: it.kind === "pr" ? "rgba(61, 214, 140, 0.16)" : "rgba(96, 165, 250, 0.16)", color: it.kind === "pr" ? ACCENT : BLUE, textTransform: "uppercase" } }, it.kind)
                ),
                h("div", { title: it.title, style: { fontSize: "11.5px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.title)
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: () => handleOpenDirectIssue({ id: it.id, kind: it.kind, owner: it.owner, dtag: it.dtag }),
                  style: { ...btnBase, color: BLUE, padding: "4px 8px", fontSize: "10px", flexShrink: 0 },
                },
                "Abrir ↗"
              )
            )
          )
        ),

      // 4. Cards OrgFy atribuídos na esteira
      h(
        "div",
        {
          style: {
            padding: "12px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700" } }, `Cards OrgFy Atribuídos (${cards.length})`),
          h("span", { style: { fontSize: "10px", color: TEXT_MUTED, fontFamily: "monospace" } }, "Executor / Revisor / Decisor")
        ),
        loading
          ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, "Carregando cards da esteira...")
          : cards.length === 0
          ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, `Nenhum card ativo ou recente vinculado a ${agentName}.`)
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" } },
              cards.slice(0, 12).map((c) => {
                const role =
                  normName(c.executor) === targetLower
                    ? "EXECUTOR"
                    : normName(c.revisor) === targetLower
                    ? "REVISOR"
                    : "DECISOR";
                return h(
                  "div",
                  {
                    key: c.id,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "7px",
                      backgroundColor: SURFACE_BG,
                      border: BORDER,
                      minWidth: 0,
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1 } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px" } },
                      h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: BLUE, fontWeight: "700" } }, `#${String(c.issueId || "").slice(0, 8)}`),
                      h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: role === "EXECUTOR" ? "rgba(61,214,140,0.16)" : "rgba(192,132,252,0.16)", color: role === "EXECUTOR" ? ACCENT : "#d8b4fe" } }, role),
                      h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(255,255,255,0.07)", color: TEXT_MUTED, textTransform: "uppercase" } }, c.stage)
                    ),
                    h("span", { title: c.title, style: { fontSize: "11.5px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.title)
                  ),
                  c.fullIssueId &&
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleOpenDirectIssue({ id: c.fullIssueId!, kind: "issue", owner: c.owner, dtag: c.empresa || "orgfy" }),
                        style: { ...btnBase, color: BLUE, padding: "4px 8px", fontSize: "10px", flexShrink: 0 },
                      },
                      "Abrir ↗"
                    )
                );
              })
            )
      ),

      // 5. Sessões Goose & Spans OTel GenAI
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "10px",
            width: "100%",
          },
        },
        h(
          "div",
          {
            style: {
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: CARD_BG,
              border: BORDER,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              minWidth: 0,
            },
          },
          h("span", { style: { fontSize: "12px", fontWeight: "700" } }, "Sessões Goose Recentes (3h)"),
          sessions.length === 0
            ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, "Nenhuma sessão recente no radar Goose.")
            : sessions.map((s) =>
                h(
                  "div",
                  {
                    key: s.session_id,
                    style: {
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: SURFACE_BG,
                      border: s.severidade === "critical" ? `1px solid ${RED}` : BORDER,
                      fontSize: "10px",
                      fontFamily: "monospace",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", gap: "4px" } },
                    h("span", { style: { color: s.ativa ? ACCENT : TEXT_MUTED, fontWeight: "700" } }, `${s.ativa ? "ATIVA" : "HIST"} · ${s.session_id}`),
                    h("span", { style: { color: TEXT_PRIMARY } }, `${s.duracao_min.toFixed(0)}m · ${s.shells} shells`)
                  ),
                  h("span", { style: { color: s.flags.length > 0 ? AMBER : ACCENT } }, s.flags.length > 0 ? s.flags.join(" · ") : "OK")
                )
              )
        ),
        h(
          "div",
          {
            style: {
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: CARD_BG,
              border: BORDER,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              minWidth: 0,
            },
          },
          h("span", { style: { fontSize: "12px", fontWeight: "700" } }, "Spans OTel GenAI deste Agente"),
          agentSpans.length === 0
            ? h("div", { style: { fontSize: "11px", color: TEXT_MUTED } }, "Nenhum span OTel capturado ainda nesta sessão do Buzz.")
            : agentSpans.map((sp) =>
                h(
                  "div",
                  {
                    key: sp.spanId,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      backgroundColor: SURFACE_BG,
                      fontSize: "10px",
                      fontFamily: "monospace",
                    },
                  },
                  h("span", { style: { color: BLUE, fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sp.toolName || sp.operationName),
                  h("span", { style: { color: sp.status === "error" ? RED : ACCENT, fontWeight: "700", flexShrink: 0 } }, `${sp.status.toUpperCase()} · ${sp.durationMs}ms`)
                )
              )
        )
      )
    );
  };
}
