// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory/factory-panel.tsx, factory-columns.tsx, scorecard-card.tsx
// Painel Visão Geral completo da Fábrica: Header, Alerta, Pipelines, 5 Meters, PRs, 3 Colunas (Checks | Recentes | Ignoradas), Scorecard, Lições, Digest e Rodapé.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import { PT_BR } from "../i18n/pt-BR";
import { renderPipelineDiagram } from "./PipelineDiagram";

export interface FactoryOverviewProps {
  h: any;
  tenant: string;
  status: FactoryStatusPayload;
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
            padding: "7px 12px",
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
    "section",
    { className: "of-card" },
    // 1. Header da Fábrica (factory-panel.tsx)
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
          h("span", null, `${PT_BR.modes[status.mode] || status.mode} · ${tenant}`),
          status.experimental && h("span", { className: "of-exp-badge" }, "experimental"),
          h(
            "span",
            { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "done" : "failed" },
            status.coordenador === "ativo" ? PT_BR.labels.coordinatorActive : PT_BR.labels.coordinatorStopped
          )
        ),
        h(
          "div",
          { className: "of-muted", style: { marginTop: "2px" } },
          status.mode === "dark_factory"
            ? "O Oráculo e issues confiáveis alimentam as pipelines; "
            : "Issues NIP-34 confiáveis alimentam as pipelines; ",
          status.limits.autoMerge ? "a OrgFy faz merge quando todos os checks passam." : "você e o Revisor L-01 aprovam os PRs."
        )
      ),
      h(
        "div",
        { style: { marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" } },
        h("button", { type: "button", className: "of-btn", onClick: onOpenBoard }, "Abrir Visão da Fábrica"),
        h(
          "button",
          { type: "button", className: "of-btn", onClick: onRefresh, disabled: loading },
          loading ? "Verificando..." : PT_BR.actions.checkNow
        ),
        h(
          "button",
          { type: "button", className: "of-btn", "data-variant": "ghost", onClick: onOpenSettings },
          "Configurações"
        ),
        h(
          "button",
          { type: "button", className: "of-btn", "data-variant": "ghost", onClick: onOpenVision },
          "Visão"
        ),
        h(
          "button",
          { type: "button", className: "of-btn", onClick: onToggleDrain },
          status.drain ? PT_BR.actions.drainOff : PT_BR.actions.drainOn
        ),
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

    // 2. Corpo do Painel
    h(
      "div",
      { className: "of-panel-body" },
      // Banner de alerta condicional (apenas bloqueios reais de operação — sem exigir docs/VISION.md do CodeDen)
      (status.globalKillSwitch || status.pausedReason) &&
        h(
          "div",
          { className: "of-alert-banner" },
          h("span", { style: { color: "var(--status-waiting)", fontWeight: 700 } }, "⚠"),
          h(
            "span",
            { style: { flex: 1 } },
            status.globalKillSwitch
              ? "Kill switch global ativado: nenhuma fábrica da Holding está rodando."
              : `Pausado: ${status.pausedReason}`
          )
        ),

      // Seção Pipelines ao vivo
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
            status.wip.holding &&
              h(
                "span",
                { className: "of-pill", "data-tone": "waiting" },
                `Finalizando trabalho aberto (${status.wip.openPrs}/${status.wip.limit} PRs)`
              ),
            status.drain && !stopped
              ? h("span", { className: "of-pill", "data-tone": "waiting" }, `Drenando: ${status.drain.inFlight} em andamento`)
              : h("span", { className: "of-pill", "data-tone": loopTone }, `Loop ${loopLabel.toLowerCase()}`)
          )
        ),
        renderPipelineDiagram({ h, status, activeHelpKey, onToggleHelp, onSelectItem })
      ),

      // 5 Meters com barras de progresso (factory-panel.tsx)
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
          label: "Agentes trabalhando",
          value: status.activeSessions,
          max: status.limits.maxConcurrentSessions,
          display: `${status.activeSessions} / ${status.limits.maxConcurrentSessions}`,
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
              label: "FPY real (sem hist.: " + (typeof qualidade?.pct_desconhecido === "number" ? `${qualidade.pct_desconhecido.toFixed(0)}%` : "n/d") + ")",
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

      // 3 Colunas (Checks de Merge | Merges & Reversões Recentes | Ignoradas)
      h(
        "div",
        { className: "of-grid-3" },
        renderColumn(
          "Checks de merge (CI + L-01 + L-22)",
          status.mergeChecks.length,
          status.mergeChecks.slice(0, 6).map((c: any, idx: number) =>
            h(
              "div",
              { key: idx, style: { padding: "6px 8px", borderRadius: "6px", background: "var(--card)", fontSize: "11.5px" } },
              h("span", { className: "of-mono", style: { color: "var(--primary)", marginRight: "6px" } }, `#${c.prNumber || idx}`),
              h("span", null, c.title || "Check")
            )
          )
        ),
        renderColumn(
          "Merges & reversões recentes",
          status.recent.length,
          status.recent.slice(0, 8).map((w) =>
            h(
              "button",
              {
                key: w.id,
                type: "button",
                onClick: () => onSelectItem(w),
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: "11.5px",
                },
              },
              h("span", { className: "of-dot", "data-tone": w.stage === "merged" ? "done" : w.stage === "failed" ? "failed" : "waiting" }),
              h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.title),
              h("span", { className: "of-mono of-muted", style: { fontSize: "10px" } }, w.stage)
            )
          )
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

      // Scorecard colapsável (scorecard-card.tsx)
      h(
        "details",
        { className: "of-surface", open: true },
        h(
          "summary",
          {
            style: {
              cursor: "pointer",
              padding: "8px 12px",
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--muted-foreground)",
            },
          },
          "Scorecard da Fábrica · FPY real, eval R5.1 de tool call e custo por modelo (kpis-esteira.json)"
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
          modelos.length === 0 && porModelo.length === 0
            ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
            : h(
                "table",
                { className: "of-table" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, scorecardView === "reviewers" ? "Revisor / Agente" : "Agente / Modelo"),
                    h("th", null, "Papel"),
                    h("th", null, "Modelo"),
                    h("th", null, "Eval R5.1"),
                    h("th", null, "Status")
                  )
                ),
                h(
                  "tbody",
                  null,
                  modelos.slice(0, 10).map((m) =>
                    h(
                      "tr",
                      { key: m.agente },
                      h("td", { style: { fontWeight: 600 } }, m.agente),
                      h("td", { className: "of-muted" }, m.papel || "—"),
                      h("td", { className: "of-mono" }, m.modelo || PT_BR.labels.unavailable),
                      h(
                        "td",
                        null,
                        h(
                          "span",
                          { className: "of-pill", "data-tone": m.abaixo_minimo ? "failed" : m.toolcall_eval ? "done" : "idle" },
                          m.toolcall_eval || PT_BR.labels.unavailable
                        )
                      ),
                      h(
                        "td",
                        null,
                        m.abaixo_minimo
                          ? h("span", { style: { color: "var(--status-failed)", fontWeight: 700, fontSize: "11px" } }, PT_BR.labels.evalBelowMin)
                          : h("span", { className: "of-muted" }, "OK")
                      )
                    )
                  )
                )
              )
        )
      ),

      // Rodapé de telemetria honesta (factory-panel.tsx)
      h(
        "div",
        { className: "of-muted", style: { fontSize: "10.5px", lineHeight: 1.5 } },
        `${status.spendToday.tokens.toLocaleString("pt-BR")} tokens hoje · auto-merge ${status.limits.autoMerge ? "ligado" : "desligado"} · política ${status.limits.mergePolicy} · quarentena: ${status.quarentenaCount ?? 0}`,
        status.indisponivel.length > 0 ? ` · indisponível: ${status.indisponivel.join(", ")}` : ""
      )
    )
  );
}
