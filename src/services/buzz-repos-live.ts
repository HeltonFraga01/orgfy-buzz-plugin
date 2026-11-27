// Integração 100% nativa com o Buzz Repos (NIP-34) via ctx.relay.snapshot().session.repositories & session.projectGit
// + Navegação direta sem redirecionamento via OS usando ctx.navigation.open() com scope resolvido de ctx.relay.

import type { Context } from "@buzz/author";

export type BuzzRepoTab = "files" | "commits" | "issues" | "prs" | "contributors" | "channels";

export type BuzzEntityRoute =
  | {
      type: "repo";
      owner: string;
      dtag: string;
      tab?: BuzzRepoTab;
      commit?: string;
    }
  | {
      type: "pr" | "issue";
      owner: string;
      dtag: string;
      id: string;
    };

export interface LiveRepoItemSummary {
  id: string;
  kind: "issue" | "pr";
  owner: string;
  dtag: string;
  title: string;
  authorPubkey: string;
  createdAt: number;
  content: string;
}

export interface LiveRepoEntityDetail {
  route: BuzzEntityRoute;
  title: string;
  content: string;
  status: string;
  authorPubkey: string;
  createdAt: number;
  commit?: string;
  commitDiff?: string | null;
  channels: string[];
  comments: Array<{
    id: string;
    authorPubkey: string;
    createdAt: number;
    content: string;
  }>;
}

export interface LiveRepoSnapshot {
  available: boolean;
  owner: string;
  dtag: string;
  name?: string;
  issues: LiveRepoItemSummary[];
  prs: LiveRepoItemSummary[];
}

export const DEFAULT_ORGFY_REPO_OWNER =
  "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";

/**
 * Resolve o NavigationScope ({ viewer, communityOrigin }) de forma confiável:
 * 1) ctx.navigation.snapshot().entry.target.scope (quando já dentro de uma página com scope)
 * 2) ctx.relay.snapshot() (viewer + origin ou derivação de scope `origin:viewer`, como no RepoPage.tsx oficial)
 */
export function resolveBuzzNavigationScope(
  ctx: Context | any
): { viewer: string; communityOrigin: string } | null {
  try {
    const navSnap =
      typeof ctx?.navigation?.snapshot === "function" ? ctx.navigation.snapshot() : null;
    const navScope = navSnap?.entry?.target?.scope;
    if (navScope?.viewer && navScope?.communityOrigin) {
      return {
        viewer: String(navScope.viewer),
        communityOrigin: String(navScope.communityOrigin),
      };
    }
  } catch {}

  try {
    const relaySnap =
      typeof ctx?.relay?.snapshot === "function" ? ctx.relay.snapshot() : null;
    const viewer = relaySnap?.viewer ? String(relaySnap.viewer) : "";
    let communityOrigin = relaySnap?.origin ? String(relaySnap.origin) : "";
    if (!communityOrigin && viewer && typeof relaySnap?.scope === "string" && relaySnap.scope.endsWith(`:${viewer}`)) {
      communityOrigin = relaySnap.scope.slice(0, -(viewer.length + 1));
    }
    if (viewer && communityOrigin) {
      return { viewer, communityOrigin };
    }
  } catch {}

  return null;
}

/**
 * Abre diretamente qualquer destino do Buzz Repos (Issue, PR, Commit ou Aba) via ctx.navigation.open
 * em 1 único salto interno — sem cair no handler de URL do macOS nem abrir página intermediária.
 */
export async function openBuzzRepoEntity(
  ctx: Context | any,
  route: BuzzEntityRoute
): Promise<boolean> {
  const scope = resolveBuzzNavigationScope(ctx);
  if (!scope || typeof ctx?.navigation?.open !== "function") {
    return false;
  }

  let normalizedRoute: BuzzEntityRoute =
    "id" in route
      ? {
          type: route.type,
          owner: route.owner.toLowerCase().trim(),
          dtag: route.dtag.trim(),
          id: route.id.toLowerCase().replace(/^#/, "").trim(),
        }
      : {
          type: "repo",
          owner: route.owner.toLowerCase().trim(),
          dtag: route.dtag.trim(),
          ...(route.tab ? { tab: route.tab } : {}),
          ...(route.commit ? { commit: route.commit.toLowerCase().trim() } : {}),
        };

  // Verifica se o repositório/issue existe no relay sob (owner, dtag) antes de navegar;
  // evita cair na tela "This page isn't available" quando o dtag/owner diverge ou falta anúncio kind:30617.
  const session = typeof ctx?.relay?.snapshot === "function" ? ctx.relay.snapshot()?.session : null;
  if ("id" in normalizedRoute && session?.repositories && typeof session.repositories.load === "function") {
    const tryLoad = async (cand: BuzzEntityRoute): Promise<boolean> => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 3000);
      try {
        const det = await session.repositories.load(cand, ac.signal);
        return Boolean(det?.item);
      } catch {
        return false;
      } finally {
        clearTimeout(t);
      }
    };

    const okDirect = await tryLoad(normalizedRoute);
    if (!okDirect) {
      let resolved: BuzzEntityRoute | null = null;
      try {
        const navSnap = typeof ctx?.navigation?.snapshot === "function" ? ctx.navigation.snapshot() : null;
        const activeCh = navSnap?.entry?.target?.kind === "conversation" ? navSnap.entry.target.channelId : null;
        if (activeCh && typeof session.repositories.home === "function") {
          const acH = new AbortController();
          const tH = setTimeout(() => acH.abort(), 2500);
          try {
            const home = await session.repositories.home(activeCh, acH.signal);
            const repos: any[] = home?.status === "home" && Array.isArray(home.repositories) ? home.repositories : [];
            for (const r of repos) {
              if (!r?.owner || !r?.dtag) continue;
              const cand: BuzzEntityRoute = { ...normalizedRoute, owner: String(r.owner).toLowerCase(), dtag: String(r.dtag) };
              if (await tryLoad(cand)) {
                resolved = cand;
                break;
              }
            }
          } finally {
            clearTimeout(tH);
          }
        }
      } catch {}

      if (!resolved && normalizedRoute.dtag !== "orgfy") {
        const orgfyCand: BuzzEntityRoute = { ...normalizedRoute, owner: DEFAULT_ORGFY_REPO_OWNER, dtag: "orgfy" };
        if (await tryLoad(orgfyCand)) {
          resolved = orgfyCand;
        }
      }

      if (resolved) {
        normalizedRoute = resolved;
      } else {
        // Não navega para buzz.repos nem para pageId inexistente (evita tela "This page isn't available")
        return false;
      }
    }
  } else if ("id" in normalizedRoute) {
    // Sem session.repositories.load para confirmar o item no relay, evita navegar às cegas para buzz.repos
    return false;
  } else if (session?.repositories && typeof session.repositories.load === "function") {
    // Também valida rota de repositório (ex.: aba PRs) antes de navegar para evitar tela "This page isn't available"
    const acRepo = new AbortController();
    const tRepo = setTimeout(() => acRepo.abort(), 2500);
    try {
      const repoDet = await session.repositories.load(normalizedRoute, acRepo.signal);
      if (!repoDet) return false;
    } catch {
      return false;
    } finally {
      clearTimeout(tRepo);
    }
  } else {
    return false;
  }

  try {
    const res = await ctx.navigation.open({
      version: 1,
      kind: "page",
      pluginId: "buzz.repos",
      pageId: "repos",
      scope,
      route: {
        version: 1,
        params: normalizedRoute,
      },
    });
    if (res && typeof res === "object" && "status" in res && res.status !== "opened") {
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[OrgFy BuzzRepos] ctx.navigation.open falhou:", err);
    return false;
  }
}

export async function openPrInBuzz(
  ctx: Context | any,
  pr: { id: string; owner?: string; dtag?: string }
): Promise<boolean> {
  const id = String(pr.id || "").toLowerCase().replace(/^#/, "").trim();
  if (!/^[0-9a-f]{64}$/i.test(id)) return false;
  const owner = /^[0-9a-f]{64}$/i.test(String(pr.owner || ""))
    ? String(pr.owner).toLowerCase()
    : DEFAULT_ORGFY_REPO_OWNER;
  const dtag = String(pr.dtag || "orgfy").trim() || "orgfy";
  return openBuzzRepoEntity(ctx, { type: "pr", owner, dtag, id });
}

export async function openRepoTabInBuzz(
  ctx: Context | any,
  opts: { owner?: string; dtag?: string; tab?: BuzzRepoTab; commit?: string }
): Promise<boolean> {
  const owner = /^[0-9a-f]{64}$/i.test(String(opts.owner || ""))
    ? String(opts.owner).toLowerCase()
    : DEFAULT_ORGFY_REPO_OWNER;
  const dtag = String(opts.dtag || "orgfy").trim() || "orgfy";
  return openBuzzRepoEntity(ctx, {
    type: "repo",
    owner,
    dtag,
    ...(opts.tab ? { tab: opts.tab } : {}),
    ...(opts.commit ? { tab: "commits", commit: opts.commit } : {}),
  });
}

function tagValue(event: any, name: string): string | undefined {
  const tags: any[] = Array.isArray(event?.tags) ? event.tags : [];
  const found = tags.find((t) => Array.isArray(t) && t[0] === name && typeof t[1] === "string");
  return found ? String(found[1]) : undefined;
}

/**
 * Descobre o repositório NIP-34 vinculado ao canal da empresa via `session.repositories.home(channelId)`
 * e carrega Issues (`kind 1621`) e PRs (`kind 1618`) ao vivo direto do relay do Buzz.
 */
const _liveRepoSnapshotCache = new Map<string, { snap: LiveRepoSnapshot; ts: number }>();

export async function loadLiveRepoSnapshot(
  ctx: Context | any,
  opts: { channelId?: string | null; owner?: string; dtag?: string; force?: boolean }
): Promise<LiveRepoSnapshot> {
  const fallbackOwner = /^[0-9a-f]{64}$/i.test(String(opts.owner || ""))
    ? String(opts.owner).toLowerCase()
    : DEFAULT_ORGFY_REPO_OWNER;
  const fallbackDtag = String(opts.dtag || "orgfy").trim() || "orgfy";
  const cacheKey = `${opts.channelId || ""}:${fallbackOwner}:${fallbackDtag}`;
  const cached = _liveRepoSnapshotCache.get(cacheKey);
  if (!opts.force && cached && Date.now() - cached.ts < 45_000) {
    return cached.snap;
  }

  const session = typeof ctx?.relay?.snapshot === "function" ? ctx.relay.snapshot()?.session : null;
  if (!session?.repositories || typeof session.repositories.load !== "function") {
    return { available: false, owner: fallbackOwner, dtag: fallbackDtag, issues: [], prs: [] };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4500);
  try {
    let owner = fallbackOwner;
    let dtag = fallbackDtag;
    let name: string | undefined;

    if (opts.channelId && typeof session.repositories.home === "function") {
      try {
        const home = await session.repositories.home(opts.channelId, ac.signal);
        if (home?.status === "home" && Array.isArray(home.repositories) && home.repositories.length > 0) {
          const picked =
            home.repositories.find((r: any) => String(r.dtag || "").toLowerCase() === fallbackDtag.toLowerCase()) ||
            home.repositories[0];
          if (picked?.owner && picked?.dtag) {
            owner = String(picked.owner).toLowerCase();
            dtag = String(picked.dtag);
            name = typeof picked.name === "string" ? picked.name : dtag;
          }
        }
      } catch {}
    }

    const [issuesDetail, prsDetail] = await Promise.all([
      session.repositories
        .load({ type: "repo", owner, dtag, tab: "issues" }, ac.signal)
        .catch(() => null),
      session.repositories
        .load({ type: "repo", owner, dtag, tab: "prs" }, ac.signal)
        .catch(() => null),
    ]);

    const mapItems = (detail: any, kind: "issue" | "pr"): LiveRepoItemSummary[] => {
      const items: any[] = Array.isArray(detail?.items) ? detail.items : [];
      return items.map((ev) => {
        const content = String(ev?.content || "");
        const title =
          tagValue(ev, "subject") ||
          content.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").slice(0, 120) ||
          `${kind.toUpperCase()} #${String(ev?.id || "").slice(0, 8)}`;
        return {
          id: String(ev?.id || ""),
          kind,
          owner,
          dtag,
          title,
          authorPubkey: String(ev?.pubkey || "").toLowerCase(),
          createdAt: Number(ev?.created_at || 0) * 1000,
          content,
        };
      });
    };

    const result: LiveRepoSnapshot = {
      available: Boolean(issuesDetail || prsDetail),
      owner,
      dtag,
      name: name || issuesDetail?.entity?.name || prsDetail?.entity?.name || dtag,
      issues: mapItems(issuesDetail, "issue"),
      prs: mapItems(prsDetail, "pr"),
    };
    if (result.available) {
      _liveRepoSnapshotCache.set(cacheKey, { snap: result, ts: Date.now() });
    }
    return result;
  } catch {
    return { available: false, owner: fallbackOwner, dtag: fallbackDtag, issues: [], prs: [] };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Carrega o detalhe completo de uma Issue ou PR específica direto de `session.repositories.load()`
 * + diff do commit via `session.projectGit.read()` (quando aplicável), para exibir dentro do drawer.
 */
export async function loadLiveRepoEntityDetail(
  ctx: Context | any,
  route: { type: "issue" | "pr"; owner?: string; dtag?: string; id: string }
): Promise<LiveRepoEntityDetail | null> {
  const id = String(route.id || "").toLowerCase().replace(/^#/, "").trim();
  if (!/^[0-9a-f]{64}$/i.test(id)) return null;
  const session = typeof ctx?.relay?.snapshot === "function" ? ctx.relay.snapshot()?.session : null;
  if (!session?.repositories || typeof session.repositories.load !== "function") return null;

  const owner = /^[0-9a-f]{64}$/i.test(String(route.owner || ""))
    ? String(route.owner).toLowerCase()
    : DEFAULT_ORGFY_REPO_OWNER;
  const dtag = String(route.dtag || "orgfy").trim() || "orgfy";

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const fullRoute: BuzzEntityRoute = { type: route.type, owner, dtag, id };
    const detail = await session.repositories.load(fullRoute, ac.signal);
    if (!detail?.item) return null;

    let commitDiff: string | null = null;
    if (detail.commit && session.projectGit && typeof session.projectGit.read === "function") {
      try {
        const git = await session.projectGit.read({ owner, dtag, commit: detail.commit }, ac.signal);
        if (git && typeof git.diff === "string") {
          commitDiff = git.diff.slice(0, 12000);
        }
      } catch {}
    }

    const content = String(detail.item.content || "");
    const title =
      tagValue(detail.item, "subject") ||
      content.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").slice(0, 140) ||
      `#${id.slice(0, 8)}`;

    const activity: any[] = Array.isArray(detail.activity) ? detail.activity : [];
    return {
      route: fullRoute,
      title,
      content,
      status: String(detail.status || "Open"),
      authorPubkey: String(detail.item.pubkey || "").toLowerCase(),
      createdAt: Number(detail.item.created_at || 0) * 1000,
      commit: detail.commit ? String(detail.commit) : undefined,
      commitDiff,
      channels: Array.isArray(detail.channels) ? detail.channels.map(String) : [],
      comments: activity.map((ev) => ({
        id: String(ev?.id || ""),
        authorPubkey: String(ev?.pubkey || "").toLowerCase(),
        createdAt: Number(ev?.created_at || 0) * 1000,
        content: String(ev?.content || ""),
      })),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve nomes canônicos por pubkey usando `session.identityNames` / `ctx.identityNames`
 * com fallback para o mapa local de agentes da empresa.
 */
export function resolveBuzzIdentityName(
  ctx: Context | any,
  pubkey: string | null | undefined,
  fallbackMap?: Map<string, string>
): string {
  const pk = String(pubkey || "").trim().toLowerCase();
  if (!pk) return "Desconhecido";

  try {
    const session = typeof ctx?.relay?.snapshot === "function" ? ctx.relay.snapshot()?.session : null;
    const idView = session?.identityNames || ctx?.identityNames;
    if (typeof idView?.resolve === "function") {
      const resolved = idView.resolve(pk);
      if (resolved && typeof resolved === "string" && resolved.trim()) return resolved.trim();
    }
    if (typeof idView?.lookup === "function") {
      const looked = idView.lookup(pk);
      if (looked?.name) return String(looked.name);
    }
  } catch {}

  if (fallbackMap?.has(pk)) return fallbackMap.get(pk)!;
  return /^[0-9a-f]{64}$/i.test(pk) ? `#${pk.slice(0, 8)}` : pk;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUZZ REPOS GIT API (session.projectGit.read) + PARSER DE DIFF UNIFICADO
// ─────────────────────────────────────────────────────────────────────────────

export interface BuzzGitCommit {
  hash: string;
  author: string;
  date: number;
  subject: string;
}

export interface BuzzGitFileEntry {
  path: string;
  hash: string;
  size: number;
}

export interface BuzzGitSnapshot {
  head: string | null;
  commits: BuzzGitCommit[];
  files: BuzzGitFileEntry[];
  readme: string | null;
  file: { path: string; content: string | null; size: number } | null;
  diff: string | null;
}

export interface ParsedDiffLine {
  type: "add" | "del" | "ctx";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface ParsedDiffHunk {
  header: string;
  lines: ParsedDiffLine[];
}

export interface ParsedDiffFile {
  path: string;
  previousPath?: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  hunks: ParsedDiffHunk[];
}

export async function readBuzzProjectGit(
  ctx: Context | any,
  opts: { owner?: string; dtag?: string; commit?: string; path?: string }
): Promise<BuzzGitSnapshot | null> {
  const session = typeof ctx?.relay?.snapshot === "function" ? ctx.relay.snapshot()?.session : null;
  if (!session?.projectGit || typeof session.projectGit.read !== "function") return null;

  const owner = /^[0-9a-f]{64}$/i.test(String(opts.owner || ""))
    ? String(opts.owner).toLowerCase()
    : DEFAULT_ORGFY_REPO_OWNER;
  const dtag = String(opts.dtag || "orgfy").trim() || "orgfy";

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 9000);
  try {
    const input: Record<string, string> = { owner, dtag };
    if (opts.commit && /^[0-9a-f]{7,40}$/i.test(opts.commit)) input.commit = opts.commit.toLowerCase();
    if (opts.path && opts.path.trim()) input.path = opts.path.trim();
    const res = await session.projectGit.read(input, ac.signal);
    if (!res || typeof res !== "object") return null;
    return {
      head: typeof res.head === "string" ? res.head : null,
      commits: Array.isArray(res.commits) ? res.commits : [],
      files: Array.isArray(res.files) ? res.files : [],
      readme: typeof res.readme === "string" ? res.readme : null,
      file: res.file && typeof res.file === "object" ? res.file : null,
      diff: typeof res.diff === "string" ? res.diff : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseUnifiedDiff(rawDiff: string | null | undefined): ParsedDiffFile[] {
  if (!rawDiff || !rawDiff.trim()) return [];
  const lines = rawDiff.replace(/\r\n/g, "\n").split("\n");
  const files: ParsedDiffFile[] = [];
  let current: ParsedDiffFile | null = null;
  let currentHunk: ParsedDiffHunk | null = null;
  let oldNum = 0;
  let newNum = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current) files.push(current);
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      const aPath = match ? match[1] : "arquivo";
      const bPath = match ? match[2] : aPath;
      current = {
        path: bPath,
        previousPath: aPath !== bPath ? aPath : undefined,
        status: aPath !== bPath ? "renamed" : "modified",
        additions: 0,
        deletions: 0,
        hunks: [],
      };
      currentHunk = null;
      continue;
    }

    if (!current) {
      if (line.startsWith("+++ b/")) {
        current = {
          path: line.slice(6).trim() || "patch",
          status: "modified",
          additions: 0,
          deletions: 0,
          hunks: [],
        };
      }
      continue;
    }

    if (line.startsWith("new file mode")) {
      current.status = "added";
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
      continue;
    }
    if (line.startsWith("rename from ")) {
      current.previousPath = line.slice(12).trim();
      current.status = "renamed";
      continue;
    }
    if (line.startsWith("rename to ")) {
      current.path = line.slice(10).trim();
      current.status = "renamed";
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("index ")) {
      continue;
    }

    if (line.startsWith("@@ ")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      oldNum = m ? Number(m[1]) : 1;
      newNum = m ? Number(m[2]) : 1;
      currentHunk = { header: line, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      if (line.startsWith("+")) {
        current.additions += 1;
        currentHunk.lines.push({ type: "add", oldLine: null, newLine: newNum++, text: line.slice(1) });
      } else if (line.startsWith("-")) {
        current.deletions += 1;
        currentHunk.lines.push({ type: "del", oldLine: oldNum++, newLine: null, text: line.slice(1) });
      } else if (line.startsWith(" ") || line === "") {
        currentHunk.lines.push({
          type: "ctx",
          oldLine: oldNum++,
          newLine: newNum++,
          text: line.startsWith(" ") ? line.slice(1) : "",
        });
      }
    }
  }

  if (current) files.push(current);
  return files;
}
