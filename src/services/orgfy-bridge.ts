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

import { ORGFY_REPO_ROOT, BUZZ_ROOT, SCRATCH_ROOT, ORGFY_VAULT_ENV_PATH } from "../config";
export const ORGFY_ABS_PATH = ORGFY_REPO_ROOT;

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
        const userScratch = `${BUZZ_ROOT}/${relativePath}`;
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
        const userScratch = `${BUZZ_ROOT}/${relativePath}`;
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
  if (!dateInput) return "--";
  let ts = typeof dateInput === "number" ? dateInput : new Date(dateInput).getTime();
  if (isNaN(ts) || ts <= 0) return "--";
  // Normaliza Unix epoch em segundos para milissegundos
  if (ts < 1e12) ts = ts * 1000;

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
 * Lê dados reais de board.json, esteira-minima-state.json (ou por tenant),
 * placar-20h.json, regras-probatorias.json, porteiro-state.json e metricas_turnos.json.
 */
export async function fetchLiveEsteiraState(ctx: any, empresa?: string) {
  const slug = empresa && empresa !== "all" ? empresa : "orgfy";
  const tenantEsteiraPath =
    slug !== "orgfy"
      ? `.esteira/estado/esteira-minima-${slug}-state.json`
      : ".esteira/estado/esteira-minima-state.json";

  const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const [boardManifest, esteiraStateTenant, placarHoje, placarFallback, regrasState, porteiroState, metricasTurnos] = await Promise.all([
    readOrgfyJson<BoardManifest | null>(ctx, "empresas/board.json", null),
    readOrgfyJson<EsteiraMinimaState | null>(ctx, tenantEsteiraPath, null),
    readOrgfyJson<PlacarState | null>(ctx, `../.scratch/placar-${todayCompact}.json`, null),
    readOrgfyJson<PlacarState | null>(ctx, ".scratch/placar-20h.json", null),
    readOrgfyJson<RegrasProbatoriasState | null>(ctx, ".esteira/estado/regras-probatorias.json", null),
    readOrgfyJson<any>(ctx, ".esteira/estado/porteiro-state.json", null),
    readOrgfyJson<any>(ctx, ".scratch/metricas_turnos.json", null),
  ]);
  const placarState = placarHoje ?? placarFallback;

  const esteiraState =
    esteiraStateTenant ??
    (slug !== "orgfy"
      ? await readOrgfyJson<EsteiraMinimaState | null>(ctx, ".esteira/estado/esteira-minima-state.json", null)
      : null);

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

export interface LiveKanbanSnapshot {
  ok: boolean;
  error: string | null;
  sources: {
    canvas_atual: boolean;
    esteira_minima_state: boolean;
  };
  cards: PipelineCard[];
}

/**
 * Extrai os cards reais da esteira v10 sem qualquer fallback mockado:
 * 1. .scratch/canvas_atual.md (tabelas de 4 colunas em ## Fila e 6 colunas em ## Em execução / ## Feito hoje)
 * 2. .esteira/estado/esteira-minima-state.json (aceites congelados, aceite_cache, CI e merged)
 */
export async function fetchLiveKanbanSnapshot(
  ctx: any,
  filter?: { stage?: string; empresa?: string; skipWorktreeScan?: boolean }
): Promise<LiveKanbanSnapshot> {
  const [live, canvasText] = await Promise.all([
    fetchLiveEsteiraState(ctx, filter?.empresa),
    readOrgfyText(ctx, ".scratch/canvas_atual.md"),
  ]);

  const hasCanvas = typeof canvasText === "string" && canvasText.trim().length > 0;
  const hasEsteiraState = live.esteiraState !== null;

  if (!hasCanvas && !hasEsteiraState) {
    return {
      ok: false,
      error: "Não foi possível ler .scratch/canvas_atual.md nem .esteira/estado/esteira-minima-state.json.",
      sources: { canvas_atual: false, esteira_minima_state: false },
      cards: [],
    };
  }

  const cardMap = new Map<string, PipelineCard>();
  const aceites = (live.esteiraState?.aceites || {}) as Record<string, any>;
  const aceiteCache = (live.esteiraState?.aceite_cache || {}) as Record<string, any>;
  const mergedSet = new Set<string>(
    Array.isArray(live.esteiraState?.merged)
      ? (live.esteiraState.merged as string[])
      : Object.keys((live.esteiraState?.merged as Record<string, any>) || {})
  );

  // Indexa pubkey -> nome amigável do agente a partir do manifesto da empresa (evita pubkey crua de 64 hex no card)
  const pubkeyToAgentName = new Map<string, string>();
  try {
    const orgfyMan = await readOrgfyJson<any>(ctx, "empresas/orgfy.json", null);
    const agentesObj = orgfyMan?.agentes;
    if (agentesObj && typeof agentesObj === "object") {
      for (const [agentName, info] of Object.entries(agentesObj as Record<string, any>)) {
        const pk = typeof info?.pubkey === "string" ? info.pubkey.trim().toLowerCase() : "";
        if (/^[0-9a-f]{64}$/i.test(pk)) {
          pubkeyToAgentName.set(pk, agentName);
        }
      }
    }
  } catch {
    // Opcional
  }
  const resolveAgentDisplay = (raw: string | undefined, fallback: string): string => {
    const val = String(raw || "").trim();
    if (!val) return fallback;
    const lower = val.toLowerCase();
    if (/^[0-9a-f]{64}$/i.test(lower)) {
      return pubkeyToAgentName.get(lower) || `Agente #${lower.slice(0, 8)}`;
    }
    return val;
  };

  // Indexa aceite_cache por prefixo curto (8 chars) e por issue_id completo
  const aceiteCacheByIssue = new Map<string, any>();
  for (const [, item] of Object.entries(aceiteCache)) {
    if (item?.issue_id) {
      aceiteCacheByIssue.set(item.issue_id, item);
      aceiteCacheByIssue.set(item.issue_id.slice(0, 8), item);
    }
  }

  // Indexa timestamps reais (ms) e IDs 64-hex a partir de esteira-transicoes.jsonl
  const issueTimestampMap = new Map<string, number>();
  const short8ToFull64 = new Map<string, string>();
  for (const fullK of Object.keys(aceites)) {
    if (/^[0-9a-f]{64}$/i.test(fullK)) short8ToFull64.set(fullK.slice(0, 8).toLowerCase(), fullK.toLowerCase());
  }
  for (const [, item] of Object.entries(aceiteCache)) {
    if (item?.issue_id && /^[0-9a-f]{64}$/i.test(item.issue_id)) {
      short8ToFull64.set(item.issue_id.slice(0, 8).toLowerCase(), item.issue_id.toLowerCase());
    }
  }
  try {
    if (ctx?.host?.readFile) {
      const rawTrans = await ctx.host.readFile(`${SCRATCH_ROOT}/esteira-transicoes.jsonl`);
      const transTxt =
        typeof rawTrans === "string"
          ? rawTrans
          : rawTrans instanceof Uint8Array
          ? new TextDecoder("utf-8").decode(rawTrans)
          : String(rawTrans ?? "");
      for (const line of transTxt.split("\n")) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          const full = typeof ev?.issue_id === "string" ? ev.issue_id.trim().toLowerCase() : "";
          if (/^[0-9a-f]{64}$/i.test(full)) {
            short8ToFull64.set(full.slice(0, 8), full);
            const rawTs = Number(ev?.ts || ev?.timestamp || 0);
            if (rawTs > 1700000000) {
              const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
              const prev = issueTimestampMap.get(full) || 0;
              if (tsMs > prev) {
                issueTimestampMap.set(full, tsMs);
                issueTimestampMap.set(full.slice(0, 8), tsMs);
              }
            }
          }
        } catch {
          // Linha malformada ignorada
        }
      }
    }
  } catch {
    // Arquivo esteira-transicoes.jsonl opcional
  }

  // 1. Extrai cards reais do canvas_atual.md (suporta tabelas de 4, 5 ou 6+ colunas)
  if (hasCanvas && canvasText) {
    const linkPattern = /\[([^\]]+)\]\(buzz:\/\/issue\?id=([0-9a-fA-F]{64})&owner=([0-9a-fA-F]{64})&d=([^)]+)\)/;
    const lines = canvasText.split("\n");
    let section: "execucao" | "fila" | "feito" | "other" = "other";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("## ")) {
        const lowerHeader = line.toLowerCase();
        if (lowerHeader.includes("fila")) {
          section = "fila";
        } else if (lowerHeader.includes("feito") || lowerHeader.includes("conclu")) {
          section = "feito";
        } else if (lowerHeader.includes("execu") || lowerHeader.includes("andamento")) {
          section = "execucao";
        } else {
          section = "other";
        }
        continue;
      }

      if (!line.startsWith("|")) continue;
      const linkMatch = linkPattern.exec(line);
      if (!linkMatch) continue;

      const [, titleRaw, fullId, owner, tenantRaw] = linkMatch;
      const cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

      const shortId = fullId.slice(0, 8);
      const title = titleRaw.trim();
      const tenant = tenantRaw.trim() || "orgfy";

      let spec = "";
      let executor = "";
      let revisor = "";
      let statusText = "";
      let branchCell = "";
      let tableAcceptanceCmd = "";

      if (section === "fila" && cells.length <= 4) {
        // | Card | Spec | Aceite | Dono |
        spec = cells[1] || "";
        tableAcceptanceCmd = (cells[2] || "").replace(/^`|`$/g, "").trim();
        statusText = cells[3] || "";
      } else {
        // | Card | Spec | Executor | Revisor | Estado | Branch / PR |
        spec = cells[1] || "";
        executor = cells[2] || "";
        revisor = cells[3] || "";
        statusText = cells[4] || "";
        branchCell = cells[5] || "";
      }

      const lowerStatus = `${statusText} ${branchCell}`.toLowerCase();
      let stage: PipelineCard["stage"] = "execucao";
      if (section === "fila") {
        stage = "triagem";
      } else if (
        section === "feito" ||
        mergedSet.has(fullId) ||
        mergedSet.has(shortId) ||
        lowerStatus.includes("integrado em origin/main") ||
        lowerStatus.includes("merged")
      ) {
        stage = "feito";
      } else if (
        lowerStatus.includes("revisão") ||
        lowerStatus.includes("revisao") ||
        lowerStatus.includes("gate") ||
        lowerStatus.includes("ci ok") ||
        lowerStatus.includes("aguardando ci")
      ) {
        stage = "revisao";
      } else if (lowerStatus.includes("aguardando reatrib") || lowerStatus.includes("aguardando despacho")) {
        stage = "triagem";
      } else if (lowerStatus.includes("despachado") && !lowerStatus.includes("em andamento")) {
        stage = "despachado";
      }

      const aceiteRecord = aceites[fullId] || aceites[shortId] || null;
      const cachedAceite = aceiteCacheByIssue.get(fullId) || aceiteCacheByIssue.get(shortId) || null;
      const acceptanceCommand =
        (typeof aceiteRecord === "object" && aceiteRecord?.comando) ||
        cachedAceite?.comando ||
        tableAcceptanceCmd ||
        undefined;
      const acceptanceHash =
        (typeof aceiteRecord === "object" && aceiteRecord?.hash_comando) ||
        cachedAceite?.hash_comando ||
        undefined;

      const branchMatch = branchCell.match(/`([^`]+)`/);
      const branch = branchMatch ? branchMatch[1] : undefined;
      const prMatch = `${statusText} ${branchCell}`.match(/PR\s+`?([0-9a-fA-F]{7,64})`?/i);
      const prId = prMatch ? prMatch[1] : undefined;
      const shaMatch = cachedAceite?.sha_pr || `${statusText} ${branchCell}`.match(/SHA\s+`?([0-9a-fA-F]{7,40})`?/i)?.[1];

      const card: PipelineCard = {
        id: `card-${shortId}`,
        issueId: shortId,
        fullIssueId: fullId,
        owner: owner.trim(),
        title,
        priority: title.includes("P0") ? "P0" : title.includes("P1") ? "P1" : "P2",
        empresa: tenant,
        executor: resolveAgentDisplay(executor, "A definir"),
        revisor: resolveAgentDisplay(revisor, "A definir"),
        decisor: "OrgFy Iris",
        tier: executor.includes("Bento")
          ? "tier_3_arquiteto"
          : revisor.includes("Vera") || revisor.includes("Teo")
          ? "tier_2_revisor"
          : "tier_1_exec_barato",
        stage,
        prId,
        commitSha: shaMatch ? String(shaMatch).slice(0, 7) : undefined,
        ciStatus: cachedAceite?.status === "VERDE" ? "pass" : undefined,
        objetivo: title,
        contexto: statusText || spec || undefined,
        acceptanceCommand,
        acceptanceHash,
        worktreePath: `.worktrees/${shortId}`,
        branch,
        createdAt:
          issueTimestampMap.get(fullId.toLowerCase()) ||
          issueTimestampMap.get(shortId.toLowerCase()) ||
          (cachedAceite?.ts ? (Number(cachedAceite.ts) < 1e12 ? Number(cachedAceite.ts) * 1000 : Number(cachedAceite.ts)) : undefined),
      };

      cardMap.set(shortId, card);
    }
  }

  // 2. Se o canvas não trouxe cards, deriva diretamente dos aceites reais de esteira-minima-state.json
  if (cardMap.size === 0 && hasEsteiraState && aceites) {
    for (const [fullId, item] of Object.entries(aceites)) {
      if (!item || typeof item !== "object") continue;
      const shortId = fullId.slice(0, 8);
      const cachedAceite = aceiteCacheByIssue.get(fullId) || aceiteCacheByIssue.get(shortId) || null;
      const isMerged = mergedSet.has(fullId) || mergedSet.has(shortId);
      cardMap.set(shortId, {
        id: `card-${shortId}`,
        issueId: shortId,
        fullIssueId: fullId,
        title: `Card ${shortId} — Aceite congelado`,
        priority: "P1",
        empresa: filter?.empresa && filter.empresa !== "all" ? filter.empresa : "orgfy",
        executor: "A definir",
        revisor: "A definir",
        tier: "tier_1_exec_barato",
        stage: isMerged ? "feito" : "despachado",
        commitSha: cachedAceite?.sha_pr ? String(cachedAceite.sha_pr).slice(0, 7) : undefined,
        ciStatus: cachedAceite?.status === "VERDE" ? "pass" : undefined,
        acceptanceCommand: (item as any).comando || cachedAceite?.comando || undefined,
        acceptanceHash: (item as any).hash_comando || undefined,
        worktreePath: `.worktrees/${shortId}`,
      });
    }
  }

  // 3. Mescla locks ativos (orgfy-locks.json) na raia Em Execução (fail-closed: exige 64-hex Nostr real)
  const DEFAULT_ORGFY_OWNER = "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";

  const resolveIssueMetadataFromRelay = async (
    fullId: string
  ): Promise<{ title?: string; owner?: string; revisor?: string; acceptanceCommand?: string; branch?: string } | null> => {
    if (!ctx?.host?.spawn || !/^[0-9a-f]{64}$/i.test(fullId)) return null;
    try {
      let out = "";
      const p = await ctx.host.spawn("buzz", {
        args: ["issues", "get", "--event", fullId],
        onStdout: (c: string) => {
          out += c;
        },
      });
      const code = await p.exited;
      if (code !== 0 || !out.trim()) return null;
      const parsed = JSON.parse(out);
      const ev = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!ev || typeof ev !== "object") return null;
      const tags: any[] = Array.isArray(ev.tags) ? ev.tags : [];
      const subjectTag = tags.find((t) => Array.isArray(t) && t[0] === "subject" && typeof t[1] === "string");
      const aTag = tags.find((t) => Array.isArray(t) && t[0] === "a" && typeof t[1] === "string");
      let owner: string | undefined;
      if (aTag) {
        const parts = String(aTag[1]).split(":");
        if (parts.length >= 2 && /^[0-9a-f]{64}$/i.test(parts[1])) owner = parts[1].toLowerCase();
      }
      const content = String(ev.content || "");
      const revM = content.match(/(?:-\s+)?(?:\*\*)?Revisor(?:\*\*)?:\s*([^\n\r|]+)/i);
      const branchM = content.match(/(?:-\s+)?(?:\*\*)?Branch(?:\*\*)?:\s*`?([a-zA-Z0-9._/-]+)`?/i);
      const acM = content.match(/##\s*(?:Comando de aceite|Aceite)[\s\S]*?```(?:bash|sh)?\s*\n([^\n`]+)/i);
      return {
        title: subjectTag ? String(subjectTag[1]).trim() : undefined,
        owner: owner || DEFAULT_ORGFY_OWNER,
        revisor: revM ? revM[1].replace(/\*/g, "").trim() : undefined,
        branch: branchM ? branchM[1].trim() : undefined,
        acceptanceCommand: acM ? acM[1].trim() : undefined,
      };
    } catch {
      return null;
    }
  };

  try {
    if (ctx?.host?.readFile) {
      const rawLocks = await ctx.host.readFile(`${SCRATCH_ROOT}/orgfy-locks.json`);
      const lockTxt =
        typeof rawLocks === "string"
          ? rawLocks
          : rawLocks instanceof Uint8Array
          ? new TextDecoder("utf-8").decode(rawLocks)
          : String(rawLocks ?? "");
      const parsedLocks = JSON.parse(lockTxt);
      const nowMs = Date.now();
      if (parsedLocks && typeof parsedLocks === "object" && !Array.isArray(parsedLocks)) {
        for (const [lockIssueId, rec] of Object.entries(parsedLocks as Record<string, any>)) {
          if (!rec || typeof rec.expiresAt !== "number" || rec.expiresAt <= nowMs) continue;
          const cleanLock = String(lockIssueId || "").replace(/^#/, "").trim().toLowerCase();
          const fullLockId = /^[0-9a-f]{64}$/i.test(cleanLock)
            ? cleanLock
            : short8ToFull64.get(cleanLock.slice(0, 8));
          // Fail-closed: nunca exibe card no Kanban sem Issue Nostr real de 64 hex
          if (!fullLockId) continue;
          const shortLockId = fullLockId.slice(0, 8);
          if (cardMap.has(shortLockId)) continue;

          const aceiteRecord = aceites[fullLockId] || aceites[shortLockId] || null;
          const cachedAceite = aceiteCacheByIssue.get(fullLockId) || aceiteCacheByIssue.get(shortLockId) || null;
          const relayMeta =
            !rec.title || !rec.acceptanceCommand ? await resolveIssueMetadataFromRelay(fullLockId) : null;
          const resolvedTitle =
            (typeof rec.title === "string" && rec.title.trim()) ||
            relayMeta?.title ||
            `Issue Nostr #${shortLockId}`;
          const resolvedOwner =
            (typeof rec.owner === "string" && /^[0-9a-f]{64}$/i.test(rec.owner) && rec.owner.toLowerCase()) ||
            relayMeta?.owner ||
            DEFAULT_ORGFY_OWNER;
          const resolvedAcceptanceCmd =
            (typeof rec.acceptanceCommand === "string" && rec.acceptanceCommand.trim()) ||
            (typeof aceiteRecord === "object" && aceiteRecord?.comando) ||
            cachedAceite?.comando ||
            relayMeta?.acceptanceCommand ||
            undefined;
          const resolvedAcceptanceHash =
            (typeof aceiteRecord === "object" && aceiteRecord?.hash_comando) ||
            cachedAceite?.hash_comando ||
            undefined;

          cardMap.set(shortLockId, {
            id: `lock-${shortLockId}`,
            issueId: shortLockId,
            fullIssueId: fullLockId,
            owner: resolvedOwner,
            title: resolvedTitle,
            empresa: filter?.empresa && filter.empresa !== "all" ? filter.empresa : "orgfy",
            executor: resolveAgentDisplay(String(rec.agentKey || ""), "Agente OrgFy"),
            revisor: resolveAgentDisplay(
              (typeof rec.revisor === "string" && rec.revisor.trim()) || relayMeta?.revisor,
              "Revisão pendente"
            ),
            decisor: "OrgFy Iris",
            tier: "tier_1_exec_barato",
            stage: "execucao",
            priority: "P1",
            branch: (typeof rec.branch === "string" && rec.branch.trim()) || relayMeta?.branch || undefined,
            acceptanceCommand: resolvedAcceptanceCmd,
            acceptanceHash: resolvedAcceptanceHash,
            worktreePath: `.worktrees/${shortLockId}`,
            createdAt: Number(rec.acquiredAt || issueTimestampMap.get(fullLockId) || nowMs),
            updatedAt: Number(rec.acquiredAt || nowMs),
          });
        }
      }
    }
  } catch {
    // Arquivo orgfy-locks.json opcional
  }

  // 4. Mescla worktrees Git ativas (ex.: .worktrees/e2e-smoke-v12) que ainda não constam no canvas
  //    Fail-closed: só exibe worktree vinculada a uma Issue Nostr real de 64 hex
  try {
    if (!filter?.skipWorktreeScan && ctx?.host?.spawn) {
      let wtOut = "";
      const proc = await ctx.host.spawn("git", {
        args: ["-C", ORGFY_ABS_PATH, "worktree", "list", "--porcelain"],
        onStdout: (chunk: string) => {
          wtOut += chunk;
        },
      });
      const code = await proc.exited;
      if (code === 0 && wtOut.trim()) {
        const blocks = wtOut.trim().split(/\n\s*\n/);
        for (const blk of blocks) {
          const wtMatch = blk.match(/^worktree\s+(.+)$/m);
          const headMatch = blk.match(/^HEAD\s+([0-9a-f]{7,40})$/m);
          const branchMatch = blk.match(/^branch\s+refs\/heads\/(.+)$/m);
          if (!wtMatch || !branchMatch) continue;
          const wtFull = wtMatch[1].trim();
          const branchName = branchMatch[1].trim();
          if (branchName === "main" || branchName === "master") continue;
          const wtMatchDir = wtFull.match(/\/\.?worktrees\/([^/]+)/);
          if (!wtMatchDir) continue;
          const slug = (wtMatchDir[1] || "").trim();
          if (!slug || slug.startsWith("_")) continue;
          const wtRelPath = wtFull.includes("/.worktrees/") ? `.worktrees/${slug}` : `worktrees/${slug}`;

          // Ignora worktrees cujo HEAD já está integrado em origin/main (evita cards "fantasmas" após merge)
          if (headMatch && headMatch[1]) {
            try {
              const ancProc = await ctx.host.spawn("git", {
                args: ["-C", ORGFY_ABS_PATH, "merge-base", "--is-ancestor", headMatch[1], "origin/main"],
              });
              const ancCode = await ancProc.exited;
              if (ancCode === 0) continue;
            } catch {
              // Se falhar, mantém a worktree visível
            }
          }

          // Evita duplicar card já presente no Kanban (por slug, branch ou título)
          const slugLower = slug.toLowerCase();
          const alreadyListed = Array.from(cardMap.values()).some(
            (c) =>
              (c.branch && c.branch.toLowerCase() === branchName.toLowerCase()) ||
              (c.worktreePath && c.worktreePath.toLowerCase().includes(slugLower)) ||
              (c.title && c.title.toLowerCase().includes(slugLower))
          );
          if (alreadyListed) continue;

          // Tenta resolver o ID Nostr real (64 hex) a partir de laudos em docs/deliveries/ ou cards/ na worktree
          let resolvedFullIssueId: string | undefined = undefined;
          let resolvedOwner: string | undefined = undefined;
          let resolvedObjetivo: string | undefined = undefined;
          let resolvedAceite: string | undefined = undefined;
          try {
            const cardMd = await readOrgfyText(ctx, `cards/${slug.toUpperCase()}.md`);
            if (cardMd) {
              const objMatch = cardMd.match(/##\s*1\.\s*Objetivo[\s\S]*?\n+([^\n#]+)/i);
              if (objMatch) resolvedObjetivo = objMatch[1].trim();
              const acMatch = cardMd.match(/##\s*8\.\s*Comando de aceite[\s\S]*?```(?:bash|sh)?\s*\n([^\n`]+)/i);
              if (acMatch) resolvedAceite = acMatch[1].trim();
              const linkM = cardMd.match(/buzz:\/\/issue\?id=([0-9a-f]{64})&owner=([0-9a-f]{64})/i);
              if (linkM) {
                resolvedFullIssueId = linkM[1].toLowerCase();
                resolvedOwner = linkM[2].toLowerCase();
              }
            }
          } catch {
            // Card markdown opcional
          }
          if (!resolvedFullIssueId && ctx?.host?.spawn) {
            try {
              let grepOut = "";
              const gProc = await ctx.host.spawn("git", {
                args: [
                  "-C",
                  wtFull,
                  "grep",
                  "-H",
                  "-o",
                  "-E",
                  "buzz://issue\\?id=[0-9a-fA-F]{64}&owner=[0-9a-fA-F]{64}",
                  "--",
                  "docs/deliveries/",
                ],
                onStdout: (c: string) => { grepOut += c; },
              });
              await gProc.exited;
              // Filtra ESTRITAMENTE por arquivos cujo nome contenha o slug da worktree (evita herdar ID de laudos antigos)
              for (const line of grepOut.split("\n")) {
                const colonIdx = line.indexOf(":");
                if (colonIdx <= 0) continue;
                const fileName = line.slice(0, colonIdx).toLowerCase();
                if (!fileName.includes(slugLower)) continue;
                const m = line.slice(colonIdx + 1).match(/id=([0-9a-fA-F]{64})&owner=([0-9a-fA-F]{64})/);
                if (m) {
                  resolvedFullIssueId = m[1].toLowerCase();
                  resolvedOwner = m[2].toLowerCase();
                  break;
                }
              }
            } catch {
              // Opcional
            }
          }

          // Fail-closed: worktrees locais sem Issue Nostr vinculada não viram cards órfãos no Kanban
          if (!resolvedFullIssueId) continue;
          const shortWtIssue = resolvedFullIssueId.slice(0, 8);
          if (cardMap.has(shortWtIssue)) continue;

          cardMap.set(shortWtIssue, {
            id: `wt-${slug}`,
            issueId: shortWtIssue,
            fullIssueId: resolvedFullIssueId,
            owner: resolvedOwner || DEFAULT_ORGFY_OWNER,
            title: `${slug.toUpperCase()} (${branchName})`,
            objetivo: resolvedObjetivo || `${slug.toUpperCase()} em execução na branch ${branchName}`,
            acceptanceCommand: resolvedAceite,
            empresa: filter?.empresa && filter.empresa !== "all" ? filter.empresa : "orgfy",
            executor: "Em execução (worktree)",
            revisor: "Revisão pendente",
            decisor: "OrgFy Iris",
            tier: "tier_1_exec_barato",
            stage: "execucao",
            priority: "P1",
            branch: branchName,
            commitSha: headMatch ? headMatch[1].slice(0, 7) : undefined,
            worktreePath: wtRelPath,
            updatedAt: Date.now(),
          });
        }
      }
    }
  } catch {
    // Worktree discovery opcional
  }

  // 5. Mescla cards recém-criados (orgfy-cards-index.json + REPOS/orgfy/cards/*.md recentes)
  //    Garante que toda issue criada via orgfy_card_create / buzz-issue-guard.sh apareça imediatamente no Kanban
  try {
    const parseCardMdFields = (md: string) => {
      const titleM = md.match(/^#\s+(.+)$/m);
      const execM = md.match(/(?:-\s+)?(?:\*\*)?Executor(?:\*\*)?:\s*([^\n\r|]+)/i);
      const revM = md.match(/(?:-\s+)?(?:\*\*)?Revisor(?:\*\*)?:\s*([^\n\r|]+)/i);
      const decM = md.match(/(?:-\s+)?(?:\*\*)?Decisor(?:\*\*)?:\s*([^\n\r|]+)/i);
      const branchM = md.match(/(?:-\s+)?(?:\*\*)?Branch(?:\*\*)?:\s*`?([a-zA-Z0-9._/-]+)`?/i);
      const wtM = md.match(/(?:-\s+)?(?:\*\*)?Workspace(?:\*\*)?:\s*(?:worktree:)?`?([^\s`\n\r]+)`?/i);
      const objM = md.match(/##\s*(?:1\.\s*)?Objetivo[\s\S]*?\n+([^\n#]+)/i);
      const acM = md.match(/##\s*(?:8\.\s*)?Comando de aceite[\s\S]*?```(?:bash|sh)?\s*\n([^\n`]+)/i);
      return {
        title: titleM ? titleM[1].trim() : undefined,
        executor: execM ? execM[1].replace(/\*/g, "").trim() : undefined,
        revisor: revM ? revM[1].replace(/\*/g, "").trim() : undefined,
        decisor: decM ? decM[1].replace(/\*/g, "").trim() : undefined,
        branch: branchM ? branchM[1].trim() : undefined,
        worktreePath: wtM ? wtM[1].trim() : undefined,
        objetivo: objM ? objM[1].trim() : undefined,
        acceptanceCommand: acM ? acM[1].trim() : undefined,
      };
    };

    if (ctx?.host?.readFile) {
      const rawIdx = await ctx.host.readFile(`${SCRATCH_ROOT}/orgfy-cards-index.json`);
      const idxTxt =
        typeof rawIdx === "string"
          ? rawIdx
          : rawIdx instanceof Uint8Array
          ? new TextDecoder("utf-8").decode(rawIdx)
          : String(rawIdx ?? "");
      const parsedIdx = JSON.parse(idxTxt);
      if (parsedIdx && typeof parsedIdx === "object" && !Array.isArray(parsedIdx)) {
        for (const [rawKey, entry] of Object.entries(parsedIdx as Record<string, any>)) {
          const fullId = String(entry?.issue_id || rawKey || "").trim().toLowerCase();
          if (!/^[0-9a-f]{64}$/i.test(fullId)) continue;
          const shortId = fullId.slice(0, 8);
          if (mergedSet.has(fullId) || mergedSet.has(shortId) || cardMap.has(shortId)) continue;

          const relCardPath = String(entry?.card_path || "").replace(/^\/Users\/heltonfraga\/\.buzz\/REPOS\/orgfy\//, "").trim();
          let fields: ReturnType<typeof parseCardMdFields> = {
            title: undefined,
            executor: undefined,
            revisor: undefined,
            decisor: undefined,
            branch: undefined,
            worktreePath: undefined,
            objetivo: undefined,
            acceptanceCommand: undefined,
          };
          if (relCardPath) {
            const md = await readOrgfyText(ctx, relCardPath);
            if (md) fields = parseCardMdFields(md);
          }

          const aceiteRecord = aceites[fullId] || aceites[shortId] || null;
          const hasFrozenAceite = Boolean(aceiteRecord);
          const entryStatus = String(entry?.status || "").trim().toLowerCase();
          const isEntryDone = entryStatus === "merged" || entryStatus === "resolved" || entryStatus === "closed" || entryStatus === "feito";
          const stage: PipelineCard["stage"] = isEntryDone ? "feito" : hasFrozenAceite ? "despachado" : "triagem";
          const title = String(entry?.title || fields.title || `Issue #${shortId}`).trim();

          cardMap.set(shortId, {
            id: `card-${shortId}`,
            issueId: shortId,
            fullIssueId: fullId,
            owner: String(entry?.owner || DEFAULT_ORGFY_OWNER).toLowerCase(),
            title,
            priority: title.includes("P0") ? "P0" : title.includes("P1") ? "P1" : "P2",
            empresa: String(entry?.repo_id || "orgfy"),
            executor: resolveAgentDisplay(fields.executor, "A definir"),
            revisor: resolveAgentDisplay(fields.revisor, "A definir"),
            decisor: fields.decisor || "OrgFy Iris",
            tier: "tier_1_exec_barato",
            stage,
            objetivo: fields.objetivo || title,
            acceptanceCommand: (typeof aceiteRecord === "object" && aceiteRecord?.comando) || fields.acceptanceCommand,
            acceptanceHash: (typeof aceiteRecord === "object" && aceiteRecord?.hash_comando) || undefined,
            branch: fields.branch,
            worktreePath: fields.worktreePath || `.worktrees/${shortId}`,
            createdAt: Number(entry?.created_at || Date.now()),
          });
        }
      }
    }
  } catch {
    // Índice orgfy-cards-index.json opcional
  }

  let result = Array.from(cardMap.values());
  if (filter?.empresa && filter.empresa !== "all") {
    result = result.filter((c) => !c.empresa || c.empresa === filter.empresa);
  }
  if (filter?.stage && filter.stage !== "all") {
    result = result.filter((c) => c.stage === filter.stage);
  }

  return {
    ok: true,
    error: null,
    sources: {
      canvas_atual: hasCanvas,
      esteira_minima_state: hasEsteiraState,
    },
    cards: result,
  };
}

/**
 * Wrapper compatível para componentes UI: retorna a lista real de cards (sem fallback mockado).
 */
export async function fetchLiveKanbanCards(
  ctx: any,
  filter?: { stage?: string; empresa?: string; skipWorktreeScan?: boolean }
): Promise<PipelineCard[]> {
  const snapshot = await fetchLiveKanbanSnapshot(ctx, filter);
  return snapshot.cards;
}

/**
 * Fonte única de verdade para orgfy_status (usada tanto pela agentTool quanto pelo servidor MCP).
 * Zero mistura de fontes em cards_por_raia e zero números hardcoded de fallback.
 */
export async function buildOrgfyStatus(ctx: any, empresa?: string) {
  const slug = empresa || "orgfy";

  const readKpisEsteira = async (): Promise<any | null> => {
    if (ctx?.host?.readFile) {
      try {
        const raw = await ctx.host.readFile(`${SCRATCH_ROOT}/kpis-esteira.json`);
        const txt = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        return JSON.parse(txt);
      } catch {
        // fallback para readOrgfyJson
      }
    }
    return readOrgfyJson<any>(ctx, ".scratch/kpis-esteira.json", null);
  };

  const [live, kanban, kpisSnap] = await Promise.all([
    fetchLiveEsteiraState(ctx, slug),
    fetchLiveKanbanSnapshot(ctx, { empresa: slug }),
    readKpisEsteira(),
  ]);

  // Contagem das 5 raias derivada 100% da mesma fonte do orgfy_kanban_read
  const cardsPorRaia = {
    triagem: 0,
    despachado: 0,
    execucao: 0,
    revisao: 0,
    feito: 0,
  };
  for (const c of kanban.cards) {
    if (c.stage in cardsPorRaia) {
      cardsPorRaia[c.stage as keyof typeof cardsPorRaia] += 1;
    }
  }

  const countEntries = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.length;
    if (typeof val === "object") return Object.keys(val).length;
    return null;
  };

  const reentregasObj = (live.porteiroState as any)?.v87_reentregas;
  const maxReentregas =
    reentregasObj && typeof reentregasObj === "object"
      ? Object.values(reentregasObj).reduce(
          (max: number, item: any) => Math.max(max, Number((item as any)?.contador) || 0),
          0
        )
      : null;

  const porteiroOnline =
    live.esteiraState?.cutover_at !== undefined || live.porteiroState !== null;

  const regrasObj = live.regrasState?.regras;
  const regrasAtivas =
    regrasObj && typeof regrasObj === "object" ? Object.keys(regrasObj).length : null;

  const totalAceitesBlindados =
    countEntries(live.esteiraState?.aceite_cache) ?? countEntries(live.esteiraState?.aceites);

  const totalMergedGate = countEntries(live.esteiraState?.merged);

  // Fonte única determinística: prioriza kpis-esteira.json (mesma fonte do orgfy_kpis)
  // para eliminar contradição entre orgfy_status e orgfy_kpis.
  const kpiCpiReal =
    typeof kpisSnap?.economia?.cpi_real === "number" ? kpisSnap.economia.cpi_real : null;
  const fallbackCpiTokens =
    typeof live.metricasTurnos?.governanca_orcamento?.cpi_tokens === "number"
      ? live.metricasTurnos.governanca_orcamento.cpi_tokens
      : null;
  const cpiTokens = kpiCpiReal ?? fallbackCpiTokens;

  const cpiMinimo =
    typeof live.metricasTurnos?.governanca_orcamento?.cpi_minimo === "number"
      ? live.metricasTurnos.governanca_orcamento.cpi_minimo
      : null;

  const kpiFpyReal =
    typeof kpisSnap?.qualidade?.fpy_real_pct === "number"
      ? kpisSnap.qualidade.fpy_real_pct
      : null;
  const fallbackFpyPercent =
    typeof live.placarState?.pct_aceito_primeira_revisao === "number"
      ? live.placarState.pct_aceito_primeira_revisao
      : null;
  const fpyPercent = kpiFpyReal ?? fallbackFpyPercent;

  return {
    empresa: slug,
    measured_at: new Date().toISOString(),
    porteiro_online: porteiroOnline,
    fpy_percent: fpyPercent,
    fpy_fonte: kpiFpyReal !== null ? "kpis-esteira.json" : fallbackFpyPercent !== null ? "placar" : null,
    cpi_tokens: cpiTokens,
    cpi_fonte: kpiCpiReal !== null ? "kpis-esteira.json" : fallbackCpiTokens !== null ? "metricas_turnos" : null,
    cpi_minimo: cpiMinimo,
    kpis_gerado_em: typeof kpisSnap?.gerado_em === "string" ? kpisSnap.gerado_em : null,
    circuit_breaker_loop: maxReentregas !== null ? `${maxReentregas}/3` : null,
    circuit_breaker_loop_ativo: maxReentregas !== null ? maxReentregas >= 3 : null,
    total_cards_kanban: kanban.cards.length,
    cards_por_raia: cardsPorRaia,
    regras_probatorias_ativas: regrasAtivas,
    total_aceites_blindados: totalAceitesBlindados,
    total_merged_gate: totalMergedGate,
    placar_20h: live.placarState
      ? {
          disponivel: true,
          abertos_na_tela: (live.placarState as any).abertos_na_tela ?? null,
          divergencia_relay_tela: (live.placarState as any).divergencia_relay_tela ?? null,
          voltas_revisao: (live.placarState as any).voltas_revisao ?? null,
          cards_por_estado_historico: live.placarState.cards_por_estado ?? null,
        }
      : { disponivel: false },
    esteira_runtime: live.esteiraState
      ? {
          disponivel: true,
          cutover_at: live.esteiraState.cutover_at ?? null,
          aceites_ativos: countEntries(live.esteiraState.aceites),
          aceites_blindados_cache: countEntries(live.esteiraState.aceite_cache),
          ci_registros: countEntries(live.esteiraState.ci),
          ci_cache: countEntries(live.esteiraState.ci_cache),
          merged_gate: totalMergedGate,
        }
      : { disponivel: false },
    fontes_lidas: {
      canvas_atual: kanban.sources.canvas_atual,
      esteira_minima_state: live.esteiraState !== null,
      kpis_esteira: kpisSnap !== null,
      placar_20h: live.placarState !== null,
      porteiro_state: live.porteiroState !== null,
      metricas_turnos: live.metricasTurnos !== null,
      regras_probatorias: live.regrasState !== null,
      board_manifest: live.boardManifest !== null,
    },
    kanban_error: kanban.error,
    modo_execucao: "efemero_headless",
  };
}

/**
 * Executa o comando determinístico de Despacho via `ctx.host.spawn` com bash.
 * cd ~/.buzz/REPOS/orgfy && python3 ferramentas/esteira/despachar --empresa <slug> <ISSUE_ID> "<EXECUTOR>" "<REVISOR>"
 */
const SENTINELA_ENV_PATH = ORGFY_VAULT_ENV_PATH;

function shQuote(arg: string): string {
  return `'${String(arg).replace(/'/g, `'"'"'`)}'`;
}

function buildEnvPythonBashCmd(pyArgs: string[]): string {
  const quotedArgs = pyArgs.map(shQuote).join(" ");
  return `set -a; [ -f ${shQuote(SENTINELA_ENV_PATH)} ] && . ${shQuote(SENTINELA_ENV_PATH)}; set +a; cd ${shQuote(ORGFY_ABS_PATH)} && exec python3 ${quotedArgs}`;
}

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

  const pyArgs = [
    `${ORGFY_ABS_PATH}/ferramentas/esteira/despachar`,
    "--empresa",
    options.empresa,
    options.issueId,
    options.executor,
    options.revisor,
  ];
  appendChunk(`[EXEC] python3 ${pyArgs.join(" ")}\n`);

  if (!ctx?.host?.spawn) {
    appendChunk("[ERRO] ctx.host.spawn indisponível para despachar " + options.issueId + ".\n");
    return { code: 1, output: combinedOutput };
  }

  const isTransientRelayMiss = (text: string) =>
    /(n[aã]o foi poss[ií]vel obter conte[uú]do|not found|n[aã]o encontrad|timeout|timed out|relay)/i.test(text);

  const maxAttempts = 3;
  const backoffMs = [2000, 4000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let attemptOutput = "";
    const appendAttempt = (chunk: string) => {
      attemptOutput += chunk;
      appendChunk(chunk);
    };
    try {
      const proc = await ctx.host.spawn("python", {
        args: pyArgs,
        cwd: ORGFY_ABS_PATH,
        onStdout: appendAttempt,
        onStderr: appendAttempt,
      });

      const code = await proc.exited;
      if (code === 0) {
        appendChunk(`\n[PROCESSO ENCERRADO] Código de saída: 0\n`);
        return { code: 0, output: combinedOutput };
      }

      if (attempt < maxAttempts && isTransientRelayMiss(attemptOutput)) {
        const waitMs = backoffMs[attempt - 1] ?? 3000;
        appendChunk(
          `\n[RETRY ${attempt}/${maxAttempts - 1}] Issue recém-criada ainda propagando no relay; aguardando ${waitMs / 1000}s...\n`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      appendChunk(`\n[PROCESSO ENCERRADO] Código de saída: ${code}\n`);
      return { code, output: combinedOutput };
    } catch (err: any) {
      appendChunk(`\n[ERRO NA EXECUÇÃO] ${err?.message || String(err)}\n`);
      return { code: 1, output: combinedOutput };
    }
  }

  return { code: 1, output: combinedOutput };
}

/**
 * Executa o comando determinístico de Gate (Aceite ou Recusa) via `ctx.host.spawn` com bash.
 * cd ~/.buzz/REPOS/orgfy && python3 ferramentas/esteira/gate --empresa <slug> <PR_ID> aceito|recusado "<motivo>" --revisor "<NOME>"
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

  const pyArgs = [
    `${ORGFY_ABS_PATH}/ferramentas/esteira/gate`,
    "--empresa",
    options.empresa,
    options.prId,
    options.acao,
  ];
  if (options.acao === "recusado") {
    pyArgs.push(options.motivo);
  }
  pyArgs.push("--revisor", options.revisor);

  appendChunk(`[EXEC] python3 ${pyArgs.join(" ")}\n`);

  if (!ctx?.host?.spawn) {
    appendChunk(`[ERRO] ctx.host.spawn indisponível para executar Gate em ${options.prId}.\n`);
    return { code: 1, output: combinedOutput };
  }

  try {
    const proc = await ctx.host.spawn("python", {
      args: pyArgs,
      cwd: ORGFY_ABS_PATH,
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
 * cd ~/.buzz/REPOS/orgfy && python3 ferramentas/esteira/porteiro.py --empresa <slug> --uma-vez
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

  const pyArgs = [
    `${ORGFY_ABS_PATH}/ferramentas/esteira/porteiro.py`,
    "--empresa",
    options.empresa,
    "--uma-vez",
  ];
  appendChunk(`[EXEC] python3 ${pyArgs.join(" ")}\n`);

  if (!ctx?.host?.spawn) {
    appendChunk("[ERRO] ctx.host.spawn indisponível para sincronizar Porteiro.\n");
    return { code: 1, output: combinedOutput };
  }

  try {
    const proc = await ctx.host.spawn("python", {
      args: pyArgs,
      cwd: ORGFY_ABS_PATH,
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

export function isValidNostrIssueId(id?: string | null): boolean {
  return /^[0-9a-f]{64}$/i.test(String(id || "").replace(/^#/, "").trim());
}

/**
 * Abre uma URI no sistema operacional (macOS) via processo 'open' direto (sem bash -c) ou fallback DOM.
 */
export async function openSystemUri(ctx: any, uri: string): Promise<boolean> {
  let opened = false;

  // 1. Prioridade 1: Spawn direto de 'open' (sem shell)
  if (ctx?.host?.spawn) {
    try {
      const proc = await ctx.host.spawn("open", { args: [uri] });
      const code = await proc.exited;
      if (code === 0) opened = true;
    } catch (e) {
      console.warn("[OrgFy Bridge] spawn direct open falhou:", e);
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

  return opened;
}

/**
 * Abre a tela nativa de uma Issue diretamente no Buzz Desktop.
 * Exige estritamente um Nostr event ID real de 64 caracteres hexadecimais —
 * NUNCA fabrica hash falso ou zero-padded (o que causa tela "This page isn't available").
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
  if (!isValidNostrIssueId(rawId)) {
    console.warn("[OrgFy Bridge] openIssueInBuzz bloqueado: ID não é um hash Nostr válido de 64 hex:", rawId);
    return false;
  }

  const uri = `buzz://issue?id=${rawId}&owner=${owner}&d=${dtag}`;

  // 1. Navegação interna nativa direta em 1 salto (resolve scope de navigation.snapshot OU relay.snapshot)
  if (ctx?.navigation?.open) {
    try {
      const snap = typeof ctx.navigation.snapshot === "function" ? ctx.navigation.snapshot() : null;
      const navScope = snap?.entry?.target?.scope;
      let activeScope =
        navScope && typeof navScope === "object" && navScope.viewer && navScope.communityOrigin
          ? { viewer: String(navScope.viewer), communityOrigin: String(navScope.communityOrigin) }
          : undefined;

      if (!activeScope && typeof ctx?.relay?.snapshot === "function") {
        const rSnap = ctx.relay.snapshot();
        const viewer = rSnap?.viewer ? String(rSnap.viewer) : "";
        let communityOrigin = rSnap?.origin ? String(rSnap.origin) : "";
        if (!communityOrigin && viewer && typeof rSnap?.scope === "string" && rSnap.scope.endsWith(`:${viewer}`)) {
          communityOrigin = rSnap.scope.slice(0, -(viewer.length + 1));
        }
        if (viewer && communityOrigin) {
          activeScope = { viewer, communityOrigin };
        }
      }

      if (activeScope) {
        const res = await ctx.navigation.open({
          version: 1,
          kind: "page",
          pluginId: "buzz.repos",
          pageId: "repos",
          scope: activeScope,
          route: {
            version: 1,
            params: {
              type: "issue",
              owner,
              dtag,
              id: rawId,
            },
          },
        });
        if (!res || res.status === "opened") {
          return true;
        }
        console.warn("[OrgFy Bridge] ctx.navigation.open retornou status != opened:", res);
      }
    } catch (err) {
      console.warn("[OrgFy Bridge] ctx.navigation.open falhou, tentando openSystemUri:", err);
    }
  }

  // 2. Fallback: deep-link buzz://issue via protocolo do SO (ingress nativo do Buzz)
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
    return { success: false, worktrees: [], output: "[ERRO] ctx.host.spawn indisponível para listar worktrees.\n" };
  }

  let output = "";
  const append = (c: string) => (output += c);

  try {
    const proc = await ctx.host.spawn("git", {
      args: ["-C", ORGFY_ABS_PATH, "worktree", "list"],
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
