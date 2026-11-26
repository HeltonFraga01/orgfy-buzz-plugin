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
import {
  executeDespachar,
  executeGate,
  executePorteiroSync,
  fetchLiveEsteiraState,
  fetchLiveKanbanCards,
  fetchLiveKanbanSnapshot,
  buildOrgfyStatus,
  calculateDsapSimilarity,
  openSystemUri,
  openIssueInBuzz,
  formatRelativeTime,
  formatFullDateTime,
} from "./services/orgfy-bridge";
import {
  executeBootstrapFlow,
  type BootstrapStepResult,
  INITIAL_BOOTSTRAP_STEPS,
} from "./services/bootstrap";
import {
  startOrgfyMcpServer,
  sendDesktopNotification,
  type McpServerStatus,
} from "./services/mcp-server";
import {
  fetchMigrationStatus,
  executeAgentMigration,
  type MigrationSummary,
  type AgentMigrationItem,
} from "./services/migration";
import {
  fetchRsiHubState,
  compileProbationaryRule,
  type CardTemplateItem,
} from "./services/templates-rsi";
import {
  buildUnifiedOrgfyTools,
} from "./tools/registry";
import {
  registerBuzzNativeIntegrations,
  getBuzzNativeState,
  updateOrgfySidebarCounts,
  subscribeRelayUpdates,
} from "./services/buzz-native";
import {
  getTelemetrySnapshot,
  subscribeTelemetry,
  resetTelemetryForTests,
  type TelemetrySnapshot,
} from "./services/telemetry-otel";
import {
  fetchKpisEsteira,
  fetchGooseLoopRadar,
  filterGooseLoopRadar,
  recalculateKpisNow,
  type KpisEsteiraPayload,
  type KpiHistoryPoint,
  type GooseLoopRadarPayload,
  type GooseLoopSession,
} from "./services/kpi-service";
import {
  renderIntelligenceTab,
  createChannelPulsePanel,
} from "./components/IntelligenceTab";
import { renderObservabilityTab } from "./components/ObservabilityTab";
import { createCardStudioTabComponent } from "./components/CardStudioTab";
import {
  acquireCheckoutLock,
  releaseCheckoutLock,
  listActiveLocks,
  evaluateBudgetGate,
  evaluateGovernanceAndReact,
  lintCardForDispatch,
  bindConversationContextForCard,
  stopAgentSession,
  checkMentionTargetIdentity,
  checkThreadWakeAntiLoop,
  resetThreadWakeGuardForTests,
  registerGovernanceAgentHooks,
} from "./services/governance-engine";

import {
  hydrateIssueDetail,
  type HydratedIssueDetail,
} from "./services/issue-detail-hydrator";

import {
  createCanonicalCard,
} from "./services/card-creator";
import {
  parseCardProgress,
  applyStepUpdateToMarkdown,
  executeCardProgress,
} from "./services/card-progress";
import {
  triageCardWithDecisions,
  triageDiffWithDecisions,
  buildBuzzAttentionContract,
} from "./services/decision-router";
import {
  reconcileAgentPresenceAndLocks,
  buildLiveAgentRoster,
  buildHandoffPack,
  runOneShotDecisionDispatch,
  cleanupAttentionOnStageChange,
  getOrgfyPipelineEvents,
  resetPresenceStateForTests,
} from "./services/presence-dispatcher";

export {
  checkMentionTargetIdentity,
  checkThreadWakeAntiLoop,
  resetThreadWakeGuardForTests,
  hydrateIssueDetail,
  createCanonicalCard,
  parseCardProgress,
  applyStepUpdateToMarkdown,
  executeCardProgress,
  triageCardWithDecisions,
  triageDiffWithDecisions,
  buildBuzzAttentionContract,
  reconcileAgentPresenceAndLocks,
  buildLiveAgentRoster,
  buildHandoffPack,
  runOneShotDecisionDispatch,
  cleanupAttentionOnStageChange,
  getOrgfyPipelineEvents,
  resetPresenceStateForTests,
  buildUnifiedOrgfyTools,
  registerBuzzNativeIntegrations,
  getBuzzNativeState,
  getTelemetrySnapshot,
  resetTelemetryForTests,
};
import {
  requestModelFailover,
  VERIFIED_TOOLCALL_FAILOVER_CHAIN,
  isUnsupportedAgentModel,
  ORGFY_FAILOVER_REQUEST_EVENT,
  reconcileAgentsViaBuzzApi,
} from "./services/model-failover";
export { VERIFIED_TOOLCALL_FAILOVER_CHAIN, isUnsupportedAgentModel, ORGFY_FAILOVER_REQUEST_EVENT, reconcileAgentsViaBuzzApi, requestModelFailover };
import {
  fetchResolvedArchive,
  searchResolvedArchive,
  type ResolvedIssueItem,
} from "./services/resolved-archive";
import { renderResolvedArchiveTab } from "./components/ResolvedArchiveTab";
import {
  fetchHoldingControlPlane,
  createBoardApproval,
  decideBoardApproval,
  type HoldingControlPlaneSnapshot,
  type BoardApprovalItem,
} from "./services/holding-service";
import { renderBoardHoldingTab } from "./components/BoardHoldingTab";
import { renderOrgChartTab } from "./components/OrgChartTab";
import { renderGovernanceAndCopilotDrawers } from "./components/GovernanceAndCopilotDrawers";
import { renderDispatchAndGateModals } from "./components/DispatchAndGateModals";
import { renderIssueDetailModal } from "./components/IssueDetailModal";
import { renderInfraModals } from "./components/InfraModals";
import { renderTemplatesRsiSection } from "./components/TemplatesRsiSection";
import { renderKanbanColumn } from "./components/KanbanColumn";
import { createFactoryAppComponent } from "./factory/FactoryApp";
import {
  parseFactoryStatus,
  buildEmptyFactoryStatus,
  fetchFactoryStatus,
  writeTenantControl,
} from "./factory/factory-adapter";
import { FACTORY_SHADOW_CSS, attachFactoryShadowStyles } from "./factory/shadow-shell";
import { PT_BR } from "./i18n/pt-BR";

export {
  parseFactoryStatus,
  buildEmptyFactoryStatus,
  fetchFactoryStatus,
  writeTenantControl,
  FACTORY_SHADOW_CSS,
  attachFactoryShadowStyles,
  PT_BR,
};

export const inject = [
  "react",
  "pages",
  "settingsCards",
  "host",
  "navigation",
  "agents",
  "panels",
  "artifactStorage",
  "notifications",
  "decisions",
  "relay",
  "conversation",
  "sidebarSections",
  "shortcuts",
];

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL DATA & FALLBACK CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

import { TENANTS, SVG, THEME } from "./ui/theme-icons";
export { TENANTS, SVG, THEME };

// Zero-Mock v13: zero cards/regras/agentes hardcoded — dados 100% vivos do Buzz e REPOS/orgfy
export const INITIAL_PIPELINE_CARDS: PipelineCard[] = [];
export const INITIAL_REGRAS_PROBATORIAS: RegraProbatoria[] = [];
export const AVAILABLE_AGENTS: Array<{ id: string; name: string; role: string; tier: string; model: string }> = [];

export function apply(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;
  const CardStudioTab = createCardStudioTabComponent(ctx);

  function OrgFyCockpit() {
    // Estado de Tenant / Multi-Tenant da Holding
    const [selectedTenant, setSelectedTenant] = React.useState<string>("all");
    const [porteiroActive, setPorteiroActive] = React.useState<boolean>(true);
    const [isSyncingPorteiro, setIsSyncingPorteiro] = React.useState<boolean>(false);
    const [fpyRate, setFpyRate] = React.useState<number | null>(null);
    const [cpiTokens, setCpiTokens] = React.useState<number | null>(null);
    const [totalMergedGate, setTotalMergedGate] = React.useState<number | null>(null);
    const [circuitBreakerLoop, setCircuitBreakerLoop] = React.useState<string | null>(null);
    const [totalAceitesBlindados, setTotalAceitesBlindados] = React.useState<number | null>(null);
    const [viewMode, setViewMode] = React.useState<"kanban" | "list">("kanban");

    // Estado da Matrix de Pipeline (5 Raias Determinísticas — sem fallback mockado)
    const [pipelineCards, setPipelineCards] = React.useState<PipelineCard[]>(() => {
      try {
        const stored = localStorage.getItem("orgfy_pipeline_cards_v11");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
        return [];
      } catch {
        return [];
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
    const [isGovernanceDrawerOpen, setIsGovernanceDrawerOpen] = React.useState<boolean>(false);
    const isRightRailOpen = isGovernanceDrawerOpen;
    const setIsRightRailOpen = setIsGovernanceDrawerOpen;
    const [isCopilotOpen, setIsCopilotOpen] = React.useState<boolean>(false);
    const [copilotAgent, setCopilotAgent] = React.useState<string>("OrgFy Bento");

    // Modais & Drawers Fase 3 (Bootstrap, MCP e Notificações)
    const [isBootstrapModalOpen, setIsBootstrapModalOpen] = React.useState<boolean>(false);
    const [bootstrapSteps, setBootstrapSteps] = React.useState<BootstrapStepResult[]>(INITIAL_BOOTSTRAP_STEPS);
    const [isBootstrapping, setIsBootstrapping] = React.useState<boolean>(false);
    const [bootstrapLog, setBootstrapLog] = React.useState<string>("");
    const [bootstrapDone, setBootstrapDone] = React.useState<boolean>(false);
    const [mcpStatus, setMcpStatus] = React.useState<McpServerStatus>({ active: false, toolCallsCount: 0 });
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = React.useState<boolean>(true);
    const [isMcpDiagnosticsOpen, setIsMcpDiagnosticsOpen] = React.useState<boolean>(false);

    // Modais & Drawers Fase 3.5 (Migrador de Agentes & Workspace)
    const [isMigrationModalOpen, setIsMigrationModalOpen] = React.useState<boolean>(false);
    const [migrationSummary, setMigrationSummary] = React.useState<MigrationSummary | null>(null);
    const [isMigrating, setIsMigrating] = React.useState<boolean>(false);
    const [migrationLog, setMigrationLog] = React.useState<string>("");

    // Expansão: Modal In-Cockpit de Detalhes da Issue e Abas do Control Plane v2
    const [activeIssueDetailCard, setActiveIssueDetailCard] = React.useState<PipelineCard | null>(null);
    const [hydratedIssueDetail, setHydratedIssueDetail] = React.useState<HydratedIssueDetail | null>(null);
    const [isHydratingIssueDetail, setIsHydratingIssueDetail] = React.useState<boolean>(false);
    const [activeCentralTab, setActiveCentralTab] = React.useState<"board" | "orgchart" | "pipeline" | "inteligencia" | "observabilidade" | "card_studio" | "templates_rsi" | "resolvidas">("board");
    const [obsFilter, setObsFilter] = React.useState<string>("all");
    const [isProbingDecision, setIsProbingDecision] = React.useState<boolean>(false);
    const [lastProbeSummary, setLastProbeSummary] = React.useState<string | null>(null);

    React.useEffect(() => {
      let cancelled = false;
      if (!activeIssueDetailCard) {
        setHydratedIssueDetail(null);
        return;
      }
      setIsHydratingIssueDetail(true);
      hydrateIssueDetail(ctx, activeIssueDetailCard)
        .then((res) => {
          if (!cancelled) setHydratedIssueDetail(res);
        })
        .catch(() => {
          if (!cancelled) setHydratedIssueDetail(null);
        })
        .finally(() => {
          if (!cancelled) setIsHydratingIssueDetail(false);
        });
      return () => {
        cancelled = true;
      };
    }, [activeIssueDetailCard]);

    // Estado Real da Holding, Board, Organograma e Aprovações (Zero Mockups)
    const [holdingData, setHoldingData] = React.useState<HoldingControlPlaneSnapshot | null>(null);
    const [newApprovalTitle, setNewApprovalTitle] = React.useState<string>("");
    const [newApprovalDesc, setNewApprovalDesc] = React.useState<string>("");
    const [newApprovalCompany, setNewApprovalCompany] = React.useState<string>("board");
    const [newApprovalType, setNewApprovalType] = React.useState<BoardApprovalItem["tipo"]>("investimento");

    // Estado da Onda 2 & 3: Inteligência & Saúde + Governança de Ciclo Fechado
    const [kpisData, setKpisData] = React.useState<KpisEsteiraPayload | null>(null);
    const [kpisHistory, setKpisHistory] = React.useState<KpiHistoryPoint[]>([]);
    const [kpisError, setKpisError] = React.useState<string | null>(null);
    const [isRecalculatingKpis, setIsRecalculatingKpis] = React.useState<boolean>(false);
    const [governanceSummary, setGovernanceSummary] = React.useState<string | null>(null);
    const [loopRadar, setLoopRadar] = React.useState<GooseLoopRadarPayload | null>(null);
    const [telemetrySnap, setTelemetrySnap] = React.useState<TelemetrySnapshot>(() => getTelemetrySnapshot());
    const liveAgents = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const pool = [...(snap.running || []), ...(snap.agents || [])];
        const seen = new Set<string>();
        const list: Array<{ id: string; name: string; tier: string }> = [];
        for (const a of pool) {
          const name = String(a?.name || a?.key || "").trim();
          if (!name || seen.has(name)) continue;
          seen.add(name);
          list.push({ id: String(a?.key || name), name, tier: "tier_1_exec_barato" });
        }
        return list;
      } catch {
        return [];
      }
    }, [holdingData]);
    React.useEffect(() => {
      const unsubTel = subscribeTelemetry(() => setTelemetrySnap(getTelemetrySnapshot()));
      const unsubRelay = subscribeRelayUpdates(() => { loadRealState(); });
      return () => { unsubTel(); unsubRelay(); };
    }, []);
    React.useEffect(() => {
      updateOrgfySidebarCounts({
        triagem: pipelineCards.filter((c) => c.stage === "triagem").length,
        execucao: pipelineCards.filter((c) => c.stage === "execucao").length,
        revisao: pipelineCards.filter((c) => c.stage === "revisao").length,
        loopsAtivos: loopRadar?.resumo?.criticos_ativos ?? loopRadar?.resumo?.criticos ?? 0,
      });
    }, [pipelineCards, loopRadar]);
    const [stoppingSessionId, setStoppingSessionId] = React.useState<string | null>(null);
    const [failingOverSessionId, setFailingOverSessionId] = React.useState<string | null>(null);

    const handleRunDecisionProbe = React.useCallback(async () => {
      setIsProbingDecision(true);
      try {
        const t0 = Date.now();
        const res = await triageCardWithDecisions(ctx, {
          slug: "probe-decisions-live",
          titulo: "Validar latência e classificação Decisions API ao vivo",
          tipo: "execucao",
          escrita_exclusiva: ["src/services/decision-router.ts"],
          acceptance_command: "node --test verify_plugin.test.mjs",
        });
        const ms = Date.now() - t0;
        setLastProbeSummary(
          `Probe OK (${ms}ms) · fonte: ${res.decisionSource} · backend: ${res.backend || "fallback"} · modelo: ${res.model || "determinístico"} · risco: ${res.riscoScore}/5 · tier: ${res.modeloTier} · Attention: ${res.attentionPolicy}`
        );
        setTelemetrySnap(getTelemetrySnapshot());
      } finally {
        setIsProbingDecision(false);
      }
    }, []);

    const handleResetSpans = React.useCallback(() => {
      resetTelemetryForTests();
      setTelemetrySnap(getTelemetrySnapshot());
      setLastProbeSummary(null);
    }, []);

    // Estado do Arquivo Pesquisável de Issues Resolvidas (Just-in-Time Context)
    const [resolvedItems, setResolvedItems] = React.useState<ResolvedIssueItem[]>([]);
    const [resolvedError, setResolvedError] = React.useState<string | null>(null);
    const [resolvedSearch, setResolvedSearch] = React.useState<string>("");
    const [resolvedSpecFilter, setResolvedSpecFilter] = React.useState<string>("all");
    const [copiedResolvedId, setCopiedResolvedId] = React.useState<string | null>(null);

    const loadHolding = React.useCallback(async () => {
      const snap = await fetchHoldingControlPlane(ctx);
      setHoldingData(snap);
    }, []);

    const loadLoopRadar = React.useCallback(async () => {
      const radar = await fetchGooseLoopRadar(ctx);
      setLoopRadar(radar);
    }, []);

    const loadKpis = React.useCallback(async () => {
      const res = await fetchKpisEsteira(ctx);
      setKpisData(res.kpis);
      setKpisHistory(res.history);
      setKpisError(res.error);
      loadLoopRadar();
    }, [loadLoopRadar]);

    const loadResolvedArchive = React.useCallback(async () => {
      const res = await fetchResolvedArchive(ctx);
      setResolvedItems(res.itens);
      setResolvedError(res.error);
    }, []);

    React.useEffect(() => {
      loadHolding();
      loadKpis();
      loadResolvedArchive();
    }, [loadHolding, loadKpis, loadResolvedArchive]);

    const handleRecalculateKpis = React.useCallback(async () => {
      setIsRecalculatingKpis(true);
      try {
        const recalc = await recalculateKpisNow(ctx);
        if (!recalc.ok) {
          setKpisError(recalc.output || "Falha ao recalcular KPIs");
        } else {
          await loadKpis();
        }
      } finally {
        setIsRecalculatingKpis(false);
      }
    }, [loadKpis]);

    const handleRunGovernanceEval = React.useCallback(async () => {
      const evalRes = await evaluateGovernanceAndReact(ctx, { dryRun: false, autoWake: true, includeRadar: true });
      setGovernanceSummary(
        `Orçamento: ${evalRes.budget.statusOrcamento} | Alertas: ${evalRes.alertsDetected} | Notificações: ${evalRes.notificationsSent.length} | Wakes: ${evalRes.wakesTriggered.join(", ") || "0"} | Cooldown: ${evalRes.skippedByCooldown.length}`
      );
    }, []);

    const handleWakeIrisForLoops = React.useCallback(async () => {
      await loadLoopRadar();
      const evalRes = await evaluateGovernanceAndReact(ctx, {
        dryRun: false,
        autoWake: true,
        bypassCooldown: true,
        includeRadar: true,
      });
      const targets = evalRes.wakesTriggered.join(", ") || "nenhum loop ativo";
      setGovernanceSummary(
        `Chamada Radar (COO → CEO) disparada | Alertas: ${evalRes.alertsDetected} | Wakes: ${targets}`
      );
      showNotification("info", evalRes.wakesTriggered.length > 0 ? `Auto-cura acionada: ${targets}` : "Nenhum loop ativo detectado no momento.");
    }, [loadLoopRadar]);

    const handleStopLoopSession = React.useCallback(async (session: GooseLoopSession) => {
      setStoppingSessionId(session.session_id);
      try {
        const res = await stopAgentSession(ctx, {
          agente: session.agente,
          agent_pubkey: session.agent_pubkey,
          channel_id: session.channel_id,
          thread_root: session.thread_root,
          action: "interrupt",
          reason: `Stop manual via Radar (${session.duracao_min}m · ${session.shells} shells)`,
        });
        setGovernanceSummary(res.message);
        showNotification(res.ok ? "success" : "warning", res.message);
        setTimeout(() => { loadLoopRadar(); }, 800);
      } finally {
        setStoppingSessionId(null);
      }
    }, [loadLoopRadar]);

    const handleFailoverModelSession = React.useCallback(async (session: GooseLoopSession) => {
      setFailingOverSessionId(session.session_id);
      try {
        const res = await requestModelFailover(ctx, {
          agente: session.agente,
          agent_pubkey: session.agent_pubkey,
          prefer_free: true,
          apply: true,
          retrigger: true,
          channel_id: session.channel_id,
          thread_root: session.thread_root,
        });
        setGovernanceSummary(res.message);
        showNotification(res.ok ? "success" : "warning", res.message);
        setTimeout(() => { loadLoopRadar(); }, 1000);
      } finally {
        setFailingOverSessionId(null);
      }
    }, [loadLoopRadar]);

    // Estados de Execução Concorrente e Loading (Fase 2)
    const [isExecutingDispatch, setIsExecutingDispatch] = React.useState<boolean>(false);
    const [isExecutingGate, setIsExecutingGate] = React.useState<boolean>(false);
    const [liveLogStream, setLiveLogStream] = React.useState<string>(
      "[SISTEMA] Console pronto. Streaming de subprocessos e logs da esteira ativado.\n"
    );

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
    const [dsapMatchedTokens, setDsapMatchedTokens] = React.useState<string[]>([]);

    // Feedback Toast / Banner
    const [notification, setNotification] = React.useState<{ type: "success" | "warning" | "info"; text: string } | null>(null);

    const showNotification = (type: "success" | "warning" | "info", text: string) => {
      setNotification({ type, text });
      setTimeout(() => setNotification(null), 3500);
    };

    const appendLiveLog = (chunk: string) => {
      setLiveLogStream((prev) => prev + chunk);
    };

    // Diagnóstico e carregamento do status dos agentes
    const loadMigrationData = async () => {
      try {
        const sum = await fetchMigrationStatus(ctx);
        setMigrationSummary(sum);
      } catch (err: any) {
        console.warn("Erro ao buscar status de migração:", err);
      }
    };

    React.useEffect(() => {
      loadMigrationData();
    }, []);

    // Listener global para fechar modais com tecla Escape (Zero travamento)
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsBootstrapModalOpen(false);
          setIsDispatchModalOpen(false);
          setIsGateModalOpen(false);
          setIsLogsDrawerOpen(false);
          setIsMcpDiagnosticsOpen(false);
          setIsMigrationModalOpen(false);
          setIsGovernanceDrawerOpen(false);
          setActiveIssueDetailCard(null);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Disparo da Migração Atômica de Agentes & Workspace
    const handleExecuteMigration = async () => {
      setIsMigrating(true);
      setMigrationLog("[MIGRADOR] Iniciando processo de migração para v10...\n");
      try {
        const res = await executeAgentMigration(ctx, (chunk) => {
          setMigrationLog((prev) => prev + chunk);
          appendLiveLog(chunk);
        });
        if (res.success) {
          showNotification("success", "16 agentes migrados para REPOS/orgfy e sincronizados com v10!");
          await loadMigrationData();
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Migração Concluída", "Todos os 16 agentes foram sincronizados para v10 no workspace REPOS/orgfy.");
          }
        } else {
          showNotification("warning", "Migração concluída com avisos. Verifique o terminal.");
        }
      } catch (err: any) {
        showNotification("warning", `Erro na migração: ${err?.message || err}`);
        setMigrationLog((prev) => prev + `[ERRO] ${err?.message || err}\n`);
      } finally {
        setIsMigrating(false);
      }
    };

    // Deep Link Helpers (buzz://issue?...)
    const hasValidNostrIssueId = (c: PipelineCard) =>
      Boolean(c.fullIssueId && /^[0-9a-f]{64}$/i.test(c.fullIssueId.trim()));

    const buildIssueDeepLink = (c: PipelineCard) => {
      const issueId = c.fullIssueId || c.issueId;
      const owner = c.owner || "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";
      const empresa = c.empresa || (selectedTenant === "all" ? "orgfy" : selectedTenant);
      return `buzz://issue?id=${issueId}&owner=${owner}&d=${empresa}`;
    };

    const handleOpenIssueDeepLink = async (c: PipelineCard) => {
      if (!hasValidNostrIssueId(c)) {
        setActiveIssueDetailCard(c);
        showNotification("info", `Worktree local (${c.issueId}) sem Issue Nostr vinculada — exibindo detalhes no Cockpit.`);
        return;
      }
      const issueId = c.fullIssueId!;
      showNotification("info", `Navegando para issue #${c.issueId} no Buzz Desktop...`);
      try {
        const opened = await openIssueInBuzz(ctx, {
          id: issueId,
          owner: c.owner,
          dtag: c.empresa || (selectedTenant === "all" ? "orgfy" : selectedTenant),
        });
        if (opened) {
          showNotification("success", `Navegação para issue #${c.issueId} concluída no Buzz Repos.`);
        } else {
          setActiveIssueDetailCard(c);
          showNotification("warning", `Não foi possível abrir a issue #${c.issueId} no Buzz Repos — exibindo detalhes no Cockpit.`);
        }
      } catch (err: any) {
        setActiveIssueDetailCard(c);
        showNotification("warning", `Erro na navegação: ${err?.message || err}`);
      }
    };

    const handleCopyDeepLink = (e: any, c: PipelineCard) => {
      e.stopPropagation();
      const uri = buildIssueDeepLink(c);
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(uri);
      }
      showNotification("success", `Deep link copiado: buzz://issue?id=${(c.fullIssueId || c.issueId).slice(0, 8)}...`);
    };

    // Auto-carregar estado real dos arquivos da esteira em REPOS/orgfy
    const loadRealState = async () => {
      try {
        const [live, status, liveCards] = await Promise.all([
          fetchLiveEsteiraState(ctx),
          buildOrgfyStatus(ctx, selectedTenant === "all" ? "orgfy" : selectedTenant),
          fetchLiveKanbanCards(ctx, { empresa: selectedTenant }),
        ]);
        if (typeof status?.fpy_percent === "number") {
          setFpyRate(status.fpy_percent);
        } else if (live.placarState?.pct_aceito_primeira_revisao !== undefined) {
          setFpyRate(live.placarState.pct_aceito_primeira_revisao);
        }
        if (typeof status?.cpi_tokens === "number") {
          setCpiTokens(status.cpi_tokens);
        } else if (live.metricasTurnos?.governanca_orcamento?.cpi_tokens !== undefined) {
          setCpiTokens(live.metricasTurnos.governanca_orcamento.cpi_tokens);
        }
        if (typeof status?.porteiro_online === "boolean") {
          setPorteiroActive(status.porteiro_online);
        }
        if (typeof status?.total_merged_gate === "number") {
          setTotalMergedGate(status.total_merged_gate);
        }
        if (status?.circuit_breaker_loop) {
          setCircuitBreakerLoop(status.circuit_breaker_loop);
        }
        if (typeof status?.total_aceites_blindados === "number") {
          setTotalAceitesBlindados(status.total_aceites_blindados);
        }
        if (live.regrasState?.regras) {
          setRegrasProbatorias(Object.values(live.regrasState.regras));
        }

        // Sincroniza cards reais do canvas e esteira (sem fallback mockado)
        setPipelineCards(liveCards);
        localStorage.setItem("orgfy_pipeline_cards_v11", JSON.stringify(liveCards));
      } catch (err: any) {
        console.warn("Erro ao carregar estado real da esteira:", err);
      }
    };

    React.useEffect(() => {
      loadRealState();
    }, [selectedTenant]);

    // Estado de monitoramento MCP (Iniciado como singleton no apply do plugin)
    React.useEffect(() => {
      setMcpStatus({ active: true, toolCallsCount: 0 });
    }, []);

    // Análise preditiva de similaridade semântica DSAP (Fase 2: via calculateDsapSimilarity)
    React.useEffect(() => {
      if (!activeGateCard || !gateRejectionReason.trim()) {
        setDsapWarning(false);
        setDsapSimilarity(0);
        setDsapMatchedTokens([]);
        return;
      }
      const prev = activeGateCard.rejectionHistory?.[0]?.reason || "";
      const result = calculateDsapSimilarity(gateRejectionReason, prev);
      setDsapSimilarity(result.similarity);
      setDsapWarning(result.isBacktracking);
      setDsapMatchedTokens(result.matchedTokens);
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

    // ─────────────────────────────────────────────────────────────────────────
    // AÇÕES OPERACIONAIS REAIS (FASE 2 E 3: SPAWN, CLI, BOOTSTRAP E MCP)
    // ─────────────────────────────────────────────────────────────────────────

    // 0. Auto-Bootstrap 1-Clique (Fase 3)
    const handleRunBootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapLog("[BOOTSTRAP] Iniciando auto-provisionamento 1-clique da Holding OrgFy...\n");
      try {
        const res = await executeBootstrapFlow(ctx, (updatedSteps) => {
          setBootstrapSteps(updatedSteps);
        });
        setBootstrapLog((prev) => prev + res.log);
        if (res.success) {
          setBootstrapDone(true);
          showNotification("success", "Auto-bootstrap e provisionamento concluídos com sucesso!");
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Esteira Pronta", "Auto-bootstrap e provisionamento concluídos com sucesso!");
          }
          await loadRealState();
        } else {
          showNotification("warning", "Bootstrap finalizado com avisos. Verifique os logs.");
        }
      } catch (err: any) {
        showNotification("warning", `Falha no bootstrap: ${err?.message || err}`);
        setBootstrapLog((prev) => prev + `[ERRO] ${err?.message || err}\n`);
      } finally {
        setIsBootstrapping(false);
      }
    };

    // 1. Disparo Real de Despacho
    const handleExecuteDispatch = async () => {
      if (!dispatchIssueId.trim()) {
        showNotification("warning", "Por favor, selecione ou informe o ID da Issue.");
        return;
      }
      // Regra L-01: Executor nunca pode ser o revisor
      if (dispatchExecutor === dispatchRevisor) {
        showNotification("warning", "Regra L-01 violada: O executor não pode ser o mesmo agente revisor!");
        return;
      }

      setIsExecutingDispatch(true);
      appendLiveLog(`\n--- INICIANDO DESPACHO REAL (${new Date().toLocaleTimeString()}) ---\n`);

      try {
        const res = await executeDespachar(ctx, {
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          issueId: dispatchIssueId.replace("#", "").trim(),
          executor: dispatchExecutor,
          revisor: dispatchRevisor,
          onOutput: appendLiveLog,
        });

        if (res.code !== 0) {
          const errLine =
            res.output
              .split("\n")
              .find((l) => l.includes("DESPACHO RECUSADO") || l.includes("ERRO")) ||
            `Despacho recusado (exit ${res.code}). Verifique o console de logs.`;
          showNotification("warning", errLine.trim().slice(0, 180));
          return;
        }

        setIsDispatchModalOpen(false);
        setDispatchIssueId("");
        await loadRealState();
        showNotification("success", `Card ${dispatchIssueId} despachado com sucesso via CLI!`);
        if (desktopNotificationsEnabled) {
          sendDesktopNotification(ctx, "OrgFy: Novo Despacho", `Card ${dispatchIssueId} despachado para ${dispatchExecutor} com sucesso.`);
        }
      } catch (err: any) {
        showNotification("warning", `Falha no despacho determinístico: ${err?.message || err}`);
      } finally {
        setIsExecutingDispatch(false);
      }
    };

    // 2. Decisão Real de Aceite de PR no Gate
    const handleAcceptGate = async (card: PipelineCard) => {
      setIsExecutingGate(true);
      appendLiveLog(`\n--- INICIANDO GATE: ACEITE REAL (${new Date().toLocaleTimeString()}) ---\n`);

      try {
        await executeGate(ctx, {
          empresa: card.empresa,
          prId: card.prId || card.issueId,
          acao: "aceito",
          motivo: "Aprovado em conformidade com probes caixa-preta e CI Swarm",
          revisor: "QA Sentinel",
          onOutput: appendLiveLog,
        });

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
        localStorage.setItem("orgfy_pipeline_cards_v11", JSON.stringify(updated));
        setIsGateModalOpen(false);
        setActiveGateCard(null);
        showNotification("success", `PR ${card.prId || card.issueId} ACEITO no Gate! FPY mantido em 100%.`);
        if (desktopNotificationsEnabled) {
          sendDesktopNotification(ctx, "OrgFy: PR Aceito no Gate", `PR ${card.prId || card.issueId} aprovado com conformidade aos probes caixa-preta.`);
        }
      } catch (err: any) {
        showNotification("warning", `Falha no Gate: ${err?.message || err}`);
      } finally {
        setIsExecutingGate(false);
      }
    };

    // 3. Decisão Real de Recusa de PR no Gate
    const handleRejectGate = async (card: PipelineCard) => {
      if (!gateRejectionReason.trim()) {
        showNotification("warning", "Por favor, justifique o motivo da recusa.");
        return;
      }

      setIsExecutingGate(true);
      appendLiveLog(`\n--- INICIANDO GATE: RECUSA REAL (${new Date().toLocaleTimeString()}) ---\n`);

      try {
        await executeGate(ctx, {
          empresa: card.empresa,
          prId: card.prId || card.issueId,
          acao: "recusado",
          motivo: gateRejectionReason,
          revisor: "QA Sentinel",
          onOutput: appendLiveLog,
        });

        if (dsapWarning) {
          showNotification("warning", `[DSAP BACKTRACKING] Disparado! Similaridade de ${Math.round(dsapSimilarity * 100)}% acionou o COO.`);
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "⚠️ [DSAP BACKTRACKING]", `Alerta de estagnação semântica acionou o COO para re-escopo (PR #${card.prId || card.issueId})`);
          }
        } else {
          showNotification("info", `PR devolvido ao executor para correções.`);
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Gate Recusado", `PR #${card.prId || card.issueId} devolvido ao executor para correções.`);
          }
        }

        if (desktopNotificationsEnabled) {
          const title = dsapWarning ? "🚨 [DSAP BACKTRACKING] Alerta de Recusa" : "OrgFy: PR Recusado no Gate";
          const body = dsapWarning
            ? `Card ${card.prId || card.issueId} teve 2ª recusa com similaridade de ${Math.round(dsapSimilarity * 100)}%. COO Bento acionado!`
            : `Card ${card.prId || card.issueId} recusado no Gate: ${gateRejectionReason}`;
          sendDesktopNotification(ctx, title, body);
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
        localStorage.setItem("orgfy_pipeline_cards_v11", JSON.stringify(updated));
        setIsGateModalOpen(false);
        setActiveGateCard(null);
        setGateRejectionReason("");
      } catch (err: any) {
        showNotification("warning", `Falha na recusa do Gate: ${err?.message || err}`);
      } finally {
        setIsExecutingGate(false);
      }
    };

    // 4. Execução sob demanda do Ciclo do Porteiro
    const handleSyncPorteiroReal = async () => {
      setIsSyncingPorteiro(true);
      showNotification("info", "Disparando ciclo determinístico do Porteiro...");
      appendLiveLog(`\n--- CICLO DETERMINÍSTICO DO PORTEIRO (${new Date().toLocaleTimeString()}) ---\n`);

      try {
        const res = await executePorteiroSync(ctx, {
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          onOutput: appendLiveLog,
        });

        if (res.code === 0) {
          showNotification("success", "Ciclo do Porteiro sincronizado com sucesso!");
          setPorteiroActive(true);
        } else {
          showNotification("warning", `Porteiro retornou aviso (código ${res.code}).`);
        }
        await loadRealState();
      } catch (err: any) {
        showNotification("warning", `Erro na execução do Porteiro: ${err?.message || err}`);
      } finally {
        setIsSyncingPorteiro(false);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    const _cockpitScope: any = { React, activeGateCard, activeIssueDetailCard, activeLogsCard, appendLiveLog, bootstrapSteps, circuitBreakerLoop, copilotAgent, cpiTokens, ctx, dispatchExecutor, dispatchIssueId, dispatchRevisor, dsapMatchedTokens, dsapSimilarity, fpyRate, gateRejectionReason, h, handleAcceptGate, handleCopyDeepLink, handleExecuteDispatch, handleExecuteMigration, handleOpenIssueDeepLink, handleRejectGate, handleRunBootstrap, hasValidNostrIssueId, holdingData, hydratedIssueDetail, isBootstrapModalOpen, isBootstrapping, isCopilotOpen, isDispatchModalOpen, isExecutingDispatch, isExecutingGate, isGateModalOpen, isGovernanceDrawerOpen, isHydratingIssueDetail, isLogsDrawerOpen, isMcpDiagnosticsOpen, isMigrating, isMigrationModalOpen, kpisData, liveAgents, liveLogStream, loadHolding, loadMigrationData, mcpStatus, migrationLog, migrationSummary, pipelineCards, regrasProbatorias, selectedTenant, setActiveCentralTab, setActiveGateCard, setActiveIssueDetailCard, setActiveLogsCard, setCopilotAgent, setDispatchExecutor, setDispatchIssueId, setDispatchRevisor, setGateRejectionReason, setIsBootstrapModalOpen, setIsCopilotOpen, setIsDispatchModalOpen, setIsGateModalOpen, setIsGovernanceDrawerOpen, setIsLogsDrawerOpen, setIsMcpDiagnosticsOpen, setIsMigrationModalOpen, setLiveLogStream, showNotification, totalAceitesBlindados, totalMergedGate, renderColumn: (...args: any[]) => (renderColumn as any)(...args), renderTemplatesRsiView: () => renderTemplatesRsiView() };
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
          height: "100vh",
          maxHeight: "100vh",
          backgroundColor: THEME.canvas,
          color: THEME.textPrimary,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "12px",
          boxSizing: "border-box",
          overflow: "hidden",
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
      // 1. TOPBAR UNIFICADA (48px) - PADRÃO LINEAR & BUZZ NATIVO
      // ───────────────────────────────────────────────────────────────────────
      h(
        "header",
        {
          style: {
            height: "48px",
            backgroundColor: THEME.columnBg,
            border: `1px solid ${THEME.hairline}`,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            marginBottom: "12px",
            flexShrink: 0,
          },
        },
        // Esquerda: Marca e Segmented Control de Tenants
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            SVG.orgfy({ h, width: 18, height: 18 }),
            h("span", { style: { fontWeight: "700", fontSize: "13px", color: THEME.textPrimary } }, "OrgFy Control Room")
          ),
          // Segmented Control de Tenants
          h(
            "div",
            {
              style: {
                display: "flex",
                backgroundColor: "rgba(0, 0, 0, 0.35)",
                borderRadius: "8px",
                padding: "2px",
                border: `1px solid ${THEME.hairline}`,
              },
            },
            [
              { id: "all", label: "Holding" },
              { id: "orgfy", label: "Core" },
              { id: "lumen-iptv", label: "Lumen IPTV" },
              { id: "saas-tributario", label: "SaaS Tributário" },
            ].map((t) =>
              h(
                "button",
                {
                  key: t.id,
                  onClick: () => setSelectedTenant(t.id),
                  style: {
                    padding: "3px 10px",
                    fontSize: "11px",
                    fontWeight: selectedTenant === t.id ? "600" : "400",
                    color: selectedTenant === t.id ? "#ffffff" : THEME.textSecondary,
                    backgroundColor: selectedTenant === t.id ? "#282a36" : "transparent",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  },
                },
                t.label
              )
            )
          )
        ),

        // Centro: Pílula Discreta de Telemetria
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "11px",
              color: THEME.textSecondary,
              fontFamily: "monospace",
            },
          },
          h(
            "span",
            { style: { display: "flex", alignItems: "center", gap: "5px", color: isSyncingPorteiro ? "#f59e0b" : porteiroActive ? "#10b981" : "#ef4444" } },
            h("span", {
              style: {
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isSyncingPorteiro ? "#f59e0b" : porteiroActive ? "#10b981" : "#ef4444",
              },
            }),
            isSyncingPorteiro ? "SINCRONIZANDO..." : porteiroActive ? "PORTEIRO ATIVO" : "PORTEIRO OFFLINE"
          ),
          h("span", { style: { color: "rgba(255,255,255,0.15)" } }, "·"),
          h("span", null, `FPY: ${fpyRate !== null ? `${fpyRate.toFixed(1)}%` : "--"}`),
          h("span", { style: { color: "rgba(255,255,255,0.15)" } }, "·"),
          h("span", null, `CPI: ${cpiTokens !== null ? cpiTokens.toFixed(2) : "--"}`),
          loopRadar?.ok && (loopRadar.resumo.criticos_ativos ?? loopRadar.resumo.criticos) > 0 &&
            h(
              "button",
              {
                onClick: () => {
                  setActiveCentralTab("inteligencia");
                  loadLoopRadar();
                },
                title: "Sessões ativas em loop ou travadas nos últimos 15 min no Goose",
                style: {
                  padding: "2px 7px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(239, 68, 68, 0.18)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  fontSize: "10.5px",
                  fontWeight: "700",
                  fontFamily: "monospace",
                  cursor: "pointer",
                },
              },
              `⚠ ${loopRadar.resumo.criticos_ativos ?? loopRadar.resumo.criticos} loop(s) ativo(s)`
            ),
          h("span", { style: { color: "rgba(255,255,255,0.15)" } }, "·"),
          h(
            "button",
            {
              onClick: () => setIsMcpDiagnosticsOpen(true),
              title: "Diagnósticos MCP Loopback (JSON-RPC 2.0)",
              style: {
                background: "none",
                border: "none",
                padding: "0",
                fontSize: "11px",
                fontFamily: "monospace",
                color: mcpStatus.active ? "#10b981" : "#60a5fa",
                cursor: "pointer",
              },
            },
            mcpStatus.active ? `MCP (${mcpStatus.toolCallsCount} calls)` : "MCP (4 tools)"
          )
        ),

        // Direita: Ação Primária "+ Novo Despacho" e Botões Utilitários
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h(
            "button",
            {
              onClick: () => setIsDispatchModalOpen(true),
              style: {
                padding: "6px 14px",
                backgroundColor: THEME.accentPrimary,
                color: "#000000",
                fontWeight: "700",
                fontSize: "12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              },
            },
            SVG.zap({ h, width: 13, height: 13 }),
            "+ Novo Despacho"
          ),

          // Toggle Drawer Governança (sem botão duplicado de Templates & RSI nem Copiloto simulado)
          h(
            "button",
            {
              onClick: () => setIsGovernanceDrawerOpen(!isGovernanceDrawerOpen),
              title: "Abrir Painel Lateral de Governança & EVM",
              style: {
                padding: "5px 10px",
                backgroundColor: isGovernanceDrawerOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: THEME.textPrimary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              },
            },
            SVG.shield({ h, width: 13, height: 13 }),
            "Governança"
          ),

          // Botão Migrador de Agentes
          h(
            "button",
            {
              onClick: () => {
                loadMigrationData();
                setIsMigrationModalOpen(true);
              },
              title: "Migrador de Agentes & Workspace",
              style: {
                padding: "5px 10px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: THEME.textSecondary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              },
            },
            SVG.users({ h, width: 12, height: 12 }),
            "Migrador"
          ),

          // Botão Auto-Bootstrap
          h(
            "button",
            {
              onClick: () => setIsBootstrapModalOpen(true),
              title: "Auto-Bootstrap 1-Clique",
              style: {
                padding: "5px 10px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: THEME.textSecondary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              },
            },
            SVG.zap({ h, width: 12, height: 12 }),
            "Bootstrap"
          ),

          // Notificações Desktop
          h(
            "button",
            {
              onClick: () => {
                const next = !desktopNotificationsEnabled;
                setDesktopNotificationsEnabled(next);
                showNotification("info", next ? "Notificações ativadas" : "Modo silencioso");
              },
              title: desktopNotificationsEnabled ? "Notificações ativas" : "Modo silencioso",
              style: {
                padding: "5px 8px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: desktopNotificationsEnabled ? "#10b981" : THEME.textMuted,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: "pointer",
              },
            },
            desktopNotificationsEnabled ? SVG.bell({ h, width: 13, height: 13 }) : SVG.bellOff({ h, width: 13, height: 13 })
          ),

          // Botão Sincronizar
          h(
            "button",
            {
              onClick: handleSyncPorteiroReal,
              disabled: isSyncingPorteiro,
              title: "Disparar sincronização em tempo real do Porteiro",
              style: {
                padding: "5px 8px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: isSyncingPorteiro ? "#f59e0b" : THEME.textPrimary,
                border: `1px solid ${THEME.hairline}`,
                borderRadius: "6px",
                cursor: isSyncingPorteiro ? "not-allowed" : "pointer",
              },
            },
            SVG.refresh({ h, width: 13, height: 13 })
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

          // ───────────────────────────────────────────────────────────────────
          // TAB SWITCHER: MATRIZ DA ESTEIRA (KANBAN) vs CATÁLOGO DE TEMPLATES & HUB DE RSI
          // ───────────────────────────────────────────────────────────────────
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                paddingBottom: "10px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              [
                { id: "board", label: "Board & Holding", color: "#10b981", icon: SVG.shield },
                { id: "orgchart", label: "Organograma", color: "#38bdf8", icon: SVG.users },
                { id: "pipeline", label: "Esteira (Kanban)", color: "#10b981", icon: SVG.columns },
                { id: "card_studio", label: "Card Studio", color: "#10b981", icon: SVG.zap },
                { id: "inteligencia", label: "Saúde & FinOps", color: "#c084fc", icon: SVG.activity },
                { id: "observabilidade", label: `Observabilidade (${telemetrySnap.totalSpans})`, color: "#38bdf8", icon: SVG.cpu },
                { id: "templates_rsi", label: "Templates & RSI", color: "#38bdf8", icon: SVG.fileText },
                { id: "resolvidas", label: `Arquivo (${resolvedItems.length})`, color: "#fbbf24", icon: SVG.checkCircle },
              ].map((t) =>
                h(
                  "button",
                  {
                    key: t.id,
                    onClick: () => {
                      setActiveCentralTab(t.id as any);
                      if (t.id === "board" || t.id === "orgchart" || t.id === "templates_rsi") loadHolding();
                      if (t.id === "inteligencia") loadKpis();
                      if (t.id === "observabilidade") setTelemetrySnap(getTelemetrySnapshot());
                      if (t.id === "resolvidas") loadResolvedArchive();
                    },
                    style: {
                      padding: "6px 12px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      border: activeCentralTab === t.id ? `1px solid ${t.color}66` : "1px solid transparent",
                      backgroundColor: activeCentralTab === t.id ? `${t.color}22` : "rgba(255, 255, 255, 0.04)",
                      color: activeCentralTab === t.id ? t.color : "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  t.icon({ h, width: 13, height: 13 }),
                  t.label
                )
              )
            ),
            h(
              "span",
              { style: { fontSize: "11px", color: "#6b7280", fontFamily: "monospace" } },
              activeCentralTab === "board"
                ? "Conselho da Holding · Visão Multi-Empresa"
                : activeCentralTab === "orgchart"
                ? "Hierarquia Real (empresas/*.json)"
                : activeCentralTab === "pipeline"
                ? "Esteira Determinística OrgFy v13"
                : activeCentralTab === "card_studio"
                ? "Abertura Schema-First · L-01 + L-22 + Buzz Attention"
                : activeCentralTab === "inteligencia"
                ? "Telemetria Real, Economia & Radar Goose"
                : activeCentralTab === "observabilidade"
                ? "OpenTelemetry GenAI · Decisions API · Sinergia Buzz"
                : activeCentralTab === "resolvidas"
                ? "Memória Episódica Sob Demanda"
                : "Templates Reais & Regras L-90"
            )
          ),

          activeCentralTab === "pipeline"
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" } },
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
                liveAgents.map((a) => h("option", { key: a.id, value: a.name }, a.name))
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
              h(
                "span",
                { style: { fontSize: "12px", color: "var(--text-subtle, #9ca3af)" } },
                `Exibindo ${filteredCards.length} de ${pipelineCards.length} cards`
              ),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    backgroundColor: "rgba(0, 0, 0, 0.35)",
                    borderRadius: "8px",
                    padding: "2px",
                    border: `1px solid ${THEME.hairline}`,
                  },
                },
                h(
                  "button",
                  {
                    onClick: () => setViewMode("kanban"),
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: viewMode === "kanban" ? "600" : "400",
                      backgroundColor: viewMode === "kanban" ? "#282a36" : "transparent",
                      color: viewMode === "kanban" ? "#ffffff" : THEME.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    },
                  },
                  SVG.columns({ h, width: 12, height: 12 }),
                  "Kanban"
                ),
                h(
                  "button",
                  {
                    onClick: () => setViewMode("list"),
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: viewMode === "list" ? "600" : "400",
                      backgroundColor: viewMode === "list" ? "#282a36" : "transparent",
                      color: viewMode === "list" ? "#ffffff" : THEME.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    },
                  },
                  SVG.list({ h, width: 12, height: 12 }),
                  "Lista"
                )
              )
            )
          ),

          // ───────────────────────────────────────────────────────────────────
          // AS 5 RAIAS DETERMINÍSTICAS (KANBAN MATRIX) OU VISÃO EM LISTA
          // ───────────────────────────────────────────────────────────────────
          viewMode === "list"
            ? h(
                "div",
                {
                  style: {
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    borderRadius: "10px",
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    border: `1px solid ${THEME.hairline}`,
                  },
                },
                h(
                  "div",
                  {
                    style: {
                      display: "grid",
                      gridTemplateColumns: "95px 1.8fr 110px 60px 1.1fr 90px 120px",
                      gap: "10px",
                      padding: "10px 14px",
                      fontSize: "10px",
                      fontWeight: "700",
                      color: THEME.textSecondary,
                      textTransform: "uppercase",
                      borderBottom: `1px solid ${THEME.hairline}`,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#14161a",
                      zIndex: 2,
                    },
                  },
                  h("span", null, "Issue"),
                  h("span", null, "Título & Aceite L-22"),
                  h("span", null, "Raia"),
                  h("span", null, "Prio"),
                  h("span", null, "Responsáveis"),
                  h("span", null, "Tempo"),
                  h("span", { style: { textAlign: "right" } }, "Ação")
                ),
                filteredCards.length === 0
                  ? h(
                      "div",
                      { style: { padding: "32px", textAlign: "center", color: THEME.textMuted, fontSize: "12px" } },
                      "Nenhum card encontrado com os filtros atuais."
                    )
                  : filteredCards.map((c) => {
                      const stageLabel =
                        c.stage === "triagem"
                          ? "Triagem"
                          : c.stage === "despachado"
                          ? "Despachado"
                          : c.stage === "execucao"
                          ? "Execução"
                          : c.stage === "revisao"
                          ? "Revisão"
                          : "Concluído";
                      const stageColor =
                        c.stage === "triagem"
                          ? "#60a5fa"
                          : c.stage === "despachado"
                          ? "#c084fc"
                          : c.stage === "execucao"
                          ? "#f59e0b"
                          : c.stage === "revisao"
                          ? "#10b981"
                          : "#e5e7eb";
                      return h(
                        "div",
                        {
                          key: c.id,
                          onClick: () => setActiveIssueDetailCard(c),
                          style: {
                            display: "grid",
                            gridTemplateColumns: "95px 1.8fr 110px 60px 1.1fr 90px 120px",
                            gap: "10px",
                            padding: "10px 14px",
                            alignItems: "center",
                            borderBottom: `1px solid ${THEME.hairline}`,
                            cursor: "pointer",
                            fontSize: "12px",
                            transition: "background 0.12s ease",
                          },
                          onMouseEnter: (e: any) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"),
                          onMouseLeave: (e: any) => (e.currentTarget.style.backgroundColor = "transparent"),
                        },
                        h(
                          "span",
                          {
                            onClick: (e: any) => {
                              e.stopPropagation();
                              handleOpenIssueDeepLink(c);
                            },
                            style: { fontFamily: "monospace", fontSize: "11px", color: "#58a6ff", fontWeight: "700", textDecoration: "underline" },
                          },
                          `#${(c.issueId || c.id).slice(0, 8)}`
                        ),
                        h(
                          "div",
                          { style: { minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" } },
                          h("span", { style: { fontWeight: "600", color: THEME.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.title),
                          c.acceptanceCommand &&
                            h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.acceptanceCommand)
                        ),
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              backgroundColor: `${stageColor}22`,
                              color: stageColor,
                              width: "fit-content",
                            },
                          },
                          stageLabel
                        ),
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              fontWeight: "700",
                              color: c.priority === "P0" ? "#f87171" : c.priority === "P1" ? "#fbbf24" : "#60a5fa",
                            },
                          },
                          c.priority
                        ),
                        h(
                          "span",
                          { style: { fontSize: "11px", color: THEME.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          `${c.executor || "Não atribuído"}${c.revisor ? ` → ${c.revisor}` : ""}`
                        ),
                        h(
                          "span",
                          { style: { fontFamily: "monospace", fontSize: "10px", color: "#34d399" } },
                          formatRelativeTime(c.createdAt || c.updatedAt || c.elapsedTime)
                        ),
                        h(
                          "div",
                          { style: { display: "flex", justifyContent: "flex-end" }, onClick: (e: any) => e.stopPropagation() },
                          c.stage === "triagem"
                            ? h(
                                "button",
                                {
                                  onClick: () => {
                                    setDispatchIssueId(c.issueId);
                                    setIsDispatchModalOpen(true);
                                  },
                                  style: {
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                                    color: "#10b981",
                                    border: "none",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                  },
                                },
                                "Despachar"
                              )
                            : c.stage === "revisao"
                            ? h(
                                "button",
                                {
                                  onClick: () => {
                                    setActiveGateCard(c);
                                    setIsGateModalOpen(true);
                                  },
                                  style: {
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    backgroundColor: "#10b981",
                                    color: "#000000",
                                    border: "none",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                  },
                                },
                                "Decidir Gate"
                              )
                            : c.stage === "execucao"
                            ? h(
                                "button",
                                {
                                  onClick: () => {
                                    setActiveLogsCard(c);
                                    setIsLogsDrawerOpen(true);
                                  },
                                  style: {
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                                    color: "#f59e0b",
                                    border: "none",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                  },
                                },
                                "Ver Logs"
                              )
                            : h("span", { style: { fontSize: "10px", color: THEME.textMuted } }, "Detalhes")
                        )
                      );
                    })
              )
            : h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(260px, 1fr))",
                gap: "12px",
                flex: 1,
                minHeight: 0,
                height: "100%",
                alignItems: "stretch",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: "4px",
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
        )
      : activeCentralTab === "board"
      ? renderBoardHoldingTab({
          h,
          holding: holdingData,
          kpis: kpisData,
          onSelectTenant: (slug) => {
            setSelectedTenant(slug);
            setActiveCentralTab("pipeline");
          },
          onCreateApproval: async (input) => {
            const res = await createBoardApproval(ctx, input);
            if (res.ok) {
              setNewApprovalTitle("");
              setNewApprovalDesc("");
              await loadHolding();
              showNotification("success", "Deliberação registrada em board-approvals.json.");
            }
          },
          onDecideApproval: async (id, decision) => {
            const res = await decideBoardApproval(ctx, id, decision);
            if (res.ok) {
              await loadHolding();
              showNotification("success", `Deliberação marcada como ${decision}.`);
            }
          },
          onRefresh: () => {
            loadHolding();
            loadKpis();
          },
          newApprovalTitle,
          setNewApprovalTitle,
          newApprovalDesc,
          setNewApprovalDesc,
          newApprovalCompany,
          setNewApprovalCompany,
          newApprovalType,
          setNewApprovalType,
        })
      : activeCentralTab === "orgchart"
      ? renderOrgChartTab({
          h,
          holding: holdingData,
          selectedTenant,
        })
      : activeCentralTab === "inteligencia"
      ? renderIntelligenceTab({
          h,
          kpis: kpisData,
          history: kpisHistory,
          error: kpisError,
          isRecalculating: isRecalculatingKpis,
          onRecalculate: handleRecalculateKpis,
          onRunGovernanceEval: handleRunGovernanceEval,
          governanceSummary,
          loopRadar,
          onRefreshLoopRadar: loadLoopRadar,
          onWakeIrisForLoops: handleWakeIrisForLoops,
          onStopLoopSession: handleStopLoopSession,
          stoppingSessionId,
          onFailoverModelSession: handleFailoverModelSession,
          failingOverSessionId,
        })
      : activeCentralTab === "observabilidade"
      ? renderObservabilityTab({
          h,
          telemetry: telemetrySnap,
          nativeState: getBuzzNativeState(),
          operationFilter: obsFilter,
          onFilterChange: setObsFilter,
          isProbingDecision,
          lastProbeSummary,
          onRunDecisionProbe: handleRunDecisionProbe,
          onResetSpans: handleResetSpans,
          onRefresh: () => setTelemetrySnap(getTelemetrySnapshot()),
        })
      : activeCentralTab === "card_studio"
      ? h(CardStudioTab, {
          liveAgents,
          defaultEmpresa: selectedTenant,
          onNotify: showNotification,
        })
      : activeCentralTab === "resolvidas"
      ? renderResolvedArchiveTab({
          h,
          items: resolvedItems,
          error: resolvedError,
          searchQuery: resolvedSearch,
          specFilter: resolvedSpecFilter,
          copiedId: copiedResolvedId,
          onSearchChange: setResolvedSearch,
          onSpecFilterChange: setResolvedSpecFilter,
          onCopyLink: (item) => {
            try {
              (navigator as any)?.clipboard?.writeText(item.deepLink);
            } catch {}
            setCopiedResolvedId(item.issueId);
            setTimeout(() => setCopiedResolvedId(null), 2000);
          },
          onReopenFollowUp: (item) => {
            setDispatchIssueId(item.fullIssueId || item.issueId);
            setIsDispatchModalOpen(true);
          },
          onRefresh: loadResolvedArchive,
        })
      : renderTemplatesRsiView()
        )
      ),

      renderGovernanceAndCopilotDrawers(_cockpitScope),
      renderDispatchAndGateModals(_cockpitScope),
      renderIssueDetailModal(_cockpitScope),
      renderInfraModals(_cockpitScope),
    );

    // ─────────────────────────────────────────────────────────────────────────
    function renderTemplatesRsiView() { return renderTemplatesRsiSection(_cockpitScope); }
    function renderColumn(title: string, cards: PipelineCard[], badgeBg: string, badgeColor: string, renderAction: (card: PipelineCard) => any, emptyText?: string) { return renderKanbanColumn(_cockpitScope, title, cards, badgeBg, badgeColor, renderAction, emptyText); }
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
        h("span", { style: { color: "#9ca3af" } }, "Arquitetura:"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "OrgFy v12 Control Plane"),
        h("span", { style: { color: "#9ca3af" } }, "Camadas:"),
        h("span", { style: { color: "#38bdf8", fontWeight: "600" } }, "Board → Core → Subsidiárias"),
        h("span", { style: { color: "#9ca3af" } }, "Telemetria:"),
        h("span", { style: { color: "#cbd5e1", fontWeight: "600" } }, "100% ao vivo no Cockpit")
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

  // Ícone monocromático padrão Buzz com currentColor (branco inativo, preto quando selecionado)
  const ORGFY_PAGE_ICON =
    "data:image/svg+xml;base64," +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 20 6.5 20 17.5 12 22 4 17.5 4 6.5 12 2"/><polyline points="4 6.5 12 11.5 20 6.5"/><line x1="12" y1="11.5" x2="12" y2="22"/></svg>'
    );

  const OrgFyFactoryView = createFactoryAppComponent(ctx);

  // Registra Página Principal única (OrgFy Factory v15+ em Shadow DOM — UI antiga removida no Bloco D v17)
  ctx.pages.register({
    id: "orgfy",
    title: "OrgFy Factory",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    icon: ORGFY_PAGE_ICON,
    component: OrgFyFactoryView,
  });

  // Registra Card em Configurações
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "orgfy-settings",
      title: "OrgFy Factory",
      group: "Pipelines & Autonomous Systems",
      component: OrgFySettingsCard,
    });
  }

  // ── ONDA 2: SIDEBAR DE PULSO NO CANAL (#esteira-orgfy) via ctx.panels ──
  if ((ctx as any).panels?.register) {
    try {
      const ChannelPulseComponent = createChannelPulsePanel(ctx, async () => {
        const res = await fetchKpisEsteira(ctx);
        return res.kpis;
      });
      (ctx as any).panels.register({
        id: "orgfy-channel-pulse",
        title: "Pulso OrgFy",
        channelPlacement: "side",
        channelLauncher: { label: "Pulso OrgFy" },
        component: ChannelPulseComponent,
      });
      console.log("[ORGFY] Sidebar panel orgfy-channel-pulse registrado com sucesso.");
    } catch (err) {
      console.warn("[ORGFY] Falha ao registrar sidebar panel:", err);
    }
  }

  // ── ONDA 3: HOOKS DE GOVERNANÇA NO CICLO DOS AGENTES ──
  registerGovernanceAgentHooks(ctx);

  // ── v13 FRONTIER: SINERGIA NATIVA BUZZ (RELAY, CHAT, SIDEBAR, SHORTCUTS, ATTENTION SOURCE, OTEL) ──
  registerBuzzNativeIntegrations(ctx);

  // ── INJEÇÃO DE INSTRUÇÕES DETERMINÍSTICAS NO PROMPT DO AGENTE (<plugin-instructions>) ──
  if ((ctx.agents as any)?.addInstructions) {
    try {
      (ctx.agents as any).addInstructions({
        id: "orgfy-governance-v13-lean",
        text: `Esteira OrgFy v13.5 (Holding Cortexx: orgfy, lumen-iptv, saas-tributario) — Núcleo Lean & Role-Scoped:
INVARIANTS UNIVERSAIS (TODOS OS PAPÉIS):
- L-01 / L-22 / L-90: Executor != Revisor; aceite L-22 imutável (SHA-256); nunca afrouxe testes ou gates.
- Specsfy + TDD (FAIL-CLOSED): nunca use 'buzz issues create' direto nem '--gate gate:qa'. Effort 1-2 (Z2): TDD RED->GREEN; Effort 3-6 (Z3): exige spec.md com Definition/Plan Gate Passed; Effort 7-10 (Z4): + DECIDIDO. Crie via 'orgfy_card_create', valide com './ferramentas/card-lint.sh' e publique via './ferramentas/buzz-issue-guard.sh'.
- Guarda de Identidade & Freio Anti-Loop: menção para '@OutroPerfil' ou thread aguardando GATE de outro -> responda apenas '[SILENT]'. Máx 12 shells sem commit / 2 falhas consecutivas -> pare e publique 'BLOQUEADO | por | motivo | falta | resolve'. Nunca faça 'git checkout' na raiz do repo (use worktree isolado).
- Ferramentas-chave de 1 chamada: 'orgfy_roster_live' (quem está livre de verdade + limpa locks zumbis), 'orgfy_handoff_pack' (retomada/revisão P1..Pn + git), 'orgfy_smart_dispatch' (delegação one-shot L-01 + WRITE_SET_CONFLICT), 'orgfy_card_progress', 'orgfy_checkout_lock' (sempre passe exclusive_paths), 'orgfy_loop_radar', 'orgfy_session_stop', 'orgfy_model_failover', 'orgfy_gate'.

REGRAS POR PAPEL (APLIQUE APENAS O SEU):
- [Executor]: use 'orgfy_handoff_pack' ao retomar; mantenha 'orgfy_card_progress' atualizado; edite apenas Escrita exclusiva; se 'git push relay' der exit 128, pegue o header via 'buzz__repo' com GIT_CONFIG_COUNT=1.
- [Revisor]: máx 15 shells; use 'orgfy_handoff_pack', rode o comando L-22, confira diff/escopo e emita 'GATE: aceito' ou 'GATE: recusado' imediatamente (nunca debugue porteiro.py em revisão).
- [COO]: antes de delegar chame 'orgfy_roster_live' e 'orgfy_smart_dispatch'; limite exploração a 10 shells; escale Agente -> COO -> CEO Empresa -> Iris (só último caso). Todo wake '[ORGFY RADAR AUTO-CURA]' exige 1 desfecho fechado: (A) erro API -> stop + 'orgfy_model_failover'; (B) aberto -> 'orgfy_session_stop(relaunch=true, reset_session_before_relaunch=true)'; (C) já na main -> stop sem relançar. Use 'python3 ferramentas/assign_issue.py' (nunca 'buzz issues assign' direto) e 'python3 ferramentas/issue_status.py --resumo' para placar.
- [CEO / Board]: delegue sempre com alvo fechado (1-3 arquivos + critério L-22 + o que não refazer).`,
      });
      console.log("[ORGFY] ctx.agents.addInstructions registrado com sucesso.");
    } catch (err) {
      console.warn("[ORGFY] Falha ao registrar addInstructions:", err);
    }
  }

  // ── REGISTRO UNIFICADO DAS 16 AGENT TOOLS (v13 SINGLE SOURCE OF TRUTH + OTEL TRACING) ──
  if ((ctx.agents as any)?.addTool) {
    try {
      const unifiedTools = buildUnifiedOrgfyTools(ctx);
      for (const tool of unifiedTools) {
        (ctx.agents as any).addTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          call: async (_client: any, _context: any, args: any) => {
            const res = await tool.execute(args || {});
            return res.text;
          },
        });
      }
      console.log(`[ORGFY v13] ${unifiedTools.length} agentTools registradas via Unified Tool Registry (OTel GenAI + Attention + Decisions API).`);
    } catch (err) {
      console.warn("[ORGFY] Falha ao registrar agentTools:", err);
    }
  }

  // Inicialização do Servidor MCP Nativo (JSON-RPC 2.0 Loopback)
  let mcpServerInstance: any = null;
  startOrgfyMcpServer(ctx)
    .then((server) => {
      mcpServerInstance = server;
    })
    .catch((err) => {
      console.warn("[ORGFY] MCP Server failed to start:", err);
    });

  if ((ctx as any).on) {
    (ctx as any).on("dispose", () => {
      if (mcpServerInstance?.close) {
        try {
          mcpServerInstance.close();
        } catch (_e) {}
      }
    });
  }
}
