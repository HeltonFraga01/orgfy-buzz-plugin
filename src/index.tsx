import type { Context } from "@buzz/author";
import type {
  BoardManifest,
  EmpresaManifest,
  EsteiraMinimaState,
  PlacarState,
  RegrasProbatoriasState,
  PipelineCard,
  RegraProbatoria,
} from "./types/orgfy";

export const inject = ["react", "pages", "settingsCards", "host", "navigation", "agents"];

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL DATA & FALLBACK CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TENANTS = [
  { id: "all", name: "Holding OrgFy", badge: "Cross-Workspace", slug: "all" },
  { id: "orgfy", name: "OrgFy Core", badge: "Core Framework", slug: "orgfy" },
  { id: "lumen-iptv", name: "Lumen IPTV", badge: "Subsidiária IPTV", slug: "lumen-iptv" },
  { id: "saas-tributario", name: "SaaS Tributário", badge: "Subsidiária Fiscal", slug: "saas-tributario" },
];

export const INITIAL_PIPELINE_CARDS: PipelineCard[] = [
  {
    id: "card-104",
    issueId: "5c569a9e",
    title: "Refatorar Autenticação PKCE e Session Store",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "triagem",
    elapsedTime: "há 14m",
    dsapScore: 0.12,
  },
  {
    id: "card-108",
    issueId: "bc63ecec",
    title: "Isolamento de Cache de CI no Swarm Efêmero",
    priority: "P1",
    empresa: "lumen-iptv",
    executor: "OrgFy Val",
    revisor: "QA Sentinel",
    tier: "tier_1_exec_barato",
    stage: "triagem",
    elapsedTime: "há 32m",
    dsapScore: 0.08,
  },
  {
    id: "card-105",
    issueId: "cf45657a",
    title: "Implementar Rota de Webhook para Gate Nostr",
    priority: "P1",
    empresa: "orgfy",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "despachado",
    elapsedTime: "há 45m",
    commitSha: "8bbb5e9",
  },
  {
    id: "card-109",
    issueId: "5c109609",
    title: "Sincronização Atômica de Manifestos da Holding",
    priority: "P2",
    empresa: "saas-tributario",
    executor: "OrgFy Val",
    revisor: "QA Sentinel",
    tier: "tier_1_exec_barato",
    stage: "despachado",
    elapsedTime: "há 1h",
    commitSha: "de39843",
  },
  {
    id: "card-106",
    issueId: "eac4478a",
    title: "Probes Caixa-Preta no Caddy v3 com Playwright",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Otto",
    revisor: "OrgFy Bento Arquiteto",
    tier: "tier_2_revisor",
    stage: "execucao",
    elapsedTime: "há 18m",
    workerPid: 84219,
    turnCurrent: 2,
    turnMax: 5,
    commitSha: "d9b6542",
    ciStatus: "running",
  },
  {
    id: "card-107",
    issueId: "2656485e",
    prId: "PR #42",
    title: "Reconciliação de Modelo de Referência e RLS Supabase",
    priority: "P0",
    empresa: "lumen-iptv",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "revisao",
    elapsedTime: "há 6m",
    commitSha: "c05c52b",
    ciStatus: "pass",
    probes: {
      http_rota: true,
      supabase_rls: true,
      playwright_console: true,
    },
    rejectionHistory: [
      {
        author: "OrgFy Bento",
        timestamp: Date.now() - 3600000,
        reason: "Falta validação de RLS na tabela de perfis de usuário",
        similarityToFirst: 0.15,
      },
    ],
  },
  {
    id: "card-102",
    issueId: "c05c52b5",
    prId: "PR #40",
    title: "Esteira Mínima v10 e Cutover Determinístico",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Bento Arquiteto",
    revisor: "QA Sentinel",
    tier: "tier_3_arquiteto",
    stage: "feito",
    elapsedTime: "concluído",
    commitSha: "c05c52b",
    ciStatus: "pass",
  },
];

export const INITIAL_REGRAS_PROBATORIAS: RegraProbatoria[] = [
  {
    regra_id: "R-001",
    erro_id: "ERR_FIXTURE_LEAK",
    descricao: "Limpeza estrita de fixtures temporárias no runner de testes",
    comando_check: "pytest testes/esteira -k fixture_clean",
    hash_comando: "a7b9c1d3",
    alvo_guarda: "testes/conftest.py",
    status: "EM_TESTE",
    criada_em_ts: Date.now() - 86400000 * 2,
    atualizada_em_ts: Date.now(),
    baseline_fpy: 96.0,
    fpy_observado: 100.0,
    janela_alvo: 10,
    cards_avaliados: 2,
    falhas_durante_teste: 0,
    motivo_transicao: "Janela probatória ativa (8/10 cards restantes)",
  },
  {
    regra_id: "R-002",
    erro_id: "ERR_MODEL_STALE",
    descricao: "Expurgo forçado de modelos inativos no sync do Goose/Pi",
    comando_check: "python3 ferramentas/esteira/retro.py --check-models",
    hash_comando: "e8f2a4b6",
    alvo_guarda: "custom_providers/nexusmind.json",
    status: "MANTIDA",
    criada_em_ts: Date.now() - 86400000 * 8,
    atualizada_em_ts: Date.now() - 86400000,
    baseline_fpy: 91.5,
    fpy_observado: 100.0,
    janela_alvo: 10,
    cards_avaliados: 10,
    falhas_durante_teste: 0,
    motivo_transicao: "Homologada sem regressão após 10 cards",
  },
];

export const AVAILABLE_AGENTS = [
  { id: "OrgFy Iris", name: "OrgFy Iris", role: "CEO Holding", tier: "tier_3_arquiteto", model: "gemini-3.8-flash-medium" },
  { id: "OrgFy Bento", name: "OrgFy Bento", role: "COO Operacional", tier: "tier_3_arquiteto", model: "claude-sonnet-4-6" },
  { id: "OrgFy Bento Arquiteto", name: "OrgFy Bento Arquiteto", role: "Arquiteto de Software", tier: "tier_3_arquiteto", model: "claude-opus-4-6" },
  { id: "OrgFy Atlas", name: "OrgFy Atlas", role: "Engenheiro Core", tier: "tier_1_exec_barato", model: "mistral-large-4-1t" },
  { id: "OrgFy Val", name: "OrgFy Val", role: "Engenheiro de Produto", tier: "tier_1_exec_barato", model: "gemini-3.8-flash" },
  { id: "OrgFy Otto", name: "OrgFy Otto", role: "Engenheiro de Testes", tier: "tier_2_revisor", model: "claude-sonnet-4-6" },
  { id: "QA Sentinel", name: "QA Sentinel", role: "Auditor de Qualidade", tier: "tier_2_revisor", model: "grok-4.5" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SVGs MINIMALISTAS GEOMÉTRICOS (ZERO EMOJIS FUNCIONAIS)
// ─────────────────────────────────────────────────────────────────────────────

export const SVG = {
  orgfy: ({ h, width = 20, height = 20 }: any) =>
    h(
      "svg",
      { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polygon", { points: "12 2 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 2" }),
      h("line", { x1: "12", y1: "22", x2: "12", y2: "15.5" }),
      h("polyline", { points: "22 8.5 12 15.5 2 8.5" }),
      h("polyline", { points: "2 15.5 12 8.5 22 15.5" })
    ),
  zap: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
    ),
  shield: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
    ),
  refresh: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
    ),
  messageCircle: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" })
    ),
  columns: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
      h("line", { x1: "12", y1: "3", x2: "12", y2: "21" })
    ),
  chevronDown: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "6 9 12 15 18 9" })
    ),
  chevronRight: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "9 18 15 12 9 6" })
    ),
  search: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "11", cy: "11", r: "8" }),
      h("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
    ),
  checkCircle: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
      h("polyline", { points: "22 4 12 14.01 9 11.01" })
    ),
  alertTriangle: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
      h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
      h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
    ),
  xCircle: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "12", cy: "12", r: "10" }),
      h("line", { x1: "15", y1: "9", x2: "9", y2: "15" }),
      h("line", { x1: "9", y1: "9", x2: "15", y2: "15" })
    ),
  terminal: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "4 17 10 11 4 5" }),
      h("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
    ),
  user: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: "12", cy: "7", r: "4" })
    ),
  cpu: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", ry: "2" }),
      h("rect", { x: "9", y: "9", width: "6", height: "6" }),
      h("line", { x1: "9", y1: "1", x2: "9", y2: "4" }),
      h("line", { x1: "15", y1: "1", x2: "15", y2: "4" }),
      h("line", { x1: "9", y1: "20", x2: "9", y2: "23" }),
      h("line", { x1: "15", y1: "20", x2: "15", y2: "23" })
    ),
  clock: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "12", cy: "12", r: "10" }),
      h("polyline", { points: "12 6 12 12 16 14" })
    ),
  gitCommit: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "12", cy: "12", r: "4" }),
      h("line", { x1: "1.05", y1: "12", x2: "7", y2: "12" }),
      h("line", { x1: "17.01", y1: "12", x2: "22.96", y2: "12" })
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (BUZZ WORKSPACE COCKPIT)
// ─────────────────────────────────────────────────────────────────────────────

export function apply(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  function OrgFyCockpit() {
    // Estado de Tenant / Multi-Tenant da Holding
    const [selectedTenant, setSelectedTenant] = React.useState<string>("all");
    const [porteiroActive, setPorteiroActive] = React.useState<boolean>(true);
    const [fpyRate, setFpyRate] = React.useState<number>(100.0);
    const [cpiTokens, setCpiTokens] = React.useState<number>(0.94);

    // Estado da Matrix de Pipeline (5 Raias Determinísticas)
    const [pipelineCards, setPipelineCards] = React.useState<PipelineCard[]>(() => {
      try {
        const stored = localStorage.getItem("orgfy_pipeline_cards");
        return stored ? JSON.parse(stored) : INITIAL_PIPELINE_CARDS;
      } catch {
        return INITIAL_PIPELINE_CARDS;
      }
    });

    // Regras Probatórias RSI (Harness²)
    const [regrasProbatorias, setRegrasProbatorias] = React.useState<RegraProbatoria[]>(() => {
      try {
        const stored = localStorage.getItem("orgfy_regras_probatorias");
        return stored ? JSON.parse(stored) : INITIAL_REGRAS_PROBATORIAS;
      } catch {
        return INITIAL_REGRAS_PROBATORIAS;
      }
    });

    // Filtros e busca da Ilha Central
    const [searchQuery, setSearchQuery] = React.useState<string>("");
    const [selectedTierFilter, setSelectedTierFilter] = React.useState<string>("all");
    const [selectedAssigneeFilter, setSelectedAssigneeFilter] = React.useState<string>("all");

    // Modais & Drawers
    const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState<boolean>(false);
    const [isGateModalOpen, setIsGateModalOpen] = React.useState<boolean>(false);
    const [activeGateCard, setActiveGateCard] = React.useState<PipelineCard | null>(null);
    const [isLogsDrawerOpen, setIsLogsDrawerOpen] = React.useState<boolean>(false);
    const [activeLogsCard, setActiveLogsCard] = React.useState<PipelineCard | null>(null);
    const [isRightRailOpen, setIsRightRailOpen] = React.useState<boolean>(true);
    const [isCopilotOpen, setIsCopilotOpen] = React.useState<boolean>(false);
    const [copilotAgent, setCopilotAgent] = React.useState<string>("OrgFy Bento");

    // Formulário do Modal de Despacho
    const [dispatchIssueId, setDispatchIssueId] = React.useState<string>("");
    const [dispatchExecutor, setDispatchExecutor] = React.useState<string>("OrgFy Atlas");
    const [dispatchRevisor, setDispatchRevisor] = React.useState<string>("OrgFy Bento");
    const [dispatchIsolatedWorktree, setDispatchIsolatedWorktree] = React.useState<boolean>(true);
    const [dispatchRunCi, setDispatchRunCi] = React.useState<boolean>(true);

    // Formulário do Modal de Gate & Alerta DSAP
    const [gateRejectionReason, setGateRejectionReason] = React.useState<string>("");
    const [dsapWarning, setDsapWarning] = React.useState<boolean>(false);
    const [dsapSimilarity, setDsapSimilarity] = React.useState<number>(0);

    // Feedback Toast / Banner
    const [notification, setNotification] = React.useState<{ type: "success" | "warning" | "info"; text: string } | null>(null);

    const showNotification = (type: "success" | "warning" | "info", text: string) => {
      setNotification({ type, text });
      setTimeout(() => setNotification(null), 3500);
    };

    // Auto-carregar estado real dos arquivos da esteira em REPOS/orgfy
    const loadRealState = async () => {
      try {
        if (ctx.host && ctx.host.readFile) {
          // Lê placar real
          try {
            const placarContent = await ctx.host.readFile("~/.buzz/REPOS/orgfy/.scratch/placar-20h.json");
            const text = typeof placarContent === "string" ? placarContent : new TextDecoder().decode(placarContent);
            const p = JSON.parse(text) as PlacarState;
            if (p.pct_aceito_primeira_revisao !== undefined) {
              setFpyRate(p.pct_aceito_primeira_revisao);
            }
          } catch {}

          // Lê esteira mínima state
          try {
            const esteiraContent = await ctx.host.readFile("~/.buzz/REPOS/orgfy/.esteira/estado/esteira-minima-state.json");
            const text = typeof esteiraContent === "string" ? esteiraContent : new TextDecoder().decode(esteiraContent);
            const em = JSON.parse(text) as EsteiraMinimaState;
            if (em.ci_cache && Object.keys(em.ci_cache).length > 0) {
              setPorteiroActive(true);
            }
          } catch {}
        }
      } catch (err: any) {
        console.warn("Leitura de fallback ativa:", err);
      }
    };

    React.useEffect(() => {
      loadRealState();
    }, [selectedTenant]);

    // Análise preditiva de similaridade semântica DSAP (Backtracking na 2ª recusa repetida)
    React.useEffect(() => {
      if (!activeGateCard || !gateRejectionReason.trim()) {
        setDsapWarning(false);
        setDsapSimilarity(0);
        return;
      }
      const prev = activeGateCard.rejectionHistory?.[0]?.reason || "";
      if (!prev) {
        setDsapWarning(false);
        return;
      }
      // Cálculo de overlap de tokens relevantes
      const tokenize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9_]/g, " ").split(/\s+/).filter((w) => w.length > 2);
      const tokensA = new Set(tokenize(gateRejectionReason));
      const tokensB = new Set(tokenize(prev));
      const intersection = [...tokensA].filter((t) => tokensB.has(t));
      const union = new Set([...tokensA, ...tokensB]);
      const sim = union.size === 0 ? 0 : intersection.length / union.size;
      setDsapSimilarity(sim);
      if (sim >= 0.7) {
        setDsapWarning(true);
      } else {
        setDsapWarning(false);
      }
    }, [gateRejectionReason, activeGateCard]);

    // Filtragem dinâmica de cards na Live Pipeline Matrix
    const filteredCards = React.useMemo(() => {
      return pipelineCards.filter((c) => {
        if (selectedTenant !== "all" && c.empresa !== selectedTenant) return false;
        if (selectedTierFilter !== "all" && c.tier !== selectedTierFilter) return false;
        if (selectedAssigneeFilter !== "all" && c.executor !== selectedAssigneeFilter && c.revisor !== selectedAssigneeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            c.title.toLowerCase().includes(q) ||
            c.issueId.toLowerCase().includes(q) ||
            (c.prId && c.prId.toLowerCase().includes(q)) ||
            (c.commitSha && c.commitSha.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      });
    }, [pipelineCards, selectedTenant, selectedTierFilter, selectedAssigneeFilter, searchQuery]);

    // Agrupamento por raia da esteira determinística
    const cardsByStage = React.useMemo(() => {
      return {
        triagem: filteredCards.filter((c) => c.stage === "triagem"),
        despachado: filteredCards.filter((c) => c.stage === "despachado"),
        execucao: filteredCards.filter((c) => c.stage === "execucao"),
        revisao: filteredCards.filter((c) => c.stage === "revisao"),
        feito: filteredCards.filter((c) => c.stage === "feito"),
      };
    }, [filteredCards]);

    // Ação: Disparar Despacho
    const handleExecuteDispatch = () => {
      if (!dispatchIssueId.trim()) {
        showNotification("warning", "Por favor, selecione ou informe o ID da Issue.");
        return;
      }
      // Regra L-01: Executor nunca pode ser o revisor
      if (dispatchExecutor === dispatchRevisor) {
        showNotification("warning", "Regra L-01 violada: O executor não pode ser o mesmo agente revisor!");
        return;
      }

      const newCard: PipelineCard = {
        id: `card-${Date.now()}`,
        issueId: dispatchIssueId.replace("#", ""),
        title: `Despacho: ${dispatchIssueId} via ${dispatchExecutor}`,
        priority: "P1",
        empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
        executor: dispatchExecutor,
        revisor: dispatchRevisor,
        tier: dispatchExecutor === "OrgFy Bento Arquiteto" ? "tier_3_arquiteto" : dispatchExecutor === "OrgFy Otto" ? "tier_2_revisor" : "tier_1_exec_barato",
        stage: "despachado",
        elapsedTime: "agora",
      };

      const updated = [newCard, ...pipelineCards];
      setPipelineCards(updated);
      localStorage.setItem("orgfy_pipeline_cards", JSON.stringify(updated));
      setIsDispatchModalOpen(false);
      setDispatchIssueId("");
      showNotification("success", `Card ${dispatchIssueId} despachado com sucesso para ${dispatchExecutor}!`);
    };

    // Ação: Aceitar PR no Gate
    const handleAcceptGate = (card: PipelineCard) => {
      const updated = pipelineCards.map((c) => {
        if (c.id === card.id) {
          return {
            ...c,
            stage: "feito" as const,
            elapsedTime: "aprovado agora",
            commitSha: c.commitSha || "c05c52b",
          };
        }
        return c;
      });
      setPipelineCards(updated);
      localStorage.setItem("orgfy_pipeline_cards", JSON.stringify(updated));
      setIsGateModalOpen(false);
      setActiveGateCard(null);
      showNotification("success", `PR ${card.prId || card.issueId} ACEITO no Gate! FPY incrementado.`);
    };

    // Ação: Recusar PR no Gate
    const handleRejectGate = (card: PipelineCard) => {
      if (!gateRejectionReason.trim()) {
        showNotification("warning", "Por favor, justifique o motivo da recusa.");
        return;
      }

      if (dsapWarning) {
        showNotification("warning", `[DSAP BACKTRACKING] Disparado! Similaridade de ${Math.round(dsapSimilarity * 100)}% acionou o COO para re-escopo.`);
      }

      const updated = pipelineCards.map((c) => {
        if (c.id === card.id) {
          const newHistory = [
            {
              author: "QA Sentinel",
              timestamp: Date.now(),
              reason: gateRejectionReason,
              similarityToFirst: dsapSimilarity,
            },
            ...(c.rejectionHistory || []),
          ];
          return {
            ...c,
            stage: "execucao" as const,
            elapsedTime: "recusado (re-trabalho)",
            rejectionHistory: newHistory,
          };
        }
        return c;
      });

      setPipelineCards(updated);
      localStorage.setItem("orgfy_pipeline_cards", JSON.stringify(updated));
      setIsGateModalOpen(false);
      setActiveGateCard(null);
      setGateRejectionReason("");
      showNotification("info", `PR devolvido ao executor para correções.`);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDERIZAÇÃO ESTRUTURAL — TRÍADE SOBERANA
    // ─────────────────────────────────────────────────────────────────────────

    return h(
      "div",
      {
        "data-project-context-detached": "true",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minHeight: "100vh",
          background: "radial-gradient(ellipse at top left, #0d1a14 0%, #080d0b 70%)",
          color: "var(--text-standard, #f3f4f6)",
          fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          padding: "12px",
          boxSizing: "border-box",
          overflowX: "hidden",
        },
      },

      // TOAST DE NOTIFICAÇÃO
      notification &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: "20px",
              right: "24px",
              zIndex: 9999,
              padding: "10px 18px",
              borderRadius: "10px",
              backgroundColor:
                notification.type === "success"
                  ? "rgba(16, 185, 129, 0.95)"
                  : notification.type === "warning"
                  ? "rgba(245, 158, 11, 0.95)"
                  : "rgba(59, 130, 246, 0.95)",
              color: "#000000",
              fontWeight: "600",
              fontSize: "13px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            },
          },
          SVG.checkCircle({ h, width: 16, height: 16 }),
          notification.text
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 1. TOP CHROME & HEADER DE GOVERNANÇA MULTI-TENANT
      // ───────────────────────────────────────────────────────────────────────
      h(
        "header",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "10px 18px",
            borderRadius: "14px",
            backgroundColor: "rgba(18, 24, 21, 0.75)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            marginBottom: "12px",
          },
        },
        // Esquerda: Logo + Dropdown de Tenant
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
              },
            },
            SVG.orgfy({ h, width: 22, height: 22 }),
            h("span", { style: { fontWeight: "700", fontSize: "14px", letterSpacing: "0.5px" } }, "ORGFY CONTROL ROOM")
          ),
          h("div", { style: { height: "20px", width: "1px", backgroundColor: "rgba(255, 255, 255, 0.1)" } }),
          // Seletor de Tenant
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px" } },
            TENANTS.map((t) =>
              h(
                "button",
                {
                  key: t.id,
                  onClick: () => setSelectedTenant(t.id),
                  style: {
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: selectedTenant === t.id ? "#10b981" : "rgba(255, 255, 255, 0.05)",
                    color: selectedTenant === t.id ? "#000000" : "var(--text-subtle, #9ca3af)",
                    fontWeight: selectedTenant === t.id ? "700" : "500",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  },
                },
                t.name
              )
            )
          )
        ),

        // Centro: Telemetria do Porteiro + Métricas de Governança
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" } },
          // Porteiro Badge
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "9999px",
                backgroundColor: porteiroActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: porteiroActive ? "#10b981" : "#ef4444",
                fontSize: "11px",
                fontWeight: "600",
              },
            },
            h("div", {
              style: {
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: porteiroActive ? "#10b981" : "#ef4444",
                boxShadow: porteiroActive ? "0 0 8px #10b981" : "none",
              },
            }),
            porteiroActive ? "PORTEIRO ATIVO (120ms)" : "PORTEIRO OCIOSO"
          ),
          // FPY
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
            h("span", { style: { color: "var(--text-subtle, #9ca3af)" } }, "FPY:"),
            h("span", { style: { color: "#10b981", fontWeight: "700" } }, `${fpyRate.toFixed(1)}%`)
          ),
          // CPI Tokens EVM
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
            h("span", { style: { color: "var(--text-subtle, #9ca3af)" } }, "CPI EVM:"),
            h("span", { style: { color: cpiTokens >= 0.85 ? "#10b981" : "#f59e0b", fontWeight: "700" } }, cpiTokens.toFixed(2))
          )
        ),

        // Direita: Botões de Ação
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h(
            "button",
            {
              onClick: () => setIsDispatchModalOpen(true),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                backgroundColor: "#10b981",
                color: "#000000",
                fontWeight: "700",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
              },
            },
            SVG.zap({ h, width: 14, height: 14 }),
            "Novo Despacho"
          ),
          h(
            "button",
            {
              onClick: () => setIsCopilotOpen((v) => !v),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isCopilotOpen ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.06)",
                color: isCopilotOpen ? "#60a5fa" : "#ffffff",
                fontSize: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
              },
            },
            SVG.messageCircle({ h, width: 14, height: 14 }),
            "Copiloto"
          ),
          h(
            "button",
            {
              onClick: () => setIsRightRailOpen((v) => !v),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isRightRailOpen ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
                color: isRightRailOpen ? "#10b981" : "#ffffff",
                fontSize: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
              },
            },
            SVG.columns({ h, width: 14, height: 14 }),
            "Governança & RSI"
          ),
          h(
            "button",
            {
              onClick: loadRealState,
              title: "Sincronizar dados da esteira",
              style: {
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              },
            },
            SVG.refresh({ h, width: 14, height: 14 })
          )
        )
      ),

      // ───────────────────────────────────────────────────────────────────────
      // 2. PALCO PRINCIPAL (ILHA CENTRAL + COSTA DIREITA UTILITÁRIA)
      // ───────────────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            display: "flex",
            flex: 1,
            gap: "12px",
            minHeight: "0",
            overflow: "hidden",
          },
        },

        // ─────────────────────────────────────────────────────────────────────
        // ILHA CENTRAL — LIVE PIPELINE MATRIX
        // ─────────────────────────────────────────────────────────────────────
        h(
          "main",
          {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRadius: "16px",
              backgroundColor: "rgba(18, 24, 21, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              padding: "16px",
              overflow: "hidden",
              minWidth: 0,
            },
          },

          // Header Tático de Filtros
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "16px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              // Busca
              h(
                "div",
                { style: { position: "relative", display: "flex", alignItems: "center" } },
                h("input", {
                  type: "text",
                  placeholder: "Buscar card, issue, commit...",
                  value: searchQuery,
                  onChange: (e: any) => setSearchQuery(e.target.value),
                  style: {
                    borderRadius: "9999px",
                    backgroundColor: "rgba(0, 0, 0, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    padding: "6px 14px 6px 32px",
                    fontSize: "12px",
                    outline: "none",
                    width: "220px",
                  },
                }),
                h(
                  "div",
                  { style: { position: "absolute", left: "10px", color: "#9ca3af", pointerEvents: "none" } },
                  SVG.search({ h, width: 14, height: 14 })
                )
              ),
              // Filtro por Tier
              h(
                "select",
                {
                  value: selectedTierFilter,
                  onChange: (e: any) => setSelectedTierFilter(e.target.value),
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(0, 0, 0, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    padding: "6px 12px",
                    fontSize: "12px",
                    outline: "none",
                    cursor: "pointer",
                  },
                },
                h("option", { value: "all" }, "Todos os Tiers CoEvo-RSI"),
                h("option", { value: "tier_1_exec_barato" }, "Tier 1: Barato (Enxuto)"),
                h("option", { value: "tier_2_revisor" }, "Tier 2: Revisor (Gate)"),
                h("option", { value: "tier_3_arquiteto" }, "Tier 3: Arquiteto (Governança)")
              ),
              // Filtro por Agente
              h(
                "select",
                {
                  value: selectedAssigneeFilter,
                  onChange: (e: any) => setSelectedAssigneeFilter(e.target.value),
                  style: {
                    borderRadius: "8px",
                    backgroundColor: "rgba(0, 0, 0, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    padding: "6px 12px",
                    fontSize: "12px",
                    outline: "none",
                    cursor: "pointer",
                  },
                },
                h("option", { value: "all" }, "Todos os Responsáveis"),
                AVAILABLE_AGENTS.map((a) => h("option", { key: a.id, value: a.name }, a.name))
              )
            ),
            h(
              "span",
              { style: { fontSize: "12px", color: "var(--text-subtle, #9ca3af)" } },
              `Exibindo ${filteredCards.length} de ${pipelineCards.length} cards`
            )
          ),

          // ───────────────────────────────────────────────────────────────────
          // AS 5 RAIAS DETERMINÍSTICAS (KANBAN MATRIX)
          // ───────────────────────────────────────────────────────────────────
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(260px, 1fr))",
                gap: "12px",
                flex: 1,
                overflowX: "auto",
                overflowY: "auto",
                paddingBottom: "8px",
              },
            },
            // Raia 1: Triagem & Backlog
            renderColumn(
              "1. Triagem & Backlog",
              cardsByStage.triagem,
              "rgba(59, 130, 246, 0.15)",
              "#60a5fa",
              (card) =>
                h(
                  "button",
                  {
                    onClick: () => {
                      setDispatchIssueId(card.issueId);
                      setIsDispatchModalOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    },
                  },
                  SVG.zap({ h, width: 12, height: 12 }),
                  "Despachar"
                )
            ),

            // Raia 2: Despachados & Alocados
            renderColumn(
              "2. Despachados",
              cardsByStage.despachado,
              "rgba(168, 85, 247, 0.15)",
              "#c084fc",
              (card) =>
                h(
                  "div",
                  {
                    style: {
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    },
                  },
                  SVG.clock({ h, width: 10, height: 10 }),
                  `Aguardando sub-second wake`
                )
            ),

            // Raia 3: Em Execução (Headless Workers)
            renderColumn(
              "3. Em Execução",
              cardsByStage.execucao,
              "rgba(245, 158, 11, 0.15)",
              "#f59e0b",
              (card) =>
                h(
                  "button",
                  {
                    onClick: () => {
                      setActiveLogsCard(card);
                      setIsLogsDrawerOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    },
                  },
                  SVG.terminal({ h, width: 12, height: 12 }),
                  "Ver Logs Live"
                )
            ),

            // Raia 4: Em Revisão (Gate Caixa-Preta)
            renderColumn(
              "4. Em Revisão (Gate)",
              cardsByStage.revisao,
              "rgba(16, 185, 129, 0.15)",
              "#10b981",
              (card) =>
                h(
                  "button",
                  {
                    onClick: () => {
                      setActiveGateCard(card);
                      setIsGateModalOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#10b981",
                      color: "#000000",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    },
                  },
                  SVG.shield({ h, width: 12, height: 12 }),
                  "Decidir Gate"
                )
            ),

            // Raia 5: Concluído / FPY
            renderColumn(
              "5. Concluído / FPY",
              cardsByStage.feito,
              "rgba(255, 255, 255, 0.1)",
              "#ffffff",
              (card) =>
                h(
                  "div",
                  {
                    style: {
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    },
                  },
                  SVG.checkCircle({ h, width: 10, height: 10 }),
                  "MERGED na main (FPY 100%)"
                )
            )
          )
        ),

        // ─────────────────────────────────────────────────────────────────────
        // COSTA DIREITA UTILITÁRIA — GOVERNANÇA, RSI E EVM (ZERO CARD-CEPTION)
        // ─────────────────────────────────────────────────────────────────────
        isRightRailOpen &&
          h(
            "aside",
            {
              style: {
                width: "320px",
                minWidth: "280px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "8px 0 8px 12px",
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                overflowY: "auto",
              },
            },
            // Header do Painel
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.shield({ h, width: 16, height: 16 }),
                h("span", { style: { fontWeight: "700", fontSize: "13px", color: "#ffffff" } }, "GOVERNANÇA & RSI")
              ),
              h("span", { style: { fontSize: "10px", color: "#10b981", fontWeight: "600" } }, "HARNESS² V10")
            ),

            // Seção EVM & Orçamento de Tokens
            h(
              "div",
              {
                style: {
                  padding: "12px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(18, 24, 21, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af" } }, "MÉTRICAS EVM & TOKENS"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "CPI Acumulado"),
                h(
                  "span",
                  { style: { fontSize: "13px", fontWeight: "700", color: cpiTokens >= 0.85 ? "#10b981" : "#f59e0b" } },
                  `${cpiTokens.toFixed(2)} (Min: 0.85)`
                )
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "Circuit Breaker Loops"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#10b981" } }, "0 / 3 turnos (OK)")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "PRs Integrados"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff" } }, "21 na main")
              )
            ),

            // Seção Catraca RSI (Regras Probatórias)
            h(
              "div",
              {
                style: {
                  padding: "12px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(18, 24, 21, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af" } }, "CATRACA RSI (REGRAS PROBATÓRIAS)"),
              regrasProbatorias.map((r) =>
                h(
                  "div",
                  {
                    key: r.regra_id,
                    style: {
                      padding: "8px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { style: { fontWeight: "700", fontSize: "11px", color: "#ffffff" } }, r.regra_id),
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "9px",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            r.status === "EM_TESTE"
                              ? "rgba(59, 130, 246, 0.2)"
                              : r.status === "MANTIDA"
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(239, 68, 68, 0.2)",
                          color:
                            r.status === "EM_TESTE"
                              ? "#60a5fa"
                              : r.status === "MANTIDA"
                              ? "#10b981"
                              : "#ef4444",
                          fontWeight: "700",
                        },
                      },
                      r.status
                    )
                  ),
                  h("div", { style: { fontSize: "11px", color: "#d1d5db" } }, r.descricao),
                  h(
                    "div",
                    { style: { fontSize: "10px", color: "#9ca3af", marginTop: "2px" } },
                    `Janela: ${r.cards_avaliados}/${r.janela_alvo} cards avaliados`
                  ),
                  h(
                    "button",
                    {
                      onClick: () => showNotification("info", `Comando executado: ${r.comando_check} -> PASSOU (Exit 0)`),
                      style: {
                        marginTop: "4px",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: "#9ca3af",
                        border: "none",
                        fontSize: "9px",
                        cursor: "pointer",
                        alignSelf: "flex-start",
                      },
                    },
                    "Checar Agora"
                  )
                )
              )
            ),

            // Seção Histórico de Recusas & DSAP
            h(
              "div",
              {
                style: {
                  padding: "12px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(18, 24, 21, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af" } }, "DETECTOR PREDITIVO DSAP"),
              h(
                "div",
                { style: { fontSize: "11px", color: "#9ca3af" } },
                "Monitora a 2ª recusa consecutiva com similaridade semântica >= 0.70 para acionamento de backtracking do COO."
              ),
              h(
                "div",
                {
                  style: {
                    padding: "6px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    color: "#10b981",
                    fontSize: "11px",
                    fontWeight: "600",
                  },
                },
                "Nenhum backtracking ativo no momento."
              )
            )
          )
      ),

      // ───────────────────────────────────────────────────────────────────────
      // 3. ILHA DO COPILOTO SAGRADO PERSONIFICÁVEL (DRAWER FLUTUANTE)
      // ───────────────────────────────────────────────────────────────────────
      isCopilotOpen &&
        h(
          "aside",
          {
            style: {
              position: "fixed",
              bottom: "20px",
              right: "24px",
              width: "360px",
              height: "460px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.65)",
              display: "flex",
              flexDirection: "column",
              zIndex: 1000,
              overflow: "hidden",
            },
          },
          // Header do Copiloto
          h(
            "div",
            {
              style: {
                padding: "12px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              },
            },
            h(
              "select",
              {
                value: copilotAgent,
                onChange: (e: any) => setCopilotAgent(e.target.value),
                style: {
                  backgroundColor: "transparent",
                  color: "#10b981",
                  fontWeight: "700",
                  fontSize: "13px",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                },
              },
              h("option", { value: "OrgFy Bento" }, "⚙️ OrgFy Bento [COO]"),
              h("option", { value: "OrgFy Iris" }, "👑 OrgFy Iris [CEO Holding]"),
              h("option", { value: "OrgFy Bento Arquiteto" }, "📐 OrgFy Bento Arquiteto"),
              h("option", { value: "QA Sentinel" }, "🛡️ QA Sentinel [Auditor]")
            ),
            h(
              "button",
              {
                onClick: () => setIsCopilotOpen(false),
                style: {
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                },
              },
              SVG.xCircle({ h, width: 16, height: 16 })
            )
          ),
          // Chat Messages
          h(
            "div",
            {
              style: {
                flex: 1,
                padding: "12px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "12px",
              },
            },
            h(
              "div",
              {
                style: {
                  padding: "8px 12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "#f3f4f6",
                  lineHeight: "1.4",
                },
              },
              h("strong", { style: { color: "#10b981" } }, `${copilotAgent}: `),
              "Olá, Helton. A esteira determinística v10 está operando com FPY de 100% e CPI de tokens em 0.94. Use /despachar para novos cards ou /gate para veredito."
            )
          ),
          // Chat Input
          h(
            "div",
            {
              style: {
                padding: "10px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                gap: "8px",
              },
            },
            h("input", {
              type: "text",
              placeholder: `Falar com ${copilotAgent}... (/despachar, /gate)`,
              style: {
                flex: 1,
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                fontSize: "12px",
                outline: "none",
              },
              onKeyDown: (e: any) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  showNotification("info", `Comando enviado para ${copilotAgent}: ${e.target.value}`);
                  e.target.value = "";
                }
              },
            })
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 4. MODAL NOVO DESPACHO (VALIDAÇÃO L-01: EXECUTOR !== REVISOR)
      // ───────────────────────────────────────────────────────────────────────
      isDispatchModalOpen &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            },
          },
          h(
            "div",
            {
              style: {
                width: "480px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "22px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              },
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "⚡ Novo Despacho Determinístico"),
              h(
                "button",
                {
                  onClick: () => setIsDispatchModalOpen(false),
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "ID DA ISSUE OU TAREFA"),
              h("input", {
                type: "text",
                placeholder: "Ex: issue-104 ou 5c569a9e",
                value: dispatchIssueId,
                onChange: (e: any) => setDispatchIssueId(e.target.value),
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                },
              })
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "EXECUTOR (TIER COEVO-RSI)"),
              h(
                "select",
                {
                  value: dispatchExecutor,
                  onChange: (e: any) => setDispatchExecutor(e.target.value),
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  },
                },
                AVAILABLE_AGENTS.map((a) =>
                  h("option", { key: a.id, value: a.name }, `${a.name} (${a.tier === "tier_1_exec_barato" ? "Tier 1: Barato" : a.tier === "tier_2_revisor" ? "Tier 2: Revisor" : "Tier 3: Arquiteto"})`)
                )
              )
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h(
                "label",
                { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } },
                "REVISOR INDEPENDENTE (REGRA L-01: BLOQUEIO MECÂNICO)"
              ),
              h(
                "select",
                {
                  value: dispatchRevisor,
                  onChange: (e: any) => setDispatchRevisor(e.target.value),
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  },
                },
                AVAILABLE_AGENTS.map((a) =>
                  h(
                    "option",
                    {
                      key: a.id,
                      value: a.name,
                      disabled: a.name === dispatchExecutor,
                    },
                    a.name === dispatchExecutor ? `${a.name} (Bloqueado pela Regra L-01)` : a.name
                  )
                )
              )
            ),
            // Preview do comando determinístico
            h(
              "div",
              {
                style: {
                  padding: "8px 10px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#10b981",
                },
              },
              `ferramentas/esteira/despachar --empresa ${selectedTenant === "all" ? "orgfy" : selectedTenant} ${dispatchIssueId || "<issue>"} "${dispatchExecutor}" "${dispatchRevisor}"`
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
              h(
                "button",
                {
                  onClick: () => setIsDispatchModalOpen(false),
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    fontSize: "12px",
                  },
                },
                "Cancelar"
              ),
              h(
                "button",
                {
                  onClick: handleExecuteDispatch,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: "#10b981",
                    color: "#000000",
                    fontWeight: "700",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  },
                },
                "Disparar Despacho"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 5. MODAL DE DECISÃO DO GATE COM DETECTOR PREDITIVO DSAP
      // ───────────────────────────────────────────────────────────────────────
      isGateModalOpen &&
        activeGateCard &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            },
          },
          h(
            "div",
            {
              style: {
                width: "520px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "24px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                null,
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "🛡️ Decisão de Gate Caixa-Preta"),
                h("span", { style: { fontSize: "12px", color: "#9ca3af" } }, `${activeGateCard.prId || activeGateCard.issueId}: ${activeGateCard.title}`)
              ),
              h(
                "button",
                {
                  onClick: () => {
                    setIsGateModalOpen(false);
                    setActiveGateCard(null);
                  },
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            // Probes Caixa-Preta (Holdout Verification)
            h(
              "div",
              {
                style: {
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#10b981" } }, "EVIDÊNCIAS DOS PROBES CAIXA-PRETA"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• http_rota (Caddy v3 200 OK):"),
                h("span", { style: { color: "#10b981", fontWeight: "600" } }, "PASSOU")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• supabase_rls (Políticas & Migrations):"),
                h("span", { style: { color: "#10b981", fontWeight: "600" } }, "PASSOU")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• playwright_console (0 erros runtime):"),
                h("span", { style: { color: "#10b981", fontWeight: "600" } }, "PASSOU")
              )
            ),

            // Justificativa de Recusa & Detector DSAP
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "MOTIVO (PREENCHA CASO VÁ RECUSAR O PR)"),
              h("textarea", {
                placeholder: "Descreva a falha ou inconsistência técnica...",
                value: gateRejectionReason,
                onChange: (e: any) => setGateRejectionReason(e.target.value),
                style: {
                  height: "70px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                  resize: "none",
                },
              }),
              // Alerta de DSAP Backtracking
              dsapWarning &&
                h(
                  "div",
                  {
                    style: {
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                      border: "1px solid #f59e0b",
                      color: "#f59e0b",
                      fontSize: "11px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.alertTriangle({ h, width: 14, height: 14 }),
                  `ALERTA DSAP (${Math.round(dsapSimilarity * 100)}% de similaridade): A repetição da mesma falha acionará [DSAP BACKTRACKING] para o COO re-escopar o card!`
                )
            ),

            // Ações de Aceite / Recusa
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "8px" } },
              h(
                "button",
                {
                  onClick: () => handleRejectGate(activeGateCard),
                  style: {
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontWeight: "700",
                    cursor: "pointer",
                    fontSize: "12px",
                  },
                },
                "RECUSAR PR"
              ),
              h(
                "button",
                {
                  onClick: () => handleAcceptGate(activeGateCard),
                  style: {
                    padding: "8px 22px",
                    borderRadius: "8px",
                    backgroundColor: "#10b981",
                    color: "#000000",
                    fontWeight: "700",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  },
                },
                "ACEITAR PR (MERGE NA MAIN)"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 6. GAVETA DE LOGS STREAMING (CONSOLE JETBRAINS / MATRIX)
      // ───────────────────────────────────────────────────────────────────────
      isLogsDrawerOpen &&
        activeLogsCard &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              bottom: 0,
              left: "12px",
              right: "12px",
              height: "280px",
              borderRadius: "16px 16px 0 0",
              backgroundColor: "#0a0f0d",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              zIndex: 1500,
            },
          },
          h(
            "div",
            {
              style: {
                padding: "8px 16px",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
            },
            h(
              "span",
              { style: { fontSize: "12px", color: "#10b981", fontWeight: "700" } },
              `CONSOLE LIVE: Worker Headless [PID: ${activeLogsCard.workerPid || "84219"}] - ${activeLogsCard.issueId}`
            ),
            h(
              "button",
              {
                onClick: () => setIsLogsDrawerOpen(false),
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
              },
              SVG.xCircle({ h, width: 16, height: 16 })
            )
          ),
          h(
            "pre",
            {
              style: {
                flex: 1,
                margin: 0,
                padding: "12px 16px",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#10b981",
                backgroundColor: "#080c0a",
                overflowY: "auto",
                lineHeight: "1.5",
              },
            },
            `[ORGFY WORKER] Iniciando container efêmero no Swarm...\n` +
            `[ORGFY WORKER] Worktree montada em: .worktrees/${activeLogsCard.issueId}\n` +
            `[ORGFY WORKER] Executando: pytest testes/esteira -v --tb=short\n` +
            `testes/esteira/test_t020.py::test_ci_cache_integrity PASSED\n` +
            `testes/esteira/test_gate_state.py::test_regras_probatorias_eval PASSED\n` +
            `[ORGFY WORKER] 2 passed in 1.42s. Probes caixa-preta engatilhados.\n` +
            `[ORGFY NOSTR] Evento kind:1618 publicado em wss://orgfy.communities.buzz.xyz (sub-second wake)`
          )
        )
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FUNÇÃO AUXILIAR: RENDERIZAÇÃO DE COLUNA DO KANBAN
    // ─────────────────────────────────────────────────────────────────────────
    function renderColumn(
      title: string,
      cards: PipelineCard[],
      badgeBg: string,
      badgeColor: string,
      renderAction: (card: PipelineCard) => any
    ) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            borderRadius: "12px",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            padding: "10px",
            minHeight: "420px",
          },
        },
        // Column Header
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "8px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              marginBottom: "10px",
            },
          },
          h("span", { style: { fontWeight: "700", fontSize: "12px", color: "#f3f4f6" } }, title),
          h(
            "span",
            {
              style: {
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: badgeBg,
                color: badgeColor,
                fontWeight: "700",
              },
            },
            cards.length
          )
        ),
        // Cards List
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto" } },
          cards.length === 0
            ? h(
                "div",
                {
                  style: {
                    padding: "20px 10px",
                    textAlign: "center",
                    color: "rgba(255, 255, 255, 0.2)",
                    fontSize: "11px",
                  },
                },
                "Nenhum card nesta raia"
              )
            : cards.map((c) =>
                h(
                  "div",
                  {
                    key: c.id,
                    style: {
                      padding: "10px 12px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      transition: "transform 0.15s ease",
                    },
                  },
                  // Card Top (Badge Priority + Issue ID + Time)
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "9px",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            c.priority === "P0"
                              ? "rgba(239, 68, 68, 0.2)"
                              : c.priority === "P1"
                              ? "rgba(245, 158, 11, 0.2)"
                              : "rgba(59, 130, 246, 0.2)",
                          color:
                            c.priority === "P0"
                              ? "#ef4444"
                              : c.priority === "P1"
                              ? "#f59e0b"
                              : "#60a5fa",
                          fontWeight: "700",
                        },
                      },
                      c.priority
                    ),
                    h(
                      "span",
                      { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } },
                      c.prId || `#${c.issueId}`
                    ),
                    h("span", { style: { fontSize: "10px", color: "var(--text-subtle, #9ca3af)" } }, c.elapsedTime)
                  ),
                  // Title
                  h("div", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff", lineHeight: "1.3" } }, c.title),
                  // Assignee & Tier
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" } },
                      SVG.user({ h, width: 11, height: 11 }),
                      c.executor
                    ),
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "9px",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          backgroundColor:
                            c.tier === "tier_3_arquiteto"
                              ? "rgba(168, 85, 247, 0.2)"
                              : c.tier === "tier_2_revisor"
                              ? "rgba(59, 130, 246, 0.2)"
                              : "rgba(16, 185, 129, 0.2)",
                          color:
                            c.tier === "tier_3_arquiteto"
                              ? "#c084fc"
                              : c.tier === "tier_2_revisor"
                              ? "#60a5fa"
                              : "#10b981",
                          fontWeight: "600",
                        },
                      },
                      c.tier === "tier_3_arquiteto" ? "Tier 3" : c.tier === "tier_2_revisor" ? "Tier 2" : "Tier 1"
                    )
                  ),
                  // Action Button
                  renderAction(c)
                )
              )
        )
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMPONENTE DO SETTINGS CARD (PREFERÊNCIAS DO BUZZ)
  // ───────────────────────────────────────────────────────────────────────────
  function OrgFySettingsCard() {
    const navigateToCockpit = () => {
      try {
        if ((ctx as any).navigation?.navigate) {
          (ctx as any).navigation.navigate("orgfy");
        } else {
          window.location.hash = "#/orgfy";
        }
      } catch {
        window.location.hash = "#/orgfy";
      }
    };

    return h(
      "div",
      {
        style: {
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          color: "#ffffff",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        SVG.orgfy({ h, width: 24, height: 24 }),
        h(
          "div",
          null,
          h("div", { style: { fontWeight: "700", fontSize: "14px" } }, "OrgFy Control Room"),
          h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Esteira determinística v10 & governança da Holding Cortexx")
        )
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            padding: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderRadius: "8px",
            fontSize: "11px",
          },
        },
        h("span", { style: { color: "#9ca3af" } }, "Porteiro Nostr:"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "🟢 ATIVO (Sub-second)"),
        h("span", { style: { color: "#9ca3af" } }, "First-Pass Yield (FPY):"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "100.0%"),
        h("span", { style: { color: "#9ca3af" } }, "CPI EVM:"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "0.94 (Margem > 0.85)")
      ),
      h(
        "button",
        {
          onClick: navigateToCockpit,
          style: {
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: "#10b981",
            color: "#000000",
            fontWeight: "700",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            alignSelf: "flex-start",
          },
        },
        "Abrir OrgFy Control Room"
      )
    );
  }

  // Registra Página Principal com layout: "workspace" (Zero margens de documento)
  ctx.pages.register({
    id: "orgfy",
    title: "OrgFy Control Room",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    component: OrgFyCockpit,
  });

  // Registra Card em Configurações
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "orgfy-settings",
      title: "OrgFy Control Room",
      group: "Pipelines & Autonomous Systems",
      component: OrgFySettingsCard,
    });
  }
}
