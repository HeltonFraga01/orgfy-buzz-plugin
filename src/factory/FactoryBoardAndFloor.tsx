// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/factory-view.tsx, components/factory-view/pipeline-board.tsx, stats-strip.tsx, view-header.tsx, view-card.tsx, item-sheet.tsx, floor/roster.tsx, scene/layout.ts, scene/lookout.ts
// Visão completa da Fábrica: ViewHeader, StatsStrip (6 tiles), Board 6 colunas + Faixa "Precisa de você", Andar 2 pisos (Oficina + Mirante) com Roster lateral e drawer ItemSheet.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "./buzz-live-telemetry";
import type { LiveRepoEntityDetail } from "../services/buzz-repos-live";
import { PT_BR } from "../i18n/pt-BR";

export interface LiveCrewAgent {
  key: string;
  pubkey?: string;
  name: string;
  picture?: string;
  model: string;
  provider: string;
  instructions?: string;
  config?: Record<string, any>;
  configBase?: any;
  running: boolean;
}

export interface BoardAndFloorProps {
  h: any;
  tenant: string;
  status: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  viewMode: "board" | "floor";
  onChangeViewMode: (m: "board" | "floor") => void;
  storeyFocus: "workshop" | "lookout" | "both" | "tower";
  onChangeStoreyFocus: (s: "workshop" | "lookout" | "both" | "tower") => void;
  selectedAgentKey: string | null;
  onSelectAgentKey: (k: string | null) => void;
  onSelectItem: (item: FactoryWorkItem) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenAgentProfileNative?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenTurnInSideChat?: (turn: LiveAgentTurn) => void;
  onRunScout?: () => void;
  runningScout?: boolean;
  onToggleKillSwitch?: (next: boolean) => void;
  onOpenGuide?: () => void;
  onRefresh: () => void;
  loading: boolean;
  Floor3D?: any;
  VirtualOffice3D?: any;
  holding?: any;
  onEnterTowerFloor?: (slug: string) => void;
  onOpenChannelInBuzz?: (slug: string) => void;
  isBoardTenant?: boolean;
  Boardroom3D?: any;
  boardroomSeats?: Array<{ id: string; label: string; role: string; status: "active" | "working" | "planned"; onClick?: () => void }>;
}

const BOARD_STAGES: Array<{ id: string; label: string; hint: string }> = [
  { id: "intake", label: "Entrada", hint: "Issues novas no relay NIP-34 e itens retidos." },
  { id: "classify", label: "Identificar tipo", hint: "Classificação Bug / Feature / Docs via Decisions." },
  { id: "building", label: "Executando", hint: "Agentes implementando em worktrees isoladas." },
  { id: "reviewing", label: "Revisando (L-01)", hint: "Revisor independente validando diff, CI e aceite L-22." },
  { id: "merge", label: "Fila de merge", hint: "PRs aprovados aguardando merge na main." },
  { id: "merged", label: "Integrado", hint: "Entregas integradas recentemente na main." },
];

const LOOKOUT_AREAS = [
  { id: "features", label: "Features" },
  { id: "ux", label: "UI & UX" },
  { id: "performance", label: "Performance" },
  { id: "tech_debt", label: "Qualidade" },
  { id: "test_gaps", label: "Testes" },
  { id: "security", label: "Segurança" },
  { id: "bugs", label: "Bugs" },
  { id: "docs", label: "Docs" },
];

function stageOfItem(item: FactoryWorkItem): string {
  if (item.stage === "merged") return "merged";
  if (item.step === "merge" || item.stage === "watching") return "merge";
  if (item.stage === "verifying" || String(item.step).includes("review")) return "reviewing";
  if (item.stage === "building") return "building";
  if (item.stage === "candidate" || item.step === "intake") return "classify";
  return "intake";
}

function cardStateOf(item: FactoryWorkItem): "running" | "person" | "failed" | "idle" {
  if (item.stage === "failed" || item.stage === "reverted") return "failed";
  if (item.stage === "escalated") return "person";
  if (item.stage === "building" || item.stage === "verifying" || item.stage === "watching") return "running";
  return "idle";
}

export function renderFactoryBoardAndFloor(props: BoardAndFloorProps) {
  const {
    h,
    tenant,
    status,
    liveCrew,
    viewMode,
    onChangeViewMode,
    storeyFocus,
    onChangeStoreyFocus,
    selectedAgentKey,
    onSelectAgentKey,
    onSelectItem,
    onRefresh,
    loading,
  } = props;

  const allItems = [...status.backlog, ...status.inProgress, ...status.recent];
  const needsYou = allItems.filter((i) => i.stage === "escalated" || i.stage === "failed" || i.stage === "reverted");
  const failedCount = allItems.filter((i) => i.stage === "failed" || i.stage === "reverted").length;
  const qualidade = status.kpis?.qualidade || null;
  const budgetUsd = status.limits.dailyBudget?.usd ?? 50;

  const byStage: Record<string, FactoryWorkItem[]> = {
    intake: [],
    classify: [],
    building: [],
    reviewing: [],
    merge: [],
    merged: [],
  };
  for (const item of allItems) {
    const st = stageOfItem(item);
    if (byStage[st]) byStage[st].push(item);
  }

  const statTiles = [
    {
      label: "Gasto hoje",
      value: `$${status.spendToday.usd.toFixed(2)}`,
      detail: `de $${budgetUsd}`,
      pct: budgetUsd > 0 ? Math.min(100, (status.spendToday.usd / budgetUsd) * 100) : 0,
      color: "var(--primary)",
    },
    {
      label: "Merges (7d)",
      value: String(status.stats.merged7d),
      detail: `hoje: ${status.mergesToday}`,
      pct: Math.min(100, (status.mergesToday / Math.max(1, status.limits.maxMergesPerDay)) * 100),
      color: "var(--status-done)",
    },
    {
      label: "FPY real",
      value: typeof qualidade?.fpy_real_pct === "number" ? `${qualidade.fpy_real_pct.toFixed(1)}%` : PT_BR.labels.unavailable,
      detail: typeof qualidade?.pct_desconhecido === "number" ? `${qualidade.pct_desconhecido.toFixed(0)}% sem hist.` : "",
      pct: typeof qualidade?.fpy_real_pct === "number" ? qualidade.fpy_real_pct : 0,
      color: "var(--status-done)",
    },
    {
      label: "Agentes da empresa",
      value: `${(status.tenantManifest?.agentes || []).filter((a) => a.running).length}/${(status.tenantManifest?.agentes || []).length || liveCrew.length}`,
      detail: `${(status.tenantManifest?.agentes || []).filter((a) => a.inBuzz).length} no Buzz`,
      pct: Math.min(100, ((status.tenantManifest?.agentes || []).filter((a) => a.running).length / Math.max(1, status.limits.maxConcurrentSessions)) * 100),
      color: "var(--status-running)",
    },
    {
      label: "PRs abertos",
      value: `${status.wip.openPrs}/${status.wip.limit}`,
      detail: status.wip.holding ? "segurando fila" : "livre",
      pct: Math.min(100, (status.wip.openPrs / Math.max(1, status.wip.limit)) * 100),
      color: "var(--status-running)",
    },
    {
      label: "Quarentena / Falhas",
      value: String((status.quarentenaCount ?? 0) + failedCount),
      detail: `falhas seguidas: ${status.consecutiveFailures}`,
      pct: Math.min(100, (status.consecutiveFailures / Math.max(1, status.limits.pauseAfterConsecutiveFailures)) * 100),
      color: failedCount > 0 ? "var(--status-failed)" : "var(--status-idle)",
    },
  ];

  const selectedAgent = liveCrew.find((a) => a.key === selectedAgentKey) || null;

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0, height: viewMode === "floor" ? "100%" : undefined } },
    // 1. ViewHeader (view-header.tsx)
    h(
      "div",
      { className: "of-card-pad", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        h("span", { className: "of-brand-icon" }, props.isBoardTenant ? "◈" : "⚙"),
        h(
          "div",
          null,
          h("div", { style: { fontSize: "14px", fontWeight: 700 } }, props.isBoardTenant ? "Conselho da Holding · Sala de Reunião & Pautas" : `Visão da Fábrica · ${tenant}`),
          h("div", { className: "of-muted", style: { fontSize: "11px" } }, props.isBoardTenant ? "Governança · 6 Comitês + Bestie (OrgFy Iris)" : (PT_BR.modes[status.mode] || status.mode))
        )
      ),
      h(
        "span",
        { className: "of-pill", "data-tone": needsYou.length > 0 ? "waiting" : "idle" },
        `${needsYou.length} precisam de você`
      ),
      h(
        "span",
        { className: "of-pill", "data-tone": failedCount > 0 ? "failed" : "idle" },
        `${failedCount} falhas`
      ),
      h(
        "div",
        { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        viewMode === "floor" &&
          h(
            "div",
            { className: "of-segmented", role: "radiogroup", "aria-label": "Andares da fábrica" },
            (props.isBoardTenant
              ? ([
                  { id: "both", label: "Sala 3D" },
                  { id: "tower", label: "Escritório 3D" },
                ] as const)
              : ([
                  { id: "workshop", label: "Oficina" },
                  { id: "lookout", label: "Mirante" },
                  { id: "both", label: "Ambos" },
                  { id: "tower", label: "Escritório 3D" },
                ] as const)
            ).map((st) =>
              h(
                "button",
                {
                  key: st.id,
                  type: "button",
                  className: "of-seg-btn",
                  "data-active": storeyFocus === st.id ? "true" : "false",
                  onClick: () => onChangeStoreyFocus(st.id),
                },
                st.label
              )
            )
          ),
        h(
          "div",
          { className: "of-segmented", role: "radiogroup", "aria-label": "Modo de visualização" },
          h(
            "button",
            {
              type: "button",
              className: "of-seg-btn",
              "data-active": viewMode === "board" ? "true" : "false",
              onClick: () => onChangeViewMode("board"),
            },
            props.isBoardTenant ? "Pautas" : "Board"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-seg-btn",
              "data-active": viewMode === "floor" ? "true" : "false",
              onClick: () => onChangeViewMode("floor"),
            },
            props.isBoardTenant ? "Sala 3D" : "Andar"
          )
        ),
        props.onRunScout &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-run-scout-now": "true",
              disabled: props.runningScout,
              title: props.isBoardTenant
                ? "Acionar Conselho CPO no #Conselho-Canal para auditar o portfólio contra a Visão e abrir pauta com os conselheiros"
                : "Disparar auditoria imediata do Oráculo (Scout) contra o Canvas/Visão",
              onClick: props.onRunScout,
            },
            props.isBoardTenant
              ? (props.runningScout ? "Conselho CPO…" : "Pauta CPO")
              : (props.runningScout ? "Oráculo…" : "Oráculo")
          ),
        props.onToggleKillSwitch &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": status.killSwitch ? "primary" : "danger",
              onClick: () => props.onToggleKillSwitch!(!status.killSwitch),
            },
            status.killSwitch ? "Retomar" : "Kill switch"
          ),
        props.onOpenGuide &&
          h(
            "button",
            {
              type: "button",
              className: "of-icon-circle-btn",
              "data-factory-guide-trigger": "true",
              title: "Como funciona o loop da Fábrica OrgFy",
              "aria-label": "Como funciona o loop da Fábrica OrgFy",
              onClick: props.onOpenGuide,
            },
            h("span", { style: { fontSize: "13px", fontWeight: 700, lineHeight: 1 } }, "?")
          ),
        h(
          "button",
          {
            type: "button",
            className: "of-icon-circle-btn",
            "data-factory-refresh-icon": "true",
            title: loading ? "Atualizando..." : "Atualizar agora",
            "aria-label": "Atualizar agora",
            onClick: onRefresh,
          },
          h(
            "svg",
            {
              width: 14,
              height: 14,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              className: loading ? "of-spin" : undefined,
              "aria-hidden": "true",
            },
            h("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
            h("path", { d: "M21 3v6h-6" })
          )
        )
      )
    ),

    // 2. StatsStrip (exibido no Board; oculto no Andar 3D para o 3D preencher 100% da tela, igual ao CodeDen)
    viewMode === "board" &&
      h(
        "div",
        { className: "of-stats-6" },
        statTiles.map((t) =>
          h(
            "div",
            { key: t.label, className: "of-card-pad", style: { padding: "10px 12px" } },
            h("div", { className: "of-meter-label" }, t.label),
            h(
              "div",
              { style: { display: "flex", alignItems: "baseline", gap: "6px", marginTop: "3px" } },
              h("span", { className: "of-num", style: { fontSize: "17px", fontWeight: 700 } }, t.value),
              t.detail && h("span", { className: "of-muted", style: { fontSize: "10.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t.detail)
            ),
            h(
              "div",
              { className: "of-bar-track" },
              h("div", { className: "of-bar-fill", style: { width: `${t.pct}%`, background: t.color } })
            )
          )
        )
      ),

    // 3. Conteúdo: Board 6 colunas OU Andar 2 pisos (Oficina + Mirante)
    viewMode === "board"
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          // Faixa "Precisa de você" (NeedsYou)
          needsYou.length === 0
            ? h("div", { className: "of-muted", style: { padding: "2px 4px" } }, "👤 Nada esperando por você agora.")
            : h(
                "section",
                { className: "of-needs-you" },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--status-waiting)" } },
                  h("span", null, `👤 Precisa de você (${needsYou.length})`),
                  h("span", { className: "of-muted", style: { fontWeight: 400 } }, "Itens parados, escalados ou aguardando decisão humana")
                ),
                h(
                  "div",
                  { className: "of-grid-3" },
                  needsYou.map((item) =>
                    h(
                      "button",
                      {
                        key: item.id,
                        type: "button",
                        className: "of-view-card",
                        "data-state": cardStateOf(item),
                        onClick: () => onSelectItem(item),
                      },
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "6px" } },
                        h("span", { className: "of-mono", style: { fontSize: "11px", color: "var(--status-waiting)" } }, `#${item.id.slice(0, 8)}`),
                        h("span", { className: "of-pill", "data-tone": "waiting" }, item.stage)
                      ),
                      h("div", { style: { fontSize: "12px", fontWeight: 600 } }, item.title),
                      item.reason && h("div", { className: "of-muted", style: { fontSize: "11px" } }, item.reason)
                    )
                  )
                )
              ),

          // 6 Colunas (pipeline-board.tsx)
          h(
            "div",
            { className: "of-board-6" },
            BOARD_STAGES.map((stage) => {
              const items = byStage[stage.id] || [];
              return h(
                "section",
                { key: stage.id, className: "of-stage-col" },
                h(
                  "header",
                  { className: "of-stage-head", title: stage.hint },
                  h("span", null, stage.label),
                  h("span", { className: "of-pill of-num" }, String(items.length))
                ),
                h(
                  "div",
                  { style: { padding: "8px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 } },
                  items.length === 0
                    ? h("div", { className: "of-muted", style: { fontSize: "11px", padding: "6px 4px" } }, "Nada aqui")
                    : items.slice(0, 20).map((item) => {
                        const st = cardStateOf(item);
                        return h(
                          "button",
                          {
                            key: item.id,
                            type: "button",
                            className: "of-view-card",
                            "data-state": st,
                            onClick: () => onSelectItem(item),
                          },
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", gap: "5px" } },
                            h("span", { className: "of-dot", "data-tone": st === "person" ? "waiting" : st }),
                            h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px" } }, `#${item.id.slice(0, 8)}`),
                            item.type && h("span", { className: "of-pill", style: { padding: "0 5px", fontSize: "9.5px" } }, item.type),
                            item.attempts > 1 && h("span", { className: "of-pill", "data-tone": "waiting", style: { marginLeft: "auto", padding: "0 5px", fontSize: "9.5px" } }, `↻${item.attempts}`)
                          ),
                          h("div", { style: { fontSize: "12px", fontWeight: 600, lineHeight: 1.3 } }, item.title),
                          h("div", { className: "of-muted", style: { fontSize: "10.5px" } }, item.note || item.step || item.stage)
                        );
                      })
                )
              );
            })
          )
        )
      : storeyFocus === "tower" && props.VirtualOffice3D
        ? h(props.VirtualOffice3D, {
            holding: props.holding,
            liveCrew,
            telemetry: props.telemetry,
            status,
            activeTenant: tenant,
            tenantLabel: props.isBoardTenant ? "Conselho" : tenant,
            onSelectTenant: (slug: string) => {
              props.onEnterTowerFloor?.(slug);
            },
            onOpenAgentDm: (ag: any) => props.onOpenAgentDm?.(ag),
            onOpenTurnInSideChat: (turn: LiveAgentTurn) => props.onOpenTurnInSideChat?.(turn),
            onOpenAgentProfile: (ag: { key?: string; pubkey?: string; name?: string }) => {
              if (props.onOpenAgentProfileNative) props.onOpenAgentProfileNative(ag);
              else if (ag.key) onSelectAgentKey(ag.key);
            },
          })
        : props.isBoardTenant && props.Boardroom3D
        ? h(props.Boardroom3D, {
            seats: props.boardroomSeats || [],
            title: "Sala de Reunião do Conselho · Conselheiros & Bestie (OrgFy Iris)",
            fullHeight: true,
            status,
            holding: props.holding,
            liveCrew,
            telemetry: props.telemetry,
            onOpenAgentDm: (ag: any) => props.onOpenAgentDm?.(ag),
            onOpenTurnInSideChat: (turn: LiveAgentTurn) => props.onOpenTurnInSideChat?.(turn),
            onOpenAgentProfile: (ag: { key?: string; pubkey?: string; name?: string }) => {
              if (props.onOpenAgentProfileNative) props.onOpenAgentProfileNative(ag);
              else if (ag.key) onSelectAgentKey(ag.key);
            },
          })
        : // Modo Andar (Floor): Motor 3D Three.js 1:1 oficial do CodeDen isolado por empresa (key=tenant)
        props.Floor3D
        ? h(props.Floor3D, {
            key: tenant,
            tenant,
            status,
            liveCrew,
            telemetry: props.telemetry,
            focus: storeyFocus === "tower" ? "both" : storeyFocus,
            onSelectItem,
            onOpenAgentDm: (ag: any) => props.onOpenAgentDm?.(ag),
            onOpenTurnInSideChat: (turn: LiveAgentTurn) => props.onOpenTurnInSideChat?.(turn),
            onOpenAgentProfile: (ag: { key?: string; pubkey?: string; name?: string }) => {
              if (props.onOpenAgentProfileNative) props.onOpenAgentProfileNative(ag);
              else if (ag.key) onSelectAgentKey(ag.key);
            },
          })
        : h(
            "div",
            { className: "of-card-pad" },
            "Carregando Andar 3D..."
          )
  );
}

/** Drawer lateral ItemSheet (item-sheet.tsx) com Buzz Repos NIP-34 ao vivo, diff Git, comentários, Thread nativa e Deep Link direto */
export function renderItemSheetDrawer(props: {
  h: any;
  item: FactoryWorkItem | null;
  tenant: string;
  repoDetail?: LiveRepoEntityDetail | null;
  repoLoading?: boolean;
  resolveAuthor?: (pubkey: string) => string;
  EmbeddedThread?: any;
  threadChannelId?: string | null;
  relaySession?: any;
  relayScope?: string | null;
  onOpenCommitInBuzz?: (commit: string) => void;
  onClose: () => void;
  onOpenInBuzz?: (item: FactoryWorkItem) => void;
}) {
  const { h, item, tenant, repoDetail, repoLoading, resolveAuthor, EmbeddedThread, threadChannelId, relaySession, relayScope, onOpenCommitInBuzz, onClose, onOpenInBuzz } = props;
  if (!item) return null;

  const steps = ["Entrada", "Identificar tipo", "Execução (Worktree)", "Revisão L-01 + CI", "Merge na main"];
  const activeIdx =
    item.stage === "merged" ? 4 : item.stage === "verifying" || item.stage === "watching" ? 3 : item.stage === "building" ? 2 : item.stage === "candidate" ? 1 : 0;

  return h(
    "div",
    {
      className: "of-sheet-backdrop",
      "data-item-sheet-drawer": "true",
      onClick: (e: any) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    h(
      "aside",
      { className: "of-sheet-panel", style: { width: "min(540px, 95vw)" } },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
        h(
          "div",
          null,
          h("div", { className: "of-mono", style: { fontSize: "11px", color: "var(--primary)" } }, `#${item.id.slice(0, 12)} · ${tenant}`),
          h("div", { style: { fontSize: "15px", fontWeight: 700, marginTop: "2px" } }, repoDetail?.title || item.title)
        ),
        h("button", { type: "button", className: "of-btn", onClick: onClose }, "Fechar")
      ),
      h(
        "div",
        { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
        h("span", { className: "of-pill", "data-tone": cardStateOf(item) === "person" ? "waiting" : cardStateOf(item) }, repoDetail?.status || item.stage),
        item.type && h("span", { className: "of-pill" }, item.type),
        item.attempts > 1 && h("span", { className: "of-pill", "data-tone": "waiting" }, `Refazer rodada ${item.attempts}`),
        onOpenInBuzz &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "primary",
              style: { marginLeft: "auto" },
              onClick: () => onOpenInBuzz(item),
            },
            "Abrir direto no Buzz Repos ↗"
          )
      ),
      h(
        "section",
        { className: "of-surface", style: { padding: "10px 12px" } },
        h("div", { className: "of-meter-label", style: { marginBottom: "8px" } }, "Trilha da pipeline"),
        steps.map((label, idx) =>
          h(
            "div",
            {
              key: label,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 6px",
                borderRadius: "6px",
                background: idx === activeIdx ? "rgba(245,158,11,0.12)" : "transparent",
                fontSize: "12px",
                fontWeight: idx === activeIdx ? 600 : 400,
              },
            },
            h("span", { className: "of-dot", "data-tone": idx < activeIdx ? "done" : idx === activeIdx ? "running" : "idle" }),
            h("span", null, label)
          )
        )
      ),
      h(
        "section",
        { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span", { className: "of-muted" }, "Work key"), h("span", { className: "of-mono" }, item.workKey || "—")),
        h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span", { className: "of-muted" }, "Etapa"), h("span", { className: "of-mono" }, item.step || item.stage)),
        repoDetail?.authorPubkey &&
          h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span", { className: "of-muted" }, "Autor (NIP-34)"), h("span", null, resolveAuthor ? resolveAuthor(repoDetail.authorPubkey) : repoDetail.authorPubkey.slice(0, 12))),
        repoDetail?.commit &&
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { className: "of-muted" }, "Commit"),
            onOpenCommitInBuzz
              ? h("button", { type: "button", className: "of-btn", "data-variant": "ghost", style: { padding: "1px 6px", fontFamily: "var(--font-mono)", color: "var(--primary)" }, onClick: () => onOpenCommitInBuzz(repoDetail.commit!) }, `${repoDetail.commit.slice(0, 10)} ↗`)
              : h("span", { className: "of-mono" }, repoDetail.commit.slice(0, 10))
          ),
        item.reason && h("div", { style: { marginTop: "4px", color: "var(--status-waiting)" } }, `Motivo: ${item.reason}`),
        item.note && h("div", { className: "of-muted" }, `Nota: ${item.note}`)
      ),
      repoLoading && h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, "Carregando conteúdo NIP-34 e diff do Buzz Repos..."),
      repoDetail?.content &&
        h(
          "section",
          { className: "of-surface", style: { padding: "10px 12px" }, "data-buzz-repo-detail": "true" },
          h("div", { className: "of-meter-label", style: { marginBottom: "6px" } }, "Descrição (Buzz Repos NIP-34)"),
          h("pre", { className: "of-muted", style: { margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "11.5px", lineHeight: 1.5, maxHeight: "220px", overflowY: "auto" } }, repoDetail.content)
        ),
      repoDetail?.commitDiff &&
        h(
          "section",
          { className: "of-surface", style: { padding: "10px 12px" } },
          h("div", { className: "of-meter-label", style: { marginBottom: "6px" } }, `Diff do Commit (${repoDetail.commit?.slice(0, 8)})`),
          h("pre", { className: "of-mono", style: { margin: 0, whiteSpace: "pre", fontSize: "10.5px", lineHeight: 1.4, maxHeight: "200px", overflow: "auto" } }, repoDetail.commitDiff)
        ),
      repoDetail && repoDetail.comments.length > 0 &&
        h(
          "section",
          { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" } },
          h("div", { className: "of-meter-label" }, `Discussão NIP-34 (${repoDetail.comments.length})`),
          repoDetail.comments.slice(-8).map((c) =>
            h(
              "div",
              { key: c.id, style: { padding: "7px 9px", borderRadius: "7px", background: "var(--card)", border: "1px solid var(--border)", fontSize: "11.5px" } },
              h("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "10.5px" } },
                h("strong", null, resolveAuthor ? resolveAuthor(c.authorPubkey) : c.authorPubkey.slice(0, 10)),
                h("span", { className: "of-muted" }, c.createdAt ? new Date(c.createdAt).toLocaleString("pt-BR") : "")
              ),
              h("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.4 } }, c.content)
            )
          )
        ),
      EmbeddedThread && threadChannelId && relaySession && typeof relayScope === "string" && relayScope.length > 0 && /^[0-9a-f]{64}$/i.test(String(item.id || "")) &&
        h(
          "section",
          { className: "of-surface", style: { padding: "10px 12px", minHeight: "220px" }, "data-embedded-buzz-thread": "true" },
          h("div", { className: "of-meter-label", style: { marginBottom: "6px" } }, "Thread ao vivo no Buzz"),
          h(EmbeddedThread, {
            session: relaySession,
            scope: relayScope,
            channelId: threadChannelId,
            channelName: tenant,
            messageId: item.id,
          })
        )
    )
  );
}

/** Drawer de Perfil & Transcript ao Vivo do Agente (Andar 3D e aba Agentes) */
export function renderAgentProfileDrawer(props: {
  h: any;
  agent: LiveCrewAgent | null;
  liveTurn?: LiveAgentTurn | null;
  TranscriptComponent?: any;
  channelId?: string | null;
  onOpenDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onSessionAction?: (agentKey: string, action: "interrupt" | "compact" | "new") => void;
  onClose: () => void;
}) {
  const { h, agent, liveTurn, TranscriptComponent, channelId, onOpenDm, onSessionAction, onClose } = props;
  if (!agent) return null;

  return h(
    "div",
    {
      className: "of-sheet-backdrop",
      "data-agent-profile-drawer": "true",
      onClick: (e: any) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    h(
      "aside",
      { className: "of-sheet-panel", style: { width: "min(520px, 95vw)" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        agent.picture
          ? h("img", { src: agent.picture, alt: agent.name, style: { width: "38px", height: "38px", borderRadius: "10px", objectFit: "cover", border: "1px solid var(--border)" } })
          : h("span", { className: "of-brand-icon", style: { width: "38px", height: "38px", fontSize: "15px" } }, agent.name.charAt(0).toUpperCase()),
        h(
          "div",
          { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontSize: "15px", fontWeight: 700 } }, agent.name),
          h("div", { className: "of-mono of-muted", style: { fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, `${agent.provider || "buzz"} / ${agent.model}`)
        ),
        h("button", { type: "button", className: "of-btn", onClick: onClose }, "Fechar")
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" } },
        h("span", { className: "of-pill", "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : agent.running ? "done" : "idle" }, liveTurn ? `⚡ ${liveTurn.stepLabel}` : agent.running ? "Ativo" : "Disponível"),
        onOpenDm &&
          h("button", { type: "button", className: "of-btn", "data-variant": "primary", onClick: () => onOpenDm({ key: agent.key, pubkey: agent.pubkey, name: agent.name }) }, "DM lateral ↗"),
        onSessionAction && agent.key &&
          h("button", { type: "button", className: "of-btn", onClick: () => onSessionAction(agent.key, "compact") }, "Compactar"),
        onSessionAction && agent.key &&
          h("button", { type: "button", className: "of-btn", onClick: () => onSessionAction(agent.key, "new") }, "Nova sessão"),
        onSessionAction && agent.key &&
          h("button", { type: "button", className: "of-btn", "data-variant": "danger", onClick: () => onSessionAction(agent.key, "interrupt") }, "Parar")
      ),
      h(
        "section",
        { className: "of-surface", style: { padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }, "data-agent-transcript": "true" },
        h("div", { className: "of-meter-label" }, "Atividade & Turno ao vivo (session.agentActivity)"),
        liveTurn
          ? h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" } },
              h("div", { style: { fontWeight: 600, color: liveTurn.state === "error" ? "var(--status-failed)" : "var(--status-running)" } }, liveTurn.stepLabel),
              liveTurn.toolName && h("div", { className: "of-mono of-muted", style: { fontSize: "11px" } }, `Tool: ${liveTurn.toolName}${liveTurn.toolTarget ? ` · ${liveTurn.toolTarget}` : ""}`),
              liveTurn.error && h("div", { style: { color: "var(--status-failed)", fontSize: "11.5px" } }, liveTurn.error)
            )
          : h("div", { className: "of-muted", style: { fontSize: "12px" } }, "Nenhum turno em execução agora. Clique em DM lateral ↗ para conversar ou acompanhar o histórico completo no Buzz."),
        agent.instructions &&
          h(
            "details",
            { style: { marginTop: "4px" } },
            h("summary", { className: "of-muted", style: { cursor: "pointer", fontSize: "11px" } }, "Instructions NIP-AP ativas"),
            h("pre", { className: "of-muted", style: { margin: "6px 0 0", whiteSpace: "pre-wrap", fontSize: "11px", maxHeight: "200px", overflowY: "auto", fontFamily: "inherit" } }, agent.instructions)
          )
      )
    )
  );
}
