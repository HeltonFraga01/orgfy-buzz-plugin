// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/inbox.tsx, reports/index.tsx, automations.tsx, agents.tsx, vision.tsx, components/factory/autonomy-dialog.tsx, limits-editor.tsx
// Páginas secundárias 100% adaptadas ao motor OrgFy: Conselho (Board), Inbox, Uso & Custos, Automações, Agentes por Empresa (com papel, modelo vivo e DM ↗), Canvas / Visão e Configurações.

import type { AutonomyMode, FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { BuzzCanvasHistoryEntry, BuzzLiveTelemetrySnapshot } from "./buzz-live-telemetry";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import type { HoldingControlPlaneSnapshot } from "../services/holding-service";
import type { BuzzChannelLiveInfo } from "../services/buzz-channel-live";
import { renderBuzzCanvasViewer } from "../components/BuzzCanvasViewer";
import { renderAutomationEditor, type OrgfyAutomation } from "./AutomationEditor";
import type {
  CrdtBackendInfo,
  OrgfyCouncilDeliberation,
  OrgfyDistributedLock,
  OrgfyQuestionCard,
  QuestionCardAnswer,
} from "../services/orgfy-crdt-store";
import type { BuzzNativeUsageSnapshot } from "../services/buzz-usage-live";
import type { BuzzFocusState } from "../services/buzz-focus";
import type { CommandIntegrityAuditSummary } from "../services/command-integrity";
import { PT_BR } from "../i18n/pt-BR";
import { renderFactoryUsageAndCostPage, type UsageDimension, type UsageMetric } from "./FactoryUsageAndCostPage";
import { renderFactoryInboxPage } from "./FactoryInboxPage";

export interface FactorySecondaryPagesProps {
  h: any;
  tab: "holding" | "inbox" | "costs" | "automations" | "agents" | "vision" | "settings";
  tenant: string;
  holding: HoldingControlPlaneSnapshot | null;
  telemetry?: BuzzLiveTelemetrySnapshot;
  channelCanvas?: string | null;
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
  onOpenChannelFullPage?: (opts?: { panel?: "members" }) => void;
  onOpenBuzzLink?: (href: string) => void;
  Boardroom3D?: any;
  onReconcileAgents?: () => void;
  onAgentSessionAction?: (agentKey: string, action: "interrupt" | "compact" | "new") => void;
  onOpenAgentDrawer?: (agentKey: string) => void;
  onSaveAgentProfile?: (agentKey: string, patch: { provider: string; model: string; instructions?: string }) => Promise<void> | void;
  editingAgentKey?: string | null;
  setEditingAgentKey?: (k: string | null) => void;
  agentEditDraft?: { provider: string; model: string; instructions: string };
  setAgentEditDraft?: (patch: Partial<{ provider: string; model: string; instructions: string }>) => void;
  canvasDraft?: string;
  setCanvasDraft?: (v: string) => void;
  canvasMode?: "view" | "edit" | "history";
  setCanvasMode?: (m: "view" | "edit" | "history") => void;
  canvasWritable?: boolean;
  canvasSaving?: boolean;
  onSaveCanvas?: () => void;
  onReloadCanvas?: () => void;
  canvasHistory?: BuzzCanvasHistoryEntry[];
  channelInfo?: BuzzChannelLiveInfo | null;
  editingChannelDetails?: boolean;
  setEditingChannelDetails?: (v: boolean) => void;
  channelDetailsDraft?: { name: string; description: string };
  setChannelDetailsDraft?: (patch: Partial<{ name: string; description: string }>) => void;
  savingChannelDetails?: boolean;
  onSaveChannelDetails?: () => void;
  onChannelDiagnostic?: (action: "markRead" | "markUnread" | "refresh") => void;
  onCopyText?: (text: string, label: string) => void;
  resolveAuthor?: (pubkey: string) => string;
  automations?: OrgfyAutomation[];
  selectedAutomationId?: string;
  onSelectAutomationId?: (id: string) => void;
  onUpdateAutomation?: (id: string, patch: Partial<OrgfyAutomation>) => void;
  onCreateAutomation?: (initial?: Partial<OrgfyAutomation>) => void;
  onDuplicateAutomation?: (auto: OrgfyAutomation) => void;
  onDeleteAutomation?: (id: string) => void;
  onSaveAutomations?: () => void;
  onRunAutomationNow?: (auto: OrgfyAutomation) => void;
  onExportAutomationYaml?: (auto: OrgfyAutomation) => void;
  onExportAutomationMarkdown?: (auto: OrgfyAutomation) => void;
  onImportAutomation?: (auto: OrgfyAutomation) => void;
  onAddStarterSet?: () => void;
  automationView?: "list" | "detail";
  setAutomationView?: (v: "list" | "detail") => void;
  runningAutomationId?: string | null;
  QuestionCardsPanel?: any;
  questionCards?: OrgfyQuestionCard[];
  crdtBackendInfo?: CrdtBackendInfo;
  onAnswerQuestionCard?: (card: OrgfyQuestionCard, answer: QuestionCardAnswer) => Promise<void> | void;
  onDismissQuestionCard?: (card: OrgfyQuestionCard) => Promise<void> | void;
  nativeUsage?: BuzzNativeUsageSnapshot | null;
  onRefreshNativeUsage?: () => void;
  focusState?: BuzzFocusState;
  commandIntegrity?: CommandIntegrityAuditSummary | null;
  onAuditCommandIntegrity?: () => void;
  onRunHoldoutNow?: () => void;
  runningHoldout?: boolean;
  councilDeliberations?: OrgfyCouncilDeliberation[];
  distributedLocks?: OrgfyDistributedLock[];
  onCreateCouncilDeliberation?: (title: string, summary: string) => Promise<void> | void;
  onVoteCouncilDeliberation?: (id: string, decision: "aprovada" | "recusada") => Promise<void> | void;
  onReleaseDistributedLock?: (id: string) => Promise<void> | void;
  onAutomateFromSession?: (input: { agentName: string; stepLabel?: string; sessionTitle?: string }) => void;
  onEvaluateTrustEngine?: (override?: { category: string; mode: "assisted" | "dark_auto_merge" | "auto" }) => Promise<void> | void;
  evaluatingTrust?: boolean;
  onScaffoldSubsidiary?: (input: { slug: string; nome: string; descricao: string; budgetTokensDiario: number; gastoDiaUsd: number }) => Promise<void> | void;
  scaffoldingSubsidiary?: boolean;
  subsidiaryDraft?: { open: boolean; slug: string; nome: string; descricao: string; budgetTokensDiario: number; gastoDiaUsd: number };
  setSubsidiaryDraft?: (patch: Partial<{ open: boolean; slug: string; nome: string; descricao: string; budgetTokensDiario: number; gastoDiaUsd: number }>) => void;
  evalFilter?: "all" | "attention" | "approved";
  setEvalFilter?: (f: "all" | "attention" | "approved") => void;
  mcpTools?: Array<{ name: string; description: string; category: string; params: string[]; required: string[] }>;
  mcpSearch?: string;
  setMcpSearch?: (v: string) => void;
  mcpCategory?: string;
  setMcpCategory?: (v: string) => void;
  onOpenAgentProfile?: (target: { key?: string; pubkey?: string; name?: string } | string) => void;
  onMigrateSingleAgentModel?: (agentKey: string, target: { provider: string; model: string }) => Promise<void> | void;
  usageDimension?: UsageDimension;
  setUsageDimension?: (d: UsageDimension) => void;
  usageMetric?: UsageMetric;
  setUsageMetric?: (m: UsageMetric) => void;
  usageHoverDay?: number | null;
  setUsageHoverDay?: (i: number | null) => void;
  usageFilterModel?: string | null;
  setUsageFilterModel?: (m: string | null) => void;
  pricesOpen?: boolean;
  setPricesOpen?: (v: boolean) => void;
  onOpenSettings?: () => void;
  inboxDismissedIds?: string[];
  onInboxDismissIds?: (ids: string[], label?: string) => void;
  onInboxRestoreIds?: (ids: string[]) => void;
  confirmBulkDismiss?: boolean;
  setConfirmBulkDismiss?: (v: boolean) => void;
  lastBulkDismiss?: { ids: string[]; label: string } | null;
  onOpenItemInBuzz?: (item: FactoryWorkItem) => void;
  onRetryInboxItem?: (item: FactoryWorkItem) => void;
  onResumeFactory?: () => void;
  onOpenFactoryPanel?: () => void;
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

  // ── 1. CONSELHO DA HOLDING (BOARD) — ESPELHA UMA HOLDING REAL (BESTIE IRIS + CONSELHO COMO EMPRESA COM PIPELINE PRÓPRIO) ──
  if (tab === "holding") {
    const empresas = holding?.empresas || [];
    const boardAreas = holding?.conselho || [];
    const approvals = holding?.approvals || [];
    const deliberations = props.councilDeliberations || [];
    const pendingDelibs = deliberations.filter((d) => d.status === "pendente").length;
    const approvedDelibs = deliberations.filter((d) => d.status === "aprovada").length;
    const pendingApprovals = approvals.filter((a) => a.status === "pendente").length;

    const resolveMemberPubkey = (name: string) => {
      const low = name.toLowerCase();
      const match = liveCrew.find((c) => c.name.toLowerCase() === low);
      return match?.pubkey || "";
    };

    // Na mesa do Boardroom 3D sentam a Bestie (OrgFy Iris) na cabeceira + os Conselheiros funcionais do Board (não nomes de empresas)
    const boardroomSeats = [
      {
        id: "bestie-iris",
        label: holding?.ceoHolding?.nome || "OrgFy Iris",
        role: "Bestie · Orquestradora Buzz",
        status: (holding?.ceoHolding?.pubkey && props.telemetry?.byPubkey?.[holding.ceoHolding.pubkey.toLowerCase()]) ? "working" : "active",
        onClick: () => onOpenAgentDm?.({ name: holding?.ceoHolding?.nome || "OrgFy Iris", pubkey: holding?.ceoHolding?.pubkey || "" }),
      },
      ...(boardAreas.length > 0
        ? boardAreas.map((area) => {
            const pk = resolveMemberPubkey(area.responsavel);
            const isWorking = Boolean(pk && props.telemetry?.byPubkey?.[pk.toLowerCase()]);
            return {
              id: area.id,
              label: area.area,
              role: area.responsavel,
              status: area.status !== "ativo" ? "planned" : isWorking ? "working" : "active",
              onClick: pk ? () => onOpenAgentDm?.({ name: area.responsavel, pubkey: pk }) : undefined,
            };
          })
        : empresas.map((emp) => ({
            id: emp.slug,
            label: emp.workspaceBuzz || emp.nome,
            role: emp.estagio === "operacional" ? `${emp.agentesProntos}/${emp.agentesTotal} agentes` : emp.estagio,
            status: emp.estagio === "operacional" ? "active" : "planned",
            onClick: () => onSelectTenant(emp.slug),
          }))),
    ];

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h(
        "div",
        { className: "of-card-pad", style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" } },
        h(
          "div",
          null,
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h("span", { style: { fontSize: "15px", fontWeight: 700 } }, "Conselho da Holding Cortexx · Governança & Board"),
            h("span", { className: "of-pill", style: { background: "var(--primary-soft)", borderColor: "var(--primary-border)", color: "var(--primary-text)" } }, `Bestie: ${holding?.ceoHolding?.nome || "OrgFy Iris"}`)
          ),
          h(
            "div",
            { className: "of-muted", style: { marginTop: "3px" } },
            `Fundador: ${holding?.fundador?.nome || "Helton Fraga"} (DM exclusiva via Bestie) · ${boardAreas.length} cadeiras no Conselho · ${empresas.length} empresas no portfólio · ${pendingApprovals + pendingDelibs} pauta(s) pendente(s)`
          )
        ),
        h(
          "div",
          { style: { display: "inline-flex", gap: "8px", flexWrap: "wrap" } },
          props.setSubsidiaryDraft &&
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-open-holding-wizard": "true",
                onClick: () => props.setSubsidiaryDraft!({ open: !props.subsidiaryDraft?.open }),
              },
              props.subsidiaryDraft?.open ? "Fechar Wizard" : "+ Nova Subsidiária (1-clique)"
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
              `DM com ${holding?.ceoHolding?.nome || "OrgFy Iris"} (Bestie) ↗`
            )
        )
      ),
      props.subsidiaryDraft?.open && props.setSubsidiaryDraft && props.onScaffoldSubsidiary &&
        h(
          "div",
          { className: "of-card-pad", "data-holding-as-code-wizard": "true", style: { display: "flex", flexDirection: "column", gap: "10px", borderColor: "var(--primary)" } },
          h(
            "div",
            null,
            h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Holding-as-Code · Provisionar Nova Subsidiária em 1 Clique (v18)"),
            h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, "Cria automaticamente empresas/<slug>.json (Eval R5.1 + L-01), controle-<slug>.json (Assistido), Motor de Confiança, Holdout Scenarios fora do repo e registra em board.json.")
          ),
          h(
            "div",
            { className: "of-grid-3" },
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Nome da Subsidiária",
              h("input", {
                className: "of-input",
                placeholder: "Ex: Cortexx Pay",
                value: props.subsidiaryDraft.nome,
                onChange: (e: any) => {
                  const nome = e.target.value;
                  const autoSlug = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
                  props.setSubsidiaryDraft!({ nome, slug: props.subsidiaryDraft!.slug ? props.subsidiaryDraft!.slug : autoSlug });
                },
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Slug (repo & manifesto)",
              h("input", {
                className: "of-input of-mono",
                placeholder: "cortexx-pay",
                value: props.subsidiaryDraft.slug,
                onChange: (e: any) => props.setSubsidiaryDraft!({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }),
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Orçamento diário (USD)",
              h("input", {
                type: "number",
                className: "of-input",
                value: props.subsidiaryDraft.gastoDiaUsd,
                onChange: (e: any) => props.setSubsidiaryDraft!({ gastoDiaUsd: Number(e.target.value) }),
              })
            )
          ),
          h(
            "div",
            { className: "of-grid-2" },
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Descrição / Visão",
              h("input", {
                className: "of-input",
                placeholder: "Missão e produto da subsidiária",
                value: props.subsidiaryDraft.descricao,
                onChange: (e: any) => props.setSubsidiaryDraft!({ descricao: e.target.value }),
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Teto diário de tokens",
              h("input", {
                type: "number",
                className: "of-input",
                value: props.subsidiaryDraft.budgetTokensDiario,
                onChange: (e: any) => props.setSubsidiaryDraft!({ budgetTokensDiario: Number(e.target.value) }),
              })
            )
          ),
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
            h("button", { type: "button", className: "of-btn", onClick: () => props.setSubsidiaryDraft!({ open: false }) }, "Cancelar"),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                disabled: props.scaffoldingSubsidiary || !props.subsidiaryDraft.slug.trim() || !props.subsidiaryDraft.nome.trim(),
                onClick: () => props.onScaffoldSubsidiary!(props.subsidiaryDraft!),
              },
              props.scaffoldingSubsidiary ? "Provisionando..." : "Provisionar Subsidiária em 1 clique"
            )
          )
        ),
      // ── ORGANOGRAMA & CADEIA DE ESCALADA POR PERMISSÃO (5 NÍVEIS) ──
      h(
        "section",
        { className: "of-card-pad", "data-holding-orgchart": "true", style: { display: "flex", flexDirection: "column", gap: "10px" } },
        h(
          "div",
          null,
          h("div", { style: { fontSize: "13px", fontWeight: 700 } }, "Organograma & Cadeia de Escalada por Permissão"),
          h("div", { className: "of-muted", style: { fontSize: "11px" } }, "Cada nível só aciona o nível imediatamente superior mediante gatilho ou permissão. Tudo fora disso permanece contido no organograma.")
        ),
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: "8px" } },
          [
            {
              level: "NÍVEL 5 · ACIONISTA",
              actor: holding?.fundador?.nome || "Helton Fraga",
              rule: "Recebe apenas DMs e Question Cards da Bestie (Iris).",
              tone: "accent",
            },
            {
              level: "NÍVEL 4 · BESTIE BUZZ",
              actor: holding?.ceoHolding?.nome || "OrgFy Iris",
              rule: "Fixada no topo do Buzz · acesso multi-workspace · única ponte Conselho ↔ Fundador.",
              tone: "accent",
            },
            {
              level: "NÍVEL 3 · CONSELHO",
              actor: `Board (${boardAreas.length} comitês)`,
              rule: "CFO · CTO · CRO · CPO · COO · CGO. Delibera estratégia, orçamento e risco.",
              tone: "done",
            },
            {
              level: "NÍVEL 2 · DIRETORIA",
              actor: "CEO ← COO / PM",
              rule: "COO/PM (ex.: Bento) só sobe ao CEO com permissão; CEO só pauta o Conselho.",
              tone: "running",
            },
            {
              level: "NÍVEL 1 · FÁBRICA",
              actor: "Executores & L-01",
              rule: "Execução em worktree isolada, CI, Revisores L-01 e Oráculo dentro da empresa.",
              tone: "idle",
            },
          ].map((lvl) =>
            h(
              "div",
              {
                key: lvl.level,
                className: "of-surface",
                style: {
                  padding: "9px 11px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  borderColor: lvl.tone === "accent" ? "var(--primary-border)" : undefined,
                },
              },
              h("div", { className: "of-mono", style: { fontSize: "9.5px", fontWeight: 700, color: lvl.tone === "accent" ? "var(--primary-text)" : "var(--muted-foreground)" } }, lvl.level),
              h("div", { style: { fontSize: "12.5px", fontWeight: 700 } }, lvl.actor),
              h("div", { className: "of-muted", style: { fontSize: "10.5px", lineHeight: 1.4 } }, lvl.rule)
            )
          )
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
        ),
      h(
        "div",
        { className: "of-grid-2", "data-orgfy-crdt-council": "true" },
        h(
          "div",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
            h("div", { className: "of-meter-label" }, "Deliberações do Conselho (CRDT Sync)"),
            props.onCreateCouncilDeliberation &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  style: { padding: "3px 8px", fontSize: "11px" },
                  onClick: () => {
                    const title = window.prompt("Título da deliberação do Conselho:");
                    if (!title || !title.trim()) return;
                    const summary = window.prompt("Resumo / decisão proposta:") || "";
                    void props.onCreateCouncilDeliberation!(title.trim(), summary.trim());
                  },
                },
                "+ Nova deliberação"
              )
          ),
          (props.councilDeliberations || []).length === 0
            ? h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, "Nenhuma deliberação registrada no CRDT ainda. Decisões criadas aqui sincronizam entre Mac e Buzz Mobile.")
            : (props.councilDeliberations || []).slice(0, 8).map((del) =>
                h(
                  "div",
                  { key: del.id, className: "of-surface", style: { padding: "8px 10px", display: "flex", flexDirection: "column", gap: "5px" } },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                    h("strong", { style: { fontSize: "12px" } }, del.title),
                    h("span", { className: "of-pill", "data-tone": del.status === "aprovada" ? "done" : del.status === "recusada" ? "failed" : "waiting" }, del.status.toUpperCase())
                  ),
                  del.summary && h("div", { className: "of-muted", style: { fontSize: "11px" } }, del.summary),
                  del.status === "pendente" && props.onVoteCouncilDeliberation &&
                    h(
                      "div",
                      { style: { display: "flex", gap: "6px", marginTop: "2px" } },
                      h("button", { type: "button", className: "of-btn", "data-variant": "primary", style: { padding: "2px 8px", fontSize: "10.5px" }, onClick: () => props.onVoteCouncilDeliberation!(del.id, "aprovada") }, "Aprovar ✓"),
                      h("button", { type: "button", className: "of-btn", style: { padding: "2px 8px", fontSize: "10.5px" }, onClick: () => props.onVoteCouncilDeliberation!(del.id, "recusada") }, "Recusar")
                    )
                )
              )
        ),
        h(
          "div",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
            h("div", { className: "of-meter-label" }, "Locks Distribuídos Ativos (CRDT Sync)"),
            h("span", { className: "of-pill", "data-tone": props.crdtBackendInfo?.mode === "buzz_artifact_collection" ? "done" : "idle" }, props.crdtBackendInfo?.mode === "buzz_artifact_collection" ? "Relay CRDT" : "Cache local")
          ),
          (props.distributedLocks || []).length === 0
            ? h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, "Nenhum lock distribuído ativo no momento.")
            : (props.distributedLocks || []).map((lk) =>
                h(
                  "div",
                  { key: lk.id, className: "of-surface", style: { padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                  h(
                    "div",
                    null,
                    h("div", { className: "of-mono", style: { fontSize: "11.5px", fontWeight: 600 } }, lk.resourceKey),
                    h("div", { className: "of-muted", style: { fontSize: "10.5px" } }, `Dono: ${lk.owner}${lk.reason ? ` · ${lk.reason}` : ""}`)
                  ),
                  props.onReleaseDistributedLock &&
                    h("button", { type: "button", className: "of-btn", style: { padding: "2px 8px", fontSize: "10.5px" }, onClick: () => props.onReleaseDistributedLock!(lk.id) }, "Liberar")
                )
              )
        )
      )
    );
  }

  // ── 2. INBOX (1:1 CodeDen via FactoryInboxPage.tsx + Herança de Tema do Buzz + Question Cards CRDT) ──
  if (tab === "inbox") {
    return renderFactoryInboxPage({
      h,
      tenant,
      companyName: status.tenantManifest?.nome || tenant,
      status,
      automations: props.automations,
      inboxFilter,
      setInboxFilter,
      dismissedIds: props.inboxDismissedIds || [],
      onDismissIds: props.onInboxDismissIds || (() => {}),
      onRestoreIds: props.onInboxRestoreIds || (() => {}),
      confirmBulkDismiss: Boolean(props.confirmBulkDismiss),
      setConfirmBulkDismiss: props.setConfirmBulkDismiss || (() => {}),
      lastBulkDismiss: props.lastBulkDismiss || null,
      onSelectItem,
      onOpenItemInBuzz: props.onOpenItemInBuzz,
      onRetryItem: props.onRetryInboxItem,
      onResumeFactory: props.onResumeFactory,
      onOpenFactoryPanel: props.onOpenFactoryPanel,
      onOpenSession: onOpenAgentDm,
      QuestionCardsPanel: props.QuestionCardsPanel,
      questionCards: props.questionCards,
      crdtBackendInfo: props.crdtBackendInfo,
      onAnswerQuestionCard: props.onAnswerQuestionCard,
      onDismissQuestionCard: props.onDismissQuestionCard,
    });
  }

  // ── 3. USO & CUSTOS (1:1 CodeDen Usage & Cost via FactoryUsageAndCostPage.tsx) ──
  if (tab === "costs") {
    return renderFactoryUsageAndCostPage({
      h,
      tenant,
      status,
      holding,
      nativeUsage: props.nativeUsage,
      onRefreshNativeUsage: props.onRefreshNativeUsage,
      automations: props.automations,
      costRange,
      setCostRange,
      usageDimension: props.usageDimension || "model",
      setUsageDimension: props.setUsageDimension || (() => {}),
      usageMetric: props.usageMetric || "cost",
      setUsageMetric: props.setUsageMetric || (() => {}),
      usageHoverDay: props.usageHoverDay ?? null,
      setUsageHoverDay: props.setUsageHoverDay || (() => {}),
      usageFilterModel: props.usageFilterModel ?? null,
      setUsageFilterModel: props.setUsageFilterModel || (() => {}),
      pricesOpen: Boolean(props.pricesOpen),
      setPricesOpen: props.setPricesOpen || (() => {}),
      onOpenSettings: props.onOpenSettings,
      onCopyText: props.onCopyText,
    });
  }

  // ── 4. AUTOMAÇÕES 1:1 CODEDEN (Automações | Execuções | Templates + Editor em 2 colunas) ──
  if (tab === "automations") {
    const tm = status.tenantManifest;
    const list = props.automations || [];
    const totalRuns = list.reduce((acc, a) => acc + (a.recentRuns?.length || 0), 0);
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" } },
        h(
          "div",
          { className: "of-segmented", style: { width: "fit-content" } },
          ([
            { id: "automations", label: `Automações (${list.length})` },
            { id: "runs", label: `Execuções (${totalRuns})` },
            { id: "templates", label: "Templates (7)" },
          ] as const).map((t) =>
            h(
              "button",
              {
                key: t.id,
                type: "button",
                className: "of-seg-btn",
                "data-active": autoTab === t.id ? "true" : "false",
                onClick: () => {
                  setAutoTab(t.id);
                  if (t.id === "automations") props.setAutomationView?.("list");
                },
              },
              t.label
            )
          )
        ),
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "11px" } },
          h("span", { className: "of-muted" }, `Coordenador: ${status.launchAgent || "xyz.orgfy.esteira-minima"}`),
          h("span", { className: "of-pill", "data-tone": status.coordenador === "ativo" ? "done" : "waiting" }, status.coordenador)
        )
      ),
      props.automations && props.onSelectAutomationId && props.onUpdateAutomation && props.onCreateAutomation && props.onDeleteAutomation && props.onSaveAutomations && props.onRunAutomationNow && props.onExportAutomationYaml &&
        renderAutomationEditor({
          h,
          tenant,
          companyName: tm?.nome || tenant,
          automations: props.automations,
          selectedId: props.selectedAutomationId || props.automations[0]?.id || "",
          onSelectId: props.onSelectAutomationId,
          onUpdateAutomation: props.onUpdateAutomation,
          onCreateAutomation: props.onCreateAutomation,
          onDuplicateAutomation: props.onDuplicateAutomation,
          onDeleteAutomation: props.onDeleteAutomation,
          onSaveAutomations: props.onSaveAutomations,
          onRunNow: props.onRunAutomationNow,
          onExportYaml: props.onExportAutomationYaml,
          onExportMarkdown: props.onExportAutomationMarkdown,
          onImportAutomation: props.onImportAutomation,
          onAddStarterSet: props.onAddStarterSet,
          runningId: props.runningAutomationId || null,
          availableAgents: (tm?.agentes || []).map((a) => a.name),
          activeSubTab: autoTab,
          onChangeSubTab: setAutoTab,
          editingView: props.automationView || "detail",
          onChangeEditingView: props.setAutomationView,
        })
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
            { id: "mcp", label: `MCP (${(props.mcpTools || []).length || 22} tools)` },
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
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h(
            "span",
            { className: "of-muted" },
            `Fonte: empresas/${tenant}.json × Buzz Desktop (${tenantAgents.filter((a) => a.inBuzz).length}/${tenantAgents.length} provisionados)`
          ),
          props.onReconcileAgents &&
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                "data-reconcile-r51": "true",
                onClick: props.onReconcileAgents,
              },
              "Reconciliar modelos (Eval R5.1)"
            )
        )
      ),
      agentTab === "memory"
        ? h(
            "div",
            { className: "of-card-pad" },
            h("div", { style: { fontSize: "14px", fontWeight: 700, marginBottom: "4px" } }, `Agentes de ${empresaNome}`),
            h("div", { className: "of-muted", style: { marginBottom: "10px" } }, "Cada agente abaixo vem do manifesto oficial desta empresa cruzado com o estado ao vivo no Buzz Desktop. Use DM ↗ para conversar na barra lateral ou os controles nativos de sessão (Parar / Compactar / Nova)."),
            tenantAgents.length === 0
              ? h("div", { className: "of-muted" }, `Nenhum agente encontrado em empresas/${tenant}.json.`)
              : h(
                  "table",
                  { className: "of-table" },
                  h(
                    "thead",
                    null,
                    h("tr", null, h("th", null, "Agente"), h("th", null, "Função & Papel"), h("th", null, "Modelo (Buzz)"), h("th", null, "Status"), h("th", null, "Ações (Buzz API)"))
                  ),
                  h(
                    "tbody",
                    null,
                    tenantAgents.map((a) => {
                      const pkLower = (a.pubkey || "").toLowerCase();
                      const liveTurn = pkLower && props.telemetry?.byPubkey ? props.telemetry.byPubkey[pkLower] : null;
                      const presence = pkLower && props.telemetry?.presenceByPubkey ? props.telemetry.presenceByPubkey[pkLower] : undefined;
                      const liveMatch = liveCrew.find((c) => c.key === a.agentKey || (pkLower && c.pubkey?.toLowerCase() === pkLower));
                      const isEditing = Boolean(props.editingAgentKey && props.editingAgentKey === a.agentKey);
                      return h(
                        "tr",
                        { key: a.name },
                        h(
                          "td",
                          { style: { fontWeight: 600 } },
                          h(
                            "span",
                            { style: { display: "inline-flex", alignItems: "center", gap: "7px" } },
                            liveMatch?.picture
                              ? h("img", { src: liveMatch.picture, alt: a.name, style: { width: "22px", height: "22px", borderRadius: "6px", objectFit: "cover", border: liveTurn ? "1.5px solid var(--status-running)" : "1px solid var(--border)", flexShrink: 0 } })
                              : h("span", { className: "of-dot", "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : a.inBuzz ? "done" : "idle" }),
                            a.name
                          )
                        ),
                        h(
                          "td",
                          null,
                          h("div", { style: { fontSize: "12px" } }, a.funcao),
                          liveTurn
                            ? h("div", { className: "of-mono", style: { fontSize: "10px", color: liveTurn.state === "error" ? "var(--status-failed)" : "var(--status-running)" } }, `⚡ ${liveTurn.stepLabel}`)
                            : h("div", { className: "of-mono of-muted", style: { fontSize: "10px" } }, `papel: ${a.papel} · paralelismo: ${a.parallelism}x`),
                          isEditing && props.agentEditDraft && props.setAgentEditDraft &&
                            h(
                              "div",
                              { className: "of-surface", style: { marginTop: "8px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }, "data-agent-nip-ap-editor": "true" },
                              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } },
                                h("input", { className: "of-input", placeholder: "Provider (ex: nexusmind_anthropic)", value: props.agentEditDraft.provider, onChange: (e: any) => props.setAgentEditDraft!({ provider: e.target.value }) }),
                                h("input", { className: "of-input", placeholder: "Model (ex: claude-sonnet-5-5)", value: props.agentEditDraft.model, onChange: (e: any) => props.setAgentEditDraft!({ model: e.target.value }) })
                              ),
                              h("textarea", { className: "of-textarea", placeholder: "Instructions NIP-AP (opcional)", value: props.agentEditDraft.instructions, onChange: (e: any) => props.setAgentEditDraft!({ instructions: e.target.value }) }),
                              h("div", { style: { display: "flex", gap: "6px" } },
                                h("button", { type: "button", className: "of-btn", "data-variant": "primary", onClick: () => props.onSaveAgentProfile?.(a.agentKey, props.agentEditDraft!) }, "Salvar no Buzz (ctx.agents.save)"),
                                h("button", { type: "button", className: "of-btn", onClick: () => props.setEditingAgentKey?.(null) }, "Cancelar")
                              )
                            )
                        ),
                        h("td", { className: "of-mono" }, a.model),
                        h(
                          "td",
                          null,
                          h(
                            "span",
                            { className: "of-pill", "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : a.inBuzz ? "done" : "waiting" },
                            liveTurn ? "Respondendo agora" : presence === "online" ? "Online" : a.inBuzz ? "Disponível" : "A provisionar"
                          )
                        ),
                        h(
                          "td",
                          null,
                          h(
                            "div",
                            { style: { display: "inline-flex", alignItems: "center", gap: "4px", flexWrap: "wrap" } },
                            onOpenAgentDm && a.pubkey &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { color: "var(--primary)", padding: "3px 7px" },
                                  onClick: () => onOpenAgentDm({ key: a.agentKey, pubkey: a.pubkey, name: a.name }),
                                },
                                "DM ↗"
                              ),
                            props.onOpenAgentDrawer && a.inBuzz && a.agentKey &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { padding: "3px 6px", fontSize: "10.5px" },
                                  onClick: () => props.onOpenAgentDrawer!(a.agentKey),
                                },
                                "Transcript"
                              ),
                            props.setEditingAgentKey && props.setAgentEditDraft && a.inBuzz && a.agentKey &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { padding: "3px 6px", fontSize: "10.5px" },
                                  onClick: () => {
                                    if (isEditing) {
                                      props.setEditingAgentKey!(null);
                                    } else {
                                      props.setEditingAgentKey!(a.agentKey);
                                      props.setAgentEditDraft!({
                                        provider: liveMatch?.provider || "",
                                        model: liveMatch?.model || a.model || "",
                                        instructions: liveMatch?.instructions || "",
                                      });
                                    }
                                  },
                                },
                                isEditing ? "Fechar" : "Editar"
                              ),
                            props.onAgentSessionAction && a.inBuzz && a.agentKey &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { padding: "3px 6px", fontSize: "10.5px" },
                                  title: "Compactar contexto da sessão",
                                  onClick: () => props.onAgentSessionAction!(a.agentKey, "compact"),
                                },
                                "Compactar"
                              ),
                            props.onAgentSessionAction && a.inBuzz && a.agentKey &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { padding: "3px 6px", fontSize: "10.5px" },
                                  title: "Iniciar nova sessão limpa",
                                  onClick: () => props.onAgentSessionAction!(a.agentKey, "new"),
                                },
                                "Nova"
                              ),
                            props.onAutomateFromSession &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  "data-automate-from-session": a.name,
                                  style: { padding: "3px 6px", fontSize: "10.5px" },
                                  title: "Converter sessão deste agente em Automação recorrente (1 clique)",
                                  onClick: () => props.onAutomateFromSession!({ agentName: a.name, stepLabel: liveTurn?.stepLabel }),
                                },
                                "⚡ Automatizar"
                              ),
                            props.onAgentSessionAction && liveTurn && a.agentKey &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "danger",
                                  style: { padding: "3px 6px", fontSize: "10.5px" },
                                  title: "Interromper turno em andamento",
                                  onClick: () => props.onAgentSessionAction!(a.agentKey, "interrupt"),
                                },
                                "Parar"
                              )
                          )
                        )
                      );
                    })
                  )
                )
          )
        : agentTab === "eval"
        ? (() => {
            const evalFilter = props.evalFilter || "all";
            const approvedCount = modelos.filter((m) => m.evalStatus === "approved").length;
            const belowCount = modelos.filter((m) => m.evalStatus === "below_min").length;
            const attentionCount = modelos.filter((m) => m.evalStatus !== "approved").length;
            const filteredModelos =
              evalFilter === "attention"
                ? modelos.filter((m) => m.evalStatus !== "approved")
                : evalFilter === "approved"
                ? modelos.filter((m) => m.evalStatus === "approved")
                : modelos;
            return h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" }, "data-eval-r51-view": "true" },
              h(
                "div",
                { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" } },
                [
                  { label: "Aprovados R5.1 (≥ 8/10)", val: `${approvedCount}/${modelos.length}`, tone: "done", sub: "tool call validado em 10 cards" },
                  { label: "Abaixo do mínimo (< 8/10)", val: String(belowCount), tone: belowCount > 0 ? "failed" : "done", sub: belowCount > 0 ? "migração recomendada" : "nenhum agente crítico" },
                  { label: "Fora do eval / Timeout", val: String(Math.max(0, attentionCount - belowCount)), tone: attentionCount - belowCount > 0 ? "waiting" : "done", sub: "mistral-large (>20s) ou não testado" },
                  { label: "Vencedores R5.1 (10/10)", val: "2 modelos", tone: "done", sub: "gemini-2.5-flash (2.0s) · sonnet-4-6 (4.1s)" },
                ].map((k) =>
                  h(
                    "div",
                    { key: k.label, className: "of-card-pad", style: { padding: "11px 13px" } },
                    h("div", { className: "of-meter-label" }, k.label),
                    h("div", { className: "of-num", style: { fontSize: "19px", fontWeight: 700, marginTop: "4px", color: k.tone === "failed" ? "var(--status-failed)" : k.tone === "waiting" ? "var(--status-waiting)" : "var(--foreground)" } }, k.val),
                    h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "2px" } }, k.sub)
                  )
                )
              ),
              h(
                "div",
                { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
                  h(
                    "div",
                    null,
                    h("div", { style: { fontSize: "14px", fontWeight: 700 } }, PT_BR.labels.modelsTitle),
                    h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, "Fonte: docs/eval-modelos-onda5.md (10 cards reais). Modelos < 8/10 ou com timeout >20s ficam sinalizados para migração em 1 clique via ctx.agents.save().")
                  ),
                  props.setEvalFilter &&
                    h(
                      "div",
                      { className: "of-segmented" },
                      ([
                        { id: "all", label: `Todos (${modelos.length})` },
                        { id: "attention", label: `Migrar (${attentionCount})` },
                        { id: "approved", label: `Aprovados (${approvedCount})` },
                      ] as const).map((f) =>
                        h(
                          "button",
                          {
                            key: f.id,
                            type: "button",
                            className: "of-seg-btn",
                            "data-active": evalFilter === f.id ? "true" : "false",
                            onClick: () => props.setEvalFilter!(f.id),
                          },
                          f.label
                        )
                      )
                    )
                ),
                filteredModelos.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "16px 0" } }, "Nenhum agente corresponde ao filtro selecionado.")
                  : h(
                      "table",
                      { className: "of-table" },
                      h(
                        "thead",
                        null,
                        h("tr", null, h("th", null, "Agente"), h("th", null, "Papel"), h("th", null, "Modelo & Provider"), h("th", null, "Tool call (R5.1)"), h("th", null, "Latência / Custo"), h("th", null, "Ação (Buzz API)"))
                      ),
                      h(
                        "tbody",
                        null,
                        filteredModelos.map((m) => {
                          const agSpec = tenantAgents.find((a) => a.name === m.agente);
                          const isTier1 = /(ceo|coo|revis|arquit|segur|secur|qa|oraculo|conselho|board)/i.test(String(m.papel || ""));
                          const recTarget = isTier1
                            ? { provider: "nexusmind_anthropic", model: "claude-sonnet-4-6", label: "Sonnet 4.6" }
                            : { provider: "nexusmind_antigravity", model: "gemini-2.5-flash", label: "Flash 2.5" };
                          const scorePct = typeof m.scoreNum === "number" ? Math.max(4, m.scoreNum * 10) : 0;
                          const tone =
                            m.evalStatus === "approved"
                              ? "done"
                              : m.evalStatus === "below_min"
                              ? "failed"
                              : "waiting";
                          const pillText =
                            m.evalStatus === "approved"
                              ? `${m.toolcall_eval} · aprovado`
                              : m.evalStatus === "below_min"
                              ? `${m.toolcall_eval} · abaixo do mín.`
                              : m.evalStatus === "unsupported"
                              ? "Timeout >20s · bloquear"
                              : "Não avaliado no R5.1";
                          return h(
                            "tr",
                            { key: m.agente },
                            h(
                              "td",
                              { style: { fontWeight: 600 } },
                              h(
                                "span",
                                { style: { display: "inline-flex", alignItems: "center", gap: "7px" } },
                                h("span", { className: "of-dot", "data-tone": tone }),
                                m.agente
                              )
                            ),
                            h("td", { className: "of-muted" }, m.papel || "—"),
                            h(
                              "td",
                              null,
                              h("div", { className: "of-mono", style: { fontSize: "12px" } }, m.modelo || PT_BR.labels.unavailable),
                              m.provider && h("div", { className: "of-mono of-muted", style: { fontSize: "10px" } }, m.provider)
                            ),
                            h(
                              "td",
                              { style: { minWidth: "175px" } },
                              h("span", { className: "of-pill", "data-tone": tone }, pillText),
                              typeof m.scoreNum === "number" &&
                                h(
                                  "div",
                                  { className: "of-bar-track", style: { marginTop: "5px", height: "4px", maxWidth: "130px" } },
                                  h("div", {
                                    className: "of-bar-fill",
                                    style: {
                                      width: `${scorePct}%`,
                                      background: tone === "done" ? "var(--status-done)" : "var(--status-failed)",
                                    },
                                  })
                                )
                            ),
                            h(
                              "td",
                              { className: "of-mono of-muted", style: { fontSize: "11px" } },
                              m.latencyMs ? `${m.latencyMs}ms · ${m.costUsd || "—"}` : "—"
                            ),
                            h(
                              "td",
                              null,
                              m.evalStatus === "approved"
                                ? h("span", { style: { fontSize: "11px", color: "var(--status-done)", fontWeight: 600 } }, "✓ Alinhado")
                                : props.onMigrateSingleAgentModel && agSpec?.inBuzz && agSpec?.agentKey
                                ? h(
                                    "button",
                                    {
                                      type: "button",
                                      className: "of-btn",
                                      style: { padding: "3px 8px", fontSize: "11px" },
                                      onClick: () => props.onMigrateSingleAgentModel!(agSpec.agentKey, { provider: recTarget.provider, model: recTarget.model }),
                                    },
                                    `Migrar → ${recTarget.label}`
                                  )
                                : h("span", { className: "of-muted", style: { fontSize: "11px" } }, "A provisionar")
                            )
                          );
                        })
                      )
                    )
              )
            );
          })()
        : agentTab === "skills"
        ? (() => {
            const surfaceMeta: Record<string, { trustId: string; paths: string[]; desc: string }> = {
              codigo: { trustId: "bug", paths: ["src/**", "ferramentas/**", "testes/**"], desc: "Revisão de mérito, provas L-22, regressões e qualidade de código." },
              metodo: { trustId: "docs", paths: ["specs/**", "cards/**", "licoes/**", "contratos/**"], desc: "Conformidade Specsfy, TDD, regras L-01/L-22/L-90 e governança." },
              seguranca: { trustId: "seguranca", paths: ["empresas/**", "ferramentas/ci.sh", ".github/**", "infra/secrets/**"], desc: "Auditoria de chaves, CI isolado, alçadas constitucionais e matérias reservadas." },
              ui: { trustId: "feature", paths: ["src/factory/**", "src/components/**", "manifest.json"], desc: "Design System CodeDen/Buzz, acessibilidade, Shadow DOM e UX nativa." },
              arquitetura: { trustId: "infra", paths: ["ferramentas/esteira/**", "contratos/alcadas_politica.json"], desc: "Fronteiras de módulos, contratos, performance e dívida estrutural." },
            };
            const approvedReviewers = revisoresSurf.filter(([, rev]) => {
              const row = modelos.find((m) => m.agente.toLowerCase() === String(rev).toLowerCase());
              return row?.evalStatus === "approved";
            }).length;
            const openReviewsCount = status.inProgress.filter((i) => i.stage === "verifying").length;
            return h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" }, "data-reviewers-l01-view": "true" },
              h(
                "div",
                { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" } },
                [
                  { label: "Superfícies cobertas (L-01)", val: `${revisoresSurf.length}/5`, sub: "segregação executor ≠ revisor" },
                  { label: "Revisores em modelo R5.1", val: `${approvedReviewers}/${revisoresSurf.length}`, sub: approvedReviewers < revisoresSurf.length ? "reconciliar modelos recomendado" : "todos validados ≥ 8/10" },
                  { label: "PRs em revisão agora", val: String(openReviewsCount), sub: "aguardando veredito GATE" },
                  { label: "Modo de alçadas", val: (status.alcadasPolitica?.modo || "observe").toUpperCase(), sub: "contratos/alcadas_politica.json" },
                ].map((k) =>
                  h(
                    "div",
                    { key: k.label, className: "of-card-pad", style: { padding: "11px 13px" } },
                    h("div", { className: "of-meter-label" }, k.label),
                    h("div", { className: "of-num", style: { fontSize: "19px", fontWeight: 700, marginTop: "4px" } }, k.val),
                    h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "2px" } }, k.sub)
                  )
                )
              ),
              h(
                "div",
                { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "12px" } },
                h(
                  "div",
                  null,
                  h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Matriz de Revisores Independentes (L-01) · ${empresaNome}`),
                  h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, "Regra L-01: o executor nunca pode revisar a própria entrega. Cada superfície cruza o revisor titular, modelo vivo no Buzz, nível de autonomia (Trust Engine) e caminhos cobertos.")
                ),
                revisoresSurf.length === 0
                  ? h("div", { className: "of-muted" }, PT_BR.labels.unavailable)
                  : h(
                      "div",
                      { className: "of-grid-3" },
                      revisoresSurf.map(([superficie, revisor]) => {
                        const keyNorm = superficie.toLowerCase();
                        const meta = surfaceMeta[keyNorm] || { trustId: "feature", paths: ["**"], desc: "Revisão técnica independente L-01." };
                        const agSpec = tenantAgents.find((a) => a.name.toLowerCase() === String(revisor).toLowerCase());
                        const evalRow = modelos.find((m) => m.agente.toLowerCase() === String(revisor).toLowerCase());
                        const liveMatch = liveCrew.find((c) => c.key === agSpec?.agentKey || c.name.toLowerCase() === String(revisor).toLowerCase());
                        const pkLower = (agSpec?.pubkey || liveMatch?.pubkey || "").toLowerCase();
                        const liveTurn = pkLower && props.telemetry?.byPubkey ? props.telemetry.byPubkey[pkLower] : null;
                        const trustCat = status.trustEngine?.categories?.find((c) => c.id === meta.trustId) || null;
                        const evalTone = evalRow?.evalStatus === "approved" ? "done" : evalRow?.evalStatus === "below_min" ? "failed" : "waiting";
                        return h(
                          "div",
                          { key: superficie, className: "of-surface", style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: "9px" } },
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                            h("span", { className: "of-meter-label", style: { color: "var(--primary)" } }, superficie.toUpperCase()),
                            trustCat &&
                              h(
                                "span",
                                { className: "of-pill", "data-tone": trustCat.mode === "dark_auto_merge" ? "done" : trustCat.locked ? "failed" : "waiting", style: { fontSize: "10px" } },
                                trustCat.mode === "dark_auto_merge" ? "DARK AUTO" : trustCat.locked ? "GATE HUMANO 🔒" : "ASSISTIDO"
                              )
                          ),
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", gap: "9px" } },
                            liveMatch?.picture
                              ? h("img", { src: liveMatch.picture, alt: revisor, style: { width: "28px", height: "28px", borderRadius: "7px", objectFit: "cover", border: "1px solid var(--border)" } })
                              : h("span", { className: "of-project-tile", style: { width: "28px", height: "28px", fontSize: "12px" } }, String(revisor).replace(/^OrgFy\s+/i, "").charAt(0).toUpperCase()),
                            h(
                              "div",
                              { style: { minWidth: 0, flex: 1 } },
                              h("div", { style: { fontSize: "13.5px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" } }, revisor, h("span", { className: "of-dot", "data-tone": liveTurn ? "running" : agSpec?.inBuzz ? "done" : "idle" })),
                              h("div", { className: "of-muted", style: { fontSize: "10.5px" } }, liveTurn ? `⚡ ${liveTurn.stepLabel}` : agSpec?.funcao || "Revisor titular L-01")
                            )
                          ),
                          h("div", { className: "of-muted", style: { fontSize: "11px", lineHeight: 1.4 } }, meta.desc),
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap", paddingTop: "6px", borderTop: "1px solid var(--border)" } },
                            h("code", { className: "of-mono of-muted", style: { fontSize: "10.5px" } }, evalRow?.modelo || agSpec?.model || "—"),
                            h("span", { className: "of-pill", "data-tone": evalTone, style: { fontSize: "10px" } }, evalRow?.toolcall_eval ? `R5.1 ${evalRow.toolcall_eval}` : evalRow?.evalStatus === "unsupported" ? "Timeout >20s" : "Não avaliado")
                          ),
                          h(
                            "div",
                            { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                            meta.paths.map((p) => h("code", { key: p, className: "of-mono", style: { fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "var(--muted)", color: "var(--muted-foreground)" } }, p))
                          ),
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "auto", paddingTop: "4px" } },
                            onOpenAgentDm && (agSpec?.pubkey || liveMatch?.pubkey) &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  style: { padding: "3px 8px", fontSize: "11px" },
                                  onClick: () => onOpenAgentDm({ key: agSpec?.agentKey || liveMatch?.key, pubkey: agSpec?.pubkey || liveMatch?.pubkey, name: revisor }),
                                },
                                "DM ↗"
                              ),
                            props.onOpenAgentProfile && (agSpec?.pubkey || liveMatch?.pubkey || agSpec?.agentKey) &&
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "of-btn",
                                  "data-variant": "ghost",
                                  style: { padding: "3px 8px", fontSize: "11px" },
                                  onClick: () => props.onOpenAgentProfile!({ key: agSpec?.agentKey || liveMatch?.key, pubkey: agSpec?.pubkey || liveMatch?.pubkey, name: revisor }),
                                },
                                "Perfil Buzz ↗"
                              ),
                            trustCat &&
                              h("span", { className: "of-mono of-muted", style: { marginLeft: "auto", fontSize: "10px" } }, `Escape ${trustCat.escapeRatePct.toFixed(1)}%`)
                          )
                        );
                      })
                    )
              ),
              status.alcadasPolitica?.materiasReservadas?.length &&
                h(
                  "div",
                  { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
                    h("div", { style: { fontSize: "13px", fontWeight: 700 } }, "Matérias Reservadas & Alçadas por Path (contratos/alcadas_politica.json)"),
                    h("span", { className: "of-pill", "data-tone": "waiting" }, `Modo: ${status.alcadasPolitica.modo || "observe"}`)
                  ),
                  h(
                    "div",
                    { className: "of-grid-3" },
                    status.alcadasPolitica.materiasReservadas.map((mat) =>
                      h(
                        "div",
                        { key: mat.id, className: "of-surface", style: { padding: "9px 11px", display: "flex", flexDirection: "column", gap: "5px" } },
                        h(
                          "div",
                          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                          h("strong", { style: { fontSize: "12px" } }, mat.nome),
                          h("span", { className: "of-pill", "data-tone": "failed", style: { fontSize: "9.5px" } }, mat.alcada.toUpperCase())
                        ),
                        h(
                          "div",
                          { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                          mat.padroes.map((p) => h("code", { key: p, className: "of-mono of-muted", style: { fontSize: "10px" } }, p))
                        )
                      )
                    )
                  )
                )
            );
          })()
        : (() => {
            const tools = props.mcpTools || [];
            const query = (props.mcpSearch || "").trim().toLowerCase();
            const cat = props.mcpCategory || "all";
            const categories = ["all", ...Array.from(new Set(tools.map((t) => t.category)))];
            const filteredTools = tools.filter((t) => {
              if (cat !== "all" && t.category !== cat) return false;
              if (!query) return true;
              return t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query) || t.params.some((p) => p.toLowerCase().includes(query));
            });
            const integrity = props.commandIntegrity;
            return h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" }, "data-mcp-registry-view": "true" },
              h(
                "div",
                { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" } },
                [
                  { label: "Agent Tools MCP", val: `${tools.length || 22} ativas`, sub: "injetadas via ctx.agents.addTool" },
                  { label: "Host Commands SHA-256", val: integrity ? `${integrity.verified}/${integrity.total} íntegros` : "7 pinados", sub: integrity && integrity.mismatches > 0 ? `${integrity.mismatches} divergência(s)` : "manifest.json verificado" },
                  { label: "Agentes no Buzz Desktop", val: String(liveCrew.length), sub: "recebem o catálogo automaticamente" },
                  { label: "Transporte & Tracing", val: "JSON-RPC 2.0", sub: "MCP Loopback · OTel GenAI" },
                ].map((k) =>
                  h(
                    "div",
                    { key: k.label, className: "of-card-pad", style: { padding: "11px 13px" } },
                    h("div", { className: "of-meter-label" }, k.label),
                    h("div", { className: "of-num", style: { fontSize: "19px", fontWeight: 700, marginTop: "4px" } }, k.val),
                    h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "2px" } }, k.sub)
                  )
                )
              ),
              h(
                "div",
                { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
                  h(
                    "div",
                    null,
                    h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Unified Tool Registry · ${tools.length || 22} Agent Tools MCP`),
                    h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, "Catálogo determinístico registrado nativamente em todas as sessões de agentes do Buzz Desktop.")
                  ),
                  props.setMcpSearch &&
                    h("input", {
                      className: "of-input",
                      style: { width: "240px" },
                      placeholder: "Filtrar tool, descrição ou parâmetro...",
                      value: props.mcpSearch || "",
                      onChange: (e: any) => props.setMcpSearch!(e.target.value),
                    })
                ),
                props.setMcpCategory &&
                  h(
                    "div",
                    { className: "of-segmented", style: { width: "fit-content", flexWrap: "wrap" } },
                    categories.map((c) =>
                      h(
                        "button",
                        {
                          key: c,
                          type: "button",
                          className: "of-seg-btn",
                          "data-active": cat === c ? "true" : "false",
                          onClick: () => props.setMcpCategory!(c),
                        },
                        c === "all" ? `Todas (${tools.length})` : `${c} (${tools.filter((t) => t.category === c).length})`
                      )
                    )
                  ),
                h(
                  "div",
                  { style: { border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" } },
                  filteredTools.length === 0
                    ? h("div", { className: "of-muted", style: { padding: "16px", textAlign: "center" } }, "Nenhuma ferramenta MCP encontrada para esse filtro.")
                    : filteredTools.map((tool, idx) =>
                        h(
                          "div",
                          {
                            key: tool.name,
                            style: {
                              padding: "10px 14px",
                              borderBottom: idx < filteredTools.length - 1 ? "1px solid var(--border)" : "none",
                              display: "flex",
                              flexDirection: "column",
                              gap: "5px",
                            },
                          },
                          h(
                            "div",
                            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                            h("code", { className: "of-mono", style: { fontSize: "12.5px", fontWeight: 700, color: "var(--foreground)" } }, tool.name),
                            h("span", { className: "of-pill", "data-tone": "done", style: { fontSize: "10px" } }, tool.category),
                            h("span", { className: "of-pill", style: { fontSize: "9.5px" } }, "built-in")
                          ),
                          h("div", { className: "of-muted", style: { fontSize: "11.5px", lineHeight: 1.4 } }, tool.description),
                          tool.params.length > 0 &&
                            h(
                              "div",
                              { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" } },
                              tool.params.map((p) => {
                                const req = tool.required.includes(p);
                                return h(
                                  "code",
                                  {
                                    key: p,
                                    className: "of-mono",
                                    style: {
                                      fontSize: "10px",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: req ? "var(--primary-soft)" : "var(--muted)",
                                      color: req ? "var(--primary)" : "var(--muted-foreground)",
                                    },
                                  },
                                  req ? `${p}*` : p
                                );
                              })
                            )
                        )
                      )
                )
              ),
              h(
                "div",
                { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
                  h(
                    "div",
                    null,
                    h("div", { style: { fontSize: "13.5px", fontWeight: 700 } }, "Host Commands Pinados por SHA-256 (manifest.json)"),
                    h("div", { className: "of-muted", style: { fontSize: "11px" } }, "Substitui execuções abertas de python/osascript por comandos declarativos com integridade verificada.")
                  ),
                  props.onAuditCommandIntegrity &&
                    h("button", { type: "button", className: "of-btn", style: { fontSize: "11px", padding: "4px 10px" }, onClick: props.onAuditCommandIntegrity }, "↻ Auditar SHA-256")
                ),
                integrity?.results?.length
                  ? h(
                      "div",
                      { className: "of-grid-2" },
                      integrity.results.map((r) =>
                        h(
                          "div",
                          { key: r.id, className: "of-surface", style: { padding: "8px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                          h(
                            "div",
                            { style: { minWidth: 0 } },
                            h("div", { className: "of-mono", style: { fontSize: "12px", fontWeight: 600 } }, r.id),
                            h("div", { className: "of-mono of-muted", style: { fontSize: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, `sha256: ${(r.actualSha256 || r.expectedSha256).slice(0, 16)}…`)
                          ),
                          h("span", { className: "of-pill", "data-tone": r.status === "verified" ? "done" : "failed" }, r.status === "verified" ? "✓ Íntegro" : r.status)
                        )
                      )
                    )
                  : h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, "Clique em Auditar SHA-256 para inspecionar os 7 host commands pinados.")
              )
            );
          })()
    );
  }

  // ── 6. CANVAS / VISÃO & REGRAS INJETADAS (Canvas nativo Visualizar/Editar/Histórico + Canal + Board + Regras) ──
  if (tab === "vision") {
    const ov = status.orgfyVision;
    const invariantes = ov?.invariantes || [];
    const cadeia = ov?.cadeiaComando || [];
    const escalada = Object.entries(ov?.fluxoEscalada || {});
    const regras = ov?.regrasProbatorias || [];
    const papeis = Object.entries(ov?.papeis || {});
    const ch = props.channelInfo;
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      renderBuzzCanvasViewer({
        h,
        tenant,
        channelName: ch?.name || status.tenantManifest?.nome || tenant,
        channelId: ch?.channelId || status.tenantManifest?.canal || null,
        content: props.channelCanvas ?? null,
        draft: props.canvasDraft ?? props.channelCanvas ?? "",
        onChangeDraft: (v: string) => props.setCanvasDraft?.(v),
        writable: Boolean(props.canvasWritable),
        saving: Boolean(props.canvasSaving),
        onSave: () => props.onSaveCanvas?.(),
        onReload: props.onReloadCanvas,
        history: props.canvasHistory || [],
        resolveAuthor: props.resolveAuthor,
        mode: props.canvasMode || "view",
        onChangeMode: (m) => props.setCanvasMode?.(m),
        onOpenBuzzLink: props.onOpenBuzzLink,
        onOpenChannelInBuzz: () => (props.onOpenChannelFullPage ? props.onOpenChannelFullPage() : props.onOpenChannelInBuzz?.()),
      }),
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
          h("div", { className: "of-meter-label" }, `2. Workspace & Arquivos de Contexto (${status.tenantManifest?.nome || tenant})`),
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

  // ── 7. CONFIGURAÇÕES (Layout 2 colunas equilibrado + Canal Buzz com humanos/agentes + Autonomia + Limites + Trust Engine + Segurança) ──
  const chInfo = props.channelInfo;
  const settingsTenantAgents = status.tenantManifest?.agentes || [];
  const resolvedMembers = (chInfo?.memberPubkeys || []).map((pk) => {
    const pkLow = pk.toLowerCase();
    const name = props.resolveAuthor ? props.resolveAuthor(pk) : pk.slice(0, 10);
    const isAgent = settingsTenantAgents.some((a) => a.pubkey?.toLowerCase() === pkLow) || liveCrew.some((c) => c.pubkey?.toLowerCase() === pkLow);
    const isWorking = Boolean(props.telemetry?.byPubkey?.[pkLow]);
    return { pk, name, isAgent, isWorking };
  });
  const humanMembers = resolvedMembers.filter((m) => !m.isAgent);
  const agentMembers = resolvedMembers.filter((m) => m.isAgent);
  return h(
    "div",
    {
      "data-settings-grid-layout": "true",
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
        gap: "16px",
        alignItems: "start",
        width: "100%",
        maxWidth: "1440px",
      },
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } },
    h(
      "div",
      { className: "of-card-pad", "data-buzz-channel-settings": "true", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
        h(
          "div",
          null,
          h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Canal da Empresa no Buzz · #${chInfo?.name || status.tenantManifest?.nome || tenant}`),
          h(
            "div",
            { className: "of-muted", style: { marginTop: "2px" } },
            chInfo?.available
              ? `Stream: ${chInfo.liveStatus} · Roster: ${chInfo.rosterTotalChannels} canais · Papel: ${chInfo.viewerRole || "member"}`
              : "Conecte o canal da empresa no Buzz para sincronizar descrição, membros, leitura e diagnósticos."
          )
        ),
        h(
          "div",
          { style: { display: "inline-flex", gap: "6px", flexWrap: "wrap" } },
          props.onOpenChannelFullPage &&
            h(
              "button",
              { type: "button", className: "of-btn", "data-variant": "primary", onClick: () => props.onOpenChannelFullPage!() },
              "Abrir Canal no Buzz ↗"
            ),
          props.onOpenChannelFullPage &&
            h(
              "button",
              { type: "button", className: "of-btn", onClick: () => props.onOpenChannelFullPage!({ panel: "members" }) },
              `Membros (${chInfo?.memberCount ?? 0})`
            )
        )
      ),
      chInfo?.available &&
        h(
          "div",
          { className: "of-grid-2" },
          h(
            "div",
            { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h("div", { className: "of-meter-label" }, "Descrição do Canal"),
              chInfo.canEdit && props.setEditingChannelDetails && props.setChannelDetailsDraft &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { padding: "2px 6px", fontSize: "10.5px" },
                    onClick: () => {
                      if (props.editingChannelDetails) {
                        props.setEditingChannelDetails!(false);
                      } else {
                        props.setChannelDetailsDraft!({ name: chInfo.name, description: chInfo.description });
                        props.setEditingChannelDetails!(true);
                      }
                    },
                  },
                  props.editingChannelDetails ? "Cancelar" : "Editar"
                )
            ),
            props.editingChannelDetails && props.channelDetailsDraft && props.setChannelDetailsDraft
              ? h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                  h("input", {
                    className: "of-input",
                    placeholder: "Nome do canal",
                    value: props.channelDetailsDraft.name,
                    onChange: (e: any) => props.setChannelDetailsDraft!({ name: e.target.value }),
                  }),
                  h("textarea", {
                    className: "of-textarea",
                    style: { minHeight: "68px", fontSize: "11.5px" },
                    placeholder: "Descrição oficial da empresa/canal no Buzz...",
                    value: props.channelDetailsDraft.description,
                    onChange: (e: any) => props.setChannelDetailsDraft!({ description: e.target.value }),
                  }),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "primary",
                      disabled: props.savingChannelDetails,
                      style: { alignSelf: "flex-start", padding: "4px 10px", fontSize: "11px" },
                      onClick: () => props.onSaveChannelDetails?.(),
                    },
                    props.savingChannelDetails ? "Salvando..." : "Salvar no Buzz (channelDetails.save)"
                  )
                )
              : h(
                  "div",
                  { style: { fontSize: "12px", color: chInfo.description ? "var(--foreground)" : "var(--muted-foreground)" } },
                  chInfo.description || "Sem descrição cadastrada no canal do Buzz."
                )
          ),
          h(
            "div",
            { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
            h("div", { className: "of-meter-label" }, "Acesso, ID & Leitura"),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px" } },
              h("span", { className: "of-pill", "data-tone": chInfo.visibility === "private" ? "waiting" : "done" }, chInfo.visibility === "private" ? "Privado" : chInfo.visibility === "public" ? "Público" : "Canal"),
              h("span", { className: "of-pill" }, `${chInfo.memberCount} membros`),
              typeof chInfo.unreadCount === "number" &&
                h("span", { className: "of-pill", "data-tone": chInfo.unreadCount > 0 ? "running" : "idle" }, `${chInfo.unreadCount} não lida(s)`)
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" } },
              h("code", { className: "of-mono of-muted", style: { fontSize: "10.5px", wordBreak: "break-all" } }, chInfo.channelId),
              props.onCopyText &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { padding: "2px 6px", fontSize: "10.5px" },
                    onClick: () => props.onCopyText!(chInfo.channelId, "Channel ID"),
                  },
                  "Copiar"
                )
            )
          )
        ),
      chInfo?.available && resolvedMembers.length > 0 &&
        h(
          "div",
          { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
            h("div", { className: "of-meter-label" }, `Membros no canal (${chInfo.memberCount})`),
            h("span", { className: "of-muted", style: { fontSize: "10.5px" } }, `${humanMembers.length} humano(s) · ${agentMembers.length} agente(s)`)
          ),
          humanMembers.length > 0 &&
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" } },
              h("span", { className: "of-muted", style: { fontSize: "10px", marginRight: "2px" } }, "Humanos:"),
              humanMembers.slice(0, 8).map((m) =>
                h("span", { key: m.pk, className: "of-pill", "data-tone": "waiting", style: { fontSize: "10.5px" } }, m.name)
              )
            ),
          agentMembers.length > 0 &&
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" } },
              h("span", { className: "of-muted", style: { fontSize: "10px", marginRight: "2px" } }, "Agentes:"),
              agentMembers.slice(0, 20).map((m) =>
                h(
                  "button",
                  {
                    key: m.pk,
                    type: "button",
                    className: "of-pill",
                    "data-tone": m.isWorking ? "running" : "idle",
                    style: { fontSize: "10.5px", cursor: onOpenAgentDm ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: "4px" },
                    onClick: () => onOpenAgentDm?.({ pubkey: m.pk, name: m.name }),
                  },
                  h("span", { className: "of-dot", "data-tone": m.isWorking ? "running" : "done" }),
                  m.name
                )
              )
            )
        ),
      chInfo?.available && props.onChannelDiagnostic &&
        h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "4px", borderTop: "1px solid var(--border)" } },
          h("button", { type: "button", className: "of-btn", style: { fontSize: "11px" }, onClick: () => props.onChannelDiagnostic!("markRead") }, "Marcar como lido"),
          h("button", { type: "button", className: "of-btn", style: { fontSize: "11px" }, onClick: () => props.onChannelDiagnostic!("markUnread") }, "Marcar como não lido"),
          h("button", { type: "button", className: "of-btn", style: { fontSize: "11px" }, onClick: () => props.onChannelDiagnostic!("refresh") }, "Atualizar canais e roster")
        )
    ),
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
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } },
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
    ),
    // ── SEGURANÇA & GOVERNANÇA v17.7 (Holdout Sensor + SHA-256 host.commands + Modo Focus) ──
    h(
      "div",
      { className: "of-card-pad", "data-orgfy-security-v177": "true", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h("div", { style: { fontSize: "14px", fontWeight: 700 } }, "Segurança & Sensor Independente (Onda 3 · v17.7)"),
      h(
        "div",
        { className: "of-grid-3" },
        h(
          "div",
          { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { className: "of-meter-label" }, "Holdout Scenarios (fora do repo)"),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px" } },
            h("span", { className: "of-pill", "data-tone": status.holdoutStatus?.status === "pass" ? "done" : status.holdoutStatus?.status === "fail" ? "failed" : "idle" }, status.holdoutStatus ? `${status.holdoutStatus.passed ?? 0}/${status.holdoutStatus.total ?? 0} ${status.holdoutStatus.status.toUpperCase()}` : "Não executado"),
            status.holdoutStatus?.external_verified && h("span", { className: "of-muted", style: { fontSize: "10.5px" } }, `sha:${status.holdoutStatus.suite_sha256 || "ok"}`)
          ),
          props.onRunHoldoutNow &&
            h("button", { type: "button", className: "of-btn", disabled: props.runningHoldout, style: { alignSelf: "flex-start", padding: "3px 9px", fontSize: "11px" }, onClick: props.onRunHoldoutNow }, props.runningHoldout ? "Rodando..." : "▶ Rodar Holdout")
        ),
        h(
          "div",
          { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { className: "of-meter-label" }, "Pinagem SHA-256 (host.commands)"),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px" } },
            h(
              "span",
              { className: "of-pill", "data-tone": props.commandIntegrity ? (props.commandIntegrity.mismatches > 0 ? "failed" : props.commandIntegrity.verified > 0 ? "done" : "idle") : "idle" },
              props.commandIntegrity ? `${props.commandIntegrity.verified}/${props.commandIntegrity.total} íntegros` : "Aguardando auditoria"
            )
          ),
          props.onAuditCommandIntegrity &&
            h("button", { type: "button", className: "of-btn", style: { alignSelf: "flex-start", padding: "3px 9px", fontSize: "11px" }, onClick: props.onAuditCommandIntegrity }, "Auditar SHA-256")
        ),
        h(
          "div",
          { className: "of-surface", style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { className: "of-meter-label" }, "Modo Focus do Fundador (Buzz)"),
          h(
            "div",
            { style: { fontSize: "12px", fontWeight: 600 } },
            props.focusState?.active ? `🔭 Focus ativo até ${props.focusState.untilFormatted}` : "Focus inativo"
          ),
          h("div", { className: "of-muted", style: { fontSize: "10.5px" } }, "Notificações não críticas são silenciadas durante o modo Focus; apenas alertas P0/Kill Switch atravessam.")
        )
      )
    ),
    // ── MOTOR DE CONFIANÇA & ESCAPE RATE (Autonomia Graduada · Onda 4 / v18) ──
    h(
      "div",
      { className: "of-card-pad", "data-orgfy-trust-engine": "true", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
        h(
          "div",
          null,
          h("div", { style: { fontSize: "14px", fontWeight: 700 } }, `Motor de Confiança & Escape Rate (Autonomia Graduada · v18)`),
          h(
            "div",
            { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } },
            status.trustEngine
              ? `Amostra: ${status.trustEngine.sampleSize} entregas · Escape Rate global: ${status.trustEngine.globalEscapeRatePct.toFixed(1)}% · ${status.trustEngine.darkCategoriesCount}/${status.trustEngine.totalCategoriesCount} categorias em Dark Auto-Merge`
              : "Clique em Recalcular para medir a Escape Rate real e habilitar auto-promoção por categoria."
          )
        ),
        props.onEvaluateTrustEngine &&
          h(
            "button",
            { type: "button", className: "of-btn", disabled: props.evaluatingTrust, style: { fontSize: "11px", padding: "4px 10px" }, onClick: () => props.onEvaluateTrustEngine!() },
            props.evaluatingTrust ? "Calculando..." : "↻ Recalcular Escape Rate"
          )
      ),
      status.trustEngine?.categories?.length &&
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          status.trustEngine.categories.map((cat) =>
            h(
              "div",
              { key: cat.id, className: "of-surface", style: { padding: "9px 12px", display: "flex", flexDirection: "column", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
                h(
                  "div",
                  { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
                  h("strong", { style: { fontSize: "12.5px" } }, cat.label),
                  h(
                    "span",
                    { className: "of-pill", "data-tone": cat.mode === "dark_auto_merge" ? "done" : cat.locked ? "failed" : "waiting" },
                    cat.mode === "dark_auto_merge" ? "DARK AUTO-MERGE" : cat.locked ? "GATE HUMANO 🔒" : "ASSISTIDO"
                  ),
                  h("span", { className: "of-mono of-muted", style: { fontSize: "11px" } }, `Escape: ${cat.escapeRatePct.toFixed(1)}% (máx ${cat.maxEscapeRatePct}%) · Limpas seguidas: ${cat.consecutiveClean}${cat.locked ? "" : `/${cat.targetConsecutiveClean}`}`)
                ),
                !cat.locked && props.onEvaluateTrustEngine &&
                  h(
                    "div",
                    { style: { display: "inline-flex", gap: "5px" } },
                    cat.mode !== "dark_auto_merge"
                      ? h("button", { type: "button", className: "of-btn", style: { padding: "2px 8px", fontSize: "10.5px" }, onClick: () => props.onEvaluateTrustEngine!({ category: cat.id, mode: "dark_auto_merge" }) }, "Promover Dark")
                      : h("button", { type: "button", className: "of-btn", style: { padding: "2px 8px", fontSize: "10.5px" }, onClick: () => props.onEvaluateTrustEngine!({ category: cat.id, mode: "assisted" }) }, "Rebaixar Assistido"),
                    cat.manualOverride &&
                      h("button", { type: "button", className: "of-btn", "data-variant": "ghost", style: { padding: "2px 7px", fontSize: "10.5px" }, onClick: () => props.onEvaluateTrustEngine!({ category: cat.id, mode: "auto" }) }, "Auto")
                  )
              ),
              !cat.locked &&
                h(
                  "div",
                  { className: "of-bar-track", style: { marginTop: 0, height: "5px" } },
                  h("div", { className: "of-bar-fill", style: { width: `${cat.progressPct}%`, background: cat.mode === "dark_auto_merge" ? "var(--status-done)" : "var(--primary)" } })
                ),
              h("div", { className: "of-muted", style: { fontSize: "11px" } }, cat.reason)
            )
          )
        )
    )
    )
  );
}
