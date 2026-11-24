import type { Context } from "@buzz/author";

export interface ModelCandidateScore {
  model: string;
  provider: string;
  isFree: boolean;
  intelligenceScore: number;
  latencyMs: number | null;
  combinedScore: number;
  online: boolean;
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

  // Famílias de alta capacidade / raciocínio / código
  if (/(opus|o3|gpt-5|gpt-6|claude-sonnet-4-6|claude-sonnet-5|gemini-3\.?5?-pro|gemini-2\.5-pro|deepseek-r1|deepseek-v3|qwen3-coder|mistral-large|grok-4)/.test(m)) {
    score += 32;
  } else if (/(sonnet|pro|large|coder|r1|reasoning|thinking|v3|nemotron-ultra|llama-4|glm-4\.5|kimi-k2)/.test(m)) {
    score += 22;
  } else if (/(flash|haiku|medium|70b|72b|32b|devstral|codestral)/.test(m)) {
    score += 12;
  }

  // Penalização para modelos ultra-leves / preview instáveis
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
  // Cada 1000ms de latência subtrai ~4 pontos (teto 35 pts), mantendo inteligência como fator dominante
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

async function discoverNexusMindCatalog(ctx: Context): Promise<Array<{ id: string; provider: ProviderGroupConfig }>> {
  const hostReq = (ctx as any)?.host?.request;
  const disabled = getDisabledModelsFromLocalStorage();
  const seen = new Map<string, { id: string; provider: ProviderGroupConfig }>();

  if (typeof hostReq === "function") {
    await Promise.all(
      NEXUSMIND_PROVIDERS.map(async (prov) => {
        try {
          const res = await hostReq({
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
          // Grupo indisponível no momento — continua nos demais
        }
      })
    );
  }

  // Fallback para cache local do NexusMind plugin caso o catálogo /v1/models falhe
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
    } catch {
      // Sem cache local
    }
  }

  return Array.from(seen.values());
}

async function probeModelLive(
  ctx: Context,
  modelId: string,
  prov: ProviderGroupConfig
): Promise<{ online: boolean; latencyMs: number | null; error?: string }> {
  const hostReq = (ctx as any)?.host?.request;
  if (typeof hostReq !== "function") {
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
    const res = await hostReq({
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
 * 1. Consulta os modelos disponíveis no NexusMind (priorizando modelos FREE por padrão);
 * 2. Faz ping real em paralelo nos top candidatos mais inteligentes (excluindo o modelo em erro);
 * 3. Elege o melhor modelo online (maior inteligência + menor latência real);
 * 4. Opcionalmente (apply: true) salva o novo modelo no agente via ctx.agents.save()
 *    e re-dispara o agente via ctx.agents.wake() na thread original.
 */
export async function executeSmartModelFailover(
  ctx: Context,
  input: ModelFailoverInput = {}
): Promise<ModelFailoverResult> {
  const preferFree = input.prefer_free !== false;
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

  const catalog = await discoverNexusMindCatalog(ctx);
  if (catalog.length === 0) {
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
      candidatesTested: 0,
      ranking: [],
      message: "Nenhum modelo retornado pelo NexusMind Gateway (/v1/models indisponível e sem cache local).",
    };
  }

  // Filtrar candidatos (excluindo o modelo em falha atual)
  const excludeSet = new Set<string>();
  if (failedNorm) excludeSet.add(failedNorm);
  if (previousModel) excludeSet.add(previousModel.toLowerCase());

  let pool = catalog.filter((c) => !excludeSet.has(c.id.toLowerCase()));
  if (preferFree) {
    const freeOnly = pool.filter((c) => isFreeModelId(c.id));
    if (freeOnly.length > 0) {
      pool = freeOnly;
    }
  }

  // Pré-ordena por inteligência estimada e faz ping real nos top maxProbes em paralelo
  const preRanked = pool
    .map((c) => ({ ...c, intelligenceScore: estimateModelIntelligence(c.id) }))
    .sort((a, b) => b.intelligenceScore - a.intelligenceScore)
    .slice(0, maxProbes);

  const probed: ModelCandidateScore[] = await Promise.all(
    preRanked.map(async (cand) => {
      const res = await probeModelLive(ctx, cand.id, cand.provider);
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
        error: res.error,
      };
    })
  );

  probed.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
    return (a.latencyMs ?? 999999) - (b.latencyMs ?? 999999);
  });

  const winner = probed.find((p) => p.online) || null;
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
      candidatesTested: probed.length,
      ranking: probed,
      message: `Nenhum dos ${probed.length} modelos testados respondeu HTTP 200 no ping real do NexusMind.`,
    };
  }

  let appliedOk = false;
  let retriggered = false;
  let applyNote = "";

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
        candidatesTested: probed.length,
        ranking: probed,
        message: `Melhor modelo eleito (${winner.model}, ${winner.latencyMs}ms), mas agente '${input.agente || input.agent_pubkey || ""}' não encontrado no Buzz Desktop.`,
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
        candidatesTested: probed.length,
        ranking: probed,
        message: `Melhor modelo eleito (${winner.model}, ${winner.latencyMs}ms), mas ctx.agents.save indisponível neste host.`,
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
      applyNote = `Modelo de ${matchedAgent.name || matchedAgent.key} atualizado de '${previousModel || "padrão"}' para '${winner.model}' (${winner.provider}, ${winner.latencyMs}ms, score ${winner.combinedScore}).`;
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
        candidatesTested: probed.length,
        ranking: probed,
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
            `[ORGFY FAILOVER AUTOMÁTICO] Seu modelo foi migrado para '${winner.model}' (${winner.latencyMs}ms online via NexusMind) após erro de API no modelo anterior. Retome imediatamente o último passo da tarefa com escopo fechado.`,
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
    candidatesTested: probed.length,
    ranking: probed,
    message:
      applyNote ||
      `Melhor modelo disponível (${preferFree ? "FREE" : "ALL"}): ${winner.model} (${winner.provider} · ${winner.latencyMs}ms · inteligência ${winner.intelligenceScore}/100 · score ${winner.combinedScore}).`,
  };
}
