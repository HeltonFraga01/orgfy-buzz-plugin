// Despacho oficial de mensagens e wakes no Buzz Desktop com menção NIP-27 real (`nostr:npub1...`)
// + tag `p` em `session.messages.send/reply` + garantia de disparo via `ctx.agents.wake` (zero menção fantasma).

import type { Context } from "@buzz/author";

export interface BuzzMentionTarget {
  agentKey?: string;
  agentName?: string;
  pubkey: string;
}

export interface BuzzDispatchOptions {
  agentKey?: string;
  agentName?: string;
  pubkey?: string;
  /** Menções adicionais (ex.: conselheiros/especialistas) convertidas em `nostr:npub1...` + tag `p`. */
  extraMentions?: BuzzMentionTarget[];
  channelId?: string | null;
  threadRoot?: string | null;
  fallbackChannelId?: string | null;
  preferDm?: boolean;
  /** Quando true (padrão), posta mensagem Kind 9 assinada pelo usuário no chat/DM/thread via session.messages.send/reply. */
  postInChat?: boolean;
  /** Quando true, além de postar no chat com `nostr:npub1...` + tag `p`, dispara `ctx.agents.wake` para garantir ativação imediata. */
  ensureWake?: boolean;
  text: string;
}

export interface BuzzDispatchResult {
  ok: boolean;
  mode?: "chat_message" | "chat_message_and_wake" | "wake" | "wake_fallback";
  channel?: string;
  threadRoot?: string;
  eventId?: string;
  mentionedPubkeys?: string[];
  wokenAgents?: string[];
  missingMembers?: string[];
  chatError?: string;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v.trim());
const isHex64 = (v: unknown): v is string => typeof v === "string" && HEX64_RE.test(v.trim());

function bech32Polymod(values: number[]): number {
  const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= gen[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) {
    ret.push((acc << (toBits - bits)) & maxv);
  }
  return ret;
}

/** Converte pubkey hex (64 chars) para NIP-19 `npub1...` (Bech32 puro, sem dependências externas). */
export function hexToNpub(hexPubkey: string): string | null {
  const clean = String(hexPubkey || "").trim().toLowerCase();
  if (!HEX64_RE.test(clean)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  const words = convertBits(bytes, 8, 5, true);
  const hrp = "npub";
  const polymod = bech32Polymod([...bech32HrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) checksum.push((polymod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...checksum].map((d) => BECH32_CHARSET[d]).join("")}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Substitui `@NomeDoAgente` por `nostr:npub1...` (NIP-27) para renderizar pílula clicável real no Buzz. */
export function formatTextWithNostrMentions(
  rawText: string,
  targets: BuzzMentionTarget[],
  prependPrimaryIfMissing = false
): string {
  let out = rawText;
  for (const t of targets) {
    const npub = hexToNpub(t.pubkey);
    if (!npub) continue;
    const token = `nostr:${npub}`;
    if (t.agentName && t.agentName.trim()) {
      const rx = new RegExp(`@${escapeRegex(t.agentName.trim())}(?=$|[\\s,.;:!?()\\[\\]])`, "gi");
      if (rx.test(out)) {
        out = out.replace(rx, token);
        continue;
      }
    }
    if (prependPrimaryIfMissing && t === targets[0] && !out.includes(token)) {
      out = `${token} ${out}`;
    }
  }
  return out;
}

export async function sendBuzzChatMessageOrWake(
  ctx: Context | any,
  opts: BuzzDispatchOptions
): Promise<BuzzDispatchResult> {
  const rawText = String(opts.text || "").trim();
  if (!rawText) return { ok: false, error: "Mensagem vazia" };

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

  // Consolida alvo principal + menções extras (dedup por pubkey)
  const allTargets: BuzzMentionTarget[] = [];
  const seenPk = new Set<string>();
  const pushTarget = (t: BuzzMentionTarget) => {
    const pk = isHex64(t.pubkey) ? t.pubkey.trim().toLowerCase() : "";
    if (!pk || seenPk.has(pk)) return;
    seenPk.add(pk);
    allTargets.push({ ...t, pubkey: pk });
  };
  if (pkLower) {
    pushTarget({ agentKey: opts.agentKey, agentName: opts.agentName, pubkey: pkLower });
  }
  if (Array.isArray(opts.extraMentions)) {
    for (const m of opts.extraMentions) pushTarget(m);
  }

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
  const formattedText = formatTextWithNostrMentions(rawText, allTargets, !opts.preferDm && allTargets.length > 0);
  const agentsApi = (ctx as any)?.agents;
  const snapAgents: any[] = (() => {
    try {
      return agentsApi?.snapshot?.()?.agents || [];
    } catch {
      return [];
    }
  })();

  const resolveAgentKey = (t: BuzzMentionTarget): string | null => {
    if (t.agentKey) return t.agentKey;
    const found = snapAgents.find(
      (a: any) =>
        (a?.pubkey && String(a.pubkey).toLowerCase() === t.pubkey) ||
        (t.agentName && String(a?.name || "").toLowerCase() === t.agentName.toLowerCase())
    );
    return found?.key ? String(found.key) : null;
  };

  // 1. Caminho oficial visível no chat: session.messages.send / reply com `nostr:npub1...` + tag `p`
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
      const validRoot = isHex64(opts.threadRoot) ? opts.threadRoot.trim().toLowerCase() : undefined;
      const isDm = channelMeta?.channelType === "dm" || channelMeta?.channelType === "solo";
      const members: string[] | null = Array.isArray(channelMeta?.members)
        ? channelMeta.members.map((m: any) => String(m).toLowerCase())
        : null;

      const mentions: string[] = [];
      const missingTargets: BuzzMentionTarget[] = [];
      for (const t of allTargets) {
        if (isDm || !members || members.includes(t.pubkey)) {
          mentions.push(t.pubkey);
        } else {
          missingTargets.push(t);
        }
      }

      let eventId: string | undefined;
      if (validRoot && typeof session.messages.reply === "function") {
        const res = session.messages.reply(resolvedChannel, validRoot, formattedText, mentions);
        if (typeof res === "string") eventId = res;
      } else if (typeof session.messages.send === "function") {
        const res = session.messages.send(resolvedChannel, formattedText, mentions);
        if (typeof res === "string") eventId = res;
      }

      if (eventId !== undefined || typeof session.messages.send === "function") {
        // Garantia anti-menção-fantasma: acorda via ctx.agents.wake qualquer alvo que não estava
        // em channelMeta.members ou quando `ensureWake` foi solicitado explicitamente.
        const targetsToWake = opts.ensureWake ? allTargets : missingTargets;
        const wokenAgents: string[] = [];
        if (typeof agentsApi?.wake === "function" && targetsToWake.length > 0) {
          const wakeRoot = !isDm && isHex64(validRoot || eventId) ? (validRoot || eventId) : undefined;
          for (const t of targetsToWake) {
            const key = resolveAgentKey(t);
            if (!key) continue;
            try {
              await agentsApi.wake(key, {
                channel: resolvedChannel,
                text: formattedText,
                ...(wakeRoot ? { root: wakeRoot } : isDm ? {} : { topLevel: true as const }),
              });
              wokenAgents.push(t.agentName || key);
            } catch {
              // não falha o envio principal se um wake auxiliar falhar
            }
          }
        }
        return {
          ok: true,
          mode: wokenAgents.length > 0 ? "chat_message_and_wake" : "chat_message",
          channel: resolvedChannel,
          threadRoot: validRoot,
          eventId,
          mentionedPubkeys: mentions,
          wokenAgents,
          missingMembers: missingTargets.map((t) => t.agentName || t.pubkey.slice(0, 8)),
        };
      }
    } catch (err: any) {
      chatError = err?.message || String(err);
    }
  }

  // 2. Fallback para ctx.agents.wake (acorda agente diretamente no canal)
  if (typeof agentsApi?.wake === "function") {
    const isDmOrSolo = channelMeta?.channelType === "dm" || channelMeta?.channelType === "solo";
    const validRoot = !isDmOrSolo && isHex64(opts.threadRoot) ? opts.threadRoot.trim().toLowerCase() : undefined;
    const keysToWake = allTargets.length > 0
      ? allTargets.map((t) => ({ key: resolveAgentKey(t), name: t.agentName || t.pubkey.slice(0, 8) })).filter((x) => x.key)
      : opts.agentKey
      ? [{ key: opts.agentKey, name: opts.agentName || opts.agentKey }]
      : [];
    const wokenAgents: string[] = [];
    let lastWakeErr = "";
    for (const target of keysToWake) {
      const payload: any = {
        channel: resolvedChannel,
        text: formattedText,
        ...(validRoot ? { root: validRoot } : isDmOrSolo ? {} : { topLevel: true as const }),
      };
      try {
        await agentsApi.wake(target.key, payload);
        wokenAgents.push(target.name);
      } catch (err: any) {
        lastWakeErr = err?.message || String(err);
      }
    }
    if (wokenAgents.length > 0) {
      return {
        ok: true,
        mode: opts.postInChat === false ? "wake" : "wake_fallback",
        channel: resolvedChannel,
        threadRoot: validRoot,
        wokenAgents,
        ...(chatError ? { chatError } : {}),
      };
    }
    return {
      ok: false,
      channel: resolvedChannel,
      chatError,
      error: lastWakeErr || chatError || "Nenhum agente pôde ser acordado via ctx.agents.wake",
    };
  }

  return {
    ok: false,
    channel: resolvedChannel,
    error: chatError || "session.messages.send e ctx.agents.wake indisponíveis",
  };
}
