// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory/pipeline-diagram.tsx
// Diagrama de Pipelines ao vivo fiel ao CodeDen: Oráculo -> Issue -> Identificar tipo -> Fan -> Bug / Feature / Docs (L-01 mantido!) -> Fan -> Merge.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import { PT_BR } from "../i18n/pt-BR";

export interface PipelineDiagramProps {
  h: any;
  status: FactoryStatusPayload;
  isBoardTenant?: boolean;
  activeHelpKey: string | null;
  onToggleHelp: (key: string | null) => void;
  onSelectItem: (item: FactoryWorkItem) => void;
}

const MAX_CHIPS = 4;

function classifyLane(item: FactoryWorkItem): "bug" | "feature" | "docs" {
  if (item.type === "bug" || item.type === "feature" || item.type === "docs") return item.type;
  const t = `${item.title} ${item.workKey}`.toLowerCase();
  if (t.includes("fix") || t.includes("bug") || t.includes("hotfix")) return "bug";
  if (t.includes("doc") || t.includes("readme") || t.includes("prd")) return "docs";
  return "feature";
}

function bucketStep(item: FactoryWorkItem, lane: "bug" | "feature" | "docs"): string {
  const st = String(item.step || item.stage || "").toLowerCase();
  if (item.stage === "merged" || st === "merge") return "merge";
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

function toneOfItem(item: FactoryWorkItem): "running" | "waiting" | "done" | "failed" | "idle" {
  const stageStr = String(item.stage || "");
  if (stageStr === "failed" || stageStr === "reverted") return "failed";
  if (stageStr === "escalated" || stageStr === "verifying") return "waiting";
  if (stageStr === "building" || stageStr === "in_progress" || stageStr === "watching") return "running";
  if (stageStr === "merged") return "done";
  return "idle";
}

export function renderPipelineDiagram(props: PipelineDiagramProps) {
  const { h, status, activeHelpKey, onToggleHelp, onSelectItem } = props;
  const live = [
    ...status.backlog,
    ...status.inProgress,
    ...status.recent.filter((w) => w.stage === "escalated"),
  ];
  const mergeItems = live.filter((w) => w.step === "merge" || w.stage === "watching");

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

  const revising = (lane: "bug" | "feature") =>
    live.filter((w) => classifyLane(w) === lane && (w.attempts || 0) > 1).length;

  const Arrow = (dashed = false) =>
    h(
      "span",
      { className: "of-pd-arrow", "aria-hidden": "true" },
      h("span", { className: "of-pd-arrow-line", "data-dashed": dashed ? "true" : "false" }),
      h("span", { style: { fontSize: "10px", marginLeft: "-3px" } }, "›")
    );

  const Fan = (side: "out" | "in") =>
    h(
      "div",
      { className: "of-pd-fan", "aria-hidden": "true" },
      h("span", { className: "of-pd-fan-spine" }),
      h("span", {
        className: "of-pd-fan-stem",
        style: side === "out" ? { left: 0 } : { right: 0 },
      }),
      [0, 1, 2].map((idx) =>
        h(
          "span",
          { key: idx, style: { position: "relative" } },
          h("span", {
            className: "of-pd-fan-stem",
            style: side === "out" ? { right: 0 } : { left: 0 },
          })
        )
      )
    );

  const Node = (opts: {
    keyId: string;
    kind: string;
    badge: string;
    title: string;
    help: string;
    items: FactoryWorkItem[];
    queued?: FactoryWorkItem[];
    width?: string;
    footer?: any;
  }) => {
    const queued = opts.queued || [];
    const shown = [...opts.items, ...queued];
    const extra = shown.length - MAX_CHIPS;
    const isActive = opts.items.length > 0;
    const isHelpOpen = activeHelpKey === opts.keyId;

    return h(
      "div",
      {
        key: opts.keyId,
        className: "of-pd-node",
        "data-active": isActive ? "true" : "false",
        style: opts.width ? { width: opts.width, flex: "0 0 auto" } : undefined,
      },
      h("span", { className: "of-pd-badge", "data-kind": opts.kind }, opts.badge),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" } },
        h("span", { style: { fontSize: "11.5px", fontWeight: 600, lineHeight: 1.2 } }, opts.title),
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
      ),
      isHelpOpen && h("div", { className: "of-help-pop" }, opts.help),
      shown.length > 0 &&
        h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px", width: "100%" } },
          opts.items.slice(0, MAX_CHIPS).map((w) => {
            const alert = w.stage === "escalated" || w.stage === "failed" || w.stage === "reverted";
            return h(
              "button",
              {
                key: `${opts.keyId}-${w.id}`,
                type: "button",
                className: "of-chip",
                "data-alert": alert ? "true" : "false",
                title: `${w.title}\nEtapa: ${w.stage}${w.attempts > 1 ? `\nRefazer rodada ${w.attempts}` : ""}\nClique para abrir o card/sessão`,
                onClick: () => onSelectItem(w),
              },
              alert ? h("span", null, "⚠") : h("span", { className: "of-dot", "data-tone": toneOfItem(w) }),
              h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, `#${w.id.slice(0, 8)}`),
              w.attempts > 1 && h("span", { style: { opacity: 0.75 } }, `↻${w.attempts}`)
            );
          }),
          queued.slice(0, Math.max(0, MAX_CHIPS - opts.items.length)).map((w) =>
            h(
              "button",
              {
                key: `${opts.keyId}-q-${w.id}`,
                type: "button",
                className: "of-chip",
                "data-queued": "true",
                title: `${w.title}\nNa fila aguardando agente livre`,
                onClick: () => onSelectItem(w),
              },
              h("span", { className: "of-dot", "data-tone": "idle" }),
              h("span", null, `#${w.id.slice(0, 8)}`)
            )
          ),
          extra > 0 && h("span", { className: "of-muted", style: { fontSize: "10px" } }, `+${extra}`)
        ),
      opts.footer
    );
  };

  const Lane = (laneKey: "bug" | "feature" | "docs", title: string, help: string, children: any[]) =>
    h(
      "div",
      { key: laneKey, className: "of-pd-lane" },
      h(
        "span",
        { className: "of-pd-lane-tag" },
        title,
        h(
          "button",
          {
            type: "button",
            className: "of-help-btn",
            title: help,
            onClick: () => onToggleHelp(activeHelpKey === `lane-${laneKey}` ? null : `lane-${laneKey}`),
          },
          "?"
        )
      ),
      ...children
    );

  const RevisePill = (count: number) =>
    h(
      "span",
      {
        className: "of-pd-revise",
        "data-active": count > 0 ? "true" : "false",
        title: PT_BR.pipelines.reviseHelp,
      },
      `↻ ${PT_BR.pipelines.reviseLabel}${count > 0 ? ` · ${count}` : ""}`
    );

  const ignored = status.ignored.length;
  const held = status.held.length;
  const isDark = status.mode === "dark_factory";

  if (props.isBoardTenant) {
    return h(
      "div",
      { className: "of-pd-scroll", "data-council-pipeline": "true" },
      h(
        "div",
        { className: "of-pd-canvas" },
        h(
          "div",
          { className: "of-pd-group" },
          Node({
            keyId: "board-subsidiary",
            kind: "agent",
            badge: "Subsidiária",
            title: "COO → CEO",
            help: "O COO/PM só escala ao CEO da empresa com permissão; o CEO só abre pauta no Conselho quando excede a alçada local.",
            items: [],
            width: "116px",
            footer: h("span", { className: "of-muted", style: { fontSize: "10px" } }, "com permissão"),
          }),
          Arrow(true),
          Node({
            keyId: "board-agenda",
            kind: "human",
            badge: "Conselho",
            title: "Pauta & Escopo",
            help: "Pautas de orçamento, risco, arquitetura, produto ou novas subsidiárias que sobem ao Conselho.",
            items: [],
            queued: status.backlog.slice(0, 3),
            width: "118px",
            footer: h("span", { className: "of-muted", style: { fontSize: "10px" } }, "alçada Holding"),
          }),
          Arrow(true),
          Node({
            keyId: "board-triage",
            kind: "llm",
            badge: "Bestie",
            title: "Triagem Iris",
            help: "OrgFy Iris (Bestie) distribui a pauta para o comitê técnico competente do Conselho.",
            items: status.backlog.filter((i) => i.step === "intake"),
            width: "118px",
          })
        ),

        Fan("out"),

        h(
          "div",
          { className: "of-pd-lanes" },
          Lane(
            "bug",
            "ESTRATÉGIA & PRODUTO",
            "Comitês CPO (Produto & Portfólio) e CTO (Arquitetura) avaliam impacto no ecossistema da Holding.",
            [
              Node({
                keyId: "board-cpo",
                kind: "agent",
                badge: "CPO",
                title: "Portfólio",
                help: "Avalia roadmap, sinergia entre subsidiárias e prioridade de produto.",
                items: laneBuckets.reproduce,
              }),
              Arrow(false),
              Node({
                keyId: "board-cto",
                kind: "workspace",
                badge: "CTO",
                title: "Arquitetura",
                help: "Valida fronteiras técnicas, contratos compartilhados e viabilidade.",
                items: laneBuckets.fix,
              }),
              Arrow(false),
              Node({
                keyId: "board-quorum-prod",
                kind: "workspace",
                badge: "CRDT",
                title: "Quorum",
                help: "Votação colegiada registrada em ata CRDT do Conselho.",
                items: laneBuckets.review_bug,
              }),
            ]
          ),
          Lane(
            "feature",
            "FINANCEIRO & FINOPS",
            "Comitê CFO (OrgFy Iris) valida orçamento, CPI/EVM, teto diário de tokens e retorno.",
            [
              Node({
                keyId: "board-cfo",
                kind: "agent",
                badge: "CFO",
                title: "Orçamento EVM",
                help: "Audita budget diário, custo por card e alocação entre empresas.",
                items: laneBuckets.analyze,
              }),
              Arrow(false),
              Node({
                keyId: "board-coo",
                kind: "workspace",
                badge: "COO / CGO",
                title: "Operação",
                help: "Confirma capacidade da fábrica e impacto em distribuição/growth.",
                items: laneBuckets.implement,
              }),
              Arrow(false),
              Node({
                keyId: "board-quorum-fin",
                kind: "workspace",
                badge: "CRDT",
                title: "Quorum",
                help: "Aprovação orçamentária registrada no CRDT.",
                items: laneBuckets.review_feature,
              }),
            ]
          ),
          Lane(
            "docs",
            "RISCO & COMPLIANCE",
            "Comitê CRO (OrgFy Vera) audita matérias reservadas, segurança, L-01 e alçadas.",
            [
              Node({
                keyId: "board-cro",
                kind: "workspace",
                badge: "CRO",
                title: "Auditoria",
                help: "Verifica invariantes L-01/L-22, segurança e riscos regulatórios.",
                items: laneBuckets.implement_docs,
              }),
              Arrow(false),
              Node({
                keyId: "board-alcadas",
                kind: "checks",
                badge: "Alçadas",
                title: "Checagem",
                help: "Confirma se a decisão cabe no Conselho ou exige aprovação do Acionista.",
                items: laneBuckets.checks,
              }),
              Arrow(false),
              Node({
                keyId: "board-quorum-risk",
                kind: "workspace",
                badge: "CRDT",
                title: "Quorum",
                help: "Emissão de parecer final de compliance.",
                items: laneBuckets.review_docs,
              }),
            ]
          )
        ),

        Fan("in"),

        h(
          "div",
          { className: "of-pd-group" },
          Node({
            keyId: "board-dispatch",
            kind: "human",
            badge: "Despacho / Bestie",
            title: "Decisão Final",
            help: "Dentro da alçada: volta ao CEO/COO da subsidiária. Acima da alçada: somente a Bestie (OrgFy Iris) envia DM/Question Card ao Fundador.",
            items: mergeItems,
            width: "134px",
            footer: h(
              "span",
              { className: "of-muted", style: { fontSize: "10px" } },
              "Subsidiária ou Iris → DM"
            ),
          })
        )
      )
    );
  }

  return h(
    "div",
    { className: "of-pd-scroll" },
    h(
      "div",
      { className: "of-pd-canvas" },
      // Entrada: Oráculo (em Dark Factory ou sempre visível como Scout) ⇢ Issue ⇢ Identificar tipo
      h(
        "div",
        { className: "of-pd-group" },
        Node({
          keyId: "scout",
          kind: "agent",
          badge: PT_BR.pipelines.scoutBadge,
          title: PT_BR.pipelines.scoutLabel,
          help: PT_BR.pipelines.scoutHelp,
          items: [],
          width: "112px",
          footer: h(
            "span",
            { className: "of-muted", style: { fontSize: "10px" } },
            isDark ? "agendado" : "sob demanda"
          ),
        }),
        Arrow(true),
        Node({
          keyId: "issue",
          kind: "human",
          badge: PT_BR.pipelines.issueBadge,
          title: PT_BR.pipelines.issueLabel,
          help: PT_BR.pipelines.issueHelp,
          items: [],
          queued: status.backlog.slice(0, 3),
          width: "116px",
          footer: h(
            "div",
            { style: { display: "flex", flexDirection: "column", alignItems: "center", fontSize: "10px" } },
            h(
              "span",
              { style: { color: ignored > 0 ? "var(--status-waiting)" : "var(--muted-foreground)" } },
              ignored > 0 ? `${ignored} ignoradas` : "autores confiáveis"
            ),
            held > 0 && h("span", { className: "of-muted", style: { fontSize: "10px" } }, `${held} retidas`)
          ),
        }),
        Arrow(true),
        Node({
          keyId: "classify",
          kind: "llm",
          badge: PT_BR.pipelines.classifyBadge,
          title: PT_BR.pipelines.classifyLabel,
          help: PT_BR.pipelines.classifyHelp,
          items: status.backlog.filter((i) => i.step === "intake"),
          width: "118px",
        })
      ),

      Fan("out"),

      // 3 Raias Listradas: Bug, Feature, Documentação (Revisor L-01 mantido!)
      h(
        "div",
        { className: "of-pd-lanes" },
        Lane(
          "bug",
          PT_BR.pipelines.lanes.bug.title,
          "Bugs são reproduzidos com teste falhando (L-22) antes da correção e revisão independente (L-01).",
          [
            Node({
              keyId: "bug-reproduce",
              kind: "workspace",
              badge: "Worktree",
              title: PT_BR.pipelines.lanes.bug.steps[0].label,
              help: PT_BR.pipelines.lanes.bug.steps[0].help,
              items: laneBuckets.reproduce,
            }),
            Arrow(false),
            Node({
              keyId: "bug-fix",
              kind: "workspace",
              badge: "Worktree",
              title: PT_BR.pipelines.lanes.bug.steps[1].label,
              help: PT_BR.pipelines.lanes.bug.steps[1].help,
              items: laneBuckets.fix,
            }),
            Arrow(false),
            h(
              "div",
              { style: { position: "relative", display: "flex", flex: 1, minWidth: 0 } },
              Node({
                keyId: "bug-review",
                kind: "workspace",
                badge: "Revisor L-01",
                title: PT_BR.pipelines.lanes.bug.steps[2].label,
                help: PT_BR.pipelines.lanes.bug.steps[2].help,
                items: laneBuckets.review_bug,
              }),
              RevisePill(revising("bug"))
            ),
          ]
        ),

        Lane(
          "feature",
          PT_BR.pipelines.lanes.feature.title,
          "Features passam por análise/spec, implementação TDD em worktree isolada e revisão independente (L-01).",
          [
            Node({
              keyId: "feat-analyze",
              kind: "agent",
              badge: "Agente",
              title: PT_BR.pipelines.lanes.feature.steps[0].label,
              help: PT_BR.pipelines.lanes.feature.steps[0].help,
              items: laneBuckets.analyze,
            }),
            Arrow(false),
            Node({
              keyId: "feat-implement",
              kind: "workspace",
              badge: "Worktree",
              title: PT_BR.pipelines.lanes.feature.steps[1].label,
              help: PT_BR.pipelines.lanes.feature.steps[1].help,
              items: laneBuckets.implement,
            }),
            Arrow(false),
            h(
              "div",
              { style: { position: "relative", display: "flex", flex: 1, minWidth: 0 } },
              Node({
                keyId: "feat-review",
                kind: "workspace",
                badge: "Revisor L-01",
                title: PT_BR.pipelines.lanes.feature.steps[2].label,
                help: PT_BR.pipelines.lanes.feature.steps[2].help,
                items: laneBuckets.review_feature,
              }),
              RevisePill(revising("feature"))
            ),
          ]
        ),

        Lane(
          "docs",
          PT_BR.pipelines.lanes.docs.title,
          "Documentação roda CI (ci.sh) e mantém revisão independente L-01 (decisão do Helton).",
          [
            Node({
              keyId: "docs-impl",
              kind: "workspace",
              badge: "Worktree",
              title: PT_BR.pipelines.lanes.docs.steps[0].label,
              help: PT_BR.pipelines.lanes.docs.steps[0].help,
              items: laneBuckets.implement_docs,
            }),
            Arrow(false),
            Node({
              keyId: "docs-checks",
              kind: "checks",
              badge: "CI",
              title: PT_BR.pipelines.lanes.docs.steps[1].label,
              help: PT_BR.pipelines.lanes.docs.steps[1].help,
              items: laneBuckets.checks,
            }),
            Arrow(false),
            Node({
              keyId: "docs-review",
              kind: "workspace",
              badge: "Revisor L-01",
              title: PT_BR.pipelines.lanes.docs.steps[2].label,
              help: PT_BR.pipelines.lanes.docs.steps[2].help,
              items: laneBuckets.review_docs,
            }),
          ]
        )
      ),

      Fan("in"),

      // Merge
      h(
        "div",
        { className: "of-pd-group" },
        Node({
          keyId: "merge",
          kind: status.limits.autoMerge ? "auto" : "human",
          badge: status.limits.autoMerge ? "Auto-merge" : "Humano",
          title: PT_BR.pipelines.mergeLabel,
          help: PT_BR.pipelines.mergeHelp,
          items: mergeItems,
          width: "126px",
          footer: h(
            "span",
            { className: "of-muted", style: { fontSize: "10px" } },
            mergeItems.length > 0
              ? status.limits.autoMerge
                ? "quando checks passam"
                : "pronto para GATE"
              : "fila de merge vazia"
          ),
        })
      )
    )
  );
}
