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
import { renderFactorySecondaryPage } from "./FactoryPages";
import {
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
  loadBuzzChannelLiveInfo,
  navigateToBuzzChannel,
  resolveBuzzNavigationScope,
  runBuzzChannelDiagnosticAction,
  saveBuzzChannelDetailsLive,
  type BuzzChannelLiveInfo,
} from "../services/buzz-channel-live";
import { openIssueInBuzz, openSystemUri } from "../services/orgfy-bridge";
import { fetchHoldingControlPlane, type HoldingControlPlaneSnapshot } from "../services/holding-service";
import { executeCardProgress } from "../services/card-progress";
import { renderCommandPalette, renderFactorySidebar, type FactorySidebarProps } from "./FactorySidebar";
import { buildDefaultAutomations, exportAutomationToBuzzWorkflowYaml, type OrgfyAutomation } from "./AutomationEditor";

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

const GLOBAL_TABS = new Set<FactoryTab>(["holding", "inbox", "costs", "automations"]);

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
  const CodeDenInspectorDrawer = createCodeDenInspectorDrawer(React);

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
    const [runningAutomationId, setRunningAutomationId] = React.useState<string | null>(null);
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

    // Lê Canvas ao vivo + histórico (session.canvas.read/history), metadados do canal (session.channels/channelDetails) e Buzz Repos NIP-34
    React.useEffect(() => {
      let cancelled = false;
      const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null;
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
      loadLiveRepoSnapshot(ctx, { channelId: canal, dtag })
        .then((snap) => {
          if (!cancelled && snap.available) setLiveRepo(snap);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [tenant, status.tenantManifest?.canal, status.tenantManifest?.repoId, holding, relayTick, activityTick]);

    // Ao abrir um card no ItemSheetDrawer, carrega conteúdo NIP-34, comentários e diff Git via Buzz Repos
    React.useEffect(() => {
      let cancelled = false;
      if (!selectedItem || !/^[0-9a-f]{64}$/i.test(selectedItem.id || "")) {
        setSelectedItemDetail(null);
        setSelectedItemDetailLoading(false);
        return;
      }
      setSelectedItemDetailLoading(true);
      const isPr = String(selectedItem.workKey || "").startsWith("pr:");
      loadLiveRepoEntityDetail(ctx, {
        type: isPr ? "pr" : "issue",
        owner: liveRepo?.owner || DEFAULT_ORGFY_REPO_OWNER,
        dtag: liveRepo?.dtag || status.tenantManifest?.repoId || tenant,
        id: selectedItem.id,
      })
        .then((det) => {
          if (!cancelled) {
            setSelectedItemDetail(det);
            setSelectedItemDetailLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSelectedItemDetail(null);
            setSelectedItemDetailLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [selectedItem?.id, liveRepo?.owner, liveRepo?.dtag, tenant]);

    // Estados das páginas
    const [scorecardView, setScorecardView] = React.useState<"builders" | "reviewers" | "pairs">("builders");
    const [scorecardDays, setScorecardDays] = React.useState<7 | 30 | 90>(30);
    const [storeyFocus, setStoreyFocus] = React.useState<"workshop" | "lookout" | "both">("both");
    const [selectedAgentKey, setSelectedAgentKey] = React.useState<string | null>(null);
    const [inboxFilter, setInboxFilter] = React.useState<"all" | "asks" | "reviews" | "problems">("all");
    const [costRange, setCostRange] = React.useState<"7d" | "30d" | "90d">("30d");
    const [autoTab, setAutoTab] = React.useState<"automations" | "runs" | "templates">("automations");
    const [agentTab, setAgentTab] = React.useState<"eval" | "memory" | "skills" | "mcp" | "hooks">("memory");

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

    const refresh = React.useCallback(
      async (targetTenant = tenant, forceSettingsSync = false, silent = false) => {
        if (!silent) setLoading(true);
        const [res, holdSnap] = await Promise.all([
          fetchFactoryStatus(ctx, targetTenant),
          fetchHoldingControlPlane(ctx).catch(() => null),
        ]);
        setStatus(res.status);
        setError(res.error);
        if (holdSnap) setHolding(holdSnap);
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
        if (!silent) setLoading(false);
      },
      [tenant]
    );

    React.useEffect(() => {
      settingsDirtyRef.current = false;
      let disposed = false;
      const run = () => {
        if (!disposed) refresh(tenant, false, true);
      };
      refresh(tenant, true, false);
      const timer = setInterval(run, 5000);
      const unsub = subscribeRelayUpdates(() => run());
      return () => {
        disposed = true;
        clearInterval(timer);
        unsub();
      };
    }, [tenant, refresh]);

    const handleControlUpdate = React.useCallback(
      async (patch: Parameters<typeof writeTenantControl>[2], message: string) => {
        const res = await writeTenantControl(ctx, tenant, patch);
        if (res.ok) {
          settingsDirtyRef.current = false;
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
          const okDirect = await openBuzzRepoEntity(ctx, { type: isPr ? "pr" : "issue", owner, dtag, id: item.id }).catch(() => false);
          const ok = okDirect || (await openIssueInBuzz(ctx, { id: item.id, owner, dtag }).catch(() => false));
          notify(ok ? `${isPr ? "PR" : "Issue"} #${item.id.slice(0, 8)} aberto direto no Buzz Repos.` : `Deep link preparado para #${item.id.slice(0, 8)}.`);
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

    const handleSaveCanvas = React.useCallback(async () => {
      const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null;
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
    }, [status.tenantManifest, holding, tenant, canvasDraft, canvasEventId, notify]);

    const handleReloadCanvas = React.useCallback(async () => {
      const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null;
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
    }, [status.tenantManifest, holding, tenant, notify]);

    const handleSaveChannelDetails = React.useCallback(async () => {
      const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null;
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
    }, [status.tenantManifest, holding, tenant, channelInfo, channelDetailsDraft, notify]);

    const handleChannelDiagnostic = React.useCallback(async (action: "markRead" | "markUnread" | "refresh") => {
      const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || null;
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
      const emp = holding?.empresas.find((e) => e.slug === slug);
      const canal = (slug === tenant ? status.tenantManifest?.canal : null) || emp?.canal;
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
    }, [holding, status.tenantManifest, tenant, notify]);

    const handleOpenChannelFullPage = React.useCallback(async (opts?: { panel?: "members" }) => {
      const emp = holding?.empresas.find((e) => e.slug === tenant);
      const canal = status.tenantManifest?.canal || emp?.canal;
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

    const tenantAgents = status.tenantManifest?.agentes || [];

    // Mapa pubkey -> nome amigável para enriquecer a telemetria ao vivo do Buzz
    const nameByPubkey = React.useMemo(() => {
      const map = new Map<string, string>();
      for (const a of liveCrew) {
        if (a.pubkey) map.set(a.pubkey.toLowerCase(), a.name);
      }
      for (const a of tenantAgents) {
        if (a.pubkey) map.set(a.pubkey.toLowerCase(), a.name);
      }
      return map;
    }, [liveCrew, tenantAgents]);

    // Snapshot ao vivo de session.agentActivity + session.presence + session.unread
    const telemetry = React.useMemo(
      () => readBuzzLiveTelemetry(ctx, nameByPubkey),
      [nameByPubkey, activityTick, relayTick, status.lastTickAt]
    );

    const handleOpenTurnInSideChat = React.useCallback(
      (turn: LiveAgentTurn) => {
        if (turn.channelId && openSideTabRef.current) {
          const ok = openSideTabRef.current(
            { channelId: turn.channelId, threadId: turn.threadRootId, messageId: turn.messageId },
            { keep: true }
          );
          if (ok) {
            notify(`Conversa de ${turn.agentName} aberta na barra lateral.`);
            return;
          }
        }
        notify(`Não foi possível abrir o chat lateral de ${turn.agentName}.`);
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
      const winners = new Set([
        "claude-sonnet-5-5",
        "claude-sonnet-4-6",
        "gemini-2.5-flash",
      ]);
      const targets = tenantAgents.filter(
        (a) => a.inBuzz && a.agentKey && !winners.has(String(a.model || "").split("/").pop() || "")
      );
      if (targets.length === 0) {
        notify("Todos os agentes provisionados já estão em modelos aprovados no Eval R5.1.");
        return;
      }
      const freshAgents = ((agentsApi.snapshot?.()?.agents || []) as any[]);
      let updated = 0;
      let firstError = "";
      for (const ag of targets) {
        const papel = String(ag.papel || "").toLowerCase();
        const isTier1 = /(ceo|coo|revis|arquit|segur|secur|qa|oraculo|conselho|board)/.test(papel);
        const provider = isTier1 ? "nexusmind_anthropic" : "nexusmind_antigravity";
        const model = isTier1 ? "claude-sonnet-5-5" : "gemini-2.5-flash";
        const fresh = freshAgents.find((c: any) => c?.key === ag.agentKey) || liveCrew.find((c) => c.key === ag.agentKey);
        const baseCfg = fresh?.config && typeof fresh.config === "object" ? fresh.config : {};
        try {
          // Omite `base` para que o Buzz resolva automaticamente `editorConfig().base`
          // (passar `configBase` vazio `{}` causa erro "config isn't synced here yet").
          await agentsApi.save(ag.agentKey, {
            config: { ...baseCfg, provider, model },
          });
          updated += 1;
        } catch (err: any) {
          if (!firstError) firstError = err?.message || String(err);
        }
      }
      notify(
        updated > 0
          ? `${updated}/${targets.length} agente(s) reconciliado(s) para os vencedores do Eval R5.1 via ctx.agents.save().`
          : `Nenhum agente pôde ser atualizado${firstError ? `: ${firstError}` : " via ctx.agents.save()."}`
      );
      await refresh(tenant);
    }, [tenantAgents, liveCrew, tenant, notify, refresh]);

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

    // Abre o Perfil NATIVO do agente no Buzz Desktop (Identity | Memory | Activity | Bestie | Attention | OrgFy | Settings)
    const handleOpenNativeAgentProfile = React.useCallback(
      async (target?: { key?: string; pubkey?: string; name?: string } | string | null) => {
        const resolved =
          typeof target === "string"
            ? liveCrew.find((a) => a.key === target) ||
              tenantAgents.find((a) => a.agentKey === target)
            : target;
        const rawPubkey =
          (resolved && "pubkey" in resolved ? resolved.pubkey : "") ||
          (resolved && "key" in resolved && resolved.key
            ? liveCrew.find((a) => a.key === resolved.key)?.pubkey || ""
            : "") ||
          "";
        const pubkey = String(rawPubkey).trim().toLowerCase();
        const agentName = (resolved && "name" in resolved ? resolved.name : "") || "Agente";
        const scope = resolveBuzzScope();
        if (/^[0-9a-f]{64}$/.test(pubkey) && (ctx as any)?.navigation?.open) {
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
        if (resolved && "key" in resolved && resolved.key) {
          setSelectedAgentKey(resolved.key);
        } else {
          notify(`Pubkey de ${agentName} indisponível para abrir o perfil nativo.`);
        }
      },
      [liveCrew, tenantAgents, resolveBuzzScope, notify]
    );

    // Dispara auditoria one-shot do Oráculo (Scout) via ctx.agents.wake
    const handleRunScoutNow = React.useCallback(async () => {
      const agentsApi = (ctx as any)?.agents;
      if (typeof agentsApi?.wake !== "function") {
        notify("API ctx.agents.wake indisponível nesta versão do Buzz.");
        return;
      }
      const scoutTenant = tenantAgents.find((a) => a.papel === "oraculo" || /or[aá]culo|scout/i.test(a.name));
      const scoutLive = liveCrew.find((a) => a.key === scoutTenant?.agentKey || /or[aá]culo|scout/i.test(a.name));
      const agentKey = scoutTenant?.agentKey || scoutLive?.key;
      if (!agentKey) {
        notify(`Nenhum agente Oráculo/Scout encontrado em ${tenant}.`);
        return;
      }
      const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || undefined;
      setRunningScout(true);
      try {
        await agentsApi.wake(agentKey, {
          ...(canal ? { channelId: canal } : {}),
          text: `[ORGFY SCOUT ONE-SHOT · ${tenant}] Audite o workspace atual contra o Canvas/Visão da empresa, identifique gaps de maior impacto (segurança, testes, UX ou dívida técnica) e proponha os próximos cards canônicos.`,
        });
        notify(`${scoutTenant?.name || scoutLive?.name || "Oráculo"} acionado via ctx.agents.wake.`);
      } catch (err: any) {
        notify(`Falha ao acionar Oráculo: ${err?.message || err}`);
      } finally {
        setRunningScout(false);
      }
    }, [tenantAgents, liveCrew, tenant, status.tenantManifest, holding, notify]);

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
          if (typeof host?.writeFile === "function") {
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

    const handleCreateAutomation = React.useCallback(() => {
      const newId = `auto-${Date.now().toString(36)}`;
      const item: OrgfyAutomation = {
        id: newId,
        name: "Nova automação",
        description: "Rotina personalizada da OrgFy Factory.",
        scope: "project",
        enabled: true,
        triggerKind: "schedule",
        frequency: "daily",
        dayOfWeek: 1,
        timeHHMM: "09:00",
        timezone: "America/Sao_Paulo",
        eventKind: "pr_opened",
        actionKind: "agent_session",
        targetAgent: tenantAgents[0]?.name || "OrgFy Bento",
        prompt: `Execute esta rotina em {{project.name}} ({{date}}).`,
        recentRuns: [],
      };
      setAutomations((prev) => [item, ...prev]);
      setSelectedAutomationId(newId);
    }, [tenantAgents]);

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
        const agentsApi = (ctx as any)?.agents;
        const targetAg =
          tenantAgents.find((a) => a.name.toLowerCase() === auto.targetAgent.toLowerCase()) ||
          liveCrew.find((a) => a.name.toLowerCase() === auto.targetAgent.toLowerCase());
        const agentKey = (targetAg && "agentKey" in targetAg ? targetAg.agentKey : targetAg?.key) || "";
        const canal = status.tenantManifest?.canal || holding?.empresas.find((e) => e.slug === tenant)?.canal || undefined;
        let statusRun: "ok" | "error" = "ok";
        let detail = `Disparado para ${auto.targetAgent} via Buzz.`;
        try {
          if (typeof agentsApi?.wake === "function" && agentKey) {
            await agentsApi.wake(agentKey, {
              ...(canal ? { channelId: canal } : {}),
              text: `[ORGFY AUTOMATION · ${auto.name}]\n${resolvedPrompt}`,
            });
          } else {
            statusRun = "error";
            detail = "ctx.agents.wake indisponível ou agente não provisionado.";
          }
        } catch (err: any) {
          statusRun = "error";
          detail = err?.message || String(err);
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
      [tenant, status.tenantManifest, holding, tenantAgents, liveCrew, persistAutomations, notify]
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

    const activeWorkspace = workspaces.find((w) => w.slug === tenant) || workspaces[0];
    const empresaNome = status.tenantManifest?.nome || activeWorkspace?.nome || tenant;
    const empresaRepo = status.tenantManifest?.repoId || tenant;
    const isGlobalView = GLOBAL_TABS.has(tab);

    const pendingApprovals = (holding?.approvals || []).filter((a) => a.status === "pendente").length;
    const abaixoMinimoCount = (status.modelos || []).filter((m) => m.abaixo_minimo).length;
    const inboxCount =
      status.held.length +
      [...status.inProgress, ...status.recent].filter((i) => i.stage === "escalated" || i.stage === "failed" || i.stage === "reverted").length;

    // Contagem REAL de agentes respondendo agora nesta empresa (via session.agentActivity!)
    const tenantWorkingNowCount = tenantAgents.filter((a) => Boolean(a.pubkey && telemetry.byPubkey[a.pubkey.toLowerCase()])).length;
    const tenantTotalAgentsCount = tenantAgents.length;
    const boardCount = status.backlog.length + status.inProgress.length;

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
      { id: "overview", label: PT_BR.nav.overview },
      { id: "board", label: "Fábrica · Board", badge: String(boardCount) },
      {
        id: "floor",
        label: "Andar 3D",
        badge: tenantWorkingNowCount > 0 ? `${tenantWorkingNowCount}/${tenantTotalAgentsCount}` : String(tenantTotalAgentsCount),
        tone: tenantWorkingNowCount > 0 ? "warn" : undefined,
      },
      { id: "agents", label: "Agentes", badge: abaixoMinimoCount > 0 ? `⚠ ${abaixoMinimoCount}` : String(tenantTotalAgentsCount), tone: abaixoMinimoCount > 0 ? "danger" : undefined },
      { id: "vision", label: "Canvas / Visão" },
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
        },
      },
      h("style", { "data-orgfy-factory-inline-fallback": "true" }, FACTORY_SHADOW_CSS),
      h(
        "div",
        {
          className: "of-shell",
          "data-collapsed": sidebarCollapsed ? "true" : "false",
          "data-density": compactDensity ? "compact" : "default",
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
            waitingItems: [
              ...status.held,
              ...[...status.inProgress, ...status.recent].filter(
                (i) => i.stage === "escalated" || i.stage === "failed" || i.stage === "reverted"
              ),
            ],
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
                  telemetry.activeTurns.length > 0 &&
                    h(
                      "span",
                      { className: "of-pill", "data-tone": "running", title: "Turnos ativos em tempo real via session.agentActivity" },
                      `⚡ ${telemetry.activeTurns.length} respondendo`
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
                    status,
                    telemetry,
                    workingNowCount: tenantWorkingNowCount,
                    onOpenTurnInSideChat: handleOpenTurnInSideChat,
                    onInterruptTurn: handleInterruptTurn,
                    onOpenAgentDm: handleOpenAgentDmInBuzz,
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
                  })
                : tab === "board" || tab === "floor"
                ? renderFactoryBoardAndFloor({
                    h,
                    tenant,
                    status,
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
                    status,
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
                    onSelectModeQuick: (mode) =>
                      handleControlUpdate({ mode }, `Modo alterado para ${PT_BR.modes[mode]}.`),
                    onOpenChannelInBuzz: handleOpenChannelInBuzz,
                    onOpenChannelFullPage: handleOpenChannelFullPage,
                    onOpenBuzzLink: handleOpenBuzzLink,
                    Boardroom3D,
                    onReconcileAgents: handleReconcileAgentsR51,
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
                    runningAutomationId,
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
        repoDtag: liveRepo?.dtag || tenant,
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
