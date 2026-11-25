// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/shell/app-shell.tsx e routes/project.tsx
// Shell principal da OrgFy Factory em Shadow DOM com navegação completa das páginas do CodeDen e multi-tenant OrgFy.

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
import { renderFactorySecondaryPage } from "./FactoryPages";
import { subscribeRelayUpdates } from "../services/buzz-native";
import { openIssueInBuzz } from "../services/orgfy-bridge";

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

const TENANT_OPTIONS = [
  { id: "orgfy", label: "OrgFy Core" },
  { id: "lumen-iptv", label: "Lumen IPTV" },
  { id: "saas-tributario", label: "SaaS Tributário" },
];

export interface CreateFactoryAppOptions {
  onOpenClassicCockpit?: () => void;
}

export function createFactoryAppComponent(ctx: Context, opts: CreateFactoryAppOptions = {}) {
  const React = ctx.react;
  const h = React.createElement;

  return function OrgFyFactoryApp() {
    const [tenant, setTenant] = React.useState<string>("orgfy");
    const [tab, setTab] = React.useState<FactoryTab>("overview");
    const [status, setStatus] = React.useState<FactoryStatusPayload>(() => buildEmptyFactoryStatus("orgfy"));
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);
    const [activeHelpKey, setActiveHelpKey] = React.useState<string | null>(null);
    const [selectedItem, setSelectedItem] = React.useState<FactoryWorkItem | null>(null);
    const [confirmKill, setConfirmKill] = React.useState<boolean>(false);

    // Estados ricos das páginas CodeDen
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
        const res = await fetchFactoryStatus(ctx, targetTenant);
        setStatus(res.status);
        setError(res.error);
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

    const handleSelectItem = React.useCallback(
      async (item: FactoryWorkItem) => {
        setSelectedItem(item);
        if (item.id && /^[0-9a-f]{64}$/i.test(item.id)) {
          await openIssueInBuzz(ctx, { id: item.id, dtag: tenant }).catch(() => false);
        }
      },
      [tenant]
    );

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
        // Sidebar oficial estilo CodeDen
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
            "select",
            {
              className: "of-tenant-select",
              value: tenant,
              onChange: (e: any) => setTenant(e.target.value),
            },
            TENANT_OPTIONS.map((t) => h("option", { key: t.id, value: t.id }, t.label))
          ),
          h("div", { className: "of-nav-group-label" }, "Holding"),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("holding", PT_BR.nav.holding),
            renderNavBtn("inbox", PT_BR.nav.inbox, inboxCount > 0 ? String(inboxCount) : undefined, inboxCount > 0 ? "warn" : undefined)
          ),
          h("div", { className: "of-nav-group-label" }, "Fábrica"),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("overview", PT_BR.nav.overview),
            renderNavBtn("board", PT_BR.nav.board, String(status.backlog.length + status.inProgress.length)),
            renderNavBtn("floor", PT_BR.nav.floor, String(liveCrew.filter((a) => a.running).length))
          ),
          h("div", { className: "of-nav-group-label" }, "Operação"),
          h(
            "nav",
            { className: "of-nav" },
            renderNavBtn("costs", PT_BR.nav.costs),
            renderNavBtn("automations", PT_BR.nav.automations),
            renderNavBtn("agents", PT_BR.nav.agents, abaixoMinimoCount > 0 ? `⚠ ${abaixoMinimoCount}` : undefined, abaixoMinimoCount > 0 ? "danger" : undefined),
            renderNavBtn("vision", PT_BR.nav.vision),
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

        // Área principal com PageHeader + conteúdo da página ativa
        h(
          "div",
          { className: "of-workspace" },
          h(
            "header",
            { className: "of-page-header" },
            h("strong", { style: { fontSize: "13.5px" } }, PT_BR.nav[tab] || PT_BR.appTitle),
            h("span", { className: "of-mono of-muted" }, `/ ${tenant}`),
            toast && h("span", { className: "of-pill", "data-tone": "done", style: { marginLeft: "auto" } }, toast),
            error && !toast && h("span", { className: "of-pill", "data-tone": "failed", style: { marginLeft: "auto" } }, `Aviso: ${error}`)
          ),
          h(
            "main",
            { className: "of-main" },
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
                  onSelectItem: handleSelectItem,
                  onRefresh: () => refresh(tenant),
                  onOpenBoard: () => setTab("board"),
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
                  onSelectItem: handleSelectItem,
                  onRefresh: () => refresh(tenant),
                  loading,
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
                  onSelectItem: handleSelectItem,
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
                })
          )
        )
      ),
      renderItemSheetDrawer({ h, item: selectedItem, tenant, onClose: () => setSelectedItem(null) })
    );
  };
}
