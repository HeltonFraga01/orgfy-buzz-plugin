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
    return fallback;
  }
}

/**
 * Snapshot completo dos arquivos de estado da esteira determinística.
 */
export async function fetchLiveEsteiraState(ctx: any) {
  const [boardManifest, esteiraState, placarState, regrasState] = await Promise.all([
    readOrgfyJson<BoardManifest | null>(ctx, "empresas/board.json", null),
    readOrgfyJson<EsteiraMinimaState | null>(ctx, ".esteira/estado/esteira-minima-state.json", null),
    readOrgfyJson<PlacarState | null>(ctx, ".scratch/placar-20h.json", null),
    readOrgfyJson<RegrasProbatoriasState | null>(ctx, ".esteira/estado/regras-probatorias.json", null),
  ]);

  return {
    boardManifest,
    esteiraState,
    placarState,
    regrasState,
    timestamp: Date.now(),
  };
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

  // 1. Prioridade 1: Spawn nativo 'open' do macOS através do host Cordis
  if (ctx?.host?.spawn) {
    try {
      const proc = await ctx.host.spawn("open", { args: [uri] });
      const code = await proc.exited;
      if (code === 0) opened = true;
    } catch (e) {
      console.warn("[OrgFy Bridge] spawn direct open falhou:", e);
    }

    if (!opened) {
      // 2. Fallback via 'bash' (com manifest args: ["-c"])
      try {
        const proc = await ctx.host.spawn("bash", { args: [`open "${uri}"`] });
        const code = await proc.exited;
        if (code === 0) opened = true;
      } catch (e) {
        console.warn("[OrgFy Bridge] spawn bash open falhou:", e);
      }
    }
  }

  // 3. Fallback Webview DOM (dispara o manipulador de protocolo do sistema)
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

  // 4. Fallback via window.location somente se outros métodos falharem
  if (!opened && typeof window !== "undefined") {
    try {
      window.location.assign(uri);
      opened = true;
    } catch (_e) {}
  }

  return opened;
}

/**
 * Abre a tela nativa de uma Issue diretamente no Buzz Desktop via `ctx.navigation.open`.
 * Rota canônica: kind: "page", pluginId: "buzz.repos", pageId: "repos", route: { version: 1, params: { type: "issue", owner, dtag, id } }
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
    // String não-hexadecimal (ex: slugs como BUZZ-106-WORKTREE-COMPAT): deriva hash determinístico de 64 hex
    let hash = "";
    for (let i = 0; i < 64; i++) {
      const code = ((rawId.charCodeAt(i % (rawId.length || 1)) + i * 37) * 31) % 16;
      hash += code.toString(16);
    }
    targetId = hash;
  }

  // 1. Tenta navegação interna nativa de páginas do Buzz Desktop (Cordis navigation service)
  if (ctx?.navigation?.open) {
    try {
      const res = await ctx.navigation.open({
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
      if (!res || res.status === "opened") {
        return true;
      }
      console.warn("[OrgFy Bridge] ctx.navigation.open retornou status não aberto:", res);
    } catch (err) {
      console.warn("[OrgFy Bridge] ctx.navigation.open para buzz.repos/repos falhou:", err);
    }
  }

  // 2. Fallback gracioso: URI canônica buzz://issue?...
  const uri = `buzz://issue?id=${targetId}&owner=${owner}&d=${dtag}`;
  return openSystemUri(ctx, uri);
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
