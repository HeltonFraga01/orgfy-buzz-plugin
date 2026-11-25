// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/factory-view.tsx, components/factory-view/pipeline-board.tsx, stats-strip.tsx, view-header.tsx, view-card.tsx, item-sheet.tsx, floor/roster.tsx, scene/layout.ts, scene/lookout.ts
// Visão completa da Fábrica: ViewHeader, StatsStrip (6 tiles), Board 6 colunas + Faixa "Precisa de você", Andar 2 pisos (Oficina + Mirante) com Roster lateral e drawer ItemSheet.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import { PT_BR } from "../i18n/pt-BR";

export interface LiveCrewAgent {
  key: string;
  name: string;
  model: string;
  provider: string;
  running: boolean;
}

export interface BoardAndFloorProps {
  h: any;
  tenant: string;
  status: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  viewMode: "board" | "floor";
  onChangeViewMode: (m: "board" | "floor") => void;
  storeyFocus: "workshop" | "lookout" | "both";
  onChangeStoreyFocus: (s: "workshop" | "lookout" | "both") => void;
  selectedAgentKey: string | null;
  onSelectAgentKey: (k: string | null) => void;
  onSelectItem: (item: FactoryWorkItem) => void;
  onRefresh: () => void;
  loading: boolean;
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
      label: "Agentes ativos",
      value: `${liveCrew.filter((a) => a.running).length}/${status.limits.maxConcurrentSessions}`,
      detail: `${liveCrew.length} no plantel`,
      pct: Math.min(100, (liveCrew.filter((a) => a.running).length / Math.max(1, status.limits.maxConcurrentSessions)) * 100),
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
    { style: { display: "flex", flexDirection: "column", gap: "12px" } },
    // 1. ViewHeader (view-header.tsx)
    h(
      "div",
      { className: "of-card-pad", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        h("span", { className: "of-brand-icon" }, "⚙"),
        h(
          "div",
          null,
          h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Visão da Fábrica · ${tenant}`),
          h("div", { className: "of-muted", style: { fontSize: "11px" } }, PT_BR.modes[status.mode] || status.mode)
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
            ([
              { id: "workshop", label: "Oficina" },
              { id: "lookout", label: "Mirante" },
              { id: "both", label: "Ambos" },
            ] as const).map((st) =>
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
            "Board"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-seg-btn",
              "data-active": viewMode === "floor" ? "true" : "false",
              onClick: () => onChangeViewMode("floor"),
            },
            "Andar"
          )
        ),
        h("button", { type: "button", className: "of-btn", onClick: onRefresh, disabled: loading }, loading ? "..." : "Atualizar")
      )
    ),

    // 2. StatsStrip (stats-strip.tsx — 6 tiles)
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
      : // Modo Andar (Floor): Roster lateral + Oficina (6 zonas + Baia de Reparo + Cabine PM) + Mirante (8 pods)
        h(
          "div",
          { className: "of-floor-shell" },
          // Roster lateral esquerdo (floor/roster.tsx)
          h(
            "aside",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 700 } },
              h("span", null, "Plantel ao vivo"),
              h("span", { className: "of-mono of-muted" }, `${liveCrew.filter((c) => c.running).length}/${liveCrew.length}`)
            ),
            liveCrew.length === 0
              ? h("div", { className: "of-muted" }, "Nenhum agente reportado por ctx.agents.snapshot().")
              : liveCrew.map((agent) =>
                  h(
                    "button",
                    {
                      key: agent.key,
                      type: "button",
                      className: "of-nav-btn",
                      "data-active": selectedAgentKey === agent.key ? "true" : "false",
                      onClick: () => onSelectAgentKey(selectedAgentKey === agent.key ? null : agent.key),
                    },
                    h(
                      "span",
                      { style: { display: "inline-flex", alignItems: "center", gap: "6px", overflow: "hidden" } },
                      h("span", { className: "of-dot", "data-tone": agent.running ? "running" : "idle" }),
                      h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, agent.name)
                    ),
                    h("span", { className: "of-mono", style: { fontSize: "9.5px", opacity: 0.7 } }, agent.running ? "ativo" : "livre")
                  )
                )
          ),

          // Planta da Fábrica (Oficina + Mirante)
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 } },
            selectedAgent &&
              h(
                "div",
                { className: "of-card-pad", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", borderColor: "rgba(245,158,11,0.45)" } },
                h(
                  "div",
                  null,
                  h("div", { style: { fontSize: "13px", fontWeight: 700 } }, selectedAgent.name),
                  h("div", { className: "of-mono of-muted" }, `${selectedAgent.provider ? `${selectedAgent.provider}/` : ""}${selectedAgent.model} · ${selectedAgent.running ? "Trabalhando agora" : "Ocioso na bancada"}`)
                ),
                h("button", { type: "button", className: "of-btn", onClick: () => onSelectAgentKey(null) }, "Fechar")
              ),

            (storeyFocus === "workshop" || storeyFocus === "both") &&
              h(
                "section",
                { className: "of-floor-hall" },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("strong", { style: { fontSize: "12.5px", letterSpacing: "0.04em", textTransform: "uppercase" } }, "Piso 1 · Oficina (Workshop)"),
                  h("span", { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "done" : "failed" }, `Coordenador: ${status.coordenador}`)
                ),
                h(
                  "div",
                  { className: "of-floor-zones" },
                  BOARD_STAGES.map((z) => {
                    const zoneItems = byStage[z.id] || [];
                    return h(
                      "div",
                      { key: z.id, className: "of-zone-bay" },
                      h(
                        "div",
                        { style: { display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", textTransform: "uppercase" } },
                        h("span", null, z.label),
                        h("span", null, String(zoneItems.length))
                      ),
                      zoneItems.length === 0
                        ? h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "auto" } }, "Bancadas livres")
                        : zoneItems.slice(0, 4).map((w) =>
                            h(
                              "button",
                              {
                                key: w.id,
                                type: "button",
                                className: "of-chip",
                                onClick: () => onSelectItem(w),
                                style: { width: "100%", justifyContent: "flex-start" },
                              },
                              h("span", { className: "of-dot", "data-tone": cardStateOf(w) === "person" ? "waiting" : cardStateOf(w) }),
                              h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, `#${w.id.slice(0, 6)}`)
                            )
                          )
                    );
                  })
                ),
                // Baia de Reparo (scene/repair-bay.ts) + Cabine do PM
                h(
                  "div",
                  { className: "of-grid-2" },
                  h(
                    "div",
                    { className: "of-repair-bay" },
                    h("div", { style: { fontSize: "11px", fontWeight: 700, color: "var(--status-waiting)", textTransform: "uppercase", letterSpacing: "0.05em" } }, `Baia de Reparo · ${needsYou.length} caixas`),
                    h(
                      "div",
                      { className: "of-muted", style: { marginTop: "4px" } },
                      needsYou.length === 0
                        ? "Nenhum item parado aguardando retry ou decisão humana."
                        : needsYou.slice(0, 3).map((i) => `#${i.id.slice(0, 8)} (${i.stage})`).join(" · ")
                    )
                  ),
                  h(
                    "div",
                    { className: "of-surface", style: { padding: "10px 12px" } },
                    h("div", { style: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Cabine do PM / COO"),
                    h("div", { className: "of-muted", style: { marginTop: "4px" } }, "Triagem de cards, despacho L-01 e supervisão de quarentena.")
                  )
                )
              ),

            (storeyFocus === "lookout" || storeyFocus === "both") &&
              h(
                "section",
                { className: "of-floor-hall" },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("strong", { style: { fontSize: "12.5px", letterSpacing: "0.04em", textTransform: "uppercase" } }, "Piso 2 · Mirante (Lookout / Oráculo)"),
                  h("span", { className: "of-pill", "data-tone": status.mode === "dark_factory" ? "running" : "idle" }, status.mode === "dark_factory" ? "Dark Factory ativo" : "Sob demanda")
                ),
                h(
                  "div",
                  { className: "of-lookout-pods" },
                  LOOKOUT_AREAS.map((area) =>
                    h(
                      "div",
                      { key: area.id, className: "of-surface", style: { padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" } },
                      h("span", { style: { fontSize: "11.5px", fontWeight: 600 } }, area.label),
                      h("span", { className: "of-dot", "data-tone": status.mode === "dark_factory" ? "waiting" : "idle" })
                    )
                  )
                )
              )
          )
        )
  );
}

/** Drawer lateral ItemSheet (item-sheet.tsx) com StepTrail, Fatos e Checks */
export function renderItemSheetDrawer(props: {
  h: any;
  item: FactoryWorkItem | null;
  tenant: string;
  onClose: () => void;
}) {
  const { h, item, tenant, onClose } = props;
  if (!item) return null;

  const steps = ["Entrada", "Identificar tipo", "Execução (Worktree)", "Revisão L-01 + CI", "Merge na main"];
  const activeIdx =
    item.stage === "merged" ? 4 : item.stage === "verifying" || item.stage === "watching" ? 3 : item.stage === "building" ? 2 : item.stage === "candidate" ? 1 : 0;

  return h(
    "div",
    {
      className: "of-sheet-backdrop",
      onClick: (e: any) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    h(
      "aside",
      { className: "of-sheet-panel" },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
        h(
          "div",
          null,
          h("div", { className: "of-mono", style: { fontSize: "11px", color: "var(--primary)" } }, `#${item.id.slice(0, 12)} · ${tenant}`),
          h("div", { style: { fontSize: "15px", fontWeight: 700, marginTop: "2px" } }, item.title)
        ),
        h("button", { type: "button", className: "of-btn", onClick: onClose }, "Fechar")
      ),
      h(
        "div",
        { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
        h("span", { className: "of-pill", "data-tone": cardStateOf(item) === "person" ? "waiting" : cardStateOf(item) }, item.stage),
        item.type && h("span", { className: "of-pill" }, item.type),
        item.attempts > 1 && h("span", { className: "of-pill", "data-tone": "waiting" }, `Refazer rodada ${item.attempts}`)
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
        h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span", { className: "of-muted" }, "Sessão ativa"), h("span", { className: "of-mono" }, item.activeSessionId || "—")),
        item.reason && h("div", { style: { marginTop: "4px", color: "var(--status-waiting)" } }, `Motivo: ${item.reason}`),
        item.note && h("div", { className: "of-muted" }, `Nota: ${item.note}`)
      )
    )
  );
}
