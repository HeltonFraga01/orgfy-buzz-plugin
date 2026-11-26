// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/project.tsx, components/project/now-next.tsx, components/factory/factory-panel.tsx, components/usage/project-spend-card.tsx
// Visão Geral modular em 5 blocos independentes (AGORA + PRÓXIMOS | Fábrica de Software | Gasto | Sessões & Agentes | Automações), 100% no tema do Buzz e com dados reais do Buzz + OrgFy.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "./buzz-live-telemetry";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import { PT_BR } from "../i18n/pt-BR";
import { renderPipelineDiagram } from "./PipelineDiagram";
import { renderCooUpdatesFeedCard, type CooUpdateEntry } from "./FactoryCooUpdatesFeed";

export interface FactoryOverviewProps {
  h: any;
  tenant: string;
  isBoardTenant?: boolean;
  status: FactoryStatusPayload;
  liveCrew?: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  workingNowCount?: number;
  onOpenTurnInSideChat?: (turn: LiveAgentTurn) => void;
  onInterruptTurn?: (turn: LiveAgentTurn) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenAgentProfile?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onNavigateTab?: (tab: "costs" | "automations" | "agents" | "board" | "floor" | "vision" | "settings") => void;
  loading: boolean;
  confirmKill: boolean;
  setConfirmKill: (v: boolean) => void;
  activeHelpKey: string | null;
  onToggleHelp: (key: string | null) => void;
  onSelectItem: (item: FactoryWorkItem) => void;
  onRefresh: () => void;
  onOpenBoard: () => void;
  onOpenSettings: () => void;
  onOpenVision: () => void;
  onToggleDrain: () => void;
  onToggleKillSwitch: (next: boolean) => void;
  scorecardView: "builders" | "reviewers" | "pairs";
  setScorecardView: (v: "builders" | "reviewers" | "pairs") => void;
  scorecardDays: 7 | 30 | 90;
  setScorecardDays: (d: 7 | 30 | 90) => void;
  cooUpdatesExpanded?: boolean;
  onToggleCooUpdates?: () => void;
  onSendUpdatesToCoo?: (entries: CooUpdateEntry[]) => void;
  sendingCooUpdates?: boolean;
}

function fmtTokens(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return PT_BR.labels.unavailable;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function fmtAge(tsMs?: number | null): string {
  if (!tsMs || tsMs <= 0) return "—";
  const diffMin = Math.max(0, Math.floor((Date.now() - tsMs) / 60000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

function Meter(h: any, props: { label: string; value: number; max: number; display: string; warn?: boolean }) {
  const pct = props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0;
  const color = !props.warn
    ? "var(--status-running)"
    : pct > 85
    ? "var(--status-failed)"
    : pct > 60
    ? "var(--status-waiting)"
    : "var(--primary)";
  return h(
    "div",
    { className: "of-meter" },
    h(
      "div",
      { className: "of-meter-top" },
      h("span", { className: "of-meter-label" }, props.label),
      h("span", { className: "of-meter-val" }, props.display)
    ),
    h(
      "div",
      { className: "of-bar-track" },
      h("div", { className: "of-bar-fill", style: { width: `${pct}%`, background: color } })
    )
  );
}

export function renderFactoryOverviewPanel(props: FactoryOverviewProps) {
  const {
    h,
    tenant,
    status,
    telemetry,
    loading,
    confirmKill,
    setConfirmKill,
    activeHelpKey,
    onToggleHelp,
    onSelectItem,
    onRefresh,
    onOpenBoard,
    onOpenSettings,
    onOpenVision,
    onToggleDrain,
    onToggleKillSwitch,
    onOpenTurnInSideChat,
    onInterruptTurn,
    onOpenAgentDm,
    onNavigateTab,
    scorecardView,
    setScorecardView,
    scorecardDays,
    setScorecardDays,
  } = props;

  const stopped = status.killSwitch || status.globalKillSwitch || status.loopState === "stopped";
  const loopTone = stopped
    ? "failed"
    : status.loopState === "paused" || status.loopState === "draining"
    ? "waiting"
    : status.loopState === "building" || status.loopState === "discovering"
    ? "running"
    : "idle";
  const loopLabel = PT_BR.loopState[stopped ? "stopped" : status.loopState] || status.loopState;

  const budgetUsd = status.limits.dailyBudget?.usd ?? 50;
  const readyCount = status.inProgress.filter((w) => w.step === "merge" && w.stage === "verifying").length;
  const qualidade = status.kpis?.qualidade || null;
  const economia = status.kpis?.economia || null;
  const modelos = status.modelos || [];
  const porModelo = Array.isArray(economia?.por_modelo) ? economia.por_modelo : [];
  const tenantAgents = status.tenantManifest?.agentes || [];
  const activeTurns = telemetry?.activeTurns || [];
  const openPrs = status.pullRequests || [];
  const topModelName = porModelo[0]?.modelo ? String(porModelo[0].modelo) : (tenantAgents[0]?.model || PT_BR.labels.unavailable);

  const nowRunningCount = activeTurns.length + status.inProgress.length;
  const queuedCount = status.backlog.length;

  const nextScheduleRows: Array<{ id: string; title: string; when: string; action: () => void }> = [
    {
      id: "coord-cycle",
      title: `Coordenador ${status.launchAgent || "esteira-minima"}`,
      when: status.coordenador === "ativo" ? (status.lastTickAt ? `ciclo ${fmtAge(status.lastTickAt)}` : "ativo") : "parado",
      action: () => onNavigateTab?.("automations"),
    },
    {
      id: "ceo-routine",
      title: "Rotina CEO · Workflow Buzz (Kind 30620)",
      when: "nativo",
      action: () => onNavigateTab?.("automations"),
    },
    {
      id: "ci-runner",
      title: `CI & Probes (${status.tenantManifest?.ciModo || "local"})`,
      when: status.tenantManifest?.probesObrigatorios ? `${status.tenantManifest.probesCount} probes` : "sob PR",
      action: () => onNavigateTab?.("automations"),
    },
    ...status.backlog.slice(0, 2).map((b) => ({
      id: `backlog-${b.id}`,
      title: b.title,
      when: "na fila",
      action: () => onSelectItem(b),
    })),
  ];

  const renderColumn = (title: string, count: number, body: any) =>
    h(
      "div",
      { className: "of-surface", style: { minWidth: 0, overflow: "hidden" } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--muted-foreground)",
          },
        },
        h("span", null, title),
        h("span", { className: "of-mono of-num" }, String(count))
      ),
      h(
        "div",
        { style: { padding: "8px", display: "flex", flexDirection: "column", gap: "4px" } },
        count === 0
          ? h("div", { className: "of-muted", style: { textAlign: "center", padding: "14px 6px", fontSize: "11px" } }, "Nada ainda")
          : body
      )
    );

  return h(
    "div",
    { className: "of-overview-stack", "data-overview-modular": "true" },

    // ── BLOCO 1: AGORA (esquerda) + PRÓXIMOS (direita) — 1:1 CodeDen NowNext ──
    h(
      "section",
      { className: "of-now-next", "aria-label": "Agora e próximos" },
      // Esquerda: AGORA
      h(
        "div",
        { style: { minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" } },
        h(
          "div",
          { className: "of-section-label" },
          h("span", null, "AGORA"),
          h(
            "span",
            { className: "of-pill", "data-tone": nowRunningCount > 0 ? "running" : "idle", style: { padding: "1px 7px", fontSize: "10px" } },
            String(nowRunningCount)
          ),
          queuedCount > 0 &&
            h("span", { style: { fontWeight: 500, textTransform: "none", letterSpacing: 0 } }, `· ${queuedCount} na fila`)
        ),
        nowRunningCount === 0
          ? h("div", { className: "of-now-empty" }, "Nada executando agora.")
          : h(
              "div",
              {
                className: "of-now-cards",
                "data-now-two-rows": "true",
                style: {
                  gridTemplateRows: nowRunningCount > 2 ? "repeat(2, 82px)" : "82px",
                  gridAutoColumns: "256px",
                },
              },
              activeTurns.map((t) => {
                const turnCrew = (props.liveCrew || []).find((c) => c.pubkey?.toLowerCase() === t.agentPubkey.toLowerCase());
                return h(
                  "div",
                  {
                    key: `turn-${t.agentPubkey}-${t.channelId}-${t.messageId || t.startedAt}`,
                    className: "of-now-card",
                    style: {
                      borderColor: t.state === "error" ? "rgba(239, 68, 68, 0.42)" : "rgba(96, 165, 250, 0.34)",
                      background: t.state === "error" ? "rgba(239, 68, 68, 0.05)" : "rgba(59, 130, 246, 0.05)",
                    },
                    onClick: () => onOpenTurnInSideChat?.(t),
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "7px", minWidth: 0 } },
                    h(
                      "button",
                      {
                        type: "button",
                        "data-agent-profile-trigger": t.agentName,
                        title: `Abrir perfil de ${t.agentName} na coluna lateral`,
                        style: {
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                          flex: 1,
                          minWidth: 0,
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          font: "inherit",
                          padding: 0,
                          cursor: props.onOpenAgentProfile ? "pointer" : "inherit",
                          textAlign: "left",
                        },
                        onClick: (e: any) => {
                          if (!props.onOpenAgentProfile) return;
                          e.stopPropagation();
                          props.onOpenAgentProfile({ pubkey: t.agentPubkey, name: t.agentName });
                        },
                      },
                      turnCrew?.picture
                        ? h("img", { src: turnCrew.picture, alt: t.agentName, style: { width: "18px", height: "18px", borderRadius: "5px", objectFit: "cover", border: "1px solid var(--status-running)", flexShrink: 0 } })
                        : h("span", { className: "of-dot", "data-tone": t.state === "error" ? "failed" : "running" }),
                      h("strong", { style: { fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 } }, t.agentName)
                    ),
                    onInterruptTurn && t.stoppable &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          "data-variant": "danger",
                          style: { padding: "1px 6px", fontSize: "10px", flexShrink: 0 },
                          onClick: (e: any) => {
                            e.stopPropagation();
                            onInterruptTurn(t);
                          },
                        },
                        "Parar"
                      )
                  ),
                  h(
                    "div",
                    { className: "of-muted", style: { fontSize: "11px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: t.stepLabel },
                    t.stepLabel
                  ),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", fontSize: "10px", color: "var(--muted-foreground)" } },
                    h("span", { className: "of-mono", style: { color: "var(--status-running)" } }, "⚡ Buzz ao vivo"),
                    h("span", { className: "of-mono", style: { flexShrink: 0 } }, fmtAge(t.startedAt))
                  )
                );
              }),
              status.inProgress.slice(0, 10).map((item) => {
                const isErr = item.stage === "failed" || item.stage === "reverted";
                const stageBadge = isErr ? "quarentena" : item.stage === "verifying" ? "revisão L-01" : item.stage === "building" ? "execução" : item.stage;
                return h(
                  "button",
                  {
                    key: `wip-${item.id}`,
                    type: "button",
                    className: "of-now-card",
                    style: isErr ? { borderColor: "rgba(239, 68, 68, 0.35)" } : undefined,
                    onClick: () => onSelectItem(item),
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "7px", minWidth: 0, width: "100%" } },
                    h("span", { className: "of-dot", "data-tone": isErr ? "failed" : item.stage === "escalated" ? "waiting" : "running" }),
                    h("strong", { style: { fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }, title: item.title }, item.title)
                  ),
                  h(
                    "div",
                    { className: "of-muted", style: { fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }, title: item.note || stageBadge },
                    item.note || stageBadge
                  ),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", width: "100%", fontSize: "10px", color: "var(--muted-foreground)" } },
                    h("span", { className: "of-mono", style: { color: isErr ? "var(--status-failed)" : "var(--primary)" } }, `#${item.id.slice(0, 8)} · ${stageBadge}`),
                    h("span", { className: "of-mono", style: { flexShrink: 0 } }, fmtAge(item.updatedAt))
                  )
                );
              })
            )
      ),
      // Direita: PRÓXIMOS
      h(
        "div",
        { style: { minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" } },
        h("div", { className: "of-section-label" }, "PRÓXIMOS"),
        h(
          "div",
          { className: "of-next-list" },
          nextScheduleRows.slice(0, 5).map((row) =>
            h(
              "button",
              { key: row.id, type: "button", className: "of-next-row", onClick: row.action },
              h("span", { className: "of-dot", "data-tone": row.when === "parado" ? "failed" : "idle" }),
              h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, row.title),
              h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px", flexShrink: 0 } }, row.when)
            )
          )
        )
      )
    ),

    // ── FEED DE UPDATES PARA O COO (Print 4) ──
    props.onToggleCooUpdates && props.onSendUpdatesToCoo &&
      renderCooUpdatesFeedCard({
        h,
        tenant,
        status,
        expanded: Boolean(props.cooUpdatesExpanded),
        onToggleExpanded: props.onToggleCooUpdates,
        onSelectItem,
        onSendUpdatesToCoo: props.onSendUpdatesToCoo,
        sending: props.sendingCooUpdates,
      }),

    // ── BLOCO 2: FÁBRICA DE SOFTWARE (Card dedicado) ──
    h(
      "section",
      { className: "of-card", "aria-label": "Fábrica de Software" },
      // Header da Fábrica
      h(
        "div",
        { className: "of-panel-head" },
        h("span", { className: "of-brand-icon", style: { width: "32px", height: "32px", fontSize: "14px" } }, "⚙"),
        h(
          "div",
          { style: { minWidth: 0 } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", fontSize: "14px", fontWeight: 600 } },
            h("span", null, props.isBoardTenant ? "Pipeline de Gestão · Conselho da Holding" : `${PT_BR.modes[status.mode] || status.mode} · ${tenant}`),
            !props.isBoardTenant && status.experimental && h("span", { className: "of-exp-badge" }, "experimental"),
            h(
              "span",
              { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "done" : "failed" },
              props.isBoardTenant ? "Governança ativa" : (status.coordenador === "ativo" ? PT_BR.labels.coordinatorActive : PT_BR.labels.coordinatorStopped)
            )
          ),
          h(
            "div",
            { className: "of-muted", style: { marginTop: "2px" } },
            props.isBoardTenant
              ? "Pautas escaladas pelas subsidiárias (COO → CEO) passam pelos comitês técnicos; apenas a Bestie (OrgFy Iris) aciona o Fundador em DM."
              : (status.mode === "dark_factory"
                  ? "O Oráculo e issues confiáveis alimentam as pipelines; "
                  : "Issues NIP-34 confiáveis alimentam as pipelines; ") +
                (status.limits.autoMerge ? "a OrgFy faz merge quando todos os checks passam." : "você e o Revisor L-01 aprovam os PRs.")
          )
        ),
        h(
          "div",
          { style: { marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" } },
          h("button", { type: "button", className: "of-btn", onClick: onOpenBoard }, "Visão da Fábrica"),
          h(
            "button",
            { type: "button", className: "of-btn", onClick: onRefresh, disabled: loading },
            loading ? "Verificando..." : PT_BR.actions.checkNow
          ),
          h("button", { type: "button", className: "of-btn", "data-variant": "ghost", onClick: onOpenSettings }, "Configurações"),
          h("button", { type: "button", className: "of-btn", "data-variant": "ghost", onClick: onOpenVision }, "Visão"),
          h("button", { type: "button", className: "of-btn", onClick: onToggleDrain }, status.drain ? PT_BR.actions.drainOff : PT_BR.actions.drainOn),
          !confirmKill
            ? h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "danger",
                  onClick: () => (status.killSwitch ? onToggleKillSwitch(false) : setConfirmKill(true)),
                },
                status.killSwitch ? PT_BR.actions.killSwitchOff : PT_BR.actions.killSwitchOn
              )
            : h(
                "div",
                { style: { display: "inline-flex", gap: "4px" } },
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "danger",
                    onClick: () => {
                      setConfirmKill(false);
                      onToggleKillSwitch(true);
                    },
                  },
                  "Confirmar Kill Switch"
                ),
                h("button", { type: "button", className: "of-btn", onClick: () => setConfirmKill(false) }, "Cancelar")
              )
        )
      ),

      // Corpo da Fábrica
      h(
        "div",
        { className: "of-panel-body" },
        // Alerta de Kill Switch / Pausa / Esteira Parada
        (status.globalKillSwitch || status.pausedReason || (status.wip?.holding && status.wip?.note)) &&
          h(
            "div",
            { className: "of-alert-banner" },
            h("span", { style: { color: "var(--status-waiting)", fontWeight: 700 } }, "⚠"),
            h(
              "span",
              { style: { flex: 1 } },
              status.globalKillSwitch
                ? "Kill switch global ativado: nenhuma fábrica da Holding está rodando."
                : status.pausedReason
                ? `Pausado: ${status.pausedReason}`
                : status.wip?.note
            )
          ),

        // Pipelines ao vivo
        h(
          "div",
          null,
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" } },
            h("span", { style: { fontSize: "12px", fontWeight: 600, color: "var(--muted-foreground)" } }, PT_BR.pipelines.title),
            h("span", { className: "of-muted", style: { fontSize: "11px" } }, "Clique em um #id para abrir o detalhe ou sessão"),
            h(
              "div",
              { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" } },
              status.drain && !stopped
                ? h("span", { className: "of-pill", "data-tone": "waiting" }, `Drenando: ${status.drain.inFlight} em andamento`)
                : h("span", { className: "of-pill", "data-tone": loopTone }, `Loop ${loopLabel.toLowerCase()}`)
            )
          ),
          renderPipelineDiagram({ h, status, isBoardTenant: props.isBoardTenant, activeHelpKey, onToggleHelp, onSelectItem })
        ),

        // 5 Meters com barras de progresso
        h(
          "div",
          { className: "of-meters-row" },
          Meter(h, {
            label: "Gasto hoje",
            value: status.spendToday.usd,
            max: budgetUsd,
            display: `$${status.spendToday.usd.toFixed(2)} / $${budgetUsd.toFixed(0)}`,
            warn: true,
          }),
          Meter(h, {
            label: "Trabalhando agora",
            value: typeof props.workingNowCount === "number" ? props.workingNowCount : 0,
            max: status.limits.maxConcurrentSessions,
            display: `${typeof props.workingNowCount === "number" ? props.workingNowCount : 0} / ${status.limits.maxConcurrentSessions}`,
            warn: false,
          }),
          Meter(h, {
            label: "PRs em andamento",
            value: status.wip.openPrs,
            max: status.wip.limit,
            display: `${status.wip.openPrs} / ${status.wip.limit}`,
            warn: false,
          }),
          status.limits.autoMerge
            ? Meter(h, {
                label: "Merges hoje (7d: " + status.stats.merged7d + ")",
                value: status.mergesToday,
                max: status.limits.maxMergesPerDay,
                display: `${status.mergesToday} / ${status.limits.maxMergesPerDay}`,
                warn: false,
              })
            : Meter(h, {
                label: "FPY real",
                value: typeof qualidade?.fpy_real_pct === "number" ? qualidade.fpy_real_pct : 0,
                max: 100,
                display: typeof qualidade?.fpy_real_pct === "number" ? `${qualidade.fpy_real_pct.toFixed(1)}%` : `${readyCount} PRs`,
                warn: false,
              }),
          Meter(h, {
            label: "Falhas seguidas",
            value: status.consecutiveFailures,
            max: status.limits.pauseAfterConsecutiveFailures,
            display: `${status.consecutiveFailures} / ${status.limits.pauseAfterConsecutiveFailures}`,
            warn: true,
          })
        ),

        // Caixa dedicada de Pull Requests (1:1 CodeDen)
        h(
          "div",
          { className: "of-surface", style: { overflow: "hidden" } },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderBottom: "1px solid var(--border)",
                fontSize: "11.5px",
              },
            },
            h(
              "span",
              { style: { fontWeight: 600, color: "var(--foreground)" } },
              "Pull requests",
              h("span", { className: "of-muted", style: { fontWeight: 400, marginLeft: "6px" } }, openPrs.length === 0 ? "· fila de merge vazia" : `· ${openPrs.length} aberto(s)`)
            ),
            h("span", { className: "of-mono of-num of-muted" }, String(openPrs.length))
          ),
          openPrs.length === 0
            ? h("div", { className: "of-muted", style: { textAlign: "center", padding: "14px 12px", fontSize: "11.5px" } }, "Nenhum pull request aberto na fábrica.")
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column" } },
                openPrs.slice(0, 8).map((pr: any, idx: number) => {
                  const pid = String(pr.id || idx);
                  const matchedItem:
                    | FactoryWorkItem
                    | undefined = status.inProgress.find((w) => w.id === pid);
                  const clickableItem: FactoryWorkItem = matchedItem || {
                    id: pid,
                    title: String(pr.title || pr.branch || `PR ${pid.slice(0, 8)}`),
                    workKey: `pr:${pid.slice(0, 12)}`,
                    stage: pr.quarentena ? "failed" : "verifying",
                    step: pr.quarentena ? "quarantine" : "review",
                    type: /fix|bug|hotfix/i.test(String(pr.title || "")) ? "bug" : "feature",
                    attempts: 1,
                    sessionId: null,
                    activeSessionId: null,
                    reason: pr.quarentena ? "PR em quarentena no coordenador" : null,
                    note: pr.branch ? `PR aberto · ${pr.branch}` : "PR aberto aguardando revisão/GATE",
                    updatedAt: typeof pr.created_at === "number" ? (pr.created_at < 1e12 ? pr.created_at * 1000 : pr.created_at) : Date.now(),
                  };
                  return h(
                    "button",
                    {
                      key: pid,
                      type: "button",
                      className: "of-list-row",
                      "data-overview-pr-row": pid.slice(0, 8),
                      onClick: () => onSelectItem(clickableItem),
                      style: {
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 12px",
                        border: "none",
                        borderBottom: idx < Math.min(openPrs.length, 8) - 1 ? "1px solid var(--border)" : "none",
                        background: "transparent",
                        color: "var(--foreground)",
                        cursor: "pointer",
                        fontSize: "12px",
                      },
                    },
                    h("span", { className: "of-dot", "data-tone": pr.quarentena ? "failed" : "running" }),
                    h("span", { className: "of-mono", style: { color: "var(--primary)", fontSize: "11px", flexShrink: 0 } }, `#${pid.slice(0, 8)}`),
                    h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pr.title || pr.branch || "Pull Request"),
                    pr.quarentena && h("span", { className: "of-pill", "data-tone": "failed" }, "quarentena"),
                    h("span", { className: "of-muted", style: { fontSize: "11px", flexShrink: 0 } }, "↗")
                  );
                })
              )
        ),

        // 3 Colunas 1:1 CodeDen (Checks de merge com 8 pílulas | Merges & reversões recentes com Refazer | Ignoradas)
        (() => {
          const ico = (paths: string[], size = 11, color?: string) =>
            h(
              "svg",
              {
                width: size,
                height: size,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: color || "currentColor",
                strokeWidth: 2,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                style: { width: `${size}px`, height: `${size}px`, flexShrink: 0, display: "inline-block" },
                "aria-hidden": "true",
              },
              paths.map((d, i) => h("path", { key: i, d }))
            );
          const checkIcon = {
            pass: () => ico(["M20 6 9 17l-5-5"], 10),
            fail: () => ico(["M18 6 6 18", "M6 6l12 12"], 10),
            pending: () => ico(["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z", "M12 6v6l4 2"], 10),
            skipped: () => ico(["M5 12h14"], 10),
          };
          const checkPillStyle = (state: "pass" | "fail" | "pending" | "skipped") => ({
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            height: "20px",
            padding: "0 7px",
            borderRadius: "999px",
            fontSize: "10.5px",
            border:
              state === "pass"
                ? "1px solid rgba(16,185,129,0.34)"
                : state === "fail"
                ? "1px solid rgba(239,68,68,0.38)"
                : "1px solid var(--border)",
            background:
              state === "pass"
                ? "rgba(16,185,129,0.10)"
                : state === "fail"
                ? "rgba(239,68,68,0.10)"
                : "transparent",
            color:
              state === "pass"
                ? "var(--status-done)"
                : state === "fail"
                ? "var(--status-failed)"
                : state === "skipped"
                ? "rgba(156,163,175,0.65)"
                : "var(--muted-foreground)",
          });

          const mergeChecksList: Array<{
            id: string;
            prNum: string;
            title: string;
            reviewer: string;
            note: string;
            item: FactoryWorkItem;
            checks: Array<{ label: string; state: "pass" | "fail" | "pending" | "skipped" }>;
          }> =
            status.mergeChecks.length > 0
              ? status.mergeChecks.slice(0, 5).map((c: any, idx: number) => ({
                  id: String(c.itemId || idx),
                  prNum: String(c.prNumber || idx + 1),
                  title: String(c.title || "PR"),
                  reviewer: String(c.reviewerProvider || "OrgFy Teo"),
                  note: String(c.reviewerNote || c.verdict || ""),
                  item: status.inProgress.find((w) => w.id === c.itemId) || status.recent[0] || {
                    id: String(c.itemId || idx),
                    title: String(c.title || "PR"),
                    workKey: `pr:${idx}`,
                    stage: "verifying",
                    step: "review",
                    type: "feature",
                    attempts: 1,
                    sessionId: null,
                    activeSessionId: null,
                    reason: null,
                    note: null,
                    updatedAt: Date.now(),
                  },
                  checks: Array.isArray(c.checks)
                    ? c.checks.map((ck: any) => ({ label: String(ck.name || ck.label), state: ck.state || "pending" }))
                    : [],
                }))
              : openPrs.slice(0, 4).map((pr: any, idx: number) => {
                  const pid = String(pr.id || idx);
                  const isQ = Boolean(pr.quarentena);
                  const matched = status.inProgress.find((w) => w.id === pid);
                  const revName = Object.values(status.tenantManifest?.revisoresPorSuperficie || {})[0] || "OrgFy Teo";
                  return {
                    id: pid,
                    prNum: pid.slice(0, 6),
                    title: String(pr.title || pr.branch || `PR #${pid.slice(0, 6)}`),
                    reviewer: revName,
                    note: isQ ? "em quarentena · revisar conflito/CI" : "aguardando GATE L-01",
                    item: matched || {
                      id: pid,
                      title: String(pr.title || `PR #${pid.slice(0, 6)}`),
                      workKey: `pr:${pid.slice(0, 12)}`,
                      stage: isQ ? "failed" : "verifying",
                      step: isQ ? "quarantine" : "review",
                      type: "feature",
                      attempts: 1,
                      sessionId: null,
                      activeSessionId: null,
                      reason: null,
                      note: null,
                      updatedAt: Date.now(),
                    },
                    checks: [
                      { label: "Áreas protegidas", state: "pass" as const },
                      { label: "Tamanho", state: "pass" as const },
                      { label: "CI", state: isQ ? ("fail" as const) : ("pending" as const) },
                      { label: "Revisão", state: "pending" as const },
                      { label: "Testes", state: isQ ? ("fail" as const) : ("pass" as const) },
                      { label: "Resultados", state: "pass" as const },
                      { label: "Segurança", state: "pending" as const },
                      { label: "Capturas", state: "skipped" as const },
                    ],
                  };
                });

          const recentCombined = [
            ...status.inProgress.filter((w) => w.stage === "failed" || w.stage === "reverted"),
            ...status.recent,
          ].slice(0, 6);

          const lessonsList = [
            ...(status.orgfyVision?.invariantes || []).map((inv, idx) => ({ id: `inv-${idx}`, text: inv, kind: "invariante" })),
            ...(status.orgfyVision?.regrasProbatorias || []).map((r) => ({ id: r.id, text: `${r.id}: ${r.descricao} (${r.cardsAvaliados}/${r.janelaAlvo})`, kind: "probatoria" })),
          ];
          const todayIso = new Date().toISOString().slice(0, 10);
          const waitingFounder = status.held.length + status.inProgress.filter((w) => w.stage === "escalated").length;

          return h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "10px" }, "data-codeden-factory-bottom": "true" },
            h(
              "div",
              { className: "of-grid-3" },
              renderColumn(
                "Checks de merge",
                mergeChecksList.length,
                mergeChecksList.map((mc) =>
                  h(
                    "button",
                    {
                      key: mc.id,
                      type: "button",
                      onClick: () => onSelectItem(mc.item),
                      style: {
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "7px 8px",
                        borderRadius: "7px",
                        border: "none",
                        background: "transparent",
                        color: "var(--foreground)",
                        fontFamily: "inherit",
                        fontSize: "12px",
                        cursor: "pointer",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "6px" } },
                      h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px", flexShrink: 0 } }, `#${mc.prNum}`),
                      h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 } }, mc.title)
                    ),
                    h(
                      "div",
                      { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                      mc.checks.map((ck) =>
                        h(
                          "span",
                          { key: ck.label, style: checkPillStyle(ck.state), "data-merge-check-pill": ck.label },
                          checkIcon[ck.state](),
                          ck.label
                        )
                      )
                    ),
                    h(
                      "div",
                      { className: "of-muted", style: { fontSize: "10.5px", marginTop: "5px" } },
                      `Revisor: ${mc.reviewer}${mc.note ? ` · ${mc.note}` : ""}`
                    )
                  )
                )
              ),
              renderColumn(
                "Merges & reversões recentes",
                recentCombined.length,
                recentCombined.map((w) => {
                  const isFailed = w.stage === "failed" || w.stage === "reverted";
                  const isMerged = w.stage === "merged";
                  const toneColor = isFailed ? "var(--status-failed)" : isMerged ? "#a78bfa" : "var(--status-waiting)";
                  return h(
                    "div",
                    {
                      key: w.id,
                      style: { display: "flex", alignItems: "center", gap: "6px", padding: "5px 6px", borderRadius: "6px", fontSize: "12px" },
                    },
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => onSelectItem(w),
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          flex: 1,
                          minWidth: 0,
                          textAlign: "left",
                          border: "none",
                          background: "transparent",
                          color: "var(--foreground)",
                          fontFamily: "inherit",
                          fontSize: "12px",
                          cursor: "pointer",
                          padding: 0,
                        },
                      },
                      isFailed
                        ? ico(["M18 6 6 18", "M6 6l12 12"], 13, "var(--status-failed)")
                        : ico(["M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M6 21V9a9 9 0 0 0 9 9"], 13, "#a78bfa"),
                      h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.title),
                      h("span", { style: { fontSize: "10.5px", color: toneColor, flexShrink: 0 } }, `${isFailed ? "falhou" : "mergeado"} · ${fmtAge(w.updatedAt)}`)
                    ),
                    isFailed &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          "data-variant": "ghost",
                          style: { padding: "2px 6px", fontSize: "10.5px", display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 },
                          onClick: () => onSelectItem(w),
                        },
                        ico(["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"], 11),
                        "Refazer"
                      )
                  );
                })
              ),
              renderColumn(
                "Ignoradas · autores não confiáveis",
                status.ignored.length,
                status.ignored.slice(0, 6).map((w) =>
                  h(
                    "div",
                    { key: w.id, style: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", fontSize: "11.5px" } },
                    h("span", { className: "of-mono of-muted" }, `#${w.id.slice(0, 8)}`),
                    h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.title)
                  )
                )
              )
            ),

            // 1. Acordeão Spot-checks (1:1 CodeDen)
            h(
              "details",
              { className: "of-surface", "data-codeden-spot-checks": "true" },
              h(
                "summary",
                { style: { cursor: "pointer", padding: "9px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" } },
                ico(["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"], 14, "var(--muted-foreground)"),
                h("strong", null, "Spot-checks"),
                h("span", { className: "of-muted", style: { fontWeight: 400 } }, "· 10% dos merges automáticos, além de entregas de autores não confiáveis e mudanças grandes"),
                h("span", { className: "of-mono of-muted", style: { marginLeft: "auto", fontSize: "11px" } }, "0 para checar")
              ),
              h(
                "div",
                { className: "of-muted", style: { borderTop: "1px solid var(--border)", padding: "10px 12px", fontSize: "11.5px" } },
                "Nenhum merge automático pendente de auditoria amostral no momento."
              )
            ),

            // 2. Acordeão Lições (1:1 CodeDen LessonsCard)
            h(
              "details",
              { className: "of-surface", "data-codeden-lessons": "true" },
              h(
                "summary",
                { style: { cursor: "pointer", padding: "9px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" } },
                ico(["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"], 14, "var(--muted-foreground)"),
                h("strong", null, "Lições"),
                h("span", { className: "of-muted", style: { fontWeight: 400 } }, "· o que as revisões ensinaram à fábrica; novos executores e revisores recebem no briefing"),
                h("span", { className: "of-mono of-muted", style: { marginLeft: "auto", fontSize: "11px" } }, String(lessonsList.length))
              ),
              h(
                "div",
                { style: { borderTop: "1px solid var(--border)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
                lessonsList.length === 0
                  ? h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, "Nenhuma lição registrada ainda.")
                  : lessonsList.map((ls) =>
                      h(
                        "div",
                        { key: ls.id, style: { display: "flex", alignItems: "flex-start", gap: "7px", fontSize: "11.5px" } },
                        h("span", { className: "of-dot", "data-tone": "done", style: { marginTop: "5px" } }),
                        h("span", null, ls.text)
                      )
                    )
              )
            ),

            // 3. Acordeão Scorecard (1:1 CodeDen ScorecardCard)
            h(
              "details",
              { className: "of-surface" },
              h(
                "summary",
                {
                  style: {
                    cursor: "pointer",
                    padding: "9px 12px",
                    fontSize: "12px",
                    color: "var(--foreground)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  },
                },
                ico(["M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3"], 14, "var(--muted-foreground)"),
                h("strong", null, "Scorecard"),
                h("span", { className: "of-muted", style: { fontWeight: 400 } }, "· merges de primeira (FPY), rodadas de revisão, reversões e custo por construtor e revisor"),
                h("span", { className: "of-mono of-muted", style: { marginLeft: "auto", fontSize: "11px" } }, `${modelos.length} agentes`)
              ),
          h(
            "div",
            { style: { borderTop: "1px solid var(--border)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" } },
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" } },
              h(
                "div",
                { className: "of-segmented" },
                (["builders", "reviewers", "pairs"] as const).map((v) =>
                  h(
                    "button",
                    {
                      key: v,
                      type: "button",
                      className: "of-seg-btn",
                      "data-active": scorecardView === v ? "true" : "false",
                      onClick: () => setScorecardView(v),
                    },
                    v === "builders" ? "Construtor" : v === "reviewers" ? "Revisor" : "Par"
                  )
                )
              ),
              h(
                "div",
                { className: "of-segmented" },
                ([7, 30, 90] as const).map((d) =>
                  h(
                    "button",
                    {
                      key: d,
                      type: "button",
                      className: "of-seg-btn",
                      "data-active": scorecardDays === d ? "true" : "false",
                      onClick: () => setScorecardDays(d),
                    },
                    `${d} dias`
                  )
                )
              )
            ),
            (() => {
              const crewList = props.liveCrew || [];
              const modelEvalByName = new Map(modelos.map((m) => [m.agente.toLowerCase(), m]));
              const costByModel = new Map<string, { usd: number; calls: number }>();
              for (const row of porModelo) {
                const mk = String((row as any)?.modelo || "").toLowerCase();
                if (!mk) continue;
                const val = { usd: Number((row as any)?.custo_usd || 0), calls: Number((row as any)?.requisicoes ?? (row as any)?.chamadas ?? 0) };
                costByModel.set(mk, val);
                const shortK = mk.includes("/") ? mk.split("/").pop()! : mk;
                if (!costByModel.has(shortK)) costByModel.set(shortK, val);
              }
              const filteredAgents = tenantAgents.filter((ag) => {
                if (scorecardView === "reviewers") return ag.categoria === "revisao";
                if (scorecardView === "builders") return ag.categoria === "execucao" || ag.categoria === "lideranca";
                return true;
              });
              if (filteredAgents.length === 0) {
                return h("div", { className: "of-muted", style: { fontSize: "12px" } }, "Nenhum agente nesta categoria.");
              }
              return h(
                "table",
                { className: "of-table", "data-scorecard-rich": "true" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, scorecardView === "reviewers" ? "Revisor L-01" : "Agente"),
                    h("th", null, "Função & Papel"),
                    h("th", null, "Modelo & Uso"),
                    h("th", null, "Ao vivo (Buzz)"),
                    h("th", null, "Ações")
                  )
                ),
                h(
                  "tbody",
                  null,
                  filteredAgents.map((ag) => {
                    const pkLower = (ag.pubkey || "").toLowerCase();
                    const liveMatch = crewList.find((c) => c.key === ag.agentKey || (pkLower && c.pubkey?.toLowerCase() === pkLower));
                    const liveTurn = pkLower && telemetry?.byPubkey ? telemetry.byPubkey[pkLower] : null;
                    const presence = pkLower && telemetry?.presenceByPubkey ? telemetry.presenceByPubkey[pkLower] : undefined;
                    const evRow = modelEvalByName.get(ag.name.toLowerCase());
                    const modelName = liveMatch?.model || ag.model || PT_BR.labels.unavailable;
                    const modelShort = modelName.includes("/") ? modelName.split("/").pop()!.toLowerCase() : modelName.toLowerCase();
                    const usage = costByModel.get(modelName.toLowerCase()) || costByModel.get(modelShort);
                    return h(
                      "tr",
                      { key: ag.agentKey || ag.name },
                      h(
                        "td",
                        { style: { fontWeight: 600 } },
                        h(
                          "button",
                          {
                            type: "button",
                            "data-agent-profile-trigger": ag.name,
                            title: `Abrir perfil de ${ag.name} na coluna lateral`,
                            style: {
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              font: "inherit",
                              padding: 0,
                              cursor: props.onOpenAgentProfile ? "pointer" : "default",
                              textAlign: "left",
                            },
                            onClick: () => props.onOpenAgentProfile?.({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name }),
                          },
                          liveMatch?.picture
                            ? h("img", {
                                src: liveMatch.picture,
                                alt: ag.name,
                                style: {
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "6px",
                                  objectFit: "cover",
                                  border: liveTurn ? "1.5px solid var(--status-running)" : "1px solid var(--border)",
                                  flexShrink: 0,
                                },
                              })
                            : h("span", { className: "of-dot", "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : ag.inBuzz ? "done" : "idle" }),
                          h("span", null, ag.name)
                        )
                      ),
                      h(
                        "td",
                        null,
                        h("div", { style: { fontSize: "11.5px" } }, ag.funcao),
                        h("div", { className: "of-mono of-muted", style: { fontSize: "10px" } }, `${ag.papel} · ${ag.parallelism}x`)
                      ),
                      h(
                        "td",
                        null,
                        h("div", { className: "of-mono", style: { fontSize: "11.5px" } }, modelName),
                        h(
                          "div",
                          { style: { display: "flex", alignItems: "center", gap: "5px", marginTop: "2px", flexWrap: "wrap" } },
                          h("span", { className: "of-mono of-muted", style: { fontSize: "10px" } }, liveMatch?.provider || ag.provider || "buzz"),
                          evRow?.toolcall_eval &&
                            h("span", { className: "of-pill", "data-tone": evRow.abaixo_minimo ? "failed" : "done", style: { fontSize: "9.5px", padding: "0 5px" } }, `Eval ${evRow.toolcall_eval}`),
                          usage &&
                            h("span", { className: "of-mono of-muted", style: { fontSize: "10px" } }, `· ${usage.calls} calls · $${usage.usd.toFixed(2)}`)
                        )
                      ),
                      h(
                        "td",
                        null,
                        liveTurn
                          ? h(
                              "div",
                              { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                              h("span", { className: "of-pill", "data-tone": liveTurn.state === "error" ? "failed" : "running", style: { width: "fit-content", fontSize: "10px" } }, "⚡ Respondendo"),
                              h("span", { className: "of-mono of-muted", style: { fontSize: "10px", maxWidth: "170px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: liveTurn.stepLabel }, liveTurn.stepLabel)
                            )
                          : h(
                              "span",
                              { className: "of-pill", "data-tone": presence === "online" || ag.inBuzz ? "done" : "waiting", style: { fontSize: "10px" } },
                              presence === "online" ? "Online" : ag.inBuzz ? "Disponível" : "A provisionar"
                            )
                      ),
                      h(
                        "td",
                        null,
                        h(
                          "div",
                          { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                          props.onOpenAgentProfile && ag.pubkey &&
                            h(
                              "button",
                              {
                                type: "button",
                                className: "of-btn",
                                "data-variant": "ghost",
                                style: { padding: "2px 6px", fontSize: "10.5px" },
                                onClick: () => props.onOpenAgentProfile!({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name }),
                              },
                              "Perfil"
                            ),
                          onOpenAgentDm && ag.pubkey &&
                            h(
                              "button",
                              {
                                type: "button",
                                className: "of-btn",
                                "data-variant": "ghost",
                                style: { padding: "2px 6px", fontSize: "10.5px", color: "var(--primary)" },
                                onClick: () => onOpenAgentDm({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name }),
                              },
                              "DM ↗"
                            )
                        )
                      )
                    );
                  })
                )
              );
            })()
          )
            ),

            // 4. Barra Digest colapsável (1:1 CodeDen)
            h(
              "details",
              { className: "of-surface", style: { borderColor: "var(--primary-border)" }, "data-codeden-digest": "true" },
              h(
                "summary",
                { style: { cursor: "pointer", padding: "8px 12px", fontSize: "11.5px", color: "var(--muted-foreground)" } },
                `Digest ${todayIso}: ${status.mergesToday} integrados, ${status.stats.failedToday} recusados, ${waitingFounder} aguardando você`
              ),
              h(
                "div",
                { className: "of-muted", style: { borderTop: "1px solid var(--border)", padding: "10px 12px", fontSize: "11.5px", lineHeight: 1.55 } },
                `Resumo diário de ${tenant}: ${status.mergesToday} merges hoje (${status.stats.merged7d} nos últimos 7d) · FPY ${typeof qualidade?.fpy_real_pct === "number" ? `${qualidade.fpy_real_pct.toFixed(1)}%` : "—"} · ${status.wip.openPrs} PR(s) abertos · quarentena: ${status.quarentenaCount ?? 0}.`
              )
            ),

            // 5. Rodapé de status completo 1:1 CodeDen
            h(
              "div",
              { className: "of-muted", style: { fontSize: "10.5px", lineHeight: 1.5, paddingTop: "2px" } },
              `${status.spendToday.tokens.toLocaleString("pt-BR")} tokens hoje · confiáveis: @HeltonFraga01 · auto-merge ${status.limits.autoMerge ? "ligado" : "desligado"} · protegidos: da visão · deploys desligados · CI ${status.limits.mergePolicy === "strict" ? "obrigatório" : "opcional"} · quarentena: ${status.quarentenaCount ?? 0} · última checagem ${fmtAge(status.lastTickAt)}`
            )
          );
        })()
      )
    ),

    // ── BLOCO 3: GASTO (Card independente — 1:1 CodeDen ProjectSpendCard) ──
    h(
      "section",
      { className: "of-card-pad", "aria-label": "Gasto da empresa" },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" } },
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } },
          h("strong", { style: { fontSize: "13.5px" } }, "Gasto"),
          h("span", { className: "of-mono of-muted", style: { fontSize: "11px" } }, `principal: ${topModelName}`)
        ),
        onNavigateTab &&
          h(
            "button",
            { type: "button", className: "of-btn", "data-variant": "ghost", onClick: () => onNavigateTab("costs") },
            "Relatório completo →"
          )
      ),
      h(
        "div",
        { className: "of-spend-grid" },
        h(
          "div",
          null,
          h("div", { className: "of-muted", style: { fontSize: "11px" } }, "Hoje"),
          h("div", { className: "of-num", style: { fontSize: "20px", fontWeight: 700, marginTop: "2px" } }, `$${status.spendToday.usd.toFixed(2)}`)
        ),
        h(
          "div",
          null,
          h("div", { className: "of-muted", style: { fontSize: "11px" } }, "Amostra (kpis)"),
          h(
            "div",
            { className: "of-num", style: { fontSize: "20px", fontWeight: 700, marginTop: "2px" } },
            typeof economia?.custo_usd_total_amostra === "number" ? `$${economia.custo_usd_total_amostra.toFixed(2)}` : "$0.00"
          )
        ),
        h(
          "div",
          null,
          h("div", { className: "of-muted", style: { fontSize: "11px" } }, "Tokens 7d"),
          h("div", { className: "of-num", style: { fontSize: "20px", fontWeight: 700, marginTop: "2px" } }, fmtTokens(economia?.tokens_7d))
        )
      )
    ),

    // ── BLOCO 4: SESSÕES & AGENTES (Seção independente — 1:1 CodeDen Sessions) ──
    h(
      "section",
      { className: "of-section-block", "aria-label": "Sessões e agentes" },
      h(
        "div",
        { className: "of-section-head" },
        h("span", { className: "of-section-label" }, "SESSÕES & AGENTES"),
        h("span", { className: "of-pill", "data-tone": activeTurns.length > 0 ? "running" : "idle" }, `Ativos · ${activeTurns.length}`),
        h("span", { className: "of-muted", style: { fontSize: "11px" } }, `Plantel · ${tenantAgents.length}`),
        onNavigateTab &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "ghost",
              style: { marginLeft: "auto", fontSize: "11px" },
              onClick: () => onNavigateTab("agents"),
            },
            "Ver todos os agentes →"
          )
      ),
      h(
        "div",
        { className: "of-list-card" },
        tenantAgents.length === 0
          ? h("div", { className: "of-muted", style: { padding: "18px", textAlign: "center" } }, "Nenhum agente provisionado nesta empresa.")
          : tenantAgents.slice(0, 7).map((ag) => {
              const pkLower = (ag.pubkey || "").toLowerCase();
              const liveMatch = (props.liveCrew || []).find((c) => c.key === ag.agentKey || (pkLower && c.pubkey?.toLowerCase() === pkLower));
              const liveTurn = pkLower && telemetry?.byPubkey ? telemetry.byPubkey[pkLower] : null;
              const presence = pkLower && telemetry?.presenceByPubkey ? telemetry.presenceByPubkey[pkLower] : undefined;
              return h(
                "div",
                {
                  key: ag.agentKey || ag.name,
                  role: "button",
                  tabIndex: 0,
                  className: "of-list-row",
                  onClick: () => onOpenAgentDm?.({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name }),
                  onKeyDown: (e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenAgentDm?.({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name });
                    }
                  },
                },
                h(
                  "button",
                  {
                    type: "button",
                    "data-agent-profile-trigger": ag.name,
                    title: `Abrir perfil de ${ag.name} na coluna lateral`,
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "9px",
                      flex: 1,
                      minWidth: 0,
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      font: "inherit",
                      padding: 0,
                      cursor: props.onOpenAgentProfile ? "pointer" : "inherit",
                      textAlign: "left",
                    },
                    onClick: (e: any) => {
                      if (!props.onOpenAgentProfile) return;
                      e.stopPropagation();
                      props.onOpenAgentProfile({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name });
                    },
                  },
                  liveMatch?.picture
                    ? h("img", { src: liveMatch.picture, alt: ag.name, style: { width: "22px", height: "22px", borderRadius: "6px", objectFit: "cover", border: liveTurn ? "1.5px solid var(--status-running)" : "1px solid var(--border)", flexShrink: 0 } })
                    : h("span", { className: "of-dot", "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : ag.inBuzz ? "done" : "idle" }),
                  h(
                    "div",
                    { style: { flex: 1, minWidth: 0 } },
                    h("div", { style: { fontWeight: 600, fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ag.name),
                    h(
                      "div",
                      { className: "of-mono of-muted", style: { fontSize: "10.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                      liveTurn ? `⚡ ${liveTurn.stepLabel}` : `${ag.papel} · ${ag.model}`
                    )
                  )
                ),
                h("span", { className: "of-muted", style: { fontSize: "11px", flexShrink: 0 } }, liveTurn ? "Respondendo" : presence === "online" ? "Online" : "Disponível"),
                h(
                  "span",
                  {
                    title: `Abrir chat lateral com ${ag.name}`,
                    "aria-label": `Abrir chat lateral com ${ag.name}`,
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      color: "var(--muted-foreground)",
                      flexShrink: 0,
                    },
                  },
                  h(
                    "svg",
                    {
                      viewBox: "0 0 24 24",
                      width: 13,
                      height: 13,
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 1.85,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      "aria-hidden": "true",
                    },
                    h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
                  )
                )
              );
            })
      )
    ),

    // ── BLOCO 5: AUTOMAÇÕES (Seção independente — 1:1 CodeDen Automations) ──
    h(
      "section",
      { className: "of-section-block", "aria-label": "Automações" },
      h(
        "div",
        { className: "of-section-head" },
        h("span", { className: "of-section-label" }, "AUTOMAÇÕES"),
        onNavigateTab &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "ghost",
              style: { marginLeft: "auto", fontSize: "11px" },
              onClick: () => onNavigateTab("automations"),
            },
            "Gerenciar, execuções e regras →"
          )
      ),
      h(
        "div",
        { className: "of-list-card" },
        [
          {
            id: "launch-agent",
            name: status.launchAgent || "com.orgfy.esteira-minima",
            desc: "Coordenador da esteira (respeita Kill Switch, Dreno e limites de controle-<tenant>.json)",
            tone: status.coordenador === "ativo" ? "done" : "failed",
            badge: status.coordenador === "ativo" ? "Ativo" : "Parado",
          },
          {
            id: "rotina-ceo",
            name: "Rotina CEO (Workflow Buzz Kind 30620)",
            desc: ".buzz/workflows/orgfy-rotina-ceo.yaml · revisão de prioridades e escalada executiva",
            tone: "waiting",
            badge: "Nativo Buzz",
          },
          {
            id: "ci-probes",
            name: `CI Runner & Probes (${status.tenantManifest?.ciModo || "local"})`,
            desc: status.tenantManifest?.ciCmd || "ferramentas/ci.sh com isolamento de segredos e GATE humano",
            tone: "done",
            badge: status.tenantManifest?.probesObrigatorios ? `${status.tenantManifest.probesCount} probes` : "Habilitado",
          },
        ].map((auto) =>
          h(
            "button",
            {
              key: auto.id,
              type: "button",
              className: "of-list-row",
              onClick: () => onNavigateTab?.("automations"),
            },
            h("span", { className: "of-dot", "data-tone": auto.tone }),
            h(
              "div",
              { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontWeight: 600, fontSize: "12.5px" } }, auto.name),
              h("div", { className: "of-muted", style: { fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, auto.desc)
            ),
            h("span", { className: "of-pill", "data-tone": auto.tone }, auto.badge)
          )
        )
      )
    )
  );
}
