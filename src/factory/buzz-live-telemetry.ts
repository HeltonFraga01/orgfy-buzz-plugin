// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/lib/orchestration.ts
// Telemetria 100% nativa do Buzz Desktop: consome session.agentActivity (turnos ao vivo, tool/step atual, typing, interrupt),
// session.presence, session.mainAgent e session.canvas.read diretamente das APIs oficiais de @buzz/author.

import type { Context } from "@buzz/author";

export interface LiveAgentTurn {
  agentPubkey: string;
  agentName: string;
  channelId: string;
  threadRootId?: string;
  messageId?: string;
  state: "working" | "waiting" | "error" | "typing";
  stepLabel: string;
  toolName?: string;
  toolTarget?: string;
  startedAt: number;
  error?: string;
  stoppable: boolean;
}

export interface BuzzLiveTelemetrySnapshot {
  connected: boolean;
  activityStatus: string;
  /** Turnos de agentes realmente trabalhando, esperando ou com erro agora no Buzz */
  activeTurns: LiveAgentTurn[];
  /** Mapa pubkey(lower) -> LiveAgentTurn mais recente */
  byPubkey: Record<string, LiveAgentTurn>;
  /** Mapa pubkey(lower) -> TODOS os turnos simultâneos daquele agente */
  turnsByPubkey: Record<string, LiveAgentTurn[]>;
  /** Mapa pubkey(lower) -> status de presença online/away/offline */
  presenceByPubkey: Record<string, "online" | "away" | "offline" | "unknown">;
  /** Contagem de mensagens não lidas por channelId */
  unreadByChannel: Record<string, number>;
}

export const EMPTY_TELEMETRY: BuzzLiveTelemetrySnapshot = {
  connected: false,
  activityStatus: "unavailable",
  activeTurns: [],
  byPubkey: {},
  turnsByPubkey: {},
  presenceByPubkey: {},
  unreadByChannel: {},
};

export function readBuzzLiveTelemetry(
  ctx: Context,
  nameByPubkey: Map<string, string>
): BuzzLiveTelemetrySnapshot {
  try {
    const relaySnap = typeof (ctx as any)?.relay?.snapshot === "function" ? (ctx as any).relay.snapshot() : null;
    const session = relaySnap?.session;
    if (!session) return EMPTY_TELEMETRY;

    const actSnap = session.agentActivity?.snapshot?.();
    const now = Date.now();
    const byPubkey: Record<string, LiveAgentTurn> = {};
    const turnsByPubkey: Record<string, LiveAgentTurn[]> = {};
    const seenSessionKey = new Set<string>();
    const turns: LiveAgentTurn[] = [];

    const pushTurn = (item: LiveAgentTurn) => {
      const sk = `${item.agentPubkey}:${item.channelId}:${item.threadRootId || item.messageId || ""}`;
      if (seenSessionKey.has(sk)) return;
      seenSessionKey.add(sk);
      turns.push(item);
      if (!turnsByPubkey[item.agentPubkey]) turnsByPubkey[item.agentPubkey] = [];
      turnsByPubkey[item.agentPubkey].push(item);
      if (!byPubkey[item.agentPubkey] || item.startedAt >= byPubkey[item.agentPubkey].startedAt) {
        byPubkey[item.agentPubkey] = item;
      }
    };

    // 1. LocalWork (mais rico: inclui step.tool, step.target, error e stoppable!)
    const localList: any[] = Array.isArray(actSnap?.local) ? actSnap.local : [];
    for (const row of localList) {
      if (!row || row.dismissed) continue;
      if (row.state !== "working" && row.state !== "waiting" && row.state !== "error") continue;
      const pk = String(row.agent || "").toLowerCase();
      if (!pk) continue;
      const stepTool = row.step?.tool ? String(row.step.tool) : undefined;
      const stepTarget = row.step?.target ? String(row.step.target) : undefined;
      const stepLabel =
        row.state === "error"
          ? `Erro: ${String(row.error || "falha no turno").slice(0, 72)}`
          : stepTool
          ? `${stepTool}${stepTarget ? ` · ${stepTarget.slice(0, 40)}` : ""}`
          : row.state === "waiting"
          ? "Iniciando turno..."
          : "Pensando...";
      pushTurn({
        agentPubkey: pk,
        agentName: nameByPubkey.get(pk) || `Agente #${pk.slice(0, 8)}`,
        channelId: String(row.channelId || ""),
        threadRootId: row.threadRootId ? String(row.threadRootId) : undefined,
        messageId: row.messageId ? String(row.messageId) : undefined,
        state: row.state === "error" ? "error" : row.state === "waiting" ? "waiting" : "working",
        stepLabel,
        toolName: stepTool,
        toolTarget: stepTarget,
        startedAt: Number(row.startedAt || now),
        error: row.error ? String(row.error) : undefined,
        stoppable: Boolean(row.stoppable),
      });
    }

    // 2. Typing / Working remoto no relay (permite múltiplas sessões em canais/threads distintos)
    const typingList: any[] = Array.isArray(actSnap?.typing) ? actSnap.typing : [];
    for (const t of typingList) {
      if (!t || !t.working) continue;
      if (typeof t.expiresAt === "number" && t.expiresAt < now) continue;
      const pk = String(t.agent || "").toLowerCase();
      if (!pk) continue;
      pushTurn({
        agentPubkey: pk,
        agentName: nameByPubkey.get(pk) || `Agente #${pk.slice(0, 8)}`,
        channelId: String(t.channelId || ""),
        threadRootId: t.threadRootId ? String(t.threadRootId) : undefined,
        state: "typing",
        stepLabel: "Respondendo no Buzz...",
        startedAt: Number(t.startedAt || t.timestamp || now),
        stoppable: false,
      });
    }

    // 3. ActivityTurns remotos em estado "working"
    const remoteTurns: any[] = Array.isArray(actSnap?.turns) ? actSnap.turns : [];
    for (const rt of remoteTurns) {
      if (!rt || rt.state !== "working") continue;
      const pk = String(rt.agent || "").toLowerCase();
      if (!pk) continue;
      const firstReq = Array.isArray(rt.requests) ? rt.requests[0] : null;
      pushTurn({
        agentPubkey: pk,
        agentName: nameByPubkey.get(pk) || `Agente #${pk.slice(0, 8)}`,
        channelId: String(rt.channelId || ""),
        threadRootId: firstReq?.threadRootId ? String(firstReq.threadRootId) : undefined,
        messageId: firstReq?.messageId ? String(firstReq.messageId) : undefined,
        state: "working",
        stepLabel: "Executando turno...",
        startedAt: Number(rt.timestamp || now),
        stoppable: false,
      });
    }

    // 4. Presença real (session.presence.status)
    const presenceByPubkey: Record<string, "online" | "away" | "offline" | "unknown"> = {};
    if (typeof session.presence?.status === "function") {
      for (const pk of nameByPubkey.keys()) {
        try {
          const st = session.presence.status(pk);
          if (st === "online" || st === "away" || st === "offline" || st === "unknown") {
            presenceByPubkey[pk] = st;
          }
        } catch {}
      }
    }

    // 5. Unread counts por canal (session.unread.snapshot)
    const unreadByChannel: Record<string, number> = {};
    try {
      const uSnap = session.unread?.snapshot?.();
      if (uSnap && typeof uSnap === "object") {
        const channelsMap = (uSnap as any).channels || (uSnap as any).byChannel;
        if (channelsMap instanceof Map) {
          for (const [cid, val] of channelsMap.entries()) {
            const count = typeof val === "number" ? val : Number((val as any)?.count ?? (val as any)?.unread ?? 0);
            if (count > 0) unreadByChannel[String(cid)] = count;
          }
        } else if (channelsMap && typeof channelsMap === "object") {
          for (const [cid, val] of Object.entries(channelsMap)) {
            const count = typeof val === "number" ? val : Number((val as any)?.count ?? (val as any)?.unread ?? 0);
            if (count > 0) unreadByChannel[String(cid)] = count;
          }
        }
      }
    } catch {}

    return {
      connected: relaySnap?.status === "ready",
      activityStatus: String(actSnap?.status || "unavailable"),
      activeTurns: turns,
      byPubkey,
      turnsByPubkey,
      presenceByPubkey,
      unreadByChannel,
    };
  } catch {
    return EMPTY_TELEMETRY;
  }
}

export async function interruptLiveTurn(ctx: Context, turn: LiveAgentTurn): Promise<boolean> {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (session?.agentActivity?.interrupt && turn.agentPubkey && turn.channelId && turn.messageId) {
      await session.agentActivity.interrupt(turn.agentPubkey, turn.channelId, turn.messageId);
      return true;
    }
  } catch {}
  return false;
}

export async function readBuzzMainAgentPubkey(ctx: Context): Promise<string | null> {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (typeof session?.mainAgent?.read === "function") {
      const pk = await session.mainAgent.read();
      return typeof pk === "string" && pk.trim() ? pk.trim().toLowerCase() : null;
    }
  } catch {}
  return null;
}

export interface BuzzCanvasState {
  content: string | null;
  eventId?: string;
  writable: boolean;
}

export interface BuzzCanvasHistoryEntry {
  id: string;
  createdAt: number;
  authorPubkey: string;
  preview: string;
  fullContent?: string;
}

export async function readBuzzChannelCanvas(ctx: Context, channelId: string | null | undefined): Promise<string | null> {
  const detailed = await readBuzzChannelCanvasDetailed(ctx, channelId);
  return detailed.content;
}

export async function readBuzzChannelCanvasDetailed(
  ctx: Context,
  channelId: string | null | undefined,
  opts?: { strong?: boolean }
): Promise<BuzzCanvasState> {
  if (!channelId) return { content: null, writable: false };
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    const writable = Boolean(session?.canvas?.available && typeof session.canvas.save === "function");
    if (session?.canvas?.available && typeof session.canvas.read === "function") {
      const ev = await session.canvas.read(channelId, opts?.strong ? { strong: true } : undefined);
      if (ev && typeof ev.content === "string") {
        return {
          content: ev.content.trim() ? ev.content : null,
          eventId: typeof ev.id === "string" ? ev.id : undefined,
          writable,
        };
      }
    }
    return { content: null, writable };
  } catch {
    return { content: null, writable: false };
  }
}

export async function saveBuzzChannelCanvas(
  ctx: Context,
  channelId: string | null | undefined,
  content: string,
  expectedEventId?: string
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  if (!channelId) return { ok: false, error: "Canal da empresa não configurado." };
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session?.canvas?.available || typeof session.canvas.save !== "function") {
      return { ok: false, error: "API session.canvas.save indisponível no Buzz." };
    }
    const saved = await session.canvas.save(channelId, content, expectedEventId);
    return { ok: true, eventId: typeof saved?.id === "string" ? saved.id : undefined };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function readBuzzChannelCanvasHistory(
  ctx: Context,
  channelId: string | null | undefined
): Promise<BuzzCanvasHistoryEntry[]> {
  if (!channelId) return [];
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session?.canvas?.available || typeof session.canvas.history !== "function") return [];
    const page = await session.canvas.history(channelId);
    // API oficial de @buzz/author retorna { revisions: RelayEvent[], next }
    const entries: any[] = Array.isArray(page?.revisions)
      ? page.revisions
      : Array.isArray(page?.entries)
      ? page.entries
      : Array.isArray(page?.events)
      ? page.events
      : Array.isArray(page)
      ? page
      : [];
    return entries.slice(0, 15).map((ev: any) => {
      const fullContent = String(ev?.content ?? ev?.event?.content ?? "");
      return {
        id: String(ev?.id || ev?.event?.id || ""),
        createdAt: Number(ev?.created_at || ev?.event?.created_at || 0) * 1000,
        authorPubkey: String(ev?.pubkey || ev?.event?.pubkey || "").toLowerCase(),
        preview: fullContent.replace(/\s+/g, " ").slice(0, 140),
        fullContent,
      };
    });
  } catch {
    return [];
  }
}
