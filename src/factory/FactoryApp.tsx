// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/shell/app-shell.tsx e routes/project.tsx
// Shell nativo do Buzz para a OrgFy Factory: Sidebar global (CEO Master via mainAgent, Conselho, Inbox, Uso & Custos, Automações, Empresas com unread real) + Menu Superior com abas por Empresa + Telemetria ao vivo (session.agentActivity) + Painel lateral nativo (ctx.conversation.ui.Tabs).

import type { Context } from "@buzz/author";
import { PT_BR } from "../i18n/pt-BR";
import {
  buildEmptyFactoryStatus,
  fetchFactoryStatus,
  writeTenantControl,
  type AutonomyMode,
  type FactoryStatusPayload,
  type FactoryWorkItem,
} from "./factory-adapter";
import { attachFactoryShadowStyles, FACTORY_SHADOW_CSS } from "./shadow-shell";
import { renderFactoryOverviewPanel } from "./FactoryOverviewPanel";
import { renderAgentProfileDrawer, renderFactoryBoardAndFloor, type LiveCrewAgent } from "./FactoryBoardAndFloor";
import { createCodeDenInspectorDrawer } from "../components/CodeDenInspectorDrawer";
import { createFloor3DComponent } from "./codeden-floor/Floor3DCanvas";
import { createBoardroom3DComponent } from "./Boardroom3DCanvas";
import { createHoldingTower3DComponent } from "./HoldingTower3DCanvas";
import { renderFactorySecondaryPage } from "./FactoryPages";
import {
  dismissErrorTurn,
  interruptLiveTurn,
  readBuzzChannelCanvasDetailed,
  readBuzzChannelCanvasHistory,
  readBuzzLiveTelemetry,
  readBuzzMainAgentPubkey,
  saveBuzzChannelCanvas,
  type BuzzCanvasHistoryEntry,
  type LiveAgentTurn,
} from "./buzz-live-telemetry";
import {
  DEFAULT_ORGFY_REPO_OWNER,
  loadLiveRepoEntityDetail,
  loadLiveRepoSnapshot,
  openBuzzRepoEntity,
  openPrInBuzz,
  openRepoTabInBuzz,
  resolveBuzzIdentityName,
  type LiveRepoEntityDetail,
  type LiveRepoSnapshot,
} from "../services/buzz-repos-live";
import { subscribeRelayUpdates } from "../services/buzz-native";
import {
  findBuzzChannelIdByName,
  loadBuzzChannelLiveInfo,
  navigateToBuzzChannel,
  resolveBuzzNavigationScope,
  runBuzzChannelDiagnosticAction,
  saveBuzzChannelDetailsLive,
  type BuzzChannelLiveInfo,
} from "../services/buzz-channel-live";
import {
  autoMatchBuzzWorkspace,
  buildEffectiveTenantAgents,
  listBuzzWorkspaces,
  loadBuzzWorkspaceDetails,
  loadLiveChannelAgentRoster,
  saveBuzzWorkspaceDetails,
  type BuzzWorkspaceDetails,
  type BuzzWorkspacesCatalog,
} from "../services/buzz-workspace-live";
import { openIssueInBuzz, openSystemUri } from "../services/orgfy-bridge";
import { fetchHoldingControlPlane, type HoldingControlPlaneSnapshot } from "../services/holding-service";
import { executeCardProgress } from "../services/card-progress";
import { renderCommandPalette, renderFactorySidebar, type FactorySidebarProps } from "./FactorySidebar";
import { buildAutomationFromSession, buildDefaultAutomations, DEFAULT_GUARDS, exportAutomationToBuzzWorkflowYaml, exportAutomationToMarkdown, ORGFY_AUTOMATION_TEMPLATES, type OrgfyAutomation } from "./AutomationEditor";
import { createQuestionCardsPanel } from "./QuestionCardsPanel";
import {
  getOrgfyCrdtStore,
  type OrgfyCouncilDeliberation,
  type OrgfyDistributedLock,
  type OrgfyQuestionCard,
  type QuestionCardAnswer,
} from "../services/orgfy-crdt-store";
import { sendBuzzChatMessageOrWake, type BuzzDispatchResult } from "../services/buzz-chat-dispatch";
import { collectBuzzNativeUsage, type BuzzNativeUsageSnapshot } from "../services/buzz-usage-live";
import { notifyRespectingFocus, readBuzzFocusState, subscribeBuzzFocus, type BuzzFocusState } from "../services/buzz-focus";
import { auditAllHostCommandsIntegrity, type CommandIntegrityAuditSummary } from "../services/command-integrity";
import { buildUnifiedOrgfyTools } from "../tools/registry";
import { loadLiveGatewayModelCatalog, pickLiveRecommendedModel } from "../components/AgentOrgfyTab";

type FactoryTab =
  | "holding"
  | "inbox"
  | "costs"
  | "automations"
  | "overview"
  | "board"
  | "floor"
  | "agents"
  | "vision"
  | "settings";

const GLOBAL_TABS = new Set<FactoryTab>(["inbox", "costs", "automations"]);

const DEFAULT_WORKSPACES = [
  { slug: "orgfy", nome: "OrgFy Core", estagio: "operacional", canal: "" },
  { slug: "lumen-iptv", nome: "Lumen IPTV", estagio: "operacional", canal: "" },
  { slug: "saas-tributario", nome: "SaaS Tributário", estagio: "planejado", canal: "" },
];

export interface CreateFactoryAppOptions {
  onOpenClassicCockpit?: () => void;
}

export function createFactoryAppComponent(ctx: Context, opts: CreateFactoryAppOptions = {}) {
  const React = ctx.react;
  const h = React.createElement;
  const Floor3D = createFloor3DComponent(ctx);
  const Boardroom3D = createBoardroom3DComponent(ctx);
  const HoldingTower3D = createHoldingTower3DComponent(ctx);
  const CodeDenInspectorDrawer = createCodeDenInspectorDrawer(React);
  const QuestionCardsPanel = createQuestionCardsPanel(React);
  const crdtStore = getOrgfyCrdtStore(ctx);

  return function OrgFyFactoryApp() {
    const [tenant, setTenant] = React.useState<string>("orgfy");
    const [tab, setTab] = React.useState<FactoryTab>("overview");
    const [dmAgentKey, setDmAgentKey] = React.useState<string>("");
    const [openingDm, setOpeningDm] = React.useState<boolean>(false);
    const [relayTick, setRelayTick] = React.useState<number>(0);
    const [activityTick, setActivityTick] = React.useState<number>(0);
    const [mainAgentPubkey, setMainAgentPubkey] = React.useState<string | null>(null);
    const [channelCanvas, setChannelCanvas] = React.useState<string | null>(null);
    const [canvasDraft, setCanvasDraft] = React.useState<string>("");
    const [canvasMode, setCanvasMode] = React.useState<"view" | "edit" | "history">("view");
    const [canvasEventId, setCanvasEventId] = React.useState<string | undefined>(undefined);
    const [canvasWritable, setCanvasWritable] = React.useState<boolean>(false);
    const [canvasSaving, setCanvasSaving] = React.useState<boolean>(false);
    const [canvasHistory, setCanvasHistory] = React.useState<BuzzCanvasHistoryEntry[]>([]);
    const [channelInfo, setChannelInfo] = React.useState<BuzzChannelLiveInfo | null>(null);
    const [editingChannelDetails, setEditingChannelDetails] = React.useState<boolean>(false);
    const [channelDetailsDraft, setChannelDetailsDraftState] = React.useState<{ name: string; description: string }>({ name: "", description: "" });
    const setChannelDetailsDraft = React.useCallback((patch: Partial<{ name: string; description: string }>) => {
      setChannelDetailsDraftState((prev) => ({ ...prev, ...patch }));
    }, []);
    const [savingChannelDetails, setSavingChannelDetails] = React.useState<boolean>(false);
    const [liveRepo, setLiveRepo] = React.useState<LiveRepoSnapshot | null>(null);
    const [selectedItemDetail, setSelectedItemDetail] = React.useState<LiveRepoEntityDetail | null>(null);
    const [selectedItemDetailLoading, setSelectedItemDetailLoading] = React.useState<boolean>(false);
    const [editingAgentKey, setEditingAgentKey] = React.useState<string | null>(null);
    const [syncingPromptKey, setSyncingPromptKey] = React.useState<string | null>(null);
    const [agentPromptSyncMap, setAgentPromptSyncMap] = React.useState<Record<string, { status: "synced" | "outdated" | "unversioned"; version: string; liveVersion?: string; sourcePath?: string; content?: string }>>({});
    const [buzzCatalog, setBuzzCatalog] = React.useState<BuzzWorkspacesCatalog>({ available: false, workspaces: [], allChannels: [], assignments: {} });
    const [linkedWorkspaceId, setLinkedWorkspaceId] = React.useState<string>("");
    const [linkedChannelId, setLinkedChannelId] = React.useState<string>("");
    const [workspaceDetails, setWorkspaceDetails] = React.useState<BuzzWorkspaceDetails | null>(null);
    const [workspaceDraft, setWorkspaceDraftState] = React.useState<{ foldersText: string; worktreeLocation: string; worktreeBranch: string; instructions: string }>({
      foldersText: "",
      worktreeLocation: "~/.buzz/worktrees",
      worktreeBranch: "main",
      instructions: "",
    });
    const setWorkspaceDraft = React.useCallback((patch: Partial<{ foldersText: string; worktreeLocation: string; worktreeBranch: string; instructions: string }>) => {
      setWorkspaceDraftState((prev) => ({ ...prev, ...patch }));
    }, []);
    const [savingWorkspaceDetails, setSavingWorkspaceDetails] = React.useState<boolean>(false);
    const [liveChannelAgents, setLiveChannelAgents] = React.useState<LiveCrewAgent[]>([]);
    const [savingEnterpriseLink, setSavingEnterpriseLink] = React.useState<boolean>(false);
    const [agentEditDraft, setAgentEditDraftState] = React.useState<{ provider: string; model: string; instructions: string }>({ provider: "", model: "", instructions: "" });
    const setAgentEditDraft = React.useCallback((patch: Partial<{ provider: string; model: string; instructions: string }>) => {
      setAgentEditDraftState((prev) => ({ ...prev, ...patch }));
    }, []);
    const [status, setStatus] = React.useState<FactoryStatusPayload>(() => buildEmptyFactoryStatus("orgfy"));
    const [holding, setHolding] = React.useState<HoldingControlPlaneSnapshot | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);
    const [activeHelpKey, setActiveHelpKey] = React.useState<string | null>(null);
    const [selectedItem, setSelectedItem] = React.useState<FactoryWorkItem | null>(null);
    const [confirmKill, setConfirmKill] = React.useState<boolean>(false);
    const [autonomyModal, setAutonomyModal] = React.useState<{
      open: boolean;
      targetMode: AutonomyMode;
      autoMerge: boolean;
      enableStarterSet: boolean;
    } | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
      try { return localStorage.getItem("orgfy_factory_sidebar_collapsed") === "1"; } catch { return false; }
    });
    const [paletteOpen, setPaletteOpen] = React.useState<boolean>(false);
    const [paletteQuery, setPaletteQuery] = React.useState<string>("");
    const [guideOpen, setGuideOpen] = React.useState<boolean>(false);
    const [guideSection, setGuideSection] = React.useState<string>("loop");
    const [runningScout, setRunningScout] = React.useState<boolean>(false);
    const [automations, setAutomations] = React.useState<OrgfyAutomation[]>(() => buildDefaultAutomations("orgfy", "OrgFy Core"));
    const [selectedAutomationId, setSelectedAutomationId] = React.useState<string>("rotina-ceo-orgfy");
    const [automationView, setAutomationView] = React.useState<"list" | "detail">("list");
    const [runningAutomationId, setRunningAutomationId] = React.useState<string | null>(null);
    const [cooUpdatesExpanded, setCooUpdatesExpanded] = React.useState<boolean>(false);
    const [sendingCooUpdates, setSendingCooUpdates] = React.useState<boolean>(false);
    const [questionCards, setQuestionCards] = React.useState<OrgfyQuestionCard[]>([]);
    const [councilDeliberations, setCouncilDeliberations] = React.useState<OrgfyCouncilDeliberation[]>([]);
    const [distributedLocks, setDistributedLocks] = React.useState<OrgfyDistributedLock[]>([]);
    const [nativeUsage, setNativeUsage] = React.useState<BuzzNativeUsageSnapshot | null>(null);
    const [focusState, setFocusState] = React.useState<BuzzFocusState>(() => readBuzzFocusState());
    const [commandIntegrity, setCommandIntegrity] = React.useState<CommandIntegrityAuditSummary | null>(null);
    const [runningHoldout, setRunningHoldout] = React.useState<boolean>(false);
    const [evaluatingTrust, setEvaluatingTrust] = React.useState<boolean>(false);
    const [scaffoldingSubsidiary, setScaffoldingSubsidiary] = React.useState<boolean>(false);
    const [subsidiaryDraft, setSubsidiaryDraftState] = React.useState<{ open: boolean; slug: string; nome: string; descricao: string; budgetTokensDiario: number; gastoDiaUsd: number }>({
      open: false,
      slug: "",
      nome: "",
      descricao: "",
      budgetTokensDiario: 1000000,
      gastoDiaUsd: 30,
    });
    const setSubsidiaryDraft = React.useCallback((patch: Partial<typeof subsidiaryDraft>) => {
      setSubsidiaryDraftState((prev) => ({ ...prev, ...patch }));
    }, []);
    const [compactDensity, setCompactDensity] = React.useState<boolean>(false);
    const [expandedProjects, setExpandedProjects] = React.useState<Record<string, boolean>>({ orgfy: true });
    const [showAllByProject, setShowAllByProject] = React.useState<Record<string, boolean>>({});

    const toggleSidebarCollapsed = React.useCallback(() => {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try { localStorage.setItem("orgfy_factory_sidebar_collapsed", next ? "1" : "0"); } catch {}
        return next;
      });
    }, []);

    React.useEffect(() => {
      const onKey = (ev: KeyboardEvent) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "b") {
          ev.preventDefault();
          toggleSidebarCollapsed();
        } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
          ev.preventDefault();
          setPaletteOpen((v) => !v);
        } else if (ev.key === "Escape") {
          setPaletteOpen(false);
          setGuideOpen(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [toggleSidebarCollapsed]);

    // Ref para o abridor nativo de abas laterais do Buzz (ctx.conversation.ui.Tabs)
    const openSideTabRef = React.useRef<
      ((target: { channelId: string; threadId?: string; messageId?: string }, options?: { keep?: boolean; markRead?: boolean }) => boolean) | null
    >(null);

    React.useEffect(() => {
      const relay = (ctx as any)?.relay;
      if (typeof relay?.subscribe !== "function") return;
      return relay.subscribe(() => setRelayTick((n) => n + 1));
    }, []);

    // Ativa e assina telemetria ao vivo nativa do Buzz (session.agentActivity + unread + mainAgent)
    React.useEffect(() => {
      const session = (ctx as any)?.relay?.snapshot?.()?.session;
      if (!session) return;
      const disposers: Array<() => void> = [];
      const bump = () => setActivityTick((n) => n + 1);
      try {
        if (typeof session.agentActivity?.activate === "function") disposers.push(session.agentActivity.activate());
        if (typeof session.agentActivity?.subscribe === "function") disposers.push(session.agentActivity.subscribe(bump));
        if (typeof session.agentActivity?.subscribeWorking === "function") disposers.push(session.agentActivity.subscribeWorking(bump));
        if (typeof session.unread?.subscribe === "function") disposers.push(session.unread.subscribe(bump));
      } catch {}
      readBuzzMainAgentPubkey(ctx).then((pk) => {
        if (pk) setMainAgentPubkey(pk);
      }).catch(() => {});
      return () => {
        for (const d of disposers) {
          try { d(); } catch {}
        }
      };
    }, [relayTick]);

    // Carrega catálogo ao vivo de Workspaces (sidebarPreferences) e Canais do Buzz Desktop
    React.useEffect(() => {
      let cancelled = false;
      listBuzzWorkspaces(ctx)
        .then((cat) => {
          if (!cancelled) setBuzzCatalog(cat);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [relayTick]);

    // Resolve vínculo ativo Workspace + Canal Principal para a empresa selecionada (localStorage -> manifesto -> auto-match)
    React.useEffect(() => {
      let savedWs = "";
      let savedCh = "";
      try {
        savedWs = localStorage.getItem(`orgfy_tenant_ws_${tenant}`) || "";
        savedCh = localStorage.getItem(`orgfy_tenant_ch_${tenant}`) || "";
      } catch {}
      const manifestCanal =
        status.tenantManifest?.canal ||
        holding?.empresas.find((e) => e.slug === tenant)?.canal ||
        "";
      const manifestCanalExists = Boolean(manifestCanal && buzzCatalog.allChannels.some((c) => c.id === manifestCanal));
      const savedChExists = Boolean(savedCh && buzzCatalog.allChannels.some((c) => c.id === savedCh));
      const matchedWs =
        (savedWs && buzzCatalog.workspaces.find((w) => w.id === savedWs)) ||
        (savedChExists && buzzCatalog.assignments[savedCh] && buzzCatalog.workspaces.find((w) => w.id === buzzCatalog.assignments[savedCh])) ||
        (manifestCanalExists && buzzCatalog.assignments[manifestCanal] && buzzCatalog.workspaces.find((w) => w.id === buzzCatalog.assignments[manifestCanal])) ||
        autoMatchBuzzWorkspace(buzzCatalog, tenant, status.tenantManifest?.nome || tenant);
      const resolvedWsId = matchedWs?.id || savedWs || "";
      const resolvedChId =
        (savedChExists ? savedCh : "") ||
        (manifestCanalExists ? manifestCanal : "") ||
        matchedWs?.channels[0]?.id ||
        manifestCanal ||
        "";
      setLinkedWorkspaceId(resolvedWsId);
      setLinkedChannelId(resolvedChId);
    }, [tenant, buzzCatalog, status.tenantManifest?.canal, status.tenantManifest?.nome, holding]);

    // Carrega detalhes do Workspace vinculado (folders, worktree, Instructions) via session.channelKit
    React.useEffect(() => {
      let cancelled = false;
      if (!linkedWorkspaceId) {
        setWorkspaceDetails(null);
        return;
      }
      const wsObj = buzzCatalog.workspaces.find((w) => w.id === linkedWorkspaceId);
      loadBuzzWorkspaceDetails(ctx, linkedWorkspaceId, wsObj?.name || status.tenantManifest?.nome || tenant)
        .then((det) => {
          if (cancelled) return;
          setWorkspaceDetails(det);
          if (det) {
            setWorkspaceDraftState({
              foldersText: det.folders.join("\n"),
              worktreeLocation: det.worktree?.location || "~/.buzz/worktrees",
              worktreeBranch: det.worktree?.baseBranch || "main",
              instructions: det.instructions || "",
            });
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [linkedWorkspaceId, buzzCatalog.workspaces, tenant, status.tenantManifest?.nome]);

    // Lê Canvas ao vivo + histórico (session.canvas.read/history), metadados do canal (session.channels/channelDetails) e Buzz Repos NIP-34
    React.useEffect(() => {
      let cancelled = false;
      const canal =
        linkedChannelId ||
        status.tenantManifest?.canal ||
        holding?.empresas.find((e) => e.slug === tenant)?.canal ||
        (tenant === "board" ? findBuzzChannelIdByName(ctx, ["Conselho", "Board", "Conselho da Holding"]) : null);
      const dtag = status.tenantManifest?.repoId || tenant;
      readBuzzChannelCanvasDetailed(ctx, canal)
        .then((st) => {
          if (!cancelled) {
            setChannelCanvas(st.content);
            setCanvasDraft(st.content || "");
            setCanvasEventId(st.eventId);
            setCanvasWritable(st.writable);
          }
        })
        .catch(() => {});
      readBuzzChannelCanvasHistory(ctx, canal)
        .then((hist) => {
          if (!cancelled) setCanvasHistory(hist);
        })
        .catch(() => {});
      loadBuzzChannelLiveInfo(ctx, canal)
        .then((info) => {
          if (!cancelled) setChannelInfo(info);
        })
        .catch(() => {});
      setLiveRepo(null);
      loadLiveRepoSnapshot(ctx, { channelId: canal, dtag })
        .then((snap) => {
          if (cancelled) return;
          // Isolamento estrito por empresa: nunca herda repo NIP-34 de outra empresa (ex.: orgfy vazando em lumen-iptv)
          if (snap.available && String(snap.dtag || "").toLowerCase() === String(dtag || "").toLowerCase()) {
            setLiveRepo(snap);
          } else {
            setLiveRepo(null);
          }
        })
        .catch(() => {
          if (!cancelled) setLiveRepo(null);
        });
      return () => {
        cancelled = true;
      };
    }, [tenant, linkedChannelId, status.tenantManifest?.canal, status.tenantManifest?.repoId, relayTick]);

    // Ao abrir um card no ItemSheetDrawer, carrega conteúdo NIP-34 + fallback local em REPOS/<repoId>/cards/*.md
    React.useEffect(() => {
      let cancelled = false;
      if (!selectedItem || !/^[0-9a-f]{64}$/i.test(selectedItem.id || "")) {
        setSelectedItemDetail(null);
        setSelectedItemDetailLoading(false);
        return;
      }
      setSelectedItemDetailLoading(true);
      const isPr = String(selectedItem.workKey || "").startsWith("pr:");
      const expectedDtag = status.tenantManifest?.repoId || tenant;
      const matchedRepoDtag = liveRepo?.dtag && liveRepo.dtag.toLowerCase() === expectedDtag.toLowerCase() ? liveRepo.dtag : expectedDtag;
      const readLocalCardFallback = async (): Promise<string | null> => {
        const readFile = (ctx as any)?.host?.readFile;
        if (typeof readFile !== "function") return null;
        const decode = (raw: any) => (raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw || ""));
        const repoRoot = `/Users/heltonfraga/.buzz/REPOS/${expectedDtag}`;
        try {
          const rawIdx = decode(await readFile(`${repoRoot}/cards/.index.json`));
          const parsed = JSON.parse(rawIdx);
          const cardsObj = parsed?.cards && typeof parsed.cards === "object" ? parsed.cards : parsed;
          if (cardsObj && typeof cardsObj === "object") {
            const targetId = selectedItem.id.toLowerCase();
            for (const [slug, meta] of Object.entries<any>(cardsObj)) {
              const mid = String(meta?.issue_id || meta?.issueId || "").toLowerCase();
              if (mid && (mid === targetId || mid.startsWith(targetId.slice(0, 8)) || targetId.startsWith(mid.slice(0, 8)))) {
                const fname = String(meta?.slug || slug).endsWith(".md") ? String(meta?.slug || slug) : `${String(meta?.slug || slug)}.md`;
                const md = decode(await readFile(`${repoRoot}/cards/${fname}`));
                if (md.trim()) return md;
              }
            }
          }
        } catch {}
        return null;
      };
      loadLiveRepoEntityDetail(ctx, {
        type: isPr ? "pr" : "issue",
        owner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER,
        dtag: matchedRepoDtag,
        id: selectedItem.id,
      })
        .then(async (det) => {
          if (cancelled) return;
          if (det && det.content && det.content.trim()) {
            setSelectedItemDetail(det);
            setSelectedItemDetailLoading(false);
            return;
          }
          const localMd = await readLocalCardFallback();
          if (cancelled) return;
          if (localMd) {
            setSelectedItemDetail({
              route: det?.route || { type: isPr ? "pr" : "issue", owner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER, dtag: matchedRepoDtag, id: selectedItem.id },
              title: det?.title || selectedItem.title,
              content: localMd,
              status: det?.status || selectedItem.stage,
              authorPubkey: det?.authorPubkey || "",
              createdAt: det?.createdAt || selectedItem.updatedAt,
              commit: det?.commit,
              commitDiff: det?.commitDiff || null,
              channels: det?.channels || [],
              comments: det?.comments || [],
            });
          } else {
            setSelectedItemDetail(det);
          }
          setSelectedItemDetailLoading(false);
        })
        .catch(async () => {
          const localMd = await readLocalCardFallback();
          if (cancelled) return;
          if (localMd) {
            setSelectedItemDetail({
              route: { type: isPr ? "pr" : "issue", owner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER, dtag: matchedRepoDtag, id: selectedItem.id },
              title: selectedItem.title,
              content: localMd,
              status: selectedItem.stage,
              authorPubkey: "",
              createdAt: selectedItem.updatedAt,
              commitDiff: null,
              channels: [],
              comments: [],
            });
          } else {
            setSelectedItemDetail(null);
          }
          setSelectedItemDetailLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [selectedItem?.id, liveRepo?.owner, liveRepo?.dtag, status.tenantManifest?.repoId, tenant]);

    // Estados das páginas
    const [scorecardView, setScorecardView] = React.useState<"builders" | "reviewers" | "pairs">("builders");
    const [scorecardDays, setScorecardDays] = React.useState<7 | 30 | 90>(30);
    const [storeyFocus, setStoreyFocus] = React.useState<"workshop" | "lookout" | "both" | "tower">("both");
    const [selectedAgentKey, setSelectedAgentKey] = React.useState<string | null>(null);
    const [inboxFilter, setInboxFilter] = React.useState<"all" | "asks" | "reviews" | "problems">("all");
    const [inboxDismissedIds, setInboxDismissedIds] = React.useState<string[]>(() => {
      try {
        const raw = localStorage.getItem("orgfy_inbox_dismissed_ids");
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });
    const [confirmBulkDismiss, setConfirmBulkDismiss] = React.useState<boolean>(false);
    const [lastBulkDismiss, setLastBulkDismiss] = React.useState<{ ids: string[]; label: string } | null>(null);
    const handleInboxDismissIds = React.useCallback((ids: string[], label = "avisos") => {
      if (!ids.length) return;
      setInboxDismissedIds((prev) => {
        const next = Array.from(new Set([...prev, ...ids])).slice(-200);
        try { localStorage.setItem("orgfy_inbox_dismissed_ids", JSON.stringify(next)); } catch {}
        return next;
      });
      setLastBulkDismiss({ ids, label });
      setTimeout(() => setLastBulkDismiss((cur) => (cur && cur.ids === ids ? null : cur)), 10_000);
    }, []);
    const handleInboxRestoreIds = React.useCallback((ids: string[]) => {
      const rm = new Set(ids);
      setInboxDismissedIds((prev) => {
        const next = prev.filter((id) => !rm.has(id));
        try { localStorage.setItem("orgfy_inbox_dismissed_ids", JSON.stringify(next)); } catch {}
        return next;
      });
      setLastBulkDismiss(null);
    }, []);
    const [costRange, setCostRange] = React.useState<"7d" | "30d" | "90d">("30d");
    const [autoTab, setAutoTab] = React.useState<"automations" | "runs" | "templates">("automations");
    const [agentTab, setAgentTab] = React.useState<"eval" | "memory" | "skills" | "mcp" | "hooks">("memory");
    const [evalFilter, setEvalFilter] = React.useState<"all" | "attention" | "approved">("all");
    const [mcpSearch, setMcpSearch] = React.useState<string>("");
    const [mcpCategory, setMcpCategory] = React.useState<string>("all");
    const [usageDimension, setUsageDimension] = React.useState<"provider" | "model" | "project" | "role" | "source">("model");
    const [usageMetric, setUsageMetric] = React.useState<"cost" | "tokens">("cost");
    const [usageHoverDay, setUsageHoverDay] = React.useState<number | null>(null);
    const [usageFilterModel, setUsageFilterModel] = React.useState<string | null>(null);
    const [pricesOpen, setPricesOpen] = React.useState<boolean>(false);

    const [settingsForm, setSettingsFormState] = React.useState<{
      mode: AutonomyMode;
      autoMerge: boolean;
      mergePolicy: "fast" | "strict";
      gastoDiaUsd: number;
      mergesDia: number;
      agentesMax: number;
      prsAbertos: number;
      falhasSeguidas: number;
    }>({
      mode: "software_factory",
      autoMerge: false,
      mergePolicy: "strict",
      gastoDiaUsd: 50,
      mergesDia: 20,
      agentesMax: 4,
      prsAbertos: 6,
      falhasSeguidas: 3,
    });

    const settingsDirtyRef = React.useRef<boolean>(false);

    const setSettingsForm = React.useCallback((patch: Partial<typeof settingsForm>) => {
      settingsDirtyRef.current = true;
      setSettingsFormState((prev) => ({ ...prev, ...patch }));
    }, []);

    const hostRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (hostRef.current) {
        attachFactoryShadowStyles(hostRef.current);
      }
    }, []);

    const notify = React.useCallback((msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(null), 3500);
    }, []);

    const refreshInFlightRef = React.useRef<boolean>(false);
    const lastHoldingFetchRef = React.useRef<number>(0);

    const refresh = React.useCallback(
      async (targetTenant = tenant, forceSettingsSync = false, silent = false) => {
        if (silent && refreshInFlightRef.current) return;
        refreshInFlightRef.current = true;
        if (!silent) setLoading(true);
        try {
          const now = Date.now();
          const shouldFetchHolding = !silent || now - lastHoldingFetchRef.current > 30000;
          const [res, holdSnap] = await Promise.all([
            fetchFactoryStatus(ctx, targetTenant),
            shouldFetchHolding
              ? fetchHoldingControlPlane(ctx).catch(() => null)
              : Promise.resolve(null),
          ]);
          setStatus(res.status);
          setError(res.error);
          if (holdSnap) {
            lastHoldingFetchRef.current = Date.now();
            setHolding(holdSnap);
          }
          if (!settingsDirtyRef.current || forceSettingsSync) {
            setSettingsFormState({
              mode: res.status.mode,
              autoMerge: res.status.limits.autoMerge,
              mergePolicy: res.status.limits.mergePolicy,
              gastoDiaUsd: res.status.limits.dailyBudget?.usd ?? 50,
              mergesDia: res.status.limits.maxMergesPerDay ?? 20,
              agentesMax: res.status.limits.maxConcurrentSessions ?? 4,
              prsAbertos: res.status.wip?.limit ?? 6,
              falhasSeguidas: res.status.limits.pauseAfterConsecutiveFailures ?? 3,
            });
          }
        } finally {
          refreshInFlightRef.current = false;
          if (!silent) setLoading(false);
        }
      },
      [tenant]
    );

    React.useEffect(() => {
      settingsDirtyRef.current = false;
      let disposed = false;
      let relayDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      const run = () => {
        if (disposed) return;
        if (typeof document !== "undefined" && document.hidden) return;
        void refresh(tenant, false, true);
      };
      void refresh(tenant, true, false);
      const timer = setInterval(run, 15000);
      const unsub = subscribeRelayUpdates(() => {
        if (disposed) return;
        if (relayDebounceTimer) clearTimeout(relayDebounceTimer);
        relayDebounceTimer = setTimeout(run, 2500);
      });
      return () => {
        disposed = true;
        clearInterval(timer);
        if (relayDebounceTimer) clearTimeout(relayDebounceTimer);
        unsub();
      };
    }, [tenant, refresh]);

    const handleControlUpdate = React.useCallback(
      async (patch: Parameters<typeof writeTenantControl>[2], message: string) => {
        const res = await writeTenantControl(ctx, tenant, patch);
        if (res.ok) {
          settingsDirtyRef.current = false;
          setStatus((prev) => ({
            ...prev,
            ...(res.control?.mode ? { mode: res.control.mode as AutonomyMode } : {}),
            ...(typeof res.control?.killSwitch === "boolean" ? { killSwitch: res.control.killSwitch } : {}),
          }));
          notify(message);
          await refresh(tenant, true);
        } else {
          notify(res.error ? `Falha ao gravar controle-${tenant}.json: ${res.error}` : `Falha ao gravar controle-${tenant}.json.`);
        }
      },
      [tenant, notify, refresh]
    );

    const handleOpenInBuzz = React.useCallback(
      async (item: FactoryWorkItem) => {
        if (item.id && /^[0-9a-f]{64}$/i.test(item.id)) {
          const isPr = String(item.workKey || "").startsWith("pr:");
          const owner = liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER;
          const dtag = liveRepo?.dtag || status.tenantManifest?.repoId || tenant;
          const ok = await openBuzzRepoEntity(ctx, { type: isPr ? "pr" : "issue", owner, dtag, id: item.id }).catch(() => false);
          notify(
            ok
              ? `${isPr ? "PR" : "Issue"} #${item.id.slice(0, 8)} aberto direto no Buzz Repos.`
              : `${isPr ? "PR" : "Issue"} #${item.id.slice(0, 8)} não está indexado no Buzz Repos — detalhes completos disponíveis aqui no Inspector.`
          );
        } else {
          notify(`Item local #${item.id.slice(0, 8)} (sem ID Nostr de 64 chars).`);
        }
      },
      [tenant, liveRepo, status.tenantManifest, notify]
    );

    const handleOpenCommitInBuzz = React.useCallback(
      async (commit: string) => {
        const ok = await openRepoTabInBuzz(ctx, {
          owner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER,
          dtag: liveRepo?.dtag || status.tenantManifest?.repoId || tenant,
          tab: "commits",
          commit,
        }).catch(() => false);
        notify(ok ? `Commit ${commit.slice(0, 8)} aberto no Buzz Repos.` : `Não foi possível abrir o commit ${commit.slice(0, 8)}.`);
      },
      [tenant, liveRepo, status.tenantManifest, notify]
    );

    const resolveActiveChannelId = React.useCallback(
      (targetSlug?: string) => {
        const slug = typeof targetSlug === "string" && targetSlug ? targetSlug : tenant;
        const emp = holding?.empresas.find((e) => e.slug === slug);
        return (
          (slug === tenant && linkedChannelId ? linkedChannelId : null) ||
          (slug === tenant ? status.tenantManifest?.canal : null) ||
          emp?.canal ||
          (slug === "board"
            ? holding?.boardCanal ||
              findBuzzChannelIdByName(ctx, ["Conselho-Canal", "Conselho", "Board", "Conselho da Holding"]) ||
              "80529b52-ee97-40d4-ab4c-aa9d13b9bcee"
            : null)
        );
      },
      [tenant, linkedChannelId, status.tenantManifest, holding]
    );

    const handleSaveCanvas = React.useCallback(async () => {
      const canal = resolveActiveChannelId();
      setCanvasSaving(true);
      const res = await saveBuzzChannelCanvas(ctx, canal, canvasDraft, canvasEventId);
      setCanvasSaving(false);
      if (res.ok) {
        setChannelCanvas(canvasDraft);
        if (res.eventId) setCanvasEventId(res.eventId);
        setCanvasMode("view");
        notify("Canvas salvo diretamente no canal do Buzz (session.canvas.save).");
        readBuzzChannelCanvasHistory(ctx, canal).then(setCanvasHistory).catch(() => {});
      } else {
        notify(`Falha ao salvar Canvas: ${res.error || "indisponível"}`);
      }
    }, [resolveActiveChannelId, canvasDraft, canvasEventId, notify]);

    const handleReloadCanvas = React.useCallback(async () => {
      const canal = resolveActiveChannelId();
      const [st, hist] = await Promise.all([
        readBuzzChannelCanvasDetailed(ctx, canal, { strong: true }),
        readBuzzChannelCanvasHistory(ctx, canal),
      ]);
      setChannelCanvas(st.content);
      setCanvasDraft(st.content || "");
      setCanvasEventId(st.eventId);
      setCanvasWritable(st.writable);
      setCanvasHistory(hist);
      notify("Canvas recarregado ao vivo do canal no Buzz.");
    }, [resolveActiveChannelId, notify]);

    const handleSaveChannelDetails = React.useCallback(async () => {
      const canal = resolveActiveChannelId();
      setSavingChannelDetails(true);
      const res = await saveBuzzChannelDetailsLive(ctx, channelInfo?.detailsBase, channelDetailsDraft);
      setSavingChannelDetails(false);
      if (res.ok) {
        setEditingChannelDetails(false);
        notify("Detalhes do canal salvos diretamente no Buzz (session.channelDetails.save).");
        loadBuzzChannelLiveInfo(ctx, canal).then(setChannelInfo).catch(() => {});
      } else {
        notify(`Falha ao salvar canal: ${res.error || "indisponível"}`);
      }
    }, [resolveActiveChannelId, channelInfo, channelDetailsDraft, notify]);

    const handleChannelDiagnostic = React.useCallback(async (action: "markRead" | "markUnread" | "refresh") => {
      const canal = resolveActiveChannelId();
      if (!canal) {
        notify("Canal da empresa não configurado.");
        return;
      }
      const res = await runBuzzChannelDiagnosticAction(ctx, canal, action);
      notify(res.message);
      loadBuzzChannelLiveInfo(ctx, canal).then(setChannelInfo).catch(() => {});
    }, [status.tenantManifest, holding, tenant, notify]);

    const handleCopyText = React.useCallback((text: string, label: string) => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
      } catch {}
      notify(`${label} copiado.`);
    }, [notify]);

    const handleOpenBuzzLink = React.useCallback(async (href: string) => {
      try {
        const u = new URL(href);
        const host = u.hostname.toLowerCase();
        const id = u.searchParams.get("id") || "";
        const owner = u.searchParams.get("owner") || liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER;
        const dtag = u.searchParams.get("d") || liveRepo?.dtag || status.tenantManifest?.repoId || tenant;
        if ((host === "issue" || host === "pr") && /^[0-9a-f]{64}$/i.test(id)) {
          const ok = await openBuzzRepoEntity(ctx, { type: host === "pr" ? "pr" : "issue", owner, dtag, id });
          if (ok) return;
        }
        if (host === "channel" && id) {
          await navigateToBuzzChannel(ctx, id, { preferFullPage: true, sideTabOpener: openSideTabRef.current });
          return;
        }
      } catch {}
      notify(`Link Buzz: ${href}`);
    }, [liveRepo, status.tenantManifest, tenant, notify]);

    const resolveBuzzScope = React.useCallback(() => resolveBuzzNavigationScope(ctx), []);

    const handleOpenChannelInBuzz = React.useCallback(async (targetSlug?: string) => {
      const slug = typeof targetSlug === "string" && targetSlug ? targetSlug : tenant;
      const canal = resolveActiveChannelId(slug);
      if (!canal) {
        notify(`Canal não configurado no manifesto de ${slug}.`);
        return;
      }
      const res = await navigateToBuzzChannel(ctx, canal, { preferFullPage: false, sideTabOpener: openSideTabRef.current });
      if (res.ok) {
        notify(res.mode === "sidetab" ? `Canal de ${slug} aberto no chat lateral.` : `Canal de ${slug} aberto no Buzz.`);
      } else {
        notify(`Não foi possível abrir o canal ${canal.slice(0, 8)}… no Buzz (verifique a conexão do relay).`);
      }
    }, [resolveActiveChannelId, tenant, notify]);

    const handleOpenChannelFullPage = React.useCallback(async (opts?: { panel?: "members" }) => {
      const canal = resolveActiveChannelId(tenant);
      if (!canal) {
        notify(`Canal não configurado no manifesto de ${tenant}.`);
        return;
      }
      const res = await navigateToBuzzChannel(ctx, canal, {
        panel: opts?.panel,
        preferFullPage: true,
        sideTabOpener: openSideTabRef.current,
      });
      if (res.ok) {
        notify(res.mode === "navigation" ? `Canal de ${tenant} aberto no Buzz.` : `Canal de ${tenant} aberto no painel lateral.`);
      } else {
        notify(`Não foi possível navegar para o canal ${canal.slice(0, 8)}… no Buzz.`);
      }
    }, [holding, status.tenantManifest, tenant, notify]);

    const liveCrew: LiveCrewAgent[] = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const runningSet = new Set((snap.running || []).map((a: any) => String(a?.key || a?.name)));
        return (snap.agents || []).map((a: any) => ({
          key: String(a?.key || a?.name || ""),
          pubkey: typeof a?.pubkey === "string" ? a.pubkey : "",
          name: String(a?.name || a?.key || "Agente"),
          picture: typeof a?.picture === "string" && a.picture.trim() ? a.picture : undefined,
          model: a?.config?.model || PT_BR.labels.unavailable,
          provider: a?.config?.provider || "",
          instructions: typeof a?.config?.instructions === "string" ? a.config.instructions : undefined,
          config: a?.config && typeof a.config === "object" ? a.config : undefined,
          configBase: a?.configBase,
          running: runningSet.has(String(a?.key || a?.name)),
        }));
      } catch {
        return [];
      }
    }, [status.lastTickAt, relayTick]);

    // Carrega o roster vivo de agentes membros do Canal Principal vinculado (fonte de verdade do time)
    React.useEffect(() => {
      let cancelled = false;
      const activeCh = linkedChannelId || status.tenantManifest?.canal || null;
      if (!activeCh || liveCrew.length === 0) {
        setLiveChannelAgents([]);
        return;
      }
      loadLiveChannelAgentRoster(ctx, activeCh, liveCrew)
        .then((list) => {
          if (!cancelled) setLiveChannelAgents(list);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [linkedChannelId, status.tenantManifest?.canal, liveCrew, relayTick]);

    const { agents: tenantAgents, source: tenantAgentsSource } = React.useMemo(
      () => buildEffectiveTenantAgents(status.tenantManifest?.agentes || [], liveChannelAgents),
      [status.tenantManifest?.agentes, liveChannelAgents]
    );

    const effectiveStatus = React.useMemo(
      () =>
        status.tenantManifest
          ? {
              ...status,
              tenantManifest: {
                ...status.tenantManifest,
                canal: linkedChannelId || status.tenantManifest.canal,
                agentes: tenantAgents,
              },
            }
          : status,
      [status, linkedChannelId, tenantAgents]
    );

    const handleLinkEnterpriseWorkspaceChannel = React.useCallback(
      async (nextWsId: string, nextChId: string) => {
        setSavingEnterpriseLink(true);
        try {
          setLinkedWorkspaceId(nextWsId);
          setLinkedChannelId(nextChId);
          try {
            if (nextWsId) localStorage.setItem(`orgfy_tenant_ws_${tenant}`, nextWsId);
            else localStorage.removeItem(`orgfy_tenant_ws_${tenant}`);
            if (nextChId) localStorage.setItem(`orgfy_tenant_ch_${tenant}`, nextChId);
            else localStorage.removeItem(`orgfy_tenant_ch_${tenant}`);
          } catch {}

          const wsObj = buzzCatalog.workspaces.find((w) => w.id === nextWsId);
          const chObj = buzzCatalog.allChannels.find((c) => c.id === nextChId);
          const [det, roster] = await Promise.all([
            nextWsId ? loadBuzzWorkspaceDetails(ctx, nextWsId, wsObj?.name || tenant) : Promise.resolve(null),
            nextChId ? loadLiveChannelAgentRoster(ctx, nextChId, liveCrew) : Promise.resolve([]),
          ]);
          if (det) {
            setWorkspaceDetails(det);
            setWorkspaceDraftState({
              foldersText: det.folders.join("\n"),
              worktreeLocation: det.worktree?.location || "~/.buzz/worktrees",
              worktreeBranch: det.worktree?.baseBranch || "main",
              instructions: det.instructions || "",
            });
          }
          setLiveChannelAgents(roster);
          if (nextChId) {
            loadBuzzChannelLiveInfo(ctx, nextChId).then(setChannelInfo).catch(() => {});
          }

          const { agents: merged } = buildEffectiveTenantAgents(status.tenantManifest?.agentes || [], roster);
          const host = (ctx as any)?.host;
          if (typeof host?.runCommand === "function") {
            await host
              .runCommand(
                "orgfy-controle-write",
                JSON.stringify({
                  kind: "empresa_link",
                  tenant,
                  canal: nextChId || undefined,
                  canalNome: chObj?.name || undefined,
                  workspaceId: nextWsId || undefined,
                  workspaceName: wsObj?.name || undefined,
                  folders: det?.folders,
                  worktree: det?.worktree,
                  agentes: roster.length > 0 ? merged.map((a) => ({ name: a.name, pubkey: a.pubkey, papel: a.papel, model: a.model })) : undefined,
                })
              )
              .catch(() => {});
          }
          notify(
            roster.length > 0
              ? `Vínculo salvo: ${wsObj?.name || "Workspace"} · #${chObj?.name || nextChId.slice(0, 8)} (${roster.length} agentes vivos sincronizados) ✓`
              : `Vínculo salvo: ${wsObj?.name || "Workspace"}${chObj ? ` · #${chObj.name}` : ""} ✓`
          );
          await refresh(tenant, false, true);
        } finally {
          setSavingEnterpriseLink(false);
        }
      },
      [tenant, buzzCatalog, liveCrew, status.tenantManifest?.agentes, notify, refresh]
    );

    const handleSaveWorkspaceSettings = React.useCallback(async () => {
      if (!workspaceDetails) {
        notify("Nenhum Workspace do Buzz vinculado para salvar.");
        return;
      }
      setSavingWorkspaceDetails(true);
      try {
        const folders = workspaceDraft.foldersText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const worktree = workspaceDraft.worktreeLocation.trim()
          ? { location: workspaceDraft.worktreeLocation.trim(), baseBranch: workspaceDraft.worktreeBranch.trim() || "main" }
          : undefined;
        const res = await saveBuzzWorkspaceDetails(ctx, workspaceDetails, {
          folders,
          worktree,
          instructions: workspaceDraft.instructions,
        });
        if (res.ok) {
          notify(`Workspace ${workspaceDetails.workspaceName} atualizado no Buzz (Folders · Worktree · Instructions) ✓`);
          const fresh = await loadBuzzWorkspaceDetails(ctx, workspaceDetails.workspaceId, workspaceDetails.workspaceName);
          if (fresh) setWorkspaceDetails(fresh);
        } else {
          notify(`Falha ao salvar Workspace: ${res.error || "indisponível"}`);
        }
      } finally {
        setSavingWorkspaceDetails(false);
      }
    }, [workspaceDetails, workspaceDraft, notify]);

    // Mapa pubkey -> nome amigável para enriquecer a telemetria ao vivo do Buzz e membros do canal
    const nameByPubkey = React.useMemo(() => {
      const map = new Map<string, string>();
      if (holding?.fundador?.pubkey) {
        map.set(holding.fundador.pubkey.toLowerCase(), `${holding.fundador.nome || "Helton Fraga"} (Fundador)`);
      }
      if (holding?.ceoHolding?.pubkey) {
        map.set(holding.ceoHolding.pubkey.toLowerCase(), holding.ceoHolding.nome || "OrgFy Iris");
      }
      try {
        const rSnap = typeof (ctx as any)?.relay?.snapshot === "function" ? (ctx as any).relay.snapshot() : null;
        const viewerPk = String(rSnap?.session?.viewer || rSnap?.viewer || "").trim().toLowerCase();
        if (viewerPk && !map.has(viewerPk)) map.set(viewerPk, "Você (Fundador)");
      } catch {}
      for (const a of liveCrew) {
        if (a.pubkey) map.set(a.pubkey.toLowerCase(), a.name);
      }
      for (const a of tenantAgents) {
        if (a.pubkey) map.set(a.pubkey.toLowerCase(), a.name);
      }
      return map;
    }, [liveCrew, tenantAgents, holding, relayTick]);

    // Catálogo real das 22 agentTools registradas no Unified Tool Registry
    const mcpTools = React.useMemo(() => {
      try {
        const raw = buildUnifiedOrgfyTools(ctx);
        const categorize = (name: string): string => {
          if (/gate|lint|governanca|checkout_lock|decision_triage/.test(name)) return "Governança L-01";
          if (/roster|handoff|smart_dispatch|despachar|reconciliar/.test(name)) return "Orquestração";
          if (/card|kanban|historico|bind_context|question_card/.test(name)) return "Cards & Relay";
          if (/loop_radar|session_stop|model_failover|kpis|status|porteiro/.test(name)) return "Radar & Telemetria";
          return "Geral";
        };
        return raw.map((t) => ({
          name: t.name,
          description: t.description,
          category: categorize(t.name),
          params: Object.keys((t.inputSchema as any)?.properties || {}),
          required: Array.isArray((t.inputSchema as any)?.required) ? ((t.inputSchema as any).required as string[]) : [],
        }));
      } catch {
        return [];
      }
    }, []);

    // Snapshot ao vivo de session.agentActivity + session.presence + session.unread
    const telemetry = React.useMemo(
      () => readBuzzLiveTelemetry(ctx, nameByPubkey),
      [nameByPubkey, activityTick, relayTick, status.lastTickAt]
    );

    const handleOpenTurnInSideChat = React.useCallback(
      (turn: LiveAgentTurn) => {
        if (turn.state === "error") {
          dismissErrorTurn(turn);
          setActivityTick((n) => n + 1);
        }
        if (turn.channelId && openSideTabRef.current) {
          const relaySession = (ctx as any)?.relay?.snapshot?.()?.session;
          const rawThread = typeof turn.threadRootId === "string" ? turn.threadRootId.trim() : "";
          const isHexEventId = /^[0-9a-f]{64}$/i.test(rawThread);
          let verifiedThreadId: string | undefined = undefined;
          if (isHexEventId && relaySession) {
            try {
              // Só abre como Thread se a mensagem raiz realmente existir no canal; evita "This message isn't available." em wakes/workflows
              const chMsgs =
                (typeof relaySession.messages?.snapshot === "function"
                  ? relaySession.messages.snapshot(turn.channelId)?.messages
                  : null) ||
                (typeof relaySession.messages?.list === "function"
                  ? relaySession.messages.list(turn.channelId)?.messages
                  : null);
              if (Array.isArray(chMsgs) && chMsgs.some((m: any) => String(m?.id || "").toLowerCase() === rawThread.toLowerCase())) {
                verifiedThreadId = rawThread;
              }
            } catch {}
          }
          const ok = openSideTabRef.current(
            verifiedThreadId
              ? { channelId: turn.channelId, threadId: verifiedThreadId, messageId: turn.messageId }
              : { channelId: turn.channelId },
            { keep: true }
          );
          if (ok) {
            notify(turn.state === "error" ? `Erro de ${turn.agentName} visualizado e limpo da fila.` : `Conversa de ${turn.agentName} aberta na barra lateral.`);
            return;
          }
        }
        notify(turn.state === "error" ? `Erro de ${turn.agentName} marcado como visualizado.` : `Não foi possível abrir o chat lateral de ${turn.agentName}.`);
      },
      [notify]
    );

    const handleInterruptTurn = React.useCallback(
      async (turn: LiveAgentTurn) => {
        const ok = await interruptLiveTurn(ctx, turn);
        notify(ok ? `Turno de ${turn.agentName} interrompido.` : `Não foi possível interromper o turno de ${turn.agentName}.`);
      },
      [notify]
    );

    const handleReconcileAgentsR51 = React.useCallback(async () => {
      const agentsApi = (ctx as any)?.agents;
      if (typeof agentsApi?.save !== "function") {
        notify("API ctx.agents.save indisponível nesta versão do Buzz.");
        return;
      }
      const catalog = await loadLiveGatewayModelCatalog(ctx).catch(() => null);
      const liveWinners = new Set<string>();
      if (catalog?.hasLiveData && catalog.approvedModels.size > 0) {
        for (const m of catalog.approvedModels) liveWinners.add(m);
      } else if (Array.isArray(status.evalWinners) && status.evalWinners.length > 0) {
        for (const w of status.evalWinners) {
          liveWinners.add(w.model.toLowerCase());
          const shortW = String(w.model.split("/").pop() || w.model).toLowerCase();
          if (shortW) liveWinners.add(shortW);
        }
      } else {
        liveWinners.add("gemini-2.5-flash");
        liveWinners.add("gpt-6.1-terra");
      }

      const targets = tenantAgents.filter((a) => {
        if (!a.inBuzz || !a.agentKey) return false;
        const full = String(a.model || "").trim().toLowerCase();
        const short = String(full.split("/").pop() || full).trim();
        if (catalog?.offlineModels.has(full) || catalog?.offlineModels.has(short)) return true;
        return !liveWinners.has(full) && !liveWinners.has(short);
      });
      if (targets.length === 0) {
        notify("Todos os agentes provisionados já estão em modelos online aprovados no Eval.");
        return;
      }
      const freshAgents = ((agentsApi.snapshot?.()?.agents || []) as any[]);
      let updated = 0;
      let firstError = "";
      const assignedModels = new Set<string>();
      for (const ag of targets) {
        const rec = pickLiveRecommendedModel(`${ag.papel || ""} ${ag.name || ""}`, catalog);
        const provider = rec.provider;
        const model = rec.model;
        const fresh = freshAgents.find((c: any) => c?.key === ag.agentKey) || liveCrew.find((c) => c.key === ag.agentKey);
        const baseCfg = fresh?.config && typeof fresh.config === "object" ? fresh.config : {};
        try {
          // Omite `base` para que o Buzz resolva automaticamente `editorConfig().base`
          // (passar `configBase` vazio `{}` causa erro "config isn't synced here yet").
          await agentsApi.save(ag.agentKey, {
            config: { ...baseCfg, provider, model },
          });
          updated += 1;
          assignedModels.add(model);
        } catch (err: any) {
          if (!firstError) firstError = err?.message || String(err);
        }
      }
      notify(
        updated > 0
          ? `${updated}/${targets.length} agente(s) reconciliado(s) para ${Array.from(assignedModels).join(", ")} (Eval ao vivo) ✓`
          : `Nenhum agente pôde ser atualizado${firstError ? `: ${firstError}` : " via ctx.agents.save()."}`
      );
      await refresh(tenant);
    }, [tenantAgents, liveCrew, status.evalWinners, tenant, notify, refresh]);

    const handleSaveAgentProfile = React.useCallback(
      async (agentKey: string, patch: { provider: string; model: string; instructions?: string }) => {
        const agentsApi = (ctx as any)?.agents;
        if (typeof agentsApi?.save !== "function") {
          notify("API ctx.agents.save indisponível nesta versão do Buzz.");
          return;
        }
        const freshAgents = ((agentsApi.snapshot?.()?.agents || []) as any[]);
        const fresh = freshAgents.find((c: any) => c?.key === agentKey) || liveCrew.find((c) => c.key === agentKey);
        const baseCfg = fresh?.config && typeof fresh.config === "object" ? fresh.config : {};
        try {
          await agentsApi.save(agentKey, {
            config: {
              ...baseCfg,
              ...(patch.provider ? { provider: patch.provider.trim() } : {}),
              ...(patch.model ? { model: patch.model.trim() } : {}),
              ...(patch.instructions !== undefined && patch.instructions.trim() ? { instructions: patch.instructions } : {}),
            },
          });
          setEditingAgentKey(null);
          notify(`Perfil de ${fresh?.name || agentKey} salvo via ctx.agents.save().`);
          await refresh(tenant);
        } catch (err: any) {
          notify(`Falha ao salvar perfil: ${err?.message || err}`);
        }
      },
      [liveCrew, tenant, notify, refresh]
    );

    const normalizePrompt = React.useCallback((txt: string) => txt.replace(/\r\n/g, "\n").trim(), []);
    const shortPromptHash = React.useCallback((txt: string) => {
      let hVal = 2166136261;
      for (let i = 0; i < txt.length; i += 1) {
        hVal ^= txt.charCodeAt(i);
        hVal = Math.imul(hVal, 16777619);
      }
      return `v·${(hVal >>> 0).toString(16).padStart(8, "0").slice(0, 4)}`;
    }, []);

    const resolvePromptCandidates = React.useCallback((targetTenant: string, agentName: string): Array<{ abs: string; label: string }> => {
      const low = agentName.trim().toLowerCase();
      const boardFiles: Record<string, string> = {
        "conselho cto": "01-conselho-cto.md",
        "conselho cro": "02-conselho-cro.md",
        "conselho cpo": "03-conselho-cpo.md",
        "conselho coo": "04-conselho-coo.md",
        "conselho cgo": "05-conselho-cgo.md",
      };
      const out: Array<{ abs: string; label: string }> = [];
      if (boardFiles[low]) {
        const fn = boardFiles[low];
        out.push({ abs: `/Users/heltonfraga/.buzz/REPOS/holding/agentes/${fn}`, label: `holding/agentes/${fn}` });
        out.push({ abs: `/Users/heltonfraga/.buzz/REPOS/orgfy/empresas/conselho/agentes/${fn}`, label: `orgfy/empresas/conselho/agentes/${fn}` });
      }
      const slug = low
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (slug) {
        out.push({ abs: `/Users/heltonfraga/.buzz/REPOS/holding/subsidiarias/${targetTenant}/agentes/${slug}.md`, label: `holding/subsidiarias/${targetTenant}/agentes/${slug}.md` });
        out.push({ abs: `/Users/heltonfraga/.buzz/REPOS/holding/agentes/${slug}.md`, label: `holding/agentes/${slug}.md` });
        out.push({ abs: `/Users/heltonfraga/.buzz/REPOS/orgfy/empresas/${targetTenant}/agentes/${slug}.md`, label: `orgfy/empresas/${targetTenant}/agentes/${slug}.md` });
      }
      return out;
    }, []);

    // Verifica versão dos prompts versionados no repo vs. instructions ao vivo no Buzz Desktop
    React.useEffect(() => {
      if (tab !== "agents") return;
      const readFile = (ctx as any)?.host?.readFile;
      if (typeof readFile !== "function" || tenantAgents.length === 0) return;
      let cancelled = false;
      const decodeText = (raw: any): string => {
        if (typeof raw === "string") return raw;
        if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
        if (typeof raw?.text === "string") return raw.text;
        if (typeof raw?.content === "string") return raw.content;
        return "";
      };
      (async () => {
        const nextMap: Record<string, { status: "synced" | "outdated" | "unversioned"; version: string; liveVersion?: string; sourcePath?: string; content?: string }> = {};
        await Promise.all(
          tenantAgents.map(async (ag) => {
            const pkLower = (ag.pubkey || "").toLowerCase();
            const liveMatch = liveCrew.find((c) => c.key === ag.agentKey || (pkLower && c.pubkey?.toLowerCase() === pkLower));
            const liveNorm = normalizePrompt(liveMatch?.instructions || "");
            const liveVer = liveNorm ? shortPromptHash(liveNorm) : undefined;
            const candidates = resolvePromptCandidates(tenant, ag.name);
            let foundText = "";
            let foundLabel = "";
            for (const c of candidates) {
              try {
                const txt = normalizePrompt(decodeText(await readFile(c.abs)));
                if (txt) {
                  foundText = txt;
                  foundLabel = c.label;
                  break;
                }
              } catch {}
            }
            if (!foundText) {
              nextMap[ag.name] = { status: "unversioned", version: liveVer || "Buzz", liveVersion: liveVer };
              return;
            }
            const repoVer = shortPromptHash(foundText);
            const isSynced = liveNorm === foundText;
            nextMap[ag.name] = {
              status: isSynced ? "synced" : "outdated",
              version: repoVer,
              liveVersion: liveVer,
              sourcePath: foundLabel,
              content: foundText,
            };
          })
        );
        if (!cancelled) setAgentPromptSyncMap(nextMap);
      })();
      return () => {
        cancelled = true;
      };
    }, [tab, tenant, tenantAgents, liveCrew, normalizePrompt, shortPromptHash, resolvePromptCandidates]);

    const handleSyncAgentPrompt = React.useCallback(
      async (target: { name: string; agentKey: string; pubkey?: string }) => {
        const agentsApi = (ctx as any)?.agents;
        if (typeof agentsApi?.save !== "function") {
          notify("API ctx.agents.save indisponível nesta versão do Buzz.");
          return;
        }
        const info = agentPromptSyncMap[target.name];
        if (!info?.content) {
          notify(`Nenhum prompt versionado encontrado para ${target.name}.`);
          return;
        }
        setSyncingPromptKey(target.name);
        try {
          const freshAgents = ((agentsApi.snapshot?.()?.agents || []) as any[]);
          const pkLower = (target.pubkey || "").toLowerCase();
          const match =
            freshAgents.find((a: any) => a?.key === target.agentKey) ||
            (pkLower ? freshAgents.find((a: any) => String(a?.pubkey || "").toLowerCase() === pkLower) : null) ||
            freshAgents.find((a: any) => String(a?.name || "").toLowerCase() === target.name.toLowerCase());
          if (!match?.key) {
            notify(`${target.name} não encontrado no Buzz Desktop.`);
            return;
          }
          const baseCfg = match?.config && typeof match.config === "object" ? match.config : {};
          await agentsApi.save(match.key, {
            config: {
              ...baseCfg,
              instructions: info.content,
            },
          });
          setAgentPromptSyncMap((prev) => ({
            ...prev,
            [target.name]: { ...info, status: "synced", liveVersion: info.version },
          }));
          notify(`Prompt de ${target.name} atualizado (${info.version} · modelo preservado) ✓`);
          await refresh(tenant, false, true);
        } catch (err: any) {
          notify(`Falha ao sincronizar ${target.name}: ${err?.message || err}`);
        } finally {
          setSyncingPromptKey(null);
        }
      },
      [agentPromptSyncMap, tenant, notify, refresh]
    );

    const handleSyncAllOutdatedPrompts = React.useCallback(async () => {
      const agentsApi = (ctx as any)?.agents;
      if (typeof agentsApi?.save !== "function") {
        notify("API ctx.agents.save indisponível nesta versão do Buzz.");
        return;
      }
      const outdated = tenantAgents.filter((a) => agentPromptSyncMap[a.name]?.status === "outdated" && agentPromptSyncMap[a.name]?.content);
      if (outdated.length === 0) {
        notify("Todos os prompts versionados já estão sincronizados ✓");
        return;
      }
      setSyncingPromptKey("__ALL__");
      try {
        const freshAgents = ((agentsApi.snapshot?.()?.agents || []) as any[]);
        let updated = 0;
        let firstError = "";
        const syncedNames: string[] = [];
        for (const ag of outdated) {
          const info = agentPromptSyncMap[ag.name];
          const pkLower = (ag.pubkey || "").toLowerCase();
          const match =
            freshAgents.find((a: any) => a?.key === ag.agentKey) ||
            (pkLower ? freshAgents.find((a: any) => String(a?.pubkey || "").toLowerCase() === pkLower) : null) ||
            freshAgents.find((a: any) => String(a?.name || "").toLowerCase() === ag.name.toLowerCase());
          if (!match?.key || !info?.content) continue;
          const baseCfg = match?.config && typeof match.config === "object" ? match.config : {};
          try {
            await agentsApi.save(match.key, {
              config: { ...baseCfg, instructions: info.content },
            });
            updated += 1;
            syncedNames.push(ag.name);
          } catch (err: any) {
            if (!firstError) firstError = `${ag.name}: ${err?.message || err}`;
          }
        }
        if (syncedNames.length > 0) {
          setAgentPromptSyncMap((prev) => {
            const copy = { ...prev };
            for (const n of syncedNames) {
              if (copy[n]) copy[n] = { ...copy[n], status: "synced", liveVersion: copy[n].version };
            }
            return copy;
          });
        }
        notify(
          updated > 0
            ? `${updated}/${outdated.length} prompt(s) sincronizado(s) no Buzz (modelos preservados) ✓`
            : `Falha ao sincronizar prompts${firstError ? `: ${firstError}` : ""}.`
        );
        await refresh(tenant, false, true);
      } finally {
        setSyncingPromptKey(null);
      }
    }, [tenantAgents, agentPromptSyncMap, tenant, notify, refresh]);

    const handleAgentSessionAction = React.useCallback(
      async (agentKey: string, action: "interrupt" | "compact" | "new") => {
        const agentsApi = (ctx as any)?.agents;
        if (typeof agentsApi?.session !== "function") {
          notify("API ctx.agents.session indisponível nesta versão do Buzz.");
          return;
        }
        const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || undefined;
        try {
          await agentsApi.session(agentKey, canal ? { channelId: canal } : {}, action);
          const label = action === "interrupt" ? "interrompida" : action === "compact" ? "compactada" : "reiniciada";
          notify(`Sessão de ${agentKey} ${label} via Buzz API.`);
        } catch (err: any) {
          notify(`Falha na ação ${action} para ${agentKey}: ${err?.message || err}`);
        }
      },
      [status.tenantManifest, holding, tenant, notify]
    );

    const dmPool = React.useMemo(() => {
      if (!GLOBAL_TABS.has(tab) && tenantAgents.length > 0) {
        return tenantAgents.map((a) => {
          const working = Boolean(a.pubkey && telemetry.byPubkey[a.pubkey.toLowerCase()]);
          return {
            key: a.agentKey,
            pubkey: a.pubkey,
            name: a.name,
            label: `${a.name} · ${a.papel}${working ? " ⚡" : ""}`,
          };
        });
      }
      return liveCrew.map((a) => {
        const working = Boolean(a.pubkey && telemetry.byPubkey[a.pubkey.toLowerCase()]);
        return {
          key: a.key,
          pubkey: a.pubkey || "",
          name: a.name,
          label: `${a.name}${working ? " ⚡" : ""}`,
        };
      });
    }, [tab, tenantAgents, liveCrew, telemetry]);

    const defaultDmAgentKey = React.useMemo(() => {
      const cooName = (status.tenantManifest?.coo || "OrgFy Bento").toLowerCase();
      const coo = dmPool.find((a) => a.name.toLowerCase() === cooName);
      if (coo) return coo.key;
      const iris = dmPool.find((a) => /iris/i.test(a.name));
      if (iris) return iris.key;
      return dmPool[0]?.key || "";
    }, [dmPool, status.tenantManifest]);

    React.useEffect(() => {
      if (dmPool.length > 0 && (!dmAgentKey || !dmPool.some((a) => a.key === dmAgentKey))) {
        setDmAgentKey(defaultDmAgentKey);
      }
    }, [dmPool, dmAgentKey, defaultDmAgentKey]);

    const selectedDmAgent = React.useMemo(
      () => dmPool.find((a) => a.key === dmAgentKey) || dmPool[0] || null,
      [dmPool, dmAgentKey]
    );

    const handleOpenAgentDmInBuzz = React.useCallback(
      async (targetAgent?: { key?: string; pubkey?: string; name?: string } | null) => {
        const agent = targetAgent || selectedDmAgent;
        const agentName = agent?.name || "Agente";
        const pubkey = (agent?.pubkey || "").trim();
        setOpeningDm(true);
        try {
          const scope = resolveBuzzScope();
          const relaySnap = typeof (ctx as any)?.relay?.snapshot === "function" ? (ctx as any).relay.snapshot() : null;
          const session = relaySnap?.session;

          let channelId: string | null = null;

          if (session?.channels?.list) {
            try {
              const list = session.channels.list()?.channels || [];
              const lowerName = agentName.toLowerCase();
              const existing = list.find((ch: any) => {
                if (ch?.channelType !== "dm" && ch?.channelType !== "solo") return false;
                if (pubkey) {
                  const members = [...(ch.participants || []), ...(ch.members || [])];
                  if (members.some((m: string) => String(m).toLowerCase() === pubkey.toLowerCase())) return true;
                }
                return typeof ch?.name === "string" && ch.name.toLowerCase().includes(lowerName);
              });
              if (existing?.id) channelId = String(existing.id);
            } catch {}
          }

          if (!channelId && pubkey && session?.directMessages?.available && typeof session.directMessages.open === "function") {
            const ac = new AbortController();
            const timeout = setTimeout(() => ac.abort(), 8000);
            try {
              channelId = await session.directMessages.open([pubkey], ac.signal);
            } finally {
              clearTimeout(timeout);
            }
          }

          if (channelId && openSideTabRef.current) {
            const openedSide = openSideTabRef.current({ channelId }, { keep: true });
            if (openedSide) {
              notify(`Chat lateral com ${agentName} aberto.`);
              return;
            }
          }

          if (channelId && scope && (ctx as any)?.navigation?.open) {
            const res = await (ctx as any).navigation.open({
              version: 1,
              kind: "conversation",
              scope,
              channelId,
            });
            if (!res || res.status === "opened") {
              notify(`DM nativa com ${agentName} aberta no Buzz.`);
              return;
            }
          }

          if (channelId) {
            await openSystemUri(ctx, `buzz://channel?id=${channelId}`);
            notify(`DM com ${agentName} aberta no Buzz.`);
            return;
          }

          notify(`Não foi possível localizar a DM de ${agentName} (verifique a conexão do relay no Buzz).`);
        } catch (err: any) {
          notify(`Erro ao abrir DM de ${agentName}: ${err?.message || err}`);
        } finally {
          setOpeningDm(false);
        }
      },
      [selectedDmAgent, resolveBuzzScope, notify]
    );

    // Abre o Canal da empresa no Buzz com o Perfil NATIVO do agente já aberto na coluna lateral direita (kind: conversation + detail)
    const handleOpenNativeAgentProfile = React.useCallback(
      async (target?: { key?: string; pubkey?: string; name?: string } | string | null) => {
        const resolved =
          typeof target === "string"
            ? liveCrew.find((a) => a.key === target) ||
              tenantAgents.find((a) => a.agentKey === target)
            : target;
        const resolvedKey = resolved && "key" in resolved ? resolved.key : resolved && "agentKey" in resolved ? (resolved as any).agentKey : undefined;
        const crewByKey = resolvedKey ? liveCrew.find((a) => a.key === resolvedKey) : undefined;
        const rawPubkey =
          (resolved && "pubkey" in resolved ? resolved.pubkey : "") ||
          crewByKey?.pubkey ||
          (resolved && "name" in resolved && resolved.name
            ? liveCrew.find((a) => a.name.toLowerCase() === String(resolved.name).toLowerCase())?.pubkey ||
              tenantAgents.find((a) => a.name.toLowerCase() === String(resolved.name).toLowerCase())?.pubkey ||
              ""
            : "") ||
          "";
        const pubkey = String(rawPubkey).trim().toLowerCase();
        const crewByPk = pubkey ? liveCrew.find((a) => a.pubkey?.toLowerCase() === pubkey) : undefined;
        const agentName = (resolved && "name" in resolved ? resolved.name : "") || crewByPk?.name || crewByKey?.name || "Agente";
        if (/^[0-9a-f]{64}$/.test(pubkey) && (ctx as any)?.navigation?.open) {
          const profileTarget = `buzz:agent-profile:${pubkey}`;
          const scope = resolveBuzzScope();
          const activeCanal =
            resolveActiveChannelId(tenant) ||
            buzzCatalog.allChannels[0]?.id ||
            "";
          // Prioridade: Canal da empresa + perfil do agente aberto na coluna lateral direita nativa do Buzz.
          if (activeCanal && scope) {
            try {
              const res = await (ctx as any).navigation.open({
                version: 1,
                kind: "conversation",
                scope,
                channelId: activeCanal,
                detail: { target: profileTarget },
              });
              if (!res || res.status === "opened") {
                notify(`Perfil de ${agentName} aberto na lateral direita do Buzz.`);
                return;
              }
            } catch {}
          }
          // Fallback nativo: página de Agentes do Buzz quando não houver canal/scope ativo.
          try {
            const res = await (ctx as any).navigation.open({
              version: 1,
              kind: "page",
              pluginId: "buzz.agents",
              pageId: "agents",
              ...(scope ? { scope } : {}),
              route: { version: 1, params: { agent: pubkey } },
            });
            if (!res || res.status === "opened") {
              notify(`Perfil nativo de ${agentName} aberto no Buzz.`);
              return;
            }
          } catch {}
        }
        if (resolvedKey) {
          setSelectedAgentKey(resolvedKey);
        } else {
          notify(`Pubkey de ${agentName} indisponível para abrir o perfil.`);
        }
      },
      [liveCrew, tenantAgents, tenant, buzzCatalog.allChannels, resolveActiveChannelId, resolveBuzzScope, notify]
    );

    // Helper oficial de entrega no Buzz: posta mensagem real Kind 9 com NIP-27 (nostr:npub1... + tag p)
    // e garantia de disparo via ctx.agents.wake quando ensureWake=true ou quando o agente não é membro ainda.
    const wakeAgentInBuzz = React.useCallback(
      async (opts: {
        agentKey: string;
        agentName?: string;
        pubkey?: string;
        extraMentions?: Array<{ agentKey?: string; agentName?: string; pubkey: string }>;
        channelId?: string | null;
        threadRoot?: string | null;
        preferDm?: boolean;
        postInChat?: boolean;
        ensureWake?: boolean;
        text: string;
      }): Promise<BuzzDispatchResult> => {
        const fallbackCanal = resolveActiveChannelId(tenant);
        return sendBuzzChatMessageOrWake(ctx, {
          ...opts,
          fallbackChannelId: fallbackCanal,
        });
      },
      [resolveActiveChannelId, tenant]
    );

    // Dispara auditoria one-shot do Oráculo (Scout) diretamente no CANAL da empresa ou do Conselho
    // com menção NIP-27 real (`nostr:npub1...` + tag `p`) e `ensureWake: true` (zero risco de não disparar).
    const handleRunScoutNow = React.useCallback(async () => {
      const isBoard = tenant === "board";
      const scoutTenant = isBoard
        ? tenantAgents.find((a) => a.papel === "cpo" || /conselho\s+cpo/i.test(a.name)) ||
          tenantAgents.find((a) => a.papel === "po" || a.papel === "oraculo" || /sol\s*po|or[aá]culo|scout/i.test(a.name))
        : tenantAgents.find((a) => a.papel === "po" || /\bpo\b/i.test(a.name)) ||
          tenantAgents.find((a) => a.papel === "oraculo" || /or[aá]culo|scout/i.test(a.name));
      const scoutLive = isBoard
        ? liveCrew.find((a) => a.key === scoutTenant?.agentKey || (scoutTenant?.pubkey && a.pubkey?.toLowerCase() === scoutTenant.pubkey.toLowerCase()) || /conselho\s+cpo/i.test(a.name))
        : liveCrew.find((a) => a.key === scoutTenant?.agentKey || (scoutTenant?.pubkey && a.pubkey?.toLowerCase() === scoutTenant.pubkey.toLowerCase()) || /sol\s*po|\bpo\b/i.test(a.name));
      const agentKey = scoutTenant?.agentKey || scoutLive?.key;
      const scoutName = scoutTenant?.name || scoutLive?.name || (isBoard ? "Conselho CPO" : "OrgFy Sol PO");
      if (!agentKey) {
        notify(`Nenhum agente ${isBoard ? "Conselho CPO" : "PO / Discovery"} encontrado em ${tenant}.`);
        return;
      }
      const targetChannelId = resolveActiveChannelId(tenant);
      const councilNames = Array.from(
        new Set(
          (holding?.conselho || [])
            .map((c) => c.responsavel)
            .filter((n) => n && n.toLowerCase() !== scoutName.toLowerCase())
        )
      );
      const cooName = status.tenantManifest?.coo || "OrgFy Bento";
      const promptText = isBoard
        ? `@${scoutName} [CONSELHO CPO · PAUTA DE PORTFÓLIO · board]\nAudite o portfólio da Holding (OrgFy Core, Lumen IPTV, SaaS Tributário) contra o Canvas/Visão atual, identifique os gaps de maior impacto em produto, receita, segurança, testes e governança, e proponha os próximos cards/pautas canônicos.\n\n**Regra de Reunião:** responda **aqui neste canal do Conselho** (não em DM) usando \`buzz__send\` com sua própria assinatura e as pubkeys em \`mentions\` (${councilNames.join(", ") || "OrgFy Iris, Conselho CTO, Conselho CRO, Conselho COO, Conselho CGO"}). Se precisar garantir o disparo de algum conselheiro, chame \`orgfy_mention_wake\` (que apenas acorda sem postar como o Fundador).`
        : `@${scoutName} [ORGFY PO DISCOVERY · ${tenant}]\nAudite o workspace atual contra o Canvas/Visão de ${status.tenantManifest?.nome || tenant}, identifique os gaps de maior impacto (segurança, testes, UX ou dívida técnica) e crie o próximo card canônico (\`<!-- orgfy:card v4 -->\`).\n\n**Regra de Canal:** responda **aqui neste canal da empresa** (não em DM) usando \`buzz__send\` com \`mentions\` para \`${cooName}\` (COO) e especialistas responsáveis (e \`orgfy_mention_wake\` se precisar garantir o wake).`;

      setRunningScout(true);
      try {
        const res = await wakeAgentInBuzz({
          agentKey,
          agentName: scoutName,
          pubkey: scoutTenant?.pubkey || scoutLive?.pubkey,
          channelId: targetChannelId,
          preferDm: false,
          postInChat: true,
          ensureWake: true,
          text: promptText,
        });
        if (res.ok && res.channel && openSideTabRef.current) {
          try {
            openSideTabRef.current({ channelId: res.channel }, { keep: true });
          } catch {}
        }
        const missingWarn =
          res.missingMembers && res.missingMembers.length > 0
            ? ` (acordado via wake — adicione ${res.missingMembers.join(", ")} em Membros do canal)`
            : "";
        notify(
          res.ok
            ? `${scoutName} acionado no canal de ${isBoard ? "Conselho" : tenant} ✓${missingWarn}`
            : `Falha ao acionar ${scoutName}: ${res.error}`
        );
      } finally {
        setRunningScout(false);
      }
    }, [tenantAgents, liveCrew, tenant, resolveActiveChannelId, holding, status.tenantManifest, wakeAgentInBuzz, notify]);

    // Carrega automacoes persistidas por empresa (localStorage + fallback defaults)
    React.useEffect(() => {
      const key = `orgfy_automations_${tenant}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAutomations(parsed);
            setSelectedAutomationId(parsed[0].id);
            return;
          }
        }
      } catch {}
      const defaults = buildDefaultAutomations(tenant, status.tenantManifest?.nome || tenant);
      setAutomations(defaults);
      setSelectedAutomationId(defaults[0]?.id || "");
    }, [tenant]);

    const persistAutomations = React.useCallback(
      async (list: OrgfyAutomation[], showToast = true) => {
        try {
          localStorage.setItem(`orgfy_automations_${tenant}`, JSON.stringify(list));
        } catch {}
        try {
          const host = (ctx as any)?.host;
          if (typeof host?.runCommand === "function") {
            await host.runCommand("orgfy-controle-write", JSON.stringify({ kind: "automacoes", tenant, automations: list }));
          } else if (typeof host?.writeFile === "function") {
            const targetPath = `/Users/heltonfraga/.buzz/REPOS/orgfy/.esteira/estado/automacoes-${tenant}.json`;
            await host.writeFile(targetPath, JSON.stringify({ tenant, updatedAt: new Date().toISOString(), automations: list }, null, 2));
          }
        } catch {}
        if (showToast) notify(`Automações de ${tenant} salvas.`);
      },
      [tenant, notify]
    );

    const handleUpdateAutomation = React.useCallback((id: string, patch: Partial<OrgfyAutomation>) => {
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    }, []);

    const handleCreateAutomation = React.useCallback((initial?: Partial<OrgfyAutomation>) => {
      const newId = initial?.id || `auto-${Date.now().toString(36)}`;
      const item: OrgfyAutomation = {
        id: newId,
        name: initial?.name || "Nova automação",
        description: initial?.description || "Rotina personalizada da OrgFy Factory.",
        scope: initial?.scope || "project",
        enabled: initial?.enabled ?? false,
        source: initial?.source || "orgfy",
        templateId: initial?.templateId,
        workKey: initial?.workKey || `automation:${newId}`,
        triggerKind: initial?.triggerKind || "schedule",
        frequency: initial?.frequency || "daily",
        dayOfWeek: initial?.dayOfWeek ?? 1,
        dayOfMonth: initial?.dayOfMonth,
        timeHHMM: initial?.timeHHMM || "09:00",
        timezone: initial?.timezone || "America/Sao_Paulo",
        eventKind: initial?.eventKind || "pr_opened",
        actionKind: initial?.actionKind || "agent_session",
        targetAgent: initial?.targetAgent || tenantAgents[0]?.name || "OrgFy Bento",
        autonomy: initial?.autonomy || "auto",
        guards: initial?.guards || { ...DEFAULT_GUARDS },
        prompt: initial?.prompt || `Execute esta rotina em {{project.name}} ({{date}}).`,
        recentRuns: initial?.recentRuns || [],
      };
      setAutomations((prev) => {
        const next = [item, ...prev];
        void persistAutomations(next, false);
        return next;
      });
      setSelectedAutomationId(newId);
    }, [tenantAgents, persistAutomations]);

    const handleExportAutomationMarkdown = React.useCallback(
      (auto: OrgfyAutomation) => {
        const md = exportAutomationToMarkdown(auto);
        handleCopyText(md, `Markdown (.md) de ${auto.name}`);
      },
      [handleCopyText]
    );

    const handleImportAutomation = React.useCallback(
      (auto: OrgfyAutomation) => {
        handleCreateAutomation(auto);
        setAutomationView("detail");
        notify(`Automação "${auto.name}" importada (desligada por segurança).`);
      },
      [handleCreateAutomation, notify]
    );

    const handleAddStarterSet = React.useCallback(() => {
      const existing = new Set(automations.map((a) => a.templateId).filter(Boolean));
      const toAdd = ORGFY_AUTOMATION_TEMPLATES.filter((t) => t.starter && !existing.has(t.id));
      if (toAdd.length === 0) {
        notify("Todos os templates Starter já estão nesta empresa.");
        return;
      }
      const created: OrgfyAutomation[] = toAdd.map((tpl) => ({
        id: `${tpl.id}-${tenant}`,
        name: tpl.name,
        description: tpl.description,
        scope: "project",
        enabled: true,
        source: "template",
        templateId: tpl.id,
        workKey: `automation:${tpl.id}`,
        triggerKind: tpl.triggerKind,
        frequency: tpl.frequency,
        dayOfWeek: tpl.dayOfWeek,
        dayOfMonth: tpl.dayOfMonth,
        timeHHMM: tpl.timeHHMM,
        timezone: "America/Sao_Paulo",
        eventKind: tpl.eventKind,
        actionKind: tpl.actionKind,
        targetAgent: tenantAgents.some((a) => a.name === tpl.defaultAgent) ? tpl.defaultAgent : tenantAgents[0]?.name || tpl.defaultAgent,
        autonomy: tpl.autonomy,
        guards: { ...DEFAULT_GUARDS, overlapPolicy: tpl.overlapPolicy },
        prompt: tpl.prompt,
        recentRuns: [],
      }));
      setAutomations((prev) => {
        const next = [...created, ...prev];
        void persistAutomations(next, false);
        return next;
      });
      notify(`Conjunto inicial ativado: ${created.length} automações adicionadas.`);
    }, [automations, tenant, tenantAgents, persistAutomations, notify]);

    const handleDeleteAutomation = React.useCallback((id: string) => {
      setAutomations((prev) => {
        const next = prev.filter((a) => a.id !== id);
        if (next.length > 0) setSelectedAutomationId(next[0].id);
        void persistAutomations(next, false);
        return next;
      });
      notify("Automação removida.");
    }, [persistAutomations, notify]);

    const handleRunAutomationNow = React.useCallback(
      async (auto: OrgfyAutomation) => {
        setRunningAutomationId(auto.id);
        const nowLabel = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const resolvedPrompt = auto.prompt
          .replace(/\{\{project\.name\}\}/g, status.tenantManifest?.nome || tenant)
          .replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10))
          .replace(/\{\{tenant\}\}/g, tenant)
          .replace(/\{\{repo\}\}/g, status.tenantManifest?.repoId || tenant)
          .replace(/\{\{channel\}\}/g, status.tenantManifest?.canal || "");
        const targetAg =
          tenantAgents.find((a) => a.name.toLowerCase() === auto.targetAgent.toLowerCase()) ||
          liveCrew.find((a) => a.name.toLowerCase() === auto.targetAgent.toLowerCase());
        const agentKey = (targetAg && "agentKey" in targetAg ? targetAg.agentKey : targetAg?.key) || "";
        let statusRun: "ok" | "error" = "ok";
        let detail = `Disparado para ${auto.targetAgent} via Buzz.`;
        try {
          const wakeRes = await wakeAgentInBuzz({
            agentKey,
            agentName: auto.targetAgent,
            pubkey: targetAg?.pubkey,
            text: `[ORGFY AUTOMATION · ${auto.name}]\n${resolvedPrompt}`,
          });
          if (!wakeRes.ok) {
            statusRun = "error";
            detail = wakeRes.error || "Falha ao acordar agente.";
          }
        } finally {
          setRunningAutomationId(null);
        }
        setAutomations((prev) => {
          const next = prev.map((a) =>
            a.id === auto.id
              ? { ...a, recentRuns: [{ id: `run-${Date.now()}`, at: nowLabel, status: statusRun, detail }, ...a.recentRuns].slice(0, 12) }
              : a
          );
          void persistAutomations(next, false);
          return next;
        });
        notify(statusRun === "ok" ? `Automação "${auto.name}" disparada para ${auto.targetAgent}.` : `Falha ao rodar "${auto.name}": ${detail}`);
      },
      [tenant, status.tenantManifest, tenantAgents, liveCrew, wakeAgentInBuzz, persistAutomations, notify]
    );

    const handleExportAutomationYaml = React.useCallback(
      (auto: OrgfyAutomation) => {
        const yaml = exportAutomationToBuzzWorkflowYaml(auto, tenant);
        handleCopyText(yaml, `YAML Workflow Kind 30620 (${auto.name})`);
      },
      [tenant, handleCopyText]
    );

    const handleToggleChecklistStep = React.useCallback(
      async (stepId: string, nextDone: boolean, item: FactoryWorkItem) => {
        const slug = String(item.workKey || item.title.split(/\s+/)[0] || item.id).replace(/^[^a-zA-Z0-9]+/, "");
        try {
          const res = await executeCardProgress(ctx, {
            slug,
            step_id: stepId,
            status: nextDone ? "done" : "todo",
            agent: "Operador",
          });
          if (res.ok) {
            notify(`Passo ${stepId} marcado como ${nextDone ? "concluído" : "pendente"} no card.`);
          } else {
            notify(`Passo ${stepId} atualizado localmente (${res.message || "arquivo do card não encontrado"}).`);
          }
        } catch {
          notify(`Passo ${stepId} marcado localmente.`);
        }
      },
      [notify]
    );

    const handleSendUpdatesToCoo = React.useCallback(
      async (entries: Array<{ badge: string; title: string; subtitle?: string; item?: FactoryWorkItem }>) => {
        const cooName = status.tenantManifest?.coo || "OrgFy Bento";
        const cooAg =
          tenantAgents.find((a) => a.papel === "coo" || a.name.toLowerCase() === cooName.toLowerCase()) ||
          liveCrew.find((a) => a.name.toLowerCase().includes("bento"));
        const agentKey = (cooAg && "agentKey" in cooAg ? cooAg.agentKey : cooAg?.key) || "";
        const lines = entries.map((e) => `- [${e.badge}] ${e.title}${e.subtitle ? ` (${e.subtitle})` : ""}`).join("\n");
        setSendingCooUpdates(true);
        try {
          const res = await wakeAgentInBuzz({
            agentKey,
            agentName: cooName,
            pubkey: cooAg?.pubkey,
            preferDm: true,
            text: `[ORGFY FACTORY UPDATES · ${tenant}]\n${entries.length} atualização(ões) recente(s):\n${lines}`,
          });
          notify(res.ok ? `${entries.length} update(s) enviado(s) para ${cooName}.` : `Falha ao enviar updates ao COO: ${res.error}`);
        } finally {
          setSendingCooUpdates(false);
        }
      },
      [tenant, status.tenantManifest, tenantAgents, liveCrew, wakeAgentInBuzz, notify]
    );

    const handleSendDiffReview = React.useCallback(
      async (comments: Array<{ file: string; line: number; lineText: string; comment: string }>, item: FactoryWorkItem, executorName?: string) => {
        const targetName = executorName || status.tenantManifest?.coo || "OrgFy Bento";
        const targetAg =
          tenantAgents.find((a) => a.name.toLowerCase().includes(targetName.toLowerCase())) ||
          liveCrew.find((a) => a.name.toLowerCase().includes(targetName.toLowerCase()));
        const agentKey = (targetAg && "agentKey" in targetAg ? targetAg.agentKey : targetAg?.key) || "";
        const body = comments
          .map((c, idx) => `${idx + 1}. \`${c.file}:${c.line}\` — ${c.comment}\n   > ${c.lineText.trim().slice(0, 100)}`)
          .join("\n");
        const res = await wakeAgentInBuzz({
          agentKey,
          agentName: targetName,
          pubkey: targetAg?.pubkey,
          text: `[ORGFY DIFF REVIEW · #${item.id.slice(0, 8)} ${item.title}]\nAjustes solicitados em ${comments.length} linha(s):\n${body}`,
        });
        notify(
          res.ok
            ? `Revisão com ${comments.length} comentário(s) ancorado(s) enviada para ${targetName}.`
            : `Falha ao enviar revisão para ${targetName}: ${res.error}`
        );
      },
      [tenant, status.tenantManifest, tenantAgents, liveCrew, wakeAgentInBuzz, notify]
    );

    // Carrega e assina Question Cards, Deliberações do Conselho e Locks via OrgfyCrdtStore (ctx.artifactStorage.open + fallback)
    const refreshQuestionCards = React.useCallback(async () => {
      try {
        const [qList, cList, lList] = await Promise.all([
          crdtStore.listQuestionCards(),
          crdtStore.listCouncilDeliberations(),
          crdtStore.listDistributedLocks(),
        ]);
        setQuestionCards(qList);
        setCouncilDeliberations(cList);
        setDistributedLocks(lList);
      } catch {}
    }, []);

    React.useEffect(() => {
      void refreshQuestionCards();
      return crdtStore.subscribe(() => {
        void refreshQuestionCards();
      });
    }, [refreshQuestionCards]);

    // Assina modo Focus nativo do Buzz (buzz-focus.v1)
    React.useEffect(() => subscribeBuzzFocus(setFocusState), []);

    const refreshNativeUsage = React.useCallback(async () => {
      const days = costRange === "90d" ? 90 : costRange === "30d" ? 30 : 7;
      const snap = await collectBuzzNativeUsage(ctx, days).catch(() => null);
      if (snap) setNativeUsage(snap);
    }, [costRange]);

    React.useEffect(() => {
      if (tab === "costs") void refreshNativeUsage();
    }, [tab, refreshNativeUsage]);

    const handleAuditCommandIntegrity = React.useCallback(async () => {
      const summary = await auditAllHostCommandsIntegrity(ctx);
      setCommandIntegrity(summary);
      notify(`Auditoria SHA-256: ${summary.verified}/${summary.total} scripts íntegros.`);
    }, [notify]);

    React.useEffect(() => {
      if ((tab === "settings" || (tab === "agents" && agentTab === "mcp")) && !commandIntegrity) {
        void auditAllHostCommandsIntegrity(ctx).then(setCommandIntegrity).catch(() => {});
      }
    }, [tab, agentTab, commandIntegrity]);

    const handleRunHoldoutNow = React.useCallback(async () => {
      const host = (ctx as any)?.host;
      if (typeof host?.runCommand !== "function") {
        notify("ctx.host.runCommand indisponível para rodar Holdout.");
        return;
      }
      setRunningHoldout(true);
      try {
        await host.runCommand("orgfy-holdout", "");
        notifyRespectingFocus(ctx, { title: "OrgFy Holdout Sensor", body: "Suíte Holdout concluída fora do repositório." }, { priority: "normal" });
        notify("Sensor Holdout executado com sucesso.");
        await refresh(tenant, false, true);
      } catch (err: any) {
        notify(`Falha ao rodar Holdout: ${err?.message || err}`);
      } finally {
        setRunningHoldout(false);
      }
    }, [tenant, notify, refresh]);

    const handleCreateCouncilDeliberation = React.useCallback(
      async (title: string, summary: string) => {
        await crdtStore.createCouncilDeliberation({ tenant, title, summary, proposedBy: "Fundador" });
        await refreshQuestionCards();
        notify(`Deliberação "${title}" sincronizada no CRDT.`);
      },
      [tenant, refreshQuestionCards, notify]
    );

    const handleVoteCouncilDeliberation = React.useCallback(
      async (id: string, decision: "aprovada" | "recusada") => {
        await crdtStore.voteCouncilDeliberation(id, decision, "Fundador");
        await refreshQuestionCards();
        notify(`Deliberação marcada como ${decision} (CRDT Sync).`);
      },
      [refreshQuestionCards, notify]
    );

    const handleReleaseDistributedLock = React.useCallback(
      async (id: string) => {
        await crdtStore.releaseDistributedLock(id);
        await refreshQuestionCards();
        notify("Lock distribuído liberado no CRDT.");
      },
      [refreshQuestionCards, notify]
    );

    const handleAutomateFromSession = React.useCallback(
      (input: { agentName: string; stepLabel?: string; sessionTitle?: string }) => {
        const draft = buildAutomationFromSession({
          tenant,
          companyName: status.tenantManifest?.nome || tenant,
          agentName: input.agentName,
          stepLabel: input.stepLabel,
          sessionTitle: input.sessionTitle,
        });
        handleCreateAutomation(draft);
        setTab("automations");
        setAutoTab("automations");
        setAutomationView("detail");
        notify(`Automação criada em 1 clique a partir da sessão de ${input.agentName}.`);
      },
      [tenant, status.tenantManifest?.nome, handleCreateAutomation, notify]
    );

    const handleEvaluateTrustEngine = React.useCallback(
      async (override?: { category: string; mode: "assisted" | "dark_auto_merge" | "auto" }) => {
        const host = (ctx as any)?.host;
        if (typeof host?.runCommand !== "function") {
          notify("ctx.host.runCommand indisponível para o Motor de Confiança.");
          return;
        }
        setEvaluatingTrust(true);
        try {
          const payload = override
            ? { action: "override", tenant, category: override.category, mode: override.mode }
            : { action: "evaluate", tenant };
          await host.runCommand("orgfy-trust-engine", JSON.stringify(payload));
          notify(override ? `Categoria ${override.category} atualizada para ${override.mode}.` : `Motor de Confiança & Escape Rate recalculado para ${tenant}.`);
          await refresh(tenant, false, true);
        } catch (err: any) {
          notify(`Falha no Motor de Confiança: ${err?.message || err}`);
        } finally {
          setEvaluatingTrust(false);
        }
      },
      [tenant, notify, refresh]
    );

    const handleScaffoldSubsidiary = React.useCallback(
      async (input: { slug: string; nome: string; descricao: string; budgetTokensDiario: number; gastoDiaUsd: number }) => {
        const host = (ctx as any)?.host;
        if (typeof host?.runCommand !== "function") {
          notify("ctx.host.runCommand indisponível para Holding-as-Code.");
          return;
        }
        setScaffoldingSubsidiary(true);
        try {
          const rawOut = await host.runCommand("orgfy-holding-scaffold", JSON.stringify(input));
          const parsed = typeof rawOut === "string" ? JSON.parse(rawOut) : rawOut;
          if (!parsed?.ok) throw new Error(parsed?.error || "Falha ao provisionar subsidiária");
          setSubsidiaryDraftState({ open: false, slug: "", nome: "", descricao: "", budgetTokensDiario: 1000000, gastoDiaUsd: 30 });
          notify(`Subsidiária ${parsed.nome} (${parsed.slug}) criada em 1 clique ✓`);
          await refresh(parsed.slug, true, false);
          setTenant(parsed.slug);
        } catch (err: any) {
          notify(`Erro Holding-as-Code: ${err?.message || err}`);
        } finally {
          setScaffoldingSubsidiary(false);
        }
      },
      [notify, refresh]
    );

    const handleAnswerQuestionCard = React.useCallback(
      async (card: OrgfyQuestionCard, answer: QuestionCardAnswer) => {
        const updated = await crdtStore.answerQuestionCard(card.id, answer);
        await refreshQuestionCards();
        if (!updated) {
          notify("Não foi possível atualizar o Question Card.");
          return;
        }
        const selectedLabels = (answer.selectedIds || [])
          .map((id) => card.options.find((o) => o.id === id)?.label || id)
          .join(", ");
        const targetAg =
          (card.requestedByPubkey &&
            (tenantAgents.find((a) => a.pubkey?.toLowerCase() === card.requestedByPubkey?.toLowerCase()) ||
              liveCrew.find((a) => a.pubkey?.toLowerCase() === card.requestedByPubkey?.toLowerCase()))) ||
          tenantAgents.find((a) => a.name.toLowerCase().includes(card.requestedBy.toLowerCase())) ||
          liveCrew.find((a) => a.name.toLowerCase().includes(card.requestedBy.toLowerCase()));
        const agentKey = (targetAg && "agentKey" in targetAg ? targetAg.agentKey : targetAg?.key) || "";
        const targetPubkey = card.requestedByPubkey || targetAg?.pubkey;
        const replyLines = [
          `@${card.requestedBy} **${card.title}**`,
          selectedLabels ? `- **Escolha:** ${selectedLabels}` : "",
          answer.freeText ? `- **Observação:** ${answer.freeText}` : "",
        ].filter(Boolean);
        const wakeRes = await wakeAgentInBuzz({
          agentKey,
          agentName: card.requestedBy,
          pubkey: targetPubkey,
          channelId: card.channelId,
          threadRoot: card.threadRoot,
          preferDm: true,
          postInChat: true,
          text: replyLines.join("\n"),
        });
        if (wakeRes.ok) {
          if (wakeRes.mode === "chat_message" && wakeRes.channel && openSideTabRef.current) {
            try {
              openSideTabRef.current(
                { channelId: wakeRes.channel, threadId: wakeRes.threadRoot },
                { keep: true }
              );
            } catch {}
          }
          notify(
            wakeRes.mode === "chat_message"
              ? `Resposta enviada no chat de ${card.requestedBy} ✓`
              : `Resposta salva e ${card.requestedBy} acordado via Buzz (fallback wake).`
          );
        } else {
          notify(`Resposta salva no CRDT, mas falhou ao enviar no chat de ${card.requestedBy}: ${wakeRes.error}`);
        }
      },
      [refreshQuestionCards, tenantAgents, liveCrew, wakeAgentInBuzz, notify]
    );

    const handleDismissQuestionCard = React.useCallback(
      async (card: OrgfyQuestionCard) => {
        await crdtStore.dismissQuestionCard(card.id);
        await refreshQuestionCards();
        notify(`Question Card "${card.title}" adiado.`);
      },
      [refreshQuestionCards, notify]
    );

    const handleRecordVisualEvidence = React.useCallback(
      async (evidence: { url: string; note: string; verdict: "approved" | "changes_requested" }, item: FactoryWorkItem, executorName?: string) => {
        await crdtStore.recordVisualEvidence({
          tenant,
          itemId: item.id,
          url: evidence.url,
          note: evidence.note,
          verdict: evidence.verdict,
        });
        const targetName = executorName || status.tenantManifest?.coo || "OrgFy Bento";
        const targetAg =
          tenantAgents.find((a) => a.name.toLowerCase().includes(targetName.toLowerCase())) ||
          liveCrew.find((a) => a.name.toLowerCase().includes(targetName.toLowerCase()));
        const agentKey = (targetAg && "agentKey" in targetAg ? targetAg.agentKey : targetAg?.key) || "";
        await wakeAgentInBuzz({
          agentKey,
          agentName: targetName,
          pubkey: targetAg?.pubkey,
          text: `[ORGFY VISUAL PREVIEW · ${evidence.verdict === "approved" ? "APROVADO ✓" : "AJUSTE SOLICITADO"} · #${item.id.slice(0, 8)} ${item.title}]\nURL: ${evidence.url}\nNota: ${evidence.note}`,
        });
        notify(
          evidence.verdict === "approved"
            ? `Evidência visual aprovada e sincronizada (CRDT) para #${item.id.slice(0, 8)}.`
            : `Ajuste visual enviado para ${targetName}.`
        );
      },
      [tenant, status.tenantManifest, tenantAgents, liveCrew, wakeAgentInBuzz, notify]
    );

    // CEO Master dinâmico: respeita session.mainAgent do Buzz se configurado, senão board.json (OrgFy Iris)
    const masterLive =
      (mainAgentPubkey && liveCrew.find((a) => a.pubkey?.toLowerCase() === mainAgentPubkey)) ||
      liveCrew.find((a) => a.name.toLowerCase().includes("iris")) ||
      liveCrew[0] ||
      null;
    const masterAgentName = masterLive?.name || holding?.ceoHolding?.nome || "OrgFy Iris";
    const masterTurn = masterLive?.pubkey ? telemetry.byPubkey[masterLive.pubkey.toLowerCase()] || null : null;

    const workspaces =
      holding?.empresas && holding.empresas.length > 0
        ? holding.empresas.map((e) => ({
            slug: e.slug,
            nome: e.workspaceBuzz || e.nome,
            estagio: e.estagio,
            canal: e.canal || "",
            agentesInfo: `${e.agentesProntos}/${e.agentesTotal}`,
          }))
        : DEFAULT_WORKSPACES.map((w) => ({ ...w, agentesInfo: "" }));

    const isBoardTenant = tenant === "board";
    const activeWorkspace = workspaces.find((w) => w.slug === tenant) || workspaces[0];
    const empresaNome = isBoardTenant ? "Conselho da Holding" : (status.tenantManifest?.nome || activeWorkspace?.nome || tenant);
    const empresaRepo = isBoardTenant ? "holding" : (status.tenantManifest?.repoId || tenant);
    const isGlobalView = GLOBAL_TABS.has(tab);

    const pendingApprovals = (holding?.approvals || []).filter((a) => a.status === "pendente").length;
    const pendingQuestionCardsCount = questionCards.filter((c) => c.status === "pending").length;
    const abaixoMinimoCount = (status.modelos || []).filter((m) => m.abaixo_minimo).length;
    // Na governança OrgFy (board.json), 'Aguardando você' (Fundador) conta SOMENTE Question Cards pendentes e escaladas explícitas da Iris/Board (nunca quarentena/falha operacional do COO)
    const founderEscalatedItems = [...status.inProgress, ...status.recent].filter((i) => i.stage === "escalated");
    const inboxCount = pendingQuestionCardsCount + status.held.length + founderEscalatedItems.length;

    // Canais de outras empresas (para isolar agentes compartilhados como Iris/Bento por empresa)
    const activeTenantChannelId = (resolveActiveChannelId(tenant) || "").trim().toLowerCase();
    const otherTenantChannels = React.useMemo(() => {
      const set = new Set<string>();
      const boardCh = (holding?.boardCanal || "80529b52-ee97-40d4-ab4c-aa9d13b9bcee").trim().toLowerCase();
      if (tenant !== "board" && boardCh && boardCh !== activeTenantChannelId) set.add(boardCh);
      for (const e of holding?.empresas || []) {
        const ch = (e.canal || "").trim().toLowerCase();
        if (e.slug !== tenant && ch && ch !== activeTenantChannelId) set.add(ch);
      }
      return Array.from(set);
    }, [holding, tenant, activeTenantChannelId]);
    const otherTenantChannelSet = React.useMemo(() => new Set(otherTenantChannels), [otherTenantChannels]);
    const tenantPubkeySet = React.useMemo(() => new Set(tenantAgents.map((a) => (a.pubkey || "").toLowerCase()).filter(Boolean)), [tenantAgents]);
    const tenantNameSet = React.useMemo(() => new Set(tenantAgents.map((a) => (a.name || "").trim().toLowerCase()).filter(Boolean)), [tenantAgents]);

    // Contagem REAL de agentes respondendo agora SOMENTE nesta empresa (excluindo turnos em erro e canais de outras empresas)
    const tenantWorkingNowCount = telemetry.activeTurns.filter((t) => {
      if (t.state === "error") return false;
      const turnCh = (t.channelId || "").trim().toLowerCase();
      if (turnCh && otherTenantChannelSet.has(turnCh)) return false;
      if (activeTenantChannelId && turnCh === activeTenantChannelId) return true;
      const pk = (t.agentPubkey || "").toLowerCase();
      const nm = (t.agentName || "").trim().toLowerCase();
      return (pk && tenantPubkeySet.has(pk)) || (nm && tenantNameSet.has(nm));
    }).length;
    const tenantTotalAgentsCount = tenantAgents.length;
    const boardCount = status.backlog.length + status.inProgress.length;

    // Assentos da Sala de Reunião 3D do Conselho (OrgFy Iris Bestie + 6 Comitês funcionais de board.json)
    const boardroomSeats = React.useMemo(() => {
      const boardAreas = holding?.conselho || [];
      const resolveCrew = (name: string) => liveCrew.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null;
      const irisName = holding?.ceoHolding?.nome || "OrgFy Iris";
      const irisCrew = resolveCrew(irisName);
      const irisPk = holding?.ceoHolding?.pubkey || irisCrew?.pubkey || "";
      return [
        {
          id: "bestie-iris",
          label: irisName,
          role: "Bestie · Orquestradora Buzz",
          agentName: irisName,
          agentKey: irisCrew?.key || "orgfy-iris",
          pubkey: irisPk,
          status: (irisPk && telemetry.byPubkey?.[irisPk.toLowerCase()] ? "working" : "active") as "active" | "working" | "planned",
          onClick: () => handleOpenAgentDmInBuzz({ key: irisCrew?.key, name: irisName, pubkey: irisPk }),
        },
        ...boardAreas.map((area) => {
          const crewMatch = resolveCrew(area.responsavel);
          const pk = (area as any).pubkey || crewMatch?.pubkey || "";
          const isWorking = Boolean(pk && telemetry.byPubkey?.[pk.toLowerCase()]);
          return {
            id: area.id,
            label: area.area,
            role: area.responsavel,
            agentName: area.responsavel,
            agentKey: crewMatch?.key || area.id,
            pubkey: pk,
            status: (area.status !== "ativo" ? "planned" : isWorking ? "working" : "active") as "active" | "working" | "planned",
            onClick: pk ? () => handleOpenAgentDmInBuzz({ key: crewMatch?.key, name: area.responsavel, pubkey: pk }) : undefined,
          };
        }),
      ];
    }, [holding, liveCrew, telemetry, handleOpenAgentDmInBuzz]);

    const renderNavBtn = (id: FactoryTab, label: string, badge?: string, tone?: "warn" | "danger") =>
      h(
        "button",
        {
          key: id,
          type: "button",
          className: "of-nav-btn",
          "data-active": tab === id ? "true" : "false",
          onClick: () => setTab(id),
        },
        h("span", null, label),
        badge && h("span", { className: "of-nav-badge", "data-tone": tone }, badge)
      );

    const projectTabs: Array<{ id: FactoryTab; label: string; badge?: string; tone?: "warn" | "danger" }> = [
      { id: "overview", label: isBoardTenant ? "Visão Geral & Pipeline de Gestão" : PT_BR.nav.overview },
      { id: "board", label: isBoardTenant ? "Pautas do Conselho" : "Fábrica · Board", badge: String(boardCount) },
      {
        id: "floor",
        label: isBoardTenant ? "Sala de Reunião 3D" : "Andar 3D",
        badge: isBoardTenant
          ? String(boardroomSeats.length)
          : tenantWorkingNowCount > 0
          ? `${tenantWorkingNowCount}/${tenantTotalAgentsCount}`
          : String(tenantTotalAgentsCount),
        tone: tenantWorkingNowCount > 0 ? "warn" : undefined,
      },
      { id: "agents", label: isBoardTenant ? "Conselheiros" : "Agentes", badge: abaixoMinimoCount > 0 ? `⚠ ${abaixoMinimoCount}` : String(tenantTotalAgentsCount), tone: abaixoMinimoCount > 0 ? "danger" : undefined },
      { id: "vision", label: isBoardTenant ? "Estatuto & Regras" : "Canvas / Visão" },
      ...(isBoardTenant
        ? [{
            id: "holding" as FactoryTab,
            label: "Conselho · Portfólio & Governança",
            badge: pendingApprovals > 0 ? String(pendingApprovals) : String((holding?.empresas || []).length),
            tone: pendingApprovals > 0 ? ("warn" as const) : undefined,
          }]
        : []),
      { id: "settings", label: PT_BR.nav.settings },
    ];

    const NativeTabs = (ctx as any)?.conversation?.ui?.Tabs;
    const relaySnap = React.useMemo(() => {
      try {
        return typeof (ctx as any)?.relay?.snapshot === "function" ? (ctx as any).relay.snapshot() : null;
      } catch {
        return null;
      }
    }, [relayTick, status.lastTickAt]);
    const useNativeSideTabs = Boolean(
      NativeTabs &&
        relaySnap?.session &&
        typeof relaySnap?.scope === "string" &&
        relaySnap.scope.length > 0 &&
        typeof relaySnap?.session?.viewer === "string" &&
        relaySnap.session.viewer.length > 0
    );

    const pageContent = h(
      "div",
      {
        ref: hostRef,
        "data-orgfy-factory-root": "true",
        style: {
          width: "100%",
          height: useNativeSideTabs ? "100%" : "100vh",
          maxHeight: useNativeSideTabs ? "100%" : "100vh",
          overflow: "hidden",
          display: "flex",
        },
      },
      h("style", { "data-orgfy-factory-inline-fallback": "true" }, FACTORY_SHADOW_CSS),
      h(
        "div",
        {
          className: "of-shell",
          "data-collapsed": sidebarCollapsed ? "true" : "false",
          "data-density": compactDensity ? "compact" : "default",
          style: { flex: 1, minWidth: 0, height: "100%" },
        },
        renderFactorySidebar(
          {
            h,
            collapsed: sidebarCollapsed,
            onToggleCollapse: toggleSidebarCollapsed,
            paletteOpen,
            onSetPaletteOpen: (open) => {
              setPaletteOpen(open);
              if (!open) setPaletteQuery("");
            },
            tab,
            onSelectTab: setTab,
            tenant,
            onSelectTenant: (slug, targetTab) => {
              setTenant(slug);
              if (targetTab) setTab(targetTab);
              else if (GLOBAL_TABS.has(tab)) setTab("overview");
            },
            workspaces,
            expandedProjects,
            onToggleProject: (slug) =>
              setExpandedProjects((prev) => ({ ...prev, [slug]: !(prev[slug] ?? slug === tenant) })),
            status,
            telemetry,
            masterAgentName,
            masterAgentPubkey: masterLive?.pubkey || holding?.ceoHolding?.pubkey || "",
            masterTurn,
            pendingApprovals,
            inboxCount,
            urgentInbox: pendingApprovals > 0 || status.held.length > 0,
            waitingItems: [...status.held, ...founderEscalatedItems],
            onOpenMasterDm: () =>
              handleOpenAgentDmInBuzz(
                masterLive || { name: masterAgentName, pubkey: holding?.ceoHolding?.pubkey || "" }
              ),
            onOpenAgentDm: handleOpenAgentDmInBuzz,
            onOpenChannelInBuzz: handleOpenChannelInBuzz,
            onSelectItem: setSelectedItem,
            onOpenTurnInSideChat: handleOpenTurnInSideChat,
            onRefresh: () => refresh(tenant),
            onToggleDrain: () =>
              handleControlUpdate(
                { drain: !status.drain },
                status.drain ? "Dreno cancelado." : "Modo Dreno ativado (finaliza os itens em andamento)."
              ),
            onToggleKillSwitch: (next) =>
              handleControlUpdate(
                { killSwitch: next, pausedReason: next ? "Kill Switch acionado pelo operador" : null },
                next ? "Kill Switch ativado imediatamente." : "Kill Switch liberado."
              ),
            compactDensity,
            onToggleDensity: () => setCompactDensity((v) => !v),
            liveCrew,
          } as FactorySidebarProps,
          showAllByProject,
          (slug) => setShowAllByProject((prev) => ({ ...prev, [slug]: !prev[slug] }))
        ),

        h(
          "div",
          { className: "of-workspace" },
          h(
            "header",
            { className: "of-page-header" },
            isGlobalView
              ? h(
                  "div",
                  { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
                  h("strong", { style: { fontSize: "14px" } }, tab === "holding" ? "Conselho da Holding (Board)" : tab === "costs" ? "Uso & Custos · Holding" : PT_BR.nav[tab] || PT_BR.appTitle),
                  h("span", { className: "of-mono of-muted" }, "· Cortexx")
                )
              : h(
                  "div",
                  { style: { display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                  h("span", { className: "of-project-tile" }, empresaNome.charAt(0).toUpperCase()),
                  h("strong", { style: { fontSize: "14px" } }, empresaNome),
                  h("span", { className: "of-mono of-muted", style: { fontSize: "11px" } }, `repo: ${empresaRepo}`),
                  h(
                    "span",
                    { className: "of-pill", "data-tone": status.killSwitch ? "failed" : "done" },
                    status.killSwitch ? "Kill Switch ativo" : PT_BR.modes[status.mode] || status.mode
                  ),
                  tenantWorkingNowCount > 0 &&
                    h(
                      "span",
                      { className: "of-pill", "data-tone": "running", title: `Turnos ativos em tempo real de ${empresaNome} via session.agentActivity` },
                      `⚡ ${tenantWorkingNowCount} respondendo`
                    ),
                  focusState.active &&
                    h(
                      "span",
                      { className: "of-pill", "data-tone": "waiting", title: "Modo Focus ativo no Buzz (notificações não críticas silenciadas)" },
                      `🔭 Focus até ${focusState.untilFormatted}`
                    )
                ),
            !isGlobalView &&
              h(
                "div",
                { className: "of-header-icon-tabs", role: "tablist", "aria-label": `Navegação de ${empresaNome}` },
                projectTabs.map((pt) => {
                  const tabIconPaths: Record<string, string[]> = {
                    overview: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"],
                    board: ["M3 4h5v16H3z", "M10 4h5v10h-5z", "M17 4h4v13h-4z"],
                    floor: ["M12 2 3 7l9 5 9-5-9-5z", "M3 12l9 5 9-5", "M3 17l9 5 9-5"],
                    agents: ["M12 8V4H8", "M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M9 13h.01", "M15 13h.01"],
                    vision: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h5"],
                    holding: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 21v-6h6v6", "M9 10h.01", "M15 10h.01"],
                    settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
                  };
                  const paths = tabIconPaths[pt.id] || tabIconPaths.overview;
                  return h(
                    "button",
                    {
                      key: pt.id,
                      type: "button",
                      role: "tab",
                      className: "of-header-icon-tab",
                      "data-active": tab === pt.id ? "true" : "false",
                      title: pt.badge ? `${pt.label} (${pt.badge})` : pt.label,
                      "aria-label": pt.label,
                      onClick: () => setTab(pt.id),
                    },
                    h(
                      "svg",
                      {
                        width: 15,
                        height: 15,
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: 1.8,
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        style: { width: "15px", height: "15px", display: "block", flexShrink: 0 },
                        "aria-hidden": "true",
                      },
                      paths.map((d, i) => h("path", { key: i, d }))
                    ),
                    pt.badge && h("span", { className: "of-nav-badge", "data-tone": pt.tone, style: { padding: "0 5px", fontSize: "9.5px" } }, pt.badge)
                  );
                })
              ),
            h(
              "div",
              { className: "of-apple-chat-bar", "data-apple-header-chat": "true" },
              !isGlobalView &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-apple-icon-btn",
                    "data-open-company-channel": "true",
                    title: `Abrir canal de ${empresaNome} no chat lateral`,
                    "aria-label": `Abrir canal de ${empresaNome}`,
                    onClick: () => handleOpenChannelInBuzz(tenant),
                  },
                  h(
                    "svg",
                    {
                      width: 15,
                      height: 15,
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 1.9,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      style: { width: "15px", height: "15px", display: "block", flexShrink: 0 },
                      "aria-hidden": "true",
                    },
                    h("line", { x1: 4, y1: 9, x2: 20, y2: 9 }),
                    h("line", { x1: 4, y1: 15, x2: 20, y2: 15 }),
                    h("line", { x1: 10, y1: 3, x2: 8, y2: 21 }),
                    h("line", { x1: 16, y1: 3, x2: 14, y2: 21 })
                  )
                ),
              h(
                "select",
                {
                  className: "of-apple-select",
                  "aria-label": "Selecionar agente e abrir chat lateral",
                  title: "Selecionar agente para abrir chat lateral",
                  disabled: openingDm,
                  value: dmAgentKey,
                  onChange: (e: any) => {
                    const nextKey = e.target.value;
                    setDmAgentKey(nextKey);
                    const picked = dmPool.find((a) => a.key === nextKey);
                    if (picked) handleOpenAgentDmInBuzz(picked);
                  },
                },
                dmPool.length > 0
                  ? dmPool.map((a) => h("option", { key: a.key, value: a.key }, a.label))
                  : h("option", { value: "" }, status.tenantManifest?.coo || "OrgFy Bento (COO)")
              )
            ),
            toast && h("span", { className: "of-pill", "data-tone": "done" }, toast),
            error && !toast && h("span", { className: "of-pill", "data-tone": "failed" }, `Aviso: ${error}`)
          ),

          h(
            "div",
            { style: { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" } },
            h(
              "main",
              {
                className: "of-main",
                style: tab === "floor" ? { padding: "10px 12px", overflow: "hidden" } : undefined,
              },
              tab === "overview"
                ? renderFactoryOverviewPanel({
                    h,
                    tenant,
                    isBoardTenant,
                    status: effectiveStatus,
                    liveCrew,
                    telemetry,
                    workingNowCount: tenantWorkingNowCount,
                    otherTenantChannels,
                    automations,
                    onOpenTurnInSideChat: handleOpenTurnInSideChat,
                    onInterruptTurn: handleInterruptTurn,
                    onOpenAgentDm: handleOpenAgentDmInBuzz,
                    onOpenAgentProfile: handleOpenNativeAgentProfile,
                    onNavigateTab: (t) => setTab(t),
                    loading,
                    confirmKill,
                    setConfirmKill,
                    activeHelpKey,
                    onToggleHelp: setActiveHelpKey,
                    onSelectItem: setSelectedItem,
                    onRefresh: () => refresh(tenant),
                    onOpenBoard: () => setTab("floor"),
                    onOpenSettings: () => setTab("settings"),
                    onOpenVision: () => setTab("vision"),
                    onToggleDrain: () =>
                      handleControlUpdate(
                        { drain: !status.drain },
                        status.drain ? "Dreno cancelado." : "Modo Dreno ativado (finaliza os itens em andamento)."
                      ),
                    onToggleKillSwitch: (next) =>
                      handleControlUpdate(
                        { killSwitch: next, pausedReason: next ? "Kill Switch acionado pelo operador" : null },
                        next ? "Kill Switch ativado imediatamente." : "Kill Switch liberado."
                      ),
                    scorecardView,
                    setScorecardView,
                    scorecardDays,
                    setScorecardDays,
                    cooUpdatesExpanded,
                    onToggleCooUpdates: () => setCooUpdatesExpanded((v) => !v),
                    onSendUpdatesToCoo: handleSendUpdatesToCoo,
                    sendingCooUpdates,
                  })
                : tab === "board" || tab === "floor"
                ? renderFactoryBoardAndFloor({
                    h,
                    tenant,
                    status: effectiveStatus,
                    liveCrew,
                    telemetry,
                    viewMode: tab,
                    onChangeViewMode: (m) => setTab(m),
                    storeyFocus,
                    onChangeStoreyFocus: setStoreyFocus,
                    selectedAgentKey,
                    onSelectAgentKey: setSelectedAgentKey,
                    onSelectItem: setSelectedItem,
                    onOpenAgentDm: handleOpenAgentDmInBuzz,
                    onOpenAgentProfileNative: handleOpenNativeAgentProfile,
                    onOpenTurnInSideChat: handleOpenTurnInSideChat,
                    onRunScout: handleRunScoutNow,
                    runningScout,
                    onOpenGuide: () => setGuideOpen(true),
                    onToggleKillSwitch: (next) =>
                      handleControlUpdate(
                        { killSwitch: next, pausedReason: next ? "Kill Switch acionado pelo operador" : null },
                        next ? "Kill Switch ativado imediatamente." : "Kill Switch liberado."
                      ),
                    onRefresh: () => refresh(tenant, false, false),
                    loading,
                    Floor3D,
                    HoldingTower3D,
                    holding,
                    onEnterTowerFloor: (slug: string) => {
                      setTenant(slug);
                      setStoreyFocus("both");
                      setTab("floor");
                    },
                    onOpenChannelInBuzz: handleOpenChannelInBuzz,
                    isBoardTenant,
                    Boardroom3D,
                    boardroomSeats,
                  })
                : renderFactorySecondaryPage({
                    h,
                    tab,
                    tenant,
                    holding,
                    telemetry,
                    channelCanvas,
                    onSelectTenant: (t) => {
                      setTenant(t);
                      setTab("overview");
                    },
                    onOpenAgentDm: handleOpenAgentDmInBuzz,
                    status: effectiveStatus,
                    buzzCatalog,
                    linkedWorkspaceId,
                    linkedChannelId,
                    tenantAgentsSource,
                    onLinkEnterpriseWorkspaceChannel: handleLinkEnterpriseWorkspaceChannel,
                    savingEnterpriseLink,
                    workspaceDetails,
                    workspaceDraft,
                    setWorkspaceDraft,
                    savingWorkspaceDetails,
                    onSaveWorkspaceSettings: handleSaveWorkspaceSettings,
                    liveCrew,
                    onSelectItem: setSelectedItem,
                    inboxFilter,
                    setInboxFilter,
                    costRange,
                    setCostRange,
                    autoTab,
                    setAutoTab,
                    agentTab,
                    setAgentTab,
                    settingsForm,
                    setSettingsForm,
                    onSaveSettings: () =>
                      handleControlUpdate(
                        {
                          mode: settingsForm.mode,
                          autoMerge: settingsForm.autoMerge,
                          mergePolicy: settingsForm.mergePolicy,
                          limits: {
                            gastoDiaUsd: settingsForm.gastoDiaUsd,
                            mergesDia: settingsForm.mergesDia,
                            agentes: settingsForm.agentesMax,
                            prsAbertos: settingsForm.prsAbertos,
                            falhasSeguidas: settingsForm.falhasSeguidas,
                          },
                        },
                        `Configurações salvas em controle-${tenant}.json.`
                      ),
                    onSelectModeQuick: (mode) => {
                      const isFactory = mode === "software_factory" || mode === "dark_factory";
                      const existingTpls = new Set(automations.map((a) => a.templateId).filter(Boolean));
                      const hasMissingStarter = ORGFY_AUTOMATION_TEMPLATES.some((t) => t.starter && !existingTpls.has(t.id));
                      setAutonomyModal({
                        open: true,
                        targetMode: mode,
                        // Dark Factory (100% autônomo): já vem com Auto-merge + Starter Set pré-marcados
                        autoMerge: mode === "dark_factory" ? true : isFactory ? Boolean(settingsForm.autoMerge) : false,
                        enableStarterSet: isFactory && hasMissingStarter,
                      });
                    },
                    onOpenChannelInBuzz: handleOpenChannelInBuzz,
                    onOpenChannelFullPage: handleOpenChannelFullPage,
                    onOpenBuzzLink: handleOpenBuzzLink,
                    Boardroom3D,
                    onReconcileAgents: handleReconcileAgentsR51,
                    agentPromptSyncMap,
                    syncingPromptKey,
                    onSyncAgentPrompt: handleSyncAgentPrompt,
                    onSyncAllOutdatedPrompts: handleSyncAllOutdatedPrompts,
                    onAgentSessionAction: handleAgentSessionAction,
                    onOpenAgentDrawer: (k: string) => void handleOpenNativeAgentProfile(k),
                    onSaveAgentProfile: handleSaveAgentProfile,
                    editingAgentKey,
                    setEditingAgentKey,
                    agentEditDraft,
                    setAgentEditDraft,
                    canvasDraft,
                    setCanvasDraft,
                    canvasMode,
                    setCanvasMode,
                    canvasWritable,
                    canvasSaving,
                    onSaveCanvas: handleSaveCanvas,
                    onReloadCanvas: handleReloadCanvas,
                    canvasHistory,
                    channelInfo,
                    editingChannelDetails,
                    setEditingChannelDetails,
                    channelDetailsDraft,
                    setChannelDetailsDraft,
                    savingChannelDetails,
                    onSaveChannelDetails: handleSaveChannelDetails,
                    onChannelDiagnostic: handleChannelDiagnostic,
                    onCopyText: handleCopyText,
                    resolveAuthor: (pk: string) => resolveBuzzIdentityName(ctx, pk, nameByPubkey),
                    automations,
                    selectedAutomationId,
                    onSelectAutomationId: setSelectedAutomationId,
                    onUpdateAutomation: handleUpdateAutomation,
                    onCreateAutomation: handleCreateAutomation,
                    onDeleteAutomation: handleDeleteAutomation,
                    onSaveAutomations: () => void persistAutomations(automations, true),
                    onRunAutomationNow: handleRunAutomationNow,
                    onExportAutomationYaml: handleExportAutomationYaml,
                    onExportAutomationMarkdown: handleExportAutomationMarkdown,
                    onImportAutomation: handleImportAutomation,
                    onAddStarterSet: handleAddStarterSet,
                    automationView,
                    setAutomationView,
                    runningAutomationId,
                    QuestionCardsPanel,
                    questionCards,
                    crdtBackendInfo: crdtStore.getBackendInfo(),
                    onAnswerQuestionCard: handleAnswerQuestionCard,
                    onDismissQuestionCard: handleDismissQuestionCard,
                    nativeUsage,
                    onRefreshNativeUsage: () => void refreshNativeUsage(),
                    focusState,
                    commandIntegrity,
                    onAuditCommandIntegrity: () => void handleAuditCommandIntegrity(),
                    onRunHoldoutNow: () => void handleRunHoldoutNow(),
                    runningHoldout,
                    councilDeliberations,
                    distributedLocks,
                    onCreateCouncilDeliberation: handleCreateCouncilDeliberation,
                    onVoteCouncilDeliberation: handleVoteCouncilDeliberation,
                    onReleaseDistributedLock: handleReleaseDistributedLock,
                    onAutomateFromSession: handleAutomateFromSession,
                    onEvaluateTrustEngine: handleEvaluateTrustEngine,
                    evaluatingTrust,
                    onScaffoldSubsidiary: handleScaffoldSubsidiary,
                    scaffoldingSubsidiary,
                    subsidiaryDraft,
                    setSubsidiaryDraft,
                    evalFilter,
                    setEvalFilter,
                    mcpTools,
                    mcpSearch,
                    setMcpSearch,
                    mcpCategory,
                    setMcpCategory,
                    onOpenAgentProfile: handleOpenNativeAgentProfile,
                    onMigrateSingleAgentModel: async (agentKey: string, target: { provider: string; model: string }) => {
                      await handleSaveAgentProfile(agentKey, { provider: target.provider, model: target.model });
                    },
                    usageDimension,
                    setUsageDimension,
                    usageMetric,
                    setUsageMetric,
                    usageHoverDay,
                    setUsageHoverDay,
                    usageFilterModel,
                    setUsageFilterModel,
                    pricesOpen,
                    setPricesOpen,
                    onOpenSettings: () => setTab("settings"),
                    inboxDismissedIds,
                    onInboxDismissIds: handleInboxDismissIds,
                    onInboxRestoreIds: handleInboxRestoreIds,
                    confirmBulkDismiss,
                    setConfirmBulkDismiss,
                    lastBulkDismiss,
                    onOpenItemInBuzz: handleOpenInBuzz,
                    onRetryInboxItem: (item: FactoryWorkItem) => {
                      const cooName = status.tenantManifest?.coo || "OrgFy Bento";
                      const cooAg =
                        tenantAgents.find((a) => a.papel === "coo" || a.name.toLowerCase() === cooName.toLowerCase()) ||
                        liveCrew.find((a) => a.name.toLowerCase().includes("bento"));
                      const agentKey = (cooAg && "agentKey" in cooAg ? cooAg.agentKey : cooAg?.key) || "";
                      void wakeAgentInBuzz({
                        agentKey,
                        agentName: cooName,
                        pubkey: cooAg?.pubkey,
                        preferDm: true,
                        postInChat: true,
                        text: `@${cooName} [RETRY INBOX · ${tenant}] Reexecutar/destravar #${item.id.slice(0, 8)} — ${item.title}${item.reason ? ` (${item.reason})` : ""}`,
                      }).then((res) => {
                        notify(res.ok ? `Reexecução solicitada para ${cooName} ✓` : `Falha ao acionar ${cooName}: ${res.error}`);
                      });
                    },
                    onResumeFactory: () =>
                      handleControlUpdate({ killSwitch: false, pausedReason: null }, "Fábrica retomada (Kill Switch liberado)."),
                    onOpenFactoryPanel: () => setTab("overview"),
                  })
            )
          )
        )
      ),
      h(CodeDenInspectorDrawer, {
        ctx,
        item: selectedItem,
        tenant,
        repoOwner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER,
        repoDtag: liveRepo?.dtag && liveRepo.dtag.toLowerCase() === (status.tenantManifest?.repoId || tenant).toLowerCase() ? liveRepo.dtag : (status.tenantManifest?.repoId || tenant),
        repoDetail: selectedItemDetail,
        repoLoading: selectedItemDetailLoading,
        linkedPr: selectedItem && liveRepo?.prs?.length
          ? liveRepo.prs.find((pr) =>
              pr.id === selectedItem.id ||
              (selectedItem.workKey && pr.title.toLowerCase().includes(selectedItem.workKey.toLowerCase())) ||
              pr.title.toLowerCase().includes(selectedItem.title.slice(0, 24).toLowerCase())
            ) || null
          : null,
        liveCrew,
        liveTurnsByPubkey: telemetry.byPubkey,
        ciBySha: status.ciBySha,
        resolveAuthor: (pk: string) => resolveBuzzIdentityName(ctx, pk, nameByPubkey),
        EmbeddedThread: (ctx as any)?.conversation?.ui?.Thread,
        threadChannelId: status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null,
        relaySession: relaySnap?.session,
        relayScope: typeof relaySnap?.scope === "string" ? relaySnap.scope : null,
        onOpenInBuzz: handleOpenInBuzz,
        onOpenPrInBuzz: (pr: any) => void openPrInBuzz(ctx, pr),
        onOpenRepoPrsInBuzz: () => void openRepoTabInBuzz(ctx, { owner: liveRepo?.owner, dtag: liveRepo?.dtag || tenant, tab: "prs" }),
        onOpenCommitInBuzz: handleOpenCommitInBuzz,
        onOpenAgentDm: handleOpenAgentDmInBuzz,
        onSessionAction: handleAgentSessionAction,
        onToggleChecklistStep: handleToggleChecklistStep,
        onSendDiffReview: handleSendDiffReview,
        onRecordVisualEvidence: handleRecordVisualEvidence,
        tenantAgents: tenantAgents.map((a) => ({ name: a.name, pubkey: a.pubkey, papel: a.papel })),
        onManageIssue: async (targetItem: FactoryWorkItem, req: { action: "resolve" | "close" | "reassign"; executorName?: string; executorPubkey?: string }) => {
          const host = (ctx as any)?.host;
          if (typeof host?.runCommand !== "function") {
            notify("ctx.host.runCommand indisponível para gerenciar issues.");
            return;
          }
          try {
            const rawOut = await host.runCommand(
              "orgfy-controle-write",
              JSON.stringify({
                kind: "issue_action",
                tenant,
                repoId: liveRepo?.dtag || status.tenantManifest?.repoId || tenant,
                repoOwner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER,
                issueId: targetItem.id,
                action: req.action,
                executorName: req.executorName,
                executorPubkey: req.executorPubkey,
              })
            );
            const parsed = rawOut ? JSON.parse(rawOut) : { ok: false };
            if (!parsed?.ok) {
              notify(`Falha ao ${req.action === "reassign" ? "reatribuir" : "atualizar"} issue: ${parsed?.error || "erro desconhecido"}`);
              return;
            }
            if (req.action === "resolve" || req.action === "close") {
              setSelectedItem(null);
              notify(
                req.action === "resolve"
                  ? `Issue #${targetItem.id.slice(0, 8)} marcada como concluída${parsed.relayOk ? " (relay + board)" : " (board local)"} ✓`
                  : `Issue #${targetItem.id.slice(0, 8)} fechada e removida da fila${parsed.relayOk ? " (relay + board)" : " (board local)"} ✓`
              );
            } else {
              notify(`Executor de #${targetItem.id.slice(0, 8)} alterado para ${req.executorName}${parsed.relayOk ? " (relay + board)" : " (board local)"} ✓`);
            }
            await refresh(tenant, false, false);
          } catch (err: any) {
            notify(`Erro ao atualizar issue: ${err?.message || err}`);
          }
        },
        onEscalateItem: async (targetItem: FactoryWorkItem, target: "coo" | "ceo_empresa" | "iris" | "review_l01") => {
          const targetName =
            target === "iris"
              ? holding?.ceoHolding?.nome || "OrgFy Iris"
              : target === "review_l01"
              ? Object.values(status.tenantManifest?.revisoresPorSuperficie || {})[0] || "OrgFy Teo"
              : status.tenantManifest?.coo || "OrgFy Bento";
          const ag =
            tenantAgents.find((a) => a.name.toLowerCase() === targetName.toLowerCase()) ||
            liveCrew.find((a) => a.name.toLowerCase().includes(targetName.toLowerCase()));
          const agentKey = (ag && "agentKey" in ag ? ag.agentKey : ag?.key) || "";
          const actionLabel =
            target === "iris"
              ? "ESCALADA CEO HOLDING (Iris)"
              : target === "review_l01"
              ? "SOLICITAÇÃO DE REVISÃO L-01 / GATE"
              : "TRATAMENTO OPERACIONAL COO";
          const msg = [
            `@${targetName} [${actionLabel} · ${tenant}]`,
            `- **Item:** #${targetItem.id.slice(0, 8)} — ${targetItem.title}`,
            targetItem.reason ? `- **Motivo / Quarentena:** ${targetItem.reason}` : "",
            targetItem.note ? `- **Contexto:** ${targetItem.note}` : "",
            target === "coo"
              ? "Avalie o erro/quarentena na esteira, resolva ou escale para a CEO da empresa / OrgFy Iris se exigir decisão de negócio."
              : target === "review_l01"
              ? "Execute a revisão independente L-01 e emita o veredito do GATE."
              : "Item escalado pela cadeia OrgFy para avaliação da CEO da Holding.",
          ]
            .filter(Boolean)
            .join("\n");
          const res = await wakeAgentInBuzz({
            agentKey,
            agentName: targetName,
            pubkey: ag?.pubkey,
            preferDm: true,
            postInChat: true,
            text: msg,
          });
          if (res.ok && res.channel && openSideTabRef.current) {
            try { openSideTabRef.current({ channelId: res.channel }, { keep: true }); } catch {}
          }
          notify(res.ok ? `Encaminhado para ${targetName} no Buzz ✓` : `Falha ao encaminhar para ${targetName}: ${res.error}`);
        },
        onClose: () => setSelectedItem(null),
      }),
      renderAgentProfileDrawer({
        h,
        agent: liveCrew.find((a) => a.key === selectedAgentKey) || null,
        liveTurn: (() => {
          const ag = liveCrew.find((a) => a.key === selectedAgentKey);
          return ag?.pubkey ? telemetry.byPubkey[ag.pubkey.toLowerCase()] || null : null;
        })(),
        TranscriptComponent: (ctx as any)?.agents?.ui?.Transcript,
        channelId: status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null,
        onOpenDm: handleOpenAgentDmInBuzz,
        onSessionAction: handleAgentSessionAction,
        onClose: () => setSelectedAgentKey(null),
      }),
      renderCommandPalette(
        {
          h,
          collapsed: sidebarCollapsed,
          onToggleCollapse: toggleSidebarCollapsed,
          paletteOpen,
          onSetPaletteOpen: (open) => {
            setPaletteOpen(open);
            if (!open) setPaletteQuery("");
          },
          tab,
          onSelectTab: setTab,
          tenant,
          onSelectTenant: (slug, targetTab) => {
            setTenant(slug);
            if (targetTab) setTab(targetTab);
          },
          workspaces,
          expandedProjects,
          onToggleProject: () => {},
          status,
          telemetry,
          masterAgentName,
          masterAgentPubkey: masterLive?.pubkey || holding?.ceoHolding?.pubkey || "",
          masterTurn,
          pendingApprovals,
          inboxCount,
          urgentInbox: pendingApprovals > 0 || status.held.length > 0,
          waitingItems: [],
          onOpenMasterDm: () =>
            handleOpenAgentDmInBuzz(
              masterLive || { name: masterAgentName, pubkey: holding?.ceoHolding?.pubkey || "" }
            ),
          onOpenAgentDm: handleOpenAgentDmInBuzz,
          onOpenChannelInBuzz: handleOpenChannelInBuzz,
          onSelectItem: setSelectedItem,
          onOpenTurnInSideChat: handleOpenTurnInSideChat,
          onRefresh: () => refresh(tenant),
          onToggleDrain: () =>
            handleControlUpdate(
              { drain: !status.drain },
              status.drain ? "Dreno cancelado." : "Modo Dreno ativado (finaliza os itens em andamento)."
            ),
          onToggleKillSwitch: (next) =>
            handleControlUpdate(
              { killSwitch: next, pausedReason: next ? "Kill Switch acionado pelo operador" : null },
              next ? "Kill Switch ativado imediatamente." : "Kill Switch liberado."
            ),
          compactDensity,
          onToggleDensity: () => setCompactDensity((v) => !v),
          liveCrew,
        } as FactorySidebarProps,
        paletteQuery,
        setPaletteQuery
      ),
      autonomyModal?.open &&
        (() => {
          const targetMode = autonomyModal.targetMode;
          const isFactoryTarget = targetMode === "software_factory" || targetMode === "dark_factory";
          const hasRepo = Boolean(status.tenantManifest?.repoId || tenant);
          const hasVision = Boolean((channelCanvas && channelCanvas.trim().length > 0) || (status.orgfyVision?.projectMd && status.orgfyVision.projectMd.trim().length > 0));
          const hasBudget = Number(settingsForm.gastoDiaUsd || 0) > 0;
          const existingTpls = new Set(automations.map((a) => a.templateId).filter(Boolean));
          const missingStarterCount = ORGFY_AUTOMATION_TEMPLATES.filter((t) => t.starter && !existingTpls.has(t.id)).length;
          const canConfirm = !isFactoryTarget || (hasRepo && hasBudget);
          return h(
            "div",
            {
              className: "of-sheet-backdrop",
              "data-orgfy-autonomy-modal": "true",
              style: { alignItems: "center", justifyContent: "center", padding: "20px" },
              onClick: (e: any) => {
                if (e.target === e.currentTarget) setAutonomyModal(null);
              },
            },
            h(
              "div",
              {
                className: "of-card-pad",
                role: "dialog",
                "aria-modal": "true",
                "aria-label": `Ativar modo ${PT_BR.modes[targetMode] || targetMode}`,
                style: {
                  width: "min(560px, 94vw)",
                  maxHeight: "88vh",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" } },
                h(
                  "div",
                  null,
                  h("div", { style: { fontSize: "15px", fontWeight: 700 } }, `Ativar ${PT_BR.modes[targetMode] || targetMode} · ${empresaNome}`),
                  h("div", { className: "of-muted", style: { fontSize: "12px", marginTop: "3px" } }, "Revise os pré-requisitos e escolha o nível de automação antes de aplicar em controle-" + tenant + ".json.")
                ),
                h("button", { type: "button", className: "of-btn", style: { padding: "3px 9px" }, onClick: () => setAutonomyModal(null) }, "×")
              ),
              isFactoryTarget
                ? h(
                    "div",
                    { className: "of-surface", style: { padding: "12px", display: "flex", flexDirection: "column", gap: "8px" } },
                    h("div", { className: "of-meter-label" }, "Pré-requisitos da Fábrica"),
                    [
                      { ok: hasRepo, label: `Repositório & manifesto configurados (repo: ${empresaRepo})` },
                      { ok: hasVision, label: hasVision ? "Visão / Canvas carregado para orientar agentes e Oráculo" : "Visão / Canvas ainda vazio (recomendado preencher na aba Canvas / Visão)" },
                      { ok: hasBudget, label: `Orçamento diário ativo (US$ ${settingsForm.gastoDiaUsd}/dia · máx ${settingsForm.mergesDia} merges/dia)` },
                    ].map((req, idx) =>
                      h(
                        "div",
                        { key: idx, style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" } },
                        h("span", { className: "of-pill", "data-tone": req.ok ? "done" : "waiting", style: { fontSize: "10px", padding: "1px 6px" } }, req.ok ? "✓" : "!"),
                        h("span", null, req.label)
                      )
                    )
                  )
                : h(
                    "div",
                    { className: "of-surface", style: { padding: "12px", fontSize: "12px", lineHeight: 1.5 } },
                    targetMode === "manual"
                      ? "No modo Manual, o coordenador pausa automações agendadas, despachos automáticos e auto-merge. Você conduz cada passo manualmente."
                      : "No modo Assistido, o COO e as automações continuam encontrando e preparando trabalho, mas todo merge na main exige sua aprovação (GATE humano)."
                  ),
              isFactoryTarget &&
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                  h(
                    "label",
                    {
                      className: "of-surface",
                      style: {
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        borderColor: autonomyModal.autoMerge ? "var(--primary)" : undefined,
                      },
                    },
                    h("input", {
                      type: "checkbox",
                      checked: autonomyModal.autoMerge,
                      style: { marginTop: "2px" },
                      onChange: (e: any) => setAutonomyModal((prev) => (prev ? { ...prev, autoMerge: Boolean(e.target.checked) } : prev)),
                    }),
                    h(
                      "div",
                      null,
                      h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, "Habilitar Auto-merge agora"),
                      h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "2px", lineHeight: 1.4 } }, "Permite que a esteira integre PRs aprovados (CI + Revisor L-01) automaticamente. Áreas protegidas (CI/runner/segurança) e regra L-01 continuam exigindo GATE humano.")
                    )
                  ),
                  h(
                    "label",
                    {
                      className: "of-surface",
                      style: {
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "10px 12px",
                        cursor: missingStarterCount > 0 ? "pointer" : "default",
                        opacity: missingStarterCount > 0 ? 1 : 0.7,
                        borderColor: autonomyModal.enableStarterSet && missingStarterCount > 0 ? "var(--primary)" : undefined,
                      },
                    },
                    h("input", {
                      type: "checkbox",
                      checked: autonomyModal.enableStarterSet && missingStarterCount > 0,
                      disabled: missingStarterCount === 0,
                      style: { marginTop: "2px" },
                      onChange: (e: any) => setAutonomyModal((prev) => (prev ? { ...prev, enableStarterSet: Boolean(e.target.checked) } : prev)),
                    }),
                    h(
                      "div",
                      null,
                      h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, missingStarterCount > 0 ? `Ativar Starter Set de automações (${missingStarterCount} templates)` : "Starter Set de automações já instalado"),
                      h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "2px", lineHeight: 1.4 } }, "Adiciona e liga as rotinas iniciais (Segurança, Dependências, Cobertura de Testes, PRs parados). Triagem duplicada é pulada automaticamente em modo fábrica.")
                    )
                  )
                ),
              h(
                "div",
                { style: { display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "6px", borderTop: "1px solid var(--border)" } },
                h("button", { type: "button", className: "of-btn", onClick: () => setAutonomyModal(null) }, "Cancelar"),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    disabled: !canConfirm,
                    onClick: async () => {
                      const chosen = autonomyModal;
                      if (!chosen) return;
                      const nextAutoMerge = isFactoryTarget ? chosen.autoMerge : false;
                      setAutonomyModal(null);
                      setSettingsForm({ mode: chosen.targetMode, autoMerge: nextAutoMerge });
                      await handleControlUpdate(
                        { mode: chosen.targetMode, autoMerge: nextAutoMerge },
                        `Modo ${PT_BR.modes[chosen.targetMode]} ativado (auto-merge ${nextAutoMerge ? "ligado" : "desligado"}).`
                      );
                      if (isFactoryTarget && chosen.enableStarterSet && missingStarterCount > 0) {
                        handleAddStarterSet();
                      }
                    },
                  },
                  `Confirmar e ativar ${PT_BR.modes[targetMode] || targetMode}`
                )
              )
            )
          );
        })(),
      guideOpen &&
        h(
          "div",
          {
            className: "of-sheet-backdrop",
            "data-orgfy-factory-guide": "true",
            "data-guide-docked": "right",
            onClick: (e: any) => {
              if (e.target === e.currentTarget) setGuideOpen(false);
            },
          },
          h(
            "aside",
            {
              className: "of-sheet-panel",
              role: "complementary",
              "aria-label": "Como funciona o loop da Fábrica OrgFy",
              style: {
                width: "min(640px, 95vw)",
                padding: 0,
                gap: 0,
                overflow: "hidden",
              },
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                },
              },
              h(
                "div",
                null,
                h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Como funciona o loop da Fábrica OrgFy"),
                h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, "Fábrica de Software e Dark Factory passo a passo (L-01, L-22, WIP e Kill Switch)")
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  style: { padding: "4px 10px", fontSize: "12px" },
                  onClick: () => setGuideOpen(false),
                },
                "×"
              )
            ),
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "210px 1fr", flex: 1, minHeight: 0, overflow: "hidden" } },
              h(
                "nav",
                {
                  style: {
                    borderRight: "1px solid var(--border)",
                    padding: "12px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    overflowY: "auto",
                    background: "rgba(0,0,0,0.14)",
                  },
                },
                [
                  { id: "loop", label: "1. O loop da fábrica" },
                  { id: "pipelines", label: "2. Raias e L-01 / L-22" },
                  { id: "merge", label: "3. Fila de merge & CI" },
                  { id: "slots", label: "4. Slots de agentes & WIP" },
                  { id: "modes", label: "5. Modos de autonomia" },
                  { id: "controls", label: "6. Kill Switch & Dreno" },
                ].map((sec) =>
                  h(
                    "button",
                    {
                      key: sec.id,
                      type: "button",
                      onClick: () => setGuideSection(sec.id),
                      style: {
                        textAlign: "left",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "none",
                        background: guideSection === sec.id ? "var(--affordance-selected, rgba(255,255,255,0.08))" : "transparent",
                        color: guideSection === sec.id ? "var(--foreground)" : "var(--muted-foreground)",
                        fontSize: "12px",
                        fontWeight: guideSection === sec.id ? 600 : 400,
                        cursor: "pointer",
                      },
                    },
                    sec.label
                  )
                )
              ),
              h(
                "div",
                { style: { padding: "18px 20px", overflowY: "auto", fontSize: "12.5px", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "12px" } },
                guideSection === "loop" &&
                  h(
                    React.Fragment,
                    null,
                    h(
                      "p",
                      { style: { margin: 0, color: "var(--muted-foreground)" } },
                      "O coordenador (Porteiro) executa ciclos contínuos sobre o relay NIP-34 do Buzz e o repositório Git, respeitando imediatamente os controles em ",
                      h("code", { className: "of-mono" }, `estado/controle-${tenant}.json`),
                      "."
                    ),
                    h(
                      "pre",
                      {
                        className: "of-mono",
                        style: {
                          margin: 0,
                          padding: "14px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "rgba(0,0,0,0.28)",
                          fontSize: "11px",
                          lineHeight: 1.5,
                          overflowX: "auto",
                        },
                      },
                      [
                        "Issue NIP-34 (você, COO ou Oráculo)",
                        "   │",
                        "   ▼",
                        "Triagem & Card-Lint (L-01 + L-22 + Escrita Exclusiva)",
                        "   │ aguarda slot livre (WIP / agentes simultâneos)",
                        "   ▼",
                        "┌─────────────────────────────────────────────┐",
                        "│ Executor trabalha em worktree Git isolada   │",
                        "│ TDD RED → GREEN + atualiza Checklist P1..Pn │",
                        "└─────────────────────────────────────────────┘",
                        "   │ abre PR NIP-34",
                        "   ▼",
                        "Revisão Cross-Provider (L-01) + CI isolado ◄──┐",
                        "   │ GATE: recusado → Executor corrige ───────┘",
                        "   ▼ GATE: aceito + checks verdes",
                        "Merge na main (Fast ou Strict) + Watchdog CI",
                      ].join("\n")
                    )
                  ),
                guideSection === "pipelines" &&
                  h(
                    React.Fragment,
                    null,
                    h("h4", { style: { margin: 0, fontSize: "13.5px" } }, "Raias Determinísticas & Invariantes"),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• L-01 (Cross-Provider): o agente revisor nunca é o executor, garantindo revisão independente."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• L-22 (Aceite Congelado): o comando de aceite do card é protegido por SHA-256; o executor não pode afrouxar testes."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Escrita Exclusiva: o despacho impede dois agentes editando o mesmo arquivo simultaneamente (WRITE_SET_CONFLICT).")
                  ),
                guideSection === "merge" &&
                  h(
                    React.Fragment,
                    null,
                    h("h4", { style: { margin: 0, fontSize: "13.5px" } }, "Fila de Merge & Políticas"),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Strict (padrão): re-executa o CI já sobre a main antes de concluir o merge, bloqueando regressões."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Fast: confia no CI aprovado do PR quando não há conflito de rebase."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Watchdog pós-merge: se a main quebrar após integração, dispara alerta e pausa a esteira automaticamente.")
                  ),
                guideSection === "slots" &&
                  h(
                    React.Fragment,
                    null,
                    h("h4", { style: { margin: 0, fontSize: "13.5px" } }, "Slots de Agentes, WIP & Orçamento"),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, `Limites ativos de ${empresaNome}: WIP máx ${status.wip.limit} PRs abertos · ${status.limits.maxConcurrentSessions} agentes simultâneos · ${status.limits.maxMergesPerDay} merges/dia · orçamento US$ ${status.limits.dailyBudget.usd}/dia.`),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "Você pode ajustar esses valores a qualquer momento na aba Configurações — eles são gravados diretamente em controle-<empresa>.json.")
                  ),
                guideSection === "modes" &&
                  h(
                    React.Fragment,
                    null,
                    h("h4", { style: { margin: 0, fontSize: "13.5px" } }, "Modos de Autonomia"),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Manual: você conduz cada despacho e revisão."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Assistido: COO e automações preparam trabalho; você revisa e integra."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Fábrica de Software: issues confiáveis entram nas raias com worktrees isoladas, CI e Revisor L-01."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Dark Factory: adiciona o Oráculo (Scout) auditando continuamente o workspace contra o Canvas/Visão e abrindo novas issues.")
                  ),
                guideSection === "controls" &&
                  h(
                    React.Fragment,
                    null,
                    h("h4", { style: { margin: 0, fontSize: "13.5px" } }, "Kill Switch & Modo Dreno"),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Kill Switch: para imediatamente novos despachos e merges no próximo ciclo do coordenador."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Modo Dreno: não inicia novas issues, mas deixa os PRs que já estão em execução/revisão concluírem com segurança."),
                    h("p", { style: { margin: 0, color: "var(--muted-foreground)" } }, "• Clique em qualquer bonequinho no Andar 3D para inspecionar o turno ao vivo e abrir o chat lateral nativo do Buzz com aquele agente.")
                  )
              )
            )
          )
        )
    );

    if (useNativeSideTabs) {
      return h(NativeTabs, {
        id: "orgfy-factory",
        session: relaySnap.session,
        scope: relaySnap.scope,
        label: PT_BR.appTitle,
        children: (open: any) => {
          openSideTabRef.current = open;
          return pageContent;
        },
      });
    }

    openSideTabRef.current = null;
    return pageContent;
  };
}
