// Integração nativa com Workspaces do Buzz Desktop (session.sidebarPreferences + session.channelKit)
// e Roster vivo de agentes por canal (session.channels.refreshRoster + ctx.agents.snapshot).

import type { Context } from "@buzz/author";
import type { TenantAgentSpec } from "../factory/factory-adapter";
import type { LiveCrewAgent } from "../factory/FactoryBoardAndFloor";

export interface BuzzWorkspaceChannelOption {
  id: string;
  name: string;
  channelType: string;
  memberCount: number;
  workspaceId: string | null;
}

export interface BuzzWorkspaceOption {
  id: string;
  name: string;
  icon?: string;
  channels: BuzzWorkspaceChannelOption[];
}

export interface BuzzWorkspacesCatalog {
  available: boolean;
  workspaces: BuzzWorkspaceOption[];
  allChannels: BuzzWorkspaceChannelOption[];
  assignments: Record<string, string>;
}

export interface BuzzWorkspaceDetails {
  workspaceId: string;
  workspaceName: string;
  folders: string[];
  worktree?: { location: string; baseBranch: string };
  instructions: string;
  lineupAgents: string[];
  rawCanvas: string;
  templateId: string;
  baseEventId?: string;
  writable: boolean;
}

const WS_PREFIX = "<!-- buzz-session-workspace:v1 ";
const WS_END = "<!-- /buzz-session-workspace -->";

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return input.replace(/[^a-z0-9_-]/gi, "_");
}

async function projectTemplateId(workspaceId: string): Promise<string> {
  return `me-section-${await sha256Hex(workspaceId)}`;
}

export function parseBuzzWorkspaceCanvas(content: string): {
  folders: string[];
  worktree?: { location: string; baseBranch: string };
  instructions: string;
} {
  if (!content || !content.startsWith(WS_PREFIX)) {
    return { folders: [], instructions: content || "" };
  }
  const lineEnd = content.indexOf(" -->\n");
  const blockEnd = content.indexOf(`\n${WS_END}\n\n`, lineEnd);
  if (lineEnd < 0 || blockEnd < 0) {
    return { folders: [], instructions: content };
  }
  try {
    const raw = JSON.parse(content.slice(WS_PREFIX.length, lineEnd));
    const folders = Array.isArray(raw?.folders)
      ? raw.folders.filter((f: any) => typeof f === "string" && f.trim()).map((f: string) => f.trim())
      : [];
    const worktree =
      raw?.worktree && typeof raw.worktree.location === "string" && typeof raw.worktree.baseBranch === "string"
        ? { location: raw.worktree.location.trim(), baseBranch: raw.worktree.baseBranch.trim() || "main" }
        : undefined;
    const instructions = content.slice(blockEnd + WS_END.length + 3);
    return { folders, worktree, instructions };
  } catch {
    return { folders: [], instructions: content };
  }
}

export function buildBuzzWorkspaceCanvas(input: {
  folders: string[];
  worktree?: { location: string; baseBranch: string };
  instructions: string;
}): string {
  const folders = Array.from(new Set(input.folders.map((f) => f.trim()).filter(Boolean)));
  const cleanInstructions = input.instructions || "";
  if (folders.length === 0) return cleanInstructions;
  const worktree =
    input.worktree?.location?.trim()
      ? {
          location: input.worktree.location.trim(),
          baseBranch: input.worktree.baseBranch?.trim() || "main",
        }
      : undefined;
  const metadata = JSON.stringify({ folders, ...(worktree ? { worktree } : {}) })
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
  const lines = worktree
    ? [
        "## Workspace instructions",
        "",
        ...folders.map((folder) => `- Use \`${folder}\` for review only. Do not make changes directly in it.`),
        `- Before starting new work, fetch the latest \`${worktree.baseBranch}\` branch from origin.`,
        `- For each repository that needs changes, create a new worktree under \`${worktree.location}\` from \`origin/${worktree.baseBranch}\`.`,
        "- Make code changes in that new worktree. A task that only reads code, or does not use a repository, usually does not need one.",
      ]
    : ["## Project folders", "", ...folders.map((folder) => `- \`${folder}\``)];
  return [`${WS_PREFIX}${metadata} -->`, ...lines, WS_END, "", cleanInstructions].join("\n");
}

/** Lista todos os Workspaces (seções da sidebar) e canais do Buzz Desktop em tempo real. */
export async function listBuzzWorkspaces(ctx: Context): Promise<BuzzWorkspacesCatalog> {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session) {
      return { available: false, workspaces: [], allChannels: [], assignments: {} };
    }
    if (typeof session.sidebarPreferences?.refresh === "function") {
      try {
        await session.sidebarPreferences.refresh();
      } catch {}
    }
    const prefsData =
      typeof session.sidebarPreferences?.snapshot === "function"
        ? session.sidebarPreferences.snapshot()?.data
        : null;
    const rawSections: any[] = Array.isArray(prefsData?.sections) ? prefsData.sections : [];
    const assignments: Record<string, string> =
      prefsData?.assignments && typeof prefsData.assignments === "object" ? prefsData.assignments : {};

    const listSnap = typeof session.channels?.list === "function" ? session.channels.list() : null;
    const rawChannels: any[] = Array.isArray(listSnap?.channels) ? listSnap.channels : [];
    const allChannels: BuzzWorkspaceChannelOption[] = rawChannels
      .filter((ch) => ch?.id && ch?.channelType !== "dm" && !ch?.archived)
      .map((ch) => {
        const members = Array.isArray(ch?.members)
          ? ch.members
          : Array.isArray(ch?.participants)
          ? ch.participants
          : [];
        return {
          id: String(ch.id),
          name: String(ch.name || ch.id.slice(0, 8)),
          channelType: String(ch.channelType || "stream"),
          memberCount: members.length,
          workspaceId: assignments[String(ch.id)] ? String(assignments[String(ch.id)]) : null,
        };
      });

    const workspaces: BuzzWorkspaceOption[] = rawSections
      .filter((s) => s?.id && s?.name)
      .map((s) => {
        const wsId = String(s.id);
        return {
          id: wsId,
          name: String(s.name),
          icon: typeof s.icon === "string" && s.icon ? s.icon : undefined,
          channels: allChannels.filter((c) => c.workspaceId === wsId),
        };
      });

    return {
      available: workspaces.length > 0 || allChannels.length > 0,
      workspaces,
      allChannels,
      assignments,
    };
  } catch {
    return { available: false, workspaces: [], allChannels: [], assignments: {} };
  }
}

/** Lê folders, worktree e Instructions de um Workspace do Buzz via session.channelKit. */
export async function loadBuzzWorkspaceDetails(
  ctx: Context,
  workspaceId: string | null | undefined,
  workspaceName = ""
): Promise<BuzzWorkspaceDetails | null> {
  if (!workspaceId) return null;
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session?.channelKit) return null;
    if (typeof session.channelKit.refresh === "function") {
      try {
        await session.channelKit.refresh();
      } catch {}
    }
    const kit = typeof session.channelKit.snapshot === "function" ? session.channelKit.snapshot() : null;
    const entries: any[] = Array.isArray(kit?.entries) ? kit.entries : [];
    const tplId = await projectTemplateId(workspaceId);
    const prefsData =
      typeof session.sidebarPreferences?.snapshot === "function"
        ? session.sidebarPreferences.snapshot()?.data
        : null;
    const legacyId = prefsData?.legacyTemplates?.[workspaceId];

    const findEntry = (id: string) =>
      entries.find((e) => !e?.record?.deleted && e?.record?.value?.type === "template" && e?.record?.value?.id === id);

    const entry = findEntry(tplId) || (legacyId ? findEntry(legacyId) : undefined);
    const tpl = entry?.record?.value;
    const rawCanvas = typeof tpl?.canvas === "string" ? tpl.canvas : "";
    const parsed = parseBuzzWorkspaceCanvas(rawCanvas);
    const lineupAgents: string[] = Array.isArray(tpl?.agents) ? tpl.agents.map(String) : [];

    return {
      workspaceId,
      workspaceName: workspaceName || String(tpl?.name || workspaceId),
      folders: parsed.folders,
      worktree: parsed.worktree,
      instructions: parsed.instructions,
      lineupAgents,
      rawCanvas,
      templateId: tplId,
      baseEventId: typeof entry?.eventId === "string" ? entry.eventId : undefined,
      writable: typeof session.channelKit.save === "function",
    };
  } catch {
    return null;
  }
}

/** Salva folders, worktree e Instructions de volta no Workspace do Buzz (session.channelKit.save). */
export async function saveBuzzWorkspaceDetails(
  ctx: Context,
  details: BuzzWorkspaceDetails,
  patch: { folders: string[]; worktree?: { location: string; baseBranch: string }; instructions: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session?.channelKit || typeof session.channelKit.save !== "function") {
      return { ok: false, error: "API session.channelKit.save indisponível nesta versão do Buzz." };
    }
    const canvas = buildBuzzWorkspaceCanvas(patch);
    const template = {
      type: "template",
      id: details.templateId,
      name: `${details.workspaceName.slice(0, 100)} chats`,
      description: "Starting workspace and Canvas for new chats in this workspace.",
      canvas,
      agents: details.lineupAgents || [],
      teamIds: [],
    };
    await session.channelKit.save(template, details.baseEventId);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** Busca os agentes membros vivos de um canal no Buzz (chama refreshRoster + cruza com ctx.agents.snapshot). */
export async function loadLiveChannelAgentRoster(
  ctx: Context,
  channelId: string | null | undefined,
  liveCrew: LiveCrewAgent[]
): Promise<LiveCrewAgent[]> {
  if (!channelId) return [];
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session?.channels) return [];
    if (typeof session.channels.refreshRoster === "function") {
      try {
        await session.channels.refreshRoster(channelId);
      } catch {}
    }
    const listSnap = typeof session.channels.list === "function" ? session.channels.list() : null;
    const allChannels: any[] = Array.isArray(listSnap?.channels) ? listSnap.channels : [];
    const summary: any =
      (typeof session.channels.get === "function" ? session.channels.get(channelId) : undefined) ||
      allChannels.find((ch) => String(ch?.id || "") === channelId) ||
      null;
    const rawMembers: string[] = Array.isArray(summary?.members)
      ? summary.members
      : Array.isArray(summary?.participants)
      ? summary.participants
      : [];
    const memberSet = new Set(rawMembers.map((m) => String(m || "").toLowerCase()).filter(Boolean));
    if (memberSet.size === 0) return [];
    return liveCrew.filter((ag) => ag.pubkey && memberSet.has(ag.pubkey.toLowerCase()));
  } catch {
    return [];
  }
}

function inferRoleFromAgentName(name: string): {
  papel: string;
  funcao: string;
  categoria: "lideranca" | "execucao" | "revisao" | "operacao";
} {
  const low = name.toLowerCase();
  if (/\b(ceo|iris)\b/.test(low)) return { papel: "ceo_empresa", funcao: "CEO · Direção & Decisão", categoria: "lideranca" };
  if (/\b(coo|bento)\b/.test(low) && !/arquit/.test(low)) return { papel: "coo", funcao: "COO · Operações, Despacho & Auto-cura", categoria: "lideranca" };
  if (/arquit/.test(low)) return { papel: "arquiteto", funcao: "Arquiteto · Design Técnico & Revisão", categoria: "lideranca" };
  if (/\bcto\b/.test(low)) return { papel: "cto", funcao: "CTO · Arquitetura & Engenharia", categoria: "lideranca" };
  if (/\bcro\b/.test(low)) return { papel: "cro", funcao: "CRO · Risco, Auditoria & Compliance", categoria: "lideranca" };
  if (/\bcpo\b/.test(low)) return { papel: "cpo", funcao: "CPO · Produto & Portfólio", categoria: "lideranca" };
  if (/\bcgo\b/.test(low)) return { papel: "cgo", funcao: "CGO · Growth & Distribuição", categoria: "lideranca" };
  if (/\bpo\b|product/.test(low)) return { papel: "po", funcao: "Product Owner · Escopo & Critérios L-22", categoria: "operacao" };
  if (/\bqa\b|test|revis/.test(low)) return { papel: "revisor_codigo", funcao: "QA & Revisão de Código (Gate L-01)", categoria: "revisao" };
  if (/segur|secur|hugo/.test(low)) return { papel: "revisor_seguranca", funcao: "Segurança & Auditoria", categoria: "revisao" };
  if (/growth|mkt|distribu/.test(low)) return { papel: "growth", funcao: "Growth & Aquisição", categoria: "execucao" };
  if (/infra|atlas|devops/.test(low)) return { papel: "infra", funcao: "Infra · CI/CD & Runtime", categoria: "execucao" };
  if (/ui|front|livia|design/.test(low)) return { papel: "frontend", funcao: "Frontend · Interface & UX", categoria: "execucao" };
  if (/dev|back|otto|eng/.test(low)) return { papel: "executor", funcao: "Dev · Implementação em Worktree", categoria: "execucao" };
  return { papel: "executor", funcao: "Agente do Canal (Buzz)", categoria: "execucao" };
}

/**
 * Combina o roster vivo de agentes do Canal Principal do Buzz com os metadados de governança
 * do manifesto JSON. Quando há membros vivos no canal, eles se tornam a fonte de verdade do time.
 */
export function buildEffectiveTenantAgents(
  manifestAgents: TenantAgentSpec[],
  liveChannelAgents: LiveCrewAgent[]
): { agents: TenantAgentSpec[]; source: "buzz_channel_live" | "manifest" } {
  if (!liveChannelAgents || liveChannelAgents.length === 0) {
    return { agents: manifestAgents, source: "manifest" };
  }
  const byPk = new Map<string, TenantAgentSpec>();
  const byName = new Map<string, TenantAgentSpec>();
  for (const m of manifestAgents) {
    if (m.pubkey) byPk.set(m.pubkey.toLowerCase(), m);
    byName.set(m.name.toLowerCase(), m);
  }
  const merged: TenantAgentSpec[] = liveChannelAgents.map((live) => {
    const pkLow = (live.pubkey || "").toLowerCase();
    const existing = (pkLow && byPk.get(pkLow)) || byName.get(live.name.toLowerCase()) || null;
    const inferred = inferRoleFromAgentName(live.name);
    return {
      name: live.name,
      papel: existing?.papel || inferred.papel,
      funcao: existing?.funcao || inferred.funcao,
      categoria: existing?.categoria || inferred.categoria,
      pubkey: live.pubkey || existing?.pubkey || "",
      model: live.model || existing?.model || "indisponível",
      provider: live.provider || existing?.provider || "buzz",
      parallelism: existing?.parallelism ?? 2,
      running: live.running,
      inBuzz: true,
      agentKey: live.key || existing?.agentKey || live.name,
    };
  });
  return { agents: merged, source: "buzz_channel_live" };
}

/** Auto-detecta o melhor Workspace do Buzz para uma empresa pelo slug/nome. */
export function autoMatchBuzzWorkspace(
  catalog: BuzzWorkspacesCatalog,
  tenantSlug: string,
  companyName: string
): BuzzWorkspaceOption | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  const targets = [norm(tenantSlug), norm(companyName)].filter(Boolean);
  for (const t of targets) {
    const exact = catalog.workspaces.find((w) => norm(w.name) === t);
    if (exact) return exact;
  }
  for (const t of targets) {
    const partial = catalog.workspaces.find((w) => norm(w.name).includes(t) || t.includes(norm(w.name)));
    if (partial) return partial;
  }
  return null;
}
