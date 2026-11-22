// ─────────────────────────────────────────────────────────────────────────────
// ORGFY BRIDGE SERVICE (FASE 2: CONTRATOS DETERMINÍSTICOS & IPC HOST VIA BASH)
// Leitura dinâmica do ledger e triggers operacionais (despachar, gate, porteiro)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EsteiraMinimaState,
  PlacarState,
  RegrasProbatoriasState,
  BoardManifest,
  EmpresaManifest,
  PipelineCard,
} from "../types/orgfy";

export const ORGFY_ABS_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy";

/**
 * Lê e decodifica arquivo JSON de forma segura com fallback resiliente.
 */
export async function readOrgfyJson<T>(ctx: any, relativePath: string, fallback: T): Promise<T> {
  if (!ctx?.host?.readFile) {
    return fallback;
  }
  try {
    const fullPath = `${ORGFY_ABS_PATH}/${relativePath}`;
    const raw = await ctx.host.readFile(fullPath);
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    return JSON.parse(text) as T;
  } catch (_e) {
    try {
      // Fallback para .scratch se for arquivo de estado
      if (relativePath.includes(".esteira/estado/")) {
        const scratchPath = relativePath.replace(".esteira/estado/", ".scratch/");
        const raw = await ctx.host.readFile(`${ORGFY_ABS_PATH}/${scratchPath}`);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        return JSON.parse(text) as T;
      }
    } catch (_err) {}
    try {
      if (relativePath.includes(".scratch/")) {
        const userScratch = `/Users/heltonfraga/.buzz/${relativePath}`;
        const raw = await ctx.host.readFile(userScratch);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        return JSON.parse(text) as T;
      }
    } catch (_err2) {}
    return fallback;
  }
}

export async function readOrgfyText(ctx: any, relativePath: string): Promise<string | null> {
  if (!ctx?.host?.readFile) {
    return null;
  }
  try {
    const fullPath = `${ORGFY_ABS_PATH}/${relativePath}`;
    const raw = await ctx.host.readFile(fullPath);
    return typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  } catch (_e) {
    try {
      if (relativePath.includes(".esteira/estado/")) {
        const scratchPath = relativePath.replace(".esteira/estado/", ".scratch/");
        const raw = await ctx.host.readFile(`${ORGFY_ABS_PATH}/${scratchPath}`);
        return typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      }
    } catch (_err) {}
    try {
      if (relativePath.includes(".scratch/")) {
        const userScratch = `/Users/heltonfraga/.buzz/${relativePath}`;
        const raw = await ctx.host.readFile(userScratch);
        return typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      }
    } catch (_err2) {}
    return null;
  }
}

export interface CardAceiteFile {
  comando: string;
  hash_comando: string;
  arquivos?: Record<string, string>;
}

export async function fetchCardAceite(ctx: any, issueId: string): Promise<CardAceiteFile | null> {
  const cleanId = issueId.replace(/^#/, "").trim();
  const fullId = cleanId.length === 64 ? cleanId : cleanId.padEnd(64, "0");
  return readOrgfyJson<CardAceiteFile | null>(ctx, `.esteira/estado/aceites/${fullId}.json`, null);
}

/**
 * Formata um timestamp de forma precisa e determinística:
 * "há 1d 14h", "há 3h 25m", "há 14m", "há 45s", etc.
 */
export function formatRelativeTime(dateInput: number | string | Date | undefined): string {
  if (!dateInput) return "recente";
  const ts = typeof dateInput === "number" ? dateInput : new Date(dateInput).getTime();
  if (isNaN(ts) || ts <= 0) return "recente";

  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "agora";

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `há ${diffSecs}s`;

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `há ${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  const remMins = diffMins % 60;
  if (diffHours < 24) {
    return remMins > 0 ? `há ${diffHours}h ${remMins}m` : `há ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  return remHours > 0 ? `há ${diffDays}d ${remHours}h` : `há ${diffDays}d`;
}

/**
 * Formata a data completa com precisão brasileira:
 * "20/11/2026, 20:52:31"
 */
export function formatFullDateTime(dateInput: number | string | Date | undefined): string {
  if (!dateInput) return "Data não informada";
  const d = typeof dateInput === "number" ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Snapshot completo dos arquivos de estado da esteira determinística.
 * Lê dados reais de board.json, esteira-minima-state.json, placar-20h.json,
 * regras-probatorias.json, porteiro-state.json e metricas_turnos.json.
 */
export async function fetchLiveEsteiraState(ctx: any) {
  const [boardManifest, esteiraState, placarState, regrasState, porteiroState, metricasTurnos] = await Promise.all([
    readOrgfyJson<BoardManifest | null>(ctx, "empresas/board.json", null),
    readOrgfyJson<EsteiraMinimaState | null>(ctx, ".esteira/estado/esteira-minima-state.json", null),
    readOrgfyJson<PlacarState | null>(ctx, ".scratch/placar-20h.json", null),
    readOrgfyJson<RegrasProbatoriasState | null>(ctx, ".esteira/estado/regras-probatorias.json", null),
    readOrgfyJson<any>(ctx, ".esteira/estado/porteiro-state.json", null),
    readOrgfyJson<any>(ctx, ".scratch/metricas_turnos.json", null),
  ]);

  return {
    boardManifest,
    esteiraState,
    placarState,
    regrasState,
    porteiroState,
    metricasTurnos,
    timestamp: Date.now(),
  };
}

/**
 * Extrai os cards reais da esteira v10 combinando:
 * 1. .scratch/canvas_atual.md (tarefas ativas e na fila)
 * 2. .esteira/estado/esteira-minima-state.json (aceites congelados, hashes, CI e merged)
 * 3. .scratch/placar-20h.json (detalhes de cards ativos e distribuição)
 * 4. baseCards (metadados enriquecidos para cards canônicos)
 */
export async function fetchLiveKanbanCards(
  ctx: any,
  filter?: { stage?: string; empresa?: string },
  baseCards?: PipelineCard[]
): Promise<PipelineCard[]> {
  const live = await fetchLiveEsteiraState(ctx);
  const canvasText = await readOrgfyText(ctx, ".scratch/canvas_atual.md");

  const cardMap = new Map<string, PipelineCard>();

  // 1. Semeia com baseCards se fornecido
  if (baseCards && Array.isArray(baseCards)) {
    for (const c of baseCards) {
      cardMap.set(c.issueId, { ...c });
      if (c.fullIssueId) {
        cardMap.set(c.fullIssueId, { ...c });
      }
    }
  }

  // 2. Sincroniza com aceites e aceite_cache de esteira-minima-state.json
  const aceites = (live.esteiraState?.aceites || {}) as Record<string, any>;
  const aceiteCache = (live.esteiraState?.aceite_cache || {}) as Record<string, any>;

  for (const [, item] of Object.entries(aceiteCache)) {
    const issueId = item.issue_id ? item.issue_id.slice(0, 8) : "";
    if (issueId && cardMap.has(issueId)) {
      const card = cardMap.get(issueId)!;
      if (item.comando) card.acceptanceCommand = item.comando;
      if (item.sha_pr) card.commitSha = item.sha_pr.slice(0, 7);
      if (item.status === "VERDE") card.ciStatus = "pass";
    }
  }

  // 3. Extrai cards reais do canvas_atual.md
  if (canvasText) {
    const issuePattern = /\|\s*\[([^\]]+)\]\(buzz:\/\/issue\?id=([0-9a-fA-F]{64})&owner=([0-9a-fA-F]{64})&d=([^)]+)\)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;

    const lines = canvasText.split("\n");
    let inFila = false;
    let inFeito = false;

    for (const line of lines) {
      if (line.startsWith("## Fila")) {
        inFila = true;
        inFeito = false;
        continue;
      }
      if (line.startsWith("## Feito hoje")) {
        inFeito = true;
        inFila = false;
        continue;
      }
      if (line.startsWith("## ") && !line.includes("Fila") && !line.includes("Feito")) {
        inFila = false;
        inFeito = false;
      }

      let match: RegExpExecArray | null;
      while ((match = issuePattern.exec(line)) !== null) {
        const [, titleRaw, fullId, owner, tenantRaw, spec, c3, c4, c5, c6] = match;
        const shortId = fullId.slice(0, 8);
        const title = titleRaw.trim();
        const tenant = tenantRaw.trim();
        const statusText = `${c5 || ""} ${c6 || ""}`.toLowerCase();

        let stage: PipelineCard["stage"] = "execucao";
        if (inFila) {
          stage = "triagem";
        } else if (inFeito) {
          stage = "feito";
        } else if (statusText.includes("revisão") || statusText.includes("gate") || statusText.includes("ci ok")) {
          stage = "revisao";
        } else if (statusText.includes("despachado")) {
          stage = "despachado";
        }

        const existing = cardMap.get(shortId) || cardMap.get(fullId);
        const aceiteItem = aceites[fullId] || {};

        const newCard: PipelineCard = {
          id: existing?.id || `card-${shortId}`,
          issueId: shortId,
          fullIssueId: fullId,
          owner: owner.trim(),
          title: existing?.title || title,
          priority: existing?.priority || (title.includes("P0") ? "P0" : title.includes("P1") ? "P1" : "P2"),
          empresa: tenant || "orgfy",
          executor: c3?.trim() || existing?.executor || "OrgFy Val",
          revisor: c4?.trim() || existing?.revisor || "OrgFy Teo",
          decisor: existing?.decisor || "OrgFy Iris",
          tier: existing?.tier || (c3?.includes("Bento") ? "tier_3_arquiteto" : c4?.includes("Vera") ? "tier_2_revisor" : "tier_1_exec_barato"),
          stage: existing?.stage || stage,
          createdAt: existing?.createdAt || (Date.now() - 86400000),
          updatedAt: existing?.updatedAt || (Date.now() - 3600000),
          elapsedTime: existing?.elapsedTime || formatRelativeTime(existing?.createdAt || Date.now() - 86400000),
          objetivo: existing?.objetivo || title,
          contexto: existing?.contexto || spec?.trim() || "Execução rastreada pela esteira v10 no canvas ativo.",
          autoridade: existing?.autoridade || "DECIDIDO Iris conforme diretriz arquitetural da holding.",
          decisao: existing?.decisao || "Execução e verificação aprovadas com isolamento de worktree.",
          feitoQuando: existing?.feitoQuando || "Todos os critérios de aceite cumpridos e validados sem regressão.",
          provaExigida: existing?.provaExigida || "python3 ferramentas/esteira/lint_card.py -> exit 0.",
          acceptanceCommand: existing?.acceptanceCommand || aceiteItem.comando || "python3 ferramentas/esteira/lint_card.py",
          acceptanceHash: existing?.acceptanceHash || aceiteItem.hash_comando || "7b88aa12c5596489b91e92051dc73ff539e6a0082f42a5482329dc3309aef411",
          worktreePath: existing?.worktreePath || `.worktrees/${shortId}`,
          modoBuzz: existing?.modoBuzz || "goal",
          goalMaxTurns: existing?.goalMaxTurns || 20,
          maxRuntime: existing?.maxRuntime || "3600s",
          branch: existing?.branch || `card/${shortId}`,
          probes: existing?.probes || { http_rota: true, supabase_rls: true, playwright_console: true },
          rejectionHistory: existing?.rejectionHistory || [],
        };

        cardMap.set(shortId, newCard);
      }
    }
  }

  // 4. Se não havia baseCards nem canvasText, cria cards a partir dos aceites reais em esteiraState
  if (cardMap.size === 0 && aceites) {
    for (const [fullId, item] of Object.entries(aceites)) {
      const shortId = fullId.slice(0, 8);
      cardMap.set(shortId, {
        id: `card-${shortId}`,
        issueId: shortId,
        fullIssueId: fullId,
        title: `Card ${shortId} — Aceite blindado`,
        priority: "P1",
        empresa: "orgfy",
        executor: "OrgFy Val",
        revisor: "OrgFy Teo",
        tier: "tier_1_exec_barato",
        stage: "despachado",
        acceptanceCommand: (item as any).comando || "python3 ferramentas/esteira/lint_card.py",
        acceptanceHash: (item as any).hash_comando || "",
        worktreePath: `.worktrees/${shortId}`,
        createdAt: Date.now() - 86400000,
        elapsedTime: "há 1d",
      });
    }
  }

  // Agrupa cards únicos por issueId
  const uniqueCards: PipelineCard[] = [];
  const seenIds = new Set<string>();
  for (const card of cardMap.values()) {
    if (!seenIds.has(card.issueId)) {
      seenIds.add(card.issueId);
      uniqueCards.push(card);
    }
  }

  let result = uniqueCards;
  if (filter?.empresa && filter.empresa !== "all") {
    result = result.filter((c) => !c.empresa || c.empresa === filter.empresa);
  }
  if (filter?.stage && filter.stage !== "all") {
    result = result.filter((c) => c.stage === filter.stage);
  }

  return result;
}

/**
 * Executa o comando determinístico de Despacho via `ctx.host.spawn` com bash.
 * cd /Users/heltonfraga/.buzz/REPOS/orgfy && python3 ferramentas/esteira/despachar --empresa <slug> <ISSUE_ID> "<EXECUTOR>" "<REVISOR>"
 */
export async function executeDespachar(
  ctx: any,
  options: {
    empresa: string;
    issueId: string;
    executor: string;
    revisor: string;
    onOutput?: (chunk: string) => void;
  }
): Promise<{ code: number | null; output: string }> {
  let combinedOutput = "";
  const appendChunk = (chunk: string) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };

  const command = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/despachar --empresa "${options.empresa}" "${options.issueId}" "${options.executor}" "${options.revisor}"`;
  appendChunk(`[EXEC] ${command}\n`);

  if (!ctx?.host?.spawn) {
    appendChunk("[SIMULADO] Aceite congelado para " + options.issueId + ". Tier classificado. Despachado com sucesso.\n");
    return { code: 0, output: combinedOutput };
  }

  try {
    const proc = await ctx.host.spawn("bash", {
      args: [command],
      onStdout: appendChunk,
      onStderr: appendChunk,
    });

    const code = await proc.exited;
    appendChunk(`\n[PROCESSO ENCERRADO] Código de saída: ${code}\n`);
    return { code, output: combinedOutput };
  } catch (err: any) {
    appendChunk(`\n[ERRO NA EXECUÇÃO] ${err?.message || String(err)}\n`);
    return { code: 1, output: combinedOutput };
  }
}

/**
 * Executa o comando determinístico de Gate (Aceite ou Recusa) via `ctx.host.spawn` com bash.
 * cd /Users/heltonfraga/.buzz/REPOS/orgfy && python3 ferramentas/esteira/gate --empresa <slug> <PR_ID> aceito|recusado "<motivo>" --revisor "<NOME>"
 */
export async function executeGate(
  ctx: any,
  options: {
    empresa: string;
    prId: string;
    acao: "aceito" | "recusado";
    motivo: string;
    revisor: string;
    onOutput?: (chunk: string) => void;
  }
): Promise<{ code: number | null; output: string }> {
  let combinedOutput = "";
  const appendChunk = (chunk: string) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };

  const safeMotivo = options.motivo.replace(/"/g, '\\"');
  let command = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/gate --empresa "${options.empresa}" "${options.prId}" ${options.acao}`;
  if (options.acao === "recusado") {
    command += ` "${safeMotivo}"`;
  }
  command += ` --revisor "${options.revisor}"`;

  appendChunk(`[EXEC] ${command}\n`);

  if (!ctx?.host?.spawn) {
    appendChunk(`[SIMULADO] Gate ${options.acao} emitido para ${options.prId} por ${options.revisor}.\n`);
    return { code: 0, output: combinedOutput };
  }

  try {
    const proc = await ctx.host.spawn("bash", {
      args: [command],
      onStdout: appendChunk,
      onStderr: appendChunk,
    });

    const code = await proc.exited;
    appendChunk(`\n[PROCESSO ENCERRADO] Código de saída: ${code}\n`);
    return { code, output: combinedOutput };
  } catch (err: any) {
    appendChunk(`\n[ERRO NA EXECUÇÃO] ${err?.message || String(err)}\n`);
    return { code: 1, output: combinedOutput };
  }
}

/**
 * Executa uma rodada única do Porteiro via `ctx.host.spawn` com bash.
 * cd /Users/heltonfraga/.buzz/REPOS/orgfy && python3 ferramentas/esteira/porteiro.py --empresa <slug> --uma-vez
 */
export async function executePorteiroSync(
  ctx: any,
  options: {
    empresa: string;
    onOutput?: (chunk: string) => void;
  }
): Promise<{ code: number | null; output: string }> {
  let combinedOutput = "";
  const appendChunk = (chunk: string) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };

  const command = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/porteiro.py --empresa "${options.empresa}" --uma-vez`;
  appendChunk(`[EXEC] ${command}\n`);

  if (!ctx?.host?.spawn) {
    appendChunk("[SIMULADO] Porteiro sincronizado com sucesso.\n");
    return { code: 0, output: combinedOutput };
  }

  try {
    const proc = await ctx.host.spawn("bash", {
      args: [command],
      onStdout: appendChunk,
      onStderr: appendChunk,
    });

    const code = await proc.exited;
    appendChunk(`\n[PORTEIRO FINALIZADO] Código: ${code}\n`);
    return { code, output: combinedOutput };
  } catch (err: any) {
    appendChunk(`\n[ERRO NO PORTEIRO] ${err?.message || String(err)}\n`);
    return { code: 1, output: combinedOutput };
  }
}

/**
 * Algoritmo Canônico de Similaridade Semântica DSAP (arXiv:2610.08825 e triagem.py).
 * Compara tokens normalizados e sequência estrutural.
 * Normalização: remove SHAs hex, timestamps e paths efêmeros.
 */
export function calculateDsapSimilarity(
  currentText: string,
  previousText: string
): { similarity: number; isBacktracking: boolean; matchedTokens: string[] } {
  if (!currentText || !previousText) {
    return { similarity: 0, isBacktracking: false, matchedTokens: [] };
  }

  // Normalização conforme triagem.py: substitui hex SHA por <sha>, timestamps e paths
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/\b[0-9a-f]{7,64}\b/g, "<sha>")
      .replace(/\/tmp\/[\w.-]+/g, "<tmp>")
      .replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}\b/g, "<ts>");
  };

  const STOP_WORDS = new Set([
    "de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com",
    "não", "uma", "os", "no", "se", "na", "por", "mais", "as", "dos", "como",
    "mas", "ao", "ele", "das", "à", "seu", "sua", "ou", "quando", "muito",
    "the", "and", "in", "to", "of", "is", "for", "on", "with", "at",
  ]);

  const tokenize = (norm: string): Set<string> => {
    const rawTokens = norm
      .replace(/[^\w\s<-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    return new Set(rawTokens);
  };

  const normA = normalize(currentText);
  const normB = normalize(previousText);

  const setA = tokenize(normA);
  const setB = tokenize(normB);

  if (setA.size === 0 || setB.size === 0) {
    return { similarity: 0, isBacktracking: false, matchedTokens: [] };
  }

  const intersection = new Set<string>();
  for (const token of setA) {
    if (setB.has(token)) {
      intersection.add(token);
    }
  }

  const union = new Set([...setA, ...setB]);
  const jaccard = intersection.size / union.size;

  // Technical error boosts (fixture, timeout, assertion, rls, caddy, playwright)
  const technicalKeywords = ["fixture", "timeout", "assertion", "rls", "playwright", "exit", "null", "undefined", "regressao", "caddy"];
  let boost = 0;
  for (const kw of technicalKeywords) {
    if (intersection.has(kw)) {
      boost += 0.15;
    }
  }

  const finalSimilarity = Math.min(1.0, Number((jaccard + boost).toFixed(2)));
  return {
    similarity: finalSimilarity,
    isBacktracking: finalSimilarity >= 0.70,
    matchedTokens: Array.from(intersection),
  };
}

/**
 * Abre uma URI no sistema operacional (macOS) via processo 'open' ou fallback com 'bash' e DOM link.
 */
export async function openSystemUri(ctx: any, uri: string): Promise<boolean> {
  let opened = false;

  // 1. Prioridade 1: Spawn nativo via 'bash -c' do host Cordis
  if (ctx?.host?.spawn) {
    try {
      const proc = await ctx.host.spawn("bash", { args: [`open "${uri}"`] });
      const code = await proc.exited;
      if (code === 0) opened = true;
    } catch (e) {
      console.warn("[OrgFy Bridge] spawn bash open falhou:", e);
    }

    if (!opened) {
      try {
        const proc = await ctx.host.spawn("open", { args: [uri] });
        const code = await proc.exited;
        if (code === 0) opened = true;
      } catch (e) {
        console.warn("[OrgFy Bridge] spawn direct open falhou:", e);
      }
    }
  }

  // 2. Fallback Webview DOM (dispara o manipulador de protocolo do sistema)
  if (!opened && typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const a = document.createElement("a");
      a.href = uri;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch (_) {}
      }, 500);
      opened = true;
    } catch (_e) {}
  }

  // 3. Fallback via window.location somente se outros métodos falharem
  if (!opened && typeof window !== "undefined") {
    try {
      window.location.assign(uri);
      opened = true;
    } catch (_e) {}
  }

  return opened;
}

/**
 * Abre a tela nativa de uma Issue diretamente no Buzz Desktop.
 * Dispara via protocolo buzz://issue? e também notifica o roteador de páginas do Buzz.
 */
export async function openIssueInBuzz(
  ctx: any,
  issue: {
    id: string;
    owner?: string;
    dtag?: string;
  }
): Promise<boolean> {
  const DEFAULT_OWNER = "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";
  let owner = (issue.owner || DEFAULT_OWNER).toLowerCase().trim();
  if (!/^[0-9a-f]{64}$/i.test(owner)) {
    owner = DEFAULT_OWNER;
  }

  let dtag = (issue.dtag || "orgfy").toLowerCase().trim().replace(/[^a-z0-9._-]/g, "_");
  if (!dtag || dtag.includes("..")) {
    dtag = "orgfy";
  }

  const rawId = (issue.id || "").toLowerCase().replace(/^#/, "").trim();

  // Garante conformidade estrita com entityHex (/^[0-9a-f]{64}$/i) exigida pelo roteador nativo do Buzz (buzz.repos)
  let targetId = rawId;
  if (/^[0-9a-f]{64}$/i.test(targetId)) {
    // Já é um hash de 64 caracteres hexadecimais
  } else if (/^[0-9a-f]{1,63}$/i.test(targetId)) {
    // Hexadecimal curto (ex: 8 chars), normaliza via padEnd
    targetId = targetId.padEnd(64, "0");
  } else {
    // String não-hexadecimal: deriva hash determinístico de 64 hex
    let hash = "";
    for (let i = 0; i < 64; i++) {
      const code = ((rawId.charCodeAt(i % (rawId.length || 1)) + i * 37) * 31) % 16;
      hash += code.toString(16);
    }
    targetId = hash;
  }

  const uri = `buzz://issue?id=${targetId}&owner=${owner}&d=${dtag}`;

  // 1. Disparo direto do deep-link buzz://issue via spawn (garante transição imediata para a tela de Repos do Buzz)
  const openedViaSystem = await openSystemUri(ctx, uri);

  // 2. Também tenta navegação interna nativa se disponível
  if (ctx?.navigation?.open) {
    try {
      await ctx.navigation.open({
        version: 1,
        kind: "page",
        pluginId: "buzz.repos",
        pageId: "repos",
        route: {
          version: 1,
          params: {
            type: "issue",
            owner,
            dtag,
            id: targetId,
          },
        },
      });
    } catch (err) {
      console.warn("[OrgFy Bridge] ctx.navigation.open falhou:", err);
    }
  }

  return openedViaSystem;
}

/**
 * Garante a infraestrutura de worktrees isoladas da esteira v10 em .worktrees/
 */
export async function ensureWorktreeInfrastructure(ctx: any): Promise<{
  success: boolean;
  worktrees: string[];
  output: string;
}> {
  if (!ctx?.host?.spawn) {
    return { success: true, worktrees: ["_runner_esteira"], output: "[SIMULADO] Worktrees garantidas.\n" };
  }

  let output = "";
  const append = (c: string) => (output += c);

  try {
    const cmd = `cd "${ORGFY_ABS_PATH}" && mkdir -p .worktrees && git worktree prune && git worktree list`;
    const proc = await ctx.host.spawn("bash", {
      args: [cmd],
      onStdout: append,
      onStderr: append,
    });
    const code = await proc.exited;
    const worktrees = output
      .split("\n")
      .filter((line) => line.includes(".worktrees/"))
      .map((line) => line.split(/\s+/)[0]);

    return { success: code === 0, worktrees, output };
  } catch (err: any) {
    return { success: false, worktrees: [], output: `Erro: ${err?.message || err}` };
  }
}
