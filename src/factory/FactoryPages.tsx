// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/inbox.tsx, reports/index.tsx, automations.tsx, agents.tsx, vision.tsx, components/factory/autonomy-dialog.tsx, limits-editor.tsx
// Páginas secundárias 100% adaptadas ao motor OrgFy: Conselho (Board), Inbox, Uso & Custos, Automações, Agentes por Empresa (com papel, modelo vivo e DM ↗), Canvas / Visão e Configurações.

import type { AutonomyMode, FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import type { HoldingControlPlaneSnapshot } from "../services/holding-service";
import { PT_BR } from "../i18n/pt-BR";

export interface FactorySecondaryPagesProps {
  h: any;
  tab: "holding" | "inbox" | "costs" | "automations" | "agents" | "vision" | "settings";
  tenant: string;
  holding: HoldingControlPlaneSnapshot | null;
  onSelectTenant: (t: string) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  status: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  onSelectItem: (item: FactoryWorkItem) => void;
  inboxFilter: "all" | "asks" | "reviews" | "problems";
  setInboxFilter: (f: "all" | "asks" | "reviews" | "problems") => void;
  costRange: "7d" | "30d" | "90d";
  setCostRange: (r: "7d" | "30d" | "90d") => void;
  autoTab: "automations" | "runs" | "templates";
  setAutoTab: (t: "automations" | "runs" | "templates") => void;
  agentTab: "eval" | "memory" | "skills" | "mcp" | "hooks";
  setAgentTab: (t: "eval" | "memory" | "skills" | "mcp" | "hooks") => void;
  settingsForm: {
    mode: AutonomyMode;
    autoMerge: boolean;
    mergePolicy: "fast" | "strict";
    gastoDiaUsd: number;
    mergesDia: number;
    agentesMax: number;
    prsAbertos: number;
    falhasSeguidas: number;
  };
  setSettingsForm: (patch: Partial<FactorySecondaryPagesProps["settingsForm"]>) => void;
  onSaveSettings: () => void;
  onSelectModeQuick: (mode: AutonomyMode) => void;
  onOpenChannelInBuzz?: () => void;
}

const CHART_COLORS = ["var(--chart-2)", "var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const AUTONOMY_MODES: Array<{
  id: AutonomyMode;
  label: string;
  summary: string;
  finds: string;
  merges: string;
  experimental: boolean;
}> = [
  {
    id: "manual",
    label: "Manual",
    summary: "Você conduz cada sessão. Automações só rodam quando você dispara.",
    finds: "Você",
    merges: "Você",
    experimental: false,
  },
  {
    id: "assisted",
    label: "Assistido",
    summary: "Você, o COO e automações encontram trabalho; você revisa e faz merge de cada PR.",
    finds: "Você, COO e automações",
    merges: "Você",
    experimental: false,
  },
  {
    id: "software_factory",
    label: "Fábrica de Software",
    summary: "Issues confiáveis entram nas raias Bug/Feature/Docs com worktrees isoladas, CI e Revisor L-01.",
    finds: "Você e autores confiáveis",
    merges: "Você (ou auto-merge)",
    experimental: true,
  },
  {
    id: "dark_factory",
    label: "Dark Factory",
    summary: "Fábrica de Software + Oráculo agendado revisando o workspace contra Canvas/PROJECT.md e abrindo issues.",
    finds: "Oráculo, você e confiáveis",
    merges: "Você (ou auto-merge)",
    experimental: true,
  },
];

function fmtTokens(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return PT_BR.labels.unavailable;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function renderFactorySecondaryPage(props: FactorySecondaryPagesProps) {
  const {
    h,
    tab,
    tenant,
    holding,
    onSelectTenant,
    onOpenAgentDm,
    status,
    liveCrew,
    onSelectItem,
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
    onSaveSettings,
    onSelectModeQuick,
  } = props;

  // ── 1. CONSELHO DA HOLDING (BOARD) — 100% REAL DE empresas/board.json + empresas/*.json ──
  if (tab === "holding") {
    const empresas = holding?.empresas || [];
    const boardAreas = holding?.conselho || [];
    const approvals = holding?.approvals || [];

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" } },
        h(
          "div",
          null,
          h("div", { style: { fontSize: "15px", fontWeight: 700 } }, "Conselho da Holding Cortexx · Portfólio Multi-Empresa"),
          h(
            "div",
            { className: "of-muted", style: { marginTop: "3px" } },
            `Fundador: ${holding?.fundador?.nome || "Helton Fraga"} · CEO Holding: ${holding?.ceoHolding?.nome || "OrgFy Iris"} · ${empresas.length} empresas no portfólio · ${approvals.filter((a) => a.status === "pendente").length} aprovação(ões) pendente(s)`
          )
        ),
        onOpenAgentDm &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "primary",
              onClick: () => onOpenAgentDm({ name: holding?.ceoHolding?.nome || "OrgFy Iris", pubkey: holding?.ceoHolding?.pubkey || "" }),
            },
            `Falar com ${holding?.ceoHolding?.nome || "OrgFy Iris"} ↗`
          )
      ),
      h(
        "div",
        { className: "of-grid-3" },
        empresas.length === 0
          ? h("div", { className: "of-card-pad of-muted" }, "Carregando manifestos de empresas/*.json...")
          : empresas.map((emp) =>
              h(
                "div",
                {
                  key: emp.slug,
                  className: "of-card-pad",
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    borderColor: tenant === emp.slug ? "var(--primary)" : undefined,
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                  h(
                    "div",
                    { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
                    h("span", { className: "of-project-tile" }, (emp.workspaceBuzz || emp.nome).charAt(0).toUpperCase()),
                    h("strong", { style: { fontSize: "13.5px" } }, emp.workspaceBuzz || emp.nome)
                  ),
                  h("span", { className: "of-pill", "data-tone": emp.estagio === "operacional" ? "done" : "idle" }, emp.estagio.toUpperCase())
                ),
                h(
                  "div",
                  { className: "of-muted", style: { fontSize: "11px" } },
                  `Liderança: ${emp.ceoEmpresa || "OrgFy Iris"} · Canal: ${emp.canal ? emp.canal.slice(0, 8) + "…" : "pendente"}`
                ),
                h(
                  "div",
                  { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
                  h(
                    "div",
                    { className: "of-surface", style: { padding: "7px 9px" } },
                    h("div", { className: "of-meter-label" }, "Agentes"),
                    h("div", { className: "of-num", style: { fontSize: "14px", fontWeight: 700, marginTop: "2px" } }, `${emp.agentesProntos}/${emp.agentesTotal}`)
                  ),
                  h(
                    "div",
                    { className: "of-surface", style: { padding: "7px 9px" } },
                    h("div", { className: "of-meter-label" }, "Teto/dia"),
                    h("div", { className: "of-num", style: { fontSize: "14px", fontWeight: 700, marginTop: "2px" } }, `${fmtTokens(emp.budgetTokensDiario)} tok`)
                  )
                ),
                emp.pendenciasOnboarding && emp.pendenciasOnboarding.length > 0
                  ? h(
                      "div",
                      { className: "of-surface", style: { padding: "7px 9px", borderColor: "rgba(245,158,11,0.35)", fontSize: "11px", color: "var(--status-waiting)" } },
                      emp.pendenciasOnboarding.slice(0, 2).map((p: string, i: number) => h("div", { key: i }, `• ${p}`))
                    )
                  : h("div", { style: { fontSize: "11px", color: "var(--status-done)" } }, "✓ Manifesto, canal e chaves operacionais validados."),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": tenant === emp.slug ? "primary" : undefined,
                    style: { marginTop: "auto", justifyContent: "center" },
                    onClick: () => onSelectTenant(emp.slug),
                  },
                  `Abrir Fábrica de ${emp.workspaceBuzz || emp.nome} →`
                )
              )
            )
      ),
      boardAreas.length > 0 &&
        h(
          "div",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
          h("div", { className: "of-meter-label" }, "Conselho Funcional (empresas/board.json)"),
          h(
            "div",
            { className: "of-grid-2" },
            boardAreas.map((area) =>
              h(
                "div",
                { key: area.id, className: "of-surface", style: { padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  null,
                  h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, area.area),
                  h("div", { className: "of-muted", style: { fontSize: "11px" } }, area.responsavel)
                ),
                h("span", { className: "of-pill", "data-tone": area.status === "ativo" ? "done" : "idle" }, area.status.toUpperCase())
              )
            )
          )
        )
    );
  }

  // ── 2. INBOX (routes/inbox.tsx) ──
  if (tab === "inbox") {
    const problems = [...status.inProgress, ...status.recent].filter((i) => i.stage === "failed" || i.stage === "reverted");
    const asks = [...status.inProgress, ...status.recent].filter((i) => i.stage === "escalated");
    const reviews = status.inProgress.filter((i) => i.stage === "verifying");
    const allCount = problems.length + asks.length + reviews.length + status.held.length;

    const shown =
      inboxFilter === "asks"
        ? asks
        : inboxFilter === "reviews"
        ? reviews
        : inboxFilter === "problems"
        ? problems
        : [...asks, ...reviews, ...problems];

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "820px" } },
      h(
        "div",
        { className: "of-segmented", style: { width: "fit-content" } },
        ([
          { id: "all", label: `Todos (${allCount})` },
          { id: "asks", label: `Precisa de resposta (${asks.length})` },
          { id: "reviews", label: `Revisões (${reviews.length})` },
          { id: "problems", label: `Problemas (${problems.length})` },
        ] as const).map((f) =>
          h(
            "button",
            {
              key: f.id,
              type: "button",
              className: "of-seg-btn",
              "data-active": inboxFilter === f.id ? "true" : "false",
              onClick: () => setInboxFilter(f.id),
            },
            f.label
          )
        )
      ),
      shown.length === 0
        ? h(
            "div",
            { className: "of-card-pad", style: { textAlign: "center", padding: "36px 20px" } },
            h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Você está em dia"),
            h("div", { className: "of-muted", style: { marginTop: "4px" } }, "Perguntas de agentes, aprovações de spec, PRs aguardando revisão e falhas aparecem aqui.")
          )
        : shown.map((item) =>
            h(
              "button",
              {
                key: item.id,
                type: "button",
                className: "of-view-card",
                "data-state": item.stage === "failed" ? "failed" : "person",
                onClick: () => onSelectItem(item),
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { className: "of-mono", style: { color: "var(--primary)", fontSize: "11px" } }, `#${item.id.slice(0, 8)}`),
                h("span", { className: "of-pill", "data-tone": item.stage === "failed" ? "failed" : "waiting" }, item.stage)
              ),
              h("div", { style: { fontSize: "13px", fontWeight: 600 } }, item.title),
              item.reason && h("div", { className: "of-muted" }, item.reason)
            )
          )
    );
  }

  // ── 3. USO & CUSTOS (1:1 CodeDen Usage & Cost adaptado a kpis-esteira.json + orçamento por empresa) ──
  if (tab === "costs") {
    const economia = status.kpis?.economia || null;
    const qualidade = status.kpis?.qualidade || null;
    const porModelo = Array.isArray(economia?.por_modelo) ? economia.por_modelo : [];
    const totalCost = porModelo.reduce((acc: number, r: any) => acc + Number(r.custo_usd || 0), 0);
    const maxCost = Math.max(0.01, ...porModelo.map((r: any) => Number(r.custo_usd || 0)));
    const empresas = holding?.empresas || [];

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h(
            "div",
            { className: "of-segmented" },
            (["7d", "30d", "90d"] as const).map((r) =>
              h(
                "button",
                {
                  key: r,
                  type: "button",
                  className: "of-seg-btn",
                  "data-active": costRange === r ? "true" : "false",
                  onClick: () => setCostRange(r),
                },
                r
              )
            )
          ),
          h("span", { className: "of-pill", "data-tone": "done" }, `Empresa em foco: ${status.tenantManifest?.nome || tenant}`)
        ),
        h("span", { className: "of-muted" }, `Fonte real: kpis-esteira.json (${status.kpis?.gerado_em || PT_BR.labels.unavailable})`)
      ),
      h(
        "div",
        { className: "of-surface", style: { padding: "8px 12px", fontSize: "11.5px", color: "var(--muted-foreground)" } },
        "Custos equivalentes de API calculados a partir de kpis-esteira.json (sem dados sintéticos; modelos gratuitos/assinatura aparecem com $0.00 quando sem cobrança por token)."
      ),
      // 5 KPIs principais (UsageTotals do CodeDen)
      h(
        "div",
        { className: "of-stats-6" },
        [
          {
            label: "Custo equivalente API",
            val: typeof economia?.custo_usd_total_amostra === "number" ? `$${economia.custo_usd_total_amostra.toFixed(2)}` : PT_BR.labels.unavailable,
            sub: `gasto hoje: $${status.spendToday.usd.toFixed(2)}`,
          },
          {
            label: "Tokens (7d)",
            val: fmtTokens(economia?.tokens_7d),
            sub: `orçamento/dia: ${fmtTokens(status.tenantManifest?.budgetTokensDiario)}`,
          },
          {
            label: "Cache hit rate",
            val: typeof economia?.cache_hit_ratio_pct === "number" ? `${economia.cache_hit_ratio_pct.toFixed(1)}%` : PT_BR.labels.unavailable,
            sub: "reaproveitamento de contexto",
          },
          {
            label: "Merges (7d)",
            val: String(status.stats.merged7d),
            sub: `hoje: ${status.mergesToday}`,
          },
          {
            label: "FPY real",
            val: typeof qualidade?.fpy_real_pct === "number" ? `${qualidade.fpy_real_pct.toFixed(1)}%` : PT_BR.labels.unavailable,
            sub: `CPI mín: ${status.tenantManifest?.cpiMinimo ?? 0.85}`,
          },
        ].map((k) =>
          h(
            "div",
            { key: k.label, className: "of-card-pad", style: { padding: "11px 13px" } },
            h("div", { className: "of-meter-label" }, k.label),
            h("div", { className: "of-num", style: { fontSize: "20px", fontWeight: 700, marginTop: "4px" } }, k.val),
            h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "2px" } }, k.sub)
          )
        )
      ),
      // Barra empilhada visual de participação por modelo + Tabela Breakdown (1:1 CodeDen SpendCard)
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
          h("div", { style: { fontSize: "13.5px", fontWeight: 700 } }, "Distribuição de gasto por modelo (kpis-esteira.json)"),
          h("span", { className: "of-muted" }, `${porModelo.length} modelos na amostra`)
        ),
        porModelo.length > 0 &&
          h(
            "div",
            { style: { display: "flex", height: "14px", borderRadius: "6px", overflow: "hidden", background: "var(--muted)", gap: "1px" } },
            porModelo.slice(0, 8).map((row: any, idx: number) => {
              const usd = Number(row.custo_usd || 0);
              const pct = totalCost > 0 ? Math.max(1, (usd / totalCost) * 100) : 100 / Math.max(1, porModelo.length);
              return h("div", {
                key: `${row.modelo || idx}`,
                title: `${row.modelo}: $${usd.toFixed(3)} (${pct.toFixed(1)}%)`,
                style: { width: `${pct}%`, background: CHART_COLORS[idx % CHART_COLORS.length] },
              });
            })
          ),
        porModelo.length === 0
          ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
          : h(
              "table",
              { className: "of-table" },
              h(
                "thead",
                null,
                h("tr", null, h("th", null, "Modelo"), h("th", null, "Participação"), h("th", null, "%"), h("th", null, "Custo USD"), h("th", null, "Chamadas"), h("th", null, "Cache"))
              ),
              h(
                "tbody",
                null,
                porModelo.slice(0, 15).map((row: any, idx: number) => {
                  const usd = Number(row.custo_usd || 0);
                  const w = Math.min(100, (usd / maxCost) * 100);
                  const sharePct = totalCost > 0 ? (usd / totalCost) * 100 : 0;
                  const color = CHART_COLORS[idx % CHART_COLORS.length];
                  return h(
                    "tr",
                    { key: `${row.modelo || idx}` },
                    h(
                      "td",
                      { className: "of-mono", style: { display: "flex", alignItems: "center", gap: "7px" } },
                      h("span", { style: { width: "8px", height: "8px", borderRadius: "2px", background: color, flexShrink: 0 } }),
                      String(row.modelo || PT_BR.labels.unavailable)
                    ),
                    h(
                      "td",
                      { style: { width: "170px" } },
                      h("div", { className: "of-bar-track", style: { marginTop: 0, height: "6px" } }, h("div", { className: "of-bar-fill", style: { width: `${w}%`, background: color } }))
                    ),
                    h("td", { className: "of-mono of-num of-muted" }, sharePct > 0 && sharePct < 1 ? "<1%" : `${Math.round(sharePct)}%`),
                    h("td", { className: "of-mono of-num" }, typeof row.custo_usd === "number" ? `$${usd.toFixed(2)}` : PT_BR.labels.unavailable),
                    h("td", { className: "of-mono of-num" }, String(row.requisicoes ?? row.chamadas ?? PT_BR.labels.unavailable)),
                    h("td", { className: "of-mono of-num" }, typeof row.cache_hit_pct === "number" ? `${row.cache_hit_pct.toFixed(1)}%` : PT_BR.labels.unavailable)
                  );
                })
              )
            )
      ),
      empresas.length > 0 &&
        h(
          "div",
          { className: "of-card-pad" },
          h("div", { style: { fontSize: "13px", fontWeight: 700, marginBottom: "8px" } }, "Tetos de orçamento por empresa (empresas/*.json)"),
          h(
            "table",
            { className: "of-table" },
            h("thead", null, h("tr", null, h("th", null, "Empresa"), h("th", null, "Estágio"), h("th", null, "Agentes"), h("th", null, "Teto diário de tokens"))),
            h(
              "tbody",
              null,
              empresas.map((e) =>
                h(
                  "tr",
                  { key: e.slug },
                  h("td", { style: { fontWeight: 600 } }, e.workspaceBuzz || e.nome),
                  h("td", null, h("span", { className: "of-pill", "data-tone": e.estagio === "operacional" ? "done" : "idle" }, e.estagio)),
                  h("td", { className: "of-mono" }, `${e.agentesProntos}/${e.agentesTotal}`),
                  h("td", { className: "of-mono" }, `${fmtTokens(e.budgetTokensDiario)} tokens/dia`)
                )
              )
            )
          )
        )
    );
  }

  // ── 4. AUTOMAÇÕES (100% REAIS DO ORGFY: LaunchAgents + Workflow Buzz + CI Runner + Probes) ──
  if (tab === "automations") {
    const tm = status.tenantManifest;
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { className: "of-segmented", style: { width: "fit-content" } },
        ([
          { id: "automations", label: "Processos & Workflows" },
          { id: "runs", label: "CI & Probes da Empresa" },
          { id: "templates", label: "Governança & Regras" },
        ] as const).map((t) =>
          h(
            "button",
            {
              key: t.id,
              type: "button",
              className: "of-seg-btn",
              "data-active": autoTab === t.id ? "true" : "false",
              onClick: () => setAutoTab(t.id),
            },
            t.label
          )
        )
      ),
      autoTab === "runs"
        ? h(
            "div",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("div", { style: { fontSize: "13.5px", fontWeight: 700 } }, `CI Runner & Probes Caixa-Preta · ${tm?.nome || tenant}`),
            h(
              "div",
              { className: "of-grid-2" },
              h(
                "div",
                { className: "of-surface", style: { padding: "10px 12px" } },
                h("div", { className: "of-meter-label" }, "CI Runner"),
                h("div", { style: { fontWeight: 700, marginTop: "4px" } }, tm?.ciModo || PT_BR.labels.unavailable),
                h("div", { className: "of-mono of-muted", style: { marginTop: "4px" } }, `cmd: ${tm?.ciCmd || "—"}`)
              ),
              h(
                "div",
                { className: "of-surface", style: { padding: "10px 12px" } },
                h("div", { className: "of-meter-label" }, "Probes Caixa-Preta no Gate"),
                h("div", { style: { fontWeight: 700, marginTop: "4px" } }, tm?.probesObrigatorios ? `Obrigatórios (${tm.probesCount})` : "Opcional neste tenant"),
                h("div", { className: "of-muted", style: { marginTop: "4px" } }, `Modo de workers: ${tm?.modoExecucao || "efemero_headless"}`)
              )
            )
          )
        : h(
            "div",
            { className: "of-grid-2" },
            h(
              "div",
              { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
              h("div", { style: { fontSize: "13.5px", fontWeight: 700 } }, "Processos agendados (máx. 2 LaunchAgents)"),
              h(
                "div",
                { className: "of-surface", style: { padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  null,
                  h("div", { style: { fontWeight: 600, fontSize: "12.5px" } }, status.launchAgent || "com.orgfy.esteira-minima"),
                  h("div", { className: "of-muted" }, "Coordenador da esteira (respeita Kill Switch e Dreno de controle-<tenant>.json)")
                ),
                h("span", { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "done" : "failed" }, status.coordenador)
              ),
              h(
                "div",
                { className: "of-surface", style: { padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  null,
                  h("div", { style: { fontWeight: 600, fontSize: "12.5px" } }, "Rotina CEO (Workflow Buzz Kind 30620)"),
                  h("div", { className: "of-muted" }, "YAML: .buzz/workflows/orgfy-rotina-ceo.yaml · Canal #esteira-orgfy")
                ),
                h("span", { className: "of-pill", "data-tone": "waiting" }, "Nativo no Buzz")
              )
            ),
            h(
              "div",
              { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
              h("div", { style: { fontSize: "13.5px", fontWeight: 700 } }, "Regras determinísticas de operação"),
              h("div", { className: "of-muted", style: { lineHeight: 1.55 } }, "• Kill Switch e Dreno em estado/controle-<tenant>.json interrompem novos despachos imediatamente."),
              h("div", { className: "of-muted", style: { lineHeight: 1.55 } }, "• Failover de modelos é delegado exclusivamente ao NexusMind (evento orgfy.failover.requested)."),
              h("div", { className: "of-muted", style: { lineHeight: 1.55 } }, "• Gate L-01 exige revisor independente por superfície (código, método, segurança, UI, arquitetura).")
            )
          )
    );
  }

  // ── 5. AGENTES DA EMPRESA (100% REAL DE empresas/<tenant>.json × ctx.agents.snapshot() + DM ↗ + Eval R5.1) ──
  if (tab === "agents") {
    const tenantAgents = status.tenantManifest?.agentes || [];
    const modelos = status.modelos || [];
    const revisoresSurf = Object.entries(status.tenantManifest?.revisoresPorSuperficie || {});
    const empresaNome = status.tenantManifest?.nome || tenant;

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
        h(
          "div",
          { className: "of-segmented", style: { width: "fit-content" } },
          ([
            { id: "memory", label: `Plantel ${empresaNome} (${tenantAgents.length})` },
            { id: "eval", label: `Eval & Modelos R5.1 (${modelos.length})` },
            { id: "skills", label: `Revisores L-01 (${revisoresSurf.length})` },
            { id: "mcp", label: "MCP (21 tools)" },
          ] as const).map((t) =>
            h(
              "button",
              {
                key: t.id,
                type: "button",
                className: "of-seg-btn",
                "data-active": agentTab === t.id ? "true" : "false",
                onClick: () => setAgentTab(t.id),
              },
              t.label
            )
          )
        ),
        h(
          "span",
          { className: "of-muted" },
          `Fonte: empresas/${tenant}.json × Buzz Desktop (${tenantAgents.filter((a) => a.inBuzz).length}/${tenantAgents.length} provisionados)`
        )
      ),
      agentTab === "memory"
        ? h(
            "div",
            { className: "of-card-pad" },
            h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "4px" } }, `Agentes de ${empresaNome}`),
            h("div", { className: "of-muted", style: { marginBottom: "10px" } }, "Cada agente abaixo vem do manifesto oficial desta empresa cruzado com o estado ao vivo no Buzz Desktop. Clique em DM ↗ para conversar na janela nativa do Buzz."),
            tenantAgents.length === 0
              ? h("div", { className: "of-muted" }, `Nenhum agente encontrado em empresas/${tenant}.json.`)
              : h(
                  "table",
                  { className: "of-table" },
                  h(
                    "thead",
                    null,
                    h("tr", null, h("th", null, "Agente"), h("th", null, "Função & Papel"), h("th", null, "Modelo (Buzz)"), h("th", null, "Status"), h("th", null, "Ação"))
                  ),
                  h(
                    "tbody",
                    null,
                    tenantAgents.map((a) =>
                      h(
                        "tr",
                        { key: a.name },
                        h(
                          "td",
                          { style: { fontWeight: 600 } },
                          h(
                            "span",
                            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
                            h("span", { className: "of-dot", "data-tone": a.running ? "running" : a.inBuzz ? "done" : "idle" }),
                            a.name
                          )
                        ),
                        h(
                          "td",
                          null,
                          h("div", { style: { fontSize: "12px" } }, a.funcao),
                          h("div", { className: "of-mono of-muted", style: { fontSize: "10px" } }, `papel: ${a.papel} · paralelismo: ${a.parallelism}x`)
                        ),
                        h("td", { className: "of-mono" }, a.model),
                        h(
                          "td",
                          null,
                          h(
                            "span",
                            { className: "of-pill", "data-tone": a.running ? "running" : a.inBuzz ? "done" : "waiting" },
                            a.running ? "Em execução" : a.inBuzz ? "No Buzz" : "A provisionar"
                          )
                        ),
                        h(
                          "td",
                          null,
                          onOpenAgentDm && a.pubkey
                            ? h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { color: "var(--primary)", padding: "3px 8px" },
                                  onClick: () => onOpenAgentDm({ key: a.agentKey, pubkey: a.pubkey, name: a.name }),
                                },
                                "DM ↗"
                              )
                            : h("span", { className: "of-muted" }, "—")
                        )
                      )
                    )
                  )
                )
          )
        : agentTab === "eval"
        ? h(
            "div",
            { className: "of-card-pad" },
            h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "4px" } }, PT_BR.labels.modelsTitle),
            h("div", { className: "of-muted", style: { marginBottom: "10px" } }, "Fonte: docs/eval-modelos-onda5.md. Qualquer agente com modelo abaixo de 8/10 em tool call aparece em vermelho."),
            modelos.length === 0
              ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
              : h(
                  "table",
                  { className: "of-table" },
                  h("thead", null, h("tr", null, h("th", null, "Agente"), h("th", null, "Papel"), h("th", null, "Modelo"), h("th", null, "Tool call (R5.1)"))),
                  h(
                    "tbody",
                    null,
                    modelos.map((m) =>
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
                            m.toolcall_eval ? (m.abaixo_minimo ? `${m.toolcall_eval} · ${PT_BR.labels.evalBelowMin}` : m.toolcall_eval) : PT_BR.labels.unavailable
                          )
                        )
                      )
                    )
                  )
                )
          )
        : agentTab === "skills"
        ? h(
            "div",
            { className: "of-card-pad" },
            h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "6px" } }, `Matriz de Revisores Independentes (L-01) · ${empresaNome}`),
            h("div", { className: "of-muted", style: { marginBottom: "10px" } }, "Regra L-01: o executor nunca pode revisar a própria entrega. Cada superfície tem revisor titular definido no manifesto da empresa."),
            revisoresSurf.length === 0
              ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
              : h(
                  "div",
                  { className: "of-grid-3" },
                  revisoresSurf.map(([superficie, revisor]) =>
                    h(
                      "div",
                      { key: superficie, className: "of-surface", style: { padding: "10px 12px" } },
                      h("div", { className: "of-meter-label" }, superficie),
                      h("div", { style: { fontSize: "13px", fontWeight: 700, marginTop: "3px" } }, revisor)
                    )
                  )
                )
          )
        : h(
            "div",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Unified Tool Registry · 21 Agent Tools MCP"),
            h("div", { className: "of-muted" }, "Todas as sessões de agentes no Buzz recebem automaticamente as ferramentas determinísticas do OrgFy: orgfy_roster_live, orgfy_handoff_pack, orgfy_smart_dispatch, orgfy_card_create, orgfy_card_progress, orgfy_checkout_lock, orgfy_gate, orgfy_loop_radar, orgfy_session_stop e orgfy_model_failover."),
            h("div", { className: "of-muted" }, `Total de agentes registrados globalmente no Buzz Desktop: ${liveCrew.length}.`)
          )
    );
  }

  // ── 6. CANVAS / VISÃO & REGRAS INJETADAS (100% OrgFy: Board + Workspace/Canvas + Regras & Lições) ──
  if (tab === "vision") {
    const ov = status.orgfyVision;
    const invariantes = ov?.invariantes || [];
    const cadeia = ov?.cadeiaComando || [];
    const escalada = Object.entries(ov?.fluxoEscalada || {});
    const regras = ov?.regrasProbatorias || [];
    const papeis = Object.entries(ov?.papeis || {});
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" } },
        h(
          "div",
          null,
          h("div", { style: { fontSize: "14.5px", fontWeight: 700 } }, `Canvas, Visão & Regras Injetadas · ${status.tenantManifest?.nome || tenant}`),
          h("div", { className: "of-muted", style: { marginTop: "2px" } }, "Fontes reais do OrgFy: empresas/board.json (Conselho), PROJECT.md + AGENTS.md + Canvas do canal no Buzz (Workspace) e regras-probatorias.json + ctx.agents.addInstructions (Agentes).")
        ),
        props.onOpenChannelInBuzz &&
          h(
            "button",
            { type: "button", className: "of-btn", "data-variant": "primary", onClick: props.onOpenChannelInBuzz },
            "Abrir Canvas / Canal no Buzz ↗"
          )
      ),
      h(
        "div",
        { className: "of-grid-2" },
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h("div", { className: "of-meter-label" }, "1. Visão da Holding / Conselho (empresas/board.json)"),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("strong", { style: { fontSize: "12.5px" } }, "Invariantes da Holding"),
            invariantes.length === 0
              ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
              : invariantes.map((inv, idx) =>
                  h(
                    "div",
                    { key: idx, style: { display: "flex", alignItems: "flex-start", gap: "7px", fontSize: "12px" } },
                    h("span", { className: "of-dot", "data-tone": "done", style: { marginTop: "5px" } }),
                    h("span", null, inv)
                  )
                )
          ),
          cadeia.length > 0 &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "4px", paddingTop: "8px", borderTop: "1px solid var(--border)" } },
              h("strong", { style: { fontSize: "12px" } }, "Cadeia de comando"),
              cadeia.map((c, idx) => h("div", { key: idx, className: "of-muted", style: { fontSize: "11.5px" } }, `${idx + 1}. ${c}`))
            ),
          escalada.length > 0 &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "4px", paddingTop: "8px", borderTop: "1px solid var(--border)" } },
              h("strong", { style: { fontSize: "12px" } }, "Fluxo de escalada"),
              escalada.map(([k, v]) => h("div", { key: k, className: "of-muted", style: { fontSize: "11px" } }, h("span", { className: "of-mono", style: { color: "var(--foreground)" } }, `${k}: `), String(v)))
            )
        ),
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h("div", { className: "of-meter-label" }, `2. Workspace & Canvas (${status.tenantManifest?.nome || tenant})`),
          papeis.length > 0 &&
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
              papeis.map(([papel, agente]) => h("span", { key: papel, className: "of-pill" }, `${papel}: ${agente}`))
            ),
          h(
            "div",
            { className: "of-surface", style: { padding: "10px 12px" } },
            h("div", { className: "of-mono", style: { fontSize: "10.5px", color: "var(--primary)", marginBottom: "6px" } }, "PROJECT.md"),
            h(
              "pre",
              { className: "of-muted", style: { margin: 0, whiteSpace: "pre-wrap", fontSize: "11px", maxHeight: "180px", overflowY: "auto", fontFamily: "inherit", lineHeight: 1.45 } },
              ov?.projectMd || "PROJECT.md não encontrado no diretório raiz."
            )
          ),
          h(
            "div",
            { className: "of-surface", style: { padding: "10px 12px" } },
            h("div", { className: "of-mono", style: { fontSize: "10.5px", color: "var(--primary)", marginBottom: "6px" } }, "AGENTS.md"),
            h(
              "pre",
              { className: "of-muted", style: { margin: 0, whiteSpace: "pre-wrap", fontSize: "11px", maxHeight: "160px", overflowY: "auto", fontFamily: "inherit", lineHeight: 1.45 } },
              ov?.agentsMd || "AGENTS.md não encontrado no diretório raiz."
            )
          )
        )
      ),
      h(
        "section",
        { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
        h("div", { className: "of-meter-label" }, "3. Regras Probatórias (regras-probatorias.json) & Injeção nos Prompts (ctx.agents.addInstructions)"),
        regras.length === 0
          ? h("div", { className: "of-muted" }, "Nenhuma regra probatória pendente em .esteira/estado/regras-probatorias.json (invariantes permanentes ativos em licoes/ e <plugin-instructions>).")
          : h(
              "table",
              { className: "of-table" },
              h("thead", null, h("tr", null, h("th", null, "Regra"), h("th", null, "Descrição"), h("th", null, "Janela"), h("th", null, "Status"))),
              h(
                "tbody",
                null,
                regras.map((r) =>
                  h(
                    "tr",
                    { key: r.id },
                    h("td", { className: "of-mono" }, r.id),
                    h("td", null, r.descricao),
                    h("td", { className: "of-mono" }, `${r.cardsAvaliados}/${r.janelaAlvo}`),
                    h("td", null, h("span", { className: "of-pill", "data-tone": "done" }, r.status))
                  )
                )
              )
            ),
        h(
          "div",
          { className: "of-surface", style: { padding: "10px 12px", fontSize: "11.5px", lineHeight: 1.5 } },
          h("div", { className: "of-mono", style: { fontSize: "10.5px", color: "var(--primary)", marginBottom: "4px" } }, "Injetado automaticamente em todos os agentes via ctx.agents.addInstructions (orgfy-governance-v13-lean):"),
          h("div", { className: "of-muted" }, "• Invariantes L-01 (Executor ≠ Revisor), L-22 (Aceite congelado por SHA-256), L-90 (Catraca de não-regressão) e Specsfy + TDD (Z2/Z3/Z4)."),
          h("div", { className: "of-muted" }, "• Guarda de Identidade (@menção) + Freio Anti-Loop (máx. 12 shells sem commit / 2 falhas consecutivas -> BLOQUEADO)."),
          h("div", { className: "of-muted" }, "• Regras específicas por papel: Executor (worktree isolado), Revisor (GATE objetivo), COO (roster_live + smart_dispatch + auto-cura) e CEO/Board (alvo fechado).")
        )
      )
    );
  }

  // ── 7. CONFIGURAÇÕES (autonomy-dialog.tsx + limits-editor.tsx + governança do manifesto) ──
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "14px", maxWidth: "880px" } },
    h(
      "div",
      { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
      h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Modo de autonomia · ${status.tenantManifest?.nome || tenant}`),
      h("div", { className: "of-muted" }, "Suba um degrau por vez. Áreas protegidas e regra L-01 sempre permanecem ativas."),
      h(
        "div",
        { className: "of-grid-2" },
        AUTONOMY_MODES.map((m) =>
          h(
            "button",
            {
              key: m.id,
              type: "button",
              className: "of-surface",
              style: {
                padding: "12px",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--foreground)",
                borderColor: settingsForm.mode === m.id ? "var(--primary)" : undefined,
                background: settingsForm.mode === m.id ? "var(--primary-soft)" : undefined,
              },
              onClick: () => {
                setSettingsForm({ mode: m.id });
                onSelectModeQuick(m.id);
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 } },
              h("span", null, m.label),
              m.experimental && h("span", { className: "of-exp-badge" }, "experimental"),
              status.mode === m.id && h("span", { className: "of-muted", style: { marginLeft: "auto", fontSize: "10px" } }, "Atual")
            ),
            h("div", { className: "of-muted", style: { marginTop: "4px", lineHeight: 1.4 } }, m.summary),
            h("div", { className: "of-muted", style: { marginTop: "6px", fontSize: "10.5px" } }, `Encontra: ${m.finds} · Merge: ${m.merges}`)
          )
        )
      )
    ),
    h(
      "div",
      { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Limites operacionais · controle-${tenant}.json`),
      h(
        "div",
        { className: "of-grid-3" },
        h(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
          "Orçamento diário (USD)",
          h("input", {
            type: "number",
            className: "of-input",
            value: settingsForm.gastoDiaUsd,
            onChange: (e: any) => setSettingsForm({ gastoDiaUsd: Number(e.target.value) }),
          })
        ),
        h(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
          "Merges por dia",
          h("input", {
            type: "number",
            className: "of-input",
            value: settingsForm.mergesDia,
            onChange: (e: any) => setSettingsForm({ mergesDia: Number(e.target.value) }),
          })
        ),
        h(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
          "Agentes simultâneos",
          h("input", {
            type: "number",
            className: "of-input",
            value: settingsForm.agentesMax,
            onChange: (e: any) => setSettingsForm({ agentesMax: Number(e.target.value) }),
          })
        ),
        h(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
          "PRs abertos no máximo (WIP)",
          h("input", {
            type: "number",
            className: "of-input",
            value: settingsForm.prsAbertos,
            onChange: (e: any) => setSettingsForm({ prsAbertos: Number(e.target.value) }),
          })
        ),
        h(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
          "Pausar após falhas seguidas",
          h("input", {
            type: "number",
            className: "of-input",
            value: settingsForm.falhasSeguidas,
            onChange: (e: any) => setSettingsForm({ falhasSeguidas: Number(e.target.value) }),
          })
        ),
        h(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
          "Política de merge",
          h(
            "select",
            {
              className: "of-tenant-select",
              value: settingsForm.mergePolicy,
              onChange: (e: any) => setSettingsForm({ mergePolicy: e.target.value as "fast" | "strict" }),
            },
            h("option", { value: "strict" }, "Strict (re-testa na main)"),
            h("option", { value: "fast" }, "Fast (CI próprio sem conflito)")
          )
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingTop: "6px", borderTop: "1px solid var(--border)" } },
        h("span", { className: "of-muted" }, `Persistido diretamente em estado/controle-${tenant}.json e lido pelo coordenador.`),
        h("button", { type: "button", className: "of-btn", "data-variant": "primary", onClick: onSaveSettings }, "Salvar configurações")
      )
    )
  );
}
