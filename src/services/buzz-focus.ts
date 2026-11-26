// ─────────────────────────────────────────────────────────────────────────────
// BUZZ FOCUS MODE INTEGRATION (Onda 3 · v17.7)
// Lê o estado nativo do modo Focus do Buzz Desktop (`buzz-focus.v1` em
// buzz-app/src/bundled/focus/state.ts), silencia notificações não críticas
// enquanto o Fundador está em foco e enfileira um digest discreto.
// ─────────────────────────────────────────────────────────────────────────────

export const BUZZ_FOCUS_STORAGE_KEY = "buzz-focus.v1";

export interface BuzzFocusState {
  active: boolean;
  untilUnixSec?: number;
  untilFormatted?: string;
}

export interface QueuedFocusNotice {
  id: string;
  title: string;
  body: string;
  at: string;
  priority: "info" | "normal" | "critical";
}

const queuedNotices: QueuedFocusNotice[] = [];

export function readBuzzFocusState(nowMs = Date.now(), storage?: Storage): BuzzFocusState {
  try {
    const store = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    const raw = store?.getItem?.(BUZZ_FOCUS_STORAGE_KEY);
    if (!raw) return { active: false };
    const parsed = JSON.parse(raw);
    const until = Number(parsed?.until);
    const nowSec = Math.floor(nowMs / 1000);
    if (Number.isSafeInteger(until) && until > nowSec) {
      const d = new Date(until * 1000);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return {
        active: true,
        untilUnixSec: until,
        untilFormatted: `${hh}:${mm}`,
      };
    }
  } catch {}
  return { active: false };
}

export function subscribeBuzzFocus(listener: (state: BuzzFocusState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (ev: StorageEvent) => {
    if (!ev.key || ev.key === BUZZ_FOCUS_STORAGE_KEY) {
      listener(readBuzzFocusState());
    }
  };
  window.addEventListener("storage", onStorage);
  const timer = window.setInterval(() => listener(readBuzzFocusState()), 30_000);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.clearInterval(timer);
  };
}

export function getDeferredFocusNotices(): QueuedFocusNotice[] {
  return [...queuedNotices];
}

export function clearDeferredFocusNotices(): void {
  queuedNotices.length = 0;
}

/**
 * Envia notificação nativa via `ctx.notifications.notify` respeitando o modo Focus:
 * - Quando Focus está inativo: envia normalmente.
 * - Quando Focus está ativo e `priority !== "critical"`: silencia e enfileira no digest.
 * - Quando `priority === "critical"` (ex.: Kill Switch / P0): atravessa o Focus.
 */
export function notifyRespectingFocus(
  ctx: any,
  payload: { title: string; body: string },
  options?: { priority?: "info" | "normal" | "critical"; storage?: Storage; nowMs?: number }
): { delivered: boolean; deferredByFocus: boolean } {
  const priority = options?.priority || "normal";
  const focus = readBuzzFocusState(options?.nowMs, options?.storage);

  if (focus.active && priority !== "critical") {
    queuedNotices.unshift({
      id: `fn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      title: payload.title,
      body: payload.body,
      at: new Date(options?.nowMs ?? Date.now()).toISOString(),
      priority,
    });
    if (queuedNotices.length > 30) queuedNotices.length = 30;
    return { delivered: false, deferredByFocus: true };
  }

  try {
    if (ctx?.notifications?.notify) {
      ctx.notifications.notify(payload);
      return { delivered: true, deferredByFocus: false };
    }
  } catch {}
  return { delivered: false, deferredByFocus: false };
}
