// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory/FactoryApp.tsx
// Interface principal da OrgFy Factory em Shadow DOM com suporte multi-tenant (PRD v15 §7 e §9).

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
import { renderPipelineDiagram } from "./PipelineDiagram";
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

    // Formulário de limites reais em Configurações
    const [gastoDiaUsd, setGastoDiaUsd] = React.useState<number>(50);
    const [mergesDia, setMergesDia] = React.useState<number>(20);
    const [agentesMax, setAgentesMax] = React.useState<number>(4);
    const [falhasSeguidas, setFalhasSeguidas] = React.useState<number>(3);

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

    const refresh = React.useCallback(async (targetTenant = tenant) => {
      setLoading(true);
      const res = await fetchFactoryStatus(ctx, targetTenant);
      setStatus(res.status);
      setError(res.error);
      setGastoDiaUsd(res.status.limits.dailyBudget?.usd ?? 50);
      setMergesDia(res.status.limits.maxMergesPerDay ?? 20);
      setAgentesMax(res.status.limits.maxConcurrentSessions ?? 4);
      setFalhasSeguidas(res.status.limits.pauseAfterConsecutiveFailures ?? 3);
      setLoading(false);
    }, [tenant]);

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

    const liveCrew = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const runningSet = new Set((snap.running || []).map((a: any) => String(a?.key || a?.name)));
        const list = (snap.agents || []).map((a: any) => ({
          key: String(a?.key || a?.name || ""),
          name: String(a?.name || a?.key || "Agente"),
          model: a?.config?.model || PT_BR.labels.unavailable,
          provider: a?.config?.provider || "",
          running: runningSet.has(String(a?.key || a?.name)),
        }));
        return list;
      } catch {
        return [];
      }
    }, [status.lastTickAt]);

    const qualidade = status.kpis?.qualidade || null;
    const economia = status.kpis?.economia || null;
    const fluxo = status.kpis?.fluxo || null;
    const modelos = status.modelos || [];
    const abaixoMinimoCount = modelos.filter((m) => m.abaixo_minimo).length;

    const navItems: Array<{ id: FactoryTab; label: string; badge?: string }> = [
      { id: "holding", label: PT_BR.nav.holding },
      { id: "inbox", label: PT_BR.nav.inbox, badge: status.held.length ? String(status.held.length) : undefined },
      { id: "overview", label: PT_BR.nav.overview },
      { id: "board", label: PT_BR.nav.board, badge: String(status.backlog.length + status.inProgress.length) },
      { id: "floor", label: PT_BR.nav.floor, badge: String(liveCrew.filter((c: any) => c.running).length) },
      { id: "costs", label: PT_BR.nav.costs },
      { id: "automations", label: PT_BR.nav.automations },
      { id: "agents", label: PT_BR.nav.agents, badge: abaixoMinimoCount > 0 ? `⚠ ${abaixoMinimoCount}` : undefined },
      { id: "vision", label: PT_BR.nav.vision },
      { id: "settings", label: PT_BR.nav.settings },
    ];

    const renderOverview = () =>
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "14px" } },
        // Cabeçalho e barra de ações
        h(
          "div",
          { className: "of-card of-header-bar" },
          h(
            "div",
            null,
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              h("strong", { style: { fontSize: "16px" } }, `${PT_BR.appTitle} · ${tenant}`),
              h(
                "span",
                { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "ok" : "danger" },
                status.coordenador === "ativo" ? PT_BR.labels.coordinatorActive : PT_BR.labels.coordinatorStopped
              ),
              h("span", { className: "of-pill", "data-tone": "warn" }, PT_BR.modes[status.mode] || status.mode),
              status.killSwitch && h("span", { className: "of-pill", "data-tone": "danger" }, "KILL SWITCH ATIVO")
            ),
            status.pausedReason &&
              h("div", { className: "of-muted", style: { marginTop: "4px" } }, `Motivo: ${status.pausedReason}`)
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h(
              "button",
              { type: "button", className: "of-btn", onClick: () => refresh(tenant), disabled: loading },
              loading ? "Atualizando..." : PT_BR.actions.checkNow
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                onClick: () =>
                  handleControlUpdate(
                    { drain: !status.drain },
                    status.drain ? "Dreno cancelado." : "Modo Dreno ativado (termina os itens em andamento)."
                  ),
              },
              status.drain ? PT_BR.actions.drainOff : PT_BR.actions.drainOn
            ),
            !confirmKill
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "danger",
                    onClick: () => {
                      if (status.killSwitch) {
                        handleControlUpdate({ killSwitch: false, pausedReason: null }, "Kill Switch liberado.");
                      } else {
                        setConfirmKill(true);
                      }
                    },
                  },
                  status.killSwitch ? PT_BR.actions.killSwitchOff : PT_BR.actions.killSwitchOn
                )
              : h(
                  "div",
                  { style: { display: "flex", gap: "6px", alignItems: "center" } },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "danger",
                      onClick: async () => {
                        setConfirmKill(false);
                        await handleControlUpdate(
                          { killSwitch: true, pausedReason: "Kill Switch acionado pelo operador" },
                          "Kill Switch ativado imediatamente."
                        );
                      },
                    },
                    "Confirmar Kill Switch"
                  ),
                  h(
                    "button",
                    { type: "button", className: "of-btn", onClick: () => setConfirmKill(false) },
                    "Cancelar"
                  )
                )
          )
        ),

        // KPIs reais (de kpis-esteira.json — zero números inventados)
        h(
          "div",
          { className: "of-kpi-grid" },
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, PT_BR.labels.fpyReal),
            h(
              "div",
              { className: "of-kpi-value" },
              typeof qualidade?.fpy_real_pct === "number" ? `${qualidade.fpy_real_pct.toFixed(1)}%` : PT_BR.labels.unavailable
            ),
            h(
              "div",
              { className: "of-kpi-sub" },
              typeof qualidade?.pct_desconhecido === "number"
                ? `${PT_BR.labels.unknownHistory}: ${qualidade.pct_desconhecido.toFixed(1)}%`
                : PT_BR.labels.unavailable
            )
          ),
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, PT_BR.labels.merges7d),
            h("div", { className: "of-kpi-value" }, String(status.stats.merged7d)),
            h("div", { className: "of-kpi-sub" }, `${PT_BR.labels.mergesToday}: ${status.mergesToday}`)
          ),
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, PT_BR.labels.spendToday),
            h("div", { className: "of-kpi-value" }, `$${status.spendToday.usd.toFixed(2)}`),
            h("div", { className: "of-kpi-sub" }, `${status.spendToday.tokens.toLocaleString("pt-BR")} tokens`)
          ),
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, PT_BR.labels.quarantine),
            h("div", { className: "of-kpi-value" }, String(status.quarentenaCount ?? 0)),
            h("div", { className: "of-kpi-sub" }, `WIP ativo: ${status.inProgress.length}`)
          )
        ),

        // Diagrama de Pipelines ao vivo (prioridade #1)
        renderPipelineDiagram({
          h,
          status,
          activeHelpKey,
          onToggleHelp: setActiveHelpKey,
          onSelectItem: handleSelectItem,
        }),

        // Transparência de fontes indisponíveis
        status.indisponivel.length > 0 &&
          h(
            "div",
            { className: "of-card", style: { fontSize: "11.5px", color: "var(--muted-foreground)" } },
            `Fontes indisponíveis neste tenant (exibidas como "${PT_BR.labels.unavailable}"): ${status.indisponivel.join(", ")}`
          )
      );

    const renderBoard = () => {
      const cols: Array<{ title: string; items: FactoryWorkItem[] }> = [
        { title: "Triagem / Backlog", items: status.backlog },
        { title: "Executando", items: status.inProgress.filter((i) => i.stage === "building") },
        { title: "Revisando (Gate L-01)", items: status.inProgress.filter((i) => i.stage === "verifying" || i.stage === "watching") },
        { title: "Integrado recente", items: status.recent.filter((i) => i.stage === "merged").slice(0, 12) },
      ];
      return h(
        "div",
        { className: "of-board-grid" },
        cols.map((col) =>
          h(
            "div",
            { key: col.title, className: "of-card", style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700 } },
              h("span", null, col.title),
              h("span", { className: "of-mono of-muted" }, String(col.items.length))
            ),
            col.items.length === 0
              ? h("div", { className: "of-muted" }, PT_BR.labels.noItems)
              : col.items.map((item) =>
                  h(
                    "button",
                    {
                      key: item.id,
                      type: "button",
                      onClick: () => handleSelectItem(item),
                      style: {
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--card-elevated)",
                        color: "var(--foreground)",
                        cursor: "pointer",
                      },
                    },
                    h("div", { className: "of-mono", style: { fontSize: "11px", color: "var(--primary)" } }, `#${item.id.slice(0, 8)}`),
                    h("div", { style: { fontSize: "12px", fontWeight: 600, marginTop: "2px" } }, item.title)
                  )
                )
          )
        )
      );
    };

    const renderFloor = () =>
      h(
        "div",
        { className: "of-card", style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Andar da Fábrica · Equipe ao vivo"),
        h(
          "div",
          { className: "of-floor-grid" },
          liveCrew.length === 0
            ? h("div", { className: "of-muted" }, "Nenhum agente reportado por ctx.agents.snapshot().")
            : liveCrew.map((agent: any) =>
                h(
                  "div",
                  {
                    key: agent.key,
                    className: "of-node",
                    "data-empty": agent.running ? "false" : "true",
                  },
                  h(
                    "div",
                    { className: "of-node-head" },
                    h("span", { className: "of-node-title" }, agent.name),
                    h("span", { className: "of-pill", "data-tone": agent.running ? "ok" : "muted" }, agent.running ? "Ativo" : "Ocioso")
                  ),
                  h("div", { className: "of-mono of-muted", style: { fontSize: "11px" } }, `${agent.provider ? `${agent.provider}/` : ""}${agent.model}`)
                )
              )
        )
      );

    const renderCosts = () => {
      const porModelo = Array.isArray(economia?.por_modelo) ? economia.por_modelo : [];
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "div",
          { className: "of-kpi-grid" },
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, "Custo amostra (USD)"),
            h(
              "div",
              { className: "of-kpi-value" },
              typeof economia?.custo_usd_total_amostra === "number"
                ? `$${economia.custo_usd_total_amostra.toFixed(2)}`
                : PT_BR.labels.unavailable
            )
          ),
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, "Cache hit"),
            h(
              "div",
              { className: "of-kpi-value" },
              typeof economia?.cache_hit_ratio_pct === "number"
                ? `${economia.cache_hit_ratio_pct.toFixed(1)}%`
                : PT_BR.labels.unavailable
            )
          ),
          h(
            "div",
            { className: "of-card" },
            h("div", { className: "of-kpi-label" }, "Tokens (7d)"),
            h(
              "div",
              { className: "of-kpi-value" },
              typeof economia?.tokens_7d === "number"
                ? economia.tokens_7d.toLocaleString("pt-BR")
                : PT_BR.labels.unavailable
            )
          )
        ),
        h(
          "div",
          { className: "of-card" },
          h("div", { style: { fontSize: "13px", fontWeight: 700, marginBottom: "8px" } }, "Quebra real por modelo (kpis-esteira.json)"),
          porModelo.length === 0
            ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
            : h(
                "table",
                { className: "of-table" },
                h(
                  "thead",
                  null,
                  h("tr", null, h("th", null, "Modelo"), h("th", null, "Chamadas"), h("th", null, "Custo USD"), h("th", null, "Cache"))
                ),
                h(
                  "tbody",
                  null,
                  porModelo.slice(0, 15).map((row: any, idx: number) =>
                    h(
                      "tr",
                      { key: `${row.modelo || idx}` },
                      h("td", { className: "of-mono" }, String(row.modelo || PT_BR.labels.unavailable)),
                      h("td", { className: "of-mono" }, String(row.requisicoes ?? row.chamadas ?? PT_BR.labels.unavailable)),
                      h("td", { className: "of-mono" }, typeof row.custo_usd === "number" ? `$${row.custo_usd.toFixed(3)}` : PT_BR.labels.unavailable),
                      h("td", { className: "of-mono" }, typeof row.cache_hit_pct === "number" ? `${row.cache_hit_pct.toFixed(1)}%` : PT_BR.labels.unavailable)
                    )
                  )
                )
              )
        )
      );
    };

    const renderAgents = () =>
      h(
        "div",
        { className: "of-card" },
        h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "8px" } }, PT_BR.labels.modelsTitle),
        h(
          "div",
          { className: "of-muted", style: { marginBottom: "10px" } },
          "Agentes com nota de tool call abaixo de 8/10 no eval R5.1 ficam destacados em vermelho."
        ),
        modelos.length === 0
          ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
          : h(
              "table",
              { className: "of-table" },
              h(
                "thead",
                null,
                h("tr", null, h("th", null, "Agente"), h("th", null, "Papel"), h("th", null, "Modelo"), h("th", null, "Eval Tool Call"))
              ),
              h(
                "tbody",
                null,
                modelos.map((m) =>
                  h(
                    "tr",
                    { key: m.agente },
                    h("td", { style: { fontWeight: 600 } }, m.agente),
                    h("td", null, m.papel || "—"),
                    h("td", { className: "of-mono" }, m.modelo || PT_BR.labels.unavailable),
                    h(
                      "td",
                      null,
                      h(
                        "span",
                        {
                          className: "of-pill",
                          "data-tone": m.abaixo_minimo ? "danger" : m.toolcall_eval ? "ok" : "muted",
                        },
                        m.toolcall_eval
                          ? m.abaixo_minimo
                            ? `${m.toolcall_eval} · ${PT_BR.labels.evalBelowMin}`
                            : m.toolcall_eval
                          : PT_BR.labels.unavailable
                      )
                    )
                  )
                )
              )
            )
      );

    const renderSettings = () =>
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "div",
          { className: "of-card" },
          h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "8px" } }, "Modo de autonomia"),
          h(
            "div",
            { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
            (["manual", "assisted", "software_factory", "dark_factory"] as AutonomyMode[]).map((mode) =>
              h(
                "button",
                {
                  key: mode,
                  type: "button",
                  className: "of-btn",
                  "data-variant": status.mode === mode ? "primary" : undefined,
                  onClick: () => handleControlUpdate({ mode }, `Modo alterado para ${PT_BR.modes[mode]}.`),
                },
                PT_BR.modes[mode]
              )
            )
          )
        ),
        h(
          "div",
          { className: "of-card", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h("div", { style: { fontSize: "14px", fontWeight: 700 } }, PT_BR.labels.limitsTitle),
          h(
            "div",
            { className: "of-kpi-grid" },
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" } },
              "Gasto/dia (USD)",
              h("input", {
                type: "number",
                value: gastoDiaUsd,
                onChange: (e: any) => setGastoDiaUsd(Number(e.target.value)),
                className: "of-tenant-select",
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" } },
              "Merges/dia",
              h("input", {
                type: "number",
                value: mergesDia,
                onChange: (e: any) => setMergesDia(Number(e.target.value)),
                className: "of-tenant-select",
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" } },
              "Agentes simultâneos",
              h("input", {
                type: "number",
                value: agentesMax,
                onChange: (e: any) => setAgentesMax(Number(e.target.value)),
                className: "of-tenant-select",
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" } },
              "Pausar após falhas seguidas",
              h("input", {
                type: "number",
                value: falhasSeguidas,
                onChange: (e: any) => setFalhasSeguidas(Number(e.target.value)),
                className: "of-tenant-select",
              })
            )
          ),
          h(
            "div",
            null,
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                onClick: () =>
                  handleControlUpdate(
                    { limits: { gastoDiaUsd, mergesDia, agentes: agentesMax, falhasSeguidas } },
                    `Limites salvos em controle-${tenant}.json.`
                  ),
              },
              "Salvar limites"
            )
          )
        )
      );

    const renderSimpleTab = () => {
      if (tab === "holding") {
        return h(
          "div",
          { className: "of-card" },
          h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "8px" } }, "Holding Cortexx · Empresas"),
          h(
            "div",
            { className: "of-kpi-grid" },
            TENANT_OPTIONS.map((t) =>
              h(
                "button",
                {
                  key: t.id,
                  type: "button",
                  className: "of-card",
                  style: { textAlign: "left", cursor: "pointer", color: "var(--foreground)" },
                  onClick: () => {
                    setTenant(t.id);
                    setTab("overview");
                  },
                },
                h("div", { style: { fontWeight: 700, fontSize: "13px" } }, t.label),
                h("div", { className: "of-mono of-muted", style: { marginTop: "4px" } }, t.id)
              )
            )
          )
        );
      }
      if (tab === "inbox") {
        return h(
          "div",
          { className: "of-card" },
          h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "8px" } }, "Inbox · Aguardando sua decisão"),
          status.held.length === 0
            ? h("div", { className: "of-muted" }, "Nenhuma pendência bloqueando a fábrica agora.")
            : h("pre", { className: "of-mono", style: { fontSize: "11px" } }, JSON.stringify(status.held, null, 2))
        );
      }
      if (tab === "automations") {
        return h(
          "div",
          { className: "of-card", style: { display: "flex", flexDirection: "column", gap: "8px" } },
          h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Automações & LaunchAgents"),
          h("div", { className: "of-mono", style: { fontSize: "12px" } }, `Coordenador (${status.launchAgent || "com.orgfy.esteira-minima"}): ${status.coordenador}`),
          h("div", { className: "of-muted" }, "Rotina CEO: configurar/verificar no Buzz Desktop (canal #esteira-orgfy).")
        );
      }
      return h(
        "div",
        { className: "of-card" },
        h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "6px" } }, "Visão do produto (docs/VISION.md)"),
        h(
          "div",
          { className: "of-muted" },
          status.visionExists
            ? "docs/VISION.md encontrado no repositório do tenant."
            : "docs/VISION.md não encontrado ainda (indisponível)."
        )
      );
    };

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
        h(
          "aside",
          { className: "of-sidebar" },
          h(
            "div",
            { className: "of-brand" },
            h("span", { className: "of-brand-title" }, PT_BR.appTitle),
            h("span", { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "ok" : "danger" }, status.coordenador)
          ),
          h(
            "div",
            { className: "of-tenant-picker" },
            h(
              "select",
              {
                className: "of-tenant-select",
                value: tenant,
                onChange: (e: any) => setTenant(e.target.value),
              },
              TENANT_OPTIONS.map((t) => h("option", { key: t.id, value: t.id }, t.label))
            )
          ),
          h(
            "nav",
            { className: "of-nav" },
            navItems.map((item) =>
              h(
                "button",
                {
                  key: item.id,
                  type: "button",
                  className: "of-nav-btn",
                  "data-active": tab === item.id ? "true" : "false",
                  onClick: () => setTab(item.id),
                },
                h("span", null, item.label),
                item.badge && h("span", { className: "of-mono", style: { fontSize: "10.5px" } }, item.badge)
              )
            )
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
        h(
          "main",
          { className: "of-main" },
          toast && h("div", { className: "of-pill", "data-tone": "ok", style: { alignSelf: "flex-end" } }, toast),
          error && h("div", { className: "of-pill", "data-tone": "danger" }, `Aviso: ${error}`),
          selectedItem &&
            h(
              "div",
              { className: "of-card of-header-bar" },
              h(
                "div",
                null,
                h("span", { className: "of-mono", style: { color: "var(--primary)", marginRight: "8px" } }, `#${selectedItem.id.slice(0, 8)}`),
                h("strong", null, selectedItem.title),
                h("span", { className: "of-muted", style: { marginLeft: "8px" } }, `(${selectedItem.stage})`)
              ),
              h("button", { type: "button", className: "of-btn", onClick: () => setSelectedItem(null) }, "Fechar")
            ),
          tab === "overview"
            ? renderOverview()
            : tab === "board"
            ? renderBoard()
            : tab === "floor"
            ? renderFloor()
            : tab === "costs"
            ? renderCosts()
            : tab === "agents"
            ? renderAgents()
            : tab === "settings"
            ? renderSettings()
            : renderSimpleTab()
        )
      )
    );
  };
}
