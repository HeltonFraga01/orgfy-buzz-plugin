// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/inbox.tsx, reports/index.tsx, automations.tsx, agents.tsx, vision.tsx, components/factory/autonomy-dialog.tsx, limits-editor.tsx
// Páginas secundárias fiéis ao CodeDen: Holding, Inbox, Custos, Automações, Agentes (com eval R5.1 < 8/10 em vermelho), Visão e Configurações (Autonomy + LimitsEditor).

import type { AutonomyMode, FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import { PT_BR } from "../i18n/pt-BR";

export interface FactorySecondaryPagesProps {
  h: any;
  tab: "holding" | "inbox" | "costs" | "automations" | "agents" | "vision" | "settings";
  tenant: string;
  onSelectTenant: (t: string) => void;
  status: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  onSelectItem: (item: FactoryWorkItem) => void;
  // Estados de filtros/abas internas
  inboxFilter: "all" | "asks" | "reviews" | "problems";
  setInboxFilter: (f: "all" | "asks" | "reviews" | "problems") => void;
  costRange: "7d" | "30d" | "90d";
  setCostRange: (r: "7d" | "30d" | "90d") => void;
  autoTab: "automations" | "runs" | "templates";
  setAutoTab: (t: "automations" | "runs" | "templates") => void;
  agentTab: "eval" | "memory" | "skills" | "mcp" | "hooks";
  setAgentTab: (t: "eval" | "memory" | "skills" | "mcp" | "hooks") => void;
  // Configurações reais (controle-<tenant>.json)
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
}

const TENANTS = [
  { id: "orgfy", name: "OrgFy Core (Engenharia & Método)", desc: "Esteira determinística principal, CI 7/7 e governança L-01/L-22." },
  { id: "lumen-iptv", name: "Lumen IPTV", desc: "Operação multi-tenant ativa na Holding Cortexx." },
  { id: "saas-tributario", name: "SaaS Tributário", desc: "Empresa planejada no portfólio da Holding." },
];

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
    summary: "Você, o PM e automações encontram trabalho; você revisa e faz merge de cada PR.",
    finds: "Você, PM e automações",
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
    summary: "Fábrica de Software + Oráculo agendado revisando o app contra docs/VISION.md e abrindo issues.",
    finds: "Oráculo, você e confiáveis",
    merges: "Você (ou auto-merge)",
    experimental: true,
  },
];

export function renderFactorySecondaryPage(props: FactorySecondaryPagesProps) {
  const {
    h,
    tab,
    tenant,
    onSelectTenant,
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

  // ── 1. HOLDING ──
  if (tab === "holding") {
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { className: "of-card-pad" },
        h("div", { style: { fontSize: "15px", fontWeight: 700 } }, "Holding Cortexx · Portfólio Multi-Tenant"),
        h("div", { className: "of-muted", style: { marginTop: "2px" } }, "Selecione uma empresa para abrir sua Fábrica (dados vivos de fabrica_status.py --empresa <tenant>).")
      ),
      h(
        "div",
        { className: "of-grid-3" },
        TENANTS.map((t) =>
          h(
            "button",
            {
              key: t.id,
              type: "button",
              className: "of-card-pad",
              style: {
                textAlign: "left",
                cursor: "pointer",
                color: "var(--foreground)",
                borderColor: tenant === t.id ? "rgba(245,158,11,0.55)" : undefined,
              },
              onClick: () => onSelectTenant(t.id),
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
              h("strong", { style: { fontSize: "13.5px" } }, t.name),
              tenant === t.id && h("span", { className: "of-pill", "data-tone": "warn" }, "Ativo")
            ),
            h("div", { className: "of-muted", style: { marginTop: "6px", lineHeight: 1.4 } }, t.desc),
            h("div", { className: "of-mono of-muted", style: { marginTop: "10px", fontSize: "10.5px" } }, `tenant: ${t.id}`)
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

  // ── 3. CUSTOS (routes/reports/index.tsx) ──
  if (tab === "costs") {
    const economia = status.kpis?.economia || null;
    const qualidade = status.kpis?.qualidade || null;
    const porModelo = Array.isArray(economia?.por_modelo) ? economia.por_modelo : [];
    const maxCost = Math.max(0.01, ...porModelo.map((r: any) => Number(r.custo_usd || 0)));

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
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
        h("span", { className: "of-muted" }, `Fonte real: kpis-esteira.json (${status.kpis?.gerado_em || PT_BR.labels.unavailable})`)
      ),
      h(
        "div",
        { className: "of-surface", style: { padding: "8px 12px", fontSize: "11.5px", color: "var(--muted-foreground)" } },
        "Valores equivalentes de API calculados diretamente do kpis-esteira.json (sem dados sintéticos; campos ausentes aparecem como indisponível)."
      ),
      // 5 KPIs principais (UsageTotals)
      h(
        "div",
        { className: "of-stats-6" },
        [
          {
            label: "Custo amostra (USD)",
            val: typeof economia?.custo_usd_total_amostra === "number" ? `$${economia.custo_usd_total_amostra.toFixed(2)}` : PT_BR.labels.unavailable,
          },
          {
            label: "Tokens (7d)",
            val: typeof economia?.tokens_7d === "number" ? economia.tokens_7d.toLocaleString("pt-BR") : PT_BR.labels.unavailable,
          },
          {
            label: "Cache hit",
            val: typeof economia?.cache_hit_ratio_pct === "number" ? `${economia.cache_hit_ratio_pct.toFixed(1)}%` : PT_BR.labels.unavailable,
          },
          {
            label: "Gasto hoje",
            val: `$${status.spendToday.usd.toFixed(2)}`,
          },
          {
            label: "FPY real",
            val: typeof qualidade?.fpy_real_pct === "number" ? `${qualidade.fpy_real_pct.toFixed(1)}%` : PT_BR.labels.unavailable,
          },
        ].map((k) =>
          h(
            "div",
            { key: k.label, className: "of-card-pad", style: { padding: "10px 12px" } },
            h("div", { className: "of-meter-label" }, k.label),
            h("div", { className: "of-num", style: { fontSize: "19px", fontWeight: 700, marginTop: "4px" } }, k.val)
          )
        )
      ),
      // Tabela Breakdown por modelo com barras horizontais
      h(
        "div",
        { className: "of-card-pad" },
        h("div", { style: { fontSize: "13px", fontWeight: 700, marginBottom: "10px" } }, "Quebra por modelo (kpis-esteira.json)"),
        porModelo.length === 0
          ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
          : h(
              "table",
              { className: "of-table" },
              h(
                "thead",
                null,
                h("tr", null, h("th", null, "Modelo"), h("th", null, "Chamadas"), h("th", null, "Custo USD"), h("th", null, "Participação"), h("th", null, "Cache"))
              ),
              h(
                "tbody",
                null,
                porModelo.slice(0, 15).map((row: any, idx: number) => {
                  const usd = Number(row.custo_usd || 0);
                  const w = Math.min(100, (usd / maxCost) * 100);
                  return h(
                    "tr",
                    { key: `${row.modelo || idx}` },
                    h("td", { className: "of-mono" }, String(row.modelo || PT_BR.labels.unavailable)),
                    h("td", { className: "of-mono of-num" }, String(row.requisicoes ?? row.chamadas ?? PT_BR.labels.unavailable)),
                    h("td", { className: "of-mono of-num" }, typeof row.custo_usd === "number" ? `$${usd.toFixed(3)}` : PT_BR.labels.unavailable),
                    h(
                      "td",
                      { style: { width: "160px" } },
                      h("div", { className: "of-bar-track", style: { marginTop: 0 } }, h("div", { className: "of-bar-fill", style: { width: `${w}%`, background: "var(--chart-1)" } }))
                    ),
                    h("td", { className: "of-mono of-num" }, typeof row.cache_hit_pct === "number" ? `${row.cache_hit_pct.toFixed(1)}%` : PT_BR.labels.unavailable)
                  );
                })
              )
            )
      )
    );
  }

  // ── 4. AUTOMAÇÕES (routes/automations.tsx) ──
  if (tab === "automations") {
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { className: "of-segmented", style: { width: "fit-content" } },
        ([
          { id: "automations", label: "Automações" },
          { id: "runs", label: "Execuções" },
          { id: "templates", label: "Templates" },
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
      h(
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
              h("div", { className: "of-muted" }, "Coordenador da esteira (runner fixado em tag v13.0.0)")
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
            h("span", { className: "of-pill", "data-tone": "waiting" }, "Configurar no Buzz Desktop")
          )
        ),
        h(
          "div",
          { className: "of-card-pad" },
          h("div", { style: { fontSize: "13.5px", fontWeight: 700, marginBottom: "8px" } }, "Regras de operação"),
          h("div", { className: "of-muted", style: { lineHeight: 1.55 } }, "Os processos respeitam imediatamente o Kill Switch e o modo Dreno definidos em controle-<tenant>.json (Fase 1).")
        )
      )
    );
  }

  // ── 5. AGENTES (routes/agents.tsx + PRD v15 §9 eval < 8/10 em vermelho) ──
  if (tab === "agents") {
    const modelos = status.modelos || [];
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { className: "of-segmented", style: { width: "fit-content" } },
        ([
          { id: "eval", label: `Eval & Modelos (${modelos.length})` },
          { id: "memory", label: "Plantel ao vivo" },
          { id: "skills", label: "Skills" },
          { id: "mcp", label: "MCP (21 tools)" },
          { id: "hooks", label: "Hooks" },
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
      agentTab === "eval"
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
                  h(
                    "thead",
                    null,
                    h("tr", null, h("th", null, "Agente"), h("th", null, "Papel"), h("th", null, "Modelo"), h("th", null, "Tool call (R5.1)"))
                  ),
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
          )
        : h(
            "div",
            { className: "of-card-pad" },
            h("div", { style: { fontSize: "13.5px", fontWeight: 700, marginBottom: "8px" } }, `Plantel ao vivo (${liveCrew.length} agentes no Buzz)`),
            liveCrew.length === 0
              ? h("div", { className: "of-muted" }, "Nenhum agente retornado por ctx.agents.snapshot().")
              : h(
                  "table",
                  { className: "of-table" },
                  h("thead", null, h("tr", null, h("th", null, "Agente"), h("th", null, "Provider"), h("th", null, "Modelo"), h("th", null, "Estado"))),
                  h(
                    "tbody",
                    null,
                    liveCrew.map((a) =>
                      h(
                        "tr",
                        { key: a.key },
                        h("td", { style: { fontWeight: 600 } }, a.name),
                        h("td", { className: "of-mono of-muted" }, a.provider || "—"),
                        h("td", { className: "of-mono" }, a.model),
                        h("td", null, h("span", { className: "of-pill", "data-tone": a.running ? "running" : "idle" }, a.running ? "Ativo" : "Livre"))
                      )
                    )
                  )
                )
          )
    );
  }

  // ── 6. VISÃO (routes/vision.tsx) ──
  if (tab === "vision") {
    const sections = ["Objetivos (Goals)", "Usuários-alvo", "Princípios", "Fora de escopo", "Barra de qualidade"];
    return h(
      "div",
      { className: "of-grid-2" },
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
        h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Visão do produto · ${tenant}`),
        h("div", { className: "of-mono of-muted" }, "docs/VISION.md"),
        h(
          "div",
          { className: status.visionExists ? "of-surface" : "of-alert-banner", style: { padding: "12px" } },
          status.visionExists
            ? "Arquivo docs/VISION.md presente no repositório do tenant e lido pelos revisores e pelo Oráculo."
            : "Arquivo docs/VISION.md ainda não existe neste tenant. Crie-o na raiz docs/VISION.md para habilitar o modo Dark Factory."
        )
      ),
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
        h("div", { className: "of-meter-label" }, "Seções esperadas (VisionPreview)"),
        sections.map((s) =>
          h(
            "div",
            { key: s, style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" } },
            h("span", { className: "of-dot", "data-tone": status.visionExists ? "done" : "waiting" }),
            h("span", null, s)
          )
        ),
        h("div", { className: "of-meter-label", style: { marginTop: "8px" } }, "Áreas protegidas"),
        h("div", { className: "of-muted" }, "Mudanças em áreas protegidas nunca recebem auto-merge e sempre vão para sua decisão na Inbox.")
      )
    );
  }

  // ── 7. CONFIGURAÇÕES (autonomy-dialog.tsx + limits-editor.tsx) ──
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "14px", maxWidth: "880px" } },
    h(
      "div",
      { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
      h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Modo de autonomia (Escada CodeDen)"),
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
                borderColor: settingsForm.mode === m.id ? "rgba(245,158,11,0.65)" : undefined,
                background: settingsForm.mode === m.id ? "rgba(245,158,11,0.06)" : undefined,
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

    // LimitsEditor completo gravando em controle-<tenant>.json
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
