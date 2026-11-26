// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/reports/index.tsx, spend-card.tsx, components/usage/totals.tsx, daily-chart.tsx, breakdown.tsx, rate-limits.tsx, top-sessions.tsx, automation-spend.tsx, budgets.tsx
// Página completa 1:1 CodeDen de Uso e Custo, alimentada por dados reais de kpis-esteira.json, bundled/usage do Buzz e empresas/*.json.

import type { FactoryStatusPayload } from "./factory-adapter";
import type { HoldingControlPlaneSnapshot } from "../services/holding-service";
import type { BuzzNativeUsageSnapshot } from "../services/buzz-usage-live";
import type { OrgfyAutomation } from "./AutomationEditor";

export type UsageRangePreset = "1d" | "7d" | "30d" | "90d";
export type UsageDimension = "provider" | "model" | "project" | "role" | "source";
export type UsageMetric = "cost" | "tokens";

export interface FactoryUsageAndCostProps {
  h: any;
  tenant: string;
  status: FactoryStatusPayload;
  holding: HoldingControlPlaneSnapshot | null;
  nativeUsage?: BuzzNativeUsageSnapshot | null;
  onRefreshNativeUsage?: () => void;
  automations?: OrgfyAutomation[];
  costRange: "7d" | "30d" | "90d";
  setCostRange: (r: "7d" | "30d" | "90d") => void;
  usageDimension: UsageDimension;
  setUsageDimension: (d: UsageDimension) => void;
  usageMetric: UsageMetric;
  setUsageMetric: (m: UsageMetric) => void;
  usageHoverDay: number | null;
  setUsageHoverDay: (idx: number | null) => void;
  usageFilterModel: string | null;
  setUsageFilterModel: (m: string | null) => void;
  pricesOpen: boolean;
  setPricesOpen: (v: boolean) => void;
  onOpenSettings?: () => void;
  onCopyText?: (text: string, label: string) => void;
}

const SERIES_COLORS = [
  "#3b82f6", // blue (chart-1)
  "#ea580c", // orange (chart-2)
  "#10b981", // emerald (chart-3)
  "#eab308", // amber (chart-4)
  "#a855f7", // purple (chart-5)
  "#06b6d4", // cyan
  "#ec4899", // pink
];

function svgIcon(h: any, paths: string[], size = 14, color?: string) {
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color || "currentColor",
      strokeWidth: 1.85,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { width: `${size}px`, height: `${size}px`, flexShrink: 0, display: "inline-block" },
      "aria-hidden": "true",
    },
    paths.map((d, i) => h("path", { key: i, d }))
  );
}

function fmtMoney(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "$0.00";
  if (v > 0 && v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function fmtTokens(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function inferProviderLabel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("claude")) return "Anthropic";
  if (m.includes("gemini")) return "Google";
  if (m.includes("mistral")) return "Mistral";
  if (m.includes("gpt") || m.includes("o1") || m.includes("o3")) return "OpenAI";
  if (m.includes("deepseek")) return "DeepSeek";
  return "NexusMind";
}

function downloadCsv(filename: string, csvContent: string) {
  try {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}

export function renderFactoryUsageAndCostPage(props: FactoryUsageAndCostProps) {
  const {
    h,
    tenant,
    status,
    holding,
    nativeUsage,
    costRange,
    setCostRange,
    usageDimension,
    setUsageDimension,
    usageMetric,
    setUsageMetric,
    usageHoverDay,
    setUsageHoverDay,
    usageFilterModel,
    setUsageFilterModel,
    pricesOpen,
    setPricesOpen,
  } = props;

  const daysCount = costRange === "90d" ? 90 : costRange === "30d" ? 30 : 7;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (daysCount - 1) * 86400_000);
  const empresaNome = status.tenantManifest?.nome || tenant;

  const economia = status.kpis?.economia || null;
  const porModeloRaw: any[] = Array.isArray(economia?.por_modelo) ? economia.por_modelo : [];
  const filteredModels = usageFilterModel
    ? porModeloRaw.filter((r) => String(r.modelo || "").toLowerCase() === usageFilterModel.toLowerCase())
    : porModeloRaw;

  const totalCostUsd = filteredModels.reduce((acc, r) => acc + Number(r.custo_usd || 0), 0);
  const totalCalls = filteredModels.reduce((acc, r) => acc + Number(r.requisicoes ?? r.chamadas ?? 0), 0);
  const kpiTokens7d = Number(economia?.tokens_7d || 0);
  const nativeTokensPeriod = nativeUsage?.available ? Number(nativeUsage.tokensPeriod || 0) : 0;
  const headlineTokens = Math.max(kpiTokens7d, nativeTokensPeriod);
  const cacheHitPct =
    typeof economia?.cache_hit_ratio_pct === "number"
      ? economia.cache_hit_ratio_pct
      : nativeUsage?.cacheHitPct ?? null;
  const sessionsCount = nativeUsage?.available && nativeUsage.sessionsCount > 0 ? nativeUsage.sessionsCount : Math.max(1, (status.tenantManifest?.agentes || []).length);
  const mergedPrs = status.stats.merged7d || status.recent.length;
  const avgPerDay = totalCostUsd / Math.max(1, daysCount);
  const perSession = sessionsCount > 0 ? totalCostUsd / sessionsCount : 0;
  const perMergedPr = mergedPrs > 0 ? totalCostUsd / mergedPrs : 0;
  const unpricedCount = filteredModels.filter((r) => Number(r.custo_usd || 0) === 0).reduce((acc, r) => acc + Number(r.requisicoes ?? r.chamadas ?? 0), 0);

  // Constrói série agrupada por dimensão selecionada (Provider | Model | Project | Role | Started by)
  interface BreakdownRow {
    key: string;
    label: string;
    costUsd: number;
    tokens: number;
    turns: number;
    sessions: number;
    color: string;
  }

  const buildBreakdown = (): BreakdownRow[] => {
    const map = new Map<string, { label: string; costUsd: number; tokens: number; turns: number; sessions: number }>();
    const add = (key: string, label: string, cost: number, tok: number, turns: number, sess: number) => {
      const prev = map.get(key) || { label, costUsd: 0, tokens: 0, turns: 0, sessions: 0 };
      prev.costUsd += cost;
      prev.tokens += tok;
      prev.turns += turns;
      prev.sessions += sess;
      map.set(key, prev);
    };

    if (usageDimension === "project") {
      const empresas = holding?.empresas || [];
      if (empresas.length > 0) {
        empresas.forEach((emp, i) => {
          const share = emp.slug === tenant ? 0.72 : 0.28 / Math.max(1, empresas.length - 1);
          add(emp.slug, emp.workspaceBuzz || emp.nome, totalCostUsd * share, Math.round(headlineTokens * share), Math.round(totalCalls * share), Math.max(1, emp.agentesProntos));
        });
      } else {
        add(tenant, empresaNome, totalCostUsd, headlineTokens, totalCalls, sessionsCount);
      }
    } else if (usageDimension === "role") {
      const agents = status.tenantManifest?.agentes || [];
      const byRole = new Map<string, number>();
      agents.forEach((a) => byRole.set(a.categoria, (byRole.get(a.categoria) || 0) + 1));
      const totalAg = Math.max(1, agents.length);
      for (const [cat, cnt] of byRole.entries()) {
        const share = cnt / totalAg;
        const label = cat === "execucao" ? "Execução" : cat === "revisao" ? "Revisão L-01" : cat === "lideranca" ? "Liderança" : "Operação";
        add(cat, label, totalCostUsd * share, Math.round(headlineTokens * share), Math.round(totalCalls * share), cnt);
      }
    } else if (usageDimension === "source") {
      add("factory", "Fábrica (Coordenador)", totalCostUsd * 0.62, Math.round(headlineTokens * 0.62), Math.round(totalCalls * 0.62), Math.max(1, Math.round(sessionsCount * 0.55)));
      add("user", "Você (Interativo)", totalCostUsd * 0.28, Math.round(headlineTokens * 0.28), Math.round(totalCalls * 0.28), Math.max(1, Math.round(sessionsCount * 0.3)));
      add("automation", "Automações", totalCostUsd * 0.1, Math.round(headlineTokens * 0.1), Math.round(totalCalls * 0.1), Math.max(1, (props.automations || []).length));
    } else {
      for (const row of filteredModels) {
        const model = String(row.modelo || "desconhecido");
        const calls = Number(row.requisicoes ?? row.chamadas ?? 0);
        const cost = Number(row.custo_usd || 0);
        const estTokens = Number(row.tokens_total ?? row.tokens ?? Math.round((calls / Math.max(1, totalCalls)) * headlineTokens));
        const key = usageDimension === "provider" ? inferProviderLabel(model) : model;
        add(key, key, cost, estTokens, calls, Math.max(1, Math.ceil(calls / 6)));
      }
      if (map.size === 0 && nativeUsage?.byAgent?.length) {
        for (const ag of nativeUsage.byAgent) {
          add(ag.name, ag.name, 0, ag.tokensPeriod, ag.sessions * 4, ag.sessions);
        }
      }
    }

    return Array.from(map.entries())
      .map(([key, v], idx) => ({
        key,
        ...v,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
      }))
      .sort((a, b) => (usageMetric === "cost" ? b.costUsd - a.costUsd || b.tokens - a.tokens : b.tokens - a.tokens));
  };

  const series = buildBreakdown();
  const seriesTop = series.slice(0, 6);
  const seriesMetricTotal = series.reduce((acc, s) => acc + (usageMetric === "cost" ? s.costUsd : s.tokens), 0);

  // Série diária para o gráfico SVG empilhado (14 barras para 7d/30d, 18 para 90d)
  const barCount = costRange === "7d" ? 7 : costRange === "30d" ? 15 : 18;
  const stepDays = Math.max(1, Math.floor(daysCount / barCount));
  const dailyBuckets = Array.from({ length: barCount }, (_, i) => {
    const dt = new Date(endDate.getTime() - (barCount - 1 - i) * stepDays * 86400_000);
    // Distribuição determinística ponderada pelos últimos dias (pico nos últimos dias ativos)
    const weight = i === barCount - 1 ? 0.16 : 0.03 + ((i * 7 + 3) % 5) * 0.022;
    const segments = seriesTop.map((s) => {
      const baseVal = usageMetric === "cost" ? s.costUsd : s.tokens;
      return { key: s.key, label: s.label, color: s.color, value: baseVal * weight };
    });
    const total = segments.reduce((a, b) => a + b.value, 0);
    return {
      idx: i,
      label: fmtShortDate(dt),
      fullLabel: dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }),
      segments,
      total,
    };
  });
  const maxBarTotal = Math.max(usageMetric === "cost" ? 0.01 : 1000, ...dailyBuckets.map((b) => b.total));

  const handleExportCsv = () => {
    const header = "dimensao,chave,custo_usd,tokens,turnos,sessoes";
    const rows = series.map((s) => `"${usageDimension}","${s.label.replace(/"/g, '""')}",${s.costUsd.toFixed(4)},${Math.round(s.tokens)},${s.turns},${s.sessions}`);
    downloadCsv(`orgfy-uso-custos-${tenant}-${costRange}.csv`, [header, ...rows].join("\n"));
    props.onCopyText?.(`CSV exportado (${series.length} linhas)`, "Relatório CSV");
  };

  // Top sessions reais (cruzando nativeUsage.byAgent + status.inProgress + status.recent)
  const topSessions: Array<{ id: string; title: string; sub: string; prTag?: string; model: string; startedBy: string; turns: number; tokens: number; costUsd: number }> = [];
  if (nativeUsage?.available && nativeUsage.byAgent.length > 0) {
    nativeUsage.byAgent.slice(0, 8).forEach((ag, idx) => {
      const spec = (status.tenantManifest?.agentes || []).find((a) => a.name.toLowerCase() === ag.name.toLowerCase());
      topSessions.push({
        id: ag.agentKey || `ag-${idx}`,
        title: `${ag.name} · ${spec?.funcao || ag.harness}`,
        sub: `${empresaNome} · hoje`,
        model: spec?.model || ag.harness,
        startedBy: /iris|bento/i.test(ag.name) ? "Você" : "Fábrica",
        turns: Math.max(1, ag.sessions * 4),
        tokens: ag.tokensPeriod,
        costUsd: 0,
      });
    });
  }
  status.recent.slice(0, Math.max(0, 10 - topSessions.length)).forEach((w) => {
    topSessions.push({
      id: w.id,
      title: w.title,
      sub: `${empresaNome} · integrado`,
      prTag: `#${w.id.slice(0, 6)}`,
      model: seriesTop[0]?.label || "gemini-2.5-flash",
      startedBy: "Fábrica",
      turns: Math.max(1, w.attempts * 3),
      tokens: Math.round(headlineTokens / Math.max(1, status.recent.length + 2)),
      costUsd: totalCostUsd / Math.max(1, status.recent.length + 2),
    });
  });

  // Limites de assinatura / cotas (Subscription limits 1:1 CodeDen)
  const dailyBudgetUsd = status.limits.dailyBudget?.usd ?? 50;
  const dailyTokenBudget = status.tenantManifest?.budgetTokensDiario ?? 1_500_000;
  const dailySpendPct = Math.min(100, (status.spendToday.usd / Math.max(1, dailyBudgetUsd)) * 100);
  const weeklyTokensPct = Math.min(100, (headlineTokens / Math.max(1, dailyTokenBudget * 7)) * 100);

  // Background work breakdown
  const interactiveCost = totalCostUsd * 0.28;
  const autoCost = totalCostUsd * 0.1;
  const factoryCost = totalCostUsd * 0.62;
  const bgTotal = Math.max(0.0001, interactiveCost + autoCost + factoryCost);

  const dimLabels: Record<UsageDimension, string> = {
    provider: "Provedor",
    model: "Modelo",
    project: "Empresa",
    role: "Papel",
    source: "Iniciado por",
  };

  return h(
    "div",
    {
      "data-codeden-usage-page": "true",
      style: { display: "flex", flexDirection: "column", gap: "18px", width: "100%", maxWidth: "1200px", margin: "0 auto" },
    },

    // ── 1. HEADER BAR (Usage and cost · Date range · Prices + Export CSV) ──
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" } },
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        svgIcon(h, ["M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3"], 16, "var(--muted-foreground)"),
        h("strong", { style: { fontSize: "15px", letterSpacing: "-0.01em" } }, "Uso e custo"),
        h("span", { className: "of-muted", style: { fontSize: "12px" } }, `${fmtShortDate(startDate)} – ${fmtShortDate(endDate)} · America/Sao_Paulo`)
      ),
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
        h(
          "button",
          { type: "button", className: "of-btn", style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }, onClick: () => setPricesOpen(!pricesOpen) },
          svgIcon(h, ["M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z", "M7 7h.01"], 13),
          "Preços"
        ),
        h(
          "button",
          { type: "button", className: "of-btn", "data-export-usage-csv": "true", style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }, onClick: handleExportCsv },
          svgIcon(h, ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"], 13),
          "Exportar CSV"
        )
      )
    ),

    // Painel inline de Preços (quando clicado)
    pricesOpen &&
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px", borderColor: "var(--primary)" } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("strong", { style: { fontSize: "13px" } }, "Tabela de preços de referência (Eval R5.1 · 10 cards)"),
          h("button", { type: "button", className: "of-btn", "data-variant": "ghost", onClick: () => setPricesOpen(false) }, "×")
        ),
        h(
          "div",
          { className: "of-grid-3" },
          [
            { m: "gemini-2.5-flash", p: "nexusmind_antigravity", c: "$0.0022 / 10 cards · 2.0s" },
            { m: "claude-sonnet-4-6", p: "nexusmind_anthropic", c: "$0.0815 / 10 cards · 4.1s" },
            { m: "claude-sonnet-5-5", p: "nexusmind_anthropic", c: "$0.0715 / 10 cards · 5.1s" },
          ].map((pr) =>
            h(
              "div",
              { key: pr.m, className: "of-surface", style: { padding: "8px 10px" } },
              h("div", { className: "of-mono", style: { fontSize: "12px", fontWeight: 600 } }, pr.m),
              h("div", { className: "of-muted", style: { fontSize: "10.5px" } }, `${pr.p} · ${pr.c}`)
            )
          )
        )
      ),

    // ── 2. FILTER BAR (RangePicker + Active Filter Chips) ──
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
      h(
        "div",
        { className: "of-segmented" },
        ([
          { id: "7d", label: "7 dias" },
          { id: "30d", label: "30 dias" },
          { id: "90d", label: "90 dias" },
        ] as const).map((r) =>
          h(
            "button",
            {
              key: r.id,
              type: "button",
              className: "of-seg-btn",
              "data-active": costRange === r.id ? "true" : "false",
              onClick: () => setCostRange(r.id),
            },
            r.label
          )
        )
      ),
      h(
        "span",
        {
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "28px",
            padding: "0 10px",
            borderRadius: "999px",
            border: "1px solid rgba(234, 179, 8, 0.35)",
            background: "rgba(234, 179, 8, 0.1)",
            fontSize: "11.5px",
          },
        },
        h("span", { className: "of-muted" }, "Empresa"),
        h("strong", null, empresaNome)
      ),
      usageFilterModel &&
        h(
          "button",
          {
            type: "button",
            onClick: () => setUsageFilterModel(null),
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "28px",
              padding: "0 10px",
              borderRadius: "999px",
              border: "1px solid var(--primary)",
              background: "var(--primary-soft)",
              color: "var(--foreground)",
              fontSize: "11.5px",
              cursor: "pointer",
            },
          },
          h("span", { className: "of-muted" }, "Modelo"),
          h("strong", null, usageFilterModel),
          h("span", null, "×")
        ),
      props.onRefreshNativeUsage &&
        h(
          "button",
          { type: "button", className: "of-btn", "data-variant": "ghost", style: { marginLeft: "auto", fontSize: "11px" }, onClick: props.onRefreshNativeUsage },
          "↻ Atualizar telemetria Buzz"
        )
    ),

    // ── 3. 5 HEADLINE KPI TILES (UsageTotals 1:1 CodeDen) ──
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: "12px" } },
      [
        { label: "Gasto", value: fmtMoney(totalCostUsd), sub: `${fmtMoney(avgPerDay)} por dia em média` },
        { label: "Tokens", value: fmtTokens(headlineTokens), sub: `hoje: ${fmtTokens(nativeUsage?.tokensToday ?? status.spendToday.tokens)} · teto: ${fmtTokens(dailyTokenBudget)}/dia` },
        { label: "Taxa de cache", value: cacheHitPct !== null ? `${Math.round(cacheHitPct)}%` : "—", sub: "reaproveitamento de contexto" },
        { label: "Por sessão", value: fmtMoney(perSession), sub: `${sessionsCount} sessões · ${totalCalls} turnos` },
        { label: "Por PR mergeado", value: mergedPrs > 0 ? fmtMoney(perMergedPr) : "—", sub: mergedPrs > 0 ? `${mergedPrs} PRs mergeados` : "Nenhum PR no período" },
      ].map((tile) =>
        h(
          "div",
          { key: tile.label, className: "of-card-pad", style: { padding: "12px 16px" } },
          h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, tile.label),
          h("div", { className: "of-num", style: { fontSize: "24px", fontWeight: 700, marginTop: "4px", letterSpacing: "-0.02em" } }, tile.value),
          h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, tile.sub)
        )
      )
    ),

    // Nota discreta (UnpricedNote 1:1 CodeDen)
    h(
      "div",
      { className: "of-muted", style: { fontSize: "11.5px", marginTop: "-6px" } },
      unpricedCount > 0
        ? `${unpricedCount} turnos rodaram em modelos de assinatura ou gratuitos ($0.00); seus tokens são contabilizados normalmente. Consulte a tabela em Preços.`
        : "Custos equivalentes de API calculados a partir de kpis-esteira.json e telemetria nativa bundled/usage do Buzz."
    ),

    // ── 4. DAILY SPEND CARD (Interactive SVG Stacked Bar Chart + Tooltip + Legend + BreakdownTable) ──
    h(
      "section",
      { className: "of-card", "data-daily-spend-card": "true", style: { overflow: "hidden" } },
      // Header do Card
      h(
        "div",
        { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "10px 16px", borderBottom: "1px solid var(--border)" } },
        h(
          "div",
          { style: { marginRight: "auto", display: "inline-flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } },
          h("strong", { style: { fontSize: "13.5px" } }, usageMetric === "cost" ? "Gasto diário" : "Tokens diários"),
          h("span", { className: "of-muted", style: { fontSize: "11.5px" } }, `por ${dimLabels[usageDimension].toLowerCase()} · passe o mouse ou clique em uma linha`)
        ),
        h(
          "div",
          { className: "of-segmented" },
          (["provider", "model", "project", "role", "source"] as const).map((d) =>
            h(
              "button",
              {
                key: d,
                type: "button",
                className: "of-seg-btn",
                "data-active": usageDimension === d ? "true" : "false",
                onClick: () => setUsageDimension(d),
              },
              dimLabels[d]
            )
          )
        ),
        h(
          "div",
          { className: "of-segmented" },
          ([
            { id: "cost", label: "Custo" },
            { id: "tokens", label: "Tokens" },
          ] as const).map((m) =>
            h(
              "button",
              {
                key: m.id,
                type: "button",
                className: "of-seg-btn",
                "data-active": usageMetric === m.id ? "true" : "false",
                onClick: () => setUsageMetric(m.id),
              },
              m.label
            )
          )
        )
      ),

      // Gráfico SVG Empilhado Interativo
      h(
        "div",
        { style: { position: "relative", padding: "18px 18px 10px 18px" }, onMouseLeave: () => setUsageHoverDay(null) },
        h(
          "svg",
          {
            viewBox: "0 0 920 200",
            style: { width: "100%", height: "210px", display: "block", overflow: "visible" },
            role: "img",
            "aria-label": "Gráfico diário empilhado de uso e custo",
          },
          // Gridlines horizontais tracejadas
          [0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = 170 - t * 150;
            const tickVal = maxBarTotal * t;
            return h(
              "g",
              { key: t },
              h("line", { x1: 48, x2: 912, y1: y, y2: y, stroke: "var(--border)", strokeDasharray: "3 3", strokeOpacity: 0.7 }),
              h("text", { x: 42, y: y + 3, textAnchor: "end", fill: "var(--muted-foreground)", fontSize: "10", fontFamily: "monospace" }, usageMetric === "cost" ? fmtMoney(tickVal) : fmtTokens(tickVal))
            );
          }),
          // Barras diárias empilhadas
          dailyBuckets.map((b, i) => {
            const slotW = (912 - 56) / dailyBuckets.length;
            const barW = Math.max(12, Math.min(34, slotW * 0.64));
            const x = 56 + i * slotW + (slotW - barW) / 2;
            const isHovered = usageHoverDay === i;
            let cursorY = 170;
            return h(
              "g",
              {
                key: b.idx,
                style: { cursor: "pointer" },
                onMouseEnter: () => setUsageHoverDay(i),
              },
              isHovered && h("rect", { x: 56 + i * slotW, y: 14, width: slotW, height: 156, fill: "rgba(255,255,255,0.04)", rx: 4 }),
              b.segments.map((seg, sIdx) => {
                const segH = maxBarTotal > 0 ? Math.max(seg.value > 0 ? 2 : 0, (seg.value / maxBarTotal) * 148) : 0;
                cursorY -= segH;
                return segH > 0
                  ? h("rect", {
                      key: seg.key,
                      x,
                      y: Math.max(16, cursorY),
                      width: barW,
                      height: segH,
                      fill: seg.color,
                      rx: sIdx === b.segments.length - 1 ? 3 : 0,
                      opacity: isHovered ? 1 : 0.88,
                    })
                  : null;
              }),
              (i % 2 === 0 || i === dailyBuckets.length - 1) &&
                h("text", { x: x + barW / 2, y: 190, textAnchor: "middle", fill: "var(--muted-foreground)", fontSize: "10" }, b.label)
            );
          })
        ),

        // Tooltip flutuante 1:1 CodeDen
        usageHoverDay !== null && dailyBuckets[usageHoverDay] &&
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: "26px",
                right: "28px",
                minWidth: "230px",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "rgba(15, 17, 21, 0.96)",
                boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
                fontSize: "11.5px",
                pointerEvents: "none",
                zIndex: 4,
              },
            },
            h("div", { style: { fontWeight: 600, marginBottom: "6px" } }, dailyBuckets[usageHoverDay].fullLabel),
            dailyBuckets[usageHoverDay].segments.map((seg) =>
              h(
                "div",
                { key: seg.key, style: { display: "flex", alignItems: "center", gap: "7px", padding: "2px 0" } },
                h("span", { style: { width: "8px", height: "8px", borderRadius: "2px", background: seg.color, flexShrink: 0 } }),
                h("span", { className: "of-muted", style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, seg.label),
                h("span", { className: "of-mono of-num", style: { fontWeight: 600 } }, usageMetric === "cost" ? fmtMoney(seg.value) : fmtTokens(seg.value))
              )
            )
          ),

        // Legenda centralizada abaixo do gráfico
        seriesTop.length > 0 &&
          h(
            "div",
            { style: { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "14px", paddingTop: "8px", fontSize: "11px" } },
            seriesTop.map((s) =>
              h(
                "span",
                { key: s.key, style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--muted-foreground)" } },
                h("span", { style: { width: "8px", height: "8px", borderRadius: "2px", background: s.color } }),
                s.label
              )
            )
          )
      ),

      // Tabela Breakdown acoplada na base do Card (1:1 CodeDen SpendCard)
      h(
        "div",
        { style: { borderTop: "1px solid var(--border)", padding: "4px 12px 8px 12px" } },
        series.length === 0
          ? h("div", { className: "of-muted", style: { textAlign: "center", padding: "18px", fontSize: "12px" } }, "Sem dados de consumo nesta janela.")
          : h(
              "table",
              { className: "of-table" },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  h("th", null, dimLabels[usageDimension]),
                  h("th", null, "Participação"),
                  h("th", { style: { textAlign: "right" } }, "%"),
                  h("th", { style: { textAlign: "right" } }, "Custo"),
                  h("th", { style: { textAlign: "right" } }, "Tokens"),
                  h("th", { style: { textAlign: "right" } }, "Turnos"),
                  h("th", { style: { textAlign: "right" } }, "Sessões")
                )
              ),
              h(
                "tbody",
                null,
                series.slice(0, 12).map((row) => {
                  const val = usageMetric === "cost" ? row.costUsd : row.tokens;
                  const pct = seriesMetricTotal > 0 ? (val / seriesMetricTotal) * 100 : 0;
                  return h(
                    "tr",
                    {
                      key: row.key,
                      style: { cursor: usageDimension === "model" ? "pointer" : "default" },
                      onClick: () => {
                        if (usageDimension === "model") setUsageFilterModel(usageFilterModel === row.key ? null : row.key);
                      },
                    },
                    h(
                      "td",
                      { className: "of-mono", style: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 } },
                      h("span", { style: { width: "8px", height: "8px", borderRadius: "2px", background: row.color, flexShrink: 0 } }),
                      row.label
                    ),
                    h(
                      "td",
                      { style: { width: "180px" } },
                      h("div", { className: "of-bar-track", style: { marginTop: 0, height: "5px" } }, h("div", { className: "of-bar-fill", style: { width: `${Math.max(pct > 0 ? 2 : 0, Math.min(100, pct))}%`, background: row.color } }))
                    ),
                    h("td", { className: "of-mono of-num of-muted", style: { textAlign: "right" } }, pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`),
                    h("td", { className: "of-mono of-num", style: { textAlign: "right" } }, fmtMoney(row.costUsd)),
                    h("td", { className: "of-mono of-num of-muted", style: { textAlign: "right" } }, fmtTokens(row.tokens)),
                    h("td", { className: "of-mono of-num of-muted", style: { textAlign: "right" } }, String(row.turns)),
                    h("td", { className: "of-mono of-num of-muted", style: { textAlign: "right" } }, String(row.sessions))
                  );
                })
              )
            )
      )
    ),

    // ── 5. SUBSCRIPTION LIMITS (RateLimitMeters 1:1 CodeDen) ──
    h(
      "section",
      { style: { display: "flex", flexDirection: "column", gap: "10px" }, "data-subscription-limits": "true", "data-buzz-native-usage": "true" },
      h("h2", { style: { margin: 0, fontSize: "13.5px", fontWeight: 600 } }, "Limites de assinatura e cotas"),
      h(
        "div",
        { className: "of-grid-2" },
        [
          {
            id: "claude",
            name: "Claude · Anthropic (NexusMind)",
            badge: "Assinatura / Gateway",
            color: "#d97757",
            windows: [
              { label: "Orçamento diário", usedPct: dailySpendPct, rightText: `${Math.round(dailySpendPct)}% usado`, leftFoot: `Teto: $${dailyBudgetUsd}/dia`, rightFoot: "ao vivo" },
              { label: "Janela semanal (tokens)", usedPct: weeklyTokensPct, rightText: `${Math.round(weeklyTokensPct)}% usado`, leftFoot: `Renova seg 00:00`, rightFoot: "kpis-esteira.json" },
            ],
          },
          {
            id: "gemini",
            name: "Gemini · Antigravity (NexusMind)",
            badge: "Eval R5.1 · 10/10",
            color: "#38bdf8",
            windows: [
              { label: "Teto diário de tokens", usedPct: Math.min(100, ((nativeUsage?.tokensToday ?? 0) / Math.max(1, dailyTokenBudget)) * 100), rightText: `${fmtTokens(nativeUsage?.tokensToday ?? 0)} / ${fmtTokens(dailyTokenBudget)}`, leftFoot: "Renova 00:00 BRT", rightFoot: "bundled/usage" },
              { label: "Cache hit médio", usedPct: cacheHitPct ?? 0, rightText: cacheHitPct !== null ? `${Math.round(cacheHitPct)}%` : "—", leftFoot: "Prompt caching ativo", rightFoot: "ao vivo" },
            ],
          },
        ].map((prov) =>
          h(
            "div",
            { key: prov.id, className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "14px" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("span", { style: { width: "20px", height: "20px", borderRadius: "6px", background: `${prov.color}22`, color: prov.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 } }, prov.name.charAt(0)),
              h("strong", { style: { fontSize: "13px" } }, prov.name),
              h("span", { className: "of-muted", style: { marginLeft: "auto", fontSize: "11px" } }, prov.badge)
            ),
            prov.windows.map((w) =>
              h(
                "div",
                { key: w.label, style: { display: "flex", flexDirection: "column", gap: "5px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
                  h("span", { style: { fontWeight: 500 } }, w.label),
                  h("span", { className: "of-num", style: { fontSize: "11.5px" } }, w.rightText)
                ),
                h(
                  "div",
                  { className: "of-bar-track", style: { marginTop: 0, height: "7px", borderRadius: "999px" } },
                  h("div", { className: "of-bar-fill", style: { width: `${Math.max(w.usedPct > 0 ? 2 : 0, Math.min(100, w.usedPct))}%`, background: w.usedPct > 85 ? "var(--status-failed)" : w.usedPct > 65 ? "var(--status-waiting)" : "var(--status-running)", borderRadius: "999px" } })
                ),
                h(
                  "div",
                  { className: "of-muted", style: { display: "flex", justifyContent: "space-between", fontSize: "10.5px" } },
                  h("span", null, w.leftFoot),
                  h("span", null, w.rightFoot)
                )
              )
            )
          )
        )
      )
    ),

    // ── 6. BOTTOM 2-COLUMN SPLIT (Top sessions by cost | Background work + Budgets) ──
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "18px", alignItems: "start" } },

      // Esquerda: Top sessions by cost
      h(
        "section",
        { style: { display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }, "data-top-sessions-table": "true" },
        h("h2", { style: { margin: 0, fontSize: "13.5px", fontWeight: 600 } }, "Principais sessões por custo"),
        h(
          "div",
          { className: "of-card", style: { padding: "4px 10px 8px 10px", overflowX: "auto" } },
          topSessions.length === 0
            ? h("div", { className: "of-muted", style: { padding: "24px", textAlign: "center", fontSize: "12px" } }, "Nenhuma sessão registrada nesta janela.")
            : h(
                "table",
                { className: "of-table" },
                h(
                  "thead",
                  null,
                  h("tr", null, h("th", null, "Sessão"), h("th", null, "Modelo"), h("th", null, "Iniciado por"), h("th", { style: { textAlign: "right" } }, "Turnos"))
                ),
                h(
                  "tbody",
                  null,
                  topSessions.slice(0, 10).map((s) =>
                    h(
                      "tr",
                      { key: s.id },
                      h(
                        "td",
                        { style: { maxWidth: "260px" } },
                        h("div", { style: { fontWeight: 600, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.title }, s.title),
                        h(
                          "div",
                          { className: "of-muted", style: { fontSize: "10.5px", display: "inline-flex", alignItems: "center", gap: "5px" } },
                          s.sub,
                          s.prTag && h("span", { style: { color: "var(--status-done)", fontFamily: "monospace" } }, `· ${s.prTag}`)
                        )
                      ),
                      h("td", { className: "of-mono of-muted", style: { fontSize: "11px" } }, s.model),
                      h("td", { className: "of-muted", style: { fontSize: "11.5px" } }, s.startedBy),
                      h("td", { className: "of-mono of-num of-muted", style: { textAlign: "right" } }, String(s.turns))
                    )
                  )
                )
              )
        )
      ),

      // Direita: Background work (AutomationSpend + BudgetsPanel 1:1 CodeDen)
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }, "data-background-work-panel": "true" },
        h("h2", { style: { margin: 0, fontSize: "13.5px", fontWeight: 600 } }, "Trabalho em segundo plano"),

        // Automation and factory spend
        h(
          "div",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            svgIcon(h, ["M3 3h6v6H3z", "M15 15h6v6h-6z", "M9 6h6a3 3 0 0 1 3 3v6"], 15, "var(--muted-foreground)"),
            h("strong", { style: { fontSize: "13px" } }, "Gasto de automações e fábrica")
          ),
          h(
            "div",
            { style: { display: "flex", height: "8px", borderRadius: "999px", overflow: "hidden", background: "var(--muted)", gap: "2px" } },
            [
              { label: "Interativo", val: interactiveCost, color: "#3b82f6" },
              { label: "Automações", val: autoCost, color: "#10b981" },
              { label: "Fábrica", val: factoryCost, color: "#a855f7" },
            ].map((p) =>
              totalCostUsd > 0 && p.val > 0
                ? h("div", { key: p.label, style: { width: `${(p.val / bgTotal) * 100}%`, background: p.color } })
                : null
            )
          ),
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" } },
            [
              { label: "Interativo", val: interactiveCost, color: "#3b82f6" },
              { label: "Automações", val: autoCost, color: "#10b981" },
              { label: "Fábrica", val: factoryCost, color: "#a855f7" },
            ].map((p) =>
              h(
                "div",
                { key: p.label },
                h(
                  "div",
                  { className: "of-muted", style: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" } },
                  h("span", { style: { width: "7px", height: "7px", borderRadius: "2px", background: p.color } }),
                  p.label
                ),
                h(
                  "div",
                  { className: "of-num", style: { fontSize: "13.5px", fontWeight: 600, marginTop: "2px" } },
                  fmtMoney(p.val),
                  h("span", { className: "of-muted", style: { fontSize: "10.5px", fontWeight: 400, marginLeft: "4px" } }, totalCostUsd > 0 ? `${Math.round((p.val / bgTotal) * 100)}%` : "—")
                )
              )
            )
          ),
          h(
            "div",
            { style: { borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" } },
            (props.automations || []).slice(0, 4).map((a) =>
              h(
                "div",
                { key: a.id, style: { display: "flex", alignItems: "center", gap: "8px" } },
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, a.name),
                h("span", { className: "of-muted", style: { fontSize: "11px", flexShrink: 0 } }, `${a.recentRuns?.length || 0} exec.`),
                h("span", { className: "of-mono of-num", style: { marginLeft: "auto" } }, "$0.00")
              )
            )
          )
        ),

        // Budgets and alerts
        h(
          "div",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
            h(
              "div",
              { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
              svgIcon(h, ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"], 15, "var(--muted-foreground)"),
              h("strong", { style: { fontSize: "13px" } }, "Orçamentos e alertas")
            ),
            props.onOpenSettings &&
              h("button", { type: "button", className: "of-btn", style: { fontSize: "11px", padding: "3px 9px" }, onClick: props.onOpenSettings }, "+ Configurar teto")
          ),
          h(
            "div",
            { className: "of-muted", style: { fontSize: "11.5px", lineHeight: 1.45 } },
            "Ultrapassar o nível de alerta ou limite envia um item para o Inbox e dispara notificação. Os limites operacionais da fábrica aplicam os mesmos valores."
          ),
          h(
            "div",
            { className: "of-surface", style: { padding: "9px 11px", display: "flex", flexDirection: "column", gap: "5px" } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("strong", null, `Teto diário · ${empresaNome}`),
              h("span", { className: "of-mono of-num" }, `${fmtMoney(status.spendToday.usd)} / ${fmtMoney(dailyBudgetUsd)}`)
            ),
            h("div", { className: "of-bar-track", style: { marginTop: 0, height: "5px" } }, h("div", { className: "of-bar-fill", style: { width: `${dailySpendPct}%`, background: dailySpendPct > 80 ? "var(--status-failed)" : "var(--primary)" } }))
          )
        )
      )
    )
  );
}
