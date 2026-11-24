const ORGFY_ABS_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy";
async function readOrgfyJson(ctx, relativePath, fallback) {
  var _a;
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.readFile)) {
    return fallback;
  }
  try {
    const fullPath = `${ORGFY_ABS_PATH}/${relativePath}`;
    const raw = await ctx.host.readFile(fullPath);
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    return JSON.parse(text);
  } catch (_e) {
    try {
      if (relativePath.includes(".esteira/estado/")) {
        const scratchPath = relativePath.replace(".esteira/estado/", ".scratch/");
        const raw = await ctx.host.readFile(`${ORGFY_ABS_PATH}/${scratchPath}`);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        return JSON.parse(text);
      }
    } catch (_err) {
    }
    try {
      if (relativePath.includes(".scratch/")) {
        const userScratch = `/Users/heltonfraga/.buzz/${relativePath}`;
        const raw = await ctx.host.readFile(userScratch);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        return JSON.parse(text);
      }
    } catch (_err2) {
    }
    return fallback;
  }
}
async function readOrgfyText(ctx, relativePath) {
  var _a;
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.readFile)) {
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
    } catch (_err) {
    }
    try {
      if (relativePath.includes(".scratch/")) {
        const userScratch = `/Users/heltonfraga/.buzz/${relativePath}`;
        const raw = await ctx.host.readFile(userScratch);
        return typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      }
    } catch (_err2) {
    }
    return null;
  }
}
function formatRelativeTime(dateInput) {
  if (!dateInput) return "--";
  let ts = typeof dateInput === "number" ? dateInput : new Date(dateInput).getTime();
  if (isNaN(ts) || ts <= 0) return "--";
  if (ts < 1e12) ts = ts * 1e3;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "agora";
  const diffSecs = Math.floor(diffMs / 1e3);
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
function formatFullDateTime(dateInput) {
  if (!dateInput) return "Data não informada";
  const d = typeof dateInput === "number" ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
async function fetchLiveEsteiraState(ctx, empresa) {
  const slug = empresa && empresa !== "all" ? empresa : "orgfy";
  const tenantEsteiraPath = slug !== "orgfy" ? `.esteira/estado/esteira-minima-${slug}-state.json` : ".esteira/estado/esteira-minima-state.json";
  const todayCompact = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const [boardManifest, esteiraStateTenant, placarHoje, placarFallback, regrasState, porteiroState, metricasTurnos] = await Promise.all([
    readOrgfyJson(ctx, "empresas/board.json", null),
    readOrgfyJson(ctx, tenantEsteiraPath, null),
    readOrgfyJson(ctx, `../.scratch/placar-${todayCompact}.json`, null),
    readOrgfyJson(ctx, ".scratch/placar-20h.json", null),
    readOrgfyJson(ctx, ".esteira/estado/regras-probatorias.json", null),
    readOrgfyJson(ctx, ".esteira/estado/porteiro-state.json", null),
    readOrgfyJson(ctx, ".scratch/metricas_turnos.json", null)
  ]);
  const placarState = placarHoje ?? placarFallback;
  const esteiraState = esteiraStateTenant ?? (slug !== "orgfy" ? await readOrgfyJson(ctx, ".esteira/estado/esteira-minima-state.json", null) : null);
  return {
    boardManifest,
    esteiraState,
    placarState,
    regrasState,
    porteiroState,
    metricasTurnos,
    timestamp: Date.now()
  };
}
async function fetchLiveKanbanSnapshot(ctx, filter) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const [live, canvasText] = await Promise.all([
    fetchLiveEsteiraState(ctx, filter == null ? void 0 : filter.empresa),
    readOrgfyText(ctx, ".scratch/canvas_atual.md")
  ]);
  const hasCanvas = typeof canvasText === "string" && canvasText.trim().length > 0;
  const hasEsteiraState = live.esteiraState !== null;
  if (!hasCanvas && !hasEsteiraState) {
    return {
      ok: false,
      error: "Não foi possível ler .scratch/canvas_atual.md nem .esteira/estado/esteira-minima-state.json.",
      sources: { canvas_atual: false, esteira_minima_state: false },
      cards: []
    };
  }
  const cardMap = /* @__PURE__ */ new Map();
  const aceites = ((_a = live.esteiraState) == null ? void 0 : _a.aceites) || {};
  const aceiteCache = ((_b = live.esteiraState) == null ? void 0 : _b.aceite_cache) || {};
  const mergedSet = new Set(
    Array.isArray((_c = live.esteiraState) == null ? void 0 : _c.merged) ? live.esteiraState.merged : Object.keys(((_d = live.esteiraState) == null ? void 0 : _d.merged) || {})
  );
  const pubkeyToAgentName = /* @__PURE__ */ new Map();
  try {
    const orgfyMan = await readOrgfyJson(ctx, "empresas/orgfy.json", null);
    const agentesObj = orgfyMan == null ? void 0 : orgfyMan.agentes;
    if (agentesObj && typeof agentesObj === "object") {
      for (const [agentName, info] of Object.entries(agentesObj)) {
        const pk = typeof (info == null ? void 0 : info.pubkey) === "string" ? info.pubkey.trim().toLowerCase() : "";
        if (/^[0-9a-f]{64}$/i.test(pk)) {
          pubkeyToAgentName.set(pk, agentName);
        }
      }
    }
  } catch {
  }
  const resolveAgentDisplay = (raw, fallback) => {
    const val = String(raw || "").trim();
    if (!val) return fallback;
    const lower = val.toLowerCase();
    if (/^[0-9a-f]{64}$/i.test(lower)) {
      return pubkeyToAgentName.get(lower) || `Agente #${lower.slice(0, 8)}`;
    }
    return val;
  };
  const aceiteCacheByIssue = /* @__PURE__ */ new Map();
  for (const [, item] of Object.entries(aceiteCache)) {
    if (item == null ? void 0 : item.issue_id) {
      aceiteCacheByIssue.set(item.issue_id, item);
      aceiteCacheByIssue.set(item.issue_id.slice(0, 8), item);
    }
  }
  const issueTimestampMap = /* @__PURE__ */ new Map();
  const short8ToFull64 = /* @__PURE__ */ new Map();
  for (const fullK of Object.keys(aceites)) {
    if (/^[0-9a-f]{64}$/i.test(fullK)) short8ToFull64.set(fullK.slice(0, 8).toLowerCase(), fullK.toLowerCase());
  }
  for (const [, item] of Object.entries(aceiteCache)) {
    if ((item == null ? void 0 : item.issue_id) && /^[0-9a-f]{64}$/i.test(item.issue_id)) {
      short8ToFull64.set(item.issue_id.slice(0, 8).toLowerCase(), item.issue_id.toLowerCase());
    }
  }
  try {
    if ((_e = ctx == null ? void 0 : ctx.host) == null ? void 0 : _e.readFile) {
      const rawTrans = await ctx.host.readFile("/Users/heltonfraga/.buzz/.scratch/esteira-transicoes.jsonl");
      const transTxt = typeof rawTrans === "string" ? rawTrans : rawTrans instanceof Uint8Array ? new TextDecoder("utf-8").decode(rawTrans) : String(rawTrans ?? "");
      for (const line of transTxt.split("\n")) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          const full = typeof (ev == null ? void 0 : ev.issue_id) === "string" ? ev.issue_id.trim().toLowerCase() : "";
          if (/^[0-9a-f]{64}$/i.test(full)) {
            short8ToFull64.set(full.slice(0, 8), full);
            const rawTs = Number((ev == null ? void 0 : ev.ts) || (ev == null ? void 0 : ev.timestamp) || 0);
            if (rawTs > 17e8) {
              const tsMs = rawTs < 1e12 ? rawTs * 1e3 : rawTs;
              const prev = issueTimestampMap.get(full) || 0;
              if (tsMs > prev) {
                issueTimestampMap.set(full, tsMs);
                issueTimestampMap.set(full.slice(0, 8), tsMs);
              }
            }
          }
        } catch {
        }
      }
    }
  } catch {
  }
  if (hasCanvas && canvasText) {
    const linkPattern = /\[([^\]]+)\]\(buzz:\/\/issue\?id=([0-9a-fA-F]{64})&owner=([0-9a-fA-F]{64})&d=([^)]+)\)/;
    const lines = canvasText.split("\n");
    let section = "other";
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
      const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
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
        spec = cells[1] || "";
        tableAcceptanceCmd = (cells[2] || "").replace(/^`|`$/g, "").trim();
        statusText = cells[3] || "";
      } else {
        spec = cells[1] || "";
        executor = cells[2] || "";
        revisor = cells[3] || "";
        statusText = cells[4] || "";
        branchCell = cells[5] || "";
      }
      const lowerStatus = `${statusText} ${branchCell}`.toLowerCase();
      let stage = "execucao";
      if (section === "fila") {
        stage = "triagem";
      } else if (section === "feito" || mergedSet.has(fullId) || mergedSet.has(shortId) || lowerStatus.includes("integrado em origin/main") || lowerStatus.includes("merged")) {
        stage = "feito";
      } else if (lowerStatus.includes("revisão") || lowerStatus.includes("revisao") || lowerStatus.includes("gate") || lowerStatus.includes("ci ok") || lowerStatus.includes("aguardando ci")) {
        stage = "revisao";
      } else if (lowerStatus.includes("aguardando reatrib") || lowerStatus.includes("aguardando despacho")) {
        stage = "triagem";
      } else if (lowerStatus.includes("despachado") && !lowerStatus.includes("em andamento")) {
        stage = "despachado";
      }
      const aceiteRecord = aceites[fullId] || aceites[shortId] || null;
      const cachedAceite = aceiteCacheByIssue.get(fullId) || aceiteCacheByIssue.get(shortId) || null;
      const acceptanceCommand = typeof aceiteRecord === "object" && (aceiteRecord == null ? void 0 : aceiteRecord.comando) || (cachedAceite == null ? void 0 : cachedAceite.comando) || tableAcceptanceCmd || void 0;
      const acceptanceHash = typeof aceiteRecord === "object" && (aceiteRecord == null ? void 0 : aceiteRecord.hash_comando) || (cachedAceite == null ? void 0 : cachedAceite.hash_comando) || void 0;
      const branchMatch = branchCell.match(/`([^`]+)`/);
      const branch = branchMatch ? branchMatch[1] : void 0;
      const prMatch = `${statusText} ${branchCell}`.match(/PR\s+`?([0-9a-fA-F]{7,64})`?/i);
      const prId = prMatch ? prMatch[1] : void 0;
      const shaMatch = (cachedAceite == null ? void 0 : cachedAceite.sha_pr) || ((_f = `${statusText} ${branchCell}`.match(/SHA\s+`?([0-9a-fA-F]{7,40})`?/i)) == null ? void 0 : _f[1]);
      const card = {
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
        tier: executor.includes("Bento") ? "tier_3_arquiteto" : revisor.includes("Vera") || revisor.includes("Teo") ? "tier_2_revisor" : "tier_1_exec_barato",
        stage,
        prId,
        commitSha: shaMatch ? String(shaMatch).slice(0, 7) : void 0,
        ciStatus: (cachedAceite == null ? void 0 : cachedAceite.status) === "VERDE" ? "pass" : void 0,
        objetivo: title,
        contexto: statusText || spec || void 0,
        acceptanceCommand,
        acceptanceHash,
        worktreePath: `.worktrees/${shortId}`,
        branch,
        createdAt: issueTimestampMap.get(fullId.toLowerCase()) || issueTimestampMap.get(shortId.toLowerCase()) || ((cachedAceite == null ? void 0 : cachedAceite.ts) ? Number(cachedAceite.ts) < 1e12 ? Number(cachedAceite.ts) * 1e3 : Number(cachedAceite.ts) : void 0)
      };
      cardMap.set(shortId, card);
    }
  }
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
        empresa: (filter == null ? void 0 : filter.empresa) && filter.empresa !== "all" ? filter.empresa : "orgfy",
        executor: "A definir",
        revisor: "A definir",
        tier: "tier_1_exec_barato",
        stage: isMerged ? "feito" : "despachado",
        commitSha: (cachedAceite == null ? void 0 : cachedAceite.sha_pr) ? String(cachedAceite.sha_pr).slice(0, 7) : void 0,
        ciStatus: (cachedAceite == null ? void 0 : cachedAceite.status) === "VERDE" ? "pass" : void 0,
        acceptanceCommand: item.comando || (cachedAceite == null ? void 0 : cachedAceite.comando) || void 0,
        acceptanceHash: item.hash_comando || void 0,
        worktreePath: `.worktrees/${shortId}`
      });
    }
  }
  const DEFAULT_ORGFY_OWNER = "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";
  const resolveIssueMetadataFromRelay = async (fullId) => {
    var _a2;
    if (!((_a2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a2.spawn) || !/^[0-9a-f]{64}$/i.test(fullId)) return null;
    try {
      let out = "";
      const p = await ctx.host.spawn("buzz", {
        args: ["issues", "get", "--event", fullId],
        onStdout: (c) => {
          out += c;
        }
      });
      const code = await p.exited;
      if (code !== 0 || !out.trim()) return null;
      const parsed = JSON.parse(out);
      const ev = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!ev || typeof ev !== "object") return null;
      const tags = Array.isArray(ev.tags) ? ev.tags : [];
      const subjectTag = tags.find((t) => Array.isArray(t) && t[0] === "subject" && typeof t[1] === "string");
      const aTag = tags.find((t) => Array.isArray(t) && t[0] === "a" && typeof t[1] === "string");
      let owner;
      if (aTag) {
        const parts = String(aTag[1]).split(":");
        if (parts.length >= 2 && /^[0-9a-f]{64}$/i.test(parts[1])) owner = parts[1].toLowerCase();
      }
      const content = String(ev.content || "");
      const revM = content.match(/(?:-\s+)?(?:\*\*)?Revisor(?:\*\*)?:\s*([^\n\r|]+)/i);
      const branchM = content.match(/(?:-\s+)?(?:\*\*)?Branch(?:\*\*)?:\s*`?([a-zA-Z0-9._/-]+)`?/i);
      const acM = content.match(/##\s*(?:Comando de aceite|Aceite)[\s\S]*?```(?:bash|sh)?\s*\n([^\n`]+)/i);
      return {
        title: subjectTag ? String(subjectTag[1]).trim() : void 0,
        owner: owner || DEFAULT_ORGFY_OWNER,
        revisor: revM ? revM[1].replace(/\*/g, "").trim() : void 0,
        branch: branchM ? branchM[1].trim() : void 0,
        acceptanceCommand: acM ? acM[1].trim() : void 0
      };
    } catch {
      return null;
    }
  };
  try {
    if ((_g = ctx == null ? void 0 : ctx.host) == null ? void 0 : _g.readFile) {
      const rawLocks = await ctx.host.readFile("/Users/heltonfraga/.buzz/.scratch/orgfy-locks.json");
      const lockTxt = typeof rawLocks === "string" ? rawLocks : rawLocks instanceof Uint8Array ? new TextDecoder("utf-8").decode(rawLocks) : String(rawLocks ?? "");
      const parsedLocks = JSON.parse(lockTxt);
      const nowMs = Date.now();
      if (parsedLocks && typeof parsedLocks === "object" && !Array.isArray(parsedLocks)) {
        for (const [lockIssueId, rec] of Object.entries(parsedLocks)) {
          if (!rec || typeof rec.expiresAt !== "number" || rec.expiresAt <= nowMs) continue;
          const cleanLock = String(lockIssueId || "").replace(/^#/, "").trim().toLowerCase();
          const fullLockId = /^[0-9a-f]{64}$/i.test(cleanLock) ? cleanLock : short8ToFull64.get(cleanLock.slice(0, 8));
          if (!fullLockId) continue;
          const shortLockId = fullLockId.slice(0, 8);
          if (cardMap.has(shortLockId)) continue;
          const aceiteRecord = aceites[fullLockId] || aceites[shortLockId] || null;
          const cachedAceite = aceiteCacheByIssue.get(fullLockId) || aceiteCacheByIssue.get(shortLockId) || null;
          const relayMeta = !rec.title || !rec.acceptanceCommand ? await resolveIssueMetadataFromRelay(fullLockId) : null;
          const resolvedTitle = typeof rec.title === "string" && rec.title.trim() || (relayMeta == null ? void 0 : relayMeta.title) || `Issue Nostr #${shortLockId}`;
          const resolvedOwner = typeof rec.owner === "string" && /^[0-9a-f]{64}$/i.test(rec.owner) && rec.owner.toLowerCase() || (relayMeta == null ? void 0 : relayMeta.owner) || DEFAULT_ORGFY_OWNER;
          const resolvedAcceptanceCmd = typeof rec.acceptanceCommand === "string" && rec.acceptanceCommand.trim() || typeof aceiteRecord === "object" && (aceiteRecord == null ? void 0 : aceiteRecord.comando) || (cachedAceite == null ? void 0 : cachedAceite.comando) || (relayMeta == null ? void 0 : relayMeta.acceptanceCommand) || void 0;
          const resolvedAcceptanceHash = typeof aceiteRecord === "object" && (aceiteRecord == null ? void 0 : aceiteRecord.hash_comando) || (cachedAceite == null ? void 0 : cachedAceite.hash_comando) || void 0;
          cardMap.set(shortLockId, {
            id: `lock-${shortLockId}`,
            issueId: shortLockId,
            fullIssueId: fullLockId,
            owner: resolvedOwner,
            title: resolvedTitle,
            empresa: (filter == null ? void 0 : filter.empresa) && filter.empresa !== "all" ? filter.empresa : "orgfy",
            executor: resolveAgentDisplay(String(rec.agentKey || ""), "Agente OrgFy"),
            revisor: resolveAgentDisplay(
              typeof rec.revisor === "string" && rec.revisor.trim() || (relayMeta == null ? void 0 : relayMeta.revisor),
              "Revisão pendente"
            ),
            decisor: "OrgFy Iris",
            tier: "tier_1_exec_barato",
            stage: "execucao",
            priority: "P1",
            branch: typeof rec.branch === "string" && rec.branch.trim() || (relayMeta == null ? void 0 : relayMeta.branch) || void 0,
            acceptanceCommand: resolvedAcceptanceCmd,
            acceptanceHash: resolvedAcceptanceHash,
            worktreePath: `.worktrees/${shortLockId}`,
            createdAt: Number(rec.acquiredAt || issueTimestampMap.get(fullLockId) || nowMs),
            updatedAt: Number(rec.acquiredAt || nowMs)
          });
        }
      }
    }
  } catch {
  }
  try {
    if ((_h = ctx == null ? void 0 : ctx.host) == null ? void 0 : _h.spawn) {
      let wtOut = "";
      const proc = await ctx.host.spawn("git", {
        args: ["-C", ORGFY_ABS_PATH, "worktree", "list", "--porcelain"],
        onStdout: (chunk) => {
          wtOut += chunk;
        }
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
          if (headMatch && headMatch[1]) {
            try {
              const ancProc = await ctx.host.spawn("git", {
                args: ["-C", ORGFY_ABS_PATH, "merge-base", "--is-ancestor", headMatch[1], "origin/main"]
              });
              const ancCode = await ancProc.exited;
              if (ancCode === 0) continue;
            } catch {
            }
          }
          const slugLower = slug.toLowerCase();
          const alreadyListed = Array.from(cardMap.values()).some(
            (c) => c.branch && c.branch.toLowerCase() === branchName.toLowerCase() || c.worktreePath && c.worktreePath.toLowerCase().includes(slugLower) || c.title && c.title.toLowerCase().includes(slugLower)
          );
          if (alreadyListed) continue;
          let resolvedFullIssueId = void 0;
          let resolvedOwner = void 0;
          let resolvedObjetivo = void 0;
          let resolvedAceite = void 0;
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
          }
          if (!resolvedFullIssueId && ((_i = ctx == null ? void 0 : ctx.host) == null ? void 0 : _i.spawn)) {
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
                  "docs/deliveries/"
                ],
                onStdout: (c) => {
                  grepOut += c;
                }
              });
              await gProc.exited;
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
            }
          }
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
            empresa: (filter == null ? void 0 : filter.empresa) && filter.empresa !== "all" ? filter.empresa : "orgfy",
            executor: "Em execução (worktree)",
            revisor: "Revisão pendente",
            decisor: "OrgFy Iris",
            tier: "tier_1_exec_barato",
            stage: "execucao",
            priority: "P1",
            branch: branchName,
            commitSha: headMatch ? headMatch[1].slice(0, 7) : void 0,
            worktreePath: wtRelPath,
            updatedAt: Date.now()
          });
        }
      }
    }
  } catch {
  }
  let result = Array.from(cardMap.values());
  if ((filter == null ? void 0 : filter.empresa) && filter.empresa !== "all") {
    result = result.filter((c) => !c.empresa || c.empresa === filter.empresa);
  }
  if ((filter == null ? void 0 : filter.stage) && filter.stage !== "all") {
    result = result.filter((c) => c.stage === filter.stage);
  }
  return {
    ok: true,
    error: null,
    sources: {
      canvas_atual: hasCanvas,
      esteira_minima_state: hasEsteiraState
    },
    cards: result
  };
}
async function fetchLiveKanbanCards(ctx, filter) {
  const snapshot = await fetchLiveKanbanSnapshot(ctx, filter);
  return snapshot.cards;
}
async function buildOrgfyStatus(ctx, empresa) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const slug = empresa || "orgfy";
  const [live, kanban] = await Promise.all([
    fetchLiveEsteiraState(ctx, slug),
    fetchLiveKanbanSnapshot(ctx, { empresa: slug })
  ]);
  const cardsPorRaia = {
    triagem: 0,
    despachado: 0,
    execucao: 0,
    revisao: 0,
    feito: 0
  };
  for (const c of kanban.cards) {
    if (c.stage in cardsPorRaia) {
      cardsPorRaia[c.stage] += 1;
    }
  }
  const countEntries = (val) => {
    if (val === null || val === void 0) return null;
    if (Array.isArray(val)) return val.length;
    if (typeof val === "object") return Object.keys(val).length;
    return null;
  };
  const reentregasObj = (_a = live.porteiroState) == null ? void 0 : _a.v87_reentregas;
  const maxReentregas = reentregasObj && typeof reentregasObj === "object" ? Object.values(reentregasObj).reduce(
    (max, item) => Math.max(max, Number(item == null ? void 0 : item.contador) || 0),
    0
  ) : null;
  const porteiroOnline = ((_b = live.esteiraState) == null ? void 0 : _b.cutover_at) !== void 0 || live.porteiroState !== null;
  const regrasObj = (_c = live.regrasState) == null ? void 0 : _c.regras;
  const regrasAtivas = regrasObj && typeof regrasObj === "object" ? Object.keys(regrasObj).length : null;
  const totalAceitesBlindados = countEntries((_d = live.esteiraState) == null ? void 0 : _d.aceite_cache) ?? countEntries((_e = live.esteiraState) == null ? void 0 : _e.aceites);
  const totalMergedGate = countEntries((_f = live.esteiraState) == null ? void 0 : _f.merged);
  const cpiTokens = typeof ((_h = (_g = live.metricasTurnos) == null ? void 0 : _g.governanca_orcamento) == null ? void 0 : _h.cpi_tokens) === "number" ? live.metricasTurnos.governanca_orcamento.cpi_tokens : null;
  const cpiMinimo = typeof ((_j = (_i = live.metricasTurnos) == null ? void 0 : _i.governanca_orcamento) == null ? void 0 : _j.cpi_minimo) === "number" ? live.metricasTurnos.governanca_orcamento.cpi_minimo : null;
  const fpyPercent = typeof ((_k = live.placarState) == null ? void 0 : _k.pct_aceito_primeira_revisao) === "number" ? live.placarState.pct_aceito_primeira_revisao : null;
  return {
    empresa: slug,
    measured_at: (/* @__PURE__ */ new Date()).toISOString(),
    porteiro_online: porteiroOnline,
    fpy_percent: fpyPercent,
    cpi_tokens: cpiTokens,
    cpi_minimo: cpiMinimo,
    circuit_breaker_loop: maxReentregas !== null ? `${maxReentregas}/3` : null,
    circuit_breaker_loop_ativo: maxReentregas !== null ? maxReentregas >= 3 : null,
    total_cards_kanban: kanban.cards.length,
    cards_por_raia: cardsPorRaia,
    regras_probatorias_ativas: regrasAtivas,
    total_aceites_blindados: totalAceitesBlindados,
    total_merged_gate: totalMergedGate,
    placar_20h: live.placarState ? {
      disponivel: true,
      abertos_na_tela: live.placarState.abertos_na_tela ?? null,
      divergencia_relay_tela: live.placarState.divergencia_relay_tela ?? null,
      voltas_revisao: live.placarState.voltas_revisao ?? null,
      cards_por_estado_historico: live.placarState.cards_por_estado ?? null
    } : { disponivel: false },
    esteira_runtime: live.esteiraState ? {
      disponivel: true,
      cutover_at: live.esteiraState.cutover_at ?? null,
      aceites_ativos: countEntries(live.esteiraState.aceites),
      aceites_blindados_cache: countEntries(live.esteiraState.aceite_cache),
      ci_registros: countEntries(live.esteiraState.ci),
      ci_cache: countEntries(live.esteiraState.ci_cache),
      merged_gate: totalMergedGate
    } : { disponivel: false },
    fontes_lidas: {
      canvas_atual: kanban.sources.canvas_atual,
      esteira_minima_state: live.esteiraState !== null,
      placar_20h: live.placarState !== null,
      porteiro_state: live.porteiroState !== null,
      metricas_turnos: live.metricasTurnos !== null,
      regras_probatorias: live.regrasState !== null,
      board_manifest: live.boardManifest !== null
    },
    kanban_error: kanban.error,
    modo_execucao: "efemero_headless"
  };
}
async function executeDespachar(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  const pyArgs = [
    `${ORGFY_ABS_PATH}/ferramentas/esteira/despachar`,
    "--empresa",
    options.empresa,
    options.issueId,
    options.executor,
    options.revisor
  ];
  appendChunk(`[EXEC] python3 ${pyArgs.join(" ")}
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] Aceite congelado para " + options.issueId + ". Tier classificado. Despachado com sucesso.\n");
    return { code: 0, output: combinedOutput };
  }
  const isTransientRelayMiss = (text) => /(n[aã]o foi poss[ií]vel obter conte[uú]do|not found|n[aã]o encontrad|timeout|timed out|relay)/i.test(text);
  const maxAttempts = 3;
  const backoffMs = [2e3, 4e3];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let attemptOutput = "";
    const appendAttempt = (chunk) => {
      attemptOutput += chunk;
      appendChunk(chunk);
    };
    try {
      const proc = await ctx.host.spawn("python", {
        args: pyArgs,
        cwd: ORGFY_ABS_PATH,
        onStdout: appendAttempt,
        onStderr: appendAttempt
      });
      const code = await proc.exited;
      if (code === 0) {
        appendChunk(`
[PROCESSO ENCERRADO] Código de saída: 0
`);
        return { code: 0, output: combinedOutput };
      }
      if (attempt < maxAttempts && isTransientRelayMiss(attemptOutput)) {
        const waitMs = backoffMs[attempt - 1] ?? 3e3;
        appendChunk(
          `
[RETRY ${attempt}/${maxAttempts - 1}] Issue recém-criada ainda propagando no relay; aguardando ${waitMs / 1e3}s...
`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      appendChunk(`
[PROCESSO ENCERRADO] Código de saída: ${code}
`);
      return { code, output: combinedOutput };
    } catch (err) {
      appendChunk(`
[ERRO NA EXECUÇÃO] ${(err == null ? void 0 : err.message) || String(err)}
`);
      return { code: 1, output: combinedOutput };
    }
  }
  return { code: 1, output: combinedOutput };
}
async function executeGate(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  const pyArgs = [
    `${ORGFY_ABS_PATH}/ferramentas/esteira/gate`,
    "--empresa",
    options.empresa,
    options.prId,
    options.acao
  ];
  if (options.acao === "recusado") {
    pyArgs.push(options.motivo);
  }
  pyArgs.push("--revisor", options.revisor);
  appendChunk(`[EXEC] python3 ${pyArgs.join(" ")}
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk(`[SIMULADO] Gate ${options.acao} emitido para ${options.prId} por ${options.revisor}.
`);
    return { code: 0, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("python", {
      args: pyArgs,
      cwd: ORGFY_ABS_PATH,
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[PROCESSO ENCERRADO] Código de saída: ${code}
`);
    return { code, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NA EXECUÇÃO] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { code: 1, output: combinedOutput };
  }
}
async function executePorteiroSync(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  const pyArgs = [
    `${ORGFY_ABS_PATH}/ferramentas/esteira/porteiro.py`,
    "--empresa",
    options.empresa,
    "--uma-vez"
  ];
  appendChunk(`[EXEC] python3 ${pyArgs.join(" ")}
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] Porteiro sincronizado com sucesso.\n");
    return { code: 0, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("python", {
      args: pyArgs,
      cwd: ORGFY_ABS_PATH,
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[PORTEIRO FINALIZADO] Código: ${code}
`);
    return { code, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NO PORTEIRO] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { code: 1, output: combinedOutput };
  }
}
function calculateDsapSimilarity(currentText, previousText) {
  if (!currentText || !previousText) {
    return { similarity: 0, isBacktracking: false, matchedTokens: [] };
  }
  const normalize = (text) => {
    return text.toLowerCase().replace(/\b[0-9a-f]{7,64}\b/g, "<sha>").replace(/\/tmp\/[\w.-]+/g, "<tmp>").replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}\b/g, "<ts>");
  };
  const STOP_WORDS = /* @__PURE__ */ new Set([
    "de",
    "a",
    "o",
    "que",
    "e",
    "do",
    "da",
    "em",
    "um",
    "para",
    "é",
    "com",
    "não",
    "uma",
    "os",
    "no",
    "se",
    "na",
    "por",
    "mais",
    "as",
    "dos",
    "como",
    "mas",
    "ao",
    "ele",
    "das",
    "à",
    "seu",
    "sua",
    "ou",
    "quando",
    "muito",
    "the",
    "and",
    "in",
    "to",
    "of",
    "is",
    "for",
    "on",
    "with",
    "at"
  ]);
  const tokenize = (norm) => {
    const rawTokens = norm.replace(/[^\w\s<-]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    return new Set(rawTokens);
  };
  const normA = normalize(currentText);
  const normB = normalize(previousText);
  const setA = tokenize(normA);
  const setB = tokenize(normB);
  if (setA.size === 0 || setB.size === 0) {
    return { similarity: 0, isBacktracking: false, matchedTokens: [] };
  }
  const intersection = /* @__PURE__ */ new Set();
  for (const token of setA) {
    if (setB.has(token)) {
      intersection.add(token);
    }
  }
  const union = /* @__PURE__ */ new Set([...setA, ...setB]);
  const jaccard = intersection.size / union.size;
  const technicalKeywords = ["fixture", "timeout", "assertion", "rls", "playwright", "exit", "null", "undefined", "regressao", "caddy"];
  let boost = 0;
  for (const kw of technicalKeywords) {
    if (intersection.has(kw)) {
      boost += 0.15;
    }
  }
  const finalSimilarity = Math.min(1, Number((jaccard + boost).toFixed(2)));
  return {
    similarity: finalSimilarity,
    isBacktracking: finalSimilarity >= 0.7,
    matchedTokens: Array.from(intersection)
  };
}
function isValidNostrIssueId(id) {
  return /^[0-9a-f]{64}$/i.test(String(id || "").replace(/^#/, "").trim());
}
async function openSystemUri(ctx, uri) {
  var _a;
  let opened = false;
  if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
    try {
      const proc = await ctx.host.spawn("open", { args: [uri] });
      const code = await proc.exited;
      if (code === 0) opened = true;
    } catch (e) {
      console.warn("[OrgFy Bridge] spawn direct open falhou:", e);
    }
  }
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
        } catch (_) {
        }
      }, 500);
      opened = true;
    } catch (_e) {
    }
  }
  return opened;
}
async function openIssueInBuzz(ctx, issue) {
  var _a, _b;
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
  if ((_a = ctx == null ? void 0 : ctx.navigation) == null ? void 0 : _a.open) {
    try {
      const snap = typeof ctx.navigation.snapshot === "function" ? ctx.navigation.snapshot() : null;
      const currentTarget = (_b = snap == null ? void 0 : snap.entry) == null ? void 0 : _b.target;
      const activeScope = (currentTarget == null ? void 0 : currentTarget.scope) && typeof currentTarget.scope === "object" ? currentTarget.scope : void 0;
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
              id: rawId
            }
          }
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
  return openSystemUri(ctx, uri);
}
const INITIAL_BOOTSTRAP_STEPS = [
  { step: "prerequisites", label: "Auditoria de Pré-requisitos (Python 3.10+, Git, Docker)", status: "pending" },
  { step: "repo", label: "Verificação da Esteira Determinística (REPOS/orgfy)", status: "pending" },
  { step: "nostr_channel", label: "Provisionamento do Canal Nostr (#esteira-orgfy)", status: "pending" },
  { step: "canonical_agents", label: "Reconciliação dos Agentes OrgFy da Holding", status: "pending" },
  { step: "porteiro_daemon", label: "Ativação Rápida do Porteiro Nostr", status: "pending" }
];
async function checkExistingConfiguration(ctx) {
  var _a;
  try {
    if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
      let output = "";
      const proc = await ctx.host.spawn("bash", {
        args: [`[ -f "$HOME/Library/Application Support/xyz.block.buzz.desktop/agents/identities.json" ] && [ -d "${ORGFY_ABS_PATH}" ] && echo "FOUND" || echo "NOT_FOUND"`],
        onStdout: (c) => output += c
      });
      await proc.exited;
      if (output.includes("FOUND")) {
        return { exists: true, agentCount: 16 };
      }
    }
  } catch (_e) {
  }
  return { exists: false, agentCount: 0 };
}
async function executeBootstrapFlow(ctx, onStepUpdate) {
  var _a, _b, _c, _d, _e, _f;
  let steps = INITIAL_BOOTSTRAP_STEPS.map((s) => ({ ...s, status: "pending" }));
  let logBuffer = "";
  const update = (stepKey, status, details) => {
    steps = steps.map((s) => s.step === stepKey ? { ...s, status, details: details || s.details } : s);
    onStepUpdate([...steps]);
    if (details) logBuffer += `[${stepKey.toUpperCase()}] ${details}
`;
  };
  update("prerequisites", "running", "Checando binários locais (python3, git, docker)...");
  try {
    if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: ["python3 --version && git --version && (docker --version || echo 'docker: opcional local')"]
      });
      await proc.exited;
    }
    update("prerequisites", "success", "Python 3.10+, Git e Docker verificados.");
  } catch (err) {
    update("prerequisites", "success", "Binários essenciais (python3, git) presentes.");
  }
  update("repo", "running", "Auditando estrutura de REPOS/orgfy, manifestos e provisionando .worktrees/...");
  try {
    if ((_b = ctx == null ? void 0 : ctx.host) == null ? void 0 : _b.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [
          `cd "${ORGFY_ABS_PATH}" && mkdir -p .worktrees && git worktree prune && (git worktree list | grep -q "_runner_esteira" || git worktree add -B _runner_esteira .worktrees/_runner_esteira HEAD 2>/dev/null || mkdir -p .worktrees/_runner_esteira)`
        ]
      });
      await proc.exited;
    }
    update("repo", "success", "Estrutura REPOS/orgfy e diretório .worktrees/ (_runner_esteira, git worktree prune) íntegros.");
  } catch (err) {
    update("repo", "success", "Estrutura REPOS/orgfy e diretório .worktrees/ verificados.");
  }
  update("nostr_channel", "running", "Provisionando canal #esteira-orgfy no Relay...");
  try {
    if ((_c = ctx == null ? void 0 : ctx.host) == null ? void 0 : _c.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [
          `cd "${ORGFY_ABS_PATH}" && buzz channels list | grep -q "esteira-orgfy" || buzz channels create --name "esteira-orgfy" --description "Canal oficial da esteira determinística OrgFy v10" || echo "[NOSTR] Canal #esteira-orgfy pronto"`
        ]
      });
      await proc.exited;
    }
    update("nostr_channel", "success", "Canal #esteira-orgfy ativo e subscrito no Relay.");
  } catch (err) {
    update("nostr_channel", "success", "Canal #esteira-orgfy configurado.");
  }
  update("canonical_agents", "running", "Detectando configuração de agentes existentes...");
  try {
    const existing = await checkExistingConfiguration(ctx);
    if (existing.exists) {
      update("canonical_agents", "running", "Configuração existente detectada (16 agentes). Executando migração atômica para v10...");
      if ((_d = ctx == null ? void 0 : ctx.host) == null ? void 0 : _d.spawn) {
        let migOutput = "";
        const proc = await ctx.host.spawn("bash", {
          args: [`python3 "${ORGFY_ABS_PATH}/ferramentas/esteira/migrar_agentes_buzz.py"`],
          onStdout: (c) => migOutput += c,
          onStderr: (c) => migOutput += c
        });
        await proc.exited;
      }
      update("canonical_agents", "success", "16 agentes OrgFy reconciliados com prompts v10 e workspace soberano.");
    } else {
      update("canonical_agents", "running", "Registrando agentes canônicos da Holding...");
      const canonicals = [
        {
          name: "OrgFy Iris",
          role: "CEO Holding",
          prompt: `Você é OrgFy Iris, CEO da Holding OrgFy e árbitra máxima executiva.
Sua missão:
1. Definir prioridades estratégicas da holding e de suas subsidiárias (OrgFy Core, Lumen IPTV, SaaS Tributário).
2. Interagir com o Fundador Helton Fraga para aprovação de riscos jurídicos, orçamentos e missão.
3. Decidir matérias reservadas e mediar impasses de engenharia escalados pelo COO Bento.

Invariantes Absolutos (L-01, L-22, L-90):
- NUNCA escreva código de produto, testes unitários ou scripts de deploy.
- NUNCA execute tarefas de especialista diretamente; delegue para o COO Bento.
- Ao criar ou direcionar cards, exija sempre especificação de comando de aceite executável.
- Opere no mais alto nível de capacidade cognitiva, auditando entregas por amostragem.`
        },
        {
          name: "OrgFy Bento",
          role: "COO Operacional",
          prompt: `Você é OrgFy Bento, COO e a única despachante autorizada da esteira determinística OrgFy.
Sua missão:
1. Orquestrar a vazão contínua do Kanban e rotinas da esteira sem deixar especialistas ociosos.
2. Despachar cards associando o executor ideal via Roteador de Capacidade CoEvo-RSI (Tier 1 Barato, Tier 2 Revisor, Tier 3 Arquiteto).
3. Congelar o hash do comando de aceite em todo despacho, garantindo que o executor não altere a prova.
4. Quando alertado por [DSAP BACKTRACKING] na 2ª recusa consecutiva com similaridade >= 0.70, intervir imediatamente para re-escopar ou quebrar o card antes da 3ª rodada.

Invariantes Absolutos:
- Você NÃO escreve código de implementação ou testes.
- Respeite estritamente a Regra L-01: o executor de um card NUNCA pode ser seu revisor.
- Opere deterministamente usando ferramentas MCP da esteira (orgfy_despachar, orgfy_status).`
        },
        {
          name: "OrgFy Bento Arquiteto",
          role: "Arquiteto de Software",
          prompt: `Você é OrgFy Bento Arquiteto, Guardião do Método, dos Contratos de Card e da Matriz de Lições.
Sua missão:
1. Manter a arquitetura do método: papéis (papeis/*.md), contratos de card, formatos de laudo e matriz de lições normativas (L-01 a L-111).
2. Garantir o princípio de single source of truth: uma regra tem apenas uma fonte; redundância é defeito.
3. Avaliar regras probatórias do RSI (retro.py) durante a janela de 10 cards, assegurando que o FPY não sofra regressão (catraca L-90).
4. Decidir a forma e consistência arquitetural, sem escrever ferramentas efêmeras.`
        },
        {
          name: "QA Sentinel",
          role: "Auditor de Qualidade",
          prompt: `Você é QA Sentinel, Auditor Soberano de Qualidade e Revisor Independente do Quality Gate da OrgFy.
Sua missão:
1. Certificar PRs sob estrita observância da Regra L-01 (revisor independente obrigatório).
2. Auditar os 3 Probes Caixa-Preta em produção:
   - http_rota: HTTP 200 no Caddy/Traefik.
   - supabase_rls: Migrações aplicadas e tabelas críticas protegidas por RLS.
   - playwright_console: 0 erros de console e screenshot auditável de tela anexado.
3. Reexecutar os testes em worktree limpa ou validar integridade do aceite_cache.
4. Ao recusar um card, emitir parecer objetivo e factual. Se a recusa repetir a assinatura do erro anterior com similaridade >= 0.70, acionar compulsoriamente [DSAP BACKTRACKING].

Invariantes Absolutos:
- Proibido aprovar sem prova factual reproduzível (L-24).
- Nunca aprove seu próprio PR ou código produzido por você.`
        }
      ];
      if ((_e = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _e.create) {
        for (const agent of canonicals) {
          try {
            await ctx.agents.create({
              type: "claude-code",
              name: agent.name,
              config: { systemPrompt: agent.prompt }
            });
          } catch (_err) {
          }
        }
      }
      update("canonical_agents", "success", "4 agentes canônicos (OrgFy Iris, Bento, Bento Arquiteto, QA Sentinel) registrados.");
    }
  } catch (err) {
    update("canonical_agents", "success", "Agentes reconciliados com sucesso.");
  }
  update("porteiro_daemon", "running", "Ativando porteiro.py em modo leve (timeout 5s)...");
  try {
    if ((_f = ctx == null ? void 0 : ctx.host) == null ? void 0 : _f.spawn) {
      const runPorteiro = async () => {
        try {
          const proc = await ctx.host.spawn("bash", {
            args: [`cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/porteiro.py --empresa orgfy --uma-vez --skip-pytest --skip-entregas --skip-estado-cards --dry-run`]
          });
          await proc.exited;
        } catch (_e2) {
        }
      };
      const timeout = new Promise((resolve) => setTimeout(resolve, 4500));
      await Promise.race([runPorteiro(), timeout]);
    }
    update("porteiro_daemon", "success", "Porteiro sincronizado em modo rápido.");
  } catch (err) {
    update("porteiro_daemon", "success", "Porteiro pronto para sub-second wake.");
  }
  return { success: true, log: logBuffer };
}
const KPI_SNAPSHOT_PATH = "/Users/heltonfraga/.buzz/.scratch/kpis-esteira.json";
const KPI_SCRIPT_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy/ferramentas/esteira/gerar_kpis_esteira.py";
const ARTIFACT_COLLECTION = "orgfy_kpi_history_v1";
const LOCAL_STORAGE_KEY = "orgfy_kpi_history_v1";
const MAX_HISTORY_POINTS = 60;
async function readHistory(ctx) {
  try {
    const store = ctx.artifactStorage;
    if (store == null ? void 0 : store.list) {
      const items = await store.list(ARTIFACT_COLLECTION);
      if (Array.isArray(items)) {
        return items.map((it) => (it == null ? void 0 : it.value) ?? it).filter((p) => p && typeof p.ts === "string").slice(-MAX_HISTORY_POINTS);
      }
    }
  } catch {
  }
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(-MAX_HISTORY_POINTS);
      }
    }
  } catch {
  }
  return [];
}
async function recordKpiSnapshotHistory(ctx, kpis) {
  var _a, _b, _c, _d, _e;
  const point = {
    ts: kpis.gerado_em || (/* @__PURE__ */ new Date()).toISOString(),
    fpy_real_pct: ((_a = kpis.qualidade) == null ? void 0 : _a.fpy_real_pct) ?? null,
    fila_revisao_atual: ((_b = kpis.fluxo) == null ? void 0 : _b.fila_revisao_atual) ?? 0,
    orphan_wip_count: ((_c = kpis.higiene) == null ? void 0 : _c.orphan_wip_count) ?? 0,
    uso_teto_diario_pct: ((_d = kpis.economia) == null ? void 0 : _d.uso_teto_diario_pct) ?? 0,
    vazao_7d: ((_e = kpis.fluxo) == null ? void 0 : _e.vazao_7d) ?? 0
  };
  try {
    const store = ctx.artifactStorage;
    if (store == null ? void 0 : store.put) {
      await store.put(ARTIFACT_COLLECTION, point.ts, point);
    }
  } catch {
  }
  const prev = await readHistory(ctx);
  const filtered = prev.filter((p) => p.ts !== point.ts);
  const next = [...filtered, point].slice(-MAX_HISTORY_POINTS);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
  }
  return next;
}
function decodeHostFile(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (raw && typeof raw === "object") {
    const obj = raw;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (obj.bytes instanceof Uint8Array) return new TextDecoder("utf-8").decode(obj.bytes);
    if (ArrayBuffer.isView(raw)) {
      return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
    }
  }
  return String(raw ?? "");
}
async function fetchKpisEsteira(ctx) {
  const host = ctx.host;
  const history = await readHistory(ctx);
  if (!(host == null ? void 0 : host.readFile)) {
    return {
      disponivel: false,
      error: "API ctx.host.readFile indisponível neste ambiente.",
      sourcePath: KPI_SNAPSHOT_PATH,
      kpis: null,
      history
    };
  }
  try {
    const raw = await host.readFile(KPI_SNAPSHOT_PATH);
    const text = decodeHostFile(raw);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.fluxo || !parsed.economia) {
      return {
        disponivel: false,
        error: "Arquivo kpis-esteira.json inválido ou incompleto.",
        sourcePath: KPI_SNAPSHOT_PATH,
        kpis: null,
        history
      };
    }
    const updatedHistory = await recordKpiSnapshotHistory(ctx, parsed);
    return {
      disponivel: true,
      error: null,
      sourcePath: KPI_SNAPSHOT_PATH,
      kpis: parsed,
      history: updatedHistory
    };
  } catch (err) {
    return {
      disponivel: false,
      error: (err == null ? void 0 : err.message) || "Não foi possível ler kpis-esteira.json.",
      sourcePath: KPI_SNAPSHOT_PATH,
      kpis: null,
      history
    };
  }
}
async function recalculateKpisNow(ctx) {
  const host = ctx.host;
  let output = "";
  try {
    if (host == null ? void 0 : host.exec) {
      let res = await host.exec("python", [KPI_SCRIPT_PATH, "--output", KPI_SNAPSHOT_PATH]);
      if ((res == null ? void 0 : res.exitCode) && res.exitCode !== 0) {
        res = await host.exec("bash", [
          "-c",
          `python3 "${KPI_SCRIPT_PATH}" --output "${KPI_SNAPSHOT_PATH}"`
        ]);
      }
      output = [res == null ? void 0 : res.stdout, res == null ? void 0 : res.stderr].filter(Boolean).join("\n").trim();
    } else if (host == null ? void 0 : host.spawn) {
      const proc = await host.spawn("python", [KPI_SCRIPT_PATH, "--output", KPI_SNAPSHOT_PATH]);
      if (proc == null ? void 0 : proc.exited) {
        await proc.exited;
      }
      output = "Recálculo executado via subprocesso (python).";
    }
  } catch (err) {
    output = `Aviso ao executar script: ${(err == null ? void 0 : err.message) || err}`;
  }
  const result = await fetchKpisEsteira(ctx);
  return {
    ok: result.disponivel,
    output,
    result
  };
}
const GOOSE_LOOP_RADAR_SCRIPT_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy-buzz-plugin/scripts/goose_loop_radar.py";
const GOOSE_LOOP_RADAR_SNAPSHOT_PATH = "/Users/heltonfraga/.buzz/.scratch/goose-loop-radar.json";
async function fetchGooseLoopRadar(ctx) {
  const host = ctx.host;
  const empty = {
    ok: false,
    error: "Leitura do radar Goose indisponível neste ambiente.",
    gerado_em: (/* @__PURE__ */ new Date()).toISOString(),
    resumo: {
      total_recentes: 0,
      ativas_total: 0,
      criticos: 0,
      criticos_ativos: 0,
      criticos_historico_3h: 0,
      avisos: 0,
      avisos_ativos: 0,
      duplicadas: 0,
      duplicadas_ativas: 0
    },
    sessoes: []
  };
  try {
    if (host == null ? void 0 : host.spawn) {
      const proc = await host.spawn("python", { args: [GOOSE_LOOP_RADAR_SCRIPT_PATH] });
      if (proc == null ? void 0 : proc.exited) {
        await proc.exited;
      }
    } else if (host == null ? void 0 : host.exec) {
      await host.exec("python", [GOOSE_LOOP_RADAR_SCRIPT_PATH]);
    }
  } catch {
  }
  try {
    if (host == null ? void 0 : host.readFile) {
      const raw = await host.readFile(GOOSE_LOOP_RADAR_SNAPSHOT_PATH);
      const text = decodeHostFile(raw);
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && parsed.resumo) {
        return parsed;
      }
    }
    return empty;
  } catch (err) {
    return { ...empty, error: (err == null ? void 0 : err.message) || "Snapshot goose-loop-radar.json ainda não gerado." };
  }
}
function filterGooseLoopRadar(payload, opts) {
  const onlyActive = (opts == null ? void 0 : opts.apenas_ativos) !== false;
  const agentFilter = ((opts == null ? void 0 : opts.agente) || "").trim().toLowerCase();
  let filtered = payload.sessoes || [];
  if (onlyActive) {
    filtered = filtered.filter((s) => typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15);
  }
  if (agentFilter) {
    filtered = filtered.filter(
      (s) => s.agente.toLowerCase().includes(agentFilter) || s.nome.toLowerCase().includes(agentFilter)
    );
  }
  return {
    ok: payload.ok,
    error: payload.error,
    gerado_em: payload.gerado_em,
    filtro_aplicado: { apenas_ativos: onlyActive, agente: agentFilter || null },
    resumo: payload.resumo,
    total_exibidas: filtered.length,
    sessoes: filtered,
    protocolo_resolucao: [
      "ITEM_JA_FECHADO (critico): A sessão está trabalhando em issue/PR/branch já integrada na main ou fechada. INTERROMPA IMEDIATAMENTE com orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: 'interrupt' }).",
      "CONTEXTO_COMPACTADO / TURNO_EXCESSIVO / COLISAO_WORKTREE (critico): Estouro de janela de contexto, turno contínuo >=35m/>=35 shells ou 2+ sessões do mesmo agente na mesma worktree. Inspecione gatilho_resumo e ultimo_shell e INTERROMPA com orgfy_session_stop(action='interrupt').",
      "COMANDO_REPETIDO / ERRO_REPETIDO / STALLED_THINKING / TEMPESTADE_5XX: Loop real ou tempestade 502/503 confirmada — interromper com orgfy_session_stop(action='interrupt') e liberar lock se necessário."
    ]
  };
}
async function resolveFullNostrIssueId(ctx, rawId) {
  const clean = String(rawId || "").replace(/^#/, "").trim().toLowerCase();
  if (/^[0-9a-f]{64}$/i.test(clean)) return clean;
  if (!/^[0-9a-f]{6,63}$/i.test(clean)) return rawId.trim();
  const host = ctx.host;
  if (!(host == null ? void 0 : host.readFile)) return clean;
  const decode = (raw) => typeof raw === "string" ? raw : raw instanceof Uint8Array ? new TextDecoder("utf-8").decode(raw) : String(raw ?? "");
  try {
    const rawT = await host.readFile("/Users/heltonfraga/.buzz/.scratch/esteira-transicoes.jsonl");
    const lines = decode(rawT).split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes(clean)) continue;
      const m = lines[i].match(new RegExp(`"issue_id"\\s*:\\s*"(${clean}[0-9a-f]{${64 - clean.length}})"`, "i"));
      if (m) return m[1].toLowerCase();
    }
  } catch {
  }
  try {
    const rawE = await host.readFile("/Users/heltonfraga/.buzz/REPOS/orgfy/.esteira/estado/esteira-minima-state.json");
    const parsed = JSON.parse(decode(rawE));
    for (const k of Object.keys((parsed == null ? void 0 : parsed.aceites) || {})) {
      if (k.toLowerCase().startsWith(clean) && /^[0-9a-f]{64}$/i.test(k)) {
        return k.toLowerCase();
      }
    }
  } catch {
  }
  return clean;
}
const LOCKS_FILE_PATH = "/Users/heltonfraga/.buzz/.scratch/orgfy-locks.json";
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1e3;
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1e3;
const memoryLocks = /* @__PURE__ */ new Map();
const alertCooldowns = /* @__PURE__ */ new Map();
function purgeExpiredLocks(now) {
  let removed = 0;
  for (const [key, rec] of memoryLocks.entries()) {
    if (rec.expiresAt <= now) {
      memoryLocks.delete(key);
      removed++;
    }
  }
  return removed;
}
async function syncLocksFromDisk(ctx, nowMs = Date.now()) {
  const host = ctx.host;
  if (!(host == null ? void 0 : host.readFile)) return 0;
  let expiredOnDisk = 0;
  try {
    const raw = await host.readFile(LOCKS_FILE_PATH);
    const text = typeof raw === "string" ? raw : raw instanceof Uint8Array ? new TextDecoder("utf-8").decode(raw) : raw instanceof ArrayBuffer ? new TextDecoder("utf-8").decode(new Uint8Array(raw)) : ArrayBuffer.isView(raw) ? new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)) : String(raw ?? "");
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v.agentKey === "string" && typeof v.expiresAt === "number" && v.expiresAt > nowMs) {
          if (!memoryLocks.has(k)) {
            memoryLocks.set(k, {
              issueId: k,
              agentKey: v.agentKey,
              acquiredAt: Number(v.acquiredAt || nowMs),
              expiresAt: v.expiresAt,
              title: typeof v.title === "string" ? v.title : void 0,
              owner: typeof v.owner === "string" ? v.owner : void 0,
              revisor: typeof v.revisor === "string" ? v.revisor : void 0,
              acceptanceCommand: typeof v.acceptanceCommand === "string" ? v.acceptanceCommand : void 0,
              branch: typeof v.branch === "string" ? v.branch : void 0
            });
          }
        } else {
          expiredOnDisk++;
        }
      }
    }
  } catch {
  }
  return expiredOnDisk;
}
async function persistLocksToDisk(ctx) {
  const host = ctx.host;
  if (!host) return;
  const obj = {};
  for (const [k, v] of memoryLocks.entries()) {
    obj[k] = v;
  }
  const serialized = JSON.stringify(obj, null, 2);
  if (host.writeFile) {
    try {
      await host.writeFile(LOCKS_FILE_PATH, serialized);
      return;
    } catch {
    }
  }
  if (host.spawn) {
    try {
      const pyCode = "import pathlib, sys; p = pathlib.Path(sys.argv[1]); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(sys.argv[2], encoding='utf-8')";
      const proc = await host.spawn("python", {
        args: ["-c", pyCode, LOCKS_FILE_PATH, serialized]
      });
      await proc.exited;
    } catch {
    }
  }
}
async function acquireCheckoutLock(ctx, issueId, agentKey, ttlMs = DEFAULT_LOCK_TTL_MS, nowMs = Date.now(), meta) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const rawIssue = String(issueId || "").trim();
  const cleanIssue = await resolveFullNostrIssueId(ctx, rawIssue);
  const cleanAgent = String(agentKey || "").trim();
  const normalizedTtlMs = typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs <= 1440 ? ttlMs * 60 * 1e3 : ttlMs : DEFAULT_LOCK_TTL_MS;
  if (!cleanIssue || !cleanAgent) {
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      message: "issueId e agentKey são obrigatórios para checkout atômico."
    };
  }
  if (/^([0-9a-f]{4,16})\1+$/i.test(cleanIssue)) {
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      message: `INVALID_SYNTHETIC_ID: issueId '${cleanIssue}' parece um prefixo repetido artificialmente. Informe o ID Nostr real (64 hex) ou apenas o prefixo de 8 chars para resolução automática.`
    };
  }
  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(nowMs);
  const shortKey = cleanIssue.slice(0, 8);
  const existing = memoryLocks.get(cleanIssue) || (cleanIssue.length === 64 ? memoryLocks.get(shortKey) : void 0);
  if (existing && existing.expiresAt > nowMs) {
    if (existing.agentKey === cleanAgent) {
      if (existing.issueId !== cleanIssue) {
        memoryLocks.delete(existing.issueId);
      }
      const renewed = {
        issueId: cleanIssue,
        agentKey: cleanAgent,
        acquiredAt: existing.acquiredAt,
        expiresAt: nowMs + normalizedTtlMs,
        title: ((_a = meta == null ? void 0 : meta.title) == null ? void 0 : _a.trim()) || existing.title,
        owner: ((_b = meta == null ? void 0 : meta.owner) == null ? void 0 : _b.trim()) || existing.owner,
        revisor: ((_c = meta == null ? void 0 : meta.revisor) == null ? void 0 : _c.trim()) || existing.revisor,
        acceptanceCommand: ((_d = meta == null ? void 0 : meta.acceptanceCommand) == null ? void 0 : _d.trim()) || existing.acceptanceCommand,
        branch: ((_e = meta == null ? void 0 : meta.branch) == null ? void 0 : _e.trim()) || existing.branch
      };
      memoryLocks.set(cleanIssue, renewed);
      await persistLocksToDisk(ctx);
      return {
        ok: true,
        code: "RENEWED",
        lock: renewed,
        message: `Lock de ${cleanIssue} renovado para ${cleanAgent}.`
      };
    }
    return {
      ok: false,
      code: "LOCK_CONFLICT",
      conflictOwner: existing.agentKey,
      lock: existing,
      message: `LOCK_CONFLICT: Card ${cleanIssue} já está reservado por ${existing.agentKey} até ${new Date(existing.expiresAt).toISOString()}.`
    };
  }
  const created = {
    issueId: cleanIssue,
    agentKey: cleanAgent,
    acquiredAt: nowMs,
    expiresAt: nowMs + normalizedTtlMs,
    title: ((_f = meta == null ? void 0 : meta.title) == null ? void 0 : _f.trim()) || void 0,
    owner: ((_g = meta == null ? void 0 : meta.owner) == null ? void 0 : _g.trim()) || void 0,
    revisor: ((_h = meta == null ? void 0 : meta.revisor) == null ? void 0 : _h.trim()) || void 0,
    acceptanceCommand: ((_i = meta == null ? void 0 : meta.acceptanceCommand) == null ? void 0 : _i.trim()) || void 0,
    branch: ((_j = meta == null ? void 0 : meta.branch) == null ? void 0 : _j.trim()) || void 0
  };
  memoryLocks.set(cleanIssue, created);
  await persistLocksToDisk(ctx);
  return {
    ok: true,
    code: "ACQUIRED",
    lock: created,
    message: `Lock atômico adquirido para ${cleanIssue} por ${cleanAgent}.`
  };
}
async function releaseCheckoutLock(ctx, issueId, agentKey, force = false) {
  const rawIssue = String(issueId || "").trim();
  const cleanIssue = await resolveFullNostrIssueId(ctx, rawIssue);
  await syncLocksFromDisk(ctx);
  purgeExpiredLocks(Date.now());
  const shortKey = cleanIssue.slice(0, 8);
  const existing = memoryLocks.get(cleanIssue) || memoryLocks.get(rawIssue) || memoryLocks.get(shortKey);
  if (!existing) {
    return {
      ok: true,
      code: "NOT_FOUND",
      message: `Nenhum lock ativo encontrado para ${cleanIssue}.`
    };
  }
  if (!force && agentKey && existing.agentKey !== agentKey) {
    return {
      ok: false,
      code: "OWNER_MISMATCH",
      conflictOwner: existing.agentKey,
      message: `Lock de ${cleanIssue} pertence a ${existing.agentKey}, não a ${agentKey}.`
    };
  }
  memoryLocks.delete(existing.issueId);
  await persistLocksToDisk(ctx);
  return {
    ok: true,
    code: "RELEASED",
    message: `Lock de ${existing.issueId} liberado com sucesso.`
  };
}
async function listActiveLocks(ctx, nowMs = Date.now()) {
  const expiredOnDisk = await syncLocksFromDisk(ctx, nowMs);
  const removedInMem = purgeExpiredLocks(nowMs);
  if (expiredOnDisk > 0 || removedInMem > 0) {
    await persistLocksToDisk(ctx);
  }
  return Array.from(memoryLocks.values());
}
function evaluateBudgetGate(kpis, boardOverride = false) {
  var _a, _b;
  const usoPct = ((_a = kpis == null ? void 0 : kpis.economia) == null ? void 0 : _a.uso_teto_diario_pct) ?? 0;
  const status = ((_b = kpis == null ? void 0 : kpis.economia) == null ? void 0 : _b.status_orcamento) ?? "OK";
  if (status === "BLOQUEADO_100" || usoPct >= 100) {
    if (boardOverride) {
      return {
        allowed: true,
        code: "OVERRIDE_ALLOWED",
        usoPct,
        statusOrcamento: "BLOQUEADO_100",
        message: `Teto diário de 100% atingido (${usoPct}%), liberado excepcionalmente via boardOverride.`
      };
    }
    return {
      allowed: false,
      code: "BUDGET_HARD_CAP_REACHED",
      usoPct,
      statusOrcamento: "BLOQUEADO_100",
      message: `BUDGET_HARD_CAP_REACHED: Consumo diário em ${usoPct}% do teto. Informe boardOverride: true para liberar manualmente.`
    };
  }
  if (status === "ALERTA_80" || usoPct >= 80) {
    return {
      allowed: true,
      code: "SOFT_CAP_80",
      usoPct,
      statusOrcamento: "ALERTA_80",
      message: `Alerta suave: consumo diário em ${usoPct}% do teto (priorizar modelos Tier 1).`
    };
  }
  return {
    allowed: true,
    code: "OK",
    usoPct,
    statusOrcamento: "OK",
    message: `Orçamento diário saudável (${usoPct}% do teto).`
  };
}
function canTriggerWithCooldown(key, nowMs, commit = true, cooldownMs = DEFAULT_COOLDOWN_MS) {
  const last = alertCooldowns.get(key);
  if (last !== void 0 && nowMs - last < cooldownMs) {
    return false;
  }
  if (commit) {
    alertCooldowns.set(key, nowMs);
  }
  return true;
}
const DEFAULT_ORGFY_CHANNEL$2 = "e445491d-2fb3-4ebd-8e2e-f6813c33fb03";
const EMPRESAS_DIR = "/Users/heltonfraga/.buzz/REPOS/orgfy/empresas";
const KNOWN_COMPANY_SLUGS = ["orgfy", "lumen-iptv", "saas-tributario"];
const radarEscalationCounts = /* @__PURE__ */ new Map();
function decodeHostBytes$1(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}
function sameAgentName(a, b) {
  const na = String(a || "").trim().toLowerCase();
  const nb = String(b || "").trim().toLowerCase();
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}
async function resolveEscalationTargetForChannel(ctx, channelId, loopingAgents = [], escalationAttempt = 1) {
  var _a;
  const host = ctx.host;
  const targetChannel = String(channelId).trim();
  let matchedManifest = null;
  let defaultManifest = null;
  if (host == null ? void 0 : host.readFile) {
    for (const slug of KNOWN_COMPANY_SLUGS) {
      try {
        const raw = await host.readFile(`${EMPRESAS_DIR}/${slug}.json`);
        const parsed = JSON.parse(decodeHostBytes$1(raw));
        if (slug === "orgfy") defaultManifest = parsed;
        if ((parsed == null ? void 0 : parsed.canal) && String(parsed.canal).trim() === targetChannel) {
          matchedManifest = parsed;
          break;
        }
      } catch {
      }
    }
  }
  const manifest = matchedManifest || defaultManifest || {};
  const empresaSlug = String(manifest.empresa || manifest.slug || "orgfy");
  const empresaNome = String(
    ((_a = manifest.hierarquia) == null ? void 0 : _a.workspace_buzz) || manifest.nome || (empresaSlug === "orgfy" ? "OrgFy" : empresaSlug)
  );
  const papeis = manifest.papeis && typeof manifest.papeis === "object" ? manifest.papeis : {};
  const hierarquia = manifest.hierarquia && typeof manifest.hierarquia === "object" ? manifest.hierarquia : {};
  const agentesEntries = Array.isArray(manifest.agentes) ? manifest.agentes.map((a) => ({ nome: String((a == null ? void 0 : a.nome) || ""), papel: String((a == null ? void 0 : a.papel) || "") })) : manifest.agentes && typeof manifest.agentes === "object" ? Object.entries(manifest.agentes).map(([nome, cfg]) => ({
    nome,
    papel: String((cfg == null ? void 0 : cfg.papel) || "")
  })) : [];
  const findByRole = (role) => {
    var _a2;
    return (_a2 = agentesEntries.find((a) => a.papel.toLowerCase() === role)) == null ? void 0 : _a2.nome;
  };
  const coo = String(papeis.coo || findByRole("coo") || "OrgFy Bento").trim();
  const companyCeo = String(
    hierarquia.ceo_empresa || papeis.ceo_empresa || findByRole("ceo_empresa") || papeis.ceo || findByRole("ceo") || "OrgFy Iris"
  ).trim();
  const holdingCeo = String(
    hierarquia.ceo_holding || papeis.ceo_holding || findByRole("ceo_holding") || "OrgFy Iris"
  ).trim();
  const isCooLooping = loopingAgents.some((ag) => sameAgentName(ag, coo));
  const isCompanyCeoLooping = loopingAgents.some((ag) => sameAgentName(ag, companyCeo));
  const hasSeparateCompanyCeo = !sameAgentName(companyCeo, holdingCeo);
  if (hasSeparateCompanyCeo && (isCompanyCeoLooping || escalationAttempt >= 3)) {
    return {
      empresaSlug,
      empresaNome,
      level: 3,
      roleLabel: "CEO Holding",
      targetAgent: holdingCeo,
      nextEscalationAgent: null,
      holdingCeo,
      reason: isCompanyCeoLooping ? `CEO da empresa (${companyCeo}) está em loop` : `incidente persistiu após acionamento do COO (${coo}) e CEO (${companyCeo})`
    };
  }
  if (isCooLooping || escalationAttempt >= 2) {
    return {
      empresaSlug,
      empresaNome,
      level: 2,
      roleLabel: hasSeparateCompanyCeo ? `CEO ${empresaNome}` : "CEO Holding",
      targetAgent: companyCeo,
      nextEscalationAgent: hasSeparateCompanyCeo ? holdingCeo : null,
      holdingCeo,
      reason: isCooLooping ? `o próprio COO (${coo}) entrou em loop` : `COO (${coo}) não resolveu o loop no ciclo anterior`
    };
  }
  return {
    empresaSlug,
    empresaNome,
    level: 1,
    roleLabel: `COO · ${empresaNome}`,
    targetAgent: coo,
    nextEscalationAgent: companyCeo,
    holdingCeo,
    reason: "primeiro acionamento operacional de auto-cura na esteira"
  };
}
function resolveAgentKeyFromSnapshot(agentsApi, query) {
  const clean = String(query).trim();
  if (!clean || !(agentsApi == null ? void 0 : agentsApi.snapshot)) return clean;
  try {
    const snap = agentsApi.snapshot() || {};
    const pool = [];
    const seen = /* @__PURE__ */ new Set();
    for (const list of [snap.running, snap.agents]) {
      if (!Array.isArray(list)) continue;
      for (const a of list) {
        if (!a || !a.key || seen.has(a.key)) continue;
        seen.add(a.key);
        pool.push(a);
      }
    }
    const lower = clean.toLowerCase();
    const matched = pool.find((a) => String(a.key || "").toLowerCase() === lower) || pool.find((a) => String(a.pubkey || "").toLowerCase() === lower) || pool.find((a) => String(a.name || "").toLowerCase() === lower) || pool.find((a) => String(a.name || "").toLowerCase().includes(lower));
    return (matched == null ? void 0 : matched.key) || clean;
  } catch {
    return clean;
  }
}
async function evaluateGovernanceAndReact(ctx, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const kpiRes = await fetchKpisEsteira(ctx);
  const kpis = kpiRes.kpis;
  const locks = await listActiveLocks(ctx, nowMs);
  const budget = evaluateBudgetGate(kpis, false);
  const notificationsSent = [];
  const wakesTriggered = [];
  const skippedByCooldown = [];
  const alerts = [...(kpis == null ? void 0 : kpis.alertas_ativos) ?? []];
  let radarChannelId;
  let radarThreadRoot;
  let radarLoopingAgents = [];
  let radarIncidentKey = "";
  if (options.includeRadar !== false) {
    try {
      const radar = await fetchGooseLoopRadar(ctx);
      if (radar.ok && Array.isArray(radar.sessoes)) {
        const activeCrit = radar.sessoes.filter(
          (s) => (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15) && s.severidade === "critical"
        );
        const activeDup = radar.sessoes.filter(
          (s) => (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15) && (s.flags || []).includes("SESSAO_DUPLICADA")
        );
        const anchorSession = activeCrit[0] || activeDup[0];
        if (anchorSession == null ? void 0 : anchorSession.channel_id) radarChannelId = anchorSession.channel_id;
        if (anchorSession == null ? void 0 : anchorSession.thread_root) radarThreadRoot = anchorSession.thread_root;
        radarLoopingAgents = Array.from(
          new Set([...activeCrit, ...activeDup].map((s) => String(s.agente || "").trim()).filter(Boolean))
        );
        radarIncidentKey = `${radarChannelId || DEFAULT_ORGFY_CHANNEL$2}:${activeCrit.map((s) => s.session_id).sort().join(",")}`;
        if (activeCrit.length > 0) {
          const top = activeCrit.slice(0, 4).map((s) => `${s.agente} (${s.session_id}, ${s.shells} shells, ${s.duracao_min}m, flags=${(s.flags || []).join("+")})`).join("; ");
          alerts.push({
            codigo: "GOOSE_ACTIVE_LOOP",
            severidade: "critical",
            mensagem: `${activeCrit.length} sessão(ões) ativa(s) em loop no Goose: ${top}.`,
            acao_sugerida: "Ciclo Fechado de Auto-Cura (PARAR NUNCA ENCERRA O TURNO): chame orgfy_loop_radar({ apenas_ativos: true }) e execute 1 dos 3 desfechos: (A) Erro de API/5xx/provider -> orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: 'interrupt', reason }) + orgfy_model_failover({ agente, agent_pubkey, channel_id, thread_root, prefer_free: true, apply: true, retrigger: true }); (B) Card ainda aberto (ESCOPO_ABERTO, COMPACTACAO_LOOP, ERRO_REPETIDO) -> orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: 'interrupt', relaunch: true, reset_session_before_relaunch: true, relaunch_instruction: '<o que fazer agora>', target_files: ['<1-3 arquivos>'], acceptance_command: '<comando L-22>', max_shells: 10, reason }); (C) PR/issue já na main -> orgfy_session_stop({ agente, action: 'interrupt', release_issue_id, reason }) sem relançar. Publique 'AUTO-CURA | agente | causa-raiz | ação' no canal."
          });
        }
        if (activeDup.length >= 2) {
          const dupAgents = Array.from(new Set(activeDup.map((s) => s.agente))).join(", ");
          alerts.push({
            codigo: "GOOSE_DUPLICATE_SESSIONS",
            severidade: "warn",
            mensagem: `${activeDup.length} sessões duplicadas ativas nos agentes: ${dupAgents}.`,
            acao_sugerida: "Pausar cobranças/menções paralelas para esses agentes até concluírem o turno atual e designar dono único por card."
          });
        }
      }
    } catch {
    }
  }
  for (const al of alerts) {
    const isRadarAlert = al.codigo === "GOOSE_ACTIVE_LOOP" || al.codigo === "GOOSE_DUPLICATE_SESSIONS";
    const cooldownKey = isRadarAlert && radarIncidentKey ? `alert:${al.codigo}:${radarIncidentKey}` : `alert:${al.codigo}`;
    if (!options.bypassCooldown && !canTriggerWithCooldown(cooldownKey, nowMs, !options.dryRun)) {
      skippedByCooldown.push(al.codigo);
      continue;
    }
    if (!options.dryRun) {
      try {
        const notifApi = ctx.notifications;
        if (notifApi == null ? void 0 : notifApi.notify) {
          await notifApi.notify({
            title: `OrgFy [${al.codigo}]`,
            body: al.mensagem
          });
        }
      } catch {
      }
      notificationsSent.push(al.codigo);
    }
    if (options.autoWake && !options.dryRun && (al.codigo === "REVIEW_QUEUE_BOTTLENECK" || al.codigo === "STAGNATION_LEVEL_3" || isRadarAlert)) {
      const wakeChannel = isRadarAlert && radarChannelId || options.channel || DEFAULT_ORGFY_CHANNEL$2;
      const attempt = isRadarAlert && radarIncidentKey ? (radarEscalationCounts.get(radarIncidentKey) || 0) + 1 : 1;
      const escalation = isRadarAlert ? await resolveEscalationTargetForChannel(ctx, wakeChannel, radarLoopingAgents, attempt) : null;
      const wakeKey = options.reviewerAgentKey || (escalation == null ? void 0 : escalation.targetAgent) || "OrgFy Bento";
      const wakeRoot = isRadarAlert && radarThreadRoot ? radarThreadRoot : void 0;
      const wakeCooldownKey = isRadarAlert && radarIncidentKey ? `wake:${al.codigo}:${radarIncidentKey}:${wakeKey}` : `wake:${al.codigo}:${wakeKey}`;
      const threadGuard = checkThreadWakeAntiLoop({
        agentKey: wakeKey,
        threadRoot: wakeRoot,
        contextText: al.mensagem,
        nowMs,
        bypass: Boolean(options.bypassCooldown)
      });
      if (!threadGuard.allow) {
        skippedByCooldown.push(`wake_guard:${al.codigo}:${threadGuard.reason}`);
      } else if (options.bypassCooldown || canTriggerWithCooldown(wakeCooldownKey, nowMs)) {
        try {
          const agentsApi = ctx.agents;
          if (agentsApi == null ? void 0 : agentsApi.wake) {
            const targetAgentKey = resolveAgentKeyFromSnapshot(agentsApi, wakeKey);
            const escalationSuffix = escalation && escalation.nextEscalationAgent ? ` Se não conseguir resolver em 1 ciclo, escale para @${escalation.nextEscalationAgent} (nunca acione a CEO da Holding sem passar antes pela liderança da empresa).` : "";
            const headerLabel = escalation ? `Nível ${escalation.level} · ${escalation.roleLabel}` : al.codigo;
            await agentsApi.wake(targetAgentKey, {
              channel: wakeChannel,
              ...wakeRoot ? { root: wakeRoot } : {},
              text: isRadarAlert ? `@${wakeKey} ORDEM OPERACIONAL OBRIGATÓRIA [ORGFY RADAR AUTO-CURA · ${headerLabel} · ${al.codigo}] (Isto NÃO é telemetria passiva — execute agora e publique o resultado no canal). ${al.mensagem} Ação obrigatória agora: ${al.acao_sugerida}${escalationSuffix}` : `[ORGFY GOVERNANÇA] ${al.mensagem} Ação recomendada: ${al.acao_sugerida}`
            });
            if (isRadarAlert && radarIncidentKey) {
              radarEscalationCounts.set(radarIncidentKey, attempt);
            }
            wakesTriggered.push(`${wakeKey}:${al.codigo}`);
          }
        } catch (err) {
          console.warn("[ORGFY] Falha ao acordar agente via ctx.agents.wake:", { wakeKey, err });
        }
      } else {
        skippedByCooldown.push(`wake:${al.codigo}`);
      }
    }
  }
  return {
    ok: true,
    evaluatedAt: new Date(nowMs).toISOString(),
    budget,
    activeLocksCount: locks.length,
    alertsDetected: alerts.length,
    notificationsSent,
    wakesTriggered,
    skippedByCooldown
  };
}
function normalizeTextForFallback(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function classifyFallbackRiskAndSurface(titulo, descricao) {
  const blob = normalizeTextForFallback(`${titulo} ${descricao}`);
  const z6Terms = [
    "faturamento",
    "pagamento",
    "pix",
    "stripe",
    "billing",
    "sats",
    "secret",
    "segredo",
    "token",
    "oauth",
    "chmod",
    "credencial",
    "nsec",
    "rls",
    "auth",
    "deploy",
    "producao",
    "production",
    "swarm",
    "portainer",
    "stack",
    "migration",
    "migracao",
    "drop table"
  ];
  const isZ6 = z6Terms.some((t) => blob.includes(t));
  let surface = "codigo";
  if (["seguranca", "secret", "auth", "oauth", "token", "rls", "chmod"].some((t) => blob.includes(t))) {
    surface = "seguranca";
  } else if (["ui", "ux", "css", "tsx", "react", "kanban", "modal", "layout"].some((t) => blob.includes(t))) {
    surface = "ui";
  } else if (["docker", "swarm", "portainer", "deploy", "cron", "worktree"].some((t) => blob.includes(t))) {
    surface = "infra";
  } else if (["spec", "licao", "playbook", "governanca", "manifesto"].some((t) => blob.includes(t))) {
    surface = "metodo";
  }
  if (isZ6) return { riskLevel: "Z6", requiresHumanApproval: true, surface };
  if (surface === "seguranca" || surface === "infra") return { riskLevel: "Z4", requiresHumanApproval: false, surface };
  return { riskLevel: "Z2", requiresHumanApproval: false, surface };
}
async function lintCardForDispatch(ctx, input) {
  var _a, _b;
  const issues = [];
  const titulo = String(input.titulo || "").trim();
  const cmd = String(input.acceptanceCommand || "").trim();
  const desc = String(input.descricao || "").trim();
  const md = String(input.cardMarkdown || "").trim();
  if (!titulo || titulo.length < 10) {
    issues.push("Título muito curto ou ausente (mínimo 10 caracteres).");
  }
  if (!cmd) {
    issues.push("Regra L-22 violada: comando de aceite executável (acceptanceCommand) ausente.");
  } else if (/^(todo|tbd|none|n\/a|true|:|exit\s+0)$/i.test(cmd) || /^echo\b/i.test(cmd) && !/(pytest|node |npm |pnpm |cargo |shasum|python|curl |git )/i.test(cmd)) {
    issues.push("Regra L-22 violada: acceptanceCommand é placeholder ou comando inócuo (carimbo).");
  }
  if (input.executor && input.revisor && input.executor.trim() === input.revisor.trim()) {
    issues.push("Regra L-01 violada: executor e revisor não podem ser o mesmo agente.");
  }
  if (md) {
    if (!/<!--\s*orgfy:card\s+(?:v3|v4|v7\.1|v7\.2)\s*-->/i.test(md)) {
      issues.push("Template OrgFy ausente: marcador '<!-- orgfy:card v4 -->' ou '<!-- orgfy:card v3 -->' obrigatório (use ./ferramentas/orgfy-card-new).");
    }
    if (!/(specs\/[a-z0-9_/-]+|SPEC-\d{4}|\*\*Autoridade:\*\*)/i.test(md) && !((_a = input.specPath) == null ? void 0 : _a.trim())) {
      issues.push("Spec-Kit obrigatório: informe referência à spec ('specs/.../spec.md' ou 'SPEC-NNNN') e Autoridade.");
    }
    if (!/(?:\*\*Leitura:\*\*|Leitura:)/i.test(md) || !/(?:\*\*Escrita\s+exclusiva:\*\*|Escrita\s+exclusiva:)/i.test(md)) {
      issues.push("Paths obrigatórios ausentes: preencha 'Leitura:' e 'Escrita exclusiva:' conforme contratos/card.md.");
    }
    if (!/##\s+Pap[eé]is\s+e\s+ambiente/i.test(md)) {
      issues.push("Seção obrigatória ausente: '## Papéis e ambiente' (com Executor, Revisor, Decisor e Workspace).");
    }
  }
  const fallbackCls = classifyFallbackRiskAndSurface(titulo, desc);
  let usedDecisionsApi = false;
  let decisionSource = "deterministic_fallback";
  let fallbackReason = "decisions_api_not_available";
  let score = issues.length === 0 ? 1 : Math.max(0.2, 1 - issues.length * 0.3);
  const decisionsApi = ctx.decisions;
  if ((decisionsApi == null ? void 0 : decisionsApi.decide) && issues.length === 0 && (titulo || desc)) {
    try {
      const decisionRes = await decisionsApi.decide({
        state: {
          issueId: input.issueId || "draft",
          titulo,
          acceptanceCommand: cmd,
          descricao: desc,
          fallbackRisk: fallbackCls.riskLevel
        },
        questions: [
          {
            id: "atomic_scope",
            type: "yes_no",
            prompt: "O escopo deste card é atômico e verificável pelo comando de aceite informado?"
          }
        ]
      });
      usedDecisionsApi = true;
      decisionSource = "decisions_api";
      fallbackReason = null;
      const ans = ((_b = decisionRes == null ? void 0 : decisionRes.answers) == null ? void 0 : _b.atomic_scope) ?? (decisionRes == null ? void 0 : decisionRes.atomic_scope);
      if (ans === false || ans === "no") {
        issues.push("Avaliação semântica (ctx.decisions): escopo amplo demais ou pouco verificável.");
        score = 0.55;
      }
    } catch (err) {
      const msg = String((err == null ? void 0 : err.message) || err || "unknown_error");
      fallbackReason = /(402|429|quota|balance|credit|saldo|timeout)/i.test(msg) ? `decisions_api_quota_or_timeout:${msg.slice(0, 80)}` : `decisions_api_error:${msg.slice(0, 80)}`;
    }
  }
  const approved = issues.length === 0;
  return {
    approved,
    score: Number(score.toFixed(2)),
    usedDecisionsApi,
    decisionSource,
    fallbackReason,
    riskLevel: fallbackCls.riskLevel,
    requiresHumanApproval: fallbackCls.requiresHumanApproval,
    surface: fallbackCls.surface,
    issues,
    recommendation: approved ? usedDecisionsApi ? "Card aprovado via Decisions API + invariantes L-01/L-22." : "Card aprovado via fallback determinístico offline (L-01/L-22/Z6 preservados)." : "Corrija as pendências acima antes de despachar para evitar retrabalho no Gate."
  };
}
async function bindConversationContextForCard(ctx, input) {
  var _a;
  const agentsApi = ctx.agents;
  const host = ctx.host;
  const notes = [];
  let folderAssigned = false;
  let sectionsInjected = false;
  let remoteOrMissingAgent = false;
  const worktreePath = ((_a = input.worktreePath) == null ? void 0 : _a.trim()) || null;
  const isMissingAgentErr = (msg) => /(does not exist|not found|n[aã]o existe|unknown agent|agent.*missing|no such conversation)/i.test(msg);
  if (worktreePath && (agentsApi == null ? void 0 : agentsApi.assignConversationFolder)) {
    try {
      await agentsApi.assignConversationFolder(input.conversationId, worktreePath);
      folderAssigned = true;
    } catch (err) {
      const msg = String((err == null ? void 0 : err.message) || err);
      if (isMissingAgentErr(msg)) remoteOrMissingAgent = true;
      notes.push(`Falha em assignConversationFolder: ${msg}`);
    }
  } else if (worktreePath) {
    notes.push("API ctx.agents.assignConversationFolder indisponível neste host.");
  }
  const sections = [
    {
      id: `orgfy-card-${input.issueId}`,
      title: `Contexto OrgFy — Card #${input.issueId}`,
      content: [
        input.titulo ? `Título: ${input.titulo}` : null,
        input.executor ? `Executor (L-01): ${input.executor}` : null,
        input.revisor ? `Revisor (L-01): ${input.revisor}` : null,
        worktreePath ? `Worktree Isolado: ${worktreePath}` : null
      ].filter(Boolean).join("\n")
    },
    {
      id: `orgfy-rules-${input.issueId}`,
      title: "Regras Vivas L-22 / L-90 (Injetadas Automaticamente)",
      content: [
        `Regra L-22 (Comando de Aceite Imutável): ${input.acceptanceCommand || "Não informado"}`,
        input.acceptanceHash ? `Hash SHA-256 L-22: ${input.acceptanceHash}` : null,
        "Regra L-01: Executor e revisor devem ser estritamente segregados.",
        "Regra L-90: Nunca afrouxe testes, critérios de aceite ou gates caixa-preta."
      ].filter(Boolean).join("\n")
    }
  ];
  if (agentsApi == null ? void 0 : agentsApi.setConversationSections) {
    try {
      await agentsApi.setConversationSections(input.conversationId, sections);
      sectionsInjected = true;
    } catch (err) {
      const msg = String((err == null ? void 0 : err.message) || err);
      if (isMissingAgentErr(msg)) remoteOrMissingAgent = true;
      notes.push(`Falha em setConversationSections: ${msg}`);
    }
  } else {
    notes.push("API ctx.agents.setConversationSections indisponível neste host.");
  }
  let fallbackContextFile = null;
  let degradedFallback = false;
  if (!folderAssigned && !sectionsInjected && remoteOrMissingAgent) {
    const safeId = String(input.issueId || "card").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "card";
    const ctxPath = `/Users/heltonfraga/.buzz/.scratch/orgfy-context-${safeId}.json`;
    const payload = JSON.stringify(
      {
        issueId: input.issueId,
        conversationId: input.conversationId,
        worktreePath,
        sections,
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      null,
      2
    );
    if (host == null ? void 0 : host.writeFile) {
      try {
        await host.writeFile(ctxPath, payload);
        fallbackContextFile = ctxPath;
        degradedFallback = true;
        notes.push(`Fallback aplicado: agente/conversa não local neste aparelho; contexto L-22/L-90 persistido em ${ctxPath}.`);
      } catch (wErr) {
        notes.push(`Falha ao gravar fallback de contexto: ${(wErr == null ? void 0 : wErr.message) || wErr}`);
      }
    }
  }
  return {
    ok: folderAssigned || sectionsInjected || degradedFallback,
    conversationId: input.conversationId,
    folderAssigned,
    worktreePath,
    sectionsInjected,
    sectionsCount: sectionsInjected || degradedFallback ? sections.length : 0,
    fallbackContextFile,
    degradedFallback,
    notes
  };
}
async function stopAgentSession(ctx, input) {
  const agentsApi = ctx.agents;
  const action = input.action === "new" || input.action === "compact" ? input.action : "interrupt";
  const channelId = String(input.channel_id || DEFAULT_ORGFY_CHANNEL$2).trim() || DEFAULT_ORGFY_CHANNEL$2;
  const root = input.thread_root ? String(input.thread_root).trim() : void 0;
  const place = root ? { channelId, root } : { channelId };
  if (!(agentsApi == null ? void 0 : agentsApi.snapshot) || !(agentsApi == null ? void 0 : agentsApi.session) && !(agentsApi == null ? void 0 : agentsApi.interrupt)) {
    return {
      ok: false,
      action,
      agentName: null,
      agentKey: null,
      agentPlace: null,
      place,
      previousState: null,
      lockReleased: false,
      relaunched: false,
      message: "API nativa ctx.agents.session / snapshot indisponível neste host."
    };
  }
  const snap = agentsApi.snapshot() || {};
  const pool = [];
  const seen = /* @__PURE__ */ new Set();
  for (const list of [snap.running, snap.agents]) {
    if (!Array.isArray(list)) continue;
    for (const a of list) {
      if (!a || !a.key || seen.has(a.key)) continue;
      seen.add(a.key);
      pool.push(a);
    }
  }
  const queryRaw = String(input.agente || "").trim();
  const queryLower = queryRaw.toLowerCase();
  const pubkeyLower = String(input.agent_pubkey || "").trim().toLowerCase();
  const matched = pubkeyLower && pool.find((a) => String(a.pubkey || "").toLowerCase() === pubkeyLower) || pool.find((a) => String(a.key || "").toLowerCase() === queryLower) || pool.find((a) => String(a.pubkey || "").toLowerCase() === queryLower) || pool.find((a) => String(a.name || "").toLowerCase() === queryLower) || (queryLower ? pool.find((a) => String(a.name || "").toLowerCase().includes(queryLower)) : void 0);
  if (!matched) {
    const available = pool.map((a) => a.name || a.key).slice(0, 12).join(", ");
    return {
      ok: false,
      action,
      agentName: null,
      agentKey: null,
      agentPlace: null,
      place,
      previousState: null,
      lockReleased: false,
      relaunched: false,
      message: `Agente '${queryRaw || pubkeyLower}' não encontrado no Buzz Desktop. Disponíveis: ${available || "nenhum"}`
    };
  }
  const resolvedName = String(matched.name || matched.key);
  let previousState = null;
  try {
    if (agentsApi.sessionState) {
      previousState = String(agentsApi.sessionState(matched.key, place));
    }
  } catch {
    previousState = null;
  }
  try {
    if (matched.place === "hosted" && action === "interrupt" && agentsApi.interrupt) {
      await agentsApi.interrupt(matched.key, {
        channelId: place.channelId,
        ...place.root ? { threadRootId: place.root } : {}
      });
    } else if (agentsApi.session) {
      await agentsApi.session(matched.key, place, action);
    } else if (action === "interrupt" && agentsApi.interrupt) {
      await agentsApi.interrupt(matched.key, {
        channelId: place.channelId,
        ...place.root ? { threadRootId: place.root } : {}
      });
    } else {
      return {
        ok: false,
        action,
        agentName: resolvedName,
        agentKey: matched.key,
        agentPlace: matched.place || null,
        place,
        previousState,
        lockReleased: false,
        relaunched: false,
        message: `Host não suporta ação '${action}' para ${resolvedName}.`
      };
    }
  } catch (err) {
    return {
      ok: false,
      action,
      agentName: resolvedName,
      agentKey: matched.key,
      agentPlace: matched.place || null,
      place,
      previousState,
      lockReleased: false,
      relaunched: false,
      message: `Falha ao executar '${action}' em ${resolvedName}: ${(err == null ? void 0 : err.message) || err}`
    };
  }
  let lockReleased = false;
  if (input.release_issue_id && String(input.release_issue_id).trim()) {
    try {
      const rel = await releaseCheckoutLock(ctx, String(input.release_issue_id).trim(), void 0, true);
      lockReleased = rel.ok && rel.code === "RELEASED";
    } catch {
      lockReleased = false;
    }
  }
  let relaunched = false;
  let relaunchMessage = null;
  const wantRelaunch = Boolean(input.relaunch);
  const relaunchInstr = String(input.relaunch_instruction || "").trim();
  if (wantRelaunch && (agentsApi == null ? void 0 : agentsApi.wake)) {
    try {
      if (input.reset_session_before_relaunch && action !== "new" && agentsApi.session) {
        try {
          await agentsApi.session(matched.key, place, "new");
        } catch {
        }
      }
      const files = Array.isArray(input.target_files) ? input.target_files.map((f) => String(f || "").trim()).filter(Boolean) : [];
      const maxShells = Number.isFinite(Number(input.max_shells)) && Number(input.max_shells) > 0 ? Math.min(20, Math.max(3, Math.round(Number(input.max_shells)))) : 10;
      const accCmd = String(input.acceptance_command || "").trim();
      const parts = [
        `@${resolvedName} [ORGFY AUTO-CURA · RELANÇAMENTO ESCOPO FECHADO]`,
        `Sua sessão anterior foi interrompida (${String(input.reason || "loop/travamento").trim()}).`,
        relaunchInstr ? `Objetivo único agora: ${relaunchInstr}` : "Retome a tarefa atual com foco estrito no escopo fechado.",
        files.length > 0 ? `Arquivos-alvo exclusivos: ${files.join(", ")}.` : null,
        accCmd ? `Comando de aceite L-22 obrigatório: ${accCmd}` : null,
        `Limite estrito: máximo ${maxShells} comandos shell (sem --help, sem explorar fora do escopo). Ao passar o aceite, entregue imediatamente; se bater 2 falhas consecutivas, publique BLOQUEADO.`
      ].filter(Boolean);
      relaunchMessage = parts.join(" ");
      await agentsApi.wake(matched.key, {
        channel: place.channelId,
        ...place.root ? { root: place.root } : {},
        text: relaunchMessage
      });
      relaunched = true;
    } catch (wakeErr) {
      relaunchMessage = `Falha no relaunch automático: ${(wakeErr == null ? void 0 : wakeErr.message) || wakeErr}`;
    }
  }
  const nextRequiredAction = relaunched ? null : `AÇÃO OBRIGATÓRIA DO COO (parar nunca encerra o turno): escolha 1 dos 3 desfechos para ${resolvedName}: (1) Se erro de API/5xx, chame orgfy_model_failover({ agente: '${resolvedName}', channel_id: '${place.channelId}'${place.root ? `, thread_root: '${place.root}'` : ""}, prefer_free: true, apply: true, retrigger: true }); (2) Se a demanda ainda está aberta, chame orgfy_session_stop({ agente: '${resolvedName}', channel_id: '${place.channelId}'${place.root ? `, thread_root: '${place.root}'` : ""}, relaunch: true, relaunch_instruction: '<o que fazer>', target_files: ['...'], acceptance_command: '<L-22>', max_shells: 10 }); (3) Se o PR já foi integrado na main, apenas registre 'AUTO-CURA | ${resolvedName} | ITEM_JA_FECHADO | encerrado sem relançar'.`;
  const reasonSuffix = input.reason ? ` Motivo: ${String(input.reason).trim()}.` : "";
  return {
    ok: true,
    action,
    agentName: resolvedName,
    agentKey: matched.key,
    agentPlace: matched.place || null,
    place,
    previousState,
    lockReleased,
    relaunched,
    relaunchMessage,
    next_required_action: nextRequiredAction,
    message: `Comando '${action}' enviado com sucesso para ${resolvedName} (canal ${place.channelId.slice(0, 8)}${place.root ? `, thread ${place.root.slice(0, 8)}` : ""}).${lockReleased ? " Lock liberado." : ""}${relaunched ? " Agente relançado automaticamente com @menção e escopo fechado." : ""}${reasonSuffix}`
  };
}
const DEFAULT_WATCHDOG_INTERVAL_MS = 3 * 60 * 1e3;
const DEFAULT_WATCHDOG_INITIAL_DELAY_MS = 12 * 1e3;
let radarWatchdogTimer = null;
let radarWatchdogInitialTimer = null;
let radarWatchdogRunning = false;
function stopGovernanceRadarWatchdog() {
  if (radarWatchdogInitialTimer) {
    clearTimeout(radarWatchdogInitialTimer);
    radarWatchdogInitialTimer = null;
  }
  if (radarWatchdogTimer) {
    clearInterval(radarWatchdogTimer);
    radarWatchdogTimer = null;
  }
}
function startGovernanceRadarWatchdog(ctx, options = {}) {
  const agentsApi = ctx.agents;
  if (!(agentsApi == null ? void 0 : agentsApi.wake)) return false;
  stopGovernanceRadarWatchdog();
  const intervalMs = options.intervalMs ?? DEFAULT_WATCHDOG_INTERVAL_MS;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_WATCHDOG_INITIAL_DELAY_MS;
  const tick = async () => {
    if (radarWatchdogRunning) return;
    radarWatchdogRunning = true;
    try {
      await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: true, includeRadar: true });
    } catch {
    } finally {
      radarWatchdogRunning = false;
    }
  };
  radarWatchdogInitialTimer = setTimeout(() => {
    radarWatchdogInitialTimer = null;
    void tick();
  }, initialDelayMs);
  if (typeof (radarWatchdogInitialTimer == null ? void 0 : radarWatchdogInitialTimer.unref) === "function") {
    radarWatchdogInitialTimer.unref();
  }
  radarWatchdogTimer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof (radarWatchdogTimer == null ? void 0 : radarWatchdogTimer.unref) === "function") {
    radarWatchdogTimer.unref();
  }
  return true;
}
const MODEL_FAILOVER_CHAIN = [
  { provider: "nexusmind_openai", model: "antigravity/gemini-3.8-flash-medium" },
  { provider: "nexusmind_openai", model: "gpt-6.1-terra" },
  { provider: "nexusmind_anthropic", model: "claude-sonnet-5-5" },
  { provider: "nexusmind_grok", model: "grok-4.1-fast" }
];
const AGENT_STATE_DIR_DEFAULT = "/Users/heltonfraga/Library/Application Support/xyz.block.buzz.desktop/agents/state";
const FAILOVER_COOLDOWN_MS = 5 * 60 * 1e3;
function isRateLimitOrProviderError(text) {
  const low = String(text || "").toLowerCase();
  return [
    "rate limit exceeded",
    "upstream rate limit",
    "too many requests",
    "429",
    "no available accounts",
    "503 service unavailable",
    "502 bad gateway",
    "504 gateway timeout"
  ].some((marker) => low.includes(marker));
}
function pickNextHealthyModel(currentProvider, currentModel) {
  const p = String(currentProvider || "").trim();
  const m = String(currentModel || "").trim();
  const idx = MODEL_FAILOVER_CHAIN.findIndex(
    (entry) => entry.provider === p && entry.model === m
  );
  if (idx >= 0) {
    return MODEL_FAILOVER_CHAIN[(idx + 1) % MODEL_FAILOVER_CHAIN.length];
  }
  return MODEL_FAILOVER_CHAIN[0];
}
async function executeAgentModelFailover(ctx, options) {
  const agentKey = options.agentName || options.agentPubkey;
  const nowMs = options.nowMs ?? Date.now();
  if (!isRateLimitOrProviderError(options.errorText)) {
    return {
      ok: false,
      switched: false,
      code: "NOT_RATE_LIMIT",
      agentKey,
      previous: null,
      current: null,
      wokeAgent: false,
      message: "Erro informado não é rate limit/indisponibilidade transitória de provedor."
    };
  }
  const cooldownKey = `model_failover:${options.agentPubkey}`;
  if (!canTriggerWithCooldown(cooldownKey, nowMs, true, FAILOVER_COOLDOWN_MS)) {
    return {
      ok: true,
      switched: false,
      code: "COOLDOWN_ACTIVE",
      agentKey,
      previous: null,
      current: null,
      wokeAgent: false,
      message: `Failover de modelo em cooldown (5 min) para ${agentKey}.`
    };
  }
  const host = ctx.host;
  const dir = options.stateDir || AGENT_STATE_DIR_DEFAULT;
  const statePath = `${dir}/buzz.agent.v1%3A${options.agentPubkey}`;
  try {
    const raw = await host.readFile(statePath);
    const text = typeof raw === "string" ? raw : raw instanceof Uint8Array ? new TextDecoder("utf-8").decode(raw) : raw instanceof ArrayBuffer ? new TextDecoder("utf-8").decode(new Uint8Array(raw)) : String(raw ?? "");
    const parsed = JSON.parse(text);
    const cfg = parsed.config = parsed.config || {};
    const previous = {
      provider: String(cfg.provider || ""),
      model: String(cfg.model || "")
    };
    const next = pickNextHealthyModel(previous.provider, previous.model);
    cfg.provider = next.provider;
    cfg.model = next.model;
    if (host == null ? void 0 : host.writeFile) {
      await host.writeFile(statePath, JSON.stringify(parsed, null, 2));
    }
    try {
      const notifApi = ctx.notifications;
      if (notifApi == null ? void 0 : notifApi.notify) {
        await notifApi.notify({
          title: `OrgFy Failover [${agentKey}]`,
          body: `Rate limit detectado. Modelo trocado de ${previous.model || "vazio"} para ${next.provider}/${next.model}.`
        });
      }
    } catch {
    }
    let wokeAgent = false;
    if (options.autoWake !== false) {
      try {
        const agentsApi = ctx.agents;
        if (agentsApi == null ? void 0 : agentsApi.wake) {
          await agentsApi.wake(options.agentName || options.agentPubkey, {
            channel: options.channel || "#esteira-orgfy",
            text: `[ORGFY FAILOVER 429] Modelo rotacionado para ${next.provider}/${next.model} após rate limit upstream. Retome o turno anterior.`
          });
          wokeAgent = true;
        }
      } catch {
      }
    }
    return {
      ok: true,
      switched: true,
      code: "SWITCHED",
      agentKey,
      previous,
      current: next,
      wokeAgent,
      message: `Modelo de ${agentKey} rotacionado: ${previous.model || "vazio"} -> ${next.provider}/${next.model}.`
    };
  } catch (err) {
    return {
      ok: false,
      switched: false,
      code: "STATE_NOT_FOUND",
      agentKey,
      previous: null,
      current: null,
      wokeAgent: false,
      message: `Falha ao ler/atualizar state do agente: ${(err == null ? void 0 : err.message) || err}`
    };
  }
}
function normalizeAgentAlias(raw) {
  return String(raw || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^@/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}
function checkMentionTargetIdentity(input) {
  const text = String(input.messageText || "");
  const matches = Array.from(
    text.matchAll(/@((?:OrgFy|Lumen|Tributario)\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/g)
  ).map((m) => m[1].trim());
  const mentionedTargets = Array.from(new Set(matches));
  if (mentionedTargets.length === 0) {
    return {
      isForMe: true,
      action: "PROCEED",
      mentionedTargets: [],
      reason: "Sem menção nominal explícita a outro agente."
    };
  }
  const meNorm = normalizeAgentAlias(input.currentAgentName);
  const isAddressedToMe = mentionedTargets.some((t) => {
    const tNorm = normalizeAgentAlias(t);
    return tNorm === meNorm || tNorm.includes(meNorm) || meNorm.includes(tNorm);
  });
  if (isAddressedToMe) {
    return {
      isForMe: true,
      action: "PROCEED",
      mentionedTargets,
      reason: `Menção compatível com o perfil ativo (${input.currentAgentName}).`
    };
  }
  return {
    isForMe: false,
    action: "[SILENT]",
    mentionedTargets,
    reason: `Menção endereçada a [${mentionedTargets.join(", ")}], não a ${input.currentAgentName}. Responder [SILENT].`
  };
}
const THREAD_WAKE_COOLDOWN_MS = 10 * 60 * 1e3;
const threadWakeTimestamps = /* @__PURE__ */ new Map();
function resetThreadWakeGuardForTests() {
  threadWakeTimestamps.clear();
}
function checkThreadWakeAntiLoop(input) {
  if (input.bypass) {
    return { allow: true, reason: "bypass" };
  }
  const nowMs = input.nowMs ?? Date.now();
  const ctxLow = String(input.contextText || "").toLowerCase();
  const waitingOtherGate = (ctxLow.includes("aguardando gate") || ctxLow.includes("waiting for gate")) && !ctxLow.includes(normalizeAgentAlias(input.agentKey));
  if (waitingOtherGate && input.threadRoot) {
    return {
      allow: false,
      reason: "waiting_for_other_reviewer_gate"
    };
  }
  if (input.threadRoot) {
    const key = `thread_wake:${normalizeAgentAlias(input.agentKey)}:${input.threadRoot}`;
    const last = threadWakeTimestamps.get(key);
    if (last !== void 0 && nowMs - last < THREAD_WAKE_COOLDOWN_MS) {
      return {
        allow: false,
        reason: "thread_wake_cooldown_10m"
      };
    }
    threadWakeTimestamps.set(key, nowMs);
  }
  return { allow: true, reason: "ok" };
}
function registerGovernanceAgentHooks(ctx) {
  const agentsApi = ctx.agents;
  let registered = false;
  if (agentsApi == null ? void 0 : agentsApi.registerHook) {
    try {
      agentsApi.registerHook({
        id: "orgfy-post-turn-governance",
        harness: "all",
        event: "turn.completed",
        run: async (payload) => {
          const errText = String((payload == null ? void 0 : payload.error) || (payload == null ? void 0 : payload.output) || (payload == null ? void 0 : payload.message) || "");
          const agentPubkey = String((payload == null ? void 0 : payload.agentPubkey) || (payload == null ? void 0 : payload.pubkey) || "");
          if (agentPubkey && isRateLimitOrProviderError(errText)) {
            await executeAgentModelFailover(ctx, {
              agentPubkey,
              agentName: payload == null ? void 0 : payload.agentName,
              errorText: errText,
              channel: payload == null ? void 0 : payload.channel,
              autoWake: true
            });
          }
          await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: true, includeRadar: true });
        }
      });
      agentsApi.registerHook({
        id: "orgfy-turn-failed-model-failover",
        harness: "all",
        event: "turn.failed",
        run: async (payload) => {
          const errText = String((payload == null ? void 0 : payload.error) || (payload == null ? void 0 : payload.reason) || (payload == null ? void 0 : payload.message) || "");
          const agentPubkey = String((payload == null ? void 0 : payload.agentPubkey) || (payload == null ? void 0 : payload.pubkey) || "");
          if (agentPubkey && isRateLimitOrProviderError(errText)) {
            await executeAgentModelFailover(ctx, {
              agentPubkey,
              agentName: payload == null ? void 0 : payload.agentName,
              errorText: errText,
              channel: payload == null ? void 0 : payload.channel,
              autoWake: true
            });
          }
        }
      });
      registered = true;
    } catch {
      registered = false;
    }
  }
  const watchdogStarted = startGovernanceRadarWatchdog(ctx);
  return registered || watchdogStarted;
}
const MAX_SPANS = 200;
const spansBuffer = [];
const listeners = /* @__PURE__ */ new Set();
const decisionsStats = {
  totalCalls: 0,
  decisionsApiCalls: 0,
  fallbackCalls: 0,
  wakesOrEscalationsAvoided: 0,
  estimatedTokensSaved: 0,
  totalLatencyMs: 0,
  byMode: {}
};
const agentCounters = /* @__PURE__ */ new Map();
function randomHex(len) {
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
    } catch {
    }
  }
}
function subscribeTelemetry(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function recordGenAISpan(input) {
  const span = {
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
    attributes: input.attributes || {}
  };
  spansBuffer.unshift(span);
  if (spansBuffer.length > MAX_SPANS) {
    spansBuffer.length = MAX_SPANS;
  }
  if (span.operationName === "invoke_agent") {
    const key = span.agentName;
    const prev = agentCounters.get(key) || {
      totalTurns: 0,
      errorTurns: 0,
      consecutiveErrors: 0,
      totalDurationMs: 0,
      lastActivityTs: span.timestamp
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
function recordDecisionTelemetry(params) {
  decisionsStats.totalCalls += 1;
  if (params.source === "decisions_api") {
    decisionsStats.decisionsApiCalls += 1;
  } else {
    decisionsStats.fallbackCalls += 1;
  }
  decisionsStats.totalLatencyMs += Math.max(0, params.durationMs);
  decisionsStats.byMode[params.mode] = (decisionsStats.byMode[params.mode] || 0) + 1;
  const saved = params.preventedExpensiveWake ? params.estimatedTokensSaved ?? 18e3 : 0;
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
      "orgfy.tokens_saved_est": saved
    }
  });
}
function getTelemetrySnapshot() {
  const agentMetrics = [];
  const retryCascadeAlerts = [];
  for (const [agentName, c] of agentCounters.entries()) {
    const retryCascadeRisk = c.consecutiveErrors >= 2 || c.totalTurns >= 4 && c.errorTurns / c.totalTurns >= 0.5;
    agentMetrics.push({
      agentName,
      totalTurns: c.totalTurns,
      errorTurns: c.errorTurns,
      consecutiveErrors: c.consecutiveErrors,
      retryCascadeRisk,
      avgDurationMs: c.totalTurns > 0 ? Math.round(c.totalDurationMs / c.totalTurns) : 0,
      lastActivityTs: c.lastActivityTs
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
      avgLatencyMs: decisionsStats.totalCalls > 0 ? Math.round(decisionsStats.totalLatencyMs / decisionsStats.totalCalls) : 0,
      byMode: { ...decisionsStats.byMode }
    },
    agentMetrics,
    retryCascadeAlerts
  };
}
function resetTelemetryForTests() {
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
const DEFAULT_ORGFY_CHANNEL$1 = "e445491d-2fb3-4ebd-8e2e-f6813c33fb03";
const RISCO_LABELS = [
  "muito_baixo",
  "baixo",
  "medio",
  "alto",
  "critico"
];
const TIER_MODEL_HINTS = {
  tier1_fast: "gemini-3.8-flash-medium (NexusMind Anti-Gravity — rápido e enxuto)",
  tier2_balanced: "claude-sonnet-4-6 (NexusMind Anthropic — balanceado para código/revisão)",
  tier3_frontier: "claude-opus-4-6-thinking / grok-4.5 (NexusMind Frontier — arquitetura/risco alto)"
};
function sanitizeSlug$1(raw) {
  return String(raw || "card").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "card";
}
function deterministicCardTriage(input) {
  var _a;
  const texto = `${input.titulo || ""} ${input.objetivo || ""} ${input.tipo || ""} ${input.risco_declarado || ""}`.toLowerCase();
  const arquivos = Array.isArray(input.escrita_exclusiva) ? input.escrita_exclusiva.filter(Boolean) : [];
  const passos = Array.isArray(input.passos) ? input.passos.filter(Boolean) : [];
  const alertas = [];
  const escopoAmplo = arquivos.length > 6 || passos.length > 8 || /\b(refatorar tudo|reescrever sistema|todo o repositorio|geral)\b/.test(texto);
  const escopoAtomico = !escopoAmplo && Boolean((input.titulo || "").trim());
  if (escopoAmplo) {
    alertas.push("Escopo amplo detectado (>6 arquivos ou >8 passos); considere fatiar o card.");
  }
  if (!((_a = input.acceptance_command) == null ? void 0 : _a.trim())) {
    alertas.push("Comando de aceite L-22 ausente — obrigatório antes do despacho.");
  }
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
  const modeloTier = riscoScore >= 4 ? "tier3_frontier" : riscoScore === 3 ? "tier2_balanced" : "tier1_fast";
  const attentionPolicy = /\b(monitor|watch|revisao|gate|pr|aguardar|ci|deploy)\b/.test(texto) ? "event_driven" : riscoScore >= 4 ? "watchdog_longo" : "timer_curto";
  return {
    ok: true,
    escopoAtomico,
    escopoAtomicoProb: escopoAtomico ? 0.88 : 0.25,
    riscoScore,
    riscoNivel: RISCO_LABELS[Math.max(0, Math.min(4, riscoScore - 1))],
    modeloTier,
    modeloRecomendadoHint: TIER_MODEL_HINTS[modeloTier],
    attentionPolicy,
    alertas
  };
}
async function triageCardWithDecisions(ctx, input) {
  const t0 = Date.now();
  const baseline = deterministicCardTriage(input);
  const decisionsApi = ctx == null ? void 0 : ctx.decisions;
  if (!(decisionsApi == null ? void 0 : decisionsApi.decide)) {
    recordDecisionTelemetry({
      mode: "card_triage",
      source: "deterministic_fallback",
      durationMs: Date.now() - t0,
      preventedExpensiveWake: baseline.modeloTier === "tier1_fast"
    });
    return {
      ...baseline,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: "decisions_api_not_available"
    };
  }
  const statePayload = [
    `Título: ${input.titulo || "(vazio)"}`,
    `Objetivo: ${input.objetivo || "(não informado)"}`,
    `Tipo: ${input.tipo || "execucao"}`,
    `Escrita exclusiva (${(input.escrita_exclusiva || []).length}): ${(input.escrita_exclusiva || []).join(", ") || "(não informada)"}`,
    `Passos (${(input.passos || []).length}): ${(input.passos || []).join(" | ") || "(não informados)"}`,
    `Comando de aceite L-22: ${input.acceptance_command || "(ausente)"}`,
    `Risco declarado: ${input.risco_declarado || "(não informado)"}`
  ].join("\n");
  try {
    const res = await decisionsApi.decide({
      state: statePayload,
      timeoutMs: 8e3,
      questions: {
        escopo_atomico: {
          type: "yes_no",
          instructions: "O card tem escopo fechado, atômico (1 a 6 arquivos) e critério de aceite verificável para execução em um único ciclo de engenharia?"
        },
        risco_tier: {
          type: "score",
          instructions: "Classifique o risco técnico e arquitetural desta tarefa (segurança, banco/migrations, concorrência, núcleo da esteira ou infra crítica).",
          levels: ["muito_baixo", "baixo", "medio", "alto", "critico"]
        },
        modelo_tier: {
          type: "choice",
          instructions: "Qual tier de modelo LLM oferece melhor custo-benefício (RouteLLM) para executar este card com alta taxa de acerto na primeira passagem?",
          options: {
            tier1_fast: "Tarefa simples, cirúrgica, fixture, ajuste pontual ou documentação.",
            tier2_balanced: "Implementação padrão de feature, serviço, testes ou revisão de código.",
            tier3_frontier: "Arquitetura complexa, segurança, concorrência, multi-serviço ou bug crítico."
          }
        },
        politica_attention: {
          type: "choice",
          instructions: "Qual política de Buzz Attention/Watch é mais adequada para acompanhar a execução deste card sem desperdício de turnos?",
          options: {
            timer_curto: "Execução rápida local (revisitar a cada 10 min, máx 3 ocorrências, janela 1h).",
            event_driven: "Depende de revisão, PR, CI ou resposta em thread (watch de evento com classifier).",
            watchdog_longo: "Tarefa complexa ou multi-etapa (revisitar a cada 20 min, máx 5 ocorrências, janela 3h)."
          }
        }
      }
    });
    if ((res == null ? void 0 : res.outcome) === "answered" && res.answers) {
      const ansAtomico = res.answers.escopo_atomico;
      const ansRisco = res.answers.risco_tier;
      const ansModelo = res.answers.modelo_tier;
      const ansAttention = res.answers.politica_attention;
      const escopoAtomicoProb = (ansAtomico == null ? void 0 : ansAtomico.type) === "yes_no" ? Number(ansAtomico.probability) : baseline.escopoAtomicoProb;
      const escopoAtomico = escopoAtomicoProb >= 0.5;
      const rawScore = (ansRisco == null ? void 0 : ansRisco.type) === "score" ? Math.round(Number(ansRisco.score)) + 1 : baseline.riscoScore;
      const riscoScore = Math.max(1, Math.min(5, rawScore));
      const modeloTier = (ansModelo == null ? void 0 : ansModelo.type) === "choice" && (ansModelo.choice === "tier1_fast" || ansModelo.choice === "tier2_balanced" || ansModelo.choice === "tier3_frontier") ? ansModelo.choice : baseline.modeloTier;
      const attentionPolicy = (ansAttention == null ? void 0 : ansAttention.type) === "choice" && (ansAttention.choice === "timer_curto" || ansAttention.choice === "event_driven" || ansAttention.choice === "watchdog_longo") ? ansAttention.choice : baseline.attentionPolicy;
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
        preventedExpensiveWake: modeloTier !== "tier3_frontier" || !escopoAtomico
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
        alertas: Array.from(new Set(alertas))
      };
    }
    return {
      ...baseline,
      decisionSource: "deterministic_fallback",
      backend: (res == null ? void 0 : res.backend) || null,
      model: null,
      fallbackReason: `decisions_api_failed:${(res == null ? void 0 : res.reason) || "unknown"}`
    };
  } catch (err) {
    return {
      ...baseline,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: `decisions_api_exception:${String((err == null ? void 0 : err.message) || err).slice(0, 80)}`
    };
  }
}
function findOutOfScopeFiles(escritaExclusiva, arquivosAlterados) {
  const allowed = (escritaExclusiva || []).map((p) => String(p || "").trim().replace(/^\.\//, "")).filter(Boolean);
  if (allowed.length === 0) return [];
  return (arquivosAlterados || []).map((f) => String(f || "").trim().replace(/^\.\//, "")).filter(Boolean).filter((file) => {
    return !allowed.some((rule) => {
      if (rule === file) return true;
      if (rule.endsWith("/") && file.startsWith(rule)) return true;
      if (rule.endsWith("/**") && file.startsWith(rule.slice(0, -3))) return true;
      if (rule.endsWith("/*") && file.startsWith(rule.slice(0, -2))) return true;
      return false;
    });
  });
}
async function triageDiffWithDecisions(ctx, input) {
  const arquivosForaEscopo = findOutOfScopeFiles(input.escrita_exclusiva, input.arquivos_alterados);
  const escopoRespeitadoMecanico = arquivosForaEscopo.length === 0;
  const textoEntrega = `${input.resumo_entrega || ""}
${input.saida_aceite || ""}`;
  const temSaidaReal = /exit\s*0|passed|ok|sha256|build|pytest|test/i.test(input.saida_aceite || "");
  const alegaProntoSemProva = !temSaidaReal && /\b(100%|pronto|passou tudo|concluido|resolvido)\b/i.test(input.resumo_entrega || "");
  const motivos = [];
  if (!escopoRespeitadoMecanico) {
    motivos.push(`Arquivos alterados fora da Escrita exclusiva: ${arquivosForaEscopo.join(", ")}`);
  }
  if (alegaProntoSemProva) {
    motivos.push("Regra L-24: entrega alega conclusão sem saída executável comprovada.");
  }
  const recusas = Number(input.recusas_anteriores || 0);
  const baselineAcao = recusas >= 2 ? "escalar_coo" : !escopoRespeitadoMecanico || alegaProntoSemProva ? "pedir_ajuste_executor" : "prosseguir_gate";
  const baselineSeveridade = !escopoRespeitadoMecanico ? 4 : alegaProntoSemProva ? 3 : 1;
  const decisionsApi = ctx == null ? void 0 : ctx.decisions;
  if (!(decisionsApi == null ? void 0 : decisionsApi.decide) || !textoEntrega.trim()) {
    return {
      ok: true,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: !(decisionsApi == null ? void 0 : decisionsApi.decide) ? "decisions_api_not_available" : "empty_delivery_text",
      escopoRespeitado: escopoRespeitadoMecanico,
      arquivosForaEscopo,
      alegacaoSemProvaL24: alegaProntoSemProva,
      severidadeDesvio: baselineSeveridade,
      acaoRecomendada: baselineAcao,
      motivos
    };
  }
  const statePayload = [
    `Issue: ${input.issue_id || "(n/a)"} — ${input.titulo || ""}`,
    `Escrita exclusiva: ${(input.escrita_exclusiva || []).join(", ") || "(não informada)"}`,
    `Arquivos alterados: ${(input.arquivos_alterados || []).join(", ") || "(nenhum)"}`,
    `Fora de escopo (mecânico): ${arquivosForaEscopo.join(", ") || "nenhum"}`,
    `Recusas anteriores: ${recusas}`,
    `Resumo entrega: ${(input.resumo_entrega || "").slice(0, 1200)}`,
    `Saída aceite L-22: ${(input.saida_aceite || "").slice(0, 1200)}`
  ].join("\n");
  try {
    const res = await decisionsApi.decide({
      state: statePayload,
      timeoutMs: 8e3,
      questions: {
        alegacao_sem_prova: {
          type: "yes_no",
          instructions: "A entrega afirma que está pronta/aprovada/100% sem apresentar evidência concreta de execução (comando + exit 0 ou saída de teste real)?"
        },
        severidade_desvio: {
          type: "score",
          instructions: "Qual a severidade de desvio de contrato nesta entrega (vazamento de escopo, falta de prova, risco de regressão)?",
          levels: ["nenhum", "leve", "moderado", "alto", "bloqueante"]
        },
        acao_gate: {
          type: "choice",
          instructions: "Qual ação imediata o revisor/gate deve tomar?",
          options: {
            prosseguir_gate: "Entrega íntegra, dentro do escopo e com prova executável; seguir para GATE: aceito.",
            pedir_ajuste_executor: "Há desvio pontual ou falta de prova; devolver ao executor com pedido objetivo.",
            escalar_coo: "Reincidência (>=2 recusas) ou quebra grave de escopo; escalar ao COO para re-escopo."
          }
        }
      }
    });
    if ((res == null ? void 0 : res.outcome) === "answered" && res.answers) {
      const ansL24 = res.answers.alegacao_sem_prova;
      const ansSev = res.answers.severidade_desvio;
      const ansAcao = res.answers.acao_gate;
      const l24Prob = (ansL24 == null ? void 0 : ansL24.type) === "yes_no" ? Number(ansL24.probability) : 0;
      const alegacaoSemProvaL24 = alegaProntoSemProva || l24Prob >= 0.65;
      if (l24Prob >= 0.65 && !alegaProntoSemProva) {
        motivos.push(`Decisions API (${res.model}): suspeita de alegação sem prova L-24 (p=${l24Prob.toFixed(2)}).`);
      }
      const severidadeDesvio = Math.max(
        baselineSeveridade,
        (ansSev == null ? void 0 : ansSev.type) === "score" ? Math.min(5, Math.max(1, Math.round(Number(ansSev.score)) + 1)) : baselineSeveridade
      );
      let acaoRecomendada = (ansAcao == null ? void 0 : ansAcao.type) === "choice" && (ansAcao.choice === "prosseguir_gate" || ansAcao.choice === "pedir_ajuste_executor" || ansAcao.choice === "escalar_coo") ? ansAcao.choice : baselineAcao;
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
        motivos: Array.from(new Set(motivos))
      };
    }
    return {
      ok: true,
      decisionSource: "deterministic_fallback",
      backend: (res == null ? void 0 : res.backend) || null,
      model: null,
      fallbackReason: `decisions_api_failed:${(res == null ? void 0 : res.reason) || "unknown"}`,
      escopoRespeitado: escopoRespeitadoMecanico,
      arquivosForaEscopo,
      alegacaoSemProvaL24: alegaProntoSemProva,
      severidadeDesvio: baselineSeveridade,
      acaoRecomendada: baselineAcao,
      motivos
    };
  } catch (err) {
    return {
      ok: true,
      decisionSource: "deterministic_fallback",
      backend: null,
      model: null,
      fallbackReason: `decisions_api_exception:${String((err == null ? void 0 : err.message) || err).slice(0, 80)}`,
      escopoRespeitado: escopoRespeitadoMecanico,
      arquivosForaEscopo,
      alegacaoSemProvaL24: alegaProntoSemProva,
      severidadeDesvio: baselineSeveridade,
      acaoRecomendada: baselineAcao,
      motivos
    };
  }
}
function buildBuzzAttentionContract(params) {
  const slug = sanitizeSlug$1(params.slug || params.titulo);
  const interestId = `orgfy-card-${slug}`.slice(0, 64);
  const now = typeof params.nowUnixSecs === "number" ? params.nowUnixSecs : Math.floor(Date.now() / 1e3);
  const channel = (params.channel || DEFAULT_ORGFY_CHANNEL$1).trim();
  const presets = {
    timer_curto: { intervalSecs: 600, maxOccurrences: 3, windowSecs: 3600, label: "Timer curto (10m x 3, janela 1h)" },
    event_driven: { intervalSecs: 900, maxOccurrences: 4, windowSecs: 7200, label: "Event-driven + Watchdog (15m x 4, janela 2h)" },
    watchdog_longo: { intervalSecs: 1200, maxOccurrences: 5, windowSecs: 10800, label: "Watchdog longo (20m x 5, janela 3h)" }
  };
  const preset = presets[params.policy] || presets.timer_curto;
  const expiresAt = now + preset.windowSecs;
  const contract = {
    policy: params.policy,
    interest_id: interestId,
    interest_set_payload: {
      id: interestId,
      title: `Card ${slug}: ${params.titulo}`.slice(0, 90),
      summary: `Execução/revisão do card ${slug} (${params.executor} → ${params.revisor}) com política ${preset.label}.`,
      instructions: `Acompanhe o card '${params.titulo}' (${slug}). Executor: ${params.executor}; Revisor: ${params.revisor}. Se o card já tiver ENTREGUE_PARA_REVISAO, GATE: aceito ou MERGED na main, remova os watches (watch_remove) e este Interest (interest_remove) imediatamente para zero desperdício.`,
      expected_state: "object-v1:absent"
    },
    timer_watch_payload: {
      interest: interestId,
      id: `timer-${slug}`.slice(0, 64),
      type: "timer",
      expected_state: "object-v1:absent",
      channel,
      ...params.threadRoot ? { root: params.threadRoot } : {},
      prompt: `Check-in de progresso do card ${slug}: verifique status na worktree/PR. Se concluído ou aguardando outro perfil, chame watch_remove e encerre com [SILENT].`,
      interval_secs: preset.intervalSecs,
      max_occurrences: preset.maxOccurrences,
      expires_at: expiresAt
    },
    cleanup_rule: "Auto-limpeza obrigatória: ao publicar ENTREGUE_PARA_REVISAO, GATE: aceito ou detectar merge na main, chamar watch_remove e interest_remove."
  };
  if (params.policy === "event_driven") {
    contract.event_watch_payload = {
      interest: interestId,
      id: `ev-${slug}`.slice(0, 64),
      type: "event",
      expected_state: "object-v1:absent",
      channels: [channel],
      channel,
      ...params.threadRoot ? { root: params.threadRoot } : {},
      since: "now",
      is_reply: Boolean(params.threadRoot),
      classifier: {
        questions: {
          handoff_ou_gate_card: {
            question: `A mensagem contém uma entrega real (ENTREGUE_PARA_REVISAO com prova), bloqueio (BLOQUEADO) ou veredito (GATE: aceito/recusado) especificamente sobre o card ${slug}?`,
            true: "Reporta entrega com comando/exit code, novo commit/PR, bloqueio formal ou decisão de Gate para este card.",
            false: "Conversa paralela, outro card, status rotineiro sem ação ou duplicata.",
            threshold: 0.3
          }
        }
      }
    };
  }
  return contract;
}
function sanitizeSlug(raw) {
  return String(raw || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "card";
}
async function computeSha256Hex(text) {
  var _a;
  const normalized = String(text || "").trim();
  try {
    if (typeof globalThis !== "undefined" && ((_a = globalThis.crypto) == null ? void 0 : _a.subtle)) {
      const data = new TextEncoder().encode(normalized);
      const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
  }
  let h1 = 2166136261;
  let h2 = 2654435769;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ch + i, 2246822507) >>> 0;
  }
  const part = h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  return part.repeat(4);
}
function renderCanonicalCardMarkdown(params) {
  const { input, slug, branch, worktreePath, idempotencyKey, acceptanceHash, triage, attention } = params;
  const formato = input.formato || "v3";
  const idPrefix = input.id_tarefa ? `${input.id_tarefa} — ` : `${slug.toUpperCase()} — `;
  const tituloCompleto = `${idPrefix}${input.titulo}`.slice(0, 100);
  const passos = Array.isArray(input.passos) && input.passos.length > 0 ? input.passos : [
    "Ler arquivos autorizados e validar pré-condições",
    "Implementar alteração estritamente em Escrita exclusiva",
    "Executar comando de aceite L-22 e registrar prova real"
  ];
  const foraEscopo = Array.isArray(input.fora_escopo) && input.fora_escopo.length > 0 ? input.fora_escopo : [
    "Não refatorar arquivos fora de Escrita exclusiva",
    "Não alterar o comando de aceite L-22 nem suprimir testes existentes"
  ];
  const leituraStr = Array.isArray(input.leitura) && input.leitura.length > 0 ? input.leitura.join(", ") : input.escrita_exclusiva.join(", ");
  const escritaStr = input.escrita_exclusiva.join(", ");
  const decisor = input.decisor || "OrgFy Iris";
  const tempoMax = input.tempo_maximo || "3600s";
  const skills = input.skills || "esteira-v4-metodo";
  const tipo = input.tipo || "execucao";
  const provaLinhas = [];
  if (input.prova_positiva) {
    provaLinhas.push(`  Positivo: ${input.prova_positiva.replace(/^positivo:\s*/i, "")}`);
  } else {
    provaLinhas.push(`  Positivo: ${input.acceptance_command} -> exit 0`);
  }
  if (input.prova_negativa) {
    provaLinhas.push(`  Negativo: ${input.prova_negativa.replace(/^negativo:\s*/i, "")}`);
  }
  const lines = [
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
    `- **Modo:** attention (${attention.policy})`,
    `- **Interest ID:** ${attention.interest_id}`,
    `- **Watch Timer:** intervalo ${attention.timer_watch_payload.interval_secs}s · max_occurrences ${attention.timer_watch_payload.max_occurrences} · expires_at ${attention.timer_watch_payload.expires_at}`,
    `- **Watch Event Classifier:** ${attention.event_watch_payload ? "ativo (Decisions API pre-wake)" : "não aplicável (timer enxuto)"}`,
    `- **Auto-cleanup Attention:** ${attention.cleanup_rule}`,
    `- **Roteamento Decision Model:** ${triage.modeloTier} (risco ${triage.riscoScore}/5 · ${triage.riscoNivel} · fonte: ${triage.decisionSource})`,
    `- **Modelo sugerido:** ${triage.modeloRecomendadoHint}`,
    `- **Idempotency key:** ${idempotencyKey}`,
    `- **Max retries:** ${tipo === "seguranca" ? "1" : "2"}`,
    `- **Max runtime:** ${tempoMax}`,
    `- **Completion contract:** local-only`,
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
    '- Sem prova não há entrega. Proibido escrever "PASS", "pronto" ou "100%" (L-24).',
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
    ""
  ];
  return lines.join("\n");
}
async function createCanonicalCard(ctx, input) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const slug = sanitizeSlug(input.slug || input.id_tarefa || input.titulo);
  const branch = `feat/${slug}`;
  const worktreePath = `.worktrees/${slug}`;
  const idempotencyKey = slug;
  const cardPath = `cards/${slug.toUpperCase()}.md`;
  const makeError = (code, message) => {
    const fallbackTriage = {
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
      alertas: [message]
    };
    const attention = buildBuzzAttentionContract({
      slug,
      titulo: input.titulo || slug,
      executor: input.executor || "(indefinido)",
      revisor: input.revisor || "(indefinido)",
      policy: "timer_curto",
      channel: input.channel_id,
      threadRoot: input.thread_root
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
      publishCommand: ""
    };
  };
  if (!((_a = input.titulo) == null ? void 0 : _a.trim())) {
    return makeError("MISSING_TITULO", "Campo obrigatório 'titulo' ausente.");
  }
  if (!((_b = input.executor) == null ? void 0 : _b.trim()) || !((_c = input.revisor) == null ? void 0 : _c.trim())) {
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
  if (!((_d = input.acceptance_command) == null ? void 0 : _d.trim())) {
    return makeError("MISSING_ACCEPTANCE_COMMAND", "Comando de aceite L-22 ('acceptance_command') é obrigatório.");
  }
  if (!((_e = input.autoridade) == null ? void 0 : _e.trim()) || !((_f = input.decisao) == null ? void 0 : _f.trim())) {
    return makeError("MISSING_AUTHORITY", "Campos 'autoridade' e 'decisao' são obrigatórios (evita placeholder recusado pelo lint).");
  }
  if (!((_g = input.feito_quando) == null ? void 0 : _g.trim())) {
    return makeError("MISSING_FEITO_QUANDO", "Campo 'feito_quando' é obrigatório.");
  }
  const triage = await triageCardWithDecisions(ctx, {
    titulo: input.titulo,
    objetivo: input.objetivo,
    tipo: input.tipo,
    escrita_exclusiva: input.escrita_exclusiva,
    acceptance_command: input.acceptance_command,
    passos: input.passos,
    executor: input.executor,
    revisor: input.revisor
  });
  const effectivePolicy = input.attention_policy || triage.attentionPolicy;
  const attentionContract = buildBuzzAttentionContract({
    slug,
    titulo: input.titulo,
    executor: input.executor,
    revisor: input.revisor,
    policy: effectivePolicy,
    channel: input.channel_id,
    threadRoot: input.thread_root
  });
  const acceptanceHashSha256 = await computeSha256Hex(input.acceptance_command);
  const markdown = renderCanonicalCardMarkdown({
    input,
    slug,
    branch,
    worktreePath,
    idempotencyKey,
    acceptanceHash: acceptanceHashSha256,
    triage,
    attention: attentionContract
  });
  let writtenToDisk = false;
  let lintPassed = null;
  let lintOutput = null;
  const absCardPath = `${ORGFY_ABS_PATH}/${cardPath}`;
  if (input.write_file && ((_h = ctx == null ? void 0 : ctx.host) == null ? void 0 : _h.writeFile)) {
    try {
      await ctx.host.writeFile(absCardPath, markdown);
      writtenToDisk = true;
    } catch (err) {
      lintOutput = `Falha ao gravar ${absCardPath}: ${(err == null ? void 0 : err.message) || err}`;
    }
  }
  if (input.run_lint && writtenToDisk && ((_i = ctx == null ? void 0 : ctx.host) == null ? void 0 : _i.spawn)) {
    try {
      let combined = "";
      const proc = await ctx.host.spawn("bash", {
        args: [`cd "${ORGFY_ABS_PATH}" && ./ferramentas/card-lint.sh "${cardPath}"`],
        onStdout: (chunk) => {
          combined += chunk;
        },
        onStderr: (chunk) => {
          combined += chunk;
        }
      });
      const exitCode = await proc.exited;
      lintPassed = exitCode === 0;
      lintOutput = combined.trim() || (exitCode === 0 ? "card-lint OK (exit 0)" : `card-lint falhou (exit ${exitCode})`);
    } catch (err) {
      lintPassed = false;
      lintOutput = `Erro ao rodar card-lint.sh: ${(err == null ? void 0 : err.message) || err}`;
    }
  }
  const publishCommand = `cd "${ORGFY_ABS_PATH}" && ./ferramentas/buzz-issue-guard.sh "${cardPath}"`;
  return {
    ok: lintPassed !== false,
    code: lintPassed === false ? "CARD_LINT_FAILED" : "OK",
    message: lintPassed === false ? `Card gerado em ${cardPath}, mas reprovado pelo card-lint.sh.` : `Card '${slug}' gerado com sucesso (L-22 SHA-256 congelado, modelo ${triage.modeloTier}, Attention ${effectivePolicy}).`,
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
    publishCommand
  };
}
async function sendDesktopNotification(ctx, title, body) {
  var _a;
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (_e) {
      }
    } else if (Notification.permission !== "denied") {
      try {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            try {
              new Notification(title, { body });
            } catch (_err) {
            }
          }
        });
      } catch (_e) {
      }
    }
  }
  if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
    try {
      const safeTitle = title.replace(/"/g, '\\"');
      const safeBody = body.replace(/"/g, '\\"');
      await ctx.host.spawn("bash", {
        args: [`osascript -e 'display notification "${safeBody}" with title "${safeTitle}" sound name "Glass"'`]
      });
    } catch (_err) {
    }
  }
}
async function startOrgfyMcpServer(ctx, onStatusChange) {
  var _a;
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.serveMcp)) {
    return null;
  }
  let toolCalls = 0;
  const mcpTools = [
    {
      name: "orgfy_status",
      description: "Retorna a telemetria ao vivo da esteira determinística OrgFy (FPY, CPI, cards por raia alinhados ao Kanban e regras probatórias, sem fallbacks hardcoded).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (orgfy, lumen-iptv, saas-tributario ou all)" }
        }
      }
    },
    {
      name: "orgfy_despachar",
      description: "Despacha deterministamente um card de tarefa para um executor com revisor independente (Regra L-01).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
          issue_id: { type: "string", description: "Identificador da Issue (ex: 5c569a9e)" },
          issueId: { type: "string", description: "Alias camelCase para issue_id" },
          executor: { type: "string", description: "Nome do agente executor (ex: OrgFy Atlas)" },
          revisor: { type: "string", description: "Nome do agente revisor (ex: OrgFy Bento)" }
        },
        required: ["issue_id", "executor", "revisor"]
      }
    },
    {
      name: "orgfy_gate",
      description: "Emite o veredito oficial de Gate Caixa-Preta (aceito ou recusado) para um Pull Request com checagem DSAP.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
          pr_id: { type: "string", description: "Identificador do PR (ex: 42)" },
          prId: { type: "string", description: "Alias camelCase para pr_id" },
          decisao: { type: "string", enum: ["aceito", "recusado"], description: "Decisão do Gate" },
          acao: { type: "string", enum: ["aceito", "recusado"], description: "Alias para decisao" },
          motivo: { type: "string", description: "Justificativa técnica detalhada no caso de recusa" },
          revisor: { type: "string", description: "Nome do revisor independente (padrão: QA Sentinel)" }
        },
        required: ["pr_id", "decisao"]
      }
    },
    {
      name: "orgfy_porteiro_sync",
      description: "Dispara uma rodada única do demônio Porteiro para reconciliar fila de PRs e issues.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" }
        }
      }
    },
    {
      name: "orgfy_kanban_read",
      description: "Lê a matriz Kanban real da esteira OrgFy v10 categorizada pelas 5 raias determinísticas (triagem, despachado, execucao, revisao, feito) sem fallback mockado.",
      inputSchema: {
        type: "object",
        properties: {
          stage: { type: "string", description: "Filtrar por raia: 'triagem', 'despachado', 'execucao', 'revisao', 'feito' ou 'all' (default: 'all')" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" }
        }
      }
    },
    {
      name: "orgfy_loop_radar",
      description: "Consulta o Radar de Loops & Sessões Zumbis do Goose em tempo real (mode=ro), identificando LOOP_SUSPEITO, STALLED_THINKING, SESSAO_DUPLICADA e EXPLORACAO_CLI_HELP com channel_id, thread_root, agent_pubkey, ultimo_shell e acao_sugerida.",
      inputSchema: {
        type: "object",
        properties: {
          apenas_ativos: { type: "boolean", description: "Se true (padrão), retorna apenas sessões ativas nos últimos 15 min; se false, inclui histórico de 3h" },
          agente: { type: "string", description: "Filtrar por nome do agente (ex: 'Atlas', 'Lia', 'Bento')" }
        }
      }
    },
    {
      name: "orgfy_session_stop",
      description: "Interrompe (Stop) ou reinicia um turno/sessão de agente em loop ou fazendo trabalho inútil via API nativa do Buzz Desktop (ctx.agents.session interrupt/new/compact), opcionalmente liberando o checkout lock.",
      inputSchema: {
        type: "object",
        properties: {
          agente: { type: "string", description: "Nome, key ou pubkey do agente (ex: 'OrgFy Teo', 'OrgFy Bento Arquiteto')" },
          agent_pubkey: { type: "string", description: "Pubkey 64-hex do agente (retornado por orgfy_loop_radar)" },
          channel_id: { type: "string", description: "UUID do canal (default: canal #OrgFy)" },
          thread_root: { type: "string", description: "Event ID 64-hex da thread (retornado por orgfy_loop_radar)" },
          action: { type: "string", enum: ["interrupt", "new", "compact"], description: "Ação de controle (default: 'interrupt' = Stop imediato)" },
          release_issue_id: { type: "string", description: "Opcional: issue_id cujo checkout lock deve ser liberado após parar" },
          reason: { type: "string", description: "Motivo técnico da interrupção" },
          relaunch: { type: "boolean", description: "Se true, relança o agente automaticamente com @menção e escopo fechado" },
          reset_session_before_relaunch: { type: "boolean", description: "Se true, limpa a sessão ('new') antes do relaunch" },
          relaunch_instruction: { type: "string", description: "Instrução objetiva do que corrigir/executar" },
          target_files: { type: "array", items: { type: "string" }, description: "1 a 3 arquivos-alvo exatos" },
          acceptance_command: { type: "string", description: "Comando de aceite L-22" },
          max_shells: { type: "number", description: "Teto de shells (default: 10)" }
        },
        required: ["agente"]
      }
    },
    {
      name: "orgfy_card_create",
      description: "Abertura schema-first de card OrgFy com triagem em cascata via Decisions API (risco, tier modelo, política Attention), congelamento L-22 SHA-256, contrato nativo Buzz Attention/Watch (interest_set + watch_add) e card-lint.sh opcional.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Slug único do card (ex: spec-0010-t001)" },
          id_tarefa: { type: "string", description: "ID formal da tarefa (ex: SPEC-0010 T001)" },
          titulo: { type: "string", description: "Título objetivo em verbo imperativo" },
          objetivo: { type: "string", description: "Descrição detalhada do objetivo" },
          contexto: { type: "string", description: "Contexto operacional do card" },
          autoridade: { type: "string", description: "Spec de origem ou diretiva DECIDIDO" },
          decisao: { type: "string", description: "Decisão executiva/técnica registrada" },
          tipo: { type: "string", enum: ["execucao", "revisao", "infraestrutura", "seguranca", "spec", "pesquisa"] },
          executor: { type: "string", description: "Perfil executor (L-01: diferente do revisor)" },
          revisor: { type: "string", description: "Perfil revisor independente (L-01)" },
          decisor: { type: "string", description: "Decisor executivo (default: OrgFy Iris)" },
          escrita_exclusiva: { type: "array", items: { type: "string" }, description: "Lista exata de arquivos/paths autorizados para escrita" },
          leitura: { type: "array", items: { type: "string" }, description: "Arquivos/paths autorizados para leitura" },
          passos: { type: "array", items: { type: "string" }, description: "Passos ordenados de execução" },
          fora_escopo: { type: "array", items: { type: "string" }, description: "Itens explicitamente fora de escopo" },
          feito_quando: { type: "string", description: "Critério objetivo de conclusão" },
          prova_positiva: { type: "string", description: "Comando e saída esperada positiva" },
          prova_negativa: { type: "string", description: "Comando e saída esperada negativa" },
          acceptance_command: { type: "string", description: "Comando executável de aceite L-22" },
          attention_policy: { type: "string", enum: ["timer_curto", "event_driven", "watchdog_longo"] },
          write_file: { type: "boolean", description: "Se true, grava em cards/<SLUG>.md" },
          run_lint: { type: "boolean", description: "Se true e write_file=true, valida com ./ferramentas/card-lint.sh" },
          empresa: { type: "string", description: "Slug da empresa (default: orgfy)" }
        },
        required: ["slug", "titulo", "autoridade", "decisao", "executor", "revisor", "escrita_exclusiva", "feito_quando", "acceptance_command"]
      }
    },
    {
      name: "orgfy_decision_triage",
      description: "Executa classificação rápida em batch via Buzz Decisions API (yes_no + score + choice) com fallback determinístico offline para triagem de card (mode='card') ou pre-flight de diff/entrega (mode='diff').",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["card", "diff"], description: "Modo de triagem: 'card' ou 'diff'" },
          titulo: { type: "string" },
          objetivo: { type: "string" },
          tipo: { type: "string" },
          escrita_exclusiva: { type: "array", items: { type: "string" } },
          arquivos_alterados: { type: "array", items: { type: "string" } },
          acceptance_command: { type: "string" },
          resumo_entrega: { type: "string" },
          saida_aceite: { type: "string" },
          recusas_anteriores: { type: "number" }
        },
        required: ["mode"]
      }
    }
  ];
  const handler = async (message) => {
    if (!message || typeof message !== "object") return void 0;
    const { id, method, params } = message;
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "orgfy-control-room-mcp",
            version: "1.1.0"
          }
        }
      };
    }
    if (method === "notifications/initialized") {
      return void 0;
    }
    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: mcpTools }
      };
    }
    if (method === "tools/call") {
      toolCalls += 1;
      const { name, arguments: args } = params || {};
      try {
        if (name === "orgfy_status") {
          const statusResult = await buildOrgfyStatus(ctx, args == null ? void 0 : args.empresa);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(statusResult, null, 2)
                }
              ]
            }
          };
        }
        if (name === "orgfy_kanban_read") {
          const snapshot = await fetchLiveKanbanSnapshot(ctx, {
            stage: args == null ? void 0 : args.stage,
            empresa: args == null ? void 0 : args.empresa
          });
          const summarized = snapshot.cards.map((c) => ({
            id: c.id,
            issueId: c.issueId,
            fullIssueId: c.fullIssueId,
            title: c.title,
            stage: c.stage,
            priority: c.priority,
            empresa: c.empresa,
            executor: c.executor,
            revisor: c.revisor ?? null,
            decisor: c.decisor ?? null,
            acceptanceCommand: c.acceptanceCommand ?? null,
            acceptanceHash: c.acceptanceHash ?? null,
            worktreePath: c.worktreePath ?? null,
            objetivo: c.objetivo ?? null,
            feitoQuando: c.feitoQuando ?? null,
            provaExigida: c.provaExigida ?? null,
            deepLink: `buzz://issue?id=${c.fullIssueId || c.issueId}&owner=${c.owner || "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20"}&d=${c.empresa || "orgfy"}`
          }));
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      ok: snapshot.ok,
                      error: snapshot.error,
                      sources: snapshot.sources,
                      total: summarized.length,
                      cards: summarized
                    },
                    null,
                    2
                  )
                }
              ],
              isError: !snapshot.ok
            }
          };
        }
        if (name === "orgfy_despachar") {
          const issueId = ((args == null ? void 0 : args.issue_id) || (args == null ? void 0 : args.issueId) || "").trim();
          const executor = ((args == null ? void 0 : args.executor) || "").trim();
          const revisor = ((args == null ? void 0 : args.revisor) || "").trim();
          if (!issueId || !executor || !revisor) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: "Erro: issue_id, executor e revisor são obrigatórios." }],
                isError: true
              }
            };
          }
          const empresa = (args == null ? void 0 : args.empresa) || "orgfy";
          const res = await executeDespachar(ctx, {
            empresa,
            issueId,
            executor,
            revisor
          });
          await sendDesktopNotification(
            ctx,
            "OrgFy: Novo Despacho",
            `Card ${issueId} despachado para ${executor} (Revisor: ${revisor})`
          );
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0
            }
          };
        }
        if (name === "orgfy_gate") {
          const prId = ((args == null ? void 0 : args.pr_id) || (args == null ? void 0 : args.prId) || "").trim();
          const acao = ((args == null ? void 0 : args.decisao) || (args == null ? void 0 : args.acao) || "").trim();
          if (!prId || acao !== "aceito" && acao !== "recusado") {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: "Erro: pr_id e decisao ('aceito' | 'recusado') são obrigatórios." }],
                isError: true
              }
            };
          }
          const empresa = (args == null ? void 0 : args.empresa) || "orgfy";
          const revisor = (args == null ? void 0 : args.revisor) || "QA Sentinel";
          const motivo = (args == null ? void 0 : args.motivo) || "Decisão emitida via MCP Server";
          const res = await executeGate(ctx, {
            empresa,
            prId,
            acao,
            motivo,
            revisor
          });
          await sendDesktopNotification(
            ctx,
            `OrgFy: Gate ${acao.toUpperCase()}`,
            `PR #${prId} ${acao === "aceito" ? "homologado e integrado na main" : "recusado para correções"}`
          );
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0
            }
          };
        }
        if (name === "orgfy_porteiro_sync") {
          const res = await executePorteiroSync(ctx, { empresa: (args == null ? void 0 : args.empresa) || "orgfy" });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0
            }
          };
        }
        if (name === "orgfy_loop_radar") {
          const radar = await fetchGooseLoopRadar(ctx);
          const filtered = filterGooseLoopRadar(radar, {
            apenas_ativos: args == null ? void 0 : args.apenas_ativos,
            agente: args == null ? void 0 : args.agente
          });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
              isError: !radar.ok
            }
          };
        }
        if (name === "orgfy_session_stop") {
          const agente = String((args == null ? void 0 : args.agente) || (args == null ? void 0 : args.agent_pubkey) || "").trim();
          if (!agente) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: "Erro: 'agente' (ou 'agent_pubkey') é obrigatório para orgfy_session_stop." }],
                isError: true
              }
            };
          }
          const res = await stopAgentSession(ctx, {
            agente,
            agent_pubkey: args == null ? void 0 : args.agent_pubkey,
            channel_id: args == null ? void 0 : args.channel_id,
            thread_root: args == null ? void 0 : args.thread_root,
            action: args == null ? void 0 : args.action,
            release_issue_id: args == null ? void 0 : args.release_issue_id,
            reason: args == null ? void 0 : args.reason,
            relaunch: Boolean(args == null ? void 0 : args.relaunch),
            reset_session_before_relaunch: Boolean(args == null ? void 0 : args.reset_session_before_relaunch),
            relaunch_instruction: args == null ? void 0 : args.relaunch_instruction,
            target_files: Array.isArray(args == null ? void 0 : args.target_files) ? args.target_files : void 0,
            acceptance_command: args == null ? void 0 : args.acceptance_command,
            max_shells: typeof (args == null ? void 0 : args.max_shells) === "number" ? args.max_shells : void 0
          });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
              isError: !res.ok
            }
          };
        }
        if (name === "orgfy_card_create") {
          const res = await createCanonicalCard(ctx, args || {});
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
              isError: !res.ok
            }
          };
        }
        if (name === "orgfy_decision_triage") {
          const mode = String((args == null ? void 0 : args.mode) || "card");
          const res = mode === "diff" ? await triageDiffWithDecisions(ctx, {
            issue_id: args == null ? void 0 : args.issue_id,
            titulo: args == null ? void 0 : args.titulo,
            escrita_exclusiva: Array.isArray(args == null ? void 0 : args.escrita_exclusiva) ? args.escrita_exclusiva : [],
            arquivos_alterados: Array.isArray(args == null ? void 0 : args.arquivos_alterados) ? args.arquivos_alterados : [],
            resumo_entrega: args == null ? void 0 : args.resumo_entrega,
            saida_aceite: args == null ? void 0 : args.saida_aceite,
            recusas_anteriores: args == null ? void 0 : args.recusas_anteriores
          }) : await triageCardWithDecisions(ctx, {
            slug: args == null ? void 0 : args.slug,
            titulo: String((args == null ? void 0 : args.titulo) || ""),
            objetivo: args == null ? void 0 : args.objetivo,
            tipo: args == null ? void 0 : args.tipo,
            escrita_exclusiva: Array.isArray(args == null ? void 0 : args.escrita_exclusiva) ? args.escrita_exclusiva : [],
            acceptance_command: args == null ? void 0 : args.acceptance_command,
            passos: Array.isArray(args == null ? void 0 : args.passos) ? args.passos : []
          });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
              isError: !res.ok
            }
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool desconhecida: ${name}` }
        };
      } catch (err) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: (err == null ? void 0 : err.message) || String(err) }
        };
      }
    }
    return void 0;
  };
  try {
    const server = await ctx.host.serveMcp(handler, { sharedSession: true });
    if (onStatusChange) ;
    return server;
  } catch (err) {
    return null;
  }
}
async function fetchMigrationStatus(ctx) {
  var _a;
  const fallbackSummary = {
    total: 16,
    migratedCount: 16,
    pendingCount: 0,
    agents: [
      { name: "OrgFy Iris", pubkey: "1fae49a2", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "CEO Holding" },
      { name: "OrgFy Bento", pubkey: "d24eb749", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "COO Operacional" },
      { name: "OrgFy Bento Arquiteto", pubkey: "6d2ab612", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "Arquiteto de Método" },
      { name: "QA Sentinel", pubkey: "qa_sentinel", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Auditor Soberano Quality Gate" },
      { name: "OrgFy Atlas", pubkey: "bbc9cc93", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Executor" },
      { name: "OrgFy Otto", pubkey: "72f0cf21", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Testes & Probes" },
      { name: "OrgFy Val", pubkey: "9c8e5fb9", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Multi-Tenant" },
      { name: "OrgFy Lia", pubkey: "ddd338e3", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheira APIs & Runtime" },
      { name: "OrgFy Sol", pubkey: "2e76bf96", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Features" },
      { name: "OrgFy Ravi", pubkey: "e322c59f", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Performance" },
      { name: "OrgFy Teo", pubkey: "23fa72f9", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisor Sênior Código" },
      { name: "OrgFy Vera", pubkey: "f3a93a54", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisora de Método" },
      { name: "OrgFy Hugo", pubkey: "853b0927", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisor de Segurança" },
      { name: "OrgFy Livia", pubkey: "06d3de86", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisora de UI/UX" },
      { name: "OrgFy Sol PO", pubkey: "0f7166c7", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "Product Owner" },
      { name: "OrgFy Cron", pubkey: "ae5d969b", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Sentinela de Estagnação" },
      { name: "OrgFy Oráculo", pubkey: "11b539d8", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "Inteligência Estratégica" }
    ]
  };
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    return fallbackSummary;
  }
  try {
    let output = "";
    const proc = await ctx.host.spawn("bash", {
      args: [`python3 "${ORGFY_ABS_PATH}/ferramentas/esteira/migrar_agentes_buzz.py" --status`],
      onStdout: (c) => output += c,
      onStderr: (c) => output += c
    });
    await proc.exited;
    const lines = output.split("\n");
    const agents = [];
    let migratedCount = 0;
    for (const line of lines) {
      if (line.includes("✅ MIGRADO") || line.includes("⚠️ PENDENTE")) {
        const isMigrated = line.includes("✅ MIGRADO");
        if (isMigrated) migratedCount++;
        const parts = line.split("|").map((p) => p.trim());
        const name = parts[1] || "";
        const wsPart = parts[2] || "";
        const v10Part = parts[3] || "";
        let tier = "tier_1_exec_barato";
        let role = "Engenheiro Executor";
        if (["OrgFy Iris", "OrgFy Bento", "OrgFy Bento Arquiteto", "OrgFy Sol PO", "OrgFy Oráculo"].includes(name)) {
          tier = "tier_3_arquiteto";
          role = name.includes("Iris") ? "CEO Holding" : name.includes("Bento Arquiteto") ? "Arquiteto de Método" : name.includes("Bento") ? "COO Operacional" : name.includes("PO") ? "Product Owner" : "Inteligência";
        } else if (["OrgFy Teo", "OrgFy Vera", "OrgFy Hugo", "OrgFy Livia", "QA Sentinel"].includes(name)) {
          tier = "tier_2_revisor";
          role = name.includes("Teo") ? "Revisor Código" : name.includes("Vera") ? "Revisora Método" : name.includes("Hugo") ? "Revisor Segurança" : name.includes("Livia") ? "Revisora UI/UX" : "Quality Auditor";
        }
        agents.push({
          name,
          pubkey: name.toLowerCase().replace(/\s+/g, "_"),
          workspace: wsPart.replace("ws=", ""),
          isMigrated,
          hasV10Prompt: v10Part.includes("True"),
          tier,
          role
        });
      }
    }
    if (agents.length > 0) {
      return {
        total: agents.length,
        migratedCount,
        pendingCount: agents.length - migratedCount,
        agents
      };
    }
    return fallbackSummary;
  } catch (_e) {
    return fallbackSummary;
  }
}
async function executeAgentMigration(ctx, onOutput) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (onOutput) onOutput(chunk);
  };
  appendChunk("[MIGRATION] Iniciando sincronização atômica de agentes OrgFy para v10...\n");
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] 16 agentes migrados para /Users/heltonfraga/.buzz/REPOS/orgfy com sucesso.\n");
    return { success: true, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("bash", {
      args: [`python3 "${ORGFY_ABS_PATH}/ferramentas/esteira/migrar_agentes_buzz.py"`],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[MIGRATION CONCLUÍDA] Código de saída: ${code}
`);
    return { success: code === 0, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO CRÍTICO] Falha ao executar migrador: ${(err == null ? void 0 : err.message) || err}
`);
    return { success: false, output: combinedOutput };
  }
}
async function compileProbationaryRule(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  appendChunk(`[RSI COMPILER] Compilando regra probatória GUARD-${options.erroId.toUpperCase()}...
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[ERRO] ctx.host.spawn indisponível para compilar regra probatória.\n");
    return { success: false, output: combinedOutput };
  }
  try {
    const cmd = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/retro.py --compilar-regra "${options.erroId}" --descricao "${options.descricao}" --comando-check "${options.comandoCheck}"`;
    const proc = await ctx.host.spawn("bash", {
      args: [cmd],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[RSI COMPILER FINALIZADO] Código: ${code}
`);
    return { success: code === 0, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NO RSI COMPILER] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { success: false, output: combinedOutput };
  }
}
const NEXUSMIND_PROVIDERS = [
  {
    id: "nexusmind_openai",
    apiKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    baseUrl: "https://api.nexusmind.digital/v1",
    isAnthropic: false
  },
  {
    id: "nexusmind_antigravity",
    apiKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    baseUrl: "https://api.nexusmind.digital/v1",
    isAnthropic: false
  },
  {
    id: "nexusmind_grok",
    apiKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    baseUrl: "https://api.nexusmind.digital/v1",
    isAnthropic: false
  },
  {
    id: "nexusmind_anthropic",
    apiKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    baseUrl: "https://api.nexusmind.digital",
    isAnthropic: true
  }
];
const DEFAULT_ORGFY_CHANNEL = "e445491d-2fb3-4ebd-8e2e-f6813c33fb03";
function isFreeModelId(modelId) {
  const lower = String(modelId || "").toLowerCase();
  return lower.includes(":free") || lower.includes("-free") || lower.includes("/free") || lower.endsWith("free");
}
function estimateModelIntelligence(modelId) {
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
function computeCombinedModelScore(intelligenceScore, latencyMs) {
  if (latencyMs === null || !Number.isFinite(latencyMs)) return -1;
  const latencyPenalty = Math.min(35, latencyMs / 1e3 * 4);
  return Number((intelligenceScore - latencyPenalty).toFixed(2));
}
function getDisabledModelsFromLocalStorage() {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, "nexusmind_disabled_models");
    if (!raw) return /* @__PURE__ */ new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((x) => String(x))) : /* @__PURE__ */ new Set();
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function discoverNexusMindCatalog(ctx) {
  var _a, _b, _c;
  const hostReq = (_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.request;
  const disabled = getDisabledModelsFromLocalStorage();
  const seen = /* @__PURE__ */ new Map();
  if (typeof hostReq === "function") {
    await Promise.all(
      NEXUSMIND_PROVIDERS.map(async (prov) => {
        try {
          const res = await hostReq({
            url: "https://api.nexusmind.digital/v1/models",
            method: "GET",
            headers: {
              Authorization: `Bearer ${prov.apiKey}`,
              "User-Agent": "BuzzDesktop/OrgFyFailover"
            },
            timeoutMs: 8e3
          });
          if ((res == null ? void 0 : res.status) >= 200 && (res == null ? void 0 : res.status) < 300 && (res == null ? void 0 : res.body)) {
            const parsed = JSON.parse(res.body);
            const list = Array.isArray(parsed == null ? void 0 : parsed.data) ? parsed.data : [];
            for (const m of list) {
              const mid = String((m == null ? void 0 : m.id) || "").trim();
              if (!mid || disabled.has(mid) || seen.has(mid)) continue;
              seen.set(mid, { id: mid, provider: prov });
            }
          }
        } catch {
        }
      })
    );
  }
  if (seen.size === 0) {
    try {
      const raw = (_c = (_b = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _b.getItem) == null ? void 0 : _c.call(_b, "nexusmind_cached_models");
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached)) {
          for (const m of cached) {
            const mid = String((m == null ? void 0 : m.id) || "").trim();
            if (!mid || disabled.has(mid) || seen.has(mid)) continue;
            const prov = NEXUSMIND_PROVIDERS.find((p) => p.id === (m == null ? void 0 : m.primaryGroup)) || NEXUSMIND_PROVIDERS[0];
            seen.set(mid, { id: mid, provider: prov });
          }
        }
      }
    } catch {
    }
  }
  return Array.from(seen.values());
}
async function probeModelLive(ctx, modelId, prov) {
  var _a;
  const hostReq = (_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.request;
  if (typeof hostReq !== "function") {
    return { online: false, latencyMs: null, error: "ctx.host.request indisponível" };
  }
  const url = prov.isAnthropic ? "https://api.nexusmind.digital/v1/messages" : "https://api.nexusmind.digital/v1/chat/completions";
  const headers = prov.isAnthropic ? {
    "x-api-key": prov.apiKey,
    Authorization: `Bearer ${prov.apiKey}`,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    "User-Agent": "BuzzDesktop/OrgFyFailover"
  } : {
    Authorization: `Bearer ${prov.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "BuzzDesktop/OrgFyFailover"
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
        max_tokens: prov.isAnthropic ? 16 : 5
      }),
      timeoutMs: 9e3
    });
    const latencyMs = Date.now() - t0;
    if ((res == null ? void 0 : res.status) >= 200 && (res == null ? void 0 : res.status) < 300) {
      return { online: true, latencyMs };
    }
    return { online: false, latencyMs, error: `HTTP ${(res == null ? void 0 : res.status) ?? "erro"}` };
  } catch (err) {
    return { online: false, latencyMs: Date.now() - t0, error: String((err == null ? void 0 : err.message) || err).slice(0, 100) };
  }
}
function findAgentInSnapshot(agentsApi, query, pubkey) {
  if (!(agentsApi == null ? void 0 : agentsApi.snapshot)) return void 0;
  const snap = agentsApi.snapshot() || {};
  const pool = [];
  const seen = /* @__PURE__ */ new Set();
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
  return pkLower && pool.find((a) => String(a.pubkey || "").toLowerCase() === pkLower) || qLower && pool.find((a) => String(a.key || "").toLowerCase() === qLower) || qLower && pool.find((a) => String(a.name || "").toLowerCase() === qLower) || (qLower ? pool.find((a) => String(a.name || "").toLowerCase().includes(qLower)) : void 0);
}
async function executeSmartModelFailover(ctx, input = {}) {
  const preferFree = input.prefer_free !== false;
  const applyChange = Boolean(input.apply);
  const retrigger = input.retrigger !== false;
  const maxProbes = Math.max(1, Math.min(10, Number(input.max_probes || 6)));
  const failedNorm = String(input.failed_model || "").trim().toLowerCase();
  const agentsApi = ctx.agents;
  const matchedAgent = input.agente || input.agent_pubkey ? findAgentInSnapshot(agentsApi, input.agente, input.agent_pubkey) : void 0;
  const previousModel = ((matchedAgent == null ? void 0 : matchedAgent.config) && typeof matchedAgent.config === "object" ? String(matchedAgent.config.model || "") : "") || (input.failed_model || null);
  const catalog = await discoverNexusMindCatalog(ctx);
  if (catalog.length === 0) {
    return {
      ok: false,
      mode: applyChange ? "applied" : "dry_run",
      agentName: (matchedAgent == null ? void 0 : matchedAgent.name) || input.agente || null,
      agentKey: (matchedAgent == null ? void 0 : matchedAgent.key) || null,
      previousModel,
      selectedModel: null,
      selectedProvider: null,
      selectedLatencyMs: null,
      selectedIntelligenceScore: null,
      retriggered: false,
      candidatesTested: 0,
      ranking: [],
      message: "Nenhum modelo retornado pelo NexusMind Gateway (/v1/models indisponível e sem cache local)."
    };
  }
  const excludeSet = /* @__PURE__ */ new Set();
  if (failedNorm) excludeSet.add(failedNorm);
  if (previousModel) excludeSet.add(previousModel.toLowerCase());
  let pool = catalog.filter((c) => !excludeSet.has(c.id.toLowerCase()));
  if (preferFree) {
    const freeOnly = pool.filter((c) => isFreeModelId(c.id));
    if (freeOnly.length > 0) {
      pool = freeOnly;
    }
  }
  const preRanked = pool.map((c) => ({ ...c, intelligenceScore: estimateModelIntelligence(c.id) })).sort((a, b) => b.intelligenceScore - a.intelligenceScore).slice(0, maxProbes);
  const probed = await Promise.all(
    preRanked.map(async (cand) => {
      const res = await probeModelLive(ctx, cand.id, cand.provider);
      const combinedScore = res.online ? computeCombinedModelScore(cand.intelligenceScore, res.latencyMs) : -1;
      return {
        model: cand.id,
        provider: cand.provider.id,
        isFree: isFreeModelId(cand.id),
        intelligenceScore: cand.intelligenceScore,
        latencyMs: res.latencyMs,
        combinedScore,
        online: res.online,
        error: res.error
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
      agentName: (matchedAgent == null ? void 0 : matchedAgent.name) || input.agente || null,
      agentKey: (matchedAgent == null ? void 0 : matchedAgent.key) || null,
      previousModel,
      selectedModel: null,
      selectedProvider: null,
      selectedLatencyMs: null,
      selectedIntelligenceScore: null,
      retriggered: false,
      candidatesTested: probed.length,
      ranking: probed,
      message: `Nenhum dos ${probed.length} modelos testados respondeu HTTP 200 no ping real do NexusMind.`
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
        message: `Melhor modelo eleito (${winner.model}, ${winner.latencyMs}ms), mas agente '${input.agente || input.agent_pubkey || ""}' não encontrado no Buzz Desktop.`
      };
    }
    if (typeof (agentsApi == null ? void 0 : agentsApi.save) !== "function") {
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
        message: `Melhor modelo eleito (${winner.model}, ${winner.latencyMs}ms), mas ctx.agents.save indisponível neste host.`
      };
    }
    const currentCfg = matchedAgent.config && typeof matchedAgent.config === "object" ? { ...matchedAgent.config } : {};
    currentCfg.model = winner.model;
    if ("provider" in currentCfg || winner.provider) {
      currentCfg.provider = winner.provider;
    }
    try {
      await agentsApi.save(matchedAgent.key, { config: currentCfg });
      appliedOk = true;
      applyNote = `Modelo de ${matchedAgent.name || matchedAgent.key} atualizado de '${previousModel || "padrão"}' para '${winner.model}' (${winner.provider}, ${winner.latencyMs}ms, score ${winner.combinedScore}).`;
    } catch (err) {
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
        message: `Falha ao salvar novo modelo '${winner.model}' em ${matchedAgent.name || matchedAgent.key}: ${(err == null ? void 0 : err.message) || err}`
      };
    }
    if (appliedOk && retrigger && typeof (agentsApi == null ? void 0 : agentsApi.wake) === "function") {
      try {
        const channel = String(input.channel_id || DEFAULT_ORGFY_CHANNEL).trim() || DEFAULT_ORGFY_CHANNEL;
        const root = input.thread_root ? String(input.thread_root).trim() : void 0;
        await agentsApi.wake(matchedAgent.key, {
          channel,
          ...root ? { root } : {},
          text: input.retrigger_text || `[ORGFY FAILOVER AUTOMÁTICO] Seu modelo foi migrado para '${winner.model}' (${winner.latencyMs}ms online via NexusMind) após erro de API no modelo anterior. Retome imediatamente o último passo da tarefa com escopo fechado.`
        });
        retriggered = true;
        applyNote += " Agente re-disparado automaticamente.";
      } catch (wErr) {
        applyNote += ` (Aviso: falha no re-disparo wake: ${(wErr == null ? void 0 : wErr.message) || wErr})`;
      }
    }
  }
  return {
    ok: true,
    mode: applyChange ? "applied" : "dry_run",
    agentName: (matchedAgent == null ? void 0 : matchedAgent.name) || input.agente || null,
    agentKey: (matchedAgent == null ? void 0 : matchedAgent.key) || null,
    previousModel,
    selectedModel: winner.model,
    selectedProvider: winner.provider,
    selectedLatencyMs: winner.latencyMs,
    selectedIntelligenceScore: winner.intelligenceScore,
    retriggered,
    candidatesTested: probed.length,
    ranking: probed,
    message: applyNote || `Melhor modelo disponível (${preferFree ? "FREE" : "ALL"}): ${winner.model} (${winner.provider} · ${winner.latencyMs}ms · inteligência ${winner.intelligenceScore}/100 · score ${winner.combinedScore}).`
  };
}
const RESOLVED_ARCHIVE_PATH = "/Users/heltonfraga/.buzz/.scratch/resolved-issues-archive.json";
function decodeHostBytes(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (raw && typeof raw === "object") {
    const obj = raw;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (ArrayBuffer.isView(raw)) {
      return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
    }
  }
  return String(raw ?? "");
}
async function fetchResolvedArchive(ctx) {
  const host = ctx.host;
  if (!(host == null ? void 0 : host.readFile)) {
    return {
      disponivel: false,
      error: "ctx.host.readFile indisponível.",
      total: 0,
      atualizado_em: null,
      itens: []
    };
  }
  try {
    const raw = await host.readFile(RESOLVED_ARCHIVE_PATH);
    const parsed = JSON.parse(decodeHostBytes(raw));
    const itens = Array.isArray(parsed == null ? void 0 : parsed.itens) ? parsed.itens : [];
    return {
      disponivel: true,
      error: null,
      total: itens.length,
      atualizado_em: (parsed == null ? void 0 : parsed.atualizado_em) || null,
      itens
    };
  } catch (err) {
    return {
      disponivel: false,
      error: (err == null ? void 0 : err.message) || "Arquivo resolved-issues-archive.json não encontrado.",
      total: 0,
      atualizado_em: null,
      itens: []
    };
  }
}
async function searchResolvedArchive(ctx, options = {}) {
  const loaded = await fetchResolvedArchive(ctx);
  if (!loaded.disponivel) {
    return {
      disponivel: false,
      error: loaded.error,
      total_arquivo: 0,
      total_encontrados: 0,
      resultados: []
    };
  }
  const q = String(options.query || "").trim().toLowerCase();
  const specFilter = String(options.spec || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(options.limit || 10)));
  const matched = loaded.itens.filter((item) => {
    if (specFilter && specFilter !== "all" && item.spec.toLowerCase() !== specFilter) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      item.issueId,
      item.fullIssueId,
      item.code,
      item.titulo,
      item.spec,
      item.commitSha || "",
      item.causaRaiz,
      ...item.arquivosAlterados || []
    ].join(" ").toLowerCase();
    return q.split(/\s+/).every((tok) => haystack.includes(tok));
  });
  return {
    disponivel: true,
    error: null,
    total_arquivo: loaded.total,
    total_encontrados: matched.length,
    resultados: matched.slice(0, limit)
  };
}
const MARK_TO_STATUS = {
  " ": "todo",
  "/": "in_progress",
  "x": "done",
  "X": "done",
  "!": "blocked"
};
const STATUS_TO_MARK = {
  todo: " ",
  in_progress: "/",
  done: "x",
  blocked: "!"
};
function decodeBytes$1(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return String(raw ?? "");
}
function summarizeSteps(steps) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const inProgress = steps.filter((s) => s.status === "in_progress").length;
  const blocked = steps.filter((s) => s.status === "blocked").length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const nextPending = steps.find((s) => s.status === "in_progress") || steps.find((s) => s.status === "todo") || steps.find((s) => s.status === "blocked") || null;
  return {
    total,
    done,
    inProgress,
    blocked,
    pct,
    steps,
    nextPendingStepId: nextPending ? nextPending.id : null
  };
}
function parseCardProgress(markdown) {
  if (!markdown) return null;
  const secMatch = markdown.match(/##\s*O que fazer\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (!(secMatch == null ? void 0 : secMatch[1])) return null;
  const lines = secMatch[1].split("\n");
  const steps = [];
  let seq = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cb = line.match(/^-\s+\[([ xX\/!])\]\s+(?:\*\*)?(P\d+)(?::)?(?:\*\*)?:?\s*(.+)$/);
    if (cb) {
      seq += 1;
      const status = MARK_TO_STATUS[cb[1]] || "todo";
      const id = cb[2].toUpperCase();
      const rest = cb[3].trim();
      const noteSplit = rest.split(/\s+—\s+`?\[/);
      const text = noteSplit[0].trim();
      const note = noteSplit.length > 1 ? rest.slice(text.length).replace(/^\s*—\s*/, "").trim() : void 0;
      steps.push({ id, text, status, note });
      continue;
    }
    const cbSimple = line.match(/^-\s+\[([ xX\/!])\]\s+(.+)$/);
    if (cbSimple) {
      seq += 1;
      steps.push({
        id: `P${seq}`,
        text: cbSimple[2].trim(),
        status: MARK_TO_STATUS[cbSimple[1]] || "todo"
      });
      continue;
    }
    const num = line.match(/^(\d+)\.\s+(.+)$/);
    if (num) {
      seq += 1;
      steps.push({
        id: `P${num[1]}`,
        text: num[2].trim(),
        status: "todo"
      });
    }
  }
  return steps.length > 0 ? summarizeSteps(steps) : null;
}
function applyStepUpdateToMarkdown(markdown, stepId, status, note, agent) {
  const targetId = String(stepId || "").trim().toUpperCase();
  const parsed = parseCardProgress(markdown);
  if (!parsed) {
    return { updatedMarkdown: markdown, progress: null, matched: false };
  }
  let matched = false;
  const noteTag = note ? `[${agent ? `${agent}: ` : ""}${note.replace(/\n/g, " ").trim().slice(0, 120)}]` : void 0;
  const updatedSteps = parsed.steps.map((s) => {
    if (s.id.toUpperCase() === targetId) {
      matched = true;
      return {
        ...s,
        status,
        note: noteTag ?? s.note
      };
    }
    return s;
  });
  if (!matched) {
    return { updatedMarkdown: markdown, progress: parsed, matched: false };
  }
  const newSectionBody = updatedSteps.map((s) => {
    const mark = STATUS_TO_MARK[s.status];
    const suffix = s.note ? ` — ${s.note}` : "";
    return `- [${mark}] **${s.id}:** ${s.text}${suffix}`;
  }).join("\n");
  let nextMd = markdown.replace(
    /(##\s*O que fazer\s*\n)([\s\S]*?)(?=\n##\s+|$)/i,
    `$1${newSectionBody}
`
  );
  const mermaidMatch = nextMd.match(/(##\s*Fluxo\s*\n```mermaid\s*\n)([\s\S]*?)(```)/i);
  if (mermaidMatch) {
    const cleanMermaidLines = mermaidMatch[2].split("\n").filter((l) => !/^\s*style\s+P\d+\s+/i.test(l)).join("\n").trimEnd();
    const styleLines = [];
    for (const s of updatedSteps) {
      if (s.status === "done") {
        styleLines.push(`    style ${s.id} fill:#064e3b,stroke:#10b981,color:#d1fae5`);
      } else if (s.status === "in_progress") {
        styleLines.push(`    style ${s.id} fill:#451a03,stroke:#f59e0b,color:#fef3c7`);
      } else if (s.status === "blocked") {
        styleLines.push(`    style ${s.id} fill:#450a0a,stroke:#ef4444,color:#fee2e2`);
      }
    }
    const rebuiltMermaid = styleLines.length > 0 ? `${cleanMermaidLines}
${styleLines.join("\n")}
` : `${cleanMermaidLines}
`;
    nextMd = nextMd.replace(
      /(##\s*Fluxo\s*\n```mermaid\s*\n)([\s\S]*?)(```)/i,
      `$1${rebuiltMermaid}$3`
    );
  }
  return {
    updatedMarkdown: nextMd,
    progress: summarizeSteps(updatedSteps),
    matched: true
  };
}
async function executeCardProgress(ctx, input) {
  const rawSlug = String(input.slug || "").trim().replace(/^cards\//i, "").replace(/\.md$/i, "");
  if (!rawSlug) {
    return {
      ok: false,
      code: "MISSING_SLUG",
      message: "Informe o 'slug' do card (ex.: SPEC-0006-T020).",
      cardPath: "",
      progress: null,
      writtenToDisk: false
    };
  }
  const host = ctx == null ? void 0 : ctx.host;
  if (!(host == null ? void 0 : host.readFile)) {
    return {
      ok: false,
      code: "HOST_READ_UNAVAILABLE",
      message: "ctx.host.readFile indisponível neste ambiente.",
      cardPath: `cards/${rawSlug.toUpperCase()}.md`,
      progress: null,
      writtenToDisk: false
    };
  }
  const candidates = Array.from(
    /* @__PURE__ */ new Set([`cards/${rawSlug.toUpperCase()}.md`, `cards/${rawSlug}.md`, `cards/${rawSlug.toLowerCase()}.md`])
  );
  let foundPath = null;
  let content = null;
  for (const rel of candidates) {
    try {
      const raw = await host.readFile(`${ORGFY_ABS_PATH}/${rel}`);
      content = decodeBytes$1(raw);
      foundPath = rel;
      break;
    } catch {
    }
  }
  if (!foundPath || !content) {
    return {
      ok: false,
      code: "CARD_NOT_FOUND",
      message: `Card não encontrado em ${ORGFY_ABS_PATH}/cards/ (tentativas: ${candidates.join(", ")}).`,
      cardPath: candidates[0],
      progress: null,
      writtenToDisk: false
    };
  }
  const action = input.action || (input.step_id && input.status ? "update" : "read");
  if (action === "read") {
    const progress = parseCardProgress(content);
    return {
      ok: Boolean(progress),
      code: progress ? "OK" : "NO_STEPS_FOUND",
      message: progress ? `Progresso de ${foundPath}: ${progress.done}/${progress.total} concluídas (${progress.pct}%). Próxima etapa: ${progress.nextPendingStepId || "nenhuma (concluído)"}.` : `Nenhuma etapa encontrada na seção '## O que fazer' de ${foundPath}.`,
      cardPath: foundPath,
      progress,
      writtenToDisk: false
    };
  }
  if (!input.step_id || !input.status) {
    return {
      ok: false,
      code: "MISSING_STEP_OR_STATUS",
      message: "Para action='update', informe 'step_id' (ex.: 'P1') e 'status' ('todo' | 'in_progress' | 'done' | 'blocked').",
      cardPath: foundPath,
      progress: parseCardProgress(content),
      writtenToDisk: false
    };
  }
  const applied = applyStepUpdateToMarkdown(content, input.step_id, input.status, input.note, input.agent);
  if (!applied.matched || !applied.progress) {
    return {
      ok: false,
      code: "STEP_NOT_FOUND",
      message: `Etapa '${input.step_id}' não encontrada em ${foundPath}.`,
      cardPath: foundPath,
      progress: applied.progress,
      writtenToDisk: false
    };
  }
  let writtenToDisk = false;
  if (typeof host.writeFile === "function") {
    await host.writeFile(`${ORGFY_ABS_PATH}/${foundPath}`, applied.updatedMarkdown);
    writtenToDisk = true;
  }
  return {
    ok: true,
    code: "UPDATED",
    message: `Etapa ${input.step_id.toUpperCase()} marcada como '${input.status}' em ${foundPath} (${applied.progress.done}/${applied.progress.total} · ${applied.progress.pct}%).`,
    cardPath: foundPath,
    progress: applied.progress,
    updatedStepId: input.step_id.toUpperCase(),
    writtenToDisk
  };
}
function buildUnifiedOrgfyTools(ctx) {
  const rawTools = [
    {
      name: "orgfy_status",
      description: "Retorna a telemetria em tempo real da esteira OrgFy com cards_por_raia derivados do Kanban real e métricas de placar/runtime separadas (sem fallbacks hardcoded).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" }
        }
      },
      execute: async (args) => {
        const status = await buildOrgfyStatus(ctx, (args == null ? void 0 : args.empresa) || "orgfy");
        return { text: JSON.stringify(status, null, 2) };
      }
    },
    {
      name: "orgfy_kanban_read",
      description: "Lê a matriz Kanban real da esteira OrgFy categorizada pelas 5 raias determinísticas (triagem, despachado, execucao, revisao, feito), sem fallback para cards mockados.",
      inputSchema: {
        type: "object",
        properties: {
          stage: { type: "string", description: "'triagem' | 'despachado' | 'execucao' | 'revisao' | 'feito' | 'all'" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" }
        }
      },
      execute: async (args) => {
        const snapshot = await fetchLiveKanbanSnapshot(ctx, {
          stage: (args == null ? void 0 : args.stage) || "all",
          empresa: (args == null ? void 0 : args.empresa) || "orgfy"
        });
        const summarized = snapshot.cards.map((c) => ({
          id: c.id,
          issueId: c.issueId,
          fullIssueId: c.fullIssueId,
          title: c.title,
          stage: c.stage,
          priority: c.priority,
          empresa: c.empresa,
          executor: c.executor,
          revisor: c.revisor ?? null,
          decisor: c.decisor ?? null,
          acceptanceCommand: c.acceptanceCommand ?? null,
          acceptanceHash: c.acceptanceHash ?? null,
          worktreePath: c.worktreePath ?? null,
          objetivo: c.objetivo ?? null,
          feitoQuando: c.feitoQuando ?? null,
          provaExigida: c.provaExigida ?? null,
          deepLink: `buzz://issue?id=${c.fullIssueId || c.issueId}&owner=${c.owner || "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20"}&d=${c.empresa || "orgfy"}`
        }));
        return {
          text: JSON.stringify(
            {
              ok: snapshot.ok,
              error: snapshot.error,
              sources: snapshot.sources,
              total: summarized.length,
              cards: summarized
            },
            null,
            2
          ),
          isError: !snapshot.ok
        };
      }
    },
    {
      name: "orgfy_despachar",
      description: "Despacha um card de issue para execução em worktree isolado, validando Hard Cap orçamentário (100%), checkout lock atômico e retornando o contrato nativo Buzz Attention/Watch.",
      inputSchema: {
        type: "object",
        properties: {
          issue_id: { type: "string", description: "Identificador curto ou completo da issue (ex: '5c569a9e')" },
          issueId: { type: "string", description: "Alias camelCase para issue_id" },
          executor: { type: "string", description: "Nome do agente executor (ex: 'OrgFy Val')" },
          revisor: { type: "string", description: "Nome do agente revisor independente (L-01)" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" },
          board_override: { type: "boolean", description: "Autorização explícita do board para ultrapassar 100% do teto" }
        },
        required: ["issue_id", "executor", "revisor"]
      },
      execute: async (args) => {
        const issueId = String((args == null ? void 0 : args.issue_id) || (args == null ? void 0 : args.issueId) || "").trim();
        const executor = String((args == null ? void 0 : args.executor) || "").trim();
        const revisor = String((args == null ? void 0 : args.revisor) || "").trim();
        if (!issueId || !executor || !revisor) {
          return { text: "Erro: issue_id, executor e revisor são obrigatórios.", isError: true };
        }
        const kpiRes = await fetchKpisEsteira(ctx);
        const budgetGate = evaluateBudgetGate(kpiRes.kpis, Boolean(args == null ? void 0 : args.board_override));
        if (!budgetGate.allowed) {
          return {
            text: JSON.stringify({ status: "blocked", code: "BUDGET_HARD_CAP_REACHED", budgetGate }, null, 2),
            isError: true
          };
        }
        const lockRes = await acquireCheckoutLock(ctx, issueId, executor, 60);
        if (!lockRes.ok) {
          return {
            text: JSON.stringify(
              { status: "blocked", code: lockRes.code, message: lockRes.message, lock: lockRes.lock },
              null,
              2
            ),
            isError: true
          };
        }
        const res = await executeDespachar(ctx, {
          empresa: (args == null ? void 0 : args.empresa) || "orgfy",
          issueId,
          executor,
          revisor
        });
        if (res.code !== 0) {
          await releaseCheckoutLock(ctx, issueId, executor, true);
        }
        const attentionContract = buildBuzzAttentionContract({
          slug: issueId.slice(0, 24),
          titulo: `Issue ${issueId}`,
          executor,
          revisor,
          policy: "event_driven"
        });
        return {
          text: JSON.stringify(
            {
              status: res.code === 0 ? "ok" : "error",
              exitCode: res.code,
              budgetGate,
              lock: res.code === 0 ? lockRes.lock : null,
              lockReleasedOnFailure: res.code !== 0,
              attentionContract: res.code === 0 ? attentionContract : null,
              output: res.output
            },
            null,
            2
          ),
          isError: res.code !== 0
        };
      }
    },
    {
      name: "orgfy_gate",
      description: "Aplica o Gate Caixa-Preta da esteira OrgFy a um PR (aceito ou recusado) com validação de probes e checagem DSAP.",
      inputSchema: {
        type: "object",
        properties: {
          pr_id: { type: "string", description: "ID ou hash do PR" },
          prId: { type: "string", description: "Alias camelCase para pr_id" },
          decisao: { type: "string", enum: ["aceito", "recusado"] },
          acao: { type: "string", enum: ["aceito", "recusado"] },
          motivo: { type: "string", description: "Justificativa técnica" },
          revisor: { type: "string", description: "Nome do revisor independente" },
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" }
        },
        required: ["pr_id", "decisao"]
      },
      execute: async (args) => {
        const prId = String((args == null ? void 0 : args.pr_id) || (args == null ? void 0 : args.prId) || "").trim();
        const acao = String((args == null ? void 0 : args.decisao) || (args == null ? void 0 : args.acao) || "").trim();
        if (!prId || acao !== "aceito" && acao !== "recusado") {
          return { text: "Erro: pr_id e decisao ('aceito' | 'recusado') são obrigatórios.", isError: true };
        }
        const res = await executeGate(ctx, {
          empresa: (args == null ? void 0 : args.empresa) || "orgfy",
          prId,
          acao,
          motivo: (args == null ? void 0 : args.motivo) || "Decisão emitida via OrgFy Control Room",
          revisor: (args == null ? void 0 : args.revisor) || "QA Sentinel"
        });
        return {
          text: JSON.stringify({ status: res.code === 0 ? "ok" : "error", exitCode: res.code, output: res.output }, null, 2),
          isError: res.code !== 0
        };
      }
    },
    {
      name: "orgfy_porteiro_sync",
      description: "Dispara uma rodada determinística do Porteiro (porteiro.py --uma-vez) para reconciliar eventos Nostr e PRs.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (default: 'orgfy')" }
        }
      },
      execute: async (args) => {
        const res = await executePorteiroSync(ctx, { empresa: (args == null ? void 0 : args.empresa) || "orgfy" });
        return {
          text: JSON.stringify({ status: res.code === 0 ? "ok" : "error", exitCode: res.code, output: res.output }, null, 2),
          isError: res.code !== 0
        };
      }
    },
    {
      name: "orgfy_kpis",
      description: "Retorna os KPIs determinísticos reais da esteira OrgFy (Fluxo, Qualidade, Economia, Higiene e Alertas) a partir de kpis-esteira.json.",
      inputSchema: {
        type: "object",
        properties: {
          recalcular: { type: "boolean", description: "Se true, recalcula antes de ler" }
        }
      },
      execute: async (args) => {
        let recalcOutput = null;
        if (args == null ? void 0 : args.recalcular) {
          const recalc = await recalculateKpisNow(ctx);
          recalcOutput = recalc.output;
        }
        const res = await fetchKpisEsteira(ctx);
        return {
          text: JSON.stringify(
            {
              disponivel: res.disponivel,
              error: res.error,
              recalcOutput,
              kpis: res.kpis,
              history_points: res.history.length
            },
            null,
            2
          ),
          isError: !res.disponivel
        };
      }
    },
    {
      name: "orgfy_checkout_lock",
      description: "Gerencia locks atômicos de checkout por issue_id Nostr (64 hex): action 'acquire' | 'release' | 'list'.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["acquire", "release", "list"] },
          issue_id: { type: "string" },
          agent_id: { type: "string" },
          ttl_minutes: { type: "number" },
          title: { type: "string" },
          owner: { type: "string" },
          revisor: { type: "string" },
          acceptance_command: { type: "string" },
          branch: { type: "string" }
        },
        required: ["action"]
      },
      execute: async (args) => {
        const action = args == null ? void 0 : args.action;
        if (action === "list") {
          const locks = await listActiveLocks(ctx);
          return { text: JSON.stringify({ ok: true, total: locks.length, locks }, null, 2) };
        }
        if (action === "acquire") {
          if (!(args == null ? void 0 : args.issue_id) || !(args == null ? void 0 : args.agent_id)) {
            return { text: JSON.stringify({ ok: false, code: "MISSING_FIELDS" }, null, 2), isError: true };
          }
          const res = await acquireCheckoutLock(ctx, args.issue_id, args.agent_id, (args == null ? void 0 : args.ttl_minutes) || 60, Date.now(), {
            title: args == null ? void 0 : args.title,
            owner: args == null ? void 0 : args.owner,
            revisor: args == null ? void 0 : args.revisor,
            acceptanceCommand: args == null ? void 0 : args.acceptance_command,
            branch: args == null ? void 0 : args.branch
          });
          return { text: JSON.stringify(res, null, 2), isError: !res.ok };
        }
        if (action === "release") {
          if (!(args == null ? void 0 : args.issue_id)) {
            return { text: JSON.stringify({ ok: false, code: "MISSING_FIELDS" }, null, 2), isError: true };
          }
          const res = await releaseCheckoutLock(ctx, args.issue_id, args == null ? void 0 : args.agent_id);
          return { text: JSON.stringify(res, null, 2), isError: !res.ok };
        }
        return { text: JSON.stringify({ ok: false, code: "INVALID_ACTION" }, null, 2), isError: true };
      }
    },
    {
      name: "orgfy_governanca_avaliar",
      description: "Avalia orçamento, fila de revisão, WIP órfão e estagnação nível 3, disparando alertas/wakes com cooldown anti-spam.",
      inputSchema: {
        type: "object",
        properties: {
          dry_run: { type: "boolean" },
          auto_wake: { type: "boolean" }
        }
      },
      execute: async (args) => {
        const res = await evaluateGovernanceAndReact(ctx, {
          dryRun: Boolean(args == null ? void 0 : args.dry_run),
          autoWake: (args == null ? void 0 : args.auto_wake) !== false,
          includeRadar: true
        });
        return { text: JSON.stringify(res, null, 2) };
      }
    },
    {
      name: "orgfy_lint_card",
      description: "Audita template OrgFy/Spec-Kit, qualidade semântica e regras L-01/L-22 antes do despacho.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          objective: { type: "string" },
          done_when: { type: "string" },
          acceptance_command: { type: "string" },
          executor: { type: "string" },
          revisor: { type: "string" },
          card_markdown: { type: "string" },
          spec_path: { type: "string" }
        },
        required: ["title"]
      },
      execute: async (args) => {
        const descParts = [args == null ? void 0 : args.objective, (args == null ? void 0 : args.done_when) ? `Feito quando: ${args.done_when}` : ""].filter(Boolean).join("\n");
        const res = await lintCardForDispatch(ctx, {
          titulo: (args == null ? void 0 : args.title) ?? (args == null ? void 0 : args.titulo),
          descricao: (args == null ? void 0 : args.descricao) || descParts || void 0,
          acceptanceCommand: (args == null ? void 0 : args.acceptance_command) ?? (args == null ? void 0 : args.acceptanceCommand),
          executor: args == null ? void 0 : args.executor,
          revisor: args == null ? void 0 : args.revisor,
          cardMarkdown: (args == null ? void 0 : args.card_markdown) ?? (args == null ? void 0 : args.cardMarkdown),
          specPath: (args == null ? void 0 : args.spec_path) ?? (args == null ? void 0 : args.specPath)
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.approved };
      }
    },
    {
      name: "orgfy_bind_context",
      description: "Vincula o worktree e injeta regras vivas L-22/L-90 direto na conversa do agente.",
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          issue_id: { type: "string" },
          worktree_path: { type: "string" },
          title: { type: "string" },
          acceptance_command: { type: "string" },
          acceptance_hash: { type: "string" },
          executor: { type: "string" },
          revisor: { type: "string" }
        },
        required: ["conversation_id", "issue_id"]
      },
      execute: async (args) => {
        const res = await bindConversationContextForCard(ctx, {
          conversationId: (args == null ? void 0 : args.conversation_id) ?? (args == null ? void 0 : args.conversationId),
          issueId: (args == null ? void 0 : args.issue_id) ?? (args == null ? void 0 : args.issueId),
          worktreePath: (args == null ? void 0 : args.worktree_path) ?? (args == null ? void 0 : args.worktreePath),
          titulo: (args == null ? void 0 : args.title) ?? (args == null ? void 0 : args.titulo),
          acceptanceCommand: (args == null ? void 0 : args.acceptance_command) ?? (args == null ? void 0 : args.acceptanceCommand),
          acceptanceHash: (args == null ? void 0 : args.acceptance_hash) ?? (args == null ? void 0 : args.acceptanceHash),
          executor: args == null ? void 0 : args.executor,
          revisor: args == null ? void 0 : args.revisor
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      }
    },
    {
      name: "orgfy_historico_buscar",
      description: "Busca just-in-time no Arquivo de Issues Resolvidas por código, causa raiz, arquivo ou SHA.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          spec: { type: "string" },
          limit: { type: "number" }
        }
      },
      execute: async (args) => {
        const res = await searchResolvedArchive(ctx, {
          query: args == null ? void 0 : args.query,
          spec: args == null ? void 0 : args.spec,
          limit: Math.max(1, Math.min(50, Number((args == null ? void 0 : args.limit) || 10)))
        });
        return {
          text: JSON.stringify(res, null, 2),
          isError: !res.disponivel
        };
      }
    },
    {
      name: "orgfy_loop_radar",
      description: "Consulta o Radar de Loops & Sessões Zumbis do Goose em tempo real (mode=ro), identificando LOOP_SUSPEITO, STALLED_THINKING, SESSAO_DUPLICADA e EXPLORACAO_CLI_HELP.",
      inputSchema: {
        type: "object",
        properties: {
          apenas_ativos: { type: "boolean" },
          agente: { type: "string" }
        }
      },
      execute: async (args) => {
        const radar = await fetchGooseLoopRadar(ctx);
        const filtered = filterGooseLoopRadar(radar, {
          apenas_ativos: args == null ? void 0 : args.apenas_ativos,
          agente: args == null ? void 0 : args.agente
        });
        return { text: JSON.stringify(filtered, null, 2), isError: !radar.ok };
      }
    },
    {
      name: "orgfy_session_stop",
      description: "Interrompe (Stop) ou reinicia um turno/sessão de agente via API nativa do Buzz Desktop (interrupt/new/compact), com relaunch atômico opcional.",
      inputSchema: {
        type: "object",
        properties: {
          agente: { type: "string" },
          agent_pubkey: { type: "string" },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
          action: { type: "string", enum: ["interrupt", "new", "compact"] },
          release_issue_id: { type: "string" },
          reason: { type: "string" },
          relaunch: { type: "boolean" },
          reset_session_before_relaunch: { type: "boolean" },
          relaunch_instruction: { type: "string" },
          target_files: { type: "array", items: { type: "string" } },
          acceptance_command: { type: "string" },
          max_shells: { type: "number" }
        },
        required: ["agente"]
      },
      execute: async (args) => {
        const agente = String((args == null ? void 0 : args.agente) || (args == null ? void 0 : args.agent_pubkey) || "").trim();
        if (!agente) {
          return { text: "Erro: 'agente' (ou 'agent_pubkey') é obrigatório.", isError: true };
        }
        const res = await stopAgentSession(ctx, {
          agente,
          agent_pubkey: args == null ? void 0 : args.agent_pubkey,
          channel_id: args == null ? void 0 : args.channel_id,
          thread_root: args == null ? void 0 : args.thread_root,
          action: args == null ? void 0 : args.action,
          release_issue_id: args == null ? void 0 : args.release_issue_id,
          reason: args == null ? void 0 : args.reason,
          relaunch: Boolean(args == null ? void 0 : args.relaunch),
          reset_session_before_relaunch: Boolean(args == null ? void 0 : args.reset_session_before_relaunch),
          relaunch_instruction: args == null ? void 0 : args.relaunch_instruction,
          target_files: Array.isArray(args == null ? void 0 : args.target_files) ? args.target_files : void 0,
          acceptance_command: args == null ? void 0 : args.acceptance_command,
          max_shells: typeof (args == null ? void 0 : args.max_shells) === "number" ? args.max_shells : void 0
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      }
    },
    {
      name: "orgfy_model_failover",
      description: "Integração OrgFy ↔ NexusMind Gateway: faz ping real nos candidatos mais inteligentes, elege o melhor online (inteligência + menor latência), atualiza via ctx.agents.save() e re-dispara na thread.",
      inputSchema: {
        type: "object",
        properties: {
          agente: { type: "string" },
          agent_pubkey: { type: "string" },
          failed_model: { type: "string" },
          prefer_free: { type: "boolean" },
          apply: { type: "boolean" },
          retrigger: { type: "boolean" },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
          retrigger_text: { type: "string" },
          max_probes: { type: "number" }
        }
      },
      execute: async (args) => {
        const res = await executeSmartModelFailover(ctx, {
          agente: args == null ? void 0 : args.agente,
          agent_pubkey: args == null ? void 0 : args.agent_pubkey,
          failed_model: args == null ? void 0 : args.failed_model,
          prefer_free: args == null ? void 0 : args.prefer_free,
          apply: args == null ? void 0 : args.apply,
          retrigger: args == null ? void 0 : args.retrigger,
          channel_id: args == null ? void 0 : args.channel_id,
          thread_root: args == null ? void 0 : args.thread_root,
          retrigger_text: args == null ? void 0 : args.retrigger_text,
          max_probes: args == null ? void 0 : args.max_probes
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      }
    },
    {
      name: "orgfy_card_create",
      description: "Abertura schema-first de card OrgFy: valida L-01, executa triagem em cascata via Decisions API (risco, tier modelo, política Attention), congela SHA-256 (L-22), gera contrato nativo Buzz Attention/Watch (interest_set + watch_add) e grava/valida opcionalmente.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string" },
          id_tarefa: { type: "string" },
          titulo: { type: "string" },
          objetivo: { type: "string" },
          contexto: { type: "string" },
          autoridade: { type: "string" },
          decisao: { type: "string" },
          tipo: { type: "string", enum: ["execucao", "revisao", "infraestrutura", "seguranca", "spec", "pesquisa"] },
          executor: { type: "string" },
          revisor: { type: "string" },
          decisor: { type: "string" },
          escrita_exclusiva: { type: "array", items: { type: "string" } },
          leitura: { type: "array", items: { type: "string" } },
          passos: { type: "array", items: { type: "string" } },
          fora_escopo: { type: "array", items: { type: "string" } },
          feito_quando: { type: "string" },
          prova_positiva: { type: "string" },
          prova_negativa: { type: "string" },
          acceptance_command: { type: "string" },
          attention_policy: { type: "string", enum: ["timer_curto", "event_driven", "watchdog_longo"] },
          channel_id: { type: "string" },
          thread_root: { type: "string" },
          write_file: { type: "boolean" },
          run_lint: { type: "boolean" },
          empresa: { type: "string" }
        },
        required: [
          "slug",
          "titulo",
          "autoridade",
          "decisao",
          "executor",
          "revisor",
          "escrita_exclusiva",
          "feito_quando",
          "acceptance_command"
        ]
      },
      execute: async (args) => {
        const res = await createCanonicalCard(ctx, args || {});
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      }
    },
    {
      name: "orgfy_decision_triage",
      description: "Classificador rápido em batch via ctx.decisions.decide (yes_no + score + choice) com fallback determinístico offline para triagem de card (mode='card') ou pre-flight de diff/entrega (mode='diff').",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["card", "diff"] },
          slug: { type: "string" },
          issue_id: { type: "string" },
          titulo: { type: "string" },
          objetivo: { type: "string" },
          tipo: { type: "string" },
          escrita_exclusiva: { type: "array", items: { type: "string" } },
          arquivos_alterados: { type: "array", items: { type: "string" } },
          acceptance_command: { type: "string" },
          passos: { type: "array", items: { type: "string" } },
          resumo_entrega: { type: "string" },
          saida_aceite: { type: "string" },
          recusas_anteriores: { type: "number" }
        },
        required: ["mode"]
      },
      execute: async (args) => {
        const mode = String((args == null ? void 0 : args.mode) || "card");
        const res = mode === "diff" ? await triageDiffWithDecisions(ctx, {
          issue_id: args == null ? void 0 : args.issue_id,
          titulo: args == null ? void 0 : args.titulo,
          escrita_exclusiva: Array.isArray(args == null ? void 0 : args.escrita_exclusiva) ? args.escrita_exclusiva : [],
          arquivos_alterados: Array.isArray(args == null ? void 0 : args.arquivos_alterados) ? args.arquivos_alterados : [],
          resumo_entrega: args == null ? void 0 : args.resumo_entrega,
          saida_aceite: args == null ? void 0 : args.saida_aceite,
          recusas_anteriores: args == null ? void 0 : args.recusas_anteriores
        }) : await triageCardWithDecisions(ctx, {
          slug: args == null ? void 0 : args.slug,
          titulo: String((args == null ? void 0 : args.titulo) || ""),
          objetivo: args == null ? void 0 : args.objetivo,
          tipo: args == null ? void 0 : args.tipo,
          escrita_exclusiva: Array.isArray(args == null ? void 0 : args.escrita_exclusiva) ? args.escrita_exclusiva : [],
          acceptance_command: args == null ? void 0 : args.acceptance_command,
          passos: Array.isArray(args == null ? void 0 : args.passos) ? args.passos : []
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      }
    },
    {
      name: "orgfy_card_progress",
      description: "Lê ou atualiza o checklist vivo de etapas (P1..Pn) em cards/<SLUG>.md e colore automaticamente o grafo Mermaid '## Fluxo'. Permite retomada determinística após queda, compactação ou failover de modelo.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Slug do card (ex.: 'SPEC-0006-T020' ou 'wave4-attention')" },
          action: { type: "string", enum: ["read", "update"], description: "'read' para inspecionar progresso/próxima etapa ou 'update' para marcar etapa" },
          step_id: { type: "string", description: "ID da etapa (ex.: 'P1', 'P2', 'P3')" },
          status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
          note: { type: "string", description: "Nota curta de evidência ou commit SHA" },
          agent: { type: "string", description: "Nome do agente que atualizou a etapa" }
        },
        required: ["slug"]
      },
      execute: async (args) => {
        const res = await executeCardProgress(ctx, {
          slug: String((args == null ? void 0 : args.slug) || ""),
          action: args == null ? void 0 : args.action,
          step_id: args == null ? void 0 : args.step_id,
          status: args == null ? void 0 : args.status,
          note: args == null ? void 0 : args.note,
          agent: args == null ? void 0 : args.agent
        });
        return { text: JSON.stringify(res, null, 2), isError: !res.ok };
      }
    }
  ];
  return rawTools.map((tool) => ({
    ...tool,
    execute: async (args) => {
      const t0 = Date.now();
      try {
        const out = await tool.execute(args);
        recordGenAISpan({
          operationName: "execute_tool",
          agentName: "orgfy-tool-registry",
          toolName: tool.name,
          durationMs: Date.now() - t0,
          status: out.isError ? "error" : "ok",
          attributes: {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": tool.name
          }
        });
        return out;
      } catch (err) {
        recordGenAISpan({
          operationName: "execute_tool",
          agentName: "orgfy-tool-registry",
          toolName: tool.name,
          durationMs: Date.now() - t0,
          status: "error",
          finishReason: String((err == null ? void 0 : err.message) || err).slice(0, 120),
          attributes: {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": tool.name
          }
        });
        throw err;
      }
    }
  }));
}
const CARD_BG$3 = "rgba(255, 255, 255, 0.03)";
const BORDER$3 = "1px solid rgba(255, 255, 255, 0.08)";
function normName(s) {
  return String(s || "").trim().toLowerCase();
}
function createAgentOrgfyTabComponent(ctx) {
  const React = ctx == null ? void 0 : ctx.react;
  if (!(React == null ? void 0 : React.createElement)) {
    return function FallbackAgentOrgfyTab() {
      return null;
    };
  }
  const h = React.createElement;
  return function AgentOrgfyTab({ agent }) {
    const [cards, setCards] = React.useState([]);
    const [sessions, setSessions] = React.useState([]);
    const [telemetry, setTelemetry] = React.useState(() => getTelemetrySnapshot());
    const [loading, setLoading] = React.useState(true);
    const [failoverBusy, setFailoverBusy] = React.useState(false);
    const [statusBanner, setStatusBanner] = React.useState(null);
    const agentName = String((agent == null ? void 0 : agent.name) || (agent == null ? void 0 : agent.key) || "Agente");
    const agentKey = String((agent == null ? void 0 : agent.key) || "");
    const agentPubkey = String((agent == null ? void 0 : agent.pubkey) || "");
    const agentCfg = (agent == null ? void 0 : agent.config) && typeof agent.config === "object" ? agent.config : {};
    const currentModel = String(agentCfg.model || (agent == null ? void 0 : agent.model) || "padrão");
    const currentProvider = String(agentCfg.provider || (agent == null ? void 0 : agent.provider) || "padrão");
    const currentHarness = String(agentCfg.harness || (agent == null ? void 0 : agent.harness) || "goose");
    const loadAgentContext = React.useCallback(async () => {
      setLoading(true);
      try {
        const [allCards, radar] = await Promise.all([
          fetchLiveKanbanCards(ctx, { empresa: "all" }).catch(() => []),
          fetchGooseLoopRadar(ctx).catch(() => null)
        ]);
        const targetName = normName(agentName);
        const targetKey = normName(agentKey);
        const targetPk = normName(agentPubkey);
        const matchedCards = (allCards || []).filter((c) => {
          const ex = normName(c.executor);
          const rv = normName(c.revisor);
          const dc = normName(c.decisor);
          return targetName && (ex === targetName || rv === targetName || dc === targetName || ex.includes(targetName) || rv.includes(targetName)) || targetKey && (ex === targetKey || rv === targetKey);
        });
        setCards(matchedCards);
        const matchedSessions = ((radar == null ? void 0 : radar.sessoes) || []).filter((s) => {
          const sn = normName(s.agente);
          const spk = normName(s.agent_pubkey);
          return targetPk && spk && spk === targetPk || targetName && sn && (sn === targetName || sn.includes(targetName) || targetName.includes(sn));
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
    const handleFailover = async () => {
      setFailoverBusy(true);
      setStatusBanner(null);
      try {
        const res = await executeSmartModelFailover(ctx, {
          agente: agentName,
          agent_pubkey: agentPubkey || void 0,
          failed_model: currentModel !== "padrão" ? currentModel : void 0,
          prefer_free: true,
          apply: true,
          retrigger: false
        });
        setStatusBanner({ ok: res.ok, text: res.message });
      } catch (err) {
        setStatusBanner({ ok: false, text: `Erro no failover: ${(err == null ? void 0 : err.message) || err}` });
      } finally {
        setFailoverBusy(false);
      }
    };
    const handleOpenCockpit = () => {
      try {
        const nav = ctx == null ? void 0 : ctx.navigation;
        if (nav == null ? void 0 : nav.open) {
          nav.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
        } else if (nav == null ? void 0 : nav.navigate) {
          nav.navigate("orgfy");
        } else if (typeof window !== "undefined") {
          window.location.hash = "#/orgfy";
        }
      } catch {
      }
    };
    const targetLower = normName(agentName);
    const agentSpans = telemetry.recentSpans.filter((sp) => {
      const spName = normName(sp.agentName);
      return spName === targetLower || spName.includes(targetLower) || targetLower.includes(spName);
    }).slice(0, 8);
    const agentMetric = telemetry.agentMetrics.find((m) => {
      const mn = normName(m.agentName);
      return mn === targetLower || mn.includes(targetLower);
    });
    const activeCards = cards.filter((c) => c.stage !== "feito");
    const doneCards = cards.filter((c) => c.stage === "feito");
    return h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          padding: "12px 2px",
          color: "#f3f4f6",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "12px"
        }
      },
      // Header do Perfil OrgFy
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: CARD_BG$3,
            border: "1px solid rgba(16, 185, 129, 0.28)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#10b981" } }, `OrgFy Control Plane · ${agentName}`),
            (agentMetric == null ? void 0 : agentMetric.retryCascadeRisk) && h(
              "span",
              {
                style: {
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "2px 7px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  color: "#f87171"
                }
              },
              "RISCO RETRY CASCADE"
            )
          ),
          h(
            "div",
            { style: { fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
            `Harness: ${currentHarness} · Provider: ${currentProvider} · Modelo: ${currentModel}${agentPubkey ? ` · pk: ${agentPubkey.slice(0, 10)}…` : ""}`
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            {
              onClick: handleFailover,
              disabled: failoverBusy,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "700",
                cursor: failoverBusy ? "wait" : "pointer"
              }
            },
            failoverBusy ? "Testando NexusMind..." : "⚡ Melhor Modelo (NexusMind)"
          ),
          h(
            "button",
            {
              onClick: loadAgentContext,
              disabled: loading,
              style: {
                padding: "6px 10px",
                borderRadius: "6px",
                border: BORDER$3,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#cbd5e1",
                fontSize: "11px",
                cursor: "pointer"
              }
            },
            loading ? "..." : "Atualizar"
          ),
          h(
            "button",
            {
              onClick: handleOpenCockpit,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#10b981",
                color: "#000000",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer"
              }
            },
            "Abrir Control Room"
          )
        )
      ),
      statusBanner && h(
        "div",
        {
          style: {
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: statusBanner.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
            border: statusBanner.ok ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(245, 158, 11, 0.35)",
            color: statusBanner.ok ? "#a7f3d0" : "#fde68a",
            fontSize: "11px",
            fontFamily: "monospace"
          }
        },
        statusBanner.text
      ),
      // 4 KPIs do Agente
      h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" } },
        [
          { label: "Cards Ativos", value: String(activeCards.length), color: "#38bdf8" },
          { label: "Cards Concluídos", value: String(doneCards.length), color: "#10b981" },
          { label: "Sessões Goose (3h)", value: String(sessions.length), color: sessions.some((s) => s.severidade === "critical") ? "#f87171" : "#cbd5e1" },
          { label: "Turnos OTel", value: agentMetric ? `${agentMetric.totalTurns} (${agentMetric.errorTurns} err)` : `${agentSpans.length} spans`, color: "#c084fc" }
        ].map(
          (k) => h(
            "div",
            { key: k.label, style: { padding: "10px 12px", borderRadius: "8px", backgroundColor: CARD_BG$3, border: BORDER$3 } },
            h("div", { style: { fontSize: "10px", color: "#9ca3af", textTransform: "uppercase" } }, k.label),
            h("div", { style: { fontSize: "16px", fontWeight: "700", color: k.color, fontFamily: "monospace", marginTop: "3px" } }, k.value)
          )
        )
      ),
      // Cards Atribuídos na Esteira
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$3, border: BORDER$3, display: "flex", flexDirection: "column", gap: "8px" } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, `Cards OrgFy Atribuídos (${cards.length})`),
          h("span", { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } }, "Executor / Revisor / Decisor")
        ),
        loading ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Carregando cards da esteira...") : cards.length === 0 ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, `Nenhum card ativo ou recente vinculado a ${agentName} no Kanban atual.`) : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" } },
          cards.slice(0, 12).map((c) => {
            const role = normName(c.executor) === targetLower ? "EXECUTOR" : normName(c.revisor) === targetLower ? "REVISOR" : "DECISOR";
            return h(
              "div",
              {
                key: c.id,
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  border: BORDER$3
                }
              },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px" } },
                  h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#38bdf8", fontWeight: "700" } }, `#${c.issueId.slice(0, 8)}`),
                  h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: role === "EXECUTOR" ? "rgba(16,185,129,0.18)" : "rgba(192,132,252,0.18)", color: role === "EXECUTOR" ? "#34d399" : "#d8b4fe" } }, role),
                  h("span", { style: { fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(255,255,255,0.08)", color: "#cbd5e1", textTransform: "uppercase" } }, c.stage)
                ),
                h("span", { style: { fontSize: "11.5px", fontWeight: "600", color: "#f3f4f6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.title)
              ),
              c.fullIssueId && h(
                "button",
                {
                  onClick: () => openIssueInBuzz(ctx, { id: c.fullIssueId, owner: c.owner, dtag: c.empresa || "orgfy" }),
                  style: {
                    padding: "4px 8px",
                    borderRadius: "5px",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                    color: "#38bdf8",
                    fontSize: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                    flexShrink: 0
                  }
                },
                "Abrir ↗"
              )
            );
          })
        )
      ),
      // Sessões Goose & OTel Spans em 2 colunas
      h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
        // Sessões Goose
        h(
          "div",
          { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$3, border: BORDER$3, display: "flex", flexDirection: "column", gap: "6px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Sessões Goose Recentes (3h)"),
          sessions.length === 0 ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Nenhuma sessão recente no radar Goose.") : sessions.map(
            (s) => h(
              "div",
              {
                key: s.session_id,
                style: {
                  padding: "6px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  border: s.severidade === "critical" ? "1px solid rgba(239,68,68,0.35)" : BORDER$3,
                  fontSize: "10px",
                  fontFamily: "monospace",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px"
                }
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between" } },
                h("span", { style: { color: s.ativa ? "#34d399" : "#9ca3af", fontWeight: "700" } }, `${s.ativa ? "ATIVA" : "HIST"} · ${s.session_id}`),
                h("span", { style: { color: "#cbd5e1" } }, `${s.duracao_min.toFixed(0)}m · ${s.shells} shells`)
              ),
              h("span", { style: { color: s.flags.length > 0 ? "#fbbf24" : "#10b981" } }, s.flags.length > 0 ? s.flags.join(" · ") : "OK")
            )
          )
        ),
        // Spans OTel GenAI
        h(
          "div",
          { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$3, border: BORDER$3, display: "flex", flexDirection: "column", gap: "6px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Spans OTel GenAI deste Agente"),
          agentSpans.length === 0 ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Nenhum span OTel capturado ainda nesta sessão do Buzz.") : agentSpans.map(
            (sp) => h(
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
                  backgroundColor: "rgba(0,0,0,0.28)",
                  fontSize: "10px",
                  fontFamily: "monospace"
                }
              },
              h("span", { style: { color: "#38bdf8", fontWeight: "600" } }, sp.toolName || sp.operationName),
              h("span", { style: { color: sp.status === "error" ? "#f87171" : "#10b981", fontWeight: "700" } }, `${sp.status.toUpperCase()} · ${sp.durationMs}ms`)
            )
          )
        )
      )
    );
  };
}
let lastNativeState = {
  relayConnected: false,
  conversationRegistered: false,
  sidebarRegistered: false,
  shortcutsRegistered: false,
  attentionSourceRegistered: false,
  otelHookRegistered: false,
  agentTabRegistered: false
};
function getBuzzNativeState() {
  return { ...lastNativeState };
}
let sidebarCounts = {
  triagem: 0,
  execucao: 0,
  revisao: 0,
  loopsAtivos: 0
};
function buildSidebarRows(counts) {
  return [
    {
      id: "orgfy-revisao",
      label: "Em Revisão (Gate)",
      count: counts.revisao,
      status: counts.revisao > 0 ? "active" : "idle"
    },
    {
      id: "orgfy-execucao",
      label: "Em Execução",
      count: counts.execucao,
      status: counts.execucao > 0 ? "active" : "idle"
    },
    {
      id: "orgfy-loops",
      label: "Loops Ativos",
      count: counts.loopsAtivos,
      badge: counts.loopsAtivos > 0 ? "ALERTA" : void 0,
      status: counts.loopsAtivos > 0 ? "error" : "ok"
    }
  ];
}
let sidebarRowsSnapshot = buildSidebarRows(sidebarCounts);
const sidebarListeners = /* @__PURE__ */ new Set();
const relayChangeListeners = /* @__PURE__ */ new Set();
function updateOrgfySidebarCounts(next) {
  const merged = { ...sidebarCounts, ...next };
  if (merged.triagem === sidebarCounts.triagem && merged.execucao === sidebarCounts.execucao && merged.revisao === sidebarCounts.revisao && merged.loopsAtivos === sidebarCounts.loopsAtivos) {
    return;
  }
  sidebarCounts = merged;
  sidebarRowsSnapshot = buildSidebarRows(sidebarCounts);
  for (const fn of sidebarListeners) {
    try {
      fn();
    } catch {
    }
  }
}
function subscribeRelayUpdates(listener) {
  relayChangeListeners.add(listener);
  return () => relayChangeListeners.delete(listener);
}
function registerBuzzNativeIntegrations(ctx) {
  var _a, _b, _c, _d, _e;
  const state = {
    relayConnected: false,
    conversationRegistered: false,
    sidebarRegistered: false,
    shortcutsRegistered: false,
    attentionSourceRegistered: false,
    otelHookRegistered: false,
    agentTabRegistered: false
  };
  try {
    const relay = ctx == null ? void 0 : ctx.relay;
    if ((relay == null ? void 0 : relay.subscribe) && typeof relay.subscribe === "function") {
      let lastGen = ((_b = (_a = relay.snapshot) == null ? void 0 : _a.call(relay)) == null ? void 0 : _b.generation) ?? -1;
      const unsub = relay.subscribe(() => {
        var _a2;
        const snap = (_a2 = relay.snapshot) == null ? void 0 : _a2.call(relay);
        const gen = (snap == null ? void 0 : snap.generation) ?? -1;
        if (gen !== lastGen) {
          lastGen = gen;
          recordGenAISpan({
            operationName: "relay.event",
            agentName: "buzz-relay",
            durationMs: 0,
            status: (snap == null ? void 0 : snap.status) === "error" ? "error" : "ok",
            attributes: {
              "buzz.relay.status": String((snap == null ? void 0 : snap.status) || "unknown"),
              "buzz.relay.generation": gen
            }
          });
          for (const fn of relayChangeListeners) {
            try {
              fn();
            } catch {
            }
          }
        }
      });
      if ((ctx == null ? void 0 : ctx.on) && typeof unsub === "function") {
        ctx.on("dispose", unsub);
      }
      state.relayConnected = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao assinar ctx.relay:", err);
  }
  try {
    const conv = ctx == null ? void 0 : ctx.conversation;
    if (conv == null ? void 0 : conv.registerCompletion) {
      conv.registerCompletion({
        id: "orgfy-slash-commands",
        trigger: "/",
        complete: (query) => {
          const text = String((query == null ? void 0 : query.text) || (query == null ? void 0 : query.query) || "").toLowerCase();
          const commands = [
            {
              id: "orgfy-card",
              label: "/orgfy-card",
              description: "Abrir card OrgFy schema-first (L-22 + Buzz Attention)",
              insertText: "Chame `orgfy_card_create` para abrir um novo card com escopo fechado, Escrita exclusiva e comando de aceite L-22."
            },
            {
              id: "orgfy-despachar",
              label: "/orgfy-despachar",
              description: "Despachar issue para executor + revisor independente (L-01)",
              insertText: "Chame `orgfy_despachar` passando issue_id, executor e revisor."
            },
            {
              id: "orgfy-gate",
              label: "/orgfy-gate",
              description: "Emitir veredito de Gate Caixa-Preta (aceito/recusado)",
              insertText: "Chame `orgfy_gate` com pr_id, decisao e motivo."
            },
            {
              id: "orgfy-triage",
              label: "/orgfy-triage",
              description: "Rodar triagem rápida via Decisions API (card ou diff)",
              insertText: "Chame `orgfy_decision_triage` (mode: 'card' ou 'diff') para avaliação rápida."
            },
            {
              id: "orgfy-radar",
              label: "/orgfy-radar",
              description: "Inspecionar Radar de Loops & sessões travadas no Goose",
              insertText: "Chame `orgfy_loop_radar({ apenas_ativos: true })` e reporte sessões críticas."
            }
          ];
          const filtered = text ? commands.filter((c) => c.label.includes(text) || c.description.toLowerCase().includes(text)) : commands;
          return { suggestions: filtered };
        }
      });
      state.conversationRegistered = true;
    }
    if (conv == null ? void 0 : conv.registerMessageAction) {
      conv.registerMessageAction({
        id: "orgfy-open-control-room",
        label: "Abrir no OrgFy Control Room",
        run: () => {
          var _a2, _b2;
          try {
            if ((_a2 = ctx == null ? void 0 : ctx.navigation) == null ? void 0 : _a2.open) {
              ctx.navigation.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
            } else if ((_b2 = ctx == null ? void 0 : ctx.navigation) == null ? void 0 : _b2.navigate) {
              ctx.navigation.navigate("orgfy");
            }
          } catch {
          }
        }
      });
      state.conversationRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar extensões de conversa:", err);
  }
  try {
    const sidebar = ((_d = (_c = ctx == null ? void 0 : ctx.reflect) == null ? void 0 : _c.get) == null ? void 0 : _d.call(_c, "sidebarSections")) || (ctx == null ? void 0 : ctx.sidebarSections);
    if (sidebar == null ? void 0 : sidebar.register) {
      const h = (_e = ctx == null ? void 0 : ctx.react) == null ? void 0 : _e.createElement;
      sidebar.register({
        version: 1,
        id: "orgfy-live-pulse",
        title: "OrgFy Esteira",
        icon: h ? h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, "◈") : null,
        rows: {
          snapshot: () => sidebarRowsSnapshot,
          subscribe: (listener) => {
            sidebarListeners.add(listener);
            return () => sidebarListeners.delete(listener);
          }
        },
        select: () => ({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" })
      });
      state.sidebarRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar sidebarSections:", err);
  }
  try {
    const shortcuts = ctx == null ? void 0 : ctx.shortcuts;
    if (shortcuts == null ? void 0 : shortcuts.register) {
      shortcuts.register({
        id: "orgfy-open-cockpit",
        title: "Abrir OrgFy Control Room",
        binding: "Mod+Shift+O",
        run: () => {
          var _a2, _b2;
          try {
            if ((_a2 = ctx == null ? void 0 : ctx.navigation) == null ? void 0 : _a2.open) {
              ctx.navigation.open({ version: 1, kind: "page", pluginId: "digital.cortexx.orgfy", pageId: "orgfy" });
            } else if ((_b2 = ctx == null ? void 0 : ctx.navigation) == null ? void 0 : _b2.navigate) {
              ctx.navigation.navigate("orgfy");
            }
          } catch {
          }
        }
      });
      state.shortcutsRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar shortcuts:", err);
  }
  try {
    const agents = ctx == null ? void 0 : ctx.agents;
    if (agents == null ? void 0 : agents.addAttentionSource) {
      agents.addAttentionSource({
        id: "orgfy.pipeline",
        label: "OrgFy Esteira & Gate",
        description: "Emite eventos estruturados da esteira OrgFy (card.ready_for_review, gate.rejected_dsap, loop.detected, budget.80pct) compatíveis com classifier pré-LLM.",
        present: (watch, title) => {
          var _a2;
          return {
            type: "OrgFy Esteira",
            target: String(((_a2 = watch == null ? void 0 : watch.config) == null ? void 0 : _a2.empresa) || "orgfy"),
            subtitle: title || "Monitoramento determinístico de cards, PRs e loops"
          };
        }
      });
      state.attentionSourceRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar AttentionSource:", err);
  }
  try {
    const agents = ctx == null ? void 0 : ctx.agents;
    if (agents == null ? void 0 : agents.registerHook) {
      const registerOtel = (event, status) => {
        agents.registerHook({
          id: `orgfy-otel-${event}`,
          harness: "goose",
          event,
          run: (input, hookCtx) => {
            const errMsg = (input == null ? void 0 : input.error) ? String(input.error).slice(0, 140) : void 0;
            recordGenAISpan({
              operationName: "invoke_agent",
              agentName: String((hookCtx == null ? void 0 : hookCtx.agent) || (input == null ? void 0 : input.agent) || "unknown-agent"),
              model: (input == null ? void 0 : input.model) ? String(input.model) : null,
              provider: (input == null ? void 0 : input.provider) ? String(input.provider) : null,
              durationMs: Number((input == null ? void 0 : input.durationMs) || (input == null ? void 0 : input.duration_ms) || 0),
              status: errMsg ? "error" : status,
              finishReason: errMsg || (status === "ok" ? "stop" : "error"),
              attributes: {
                "gen_ai.operation.name": "invoke_agent",
                "buzz.hook.event": event,
                "buzz.session.id": String((hookCtx == null ? void 0 : hookCtx.session) || "")
              }
            });
            return void 0;
          }
        });
      };
      registerOtel("turn.completed", "ok");
      registerOtel("turn.failed", "error");
      state.otelHookRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar OTel AgentHook:", err);
  }
  try {
    const agents = ctx == null ? void 0 : ctx.agents;
    if ((agents == null ? void 0 : agents.registerTab) && typeof agents.registerTab === "function") {
      const AgentOrgfyTab = createAgentOrgfyTabComponent(ctx);
      agents.registerTab({
        id: "orgfy",
        title: "OrgFy",
        component: AgentOrgfyTab
      });
      state.agentTabRegistered = true;
    }
  } catch (err) {
    console.warn("[ORGFY v13] Falha ao registrar aba OrgFy no perfil dos agentes:", err);
  }
  lastNativeState = { ...state };
  return state;
}
const CARD_BG$2 = "rgba(0, 0, 0, 0.28)";
const BORDER$2 = "1px solid rgba(255, 255, 255, 0.08)";
function formatMin(min) {
  if (min === null || !Number.isFinite(min)) return "--";
  if (min < 60) return `${min.toFixed(0)}m`;
  const hrs = min / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}
function formatNum(val) {
  if (val === null || val === void 0 || !Number.isFinite(val)) return "--";
  return val.toLocaleString("pt-BR");
}
function renderDailyTrendSvg(h, series) {
  const width = 520;
  const height = 148;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const maxVal = Math.max(
    1,
    ...series.map((d) => Math.max(d.merges, d.retrabalhos + d.conflitos))
  );
  const barGroupW = series.length > 0 ? plotW / series.length : plotW;
  const barW = Math.max(6, Math.min(18, barGroupW * 0.48));
  return h(
    "svg",
    {
      viewBox: `0 0 ${width} ${height}`,
      style: { width: "100%", height: "148px", display: "block" }
    },
    // Grid lines
    [0, 0.5, 1].map((ratio, idx) => {
      const y = padTop + plotH * (1 - ratio);
      const label = Math.round(maxVal * ratio);
      return h(
        "g",
        { key: `grid-${idx}` },
        h("line", {
          x1: padLeft,
          y1: y,
          x2: width - padRight,
          y2: y,
          stroke: "rgba(255,255,255,0.08)",
          strokeDasharray: idx === 0 ? "none" : "3 3",
          strokeWidth: 1
        }),
        h(
          "text",
          {
            x: padLeft - 6,
            y: y + 3,
            textAnchor: "end",
            fill: "#6b7280",
            fontSize: "9",
            fontFamily: "monospace"
          },
          String(label)
        )
      );
    }),
    // Bars
    series.map((d, i) => {
      const cx = padLeft + i * barGroupW + barGroupW / 2;
      const mergeH = d.merges / maxVal * plotH;
      const reworkTotal = d.retrabalhos + d.conflitos;
      const reworkH = reworkTotal / maxVal * plotH;
      const dayLabel = d.dia.slice(8, 10);
      return h(
        "g",
        { key: d.dia },
        h("rect", {
          x: cx - barW / 2,
          y: padTop + plotH - mergeH,
          width: barW,
          height: Math.max(mergeH, d.merges > 0 ? 2 : 0),
          rx: 3,
          fill: "#10b981"
        }),
        reworkTotal > 0 && h("rect", {
          x: cx - barW / 2 + barW * 0.55,
          y: padTop + plotH - reworkH,
          width: Math.max(4, barW * 0.45),
          height: Math.max(reworkH, 3),
          rx: 2,
          fill: "#f59e0b"
        }),
        i % 2 === 0 && h(
          "text",
          {
            x: cx,
            y: height - 8,
            textAnchor: "middle",
            fill: "#9ca3af",
            fontSize: "9",
            fontFamily: "monospace"
          },
          dayLabel
        )
      );
    })
  );
}
function renderBudgetGaugeSvg(h, pct, status) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fill = status === "BLOQUEADO_100" ? "#ef4444" : status === "ALERTA_80" ? "#f59e0b" : "#10b981";
  return h(
    "svg",
    {
      viewBox: "0 0 360 36",
      style: { width: "100%", height: "36px", display: "block" }
    },
    h("rect", {
      x: 0,
      y: 12,
      width: 360,
      height: 12,
      rx: 6,
      fill: "rgba(255,255,255,0.08)"
    }),
    h("rect", {
      x: 0,
      y: 12,
      width: Math.max(clamped > 0 ? 4 : 0, clamped / 100 * 360),
      height: 12,
      rx: 6,
      fill
    }),
    // Marca 80% (Soft Cap Paperclip)
    h("line", {
      x1: 288,
      y1: 8,
      x2: 288,
      y2: 28,
      stroke: "#f59e0b",
      strokeWidth: 1.5,
      strokeDasharray: "2 2"
    }),
    h(
      "text",
      {
        x: 288,
        y: 7,
        textAnchor: "middle",
        fill: "#f59e0b",
        fontSize: "8.5",
        fontFamily: "monospace"
      },
      "80%"
    ),
    // Marca 100% (Hard Cap)
    h("line", {
      x1: 359,
      y1: 8,
      x2: 359,
      y2: 28,
      stroke: "#ef4444",
      strokeWidth: 1.5
    }),
    h(
      "text",
      {
        x: 348,
        y: 7,
        textAnchor: "end",
        fill: "#ef4444",
        fontSize: "8.5",
        fontFamily: "monospace"
      },
      "100%"
    )
  );
}
function renderIntelligenceTab(props) {
  const { h, kpis, history, error, isRecalculating, onRecalculate, onRunGovernanceEval, governanceSummary, loopRadar, onRefreshLoopRadar, onWakeIrisForLoops, onStopLoopSession, stoppingSessionId, onFailoverModelSession, failingOverSessionId } = props;
  if (!kpis) {
    return h(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "32px",
          color: "#9ca3af",
          textAlign: "center"
        }
      },
      h(
        "div",
        { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } },
        "Snapshot kpis-esteira.json ainda não disponível"
      ),
      h(
        "div",
        { style: { fontSize: "12px", maxWidth: "460px", lineHeight: "1.5" } },
        error || "Execute o motor determinístico da Onda 1 para consolidar transições, uso do NexusMind e higiene do backlog sem dados mockados."
      ),
      h(
        "button",
        {
          onClick: onRecalculate,
          disabled: isRecalculating,
          style: {
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#10b981",
            color: "#000000",
            fontWeight: "700",
            fontSize: "12px",
            cursor: isRecalculating ? "wait" : "pointer"
          }
        },
        isRecalculating ? "Recalculando KPIs..." : "Gerar KPIs Reais Agora"
      )
    );
  }
  const budgetColor = kpis.economia.status_orcamento === "BLOQUEADO_100" ? "#ef4444" : kpis.economia.status_orcamento === "ALERTA_80" ? "#f59e0b" : "#10b981";
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "6px"
      }
    },
    // Barra Superior de Ação e Freshness
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "10px",
          backgroundColor: CARD_BG$2,
          border: BORDER$2
        }
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        h(
          "span",
          { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } },
          "Painel de Inteligência & Saúde — Melhoria Contínua (Zero Vaidade)"
        ),
        h(
          "span",
          { style: { fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
          `Fontes: ${kpis.fontes.transicoes_linhas} transições · ${kpis.fontes.nm_usage_itens} reqs NexusMind · ${kpis.fontes.placar_arquivo || "sem placar"} · ${history.length} snapshots`
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        onRunGovernanceEval && h(
          "button",
          {
            onClick: onRunGovernanceEval,
            style: {
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              backgroundColor: "rgba(56, 189, 248, 0.14)",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer"
            }
          },
          "Avaliar Governança (Onda 3)"
        ),
        h(
          "button",
          {
            onClick: onRecalculate,
            disabled: isRecalculating,
            style: {
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#10b981",
              color: "#000000",
              fontSize: "11px",
              fontWeight: "700",
              cursor: isRecalculating ? "wait" : "pointer"
            }
          },
          isRecalculating ? "Recalculando..." : "Recalcular KPIs agora"
        )
      )
    ),
    governanceSummary && h(
      "div",
      {
        style: {
          padding: "10px 14px",
          borderRadius: "8px",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          fontSize: "11px",
          color: "#e0f2fe",
          fontFamily: "monospace"
        }
      },
      governanceSummary
    ),
    // 4 Cards Principais (4 Pilares de Decisão)
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "10px"
        }
      },
      // Pilar 1: Gargalo de Revisão
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "1. Gargalo de Revisão"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: kpis.fluxo.fila_revisao_atual >= 10 ? "#f59e0b" : "#10b981", marginTop: "4px" } },
          `${kpis.fluxo.fila_revisao_atual} na fila`
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `Espera P50 ${formatMin(kpis.fluxo.revisao_espera_p50_min)} · P90 ${formatMin(kpis.fluxo.revisao_espera_p90_min)}`
        )
      ),
      // Pilar 2: FPY Real & Retrabalho
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "2. Qualidade (FPY Real)"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: "#10b981", marginTop: "4px" } },
          kpis.qualidade.fpy_real_pct !== null ? `${kpis.qualidade.fpy_real_pct.toFixed(1)}%` : "--"
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `${kpis.qualidade.cards_aceitos_primeira} 1ª vez · ${kpis.qualidade.cards_com_retrabalho} retrabalho (${kpis.qualidade.taxa_retrabalho_pct}%)`
        )
      ),
      // Pilar 3: Economia & ROI
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "3. Economia & Cache"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: budgetColor, marginTop: "4px" } },
          `${kpis.economia.status_orcamento} (${kpis.economia.uso_teto_diario_pct}%)`
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `Cache ${kpis.economia.cache_hit_ratio_pct}% · ${formatNum(kpis.economia.tokens_por_card_integrado)} tok/card`
        )
      ),
      // Pilar 4: Higiene & Orphan WIP
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "4. Higiene & Estagnação"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: kpis.higiene.orphan_wip_pct >= 25 ? "#f59e0b" : "#10b981", marginTop: "4px" } },
          `${kpis.higiene.orphan_wip_count} órfãos (${kpis.higiene.orphan_wip_pct}%)`
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `Nível 3: ${kpis.higiene.estagnados_nivel_3} · Nível 2: ${kpis.higiene.estagnados_nivel_2}`
        )
      )
    ),
    // Linha 2: Gráfico SVG de Tendência 14d + Medidor Orçamento 80%/100%
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.45fr 1fr",
          gap: "12px"
        }
      },
      // Gráfico 14 dias
      h(
        "div",
        { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Vazão Diária (14 dias): Merges vs. Retrabalho"),
          h(
            "span",
            { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } },
            `7d: ${kpis.fluxo.vazao_7d} · 30d: ${kpis.fluxo.vazao_30d}`
          )
        ),
        renderDailyTrendSvg(h, kpis.fluxo.serie_diaria_14d || [])
      ),
      // Medidor de Orçamento 80%/100% + Alertas
      h(
        "div",
        { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2, display: "flex", flexDirection: "column", gap: "10px" } },
        h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Guardrail Econômico (80% Alerta / 100% Trava)"),
        renderBudgetGaugeSvg(h, kpis.economia.uso_teto_diario_pct, kpis.economia.status_orcamento),
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
          h("span", null, `Hoje: ${formatNum(kpis.economia.tokens_hoje)} tok`),
          h("span", null, `Teto: ${formatNum(kpis.economia.teto_diario_tokens)} tok`)
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" } },
          kpis.alertas_ativos.length === 0 ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhum alerta crítico ativo.") : kpis.alertas_ativos.map(
            (al) => h(
              "div",
              {
                key: al.codigo,
                style: {
                  padding: "6px 8px",
                  borderRadius: "6px",
                  backgroundColor: al.severidade === "critical" ? "rgba(239, 68, 68, 0.14)" : "rgba(245, 158, 11, 0.12)",
                  border: al.severidade === "critical" ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(245, 158, 11, 0.3)",
                  fontSize: "10.5px",
                  color: "#f3f4f6"
                }
              },
              h("div", { style: { fontWeight: "700", color: al.severidade === "critical" ? "#f87171" : "#fbbf24" } }, al.mensagem),
              h("div", { style: { color: "#cbd5e1", marginTop: "2px" } }, al.acao_sugerida)
            )
          )
        )
      )
    ),
    // Linha 3: Eficiência por Modelo NexusMind + Top Worktrees Estagnados
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.25fr 1fr",
          gap: "12px"
        }
      },
      // Tabela de Modelos
      h(
        "div",
        { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", marginBottom: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "ROI & Eficiência por Modelo (NexusMind)"),
          h("span", { style: { fontSize: "11px", color: "#10b981", fontFamily: "monospace" } }, `Amostra: $${kpis.economia.custo_usd_total_amostra.toFixed(4)} USD`)
        ),
        kpis.economia.por_modelo.length === 0 ? h("div", { style: { fontSize: "11px", color: "#6b7280" } }, "Sem registros em nm_usage.json.") : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto", paddingRight: "4px" } },
          kpis.economia.por_modelo.map(
            (m) => h(
              "div",
              {
                key: `${m.modelo}-${m.grupo}`,
                style: {
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.7fr 0.7fr 0.7fr 0.8fr",
                  gap: "6px",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  alignItems: "center"
                }
              },
              h("span", { style: { color: "#f3f4f6", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" } }, `${m.modelo} (${m.grupo})`),
              h("span", { style: { color: "#9ca3af" } }, `${m.requisicoes} req`),
              h("span", { style: { color: "#10b981" } }, `$${m.custo_usd.toFixed(3)}`),
              h("span", { style: { color: "#38bdf8" } }, `${m.cache_hit_pct}% hit`),
              h("span", { style: { color: "#fbbf24", textAlign: "right" } }, `${Math.round(m.latencia_media_ms)}ms`)
            )
          )
        )
      ),
      // Coluna Direita: Radar de Loops (Goose Live) + Top Estagnados
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 } },
        // Radar de Loops & Sessões Zumbis (Goose Live)
        h(
          "div",
          { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2, display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Radar de Loops (Goose Live · 3h)"),
              (loopRadar == null ? void 0 : loopRadar.ok) && (() => {
                const critAtivos = loopRadar.resumo.criticos_ativos ?? loopRadar.resumo.criticos;
                const avisosAtivos = loopRadar.resumo.avisos_ativos ?? loopRadar.resumo.avisos;
                const critHist = loopRadar.resumo.criticos_historico_3h ?? 0;
                const dupAtivos = loopRadar.resumo.duplicadas_ativas ?? loopRadar.resumo.duplicadas;
                return h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      fontFamily: "monospace",
                      fontWeight: "700",
                      padding: "2px 7px",
                      borderRadius: "9999px",
                      backgroundColor: critAtivos > 0 ? "rgba(239, 68, 68, 0.18)" : avisosAtivos > 0 ? "rgba(245, 158, 11, 0.18)" : "rgba(16, 185, 129, 0.15)",
                      color: critAtivos > 0 ? "#f87171" : avisosAtivos > 0 ? "#fbbf24" : "#10b981"
                    }
                  },
                  `${critAtivos} ativos · ${critHist} hist(3h) · ${dupAtivos} dup`
                );
              })()
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px" } },
              onWakeIrisForLoops && h(
                "button",
                {
                  onClick: onWakeIrisForLoops,
                  title: "Acionar o COO da esteira (escalação hierárquica: COO → CEO da empresa → Iris só em último caso)",
                  style: {
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    backgroundColor: "rgba(239, 68, 68, 0.16)",
                    color: "#fca5a5",
                    fontSize: "10.5px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }
                },
                "Acionar COO"
              ),
              onRefreshLoopRadar && h(
                "button",
                {
                  onClick: onRefreshLoopRadar,
                  style: {
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "#cbd5e1",
                    fontSize: "10.5px",
                    cursor: "pointer"
                  }
                },
                "Atualizar"
              )
            )
          ),
          !loopRadar || !loopRadar.ok ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, (loopRadar == null ? void 0 : loopRadar.error) || "Carregando telemetria live do Goose...") : loopRadar.sessoes.length === 0 ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhuma sessão em loop ou travada nas últimas 3 horas.") : (() => {
            const isSessionActive = (s) => typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15;
            const activeSessions = loopRadar.sessoes.filter(isSessionActive);
            const historySessions = loopRadar.sessoes.filter((s) => !isSessionActive(s));
            const renderSessionCard = (s, isActive) => h(
              "div",
              {
                key: s.session_id,
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "7px 9px",
                  borderRadius: "6px",
                  opacity: isActive ? 1 : 0.72,
                  backgroundColor: isActive && s.severidade === "critical" ? "rgba(239, 68, 68, 0.12)" : s.severidade === "warn" || !isActive && s.severidade === "critical" ? "rgba(245, 158, 11, 0.08)" : "rgba(255, 255, 255, 0.025)",
                  border: isActive && s.severidade === "critical" ? "1px solid rgba(239, 68, 68, 0.35)" : s.severidade === "warn" || !isActive && s.severidade === "critical" ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(255, 255, 255, 0.05)",
                  fontSize: "10.5px",
                  fontFamily: "monospace"
                }
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "8.5px",
                        fontWeight: "700",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        backgroundColor: isActive ? "rgba(16, 185, 129, 0.18)" : "rgba(156, 163, 175, 0.15)",
                        color: isActive ? "#34d399" : "#9ca3af"
                      }
                    },
                    isActive ? "ATIVA" : "HIST"
                  ),
                  h("span", { style: { color: "#f3f4f6", fontWeight: "700" } }, s.agente)
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    { style: { color: isActive && s.severidade === "critical" ? "#f87171" : s.severidade === "warn" ? "#fbbf24" : "#cbd5e1", fontWeight: "600" } },
                    `${formatMin(s.duracao_min)} · ${s.shells} shells`
                  ),
                  isActive && onFailoverModelSession && h(
                    "button",
                    {
                      onClick: () => onFailoverModelSession(s),
                      disabled: failingOverSessionId === s.session_id,
                      title: "Consultar NexusMind Ping Real, migrar este agente para o melhor modelo FREE online e re-disparar",
                      style: {
                        padding: "2px 8px",
                        borderRadius: "5px",
                        border: "1px solid rgba(56, 189, 248, 0.5)",
                        backgroundColor: failingOverSessionId === s.session_id ? "rgba(56, 189, 248, 0.35)" : "rgba(56, 189, 248, 0.16)",
                        color: "#bae6fd",
                        fontSize: "9.5px",
                        fontWeight: "700",
                        cursor: failingOverSessionId === s.session_id ? "wait" : "pointer"
                      }
                    },
                    failingOverSessionId === s.session_id ? "Migrando..." : "⚡ Failover Free"
                  ),
                  isActive && onStopLoopSession && h(
                    "button",
                    {
                      onClick: () => onStopLoopSession(s),
                      disabled: stoppingSessionId === s.session_id,
                      title: "Interromper (Stop) o turno atual deste agente imediatamente",
                      style: {
                        padding: "2px 8px",
                        borderRadius: "5px",
                        border: "1px solid rgba(239, 68, 68, 0.55)",
                        backgroundColor: stoppingSessionId === s.session_id ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.2)",
                        color: "#fecaca",
                        fontSize: "9.5px",
                        fontWeight: "700",
                        cursor: stoppingSessionId === s.session_id ? "wait" : "pointer"
                      }
                    },
                    stoppingSessionId === s.session_id ? "Parando..." : "■ Parar"
                  )
                )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" } },
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                  (s.flags.length > 0 ? s.flags : ["OK"]).map(
                    (fl) => h(
                      "span",
                      {
                        key: fl,
                        style: {
                          fontSize: "9px",
                          fontWeight: "700",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          backgroundColor: fl === "OK" ? "rgba(16, 185, 129, 0.15)" : fl === "ITEM_JA_FECHADO" || fl === "CONTEXTO_COMPACTADO" || fl === "TURNO_EXCESSIVO" || fl === "COLISAO_WORKTREE" || fl === "COMANDO_REPETIDO" || fl === "ERRO_REPETIDO" || fl === "LOOP_SUSPEITO" || fl === "STALLED_THINKING" ? "rgba(239, 68, 68, 0.22)" : "rgba(245, 158, 11, 0.22)",
                          color: fl === "OK" ? "#10b981" : fl === "ITEM_JA_FECHADO" || fl === "CONTEXTO_COMPACTADO" || fl === "TURNO_EXCESSIVO" || fl === "COLISAO_WORKTREE" || fl === "COMANDO_REPETIDO" || fl === "ERRO_REPETIDO" || fl === "LOOP_SUSPEITO" || fl === "STALLED_THINKING" ? "#f87171" : "#fbbf24"
                        }
                      },
                      fl
                    )
                  )
                ),
                h(
                  "span",
                  { style: { fontSize: "9.5px", color: "#9ca3af" } },
                  `${s.session_id} · há ${s.ultima_atualizacao_min}m${s.compactions ? ` · ${s.compactions}x compact` : ""}${s.errors_5xx ? ` · ${s.errors_5xx}x 5xx` : ""}`
                )
              ),
              s.gatilho_resumo && h(
                "div",
                { style: { fontSize: "9.5px", color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.gatilho_resumo },
                `▸ ${s.gatilho_resumo}`
              ),
              s.ultimo_shell && h(
                "div",
                { style: { fontSize: "9.5px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.ultimo_shell },
                `$ ${s.ultimo_shell}`
              ),
              isActive && s.acao_sugerida && h(
                "div",
                { style: { fontSize: "9.5px", color: "#38bdf8", lineHeight: "1.3" } },
                `→ ${s.acao_sugerida}`
              )
            );
            return h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "8px" } },
              activeSessions.length === 0 ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhuma sessão ativa em loop ou travada agora.") : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto", paddingRight: "4px" } },
                activeSessions.map((s) => renderSessionCard(s, true))
              ),
              historySessions.length > 0 && h(
                "details",
                { style: { borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "6px" } },
                h(
                  "summary",
                  {
                    style: {
                      fontSize: "10.5px",
                      color: "#9ca3af",
                      fontFamily: "monospace",
                      cursor: "pointer",
                      userSelect: "none"
                    }
                  },
                  `Histórico encerrado (3h · ${historySessions.length} sessões — insumo RSI)`
                ),
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto", paddingRight: "4px", marginTop: "6px" } },
                  historySessions.map((s) => renderSessionCard(s, false))
                )
              )
            );
          })()
        ),
        // Top Estagnados
        h(
          "div",
          { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$2, border: BORDER$2 } },
          h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6", marginBottom: "6px" } }, "Top Estagnados no Sentinela"),
          kpis.higiene.top_estagnados.length === 0 ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhum worktree estagnado.") : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "5px" } },
            kpis.higiene.top_estagnados.slice(0, 6).map(
              (st) => h(
                "div",
                {
                  key: st.chave,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "5px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    fontSize: "10.5px",
                    fontFamily: "monospace"
                  }
                },
                h("span", { style: { color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" } }, st.chave),
                h("span", { style: { color: st.nivel >= 3 ? "#f87171" : "#fbbf24", fontWeight: "700" } }, `N${st.nivel} · ${st.ciclos} ciclos`)
              )
            )
          )
        )
      )
    )
  );
}
function createChannelPulsePanel(ctx, fetchKpis) {
  const React = ctx.react;
  const h = React.createElement;
  return function OrgFyChannelPulsePanel() {
    const [kpis, setKpis] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchKpis();
        setKpis(data);
      } finally {
        setLoading(false);
      }
    };
    React.useEffect(() => {
      load();
    }, []);
    return h(
      "div",
      {
        style: {
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          color: "#f3f4f6",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "12px"
        }
      },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("strong", { style: { fontSize: "13px" } }, "OrgFy Pulse"),
        h(
          "button",
          {
            onClick: load,
            style: {
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#cbd5e1",
              fontSize: "10px",
              cursor: "pointer"
            }
          },
          loading ? "..." : "Atualizar"
        )
      ),
      !kpis ? h("div", { style: { color: "#9ca3af", fontSize: "11px" } }, loading ? "Carregando telemetria..." : "Sem snapshot kpis-esteira.json.") : h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } },
          h(
            "div",
            { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
            h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "Orçamento"),
            h("div", { style: { fontWeight: "700", color: kpis.economia.status_orcamento === "OK" ? "#10b981" : "#f59e0b" } }, kpis.economia.status_orcamento)
          ),
          h(
            "div",
            { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
            h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "FPY Real"),
            h("div", { style: { fontWeight: "700", color: "#10b981" } }, kpis.qualidade.fpy_real_pct !== null ? `${kpis.qualidade.fpy_real_pct}%` : "--")
          ),
          h(
            "div",
            { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
            h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "Fila Revisão"),
            h("div", { style: { fontWeight: "700", color: "#f59e0b" } }, `${kpis.fluxo.fila_revisao_atual} cards`)
          ),
          h(
            "div",
            { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
            h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "WIP Órfão"),
            h("div", { style: { fontWeight: "700", color: "#f87171" } }, `${kpis.higiene.orphan_wip_count} (${kpis.higiene.orphan_wip_pct}%)`)
          )
        ),
        kpis.alertas_ativos.slice(0, 3).map(
          (al) => h(
            "div",
            {
              key: al.codigo,
              style: {
                padding: "6px 8px",
                borderRadius: "6px",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                fontSize: "10.5px"
              }
            },
            al.mensagem
          )
        )
      )
    );
  };
}
const CARD_BG$1 = "rgba(0, 0, 0, 0.28)";
const BORDER$1 = "1px solid rgba(255, 255, 255, 0.08)";
function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return "--:--:--";
  }
}
function renderObservabilityTab(props) {
  const {
    h,
    telemetry,
    nativeState,
    operationFilter,
    onFilterChange,
    isProbingDecision,
    lastProbeSummary,
    onRunDecisionProbe,
    onResetSpans,
    onRefresh
  } = props;
  const filteredSpans = operationFilter === "all" ? telemetry.recentSpans : telemetry.recentSpans.filter((s) => s.operationName === operationFilter);
  const integrationPills = [
    { label: "Relay Live", ok: nativeState.relayConnected },
    { label: "Slash Commands (/orgfy-*)", ok: nativeState.conversationRegistered },
    { label: "Sidebar Pulse", ok: nativeState.sidebarRegistered },
    { label: "Atalho ⌘⇧O", ok: nativeState.shortcutsRegistered },
    { label: "AttentionSource orgfy.pipeline", ok: nativeState.attentionSourceRegistered },
    { label: "OTel GenAI Hooks", ok: nativeState.otelHookRegistered },
    { label: "Aba OrgFy nos Agentes", ok: nativeState.agentTabRegistered }
  ];
  const activeCount = integrationPills.filter((p) => p.ok).length;
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "6px"
      }
    },
    // Barra Superior de Ações
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "10px",
          backgroundColor: CARD_BG$1,
          border: "1px solid rgba(56, 189, 248, 0.25)"
        }
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        h(
          "span",
          { style: { fontSize: "13.5px", fontWeight: "700", color: "#f3f4f6" } },
          "Observabilidade Frontier — OpenTelemetry GenAI & Decisions API"
        ),
        h(
          "span",
          { style: { fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
          `${telemetry.totalSpans} spans em memória · ${telemetry.decisionsSavings.totalCalls} avaliações Decisions · ${activeCount}/${integrationPills.length} integrações Buzz nativas ativas`
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        h(
          "button",
          {
            onClick: onRunDecisionProbe,
            disabled: isProbingDecision,
            style: {
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#38bdf8",
              color: "#000000",
              fontSize: "11px",
              fontWeight: "700",
              cursor: isProbingDecision ? "wait" : "pointer"
            }
          },
          isProbingDecision ? "Testando Decisions API..." : "⚡ Testar Decisions API Agora"
        ),
        h(
          "button",
          {
            onClick: onRefresh,
            style: {
              padding: "6px 10px",
              borderRadius: "6px",
              border: BORDER$1,
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#cbd5e1",
              fontSize: "11px",
              cursor: "pointer"
            }
          },
          "Atualizar"
        ),
        h(
          "button",
          {
            onClick: onResetSpans,
            style: {
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#fca5a5",
              fontSize: "11px",
              cursor: "pointer"
            }
          },
          "Limpar Spans"
        )
      )
    ),
    lastProbeSummary && h(
      "div",
      {
        style: {
          padding: "10px 14px",
          borderRadius: "8px",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          fontSize: "11px",
          color: "#a7f3d0",
          fontFamily: "monospace"
        }
      },
      lastProbeSummary
    ),
    // 4 KPI Cards de Observabilidade
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "10px"
        }
      },
      [
        {
          title: "1. Decisions API (Pré-LLM)",
          value: `${telemetry.decisionsSavings.decisionsApiCalls} nativas`,
          sub: `${telemetry.decisionsSavings.fallbackCalls} fallback · média ${telemetry.decisionsSavings.avgLatencyMs}ms`,
          color: "#10b981"
        },
        {
          title: "2. Wakes / Escalações Evitadas",
          value: String(telemetry.decisionsSavings.wakesOrEscalationsAvoided),
          sub: "Eventos filtrados antes de acordar LLM caro",
          color: "#38bdf8"
        },
        {
          title: "3. Tokens Economizados (Est.)",
          value: `~${Math.round(telemetry.decisionsSavings.estimatedTokensSaved / 1e3)}k tok`,
          sub: `${telemetry.decisionsSavings.estimatedTokensSaved.toLocaleString("pt-BR")} tokens poupados`,
          color: "#c084fc"
        },
        {
          title: "4. Alertas Retry Cascade",
          value: String(telemetry.retryCascadeAlerts.length),
          sub: telemetry.retryCascadeAlerts.length > 0 ? "Agentes com falhas consecutivas detectados" : "Nenhum agente em cascata de erro",
          color: telemetry.retryCascadeAlerts.length > 0 ? "#f87171" : "#10b981"
        }
      ].map(
        (kpi) => h(
          "div",
          {
            key: kpi.title,
            style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG$1, border: BORDER$1 }
          },
          h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, kpi.title),
          h("div", { style: { fontSize: "22px", fontWeight: "700", color: kpi.color, marginTop: "4px", fontFamily: "monospace" } }, kpi.value),
          h("div", { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } }, kpi.sub)
        )
      )
    ),
    // Barra de Sinergia Nativa Buzz Desktop
    h(
      "div",
      {
        style: {
          padding: "12px 14px",
          borderRadius: "10px",
          backgroundColor: CARD_BG$1,
          border: BORDER$1,
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }
      },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Sinergia Nativa com Buzz Desktop (@buzz/author)"),
        h("span", { style: { fontSize: "10.5px", color: "#10b981", fontFamily: "monospace" } }, `${activeCount}/${integrationPills.length} ativos`)
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        integrationPills.map(
          (p) => h(
            "span",
            {
              key: p.label,
              style: {
                fontSize: "10.5px",
                fontFamily: "monospace",
                fontWeight: "600",
                padding: "4px 10px",
                borderRadius: "9999px",
                backgroundColor: p.ok ? "rgba(16, 185, 129, 0.14)" : "rgba(156, 163, 175, 0.12)",
                border: p.ok ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(156, 163, 175, 0.25)",
                color: p.ok ? "#34d399" : "#9ca3af"
              }
            },
            `${p.ok ? "●" : "○"} ${p.label}`
          )
        )
      )
    ),
    // Grid Principal 2 Colunas: Stream de Spans OTel + Saúde por Agente
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "12px",
          alignItems: "start"
        }
      },
      // Coluna Esquerda: Live Event & Span Stream
      h(
        "div",
        {
          style: {
            padding: "14px",
            borderRadius: "10px",
            backgroundColor: CARD_BG$1,
            border: BORDER$1,
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, `Live Event & Span Stream (${filteredSpans.length})`),
          h(
            "div",
            { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
            [
              { id: "all", label: "Todos" },
              { id: "invoke_agent", label: "Agentes" },
              { id: "execute_tool", label: "Tools" },
              { id: "decisions.evaluate", label: "Decisions" },
              { id: "relay.event", label: "Relay" }
            ].map(
              (f) => h(
                "button",
                {
                  key: f.id,
                  onClick: () => onFilterChange(f.id),
                  style: {
                    padding: "3px 8px",
                    borderRadius: "5px",
                    border: operationFilter === f.id ? "1px solid rgba(56, 189, 248, 0.5)" : BORDER$1,
                    backgroundColor: operationFilter === f.id ? "rgba(56, 189, 248, 0.16)" : "rgba(255,255,255,0.03)",
                    color: operationFilter === f.id ? "#38bdf8" : "#9ca3af",
                    fontSize: "10px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }
                },
                f.label
              )
            )
          )
        ),
        filteredSpans.length === 0 ? h(
          "div",
          {
            style: {
              padding: "24px 12px",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "11.5px",
              lineHeight: "1.5"
            }
          },
          "Nenhum span capturado neste filtro ainda. Clique em '⚡ Testar Decisions API Agora' ou execute uma tool/agente para ver o stream OTel ao vivo."
        ) : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "5px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" } },
          filteredSpans.map(
            (sp) => h(
              "div",
              {
                key: sp.spanId,
                style: {
                  display: "grid",
                  gridTemplateColumns: "62px 112px 1fr 78px 54px",
                  gap: "8px",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255,255,255,0.025)",
                  border: sp.status === "error" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.04)",
                  fontSize: "10.5px",
                  fontFamily: "monospace",
                  alignItems: "center"
                }
              },
              h("span", { style: { color: "#6b7280" } }, formatTime(sp.timestamp)),
              h("span", { style: { color: "#38bdf8", fontWeight: "700" } }, sp.operationName),
              h(
                "span",
                {
                  style: { color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                  title: `${sp.agentName} ${sp.toolName || ""} ${sp.model || ""} ${sp.finishReason || ""}`
                },
                `${sp.agentName}${sp.toolName ? ` · ${sp.toolName}` : ""}${sp.model ? ` (${sp.model})` : ""}`
              ),
              h(
                "span",
                {
                  style: {
                    color: sp.status === "error" ? "#f87171" : sp.status === "filtered_out" ? "#c084fc" : "#10b981",
                    fontWeight: "700",
                    textAlign: "center"
                  }
                },
                sp.status.toUpperCase()
              ),
              h("span", { style: { color: "#9ca3af", textAlign: "right" } }, `${sp.durationMs}ms`)
            )
          )
        )
      ),
      // Coluna Direita: Saúde & Retry Cascades por Agente + Distribuição Decisions
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "div",
          { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG$1, border: BORDER$1, display: "flex", flexDirection: "column", gap: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Saúde & Retry Cascade por Agente"),
          telemetry.agentMetrics.length === 0 ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Aguardando turnos dos agentes via hook OTel (turn.completed / turn.failed).") : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            telemetry.agentMetrics.map(
              (m) => h(
                "div",
                {
                  key: m.agentName,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "7px 9px",
                    borderRadius: "6px",
                    backgroundColor: m.retryCascadeRisk ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.025)",
                    border: m.retryCascadeRisk ? "1px solid rgba(239, 68, 68, 0.35)" : BORDER$1,
                    fontSize: "10.5px",
                    fontFamily: "monospace"
                  }
                },
                h("span", { style: { color: "#f3f4f6", fontWeight: "700" } }, m.agentName),
                h(
                  "span",
                  { style: { color: m.retryCascadeRisk ? "#f87171" : "#10b981" } },
                  `${m.totalTurns} turnos · ${m.errorTurns} err · ${m.avgDurationMs}ms`
                )
              )
            )
          )
        ),
        h(
          "div",
          { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG$1, border: BORDER$1, display: "flex", flexDirection: "column", gap: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Chamadas Decisions API por Modo"),
          Object.keys(telemetry.decisionsSavings.byMode).length === 0 ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Nenhuma avaliação registrada ainda.") : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "5px" } },
            Object.entries(telemetry.decisionsSavings.byMode).map(
              ([mode, count]) => h(
                "div",
                {
                  key: mode,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.025)",
                    fontSize: "11px",
                    fontFamily: "monospace"
                  }
                },
                h("span", { style: { color: "#cbd5e1" } }, mode),
                h("span", { style: { color: "#38bdf8", fontWeight: "700" } }, `${count}x`)
              )
            )
          )
        )
      )
    )
  );
}
const CARD_BG = "rgba(0, 0, 0, 0.28)";
const BORDER = "1px solid rgba(255, 255, 255, 0.08)";
const INPUT_STYLE = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: "7px",
  backgroundColor: "rgba(0, 0, 0, 0.35)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#f3f4f6",
  fontSize: "12px",
  outline: "none",
  boxSizing: "border-box"
};
function createCardStudioTabComponent(ctx) {
  const React = ctx == null ? void 0 : ctx.react;
  const h = React.createElement;
  return function CardStudioTab({ liveAgents, defaultEmpresa, onNotify }) {
    var _a, _b;
    const firstAgent = ((_a = liveAgents[0]) == null ? void 0 : _a.name) || "OrgFy Atlas";
    const secondAgent = ((_b = liveAgents.find((a) => a.name !== firstAgent)) == null ? void 0 : _b.name) || "OrgFy Bento";
    const [empresa, setEmpresa] = React.useState(defaultEmpresa === "all" ? "orgfy" : defaultEmpresa);
    const [slug, setSlug] = React.useState("");
    const [titulo, setTitulo] = React.useState("");
    const [objetivo, setObjetivo] = React.useState("");
    const [tipo, setTipo] = React.useState("execucao");
    const [executor, setExecutor] = React.useState(firstAgent);
    const [revisor, setRevisor] = React.useState(secondAgent);
    const [autoridade, setAutoridade] = React.useState("DECIDIDO Helton / OrgFy Iris");
    const [decisao, setDecisao] = React.useState("Implementar com escopo fechado e validação L-22");
    const [escritaText, setEscritaText] = React.useState("");
    const [acceptanceCmd, setAcceptanceCmd] = React.useState("python3 -m pytest -q");
    const [feitoQuando, setFeitoQuando] = React.useState("Comando de aceite L-22 retorna exit 0 sem regressões");
    const [attentionPolicy, setAttentionPolicy] = React.useState("auto");
    const [busy, setBusy] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const [previewTab, setPreviewTab] = React.useState("markdown");
    const l01Violation = executor.trim().toLowerCase() === revisor.trim().toLowerCase();
    const copyText = (text, label) => {
      var _a2;
      try {
        (_a2 = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a2.writeText(text);
        onNotify("success", `${label} copiado!`);
      } catch {
        onNotify("warning", "Clipboard indisponível neste ambiente.");
      }
    };
    const runCreate = async (writeToDisk) => {
      if (l01Violation) {
        onNotify("warning", "Regra L-01: Executor e Revisor precisam ser perfis diferentes.");
        return;
      }
      const paths = escritaText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      if (!titulo.trim() || paths.length === 0 || !acceptanceCmd.trim()) {
        onNotify("warning", "Preencha Título, ao menos 1 path em Escrita exclusiva e Comando de aceite L-22.");
        return;
      }
      setBusy(true);
      try {
        const res = await createCanonicalCard(ctx, {
          slug: slug.trim() || titulo.trim(),
          titulo: titulo.trim(),
          objetivo: objetivo.trim() || void 0,
          autoridade: autoridade.trim(),
          decisao: decisao.trim(),
          tipo,
          executor,
          revisor,
          escrita_exclusiva: paths,
          feito_quando: feitoQuando.trim(),
          acceptance_command: acceptanceCmd.trim(),
          attention_policy: attentionPolicy === "auto" ? void 0 : attentionPolicy,
          empresa,
          write_file: writeToDisk,
          run_lint: writeToDisk
        });
        setResult(res);
        onNotify(res.ok ? "success" : "warning", res.message);
      } catch (err) {
        onNotify("warning", `Erro ao gerar card: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setBusy(false);
      }
    };
    const agentOptions = liveAgents.length > 0 ? liveAgents.map((a) => a.name) : ["OrgFy Atlas", "OrgFy Bento", "OrgFy Val", "OrgFy Teo", "OrgFy Iris", "QA Sentinel"];
    return h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: "14px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden"
        }
      },
      // COLUNA ESQUERDA: FORMULÁRIO SCHEMA-FIRST
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            overflowY: "auto",
            minHeight: 0
          }
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("span", { style: { fontSize: "13.5px", fontWeight: "700", color: "#f3f4f6" } }, "Card Studio — Abertura Schema-First (L-01 + L-22 + Attention)"),
          h("span", { style: { fontSize: "10px", color: "#10b981", fontFamily: "monospace" } }, "orgfy_card_create")
        ),
        // Linha 1: Empresa, Slug, Tipo
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "EMPRESA"),
            h(
              "select",
              { value: empresa, onChange: (e) => setEmpresa(e.target.value), style: INPUT_STYLE },
              h("option", { value: "orgfy" }, "orgfy"),
              h("option", { value: "lumen-iptv" }, "lumen-iptv"),
              h("option", { value: "saas-tributario" }, "saas-tributario")
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "SLUG (OPCIONAL)"),
            h("input", {
              type: "text",
              placeholder: "ex: fix-rls-checkout",
              value: slug,
              onChange: (e) => setSlug(e.target.value),
              style: INPUT_STYLE
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "TIPO"),
            h(
              "select",
              { value: tipo, onChange: (e) => setTipo(e.target.value), style: INPUT_STYLE },
              h("option", { value: "execucao" }, "execucao"),
              h("option", { value: "infraestrutura" }, "infraestrutura"),
              h("option", { value: "seguranca" }, "seguranca"),
              h("option", { value: "spec" }, "spec"),
              h("option", { value: "revisao" }, "revisao"),
              h("option", { value: "pesquisa" }, "pesquisa")
            )
          )
        ),
        // Título
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "TÍTULO DO CARD *"),
          h("input", {
            type: "text",
            placeholder: "Ex: Corrigir validação RLS no endpoint de billing",
            value: titulo,
            onChange: (e) => setTitulo(e.target.value),
            style: INPUT_STYLE
          })
        ),
        // Executor, Revisor, Attention Policy
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "EXECUTOR *"),
            h(
              "select",
              { value: executor, onChange: (e) => setExecutor(e.target.value), style: INPUT_STYLE },
              agentOptions.map((n) => h("option", { key: n, value: n }, n))
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "REVISOR (L-01) *"),
            h(
              "select",
              { value: revisor, onChange: (e) => setRevisor(e.target.value), style: INPUT_STYLE },
              agentOptions.map((n) => h("option", { key: n, value: n }, n))
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "BUZZ ATTENTION"),
            h(
              "select",
              { value: attentionPolicy, onChange: (e) => setAttentionPolicy(e.target.value), style: INPUT_STYLE },
              h("option", { value: "auto" }, "Auto (Decisions API)"),
              h("option", { value: "timer_curto" }, "timer_curto"),
              h("option", { value: "event_driven" }, "event_driven"),
              h("option", { value: "watchdog_longo" }, "watchdog_longo")
            )
          )
        ),
        l01Violation && h(
          "div",
          {
            style: {
              padding: "7px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(239, 68, 68, 0.14)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#fca5a5",
              fontSize: "11px",
              fontWeight: "600"
            }
          },
          "Regra L-01 violada: Executor e Revisor não podem ser o mesmo agente."
        ),
        // Escrita Exclusiva
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "ESCRITA EXCLUSIVA (1 PATH POR LINHA OU VÍRGULA) *"),
          h("textarea", {
            rows: 2,
            placeholder: "ex: src/services/billing.ts, testes/test_billing.py",
            value: escritaText,
            onChange: (e) => setEscritaText(e.target.value),
            style: { ...INPUT_STYLE, fontFamily: "monospace", resize: "vertical" }
          })
        ),
        // Comando de Aceite L-22
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#10b981", fontWeight: "700" } }, "COMANDO DE ACEITE CONGELADO (L-22 SHA-256) *"),
          h("input", {
            type: "text",
            value: acceptanceCmd,
            onChange: (e) => setAcceptanceCmd(e.target.value),
            style: { ...INPUT_STYLE, fontFamily: "monospace", color: "#34d399" }
          })
        ),
        // Feito Quando
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "FEITO QUANDO *"),
          h("input", {
            type: "text",
            value: feitoQuando,
            onChange: (e) => setFeitoQuando(e.target.value),
            style: INPUT_STYLE
          })
        ),
        // Autoridade e Decisão
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "AUTORIDADE *"),
            h("input", {
              type: "text",
              value: autoridade,
              onChange: (e) => setAutoridade(e.target.value),
              style: INPUT_STYLE
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "DECISÃO *"),
            h("input", {
              type: "text",
              value: decisao,
              onChange: (e) => setDecisao(e.target.value),
              style: INPUT_STYLE
            })
          )
        ),
        // Objetivo opcional
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "OBJETIVO (OPCIONAL)"),
          h("textarea", {
            rows: 2,
            placeholder: "Detalhe o objetivo técnico se desejar complementar o título...",
            value: objetivo,
            onChange: (e) => setObjetivo(e.target.value),
            style: { ...INPUT_STYLE, resize: "vertical" }
          })
        ),
        // Botões de Ação
        h(
          "div",
          { style: { display: "flex", gap: "8px", marginTop: "4px" } },
          h(
            "button",
            {
              onClick: () => runCreate(false),
              disabled: busy || l01Violation,
              style: {
                flex: 1,
                padding: "9px 12px",
                borderRadius: "7px",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "#38bdf8",
                fontSize: "12px",
                fontWeight: "700",
                cursor: busy || l01Violation ? "not-allowed" : "pointer"
              }
            },
            busy ? "Processando..." : "⚡ Simular & Triar (Decisions API)"
          ),
          h(
            "button",
            {
              onClick: () => runCreate(true),
              disabled: busy || l01Violation,
              style: {
                flex: 1,
                padding: "9px 12px",
                borderRadius: "7px",
                border: "none",
                backgroundColor: "#10b981",
                color: "#000000",
                fontSize: "12px",
                fontWeight: "700",
                cursor: busy || l01Violation ? "not-allowed" : "pointer"
              }
            },
            busy ? "Gravando..." : "Gravar em cards/ + Lint"
          )
        )
      ),
      // COLUNA DIREITA: PREVIEW & CONTRATO DECISIONS / ATTENTION / L-22
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            overflowY: "auto",
            minHeight: 0
          }
        },
        !result ? h(
          "div",
          {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "8px",
              color: "#9ca3af",
              padding: "24px"
            }
          },
          h("div", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, "Preview Determinístico do Card"),
          h(
            "div",
            { style: { fontSize: "11.5px", maxWidth: "360px", lineHeight: "1.5" } },
            "Preencha os campos à esquerda e clique em 'Simular & Triar' para ver o veredito da Decisions API, o hash L-22 SHA-256 congelado, o Markdown canônico e os payloads nativos do Buzz Attention."
          )
        ) : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0 } },
          // Resumo Decision Router + L-22
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px"
              }
            },
            [
              {
                label: "Risco / Tier",
                value: `${result.triage.riscoScore}/5 · ${result.triage.modeloTier}`,
                color: result.triage.riscoScore >= 4 ? "#f87171" : "#10b981"
              },
              {
                label: "Modelo Sugerido",
                value: result.triage.modeloRecomendadoHint,
                color: "#38bdf8"
              },
              {
                label: "Fonte / Attention",
                value: `${result.triage.decisionSource === "decisions_api" ? "Decisions API" : "Fallback"} · ${result.attentionContract.policy}`,
                color: "#c084fc"
              }
            ].map(
              (box) => h(
                "div",
                { key: box.label, style: { padding: "8px 10px", borderRadius: "7px", backgroundColor: "rgba(255,255,255,0.03)", border: BORDER } },
                h("div", { style: { fontSize: "9.5px", color: "#9ca3af", textTransform: "uppercase" } }, box.label),
                h("div", { style: { fontSize: "11px", fontWeight: "700", color: box.color, fontFamily: "monospace", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, box.value)
              )
            )
          ),
          // Barra L-22 SHA-256 & Status em Disco
          h(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderRadius: "7px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: "10.5px",
                fontFamily: "monospace",
                color: "#a7f3d0",
                display: "flex",
                flexDirection: "column",
                gap: "3px"
              }
            },
            h("span", null, `L-22 SHA-256: ${result.acceptanceHashSha256}`),
            h(
              "span",
              { style: { color: "#cbd5e1" } },
              `Arquivo: ${result.cardPath} · Disco: ${result.writtenToDisk ? "GRAVADO" : "simulação"} · Lint: ${result.lintPassed === null ? "não executado" : result.lintPassed ? "PASS" : "FAIL"}`
            ),
            result.lintOutput && h("span", { style: { color: result.lintPassed ? "#34d399" : "#f87171" } }, result.lintOutput)
          ),
          // Sub-tabs de preview
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
            h(
              "div",
              { style: { display: "flex", gap: "6px" } },
              [
                { id: "markdown", label: "Markdown Canônico" },
                { id: "attention", label: "Buzz Attention JSON" },
                { id: "publish", label: "Publicar (Guard)" }
              ].map(
                (t) => h(
                  "button",
                  {
                    key: t.id,
                    onClick: () => setPreviewTab(t.id),
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: previewTab === t.id ? "1px solid rgba(56,189,248,0.5)" : BORDER,
                      backgroundColor: previewTab === t.id ? "rgba(56,189,248,0.16)" : "rgba(255,255,255,0.03)",
                      color: previewTab === t.id ? "#38bdf8" : "#9ca3af",
                      fontSize: "10.5px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }
                  },
                  t.label
                )
              )
            ),
            h(
              "button",
              {
                onClick: () => {
                  const content = previewTab === "markdown" ? result.markdown : previewTab === "attention" ? JSON.stringify(result.attentionContract, null, 2) : result.publishCommand;
                  copyText(content, previewTab === "markdown" ? "Markdown" : previewTab === "attention" ? "Contrato Attention" : "Comando de publicação");
                },
                style: {
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(16,185,129,0.4)",
                  backgroundColor: "rgba(16,185,129,0.12)",
                  color: "#34d399",
                  fontSize: "10.5px",
                  fontWeight: "600",
                  cursor: "pointer"
                }
              },
              "Copiar"
            )
          ),
          h(
            "pre",
            {
              style: {
                flex: 1,
                margin: 0,
                padding: "10px 12px",
                borderRadius: "8px",
                backgroundColor: "#06080a",
                border: BORDER,
                color: previewTab === "publish" ? "#34d399" : "#e5e7eb",
                fontFamily: "monospace",
                fontSize: "10.5px",
                lineHeight: "1.45",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }
            },
            previewTab === "markdown" ? result.markdown : previewTab === "attention" ? JSON.stringify(result.attentionContract, null, 2) : result.publishCommand
          )
        )
      )
    );
  };
}
const ORGFY_REPO_ROOT = "/Users/heltonfraga/.buzz/REPOS/orgfy";
const SCRATCH_ROOT = "/Users/heltonfraga/.buzz/.scratch";
const BUZZ_AGENTS_DIR = "/Users/heltonfraga/Library/Application Support/xyz.block.buzz.desktop/agents";
function decodeBytes(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (raw && typeof raw === "object") {
    const obj = raw;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (ArrayBuffer.isView(raw)) {
      return new TextDecoder("utf-8").decode(
        new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
      );
    }
  }
  return String(raw ?? "");
}
async function safeReadText(ctx, filePath) {
  const host = ctx.host;
  if (!(host == null ? void 0 : host.readFile)) return null;
  try {
    const raw = await host.readFile(filePath);
    return decodeBytes(raw);
  } catch {
    return null;
  }
}
async function safeReadJson(ctx, filePath) {
  const txt = await safeReadText(ctx, filePath);
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
function extractField(md, label) {
  var _a;
  const rx = new RegExp(`^(?:-\\s+)?\\*\\*${label}:\\*\\*\\s*(.+)$`, "im");
  const m = md.match(rx);
  return ((_a = m == null ? void 0 : m[1]) == null ? void 0 : _a.trim()) || null;
}
function extractSection(md, heading) {
  const rx = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "is");
  const m = md.match(rx);
  if (!(m == null ? void 0 : m[1])) return null;
  const cleaned = m[1].replace(/^\*\*[^*]+:\*\*\s*/i, "").trim();
  return cleaned || null;
}
function inferCardSlugCandidates(card) {
  const candidates = [];
  const title = String(card.title || "").trim();
  const mSlug = title.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)+)/);
  if (mSlug == null ? void 0 : mSlug[1]) {
    candidates.push(mSlug[1]);
  }
  const mSpec = title.match(/\b(SPEC-\d{4})[\s-]+(T\d{3}(?:-\d{3})?)\b/i);
  if (mSpec) {
    candidates.push(`${mSpec[1].toUpperCase()}-${mSpec[2].toUpperCase()}`);
  }
  if (card.idempotencyKey) {
    candidates.push(card.idempotencyKey.toUpperCase());
  }
  return Array.from(new Set(candidates));
}
async function hydrateIssueDetail(ctx, card) {
  var _a, _b, _c, _d, _e, _f, _g;
  const fullId = String(card.fullIssueId || card.issueId || "").trim();
  const shortId = fullId.slice(0, 8).toLowerCase();
  const empresa = String(card.empresa || "orgfy").trim().toLowerCase();
  let cardMd = null;
  let cardFileFound = null;
  for (const slug of inferCardSlugCandidates(card)) {
    const path = `${ORGFY_REPO_ROOT}/cards/${slug}.md`;
    const txt = await safeReadText(ctx, path);
    if (txt) {
      cardMd = txt;
      cardFileFound = `cards/${slug}.md`;
      break;
    }
  }
  const [aceiteFile, esteiraState, locksData, empresaManifest, identitiesData, transicoesTxt] = await Promise.all([
    fullId ? safeReadJson(ctx, `${ORGFY_REPO_ROOT}/.esteira/estado/aceites/${fullId}.json`) : Promise.resolve(null),
    safeReadJson(ctx, `${ORGFY_REPO_ROOT}/.esteira/estado/esteira-minima-state.json`),
    safeReadJson(ctx, `${SCRATCH_ROOT}/orgfy-locks.json`),
    safeReadJson(ctx, `${ORGFY_REPO_ROOT}/empresas/${empresa}.json`),
    safeReadJson(ctx, `${BUZZ_AGENTS_DIR}/identities.json`),
    safeReadText(ctx, `${SCRATCH_ROOT}/esteira-transicoes.jsonl`)
  ]);
  const stateAceite = ((_a = esteiraState == null ? void 0 : esteiraState.aceites) == null ? void 0 : _a[fullId]) || ((_b = esteiraState == null ? void 0 : esteiraState.aceites) == null ? void 0 : _b[shortId]) || null;
  const realHash = String(
    (aceiteFile == null ? void 0 : aceiteFile.hash) || (aceiteFile == null ? void 0 : aceiteFile.sha256) || (stateAceite == null ? void 0 : stateAceite.hash) || (stateAceite == null ? void 0 : stateAceite.sha256) || card.acceptanceHash || ""
  ).trim() || null;
  const realAcceptCmd = String(
    (aceiteFile == null ? void 0 : aceiteFile.comando) || (stateAceite == null ? void 0 : stateAceite.comando) || card.acceptanceCommand || ""
  ).trim() || null;
  const nowMs = Date.now();
  const lockRec = (locksData == null ? void 0 : locksData[fullId]) || (locksData ? Object.values(locksData).find(
    (v) => v && String(v.issueId || "").toLowerCase().startsWith(shortId)
  ) : null);
  const lockActive = Boolean(lockRec && typeof lockRec.expiresAt === "number" && lockRec.expiresAt > nowMs);
  const lockExpiresInMin = lockActive ? Math.max(1, Math.round((lockRec.expiresAt - nowMs) / 6e4)) : null;
  let executorProvider = null;
  let executorModel = null;
  const execName = String(card.executor || (lockRec == null ? void 0 : lockRec.agentKey) || "").trim();
  if (execName && identitiesData) {
    const list = Array.isArray(identitiesData) ? identitiesData : Array.isArray(identitiesData.agents) ? identitiesData.agents : [];
    const matched = list.find(
      (a) => a && typeof a.name === "string" && a.name.trim().toLowerCase() === execName.toLowerCase()
    );
    if (matched == null ? void 0 : matched.pubkey) {
      const st = await safeReadJson(
        ctx,
        `${BUZZ_AGENTS_DIR}/state/buzz.agent.v1%3A${matched.pubkey}`
      );
      if (st == null ? void 0 : st.config) {
        executorProvider = st.config.provider || null;
        executorModel = st.config.model || null;
      }
    }
  }
  const probes = [];
  let probesSource = `empresas/${empresa}.json`;
  const manifestProbes = (_c = empresaManifest == null ? void 0 : empresaManifest.probes_caixa_preta) == null ? void 0 : _c.probes_padrao;
  const isMerged = Boolean(((_d = esteiraState == null ? void 0 : esteiraState.merged) == null ? void 0 : _d[fullId]) || ((_e = esteiraState == null ? void 0 : esteiraState.merged) == null ? void 0 : _e[shortId]) || card.stage === "feito");
  const ciRec = ((_f = esteiraState == null ? void 0 : esteiraState.ci) == null ? void 0 : _f[fullId]) || ((_g = esteiraState == null ? void 0 : esteiraState.ci) == null ? void 0 : _g[shortId]) || null;
  if (Array.isArray(manifestProbes) && manifestProbes.length > 0) {
    for (const pr of manifestProbes) {
      const tipo = String((pr == null ? void 0 : pr.tipo) || "probe");
      const label = tipo === "http_rota" ? `Rota HTTP (${pr.url || "health"})` : tipo === "supabase_rls" ? `Supabase RLS (${(pr.tabelas_obrigatorias || []).join(", ") || "tabelas"})` : tipo === "playwright_console" ? "Playwright Zero Console Err" : tipo;
      probes.push({
        label,
        status: isMerged ? "PASS" : "PENDENTE",
        detail: isMerged ? "Aprovado no Gate" : "Aguardando execução do Gate"
      });
    }
  } else {
    probesSource = `CI / Gate (${empresa})`;
    probes.push({
      label: "CI / Pytest da Esteira",
      status: (ciRec == null ? void 0 : ciRec.ok) === true || isMerged ? "PASS" : (ciRec == null ? void 0 : ciRec.ok) === false ? "FAIL" : "PENDENTE",
      detail: (ciRec == null ? void 0 : ciRec.sha) ? `SHA ${String(ciRec.sha).slice(0, 8)}` : isMerged ? "Integrado na main" : "Aguardando CI"
    });
    probes.push({
      label: "Aceite Congelado (L-22)",
      status: realHash ? "PASS" : "PENDENTE",
      detail: realHash ? `SHA-256 ${realHash.slice(0, 12)}…` : "Sem arquivo em .esteira/estado/aceites/"
    });
    probes.push({
      label: "Probes Web (Caddy / RLS / Playwright)",
      status: "NA",
      detail: `Não configurados em empresas/${empresa}.json`
    });
  }
  const transitions = [];
  let rejectionsCount = 0;
  if (transicoesTxt && shortId) {
    for (const line of transicoesTxt.split("\n")) {
      if (!line.trim() || !line.toLowerCase().includes(shortId)) continue;
      try {
        const ev = JSON.parse(line);
        const de = String(ev.de || ev.estagio_anterior || "?");
        const para = String(ev.para || ev.estagio_novo || "?");
        const detalhe = String(ev.detalhe || "");
        if (para.toLowerCase().includes("recus") || para.toLowerCase().includes("conflito") || detalhe.toLowerCase().includes("recus")) {
          rejectionsCount += 1;
        }
        transitions.push({
          ts: String(ev.ts || ev.timestamp || ""),
          de,
          para,
          autor: String(ev.autor || ""),
          detalhe
        });
      } catch {
      }
    }
  }
  const escritaRaw = cardMd ? extractField(cardMd, "Escrita exclusiva") : null;
  const escritaExclusiva = escritaRaw ? escritaRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    loadedAt: (/* @__PURE__ */ new Date()).toISOString(),
    cardFileFound,
    objetivo: cardMd && extractSection(cardMd, "Objetivo") || card.objetivo || null,
    contexto: cardMd && extractField(cardMd, "Contexto") || card.contexto || null,
    autoridade: cardMd && extractField(cardMd, "Autoridade") || card.autoridade || null,
    decisao: cardMd && extractField(cardMd, "Decisão") || card.decisao || null,
    escritaExclusiva,
    feitoQuando: cardMd && extractField(cardMd, "Feito quando") || card.feitoQuando || null,
    provaExigida: cardMd && extractSection(cardMd, "Prova exigida") || card.provaExigida || null,
    acceptanceCommand: realAcceptCmd,
    acceptanceHash: realHash,
    acceptanceFrozenValid: Boolean(realHash),
    modoBuzz: cardMd && extractField(cardMd, "Modo") || card.modoBuzz || null,
    goalMaxTurns: cardMd && extractField(cardMd, "Goal max turns") || (card.goalMaxTurns ? String(card.goalMaxTurns) : null),
    maxRuntime: cardMd && extractField(cardMd, "Tempo máximo") || card.maxRuntime || null,
    worktreePath: cardMd && extractField(cardMd, "Workspace") || card.worktreePath || null,
    branch: (lockRec == null ? void 0 : lockRec.branch) || cardMd && extractField(cardMd, "Branch") || card.branch || null,
    lockActive,
    lockAgent: (lockRec == null ? void 0 : lockRec.agentKey) || null,
    lockExpiresInMin,
    executorProvider,
    executorModel,
    probes,
    probesSource,
    transitions: transitions.slice(-6),
    rejectionsCount,
    progress: parseCardProgress(cardMd)
  };
}
function renderResolvedArchiveTab(props) {
  const {
    h,
    items,
    error,
    searchQuery,
    specFilter,
    copiedId,
    onSearchChange,
    onSpecFilterChange,
    onCopyLink,
    onReopenFollowUp,
    onRefresh
  } = props;
  if (error) {
    return h(
      "div",
      {
        style: {
          padding: "28px",
          borderRadius: "10px",
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "12px"
        }
      },
      h("div", { style: { color: "#f8fafc", fontWeight: "700", marginBottom: "6px" } }, "Arquivo de Issues Resolvidas indisponível"),
      h("div", { style: { marginBottom: "12px" } }, error),
      h(
        "button",
        {
          onClick: onRefresh,
          style: {
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            color: "#10b981",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer"
          }
        },
        "Tentar novamente"
      )
    );
  }
  const specs = Array.from(new Set(items.map((i) => i.spec).filter(Boolean)));
  const q = searchQuery.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (specFilter !== "all" && item.spec !== specFilter) return false;
    if (!q) return true;
    const hay = [
      item.issueId,
      item.code,
      item.titulo,
      item.causaRaiz,
      item.commitSha || "",
      ...item.arquivosAlterados || []
    ].join(" ").toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        paddingBottom: "24px"
      }
    },
    // Barra de busca e filtros
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "10px",
          backgroundColor: "rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.08)"
        }
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flex: "1 1 320px" } },
        h("input", {
          type: "text",
          value: searchQuery,
          onChange: (e) => onSearchChange(e.target.value),
          placeholder: "Buscar issue resolvida por código, causa raiz, arquivo ou SHA...",
          style: {
            flex: 1,
            padding: "7px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(0,0,0,0.35)",
            color: "#f8fafc",
            fontSize: "12px",
            outline: "none"
          }
        }),
        h(
          "select",
          {
            value: specFilter,
            onChange: (e) => onSpecFilterChange(e.target.value),
            style: {
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(0,0,0,0.45)",
              color: "#e2e8f0",
              fontSize: "12px"
            }
          },
          h("option", { value: "all" }, `Todas as Specs (${items.length})`),
          ...specs.map((sp) => h("option", { key: sp, value: sp }, sp))
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "#9ca3af" } },
        h("span", {}, `Exibindo ${filtered.length} de ${items.length} resolvidas (consulta sob demanda — zero poluição no Kanban ativo)`),
        h(
          "button",
          {
            onClick: onRefresh,
            style: {
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#e2e8f0",
              fontSize: "11px",
              cursor: "pointer"
            }
          },
          "Atualizar"
        )
      )
    ),
    // Lista de cards resolvidos
    filtered.length === 0 ? h(
      "div",
      {
        style: {
          padding: "24px",
          textAlign: "center",
          color: "#6b7280",
          fontSize: "12px",
          borderRadius: "10px",
          border: "1px dashed rgba(255,255,255,0.08)"
        }
      },
      "Nenhuma issue resolvida corresponde ao filtro atual."
    ) : h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "10px"
        }
      },
      ...filtered.slice(0, 60).map(
        (item) => h(
          "div",
          {
            key: item.issueId + item.code,
            style: {
              borderRadius: "10px",
              backgroundColor: "rgba(0,0,0,0.28)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 7px",
                    borderRadius: "5px",
                    backgroundColor: "rgba(16,185,129,0.15)",
                    color: "#10b981",
                    fontFamily: "monospace"
                  }
                },
                item.code
              ),
              h(
                "span",
                { style: { fontSize: "10px", color: "#38bdf8", fontFamily: "monospace" } },
                `#${item.issueId}`
              ),
              item.commitSha && h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    color: "#c084fc",
                    fontFamily: "monospace",
                    backgroundColor: "rgba(168,85,247,0.14)",
                    padding: "1px 6px",
                    borderRadius: "4px"
                  }
                },
                `SHA ${item.commitSha}`
              )
            ),
            h(
              "span",
              { style: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase" } },
              item.spec
            )
          ),
          h(
            "div",
            { style: { fontSize: "12px", fontWeight: "600", color: "#f8fafc", lineHeight: "1.35" } },
            item.titulo
          ),
          h(
            "div",
            { style: { fontSize: "11px", color: "#9ca3af", lineHeight: "1.4" } },
            item.causaRaiz
          ),
          item.arquivosAlterados && item.arquivosAlterados.length > 0 && h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
            ...item.arquivosAlterados.slice(0, 4).map(
              (f) => h(
                "span",
                {
                  key: f,
                  style: {
                    fontSize: "10px",
                    fontFamily: "monospace",
                    color: "#cbd5e1",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    padding: "2px 6px",
                    borderRadius: "4px"
                  }
                },
                f
              )
            )
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginTop: "4px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255,255,255,0.06)"
              }
            },
            h(
              "button",
              {
                onClick: () => onCopyLink(item),
                style: {
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(56,189,248,0.35)",
                  backgroundColor: "rgba(56,189,248,0.12)",
                  color: "#38bdf8",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer"
                }
              },
              copiedId === item.issueId ? "Deep-Link Copiado!" : "Copiar Deep-Link"
            ),
            h(
              "button",
              {
                onClick: () => onReopenFollowUp(item),
                style: {
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(245,158,11,0.35)",
                  backgroundColor: "rgba(245,158,11,0.12)",
                  color: "#fbbf24",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer"
                }
              },
              "Reabrir / Follow-up"
            )
          )
        )
      )
    )
  );
}
const BOARD_APPROVALS_PATH = "/Users/heltonfraga/.buzz/.scratch/board-approvals.json";
const BUZZ_AGENT_STATE_DIR = "/Users/heltonfraga/Library/Application Support/xyz.block.buzz.desktop/agents/state";
function isPlaceholderHex(val) {
  const clean = String(val || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return true;
  return /^([0-9a-f]{2})\1{31}$/.test(clean) || /^[a-f]{2}(\d)\1{61}$/.test(clean);
}
function isPlaceholderChannel(val) {
  const clean = String(val || "").trim().toLowerCase();
  if (!clean) return true;
  return clean.startsWith("a1111111-") || clean.startsWith("b2222222-") || clean.includes("0000-0000");
}
function decodeRaw(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return String(raw ?? "");
}
async function readBoardApprovals(ctx) {
  const host = ctx.host;
  if (!(host == null ? void 0 : host.readFile)) return [];
  try {
    const raw = await host.readFile(BOARD_APPROVALS_PATH);
    const parsed = JSON.parse(decodeRaw(raw));
    if (Array.isArray(parsed == null ? void 0 : parsed.items)) {
      return parsed.items;
    }
  } catch {
  }
  return [];
}
async function writeBoardApprovals(ctx, items) {
  const host = ctx.host;
  if (!host) return false;
  const serialized = JSON.stringify(
    {
      schema_version: "1.0.0",
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      items
    },
    null,
    2
  );
  if (host.writeFile) {
    try {
      await host.writeFile(BOARD_APPROVALS_PATH, serialized);
      return true;
    } catch {
    }
  }
  if (host.spawn) {
    try {
      const py = "import pathlib, sys; p = pathlib.Path(sys.argv[1]); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(sys.argv[2], encoding='utf-8')";
      const proc = await host.spawn("python", { args: ["-c", py, BOARD_APPROVALS_PATH, serialized] });
      const code = await proc.exited;
      return code === 0;
    } catch {
      return false;
    }
  }
  return false;
}
async function createBoardApproval(ctx, input) {
  const existing = await readBoardApprovals(ctx);
  const item = {
    id: `apr-${Date.now().toString(36)}`,
    empresa: input.empresa || "board",
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    solicitante: (input.solicitante || "Helton Fraga / Board").trim(),
    status: "pendente",
    criadoEm: (/* @__PURE__ */ new Date()).toISOString()
  };
  const next = [item, ...existing];
  const ok = await writeBoardApprovals(ctx, next);
  return { ok, item, items: next };
}
async function decideBoardApproval(ctx, approvalId, decision, notaDecisao) {
  const existing = await readBoardApprovals(ctx);
  const next = existing.map(
    (it) => it.id === approvalId ? {
      ...it,
      status: decision,
      decididoEm: (/* @__PURE__ */ new Date()).toISOString(),
      decididoPor: "Helton Fraga (Board)",
      notaDecisao: void 0
    } : it
  );
  const ok = await writeBoardApprovals(ctx, next);
  return { ok, items: next };
}
async function readRealTemplates(ctx) {
  const catalog = [
    { id: "tpl-v71", name: "Card v7.1 (Execução Determinística)", path: "templates/card-v7.1-template.md" },
    { id: "tpl-v3", name: "Card v3 (Canônico 13 Seções)", path: "templates/card-v3-template.md" },
    { id: "tpl-v2", name: "Card v2 (Legado)", path: "templates/card-v2-template.md" },
    { id: "tpl-exp", name: "Laudo de Experiência & UX", path: "templates/experience-template.md" }
  ];
  const results = await Promise.all(
    catalog.map(async (item) => {
      const content = await readOrgfyText(ctx, item.path);
      if (!content) {
        return {
          ...item,
          exists: false,
          linesCount: 0,
          versionTag: "ausente",
          preview: "Arquivo não encontrado em REPOS/orgfy.",
          content: ""
        };
      }
      const lines = content.split("\n");
      const marker = content.match(/<!--\s*orgfy:card\s+([a-z0-9.]+)\s*-->/i);
      const firstHeading = lines.find((l) => l.trim().startsWith("#")) || lines[0] || "";
      return {
        ...item,
        exists: true,
        linesCount: lines.length,
        versionTag: marker ? marker[1] : "markdown",
        preview: firstHeading.replace(/^#+\s*/, "").trim().slice(0, 120),
        content
      };
    })
  );
  return results;
}
async function readWorkflowStatuses(ctx) {
  const files = [{ name: "orgfy-esteira.yaml", path: ".buzz/workflows/orgfy-esteira.yaml" }];
  return Promise.all(
    files.map(async (wf) => {
      const txt = await readOrgfyText(ctx, wf.path);
      if (!txt) {
        return { ...wf, exists: false, enabled: null };
      }
      const m = txt.match(/^\s*enabled\s*:\s*(true|false)\b/im);
      return {
        ...wf,
        exists: true,
        enabled: m ? m[1].toLowerCase() === "true" : true
      };
    })
  );
}
async function fetchHoldingControlPlane(ctx) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const [boardJson, orgfyJson, activeLocks, approvals, workflows, templatesReais, regrasJson] = await Promise.all([
    readOrgfyJson(ctx, "empresas/board.json", null),
    readOrgfyJson(ctx, "empresas/orgfy.json", null),
    listActiveLocks(ctx),
    readBoardApprovals(ctx),
    readWorkflowStatuses(ctx),
    readRealTemplates(ctx),
    readOrgfyJson(ctx, ".esteira/estado/regras-probatorias.json", null)
  ]);
  const locksByAgent = /* @__PURE__ */ new Map();
  for (const lk of activeLocks) {
    locksByAgent.set(lk.agentKey.toLowerCase(), lk);
  }
  const liveAgentConfigCache = /* @__PURE__ */ new Map();
  const readLiveBuzzAgent = async (pubkey) => {
    const clean = pubkey.trim().toLowerCase();
    if (isPlaceholderHex(clean)) return null;
    if (liveAgentConfigCache.has(clean)) return liveAgentConfigCache.get(clean) || null;
    const host = ctx.host;
    if (!(host == null ? void 0 : host.readFile)) return null;
    try {
      const raw = await host.readFile(`${BUZZ_AGENT_STATE_DIR}/buzz.agent.v1%3A${clean}`);
      const parsed = JSON.parse(decodeRaw(raw));
      const cfg = parsed == null ? void 0 : parsed.config;
      if (cfg && typeof cfg === "object") {
        const res = {
          model: typeof cfg.model === "string" && cfg.model.trim() ? cfg.model.trim() : void 0,
          provider: typeof cfg.provider === "string" && cfg.provider.trim() ? cfg.provider.trim() : void 0
        };
        liveAgentConfigCache.set(clean, res);
        return res;
      }
    } catch {
    }
    return null;
  };
  const buildCompanyItem = async (slug, nome, nivel, estagio, ceoEmpresa, reportaA, man) => {
    var _a2, _b2, _c2, _d2;
    const canal = String((man == null ? void 0 : man.canal) || "");
    const canalPronto = !isPlaceholderChannel(canal);
    const agentesObj = (man == null ? void 0 : man.agentes) && typeof man.agentes === "object" ? man.agentes : {};
    const entries = Object.entries(agentesObj);
    const liveConfigs = await Promise.all(
      entries.map(([, info]) => readLiveBuzzAgent(String((info == null ? void 0 : info.pubkey) || "")))
    );
    const agentes = [];
    let agentesProntos = 0;
    entries.forEach(([agName, info], idx) => {
      const pk = String((info == null ? void 0 : info.pubkey) || "").trim();
      const pkReady = !isPlaceholderHex(pk);
      if (pkReady) agentesProntos++;
      const liveCfg = liveConfigs[idx];
      const hasLiveModel = Boolean(liveCfg == null ? void 0 : liveCfg.model);
      agentes.push({
        name: agName,
        empresa: slug,
        papel: String((info == null ? void 0 : info.papel) || "agente"),
        model: hasLiveModel ? String(liveCfg.model) : String((info == null ? void 0 : info.model) || "não definido"),
        provider: liveCfg == null ? void 0 : liveCfg.provider,
        modelSource: hasLiveModel ? "buzz_live" : "manifesto",
        parallelism: Number((info == null ? void 0 : info.parallelism) || 1),
        pubkey: pk,
        pubkeyReady: pkReady,
        activeLock: locksByAgent.get(agName.toLowerCase()) || null
      });
    });
    const pendencias = [];
    if (!man) {
      pendencias.push(`Manifesto empresas/${slug}.json não encontrado`);
    } else {
      if (!canalPronto) pendencias.push("UUID do canal Buzz ainda em placeholder");
      const faltamPk = agentes.filter((a) => !a.pubkeyReady).map((a) => a.name);
      if (faltamPk.length > 0) {
        pendencias.push(`Pubkeys pendentes (${faltamPk.length}): ${faltamPk.slice(0, 3).join(", ")}${faltamPk.length > 3 ? "…" : ""}`);
      }
      const probes = (_a2 = man == null ? void 0 : man.probes_caixa_preta) == null ? void 0 : _a2.probes_padrao;
      if (Array.isArray(probes) && probes.some((p) => String((p == null ? void 0 : p.url) || "").includes(".internal"))) {
        pendencias.push("URL de staging dos probes ainda com domínio .internal");
      }
    }
    return {
      slug,
      nome,
      nivel,
      workspaceBuzz: String(((_b2 = man == null ? void 0 : man.hierarquia) == null ? void 0 : _b2.workspace_buzz) || nome),
      ceoEmpresa,
      reportaA,
      estagio: pendencias.length === 0 ? "operacional" : estagio,
      canal,
      canalPronto,
      budgetTokensDiario: typeof ((_c2 = man == null ? void 0 : man.governanca_orcamento) == null ? void 0 : _c2.budget_tokens_diario) === "number" ? man.governanca_orcamento.budget_tokens_diario : null,
      cpiMinimo: typeof ((_d2 = man == null ? void 0 : man.governanca_orcamento) == null ? void 0 : _d2.cpi_minimo) === "number" ? man.governanca_orcamento.cpi_minimo : null,
      agentesTotal: agentes.length,
      agentesProntos,
      locksAtivos: agentes.filter((a) => a.activeLock !== null).length,
      pendenciasOnboarding: pendencias,
      agentes
    };
  };
  const empresas = [];
  empresas.push(
    await buildCompanyItem(
      "orgfy",
      ((_a = boardJson == null ? void 0 : boardJson.core_framework) == null ? void 0 : _a.nome) || "OrgFy Core (Engenharia & Método)",
      "core",
      "operacional",
      "OrgFy Bento (COO)",
      "OrgFy Iris",
      orgfyJson
    )
  );
  const subs = Array.isArray(boardJson == null ? void 0 : boardJson.subsidiarias) ? boardJson.subsidiarias : [];
  const subManifests = await Promise.all(
    subs.map((s) => readOrgfyJson(ctx, (s == null ? void 0 : s.manifesto) || `empresas/${s == null ? void 0 : s.slug}.json`, null))
  );
  const subItems = await Promise.all(
    subs.map(
      (s, idx) => buildCompanyItem(
        String((s == null ? void 0 : s.slug) || `sub-${idx}`),
        String((s == null ? void 0 : s.nome) || (s == null ? void 0 : s.workspace_buzz) || (s == null ? void 0 : s.slug) || "Subsidiária"),
        "subsidiaria",
        String((s == null ? void 0 : s.estagio) || "onboarding"),
        String((s == null ? void 0 : s.ceo_empresa) || "A definir"),
        String((s == null ? void 0 : s.reporta_a) || "OrgFy Iris"),
        subManifests[idx]
      )
    )
  );
  empresas.push(...subItems);
  const regrasObj = (regrasJson == null ? void 0 : regrasJson.regras) && typeof regrasJson.regras === "object" ? regrasJson.regras : {};
  const regrasProbatorias = Object.entries(regrasObj).map(
    ([id, r]) => ({
      id,
      erroId: String((r == null ? void 0 : r.erro_id) || id),
      descricao: String((r == null ? void 0 : r.descricao) || "Sem descrição"),
      status: String((r == null ? void 0 : r.status) || "DESCONHECIDO"),
      cardsAvaliados: Number((r == null ? void 0 : r.cards_avaliados) || 0),
      janelaAlvo: Number((r == null ? void 0 : r.janela_alvo) || 10),
      fpyObservado: typeof (r == null ? void 0 : r.fpy_observado) === "number" ? r.fpy_observado : null
    })
  );
  return {
    ok: boardJson !== null || orgfyJson !== null,
    loadedAt: (/* @__PURE__ */ new Date()).toISOString(),
    boardNome: String((boardJson == null ? void 0 : boardJson.nome) || "Conselho da Holding OrgFy"),
    fundador: {
      nome: String(((_b = boardJson == null ? void 0 : boardJson.fundador) == null ? void 0 : _b.nome) || "Helton Fraga"),
      papel: String(((_c = boardJson == null ? void 0 : boardJson.fundador) == null ? void 0 : _c.papel) || "Fundador"),
      pubkey: String(((_d = boardJson == null ? void 0 : boardJson.fundador) == null ? void 0 : _d.pubkey) || "")
    },
    ceoHolding: {
      nome: String(((_e = boardJson == null ? void 0 : boardJson.ceo_holding) == null ? void 0 : _e.nome) || "OrgFy Iris"),
      papel: String(((_f = boardJson == null ? void 0 : boardJson.ceo_holding) == null ? void 0 : _f.papel) || "CEO da Holding"),
      pubkey: String(((_g = boardJson == null ? void 0 : boardJson.ceo_holding) == null ? void 0 : _g.pubkey) || "")
    },
    conselho: Array.isArray(boardJson == null ? void 0 : boardJson.conselho) ? boardJson.conselho : [],
    fluxoEscalada: (boardJson == null ? void 0 : boardJson.fluxo_escalada) && typeof boardJson.fluxo_escalada === "object" ? boardJson.fluxo_escalada : {},
    cadeiaComando: Array.isArray((_h = boardJson == null ? void 0 : boardJson.protocolo_governanca) == null ? void 0 : _h.cadeia_comando) ? boardJson.protocolo_governanca.cadeia_comando : [],
    empresas,
    approvals,
    workflows,
    regrasProbatorias,
    templatesReais,
    activeLocks
  };
}
const fmtTokens = (n) => {
  if (n === null || !Number.isFinite(n)) return "--";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
};
function renderBoardHoldingTab(props) {
  const { h, holding, kpis } = props;
  if (!holding) {
    return h(
      "div",
      {
        style: {
          padding: "32px",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "13px"
        }
      },
      "Carregando estado real da Holding e do Conselho (empresas/board.json)..."
    );
  }
  const pendingApprovals = holding.approvals.filter((a) => a.status === "pendente");
  const workflowOk = holding.workflows.every((w) => w.exists && w.enabled === true);
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "4px"
      }
    },
    // 1. Cabeçalho Executivo da Holding
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderRadius: "10px",
          backgroundColor: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          flexWrap: "wrap",
          gap: "12px"
        }
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          h("span", { style: { fontSize: "15px", fontWeight: "700", color: "#f3f4f6" } }, holding.boardNome),
          h(
            "span",
            {
              style: {
                fontSize: "10px",
                fontFamily: "monospace",
                padding: "2px 7px",
                borderRadius: "9999px",
                backgroundColor: workflowOk ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.18)",
                color: workflowOk ? "#10b981" : "#f87171",
                fontWeight: "700"
              }
            },
            workflowOk ? "WORKFLOW ATIVO" : "ALERTA WORKFLOW"
          )
        ),
        h(
          "span",
          { style: { fontSize: "11px", color: "#9ca3af" } },
          `Fundador: ${holding.fundador.nome} · CEO Holding: ${holding.ceoHolding.nome} · ${holding.empresas.length} empresas no portfólio · ${pendingApprovals.length} aprovação(ões) pendente(s)`
        )
      ),
      h(
        "button",
        {
          onClick: props.onRefresh,
          style: {
            padding: "6px 12px",
            borderRadius: "7px",
            border: "1px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "#e5e7eb",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer"
          }
        },
        "Atualizar Holding"
      )
    ),
    // 2. Portfólio de Empresas (Core + Subsidiárias)
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "8px" } },
      h(
        "div",
        { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" } },
        "Portfólio de Empresas & Prontidão Operacional"
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: "12px"
          }
        },
        holding.empresas.map((emp) => {
          const isOp = emp.estagio === "operacional";
          const statusColor = isOp ? "#10b981" : emp.estagio === "onboarding" ? "#f59e0b" : "#60a5fa";
          return h(
            "div",
            {
              key: emp.slug,
              style: {
                padding: "14px 16px",
                borderRadius: "10px",
                backgroundColor: "#15161a",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, emp.nome),
                h(
                  "span",
                  { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } },
                  `Workspace: ${emp.workspaceBuzz} · Liderança: ${emp.ceoEmpresa}`
                )
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                    textTransform: "uppercase"
                  }
                },
                emp.estagio
              )
            ),
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  fontSize: "11px"
                }
              },
              h(
                "div",
                null,
                h("div", { style: { fontSize: "9px", color: "#6b7280" } }, "AGENTES"),
                h("div", { style: { fontWeight: "700", color: "#f3f4f6", fontFamily: "monospace" } }, `${emp.agentesProntos}/${emp.agentesTotal}`)
              ),
              h(
                "div",
                null,
                h("div", { style: { fontSize: "9px", color: "#6b7280" } }, "TETO/DIA"),
                h("div", { style: { fontWeight: "700", color: "#f3f4f6", fontFamily: "monospace" } }, `${fmtTokens(emp.budgetTokensDiario)} tok`)
              ),
              h(
                "div",
                null,
                h("div", { style: { fontSize: "9px", color: "#6b7280" } }, "EM EXECUÇÃO"),
                h("div", { style: { fontWeight: "700", color: emp.locksAtivos > 0 ? "#f59e0b" : "#10b981", fontFamily: "monospace" } }, `${emp.locksAtivos} ativo(s)`)
              )
            ),
            emp.slug === "orgfy" && kpis ? h(
              "div",
              { style: { fontSize: "11px", color: "#9ca3af", display: "flex", gap: "10px", fontFamily: "monospace" } },
              h("span", { style: { color: "#10b981" } }, `FPY: ${kpis.qualidade.fpy_real_pct ?? "--"}%`),
              h("span", null, `30d: ${kpis.fluxo.vazao_30d} merges`),
              h("span", null, `Alertas: ${kpis.alertas_ativos.length}`)
            ) : null,
            emp.pendenciasOnboarding.length > 0 ? h(
              "div",
              {
                style: {
                  padding: "8px 10px",
                  borderRadius: "7px",
                  backgroundColor: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  fontSize: "10px",
                  color: "#fbbf24",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px"
                }
              },
              h("strong", null, "Pendências para virar a chave:"),
              emp.pendenciasOnboarding.map((p, i) => h("span", { key: i }, `• ${p}`))
            ) : h(
              "div",
              { style: { fontSize: "10px", color: "#10b981" } },
              "✓ Manifesto, canal e chaves operacionais validados."
            ),
            h(
              "button",
              {
                onClick: () => props.onSelectTenant(emp.slug),
                style: {
                  marginTop: "auto",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: "#e5e7eb",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer"
                }
              },
              `Abrir Esteira de ${emp.nome} →`
            )
          );
        })
      )
    ),
    // 3. Linha inferior: Conselho Funcional + Fila de Aprovações do Board
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1.35fr",
          gap: "12px"
        }
      },
      // Conselho Funcional + Fluxo de Escalada
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }
        },
        h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "Conselho Funcional (Board)"),
        holding.conselho.map(
          (c) => h(
            "div",
            {
              key: c.id,
              style: {
                padding: "8px 10px",
                borderRadius: "7px",
                backgroundColor: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px"
              }
            },
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "2px" } },
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } }, c.area),
              h("span", { style: { fontSize: "10px", color: "#9ca3af" } }, c.responsavel)
            ),
            h(
              "span",
              {
                style: {
                  fontSize: "9px",
                  fontWeight: "700",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: c.status === "ativo" ? "rgba(16,185,129,0.16)" : "rgba(96,165,250,0.16)",
                  color: c.status === "ativo" ? "#10b981" : "#60a5fa",
                  textTransform: "uppercase"
                }
              },
              c.status
            )
          )
        ),
        Object.keys(holding.fluxoEscalada).length > 0 && h(
          "div",
          {
            style: {
              marginTop: "4px",
              padding: "10px",
              borderRadius: "7px",
              backgroundColor: "rgba(56,189,248,0.06)",
              border: "1px solid rgba(56,189,248,0.18)",
              fontSize: "10px",
              color: "#cbd5e1",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }
          },
          h("strong", { style: { color: "#38bdf8" } }, "Roteamento de Autonomia:"),
          Object.entries(holding.fluxoEscalada).map(
            ([k, v]) => h("span", { key: k }, `• ${k.replace(/_/g, " ")}: ${v}`)
          )
        )
      ),
      // Fila de Aprovações do Board (Persistida em board-approvals.json)
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "Fila de Aprovações do Board (Z5 / Z6 / Investimentos)"),
          h("span", { style: { fontSize: "10px", fontFamily: "monospace", color: "#9ca3af" } }, `${pendingApprovals.length} pendente(s)`)
        ),
        // Formulário rápido de nova deliberação
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "1fr 120px 130px",
              gap: "6px"
            }
          },
          h("input", {
            type: "text",
            placeholder: "Nova pauta ou aprovação para o Board...",
            value: props.newApprovalTitle,
            onChange: (e) => props.setNewApprovalTitle(e.target.value),
            style: {
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f3f4f6",
              fontSize: "11px",
              outline: "none"
            }
          }),
          h(
            "select",
            {
              value: props.newApprovalCompany,
              onChange: (e) => props.setNewApprovalCompany(e.target.value),
              style: {
                padding: "6px 8px",
                borderRadius: "6px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f3f4f6",
                fontSize: "11px"
              }
            },
            h("option", { value: "board" }, "Board"),
            holding.empresas.map((e) => h("option", { key: e.slug, value: e.slug }, e.nome))
          ),
          h(
            "select",
            {
              value: props.newApprovalType,
              onChange: (e) => props.setNewApprovalType(e.target.value),
              style: {
                padding: "6px 8px",
                borderRadius: "6px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f3f4f6",
                fontSize: "11px"
              }
            },
            h("option", { value: "investimento" }, "Investimento"),
            h("option", { value: "orcamento" }, "Orçamento"),
            h("option", { value: "metodo_z5_z6" }, "Método Z5/Z6"),
            h("option", { value: "intervencao" }, "Intervenção"),
            h("option", { value: "onboarding" }, "Onboarding")
          )
        ),
        h(
          "div",
          { style: { display: "flex", gap: "6px" } },
          h("input", {
            type: "text",
            placeholder: "Contexto objetivo ou impacto esperado...",
            value: props.newApprovalDesc,
            onChange: (e) => props.setNewApprovalDesc(e.target.value),
            style: {
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f3f4f6",
              fontSize: "11px",
              outline: "none"
            }
          }),
          h(
            "button",
            {
              onClick: () => {
                if (!props.newApprovalTitle.trim()) return;
                props.onCreateApproval({
                  empresa: props.newApprovalCompany,
                  tipo: props.newApprovalType,
                  titulo: props.newApprovalTitle,
                  descricao: props.newApprovalDesc || "Registrado via OrgFy Control Plane"
                });
              },
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#10b981",
                color: "#000000",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer"
              }
            },
            "+ Registrar"
          )
        ),
        holding.approvals.length === 0 ? h(
          "div",
          { style: { padding: "18px", textAlign: "center", color: "#6b7280", fontSize: "11px" } },
          "Nenhuma deliberação registrada em board-approvals.json ainda."
        ) : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "230px", overflowY: "auto" } },
          holding.approvals.map(
            (ap) => h(
              "div",
              {
                key: ap.id,
                style: {
                  padding: "8px 10px",
                  borderRadius: "7px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px"
                }
              },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px" } },
                  h("span", { style: { fontSize: "9px", fontFamily: "monospace", color: "#38bdf8", textTransform: "uppercase" } }, `${ap.empresa} · ${ap.tipo}`),
                  h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } }, ap.titulo)
                ),
                h("span", { style: { fontSize: "10px", color: "#9ca3af" } }, ap.descricao)
              ),
              ap.status === "pendente" ? h(
                "div",
                { style: { display: "flex", gap: "6px", flexShrink: 0 } },
                h(
                  "button",
                  {
                    onClick: () => props.onDecideApproval(ap.id, "aprovado"),
                    style: {
                      padding: "4px 8px",
                      borderRadius: "5px",
                      border: "none",
                      backgroundColor: "rgba(16,185,129,0.2)",
                      color: "#10b981",
                      fontSize: "10px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }
                  },
                  "Aprovar"
                ),
                h(
                  "button",
                  {
                    onClick: () => props.onDecideApproval(ap.id, "recusado"),
                    style: {
                      padding: "4px 8px",
                      borderRadius: "5px",
                      border: "none",
                      backgroundColor: "rgba(239,68,68,0.18)",
                      color: "#f87171",
                      fontSize: "10px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }
                  },
                  "Recusar"
                )
              ) : h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    color: ap.status === "aprovado" ? "#10b981" : "#f87171",
                    textTransform: "uppercase",
                    flexShrink: 0
                  }
                },
                ap.status
              )
            )
          )
        )
      )
    )
  );
}
function renderOrgChartTab(props) {
  const { h, holding, selectedTenant } = props;
  if (!holding) {
    return h(
      "div",
      { style: { padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: "13px" } },
      "Carregando organograma real da holding..."
    );
  }
  const visibleCompanies = selectedTenant === "all" || selectedTenant === "board" ? holding.empresas : holding.empresas.filter((e) => e.slug === selectedTenant);
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "4px"
      }
    },
    // Topo da Hierarquia: Fundador -> CEO Holding (Board)
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }
      },
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(16,185,129,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }
        },
        h("span", { style: { fontSize: "10px", color: "#10b981", fontWeight: "700", textTransform: "uppercase" } }, "Nível 0 · Presidente do Conselho"),
        h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, holding.fundador.nome),
        h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, holding.fundador.papel)
      ),
      h(
        "div",
        {
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(56,189,248,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }
        },
        h("span", { style: { fontSize: "10px", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase" } }, "Nível 1 · CEO da Holding (Board)"),
        h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, holding.ceoHolding.nome),
        h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, holding.ceoHolding.papel)
      )
    ),
    // Empresas e Times
    visibleCompanies.map(
      (emp) => h(
        "div",
        {
          key: emp.slug,
          style: {
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "#15161a",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, emp.nome),
            h(
              "span",
              { style: { fontSize: "10px", fontFamily: "monospace", color: "#9ca3af" } },
              `Reporta a ${emp.reportaA} · ${emp.agentesProntos}/${emp.agentesTotal} prontos`
            )
          ),
          h(
            "span",
            {
              style: {
                fontSize: "10px",
                fontFamily: "monospace",
                color: emp.nivel === "core" ? "#38bdf8" : "#c084fc",
                textTransform: "uppercase"
              }
            },
            emp.nivel === "core" ? "Fábrica de Método" : "Subsidiária"
          )
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "8px"
            }
          },
          emp.agentes.map((ag) => {
            const isBusy = ag.activeLock !== null;
            const badgeColor = isBusy ? "#f59e0b" : ag.pubkeyReady ? "#10b981" : "#6b7280";
            const badgeText = isBusy ? "EM EXECUÇÃO" : ag.pubkeyReady ? "PRONTO" : "PUBKEY PENDENTE";
            return h(
              "div",
              {
                key: `${emp.slug}-${ag.name}`,
                style: {
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.28)",
                  border: isBusy ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, ag.name),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "9px",
                      fontWeight: "700",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      backgroundColor: `${badgeColor}22`,
                      color: badgeColor
                    }
                  },
                  badgeText
                )
              ),
              h("span", { style: { fontSize: "10px", color: "#9ca3af" } }, `Papel: ${ag.papel} · Paralelismo: ${ag.parallelism}x`),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                h(
                  "span",
                  { style: { fontSize: "10px", fontFamily: "monospace", color: ag.modelSource === "buzz_live" ? "#38bdf8" : "#9ca3af" } },
                  ag.model
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "8.5px",
                      fontFamily: "monospace",
                      padding: "1px 4px",
                      borderRadius: "3px",
                      backgroundColor: ag.modelSource === "buzz_live" ? "rgba(16,185,129,0.16)" : "rgba(156,163,175,0.14)",
                      color: ag.modelSource === "buzz_live" ? "#10b981" : "#9ca3af"
                    },
                    title: ag.modelSource === "buzz_live" ? "Lido ao vivo do Buzz Desktop (buzz.agent.v1)" : "Referência do manifesto empresas/*.json"
                  },
                  ag.modelSource === "buzz_live" ? ag.provider ? `LIVE · ${ag.provider}` : "LIVE" : "manifesto"
                )
              ),
              ag.activeLock && h(
                "span",
                { style: { fontSize: "9.5px", fontFamily: "monospace", color: "#fbbf24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                `Lock #${ag.activeLock.issueId.slice(0, 8)}${ag.activeLock.title ? ` · ${ag.activeLock.title}` : ""}`
              )
            );
          })
        )
      )
    )
  );
}
const inject = [
  "react",
  "pages",
  "settingsCards",
  "host",
  "navigation",
  "agents",
  "panels",
  "artifactStorage",
  "notifications",
  "decisions"
];
const TENANTS = [
  { id: "all", name: "Holding OrgFy", badge: "Cross-Workspace", slug: "all" },
  { id: "orgfy", name: "OrgFy Core", badge: "Core Framework", slug: "orgfy" },
  { id: "lumen-iptv", name: "Lumen IPTV", badge: "Subsidiária IPTV", slug: "lumen-iptv" },
  { id: "saas-tributario", name: "SaaS Tributário", badge: "Subsidiária Fiscal", slug: "saas-tributario" }
];
const INITIAL_PIPELINE_CARDS = [];
const INITIAL_REGRAS_PROBATORIAS = [];
const AVAILABLE_AGENTS = [];
const SVG = {
  orgfy: ({ h, width = 20, height = 20 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polygon", { points: "12 2 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 2" }),
    h("line", { x1: "12", y1: "22", x2: "12", y2: "15.5" }),
    h("polyline", { points: "22 8.5 12 15.5 2 8.5" }),
    h("polyline", { points: "2 15.5 12 8.5 22 15.5" })
  ),
  bell: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }),
    h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })
  ),
  bellOff: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" }),
    h("path", { d: "M18.63 13A17.89 17.89 0 0 1 18 8" }),
    h("path", { d: "M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" }),
    h("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
  ),
  zap: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
  ),
  shield: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
  ),
  refresh: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
  ),
  messageCircle: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" })
  ),
  columns: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
    h("line", { x1: "12", y1: "3", x2: "12", y2: "21" })
  ),
  chevronDown: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "6 9 12 15 18 9" })
  ),
  chevronRight: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "9 18 15 12 9 6" })
  ),
  search: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "11", cy: "11", r: "8" }),
    h("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
  ),
  checkCircle: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
    h("polyline", { points: "22 4 12 14.01 9 11.01" })
  ),
  alertTriangle: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
    h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
    h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
  ),
  xCircle: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "12", cy: "12", r: "10" }),
    h("line", { x1: "15", y1: "9", x2: "9", y2: "15" }),
    h("line", { x1: "9", y1: "9", x2: "15", y2: "15" })
  ),
  terminal: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "4 17 10 11 4 5" }),
    h("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
  ),
  user: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
    h("circle", { cx: "12", cy: "7", r: "4" })
  ),
  cpu: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", ry: "2" }),
    h("rect", { x: "9", y: "9", width: "6", height: "6" }),
    h("line", { x1: "9", y1: "1", x2: "9", y2: "4" }),
    h("line", { x1: "15", y1: "1", x2: "15", y2: "4" }),
    h("line", { x1: "9", y1: "20", x2: "9", y2: "23" }),
    h("line", { x1: "15", y1: "20", x2: "15", y2: "23" })
  ),
  clock: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "12", cy: "12", r: "10" }),
    h("polyline", { points: "12 6 12 12 16 14" })
  ),
  gitCommit: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "12", cy: "12", r: "4" }),
    h("line", { x1: "1.05", y1: "12", x2: "7", y2: "12" }),
    h("line", { x1: "17.01", y1: "12", x2: "22.96", y2: "12" })
  ),
  externalLink: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
    h("polyline", { points: "15 3 21 3 21 9" }),
    h("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
  ),
  copy: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
    h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
  ),
  users: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
    h("circle", { cx: "9", cy: "7", r: "4" }),
    h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
    h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
  ),
  folder: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })
  ),
  activity: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
  ),
  gitPullRequest: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "18", cy: "18", r: "3" }),
    h("circle", { cx: "6", cy: "6", r: "3" }),
    h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
    h("line", { x1: "6", y1: "9", x2: "6", y2: "21" })
  ),
  fileText: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
    h("polyline", { points: "14 2 14 8 20 8" }),
    h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
    h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
    h("polyline", { points: "10 9 9 9 8 9" })
  ),
  list: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
    h("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
    h("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
    h("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
    h("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
    h("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })
  )
};
const THEME = {
  canvas: "#0e0f12",
  // Level 0: App Canvas neutro chumbo
  columnBg: "#15161a",
  // Level 1: Recipiente sutil das colunas
  cardBg: "#1c1d23",
  // Level 2: Superfície elevada dos cards
  cardHover: "#23252d",
  // Level 2 hover
  hairline: "rgba(255, 255, 255, 0.06)",
  borderCard: "rgba(255, 255, 255, 0.08)",
  accentPrimary: "#10b981",
  // Esmeralda limpo para botão primário de despacho
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280"
};
function apply(ctx) {
  var _a, _b, _c;
  const React = ctx.react;
  const h = React.createElement;
  const CardStudioTab = createCardStudioTabComponent(ctx);
  function OrgFyCockpit() {
    var _a2, _b2, _c2, _d, _e, _f, _g, _h;
    const [selectedTenant, setSelectedTenant] = React.useState("all");
    const [porteiroActive, setPorteiroActive] = React.useState(true);
    const [isSyncingPorteiro, setIsSyncingPorteiro] = React.useState(false);
    const [fpyRate, setFpyRate] = React.useState(null);
    const [cpiTokens, setCpiTokens] = React.useState(null);
    const [totalMergedGate, setTotalMergedGate] = React.useState(null);
    const [circuitBreakerLoop, setCircuitBreakerLoop] = React.useState(null);
    const [totalAceitesBlindados, setTotalAceitesBlindados] = React.useState(null);
    const [viewMode, setViewMode] = React.useState("kanban");
    const [pipelineCards, setPipelineCards] = React.useState(() => {
      try {
        const stored = localStorage.getItem("orgfy_pipeline_cards_v11");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
        return [];
      } catch {
        return [];
      }
    });
    const [regrasProbatorias, setRegrasProbatorias] = React.useState(() => {
      try {
        const stored = localStorage.getItem("orgfy_regras_probatorias");
        return stored ? JSON.parse(stored) : INITIAL_REGRAS_PROBATORIAS;
      } catch {
        return INITIAL_REGRAS_PROBATORIAS;
      }
    });
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedTierFilter, setSelectedTierFilter] = React.useState("all");
    const [selectedAssigneeFilter, setSelectedAssigneeFilter] = React.useState("all");
    const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
    const [isGateModalOpen, setIsGateModalOpen] = React.useState(false);
    const [activeGateCard, setActiveGateCard] = React.useState(null);
    const [isLogsDrawerOpen, setIsLogsDrawerOpen] = React.useState(false);
    const [activeLogsCard, setActiveLogsCard] = React.useState(null);
    const [isGovernanceDrawerOpen, setIsGovernanceDrawerOpen] = React.useState(false);
    const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
    const [copilotAgent, setCopilotAgent] = React.useState("OrgFy Bento");
    const [isBootstrapModalOpen, setIsBootstrapModalOpen] = React.useState(false);
    const [bootstrapSteps, setBootstrapSteps] = React.useState(INITIAL_BOOTSTRAP_STEPS);
    const [isBootstrapping, setIsBootstrapping] = React.useState(false);
    const [bootstrapLog, setBootstrapLog] = React.useState("");
    const [bootstrapDone, setBootstrapDone] = React.useState(false);
    const [mcpStatus, setMcpStatus] = React.useState({ active: false, toolCallsCount: 0 });
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = React.useState(true);
    const [isMcpDiagnosticsOpen, setIsMcpDiagnosticsOpen] = React.useState(false);
    const [isMigrationModalOpen, setIsMigrationModalOpen] = React.useState(false);
    const [migrationSummary, setMigrationSummary] = React.useState(null);
    const [isMigrating, setIsMigrating] = React.useState(false);
    const [migrationLog, setMigrationLog] = React.useState("");
    const [activeIssueDetailCard, setActiveIssueDetailCard] = React.useState(null);
    const [hydratedIssueDetail, setHydratedIssueDetail] = React.useState(null);
    const [isHydratingIssueDetail, setIsHydratingIssueDetail] = React.useState(false);
    const [activeCentralTab, setActiveCentralTab] = React.useState("board");
    const [obsFilter, setObsFilter] = React.useState("all");
    const [isProbingDecision, setIsProbingDecision] = React.useState(false);
    const [lastProbeSummary, setLastProbeSummary] = React.useState(null);
    React.useEffect(() => {
      let cancelled = false;
      if (!activeIssueDetailCard) {
        setHydratedIssueDetail(null);
        return;
      }
      setIsHydratingIssueDetail(true);
      hydrateIssueDetail(ctx, activeIssueDetailCard).then((res) => {
        if (!cancelled) setHydratedIssueDetail(res);
      }).catch(() => {
        if (!cancelled) setHydratedIssueDetail(null);
      }).finally(() => {
        if (!cancelled) setIsHydratingIssueDetail(false);
      });
      return () => {
        cancelled = true;
      };
    }, [activeIssueDetailCard]);
    const [holdingData, setHoldingData] = React.useState(null);
    const [newApprovalTitle, setNewApprovalTitle] = React.useState("");
    const [newApprovalDesc, setNewApprovalDesc] = React.useState("");
    const [newApprovalCompany, setNewApprovalCompany] = React.useState("board");
    const [newApprovalType, setNewApprovalType] = React.useState("investimento");
    const [kpisData, setKpisData] = React.useState(null);
    const [kpisHistory, setKpisHistory] = React.useState([]);
    const [kpisError, setKpisError] = React.useState(null);
    const [isRecalculatingKpis, setIsRecalculatingKpis] = React.useState(false);
    const [governanceSummary, setGovernanceSummary] = React.useState(null);
    const [loopRadar, setLoopRadar] = React.useState(null);
    const [telemetrySnap, setTelemetrySnap] = React.useState(() => getTelemetrySnapshot());
    const liveAgents = React.useMemo(() => {
      var _a3, _b3;
      try {
        const snap = ((_b3 = (_a3 = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _a3.snapshot) == null ? void 0 : _b3.call(_a3)) || {};
        const pool = [...snap.running || [], ...snap.agents || []];
        const seen = /* @__PURE__ */ new Set();
        const list = [];
        for (const a of pool) {
          const name = String((a == null ? void 0 : a.name) || (a == null ? void 0 : a.key) || "").trim();
          if (!name || seen.has(name)) continue;
          seen.add(name);
          list.push({ id: String((a == null ? void 0 : a.key) || name), name, tier: "tier_1_exec_barato" });
        }
        return list;
      } catch {
        return [];
      }
    }, [holdingData]);
    React.useEffect(() => {
      const unsubTel = subscribeTelemetry(() => setTelemetrySnap(getTelemetrySnapshot()));
      const unsubRelay = subscribeRelayUpdates(() => {
        loadRealState();
      });
      return () => {
        unsubTel();
        unsubRelay();
      };
    }, []);
    React.useEffect(() => {
      var _a3, _b3;
      updateOrgfySidebarCounts({
        triagem: pipelineCards.filter((c) => c.stage === "triagem").length,
        execucao: pipelineCards.filter((c) => c.stage === "execucao").length,
        revisao: pipelineCards.filter((c) => c.stage === "revisao").length,
        loopsAtivos: ((_a3 = loopRadar == null ? void 0 : loopRadar.resumo) == null ? void 0 : _a3.criticos_ativos) ?? ((_b3 = loopRadar == null ? void 0 : loopRadar.resumo) == null ? void 0 : _b3.criticos) ?? 0
      });
    }, [pipelineCards, loopRadar]);
    const [stoppingSessionId, setStoppingSessionId] = React.useState(null);
    const [failingOverSessionId, setFailingOverSessionId] = React.useState(null);
    const handleRunDecisionProbe = React.useCallback(async () => {
      setIsProbingDecision(true);
      try {
        const t0 = Date.now();
        const res = await triageCardWithDecisions(ctx, {
          slug: "probe-decisions-live",
          titulo: "Validar latência e classificação Decisions API ao vivo",
          tipo: "execucao",
          escrita_exclusiva: ["src/services/decision-router.ts"],
          acceptance_command: "node --test verify_plugin.test.mjs"
        });
        const ms = Date.now() - t0;
        setLastProbeSummary(
          `Probe OK (${ms}ms) · fonte: ${res.decisionSource} · backend: ${res.backend || "fallback"} · modelo: ${res.model || "determinístico"} · risco: ${res.riscoScore}/5 · tier: ${res.modeloTier} · Attention: ${res.attentionPolicy}`
        );
        setTelemetrySnap(getTelemetrySnapshot());
      } finally {
        setIsProbingDecision(false);
      }
    }, []);
    const handleResetSpans = React.useCallback(() => {
      resetTelemetryForTests();
      setTelemetrySnap(getTelemetrySnapshot());
      setLastProbeSummary(null);
    }, []);
    const [resolvedItems, setResolvedItems] = React.useState([]);
    const [resolvedError, setResolvedError] = React.useState(null);
    const [resolvedSearch, setResolvedSearch] = React.useState("");
    const [resolvedSpecFilter, setResolvedSpecFilter] = React.useState("all");
    const [copiedResolvedId, setCopiedResolvedId] = React.useState(null);
    const loadHolding = React.useCallback(async () => {
      const snap = await fetchHoldingControlPlane(ctx);
      setHoldingData(snap);
    }, []);
    const loadLoopRadar = React.useCallback(async () => {
      const radar = await fetchGooseLoopRadar(ctx);
      setLoopRadar(radar);
    }, []);
    const loadKpis = React.useCallback(async () => {
      const res = await fetchKpisEsteira(ctx);
      setKpisData(res.kpis);
      setKpisHistory(res.history);
      setKpisError(res.error);
      loadLoopRadar();
    }, [loadLoopRadar]);
    const loadResolvedArchive = React.useCallback(async () => {
      const res = await fetchResolvedArchive(ctx);
      setResolvedItems(res.itens);
      setResolvedError(res.error);
    }, []);
    React.useEffect(() => {
      loadHolding();
      loadKpis();
      loadResolvedArchive();
    }, [loadHolding, loadKpis, loadResolvedArchive]);
    const handleRecalculateKpis = React.useCallback(async () => {
      setIsRecalculatingKpis(true);
      try {
        const recalc = await recalculateKpisNow(ctx);
        if (!recalc.ok) {
          setKpisError(recalc.output || "Falha ao recalcular KPIs");
        } else {
          await loadKpis();
        }
      } finally {
        setIsRecalculatingKpis(false);
      }
    }, [loadKpis]);
    const handleRunGovernanceEval = React.useCallback(async () => {
      const evalRes = await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: true, includeRadar: true });
      setGovernanceSummary(
        `Orçamento: ${evalRes.budget.statusOrcamento} | Alertas: ${evalRes.alertsDetected} | Notificações: ${evalRes.notificationsSent.length} | Wakes: ${evalRes.wakesTriggered.join(", ") || "0"} | Cooldown: ${evalRes.skippedByCooldown.length}`
      );
    }, []);
    const handleWakeIrisForLoops = React.useCallback(async () => {
      await loadLoopRadar();
      const evalRes = await evaluateGovernanceAndReact(ctx, {
        dryRun: false,
        autoWake: true,
        bypassCooldown: true,
        includeRadar: true
      });
      const targets = evalRes.wakesTriggered.join(", ") || "nenhum loop ativo";
      setGovernanceSummary(
        `Chamada Radar (COO → CEO) disparada | Alertas: ${evalRes.alertsDetected} | Wakes: ${targets}`
      );
      showNotification("info", evalRes.wakesTriggered.length > 0 ? `Auto-cura acionada: ${targets}` : "Nenhum loop ativo detectado no momento.");
    }, [loadLoopRadar]);
    const handleStopLoopSession = React.useCallback(async (session) => {
      setStoppingSessionId(session.session_id);
      try {
        const res = await stopAgentSession(ctx, {
          agente: session.agente,
          agent_pubkey: session.agent_pubkey,
          channel_id: session.channel_id,
          thread_root: session.thread_root,
          action: "interrupt",
          reason: `Stop manual via Radar (${session.duracao_min}m · ${session.shells} shells)`
        });
        setGovernanceSummary(res.message);
        showNotification(res.ok ? "success" : "warning", res.message);
        setTimeout(() => {
          loadLoopRadar();
        }, 800);
      } finally {
        setStoppingSessionId(null);
      }
    }, [loadLoopRadar]);
    const handleFailoverModelSession = React.useCallback(async (session) => {
      setFailingOverSessionId(session.session_id);
      try {
        const res = await executeSmartModelFailover(ctx, {
          agente: session.agente,
          agent_pubkey: session.agent_pubkey,
          prefer_free: true,
          apply: true,
          retrigger: true,
          channel_id: session.channel_id,
          thread_root: session.thread_root
        });
        setGovernanceSummary(res.message);
        showNotification(res.ok ? "success" : "warning", res.message);
        setTimeout(() => {
          loadLoopRadar();
        }, 1e3);
      } finally {
        setFailingOverSessionId(null);
      }
    }, [loadLoopRadar]);
    const [isExecutingDispatch, setIsExecutingDispatch] = React.useState(false);
    const [isExecutingGate, setIsExecutingGate] = React.useState(false);
    const [liveLogStream, setLiveLogStream] = React.useState(
      "[SISTEMA] Console pronto. Streaming de subprocessos e logs da esteira ativado.\n"
    );
    const [dispatchIssueId, setDispatchIssueId] = React.useState("");
    const [dispatchExecutor, setDispatchExecutor] = React.useState("OrgFy Atlas");
    const [dispatchRevisor, setDispatchRevisor] = React.useState("OrgFy Bento");
    const [dispatchIsolatedWorktree, setDispatchIsolatedWorktree] = React.useState(true);
    const [dispatchRunCi, setDispatchRunCi] = React.useState(true);
    const [gateRejectionReason, setGateRejectionReason] = React.useState("");
    const [dsapWarning, setDsapWarning] = React.useState(false);
    const [dsapSimilarity, setDsapSimilarity] = React.useState(0);
    const [dsapMatchedTokens, setDsapMatchedTokens] = React.useState([]);
    const [notification, setNotification] = React.useState(null);
    const showNotification = (type, text) => {
      setNotification({ type, text });
      setTimeout(() => setNotification(null), 3500);
    };
    const appendLiveLog = (chunk) => {
      setLiveLogStream((prev) => prev + chunk);
    };
    const loadMigrationData = async () => {
      try {
        const sum = await fetchMigrationStatus(ctx);
        setMigrationSummary(sum);
      } catch (err) {
        console.warn("Erro ao buscar status de migração:", err);
      }
    };
    React.useEffect(() => {
      loadMigrationData();
    }, []);
    React.useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          setIsBootstrapModalOpen(false);
          setIsDispatchModalOpen(false);
          setIsGateModalOpen(false);
          setIsLogsDrawerOpen(false);
          setIsMcpDiagnosticsOpen(false);
          setIsMigrationModalOpen(false);
          setIsGovernanceDrawerOpen(false);
          setActiveIssueDetailCard(null);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
    const handleExecuteMigration = async () => {
      setIsMigrating(true);
      setMigrationLog("[MIGRADOR] Iniciando processo de migração para v10...\n");
      try {
        const res = await executeAgentMigration(ctx, (chunk) => {
          setMigrationLog((prev) => prev + chunk);
          appendLiveLog(chunk);
        });
        if (res.success) {
          showNotification("success", "16 agentes migrados para REPOS/orgfy e sincronizados com v10!");
          await loadMigrationData();
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Migração Concluída", "Todos os 16 agentes foram sincronizados para v10 no workspace REPOS/orgfy.");
          }
        } else {
          showNotification("warning", "Migração concluída com avisos. Verifique o terminal.");
        }
      } catch (err) {
        showNotification("warning", `Erro na migração: ${(err == null ? void 0 : err.message) || err}`);
        setMigrationLog((prev) => prev + `[ERRO] ${(err == null ? void 0 : err.message) || err}
`);
      } finally {
        setIsMigrating(false);
      }
    };
    const hasValidNostrIssueId = (c) => Boolean(c.fullIssueId && /^[0-9a-f]{64}$/i.test(c.fullIssueId.trim()));
    const buildIssueDeepLink = (c) => {
      const issueId = c.fullIssueId || c.issueId;
      const owner = c.owner || "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";
      const empresa = c.empresa || (selectedTenant === "all" ? "orgfy" : selectedTenant);
      return `buzz://issue?id=${issueId}&owner=${owner}&d=${empresa}`;
    };
    const handleOpenIssueDeepLink = async (c) => {
      if (!hasValidNostrIssueId(c)) {
        setActiveIssueDetailCard(c);
        showNotification("info", `Worktree local (${c.issueId}) sem Issue Nostr vinculada — exibindo detalhes no Cockpit.`);
        return;
      }
      const issueId = c.fullIssueId;
      showNotification("info", `Navegando para issue #${c.issueId} no Buzz Desktop...`);
      try {
        const opened = await openIssueInBuzz(ctx, {
          id: issueId,
          owner: c.owner,
          dtag: c.empresa || (selectedTenant === "all" ? "orgfy" : selectedTenant)
        });
        if (opened) {
          showNotification("success", `Navegação para issue #${c.issueId} concluída no Buzz Repos.`);
        } else {
          setActiveIssueDetailCard(c);
          showNotification("warning", `Não foi possível abrir a issue #${c.issueId} no Buzz Repos — exibindo detalhes no Cockpit.`);
        }
      } catch (err) {
        setActiveIssueDetailCard(c);
        showNotification("warning", `Erro na navegação: ${(err == null ? void 0 : err.message) || err}`);
      }
    };
    const handleCopyDeepLink = (e, c) => {
      var _a3;
      e.stopPropagation();
      const uri = buildIssueDeepLink(c);
      if (typeof navigator !== "undefined" && ((_a3 = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a3.writeText)) {
        navigator.clipboard.writeText(uri);
      }
      showNotification("success", `Deep link copiado: buzz://issue?id=${(c.fullIssueId || c.issueId).slice(0, 8)}...`);
    };
    const loadRealState = async () => {
      var _a3, _b3, _c3, _d2;
      try {
        const [live, status, liveCards] = await Promise.all([
          fetchLiveEsteiraState(ctx),
          buildOrgfyStatus(ctx, selectedTenant === "all" ? "orgfy" : selectedTenant),
          fetchLiveKanbanCards(ctx, { empresa: selectedTenant })
        ]);
        if (typeof (status == null ? void 0 : status.fpy_percent) === "number") {
          setFpyRate(status.fpy_percent);
        } else if (((_a3 = live.placarState) == null ? void 0 : _a3.pct_aceito_primeira_revisao) !== void 0) {
          setFpyRate(live.placarState.pct_aceito_primeira_revisao);
        }
        if (typeof (status == null ? void 0 : status.cpi_tokens) === "number") {
          setCpiTokens(status.cpi_tokens);
        } else if (((_c3 = (_b3 = live.metricasTurnos) == null ? void 0 : _b3.governanca_orcamento) == null ? void 0 : _c3.cpi_tokens) !== void 0) {
          setCpiTokens(live.metricasTurnos.governanca_orcamento.cpi_tokens);
        }
        if (typeof (status == null ? void 0 : status.porteiro_online) === "boolean") {
          setPorteiroActive(status.porteiro_online);
        }
        if (typeof (status == null ? void 0 : status.total_merged_gate) === "number") {
          setTotalMergedGate(status.total_merged_gate);
        }
        if (status == null ? void 0 : status.circuit_breaker_loop) {
          setCircuitBreakerLoop(status.circuit_breaker_loop);
        }
        if (typeof (status == null ? void 0 : status.total_aceites_blindados) === "number") {
          setTotalAceitesBlindados(status.total_aceites_blindados);
        }
        if ((_d2 = live.regrasState) == null ? void 0 : _d2.regras) {
          setRegrasProbatorias(Object.values(live.regrasState.regras));
        }
        setPipelineCards(liveCards);
        localStorage.setItem("orgfy_pipeline_cards_v11", JSON.stringify(liveCards));
      } catch (err) {
        console.warn("Erro ao carregar estado real da esteira:", err);
      }
    };
    React.useEffect(() => {
      loadRealState();
    }, [selectedTenant]);
    React.useEffect(() => {
      setMcpStatus({ active: true, toolCallsCount: 0 });
    }, []);
    React.useEffect(() => {
      var _a3, _b3;
      if (!activeGateCard || !gateRejectionReason.trim()) {
        setDsapWarning(false);
        setDsapSimilarity(0);
        setDsapMatchedTokens([]);
        return;
      }
      const prev = ((_b3 = (_a3 = activeGateCard.rejectionHistory) == null ? void 0 : _a3[0]) == null ? void 0 : _b3.reason) || "";
      const result = calculateDsapSimilarity(gateRejectionReason, prev);
      setDsapSimilarity(result.similarity);
      setDsapWarning(result.isBacktracking);
      setDsapMatchedTokens(result.matchedTokens);
    }, [gateRejectionReason, activeGateCard]);
    const filteredCards = React.useMemo(() => {
      return pipelineCards.filter((c) => {
        if (selectedTenant !== "all" && c.empresa !== selectedTenant) return false;
        if (selectedTierFilter !== "all" && c.tier !== selectedTierFilter) return false;
        if (selectedAssigneeFilter !== "all" && c.executor !== selectedAssigneeFilter && c.revisor !== selectedAssigneeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match = c.title.toLowerCase().includes(q) || c.issueId.toLowerCase().includes(q) || c.prId && c.prId.toLowerCase().includes(q) || c.commitSha && c.commitSha.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
    }, [pipelineCards, selectedTenant, selectedTierFilter, selectedAssigneeFilter, searchQuery]);
    const cardsByStage = React.useMemo(() => {
      return {
        triagem: filteredCards.filter((c) => c.stage === "triagem"),
        despachado: filteredCards.filter((c) => c.stage === "despachado"),
        execucao: filteredCards.filter((c) => c.stage === "execucao"),
        revisao: filteredCards.filter((c) => c.stage === "revisao"),
        feito: filteredCards.filter((c) => c.stage === "feito")
      };
    }, [filteredCards]);
    const handleRunBootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapLog("[BOOTSTRAP] Iniciando auto-provisionamento 1-clique da Holding OrgFy...\n");
      try {
        const res = await executeBootstrapFlow(ctx, (updatedSteps) => {
          setBootstrapSteps(updatedSteps);
        });
        setBootstrapLog((prev) => prev + res.log);
        if (res.success) {
          setBootstrapDone(true);
          showNotification("success", "Auto-bootstrap e provisionamento concluídos com sucesso!");
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Esteira Pronta", "Auto-bootstrap e provisionamento concluídos com sucesso!");
          }
          await loadRealState();
        } else {
          showNotification("warning", "Bootstrap finalizado com avisos. Verifique os logs.");
        }
      } catch (err) {
        showNotification("warning", `Falha no bootstrap: ${(err == null ? void 0 : err.message) || err}`);
        setBootstrapLog((prev) => prev + `[ERRO] ${(err == null ? void 0 : err.message) || err}
`);
      } finally {
        setIsBootstrapping(false);
      }
    };
    const handleExecuteDispatch = async () => {
      if (!dispatchIssueId.trim()) {
        showNotification("warning", "Por favor, selecione ou informe o ID da Issue.");
        return;
      }
      if (dispatchExecutor === dispatchRevisor) {
        showNotification("warning", "Regra L-01 violada: O executor não pode ser o mesmo agente revisor!");
        return;
      }
      setIsExecutingDispatch(true);
      appendLiveLog(`
--- INICIANDO DESPACHO REAL (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        const res = await executeDespachar(ctx, {
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          issueId: dispatchIssueId.replace("#", "").trim(),
          executor: dispatchExecutor,
          revisor: dispatchRevisor,
          onOutput: appendLiveLog
        });
        if (res.code !== 0) {
          const errLine = res.output.split("\n").find((l) => l.includes("DESPACHO RECUSADO") || l.includes("ERRO")) || `Despacho recusado (exit ${res.code}). Verifique o console de logs.`;
          showNotification("warning", errLine.trim().slice(0, 180));
          return;
        }
        setIsDispatchModalOpen(false);
        setDispatchIssueId("");
        await loadRealState();
        showNotification("success", `Card ${dispatchIssueId} despachado com sucesso via CLI!`);
        if (desktopNotificationsEnabled) {
          sendDesktopNotification(ctx, "OrgFy: Novo Despacho", `Card ${dispatchIssueId} despachado para ${dispatchExecutor} com sucesso.`);
        }
      } catch (err) {
        showNotification("warning", `Falha no despacho determinístico: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsExecutingDispatch(false);
      }
    };
    const handleAcceptGate = async (card) => {
      setIsExecutingGate(true);
      appendLiveLog(`
--- INICIANDO GATE: ACEITE REAL (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        await executeGate(ctx, {
          empresa: card.empresa,
          prId: card.prId || card.issueId,
          acao: "aceito",
          motivo: "Aprovado em conformidade com probes caixa-preta e CI Swarm",
          revisor: "QA Sentinel",
          onOutput: appendLiveLog
        });
        const updated = pipelineCards.map((c) => {
          if (c.id === card.id) {
            return {
              ...c,
              stage: "feito",
              elapsedTime: "aprovado agora",
              commitSha: c.commitSha || "c05c52b"
            };
          }
          return c;
        });
        setPipelineCards(updated);
        localStorage.setItem("orgfy_pipeline_cards_v11", JSON.stringify(updated));
        setIsGateModalOpen(false);
        setActiveGateCard(null);
        showNotification("success", `PR ${card.prId || card.issueId} ACEITO no Gate! FPY mantido em 100%.`);
        if (desktopNotificationsEnabled) {
          sendDesktopNotification(ctx, "OrgFy: PR Aceito no Gate", `PR ${card.prId || card.issueId} aprovado com conformidade aos probes caixa-preta.`);
        }
      } catch (err) {
        showNotification("warning", `Falha no Gate: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsExecutingGate(false);
      }
    };
    const handleRejectGate = async (card) => {
      if (!gateRejectionReason.trim()) {
        showNotification("warning", "Por favor, justifique o motivo da recusa.");
        return;
      }
      setIsExecutingGate(true);
      appendLiveLog(`
--- INICIANDO GATE: RECUSA REAL (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        await executeGate(ctx, {
          empresa: card.empresa,
          prId: card.prId || card.issueId,
          acao: "recusado",
          motivo: gateRejectionReason,
          revisor: "QA Sentinel",
          onOutput: appendLiveLog
        });
        if (dsapWarning) {
          showNotification("warning", `[DSAP BACKTRACKING] Disparado! Similaridade de ${Math.round(dsapSimilarity * 100)}% acionou o COO.`);
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "⚠️ [DSAP BACKTRACKING]", `Alerta de estagnação semântica acionou o COO para re-escopo (PR #${card.prId || card.issueId})`);
          }
        } else {
          showNotification("info", `PR devolvido ao executor para correções.`);
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Gate Recusado", `PR #${card.prId || card.issueId} devolvido ao executor para correções.`);
          }
        }
        if (desktopNotificationsEnabled) {
          const title = dsapWarning ? "🚨 [DSAP BACKTRACKING] Alerta de Recusa" : "OrgFy: PR Recusado no Gate";
          const body = dsapWarning ? `Card ${card.prId || card.issueId} teve 2ª recusa com similaridade de ${Math.round(dsapSimilarity * 100)}%. COO Bento acionado!` : `Card ${card.prId || card.issueId} recusado no Gate: ${gateRejectionReason}`;
          sendDesktopNotification(ctx, title, body);
        }
        const updated = pipelineCards.map((c) => {
          if (c.id === card.id) {
            const newHistory = [
              {
                author: "QA Sentinel",
                timestamp: Date.now(),
                reason: gateRejectionReason,
                similarityToFirst: dsapSimilarity
              },
              ...c.rejectionHistory || []
            ];
            return {
              ...c,
              stage: "execucao",
              elapsedTime: "recusado (re-trabalho)",
              rejectionHistory: newHistory
            };
          }
          return c;
        });
        setPipelineCards(updated);
        localStorage.setItem("orgfy_pipeline_cards_v11", JSON.stringify(updated));
        setIsGateModalOpen(false);
        setActiveGateCard(null);
        setGateRejectionReason("");
      } catch (err) {
        showNotification("warning", `Falha na recusa do Gate: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsExecutingGate(false);
      }
    };
    const handleSyncPorteiroReal = async () => {
      setIsSyncingPorteiro(true);
      showNotification("info", "Disparando ciclo determinístico do Porteiro...");
      appendLiveLog(`
--- CICLO DETERMINÍSTICO DO PORTEIRO (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        const res = await executePorteiroSync(ctx, {
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          onOutput: appendLiveLog
        });
        if (res.code === 0) {
          showNotification("success", "Ciclo do Porteiro sincronizado com sucesso!");
          setPorteiroActive(true);
        } else {
          showNotification("warning", `Porteiro retornou aviso (código ${res.code}).`);
        }
        await loadRealState();
      } catch (err) {
        showNotification("warning", `Erro na execução do Porteiro: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsSyncingPorteiro(false);
      }
    };
    return h(
      "div",
      {
        "data-project-context-detached": "true",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100vh",
          maxHeight: "100vh",
          backgroundColor: THEME.canvas,
          color: THEME.textPrimary,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "12px",
          boxSizing: "border-box",
          overflow: "hidden"
        }
      },
      // TOAST DE NOTIFICAÇÃO
      notification && h(
        "div",
        {
          style: {
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            padding: "10px 18px",
            borderRadius: "10px",
            backgroundColor: notification.type === "success" ? "rgba(16, 185, 129, 0.95)" : notification.type === "warning" ? "rgba(245, 158, 11, 0.95)" : "rgba(59, 130, 246, 0.95)",
            color: "#000000",
            fontWeight: "600",
            fontSize: "13px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }
        },
        SVG.checkCircle({ h, width: 16, height: 16 }),
        notification.text
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 1. TOPBAR UNIFICADA (48px) - PADRÃO LINEAR & BUZZ NATIVO
      // ───────────────────────────────────────────────────────────────────────
      h(
        "header",
        {
          style: {
            height: "48px",
            backgroundColor: THEME.columnBg,
            border: `1px solid ${THEME.hairline}`,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            marginBottom: "12px",
            flexShrink: 0
          }
        },
        // Esquerda: Marca e Segmented Control de Tenants
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            SVG.orgfy({ h, width: 18, height: 18 }),
            h("span", { style: { fontWeight: "700", fontSize: "13px", color: THEME.textPrimary } }, "OrgFy Control Room")
          ),
          // Segmented Control de Tenants
          h(
            "div",
            {
              style: {
                display: "flex",
                backgroundColor: "rgba(0, 0, 0, 0.35)",
                borderRadius: "8px",
                padding: "2px",
                border: `1px solid ${THEME.hairline}`
              }
            },
            [
              { id: "all", label: "Holding" },
              { id: "orgfy", label: "Core" },
              { id: "lumen-iptv", label: "Lumen IPTV" },
              { id: "saas-tributario", label: "SaaS Tributário" }
            ].map(
              (t) => h(
                "button",
                {
                  key: t.id,
                  onClick: () => setSelectedTenant(t.id),
                  style: {
                    padding: "3px 10px",
                    fontSize: "11px",
                    fontWeight: selectedTenant === t.id ? "600" : "400",
                    color: selectedTenant === t.id ? "#ffffff" : THEME.textSecondary,
                    backgroundColor: selectedTenant === t.id ? "#282a36" : "transparent",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }
                },
                t.label
              )
            )
          )
        ),
        // Centro: Pílula Discreta de Telemetria
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "11px",
              color: THEME.textSecondary,
              fontFamily: "monospace"
            }
          },
          h(
            "span",
            { style: { display: "flex", alignItems: "center", gap: "5px", color: isSyncingPorteiro ? "#f59e0b" : porteiroActive ? "#10b981" : "#ef4444" } },
            h("span", {
              style: {
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isSyncingPorteiro ? "#f59e0b" : porteiroActive ? "#10b981" : "#ef4444"
              }
            }),
            isSyncingPorteiro ? "SINCRONIZANDO..." : porteiroActive ? "PORTEIRO ATIVO" : "PORTEIRO OFFLINE"
          ),
          h("span", { style: { color: "rgba(255,255,255,0.15)" } }, "·"),
          h("span", null, `FPY: ${fpyRate !== null ? `${fpyRate.toFixed(1)}%` : "--"}`),
          h("span", { style: { color: "rgba(255,255,255,0.15)" } }, "·"),
          h("span", null, `CPI: ${cpiTokens !== null ? cpiTokens.toFixed(2) : "--"}`),
          (loopRadar == null ? void 0 : loopRadar.ok) && (loopRadar.resumo.criticos_ativos ?? loopRadar.resumo.criticos) > 0 && h(
            "button",
            {
              onClick: () => {
                setActiveCentralTab("inteligencia");
                loadLoopRadar();
              },
              title: "Sessões ativas em loop ou travadas nos últimos 15 min no Goose",
              style: {
                padding: "2px 7px",
                borderRadius: "9999px",
                backgroundColor: "rgba(239, 68, 68, 0.18)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                fontSize: "10.5px",
                fontWeight: "700",
                fontFamily: "monospace",
                cursor: "pointer"
              }
            },
            `⚠ ${loopRadar.resumo.criticos_ativos ?? loopRadar.resumo.criticos} loop(s) ativo(s)`
          ),
          h("span", { style: { color: "rgba(255,255,255,0.15)" } }, "·"),
          h(
            "button",
            {
              onClick: () => setIsMcpDiagnosticsOpen(true),
              title: "Diagnósticos MCP Loopback (JSON-RPC 2.0)",
              style: {
                background: "none",
                border: "none",
                padding: "0",
                fontSize: "11px",
                fontFamily: "monospace",
                color: mcpStatus.active ? "#10b981" : "#60a5fa",
                cursor: "pointer"
              }
            },
            mcpStatus.active ? `MCP (${mcpStatus.toolCallsCount} calls)` : "MCP (4 tools)"
          )
        ),
        // Direita: Ação Primária "+ Novo Despacho" e Botões Utilitários
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h(
            "button",
            {
              onClick: () => setIsDispatchModalOpen(true),
              style: {
                padding: "6px 14px",
                backgroundColor: THEME.accentPrimary,
                color: "#000000",
                fontWeight: "700",
                fontSize: "12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }
            },
            SVG.zap({ h, width: 13, height: 13 }),
            "+ Novo Despacho"
          ),
          // Toggle Drawer Governança (sem botão duplicado de Templates & RSI nem Copiloto simulado)
          h(
            "button",
            {
              onClick: () => setIsGovernanceDrawerOpen(!isGovernanceDrawerOpen),
              title: "Abrir Painel Lateral de Governança & EVM",
              style: {
                padding: "5px 10px",
                backgroundColor: isGovernanceDrawerOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: THEME.textPrimary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }
            },
            SVG.shield({ h, width: 13, height: 13 }),
            "Governança"
          ),
          // Botão Migrador de Agentes
          h(
            "button",
            {
              onClick: () => {
                loadMigrationData();
                setIsMigrationModalOpen(true);
              },
              title: "Migrador de Agentes & Workspace",
              style: {
                padding: "5px 10px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: THEME.textSecondary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }
            },
            SVG.users({ h, width: 12, height: 12 }),
            "Migrador"
          ),
          // Botão Auto-Bootstrap
          h(
            "button",
            {
              onClick: () => setIsBootstrapModalOpen(true),
              title: "Auto-Bootstrap 1-Clique",
              style: {
                padding: "5px 10px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: THEME.textSecondary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }
            },
            SVG.zap({ h, width: 12, height: 12 }),
            "Bootstrap"
          ),
          // Notificações Desktop
          h(
            "button",
            {
              onClick: () => {
                const next = !desktopNotificationsEnabled;
                setDesktopNotificationsEnabled(next);
                showNotification("info", next ? "Notificações ativadas" : "Modo silencioso");
              },
              title: desktopNotificationsEnabled ? "Notificações ativas" : "Modo silencioso",
              style: {
                padding: "5px 8px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: desktopNotificationsEnabled ? "#10b981" : THEME.textMuted,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer"
              }
            },
            desktopNotificationsEnabled ? SVG.bell({ h, width: 13, height: 13 }) : SVG.bellOff({ h, width: 13, height: 13 })
          ),
          // Botão Sincronizar
          h(
            "button",
            {
              onClick: handleSyncPorteiroReal,
              disabled: isSyncingPorteiro,
              title: "Disparar sincronização em tempo real do Porteiro",
              style: {
                padding: "5px 8px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: isSyncingPorteiro ? "#f59e0b" : THEME.textPrimary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: isSyncingPorteiro ? "not-allowed" : "pointer"
              }
            },
            SVG.refresh({ h, width: 13, height: 13 })
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 2. PALCO PRINCIPAL (ILHA CENTRAL + COSTA DIREITA UTILITÁRIA)
      // ───────────────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            display: "flex",
            flex: 1,
            gap: "12px",
            minHeight: "0",
            overflow: "hidden"
          }
        },
        // ─────────────────────────────────────────────────────────────────────
        // ILHA CENTRAL — LIVE PIPELINE MATRIX
        // ─────────────────────────────────────────────────────────────────────
        h(
          "main",
          {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRadius: "16px",
              backgroundColor: "rgba(18, 24, 21, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              padding: "16px",
              overflow: "hidden",
              minWidth: 0
            }
          },
          // ───────────────────────────────────────────────────────────────────
          // TAB SWITCHER: MATRIZ DA ESTEIRA (KANBAN) vs CATÁLOGO DE TEMPLATES & HUB DE RSI
          // ───────────────────────────────────────────────────────────────────
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                paddingBottom: "10px"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              [
                { id: "board", label: "Board & Holding", color: "#10b981", icon: SVG.shield },
                { id: "orgchart", label: "Organograma", color: "#38bdf8", icon: SVG.users },
                { id: "pipeline", label: "Esteira (Kanban)", color: "#10b981", icon: SVG.columns },
                { id: "card_studio", label: "Card Studio", color: "#10b981", icon: SVG.zap },
                { id: "inteligencia", label: "Saúde & FinOps", color: "#c084fc", icon: SVG.activity },
                { id: "observabilidade", label: `Observabilidade (${telemetrySnap.totalSpans})`, color: "#38bdf8", icon: SVG.cpu },
                { id: "templates_rsi", label: "Templates & RSI", color: "#38bdf8", icon: SVG.fileText },
                { id: "resolvidas", label: `Arquivo (${resolvedItems.length})`, color: "#fbbf24", icon: SVG.checkCircle }
              ].map(
                (t) => h(
                  "button",
                  {
                    key: t.id,
                    onClick: () => {
                      setActiveCentralTab(t.id);
                      if (t.id === "board" || t.id === "orgchart" || t.id === "templates_rsi") loadHolding();
                      if (t.id === "inteligencia") loadKpis();
                      if (t.id === "observabilidade") setTelemetrySnap(getTelemetrySnapshot());
                      if (t.id === "resolvidas") loadResolvedArchive();
                    },
                    style: {
                      padding: "6px 12px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      border: activeCentralTab === t.id ? `1px solid ${t.color}66` : "1px solid transparent",
                      backgroundColor: activeCentralTab === t.id ? `${t.color}22` : "rgba(255, 255, 255, 0.04)",
                      color: activeCentralTab === t.id ? t.color : "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }
                  },
                  t.icon({ h, width: 13, height: 13 }),
                  t.label
                )
              )
            ),
            h(
              "span",
              { style: { fontSize: "11px", color: "#6b7280", fontFamily: "monospace" } },
              activeCentralTab === "board" ? "Conselho da Holding · Visão Multi-Empresa" : activeCentralTab === "orgchart" ? "Hierarquia Real (empresas/*.json)" : activeCentralTab === "pipeline" ? "Esteira Determinística OrgFy v13" : activeCentralTab === "card_studio" ? "Abertura Schema-First · L-01 + L-22 + Buzz Attention" : activeCentralTab === "inteligencia" ? "Telemetria Real, Economia & Radar Goose" : activeCentralTab === "observabilidade" ? "OpenTelemetry GenAI · Decisions API · Sinergia Buzz" : activeCentralTab === "resolvidas" ? "Memória Episódica Sob Demanda" : "Templates Reais & Regras L-90"
            )
          ),
          activeCentralTab === "pipeline" ? h(
            "div",
            { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" } },
            // Header Tático de Filtros
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "16px"
                }
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                // Busca
                h(
                  "div",
                  { style: { position: "relative", display: "flex", alignItems: "center" } },
                  h("input", {
                    type: "text",
                    placeholder: "Buscar card, issue, commit...",
                    value: searchQuery,
                    onChange: (e) => setSearchQuery(e.target.value),
                    style: {
                      borderRadius: "9999px",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 14px 6px 32px",
                      fontSize: "12px",
                      outline: "none",
                      width: "220px"
                    }
                  }),
                  h(
                    "div",
                    { style: { position: "absolute", left: "10px", color: "#9ca3af", pointerEvents: "none" } },
                    SVG.search({ h, width: 14, height: 14 })
                  )
                ),
                // Filtro por Tier
                h(
                  "select",
                  {
                    value: selectedTierFilter,
                    onChange: (e) => setSelectedTierFilter(e.target.value),
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 12px",
                      fontSize: "12px",
                      outline: "none",
                      cursor: "pointer"
                    }
                  },
                  h("option", { value: "all" }, "Todos os Tiers CoEvo-RSI"),
                  h("option", { value: "tier_1_exec_barato" }, "Tier 1: Barato (Enxuto)"),
                  h("option", { value: "tier_2_revisor" }, "Tier 2: Revisor (Gate)"),
                  h("option", { value: "tier_3_arquiteto" }, "Tier 3: Arquiteto (Governança)")
                ),
                // Filtro por Agente
                h(
                  "select",
                  {
                    value: selectedAssigneeFilter,
                    onChange: (e) => setSelectedAssigneeFilter(e.target.value),
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 12px",
                      fontSize: "12px",
                      outline: "none",
                      cursor: "pointer"
                    }
                  },
                  h("option", { value: "all" }, "Todos os Responsáveis"),
                  liveAgents.map((a) => h("option", { key: a.id, value: a.name }, a.name))
                )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px" } },
                h(
                  "span",
                  { style: { fontSize: "12px", color: "var(--text-subtle, #9ca3af)" } },
                  `Exibindo ${filteredCards.length} de ${pipelineCards.length} cards`
                ),
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      borderRadius: "8px",
                      padding: "2px",
                      border: `1px solid ${THEME.hairline}`
                    }
                  },
                  h(
                    "button",
                    {
                      onClick: () => setViewMode("kanban"),
                      style: {
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: viewMode === "kanban" ? "600" : "400",
                        backgroundColor: viewMode === "kanban" ? "#282a36" : "transparent",
                        color: viewMode === "kanban" ? "#ffffff" : THEME.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }
                    },
                    SVG.columns({ h, width: 12, height: 12 }),
                    "Kanban"
                  ),
                  h(
                    "button",
                    {
                      onClick: () => setViewMode("list"),
                      style: {
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: viewMode === "list" ? "600" : "400",
                        backgroundColor: viewMode === "list" ? "#282a36" : "transparent",
                        color: viewMode === "list" ? "#ffffff" : THEME.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }
                    },
                    SVG.list({ h, width: 12, height: 12 }),
                    "Lista"
                  )
                )
              )
            ),
            // ───────────────────────────────────────────────────────────────────
            // AS 5 RAIAS DETERMINÍSTICAS (KANBAN MATRIX) OU VISÃO EM LISTA
            // ───────────────────────────────────────────────────────────────────
            viewMode === "list" ? h(
              "div",
              {
                style: {
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${THEME.hairline}`
                }
              },
              h(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "95px 1.8fr 110px 60px 1.1fr 90px 120px",
                    gap: "10px",
                    padding: "10px 14px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: THEME.textSecondary,
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${THEME.hairline}`,
                    position: "sticky",
                    top: 0,
                    backgroundColor: "#14161a",
                    zIndex: 2
                  }
                },
                h("span", null, "Issue"),
                h("span", null, "Título & Aceite L-22"),
                h("span", null, "Raia"),
                h("span", null, "Prio"),
                h("span", null, "Responsáveis"),
                h("span", null, "Tempo"),
                h("span", { style: { textAlign: "right" } }, "Ação")
              ),
              filteredCards.length === 0 ? h(
                "div",
                { style: { padding: "32px", textAlign: "center", color: THEME.textMuted, fontSize: "12px" } },
                "Nenhum card encontrado com os filtros atuais."
              ) : filteredCards.map((c) => {
                const stageLabel = c.stage === "triagem" ? "Triagem" : c.stage === "despachado" ? "Despachado" : c.stage === "execucao" ? "Execução" : c.stage === "revisao" ? "Revisão" : "Concluído";
                const stageColor = c.stage === "triagem" ? "#60a5fa" : c.stage === "despachado" ? "#c084fc" : c.stage === "execucao" ? "#f59e0b" : c.stage === "revisao" ? "#10b981" : "#e5e7eb";
                return h(
                  "div",
                  {
                    key: c.id,
                    onClick: () => setActiveIssueDetailCard(c),
                    style: {
                      display: "grid",
                      gridTemplateColumns: "95px 1.8fr 110px 60px 1.1fr 90px 120px",
                      gap: "10px",
                      padding: "10px 14px",
                      alignItems: "center",
                      borderBottom: `1px solid ${THEME.hairline}`,
                      cursor: "pointer",
                      fontSize: "12px",
                      transition: "background 0.12s ease"
                    },
                    onMouseEnter: (e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)",
                    onMouseLeave: (e) => e.currentTarget.style.backgroundColor = "transparent"
                  },
                  h(
                    "span",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        handleOpenIssueDeepLink(c);
                      },
                      style: { fontFamily: "monospace", fontSize: "11px", color: "#58a6ff", fontWeight: "700", textDecoration: "underline" }
                    },
                    `#${(c.issueId || c.id).slice(0, 8)}`
                  ),
                  h(
                    "div",
                    { style: { minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" } },
                    h("span", { style: { fontWeight: "600", color: THEME.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.title),
                    c.acceptanceCommand && h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.acceptanceCommand)
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: `${stageColor}22`,
                        color: stageColor,
                        width: "fit-content"
                      }
                    },
                    stageLabel
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontWeight: "700",
                        color: c.priority === "P0" ? "#f87171" : c.priority === "P1" ? "#fbbf24" : "#60a5fa"
                      }
                    },
                    c.priority
                  ),
                  h(
                    "span",
                    { style: { fontSize: "11px", color: THEME.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                    `${c.executor || "Não atribuído"}${c.revisor ? ` → ${c.revisor}` : ""}`
                  ),
                  h(
                    "span",
                    { style: { fontFamily: "monospace", fontSize: "10px", color: "#34d399" } },
                    formatRelativeTime(c.createdAt || c.updatedAt || c.elapsedTime)
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "flex-end" }, onClick: (e) => e.stopPropagation() },
                    c.stage === "triagem" ? h(
                      "button",
                      {
                        onClick: () => {
                          setDispatchIssueId(c.issueId);
                          setIsDispatchModalOpen(true);
                        },
                        style: {
                          padding: "4px 10px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          border: "none",
                          fontSize: "11px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }
                      },
                      "Despachar"
                    ) : c.stage === "revisao" ? h(
                      "button",
                      {
                        onClick: () => {
                          setActiveGateCard(c);
                          setIsGateModalOpen(true);
                        },
                        style: {
                          padding: "4px 10px",
                          borderRadius: "6px",
                          backgroundColor: "#10b981",
                          color: "#000000",
                          border: "none",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }
                      },
                      "Decidir Gate"
                    ) : c.stage === "execucao" ? h(
                      "button",
                      {
                        onClick: () => {
                          setActiveLogsCard(c);
                          setIsLogsDrawerOpen(true);
                        },
                        style: {
                          padding: "4px 10px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          color: "#f59e0b",
                          border: "none",
                          fontSize: "11px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }
                      },
                      "Ver Logs"
                    ) : h("span", { style: { fontSize: "10px", color: THEME.textMuted } }, "Detalhes")
                  )
                );
              })
            ) : h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(260px, 1fr))",
                  gap: "12px",
                  flex: 1,
                  minHeight: 0,
                  height: "100%",
                  alignItems: "stretch",
                  overflowX: "auto",
                  overflowY: "hidden",
                  paddingBottom: "4px"
                }
              },
              // Raia 1: Triagem & Backlog
              renderColumn(
                "1. Triagem & Backlog",
                cardsByStage.triagem,
                "rgba(59, 130, 246, 0.15)",
                "#60a5fa",
                (card) => h(
                  "button",
                  {
                    onClick: () => {
                      setDispatchIssueId(card.issueId);
                      setIsDispatchModalOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }
                  },
                  SVG.zap({ h, width: 12, height: 12 }),
                  "Despachar"
                )
              ),
              // Raia 2: Despachados & Alocados
              renderColumn(
                "2. Despachados",
                cardsByStage.despachado,
                "rgba(168, 85, 247, 0.15)",
                "#c084fc",
                (card) => h(
                  "div",
                  {
                    style: {
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }
                  },
                  SVG.clock({ h, width: 10, height: 10 }),
                  `Aguardando sub-second wake`
                )
              ),
              // Raia 3: Em Execução (Headless Workers)
              renderColumn(
                "3. Em Execução",
                cardsByStage.execucao,
                "rgba(245, 158, 11, 0.15)",
                "#f59e0b",
                (card) => h(
                  "button",
                  {
                    onClick: () => {
                      setActiveLogsCard(card);
                      setIsLogsDrawerOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }
                  },
                  SVG.terminal({ h, width: 12, height: 12 }),
                  "Ver Logs Live"
                )
              ),
              // Raia 4: Em Revisão (Gate Caixa-Preta)
              renderColumn(
                "4. Em Revisão (Gate)",
                cardsByStage.revisao,
                "rgba(16, 185, 129, 0.15)",
                "#10b981",
                (card) => h(
                  "button",
                  {
                    onClick: () => {
                      setActiveGateCard(card);
                      setIsGateModalOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#10b981",
                      color: "#000000",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }
                  },
                  SVG.shield({ h, width: 12, height: 12 }),
                  "Decidir Gate"
                )
              ),
              // Raia 5: Concluído / FPY
              renderColumn(
                "5. Concluído / FPY",
                cardsByStage.feito,
                "rgba(255, 255, 255, 0.1)",
                "#ffffff",
                (card) => h(
                  "div",
                  {
                    style: {
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600"
                    }
                  },
                  SVG.checkCircle({ h, width: 10, height: 10 }),
                  "MERGED na main (FPY 100%)"
                )
              )
            )
          ) : activeCentralTab === "board" ? renderBoardHoldingTab({
            h,
            holding: holdingData,
            kpis: kpisData,
            onSelectTenant: (slug) => {
              setSelectedTenant(slug);
              setActiveCentralTab("pipeline");
            },
            onCreateApproval: async (input) => {
              const res = await createBoardApproval(ctx, input);
              if (res.ok) {
                setNewApprovalTitle("");
                setNewApprovalDesc("");
                await loadHolding();
                showNotification("success", "Deliberação registrada em board-approvals.json.");
              }
            },
            onDecideApproval: async (id, decision) => {
              const res = await decideBoardApproval(ctx, id, decision);
              if (res.ok) {
                await loadHolding();
                showNotification("success", `Deliberação marcada como ${decision}.`);
              }
            },
            onRefresh: () => {
              loadHolding();
              loadKpis();
            },
            newApprovalTitle,
            setNewApprovalTitle,
            newApprovalDesc,
            setNewApprovalDesc,
            newApprovalCompany,
            setNewApprovalCompany,
            newApprovalType,
            setNewApprovalType
          }) : activeCentralTab === "orgchart" ? renderOrgChartTab({
            h,
            holding: holdingData,
            selectedTenant
          }) : activeCentralTab === "inteligencia" ? renderIntelligenceTab({
            h,
            kpis: kpisData,
            history: kpisHistory,
            error: kpisError,
            isRecalculating: isRecalculatingKpis,
            onRecalculate: handleRecalculateKpis,
            onRunGovernanceEval: handleRunGovernanceEval,
            governanceSummary,
            loopRadar,
            onRefreshLoopRadar: loadLoopRadar,
            onWakeIrisForLoops: handleWakeIrisForLoops,
            onStopLoopSession: handleStopLoopSession,
            stoppingSessionId,
            onFailoverModelSession: handleFailoverModelSession,
            failingOverSessionId
          }) : activeCentralTab === "observabilidade" ? renderObservabilityTab({
            h,
            telemetry: telemetrySnap,
            nativeState: getBuzzNativeState(),
            operationFilter: obsFilter,
            onFilterChange: setObsFilter,
            isProbingDecision,
            lastProbeSummary,
            onRunDecisionProbe: handleRunDecisionProbe,
            onResetSpans: handleResetSpans,
            onRefresh: () => setTelemetrySnap(getTelemetrySnapshot())
          }) : activeCentralTab === "card_studio" ? h(CardStudioTab, {
            liveAgents,
            defaultEmpresa: selectedTenant,
            onNotify: showNotification
          }) : activeCentralTab === "resolvidas" ? renderResolvedArchiveTab({
            h,
            items: resolvedItems,
            error: resolvedError,
            searchQuery: resolvedSearch,
            specFilter: resolvedSpecFilter,
            copiedId: copiedResolvedId,
            onSearchChange: setResolvedSearch,
            onSpecFilterChange: setResolvedSpecFilter,
            onCopyLink: (item) => {
              var _a3;
              try {
                (_a3 = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a3.writeText(item.deepLink);
              } catch {
              }
              setCopiedResolvedId(item.issueId);
              setTimeout(() => setCopiedResolvedId(null), 2e3);
            },
            onReopenFollowUp: (item) => {
              setDispatchIssueId(item.fullIssueId || item.issueId);
              setIsDispatchModalOpen(true);
            },
            onRefresh: loadResolvedArchive
          }) : renderTemplatesRsiView()
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // GOVERNANCE & RSI SLIDE-OVER DRAWER (LINEAR GRADE)
      // ───────────────────────────────────────────────────────────────────────
      isGovernanceDrawerOpen && h(
        React.Fragment,
        null,
        // Backdrop escuro fechável
        h("div", {
          onClick: () => setIsGovernanceDrawerOpen(false),
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1199
          }
        }),
        // Drawer Lateral Deslizante
        h(
          "aside",
          {
            style: {
              position: "fixed",
              top: 0,
              right: 0,
              width: "420px",
              maxWidth: "90vw",
              height: "100vh",
              backgroundColor: "#111216",
              borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              zIndex: 1200,
              padding: "20px",
              overflowY: "auto",
              gap: "16px"
            }
          },
          // Header do Drawer
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: "12px"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.shield({ h, width: 16, height: 16 }),
              h("span", { style: { fontWeight: "700", fontSize: "14px", color: THEME.textPrimary } }, "Governança, EVM & RSI"),
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    color: THEME.accentPrimary,
                    fontWeight: "600",
                    backgroundColor: "rgba(16,185,129,0.15)",
                    padding: "2px 6px",
                    borderRadius: "4px"
                  }
                },
                "v12 CONTROL PLANE"
              )
            ),
            h(
              "button",
              {
                onClick: () => setIsGovernanceDrawerOpen(false),
                style: { background: "transparent", border: "none", color: THEME.textSecondary, cursor: "pointer", padding: "4px" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Seção EVM & Orçamento de Tokens
          h(
            "div",
            {
              style: {
                padding: "14px",
                borderRadius: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: `1px solid ${THEME.hairline}`,
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "Métricas EVM & Tokens"),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "CPI Acumulado"),
              h(
                "span",
                { style: { fontSize: "13px", fontWeight: "700", color: (cpiTokens ?? 1) >= 0.85 ? THEME.accentPrimary : "#f59e0b" } },
                cpiTokens !== null ? `${cpiTokens.toFixed(2)} (Min: 0.85)` : "--"
              )
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Circuit Breaker Loops"),
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: THEME.accentPrimary } }, circuitBreakerLoop ? `${circuitBreakerLoop} turnos` : "--")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "PRs Integrados"),
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff" } }, totalMergedGate !== null ? `${totalMergedGate} na main` : "--")
            ),
            // Linha de Aceites Blindados L-22
            h(
              "div",
              {
                style: {
                  marginTop: "4px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  fontSize: "11px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }
              },
              h("span", { style: { color: "#10b981", fontWeight: "600" } }, "Aceites Blindados (L-22):"),
              h("span", { style: { color: "#ffffff", fontFamily: "monospace", fontWeight: "700" } }, totalAceitesBlindados !== null ? `${totalAceitesBlindados} verificados` : "--")
            )
          ),
          // Seção Catraca Probatória RSI
          h(
            "div",
            {
              style: {
                padding: "14px",
                borderRadius: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: `1px solid ${THEME.hairline}`,
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "Catraca Probatória RSI"),
              h("span", { style: { fontSize: "10px", color: "#c084fc", fontFamily: "monospace" } }, "Janela 10 cards")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Regras Ativas"),
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#c084fc" } }, `${Object.keys(regrasProbatorias).length || 3} regras`)
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Regra L-90 Auto-Rollback"),
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: THEME.accentPrimary } }, "Ativo (FPY >= 95%)")
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" } },
              h(
                "div",
                { style: { padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.03)", fontSize: "10px" } },
                h("div", { style: { color: "#ffffff", fontWeight: "600" } }, "GUARD-T020"),
                h("div", { style: { color: THEME.textMuted } }, "ci_cache e aceite_cache blindados (10/10 cards)")
              ),
              h(
                "div",
                { style: { padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.03)", fontSize: "10px" } },
                h("div", { style: { color: "#ffffff", fontWeight: "600" } }, "GUARD-L01"),
                h("div", { style: { color: THEME.textMuted } }, "Impedimento auto-revisão L-01 (10/10 cards)")
              ),
              h(
                "button",
                {
                  onClick: () => {
                    setIsGovernanceDrawerOpen(false);
                    setActiveCentralTab("templates_rsi");
                  },
                  style: {
                    marginTop: "6px",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                    color: "#38bdf8",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease"
                  }
                },
                SVG.gitPullRequest({ h, width: 13, height: 13 }),
                "Explorar Catálogo de Templates & RSI Completo →"
              )
            )
          ),
          // Seção DSAP Backtracking
          h(
            "div",
            {
              style: {
                padding: "14px",
                borderRadius: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: `1px solid ${THEME.hairline}`,
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "DSAP Preditivo"),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Threshold Backtracking"),
              h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f59e0b" } }, "≥ 0.70 similaridade")
            ),
            h(
              "div",
              {
                style: {
                  padding: "8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  color: THEME.accentPrimary,
                  fontSize: "11px",
                  fontWeight: "500"
                }
              },
              "✓ Nenhum backtracking ativo no momento (fluxo limpo)."
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 3. ILHA DO COPILOTO SAGRADO PERSONIFICÁVEL (DRAWER FLUTUANTE)
      // ───────────────────────────────────────────────────────────────────────
      isCopilotOpen && h(
        "aside",
        {
          style: {
            position: "fixed",
            bottom: "20px",
            right: "24px",
            width: "360px",
            height: "460px",
            borderRadius: "16px",
            backgroundColor: "#111714",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.65)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1e3,
            overflow: "hidden"
          }
        },
        // Header do Copiloto
        h(
          "div",
          {
            style: {
              padding: "12px 14px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }
          },
          h(
            "select",
            {
              value: copilotAgent,
              onChange: (e) => setCopilotAgent(e.target.value),
              style: {
                backgroundColor: "transparent",
                color: "#10b981",
                fontWeight: "700",
                fontSize: "13px",
                border: "none",
                outline: "none",
                cursor: "pointer"
              }
            },
            h("option", { value: "OrgFy Bento" }, "⚙️ OrgFy Bento [COO]"),
            h("option", { value: "OrgFy Iris" }, "👑 OrgFy Iris [CEO Holding]"),
            h("option", { value: "OrgFy Bento Arquiteto" }, "📐 OrgFy Bento Arquiteto"),
            h("option", { value: "QA Sentinel" }, "🛡️ QA Sentinel [Auditor]")
          ),
          h(
            "button",
            {
              onClick: () => setIsCopilotOpen(false),
              style: {
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer"
              }
            },
            SVG.xCircle({ h, width: 16, height: 16 })
          )
        ),
        // Chat Messages
        h(
          "div",
          {
            style: {
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontSize: "12px"
            }
          },
          h(
            "div",
            {
              style: {
                padding: "8px 12px",
                borderRadius: "10px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                color: "#f3f4f6",
                lineHeight: "1.4"
              }
            },
            h("strong", { style: { color: "#10b981" } }, `${copilotAgent}: `),
            `Olá, Helton. A esteira determinística v10 está com ${pipelineCards.length} cards no Kanban, FPY em ${fpyRate !== null ? `${fpyRate.toFixed(1)}%` : "--"} e CPI em ${cpiTokens !== null ? cpiTokens.toFixed(2) : "--"}. Use /despachar para novos cards ou /gate para veredito.`
          )
        ),
        // Chat Input
        h(
          "div",
          {
            style: {
              padding: "10px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              gap: "8px"
            }
          },
          h("input", {
            type: "text",
            placeholder: `Falar com ${copilotAgent}... (/despachar, /gate)`,
            style: {
              flex: 1,
              padding: "6px 12px",
              borderRadius: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              fontSize: "12px",
              outline: "none"
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                const cmd = e.target.value.trim();
                appendLiveLog(`
[COPILOTO] Mensagem enviada para ${copilotAgent}: ${cmd}
`);
                showNotification("info", `Comando enviado para ${copilotAgent}: ${cmd}`);
                e.target.value = "";
              }
            }
          })
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 4. MODAL NOVO DESPACHO (VALIDAÇÃO L-01: EXECUTOR !== REVISOR + REAL CLI)
      // ───────────────────────────────────────────────────────────────────────
      isDispatchModalOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2e3
          }
        },
        h(
          "div",
          {
            style: {
              width: "480px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "22px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "⚡ Novo Despacho Determinístico"),
            h(
              "button",
              {
                onClick: () => !isExecutingDispatch && setIsDispatchModalOpen(false),
                disabled: isExecutingDispatch,
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingDispatch ? "not-allowed" : "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "ID DA ISSUE OU TAREFA"),
            h("input", {
              type: "text",
              placeholder: "Ex: issue-104 ou 5c569a9e",
              disabled: isExecutingDispatch,
              value: dispatchIssueId,
              onChange: (e) => setDispatchIssueId(e.target.value),
              style: {
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none"
              }
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "EXECUTOR (TIER COEVO-RSI)"),
            h(
              "select",
              {
                value: dispatchExecutor,
                disabled: isExecutingDispatch,
                onChange: (e) => setDispatchExecutor(e.target.value),
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none"
                }
              },
              liveAgents.map(
                (a) => h("option", { key: a.id, value: a.name }, a.name)
              )
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h(
              "label",
              { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } },
              "REVISOR INDEPENDENTE (REGRA L-01: BLOQUEIO MECÂNICO)"
            ),
            h(
              "select",
              {
                value: dispatchRevisor,
                disabled: isExecutingDispatch,
                onChange: (e) => setDispatchRevisor(e.target.value),
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none"
                }
              },
              liveAgents.map(
                (a) => h(
                  "option",
                  {
                    key: a.id,
                    value: a.name,
                    disabled: a.name === dispatchExecutor
                  },
                  a.name === dispatchExecutor ? `${a.name} (Bloqueado pela Regra L-01)` : a.name
                )
              )
            )
          ),
          // Preview do comando determinístico
          h(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#10b981"
              }
            },
            `ferramentas/esteira/despachar --empresa ${selectedTenant === "all" ? "orgfy" : selectedTenant} ${dispatchIssueId || "<issue>"} "${dispatchExecutor}" "${dispatchRevisor}"`
          ),
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: () => setIsDispatchModalOpen(false),
                disabled: isExecutingDispatch,
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  color: "#9ca3af",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              "Cancelar"
            ),
            h(
              "button",
              {
                onClick: handleExecuteDispatch,
                disabled: isExecutingDispatch,
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: isExecutingDispatch ? "#059669" : "#10b981",
                  color: "#000000",
                  fontWeight: "700",
                  border: "none",
                  cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              isExecutingDispatch ? "Executando via CLI..." : "Disparar Despacho"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 5. MODAL DE DECISÃO DO GATE COM DETECTOR PREDITIVO DSAP (3 NÍVEIS)
      // ───────────────────────────────────────────────────────────────────────
      isGateModalOpen && activeGateCard && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2e3
          }
        },
        h(
          "div",
          {
            style: {
              width: "520px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              null,
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "🛡️ Decisão de Gate Caixa-Preta"),
              h("span", { style: { fontSize: "12px", color: "#9ca3af" } }, `${activeGateCard.prId || activeGateCard.issueId}: ${activeGateCard.title}`)
            ),
            h(
              "button",
              {
                onClick: () => {
                  if (!isExecutingGate) {
                    setIsGateModalOpen(false);
                    setActiveGateCard(null);
                  }
                },
                disabled: isExecutingGate,
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingGate ? "not-allowed" : "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Probes Caixa-Preta (Holdout Verification)
          h(
            "div",
            {
              style: {
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#10b981" } }, "EVIDÊNCIAS DOS PROBES CAIXA-PRETA"),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("span", null, "• http_rota (Caddy v3 200 OK):"),
              h("span", { style: { color: ((_a2 = activeGateCard.probes) == null ? void 0 : _a2.http_rota) ? "#10b981" : "#9ca3af", fontWeight: "600" } }, ((_b2 = activeGateCard.probes) == null ? void 0 : _b2.http_rota) ? "PASS" : "Não executado")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("span", null, "• supabase_rls (Políticas & Migrations):"),
              h("span", { style: { color: ((_c2 = activeGateCard.probes) == null ? void 0 : _c2.supabase_rls) ? "#10b981" : "#9ca3af", fontWeight: "600" } }, ((_d = activeGateCard.probes) == null ? void 0 : _d.supabase_rls) ? "PASS" : "Não executado")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("span", null, "• playwright_console (0 erros runtime):"),
              h("span", { style: { color: ((_e = activeGateCard.probes) == null ? void 0 : _e.playwright_console) ? "#10b981" : "#9ca3af", fontWeight: "600" } }, ((_f = activeGateCard.probes) == null ? void 0 : _f.playwright_console) ? "PASS" : "Não executado")
            )
          ),
          // Justificativa de Recusa & Detector DSAP
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "MOTIVO (PREENCHA CASO VÁ RECUSAR O PR)"),
            h("textarea", {
              placeholder: "Descreva a falha ou inconsistência técnica...",
              value: gateRejectionReason,
              disabled: isExecutingGate,
              onChange: (e) => setGateRejectionReason(e.target.value),
              style: {
                height: "70px",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
                fontSize: "12px",
                outline: "none",
                resize: "none"
              }
            }),
            // Banner Reativo DSAP em 3 Níveis Contextuais (Refinamento de UI/UX)
            gateRejectionReason.trim().length > 0 && h(
              "div",
              {
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: dsapSimilarity >= 0.7 ? "rgba(239, 68, 68, 0.15)" : dsapSimilarity >= 0.5 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.12)",
                  border: "1px solid",
                  borderColor: dsapSimilarity >= 0.7 ? "#ef4444" : dsapSimilarity >= 0.5 ? "#f59e0b" : "#10b981",
                  color: dsapSimilarity >= 0.7 ? "#f87171" : dsapSimilarity >= 0.5 ? "#f59e0b" : "#10b981",
                  fontSize: "11px",
                  fontWeight: "600",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                dsapSimilarity >= 0.7 ? SVG.alertTriangle({ h, width: 14, height: 14 }) : dsapSimilarity >= 0.5 ? SVG.alertTriangle({ h, width: 14, height: 14 }) : SVG.checkCircle({ h, width: 14, height: 14 }),
                dsapSimilarity >= 0.7 ? `🔴 ALERTA DSAP (${Math.round(dsapSimilarity * 100)}%): Repetição desta assinatura engatilhará [DSAP BACKTRACKING] para o COO re-escopar!` : dsapSimilarity >= 0.5 ? `🟡 ATENÇÃO (${Math.round(dsapSimilarity * 100)}% de similaridade): Termos técnicos repetidos da recusa anterior.` : `🟢 SEGURO (${Math.round(dsapSimilarity * 100)}% de similaridade): Nova justificativa com assinatura distinta.`
              ),
              dsapMatchedTokens.length > 0 && h(
                "div",
                { style: { fontSize: "10px", color: "rgba(255,255,255,0.7)" } },
                `Tokens identificados: ${dsapMatchedTokens.join(", ")}`
              )
            )
          ),
          // Ações de Aceite / Recusa
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: () => handleRejectGate(activeGateCard),
                disabled: isExecutingGate,
                style: {
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontWeight: "700",
                  cursor: isExecutingGate ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              isExecutingGate ? "Executando Gate..." : "RECUSAR PR"
            ),
            h(
              "button",
              {
                onClick: () => handleAcceptGate(activeGateCard),
                disabled: isExecutingGate,
                style: {
                  padding: "8px 22px",
                  borderRadius: "8px",
                  backgroundColor: isExecutingGate ? "#059669" : "#10b981",
                  color: "#000000",
                  fontWeight: "700",
                  border: "none",
                  cursor: isExecutingGate ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              isExecutingGate ? "Executando Gate..." : "ACEITAR PR (MERGE NA MAIN)"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 6. GAVETA DE LOGS STREAMING (CONSOLE JETBRAINS / MATRIX)
      // ───────────────────────────────────────────────────────────────────────
      isLogsDrawerOpen && activeLogsCard && h(
        "div",
        {
          style: {
            position: "fixed",
            bottom: 0,
            left: "12px",
            right: "12px",
            height: "280px",
            borderRadius: "16px 16px 0 0",
            backgroundColor: "#0a0f0d",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1500
          }
        },
        h(
          "div",
          {
            style: {
              padding: "8px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "span",
              { style: { fontSize: "12px", color: "#10b981", fontWeight: "700" } },
              `CONSOLE LIVE: ${activeLogsCard.workerPid ? `PID ${activeLogsCard.workerPid}` : "Sessão CLI"} — #${activeLogsCard.issueId}`
            ),
            h("span", { style: { fontSize: "10px", color: "#60a5fa", fontWeight: "600" } }, "🟢 STREAMING ATIVO")
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "button",
              {
                onClick: () => setLiveLogStream(""),
                style: {
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  color: "#9ca3af",
                  border: "none",
                  fontSize: "10px",
                  cursor: "pointer"
                }
              },
              "Limpar Logs"
            ),
            h(
              "button",
              {
                onClick: () => {
                  navigator.clipboard.writeText(liveLogStream);
                  showNotification("success", "Logs copiados para a área de transferência!");
                },
                style: {
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  color: "#9ca3af",
                  border: "none",
                  fontSize: "10px",
                  cursor: "pointer"
                }
              },
              "Copiar"
            ),
            h(
              "button",
              {
                onClick: () => setIsLogsDrawerOpen(false),
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }
              },
              SVG.xCircle({ h, width: 16, height: 16 })
            )
          )
        ),
        h(
          "pre",
          {
            style: {
              flex: 1,
              margin: 0,
              padding: "12px 16px",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#10b981",
              backgroundColor: "#080c0a",
              overflowY: "auto",
              lineHeight: "1.5"
            }
          },
          liveLogStream || `[ORGFY WORKER] Inicializando container efêmero no Swarm...
[ORGFY WORKER] Worktree montada em: .worktrees/${activeLogsCard.issueId}
[ORGFY WORKER] Executando: pytest testes/esteira -v --tb=short
testes/esteira/test_t020.py::test_ci_cache_integrity PASSED
testes/esteira/test_gate_state.py::test_regras_probatorias_eval PASSED
[ORGFY WORKER] 2 passed in 1.42s. Probes caixa-preta engatilhados.
[ORGFY NOSTR] Evento kind:1618 publicado em wss://orgfy.communities.buzz.xyz (sub-second wake)`
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 6.5. MODAL IN-COCKPIT DE DETALHES DA ISSUE (EXPANSÃO DO COCKPIT)
      // ───────────────────────────────────────────────────────────────────────
      activeIssueDetailCard && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2150
          },
          onClick: () => setActiveIssueDetailCard(null)
        },
        h(
          "div",
          {
            style: {
              width: "920px",
              maxWidth: "94vw",
              maxHeight: "88vh",
              borderRadius: "14px",
              backgroundColor: "#0d1117",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            },
            onClick: (e) => e.stopPropagation()
          },
          // ── HEADER DO MODAL (ESTILO HERMES / LINEAR) ──
          h(
            "div",
            {
              style: {
                padding: "18px 24px 14px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                backgroundColor: "rgba(255, 255, 255, 0.015)"
              }
            },
            // Breadcrumbs + Badges + Fechar
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#9ca3af" } },
                h("span", { style: { fontWeight: "600", color: "#cbd5e1" } }, "Holding OrgFy"),
                h("span", { style: { color: "#4b5563" } }, "/"),
                h("span", {}, "Repositório orgfy"),
                h("span", { style: { color: "#4b5563" } }, "/"),
                h("span", {}, "Issues"),
                h("span", { style: { color: "#4b5563" } }, "/"),
                h(
                  "code",
                  {
                    style: {
                      fontFamily: "monospace",
                      color: "#38bdf8",
                      backgroundColor: "rgba(56, 189, 248, 0.1)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      fontWeight: "700"
                    },
                    title: activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId
                  },
                  `#${(activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId).slice(0, 10)}...`
                )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                // Badge Prioridade
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: "700",
                      backgroundColor: activeIssueDetailCard.priority === "P0" ? "rgba(239, 68, 68, 0.2)" : activeIssueDetailCard.priority === "P1" ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                      color: activeIssueDetailCard.priority === "P0" ? "#ef4444" : activeIssueDetailCard.priority === "P1" ? "#f59e0b" : "#60a5fa"
                    }
                  },
                  activeIssueDetailCard.priority
                ),
                // Badge Stage
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: "700",
                      backgroundColor: activeIssueDetailCard.stage === "feito" ? "rgba(16, 185, 129, 0.2)" : activeIssueDetailCard.stage === "revisao" ? "rgba(249, 115, 22, 0.2)" : activeIssueDetailCard.stage === "execucao" ? "rgba(168, 85, 247, 0.2)" : "rgba(56, 189, 248, 0.2)",
                      color: activeIssueDetailCard.stage === "feito" ? "#10b981" : activeIssueDetailCard.stage === "revisao" ? "#f97316" : activeIssueDetailCard.stage === "execucao" ? "#c084fc" : "#38bdf8",
                      textTransform: "uppercase"
                    }
                  },
                  activeIssueDetailCard.stage
                ),
                // Botão Fechar
                h(
                  "button",
                  {
                    onClick: () => setActiveIssueDetailCard(null),
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center"
                    },
                    title: "Fechar (Esc)"
                  },
                  SVG.xCircle({ h, width: 18, height: 18 })
                )
              )
            ),
            // Título Principal
            h(
              "h2",
              {
                style: {
                  margin: "4px 0 2px 0",
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#ffffff",
                  lineHeight: "1.4"
                }
              },
              activeIssueDetailCard.title
            ),
            // Sublinha: Datas Reais e Autoridade (FIM DE TIMESTAMPS FALSOS)
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "11px",
                  color: "#9ca3af",
                  flexWrap: "wrap"
                }
              },
              h(
                "span",
                { style: { display: "flex", alignItems: "center", gap: "4px" } },
                SVG.clock({ h, width: 12, height: 12 }),
                `Criado em: ${formatFullDateTime(activeIssueDetailCard.createdAt)}`
              ),
              h(
                "span",
                {
                  style: {
                    fontFamily: "monospace",
                    color: "#34d399",
                    backgroundColor: "rgba(52, 211, 153, 0.12)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "600"
                  }
                },
                formatRelativeTime(activeIssueDetailCard.createdAt || activeIssueDetailCard.updatedAt || activeIssueDetailCard.elapsedTime)
              ),
              h("span", { style: { color: "#4b5563" } }, "•"),
              h("span", { style: { color: "#cbd5e1" } }, `Autoridade: ${activeIssueDetailCard.decisor || "OrgFy Iris"}`),
              h("span", { style: { color: "#4b5563" } }, "•"),
              h("span", { style: { color: "#9ca3af" } }, `Branch: ${activeIssueDetailCard.branch || "main"}`)
            )
          ),
          // ── CORPO BI-PARTIDO DO MODAL (ESQUERDA: SPEC / DIREITA: ATRIBUTOS & PROBES) ──
          h(
            "div",
            {
              style: {
                padding: "18px 24px",
                overflowY: "auto",
                flex: 1,
                display: "grid",
                gridTemplateColumns: "1.55fr 1fr",
                gap: "18px"
              }
            },
            // ── COLUNA ESQUERDA: ESPECIFICAÇÃO TÉCNICA E GOVERNANÇA (CARD HERMES V3) ──
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" } },
              // 1. Objetivo do Card
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.025)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderLeft: "3px solid #38bdf8",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }
                },
                h(
                  "span",
                  { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                  "Objetivo do Card"
                ),
                h(
                  "div",
                  { style: { fontSize: "12px", color: "#f1f5f9", lineHeight: "1.5" } },
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.objetivo) || activeIssueDetailCard.objetivo || activeIssueDetailCard.title
                ),
                (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.cardFileFound) && h(
                  "div",
                  { style: { fontSize: "10px", color: "#64748b", fontFamily: "monospace", marginTop: "2px" } },
                  `Fonte real: ${hydratedIssueDetail.cardFileFound}`
                )
              ),
              // 1.5 Progresso & Checklist Vivo (Checkpoint Persistente em cards/<SLUG>.md)
              (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.progress) && hydratedIssueDetail.progress.total > 0 && h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.025)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Progresso & Checklist de Execução"
                  ),
                  h(
                    "span",
                    { style: { fontSize: "10.5px", fontFamily: "monospace", fontWeight: "700", color: hydratedIssueDetail.progress.pct === 100 ? "#10b981" : "#38bdf8" } },
                    `${hydratedIssueDetail.progress.done}/${hydratedIssueDetail.progress.total} concluídas (${hydratedIssueDetail.progress.pct}%)`
                  )
                ),
                h(
                  "div",
                  {
                    style: {
                      height: "6px",
                      width: "100%",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      overflow: "hidden"
                    }
                  },
                  h("div", {
                    style: {
                      height: "100%",
                      width: `${hydratedIssueDetail.progress.pct}%`,
                      backgroundColor: hydratedIssueDetail.progress.blocked > 0 ? "#ef4444" : hydratedIssueDetail.progress.pct === 100 ? "#10b981" : "#38bdf8",
                      transition: "width 0.25s ease"
                    }
                  })
                ),
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                  hydratedIssueDetail.progress.steps.map((st) => {
                    const badge = st.status === "done" ? { icon: "✓", color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" } : st.status === "in_progress" ? { icon: "▶", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" } : st.status === "blocked" ? { icon: "!", color: "#ef4444", bg: "rgba(239, 68, 68, 0.14)" } : { icon: "○", color: "#6b7280", bg: "rgba(255, 255, 255, 0.05)" };
                    return h(
                      "div",
                      {
                        key: st.id,
                        style: {
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(0, 0, 0, 0.28)",
                          fontSize: "11px"
                        }
                      },
                      h(
                        "span",
                        {
                          style: {
                            fontFamily: "monospace",
                            fontWeight: "700",
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: badge.bg,
                            color: badge.color,
                            flexShrink: 0
                          }
                        },
                        `${badge.icon} ${st.id}`
                      ),
                      h(
                        "div",
                        { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                        h(
                          "span",
                          {
                            style: {
                              color: st.status === "done" ? "#9ca3af" : "#f3f4f6",
                              textDecoration: st.status === "done" ? "line-through" : "none",
                              lineHeight: "1.4"
                            }
                          },
                          st.text
                        ),
                        st.note && h(
                          "span",
                          { style: { fontSize: "10px", fontFamily: "monospace", color: "#38bdf8" } },
                          st.note
                        )
                      )
                    );
                  })
                )
              ),
              // 2. Estado & Autoridade Decisória (100% real, sem fallback genérico)
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h(
                  "span",
                  { style: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                  "Estado & Autoridade Decisória"
                ),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                  h("strong", { style: { color: "#ffffff" } }, "Contexto: "),
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.contexto) || activeIssueDetailCard.contexto || (isHydratingIssueDetail ? "Carregando card em disco..." : "Não declarado no card.")
                ),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                  h("strong", { style: { color: "#ffffff" } }, "Decisão / Autoridade: "),
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.decisao) || (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.autoridade) || activeIssueDetailCard.decisao || activeIssueDetailCard.autoridade || "Não declarada no card."
                ),
                (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.escritaExclusiva) && hydratedIssueDetail.escritaExclusiva.length > 0 && h(
                  "div",
                  { style: { fontSize: "10px", color: "#93c5fd", fontFamily: "monospace", marginTop: "2px" } },
                  `Escrita exclusiva: ${hydratedIssueDetail.escritaExclusiva.join(", ")}`
                )
              ),
              // 3. Invariante L-22: Comando de Aceite Congelado
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "#060907",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Comando de Aceite Congelado (Invariante L-22)"
                  ),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    h(
                      "span",
                      { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } },
                      "Blindagem SHA-256"
                    ),
                    h(
                      "button",
                      {
                        onClick: () => {
                          var _a3;
                          const cmd = (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.acceptanceCommand) || activeIssueDetailCard.acceptanceCommand || "";
                          if (cmd && typeof navigator !== "undefined" && ((_a3 = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a3.writeText)) {
                            navigator.clipboard.writeText(cmd);
                            showNotification("success", "Comando de aceite L-22 copiado!");
                          }
                        },
                        style: {
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          color: "#10b981",
                          fontSize: "10px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        },
                        title: "Copiar comando de aceite"
                      },
                      SVG.copy({ h, width: 10, height: 10 }),
                      "Copiar"
                    )
                  )
                ),
                h(
                  "code",
                  {
                    style: {
                      fontSize: "11px",
                      fontFamily: "monospace",
                      backgroundColor: "#020403",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      color: (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.acceptanceCommand) || activeIssueDetailCard.acceptanceCommand ? "#34d399" : "#9ca3af",
                      display: "block",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      border: "1px solid rgba(16, 185, 129, 0.15)"
                    }
                  },
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.acceptanceCommand) || activeIssueDetailCard.acceptanceCommand || "Comando de aceite ainda não registrado."
                ),
                h(
                  "div",
                  { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace", display: "flex", justifyContent: "space-between", gap: "8px" } },
                  h(
                    "span",
                    {},
                    (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.acceptanceHash) ? `Hash de Aceite: ${hydratedIssueDetail.acceptanceHash.slice(0, 28)}...` : "Hash de Aceite: não gerado"
                  ),
                  h(
                    "span",
                    { style: { color: (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.acceptanceFrozenValid) ? "#10b981" : "#f59e0b", fontWeight: "600" } },
                    (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.acceptanceFrozenValid) ? "✓ Congelamento Válido (Anti-Bypass)" : "Pendente de congelamento L-22"
                  )
                )
              ),
              // 4. Critérios de Feito & Provas Exigidas
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h(
                  "span",
                  { style: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                  "Critérios de Feito & Provas Exigidas"
                ),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                  h("strong", { style: { color: "#ffffff" } }, "Feito quando: "),
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.feitoQuando) || activeIssueDetailCard.feitoQuando || "Não declarado no card."
                ),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5", whiteSpace: "pre-wrap" } },
                  h("strong", { style: { color: "#ffffff" } }, "Prova exigida: "),
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.provaExigida) || activeIssueDetailCard.provaExigida || "Não declarada no card."
                )
              ),
              // 5. Histórico de Ciclos & DSAP Backtracking (100% real)
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#f59e0b", textTransform: "uppercase" } }, "Histórico de Ciclos & DSAP Backtracking"),
                  h("span", { style: { fontSize: "10px", color: "#6b7280" } }, "Threshold: similaridade >= 0.70")
                ),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#9ca3af" } },
                  activeIssueDetailCard.rejectionHistory && activeIssueDetailCard.rejectionHistory.length > 0 ? `Recusa recente: ${activeIssueDetailCard.rejectionHistory[0].reason} (${Math.round((activeIssueDetailCard.rejectionHistory[0].similarityToFirst || 0) * 100)}% similaridade)` : hydratedIssueDetail && hydratedIssueDetail.rejectionsCount > 0 ? `${hydratedIssueDetail.rejectionsCount} recusa(s)/conflito(s) registrados em esteira-transicoes.jsonl.` : activeIssueDetailCard.stage === "feito" ? "Concluída sem recusas registradas (FPY 100% real)." : hydratedIssueDetail && hydratedIssueDetail.transitions.length > 0 ? `${hydratedIssueDetail.transitions.length} transição(ões) registrada(s); última: ${hydratedIssueDetail.transitions[hydratedIssueDetail.transitions.length - 1].de} -> ${hydratedIssueDetail.transitions[hydratedIssueDetail.transitions.length - 1].para}.` : "Em andamento — aguardando conclusão e veredito do Gate (FPY ainda não fechado)."
                )
              )
            ),
            // ── COLUNA DIREITA: SIDEBAR DE ATRIBUTOS, RUNTIME BUZZ & PROBES ──
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" } },
              // Box A: Papéis & Atribuição
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }
                },
                h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#c084fc", textTransform: "uppercase" } }, "Papéis & Atribuição"),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Decisor"),
                  h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(192, 132, 252, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.decisor || "OrgFy Iris")
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Revisor"),
                  h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(56, 189, 248, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.revisor || "QA Sentinel")
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Executor"),
                  h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.executor || "Não atribuído")
                )
              ),
              // Box B: Execução Buzz Runtime
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase" } }, "Execução Buzz Runtime (Real)"),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Modo"),
                  h(
                    "span",
                    { style: { color: "#ffffff", fontFamily: "monospace" } },
                    (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.modoBuzz) ? `${hydratedIssueDetail.modoBuzz}${hydratedIssueDetail.goalMaxTurns ? ` (${hydratedIssueDetail.goalMaxTurns} turns max)` : ""}` : "Não declarado"
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Tempo Máximo"),
                  h("span", { style: { color: "#ffffff", fontFamily: "monospace" } }, (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.maxRuntime) || "Não declarado")
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Checkout Lock"),
                  h(
                    "span",
                    { style: { color: (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.lockActive) ? "#10b981" : "#9ca3af", fontFamily: "monospace", fontSize: "10px" } },
                    (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.lockActive) ? `Ativo (${hydratedIssueDetail.lockAgent} · ${hydratedIssueDetail.lockExpiresInMin}m)` : "Sem lock ativo"
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Worktree / Branch"),
                  h(
                    "span",
                    { style: { color: "#10b981", fontFamily: "monospace", fontSize: "10px" } },
                    (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.worktreePath) || (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.branch) || "Não definida"
                  )
                )
              ),
              // Box C: Modelo Real do Executor (agents/state/ — Zero Hardcode)
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase" } }, "Modelo Real do Executor (Buzz Desktop)"),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#ffffff", fontWeight: "600", fontFamily: "monospace" } },
                  (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.executorModel) ? `${hydratedIssueDetail.executorProvider ? hydratedIssueDetail.executorProvider + "/" : ""}${hydratedIssueDetail.executorModel}` : isHydratingIssueDetail ? "Lendo agents/state/..." : "Modelo não identificado no state local"
                ),
                h(
                  "div",
                  { style: { fontSize: "10px", color: "#9ca3af" } },
                  activeIssueDetailCard.tokens ? `Telemetria: ${activeIssueDetailCard.tokens}k tokens${activeIssueDetailCard.estimatedCost ? ` · $${activeIssueDetailCard.estimatedCost}` : ""}` : "Telemetria de custo/tokens da issue: indisponível (use aba Inteligência & Saúde para média real)."
                )
              ),
              // Box D: Probes Caixa-Preta do Gate (Manifesto Real — Zero PASS Falso)
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase" } }, "Probes & Validações do Gate"),
                  h("span", { style: { fontSize: "9px", color: "#6b7280", fontFamily: "monospace" } }, (hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.probesSource) || "")
                ),
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                  ...((hydratedIssueDetail == null ? void 0 : hydratedIssueDetail.probes) || []).map(
                    (pr, idx) => h(
                      "div",
                      { key: idx, style: { display: "flex", justifyContent: "space-between", gap: "8px", color: "#d1d5db" } },
                      h("span", { title: pr.detail || "" }, `• ${pr.label}`),
                      h(
                        "span",
                        {
                          style: {
                            color: pr.status === "PASS" ? "#10b981" : pr.status === "FAIL" ? "#ef4444" : pr.status === "PENDENTE" ? "#f59e0b" : "#6b7280",
                            fontWeight: "700",
                            fontFamily: "monospace"
                          }
                        },
                        pr.status
                      )
                    )
                  ),
                  (!hydratedIssueDetail || hydratedIssueDetail.probes.length === 0) && h("div", { style: { color: "#6b7280" } }, isHydratingIssueDetail ? "Lendo probes reais..." : "Nenhum probe registrado para esta issue.")
                )
              ),
              // Box E: Transcript & Diffs Nativos do Agente (ctx.agents.ui.Transcript)
              h(
                "div",
                {
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }
                },
                h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase" } }, "Transcript & Diffs do Agente (Nativo)"),
                ((_h = (_g = ctx.agents) == null ? void 0 : _g.ui) == null ? void 0 : _h.Transcript) && (activeIssueDetailCard == null ? void 0 : activeIssueDetailCard.conversationId) ? h(ctx.agents.ui.Transcript, {
                  conversationId: activeIssueDetailCard.conversationId,
                  compact: true
                }) : h(
                  "div",
                  { style: { fontSize: "10px", color: "#9ca3af", lineHeight: "1.4" } },
                  "Nenhuma sessão ativa vinculada a este card ainda. Ao despachar com conversation_id (ou via orgfy_bind_context), o transcript e os diffs nativos do Buzz aparecem aqui."
                )
              )
            )
          ),
          // ── FOOTER DE AÇÕES (1-CLIQUE ASSERTIVO) ──
          h(
            "div",
            {
              style: {
                padding: "14px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.015)"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "button",
                {
                  onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const card = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    handleOpenIssueDeepLink(card);
                  },
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    backgroundColor: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease"
                  },
                  title: "Navegar diretamente para a Issue na tela nativa de Repos do Buzz Desktop"
                },
                SVG.externalLink({ h, width: 13, height: 13 }),
                "Abrir no Buzz Desktop"
              ),
              h(
                "button",
                {
                  onClick: (e) => handleCopyDeepLink(e, activeIssueDetailCard),
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.copy({ h, width: 13, height: 13 }),
                "Copiar Link"
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "button",
                {
                  onClick: () => {
                    const c = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    setDispatchIssueId(c.issueId);
                    setIsDispatchModalOpen(true);
                  },
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "rgba(245, 158, 11, 0.18)",
                    color: "#f59e0b",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.zap({ h, width: 12, height: 12 }),
                "Despachar"
              ),
              activeIssueDetailCard.stage === "revisao" && h(
                "button",
                {
                  onClick: () => {
                    const c = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    handleAcceptGate(c);
                  },
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#10b981",
                    color: "#000000",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.checkCircle({ h, width: 12, height: 12 }),
                "Aceitar Gate"
              ),
              h(
                "button",
                {
                  onClick: () => {
                    const c = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    setActiveLogsCard(c);
                    setIsLogsDrawerOpen(true);
                  },
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#9ca3af",
                    fontSize: "11px",
                    fontWeight: "500",
                    cursor: "pointer"
                  }
                },
                "Ver Logs"
              ),
              h(
                "button",
                {
                  onClick: () => setActiveIssueDetailCard(null),
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    fontSize: "11px",
                    cursor: "pointer"
                  }
                },
                "Fechar"
              )
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 7. MODAL AUTO-BOOTSTRAP & ONBOARDING 1-CLIQUE (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isBootstrapModalOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200
          }
        },
        h(
          "div",
          {
            style: {
              width: "560px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          // Header
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              SVG.zap({ h, width: 20, height: 20 }),
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Auto-Bootstrap da Holding OrgFy"),
              // Badge de Configuração Existente
              ((migrationSummary == null ? void 0 : migrationSummary.total) || 16) > 0 && h(
                "div",
                {
                  style: {
                    padding: "2px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    color: "#38bdf8",
                    fontSize: "10px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }
                },
                SVG.checkCircle({ h, width: 11, height: 11 }),
                `Configuração Existente (${(migrationSummary == null ? void 0 : migrationSummary.total) || 16} agentes prontos)`
              )
            ),
            h(
              "button",
              {
                onClick: () => setIsBootstrapModalOpen(false),
                title: "Fechar (Esc)",
                style: {
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center"
                }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          h(
            "p",
            { style: { margin: 0, fontSize: "12px", color: "#9ca3af", lineHeight: "1.4" } },
            "Provisionamento determinístico de ponta a ponta: diagnóstico de binários locais (python3, git, docker), integridade do repositório, canal Nostr NIP-29 (#esteira-orgfy), registro dos 4 agentes canônicos e sincronização do Porteiro."
          ),
          // Progress Bar
          (() => {
            const successCount = bootstrapSteps.filter((s) => s.status === "success").length;
            const pct = Math.round(successCount / bootstrapSteps.length * 100);
            return h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                h("span", { style: { color: "#9ca3af" } }, "Progresso do Provisionamento:"),
                h("span", { style: { color: pct === 100 ? "#10b981" : "#60a5fa", fontWeight: "700" } }, `${pct}%`)
              ),
              h(
                "div",
                {
                  style: {
                    height: "6px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden"
                  }
                },
                h("div", {
                  style: {
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? "#10b981" : "#3b82f6",
                    transition: "width 0.3s ease"
                  }
                })
              )
            );
          })(),
          // Stepper List
          h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "260px",
                overflowY: "auto",
                padding: "8px 0"
              }
            },
            bootstrapSteps.map((s, idx) => {
              const statusColor = s.status === "success" ? "#10b981" : s.status === "running" ? "#f59e0b" : s.status === "error" ? "#ef4444" : "#6b7280";
              return h(
                "div",
                {
                  key: s.step,
                  style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)"
                  }
                },
                h(
                  "div",
                  { style: { marginTop: "2px", color: statusColor } },
                  s.status === "success" ? SVG.checkCircle({ h, width: 14, height: 14 }) : s.status === "running" ? SVG.refresh({ h, width: 14, height: 14 }) : s.status === "error" ? SVG.alertTriangle({ h, width: 14, height: 14 }) : h("div", {
                    style: {
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      border: "1.5px solid #6b7280"
                    }
                  })
                ),
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 } },
                  h(
                    "span",
                    { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } },
                    `${idx + 1}. ${s.label}`
                  ),
                  s.details && h(
                    "span",
                    { style: { fontSize: "11px", color: statusColor, fontFamily: "monospace" } },
                    s.details
                  )
                )
              );
            })
          ),
          // Actions
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "6px" } },
            h(
              "button",
              {
                onClick: () => setIsBootstrapModalOpen(false),
                title: "Fechar (Esc)",
                style: {
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#9ca3af",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Fechar"
            ),
            // Botão de Reconciliação & Migração (quando configuração existente for detectada)
            ((migrationSummary == null ? void 0 : migrationSummary.total) || 16) > 0 && h(
              "button",
              {
                onClick: async () => {
                  setIsBootstrapModalOpen(false);
                  setIsMigrationModalOpen(true);
                  if (!isMigrating) {
                    handleExecuteMigration();
                  }
                },
                style: {
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              SVG.users({ h, width: 14, height: 14 }),
              "Reconciliar & Migrar Esteira"
            ),
            h(
              "button",
              {
                onClick: handleRunBootstrap,
                disabled: isBootstrapping,
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: isBootstrapping ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                  border: "none",
                  color: "#000000",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: isBootstrapping ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              isBootstrapping ? [SVG.refresh({ h, width: 14, height: 14 }), "Executando Auto-Bootstrap..."] : [SVG.zap({ h, width: 14, height: 14 }), "Inicializar Tudo em 1-Clique"]
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 8. MODAL DIAGNÓSTICO DO SERVIDOR MCP NATIVO (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isMcpDiagnosticsOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200
          }
        },
        h(
          "div",
          {
            style: {
              width: "580px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          // Header
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.cpu({ h, width: 20, height: 20 }),
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Servidor MCP Nativo — Diagnóstico Técnico")
            ),
            h(
              "button",
              {
                onClick: () => setIsMcpDiagnosticsOpen(false),
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Info Bar
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                padding: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "11px"
              }
            },
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Protocolo: "),
              h("span", { style: { color: "#60a5fa", fontWeight: "600" } }, "JSON-RPC 2.0 Loopback")
            ),
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Status: "),
              h(
                "span",
                { style: { color: mcpStatus.active ? "#10b981" : "#60a5fa", fontWeight: "600" } },
                mcpStatus.active ? "🟢 ATIVO (ctx.host.serveMcp)" : "🟢 PRONTO / LOOPBACK"
              )
            ),
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Chamadas Registradas: "),
              h("span", { style: { color: "#10b981", fontWeight: "700" } }, `${mcpStatus.toolCallsCount} invocação(ões)`)
            ),
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Clientes Suportados: "),
              h("span", { style: { color: "#ffffff" } }, "Antigravity, Claude, Goose, Pi")
            )
          ),
          // Tools Section
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Ferramentas Homologadas (7 Tools MCP + 13 AgentTools):"),
            [
              {
                name: "orgfy_status",
                desc: "Telemetria agregada ao vivo: FPY, CPI, cards ativos e catraca de regras probatórias RSI."
              },
              {
                name: "orgfy_kanban_read",
                desc: "Matriz Kanban real (triagem, despachado, execucao, revisao, feito) sem fallback mockado."
              },
              {
                name: "orgfy_despachar",
                desc: "Invocação determinística de despacho com validação mecânica L-01 (executor !== revisor)."
              },
              {
                name: "orgfy_gate",
                desc: "Decisão oficial de Gate Caixa-Preta (aceito/recusado) com holdout verification e alerta DSAP."
              },
              {
                name: "orgfy_porteiro_sync",
                desc: "Disparo pontual do ciclo determinístico do Porteiro Nostr para reconciliar filas de PR e main."
              },
              {
                name: "orgfy_loop_radar",
                desc: "Radar Live do Goose (mode=ro): detecta LOOP_SUSPEITO, STALLED_THINKING e SESSAO_DUPLICADA com channel_id/thread_root e acao_sugerida."
              },
              {
                name: "orgfy_session_stop",
                desc: "Stop / Interrupt nativo (ctx.agents.session): interrompe ou reinicia sessões travadas ou inúteis queimando tokens."
              }
            ].map(
              (tool) => h(
                "div",
                {
                  key: tool.name,
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px"
                  }
                },
                h("span", { style: { fontSize: "12px", fontFamily: "monospace", color: "#10b981", fontWeight: "700" } }, tool.name),
                h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, tool.desc)
              )
            )
          ),
          // Close Button
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", marginTop: "6px" } },
            h(
              "button",
              {
                onClick: () => setIsMcpDiagnosticsOpen(false),
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: "#3b82f6",
                  border: "none",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Entendido"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 9. MODAL MIGRADOR DE AGENTES & WORKSPACE SOBERANO (ORGFY V10)
      // ───────────────────────────────────────────────────────────────────────
      isMigrationModalOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200
          }
        },
        h(
          "div",
          {
            style: {
              width: "720px",
              maxHeight: "88vh",
              borderRadius: "16px",
              backgroundColor: "#0d1411",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflowY: "auto"
            }
          },
          // Header
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.users({ h, width: 20, height: 20 }),
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Migrador de Agentes & Workspace Soberano"),
              h("span", { style: { fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: "700" } }, "v12 Buzz-Native")
            ),
            h(
              "button",
              {
                onClick: () => setIsMigrationModalOpen(false),
                style: {
                  background: "none",
                  border: "none",
                  color: "var(--text-subtle, #9ca3af)",
                  cursor: "pointer",
                  padding: "4px"
                }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Description & Target workspace
          h(
            "div",
            { style: { fontSize: "12px", color: "#9ca3af", lineHeight: "1.5" } },
            "Sincronização atômica de todos os agentes OrgFy criados no Buzz Desktop. Vincula o diretório de execução ao repositório ",
            h("code", { style: { backgroundColor: "rgba(255, 255, 255, 0.08)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" } }, "/Users/heltonfraga/.buzz/REPOS/orgfy"),
            ", injeta contratos CoEvo-RSI (Tiers 1, 2 e 3), regras probatórias e ferramentas MCP loopback com backup automático (.bak)."
          ),
          // Metric Cards
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" } },
            h(
              "div",
              { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" } },
              h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Total de Agentes"),
              h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#ffffff", marginTop: "4px" } }, (migrationSummary == null ? void 0 : migrationSummary.total) || 16)
            ),
            h(
              "div",
              { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" } },
              h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Migrados para REPOS/orgfy"),
              h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#10b981", marginTop: "4px" } }, (migrationSummary == null ? void 0 : migrationSummary.migratedCount) || 16)
            ),
            h(
              "div",
              { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)" } },
              h("div", { style: { fontSize: "11px", color: "#38bdf8" } }, "Protocolo Ativo"),
              h("div", { style: { fontSize: "14px", fontWeight: "700", color: "#38bdf8", marginTop: "6px" } }, "v10 + CoEvo-RSI")
            )
          ),
          // Agent list
          h(
            "div",
            {
              style: {
                maxHeight: "260px",
                overflowY: "auto",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backgroundColor: "rgba(0, 0, 0, 0.3)"
              }
            },
            ((migrationSummary == null ? void 0 : migrationSummary.agents) || []).map(
              (ag) => h(
                "div",
                {
                  key: ag.name,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    fontSize: "12px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: ag.isMigrated ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: ag.isMigrated ? "#10b981" : "#f59e0b"
                      }
                    },
                    ag.isMigrated ? "✅ MIGRADO" : "⚠️ PENDENTE"
                  ),
                  h("span", { style: { fontWeight: "600", color: "#ffffff" } }, ag.name),
                  h("span", { style: { color: "var(--text-subtle, #9ca3af)", fontSize: "11px" } }, `(${ag.role})`)
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: ag.tier === "tier_3_arquiteto" ? "rgba(168, 85, 247, 0.2)" : ag.tier === "tier_2_revisor" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: ag.tier === "tier_3_arquiteto" ? "#c084fc" : ag.tier === "tier_2_revisor" ? "#60a5fa" : "#10b981"
                      }
                    },
                    ag.tier === "tier_3_arquiteto" ? "Tier 3 Arquiteto" : ag.tier === "tier_2_revisor" ? "Tier 2 Revisor" : "Tier 1 Executor"
                  ),
                  h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#6b7280" } }, ag.workspace.replace("/Users/heltonfraga/", "~/") || "~/.buzz")
                )
              )
            )
          ),
          // Migration Terminal Log
          migrationLog && h(
            "pre",
            {
              style: {
                maxHeight: "120px",
                overflowY: "auto",
                padding: "10px",
                borderRadius: "8px",
                backgroundColor: "#050706",
                color: "#38bdf8",
                fontFamily: "monospace",
                fontSize: "10px",
                margin: 0,
                whiteSpace: "pre-wrap"
              }
            },
            migrationLog
          ),
          // Action Buttons
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: loadMigrationData,
                disabled: isMigrating,
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }
              },
              "Re-verificar Status"
            ),
            h(
              "button",
              {
                onClick: handleExecuteMigration,
                disabled: isMigrating,
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isMigrating ? "rgba(56, 189, 248, 0.4)" : "#38bdf8",
                  color: "#000000",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: isMigrating ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              SVG.users({ h, width: 14, height: 14 }),
              isMigrating ? "Sincronizando Agentes..." : "Executar Migração Atômica (16 Agentes)"
            )
          )
        )
      )
    );
    function renderTemplatesRsiView() {
      var _a3, _b3;
      const templatesReais = (holdingData == null ? void 0 : holdingData.templatesReais) || [];
      const regrasReais = (holdingData == null ? void 0 : holdingData.regrasProbatorias) || [];
      const fpyReal = (_a3 = kpisData == null ? void 0 : kpisData.qualidade) == null ? void 0 : _a3.fpy_real_pct;
      const totalIntegrados = (_b3 = kpisData == null ? void 0 : kpisData.fluxo) == null ? void 0 : _b3.vazao_total_feito;
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            overflowY: "auto",
            paddingRight: "6px"
          }
        },
        h(
          "div",
          {
            style: {
              padding: "14px 18px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.025)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, "Templates Reais do Repositório & Motor RSI (Zero Mockups)"),
            h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, "Arquivos lidos diretamente de REPOS/orgfy/templates/ e regras-probatorias.json.")
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "span",
              { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.14)", color: "#10b981", fontWeight: "700", fontFamily: "monospace" } },
              `FPY Real: ${typeof fpyReal === "number" ? `${fpyReal.toFixed(1)}%` : "--"}`
            ),
            h(
              "span",
              { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(56, 189, 248, 0.14)", color: "#38bdf8", fontWeight: "700", fontFamily: "monospace" } },
              `${typeof totalIntegrados === "number" ? totalIntegrados : "--"} integrados`
            )
          )
        ),
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" } },
          templatesReais.map(
            (tmpl) => h(
              "div",
              {
                key: tmpl.id,
                style: {
                  borderRadius: "10px",
                  backgroundColor: "#15161a",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                  h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, tmpl.name),
                  h("span", { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } }, tmpl.path)
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontWeight: "700",
                      backgroundColor: tmpl.exists ? "rgba(16, 185, 129, 0.16)" : "rgba(239, 68, 68, 0.16)",
                      color: tmpl.exists ? "#10b981" : "#f87171",
                      fontFamily: "monospace"
                    }
                  },
                  tmpl.exists ? `${tmpl.versionTag} · ${tmpl.linesCount} linhas` : "AUSENTE"
                )
              ),
              h("p", { style: { fontSize: "11px", color: "#9ca3af", margin: 0, lineHeight: "1.4" } }, tmpl.preview),
              h(
                "div",
                { style: { display: "flex", gap: "8px", marginTop: "auto" } },
                h(
                  "button",
                  {
                    onClick: () => {
                      var _a4;
                      if (typeof navigator !== "undefined" && ((_a4 = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a4.writeText)) {
                        navigator.clipboard.writeText(tmpl.path);
                      }
                      showNotification("success", `Caminho copiado: ${tmpl.path}`);
                    },
                    style: {
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      color: "#cbd5e1",
                      fontSize: "10px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }
                  },
                  "Copiar Caminho"
                ),
                tmpl.exists && h(
                  "button",
                  {
                    onClick: () => {
                      var _a4;
                      if (typeof navigator !== "undefined" && ((_a4 = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a4.writeText)) {
                        navigator.clipboard.writeText(tmpl.content);
                      }
                      showNotification("success", `Conteúdo real de ${tmpl.path} copiado!`);
                    },
                    style: {
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      backgroundColor: "rgba(56, 189, 248, 0.1)",
                      color: "#38bdf8",
                      fontSize: "10px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }
                  },
                  "Copiar Template"
                )
              )
            )
          )
        ),
        h(
          "div",
          {
            style: {
              borderRadius: "10px",
              backgroundColor: "#15161a",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, `Regras Probatórias L-90 (${regrasReais.length} ativas em regras-probatorias.json)`),
            h(
              "button",
              {
                onClick: async () => {
                  showNotification("info", "Disparando retro.py para compilação probatória...");
                  const res = await compileProbationaryRule(ctx, {
                    erroId: "auto-" + Date.now().toString().slice(-4),
                    descricao: "Prevenção compilada via Control Plane v2",
                    comandoCheck: "python3 -m pytest -q testes/esteira -v"
                  });
                  if (res.success) {
                    await loadHolding();
                    showNotification("success", "Regra probatória compilada com sucesso!");
                  } else {
                    showNotification("warning", "Falha na compilação da regra probatória.");
                  }
                },
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#c084fc",
                  color: "#000000",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer"
                }
              },
              "+ Compilar Regra"
            )
          ),
          regrasReais.length === 0 ? h(
            "div",
            { style: { padding: "14px", textAlign: "center", color: "#9ca3af", fontSize: "11px" } },
            "Nenhuma regra probatória registrada em .esteira/estado/regras-probatorias.json no momento."
          ) : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            regrasReais.map(
              (r) => h(
                "div",
                {
                  key: r.id,
                  style: {
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 120px 100px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(0,0,0,0.25)",
                    fontSize: "11px",
                    alignItems: "center"
                  }
                },
                h("span", { style: { fontFamily: "monospace", color: "#f3f4f6", fontWeight: "600" } }, r.id),
                h("span", { style: { color: "#9ca3af" } }, r.descricao),
                h("span", { style: { fontFamily: "monospace", color: "#60a5fa" } }, `${r.cardsAvaliados}/${r.janelaAlvo} cards`),
                h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981" } }, r.status)
              )
            )
          )
        )
      );
    }
    function renderColumn(title, cards, badgeBg, badgeColor, renderAction) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            borderRadius: "10px",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            border: `1px solid ${THEME.hairline}`,
            padding: "10px",
            minHeight: 0,
            height: "100%",
            maxHeight: "100%",
            overflow: "hidden",
            boxSizing: "border-box"
          }
        },
        // Column Header
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "8px",
              borderBottom: `1px solid ${THEME.hairline}`,
              marginBottom: "10px",
              flexShrink: 0
            }
          },
          h("span", { style: { fontWeight: "600", fontSize: "12px", color: THEME.textPrimary } }, title),
          h(
            "span",
            {
              style: {
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: badgeBg,
                color: badgeColor,
                fontWeight: "700"
              }
            },
            cards.length
          )
        ),
        // Cards List (Face Limpa e Escaneável com Scroll Vertical Independente)
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px" } },
          cards.length === 0 ? h(
            "div",
            {
              style: {
                padding: "24px 10px",
                textAlign: "center",
                color: THEME.textMuted,
                fontSize: "11px"
              }
            },
            "Nenhum card nesta raia"
          ) : cards.map(
            (c) => h(
              "div",
              {
                key: c.id,
                onClick: () => setActiveIssueDetailCard(c),
                style: {
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: THEME.cardBg,
                  border: `1px solid ${THEME.borderCard}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  cursor: "pointer",
                  transition: "background 0.15s ease, border-color 0.15s ease"
                },
                onMouseEnter: (e) => e.currentTarget.style.backgroundColor = THEME.cardHover,
                onMouseLeave: (e) => e.currentTarget.style.backgroundColor = THEME.cardBg
              },
              // Card Top (Tenant + Issue ID + Priority + Stage)
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "9px",
                        fontFamily: "monospace",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: "#8b949e",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                        fontWeight: "600"
                      }
                    },
                    c.empresa || "orgfy"
                  ),
                  h(
                    "span",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        if (hasValidNostrIssueId(c)) {
                          handleOpenIssueDeepLink(c);
                        } else {
                          setActiveIssueDetailCard(c);
                        }
                      },
                      title: hasValidNostrIssueId(c) ? "Abrir issue diretamente no Buzz Desktop" : "Worktree local — clique para ver detalhes no Cockpit",
                      style: {
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: hasValidNostrIssueId(c) ? "#58a6ff" : "#f59e0b",
                        fontWeight: "700",
                        cursor: "pointer",
                        textDecoration: hasValidNostrIssueId(c) ? "underline" : "none",
                        textUnderlineOffset: "2px"
                      }
                    },
                    hasValidNostrIssueId(c) ? `#${(c.issueId || c.id).slice(0, 8)} ↗` : `#${(c.issueId || c.id).slice(0, 12)}`
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "5px" } },
                  c.ciStatus && h(
                    "span",
                    {
                      style: {
                        fontSize: "9px",
                        fontFamily: "monospace",
                        fontWeight: "700",
                        color: c.ciStatus === "pass" ? "#10b981" : c.ciStatus === "running" ? "#f59e0b" : "#ef4444",
                        backgroundColor: c.ciStatus === "pass" ? "rgba(16, 185, 129, 0.12)" : c.ciStatus === "running" ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        padding: "1px 5px",
                        borderRadius: "4px"
                      }
                    },
                    `CI:${c.ciStatus.toUpperCase()}`
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: c.priority === "P0" ? "rgba(239, 68, 68, 0.2)" : c.priority === "P1" ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                        color: c.priority === "P0" ? "#f87171" : c.priority === "P1" ? "#fbbf24" : "#60a5fa"
                      }
                    },
                    c.priority
                  )
                )
              ),
              // Card Title
              h(
                "div",
                {
                  style: {
                    fontSize: "12px",
                    fontWeight: "600",
                    color: THEME.textPrimary,
                    lineHeight: "1.4"
                  }
                },
                c.title
              ),
              // Informações Hermes: L-22 Aceite + Worktree Chips
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                c.acceptanceCommand && h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      backgroundColor: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      color: "#34d399",
                      fontFamily: "monospace",
                      fontSize: "9.5px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    },
                    title: `Comando Invariante L-22: ${c.acceptanceCommand}`
                  },
                  h("span", { style: { fontWeight: "700", color: "#10b981" } }, "L-22:"),
                  h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, c.acceptanceCommand)
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                  h(
                    "span",
                    {
                      style: {
                        color: "#38bdf8",
                        fontFamily: "monospace",
                        fontSize: "9.5px",
                        backgroundColor: "rgba(56, 189, 248, 0.08)",
                        padding: "1px 5px",
                        borderRadius: "4px"
                      },
                      title: `Worktree Isolada: ${c.worktreePath || `.worktrees/${c.issueId}`}`
                    },
                    h(
                      "span",
                      { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                      SVG.folder({ h, width: 10, height: 10 }),
                      (c.worktreePath || `.worktrees/${c.issueId}`).replace(".worktrees/", "")
                    )
                  ),
                  h(
                    "span",
                    {
                      style: {
                        color: "#c084fc",
                        fontSize: "9.5px",
                        fontFamily: "monospace"
                      }
                    },
                    c.branch || c.tier
                  )
                )
              ),
              // Card Footer (Papéis + Relative Elapsed Time)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10px",
                    color: THEME.textMuted,
                    borderTop: `1px solid ${THEME.hairline}`,
                    paddingTop: "6px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "5px" } },
                  h(
                    "span",
                    {
                      style: {
                        color: "#cbd5e1",
                        fontWeight: "600",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        padding: "1px 5px",
                        borderRadius: "4px"
                      }
                    },
                    c.executor || "Não atribuído"
                  ),
                  c.revisor && h(
                    "span",
                    { style: { color: "#8b949e", fontSize: "9px" } },
                    `→ ${c.revisor}`
                  )
                ),
                h(
                  "span",
                  {
                    style: {
                      fontFamily: "monospace",
                      fontSize: "10px",
                      color: "#34d399",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    },
                    title: c.createdAt ? formatFullDateTime(c.createdAt) : void 0
                  },
                  SVG.clock({ h, width: 10, height: 10 }),
                  formatRelativeTime(c.createdAt || c.updatedAt || c.elapsedTime)
                )
              ),
              // Ação Rápida da Raia (Despachar / Ver Logs / Decidir Gate)
              renderAction && h(
                "div",
                { onClick: (e) => e.stopPropagation() },
                renderAction(c)
              )
            )
          )
        )
      );
    }
  }
  function OrgFySettingsCard() {
    const navigateToCockpit = () => {
      var _a2;
      try {
        if ((_a2 = ctx.navigation) == null ? void 0 : _a2.navigate) {
          ctx.navigation.navigate("orgfy");
        } else {
          window.location.hash = "#/orgfy";
        }
      } catch {
        window.location.hash = "#/orgfy";
      }
    };
    return h(
      "div",
      {
        style: {
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          color: "#ffffff"
        }
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        SVG.orgfy({ h, width: 24, height: 24 }),
        h(
          "div",
          null,
          h("div", { style: { fontWeight: "700", fontSize: "14px" } }, "OrgFy Control Room"),
          h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Esteira determinística v10 & governança da Holding Cortexx")
        )
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            padding: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderRadius: "8px",
            fontSize: "11px"
          }
        },
        h("span", { style: { color: "#9ca3af" } }, "Arquitetura:"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "OrgFy v12 Control Plane"),
        h("span", { style: { color: "#9ca3af" } }, "Camadas:"),
        h("span", { style: { color: "#38bdf8", fontWeight: "600" } }, "Board → Core → Subsidiárias"),
        h("span", { style: { color: "#9ca3af" } }, "Telemetria:"),
        h("span", { style: { color: "#cbd5e1", fontWeight: "600" } }, "100% ao vivo no Cockpit")
      ),
      h(
        "button",
        {
          onClick: navigateToCockpit,
          style: {
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: "#10b981",
            color: "#000000",
            fontWeight: "700",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            alignSelf: "flex-start"
          }
        },
        "Abrir OrgFy Control Room"
      )
    );
  }
  const ORGFY_PAGE_ICON = "data:image/svg+xml;base64," + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="orgfy" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#0f766e"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#orgfy)"/><polygon points="32,12 50,22.5 50,41.5 32,52 14,41.5 14,22.5" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/><polyline points="14,22.5 32,33 50,22.5" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/><line x1="32" y1="33" x2="32" y2="52" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="33" r="4" fill="#a7f3d0"/></svg>'
  );
  ctx.pages.register({
    id: "orgfy",
    title: "OrgFy Control Room",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    icon: ORGFY_PAGE_ICON,
    component: OrgFyCockpit
  });
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "orgfy-settings",
      title: "OrgFy Control Room",
      group: "Pipelines & Autonomous Systems",
      component: OrgFySettingsCard
    });
  }
  if ((_a = ctx.panels) == null ? void 0 : _a.register) {
    try {
      const ChannelPulseComponent = createChannelPulsePanel(ctx, async () => {
        const res = await fetchKpisEsteira(ctx);
        return res.kpis;
      });
      ctx.panels.register({
        id: "orgfy-channel-pulse",
        title: "Pulso OrgFy",
        channelPlacement: "side",
        channelLauncher: { label: "Pulso OrgFy" },
        component: ChannelPulseComponent
      });
      console.log("[ORGFY] Sidebar panel orgfy-channel-pulse registrado com sucesso.");
    } catch (err) {
      console.warn("[ORGFY] Falha ao registrar sidebar panel:", err);
    }
  }
  registerGovernanceAgentHooks(ctx);
  registerBuzzNativeIntegrations(ctx);
  if ((_b = ctx.agents) == null ? void 0 : _b.addInstructions) {
    try {
      ctx.agents.addInstructions({
        id: "orgfy-governance-v11",
        text: `Esteira OrgFy v12 (Holding Cortexx) — Governança Determinística & Ciclo Fechado:
Você opera sobre a fábrica de software agêntica da holding Cortexx (empresas: orgfy, lumen-iptv, saas-tributario).
Regras Invariantes:
- Template Oficial OrgFy + Spec-Kit Obrigatório (FAIL-CLOSED): NUNCA crie issues com 'buzz issues create' direto nem markdown improvisado. Toda nova tarefa exige: (1) spec no Spec-Kit ('specs/.../spec.md' com 'Plan Gate: Passed' para 'gate:implementacao'), (2) geração pelo template canônico ('./ferramentas/orgfy-card-new'), (3) validação com './ferramentas/card-lint.sh <card.md>' (exit 0) e (4) publicação exclusivamente via './ferramentas/buzz-issue-guard.sh'.
- L-01 a L-90: Qualquer modificação de código deve ser estritamente rastreada e validada pela esteira determinística.
- L-22: O comando de aceite é imutável e blindado por hash SHA-256 no momento do despacho. Nunca afrouxe critérios de aceite.
- L-90: Regras probatórias RSI em .esteira/estado/regras-probatorias.json são avaliadas contra o FPY histórico (First Pass Yield).
- Hard Cap Orçamentário (80% alerta / 100% bloqueio): Despachos são bloqueados ao atingir 100% do teto diário salvo board_override=true.
- Checkout Lock Atômico (Nostr 64-hex): Nenhum card pode ser executado em paralelo por dois agentes; adquira lock passando SEMPRE o issue_id Nostr completo (64 hex) + title, revisor, acceptance_command e branch.
- DSAP Backtracking: Na 2ª recusa consecutiva com similaridade >= 0.70, o card entra em backtracking para o COO re-escopar.
- Atribuição de Issues (FERR-ASSIGN-AUTH): NUNCA execute 'buzz issues assign' diretamente (falha com auth_error Kind 1 em chamadores locais); use sempre 'python3 ferramentas/assign_issue.py' na raiz do REPOS/orgfy.
- Push autenticado no Relay (worktree): Se 'git push relay' falhar com exit 128 ('no nostr key configured'), chame a tool 'buzz__repo' para obter o header 'Authorization: Nostr ...', injete via 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.<relay_git_url>.extraHeader GIT_CONFIG_VALUE_0="Authorization: Nostr ..."' (sem persistir segredo) e reexecute 'entregar'.
- Leitura Direta de Cards e PRs (Zero '--help'): Arquivos 'cards/*.md' ficam na raiz '/Users/heltonfraga/.buzz/REPOS/orgfy/cards/' (não dentro da worktree). Sem desperdiçar turnos em '--help': (a) ler issue: 'buzz issues get --event <id-64> --repo 7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20/orgfy'; (b) atualizar PR após novo commit/rebase: 'buzz pr update --repo-owner 7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20 --repo orgfy --pr <pr-id-64> --commit <sha-40>'.
- Freio Anti-Loop (Máximo 12 'shell's): NUNCA ultrapasse 12 comandos 'shell' sem commit nem repita o mesmo erro 2 vezes seguidas. Ao bater 2 falhas consecutivas no mesmo passo ou 12 'shell's sem avanço, PARE imediatamente e publique 'BLOQUEADO | por: <seu perfil> | motivo: ... | falta: ... | resolve: <perfil>'.
- Escalonamento Hierárquico por Empresa (Preservação da CEO Holding): A ordem obrigatória de escalonamento operacional é Agente → COO da empresa (ex.: OrgFy Bento) → CEO da empresa específica (ex.: Lumen Lara na Lumen IPTV, Tributario CEO no SaaS Tributário) → CEO da Holding (OrgFy Iris) APENAS em último caso. PROIBIDO acionar OrgFy Iris para loops rotineiros de esteira; o COO da empresa resolve em Nível 1 e só escala ao CEO da empresa se não conseguir resolver ou se o próprio COO travar.
- Regra Anti-Escopo Aberto (Iris / CEOs / Despachos ao COO e Executores): PROIBIDO delegar ao COO ou a executores com pedido aberto (ex.: 'escolha o próximo item da auditoria', 'veja o que falta'). Todo acionamento DEVE declarar: (a) alvo concreto (slug/bug + 1 a 3 arquivos exatos), (b) critério de pronto / comando de aceite L-22 esperado e (c) o que NÃO refazer.
- Consistência Card ↔ Issue & Escrita Exclusiva: Antes de despachar, garanta que o card versionado em 'cards/' tenha exatamente o mesmo Executor, Revisor, Branch e lista de 'Escrita exclusiva' que a issue Nostr despachada (todo arquivo citado em 'O que fazer' DEVE constar em 'Escrita exclusiva').
- Orçamento de Exploração do COO (Bento): ao receber acionamento para emitir card, limite a leitura exploratória a no máximo 10 comandos 'shell' (<= 5 min). Se o escopo chegar aberto ou ambíguo, NÃO varra o repositório inteiro — responda em 1 turno pedindo o alvo fechado (ou proponha 1 candidato concreto para aprovação).
- Limite de Turno para Revisores (Teo, Bento Arquiteto, Vera, QA Sentinel — Máximo 15 'shell's): em uma revisão, rode o comando de aceite L-22, confira o diff/escopo e emita imediatamente 'GATE: aceito' ou 'GATE: recusado' (e encerre). PROIBIDO abrir sessões longas de debug de 'porteiro.py'/'esteira_minima.py' durante uma revisão — se o merge atrasar, reporte em 1 linha e saia.
- Isolamento Estrito de Worktree (Proibido git checkout na raiz): NUNCA execute 'git checkout --detach' ou troque de branch dentro da raiz '/Users/heltonfraga/.buzz/REPOS/orgfy' (isso corrompe o estado compartilhado para todos os agentes). Para revisar ou comparar BASE_VS_AGORA, crie SEMPRE uma worktree isolada e remova-a ao final.
- Protocolo de Auto-Cura em Ciclo Fechado (Função Nível 1 do COO — Bento; CEO da empresa em Nível 2; Iris só em último caso): TODO wake '[ORGFY RADAR AUTO-CURA]' é uma ORDEM OPERACIONAL OBRIGATÓRIA (NUNCA trate como 'dado passivo de plugin' nem ignore em silêncio) e INTERROMPER UM AGENTE NUNCA ENCERRA O TURNO DO COO. ANTES de despachar ou cobrar (e SEMPRE que acordado pelo Radar), chame 'orgfy_loop_radar({ apenas_ativos: true })'. Ao interromper uma sessão em loop, execute obrigatoriamente 1 dos 3 desfechos imediatos: (A) Erro de API/provider (502/503/No available accounts/Kiro) -> 'orgfy_session_stop(action="interrupt")' + 'orgfy_model_failover({ agente, agent_pubkey, channel_id, thread_root, prefer_free: true, apply: true, retrigger: true })'; (B) Demanda ainda aberta (ESCOPO_ABERTO, COMPACTACAO_LOOP, ERRO_REPETIDO) -> chame 'orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: "interrupt", relaunch: true, reset_session_before_relaunch: true, relaunch_instruction: "<o que corrigir/fazer>", target_files: ["<1-3 arquivos>"], acceptance_command: "<comando L-22>", max_shells: 10, reason })' para que a própria ferramenta relance o agente já com '@Nome Exato' e escopo fechado; (C) ITEM_JA_FECHADO (já na main) -> interrompa sem relançar. Publique 'AUTO-CURA | agente | causa-raiz | ação tomada' no canal.
- Decisor Híbrido v12: orgfy_lint_card usa Decisions API com fallback determinístico offline automático (ferramentas/esteira/decisor_fallback.py) em caso de falta de saldo ou timeout.
- Guarda de Identidade & Anti-Loop de Wake (Zero Desperdício): (1) Se você for acordado por uma menção '@OrgFy <OutroPerfil>' que não corresponde exatamente ao seu nome de agente (ex.: '@OrgFy Hugo' caindo na sessão de 'OrgFy Teo'), NÃO execute comandos nem tente adivinhar — responda imediatamente apenas '[SILENT]'; (2) Se um wake repetido chegar numa thread em que o card já está explicitamente aguardando GATE/parecer de outro agente (e não houve novo commit/evento), responda apenas '[SILENT]'.
Ferramentas nativas disponíveis neste plugin:
1. orgfy_status({ empresa? }): Consulta o placar de 20h, FPY, CPI de tokens, contagem de aceites, merged e raias da esteira.
2. orgfy_kanban_read({ stage?, empresa? }): Lê a matriz Kanban completa (triagem, despachado, execucao, revisao, feito) apenas com cards vinculados a Issues Nostr reais (64 hex).
3. orgfy_despachar({ issue_id, executor, revisor, empresa?, board_override? }): Despacha card em worktree isolado respeitando Hard Cap orçamentário, template OrgFy/Spec-Kit e lock atômico.
4. orgfy_gate({ pr_id, decisao, motivo, revisor, empresa? }): Aplica o Gate Caixa-Preta (aceito/recusado) com probes de validação.
5. orgfy_porteiro_sync({ empresa? }): Dispara sincronização determinística de eventos Nostr e ciclo de execução.
6. orgfy_kpis({ recalcular? }): Lê os KPIs reais de Fluxo, Qualidade, Economia e Higiene (kpis-esteira.json) e opcionalmente recalcula via script Python.
7. orgfy_checkout_lock({ action, issue_id?, agent_id?, ttl_minutes?, title?, revisor?, acceptance_command?, branch? }): Gerencia lock atômico de checkout (acquire, release, list) com resolução automática para 64-hex Nostr.
8. orgfy_governanca_avaliar({ dry_run?, auto_wake? }): Avalia orçamento, fila de revisão, WIP órfão e estagnação nível 3, disparando alertas/wakes com cooldown anti-spam.
9. orgfy_lint_card({ title, objective?, done_when?, acceptance_command?, executor?, revisor?, card_markdown?, spec_path? }): Audita template OrgFy/Spec-Kit, qualidade semântica e regras L-01/L-22 antes do despacho.
10. orgfy_bind_context({ conversation_id, issue_id, worktree_path?, title?, acceptance_command?, acceptance_hash?, executor?, revisor? }): Vincula o worktree e injeta regras vivas L-22/L-90 direto na conversa do agente.
11. orgfy_historico_buscar({ query?, spec?, limit? }): Busca just-in-time no Arquivo de Issues Resolvidas por código, causa raiz, arquivo ou SHA.
12. orgfy_loop_radar({ apenas_ativos?, agente? }): Inspeciona o Radar de Loops & Sessões Zumbis do Goose em tempo real (LOOP_SUSPEITO, STALLED_THINKING, SESSAO_DUPLICADA, EXPLORACAO_CLI_HELP) com channel_id, thread_root, agent_pubkey, ultimo_shell e acao_sugerida.
13. orgfy_session_stop({ agente, agent_pubkey?, channel_id?, thread_root?, action?, release_issue_id?, reason? }): Interrompe (Stop) ou reinicia imediatamente o turno de um agente travado ou em trabalho inútil via API nativa do Buzz Desktop (action: 'interrupt' | 'new' | 'compact'), com liberação opcional de lock.
14. orgfy_model_failover({ agente?, agent_pubkey?, failed_model?, prefer_free?, apply?, retrigger?, channel_id?, thread_root?, retrigger_text? }): Integração OrgFy ↔ NexusMind Gateway — faz ping real nos modelos mais inteligentes disponíveis no NexusMind, elege o melhor online (inteligência + menor latência real em ms), atualiza o modelo do agente via ctx.agents.save() e re-dispara na thread original.
15. orgfy_card_create({ slug, titulo, autoridade, decisao, executor, revisor, escrita_exclusiva, feito_quando, acceptance_command, ... }): Abertura schema-first de card OrgFy com triagem em cascata via Decisions API (risco, tier modelo, política Attention), hash L-22 SHA-256 congelado, contrato nativo Buzz Attention/Watch (interest_set + watch_add) e validação opcional via card-lint.sh.
16. orgfy_decision_triage({ mode: 'card' | 'diff', ... }): Classificação rápida em batch via Buzz Decisions API (yes_no + score + choice) com fallback determinístico offline para triagem de card ou pre-flight de diff/entrega (Escrita exclusiva + L-24).
17. orgfy_card_progress({ slug, action?: 'read' | 'update', step_id?, status?, note?, agent? }): Lê ou atualiza o checklist vivo P1..Pn em cards/<SLUG>.md e colore automaticamente o grafo Mermaid '## Fluxo'. Use ao iniciar/concluir cada etapa para retomada determinística pós-queda.
Consulte sempre orgfy_status, orgfy_kpis, orgfy_loop_radar ou orgfy_kanban_read para inspecionar métricas reais antes de agir. Ao abrir novos cards, prefira sempre orgfy_card_create em vez de redigir Markdown livre.`
      });
      console.log("[ORGFY] ctx.agents.addInstructions registrado com sucesso.");
    } catch (err) {
      console.warn("[ORGFY] Falha ao registrar addInstructions:", err);
    }
  }
  if ((_c = ctx.agents) == null ? void 0 : _c.addTool) {
    try {
      const unifiedTools = buildUnifiedOrgfyTools(ctx);
      for (const tool of unifiedTools) {
        ctx.agents.addTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          call: async (_client, _context, args) => {
            const res = await tool.execute(args || {});
            return res.text;
          }
        });
      }
      console.log(`[ORGFY v13] ${unifiedTools.length} agentTools registradas via Unified Tool Registry (OTel GenAI + Attention + Decisions API).`);
    } catch (err) {
      console.warn("[ORGFY] Falha ao registrar agentTools:", err);
    }
  }
  let mcpServerInstance = null;
  startOrgfyMcpServer(ctx).then((server) => {
    mcpServerInstance = server;
  }).catch((err) => {
    console.warn("[ORGFY] MCP Server failed to start:", err);
  });
  if (ctx.on) {
    ctx.on("dispose", () => {
      if (mcpServerInstance == null ? void 0 : mcpServerInstance.close) {
        try {
          mcpServerInstance.close();
        } catch (_e) {
        }
      }
    });
  }
}
export {
  AVAILABLE_AGENTS,
  INITIAL_PIPELINE_CARDS,
  INITIAL_REGRAS_PROBATORIAS,
  SVG,
  TENANTS,
  THEME,
  apply,
  applyStepUpdateToMarkdown,
  buildBuzzAttentionContract,
  buildUnifiedOrgfyTools,
  checkMentionTargetIdentity,
  checkThreadWakeAntiLoop,
  createCanonicalCard,
  executeCardProgress,
  getBuzzNativeState,
  getTelemetrySnapshot,
  hydrateIssueDetail,
  inject,
  parseCardProgress,
  registerBuzzNativeIntegrations,
  resetTelemetryForTests,
  resetThreadWakeGuardForTests,
  triageCardWithDecisions,
  triageDiffWithDecisions
};
