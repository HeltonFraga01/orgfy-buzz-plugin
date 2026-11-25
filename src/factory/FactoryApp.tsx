// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/shell/app-shell.tsx e routes/project.tsx
// Shell nativo do Buzz para a OrgFy Factory: Sidebar global (CEO Master, Conselho, Inbox, Custos, Automações, Empresas) + Menu Superior com abas por Empresa e DM nativa do Buzz.

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
import { renderFactoryBoardAndFloor, renderItemSheetDrawer, type LiveCrewAgent } from "./FactoryBoardAndFloor";
import { createFloor3DComponent } from "./codeden-floor/Floor3DCanvas";
import { renderFactorySecondaryPage } from "./FactoryPages";
import { subscribeRelayUpdates } from "../services/buzz-native";
import { openIssueInBuzz, openSystemUri } from "../services/orgfy-bridge";
import { fetchHoldingControlPlane, type HoldingControlPlaneSnapshot } from "../services/holding-service";

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
  { slug: "orgfy", nome: "OrgFy Core", estagio: "operacional" },
  { slug: "lumen-iptv", nome: "Lumen IPTV", estagio: "operacional" },
  { slug: "saas-tributario", nome: "SaaS Tributário", estagio: "planejado" },
];

export interface CreateFactoryAppOptions {
  onOpenClassicCockpit?: () => void;
}

export function createFactoryAppComponent(ctx: Context, opts: CreateFactoryAppOptions = {}) {
  const React = ctx.react;
  const h = React.createElement;
  const Floor3D = createFloor3DComponent(ctx);

  return function OrgFyFactoryApp() {
    const [tenant, setTenant] = React.useState<string>("orgfy");
    const [tab, setTab] = React.useState<FactoryTab>("overview");
    const [dmAgentKey, setDmAgentKey] = React.useState<string>("");
    const [openingDm, setOpeningDm] = React.useState<boolean>(false);
    const [relayTick, setRelayTick] = React.useState<number>(0);
    const [status, setStatus] = React.useState<FactoryStatusPayload>(() => buildEmptyFactoryStatus("orgfy"));
    const [holding, setHolding] = React.useState<HoldingControlPlaneSnapshot | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);
    const [activeHelpKey, setActiveHelpKey] = React.useState<string | null>(null);
    const [selectedItem, setSelectedItem] = React.useState<FactoryWorkItem | null>(null);
    const [confirmKill, setConfirmKill] = React.useState<boolean>(false);

    // Ref para o abridor nativo de abas laterais do Buzz (ctx.conversation.ui.Tabs)
    const openSideTabRef = React.useRef<
      ((target: { channelId: string; threadId?: string; messageId?: string }, options?: { keep?: boolean; markRead?: boolean }) => boolean) | null
    >(null);

    React.useEffect(() => {
      const relay = (ctx as any)?.relay;
      if (typeof relay?.subscribe !== "function") return;
      return relay.subscribe(() => setRelayTick((n) => n + 1));
    }, []);

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

    const setSettingsForm = React.useCallback((patch: Partial<typeof settingsForm>) => {
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
      async (targetTenant = tenant) => {
        setLoading(true);
        const [res, holdSnap] = await Promise.all([
          fetchFactoryStatus(ctx, targetTenant),
          fetchHoldingControlPlane(ctx).catch(() => null),
        ]);
        setStatus(res.status);
        setError(res.error);
        if (holdSnap) setHolding(holdSnap);
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
        setLoading(false);
      },
      [tenant]
    );

    React.useEffect(() => {
      let disposed = false;
      const run = () => {
        if (!disposed) refresh(tenant);
      };
      run();
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
          notify(message);
          await refresh(tenant);
        } else {
          notify("Falha ao gravar controle-<tenant>.json (host.writeFile indisponível).");
        }
      },
      [tenant, notify, refresh]
    );

    const handleOpenInBuzz = React.useCallback(
      async (item: FactoryWorkItem) => {
        if (item.id && /^[0-9a-f]{64}$/i.test(item.id)) {
          const ok = await openIssueInBuzz(ctx, { id: item.id, dtag: tenant }).catch(() => false);
          notify(ok ? `Issue #${item.id.slice(0, 8)} aberta no Buzz Repos.` : `Deep link preparado para #${item.id.slice(0, 8)}.`);
        } else {
          notify(`Item local #${item.id.slice(0, 8)} (sem ID Nostr de 64 chars).`);
        }
      },
      [tenant, notify]
    );

    const resolveBuzzScope = React.useCallback((): { viewer: string; communityOrigin: string } | null => {
      try {
        const navSnap = typeof (ctx as any)?.navigation?.snapshot === "function" ? (ctx as any).navigation.snapshot() : null;
        const navScope = navSnap?.entry?.target?.scope;
        if (navScope?.viewer && navScope?.communityOrigin) {
          return { viewer: String(navScope.viewer), communityOrigin: String(navScope.communityOrigin) };
        }
      } catch {}
      try {
        const relaySnap = typeof (ctx as any)?.relay?.snapshot === "function" ? (ctx as any).relay.snapshot() : null;
        if (relaySnap?.viewer && relaySnap?.origin) {
          return { viewer: String(relaySnap.viewer), communityOrigin: String(relaySnap.origin) };
        }
      } catch {}
      return null;
    }, []);

    const handleOpenChannelInBuzz = React.useCallback(async () => {
      const emp = holding?.empresas.find((e) => e.slug === tenant);
      const canal = status.tenantManifest?.canal || emp?.canal;
      const scope = resolveBuzzScope();
      try {
        // 1. Prioridade máxima: abre o canal na barra lateral nativa do Buzz (ctx.conversation.ui.Tabs) sem sair do plugin
        if (canal && openSideTabRef.current) {
          const openedSide = openSideTabRef.current({ channelId: canal }, { keep: true });
          if (openedSide) {
            notify(`Canal de ${tenant} aberto na barra lateral do Buzz.`);
            return;
          }
        }
        // 2. Fallback caso ui.Tabs ainda não esteja montado
        if (canal && scope && (ctx as any).navigation?.open) {
          const res = await (ctx as any).navigation.open({
            version: 1,
            kind: "conversation",
            scope,
            channelId: canal,
          });
          if (!res || res.status === "opened") {
            notify(`Canal do workspace ${tenant} aberto no Buzz.`);
            return;
          }
        }
        if (canal) {
          await openSystemUri(ctx, `buzz://channel?id=${canal}`);
          notify(`Canal do workspace ${tenant} aberto no Buzz.`);
          return;
        }
      } catch {}
      notify(`Workspace ativo: ${tenant}${canal ? ` (canal ${canal.slice(0, 8)}…)` : ""}.`);
    }, [holding, status.tenantManifest, tenant, resolveBuzzScope, notify]);

    const liveCrew: LiveCrewAgent[] = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const runningSet = new Set((snap.running || []).map((a: any) => String(a?.key || a?.name)));
        return (snap.agents || []).map((a: any) => ({
          key: String(a?.key || a?.name || ""),
          pubkey: typeof a?.pubkey === "string" ? a.pubkey : "",
          name: String(a?.name || a?.key || "Agente"),
          model: a?.config?.model || PT_BR.labels.unavailable,
          provider: a?.config?.provider || "",
          running: runningSet.has(String(a?.key || a?.name)),
        }));
      } catch {
        return [];
      }
    }, [status.lastTickAt]);

    // Agentes filtrados para a empresa ativa (empresas/<tenant>.json × Buzz)
    const tenantAgents = status.tenantManifest?.agentes || [];
    const dmPool = React.useMemo(() => {
      if (!GLOBAL_TABS.has(tab) && tenantAgents.length > 0) {
        return tenantAgents.map((a) => ({
          key: a.agentKey,
          pubkey: a.pubkey,
          name: a.name,
          label: `${a.name} · ${a.papel}${a.running ? " ●" : ""}`,
        }));
      }
      return liveCrew.map((a) => ({
        key: a.key,
        pubkey: a.pubkey || "",
        name: a.name,
        label: `${a.name}${a.running ? " ●" : ""}`,
      }));
    }, [tab, tenantAgents, liveCrew]);

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

          // 1. Prioridade máxima: abre o chat nativo do Buzz NA BARRA LATERAL (sem sair do plugin!)
          if (channelId && openSideTabRef.current) {
            const openedSide = openSideTabRef.current({ channelId }, { keep: true });
            if (openedSide) {
              notify(`Chat lateral com ${agentName} aberto.`);
              return;
            }
          }

          // 2. Fallback caso ui.Tabs ainda não esteja disponível nesta sessão
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

    const masterAgentName = holding?.ceoHolding?.nome || "OrgFy Iris";
    const masterLive = liveCrew.find((a) => a.name.toLowerCase().includes("iris")) || liveCrew[0] || null;
    const workspaces =
      holding?.empresas && holding.empresas.length > 0
        ? holding.empresas.map((e) => ({
            slug: e.slug,
            nome: e.workspaceBuzz || e.nome,
            estagio: e.estagio,
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
    const tenantActiveAgentsCount = tenantAgents.filter((a) => a.running).length;
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
      { id: "floor", label: "Andar 3D", badge: `${tenantActiveAgentsCount}/${tenantTotalAgentsCount}` },
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
    const useNativeSideTabs = Boolean(NativeTabs && relaySnap?.session && relaySnap?.scope);

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
        { className: "of-shell" },
        // Sidebar limpa 1:1 CodeDen: CEO Master -> Holding Global (Conselho, Inbox, Uso & Custos, Automações) -> Empresas (Workspaces)
        h(
          "aside",
          { className: "of-sidebar" },
          h(
            "div",
            { className: "of-brand" },
            h(
              "span",
              { className: "of-brand-mark" },
              h("span", { className: "of-brand-icon" }, "<>"),
              PT_BR.appTitle
            ),
            h("span", { className: "of-dot", "data-tone": status.coordenador === "ativo" ? "done" : "failed", title: `Coordenador: ${status.coordenador}` })
          ),

          h(
            "button",
            {
              type: "button",
              className: "of-surface",
              title: `Abrir DM nativa com ${masterAgentName} no Buzz`,
              onClick: () =>
                handleOpenAgentDmInBuzz(
                  masterLive || { name: masterAgentName, pubkey: holding?.ceoHolding?.pubkey || "" }
                ),
              style: {
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" } },
              h("span", null, "CEO Master · Orquestrador"),
              h("span", { style: { color: "var(--primary)", fontWeight: 600, textTransform: "none", letterSpacing: 0 } }, "DM ↗")
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "var(--foreground)" } },
              h("span", { className: "of-dot", "data-tone": masterLive?.running ? "running" : "done" }),
              masterAgentName
            ),
            h("div", { className: "of-mono of-muted", style: { fontSize: "10px" } }, masterLive ? masterLive.model : "Ativa no Buzz")
          ),

          h("div", { className: "of-nav-group-label" }, "Holding & Global"),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("holding", "Conselho (Board)", pendingApprovals > 0 ? String(pendingApprovals) : undefined, pendingApprovals > 0 ? "warn" : undefined),
            renderNavBtn("inbox", PT_BR.nav.inbox, inboxCount > 0 ? String(inboxCount) : undefined, inboxCount > 0 ? "warn" : undefined),
            renderNavBtn("costs", "Uso & Custos"),
            renderNavBtn("automations", PT_BR.nav.automations)
          ),

          h("div", { className: "of-nav-group-label" }, "Empresas · Workspaces"),
          h(
            "nav",
            { className: "of-nav" },
            workspaces.map((w) => {
              const isSelectedEmpresa = !isGlobalView && tenant === w.slug;
              return h(
                "button",
                {
                  key: w.slug,
                  type: "button",
                  className: "of-nav-btn",
                  "data-active": isSelectedEmpresa ? "true" : "false",
                  onClick: () => {
                    setTenant(w.slug);
                    if (GLOBAL_TABS.has(tab)) setTab("overview");
                  },
                },
                h(
                  "span",
                  { style: { display: "inline-flex", alignItems: "center", gap: "7px", overflow: "hidden" } },
                  h("span", { className: "of-project-tile", style: { width: "18px", height: "18px", fontSize: "10px" } }, w.nome.charAt(0).toUpperCase()),
                  h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.nome)
                ),
                w.agentesInfo && h("span", { className: "of-nav-badge" }, w.agentesInfo)
              );
            })
          ),

          opts.onOpenClassicCockpit &&
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { marginTop: "auto", justifyContent: "center" },
                onClick: opts.onOpenClassicCockpit,
              },
              "Control Room clássico"
            )
        ),

        // Área principal em tela cheia: Header + Abas Horizontais da Empresa (1:1 CodeDen)
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
                  )
                ),
            h(
              "div",
              { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              !isGlobalView &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": tab === "floor" ? "primary" : "ghost",
                    onClick: () => setTab(tab === "floor" ? "overview" : "floor"),
                  },
                  `Andar 3D (${tenantTotalAgentsCount})`
                ),
              !isGlobalView &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    onClick: handleOpenChannelInBuzz,
                  },
                  "Canal no Buzz ↗"
                ),
              h(
                "select",
                {
                  className: "of-tenant-select",
                  "aria-label": "Selecionar agente para DM no Buzz",
                  value: dmAgentKey,
                  onChange: (e: any) => setDmAgentKey(e.target.value),
                  style: { width: "auto", maxWidth: "210px", padding: "4px 8px", fontSize: "11.5px" },
                },
                dmPool.length > 0
                  ? dmPool.map((a) => h("option", { key: a.key, value: a.key }, a.label))
                  : h("option", { value: "" }, status.tenantManifest?.coo || "OrgFy Bento (COO)")
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "primary",
                  disabled: openingDm,
                  onClick: () => handleOpenAgentDmInBuzz(selectedDmAgent),
                },
                openingDm ? "Abrindo..." : "Chat lateral"
              )
            ),
            toast && h("span", { className: "of-pill", "data-tone": "done" }, toast),
            error && !toast && h("span", { className: "of-pill", "data-tone": "failed" }, `Aviso: ${error}`)
          ),

          // Barra de Abas Horizontais da Empresa (igual ao CodeDen ProjectPage!)
          !isGlobalView &&
            h(
              "div",
              { className: "of-project-tabs", role: "tablist", "aria-label": `Navegação de ${empresaNome}` },
              projectTabs.map((pt) =>
                h(
                  "button",
                  {
                    key: pt.id,
                    type: "button",
                    role: "tab",
                    className: "of-project-tab",
                    "data-active": tab === pt.id ? "true" : "false",
                    onClick: () => setTab(pt.id),
                  },
                  h("span", null, pt.label),
                  pt.badge && h("span", { className: "of-nav-badge", "data-tone": pt.tone }, pt.badge)
                )
              )
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
                    viewMode: tab,
                    onChangeViewMode: (m) => setTab(m),
                    storeyFocus,
                    onChangeStoreyFocus: setStoreyFocus,
                    selectedAgentKey,
                    onSelectAgentKey: setSelectedAgentKey,
                    onSelectItem: setSelectedItem,
                    onOpenAgentDm: handleOpenAgentDmInBuzz,
                    onRefresh: () => refresh(tenant),
                    loading,
                    Floor3D,
                  })
                : renderFactorySecondaryPage({
                    h,
                    tab,
                    tenant,
                    holding,
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
                  })
            )
          )
        )
      ),
      renderItemSheetDrawer({
        h,
        item: selectedItem,
        tenant,
        onClose: () => setSelectedItem(null),
        onOpenInBuzz: handleOpenInBuzz,
      })
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
