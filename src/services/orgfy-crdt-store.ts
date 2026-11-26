// ─────────────────────────────────────────────────────────────────────────────
// ORGFY CRDT & ARTIFACT STORAGE SYNC STORE (Onda 3 · v17.7)
// Sincronização multi-dispositivo via API oficial do Buzz Desktop:
//   ctx.artifactStorage.open(ArtifactCollectionDefinition)
// com fallback transparente para localStorage/memória quando fora de uma
// comunidade/relay ativa ou em ambiente headless de testes.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";

export type OrgfyCrdtRecordKind =
  | "question_card"
  | "visual_evidence"
  | "council_decision"
  | "distributed_lock"
  | "control_sync"
  | "automation_sync";

export interface QuestionCardOption {
  id: string;
  label: string;
  description?: string;
}

export interface QuestionCardAnswer {
  selectedIds: string[];
  freeText?: string;
  answeredBy?: string;
}

export interface OrgfyQuestionCard {
  id: string;
  kind: "question_card";
  tenant: string;
  title: string;
  question: string;
  requestedBy: string;
  requestedByPubkey?: string;
  channelId?: string;
  threadRoot?: string;
  options: QuestionCardOption[];
  selectionMode: "single" | "multi";
  allowFreeText: boolean;
  status: "pending" | "answered" | "dismissed" | "expired";
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  answeredAt?: string;
  answer?: QuestionCardAnswer;
}

export interface OrgfyVisualEvidence {
  id: string;
  kind: "visual_evidence";
  tenant: string;
  itemId: string;
  url: string;
  note: string;
  verdict: "approved" | "changes_requested";
  createdAt: string;
  updatedAt: string;
}

export interface OrgfyCouncilDeliberation {
  id: string;
  kind: "council_decision";
  tenant: string;
  title: string;
  summary: string;
  proposedBy: string;
  status: "pendente" | "aprovada" | "recusada";
  decidedBy?: string;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
}

export interface OrgfyDistributedLock {
  id: string;
  kind: "distributed_lock";
  tenant: string;
  resourceKey: string;
  owner: string;
  reason?: string;
  status: "active" | "released";
  acquiredAt: string;
  expiresAt: string;
  updatedAt: string;
}

export interface OrgfySyncedDocument {
  id: string;
  kind: "council_decision" | "control_sync" | "automation_sync";
  tenant: string;
  payload: Record<string, any>;
  updatedAt: string;
}

export type OrgfyCrdtRecord =
  | OrgfyQuestionCard
  | OrgfyVisualEvidence
  | OrgfyCouncilDeliberation
  | OrgfyDistributedLock
  | OrgfySyncedDocument;

export interface CrdtBackendInfo {
  mode: "buzz_artifact_collection" | "local_fallback";
  collectionName: string;
  scope?: { viewer: string; relay: string; partition: string };
}

const COLLECTION_NAME = "orgfy_factory_state_v1";
const COLLECTION_TYPE = "orgfy.factory.state";
const LOCAL_STORAGE_KEY = "orgfy_crdt_state_v17_7";

function extractRecordFromEntry(entry: any): OrgfyCrdtRecord | null {
  if (!entry) return null;
  // Preferência mutável sempre vence o snapshot inicial local (last-write-wins por updatedAt)
  const pref = entry.preference;
  const local = entry.record?.local;
  const candidate = pref && typeof pref === "object" && pref.id ? pref : local && typeof local === "object" && local.id ? local : null;
  if (!candidate) {
    // Tenta ler revision.content caso tenha chegado sincronizado via relay
    const revContent = entry.record?.current?.content;
    if (typeof revContent === "string" && revContent.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(revContent);
        if (parsed && typeof parsed === "object" && parsed.id && parsed.kind) return parsed as OrgfyCrdtRecord;
      } catch {}
    }
    return null;
  }
  return candidate as OrgfyCrdtRecord;
}

function readLocalFallbackMap(): Map<string, OrgfyCrdtRecord> {
  const map = new Map<string, OrgfyCrdtRecord>();
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v === "object" && (v as any).id) {
              map.set(k, v as OrgfyCrdtRecord);
            }
          }
        }
      }
    }
  } catch {}
  return map;
}

function writeLocalFallbackMap(map: Map<string, OrgfyCrdtRecord>): void {
  try {
    if (typeof localStorage !== "undefined") {
      const obj: Record<string, OrgfyCrdtRecord> = {};
      for (const [k, v] of map.entries()) obj[k] = v;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
    }
  } catch {}
}

export class OrgfyCrdtStore {
  private collection: any | null = null;
  private mode: "buzz_artifact_collection" | "local_fallback" = "local_fallback";
  private memoryMap: Map<string, OrgfyCrdtRecord>;
  private listeners = new Set<() => void>();
  private unsubCollection: (() => void) | null = null;
  private unsubChanges: (() => void) | null = null;

  constructor(private readonly ctx: Context | any) {
    this.memoryMap = readLocalFallbackMap();
    this.tryOpenCollection();
  }

  private tryOpenCollection(): void {
    if (this.collection) return;
    const storage = (this.ctx as any)?.artifactStorage || (this.ctx as any)?.reflect?.get?.("artifactStorage");
    if (!storage || typeof storage.open !== "function") {
      this.mode = "local_fallback";
      return;
    }
    try {
      const col = storage.open({
        name: COLLECTION_NAME,
        type: COLLECTION_TYPE,
        version: 1,
        project: (entry: any) => {
          const rec = extractRecordFromEntry(entry);
          if (!rec) return [];
          const order = String(rec.updatedAt || "1970-01-01T00:00:00.000Z");
          return [
            { index: "all", value: "1", order },
            { index: "kind", value: rec.kind, order },
            { index: "tenant", value: rec.tenant || "orgfy", order },
          ];
        },
      });
      this.collection = col;
      this.mode = "buzz_artifact_collection";
      if (typeof col.subscribe === "function") {
        this.unsubCollection = col.subscribe(() => this.notify());
      }
      if (typeof col.subscribeChanges === "function") {
        this.unsubChanges = col.subscribeChanges(() => this.notify());
      }
    } catch {
      this.collection = null;
      this.mode = "local_fallback";
    }
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {}
    }
  }

  getBackendInfo(): CrdtBackendInfo {
    this.tryOpenCollection();
    return {
      mode: this.mode,
      collectionName: COLLECTION_NAME,
      scope: this.collection?.scope,
    };
  }

  subscribe(listener: () => void): () => void {
    this.tryOpenCollection();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async putRecord(record: OrgfyCrdtRecord): Promise<OrgfyCrdtRecord> {
    this.tryOpenCollection();
    this.memoryMap.set(record.id, record);
    writeLocalFallbackMap(this.memoryMap);

    if (this.collection) {
      try {
        const existing = await this.collection.get(record.id);
        if (!existing && typeof this.collection.importBatch === "function") {
          await this.collection.importBatch({
            records: [{ id: record.id, local: record }],
            preferences: [{ id: record.id, value: record }],
          });
        } else if (this.collection.preferences?.update) {
          await this.collection.preferences.update(record.id, () => record);
        }
      } catch {
        // Escopo pode ter mudado; reabre na próxima chamada e mantém cache local íntegro
        this.collection = null;
        this.mode = "local_fallback";
      }
    }
    this.notify();
    return record;
  }

  async getRecord(id: string): Promise<OrgfyCrdtRecord | null> {
    this.tryOpenCollection();
    if (this.collection) {
      try {
        const entry = await this.collection.get(id);
        const extracted = extractRecordFromEntry(entry);
        if (extracted) {
          this.memoryMap.set(id, extracted);
          return extracted;
        }
      } catch {}
    }
    return this.memoryMap.get(id) || null;
  }

  async listByKind<T extends OrgfyCrdtRecord>(kind: OrgfyCrdtRecordKind, tenant?: string): Promise<T[]> {
    this.tryOpenCollection();
    const merged = new Map<string, OrgfyCrdtRecord>();
    for (const [id, rec] of this.memoryMap.entries()) {
      if (rec.kind === kind) merged.set(id, rec);
    }
    if (this.collection && typeof this.collection.page === "function") {
      try {
        const page = await this.collection.page({ index: "kind", value: kind, limit: 200 });
        for (const entry of page?.entries || []) {
          const rec = extractRecordFromEntry(entry);
          if (rec && rec.kind === kind) {
            const cur = merged.get(rec.id);
            if (!cur || String(rec.updatedAt || "") >= String(cur.updatedAt || "")) {
              merged.set(rec.id, rec);
              this.memoryMap.set(rec.id, rec);
            }
          }
        }
      } catch {}
    }
    const list = Array.from(merged.values()).filter((r) => !tenant || tenant === "all" || r.tenant === tenant);
    list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return list as T[];
  }

  async createQuestionCard(input: {
    id?: string;
    tenant?: string;
    title: string;
    question: string;
    requestedBy: string;
    requestedByPubkey?: string;
    channelId?: string;
    threadRoot?: string;
    options?: Array<{ id?: string; label: string; description?: string }>;
    selectionMode?: "single" | "multi";
    allowFreeText?: boolean;
    timeoutMinutes?: number;
  }): Promise<OrgfyQuestionCard> {
    const now = new Date();
    const nowIso = now.toISOString();
    const id = input.id || `qcard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const normalizedOptions: QuestionCardOption[] = (input.options || []).map((opt, idx) => ({
      id: String(opt.id || `opt_${idx + 1}`).trim(),
      label: String(opt.label || "").trim(),
      description: opt.description ? String(opt.description).trim() : undefined,
    })).filter((o) => o.label.length > 0);

    const expiresAt =
      typeof input.timeoutMinutes === "number" && input.timeoutMinutes > 0
        ? new Date(now.getTime() + input.timeoutMinutes * 60_000).toISOString()
        : undefined;

    const card: OrgfyQuestionCard = {
      id,
      kind: "question_card",
      tenant: String(input.tenant || "orgfy").trim() || "orgfy",
      title: String(input.title || "Decisão solicitada pelo agente").trim(),
      question: String(input.question || "").trim(),
      requestedBy: String(input.requestedBy || "OrgFy Bento").trim(),
      requestedByPubkey: input.requestedByPubkey ? String(input.requestedByPubkey).trim() : undefined,
      channelId: input.channelId ? String(input.channelId).trim() : undefined,
      threadRoot: input.threadRoot ? String(input.threadRoot).trim() : undefined,
      options: normalizedOptions,
      selectionMode: input.selectionMode === "multi" ? "multi" : "single",
      allowFreeText: input.allowFreeText !== false,
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt,
    };
    await this.putRecord(card);
    return card;
  }

  async listQuestionCards(tenant?: string): Promise<OrgfyQuestionCard[]> {
    const cards = await this.listByKind<OrgfyQuestionCard>("question_card", tenant);
    const nowMs = Date.now();
    return cards.map((c) => {
      if (c.status === "pending" && c.expiresAt) {
        const expMs = Date.parse(c.expiresAt);
        if (Number.isFinite(expMs) && expMs < nowMs) {
          return { ...c, status: "expired" as const };
        }
      }
      return c;
    });
  }

  async answerQuestionCard(id: string, answer: QuestionCardAnswer): Promise<OrgfyQuestionCard | null> {
    const existing = await this.getRecord(id);
    if (!existing || existing.kind !== "question_card") return null;
    const nowIso = new Date().toISOString();
    const updated: OrgfyQuestionCard = {
      ...existing,
      status: "answered",
      answeredAt: nowIso,
      updatedAt: nowIso,
      answer: {
        selectedIds: Array.isArray(answer.selectedIds) ? answer.selectedIds : [],
        freeText: answer.freeText ? String(answer.freeText).trim() : undefined,
        answeredBy: answer.answeredBy || "Fundador",
      },
    };
    await this.putRecord(updated);
    return updated;
  }

  async dismissQuestionCard(id: string): Promise<OrgfyQuestionCard | null> {
    const existing = await this.getRecord(id);
    if (!existing || existing.kind !== "question_card") return null;
    const nowIso = new Date().toISOString();
    const updated: OrgfyQuestionCard = {
      ...existing,
      status: "dismissed",
      updatedAt: nowIso,
    };
    await this.putRecord(updated);
    return updated;
  }

  async recordVisualEvidence(input: {
    tenant: string;
    itemId: string;
    url: string;
    note: string;
    verdict: "approved" | "changes_requested";
  }): Promise<OrgfyVisualEvidence> {
    const nowIso = new Date().toISOString();
    const rec: OrgfyVisualEvidence = {
      id: `vev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "visual_evidence",
      tenant: input.tenant || "orgfy",
      itemId: input.itemId,
      url: input.url.trim(),
      note: input.note.trim(),
      verdict: input.verdict,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.putRecord(rec);
    return rec;
  }

  async listVisualEvidence(tenant?: string, itemId?: string): Promise<OrgfyVisualEvidence[]> {
    const list = await this.listByKind<OrgfyVisualEvidence>("visual_evidence", tenant);
    return itemId ? list.filter((v) => v.itemId === itemId) : list;
  }

  // ── Deliberações do Conselho (CRDT Sync · Onda 3 v17.7) ──
  async createCouncilDeliberation(input: {
    tenant?: string;
    title: string;
    summary: string;
    proposedBy?: string;
  }): Promise<OrgfyCouncilDeliberation> {
    const nowIso = new Date().toISOString();
    const rec: OrgfyCouncilDeliberation = {
      id: `cdel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "council_decision",
      tenant: String(input.tenant || "orgfy").trim() || "orgfy",
      title: String(input.title || "Deliberação do Conselho").trim(),
      summary: String(input.summary || "").trim(),
      proposedBy: String(input.proposedBy || "Fundador").trim(),
      status: "pendente",
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.putRecord(rec);
    return rec;
  }

  async voteCouncilDeliberation(
    id: string,
    decision: "aprovada" | "recusada",
    decidedBy = "Fundador",
    note?: string
  ): Promise<OrgfyCouncilDeliberation | null> {
    const existing = await this.getRecord(id);
    if (!existing || existing.kind !== "council_decision" || !("title" in existing)) return null;
    const nowIso = new Date().toISOString();
    const updated: OrgfyCouncilDeliberation = {
      ...existing,
      status: decision,
      decidedBy,
      decisionNote: note ? String(note).trim() : undefined,
      decidedAt: nowIso,
      updatedAt: nowIso,
    };
    await this.putRecord(updated);
    return updated;
  }

  async listCouncilDeliberations(tenant?: string): Promise<OrgfyCouncilDeliberation[]> {
    const raw = await this.listByKind<any>("council_decision", tenant);
    return raw.filter((r) => r && typeof r.title === "string") as OrgfyCouncilDeliberation[];
  }

  // ── Locks Distribuídos (CRDT Sync · Onda 3 v17.7) ──
  async acquireDistributedLock(input: {
    tenant?: string;
    resourceKey: string;
    owner: string;
    reason?: string;
    ttlMinutes?: number;
  }): Promise<OrgfyDistributedLock> {
    const now = new Date();
    const nowIso = now.toISOString();
    const ttlMs = Math.max(1, Number(input.ttlMinutes || 30)) * 60_000;
    const safeKey = String(input.resourceKey || "default").trim().replace(/[^a-zA-Z0-9:_-]+/g, "_");
    const rec: OrgfyDistributedLock = {
      id: `lock:${input.tenant || "orgfy"}:${safeKey}`,
      kind: "distributed_lock",
      tenant: String(input.tenant || "orgfy").trim() || "orgfy",
      resourceKey: String(input.resourceKey || "default").trim(),
      owner: String(input.owner || "OrgFy").trim(),
      reason: input.reason ? String(input.reason).trim() : undefined,
      status: "active",
      acquiredAt: nowIso,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      updatedAt: nowIso,
    };
    await this.putRecord(rec);
    return rec;
  }

  async releaseDistributedLock(id: string): Promise<OrgfyDistributedLock | null> {
    const existing = await this.getRecord(id);
    if (!existing || existing.kind !== "distributed_lock") return null;
    const updated: OrgfyDistributedLock = {
      ...existing,
      status: "released",
      updatedAt: new Date().toISOString(),
    };
    await this.putRecord(updated);
    return updated;
  }

  async listDistributedLocks(tenant?: string, onlyActive = true): Promise<OrgfyDistributedLock[]> {
    const all = await this.listByKind<OrgfyDistributedLock>("distributed_lock", tenant);
    const nowMs = Date.now();
    return all.filter((l) => {
      if (!onlyActive) return true;
      if (l.status !== "active") return false;
      const exp = Date.parse(l.expiresAt || "");
      return !Number.isFinite(exp) || exp > nowMs;
    });
  }

  async syncDocument(
    kind: "council_decision" | "control_sync" | "automation_sync",
    id: string,
    tenant: string,
    payload: Record<string, any>
  ): Promise<OrgfySyncedDocument> {
    const rec: OrgfySyncedDocument = {
      id,
      kind,
      tenant: tenant || "orgfy",
      payload,
      updatedAt: new Date().toISOString(),
    };
    await this.putRecord(rec);
    return rec;
  }

  async listDocuments(
    kind: "council_decision" | "control_sync" | "automation_sync",
    tenant?: string
  ): Promise<OrgfySyncedDocument[]> {
    return this.listByKind<OrgfySyncedDocument>(kind, tenant);
  }

  close(): void {
    try {
      this.unsubCollection?.();
      this.unsubChanges?.();
      this.collection?.close?.();
    } catch {}
    this.unsubCollection = null;
    this.unsubChanges = null;
    this.collection = null;
    this.listeners.clear();
  }
}

const storeCache = new WeakMap<object, OrgfyCrdtStore>();
let fallbackSingleton: OrgfyCrdtStore | null = null;

export function getOrgfyCrdtStore(ctx: Context | any): OrgfyCrdtStore {
  if (ctx && typeof ctx === "object") {
    let store = storeCache.get(ctx);
    if (!store) {
      store = new OrgfyCrdtStore(ctx);
      storeCache.set(ctx, store);
    }
    return store;
  }
  if (!fallbackSingleton) fallbackSingleton = new OrgfyCrdtStore(null);
  return fallbackSingleton;
}
