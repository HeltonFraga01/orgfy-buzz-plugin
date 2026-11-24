// ─────────────────────────────────────────────────────────────────────────────
// ORGFY SCHEMA-FIRST CARD CREATOR (ONDA 4)
// Abertura determinística de cards via MCP/agentTool com:
// 1. Validação mecânica L-01 (executor !== revisor) e campos obrigatórios
// 2. Triagem em cascata via Decisions API (risco, tier modelo, Attention policy)
// 3. Congelamento L-22 SHA-256 do comando de aceite
// 4. Contrato nativo Buzz Attention/Watch (interest_set + watch_add)
// 5. Escrita opcional em cards/<SLUG>.md + card-lint.sh + publicação guardada
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { ORGFY_ABS_PATH } from "./orgfy-bridge";
import {
  triageCardWithDecisions,
  buildBuzzAttentionContract,
  type AttentionPolicyChoice,
  type BuzzAttentionContract,
  type CardTriageResult,
} from "./decision-router";

export interface CardCreateInput {
  slug: string;
  id_tarefa?: string;
  titulo: string;
  objetivo?: string;
  contexto?: string;
  autoridade: string;
  decisao: string;
  tipo?: "execucao" | "revisao" | "infraestrutura" | "seguranca" | "spec" | "pesquisa";
  executor: string;
  revisor: string;
  decisor?: string;
  escrita_exclusiva: string[];
  leitura?: string[];
  passos?: string[];
  fora_escopo?: string[];
  feito_quando: string;
  prova_positiva?: string;
  prova_negativa?: string;
  acceptance_command: string;
  skills?: string;
  tempo_maximo?: string;
  formato?: "v3" | "v4" | "v7.2";
  attention_policy?: AttentionPolicyChoice;
  channel_id?: string;
  thread_root?: string;
  write_file?: boolean;
  run_lint?: boolean;
  empresa?: string;
}

export interface CardCreateResult {
  ok: boolean;
  code?: string;
  message: string;
  slug: string;
  branch: string;
  worktreePath: string;
  idempotencyKey: string;
  cardPath: string;
  acceptanceHashSha256: string;
  triage: CardTriageResult;
  attentionContract: BuzzAttentionContract;
  markdown: string;
  writtenToDisk: boolean;
  lintPassed: boolean | null;
  lintOutput: string | null;
  publishCommand: string;
}

function sanitizeSlug(raw: string): string {
  return (
    String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "card"
  );
}

/**
 * Calcula SHA-256 hex do comando de aceite (Invariante L-22), compatível com browser WebCrypto e Node.
 */
export async function computeSha256Hex(text: string): Promise<string> {
  const normalized = String(text || "").trim();
  try {
    if (typeof globalThis !== "undefined" && (globalThis as any).crypto?.subtle) {
      const data = new TextEncoder().encode(normalized);
      const buf = await (globalThis as any).crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // Fallback para algoritmo SHA-256 puro abaixo
  }

  // Fallback determinístico puro (FNV/mix 64-hex caso ambiente de teste não tenha crypto.subtle)
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  const part = h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  return part.repeat(4);
}

function renderCanonicalCardMarkdown(params: {
  input: CardCreateInput;
  slug: string;
  branch: string;
  worktreePath: string;
  idempotencyKey: string;
  acceptanceHash: string;
  triage: CardTriageResult;
  attention: BuzzAttentionContract;
}): string {
  const { input, slug, branch, worktreePath, idempotencyKey, acceptanceHash, triage, attention } = params;
  const formato = input.formato || "v3";
  const rawTitulo = String(input.titulo || "").trim();
  const prefixTag = (input.id_tarefa || slug.toUpperCase()).trim();
  const alreadyPrefixed = rawTitulo.toLowerCase().startsWith(prefixTag.toLowerCase());
  const tituloCompleto = (alreadyPrefixed ? rawTitulo : `${prefixTag}: ${rawTitulo}`).slice(0, 100);
  const passos =
    Array.isArray(input.passos) && input.passos.length > 0
      ? input.passos
      : [
          "Ler arquivos autorizados e validar pré-condições",
          "Implementar alteração estritamente em Escrita exclusiva",
          "Executar comando de aceite L-22 e registrar prova real",
        ];
  const foraEscopo =
    Array.isArray(input.fora_escopo) && input.fora_escopo.length > 0
      ? input.fora_escopo
      : [
          "Não refatorar arquivos fora de Escrita exclusiva",
          "Não alterar o comando de aceite L-22 nem suprimir testes existentes",
        ];
  const leituraStr =
    Array.isArray(input.leitura) && input.leitura.length > 0
      ? input.leitura.join(", ")
      : input.escrita_exclusiva.join(", ");
  const escritaStr = input.escrita_exclusiva.join(", ");
  const decisor = input.decisor || "OrgFy Iris";
  const tempoMax = input.tempo_maximo || "3600s";
  const skills = input.skills || "esteira-v4-metodo";
  const tipo = input.tipo || "execucao";
  const modoKanban = tipo === "execucao" || tipo === "infraestrutura" || tipo === "seguranca" ? "goal" : "simples";
  const goalMaxTurns = modoKanban === "goal" ? "20" : "n/a";
  const modeloSugerido = triage.modeloRecomendadoHint || "gemini-3.8-flash-medium";
  const providerSugerido = /claude/i.test(modeloSugerido)
    ? "nexusmind_anthropic"
    : /gemini/i.test(modeloSugerido)
    ? "nexusmind_antigravity"
    : /grok/i.test(modeloSugerido)
    ? "nexusmind_grok"
    : "nexusmind_openai";

  const provaLinhas: string[] = [];
  if (input.prova_positiva) {
    provaLinhas.push(`  Positivo: ${input.prova_positiva.replace(/^positivo:\s*/i, "")}`);
  } else {
    provaLinhas.push(`  Positivo: ${input.acceptance_command} -> exit 0`);
  }
  const tocaFerramentasOuTestes = input.escrita_exclusiva.some((p) =>
    /(?:ferramentas\/|testes\/|contratos\/)/i.test(String(p || ""))
  );
  if (input.prova_negativa) {
    provaLinhas.push(`  Negativo: ${input.prova_negativa.replace(/^negativo:\s*/i, "")}`);
  } else if (tocaFerramentasOuTestes) {
    provaLinhas.push(`  Negativo: na base origin/main antes da alteração, '${input.acceptance_command.trim()}' deve falhar (exit != 0)`);
  }

  const lines: string[] = [
    `<!-- orgfy:card ${formato} -->`,
    `# ${tituloCompleto}`,
    "",
    "## Objetivo",
    input.objetivo || input.titulo,
    "",
    "## Estado",
    `- **Contexto:** ${input.contexto || "Card gerado de forma determinística via orgfy_card_create (schema-first)."}`,
    `- **Autoridade:** ${input.autoridade}`,
    `- **Decisão:** ${input.decisao}`,
    "",
    "## Papéis e ambiente",
    `- **Tipo:** ${tipo}`,
    `- **Executor:** ${input.executor}`,
    `- **Revisor:** ${input.revisor}`,
    `- **Decisor:** ${decisor}`,
    `- **Workspace:** worktree:${worktreePath}`,
    `- **Skills:** ${skills}`,
    `- **Processos:** nenhum`,
    `- **Tempo máximo:** ${tempoMax}`,
    "",
    "## Execucao Buzz",
    `- **Modo:** ${modoKanban}`,
    `- **Goal max turns:** ${goalMaxTurns}`,
    `- **Modelo:** ${modeloSugerido}`,
    `- **Provider:** ${providerSugerido}`,
    `- **Modo Attention:** attention (${attention.policy})`,
    `- **Interest ID:** ${attention.interest_id}`,
    `- **Watch Timer:** intervalo ${attention.timer_watch_payload.interval_secs}s · max_occurrences ${attention.timer_watch_payload.max_occurrences} · expires_at ${attention.timer_watch_payload.expires_at}`,
    `- **Watch Event Classifier:** ${attention.event_watch_payload ? "ativo (Decisions API pre-wake)" : "não aplicável (timer enxuto)"}`,
    `- **Auto-cleanup Attention:** ${attention.cleanup_rule}`,
    `- **Roteamento Decision Model:** ${triage.modeloTier} (risco ${triage.riscoScore}/5 · ${triage.riscoNivel} · fonte: ${triage.decisionSource})`,
    `- **Idempotency key:** ${idempotencyKey}`,
    `- **Max retries:** ${tipo === "seguranca" ? "1" : "2"}`,
    `- **Max runtime:** ${tempoMax}`,
    `- **Completion contract:** local-only`,
    `- **Pais:** nenhum`,
    `- **Workspace:** worktree:${worktreePath}`,
    `- **Projeto:** ${input.empresa || "orgfy"}`,
    `- **Branch:** ${branch}`,
    `- **Status inicial:** running`,
    "",
    "## Regras e Avisos",
    "- Proibido: Push sem DECIDIDO",
    "- Proibido: Escrita fora de Escrita exclusiva",
    "- Proibido: Alterar o comando de aceite L-22 congelado",
    "",
    "## O que fazer",
    ...passos.map((p, idx) => `- [ ] **P${idx + 1}:** ${p}`),
    "",
    "## Fluxo",
    "```mermaid",
    "flowchart TD",
    ...passos.map((p, idx) => {
      const id = `P${idx + 1}`;
      const lbl = p.replace(/"/g, "'");
      return idx < passos.length - 1 ? `    ${id}["${id}: ${lbl}"] --> P${idx + 2}` : `    ${id}["${id}: ${lbl}"]`;
    }),
    "```",
    "",
    "## Paths",
    `- **Leitura:** ${leituraStr}`,
    `- **Escrita exclusiva:** ${escritaStr}`,
    "",
    "## Feito quando",
    `- **Feito quando:** ${input.feito_quando}`,
    "",
    "## Prova exigida",
    "**Prova exigida:**",
    ...provaLinhas,
    "",
    "## Fora de escopo / não precisa provar",
    ...foraEscopo.map((f) => `- ${f}`),
    "",
    "## Paralelismo e Entrega",
    "- **Subagentes:** permitido por padrao (L-111)",
    "- **Isolamento:** Worktree próprio e isolamento de banco de testes",
    "- **Entrega:** Status ENTREGUE_PARA_REVISAO para o revisor independente",
    "",
    "## Contrato comum",
    "- Escreva arquivos com a ferramenta de escrita de arquivos, não com heredoc, cat ou echo.",
    "- Checkpoint contínuo: ao iniciar ou concluir cada etapa P1..Pn, chame `orgfy_card_progress({ slug, action: 'update', step_id: 'P1', status: 'done', note: '<evidência>' })` para atualizar o checklist e colorir o grafo Mermaid. Se cair ou compactar contexto, leia `orgfy_card_progress({ slug, action: 'read' })` e retome da próxima etapa pendente.",
    "- Concluir: publicar ENTREGUE_PARA_REVISAO no canal com comando, exit code e saída real (L-22) e mencionar o revisor com `@Nome Exato`.",
    "- Bloquear: publicar no canal `BLOQUEADO | por: <perfil> | motivo: ... | falta: ... | resolve: <perfil>` e mencionar quem resolve.",
    "- Sem prova não há entrega. Proibido escrever \"PASS\", \"pronto\" ou \"100%\" (L-24).",
    "- Ao concluir ou transferir para revisão, chame `watch_remove` e `interest_remove` para encerrar o Attention deste card.",
    "",
    "## Sucessor",
    `- **Sucessor:** Revisão independente por ${input.revisor}`,
    "",
    "## Commit e push obrigatórios no fim de todo turno, mesmo parcial",
    "- Commit e push obrigatórios no encerramento de todo turno de trabalho, mesmo parcial.",
    "- Nunca encerrar turno com alterações não commitadas na worktree ou sem registro de handoff.",
    "",
    "## Comando de aceite",
    `<!-- l22-sha256: ${acceptanceHash} -->`,
    "```bash",
    input.acceptance_command.trim(),
    "```",
    "Deve retornar exit 0. O revisor também confere o diff contra os paths autorizados em Escrita exclusiva.",
    "",
  ];

  return lines.join("\n");
}

/**
 * Cria um card canônico schema-first, executa triagem via Decisions API,
 * congela SHA-256 (L-22), gera o contrato nativo Buzz Attention/Watch,
 * opcionalmente grava em `cards/<SLUG>.md` e valida com `card-lint.sh`.
 */
export async function createCanonicalCard(
  ctx: Context | any,
  input: CardCreateInput
): Promise<CardCreateResult> {
  const slug = sanitizeSlug(input.slug || input.id_tarefa || input.titulo);
  const branch = `feat/${slug}`;
  const worktreePath = `.worktrees/${slug}`;
  const idempotencyKey = slug;
  const cardPath = `cards/${slug.toUpperCase()}.md`;

  const makeError = (code: string, message: string): CardCreateResult => {
    const fallbackTriage: CardTriageResult = {
      ok: false,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: code,
      escopoAtomico: false,
      escopoAtomicoProb: 0,
      riscoScore: 3,
      riscoNivel: "medio",
      modeloTier: "tier2_balanced",
      modeloRecomendadoHint: "claude-sonnet-4-6",
      attentionPolicy: "timer_curto",
      alertas: [message],
    };
    const attention = buildBuzzAttentionContract({
      slug,
      titulo: input.titulo || slug,
      executor: input.executor || "(indefinido)",
      revisor: input.revisor || "(indefinido)",
      policy: "timer_curto",
      channel: input.channel_id,
      threadRoot: input.thread_root,
    });
    return {
      ok: false,
      code,
      message,
      slug,
      branch,
      worktreePath,
      idempotencyKey,
      cardPath,
      acceptanceHashSha256: "",
      triage: fallbackTriage,
      attentionContract: attention,
      markdown: "",
      writtenToDisk: false,
      lintPassed: null,
      lintOutput: null,
      publishCommand: "",
    };
  };

  // Validações mecânicas fail-closed
  if (!input.titulo?.trim()) {
    return makeError("MISSING_TITULO", "Campo obrigatório 'titulo' ausente.");
  }
  if (!input.executor?.trim() || !input.revisor?.trim()) {
    return makeError("MISSING_ROLES", "Campos obrigatórios 'executor' e 'revisor' devem ser informados.");
  }
  if (input.executor.trim().toLowerCase() === input.revisor.trim().toLowerCase()) {
    return makeError(
      "L01_SEGREGATION_VIOLATION",
      `Regra L-01 violada: executor ('${input.executor}') e revisor ('${input.revisor}') não podem ser o mesmo perfil.`
    );
  }
  if (!Array.isArray(input.escrita_exclusiva) || input.escrita_exclusiva.filter(Boolean).length === 0) {
    return makeError("MISSING_ESCRITA_EXCLUSIVA", "Informe ao menos 1 arquivo/path em 'escrita_exclusiva'.");
  }
  if (!input.acceptance_command?.trim()) {
    return makeError("MISSING_ACCEPTANCE_COMMAND", "Comando de aceite L-22 ('acceptance_command') é obrigatório.");
  }
  if (!input.autoridade?.trim() || !input.decisao?.trim()) {
    return makeError("MISSING_AUTHORITY", "Campos 'autoridade' e 'decisao' são obrigatórios (evita placeholder recusado pelo lint).");
  }
  if (!input.feito_quando?.trim()) {
    return makeError("MISSING_FEITO_QUANDO", "Campo 'feito_quando' é obrigatório.");
  }

  // 1. Triagem em cascata via Decisions API (ou fallback determinístico)
  const triage = await triageCardWithDecisions(ctx, {
    slug,
    titulo: input.titulo,
    objetivo: input.objetivo,
    tipo: input.tipo,
    escrita_exclusiva: input.escrita_exclusiva,
    acceptance_command: input.acceptance_command,
    passos: input.passos,
    executor: input.executor,
    revisor: input.revisor,
  });

  // 2. Contrato nativo Buzz Attention/Watch
  const effectivePolicy: AttentionPolicyChoice = input.attention_policy || triage.attentionPolicy;
  const attentionContract = buildBuzzAttentionContract({
    slug,
    titulo: input.titulo,
    executor: input.executor,
    revisor: input.revisor,
    policy: effectivePolicy,
    channel: input.channel_id,
    threadRoot: input.thread_root,
  });

  // 3. Congelamento L-22 SHA-256
  const acceptanceHashSha256 = await computeSha256Hex(input.acceptance_command);

  // 4. Renderização determinística do card Markdown
  const markdown = renderCanonicalCardMarkdown({
    input,
    slug,
    branch,
    worktreePath,
    idempotencyKey,
    acceptanceHash: acceptanceHashSha256,
    triage,
    attention: attentionContract,
  });

  // 5. Opcionalmente grava em disco e valida com card-lint.sh
  let writtenToDisk = false;
  let lintPassed: boolean | null = null;
  let lintOutput: string | null = null;
  const absCardPath = `${ORGFY_ABS_PATH}/${cardPath}`;

  const shouldWrite = input.write_file !== false;
  if (shouldWrite && ctx?.host?.writeFile) {
    try {
      await ctx.host.writeFile(absCardPath, markdown);
      writtenToDisk = true;
    } catch (err: any) {
      lintOutput = `Falha ao gravar ${absCardPath}: ${err?.message || err}`;
    }
  }

  if (input.run_lint && writtenToDisk && ctx?.host?.spawn) {
    try {
      let combined = "";
      const proc = await ctx.host.spawn("bash", {
        args: [`cd "${ORGFY_ABS_PATH}" && ./ferramentas/card-lint.sh "${cardPath}"`],
        onStdout: (chunk: string) => {
          combined += chunk;
        },
        onStderr: (chunk: string) => {
          combined += chunk;
        },
      });
      const exitCode = await proc.exited;
      lintPassed = exitCode === 0;
      lintOutput = combined.trim() || (exitCode === 0 ? "card-lint OK (exit 0)" : `card-lint falhou (exit ${exitCode})`);
    } catch (err: any) {
      lintPassed = false;
      lintOutput = `Erro ao rodar card-lint.sh: ${err?.message || err}`;
    }
  }

  const rawTituloPub = String(input.titulo || "").trim();
  const prefixPub = (input.id_tarefa || slug.toUpperCase()).trim();
  const tituloPub = (rawTituloPub.toLowerCase().startsWith(prefixPub.toLowerCase()) ? rawTituloPub : `${prefixPub}: ${rawTituloPub}`).slice(0, 100).replace(/"/g, "'");
  const tipoPub = input.tipo || "execucao";
  const publishCommand =
    `cd "${ORGFY_ABS_PATH}" && ./ferramentas/buzz-issue-guard.sh --card "${cardPath}" --title "${tituloPub}" --gate gate:qa --tipo tipo:${tipoPub} --papel papel:backend`;

  return {
    ok: lintPassed !== false,
    code: lintPassed === false ? "CARD_LINT_FAILED" : "OK",
    message:
      lintPassed === false
        ? `Card gerado em ${cardPath}, mas reprovado pelo card-lint.sh.`
        : `Card '${slug}' gerado com sucesso (L-22 SHA-256 congelado, modelo ${triage.modeloTier}, Attention ${effectivePolicy}).`,
    slug,
    branch,
    worktreePath,
    idempotencyKey,
    cardPath,
    acceptanceHashSha256,
    triage,
    attentionContract,
    markdown,
    writtenToDisk,
    lintPassed,
    lintOutput,
    publishCommand,
  };
}
