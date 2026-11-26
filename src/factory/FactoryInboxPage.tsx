// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/inbox.tsx, components/inbox/inbox-entry.tsx, inbox-actions.tsx, factory-inbox.tsx, run-failed-actions.tsx, bulk-dismiss.tsx, lib/inbox.ts
// Inbox 1:1 CodeDen herdando 100% o sistema de cores e acento personalizado do Buzz Desktop (--affordance-accent-prominent, --text-on-accent, --bg-panel, --surface-inset, --text-primary/tertiary, --border-primary).

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { OrgfyAutomation } from "./AutomationEditor";
import type { CrdtBackendInfo, OrgfyQuestionCard, QuestionCardAnswer } from "../services/orgfy-crdt-store";

export type InboxFilter = "all" | "asks" | "reviews" | "problems";

export interface FactoryInboxPageProps {
  h: any;
  tenant: string;
  companyName: string;
  status: FactoryStatusPayload;
  automations?: OrgfyAutomation[];
  inboxFilter: InboxFilter;
  setInboxFilter: (f: InboxFilter) => void;
  dismissedIds: string[];
  onDismissIds: (ids: string[], label?: string) => void;
  onRestoreIds: (ids: string[]) => void;
  confirmBulkDismiss: boolean;
  setConfirmBulkDismiss: (v: boolean) => void;
  lastBulkDismiss: { ids: string[]; label: string } | null;
  onSelectItem: (item: FactoryWorkItem) => void;
  onOpenItemInBuzz?: (item: FactoryWorkItem) => void;
  onRetryItem?: (item: FactoryWorkItem) => void;
  onResumeFactory?: () => void;
  onOpenFactoryPanel?: () => void;
  onOpenSession?: (target: { name?: string; pubkey?: string; key?: string }) => void;
  QuestionCardsPanel?: any;
  questionCards?: OrgfyQuestionCard[];
  crdtBackendInfo?: CrdtBackendInfo;
  onAnswerQuestionCard?: (card: OrgfyQuestionCard, answer: QuestionCardAnswer) => Promise<void> | void;
  onDismissQuestionCard?: (card: OrgfyQuestionCard) => Promise<void> | void;
}

type InboxKind = "escalated" | "pr_review" | "run_failed" | "automation_result";

interface NormalizedInboxEntry {
  id: string;
  kind: InboxKind;
  filter: Exclude<InboxFilter, "all">;
  projectSlug: string;
  projectLabel: string;
  title: string;
  body: string | null;
  priority: "high" | "normal";
  createdAt: number;
  attempts: number;
  prShort?: string;
  branch?: string;
  sessionTarget?: { name?: string };
  workItem?: FactoryWorkItem;
  isFactoryPaused?: boolean;
  isDigest?: boolean;
  waitsOnYou: boolean;
}

function svg(h: any, size: number, paths: Array<{ tag?: string; attrs: Record<string, any> }>, color = "currentColor") {
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: 1.9,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { width: `${size}px`, height: `${size}px`, flexShrink: 0, display: "block" },
      "aria-hidden": "true",
    },
    paths.map((p, idx) => h(p.tag || "path", { key: idx, ...p.attrs }))
  );
}

const ICONS = {
  inbox: (h: any, size = 15) =>
    svg(h, size, [
      { tag: "polyline", attrs: { points: "22 12 16 12 14 15 10 15 8 12 2 12" } },
      { attrs: { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" } },
    ]),
  checkCheck: (h: any, size = 14) =>
    svg(h, size, [
      { attrs: { d: "M18 6 7 17l-5-5" } },
      { attrs: { d: "m22 10-7.5 7.5L13 16" } },
    ]),
  gitMerge: (h: any, size = 13) =>
    svg(h, size, [
      { tag: "circle", attrs: { cx: 18, cy: 18, r: 3 } },
      { tag: "circle", attrs: { cx: 6, cy: 6, r: 3 } },
      { attrs: { d: "M6 21V9a9 9 0 0 0 9 9" } },
    ]),
  gitPr: (h: any, size = 13, color = "currentColor") =>
    svg(
      h,
      size,
      [
        { tag: "circle", attrs: { cx: 18, cy: 18, r: 3 } },
        { tag: "circle", attrs: { cx: 6, cy: 6, r: 3 } },
        { attrs: { d: "M13 6h3a2 2 0 0 1 2 2v7" } },
        { tag: "line", attrs: { x1: 6, y1: 9, x2: 6, y2: 21 } },
      ],
      color
    ),
  externalLink: (h: any, size = 13) =>
    svg(h, size, [
      { attrs: { d: "M15 3h6v6" } },
      { attrs: { d: "M10 14 21 3" } },
      { attrs: { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" } },
    ]),
  arrowUpRight: (h: any, size = 12) =>
    svg(h, size, [
      { attrs: { d: "M7 7h10v10" } },
      { attrs: { d: "M7 17 17 7" } },
    ]),
  rotateCcw: (h: any, size = 13) =>
    svg(h, size, [
      { attrs: { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" } },
      { attrs: { d: "M3 3v5h5" } },
    ]),
  newspaper: (h: any, size = 14) =>
    svg(h, size, [
      { attrs: { d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" } },
      { attrs: { d: "M18 14h-8" } },
      { attrs: { d: "M15 18h-5" } },
      { attrs: { d: "M10 6h8v4h-8V6Z" } },
    ]),
  shieldAlert: (h: any, size = 14) =>
    svg(h, size, [
      { attrs: { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" } },
      { attrs: { d: "M12 8v4" } },
      { attrs: { d: "M12 16h.01" } },
    ]),
  factory: (h: any, size = 13) =>
    svg(h, size, [
      { attrs: { d: "M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" } },
      { attrs: { d: "M17 18h1" } },
      { attrs: { d: "M12 18h1" } },
      { attrs: { d: "M7 18h1" } },
    ]),
  circle: (h: any, size = 12, color = "var(--muted-foreground)") =>
    svg(h, size, [{ tag: "circle", attrs: { cx: 12, cy: 12, r: 9 } }], color),
};

function fmtAgo(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "agora";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days} d atrás`;
}

function projectBadgeStyle(slug: string): Record<string, string> {
  const s = (slug || "orgfy").toLowerCase();
  if (s.includes("lumen")) {
    return {
      background: "var(--surface-categorical-purple, rgba(168, 85, 247, 0.16))",
      color: "var(--icon-categorical-purple, var(--purple-11, #c084fc))",
    };
  }
  if (s.includes("saas") || s.includes("trib")) {
    return {
      background: "var(--surface-categorical-blue, rgba(59, 130, 246, 0.16))",
      color: "var(--icon-categorical-blue, var(--blue-11, #60a5fa))",
    };
  }
  return {
    background: "var(--primary-soft)",
    color: "var(--primary-text)",
  };
}

function buildDigestBody(tenant: string, status: FactoryStatusPayload): string {
  const merged = status.recent.filter((i) => i.stage === "merged").slice(0, 5);
  const failed = [...status.inProgress, ...status.recent].filter((i) => i.stage === "failed" || i.stage === "reverted").slice(0, 5);
  const waiting = [...status.inProgress.filter((i) => i.stage === "verifying" || i.stage === "escalated")].slice(0, 5);
  const lines: string[] = [
    `Digest da fábrica para ${tenant}, ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Integrados (${merged.length}):`,
    ...(merged.length > 0 ? merged.map((m) => `• #${m.id.slice(0, 8)} ${m.title}`) : ["• nenhum"]),
    "",
    `Recusados ou com falha (${failed.length}):`,
    ...(failed.length > 0 ? failed.map((f) => `• #${f.id.slice(0, 8)} ${f.title}${f.reason ? ` — ${f.reason}` : ""}`) : ["• nenhum"]),
    "",
    `Aguardando revisão ou decisão (${waiting.length}):`,
    ...(waiting.length > 0 ? waiting.map((w) => `• #${w.id.slice(0, 8)} ${w.title}`) : ["• nenhum"]),
    "",
    `Gasto hoje: $${status.spendToday.usd.toFixed(2)} / $${status.limits.dailyBudget?.usd ?? 50} · WIP: ${status.wip.openPrs}/${status.wip.limit} PRs`,
  ];
  return lines.join("\n");
}

function buildEntries(props: FactoryInboxPageProps): NormalizedInboxEntry[] {
  const { tenant, companyName, status, automations } = props;
  const cooName = status.tenantManifest?.coo || "OrgFy Bento";
  const entries: NormalizedInboxEntry[] = [];
  const seen = new Set<string>();

  // 1. Áreas protegidas / Escaladas ao Fundador (waitsOnYou = true)
  for (const item of [...status.inProgress, ...status.recent]) {
    if (item.stage !== "escalated") continue;
    const id = `escalated:${item.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      kind: "escalated",
      filter: "asks",
      projectSlug: tenant,
      projectLabel: tenant,
      title: item.title,
      body: item.reason || item.note || "Item escalado para decisão em área protegida.",
      priority: "high",
      createdAt: item.updatedAt || Date.now(),
      attempts: item.attempts || 1,
      prShort: item.id.slice(0, 8),
      sessionTarget: { name: cooName },
      workItem: item,
      waitsOnYou: true,
    });
  }

  // 2. Pull requests prontos para revisão (L-01 / Merge)
  for (const item of status.inProgress) {
    if (item.stage !== "verifying") continue;
    const id = `pr:${item.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const branchMatch = item.note?.match(/PR aberto\s*·\s*(.+)$/i);
    entries.push({
      id,
      kind: "pr_review",
      filter: "reviews",
      projectSlug: tenant,
      projectLabel: tenant,
      title: `Pronto para revisão: ${item.title}`,
      body: item.note || "PR pronto aguardando revisão L-01 e veredito GATE.",
      priority: "normal",
      createdAt: item.updatedAt || Date.now(),
      attempts: item.attempts || 1,
      prShort: item.id.slice(0, 8),
      branch: branchMatch ? branchMatch[1].trim() : undefined,
      sessionTarget: { name: Object.values(status.tenantManifest?.revisoresPorSuperficie || {})[0] || "OrgFy Teo" },
      workItem: item,
      waitsOnYou: true,
    });
  }

  // 3. Execuções com falha (Loop pausado / Quarentena / Falhas)
  if (status.killSwitch || status.loopState === "paused") {
    entries.push({
      id: `factory-paused:${tenant}`,
      kind: "run_failed",
      filter: "problems",
      projectSlug: tenant,
      projectLabel: tenant,
      title: "Loop da fábrica pausado",
      body:
        status.pausedReason ||
        `${status.consecutiveFailures} falha(s) consecutiva(s) ou Kill Switch ativo. Retome a fábrica após inspecionar os logs.`,
      priority: "high",
      createdAt: status.lastTickAt || Date.now(),
      attempts: Math.max(1, status.consecutiveFailures),
      sessionTarget: { name: cooName },
      isFactoryPaused: true,
      waitsOnYou: false,
    });
  }

  for (const item of [...status.inProgress, ...status.recent]) {
    if (item.stage !== "failed" && item.stage !== "reverted") continue;
    const id = `failed:${item.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      kind: "run_failed",
      filter: "problems",
      projectSlug: tenant,
      projectLabel: tenant,
      title: `Falha na execução: ${item.title}`,
      body: item.reason || item.note || "Execução interrompida ou enviada para quarentena pelo coordenador.",
      priority: item.stage === "reverted" ? "high" : "normal",
      createdAt: item.updatedAt || Date.now(),
      attempts: Math.max(1, item.attempts || 1),
      prShort: item.id.slice(0, 8),
      sessionTarget: { name: cooName },
      workItem: item,
      waitsOnYou: false,
    });
  }

  // 4. Resultados de automação (Factory Digest diário + execuções recentes de automações)
  const today = new Date().toISOString().slice(0, 10);
  const mergedCount = status.stats.mergedToday;
  const failedCount = status.stats.failedToday + entries.filter((e) => e.kind === "run_failed").length;
  const waitingCount = entries.filter((e) => e.waitsOnYou).length;
  entries.push({
    id: `factory-digest:${tenant}:${today}`,
    kind: "automation_result",
    filter: "reviews",
    projectSlug: tenant,
    projectLabel: companyName || tenant,
    title: `${tenant}, ${today} (${mergedCount} integrados, ${failedCount} recusados, ${waitingCount} aguardando)`,
    body: buildDigestBody(tenant, status),
    priority: "normal",
    createdAt: status.lastTickAt || Date.now(),
    attempts: 1,
    isDigest: true,
    waitsOnYou: false,
  });

  for (const auto of automations || []) {
    const lastRun = auto.recentRuns?.[0];
    if (!lastRun) continue;
    const isErr = lastRun.status === "error";
    entries.push({
      id: `auto-run:${auto.id}:${lastRun.id}`,
      kind: isErr ? "run_failed" : "automation_result",
      filter: isErr ? "problems" : "reviews",
      projectSlug: tenant,
      projectLabel: tenant,
      title: isErr ? `Falha na automação: ${auto.name}` : `Resultado da automação: ${auto.name}`,
      body: lastRun.detail || `Executada às ${lastRun.at} por ${auto.targetAgent}.`,
      priority: isErr ? "high" : "normal",
      createdAt: Date.now() - 600_000,
      attempts: 1,
      sessionTarget: { name: auto.targetAgent },
      waitsOnYou: false,
    });
  }

  return entries;
}

export function renderFactoryInboxPage(props: FactoryInboxPageProps) {
  const {
    h,
    inboxFilter,
    setInboxFilter,
    dismissedIds,
    onDismissIds,
    onRestoreIds,
    confirmBulkDismiss,
    setConfirmBulkDismiss,
    lastBulkDismiss,
    onSelectItem,
    onOpenItemInBuzz,
    onRetryItem,
    onResumeFactory,
    onOpenFactoryPanel,
    onOpenSession,
  } = props;

  const dismissedSet = new Set(dismissedIds);
  const allEntries = buildEntries(props);
  const openEntries = allEntries.filter((e) => !dismissedSet.has(e.id));
  const resolvedEntries = allEntries.filter((e) => dismissedSet.has(e.id)).slice(0, 5);

  const qCards = props.questionCards || [];
  const pendingQ = qCards.filter((c) => c.status === "pending");

  const counts: Record<InboxFilter, number> = {
    all: openEntries.length + pendingQ.length,
    asks: openEntries.filter((e) => e.filter === "asks").length + pendingQ.length,
    reviews: openEntries.filter((e) => e.filter === "reviews").length,
    problems: openEntries.filter((e) => e.filter === "problems").length,
  };

  const GROUP_DEFS: Array<{ kind: InboxKind; title: string; filter: Exclude<InboxFilter, "all"> }> = [
    { kind: "escalated", title: "ÁREAS PROTEGIDAS & ESCALADAS", filter: "asks" },
    { kind: "pr_review", title: "PULL REQUESTS PRONTOS", filter: "reviews" },
    { kind: "run_failed", title: "EXECUÇÕES COM FALHA", filter: "problems" },
    { kind: "automation_result", title: "RESULTADOS DE AUTOMAÇÃO", filter: "reviews" },
  ];

  const groups = GROUP_DEFS.filter((g) => inboxFilter === "all" || g.filter === inboxFilter)
    .map((g) => ({
      ...g,
      items: openEntries
        .filter((e) => e.kind === g.kind)
        .sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1) || b.createdAt - a.createdAt),
    }))
    .filter((g) => g.items.length > 0);

  const viewItems = groups.flatMap((g) => g.items);
  const dismissableInView = viewItems.filter((i) => !i.waitsOnYou);
  const stayingInView = viewItems.filter((i) => i.waitsOnYou);
  const showQuestionCards = Boolean(props.QuestionCardsPanel && qCards.length > 0 && (inboxFilter === "all" || inboxFilter === "asks"));

  const FILTERS: Array<{ id: InboxFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "asks", label: "Aguarda resposta" },
    { id: "reviews", label: "Revisões" },
    { id: "problems", label: "Problemas" },
  ];

  const renderEntryCard = (entry: NormalizedInboxEntry, isResolved = false) => {
    const badgeColors = projectBadgeStyle(entry.projectSlug);
    const metaRow = h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px",
          fontSize: "11px",
          color: "var(--muted-foreground)",
        },
      },
      h(
        "span",
        {
          style: {
            width: "18px",
            height: "18px",
            borderRadius: "5px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 700,
            flexShrink: 0,
            ...badgeColors,
          },
        },
        entry.projectSlug.charAt(0).toUpperCase()
      ),
      h("span", { style: { color: "var(--muted-foreground)", fontWeight: 500 } }, entry.projectSlug),
      h("span", { style: { opacity: 0.45 } }, "·"),
      h("span", null, fmtAgo(entry.createdAt)),
      entry.priority === "high" &&
        h(
          "span",
          {
            style: {
              borderRadius: "9999px",
              padding: "1px 7px",
              fontSize: "10px",
              fontWeight: 600,
              background: "var(--affordance-danger, rgba(239, 68, 68, 0.14))",
              color: "var(--text-danger, var(--status-failed))",
            },
          },
          "alta"
        ),
      h(
        "span",
        { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "10px" } },
        entry.prShort &&
          h(
            "button",
            {
              type: "button",
              onClick: () => (entry.workItem ? (onOpenItemInBuzz ? onOpenItemInBuzz(entry.workItem) : onSelectItem(entry.workItem)) : undefined),
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                border: "none",
                background: "transparent",
                color: "var(--muted-foreground)",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
                padding: 0,
              },
            },
            ICONS.gitPr(h, 12, "var(--status-done)"),
            `#${entry.prShort}`
          ),
        entry.sessionTarget &&
          onOpenSession &&
          h(
            "button",
            {
              type: "button",
              onClick: () => onOpenSession(entry.sessionTarget!),
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                border: "none",
                background: "transparent",
                color: "var(--muted-foreground)",
                fontSize: "11px",
                cursor: "pointer",
                padding: 0,
              },
            },
            "Sessão",
            ICONS.arrowUpRight(h, 12)
          )
      )
    );

    if (entry.isDigest) {
      return h(
        "article",
        { key: entry.id, "data-inbox-kind": "digest", style: { opacity: isResolved ? 0.6 : 1 } },
        metaRow,
        h(
          "div",
          {
            style: {
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--card)",
              overflow: "hidden",
            },
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
              },
            },
            ICONS.newspaper(h, 14),
            h("span", null, "Digest da Fábrica")
          ),
          h(
            "div",
            { style: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" } },
            h("h3", { style: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--foreground)" } }, entry.title),
            entry.body &&
              h(
                "pre",
                {
                  style: {
                    margin: 0,
                    maxHeight: "260px",
                    overflowY: "auto",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-inset)",
                    padding: "10px 12px",
                    fontSize: "12.5px",
                    lineHeight: 1.55,
                    fontFamily: "inherit",
                    whiteSpace: "pre-wrap",
                    color: "var(--foreground)",
                  },
                },
                entry.body
              ),
            !isResolved
              ? h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                  onOpenFactoryPanel &&
                    h(
                      "button",
                      { type: "button", className: "of-btn", onClick: onOpenFactoryPanel },
                      ICONS.factory(h, 13),
                      "Painel da Fábrica"
                    ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "ghost",
                      onClick: () => onDismissIds([entry.id], "1 digest"),
                    },
                    "Marcar como lido"
                  )
                )
              : h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "var(--status-done)" } },
                  h("span", null, "Lido / resolvido"),
                  h(
                    "button",
                    { type: "button", className: "of-btn", "data-variant": "ghost", onClick: () => onRestoreIds([entry.id]) },
                    "Restaurar"
                  )
                )
          )
        )
      );
    }

    if (entry.kind === "escalated") {
      return h(
        "article",
        { key: entry.id, "data-inbox-kind": "escalated", style: { opacity: isResolved ? 0.6 : 1 } },
        metaRow,
        h(
          "div",
          {
            style: {
              borderRadius: "12px",
              border: "1px solid var(--border-warning, rgba(245, 158, 11, 0.35))",
              background: "var(--card)",
              overflow: "hidden",
            },
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
                background: "var(--affordance-warning, rgba(245, 158, 11, 0.08))",
                color: "var(--text-warning, var(--status-waiting))",
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              },
            },
            ICONS.shieldAlert(h, 14),
            h("span", null, "Área protegida · precisa de você")
          ),
          h(
            "div",
            { style: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" } },
            h("h3", { style: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--foreground)" } }, entry.title),
            entry.body && h("p", { style: { margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--muted-foreground)" } }, entry.body),
            !isResolved &&
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" } },
                entry.workItem &&
                  h(
                    "button",
                    { type: "button", className: "of-btn", "data-variant": "primary", onClick: () => onSelectItem(entry.workItem!) },
                    ICONS.gitMerge(h, 13),
                    "Revisar e decidir"
                  ),
                entry.workItem &&
                  onOpenItemInBuzz &&
                  h(
                    "button",
                    { type: "button", className: "of-btn", onClick: () => onOpenItemInBuzz(entry.workItem!) },
                    ICONS.gitPr(h, 13),
                    "Abrir PR"
                  )
              )
          )
        )
      );
    }

    return h(
      "article",
      { key: entry.id, "data-inbox-kind": entry.kind, style: { opacity: isResolved ? 0.6 : 1 } },
      metaRow,
      h(
        "div",
        {
          style: {
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "var(--card)",
            padding: "13px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        h("h3", { style: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.35 } }, entry.title),
        entry.body &&
          h(
            "p",
            {
              style: {
                margin: 0,
                fontSize: "13px",
                lineHeight: 1.5,
                color: "var(--muted-foreground)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              },
            },
            entry.body
          ),
        entry.kind === "pr_review" &&
          !isResolved &&
          h(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
                marginTop: "2px",
                fontSize: "11px",
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
              },
            },
            ICONS.circle(h, 12, "var(--muted-foreground)"),
            h("span", { style: { color: "var(--diff-add)" } }, "L-01 pendente"),
            entry.branch && h("span", null, entry.branch),
            h("span", null, `tentativa ${entry.attempts}`)
          ),
        !isResolved
          ? h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "6px" } },
              entry.kind === "pr_review" &&
                entry.workItem &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    onClick: () => onSelectItem(entry.workItem!),
                  },
                  ICONS.gitMerge(h, 13),
                  "Merge"
                ),
              entry.kind === "pr_review" &&
                entry.workItem &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    onClick: () => onSelectItem(entry.workItem!),
                  },
                  ICONS.gitPr(h, 13),
                  "Abrir PR"
                ),
              entry.kind === "pr_review" &&
                entry.workItem &&
                onOpenItemInBuzz &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    onClick: () => onOpenItemInBuzz(entry.workItem!),
                  },
                  ICONS.externalLink(h, 13),
                  "Buzz Repos"
                ),
              entry.kind === "run_failed" &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    onClick: () => {
                      if (entry.isFactoryPaused && onResumeFactory) onResumeFactory();
                      else if (entry.workItem && onRetryItem) onRetryItem(entry.workItem);
                      else if (entry.workItem) onSelectItem(entry.workItem);
                    },
                  },
                  ICONS.rotateCcw(h, 13),
                  entry.isFactoryPaused ? "Retomar fábrica" : "Refazer"
                ),
              entry.kind !== "pr_review" &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    onClick: () => onDismissIds([entry.id], "1 aviso"),
                  },
                  "Dispensar"
                ),
              entry.kind === "run_failed" &&
                entry.attempts > 1 &&
                h("span", { style: { fontSize: "11px", color: "var(--muted-foreground)" } }, `Falhou ${entry.attempts} vezes`)
            )
          : h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px", fontSize: "11px", color: "var(--status-done)" } },
              h("span", null, "Resolvido / dispensado"),
              h(
                "button",
                { type: "button", className: "of-btn", "data-variant": "ghost", onClick: () => onRestoreIds([entry.id]) },
                "Restaurar"
              )
            )
      )
    );
  };

  return h(
    "div",
    {
      "data-orgfy-inbox-v183": "true",
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        gap: "18px",
      },
    },
    // Barra superior 1:1 CodeDen (Inbox + N aguardando você | ✓ Dispensar N)
    h(
      "div",
      {
        "data-inbox-header": "true",
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--border)",
        },
      },
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "10px" } },
        h("span", { style: { color: "var(--muted-foreground)", display: "inline-flex" } }, ICONS.inbox(h, 16)),
        h("strong", { style: { fontSize: "14px", fontWeight: 600, color: "var(--foreground)" } }, "Inbox"),
        h(
          "span",
          { className: "of-num", style: { fontSize: "12px", color: "var(--muted-foreground)" } },
          `${counts.all} aguardando você`
        )
      ),
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
        lastBulkDismiss &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              onClick: () => onRestoreIds(lastBulkDismiss.ids),
            },
            `Desfazer (${lastBulkDismiss.label})`
          ),
        dismissableInView.length > 0 &&
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "ghost",
              onClick: () => setConfirmBulkDismiss(!confirmBulkDismiss),
            },
            ICONS.checkCheck(h, 14),
            `Dispensar ${dismissableInView.length}`
          )
      )
    ),
    confirmBulkDismiss &&
      dismissableInView.length > 0 &&
      h(
        "div",
        {
          style: {
            maxWidth: "768px",
            width: "100%",
            margin: "0 auto",
            borderRadius: "12px",
            border: "1px solid var(--border-strong)",
            background: "var(--card)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          },
        },
        h("div", { style: { fontSize: "13.5px", fontWeight: 600 } }, `Dispensar ${dismissableInView.length} aviso(s)?`),
        h(
          "div",
          { style: { fontSize: "12px", color: "var(--muted-foreground)" } },
          `${dismissableInView.length} aviso(s) serão dispensados${stayingInView.length > 0 ? `; ${stayingInView.length} item(ns) aguardando sua decisão permanecem.` : "."} Você pode desfazer logo em seguida.`
        ),
        stayingInView.length > 0 &&
          h(
            "div",
            { style: { fontSize: "12px", color: "var(--muted-foreground)" } },
            h("div", { style: { fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" } }, "Permanecem"),
            stayingInView.slice(0, 5).map((s) => h("div", { key: s.id, style: { color: "var(--foreground)" } }, `• ${s.title}`))
          ),
        h(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
          h("button", { type: "button", className: "of-btn", onClick: () => setConfirmBulkDismiss(false) }, "Cancelar"),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "primary",
              onClick: () => {
                onDismissIds(
                  dismissableInView.map((i) => i.id),
                  `${dismissableInView.length} aviso(s)`
                );
                setConfirmBulkDismiss(false);
              },
            },
            `Dispensar ${dismissableInView.length}`
          )
        )
      ),
    // Corpo centralizado 1:1 CodeDen (max-w-3xl = 768px)
    h(
      "div",
      {
        style: {
          width: "100%",
          maxWidth: "768px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
          paddingBottom: "32px",
        },
      },
      // Abas de filtro segmentadas
      h(
        "div",
        {
          "data-inbox-filters": "true",
          style: {
            display: "inline-flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "4px",
            width: "fit-content",
            borderRadius: "9px",
            border: "1px solid var(--border)",
            background: "var(--card)",
            padding: "3px",
          },
        },
        FILTERS.map((f) => {
          const active = inboxFilter === f.id;
          return h(
            "button",
            {
              key: f.id,
              type: "button",
              onClick: () => setInboxFilter(f.id),
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                height: "28px",
                padding: "0 10px",
                borderRadius: "6px",
                border: "none",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                fontSize: "12px",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              },
            },
            h("span", null, f.label),
            h("span", { className: "of-num", style: { fontSize: "10.5px", opacity: 0.7 } }, String(counts[f.id]))
          );
        })
      ),
      showQuestionCards &&
        h(props.QuestionCardsPanel, {
          cards: qCards,
          backendInfo: props.crdtBackendInfo,
          onAnswer: props.onAnswerQuestionCard || (() => {}),
          onDismiss: props.onDismissQuestionCard || (() => {}),
        }),
      groups.length === 0 && !showQuestionCards
        ? h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "64px 20px",
                gap: "8px",
                color: "var(--muted-foreground)",
              },
            },
            ICONS.checkCheck(h, 24),
            h("div", { style: { fontSize: "14px", fontWeight: 600, color: "var(--foreground)" } }, "Você está em dia"),
            h("div", { style: { fontSize: "12.5px", maxWidth: "380px" } }, "Perguntas, aprovações, PRs prontos para revisão e falhas de execução aparecem aqui.")
          )
        : groups.map((g) => {
            const dismissableGroup = g.items.filter((i) => !i.waitsOnYou);
            return h(
              "section",
              { key: g.kind, style: { display: "flex", flexDirection: "column", gap: "14px" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                h(
                  "div",
                  {
                    style: {
                      fontSize: "10.5px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                    },
                  },
                  `${g.title} · ${g.items.length}`
                ),
                g.kind === "run_failed" &&
                  dismissableGroup.length >= 2 &&
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "ghost",
                      style: { fontSize: "11px", padding: "2px 8px" },
                      onClick: () =>
                        onDismissIds(
                          dismissableGroup.map((i) => i.id),
                          `${dismissableGroup.length} falha(s)`
                        ),
                    },
                    "Dispensar todos"
                  )
              ),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "18px" } },
                g.items.map((item) => renderEntryCard(item, false))
              )
            );
          }),
      resolvedEntries.length > 0 &&
        h(
          "section",
          { style: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" } },
          h(
            "div",
            {
              style: {
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
              },
            },
            `Resolvidos recentemente · ${resolvedEntries.length}`
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "12px" } },
            resolvedEntries.map((item) => renderEntryCard(item, true))
          )
        )
    )
  );
}
