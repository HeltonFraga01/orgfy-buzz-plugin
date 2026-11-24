// ─────────────────────────────────────────────────────────────────────────────
// ORGFY OPENTELEMETRY GENAI TELEMETRY & EVENT STREAM SERVICE (v13 FRONTIER)
// Segue OpenTelemetry GenAI Semantic Conventions v1.42+ (invoke_agent, execute_tool)
// + Contabilização real de economia da Decisions API (acordadas evitadas)
// + Detector de Retry Cascades em tempo real (sem gravar prompts/segredos)
// ─────────────────────────────────────────────────────────────────────────────

export interface OTelGenAISpan {
  spanId: string;
  traceId: string;
  timestamp: number;
  operationName: "invoke_agent" | "execute_tool" | "decisions.evaluate" | "relay.event" | "attention.emit";
  agentName: string;
  model?: string | null;
  provider?: string | null;
  toolName?: string | null;
  durationMs: number;
  status: "ok" | "error" | "filtered_out";
  finishReason?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface DecisionsSavingsStats {
  totalCalls: number;
  decisionsApiCalls: number;
  fallbackCalls: number;
  wakesOrEscalationsAvoided: number;
  estimatedTokensSaved: number;
  avgLatencyMs: number;
  byMode: Record<string, number>;
}

export interface AgentWasteMetric {
  agentName: string;
  totalTurns: number;
  errorTurns: number;
  consecutiveErrors: number;
  retryCascadeRisk: boolean;
  avgDurationMs: number;
  lastActivityTs: number;
}

export interface TelemetrySnapshot {
  updatedAt: number;
  totalSpans: number;
  recentSpans: OTelGenAISpan[];
  decisionsSavings: DecisionsSavingsStats;
  agentMetrics: AgentWasteMetric[];
  retryCascadeAlerts: string[];
}

const MAX_SPANS = 200;
const spansBuffer: OTelGenAISpan[] = [];
const listeners = new Set<() => void>();

const decisionsStats = {
  totalCalls: 0,
  decisionsApiCalls: 0,
  fallbackCalls: 0,
  wakesOrEscalationsAvoided: 0,
  estimatedTokensSaved: 0,
  totalLatencyMs: 0,
  byMode: {} as Record<string, number>,
};

const agentCounters = new Map<
  string,
  {
    totalTurns: number;
    errorTurns: number;
    consecutiveErrors: number;
    totalDurationMs: number;
    lastActivityTs: number;
  }
>();

function randomHex(len: number): string {
  let out = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {}
  }
}

export function subscribeTelemetry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Registra um span OTel GenAI sem capturar prompts/segredos (redação por padrão).
 */
export function recordGenAISpan(
  input: Omit<OTelGenAISpan, "spanId" | "traceId" | "timestamp"> & {
    traceId?: string;
    timestamp?: number;
  }
): OTelGenAISpan {
  const span: OTelGenAISpan = {
    spanId: randomHex(16),
    traceId: input.traceId || randomHex(32),
    timestamp: input.timestamp || Date.now(),
    operationName: input.operationName,
    agentName: input.agentName || "orgfy-system",
    model: input.model ?? null,
    provider: input.provider ?? null,
    toolName: input.toolName ?? null,
    durationMs: Math.max(0, Math.round(input.durationMs || 0)),
    status: input.status,
    finishReason: input.finishReason,
    attributes: input.attributes || {},
  };

  spansBuffer.unshift(span);
  if (spansBuffer.length > MAX_SPANS) {
    spansBuffer.length = MAX_SPANS;
  }

  // Atualiza contadores por agente para detecção de retry cascades
  if (span.operationName === "invoke_agent") {
    const key = span.agentName;
    const prev = agentCounters.get(key) || {
      totalTurns: 0,
      errorTurns: 0,
      consecutiveErrors: 0,
      totalDurationMs: 0,
      lastActivityTs: span.timestamp,
    };
    prev.totalTurns += 1;
    prev.totalDurationMs += span.durationMs;
    prev.lastActivityTs = span.timestamp;
    if (span.status === "error") {
      prev.errorTurns += 1;
      prev.consecutiveErrors += 1;
    } else {
      prev.consecutiveErrors = 0;
    }
    agentCounters.set(key, prev);
  }

  notify();
  return span;
}

/**
 * Registra uma avaliação da Decisions API (ou fallback) e estima a economia de tokens
 * quando o classificador rápido evita acordar um LLM frontier ou evita retrabalho.
 */
export function recordDecisionTelemetry(params: {
  mode: string;
  source: "decisions_api" | "deterministic_fallback";
  model?: string | null;
  backend?: string | null;
  durationMs: number;
  preventedExpensiveWake?: boolean;
  estimatedTokensSaved?: number;
}) {
  decisionsStats.totalCalls += 1;
  if (params.source === "decisions_api") {
    decisionsStats.decisionsApiCalls += 1;
  } else {
    decisionsStats.fallbackCalls += 1;
  }
  decisionsStats.totalLatencyMs += Math.max(0, params.durationMs);
  decisionsStats.byMode[params.mode] = (decisionsStats.byMode[params.mode] || 0) + 1;

  const saved = params.preventedExpensiveWake ? (params.estimatedTokensSaved ?? 18000) : 0;
  if (params.preventedExpensiveWake) {
    decisionsStats.wakesOrEscalationsAvoided += 1;
    decisionsStats.estimatedTokensSaved += saved;
  }

  recordGenAISpan({
    operationName: "decisions.evaluate",
    agentName: "orgfy-decisions-router",
    model: params.model || "deterministic_fallback",
    provider: params.backend || params.source,
    durationMs: params.durationMs,
    status: params.preventedExpensiveWake ? "filtered_out" : "ok",
    attributes: {
      "gen_ai.operation.name": "decisions.evaluate",
      "orgfy.decision.mode": params.mode,
      "orgfy.decision.source": params.source,
      "orgfy.tokens_saved_est": saved,
    },
  });
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  const agentMetrics: AgentWasteMetric[] = [];
  const retryCascadeAlerts: string[] = [];

  for (const [agentName, c] of agentCounters.entries()) {
    const retryCascadeRisk = c.consecutiveErrors >= 2 || (c.totalTurns >= 4 && c.errorTurns / c.totalTurns >= 0.5);
    agentMetrics.push({
      agentName,
      totalTurns: c.totalTurns,
      errorTurns: c.errorTurns,
      consecutiveErrors: c.consecutiveErrors,
      retryCascadeRisk,
      avgDurationMs: c.totalTurns > 0 ? Math.round(c.totalDurationMs / c.totalTurns) : 0,
      lastActivityTs: c.lastActivityTs,
    });
    if (retryCascadeRisk) {
      retryCascadeAlerts.push(
        `${agentName}: ${c.consecutiveErrors} erro(s) consecutivo(s) (${c.errorTurns}/${c.totalTurns} turnos) — risco de retry cascade.`
      );
    }
  }

  agentMetrics.sort((a, b) => b.lastActivityTs - a.lastActivityTs);

  return {
    updatedAt: Date.now(),
    totalSpans: spansBuffer.length,
    recentSpans: spansBuffer.slice(0, 40),
    decisionsSavings: {
      totalCalls: decisionsStats.totalCalls,
      decisionsApiCalls: decisionsStats.decisionsApiCalls,
      fallbackCalls: decisionsStats.fallbackCalls,
      wakesOrEscalationsAvoided: decisionsStats.wakesOrEscalationsAvoided,
      estimatedTokensSaved: decisionsStats.estimatedTokensSaved,
      avgLatencyMs:
        decisionsStats.totalCalls > 0
          ? Math.round(decisionsStats.totalLatencyMs / decisionsStats.totalCalls)
          : 0,
      byMode: { ...decisionsStats.byMode },
    },
    agentMetrics,
    retryCascadeAlerts,
  };
}

export function resetTelemetryForTests() {
  spansBuffer.length = 0;
  agentCounters.clear();
  decisionsStats.totalCalls = 0;
  decisionsStats.decisionsApiCalls = 0;
  decisionsStats.fallbackCalls = 0;
  decisionsStats.wakesOrEscalationsAvoided = 0;
  decisionsStats.estimatedTokensSaved = 0;
  decisionsStats.totalLatencyMs = 0;
  decisionsStats.byMode = {};
}
