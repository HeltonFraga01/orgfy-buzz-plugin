// ─────────────────────────────────────────────────────────────────────────────
// ORGFY DECISION ROUTER & BUZZ ATTENTION CONTRACT ENGINE (ONDA 4 + v13 OTel)
// Cascata SOTA com ctx.decisions.decide (batch yes_no + choice + score)
// + Fallback determinístico offline + Contratos nativos Buzz Attention/Watch
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { recordDecisionTelemetry } from "./telemetry-otel";

export type ModelTierChoice = "tier1_fast" | "tier2_balanced" | "tier3_frontier";
export type AttentionPolicyChoice = "timer_curto" | "event_driven" | "watchdog_longo";
export type GateActionChoice = "prosseguir_gate" | "pedir_ajuste_executor" | "escalar_coo";

export interface CardTriageInput {
  slug?: string;
  titulo: string;
  objetivo?: string;
  tipo?: string;
  escrita_exclusiva?: string[];
  acceptance_command?: string;
  passos?: string[];
  executor?: string;
  revisor?: string;
  risco_declarado?: string;
}

export interface CardTriageResult {
  ok: boolean;
  decisionSource: "decisions_api" | "deterministic_fallback";
  backend: string | null;
  model: string | null;
  fallbackReason: string | null;
  escopoAtomico: boolean;
  escopoAtomicoProb: number;
  riscoScore: number; // 1..5
  riscoNivel: "muito_baixo" | "baixo" | "medio" | "alto" | "critico";
  modeloTier: ModelTierChoice;
  modeloRecomendadoHint: string;
  attentionPolicy: AttentionPolicyChoice;
  alertas: string[];
}

export interface DiffTriageInput {
  issue_id?: string;
  titulo?: string;
  escrita_exclusiva: string[];
  arquivos_alterados: string[];
  resumo_entrega?: string;
  saida_aceite?: string;
  recusas_anteriores?: number;
}

export interface DiffTriageResult {
  ok: boolean;
  decisionSource: "decisions_api" | "deterministic_fallback";
  backend: string | null;
  model: string | null;
  fallbackReason: string | null;
  escopoRespeitado: boolean;
  arquivosForaEscopo: string[];
  alegacaoSemProvaL24: boolean;
  severidadeDesvio: number; // 1..5
  acaoRecomendada: GateActionChoice;
  motivos: string[];
}

export interface BuzzAttentionContract {
  policy: AttentionPolicyChoice;
  interest_id: string;
  interest_set_payload: {
    id: string;
    title: string;
    summary: string;
    instructions: string;
    expected_state: "object-v1:absent";
  };
  timer_watch_payload: {
    interest: string;
    id: string;
    type: "timer";
    expected_state: "object-v1:absent";
    channel: string;
    root?: string;
    prompt: string;
    interval_secs: number;
    max_occurrences: number;
    expires_at: number;
  };
  event_watch_payload?: {
    interest: string;
    id: string;
    type: "event";
    expected_state: "object-v1:absent";
    channels: string[];
    channel: string;
    root?: string;
    since: "now";
    is_reply: boolean;
    classifier: {
      questions: Record<
        string,
        {
          question: string;
          true: string;
          false: string;
          threshold?: number;
        }
      >;
    };
  };
  cleanup_rule: string;
}

const DEFAULT_ORGFY_CHANNEL = "e445491d-2fb3-4ebd-8e2e-f6813c33fb03";

const RISCO_LABELS: readonly CardTriageResult["riscoNivel"][] = [
  "muito_baixo",
  "baixo",
  "medio",
  "alto",
  "critico",
];

const TIER_MODEL_HINTS: Record<ModelTierChoice, string> = {
  tier1_fast: "gemini-2.5-flash / top :free do NexusMind Gateway (rápido e econômico)",
  tier2_balanced: "claude-sonnet-4-6 (NexusMind Anthropic — balanceado para código/revisão L-01)",
  tier3_frontier: "gpt-6.1-terra / claude-sonnet-5-5 (NexusMind Frontier — arquitetura/risco alto)",
};

function sanitizeSlug(raw: string): string {
  return (
    String(raw || "card")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "card"
  );
}

function deterministicCardTriage(input: CardTriageInput): Omit<
  CardTriageResult,
  "decisionSource" | "backend" | "model" | "fallbackReason"
> {
  const texto = `${input.titulo || ""} ${input.objetivo || ""} ${input.tipo || ""} ${input.risco_declarado || ""}`.toLowerCase();
  const arquivos = Array.isArray(input.escrita_exclusiva) ? input.escrita_exclusiva.filter(Boolean) : [];
  const passos = Array.isArray(input.passos) ? input.passos.filter(Boolean) : [];
  const alertas: string[] = [];

  // Escopo atômico: 1..6 arquivos, objetivo definido, comando de aceite presente
  const escopoAmplo = arquivos.length > 6 || passos.length > 8 || /\b(refatorar tudo|reescrever sistema|todo o repositorio|geral)\b/.test(texto);
  const escopoAtomico = !escopoAmplo && Boolean((input.titulo || "").trim());
  if (escopoAmplo) {
    alertas.push("Escopo amplo detectado (>6 arquivos ou >8 passos); considere fatiar o card.");
  }
  if (!input.acceptance_command?.trim()) {
    alertas.push("Comando de aceite L-22 ausente — obrigatório antes do despacho.");
  }

  // Score de risco 1..5
  let riscoScore = 2;
  if (/\b(seguranca|auth|rls|migration|banco|producao|billing|pagamento|chave|secret|deploy|infra)\b/.test(texto)) {
    riscoScore = 5;
  } else if (/\b(arquitetura|protocolo|gate|porteiro|concorrencia|lock|failover|mcp|plugin)\b/.test(texto)) {
    riscoScore = 4;
  } else if (arquivos.length >= 4 || passos.length >= 5) {
    riscoScore = 3;
  } else if (/\b(doc|readme|typo|comentario|fixture|teste unitario|badge|css)\b/.test(texto)) {
    riscoScore = 1;
  }

  const modeloTier: ModelTierChoice =
    riscoScore >= 4 ? "tier3_frontier" : riscoScore === 3 ? "tier2_balanced" : "tier1_fast";

  const attentionPolicy: AttentionPolicyChoice =
    /\b(monitor|watch|revisao|gate|pr|aguardar|ci|deploy)\b/.test(texto)
      ? "event_driven"
      : riscoScore >= 4
      ? "watchdog_longo"
      : "timer_curto";

  return {
    ok: true,
    escopoAtomico,
    escopoAtomicoProb: escopoAtomico ? 0.88 : 0.25,
    riscoScore,
    riscoNivel: RISCO_LABELS[Math.max(0, Math.min(4, riscoScore - 1))],
    modeloTier,
    modeloRecomendadoHint: TIER_MODEL_HINTS[modeloTier],
    attentionPolicy,
    alertas,
  };
}

/**
 * Executa triagem em cascata de um card em 1 única chamada batch à Buzz Decisions API
 * (4 perguntas simultâneas: yes_no + score + choice + choice).
 * Nunca falha: cai para heurística determinística offline se Decisions API estiver indisponível.
 */
export async function triageCardWithDecisions(
  ctx: Context | any,
  input: CardTriageInput
): Promise<CardTriageResult> {
  const t0 = Date.now();
  const baseline = deterministicCardTriage(input);
  const decisionsApi = ctx?.decisions;

  if (!decisionsApi?.decide) {
    recordDecisionTelemetry({
      mode: "card_triage",
      source: "deterministic_fallback",
      durationMs: Date.now() - t0,
      preventedExpensiveWake: baseline.modeloTier === "tier1_fast",
    });
    return {
      ...baseline,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: "decisions_api_not_available",
    };
  }

  const statePayload = [
    `Título: ${input.titulo || "(vazio)"}`,
    `Objetivo: ${input.objetivo || "(não informado)"}`,
    `Tipo: ${input.tipo || "execucao"}`,
    `Escrita exclusiva (${(input.escrita_exclusiva || []).length}): ${(input.escrita_exclusiva || []).join(", ") || "(não informada)"}`,
    `Passos (${(input.passos || []).length}): ${(input.passos || []).join(" | ") || "(não informados)"}`,
    `Comando de aceite L-22: ${input.acceptance_command || "(ausente)"}`,
    `Risco declarado: ${input.risco_declarado || "(não informado)"}`,
  ].join("\n");

  try {
    const res = await decisionsApi.decide({
      state: statePayload,
      timeoutMs: 15000,
      questions: {
        escopo_atomico: {
          type: "yes_no",
          instructions:
            "O card tem escopo fechado, atômico (1 a 6 arquivos) e critério de aceite verificável para execução em um único ciclo de engenharia?",
        },
        risco_tier: {
          type: "score",
          instructions:
            "Classifique o risco técnico e arquitetural desta tarefa (segurança, banco/migrations, concorrência, núcleo da esteira ou infra crítica).",
          levels: ["muito_baixo", "baixo", "medio", "alto", "critico"],
        },
        modelo_tier: {
          type: "choice",
          instructions:
            "Qual tier de modelo LLM oferece melhor custo-benefício (RouteLLM) para executar este card com alta taxa de acerto na primeira passagem?",
          options: {
            tier1_fast: "Tarefa simples, cirúrgica, fixture, ajuste pontual ou documentação.",
            tier2_balanced: "Implementação padrão de feature, serviço, testes ou revisão de código.",
            tier3_frontier: "Arquitetura complexa, segurança, concorrência, multi-serviço ou bug crítico.",
          },
        },
        politica_attention: {
          type: "choice",
          instructions:
            "Qual política de Buzz Attention/Watch é mais adequada para acompanhar a execução deste card sem desperdício de turnos?",
          options: {
            timer_curto: "Execução rápida local (revisitar a cada 10 min, máx 3 ocorrências, janela 1h).",
            event_driven: "Depende de revisão, PR, CI ou resposta em thread (watch de evento com classifier).",
            watchdog_longo: "Tarefa complexa ou multi-etapa (revisitar a cada 20 min, máx 5 ocorrências, janela 3h).",
          },
        },
      },
    });

    if (res?.outcome === "answered" && res.answers) {
      const ansAtomico = res.answers.escopo_atomico;
      const ansRisco = res.answers.risco_tier;
      const ansModelo = res.answers.modelo_tier;
      const ansAttention = res.answers.politica_attention;

      const escopoAtomicoProb =
        ansAtomico?.type === "yes_no" ? Number(ansAtomico.probability) : baseline.escopoAtomicoProb;
      const escopoAtomico = escopoAtomicoProb >= 0.5;

      // score é 0-based (0..4) -> mapeamos para 1..5
      const rawScore = ansRisco?.type === "score" ? Math.round(Number(ansRisco.score)) + 1 : baseline.riscoScore;
      const riscoScore = Math.max(1, Math.min(5, rawScore));

      const modeloTier: ModelTierChoice =
        ansModelo?.type === "choice" &&
        (ansModelo.choice === "tier1_fast" ||
          ansModelo.choice === "tier2_balanced" ||
          ansModelo.choice === "tier3_frontier")
          ? ansModelo.choice
          : baseline.modeloTier;

      const attentionPolicy: AttentionPolicyChoice =
        ansAttention?.type === "choice" &&
        (ansAttention.choice === "timer_curto" ||
          ansAttention.choice === "event_driven" ||
          ansAttention.choice === "watchdog_longo")
          ? ansAttention.choice
          : baseline.attentionPolicy;

      const alertas = [...baseline.alertas];
      if (!escopoAtomico) {
        alertas.push(
          `Decisions API (${res.model}): escopo avaliado como pouco atômico (p=${escopoAtomicoProb.toFixed(2)}).`
        );
      }

      recordDecisionTelemetry({
        mode: "card_triage",
        source: "decisions_api",
        model: res.model || null,
        backend: res.backend || null,
        durationMs: Date.now() - t0,
        preventedExpensiveWake: modeloTier !== "tier3_frontier" || !escopoAtomico,
      });
      return {
        ok: true,
        decisionSource: "decisions_api",
        backend: res.backend || null,
        model: res.model || null,
        fallbackReason: null,
        escopoAtomico,
        escopoAtomicoProb,
        riscoScore,
        riscoNivel: RISCO_LABELS[riscoScore - 1],
        modeloTier,
        modeloRecomendadoHint: TIER_MODEL_HINTS[modeloTier],
        attentionPolicy,
        alertas: Array.from(new Set(alertas)),
      };
    }

    return {
      ...baseline,
      decisionSource: "deterministic_fallback",
      backend: res?.backend || null,
      model: null,
      fallbackReason: `decisions_api_failed:${res?.reason || "unknown"}`,
    };
  } catch (err: any) {
    return {
      ...baseline,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: `decisions_api_exception:${String(err?.message || err).slice(0, 80)}`,
    };
  }
}

/**
 * Checa se cada arquivo alterado pertence à lista de Escrita Exclusiva (suporta prefixo de pasta).
 */
export function findOutOfScopeFiles(escritaExclusiva: string[], arquivosAlterados: string[]): string[] {
  const allowed = (escritaExclusiva || [])
    .map((p) => String(p || "").trim().replace(/^\.\//, ""))
    .filter(Boolean);
  if (allowed.length === 0) return [];

  return (arquivosAlterados || [])
    .map((f) => String(f || "").trim().replace(/^\.\//, ""))
    .filter(Boolean)
    .filter((file) => {
      return !allowed.some((rule) => {
        if (rule === file) return true;
        if (rule.endsWith("/") && file.startsWith(rule)) return true;
        if (rule.endsWith("/**") && file.startsWith(rule.slice(0, -3))) return true;
        if (rule.endsWith("/*") && file.startsWith(rule.slice(0, -2))) return true;
        return false;
      });
    });
}

/**
 * Pre-flight rápido de entrega/PR usando 1 batch da Decisions API + verificação mecânica
 * de Escrita Exclusiva e Regra L-24 (alegação sem prova).
 */
export async function triageDiffWithDecisions(
  ctx: Context | any,
  input: DiffTriageInput
): Promise<DiffTriageResult> {
  const arquivosForaEscopo = findOutOfScopeFiles(input.escrita_exclusiva, input.arquivos_alterados);
  const escopoRespeitadoMecanico = arquivosForaEscopo.length === 0;
  const textoEntrega = `${input.resumo_entrega || ""}\n${input.saida_aceite || ""}`;
  const temSaidaReal = /exit\s*0|passed|ok|sha256|build|pytest|test/i.test(input.saida_aceite || "");
  const alegaProntoSemProva =
    !temSaidaReal && /\b(100%|pronto|passou tudo|concluido|resolvido)\b/i.test(input.resumo_entrega || "");

  const motivos: string[] = [];
  if (!escopoRespeitadoMecanico) {
    motivos.push(`Arquivos alterados fora da Escrita exclusiva: ${arquivosForaEscopo.join(", ")}`);
  }
  if (alegaProntoSemProva) {
    motivos.push("Regra L-24: entrega alega conclusão sem saída executável comprovada.");
  }

  const recusas = Number(input.recusas_anteriores || 0);
  const baselineAcao: GateActionChoice =
    recusas >= 2
      ? "escalar_coo"
      : !escopoRespeitadoMecanico || alegaProntoSemProva
      ? "pedir_ajuste_executor"
      : "prosseguir_gate";
  const baselineSeveridade =
    !escopoRespeitadoMecanico ? 4 : alegaProntoSemProva ? 3 : 1;

  const decisionsApi = ctx?.decisions;
  if (!decisionsApi?.decide || !textoEntrega.trim()) {
    return {
      ok: true,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: !decisionsApi?.decide ? "decisions_api_not_available" : "empty_delivery_text",
      escopoRespeitado: escopoRespeitadoMecanico,
      arquivosForaEscopo,
      alegacaoSemProvaL24: alegaProntoSemProva,
      severidadeDesvio: baselineSeveridade,
      acaoRecomendada: baselineAcao,
      motivos,
    };
  }

  const statePayload = [
    `Issue: ${input.issue_id || "(n/a)"} — ${input.titulo || ""}`,
    `Escrita exclusiva: ${(input.escrita_exclusiva || []).join(", ") || "(não informada)"}`,
    `Arquivos alterados: ${(input.arquivos_alterados || []).join(", ") || "(nenhum)"}`,
    `Fora de escopo (mecânico): ${arquivosForaEscopo.join(", ") || "nenhum"}`,
    `Recusas anteriores: ${recusas}`,
    `Resumo entrega: ${(input.resumo_entrega || "").slice(0, 1200)}`,
    `Saída aceite L-22: ${(input.saida_aceite || "").slice(0, 1200)}`,
  ].join("\n");

  try {
    const res = await decisionsApi.decide({
      state: statePayload,
      timeoutMs: 15000,
      questions: {
        alegacao_sem_prova: {
          type: "yes_no",
          instructions:
            "A entrega afirma que está pronta/aprovada/100% sem apresentar evidência concreta de execução (comando + exit 0 ou saída de teste real)?",
        },
        severidade_desvio: {
          type: "score",
          instructions:
            "Qual a severidade de desvio de contrato nesta entrega (vazamento de escopo, falta de prova, risco de regressão)?",
          levels: ["nenhum", "leve", "moderado", "alto", "bloqueante"],
        },
        acao_gate: {
          type: "choice",
          instructions: "Qual ação imediata o revisor/gate deve tomar?",
          options: {
            prosseguir_gate: "Entrega íntegra, dentro do escopo e com prova executável; seguir para GATE: aceito.",
            pedir_ajuste_executor: "Há desvio pontual ou falta de prova; devolver ao executor com pedido objetivo.",
            escalar_coo: "Reincidência (>=2 recusas) ou quebra grave de escopo; escalar ao COO para re-escopo.",
          },
        },
      },
    });

    if (res?.outcome === "answered" && res.answers) {
      const ansL24 = res.answers.alegacao_sem_prova;
      const ansSev = res.answers.severidade_desvio;
      const ansAcao = res.answers.acao_gate;

      const l24Prob = ansL24?.type === "yes_no" ? Number(ansL24.probability) : 0;
      const alegacaoSemProvaL24 = alegaProntoSemProva || l24Prob >= 0.65;
      if (l24Prob >= 0.65 && !alegaProntoSemProva) {
        motivos.push(`Decisions API (${res.model}): suspeita de alegação sem prova L-24 (p=${l24Prob.toFixed(2)}).`);
      }

      const severidadeDesvio = Math.max(
        baselineSeveridade,
        ansSev?.type === "score" ? Math.min(5, Math.max(1, Math.round(Number(ansSev.score)) + 1)) : baselineSeveridade
      );

      let acaoRecomendada: GateActionChoice =
        ansAcao?.type === "choice" &&
        (ansAcao.choice === "prosseguir_gate" ||
          ansAcao.choice === "pedir_ajuste_executor" ||
          ansAcao.choice === "escalar_coo")
          ? ansAcao.choice
          : baselineAcao;

      // Invariante mecânica nunca pode ser afrouxada pelo modelo
      if (!escopoRespeitadoMecanico && acaoRecomendada === "prosseguir_gate") {
        acaoRecomendada = recusas >= 2 ? "escalar_coo" : "pedir_ajuste_executor";
      }

      return {
        ok: true,
        decisionSource: "decisions_api",
        backend: res.backend || null,
        model: res.model || null,
        fallbackReason: null,
        escopoRespeitado: escopoRespeitadoMecanico,
        arquivosForaEscopo,
        alegacaoSemProvaL24,
        severidadeDesvio,
        acaoRecomendada,
        motivos: Array.from(new Set(motivos)),
      };
    }

    return {
      ok: true,
      decisionSource: "deterministic_fallback",
      backend: res?.backend || null,
      model: null,
      fallbackReason: `decisions_api_failed:${res?.reason || "unknown"}`,
      escopoRespeitado: escopoRespeitadoMecanico,
      arquivosForaEscopo,
      alegacaoSemProvaL24: alegaProntoSemProva,
      severidadeDesvio: baselineSeveridade,
      acaoRecomendada: baselineAcao,
      motivos,
    };
  } catch (err: any) {
    return {
      ok: true,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: `decisions_api_exception:${String(err?.message || err).slice(0, 80)}`,
      escopoRespeitado: escopoRespeitadoMecanico,
      arquivosForaEscopo,
      alegacaoSemProvaL24: alegaProntoSemProva,
      severidadeDesvio: baselineSeveridade,
      acaoRecomendada: baselineAcao,
      motivos,
    };
  }
}

/**
 * Gera o contrato nativo Buzz Attention & Watch (interest_set + watch_add)
 * pronto para o agente registrar via MCP nativo do Buzz, substituindo o legado `goal (20 turns)`.
 */
export function buildBuzzAttentionContract(params: {
  slug: string;
  titulo: string;
  executor: string;
  revisor: string;
  policy: AttentionPolicyChoice;
  channel?: string;
  threadRoot?: string;
  nowUnixSecs?: number;
}): BuzzAttentionContract {
  const slug = sanitizeSlug(params.slug || params.titulo);
  const interestId = `orgfy-card-${slug}`.slice(0, 64);
  const now = typeof params.nowUnixSecs === "number" ? params.nowUnixSecs : Math.floor(Date.now() / 1000);
  const channel = (params.channel || DEFAULT_ORGFY_CHANNEL).trim();

  const presets: Record<
    AttentionPolicyChoice,
    { intervalSecs: number; maxOccurrences: number; windowSecs: number; label: string }
  > = {
    timer_curto: { intervalSecs: 600, maxOccurrences: 3, windowSecs: 3600, label: "Timer curto (10m x 3, janela 1h)" },
    event_driven: { intervalSecs: 900, maxOccurrences: 4, windowSecs: 7200, label: "Event-driven + Watchdog (15m x 4, janela 2h)" },
    watchdog_longo: { intervalSecs: 1200, maxOccurrences: 5, windowSecs: 10800, label: "Watchdog longo (20m x 5, janela 3h)" },
  };

  const preset = presets[params.policy] || presets.timer_curto;
  const expiresAt = now + preset.windowSecs;

  const contract: BuzzAttentionContract = {
    policy: params.policy,
    interest_id: interestId,
    interest_set_payload: {
      id: interestId,
      title: `Card ${slug}: ${params.titulo}`.slice(0, 90),
      summary: `Execução/revisão do card ${slug} (${params.executor} → ${params.revisor}) com política ${preset.label}.`,
      instructions:
        `Acompanhe o card '${params.titulo}' (${slug}). ` +
        `Executor: ${params.executor}; Revisor: ${params.revisor}. ` +
        `Se o card já tiver ENTREGUE_PARA_REVISAO, GATE: aceito ou MERGED na main, remova os watches (watch_remove) e este Interest (interest_remove) imediatamente para zero desperdício.`,
      expected_state: "object-v1:absent",
    },
    timer_watch_payload: {
      interest: interestId,
      id: `timer-${slug}`.slice(0, 64),
      type: "timer",
      expected_state: "object-v1:absent",
      channel,
      ...(params.threadRoot ? { root: params.threadRoot } : {}),
      prompt: `Check-in de progresso do card ${slug}: verifique status na worktree/PR. Se concluído ou aguardando outro perfil, chame watch_remove e encerre com [SILENT].`,
      interval_secs: preset.intervalSecs,
      max_occurrences: preset.maxOccurrences,
      expires_at: expiresAt,
    },
    cleanup_rule:
      "Auto-limpeza obrigatória: ao publicar ENTREGUE_PARA_REVISAO, GATE: aceito ou detectar merge na main, chamar watch_remove e interest_remove.",
  };

  if (params.policy === "event_driven") {
    contract.event_watch_payload = {
      interest: interestId,
      id: `ev-${slug}`.slice(0, 64),
      type: "event",
      expected_state: "object-v1:absent",
      channels: [channel],
      channel,
      ...(params.threadRoot ? { root: params.threadRoot } : {}),
      since: "now",
      is_reply: Boolean(params.threadRoot),
      classifier: {
        questions: {
          handoff_ou_gate_card: {
            question: `A mensagem contém uma entrega real (ENTREGUE_PARA_REVISAO com prova), bloqueio (BLOQUEADO) ou veredito (GATE: aceito/recusado) especificamente sobre o card ${slug}?`,
            true: "Reporta entrega com comando/exit code, novo commit/PR, bloqueio formal ou decisão de Gate para este card.",
            false: "Conversa paralela, outro card, status rotineiro sem ação ou duplicata.",
            threshold: 0.3,
          },
        },
      },
    };
  }

  return contract;
}
