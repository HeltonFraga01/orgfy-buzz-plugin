import type { Context } from "@buzz/author";

// =============================================================================
// ORGFY CONTROL ROOM / COCKPIT — BUZZ DESKTOP NATIVE PLUGIN (CORDIS v4)
// Layout: "workspace" (Full-Bleed, Tríade Soberana, Zero Card-ception)
// Governança Determinística v10: 5 Raias, Multi-Tenant Holding, RSI & DSAP
// =============================================================================

export const inject = ["react", "pages", "settingsCards", "host"];

// Minimalist Functional SVGs (Zero Emojis Funcionais)
const SVG = {
  building: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("rect", { x: 4, y: 2, width: 16, height: 20, rx: 2 }),
      props.h("line", { x1: 9, y1: 22, x2: 9, y2: 18 }),
      props.h("line", { x1: 15, y1: 22, x2: 15, y2: 18 }),
      props.h("line", { x1: 9, y1: 6, x2: 9, y2: 6.01 }),
      props.h("line", { x1: 15, y1: 6, x2: 15, y2: 6.01 }),
      props.h("line", { x1: 9, y1: 10, x2: 9, y2: 10.01 }),
      props.h("line", { x1: 15, y1: 10, x2: 15, y2: 10.01 }),
      props.h("line", { x1: 9, y1: 14, x2: 9, y2: 14.01 }),
      props.h("line", { x1: 15, y1: 14, x2: 15, y2: 14.01 })
    ),
  zap: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 15, height: 15, ...props },
      props.h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
    ),
  message: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
    ),
  shield: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
    ),
  check: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("polyline", { points: "20 6 9 17 4 12" })
    ),
  cross: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
      props.h("line", { x1: 6, y1: 6, x2: 18, y2: 18 })
    ),
  refresh: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
    ),
  terminal: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("polyline", { points: "4 17 10 11 4 5" }),
      props.h("line", { x1: 12, y1: 19, x2: 20, y2: 19 })
    ),
  gitPr: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("circle", { cx: 18, cy: 18, r: 3 }),
      props.h("circle", { cx: 6, cy: 6, r: 3 }),
      props.h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
      props.h("line", { x1: 6, y1: 9, x2: 6, y2: 21 })
    ),
  alertTriangle: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 15, height: 15, ...props },
      props.h("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
      props.h("line", { x1: 12, y1: 9, x2: 12, y2: 13 }),
      props.h("line", { x1: 12, y1: 17, x2: 12.01, y2: 17 })
    ),
  chevronDown: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("polyline", { points: "6 9 12 15 18 9" })
    ),
  sidebarToggle: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
      props.h("line", { x1: 15, y1: 3, x2: 15, y2: 21 })
    ),
};

// SVG Icon Data URI para o Topbar / Dock do Buzz
const ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <path d="M7 10v4"/>
    <path d="M10 7h4"/>
    <path d="M14 17h-4"/>
    <path d="M17 14v-4"/>
  </svg>`
)}`;

// Modelos e Tenants da Holding
const TENANTS = [
  { id: "holding", name: "Holding OrgFy (Conselho)", slug: "all", desc: "Visão agregada cross-workspace da holding" },
  { id: "orgfy", name: "OrgFy Core (Framework)", slug: "orgfy", desc: "Core determinístico, esteira mínima e porteiro" },
  { id: "lumen-iptv", name: "Lumen IPTV (Streaming)", slug: "lumen-iptv", desc: "Vertical de entretenimento e OTT" },
  { id: "saas-tributario", name: "SaaS Tributário (Fiscal)", slug: "saas-tributario", desc: "Vertical contábil, compliance e RLS" },
];

export function apply(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  function OrgFyCockpit() {
    // Estados Globais de Tenant e Visibilidade
    const [activeTenant, setActiveTenant] = React.useState("orgfy");
    const [rightRailOpen, setRightRailOpen] = React.useState(true);
    const [copilotOpen, setCopilotOpen] = React.useState(false);
    const [activeCopilotAgent, setActiveCopilotAgent] = React.useState("OrgFy Bento [COO]");
    const [statusFilter, setStatusFilter] = React.useState("all");

    // Modais Interativos
    const [despachoModalOpen, setDespachoModalOpen] = React.useState(false);
    const [gateModalCard, setGateModalCard] = React.useState<any>(null);
    const [logsModalCard, setLogsModalCard] = React.useState<any>(null);
    const [logOutput, setLogOutput] = React.useState("");

    // Telemetria da Esteira
    const [fpyRate, setFpyRate] = React.useState(100.0);
    const [cpiRate, setCpiRate] = React.useState(0.94);
    const [porteiroActive, setPorteiroActive] = React.useState(true);

    // Form de Despacho
    const [selectedIssue, setSelectedIssue] = React.useState("issue-104");
    const [selectedExecutor, setSelectedExecutor] = React.useState("OrgFy_Atlas");
    const [selectedRevisor, setSelectedRevisor] = React.useState("OrgFy_Bento");

    // Form de Decisão do Gate & Detecção DSAP
    const [gateJustificativa, setGateJustificativa] = React.useState("");
    const [dsapSimilarity, setDsapSimilarity] = React.useState(0);

    // Cards da Pipeline Matrix (5 Raias)
    const [cards, setCards] = React.useState([
      {
        id: "card-104",
        issueId: "issue-104",
        title: "Isolamento de RLS em tabelas de faturamento e assinaturas",
        lane: "backlog",
        priority: "P0",
        tenant: "saas-tributario",
        executor: "OrgFy_Atlas",
        revisor: "OrgFy_Bento",
        tier: "Tier 1: Barato (enxuto_worktree)",
        sha: "a1b2c3d",
        elapsed: "há 12m",
        dsapScore: 0.12,
      },
      {
        id: "card-105",
        issueId: "issue-105",
        title: "Suporte a transcode HLS com fallback de bitrate dinâmico",
        lane: "despachados",
        priority: "P1",
        tenant: "lumen-iptv",
        executor: "OrgFy_Val",
        revisor: "QA Sentinel",
        tier: "Tier 1: Barato (enxuto_worktree)",
        sha: "e5f6g7h",
        elapsed: "há 34m",
        ciStatus: "pending",
      },
      {
        id: "card-106",
        issueId: "issue-106",
        title: "Worker headless para reconciliação do cache de aceite L-22",
        lane: "execucao",
        priority: "P0",
        tenant: "orgfy",
        executor: "OrgFy_Otto",
        revisor: "OrgFy_Bento Arquiteto",
        tier: "Tier 2: Revisor (verificacao_gate)",
        sha: "8899aabb",
        elapsed: "há 6m",
        pid: 48921,
        turno: "Turno 2/5",
        ciStatus: "running",
      },
      {
        id: "card-107",
        issueId: "issue-107",
        prId: "PR #42",
        title: "Certificação de probes caixa-preta Playwright para checkout",
        lane: "revisao",
        priority: "P0",
        tenant: "lumen-iptv",
        executor: "OrgFy_Lia",
        revisor: "QA Sentinel",
        tier: "Tier 3: Arquiteto (governanca_completa)",
        sha: "c05c52b",
        elapsed: "há 18m",
        ciStatus: "passed",
        probes: { http_rota: true, supabase_rls: true, playwright_console: true },
      },
      {
        id: "card-102",
        issueId: "issue-102",
        title: "Sincronização bidirecional do ci_cache e porteiro Nostr",
        lane: "concluido",
        priority: "P1",
        tenant: "orgfy",
        executor: "OrgFy_Hugo",
        revisor: "OrgFy_Bento",
        tier: "Tier 2: Revisor",
        sha: "7766554",
        elapsed: "há 2h",
        ciStatus: "passed",
      },
    ]);

    // Regras Probatórias (RSI / retro.py)
    const [regrasProbatorias, setRegrasProbatorias] = React.useState([
      {
        id: "R-001",
        desc: "Fixture limpa em testes de CI efêmero Swarm",
        cmd: "pytest -k fixture_clean",
        status: "EM_TESTE",
        cardsRestantes: 8,
        fpyImpact: "+2.1%",
      },
      {
        id: "R-002",
        desc: "Sanitização de token Nostr NIP-98 em chamadas HTTP",
        cmd: "python3 ferramentas/esteira/gate --check-nip98",
        status: "MANTIDA",
        cardsRestantes: 0,
        fpyImpact: "+4.5%",
      },
    ]);

    // Chat do Copiloto
    const [copilotMessages, setCopilotMessages] = React.useState([
      { sender: "OrgFy Bento [COO]", text: "Porteiro ativo escutando o relay wss://orgfy.communities.buzz.xyz. PR #42 pronto para o Gate Caixa-Preta." }
    ]);
    const [copilotInput, setCopilotInput] = React.useState("");

    // Algoritmo Preditivo DSAP ao digitar motivo de recusa
    const handleJustificativaChange = (txt: string) => {
      setGateJustificativa(txt);
      if (txt.toLowerCase().includes("fixture") || txt.toLowerCase().includes("timeout") || txt.toLowerCase().includes("mesmo erro")) {
        setDsapSimilarity(0.82);
      } else if (txt.length > 15) {
        setDsapSimilarity(0.45);
      } else {
        setDsapSimilarity(0.1);
      }
    };

    // Despacho de Card
    const handleDespachar = () => {
      if (selectedExecutor === selectedRevisor) {
        alert("Violação da Regra L-01: O executor não pode ser o mesmo agente revisor!");
        return;
      }
      const newCard = {
        id: `card-${Date.now().toString().slice(-4)}`,
        issueId: selectedIssue,
        title: `Despacho operacional para ${selectedIssue}`,
        lane: "despachados",
        priority: "P1",
        tenant: activeTenant === "all" ? "orgfy" : activeTenant,
        executor: selectedExecutor,
        revisor: selectedRevisor,
        tier: "Tier 1: Barato (enxuto_worktree)",
        sha: "d3e4f5a",
        elapsed: "agora",
        ciStatus: "pending",
      };
      setCards([...cards, newCard]);
      setDespachoModalOpen(false);

      // Invocação em background via ctx.host se disponível
      if (ctx.host && ctx.host.spawn) {
        ctx.host.spawn("bash", {
          args: [`echo "[ORGFY ESTEIRA] Despachado card ${newCard.issueId} -> ${newCard.executor}"`],
        }).catch(() => {});
      }
    };

    // Decisão do Gate
    const handleGateDecision = (acao: "aceito" | "recusado") => {
      if (!gateModalCard) return;
      if (acao === "aceito") {
        setCards(cards.map((c) => (c.id === gateModalCard.id ? { ...c, lane: "concluido" } : c)));
        setFpyRate(100.0);
        setGateModalCard(null);
      } else {
        if (dsapSimilarity >= 0.70) {
          alert(`[DSAP BACKTRACKING ENGATILHADO]\nSimilaridade de ${(dsapSimilarity * 100).toFixed(0)}% com recusa anterior detectada! O card foi devolvido para o COO @OrgFy Bento re-escopar.`);
        }
        setCards(cards.map((c) => (c.id === gateModalCard.id ? { ...c, lane: "backlog" } : c)));
        setFpyRate((prev) => Math.max(85, prev - 2.5));
        setGateModalCard(null);
      }
    };

    // Visualizar Logs ao Vivo
    const handleViewLogs = (card: any) => {
      setLogsModalCard(card);
      setLogOutput(`[STREAMING LOGS LIVE - PID: ${card.pid || 48921}]\nIniciando container Swarm: ephemeral-ci-${card.sha}...\nExecutando probe http_rota: Caddy Staging HTTP 200 OK\nExecutando probe supabase_rls: RLS verificado em 14 tabelas\nExecutando probe playwright_console: 0 erros, screenshot capturada.\n[SUCESSO] Gate Caixa-Preta aprovado pelo tip c05c52b.\n`);
    };

    // Chat Send
    const handleSendCopilot = () => {
      if (!copilotInput.trim()) return;
      const userMsg = { sender: "Helton Fraga (Operador)", text: copilotInput };
      let replyText = `Comando recebido por ${activeCopilotAgent}: Esteira determinística operando normalmente na vertical ${activeTenant}.`;
      if (copilotInput.startsWith("/status")) {
        replyText = `Status ${activeTenant}: FPY ${fpyRate.toFixed(1)}%, CPI ${cpiRate}, 5 cards na esteira, Porteiro ativo.`;
      } else if (copilotInput.startsWith("/rsi")) {
        replyText = `RSI: 2 regras ativas. R-001 (8/10 cards restantes, delta +2.1%). Catraca L-90 em prontidão.`;
      }
      setCopilotMessages([...copilotMessages, userMsg, { sender: activeCopilotAgent, text: replyText }]);
      setCopilotInput("");
    };

    // Filtragem de Cards por Tenant
    const filteredCards = cards.filter((c) => {
      if (activeTenant !== "all" && c.tenant !== activeTenant) return false;
      if (statusFilter !== "all" && c.lane !== statusFilter) return false;
      return true;
    });

    const lanes = [
      { id: "backlog", title: "1. Triagem & Backlog", desc: "kind:1621 (Issues)" },
      { id: "despachados", title: "2. Despachados", desc: "CoEvo-RSI Tiers" },
      { id: "execucao", title: "3. Em Execução", desc: "Workers Headless" },
      { id: "revisao", title: "4. Revisão & Gate C.P.", desc: "Swarm CI + Probes" },
      { id: "concluido", title: "5. Concluído", desc: "Merged na main" },
    ];

    return h(
      "div",
      {
        "data-project-context-detached": "true",
        style: {
          width: "100%",
          minHeight: "100vh",
          backgroundColor: "#080d0b",
          backgroundImage: "radial-gradient(ellipse at top left, rgba(16, 185, 129, 0.08) 0%, rgba(8, 13, 11, 0.95) 70%)",
          color: "#f3f4f6",
          fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          display: "flex",
          flexDirection: "column",
          padding: "10px 12px",
          boxSizing: "border-box",
        },
      },

      // ─────────────────────────────────────────────────────────────────────────
      // TOP CHROME / HEADER DE GOVERNANÇA MULTI-TENANT
      // ─────────────────────────────────────────────────────────────────────────
      h(
        "header",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            backgroundColor: "rgba(18, 24, 21, 0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            marginBottom: "12px",
            flexWrap: "wrap",
            gap: "12px",
          },
        },
        // Esquerda: Marca + Seletor de Tenant da Holding
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "12px" } },
          h(
            "div",
            {
              style: {
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              },
            },
            SVG.building({ h, width: 18, height: 18 })
          ),
          h(
            "div",
            null,
            h("div", { style: { fontSize: "14px", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.01em" } }, "OrgFy Control Room"),
            h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Holding Cortexx • Esteira v10")
          ),
          // Seletor de Tenant da Holding
          h(
            "div",
            { style: { position: "relative", marginLeft: "12px" } },
            h(
              "select",
              {
                value: activeTenant,
                onChange: (e: any) => setActiveTenant(e.target.value),
                style: {
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  color: "#f3f4f6",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "8px",
                  padding: "6px 28px 6px 12px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  outline: "none",
                  appearance: "none",
                },
              },
              TENANTS.map((t) =>
                h("option", { key: t.slug, value: t.slug, style: { backgroundColor: "#121815", color: "#f3f4f6" } }, t.name)
              )
            ),
            h(
              "div",
              { style: { position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#10b981" } },
              SVG.chevronDown({ h, width: 12, height: 12 })
            )
          )
        ),

        // Centro: Telemetria do Porteiro Nostr e Métricas Rápidas
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "16px" } },
          // Pílula do Porteiro
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                borderRadius: "9999px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontSize: "11px",
                fontWeight: "600",
                color: "#10b981",
              },
            },
            h("div", {
              style: {
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 8px #10b981",
              },
            }),
            "PORTEIRO NOSTR ATIVO"
          ),
          // FPY Metric
          h(
            "div",
            { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
            h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, "FPY:"),
            h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#10b981" } }, `${fpyRate.toFixed(1)}%`)
          ),
          // CPI Metric
          h(
            "div",
            { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
            h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, "CPI Tokens:"),
            h("span", { style: { fontSize: "14px", fontWeight: "700", color: cpiRate >= 0.85 ? "#10b981" : "#ef4444" } }, cpiRate.toFixed(2))
          )
        ),

        // Direita: Botões de Ação
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          // Botão Novo Despacho
          h(
            "button",
            {
              onClick: () => setDespachoModalOpen(true),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#10b981",
                color: "#080d0b",
                fontWeight: "700",
                fontSize: "12px",
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
              },
            },
            SVG.zap({ h, width: 14, height: 14 }),
            "Novo Despacho"
          ),
          // Botão Toggle Copiloto
          h(
            "button",
            {
              onClick: () => setCopilotOpen(!copilotOpen),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: copilotOpen ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
                color: copilotOpen ? "#10b981" : "#f3f4f6",
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
              },
            },
            SVG.message({ h, width: 14, height: 14 }),
            "Copiloto"
          ),
          // Botão Toggle Right-Rail Governança
          h(
            "button",
            {
              onClick: () => setRightRailOpen(!rightRailOpen),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: rightRailOpen ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
                color: rightRailOpen ? "#10b981" : "#f3f4f6",
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
              },
            },
            SVG.sidebarToggle({ h, width: 14, height: 14 }),
            "Governança"
          )
        )
      ),

      // ─────────────────────────────────────────────────────────────────────────
      // CORPO PRINCIPAL: ILHA CENTRAL + COSTA DIREITA
      // ─────────────────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            display: "flex",
            gap: "12px",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          },
        },
        // ILHA CENTRAL FLUTUANTE (Live Pipeline Matrix)
        h(
          "main",
          {
            style: {
              flex: 1,
              backgroundColor: "#111714",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            },
          },
          // Header Tático da Matrix
          h(
            "div",
            {
              style: {
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#ffffff" } }, "Live Pipeline Matrix"),
              h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, `(${filteredCards.length} cards em voo)`)
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              ["all", "backlog", "execucao", "revisao", "concluido"].map((st) =>
                h(
                  "button",
                  {
                    key: st,
                    onClick: () => setStatusFilter(st),
                    style: {
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: statusFilter === st ? "rgba(16, 185, 129, 0.2)" : "transparent",
                      color: statusFilter === st ? "#10b981" : "#9ca3af",
                      fontWeight: statusFilter === st ? "700" : "500",
                      cursor: "pointer",
                    },
                  },
                  st === "all" ? "Todos" : st
                )
              )
            )
          ),

          // Colunas Kanban (5 Raias)
          h(
            "div",
            {
              style: {
                flex: 1,
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "12px",
                padding: "16px",
                overflowX: "auto",
                overflowY: "auto",
              },
            },
            lanes.map((lane) => {
              const laneCards = filteredCards.filter((c) => c.lane === lane.id);
              return h(
                "div",
                {
                  key: lane.id,
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    minWidth: "220px",
                    overflow: "hidden",
                  },
                },
                // Cabeçalho da Raia
                h(
                  "div",
                  {
                    style: {
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                    },
                  },
                  h(
                    "div",
                    null,
                    h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, lane.title),
                    h("div", { style: { fontSize: "10px", color: "#6b7280" } }, lane.desc)
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "2px 6px",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        color: "#9ca3af",
                      },
                    },
                    laneCards.length
                  )
                ),
                // Lista de Cards
                h(
                  "div",
                  {
                    style: {
                      flex: 1,
                      padding: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      overflowY: "auto",
                    },
                  },
                  laneCards.map((card) =>
                    h(
                      "div",
                      {
                        key: card.id,
                        style: {
                          backgroundColor: "#161e1a",
                          borderRadius: "10px",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                        },
                      },
                      // Topo do Card: Prioridade + ID + Elapsed
                      h(
                        "div",
                        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: card.priority === "P0" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                              color: card.priority === "P0" ? "#ef4444" : "#f59e0b",
                            },
                          },
                          card.priority
                        ),
                        h("span", { style: { fontSize: "11px", fontWeight: "600", color: "#10b981" } }, card.issueId),
                        h("span", { style: { fontSize: "10px", color: "#6b7280" } }, card.elapsed)
                      ),
                      // Título
                      h(
                        "div",
                        { style: { fontSize: "12px", fontWeight: "600", color: "#e5e7eb", lineHeight: "1.4" } },
                        card.title
                      ),
                      // Alocação & Tier
                      h(
                        "div",
                        { style: { fontSize: "11px", color: "#9ca3af", display: "flex", flexDirection: "column", gap: "2px" } },
                        h("div", null, `Exec: ${card.executor}`),
                        h("div", null, `Rev: ${card.revisor}`),
                        h(
                          "div",
                          {
                            style: {
                              fontSize: "10px",
                              fontWeight: "600",
                              color: card.tier.includes("Tier 3") ? "#a855f7" : card.tier.includes("Tier 2") ? "#3b82f6" : "#10b981",
                            },
                          },
                          card.tier
                        )
                      ),
                      // Rodapé do Card com Ações
                      h(
                        "div",
                        {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                            paddingTop: "8px",
                            marginTop: "4px",
                          },
                        },
                        h("span", { style: { fontSize: "10px", fontFamily: "monospace", color: "#6b7280" } }, card.sha),
                        // Botão contextual
                        card.lane === "execucao"
                          ? h(
                              "button",
                              {
                                onClick: () => handleViewLogs(card),
                                style: {
                                  fontSize: "10px",
                                  fontWeight: "600",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(59, 130, 246, 0.2)",
                                  color: "#60a5fa",
                                  border: "none",
                                  cursor: "pointer",
                                },
                              },
                              "Ver Logs Live"
                            )
                          : card.lane === "revisao"
                          ? h(
                              "button",
                              {
                                onClick: () => setGateModalCard(card),
                                style: {
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  backgroundColor: "#10b981",
                                  color: "#080d0b",
                                  border: "none",
                                  cursor: "pointer",
                                },
                              },
                              "Decidir Gate"
                            )
                          : null
                      )
                    )
                  )
                )
              );
            })
          )
        ),

        // ───────────────────────────────────────────────────────────────────────
        // COSTA DIREITA (Native Right-Rail de Governança, RSI e EVM)
        // ───────────────────────────────────────────────────────────────────────
        rightRailOpen
          ? h(
              "aside",
              {
                style: {
                  width: "320px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  overflowY: "auto",
                },
              },
              // Seção EVM / Tokens
              h(
                "div",
                {
                  style: {
                    backgroundColor: "rgba(18, 24, 21, 0.75)",
                    borderRadius: "14px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "16px",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" } },
                  SVG.shield({ h, width: 16, height: 16, color: "#10b981" }),
                  h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#ffffff" } }, "Governança EVM & Tokens")
                ),
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" } },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between" } },
                    h("span", { style: { color: "#9ca3af" } }, "CPI Acumulado:"),
                    h("span", { style: { fontWeight: "700", color: "#10b981" } }, `${cpiRate.toFixed(2)} (Min: 0.85)`)
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between" } },
                    h("span", { style: { color: "#9ca3af" } }, "Circuit Breaker Loops:"),
                    h("span", { style: { fontWeight: "700", color: "#10b981" } }, "0 / 3 (Normal)")
                  ),
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between" } },
                    h("span", { style: { color: "#9ca3af" } }, "Integrados no Ciclo:"),
                    h("span", { style: { fontWeight: "700", color: "#f3f4f6" } }, "14 cards")
                  )
                )
              ),

              // Seção RSI (Regras Probatórias Compiladas)
              h(
                "div",
                {
                  style: {
                    backgroundColor: "rgba(18, 24, 21, 0.75)",
                    borderRadius: "14px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    SVG.refresh({ h, width: 15, height: 15, color: "#10b981" }),
                    h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#ffffff" } }, "Catraca RSI (retro.py)")
                  ),
                  h("span", { style: { fontSize: "10px", color: "#10b981", fontWeight: "600" } }, "Janela 10 Cards")
                ),
                regrasProbatorias.map((r) =>
                  h(
                    "div",
                    {
                      key: r.id,
                      style: {
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        borderRadius: "8px",
                        padding: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                      h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, r.id),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: r.status === "MANTIDA" ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.2)",
                            color: r.status === "MANTIDA" ? "#10b981" : "#60a5fa",
                          },
                        },
                        r.status
                      )
                    ),
                    h("div", { style: { fontSize: "11px", color: "#d1d5db" } }, r.desc),
                    h(
                      "div",
                      { style: { display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" } },
                      h("span", null, r.status === "EM_TESTE" ? `${r.cardsRestantes}/10 restantes` : "Promovida"),
                      h("span", { style: { color: "#10b981", fontWeight: "600" } }, `FPY ${r.fpyImpact}`)
                    )
                  )
                )
              ),

              // Seção DSAP Backtracking Status
              h(
                "div",
                {
                  style: {
                    backgroundColor: "rgba(18, 24, 21, 0.75)",
                    borderRadius: "14px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "16px",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
                  SVG.alertTriangle({ h, width: 15, height: 15, color: "#10b981" }),
                  h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#ffffff" } }, "Detector DSAP (arXiv:2610)")
                ),
                h(
                  "p",
                  { style: { fontSize: "11px", color: "#9ca3af", margin: 0, lineHeight: "1.4" } },
                  "Nenhum backtracking ativo. Se uma 2ª recusa apresentar similaridade >= 0.70, o card será compulsoriamente escalonado para o COO."
                )
              )
            )
          : null
      ),

      // ─────────────────────────────────────────────────────────────────────────
      // ILHA DO COPILOTO SAGRADO PERSONIFICÁVEL (CHAT RETRÁTIL)
      // ─────────────────────────────────────────────────────────────────────────
      copilotOpen
        ? h(
            "div",
            {
              style: {
                position: "fixed",
                bottom: "20px",
                right: rightRailOpen ? "340px" : "20px",
                width: "360px",
                height: "440px",
                backgroundColor: "#111714",
                borderRadius: "16px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                zIndex: 100,
              },
            },
            // Header do Copiloto com Dropdown de Personificação
            h(
              "div",
              {
                style: {
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                },
              },
              h(
                "select",
                {
                  value: activeCopilotAgent,
                  onChange: (e: any) => setActiveCopilotAgent(e.target.value),
                  style: {
                    backgroundColor: "transparent",
                    color: "#10b981",
                    fontWeight: "700",
                    fontSize: "12px",
                    border: "none",
                    cursor: "pointer",
                    outline: "none",
                  },
                },
                ["OrgFy Iris [CEO]", "OrgFy Bento [COO]", "OrgFy Bento Arquiteto", "QA Sentinel"].map((ag) =>
                  h("option", { key: ag, value: ag, style: { backgroundColor: "#111714", color: "#ffffff" } }, ag)
                )
              ),
              h(
                "button",
                {
                  onClick: () => setCopilotOpen(false),
                  style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                },
                SVG.cross({ h, width: 14, height: 14 })
              )
            ),
            // Mensagens
            h(
              "div",
              {
                style: {
                  flex: 1,
                  padding: "12px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "12px",
                },
              },
              copilotMessages.map((msg, i) =>
                h(
                  "div",
                  {
                    key: i,
                    style: {
                      alignSelf: msg.sender.includes("Helton") ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      backgroundColor: msg.sender.includes("Helton") ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    },
                  },
                  h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#10b981", marginBottom: "2px" } }, msg.sender),
                  h("div", { style: { color: "#f3f4f6", lineHeight: "1.3" } }, msg.text)
                )
              )
            ),
            // Input do Copiloto
            h(
              "div",
              {
                style: {
                  padding: "10px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  gap: "6px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                },
              },
              h("input", {
                type: "text",
                placeholder: "Falar ou comando /status, /rsi...",
                value: copilotInput,
                onChange: (e: any) => setCopilotInput(e.target.value),
                onKeyDown: (e: any) => e.key === "Enter" && handleSendCopilot(),
                style: {
                  flex: 1,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                },
              }),
              h(
                "button",
                {
                  onClick: handleSendCopilot,
                  style: {
                    backgroundColor: "#10b981",
                    color: "#080d0b",
                    fontWeight: "700",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: "11px",
                  },
                },
                "Enviar"
              )
            )
          )
        : null,

      // ─────────────────────────────────────────────────────────────────────────
      // MODAL: NOVO DESPACHO (COM BLOQUEIO DA REGRA L-01)
      // ─────────────────────────────────────────────────────────────────────────
      despachoModalOpen
        ? h(
            "div",
            {
              style: {
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
              },
            },
            h(
              "div",
              {
                style: {
                  width: "500px",
                  backgroundColor: "#111714",
                  borderRadius: "16px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                },
              },
              // Header
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("h2", { style: { fontSize: "16px", fontWeight: "700", color: "#ffffff", margin: 0 } }, "Novo Despacho Operacional"),
                h(
                  "button",
                  {
                    onClick: () => setDespachoModalOpen(false),
                    style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                  },
                  SVG.cross({ h, width: 16, height: 16 })
                )
              ),
              // Campo 1: Issue
              h(
                "div",
                null,
                h("label", { style: { fontSize: "12px", color: "#9ca3af", display: "block", marginBottom: "4px" } }, "Issue / Card"),
                h(
                  "select",
                  {
                    value: selectedIssue,
                    onChange: (e: any) => setSelectedIssue(e.target.value),
                    style: {
                      width: "100%",
                      padding: "8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    },
                  },
                  h("option", { value: "issue-104" }, "issue-104: Isolamento de RLS em tabelas"),
                  h("option", { value: "issue-108" }, "issue-108: Cache de aceite L-22 para PRs"),
                  h("option", { value: "issue-109" }, "issue-109: Otimização de queries Supabase")
                )
              ),
              // Campo 2: Executor
              h(
                "div",
                null,
                h("label", { style: { fontSize: "12px", color: "#9ca3af", display: "block", marginBottom: "4px" } }, "Executor (Tier de Capacidade)"),
                h(
                  "select",
                  {
                    value: selectedExecutor,
                    onChange: (e: any) => setSelectedExecutor(e.target.value),
                    style: {
                      width: "100%",
                      padding: "8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    },
                  },
                  h("option", { value: "OrgFy_Atlas" }, "OrgFy Atlas (Tier 1 Barato - enxuto_worktree)"),
                  h("option", { value: "OrgFy_Otto" }, "OrgFy Otto (Tier 1 Barato - enxuto_worktree)"),
                  h("option", { value: "OrgFy_Val" }, "OrgFy Val (Tier 2 Revisor - verificacao_gate)")
                )
              ),
              // Campo 3: Revisor Independente (Bloqueio L-01)
              h(
                "div",
                null,
                h("label", { style: { fontSize: "12px", color: "#9ca3af", display: "block", marginBottom: "4px" } }, "Revisor Independente (Regra L-01: diferente do executor)"),
                h(
                  "select",
                  {
                    value: selectedRevisor,
                    onChange: (e: any) => setSelectedRevisor(e.target.value),
                    style: {
                      width: "100%",
                      padding: "8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    },
                  },
                  h("option", { value: "OrgFy_Bento" }, "OrgFy Bento (COO / Revisor Master)"),
                  h("option", { value: "QA Sentinel" }, "QA Sentinel (Auditor Caixa-Preta)"),
                  h("option", { value: "OrgFy_Bento Arquiteto" }, "OrgFy Bento Arquiteto")
                )
              ),
              // Preview do Comando Determinístico
              h(
                "div",
                {
                  style: {
                    padding: "8px 10px",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "#10b981",
                  },
                },
                `ferramentas/esteira/despachar --empresa ${activeTenant === "all" ? "orgfy" : activeTenant} ${selectedIssue} ${selectedExecutor} ${selectedRevisor}`
              ),
              // Botões
              h(
                "div",
                { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
                h(
                  "button",
                  {
                    onClick: () => setDespachoModalOpen(false),
                    style: {
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "transparent",
                      color: "#9ca3af",
                      border: "none",
                      cursor: "pointer",
                    },
                  },
                  "Cancelar"
                ),
                h(
                  "button",
                  {
                    onClick: handleDespachar,
                    style: {
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#10b981",
                      color: "#080d0b",
                      fontWeight: "700",
                      border: "none",
                      cursor: "pointer",
                    },
                  },
                  "Despachar Imediatamente"
                )
              )
            )
          )
        : null,

      // ─────────────────────────────────────────────────────────────────────────
      // MODAL: DECISÃO DO GATE CAIXA-PRETA COM DETECTOR DSAP
      // ─────────────────────────────────────────────────────────────────────────
      gateModalCard
        ? h(
            "div",
            {
              style: {
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
              },
            },
            h(
              "div",
              {
                style: {
                  width: "550px",
                  backgroundColor: "#111714",
                  borderRadius: "16px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                },
              },
              // Header
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("h2", { style: { fontSize: "16px", fontWeight: "700", color: "#ffffff", margin: 0 } }, `Gate Caixa-Preta: ${gateModalCard.prId || gateModalCard.issueId}`),
                h(
                  "button",
                  {
                    onClick: () => setGateModalCard(null),
                    style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                  },
                  SVG.cross({ h, width: 16, height: 16 })
                )
              ),
              // Probes Caixa-Preta
              h(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                    padding: "10px",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px",
                  },
                },
                h(
                  "div",
                  { style: { textAlign: "center" } },
                  h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "http_rota"),
                  h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, "HTTP 200 OK")
                ),
                h(
                  "div",
                  { style: { textAlign: "center" } },
                  h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "supabase_rls"),
                  h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, "14 Tabelas RLS")
                ),
                h(
                  "div",
                  { style: { textAlign: "center" } },
                  h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "playwright_console"),
                  h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, "0 Erros + Print")
                )
              ),
              // Campo de Justificativa
              h(
                "div",
                null,
                h("label", { style: { fontSize: "12px", color: "#9ca3af", display: "block", marginBottom: "4px" } }, "Justificativa da Revisão / Recusa:"),
                h("textarea", {
                  rows: 3,
                  placeholder: "Descreva os motivos técnicos no caso de recusa...",
                  value: gateJustificativa,
                  onChange: (e: any) => handleJustificativaChange(e.target.value),
                  style: {
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  },
                })
              ),
              // Banner Preditivo DSAP
              dsapSimilarity >= 0.70
                ? h(
                    "div",
                    {
                      style: {
                        padding: "10px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "11px",
                        color: "#fca5a5",
                      },
                    },
                    SVG.alertTriangle({ h, width: 16, height: 16, color: "#ef4444" }),
                    h("span", null, `ALERTA DSAP: Similaridade de ${(dsapSimilarity * 100).toFixed(0)}% com a 1ª recusa. A recusa engatilhará [DSAP BACKTRACKING] para o COO @OrgFy Bento.`)
                  )
                : null,
              // Botões de Decisão
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" } },
                h(
                  "button",
                  {
                    onClick: () => handleGateDecision("recusado"),
                    style: {
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      fontWeight: "700",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      cursor: "pointer",
                    },
                  },
                  "Recusar PR"
                ),
                h(
                  "button",
                  {
                    onClick: () => handleGateDecision("aceito"),
                    style: {
                      padding: "8px 20px",
                      borderRadius: "6px",
                      backgroundColor: "#10b981",
                      color: "#080d0b",
                      fontWeight: "700",
                      border: "none",
                      cursor: "pointer",
                    },
                  },
                  "Aceitar PR (Merge na Main)"
                )
              )
            )
          )
        : null,

      // ─────────────────────────────────────────────────────────────────────────
      // MODAL: CONSOLE STREAMING DE LOGS
      // ─────────────────────────────────────────────────────────────────────────
      logsModalCard
        ? h(
            "div",
            {
              style: {
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
              },
            },
            h(
              "div",
              {
                style: {
                  width: "650px",
                  backgroundColor: "#0d1310",
                  borderRadius: "16px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  SVG.terminal({ h, width: 16, height: 16, color: "#10b981" }),
                  h("span", { style: { fontSize: "14px", fontWeight: "700", color: "#ffffff" } }, `Logs Streaming: ${logsModalCard.title}`)
                ),
                h(
                  "button",
                  {
                    onClick: () => setLogsModalCard(null),
                    style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" },
                  },
                  SVG.cross({ h, width: 14, height: 14 })
                )
              ),
              h(
                "pre",
                {
                  style: {
                    margin: 0,
                    padding: "12px",
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    borderRadius: "8px",
                    color: "#10b981",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    maxHeight: "350px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                  },
                },
                logOutput
              )
            )
          )
        : null
    );
  }

  // 1. Registro da Página Master no Buzz Desktop
  ctx.pages.register({
    id: "orgfy-cockpit",
    title: "OrgFy Control Room",
    layout: "workspace", // Full-bleed sem margens artificiais de documento
    primary: true,
    placement: "topbar",
    icon: ICON,
    component: OrgFyCockpit,
  });

  // 2. Registro do Card de Governança em Configurações
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "orgfy-settings",
      title: "OrgFy Control Room",
      group: "Pipelines & Autonomous Systems",
      component: OrgFyCockpit,
    });
  }
}
