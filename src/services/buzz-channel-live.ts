// Serviço nativo para integração de Canais do Buzz (session.channels, session.channelDetails,
// session.memberAdministration, session.unread, session.live e ctx.navigation.open).

import type { Context } from "@buzz/author";

export interface BuzzChannelLiveInfo {
  available: boolean;
  channelId: string;
  name: string;
  description: string;
  visibility: "public" | "private" | "unknown";
  channelType: string;
  viewerRole?: string;
  archived: boolean;
  memberPubkeys: string[];
  memberCount: number;
  labels: string[];
  canEdit: boolean;
  detailsBase?: any;
  unreadCount: number | null;
  attentionCount: number | null;
  liveStatus: string;
  rosterTotalChannels: number;
  lastActivityAt?: number;
}

export function resolveBuzzNavigationScope(ctx: Context): { viewer: string; communityOrigin: string } | null {
  try {
    const navSnap = typeof (ctx as any)?.navigation?.snapshot === "function" ? (ctx as any).navigation.snapshot() : null;
    const navScope = navSnap?.entry?.target?.scope;
    if (navScope?.viewer && navScope?.communityOrigin) {
      return { viewer: String(navScope.viewer), communityOrigin: String(navScope.communityOrigin) };
    }
  } catch {}
  try {
    const relaySnap = typeof (ctx as any)?.relay?.snapshot === "function" ? (ctx as any).relay.snapshot() : null;
    const viewer = relaySnap?.viewer ? String(relaySnap.viewer) : relaySnap?.session?.viewer ? String(relaySnap.session.viewer) : "";
    let communityOrigin = relaySnap?.origin ? String(relaySnap.origin) : "";
    if (!communityOrigin && viewer && typeof relaySnap?.scope === "string" && relaySnap.scope.endsWith(`:${viewer}`)) {
      communityOrigin = relaySnap.scope.slice(0, -(viewer.length + 1));
    }
    if (!communityOrigin && viewer && typeof relaySnap?.session?.scope === "string" && relaySnap.session.scope.endsWith(`:${viewer}`)) {
      communityOrigin = relaySnap.session.scope.slice(0, -(viewer.length + 1));
    }
    if (viewer && communityOrigin) {
      return { viewer, communityOrigin };
    }
  } catch {}
  return null;
}

/** Localiza dinamicamente um canal no Buzz Desktop pelo nome (ex.: "Conselho", "Board") via session.channels.list(). */
export function findBuzzChannelIdByName(ctx: Context, candidateNames: string[]): string | null {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    const listSnap = typeof session?.channels?.list === "function" ? session.channels.list() : null;
    const allChannels: any[] = Array.isArray(listSnap?.channels) ? listSnap.channels : [];
    const normalizedTargets = candidateNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
    if (normalizedTargets.length === 0) return null;
    for (const target of normalizedTargets) {
      const exact = allChannels.find(
        (ch) =>
          ch?.id &&
          ch?.channelType !== "dm" &&
          ch?.channelType !== "solo" &&
          String(ch?.name || "").trim().toLowerCase() === target
      );
      if (exact?.id) return String(exact.id);
    }
    for (const target of normalizedTargets) {
      const partial = allChannels.find(
        (ch) =>
          ch?.id &&
          ch?.channelType !== "dm" &&
          ch?.channelType !== "solo" &&
          String(ch?.name || "").trim().toLowerCase().includes(target)
      );
      if (partial?.id) return String(partial.id);
    }
  } catch {}
  return null;
}

export async function loadBuzzChannelLiveInfo(
  ctx: Context,
  channelId: string | null | undefined
): Promise<BuzzChannelLiveInfo | null> {
  if (!channelId) return null;
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session) return null;

    const listSnap = typeof session.channels?.list === "function" ? session.channels.list() : null;
    const allChannels: any[] = Array.isArray(listSnap?.channels) ? listSnap.channels : [];
    const summary: any =
      (typeof session.channels?.get === "function" ? session.channels.get(channelId) : undefined) ||
      allChannels.find((ch) => String(ch?.id || "") === channelId) ||
      null;

    let details: any = null;
    if (session.channelDetails?.available && typeof session.channelDetails.load === "function") {
      try {
        details = await session.channelDetails.load(channelId);
      } catch {}
    }

    const rawMembers: string[] = Array.isArray(summary?.members)
      ? summary.members
      : Array.isArray(summary?.participants)
      ? summary.participants
      : [];
    const uniqueMembers = Array.from(new Set(rawMembers.map((m) => String(m || "").toLowerCase()).filter(Boolean)));

    let unreadCount: number | null = null;
    let attentionCount: number | null = null;
    try {
      if (typeof session.unread?.snapshot === "function") {
        const uSnap = session.unread.snapshot({ kind: "channel", channelId });
        if (uSnap && typeof uSnap === "object") {
          if (typeof uSnap.observedCount === "number") unreadCount = uSnap.observedCount;
          if (typeof uSnap.attentionCount === "number") attentionCount = uSnap.attentionCount;
        }
      }
    } catch {}

    let liveStatus = "unknown";
    try {
      const lSnap = session.live?.snapshot?.();
      if (lSnap?.status) liveStatus = String(lSnap.status);
    } catch {}

    const visibility: "public" | "private" | "unknown" =
      details?.visibility === "private" || summary?.visibility === "private" || summary?.private === true
        ? "private"
        : details?.visibility === "public" || summary?.visibility === "public"
        ? "public"
        : "unknown";

    return {
      available: Boolean(summary || details),
      channelId,
      name: String(details?.name || summary?.name || "Canal"),
      description: String(details?.description ?? summary?.description ?? ""),
      visibility,
      channelType: String(summary?.channelType || "stream"),
      viewerRole: summary?.viewerRole ? String(summary.viewerRole) : undefined,
      archived: Boolean(summary?.archived),
      memberPubkeys: uniqueMembers,
      memberCount: uniqueMembers.length,
      labels: Array.isArray(details?.labels)
        ? details.labels.map(String)
        : Array.isArray(summary?.labels)
        ? summary.labels.map(String)
        : [],
      canEdit: Boolean(details?.canEdit && session.channelDetails?.available && typeof session.channelDetails.save === "function"),
      detailsBase: details || undefined,
      unreadCount,
      attentionCount,
      liveStatus,
      rosterTotalChannels: allChannels.length,
      lastActivityAt: typeof summary?.lastActivityAt === "number" ? summary.lastActivityAt : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveBuzzChannelDetailsLive(
  ctx: Context,
  detailsBase: any,
  patch: { name?: string; description?: string; visibility?: "public" | "private" }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session?.channelDetails?.available || typeof session.channelDetails.save !== "function") {
      return { ok: false, error: "API session.channelDetails.save indisponível nesta versão do Buzz." };
    }
    if (!detailsBase) {
      return { ok: false, error: "Metadados base do canal ainda não carregados." };
    }
    const draft = {
      name: patch.name !== undefined ? patch.name.trim() : String(detailsBase.name || ""),
      description: patch.description !== undefined ? patch.description.trim() : String(detailsBase.description || ""),
      visibility: patch.visibility || (detailsBase.visibility === "public" ? "public" : "private"),
      ...(detailsBase.joinRole ? { joinRole: detailsBase.joinRole } : {}),
      ...(typeof detailsBase.ttlSeconds === "number" ? { ttlSeconds: detailsBase.ttlSeconds } : {}),
      ...(Array.isArray(detailsBase.labels) ? { labels: detailsBase.labels } : {}),
    };
    await session.channelDetails.save(detailsBase, draft);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function runBuzzChannelDiagnosticAction(
  ctx: Context,
  channelId: string,
  action: "markRead" | "markUnread" | "refresh"
): Promise<{ ok: boolean; message: string }> {
  try {
    const session = (ctx as any)?.relay?.snapshot?.()?.session;
    if (!session) return { ok: false, message: "Sessão do relay Buzz indisponível." };

    if (action === "markRead") {
      if (typeof session.unread?.markChannelRead === "function") {
        await session.unread.markChannelRead(channelId);
        return { ok: true, message: "Canal marcado como lido no Buzz." };
      }
      return { ok: false, message: "markChannelRead indisponível." };
    }

    if (action === "markUnread") {
      if (typeof session.unread?.markUnreadLocal === "function") {
        await session.unread.markUnreadLocal({ kind: "channel", channelId });
        return { ok: true, message: "Canal marcado como não lido." };
      }
      return { ok: false, message: "markUnreadLocal indisponível." };
    }

    if (typeof session.channels?.refreshList === "function") {
      session.channels.refreshList();
    }
    if (typeof session.channels?.refreshRoster === "function") {
      await session.channels.refreshRoster(channelId).catch(() => {});
    }
    if (typeof session.channels?.refresh === "function") {
      session.channels.refresh(channelId);
    }
    return { ok: true, message: "Lista de canais e roster atualizados via Buzz relay." };
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export async function navigateToBuzzChannel(
  ctx: Context,
  channelId: string,
  options?: { panel?: "members"; preferFullPage?: boolean; sideTabOpener?: ((target: { channelId: string }, opts?: { keep?: boolean }) => boolean) | null }
): Promise<{ ok: boolean; mode: "navigation" | "sidetab" | "none" }> {
  if (!channelId) return { ok: false, mode: "none" };
  const scope = resolveBuzzNavigationScope(ctx);

  // Se o usuário pediu explicitamente abrir o canal/canvas na página do Buzz, prioriza ctx.navigation.open
  if (options?.preferFullPage && scope && typeof (ctx as any)?.navigation?.open === "function") {
    try {
      const target: any = {
        version: 1,
        kind: "conversation",
        scope,
        channelId,
      };
      if (options.panel) target.panel = options.panel;
      const res = await (ctx as any).navigation.open(target);
      if (!res || res.status === "opened") {
        return { ok: true, mode: "navigation" };
      }
    } catch {}
  }

  // Caso contrário (ou fallback), tenta abrir no painel lateral nativo (ctx.conversation.ui.Tabs)
  if (options?.sideTabOpener) {
    try {
      const opened = options.sideTabOpener({ channelId }, { keep: true });
      if (opened) return { ok: true, mode: "sidetab" };
    } catch {}
  }

  // Fallback final para ctx.navigation.open
  if (scope && typeof (ctx as any)?.navigation?.open === "function") {
    try {
      const target: any = {
        version: 1,
        kind: "conversation",
        scope,
        channelId,
      };
      if (options?.panel) target.panel = options.panel;
      const res = await (ctx as any).navigation.open(target);
      if (!res || res.status === "opened") {
        return { ok: true, mode: "navigation" };
      }
    } catch {}
  }

  return { ok: false, mode: "none" };
}
