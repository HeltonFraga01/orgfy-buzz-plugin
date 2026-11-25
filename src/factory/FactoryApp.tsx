// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/shell/app-shell.tsx e routes/project.tsx
// Shell nativo do Buzz para a OrgFy Factory: cores dinâmicas do Buzz, CEO Master, Conselho (Board), Workspaces, Andar 3D em tela cheia e Chat lateral do COO/Agentes.

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
import { createAgentQuickChatComponent } from "./AgentQuickChat";
import { renderFactorySecondaryPage } from "./FactoryPages";
import { subscribeRelayUpdates } from "../services/buzz-native";
import { openIssueInBuzz } from "../services/orgfy-bridge";
import { fetchHoldingControlPlane, type HoldingControlPlaneSnapshot } from "../services/holding-service";

type FactoryTab =
  | "holding"
  | "inbox"
  | "overview"
  | "board"
  | "floor"
  | "costs"
  | "automations"
  | "agents"
  | "vision"
  | "settings";

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
  const AgentQuickChat = createAgentQuickChatComponent(ctx);

  return function OrgFyFactoryApp() {
    const [tenant, setTenant] = React.useState<string>("orgfy");
    const [tab, setTab] = React.useState<FactoryTab>("overview");
    const [chatOpen, setChatOpen] = React.useState<boolean>(true);
    const [status, setStatus] = React.useState<FactoryStatusPayload>(() => buildEmptyFactoryStatus("orgfy"));
    const [holding, setHolding] = React.useState<HoldingControlPlaneSnapshot | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);
    const [activeHelpKey, setActiveHelpKey] = React.useState<string | null>(null);
    const [selectedItem, setSelectedItem] = React.useState<FactoryWorkItem | null>(null);
    const [confirmKill, setConfirmKill] = React.useState<boolean>(false);

    // Estados das páginas
    const [scorecardView, setScorecardView] = React.useState<"builders" | "reviewers" | "pairs">("builders");
    const [scorecardDays, setScorecardDays] = React.useState<7 | 30 | 90>(30);
    const [storeyFocus, setStoreyFocus] = React.useState<"workshop" | "lookout" | "both">("both");
    const [selectedAgentKey, setSelectedAgentKey] = React.useState<string | null>(null);
    const [inboxFilter, setInboxFilter] = React.useState<"all" | "asks" | "reviews" | "problems">("all");
    const [costRange, setCostRange] = React.useState<"7d" | "30d" | "90d">("30d");
    const [autoTab, setAutoTab] = React.useState<"automations" | "runs" | "templates">("automations");
    const [agentTab, setAgentTab] = React.useState<"eval" | "memory" | "skills" | "mcp" | "hooks">("eval");

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

    // useFactoryStatus(tenant): poll 5s + invalidação em eventos do relay
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

    const handleOpenChannelInBuzz = React.useCallback(async () => {
      const emp = holding?.empresas.find((e) => e.slug === tenant);
      const canal = emp?.canal;
      try {
        if (canal && (ctx as any).navigation?.open) {
          await (ctx as any).navigation.open({ kind: "channel", channelId: canal });
          notify(`Canal do workspace ${tenant} aberto no Buzz.`);
          return;
        }
      } catch {}
      notify(`Workspace ativo: ${tenant}${canal ? ` (canal ${canal.slice(0, 8)}…)` : ""}.`);
    }, [holding, tenant, notify]);

    const liveCrew: LiveCrewAgent[] = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const runningSet = new Set((snap.running || []).map((a: any) => String(a?.key || a?.name)));
        return (snap.agents || []).map((a: any) => ({
          key: String(a?.key || a?.name || ""),
          name: String(a?.name || a?.key || "Agente"),
          model: a?.config?.model || PT_BR.labels.unavailable,
          provider: a?.config?.provider || "",
          running: runningSet.has(String(a?.key || a?.name)),
        }));
      } catch {
        return [];
      }
    }, [status.lastTickAt]);

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

    const pendingApprovals = (holding?.approvals || []).filter((a) => a.status === "pendente").length;
    const abaixoMinimoCount = (status.modelos || []).filter((m) => m.abaixo_minimo).length;
    const inboxCount =
      status.held.length +
      [...status.inProgress, ...status.recent].filter((i) => i.stage === "escalated" || i.stage === "failed" || i.stage === "reverted").length;

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

    return h(
      "div",
      {
        ref: hostRef,
        "data-orgfy-factory-root": "true",
        style: { width: "100%", height: "100vh", maxHeight: "100vh", overflow: "hidden" },
      },
      h("style", { "data-orgfy-factory-inline-fallback": "true" }, FACTORY_SHADOW_CSS),
      h(
        "div",
        { className: "of-shell" },
        // Sidebar OrgFy: CEO Master -> Holding/Conselho & Inbox -> Workspaces -> Fábrica -> Operação
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
            "div",
            { className: "of-surface", style: { padding: "8px 10px", display: "flex", flexDirection: "column", gap: "3px" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" } },
              h("span", null, "CEO Master · Orquestrador"),
              h("span", { className: "of-dot", "data-tone": masterLive?.running ? "running" : "done" })
            ),
            h("div", { style: { fontSize: "12.5px", fontWeight: 700, color: "var(--foreground)" } }, masterAgentName),
            h("div", { className: "of-mono of-muted", style: { fontSize: "10px" } }, masterLive ? masterLive.model : "Ativa no Buzz")
          ),

          h("div", { className: "of-nav-group-label" }, "Holding & Conselho"),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("holding", "Conselho (Board)", pendingApprovals > 0 ? String(pendingApprovals) : undefined, pendingApprovals > 0 ? "warn" : undefined),
            renderNavBtn("inbox", PT_BR.nav.inbox, inboxCount > 0 ? String(inboxCount) : undefined, inboxCount > 0 ? "warn" : undefined)
          ),

          h("div", { className: "of-nav-group-label" }, "Empresas · Workspaces"),
          h(
            "nav",
            { className: "of-nav" },
            workspaces.map((w) =>
              h(
                "button",
                {
                  key: w.slug,
                  type: "button",
                  className: "of-nav-btn",
                  "data-active": tenant === w.slug ? "true" : "false",
                  onClick: () => {
                    setTenant(w.slug);
                    if (tab === "holding") setTab("overview");
                  },
                },
                h(
                  "span",
                  { style: { display: "inline-flex", alignItems: "center", gap: "6px", overflow: "hidden" } },
                  h("span", { className: "of-dot", "data-tone": w.estagio === "operacional" ? "done" : "idle" }),
                  h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.nome)
                ),
                w.agentesInfo && h("span", { className: "of-nav-badge" }, w.agentesInfo)
              )
            )
          ),

          h("div", { className: "of-nav-group-label" }, `Fábrica · ${tenant}`),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("overview", PT_BR.nav.overview),
            renderNavBtn("board", PT_BR.nav.board, String(status.backlog.length + status.inProgress.length)),
            renderNavBtn("floor", "Andar 3D", String(liveCrew.filter((a) => a.running).length))
          ),

          h("div", { className: "of-nav-group-label" }, "Operação"),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("costs", PT_BR.nav.costs),
            renderNavBtn("vision", "Canvas / Visão"),
            renderNavBtn("agents", PT_BR.nav.agents, abaixoMinimoCount > 0 ? `⚠ ${abaixoMinimoCount}` : undefined, abaixoMinimoCount > 0 ? "danger" : undefined),
            renderNavBtn("automations", PT_BR.nav.automations),
            renderNavBtn("settings", PT_BR.nav.settings)
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

        // Área principal + Painel Lateral de Chat com COO & Agentes
        h(
          "div",
          { className: "of-workspace" },
          h(
            "header",
            { className: "of-page-header" },
            h("strong", { style: { fontSize: "13.5px" } }, tab === "vision" ? "Canvas / Visão" : tab === "floor" ? "Andar 3D" : PT_BR.nav[tab] || PT_BR.appTitle),
            h("span", { className: "of-mono of-muted" }, `/ ${tenant}`),
            h(
              "div",
              { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px" } },
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
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": chatOpen ? "primary" : undefined,
                  onClick: () => setChatOpen(!chatOpen),
                },
                chatOpen ? "Ocultar Chat COO" : "Chat COO & Agentes"
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
                    onRefresh: () => refresh(tenant),
                    loading,
                    Floor3D,
                  })
                : renderFactorySecondaryPage({
                    h,
                    tab,
                    tenant,
                    onSelectTenant: (t) => {
                      setTenant(t);
                      setTab("overview");
                    },
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
            ),
            chatOpen &&
              h(AgentQuickChat, {
                tenant,
                liveCrew,
                onCollapse: () => setChatOpen(false),
                onNotify: notify,
              })
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
  };
}
