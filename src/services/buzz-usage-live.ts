// ─────────────────────────────────────────────────────────────────────────────
// BUZZ NATIVE USAGE TELEMETRY (Onda 3 · v17.7)
// Espelha buzz-app/src/bundled/usage/UsagePage.tsx consumindo diretamente
// ctx.agents.types()[...].usage(agent, { since, signal }) para telemetria ao
// vivo de tokens, cache hit e sessões por agente na máquina local.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";

export interface BuzzAgentNativeUsageRow {
  agentKey: string;
  pubkey: string;
  name: string;
  picture?: string;
  harness: string;
  sessions: number;
  tokensToday: number;
  tokensPeriod: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheHitPct: number | null;
  lastModel?: string;
}

export interface BuzzNativeUsageSnapshot {
  available: boolean;
  days: number;
  fetchedAt: string;
  tokensToday: number;
  tokensPeriod: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheHitPct: number | null;
  sessionsCount: number;
  agentsCount: number;
  byAgent: BuzzAgentNativeUsageRow[];
  failedAgents: string[];
}

function observationTokens(obs: any): { input: number; output: number; cacheRead: number; cacheWrite: number; total: number; tsMs: number } {
  const input = Number(obs?.input ?? obs?.inputTokens ?? obs?.tokens?.input ?? 0) || 0;
  const output = Number(obs?.output ?? obs?.outputTokens ?? obs?.tokens?.output ?? 0) || 0;
  const cacheRead = Number(obs?.cacheRead ?? obs?.cacheReadTokens ?? obs?.tokens?.cacheRead ?? 0) || 0;
  const cacheWrite = Number(obs?.cacheWrite ?? obs?.cacheCreationTokens ?? obs?.tokens?.cacheWrite ?? 0) || 0;
  const rawTs = obs?.at ?? obs?.ts ?? obs?.timestamp ?? 0;
  const tsMs = typeof rawTs === "number" ? (rawTs < 1e12 ? rawTs * 1000 : rawTs) : Date.parse(String(rawTs || "")) || 0;
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    total: input + output + cacheRead + cacheWrite,
    tsMs,
  };
}

export async function collectBuzzNativeUsage(
  ctx: Context | any,
  days = 7,
  signal?: AbortSignal
): Promise<BuzzNativeUsageSnapshot> {
  const nowMs = Date.now();
  const sinceMs = nowMs - Math.max(1, days) * 24 * 60 * 60 * 1000;
  const todayStartMs = new Date(new Date(nowMs).toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();

  const empty: BuzzNativeUsageSnapshot = {
    available: false,
    days,
    fetchedAt: new Date(nowMs).toISOString(),
    tokensToday: 0,
    tokensPeriod: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheHitPct: null,
    sessionsCount: 0,
    agentsCount: 0,
    byAgent: [],
    failedAgents: [],
  };

  const agentsApi = ctx?.agents;
  if (!agentsApi || typeof agentsApi.types !== "function" || typeof agentsApi.snapshot !== "function") {
    return empty;
  }

  const types: any[] = Array.isArray(agentsApi.types()) ? agentsApi.types() : [];
  const usageByType = new Map<string, (agent: any, opts: { since: number; signal?: AbortSignal }) => Promise<readonly any[]>>();
  for (const t of types) {
    if (t?.key && typeof t.usage === "function") {
      usageByType.set(String(t.key), t.usage);
    }
  }
  if (usageByType.size === 0) return empty;

  const snap = agentsApi.snapshot();
  const allAgents: any[] = Array.isArray(snap?.agents) ? snap.agents : [];
  const targets = allAgents.filter(
    (a) => (!a.place || a.place === "here") && usageByType.has(String(a.type || ""))
  );
  if (targets.length === 0) {
    return { ...empty, available: true };
  }

  let totalToday = 0;
  let totalPeriod = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalSessions = 0;
  const byAgent: BuzzAgentNativeUsageRow[] = [];
  const failedAgents: string[] = [];

  await Promise.all(
    targets.map(async (agent) => {
      const read = usageByType.get(String(agent.type));
      if (!read) return;
      try {
        const sessions = await read(agent, { since: sinceMs, signal });
        if (!Array.isArray(sessions)) return;
        let agToday = 0;
        let agPeriod = 0;
        let agInput = 0;
        let agOutput = 0;
        let agCacheRead = 0;
        let lastModel: string | undefined;

        for (const sess of sessions) {
          const observations = Array.isArray(sess?.observations) ? sess.observations : [];
          for (const obs of observations) {
            const m = observationTokens(obs);
            if (m.tsMs > 0 && m.tsMs < sinceMs) continue;
            agPeriod += m.total;
            agInput += m.input;
            agOutput += m.output;
            agCacheRead += m.cacheRead;
            if (m.tsMs >= todayStartMs) agToday += m.total;
            if (obs?.model) lastModel = String(obs.model);
          }
        }

        totalToday += agToday;
        totalPeriod += agPeriod;
        totalInput += agInput;
        totalOutput += agOutput;
        totalCacheRead += agCacheRead;
        totalSessions += sessions.length;

        const denom = agInput + agCacheRead;
        byAgent.push({
          agentKey: String(agent.key || ""),
          pubkey: String(agent.pubkey || ""),
          name: String(agent.name || agent.key || "Agente"),
          picture: agent.picture ? String(agent.picture) : undefined,
          harness: String(agent.type || ""),
          sessions: sessions.length,
          tokensToday: agToday,
          tokensPeriod: agPeriod,
          inputTokens: agInput,
          outputTokens: agOutput,
          cacheReadTokens: agCacheRead,
          cacheHitPct: denom > 0 ? Math.round((agCacheRead / denom) * 1000) / 10 : null,
          lastModel,
        });
      } catch {
        failedAgents.push(String(agent.name || agent.key || "Agente"));
      }
    })
  );

  byAgent.sort((a, b) => b.tokensPeriod - a.tokensPeriod);
  const globalDenom = totalInput + totalCacheRead;

  return {
    available: true,
    days,
    fetchedAt: new Date().toISOString(),
    tokensToday: totalToday,
    tokensPeriod: totalPeriod,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCacheRead,
    cacheHitPct: globalDenom > 0 ? Math.round((totalCacheRead / globalDenom) * 1000) / 10 : null,
    sessionsCount: totalSessions,
    agentsCount: targets.length,
    byAgent,
    failedAgents,
  };
}
