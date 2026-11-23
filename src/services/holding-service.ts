// ─────────────────────────────────────────────────────────────────────────────
// ORGFY HOLDING & BOARD SERVICE (CONTROL PLANE V2 — 100% REAL, ZERO MOCKUPS)
// Lê empresas/board.json, manifestos das subsidiárias, workflows, regras RSI,
// templates reais em templates/*.md e a fila de aprovações do Board.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { ORGFY_ABS_PATH, readOrgfyJson, readOrgfyText } from "./orgfy-bridge";
import { listActiveLocks, type CheckoutLockRecord } from "./governance-engine";

export const BOARD_APPROVALS_PATH = "/Users/heltonfraga/.buzz/.scratch/board-approvals.json";
export const BUZZ_AGENT_STATE_DIR = "/Users/heltonfraga/Library/Application Support/xyz.block.buzz.desktop/agents/state";

export interface BoardCouncilMember {
  id: string;
  area: string;
  papel: string;
  responsavel: string;
  status: string;
}

export interface HoldingAgentNode {
  name: string;
  empresa: string;
  papel: string;
  model: string;
  provider?: string;
  modelSource: "buzz_live" | "manifesto";
  parallelism: number;
  pubkey: string;
  pubkeyReady: boolean;
  activeLock: CheckoutLockRecord | null;
}

export interface CompanyReadinessItem {
  slug: string;
  nome: string;
  nivel: "core" | "subsidiaria";
  workspaceBuzz: string;
  ceoEmpresa: string;
  reportaA: string;
  estagio: string;
  canal: string;
  canalPronto: boolean;
  budgetTokensDiario: number | null;
  cpiMinimo: number | null;
  agentesTotal: number;
  agentesProntos: number;
  locksAtivos: number;
  pendenciasOnboarding: string[];
  agentes: HoldingAgentNode[];
}

export interface BoardApprovalItem {
  id: string;
  empresa: string;
  tipo: "investimento" | "orcamento" | "metodo_z5_z6" | "onboarding" | "intervencao";
  titulo: string;
  descricao: string;
  solicitante: string;
  status: "pendente" | "aprovado" | "recusado";
  criadoEm: string;
  decididoEm?: string;
  decididoPor?: string;
  notaDecisao?: string;
}

export interface RealTemplateFile {
  id: string;
  name: string;
  path: string;
  exists: boolean;
  linesCount: number;
  versionTag: string;
  preview: string;
  content: string;
}

export interface RealWorkflowStatus {
  name: string;
  path: string;
  exists: boolean;
  enabled: boolean | null;
}

export interface RealProbationaryRule {
  id: string;
  erroId: string;
  descricao: string;
  status: string;
  cardsAvaliados: number;
  janelaAlvo: number;
  fpyObservado: number | null;
}

export interface HoldingControlPlaneSnapshot {
  ok: boolean;
  loadedAt: string;
  boardNome: string;
  fundador: { nome: string; papel: string; pubkey: string };
  ceoHolding: { nome: string; papel: string; pubkey: string };
  conselho: BoardCouncilMember[];
  fluxoEscalada: Record<string, string>;
  cadeiaComando: string[];
  empresas: CompanyReadinessItem[];
  approvals: BoardApprovalItem[];
  workflows: RealWorkflowStatus[];
  regrasProbatorias: RealProbationaryRule[];
  templatesReais: RealTemplateFile[];
  activeLocks: CheckoutLockRecord[];
}

function isPlaceholderHex(val: string | undefined): boolean {
  const clean = String(val || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return true;
  // Detecta placeholders óbvios como aa1111..., bb2222..., dd4444...
  return /^([0-9a-f]{2})\1{31}$/.test(clean) || /^[a-f]{2}(\d)\1{61}$/.test(clean);
}

function isPlaceholderChannel(val: string | undefined): boolean {
  const clean = String(val || "").trim().toLowerCase();
  if (!clean) return true;
  return clean.startsWith("a1111111-") || clean.startsWith("b2222222-") || clean.includes("0000-0000");
}

function decodeRaw(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return String(raw ?? "");
}

export async function readBoardApprovals(ctx: Context): Promise<BoardApprovalItem[]> {
  const host = (ctx as any).host;
  if (!host?.readFile) return [];
  try {
    const raw = await host.readFile(BOARD_APPROVALS_PATH);
    const parsed = JSON.parse(decodeRaw(raw));
    if (Array.isArray(parsed?.items)) {
      return parsed.items as BoardApprovalItem[];
    }
  } catch {
    // Arquivo pode não existir ainda
  }
  return [];
}

async function writeBoardApprovals(ctx: Context, items: BoardApprovalItem[]): Promise<boolean> {
  const host = (ctx as any).host;
  if (!host) return false;
  const serialized = JSON.stringify(
    {
      schema_version: "1.0.0",
      updated_at: new Date().toISOString(),
      items,
    },
    null,
    2
  );
  if (host.writeFile) {
    try {
      await host.writeFile(BOARD_APPROVALS_PATH, serialized);
      return true;
    } catch {
      // fallback abaixo
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

export async function createBoardApproval(
  ctx: Context,
  input: {
    empresa: string;
    tipo: BoardApprovalItem["tipo"];
    titulo: string;
    descricao: string;
    solicitante?: string;
  }
): Promise<{ ok: boolean; item?: BoardApprovalItem; items: BoardApprovalItem[] }> {
  const existing = await readBoardApprovals(ctx);
  const item: BoardApprovalItem = {
    id: `apr-${Date.now().toString(36)}`,
    empresa: input.empresa || "board",
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    solicitante: (input.solicitante || "Helton Fraga / Board").trim(),
    status: "pendente",
    criadoEm: new Date().toISOString(),
  };
  const next = [item, ...existing];
  const ok = await writeBoardApprovals(ctx, next);
  return { ok, item, items: next };
}

export async function decideBoardApproval(
  ctx: Context,
  approvalId: string,
  decision: "aprovado" | "recusado",
  notaDecisao?: string
): Promise<{ ok: boolean; items: BoardApprovalItem[] }> {
  const existing = await readBoardApprovals(ctx);
  const next = existing.map((it) =>
    it.id === approvalId
      ? {
          ...it,
          status: decision,
          decididoEm: new Date().toISOString(),
          decididoPor: "Helton Fraga (Board)",
          notaDecisao: notaDecisao?.trim() || undefined,
        }
      : it
  );
  const ok = await writeBoardApprovals(ctx, next);
  return { ok, items: next };
}

async function readRealTemplates(ctx: Context): Promise<RealTemplateFile[]> {
  const catalog = [
    { id: "tpl-v71", name: "Card v7.1 (Execução Determinística)", path: "templates/card-v7.1-template.md" },
    { id: "tpl-v3", name: "Card v3 (Canônico 13 Seções)", path: "templates/card-v3-template.md" },
    { id: "tpl-v2", name: "Card v2 (Legado)", path: "templates/card-v2-template.md" },
    { id: "tpl-exp", name: "Laudo de Experiência & UX", path: "templates/experience-template.md" },
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
          content: "",
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
        content,
      };
    })
  );
  return results;
}

async function readWorkflowStatuses(ctx: Context): Promise<RealWorkflowStatus[]> {
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
        enabled: m ? m[1].toLowerCase() === "true" : true,
      };
    })
  );
}

export async function fetchHoldingControlPlane(ctx: Context): Promise<HoldingControlPlaneSnapshot> {
  const [boardJson, orgfyJson, activeLocks, approvals, workflows, templatesReais, regrasJson] = await Promise.all([
    readOrgfyJson<any>(ctx, "empresas/board.json", null),
    readOrgfyJson<any>(ctx, "empresas/orgfy.json", null),
    listActiveLocks(ctx),
    readBoardApprovals(ctx),
    readWorkflowStatuses(ctx),
    readRealTemplates(ctx),
    readOrgfyJson<any>(ctx, ".esteira/estado/regras-probatorias.json", null),
  ]);

  const locksByAgent = new Map<string, CheckoutLockRecord>();
  for (const lk of activeLocks) {
    locksByAgent.set(lk.agentKey.toLowerCase(), lk);
  }

  // Lê modelo e provedor REAIS ativos no Buzz Desktop para cada pubkey válida
  const liveAgentConfigCache = new Map<string, { model?: string; provider?: string }>();
  const readLiveBuzzAgent = async (pubkey: string): Promise<{ model?: string; provider?: string } | null> => {
    const clean = pubkey.trim().toLowerCase();
    if (isPlaceholderHex(clean)) return null;
    if (liveAgentConfigCache.has(clean)) return liveAgentConfigCache.get(clean) || null;
    const host = (ctx as any).host;
    if (!host?.readFile) return null;
    try {
      const raw = await host.readFile(`${BUZZ_AGENT_STATE_DIR}/buzz.agent.v1%3A${clean}`);
      const parsed = JSON.parse(decodeRaw(raw));
      const cfg = parsed?.config;
      if (cfg && typeof cfg === "object") {
        const res = {
          model: typeof cfg.model === "string" && cfg.model.trim() ? cfg.model.trim() : undefined,
          provider: typeof cfg.provider === "string" && cfg.provider.trim() ? cfg.provider.trim() : undefined,
        };
        liveAgentConfigCache.set(clean, res);
        return res;
      }
    } catch {
      // Agente ainda não configurado no Buzz Desktop local
    }
    return null;
  };

  const buildCompanyItem = async (
    slug: string,
    nome: string,
    nivel: "core" | "subsidiaria",
    estagio: string,
    ceoEmpresa: string,
    reportaA: string,
    man: any
  ): Promise<CompanyReadinessItem> => {
    const canal = String(man?.canal || "");
    const canalPronto = !isPlaceholderChannel(canal);
    const agentesObj = man?.agentes && typeof man.agentes === "object" ? man.agentes : {};
    const entries = Object.entries(agentesObj as Record<string, any>);
    const liveConfigs = await Promise.all(
      entries.map(([, info]) => readLiveBuzzAgent(String(info?.pubkey || "")))
    );
    const agentes: HoldingAgentNode[] = [];
    let agentesProntos = 0;

    entries.forEach(([agName, info], idx) => {
      const pk = String(info?.pubkey || "").trim();
      const pkReady = !isPlaceholderHex(pk);
      if (pkReady) agentesProntos++;
      const liveCfg = liveConfigs[idx];
      const hasLiveModel = Boolean(liveCfg?.model);
      agentes.push({
        name: agName,
        empresa: slug,
        papel: String(info?.papel || "agente"),
        model: hasLiveModel ? String(liveCfg!.model) : String(info?.model || "não definido"),
        provider: liveCfg?.provider,
        modelSource: hasLiveModel ? "buzz_live" : "manifesto",
        parallelism: Number(info?.parallelism || 1),
        pubkey: pk,
        pubkeyReady: pkReady,
        activeLock: locksByAgent.get(agName.toLowerCase()) || null,
      });
    });

    const pendencias: string[] = [];
    if (!man) {
      pendencias.push(`Manifesto empresas/${slug}.json não encontrado`);
    } else {
      if (!canalPronto) pendencias.push("UUID do canal Buzz ainda em placeholder");
      const faltamPk = agentes.filter((a) => !a.pubkeyReady).map((a) => a.name);
      if (faltamPk.length > 0) {
        pendencias.push(`Pubkeys pendentes (${faltamPk.length}): ${faltamPk.slice(0, 3).join(", ")}${faltamPk.length > 3 ? "…" : ""}`);
      }
      const probes = man?.probes_caixa_preta?.probes_padrao;
      if (Array.isArray(probes) && probes.some((p: any) => String(p?.url || "").includes(".internal"))) {
        pendencias.push("URL de staging dos probes ainda com domínio .internal");
      }
    }

    return {
      slug,
      nome,
      nivel,
      workspaceBuzz: String(man?.hierarquia?.workspace_buzz || nome),
      ceoEmpresa,
      reportaA,
      estagio: pendencias.length === 0 ? "operacional" : estagio,
      canal,
      canalPronto,
      budgetTokensDiario:
        typeof man?.governanca_orcamento?.budget_tokens_diario === "number"
          ? man.governanca_orcamento.budget_tokens_diario
          : null,
      cpiMinimo:
        typeof man?.governanca_orcamento?.cpi_minimo === "number"
          ? man.governanca_orcamento.cpi_minimo
          : null,
      agentesTotal: agentes.length,
      agentesProntos,
      locksAtivos: agentes.filter((a) => a.activeLock !== null).length,
      pendenciasOnboarding: pendencias,
      agentes,
    };
  };

  const empresas: CompanyReadinessItem[] = [];
  empresas.push(
    await buildCompanyItem(
      "orgfy",
      boardJson?.core_framework?.nome || "OrgFy Core (Engenharia & Método)",
      "core",
      "operacional",
      "OrgFy Bento (COO)",
      "OrgFy Iris",
      orgfyJson
    )
  );

  const subs = Array.isArray(boardJson?.subsidiarias) ? boardJson.subsidiarias : [];
  const subManifests = await Promise.all(
    subs.map((s: any) => readOrgfyJson<any>(ctx, s?.manifesto || `empresas/${s?.slug}.json`, null))
  );
  const subItems = await Promise.all(
    subs.map((s: any, idx: number) =>
      buildCompanyItem(
        String(s?.slug || `sub-${idx}`),
        String(s?.nome || s?.workspace_buzz || s?.slug || "Subsidiária"),
        "subsidiaria",
        String(s?.estagio || "onboarding"),
        String(s?.ceo_empresa || "A definir"),
        String(s?.reporta_a || "OrgFy Iris"),
        subManifests[idx]
      )
    )
  );
  empresas.push(...subItems);

  const regrasObj = regrasJson?.regras && typeof regrasJson.regras === "object" ? regrasJson.regras : {};
  const regrasProbatorias: RealProbationaryRule[] = Object.entries(regrasObj as Record<string, any>).map(
    ([id, r]) => ({
      id,
      erroId: String(r?.erro_id || id),
      descricao: String(r?.descricao || "Sem descrição"),
      status: String(r?.status || "DESCONHECIDO"),
      cardsAvaliados: Number(r?.cards_avaliados || 0),
      janelaAlvo: Number(r?.janela_alvo || 10),
      fpyObservado: typeof r?.fpy_observado === "number" ? r.fpy_observado : null,
    })
  );

  return {
    ok: boardJson !== null || orgfyJson !== null,
    loadedAt: new Date().toISOString(),
    boardNome: String(boardJson?.nome || "Conselho da Holding OrgFy"),
    fundador: {
      nome: String(boardJson?.fundador?.nome || "Helton Fraga"),
      papel: String(boardJson?.fundador?.papel || "Fundador"),
      pubkey: String(boardJson?.fundador?.pubkey || ""),
    },
    ceoHolding: {
      nome: String(boardJson?.ceo_holding?.nome || "OrgFy Iris"),
      papel: String(boardJson?.ceo_holding?.papel || "CEO da Holding"),
      pubkey: String(boardJson?.ceo_holding?.pubkey || ""),
    },
    conselho: Array.isArray(boardJson?.conselho) ? boardJson.conselho : [],
    fluxoEscalada:
      boardJson?.fluxo_escalada && typeof boardJson.fluxo_escalada === "object"
        ? boardJson.fluxo_escalada
        : {},
    cadeiaComando: Array.isArray(boardJson?.protocolo_governanca?.cadeia_comando)
      ? boardJson.protocolo_governanca.cadeia_comando
      : [],
    empresas,
    approvals,
    workflows,
    regrasProbatorias,
    templatesReais,
    activeLocks,
  };
}

export const ORGFY_CORE_PATH_REF = ORGFY_ABS_PATH;
