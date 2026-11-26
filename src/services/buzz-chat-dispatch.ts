// Despacho oficial de mensagens e wakes no Buzz Desktop.
// Segue o padrão verificado em buzz-app/src/bundled/github/ResolvePull.tsx (session.messages.send / reply)
// com fallback seguro para ctx.agents.wake ({ channel, root?, topLevel?, text }).

import type { Context } from "@buzz/author";

export interface BuzzDispatchOptions {
  agentKey?: string;
  agentName?: string;
  pubkey?: string;
  channelId?: string | null;
  threadRoot?: string | null;
  fallbackChannelId?: string | null;
  preferDm?: boolean;
  /** Quando true (padrão), posta mensagem Kind 9 assinada pelo usuário no chat/DM/thread via session.messages.send/reply (visível no chat e acorda o agente como menção do dono). */
  postInChat?: boolean;
  text: string;
}

export interface BuzzDispatchResult {
  ok: boolean;
  mode?: "chat_message" | "wake" | "wake_fallback";
  channel?: string;
  threadRoot?: string;
  eventId?: string;
  chatError?: string;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v.trim());
const isHex64 = (v: unknown): v is string => typeof v === "string" && HEX64_RE.test(v.trim());

export async function sendBuzzChatMessageOrWake(
  ctx: Context | any,
  opts: BuzzDispatchOptions
): Promise<BuzzDispatchResult> {
  const text = String(opts.text || "").trim();
  if (!text) return { ok: false, error: "Mensagem vazia" };

  const session = (ctx as any)?.relay?.snapshot?.()?.session;
  const channelsList: any[] = (() => {
    try {
      return session?.channels?.list?.()?.channels || [];
    } catch {
      return [];
    }
  })();

  const pkLower = isHex64(opts.pubkey) ? opts.pubkey.trim().toLowerCase() : "";
  const nameLower = (opts.agentName || "").trim().toLowerCase();

  const findDmChannelId = async (): Promise<string | null> => {
    const existing = channelsList.find((ch: any) => {
      if (ch?.channelType !== "dm" && ch?.channelType !== "solo") return false;
      if (pkLower) {
        const members = [...(ch.participants || []), ...(ch.members || [])];
        if (members.some((m: string) => String(m).toLowerCase() === pkLower)) return true;
      }
      return Boolean(nameLower && typeof ch?.name === "string" && ch.name.toLowerCase().includes(nameLower));
    });
    if (existing?.id) return String(existing.id);
    if (pkLower && session?.directMessages?.available && typeof session.directMessages.open === "function") {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 6000);
      try {
        const opened = await session.directMessages.open([pkLower], ac.signal);
        if (opened) return String(opened);
      } catch {
        // segue para fallback
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  };

  let resolvedChannel: string | null = isUuid(opts.channelId) ? opts.channelId.trim() : null;
  if (!resolvedChannel && opts.preferDm) {
    resolvedChannel = await findDmChannelId();
  }
  if (!resolvedChannel && isUuid(opts.fallbackChannelId)) {
    resolvedChannel = opts.fallbackChannelId.trim();
  }
  if (!resolvedChannel) {
    resolvedChannel = await findDmChannelId();
  }
  if (!resolvedChannel) {
    return { ok: false, error: "Nenhum canal/DM válido encontrado no Buzz para enviar a mensagem" };
  }

  let channelMeta = channelsList.find((ch: any) => String(ch?.id || "") === resolvedChannel) || null;
  let chatError: string | undefined;

  // 1. Caminho oficial visível no chat (ResolvePull.tsx): session.messages.send / reply
  if (opts.postInChat !== false && session?.messages) {
    try {
      if (typeof session.channelWrites?.refreshMembership === "function") {
        try {
          const fresh = await session.channelWrites.refreshMembership(resolvedChannel);
          if (fresh) channelMeta = fresh;
        } catch {
          // usa channelMeta já carregado
        }
      }
      const isDmOrSolo = channelMeta?.channelType === "dm" || channelMeta?.channelType === "solo";
      const validRoot = !isDmOrSolo && isHex64(opts.threadRoot) ? opts.threadRoot.trim().toLowerCase() : undefined;

      // Valida menções conforme session.ts validateMentions (em DM 1:1 withDmAgents já inclui o agente automaticamente)
      let mentions: string[] = [];
      if (pkLower) {
        const members: string[] | null = Array.isArray(channelMeta?.members)
          ? channelMeta.members.map((m: any) => String(m).toLowerCase())
          : null;
        if (!members || members.includes(pkLower)) {
          mentions = [pkLower];
        } else if (channelMeta?.channelType !== "dm") {
          mentions = [];
        }
      }

      if (validRoot && typeof session.messages.reply === "function") {
        const eventId = session.messages.reply(resolvedChannel, validRoot, text, mentions);
        return {
          ok: true,
          mode: "chat_message",
          channel: resolvedChannel,
          threadRoot: validRoot,
          eventId: typeof eventId === "string" ? eventId : undefined,
        };
      }
      if (typeof session.messages.send === "function") {
        const eventId = session.messages.send(resolvedChannel, text, mentions);
        return {
          ok: true,
          mode: "chat_message",
          channel: resolvedChannel,
          eventId: typeof eventId === "string" ? eventId : undefined,
        };
      }
    } catch (err: any) {
      chatError = err?.message || String(err);
    }
  }

  // 2. Fallback para ctx.agents.wake (acorda agente sem postar mensagem visível)
  const agentsApi = (ctx as any)?.agents;
  if (typeof agentsApi?.wake === "function" && opts.agentKey) {
    const isDmOrSolo = channelMeta?.channelType === "dm" || channelMeta?.channelType === "solo";
    const validRoot = !isDmOrSolo && isHex64(opts.threadRoot) ? opts.threadRoot.trim().toLowerCase() : undefined;
    const payload: any = {
      channel: resolvedChannel,
      text,
      ...(validRoot ? { root: validRoot } : isDmOrSolo ? {} : { topLevel: true as const }),
    };
    try {
      await agentsApi.wake(opts.agentKey, payload);
      return {
        ok: true,
        mode: opts.postInChat === false ? "wake" : "wake_fallback",
        channel: resolvedChannel,
        threadRoot: validRoot,
        ...(chatError ? { chatError } : {}),
      };
    } catch (err: any) {
      return {
        ok: false,
        channel: resolvedChannel,
        chatError,
        error: err?.message || String(err),
      };
    }
  }

  return {
    ok: false,
    channel: resolvedChannel,
    error: chatError || "session.messages.send e ctx.agents.wake indisponíveis",
  };
}
