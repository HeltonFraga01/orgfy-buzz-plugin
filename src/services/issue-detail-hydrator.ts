import type { Context } from "@buzz/author";
import type { PipelineCard } from "../types/orgfy";

export interface HydratedProbeItem {
  label: string;
  status: "PASS" | "FAIL" | "PENDENTE" | "NA";
  detail?: string;
}

export interface HydratedTransitionItem {
  ts: string;
  de: string;
  para: string;
  autor: string;
  detalhe: string;
}

export interface HydratedIssueDetail {
  loadedAt: string;
  cardFileFound: string | null;
  objetivo: string | null;
  contexto: string | null;
  autoridade: string | null;
  decisao: string | null;
  escritaExclusiva: string[];
  feitoQuando: string | null;
  provaExigida: string | null;
  acceptanceCommand: string | null;
  acceptanceHash: string | null;
  acceptanceFrozenValid: boolean;
  modoBuzz: string | null;
  goalMaxTurns: string | null;
  maxRuntime: string | null;
  worktreePath: string | null;
  branch: string | null;
  lockActive: boolean;
  lockAgent: string | null;
  lockExpiresInMin: number | null;
  executorProvider: string | null;
  executorModel: string | null;
  probes: HydratedProbeItem[];
  probesSource: string;
  transitions: HydratedTransitionItem[];
  rejectionsCount: number;
}

const ORGFY_REPO_ROOT = "/Users/heltonfraga/.buzz/REPOS/orgfy";
const SCRATCH_ROOT = "/Users/heltonfraga/.buzz/.scratch";
const BUZZ_AGENTS_DIR =
  "/Users/heltonfraga/Library/Application Support/xyz.block.buzz.desktop/agents";

function decodeBytes(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
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

async function safeReadText(ctx: Context, filePath: string): Promise<string | null> {
  const host = (ctx as any).host;
  if (!host?.readFile) return null;
  try {
    const raw = await host.readFile(filePath);
    return decodeBytes(raw);
  } catch {
    return null;
  }
}

async function safeReadJson<T>(ctx: Context, filePath: string): Promise<T | null> {
  const txt = await safeReadText(ctx, filePath);
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function extractField(md: string, label: string): string | null {
  const rx = new RegExp(`^(?:-\\s+)?\\*\\*${label}:\\*\\*\\s*(.+)$`, "im");
  const m = md.match(rx);
  return m?.[1]?.trim() || null;
}

function extractSection(md: string, heading: string): string | null {
  const rx = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "is");
  const m = md.match(rx);
  if (!m?.[1]) return null;
  const cleaned = m[1]
    .replace(/^\*\*[^*]+:\*\*\s*/i, "")
    .trim();
  return cleaned || null;
}

function inferCardSlugCandidates(card: PipelineCard): string[] {
  const candidates: string[] = [];
  const title = String(card.title || "").trim();
  const mSlug = title.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)+)/);
  if (mSlug?.[1]) {
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

export async function hydrateIssueDetail(
  ctx: Context,
  card: PipelineCard
): Promise<HydratedIssueDetail> {
  const fullId = String(card.fullIssueId || card.issueId || "").trim();
  const shortId = fullId.slice(0, 8).toLowerCase();
  const empresa = String(card.empresa || "orgfy").trim().toLowerCase();

  // 1. Tentar ler cards/<SLUG>.md real em disco
  let cardMd: string | null = null;
  let cardFileFound: string | null = null;
  for (const slug of inferCardSlugCandidates(card)) {
    const path = `${ORGFY_REPO_ROOT}/cards/${slug}.md`;
    const txt = await safeReadText(ctx, path);
    if (txt) {
      cardMd = txt;
      cardFileFound = `cards/${slug}.md`;
      break;
    }
  }

  // 2. Leituras paralelas de aceite real, locks, manifesto da empresa, identidades e transições
  const [aceiteFile, esteiraState, locksData, empresaManifest, identitiesData, transicoesTxt] =
    await Promise.all([
      fullId
        ? safeReadJson<any>(ctx, `${ORGFY_REPO_ROOT}/.esteira/estado/aceites/${fullId}.json`)
        : Promise.resolve(null),
      safeReadJson<any>(ctx, `${ORGFY_REPO_ROOT}/.esteira/estado/esteira-minima-state.json`),
      safeReadJson<Record<string, any>>(ctx, `${SCRATCH_ROOT}/orgfy-locks.json`),
      safeReadJson<any>(ctx, `${ORGFY_REPO_ROOT}/empresas/${empresa}.json`),
      safeReadJson<any>(ctx, `${BUZZ_AGENTS_DIR}/identities.json`),
      safeReadText(ctx, `${SCRATCH_ROOT}/esteira-transicoes.jsonl`),
    ]);

  // Aceite L-22 real (sem hash sintético)
  const stateAceite =
    esteiraState?.aceites?.[fullId] ||
    esteiraState?.aceites?.[shortId] ||
    null;
  const realHash =
    String(
      aceiteFile?.hash ||
        aceiteFile?.sha256 ||
        stateAceite?.hash ||
        stateAceite?.sha256 ||
        card.acceptanceHash ||
        ""
    ).trim() || null;
  const realAcceptCmd =
    String(
      aceiteFile?.comando ||
        stateAceite?.comando ||
        card.acceptanceCommand ||
        ""
    ).trim() || null;

  // Lock real em orgfy-locks.json
  const nowMs = Date.now();
  const lockRec =
    locksData?.[fullId] ||
    (locksData
      ? Object.values(locksData).find(
          (v: any) => v && String(v.issueId || "").toLowerCase().startsWith(shortId)
        )
      : null);
  const lockActive = Boolean(lockRec && typeof lockRec.expiresAt === "number" && lockRec.expiresAt > nowMs);
  const lockExpiresInMin = lockActive ? Math.max(1, Math.round((lockRec.expiresAt - nowMs) / 60000)) : null;

  // Modelo real do executor no Buzz Desktop (agents/state/buzz.agent.v1%3A<pubkey>)
  let executorProvider: string | null = null;
  let executorModel: string | null = null;
  const execName = String(card.executor || lockRec?.agentKey || "").trim();
  if (execName && identitiesData) {
    const list = Array.isArray(identitiesData)
      ? identitiesData
      : Array.isArray(identitiesData.agents)
      ? identitiesData.agents
      : [];
    const matched = list.find(
      (a: any) =>
        a &&
        typeof a.name === "string" &&
        a.name.trim().toLowerCase() === execName.toLowerCase()
    );
    if (matched?.pubkey) {
      const st = await safeReadJson<any>(
        ctx,
        `${BUZZ_AGENTS_DIR}/state/buzz.agent.v1%3A${matched.pubkey}`
      );
      if (st?.config) {
        executorProvider = st.config.provider || null;
        executorModel = st.config.model || null;
      }
    }
  }

  // Probes reais segundo manifesto da empresa + status real no esteira-minima-state
  const probes: HydratedProbeItem[] = [];
  let probesSource = `empresas/${empresa}.json`;
  const manifestProbes = empresaManifest?.probes_caixa_preta?.probes_padrao;
  const isMerged = Boolean(esteiraState?.merged?.[fullId] || esteiraState?.merged?.[shortId] || card.stage === "feito");
  const ciRec = esteiraState?.ci?.[fullId] || esteiraState?.ci?.[shortId] || null;

  if (Array.isArray(manifestProbes) && manifestProbes.length > 0) {
    for (const pr of manifestProbes) {
      const tipo = String(pr?.tipo || "probe");
      const label =
        tipo === "http_rota"
          ? `Rota HTTP (${pr.url || "health"})`
          : tipo === "supabase_rls"
          ? `Supabase RLS (${(pr.tabelas_obrigatorias || []).join(", ") || "tabelas"})`
          : tipo === "playwright_console"
          ? "Playwright Zero Console Err"
          : tipo;
      probes.push({
        label,
        status: isMerged ? "PASS" : "PENDENTE",
        detail: isMerged ? "Aprovado no Gate" : "Aguardando execução do Gate",
      });
    }
  } else {
    probesSource = `CI / Gate (${empresa})`;
    probes.push({
      label: "CI / Pytest da Esteira",
      status: ciRec?.ok === true || isMerged ? "PASS" : ciRec?.ok === false ? "FAIL" : "PENDENTE",
      detail: ciRec?.sha ? `SHA ${String(ciRec.sha).slice(0, 8)}` : isMerged ? "Integrado na main" : "Aguardando CI",
    });
    probes.push({
      label: "Aceite Congelado (L-22)",
      status: realHash ? "PASS" : "PENDENTE",
      detail: realHash ? `SHA-256 ${realHash.slice(0, 12)}…` : "Sem arquivo em .esteira/estado/aceites/",
    });
    probes.push({
      label: "Probes Web (Caddy / RLS / Playwright)",
      status: "NA",
      detail: `Não configurados em empresas/${empresa}.json`,
    });
  }

  // Transições reais desta issue em esteira-transicoes.jsonl
  const transitions: HydratedTransitionItem[] = [];
  let rejectionsCount = 0;
  if (transicoesTxt && shortId) {
    for (const line of transicoesTxt.split("\n")) {
      if (!line.trim() || !line.toLowerCase().includes(shortId)) continue;
      try {
        const ev = JSON.parse(line);
        const de = String(ev.de || ev.estagio_anterior || "?");
        const para = String(ev.para || ev.estagio_novo || "?");
        const detalhe = String(ev.detalhe || "");
        if (
          para.toLowerCase().includes("recus") ||
          para.toLowerCase().includes("conflito") ||
          detalhe.toLowerCase().includes("recus")
        ) {
          rejectionsCount += 1;
        }
        transitions.push({
          ts: String(ev.ts || ev.timestamp || ""),
          de,
          para,
          autor: String(ev.autor || ""),
          detalhe,
        });
      } catch {}
    }
  }

  const escritaRaw = cardMd ? extractField(cardMd, "Escrita exclusiva") : null;
  const escritaExclusiva = escritaRaw
    ? escritaRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    loadedAt: new Date().toISOString(),
    cardFileFound,
    objetivo: (cardMd && extractSection(cardMd, "Objetivo")) || card.objetivo || null,
    contexto: (cardMd && extractField(cardMd, "Contexto")) || card.contexto || null,
    autoridade: (cardMd && extractField(cardMd, "Autoridade")) || card.autoridade || null,
    decisao: (cardMd && extractField(cardMd, "Decisão")) || card.decisao || null,
    escritaExclusiva,
    feitoQuando: (cardMd && extractField(cardMd, "Feito quando")) || card.feitoQuando || null,
    provaExigida: (cardMd && extractSection(cardMd, "Prova exigida")) || card.provaExigida || null,
    acceptanceCommand: realAcceptCmd,
    acceptanceHash: realHash,
    acceptanceFrozenValid: Boolean(realHash),
    modoBuzz: (cardMd && extractField(cardMd, "Modo")) || card.modoBuzz || null,
    goalMaxTurns: (cardMd && extractField(cardMd, "Goal max turns")) || (card.goalMaxTurns ? String(card.goalMaxTurns) : null),
    maxRuntime: (cardMd && extractField(cardMd, "Tempo máximo")) || card.maxRuntime || null,
    worktreePath: (cardMd && extractField(cardMd, "Workspace")) || card.worktreePath || null,
    branch: lockRec?.branch || (cardMd && extractField(cardMd, "Branch")) || card.branch || null,
    lockActive,
    lockAgent: lockRec?.agentKey || null,
    lockExpiresInMin,
    executorProvider,
    executorModel,
    probes,
    probesSource,
    transitions: transitions.slice(-6),
    rejectionsCount,
  };
}
