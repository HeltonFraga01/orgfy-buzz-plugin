// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory/PipelineDiagram.tsx
// Diagrama de Pipelines ao vivo (prioridade #1): Oráculo -> Issue -> Identificar tipo -> Bug / Feature / Docs (com Revisor L-01) -> Merge.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import { PT_BR } from "../i18n/pt-BR";

export interface PipelineDiagramProps {
  h: any;
  status: FactoryStatusPayload;
  activeHelpKey: string | null;
  onToggleHelp: (key: string | null) => void;
  onSelectItem: (item: FactoryWorkItem) => void;
}

function classifyLane(item: FactoryWorkItem): "bug" | "feature" | "docs" {
  if (item.type === "bug" || item.type === "feature" || item.type === "docs") return item.type;
  const t = `${item.title} ${item.workKey}`.toLowerCase();
  if (t.includes("fix") || t.includes("bug") || t.includes("hotfix")) return "bug";
  if (t.includes("doc") || t.includes("readme") || t.includes("prd")) return "docs";
  return "feature";
}

function bucketStep(item: FactoryWorkItem, lane: "bug" | "feature" | "docs"): string {
  const st = String(item.step || item.stage || "").toLowerCase();
  if (item.stage === "merged") return "merge";
  if (item.stage === "verifying" || item.stage === "watching" || st.includes("revis") || st.includes("gate") || st.includes("review")) {
    return lane === "docs" ? "review_docs" : "review";
  }
  if (lane === "bug") {
    if (st.includes("reprod") || item.stage === "backlog") return "reproduce";
    return "fix";
  }
  if (lane === "docs") {
    if (st.includes("check") || st.includes("ci")) return "checks";
    return "implement_docs";
  }
  if (st.includes("anal") || st.includes("spec") || item.stage === "backlog") return "analyze";
  return "implement";
}

export function renderPipelineDiagram(props: PipelineDiagramProps) {
  const { h, status, activeHelpKey, onToggleHelp, onSelectItem } = props;
  const allActive = [...status.backlog, ...status.inProgress];
  const recentMerged = status.recent.filter((i) => i.stage === "merged").slice(0, 6);
  const failedItems = [...status.inProgress, ...status.recent].filter(
    (i) => i.stage === "failed" || i.stage === "escalated" || i.stage === "reverted"
  );
  const retryCount = allActive.reduce((acc, i) => acc + Math.max(0, (i.attempts || 1) - 1), 0);

  const laneBuckets: Record<string, FactoryWorkItem[]> = {
    reproduce: [],
    fix: [],
    review_bug: [],
    analyze: [],
    implement: [],
    review_feature: [],
    implement_docs: [],
    checks: [],
    review_docs: [],
  };

  for (const item of status.inProgress) {
    const lane = classifyLane(item);
    const step = bucketStep(item, lane);
    if (lane === "bug" && step === "review") laneBuckets.review_bug.push(item);
    else if (lane === "feature" && step === "review") laneBuckets.review_feature.push(item);
    else if (laneBuckets[step]) laneBuckets[step].push(item);
  }

  const loopTone =
    status.killSwitch || status.globalKillSwitch || status.loopState === "stopped"
      ? "danger"
      : status.loopState === "draining" || status.loopState === "paused"
      ? "warn"
      : "ok";
  const loopLabel = PT_BR.loopState[status.loopState] || status.loopState;

  const renderNode = (opts: {
    keyId: string;
    title: string;
    badge: string;
    help: string;
    items: FactoryWorkItem[];
  }) => {
    const hasAlert = opts.items.some((i) => i.stage === "failed" || i.stage === "escalated" || i.stage === "reverted");
    const isEmpty = opts.items.length === 0;
    const isHelpOpen = activeHelpKey === opts.keyId;

    return h(
      "div",
      {
        key: opts.keyId,
        className: "of-node",
        "data-empty": isEmpty ? "true" : "false",
        "data-alert": hasAlert ? "true" : "false",
      },
      h(
        "div",
        { className: "of-node-head" },
        h("span", { className: "of-node-title" }, opts.title),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "4px" } },
          h("span", { className: "of-node-badge" }, opts.badge),
          h(
            "button",
            {
              type: "button",
              className: "of-help-btn",
              title: opts.help,
              onClick: () => onToggleHelp(isHelpOpen ? null : opts.keyId),
            },
            "?"
          )
        )
      ),
      isHelpOpen &&
        h(
          "div",
          {
            style: {
              fontSize: "11px",
              color: "var(--muted-foreground)",
              background: "rgba(0,0,0,0.28)",
              padding: "6px 8px",
              borderRadius: "6px",
              lineHeight: 1.35,
            },
          },
          opts.help
        ),
      opts.items.length > 0
        ? h(
            "div",
            { className: "of-chip-row" },
            opts.items.slice(0, 8).map((item) => {
              const itemAlert = item.stage === "failed" || item.stage === "escalated" || item.stage === "reverted";
              return h(
                "button",
                {
                  key: `${opts.keyId}-${item.id}`,
                  type: "button",
                  className: "of-chip",
                  "data-alert": itemAlert ? "true" : "false",
                  title: `${item.title} (${item.stage})`,
                  onClick: () => onSelectItem(item),
                },
                itemAlert ? "⚠ " : "",
                `#${item.id.slice(0, 8)}`
              );
            })
          )
        : h("span", { className: "of-muted", style: { fontSize: "10.5px" } }, "—")
    );
  };

  return h(
    "section",
    { className: "of-card of-pipeline-flow" },
    h(
      "div",
      { className: "of-header-bar" },
      h(
        "div",
        null,
        h("div", { style: { fontSize: "14px", fontWeight: 700 } }, PT_BR.pipelines.title),
        h("div", { className: "of-muted", style: { marginTop: "2px" } }, PT_BR.pipelines.subtitle)
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        h("span", { className: "of-pill", "data-tone": loopTone }, loopLabel),
        h(
          "span",
          { className: "of-pill", "data-tone": retryCount > 0 ? "warn" : "muted", title: PT_BR.pipelines.reviseHelp },
          `↻ ${PT_BR.pipelines.reviseLabel}: ${retryCount}`
        ),
        failedItems.length > 0 &&
          h("span", { className: "of-pill", "data-tone": "danger" }, `⚠ ${failedItems.length} atenção`)
      )
    ),

    // Entrada: Oráculo ⇢ Issue ⇢ Identificar tipo
    h(
      "div",
      { className: "of-pipeline-entry" },
      h("div", { style: { flex: "1 1 200px" } }, renderNode({
        keyId: "scout",
        title: PT_BR.pipelines.scoutLabel,
        badge: PT_BR.pipelines.scoutBadge,
        help: PT_BR.pipelines.scoutHelp,
        items: [],
      })),
      h("div", { style: { flex: "1 1 200px" } }, renderNode({
        keyId: "issue",
        title: PT_BR.pipelines.issueLabel,
        badge: PT_BR.pipelines.issueBadge,
        help: PT_BR.pipelines.issueHelp,
        items: status.backlog,
      })),
      h("div", { style: { flex: "1 1 200px" } }, renderNode({
        keyId: "classify",
        title: PT_BR.pipelines.classifyLabel,
        badge: PT_BR.pipelines.classifyBadge,
        help: PT_BR.pipelines.classifyHelp,
        items: status.backlog.slice(0, 4),
      }))
    ),

    // 3 Raias: Bug, Feature, Documentação (L-01 mantido!) -> Merge
    h(
      "div",
      { className: "of-pipeline-lanes" },
      // Raia Bug
      h(
        "div",
        { className: "of-lane" },
        h("div", { className: "of-lane-tag" }, PT_BR.pipelines.lanes.bug.title),
        renderNode({
          keyId: "bug-reproduce",
          title: PT_BR.pipelines.lanes.bug.steps[0].label,
          badge: PT_BR.pipelines.lanes.bug.steps[0].badge,
          help: PT_BR.pipelines.lanes.bug.steps[0].help,
          items: laneBuckets.reproduce,
        }),
        renderNode({
          keyId: "bug-fix",
          title: PT_BR.pipelines.lanes.bug.steps[1].label,
          badge: PT_BR.pipelines.lanes.bug.steps[1].badge,
          help: PT_BR.pipelines.lanes.bug.steps[1].help,
          items: laneBuckets.fix,
        }),
        renderNode({
          keyId: "bug-review",
          title: PT_BR.pipelines.lanes.bug.steps[2].label,
          badge: PT_BR.pipelines.lanes.bug.steps[2].badge,
          help: PT_BR.pipelines.lanes.bug.steps[2].help,
          items: laneBuckets.review_bug,
        }),
        renderNode({
          keyId: "merge-bug",
          title: PT_BR.pipelines.mergeLabel,
          badge: PT_BR.pipelines.mergeBadge,
          help: PT_BR.pipelines.mergeHelp,
          items: recentMerged.filter((i) => classifyLane(i) === "bug"),
        })
      ),

      // Raia Feature
      h(
        "div",
        { className: "of-lane" },
        h("div", { className: "of-lane-tag" }, PT_BR.pipelines.lanes.feature.title),
        renderNode({
          keyId: "feat-analyze",
          title: PT_BR.pipelines.lanes.feature.steps[0].label,
          badge: PT_BR.pipelines.lanes.feature.steps[0].badge,
          help: PT_BR.pipelines.lanes.feature.steps[0].help,
          items: laneBuckets.analyze,
        }),
        renderNode({
          keyId: "feat-implement",
          title: PT_BR.pipelines.lanes.feature.steps[1].label,
          badge: PT_BR.pipelines.lanes.feature.steps[1].badge,
          help: PT_BR.pipelines.lanes.feature.steps[1].help,
          items: laneBuckets.implement,
        }),
        renderNode({
          keyId: "feat-review",
          title: PT_BR.pipelines.lanes.feature.steps[2].label,
          badge: PT_BR.pipelines.lanes.feature.steps[2].badge,
          help: PT_BR.pipelines.lanes.feature.steps[2].help,
          items: laneBuckets.review_feature,
        }),
        renderNode({
          keyId: "merge-feat",
          title: PT_BR.pipelines.mergeLabel,
          badge: PT_BR.pipelines.mergeBadge,
          help: PT_BR.pipelines.mergeHelp,
          items: recentMerged.filter((i) => classifyLane(i) === "feature"),
        })
      ),

      // Raia Docs (com Revisor L-01 mantido!)
      h(
        "div",
        { className: "of-lane" },
        h("div", { className: "of-lane-tag" }, PT_BR.pipelines.lanes.docs.title),
        renderNode({
          keyId: "docs-impl",
          title: PT_BR.pipelines.lanes.docs.steps[0].label,
          badge: PT_BR.pipelines.lanes.docs.steps[0].badge,
          help: PT_BR.pipelines.lanes.docs.steps[0].help,
          items: laneBuckets.implement_docs,
        }),
        renderNode({
          keyId: "docs-checks",
          title: PT_BR.pipelines.lanes.docs.steps[1].label,
          badge: PT_BR.pipelines.lanes.docs.steps[1].badge,
          help: PT_BR.pipelines.lanes.docs.steps[1].help,
          items: laneBuckets.checks,
        }),
        renderNode({
          keyId: "docs-review",
          title: PT_BR.pipelines.lanes.docs.steps[2].label,
          badge: PT_BR.pipelines.lanes.docs.steps[2].badge,
          help: PT_BR.pipelines.lanes.docs.steps[2].help,
          items: laneBuckets.review_docs,
        }),
        renderNode({
          keyId: "merge-docs",
          title: PT_BR.pipelines.mergeLabel,
          badge: PT_BR.pipelines.mergeBadge,
          help: PT_BR.pipelines.mergeHelp,
          items: recentMerged.filter((i) => classifyLane(i) === "docs"),
        })
      )
    )
  );
}
