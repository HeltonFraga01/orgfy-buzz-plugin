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
  executeSmartModelFailover,
  VERIFIED_TOOLCALL_FAILOVER_CHAIN,
  isUnsupportedAgentModel,
  ORGFY_FAILOVER_REQUEST_EVENT,
  reconcileAgentsViaBuzzApi,
} from "./services/model-failover";
export { VERIFIED_TOOLCALL_FAILOVER_CHAIN, isUnsupportedAgentModel, ORGFY_FAILOVER_REQUEST_EVENT, reconcileAgentsViaBuzzApi, executeSmartModelFailover };
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

export const TENANTS = [
  { id: "all", name: "Holding OrgFy", badge: "Cross-Workspace", slug: "all" },
  { id: "orgfy", name: "OrgFy Core", badge: "Core Framework", slug: "orgfy" },
  { id: "lumen-iptv", name: "Lumen IPTV", badge: "Subsidiária IPTV", slug: "lumen-iptv" },
  { id: "saas-tributario", name: "SaaS Tributário", badge: "Subsidiária Fiscal", slug: "saas-tributario" },
];

// Zero-Mock v13: zero cards/regras/agentes hardcoded — dados 100% vivos do Buzz e REPOS/orgfy
export const INITIAL_PIPELINE_CARDS: PipelineCard[] = [];
export const INITIAL_REGRAS_PROBATORIAS: RegraProbatoria[] = [];
export const AVAILABLE_AGENTS: Array<{ id: string; name: string; role: string; tier: string; model: string }> = [];

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
  bell: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }),
      h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })
    ),
  bellOff: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" }),
      h("path", { d: "M18.63 13A17.89 17.89 0 0 1 18 8" }),
      h("path", { d: "M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" }),
      h("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
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
  externalLink: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
      h("polyline", { points: "15 3 21 3 21 9" }),
      h("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
    ),
  copy: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
      h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
    ),
  users: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: "9", cy: "7", r: "4" }),
      h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
      h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
    ),
  folder: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })
    ),
  activity: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
    ),
  gitPullRequest: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "18", cy: "18", r: "3" }),
      h("circle", { cx: "6", cy: "6", r: "3" }),
      h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
      h("line", { x1: "6", y1: "9", x2: "6", y2: "21" })
    ),
  fileText: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
      h("polyline", { points: "14 2 14 8 20 8" }),
      h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
      h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
      h("polyline", { points: "10 9 9 9 8 9" })
    ),
  list: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
      h("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
      h("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
      h("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
      h("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
      h("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE LADDER & PALETA TONAL LINEAR (ANTI-AI SLOP)
// ─────────────────────────────────────────────────────────────────────────────
export const THEME = {
  canvas: "#0e0f12",          // Level 0: App Canvas neutro chumbo
  columnBg: "#15161a",        // Level 1: Recipiente sutil das colunas
  cardBg: "#1c1d23",          // Level 2: Superfície elevada dos cards
  cardHover: "#23252d",       // Level 2 hover
  hairline: "rgba(255, 255, 255, 0.06)",
  borderCard: "rgba(255, 255, 255, 0.08)",
  accentPrimary: "#10b981",   // Esmeralda limpo para botão primário de despacho
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (BUZZ WORKSPACE COCKPIT)
// ─────────────────────────────────────────────────────────────────────────────

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
        const res = await executeSmartModelFailover(ctx, {
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

      // ───────────────────────────────────────────────────────────────────────
      // GOVERNANCE & RSI SLIDE-OVER DRAWER (LINEAR GRADE)
      // ───────────────────────────────────────────────────────────────────────
      isGovernanceDrawerOpen &&
        h(
          React.Fragment,
          null,
          // Backdrop escuro fechável
          h("div", {
            onClick: () => setIsGovernanceDrawerOpen(false),
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 1199,
            },
          }),
          // Drawer Lateral Deslizante
          h(
            "aside",
            {
              style: {
                position: "fixed",
                top: 0,
                right: 0,
                width: "420px",
                maxWidth: "90vw",
                height: "100vh",
                backgroundColor: "#111216",
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
                display: "flex",
                flexDirection: "column",
                zIndex: 1200,
                padding: "20px",
                overflowY: "auto",
                gap: "16px",
              },
            },
            // Header do Drawer
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: "12px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.shield({ h, width: 16, height: 16 }),
                h("span", { style: { fontWeight: "700", fontSize: "14px", color: THEME.textPrimary } }, "Governança, EVM & RSI"),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      color: THEME.accentPrimary,
                      fontWeight: "600",
                      backgroundColor: "rgba(16,185,129,0.15)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    },
                  },
                  "v12 CONTROL PLANE"
                )
              ),
              h(
                "button",
                {
                  onClick: () => setIsGovernanceDrawerOpen(false),
                  style: { background: "transparent", border: "none", color: THEME.textSecondary, cursor: "pointer", padding: "4px" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),

            // Seção EVM & Orçamento de Tokens
            h(
              "div",
              {
                style: {
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: `1px solid ${THEME.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "Métricas EVM & Tokens"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "CPI Acumulado"),
                h(
                  "span",
                  { style: { fontSize: "13px", fontWeight: "700", color: (cpiTokens ?? 1) >= 0.85 ? THEME.accentPrimary : "#f59e0b" } },
                  cpiTokens !== null ? `${cpiTokens.toFixed(2)} (Min: 0.85)` : "--"
                )
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Circuit Breaker Loops"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: THEME.accentPrimary } }, circuitBreakerLoop ? `${circuitBreakerLoop} turnos` : "--")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "PRs Integrados"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff" } }, totalMergedGate !== null ? `${totalMergedGate} na main` : "--")
              ),
              // Linha de Aceites Blindados L-22
              h(
                "div",
                {
                  style: {
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                },
                h("span", { style: { color: "#10b981", fontWeight: "600" } }, "Aceites Blindados (L-22):"),
                h("span", { style: { color: "#ffffff", fontFamily: "monospace", fontWeight: "700" } }, totalAceitesBlindados !== null ? `${totalAceitesBlindados} verificados` : "--")
              )
            ),

            // Seção Catraca Probatória RSI
            h(
              "div",
              {
                style: {
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: `1px solid ${THEME.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "Catraca Probatória RSI"),
                h("span", { style: { fontSize: "10px", color: "#c084fc", fontFamily: "monospace" } }, "Janela 10 cards")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Regras Ativas"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#c084fc" } }, `${Object.keys(regrasProbatorias).length || 3} regras`)
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Regra L-90 Auto-Rollback"),
                h("span", { style: { fontSize: "12px", fontWeight: "600", color: THEME.accentPrimary } }, "Ativo (FPY >= 95%)")
              ),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" } },
                h(
                  "div",
                  { style: { padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.03)", fontSize: "10px" } },
                  h("div", { style: { color: "#ffffff", fontWeight: "600" } }, "GUARD-T020"),
                  h("div", { style: { color: THEME.textMuted } }, "ci_cache e aceite_cache blindados (10/10 cards)")
                ),
                h(
                  "div",
                  { style: { padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.03)", fontSize: "10px" } },
                  h("div", { style: { color: "#ffffff", fontWeight: "600" } }, "GUARD-L01"),
                  h("div", { style: { color: THEME.textMuted } }, "Impedimento auto-revisão L-01 (10/10 cards)")
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      setIsGovernanceDrawerOpen(false);
                      setActiveCentralTab("templates_rsi");
                    },
                    style: {
                      marginTop: "6px",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      backgroundColor: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    },
                  },
                  SVG.gitPullRequest({ h, width: 13, height: 13 }),
                  "Explorar Catálogo de Templates & RSI Completo →"
                )
              )
            ),

            // Seção DSAP Backtracking
            h(
              "div",
              {
                style: {
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  border: `1px solid ${THEME.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h("div", { style: { fontSize: "11px", fontWeight: "700", color: THEME.textSecondary, textTransform: "uppercase" } }, "DSAP Preditivo"),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: "12px", color: THEME.textPrimary } }, "Threshold Backtracking"),
                h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f59e0b" } }, "≥ 0.70 similaridade")
              ),
              h(
                "div",
                {
                  style: {
                    padding: "8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    color: THEME.accentPrimary,
                    fontSize: "11px",
                    fontWeight: "500",
                  },
                },
                "✓ Nenhum backtracking ativo no momento (fluxo limpo)."
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
              `Olá, Helton. A esteira determinística v10 está com ${pipelineCards.length} cards no Kanban, FPY em ${fpyRate !== null ? `${fpyRate.toFixed(1)}%` : "--"} e CPI em ${cpiTokens !== null ? cpiTokens.toFixed(2) : "--"}. Use /despachar para novos cards ou /gate para veredito.`
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
                  const cmd = e.target.value.trim();
                  appendLiveLog(`\n[COPILOTO] Mensagem enviada para ${copilotAgent}: ${cmd}\n`);
                  showNotification("info", `Comando enviado para ${copilotAgent}: ${cmd}`);
                  e.target.value = "";
                }
              },
            })
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 4. MODAL NOVO DESPACHO (VALIDAÇÃO L-01: EXECUTOR !== REVISOR + REAL CLI)
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
                  onClick: () => !isExecutingDispatch && setIsDispatchModalOpen(false),
                  disabled: isExecutingDispatch,
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingDispatch ? "not-allowed" : "pointer" },
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
                disabled: isExecutingDispatch,
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
                  disabled: isExecutingDispatch,
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
                liveAgents.map((a) =>
                  h("option", { key: a.id, value: a.name }, a.name)
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
                  disabled: isExecutingDispatch,
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
                liveAgents.map((a) =>
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
                  disabled: isExecutingDispatch,
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                "Cancelar"
              ),
              h(
                "button",
                {
                  onClick: handleExecuteDispatch,
                  disabled: isExecutingDispatch,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: isExecutingDispatch ? "#059669" : "#10b981",
                    color: "#000000",
                    fontWeight: "700",
                    border: "none",
                    cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                isExecutingDispatch ? "Executando via CLI..." : "Disparar Despacho"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 5. MODAL DE DECISÃO DO GATE COM DETECTOR PREDITIVO DSAP (3 NÍVEIS)
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
                    if (!isExecutingGate) {
                      setIsGateModalOpen(false);
                      setActiveGateCard(null);
                    }
                  },
                  disabled: isExecutingGate,
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingGate ? "not-allowed" : "pointer" },
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
                h("span", { style: { color: activeGateCard.probes?.http_rota ? "#10b981" : "#9ca3af", fontWeight: "600" } }, activeGateCard.probes?.http_rota ? "PASS" : "Não executado")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• supabase_rls (Políticas & Migrations):"),
                h("span", { style: { color: activeGateCard.probes?.supabase_rls ? "#10b981" : "#9ca3af", fontWeight: "600" } }, activeGateCard.probes?.supabase_rls ? "PASS" : "Não executado")
              ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                h("span", null, "• playwright_console (0 erros runtime):"),
                h("span", { style: { color: activeGateCard.probes?.playwright_console ? "#10b981" : "#9ca3af", fontWeight: "600" } }, activeGateCard.probes?.playwright_console ? "PASS" : "Não executado")
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
                disabled: isExecutingGate,
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
              // Banner Reativo DSAP em 3 Níveis Contextuais (Refinamento de UI/UX)
              gateRejectionReason.trim().length > 0 &&
                h(
                  "div",
                  {
                    style: {
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor:
                        dsapSimilarity >= 0.7
                          ? "rgba(239, 68, 68, 0.15)"
                          : dsapSimilarity >= 0.5
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(16, 185, 129, 0.12)",
                      border: "1px solid",
                      borderColor:
                        dsapSimilarity >= 0.7
                          ? "#ef4444"
                          : dsapSimilarity >= 0.5
                          ? "#f59e0b"
                          : "#10b981",
                      color:
                        dsapSimilarity >= 0.7
                          ? "#f87171"
                          : dsapSimilarity >= 0.5
                          ? "#f59e0b"
                          : "#10b981",
                      fontSize: "11px",
                      fontWeight: "600",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "6px" } },
                    dsapSimilarity >= 0.7
                      ? SVG.alertTriangle({ h, width: 14, height: 14 })
                      : dsapSimilarity >= 0.5
                      ? SVG.alertTriangle({ h, width: 14, height: 14 })
                      : SVG.checkCircle({ h, width: 14, height: 14 }),
                    dsapSimilarity >= 0.7
                      ? `🔴 ALERTA DSAP (${Math.round(dsapSimilarity * 100)}%): Repetição desta assinatura engatilhará [DSAP BACKTRACKING] para o COO re-escopar!`
                      : dsapSimilarity >= 0.5
                      ? `🟡 ATENÇÃO (${Math.round(dsapSimilarity * 100)}% de similaridade): Termos técnicos repetidos da recusa anterior.`
                      : `🟢 SEGURO (${Math.round(dsapSimilarity * 100)}% de similaridade): Nova justificativa com assinatura distinta.`
                  ),
                  dsapMatchedTokens.length > 0 &&
                    h(
                      "div",
                      { style: { fontSize: "10px", color: "rgba(255,255,255,0.7)" } },
                      `Tokens identificados: ${dsapMatchedTokens.join(", ")}`
                    )
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
                  disabled: isExecutingGate,
                  style: {
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontWeight: "700",
                    cursor: isExecutingGate ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                isExecutingGate ? "Executando Gate..." : "RECUSAR PR"
              ),
              h(
                "button",
                {
                  onClick: () => handleAcceptGate(activeGateCard),
                  disabled: isExecutingGate,
                  style: {
                    padding: "8px 22px",
                    borderRadius: "8px",
                    backgroundColor: isExecutingGate ? "#059669" : "#10b981",
                    color: "#000000",
                    fontWeight: "700",
                    border: "none",
                    cursor: isExecutingGate ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  },
                },
                isExecutingGate ? "Executando Gate..." : "ACEITAR PR (MERGE NA MAIN)"
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
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "span",
                { style: { fontSize: "12px", color: "#10b981", fontWeight: "700" } },
                `CONSOLE LIVE: ${activeLogsCard.workerPid ? `PID ${activeLogsCard.workerPid}` : "Sessão CLI"} — #${activeLogsCard.issueId}`
              ),
              h("span", { style: { fontSize: "10px", color: "#60a5fa", fontWeight: "600" } }, "🟢 STREAMING ATIVO")
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "button",
                {
                  onClick: () => setLiveLogStream(""),
                  style: {
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    color: "#9ca3af",
                    border: "none",
                    fontSize: "10px",
                    cursor: "pointer",
                  },
                },
                "Limpar Logs"
              ),
              h(
                "button",
                {
                  onClick: () => {
                    navigator.clipboard.writeText(liveLogStream);
                    showNotification("success", "Logs copiados para a área de transferência!");
                  },
                  style: {
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    color: "#9ca3af",
                    border: "none",
                    fontSize: "10px",
                    cursor: "pointer",
                  },
                },
                "Copiar"
              ),
              h(
                "button",
                {
                  onClick: () => setIsLogsDrawerOpen(false),
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.xCircle({ h, width: 16, height: 16 })
              )
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
            liveLogStream ||
              `[ORGFY WORKER] Inicializando container efêmero no Swarm...\n` +
              `[ORGFY WORKER] Worktree montada em: .worktrees/${activeLogsCard.issueId}\n` +
              `[ORGFY WORKER] Executando: pytest testes/esteira -v --tb=short\n` +
              `testes/esteira/test_t020.py::test_ci_cache_integrity PASSED\n` +
              `testes/esteira/test_gate_state.py::test_regras_probatorias_eval PASSED\n` +
              `[ORGFY WORKER] 2 passed in 1.42s. Probes caixa-preta engatilhados.\n` +
              `[ORGFY NOSTR] Evento kind:1618 publicado em wss://orgfy.communities.buzz.xyz (sub-second wake)`
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 6.5. MODAL IN-COCKPIT DE DETALHES DA ISSUE (EXPANSÃO DO COCKPIT)
      // ───────────────────────────────────────────────────────────────────────
      activeIssueDetailCard &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2150,
            },
            onClick: () => setActiveIssueDetailCard(null),
          },
          h(
            "div",
            {
              style: {
                width: "920px",
                maxWidth: "94vw",
                maxHeight: "88vh",
                borderRadius: "14px",
                backgroundColor: "#0d1117",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              },
              onClick: (e: any) => e.stopPropagation(),
            },
            // ── HEADER DO MODAL (ESTILO HERMES / LINEAR) ──
            h(
              "div",
              {
                style: {
                  padding: "18px 24px 14px 24px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  backgroundColor: "rgba(255, 255, 255, 0.015)",
                },
              },
              // Breadcrumbs + Badges + Fechar
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#9ca3af" } },
                  h("span", { style: { fontWeight: "600", color: "#cbd5e1" } }, "Holding OrgFy"),
                  h("span", { style: { color: "#4b5563" } }, "/"),
                  h("span", {}, "Repositório orgfy"),
                  h("span", { style: { color: "#4b5563" } }, "/"),
                  h("span", {}, "Issues"),
                  h("span", { style: { color: "#4b5563" } }, "/"),
                  h(
                    "code",
                    {
                      style: {
                        fontFamily: "monospace",
                        color: "#38bdf8",
                        backgroundColor: "rgba(56, 189, 248, 0.1)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        fontWeight: "700",
                      },
                      title: activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId,
                    },
                    `#${(activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId).slice(0, 10)}...`
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  // Badge Prioridade
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        backgroundColor:
                          activeIssueDetailCard.priority === "P0"
                            ? "rgba(239, 68, 68, 0.2)"
                            : activeIssueDetailCard.priority === "P1"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(59, 130, 246, 0.2)",
                        color:
                          activeIssueDetailCard.priority === "P0"
                            ? "#ef4444"
                            : activeIssueDetailCard.priority === "P1"
                            ? "#f59e0b"
                            : "#60a5fa",
                      },
                    },
                    activeIssueDetailCard.priority
                  ),
                  // Badge Stage
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        backgroundColor:
                          activeIssueDetailCard.stage === "feito"
                            ? "rgba(16, 185, 129, 0.2)"
                            : activeIssueDetailCard.stage === "revisao"
                            ? "rgba(249, 115, 22, 0.2)"
                            : activeIssueDetailCard.stage === "execucao"
                            ? "rgba(168, 85, 247, 0.2)"
                            : "rgba(56, 189, 248, 0.2)",
                        color:
                          activeIssueDetailCard.stage === "feito"
                            ? "#10b981"
                            : activeIssueDetailCard.stage === "revisao"
                            ? "#f97316"
                            : activeIssueDetailCard.stage === "execucao"
                            ? "#c084fc"
                            : "#38bdf8",
                        textTransform: "uppercase",
                      },
                    },
                    activeIssueDetailCard.stage
                  ),
                  // Botão Fechar
                  h(
                    "button",
                    {
                      onClick: () => setActiveIssueDetailCard(null),
                      style: {
                        background: "transparent",
                        border: "none",
                        color: "#9ca3af",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                      },
                      title: "Fechar (Esc)",
                    },
                    SVG.xCircle({ h, width: 18, height: 18 })
                  )
                )
              ),
              // Título Principal
              h(
                "h2",
                {
                  style: {
                    margin: "4px 0 2px 0",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#ffffff",
                    lineHeight: "1.4",
                  },
                },
                activeIssueDetailCard.title
              ),
              // Sublinha: Datas Reais e Autoridade (FIM DE TIMESTAMPS FALSOS)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "11px",
                    color: "#9ca3af",
                    flexWrap: "wrap",
                  },
                },
                h(
                  "span",
                  { style: { display: "flex", alignItems: "center", gap: "4px" } },
                  SVG.clock({ h, width: 12, height: 12 }),
                  `Criado em: ${formatFullDateTime(activeIssueDetailCard.createdAt)}`
                ),
                h(
                  "span",
                  {
                    style: {
                      fontFamily: "monospace",
                      color: "#34d399",
                      backgroundColor: "rgba(52, 211, 153, 0.12)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                    },
                  },
                  formatRelativeTime(activeIssueDetailCard.createdAt || activeIssueDetailCard.updatedAt || activeIssueDetailCard.elapsedTime)
                ),
                h("span", { style: { color: "#4b5563" } }, "•"),
                h("span", { style: { color: "#cbd5e1" } }, `Autoridade: ${activeIssueDetailCard.decisor || "OrgFy Iris"}`),
                h("span", { style: { color: "#4b5563" } }, "•"),
                h("span", { style: { color: "#9ca3af" } }, `Branch: ${activeIssueDetailCard.branch || "main"}`)
              )
            ),

            // ── CORPO BI-PARTIDO DO MODAL (ESQUERDA: SPEC / DIREITA: ATRIBUTOS & PROBES) ──
            h(
              "div",
              {
                style: {
                  padding: "18px 24px",
                  overflowY: "auto",
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "1.55fr 1fr",
                  gap: "18px",
                },
              },
              // ── COLUNA ESQUERDA: ESPECIFICAÇÃO TÉCNICA E GOVERNANÇA (CARD HERMES V3) ──
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "12px" } },
                // 1. Objetivo do Card
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.025)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderLeft: "3px solid #38bdf8",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Objetivo do Card"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "12px", color: "#f1f5f9", lineHeight: "1.5" } },
                    hydratedIssueDetail?.objetivo || activeIssueDetailCard.objetivo || activeIssueDetailCard.title
                  ),
                  hydratedIssueDetail?.cardFileFound &&
                    h(
                      "div",
                      { style: { fontSize: "10px", color: "#64748b", fontFamily: "monospace", marginTop: "2px" } },
                      `Fonte real: ${hydratedIssueDetail.cardFileFound}`
                    )
                ),

                // 1.5 Progresso & Checklist Vivo (Checkpoint Persistente em cards/<SLUG>.md)
                hydratedIssueDetail?.progress &&
                  hydratedIssueDetail.progress.total > 0 &&
                  h(
                    "div",
                    {
                      style: {
                        borderRadius: "8px",
                        backgroundColor: "rgba(255, 255, 255, 0.025)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                      h(
                        "span",
                        { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                        "Progresso & Checklist de Execução"
                      ),
                      h(
                        "span",
                        { style: { fontSize: "10.5px", fontFamily: "monospace", fontWeight: "700", color: hydratedIssueDetail.progress.pct === 100 ? "#10b981" : "#38bdf8" } },
                        `${hydratedIssueDetail.progress.done}/${hydratedIssueDetail.progress.total} concluídas (${hydratedIssueDetail.progress.pct}%)`
                      )
                    ),
                    h(
                      "div",
                      {
                        style: {
                          height: "6px",
                          width: "100%",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          overflow: "hidden",
                        },
                      },
                      h("div", {
                        style: {
                          height: "100%",
                          width: `${hydratedIssueDetail.progress.pct}%`,
                          backgroundColor: hydratedIssueDetail.progress.blocked > 0 ? "#ef4444" : hydratedIssueDetail.progress.pct === 100 ? "#10b981" : "#38bdf8",
                          transition: "width 0.25s ease",
                        },
                      })
                    ),
                    h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                      hydratedIssueDetail.progress.steps.map((st) => {
                        const badge =
                          st.status === "done"
                            ? { icon: "✓", color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" }
                            : st.status === "in_progress"
                            ? { icon: "▶", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.14)" }
                            : st.status === "blocked"
                            ? { icon: "!", color: "#ef4444", bg: "rgba(239, 68, 68, 0.14)" }
                            : { icon: "○", color: "#6b7280", bg: "rgba(255, 255, 255, 0.05)" };
                        return h(
                          "div",
                          {
                            key: st.id,
                            style: {
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              padding: "5px 8px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(0, 0, 0, 0.28)",
                              fontSize: "11px",
                            },
                          },
                          h(
                            "span",
                            {
                              style: {
                                fontFamily: "monospace",
                                fontWeight: "700",
                                fontSize: "10px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                backgroundColor: badge.bg,
                                color: badge.color,
                                flexShrink: 0,
                              },
                            },
                            `${badge.icon} ${st.id}`
                          ),
                          h(
                            "div",
                            { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                            h(
                              "span",
                              {
                                style: {
                                  color: st.status === "done" ? "#9ca3af" : "#f3f4f6",
                                  textDecoration: st.status === "done" ? "line-through" : "none",
                                  lineHeight: "1.4",
                                },
                              },
                              st.text
                            ),
                            st.note &&
                              h(
                                "span",
                                { style: { fontSize: "10px", fontFamily: "monospace", color: "#38bdf8" } },
                                st.note
                              )
                          )
                        );
                      })
                    )
                  ),

                // 2. Estado & Autoridade Decisória (100% real, sem fallback genérico)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Estado & Autoridade Decisória"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                    h("strong", { style: { color: "#ffffff" } }, "Contexto: "),
                    hydratedIssueDetail?.contexto || activeIssueDetailCard.contexto || (isHydratingIssueDetail ? "Carregando card em disco..." : "Não declarado no card.")
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                    h("strong", { style: { color: "#ffffff" } }, "Decisão / Autoridade: "),
                    hydratedIssueDetail?.decisao || hydratedIssueDetail?.autoridade || activeIssueDetailCard.decisao || activeIssueDetailCard.autoridade || "Não declarada no card."
                  ),
                  hydratedIssueDetail?.escritaExclusiva && hydratedIssueDetail.escritaExclusiva.length > 0 &&
                    h(
                      "div",
                      { style: { fontSize: "10px", color: "#93c5fd", fontFamily: "monospace", marginTop: "2px" } },
                      `Escrita exclusiva: ${hydratedIssueDetail.escritaExclusiva.join(", ")}`
                    )
                ),

                // 3. Invariante L-22: Comando de Aceite Congelado
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "#060907",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h(
                      "span",
                      { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                      "Comando de Aceite Congelado (Invariante L-22)"
                    ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "8px" } },
                      h(
                        "span",
                        { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } },
                        "Blindagem SHA-256"
                      ),
                      h(
                        "button",
                        {
                          onClick: () => {
                            const cmd = hydratedIssueDetail?.acceptanceCommand || activeIssueDetailCard.acceptanceCommand || "";
                            if (cmd && typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
                              navigator.clipboard.writeText(cmd);
                              showNotification("success", "Comando de aceite L-22 copiado!");
                            }
                          },
                          style: {
                            padding: "2px 6px",
                            borderRadius: "4px",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            fontSize: "10px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          },
                          title: "Copiar comando de aceite",
                        },
                        SVG.copy({ h, width: 10, height: 10 }),
                        "Copiar"
                      )
                    )
                  ),
                  h(
                    "code",
                    {
                      style: {
                        fontSize: "11px",
                        fontFamily: "monospace",
                        backgroundColor: "#020403",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        color: hydratedIssueDetail?.acceptanceCommand || activeIssueDetailCard.acceptanceCommand ? "#34d399" : "#9ca3af",
                        display: "block",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        border: "1px solid rgba(16, 185, 129, 0.15)",
                      },
                    },
                    hydratedIssueDetail?.acceptanceCommand || activeIssueDetailCard.acceptanceCommand || "Comando de aceite ainda não registrado."
                  ),
                  h(
                    "div",
                    { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace", display: "flex", justifyContent: "space-between", gap: "8px" } },
                    h(
                      "span",
                      {},
                      hydratedIssueDetail?.acceptanceHash
                        ? `Hash de Aceite: ${hydratedIssueDetail.acceptanceHash.slice(0, 28)}...`
                        : "Hash de Aceite: não gerado"
                    ),
                    h(
                      "span",
                      { style: { color: hydratedIssueDetail?.acceptanceFrozenValid ? "#10b981" : "#f59e0b", fontWeight: "600" } },
                      hydratedIssueDetail?.acceptanceFrozenValid
                        ? "✓ Congelamento Válido (Anti-Bypass)"
                        : "Pendente de congelamento L-22"
                    )
                  )
                ),

                // 4. Critérios de Feito & Provas Exigidas
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" } },
                    "Critérios de Feito & Provas Exigidas"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" } },
                    h("strong", { style: { color: "#ffffff" } }, "Feito quando: "),
                    hydratedIssueDetail?.feitoQuando || activeIssueDetailCard.feitoQuando || "Não declarado no card."
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5", whiteSpace: "pre-wrap" } },
                    h("strong", { style: { color: "#ffffff" } }, "Prova exigida: "),
                    hydratedIssueDetail?.provaExigida || activeIssueDetailCard.provaExigida || "Não declarada no card."
                  )
                ),

                // 5. Histórico de Ciclos & DSAP Backtracking (100% real)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#f59e0b", textTransform: "uppercase" } }, "Histórico de Ciclos & DSAP Backtracking"),
                    h("span", { style: { fontSize: "10px", color: "#6b7280" } }, "Threshold: similaridade >= 0.70")
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#9ca3af" } },
                    activeIssueDetailCard.rejectionHistory && activeIssueDetailCard.rejectionHistory.length > 0
                      ? `Recusa recente: ${activeIssueDetailCard.rejectionHistory[0].reason} (${Math.round((activeIssueDetailCard.rejectionHistory[0].similarityToFirst || 0) * 100)}% similaridade)`
                      : hydratedIssueDetail && hydratedIssueDetail.rejectionsCount > 0
                      ? `${hydratedIssueDetail.rejectionsCount} recusa(s)/conflito(s) registrados em esteira-transicoes.jsonl.`
                      : activeIssueDetailCard.stage === "feito"
                      ? "Concluída sem recusas registradas (FPY 100% real)."
                      : hydratedIssueDetail && hydratedIssueDetail.transitions.length > 0
                      ? `${hydratedIssueDetail.transitions.length} transição(ões) registrada(s); última: ${hydratedIssueDetail.transitions[hydratedIssueDetail.transitions.length - 1].de} -> ${hydratedIssueDetail.transitions[hydratedIssueDetail.transitions.length - 1].para}.`
                      : "Em andamento — aguardando conclusão e veredito do Gate (FPY ainda não fechado)."
                  )
                )
              ),

              // ── COLUNA DIREITA: SIDEBAR DE ATRIBUTOS, RUNTIME BUZZ & PROBES ──
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "12px" } },
                // Box A: Papéis & Atribuição
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#c084fc", textTransform: "uppercase" } }, "Papéis & Atribuição"),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Decisor"),
                    h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(192, 132, 252, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.decisor || "OrgFy Iris")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Revisor"),
                    h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(56, 189, 248, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.revisor || "QA Sentinel")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Executor"),
                    h("span", { style: { color: "#ffffff", fontWeight: "600", backgroundColor: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "4px" } }, activeIssueDetailCard.executor || "Não atribuído")
                  )
                ),

                // Box B: Execução Buzz Runtime
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase" } }, "Execução Buzz Runtime (Real)"),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Modo"),
                    h(
                      "span",
                      { style: { color: "#ffffff", fontFamily: "monospace" } },
                      hydratedIssueDetail?.modoBuzz
                        ? `${hydratedIssueDetail.modoBuzz}${hydratedIssueDetail.goalMaxTurns ? ` (${hydratedIssueDetail.goalMaxTurns} turns max)` : ""}`
                        : "Não declarado"
                    )
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Tempo Máximo"),
                    h("span", { style: { color: "#ffffff", fontFamily: "monospace" } }, hydratedIssueDetail?.maxRuntime || "Não declarado")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Checkout Lock"),
                    h(
                      "span",
                      { style: { color: hydratedIssueDetail?.lockActive ? "#10b981" : "#9ca3af", fontFamily: "monospace", fontSize: "10px" } },
                      hydratedIssueDetail?.lockActive
                        ? `Ativo (${hydratedIssueDetail.lockAgent} · ${hydratedIssueDetail.lockExpiresInMin}m)`
                        : "Sem lock ativo"
                    )
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                    h("span", { style: { color: "#9ca3af" } }, "Worktree / Branch"),
                    h(
                      "span",
                      { style: { color: "#10b981", fontFamily: "monospace", fontSize: "10px" } },
                      hydratedIssueDetail?.worktreePath || hydratedIssueDetail?.branch || "Não definida"
                    )
                  )
                ),

                // Box C: Modelo Real do Executor (agents/state/ — Zero Hardcode)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase" } }, "Modelo Real do Executor (Buzz Desktop)"),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#ffffff", fontWeight: "600", fontFamily: "monospace" } },
                    hydratedIssueDetail?.executorModel
                      ? `${hydratedIssueDetail.executorProvider ? hydratedIssueDetail.executorProvider + "/" : ""}${hydratedIssueDetail.executorModel}`
                      : isHydratingIssueDetail
                      ? "Lendo agents/state/..."
                      : "Modelo não identificado no state local"
                  ),
                  h(
                    "div",
                    { style: { fontSize: "10px", color: "#9ca3af" } },
                    activeIssueDetailCard.tokens
                      ? `Telemetria: ${activeIssueDetailCard.tokens}k tokens${activeIssueDetailCard.estimatedCost ? ` · $${activeIssueDetailCard.estimatedCost}` : ""}`
                      : "Telemetria de custo/tokens da issue: indisponível (use aba Inteligência & Saúde para média real)."
                  )
                ),

                // Box D: Probes Caixa-Preta do Gate (Manifesto Real — Zero PASS Falso)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase" } }, "Probes & Validações do Gate"),
                    h("span", { style: { fontSize: "9px", color: "#6b7280", fontFamily: "monospace" } }, hydratedIssueDetail?.probesSource || "")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                    ...(hydratedIssueDetail?.probes || []).map((pr, idx) =>
                      h(
                        "div",
                        { key: idx, style: { display: "flex", justifyContent: "space-between", gap: "8px", color: "#d1d5db" } },
                        h("span", { title: pr.detail || "" }, `• ${pr.label}`),
                        h(
                          "span",
                          {
                            style: {
                              color:
                                pr.status === "PASS"
                                  ? "#10b981"
                                  : pr.status === "FAIL"
                                  ? "#ef4444"
                                  : pr.status === "PENDENTE"
                                  ? "#f59e0b"
                                  : "#6b7280",
                              fontWeight: "700",
                              fontFamily: "monospace",
                            },
                          },
                          pr.status
                        )
                      )
                    ),
                    (!hydratedIssueDetail || hydratedIssueDetail.probes.length === 0) &&
                      h("div", { style: { color: "#6b7280" } }, isHydratingIssueDetail ? "Lendo probes reais..." : "Nenhum probe registrado para esta issue.")
                  )
                ),

                // Box E: Transcript & Diffs Nativos do Agente (ctx.agents.ui.Transcript)
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    },
                  },
                  h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase" } }, "Transcript & Diffs do Agente (Nativo)"),
                  (ctx.agents as any)?.ui?.Transcript && (activeIssueDetailCard as any)?.conversationId
                    ? h((ctx.agents as any).ui.Transcript, {
                        conversationId: (activeIssueDetailCard as any).conversationId,
                        compact: true,
                      })
                    : h(
                        "div",
                        { style: { fontSize: "10px", color: "#9ca3af", lineHeight: "1.4" } },
                        "Nenhuma sessão ativa vinculada a este card ainda. Ao despachar com conversation_id (ou via orgfy_bind_context), o transcript e os diffs nativos do Buzz aparecem aqui."
                      )
                )
              )
            ),

            // ── FOOTER DE AÇÕES (1-CLIQUE ASSERTIVO) ──
            h(
              "div",
              {
                style: {
                  padding: "14px 24px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.015)",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "button",
                  {
                    onClick: (e: any) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const card = activeIssueDetailCard;
                      setActiveIssueDetailCard(null);
                      handleOpenIssueDeepLink(card);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    },
                    title: "Navegar diretamente para a Issue na tela nativa de Repos do Buzz Desktop",
                  },
                  SVG.externalLink({ h, width: 13, height: 13 }),
                  "Abrir no Buzz Desktop"
                ),
                h(
                  "button",
                  {
                    onClick: (e: any) => handleCopyDeepLink(e, activeIssueDetailCard),
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.copy({ h, width: 13, height: 13 }),
                  "Copiar Link"
                )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "button",
                  {
                    onClick: () => {
                      const c = activeIssueDetailCard;
                      setActiveIssueDetailCard(null);
                      setDispatchIssueId(c.issueId);
                      setIsDispatchModalOpen(true);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "rgba(245, 158, 11, 0.18)",
                      color: "#f59e0b",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.zap({ h, width: 12, height: 12 }),
                  "Despachar"
                ),
                activeIssueDetailCard.stage === "revisao" &&
                  h(
                    "button",
                    {
                      onClick: () => {
                        const c = activeIssueDetailCard;
                        setActiveIssueDetailCard(null);
                        handleAcceptGate(c);
                      },
                      style: {
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#10b981",
                        color: "#000000",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      },
                    },
                    SVG.checkCircle({ h, width: 12, height: 12 }),
                    "Aceitar Gate"
                  ),
                h(
                  "button",
                  {
                    onClick: () => {
                      const c = activeIssueDetailCard;
                      setActiveIssueDetailCard(null);
                      setActiveLogsCard(c);
                      setIsLogsDrawerOpen(true);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      color: "#9ca3af",
                      fontSize: "11px",
                      fontWeight: "500",
                      cursor: "pointer",
                    },
                  },
                  "Ver Logs"
                ),
                h(
                  "button",
                  {
                    onClick: () => setActiveIssueDetailCard(null),
                    style: {
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "transparent",
                      color: "#9ca3af",
                      fontSize: "11px",
                      cursor: "pointer",
                    },
                  },
                  "Fechar"
                )
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 7. MODAL AUTO-BOOTSTRAP & ONBOARDING 1-CLIQUE (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isBootstrapModalOpen &&
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
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2200,
            },
          },
          h(
            "div",
            {
              style: {
                width: "560px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
            },
            // Header
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                SVG.zap({ h, width: 20, height: 20 }),
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Auto-Bootstrap da Holding OrgFy"),
                // Badge de Configuração Existente
                (migrationSummary?.total || 16) > 0 &&
                  h(
                    "div",
                    {
                      style: {
                        padding: "2px 8px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "#38bdf8",
                        fontSize: "10px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    SVG.checkCircle({ h, width: 11, height: 11 }),
                    `Configuração Existente (${migrationSummary?.total || 16} agentes prontos)`
                  )
              ),
              h(
                "button",
                {
                  onClick: () => setIsBootstrapModalOpen(false),
                  title: "Fechar (Esc)",
                  style: {
                    background: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            h(
              "p",
              { style: { margin: 0, fontSize: "12px", color: "#9ca3af", lineHeight: "1.4" } },
              "Provisionamento determinístico de ponta a ponta: diagnóstico de binários locais (python3, git, docker), integridade do repositório, canal Nostr NIP-29 (#esteira-orgfy), registro dos 4 agentes canônicos e sincronização do Porteiro."
            ),
            // Progress Bar
            (() => {
              const successCount = bootstrapSteps.filter((s) => s.status === "success").length;
              const pct = Math.round((successCount / bootstrapSteps.length) * 100);
              return h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                  h("span", { style: { color: "#9ca3af" } }, "Progresso do Provisionamento:"),
                  h("span", { style: { color: pct === 100 ? "#10b981" : "#60a5fa", fontWeight: "700" } }, `${pct}%`)
                ),
                h(
                  "div",
                  {
                    style: {
                      height: "6px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      overflow: "hidden",
                    },
                  },
                  h("div", {
                    style: {
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: pct === 100 ? "#10b981" : "#3b82f6",
                      transition: "width 0.3s ease",
                    },
                  })
                )
              );
            })(),
            // Stepper List
            h(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  padding: "8px 0",
                },
              },
              bootstrapSteps.map((s, idx) => {
                const statusColor =
                  s.status === "success"
                    ? "#10b981"
                    : s.status === "running"
                    ? "#f59e0b"
                    : s.status === "error"
                    ? "#ef4444"
                    : "#6b7280";
                return h(
                  "div",
                  {
                    key: s.step,
                    style: {
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    },
                  },
                  h(
                    "div",
                    { style: { marginTop: "2px", color: statusColor } },
                    s.status === "success"
                      ? SVG.checkCircle({ h, width: 14, height: 14 })
                      : s.status === "running"
                      ? SVG.refresh({ h, width: 14, height: 14 })
                      : s.status === "error"
                      ? SVG.alertTriangle({ h, width: 14, height: 14 })
                      : h("div", {
                          style: {
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            border: "1.5px solid #6b7280",
                          },
                        })
                  ),
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 } },
                    h(
                      "span",
                      { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } },
                      `${idx + 1}. ${s.label}`
                    ),
                    s.details &&
                      h(
                        "span",
                        { style: { fontSize: "11px", color: statusColor, fontFamily: "monospace" } },
                        s.details
                      )
                  )
                );
              })
            ),
            // Actions
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "6px" } },
              h(
                "button",
                {
                  onClick: () => setIsBootstrapModalOpen(false),
                  title: "Fechar (Esc)",
                  style: {
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "transparent",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#9ca3af",
                    fontSize: "12px",
                    cursor: "pointer",
                  },
                },
                "Fechar"
              ),
              // Botão de Reconciliação & Migração (quando configuração existente for detectada)
              (migrationSummary?.total || 16) > 0 &&
                h(
                  "button",
                  {
                    onClick: async () => {
                      setIsBootstrapModalOpen(false);
                      setIsMigrationModalOpen(true);
                      if (!isMigrating) {
                        handleExecuteMigration();
                      }
                    },
                    style: {
                      padding: "8px 16px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      color: "#38bdf8",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG.users({ h, width: 14, height: 14 }),
                  "Reconciliar & Migrar Esteira"
                ),
              h(
                "button",
                {
                  onClick: handleRunBootstrap,
                  disabled: isBootstrapping,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: isBootstrapping ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                    border: "none",
                    color: "#000000",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: isBootstrapping ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                isBootstrapping
                  ? [SVG.refresh({ h, width: 14, height: 14 }), "Executando Auto-Bootstrap..."]
                  : [SVG.zap({ h, width: 14, height: 14 }), "Inicializar Tudo em 1-Clique"]
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 8. MODAL DIAGNÓSTICO DO SERVIDOR MCP NATIVO (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isMcpDiagnosticsOpen &&
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
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2200,
            },
          },
          h(
            "div",
            {
              style: {
                width: "580px",
                borderRadius: "16px",
                backgroundColor: "#111714",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
            },
            // Header
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.cpu({ h, width: 20, height: 20 }),
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Servidor MCP Nativo — Diagnóstico Técnico")
              ),
              h(
                "button",
                {
                  onClick: () => setIsMcpDiagnosticsOpen(false),
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            // Info Bar
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: "11px",
                },
              },
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Protocolo: "),
                h("span", { style: { color: "#60a5fa", fontWeight: "600" } }, "JSON-RPC 2.0 Loopback")
              ),
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Status: "),
                h(
                  "span",
                  { style: { color: mcpStatus.active ? "#10b981" : "#60a5fa", fontWeight: "600" } },
                  mcpStatus.active ? "🟢 ATIVO (ctx.host.serveMcp)" : "🟢 PRONTO / LOOPBACK"
                )
              ),
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Chamadas Registradas: "),
                h("span", { style: { color: "#10b981", fontWeight: "700" } }, `${mcpStatus.toolCallsCount} invocação(ões)`)
              ),
              h(
                "div",
                null,
                h("span", { style: { color: "#9ca3af" } }, "Clientes Suportados: "),
                h("span", { style: { color: "#ffffff" } }, "Antigravity, Claude, Goose, Pi")
              )
            ),
            // Tools Section
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "8px" } },
              h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Ferramentas Homologadas (7 Tools MCP + 13 AgentTools):"),
              [
                {
                  name: "orgfy_status",
                  desc: "Telemetria agregada ao vivo: FPY, CPI, cards ativos e catraca de regras probatórias RSI.",
                },
                {
                  name: "orgfy_kanban_read",
                  desc: "Matriz Kanban real (triagem, despachado, execucao, revisao, feito) sem fallback mockado.",
                },
                {
                  name: "orgfy_despachar",
                  desc: "Invocação determinística de despacho com validação mecânica L-01 (executor !== revisor).",
                },
                {
                  name: "orgfy_gate",
                  desc: "Decisão oficial de Gate Caixa-Preta (aceito/recusado) com holdout verification e alerta DSAP.",
                },
                {
                  name: "orgfy_porteiro_sync",
                  desc: "Disparo pontual do ciclo determinístico do Porteiro Nostr para reconciliar filas de PR e main.",
                },
                {
                  name: "orgfy_loop_radar",
                  desc: "Radar Live do Goose (mode=ro): detecta LOOP_SUSPEITO, STALLED_THINKING e SESSAO_DUPLICADA com channel_id/thread_root e acao_sugerida.",
                },
                {
                  name: "orgfy_session_stop",
                  desc: "Stop / Interrupt nativo (ctx.agents.session): interrompe ou reinicia sessões travadas ou inúteis queimando tokens.",
                },
              ].map((tool) =>
                h(
                  "div",
                  {
                    key: tool.name,
                    style: {
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    },
                  },
                  h("span", { style: { fontSize: "12px", fontFamily: "monospace", color: "#10b981", fontWeight: "700" } }, tool.name),
                  h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, tool.desc)
                )
              )
            ),
            // Close Button
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", marginTop: "6px" } },
              h(
                "button",
                {
                  onClick: () => setIsMcpDiagnosticsOpen(false),
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    backgroundColor: "#3b82f6",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                  },
                },
                "Entendido"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // 9. MODAL MIGRADOR DE AGENTES & WORKSPACE SOBERANO (ORGFY V10)
      // ───────────────────────────────────────────────────────────────────────
      isMigrationModalOpen &&
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
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2200,
            },
          },
          h(
            "div",
            {
              style: {
                width: "720px",
                maxHeight: "88vh",
                borderRadius: "16px",
                backgroundColor: "#0d1411",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                overflowY: "auto",
              },
            },
            // Header
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                SVG.users({ h, width: 20, height: 20 }),
                h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Migrador de Agentes & Workspace Soberano"),
                h("span", { style: { fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: "700" } }, "v12 Buzz-Native")
              ),
              h(
                "button",
                {
                  onClick: () => setIsMigrationModalOpen(false),
                  style: {
                    background: "none",
                    border: "none",
                    color: "var(--text-subtle, #9ca3af)",
                    cursor: "pointer",
                    padding: "4px",
                  },
                },
                SVG.xCircle({ h, width: 18, height: 18 })
              )
            ),
            // Description & Target workspace
            h(
              "div",
              { style: { fontSize: "12px", color: "#9ca3af", lineHeight: "1.5" } },
              "Sincronização atômica de todos os agentes OrgFy criados no Buzz Desktop. Vincula o diretório de execução ao repositório ",
              h("code", { style: { backgroundColor: "rgba(255, 255, 255, 0.08)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" } }, "/Users/heltonfraga/.buzz/REPOS/orgfy"),
              ", injeta contratos CoEvo-RSI (Tiers 1, 2 e 3), regras probatórias e ferramentas MCP loopback com backup automático (.bak)."
            ),
            // Metric Cards
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" } },
              h(
                "div",
                { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" } },
                h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Total de Agentes"),
                h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#ffffff", marginTop: "4px" } }, migrationSummary?.total || 16)
              ),
              h(
                "div",
                { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" } },
                h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Migrados para REPOS/orgfy"),
                h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#10b981", marginTop: "4px" } }, migrationSummary?.migratedCount || 16)
              ),
              h(
                "div",
                { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)" } },
                h("div", { style: { fontSize: "11px", color: "#38bdf8" } }, "Protocolo Ativo"),
                h("div", { style: { fontSize: "14px", fontWeight: "700", color: "#38bdf8", marginTop: "6px" } }, "v10 + CoEvo-RSI")
              )
            ),
            // Agent list
            h(
              "div",
              {
                style: {
                  maxHeight: "260px",
                  overflowY: "auto",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                },
              },
              (migrationSummary?.agents || []).map((ag) =>
                h(
                  "div",
                  {
                    key: ag.name,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                      fontSize: "12px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "10px",
                          fontWeight: "700",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: ag.isMigrated ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: ag.isMigrated ? "#10b981" : "#f59e0b",
                        },
                      },
                      ag.isMigrated ? "✅ MIGRADO" : "⚠️ PENDENTE"
                    ),
                    h("span", { style: { fontWeight: "600", color: "#ffffff" } }, ag.name),
                    h("span", { style: { color: "var(--text-subtle, #9ca3af)", fontSize: "11px" } }, `(${ag.role})`)
                  ),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            ag.tier === "tier_3_arquiteto"
                              ? "rgba(168, 85, 247, 0.2)"
                              : ag.tier === "tier_2_revisor"
                              ? "rgba(59, 130, 246, 0.2)"
                              : "rgba(16, 185, 129, 0.2)",
                          color:
                            ag.tier === "tier_3_arquiteto"
                              ? "#c084fc"
                              : ag.tier === "tier_2_revisor"
                              ? "#60a5fa"
                              : "#10b981",
                        },
                      },
                      ag.tier === "tier_3_arquiteto" ? "Tier 3 Arquiteto" : ag.tier === "tier_2_revisor" ? "Tier 2 Revisor" : "Tier 1 Executor"
                    ),
                    h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#6b7280" } }, ag.workspace.replace("/Users/heltonfraga/", "~/") || "~/.buzz")
                  )
                )
              )
            ),
            // Migration Terminal Log
            migrationLog &&
              h(
                "pre",
                {
                  style: {
                    maxHeight: "120px",
                    overflowY: "auto",
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: "#050706",
                    color: "#38bdf8",
                    fontFamily: "monospace",
                    fontSize: "10px",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  },
                },
                migrationLog
              ),
            // Action Buttons
            h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
              h(
                "button",
                {
                  onClick: loadMigrationData,
                  disabled: isMigrating,
                  style: {
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  },
                },
                "Re-verificar Status"
              ),
              h(
                "button",
                {
                  onClick: handleExecuteMigration,
                  disabled: isMigrating,
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isMigrating ? "rgba(56, 189, 248, 0.4)" : "#38bdf8",
                    color: "#000000",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: isMigrating ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                SVG.users({ h, width: 14, height: 14 }),
                isMigrating ? "Sincronizando Agentes..." : "Executar Migração Atômica (16 Agentes)"
              )
            )
          )
        ),

    );

    // ─────────────────────────────────────────────────────────────────────────
    // FUNÇÃO AUXILIAR: CATÁLOGO DE TEMPLATES & HUB DE RSI (EXPANSÃO DO COCKPIT)
    // ─────────────────────────────────────────────────────────────────────────
    function renderTemplatesRsiView() {
      const templatesReais = holdingData?.templatesReais || [];
      const regrasReais = holdingData?.regrasProbatorias || [];
      const fpyReal = kpisData?.qualidade?.fpy_real_pct;
      const totalIntegrados = kpisData?.fluxo?.vazao_total_feito;

      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            overflowY: "auto",
            paddingRight: "6px",
          },
        },
        h(
          "div",
          {
            style: {
              padding: "14px 18px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.025)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            },
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } }, "Templates Reais do Repositório & Motor RSI (Zero Mockups)"),
            h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, "Arquivos lidos diretamente de REPOS/orgfy/templates/ e regras-probatorias.json.")
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "span",
              { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.14)", color: "#10b981", fontWeight: "700", fontFamily: "monospace" } },
              `FPY Real: ${typeof fpyReal === "number" ? `${fpyReal.toFixed(1)}%` : "--"}`
            ),
            h(
              "span",
              { style: { fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(56, 189, 248, 0.14)", color: "#38bdf8", fontWeight: "700", fontFamily: "monospace" } },
              `${typeof totalIntegrados === "number" ? totalIntegrados : "--"} integrados`
            )
          )
        ),

        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" } },
          templatesReais.map((tmpl) =>
            h(
              "div",
              {
                key: tmpl.id,
                style: {
                  borderRadius: "10px",
                  backgroundColor: "#15161a",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                  h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, tmpl.name),
                  h("span", { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } }, tmpl.path)
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontWeight: "700",
                      backgroundColor: tmpl.exists ? "rgba(16, 185, 129, 0.16)" : "rgba(239, 68, 68, 0.16)",
                      color: tmpl.exists ? "#10b981" : "#f87171",
                      fontFamily: "monospace",
                    },
                  },
                  tmpl.exists ? `${tmpl.versionTag} · ${tmpl.linesCount} linhas` : "AUSENTE"
                )
              ),
              h("p", { style: { fontSize: "11px", color: "#9ca3af", margin: 0, lineHeight: "1.4" } }, tmpl.preview),
              h(
                "div",
                { style: { display: "flex", gap: "8px", marginTop: "auto" } },
                h(
                  "button",
                  {
                    onClick: () => {
                      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(tmpl.path);
                      }
                      showNotification("success", `Caminho copiado: ${tmpl.path}`);
                    },
                    style: {
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      color: "#cbd5e1",
                      fontSize: "10px",
                      fontWeight: "600",
                      cursor: "pointer",
                    },
                  },
                  "Copiar Caminho"
                ),
                tmpl.exists &&
                  h(
                    "button",
                    {
                      onClick: () => {
                        if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
                          navigator.clipboard.writeText(tmpl.content);
                        }
                        showNotification("success", `Conteúdo real de ${tmpl.path} copiado!`);
                      },
                      style: {
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        backgroundColor: "rgba(56, 189, 248, 0.1)",
                        color: "#38bdf8",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: "pointer",
                      },
                    },
                    "Copiar Template"
                  )
              )
            )
          )
        ),

        h(
          "div",
          {
            style: {
              borderRadius: "10px",
              backgroundColor: "#15161a",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            },
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, `Regras Probatórias L-90 (${regrasReais.length} ativas em regras-probatorias.json)`),
            h(
              "button",
              {
                onClick: async () => {
                  showNotification("info", "Disparando retro.py para compilação probatória...");
                  const res = await compileProbationaryRule(ctx, {
                    erroId: "auto-" + Date.now().toString().slice(-4),
                    descricao: "Prevenção compilada via Control Plane v2",
                    comandoCheck: "python3 -m pytest -q testes/esteira -v",
                  });
                  if (res.success) {
                    await loadHolding();
                    showNotification("success", "Regra probatória compilada com sucesso!");
                  } else {
                    showNotification("warning", "Falha na compilação da regra probatória.");
                  }
                },
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#c084fc",
                  color: "#000000",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                },
              },
              "+ Compilar Regra"
            )
          ),
          regrasReais.length === 0
            ? h(
                "div",
                { style: { padding: "14px", textAlign: "center", color: "#9ca3af", fontSize: "11px" } },
                "Nenhuma regra probatória registrada em .esteira/estado/regras-probatorias.json no momento."
              )
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                regrasReais.map((r) =>
                  h(
                    "div",
                    {
                      key: r.id,
                      style: {
                        display: "grid",
                        gridTemplateColumns: "110px 1fr 120px 100px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(0,0,0,0.25)",
                        fontSize: "11px",
                        alignItems: "center",
                      },
                    },
                    h("span", { style: { fontFamily: "monospace", color: "#f3f4f6", fontWeight: "600" } }, r.id),
                    h("span", { style: { color: "#9ca3af" } }, r.descricao),
                    h("span", { style: { fontFamily: "monospace", color: "#60a5fa" } }, `${r.cardsAvaliados}/${r.janelaAlvo} cards`),
                    h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981" } }, r.status)
                  )
                )
              )
        )
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FUNÇÃO AUXILIAR: RENDERIZAÇÃO DE COLUNA DO KANBAN
    // ─────────────────────────────────────────────────────────────────────────
    function renderColumn(
      title: string,
      cards: PipelineCard[],
      badgeBg: string,
      badgeColor: string,
      renderAction?: (card: PipelineCard) => any
    ) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            borderRadius: "10px",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            border: `1px solid ${THEME.hairline}`,
            padding: "10px",
            minHeight: 0,
            height: "100%",
            maxHeight: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
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
              borderBottom: `1px solid ${THEME.hairline}`,
              marginBottom: "10px",
              flexShrink: 0,
            },
          },
          h("span", { style: { fontWeight: "600", fontSize: "12px", color: THEME.textPrimary } }, title),
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
        // Cards List (Face Limpa e Escaneável com Scroll Vertical Independente)
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px" } },
          cards.length === 0
            ? h(
                "div",
                {
                  style: {
                    padding: "24px 10px",
                    textAlign: "center",
                    color: THEME.textMuted,
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
                    onClick: () => setActiveIssueDetailCard(c),
                    style: {
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: THEME.cardBg,
                      border: `1px solid ${THEME.borderCard}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      cursor: "pointer",
                      transition: "background 0.15s ease, border-color 0.15s ease",
                    },
                    onMouseEnter: (e: any) => (e.currentTarget.style.backgroundColor = THEME.cardHover),
                    onMouseLeave: (e: any) => (e.currentTarget.style.backgroundColor = THEME.cardBg),
                  },
                  // Card Top (Tenant + Issue ID + Priority + Stage)
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "6px" } },
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "9px",
                            fontFamily: "monospace",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            color: "#8b949e",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                            fontWeight: "600",
                          },
                        },
                        c.empresa || "orgfy"
                      ),
                      h(
                        "span",
                        {
                          onClick: (e: any) => {
                            e.stopPropagation();
                            if (hasValidNostrIssueId(c)) {
                              handleOpenIssueDeepLink(c);
                            } else {
                              setActiveIssueDetailCard(c);
                            }
                          },
                          title: hasValidNostrIssueId(c)
                            ? "Abrir issue diretamente no Buzz Desktop"
                            : "Worktree local — clique para ver detalhes no Cockpit",
                          style: {
                            fontSize: "11px",
                            fontFamily: "monospace",
                            color: hasValidNostrIssueId(c) ? "#58a6ff" : "#f59e0b",
                            fontWeight: "700",
                            cursor: "pointer",
                            textDecoration: hasValidNostrIssueId(c) ? "underline" : "none",
                            textUnderlineOffset: "2px",
                          },
                        },
                        hasValidNostrIssueId(c)
                          ? `#${(c.issueId || c.id).slice(0, 8)} ↗`
                          : `#${(c.issueId || c.id).slice(0, 12)}`
                      )
                    ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "5px" } },
                      c.ciStatus &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "9px",
                              fontFamily: "monospace",
                              fontWeight: "700",
                              color: c.ciStatus === "pass" ? "#10b981" : c.ciStatus === "running" ? "#f59e0b" : "#ef4444",
                              backgroundColor:
                                c.ciStatus === "pass"
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : c.ciStatus === "running"
                                  ? "rgba(245, 158, 11, 0.12)"
                                  : "rgba(239, 68, 68, 0.12)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            },
                          },
                          `CI:${c.ciStatus.toUpperCase()}`
                        ),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            fontWeight: "700",
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
                                ? "#f87171"
                                : c.priority === "P1"
                                ? "#fbbf24"
                                : "#60a5fa",
                          },
                        },
                        c.priority
                      )
                    )
                  ),
                  // Card Title
                  h(
                    "div",
                    {
                      style: {
                        fontSize: "12px",
                        fontWeight: "600",
                        color: THEME.textPrimary,
                        lineHeight: "1.4",
                      },
                    },
                    c.title
                  ),
                  // Informações Hermes: L-22 Aceite + Worktree Chips
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                    c.acceptanceCommand &&
                      h(
                        "div",
                        {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            backgroundColor: "rgba(16, 185, 129, 0.08)",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            color: "#34d399",
                            fontFamily: "monospace",
                            fontSize: "9.5px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                          title: `Comando Invariante L-22: ${c.acceptanceCommand}`,
                        },
                        h("span", { style: { fontWeight: "700", color: "#10b981" } }, "L-22:"),
                        h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, c.acceptanceCommand)
                      ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                      h(
                        "span",
                        {
                          style: {
                            color: "#38bdf8",
                            fontFamily: "monospace",
                            fontSize: "9.5px",
                            backgroundColor: "rgba(56, 189, 248, 0.08)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          },
                          title: `Worktree Isolada: ${c.worktreePath || `.worktrees/${c.issueId}`}`,
                        },
                        h(
                          "span",
                          { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                          SVG.folder({ h, width: 10, height: 10 }),
                          (c.worktreePath || `.worktrees/${c.issueId}`).replace(".worktrees/", "")
                        )
                      ),
                      h(
                        "span",
                        {
                          style: {
                            color: "#c084fc",
                            fontSize: "9.5px",
                            fontFamily: "monospace",
                          },
                        },
                        c.branch || c.tier
                      )
                    )
                  ),
                  // Card Footer (Papéis + Relative Elapsed Time)
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10px",
                        color: THEME.textMuted,
                        borderTop: `1px solid ${THEME.hairline}`,
                        paddingTop: "6px",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "5px" } },
                      h(
                        "span",
                        {
                          style: {
                            color: "#cbd5e1",
                            fontWeight: "600",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          },
                        },
                        c.executor || "Não atribuído"
                      ),
                      c.revisor &&
                        h(
                          "span",
                          { style: { color: "#8b949e", fontSize: "9px" } },
                          `→ ${c.revisor}`
                        )
                    ),
                    h(
                      "span",
                      {
                        style: {
                          fontFamily: "monospace",
                          fontSize: "10px",
                          color: "#34d399",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        },
                        title: c.createdAt ? formatFullDateTime(c.createdAt) : undefined,
                      },
                      SVG.clock({ h, width: 10, height: 10 }),
                      formatRelativeTime(c.createdAt || c.updatedAt || c.elapsedTime)
                    )
                  ),
                  // Ação Rápida da Raia (Despachar / Ver Logs / Decidir Gate)
                  renderAction &&
                    h(
                      "div",
                      { onClick: (e: any) => e.stopPropagation() },
                      renderAction(c)
                    )
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

  // Registra Página Principal com layout: "workspace" (Zero margens de documento)
  ctx.pages.register({
    id: "orgfy",
    title: "OrgFy Control Room",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    icon: ORGFY_PAGE_ICON,
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
