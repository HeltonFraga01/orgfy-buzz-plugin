// Adaptado de CodeDen (MIT) commit b0b2a5a: PM Chat status updates card (Print 4)
// Feed colapsável "Status enviado ao COO · N updates" com merges, falhas, pausas e deep links diretos.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import { getOrgfyPipelineEvents } from "../services/presence-dispatcher";

export interface CooUpdateEntry {
  id: string;
  kind: "merged" | "failed" | "paused" | "event";
  badge: string;
  title: string;
  subtitle?: string;
  item?: FactoryWorkItem;
}

export function buildCooUpdatesFeed(status: FactoryStatusPayload, tenant: string): CooUpdateEntry[] {
  const entries: CooUpdateEntry[] = [];

  if (status.killSwitch) {
    entries.push({
      id: "kill-switch-active",
      kind: "paused",
      badge: "Fábrica",
      title: "Loop da fábrica pausado (Kill Switch ativo)",
      subtitle: status.pausedReason || "Aguardando retomada manual",
    });
  } else if (status.drain) {
    entries.push({
      id: "drain-active",
      kind: "paused",
      badge: "Fábrica",
      title: "Modo Dreno ativo",
      subtitle: `${status.drain.inFlight} item(ns) finalizando antes de pausar`,
    });
  }

  for (const item of [...status.inProgress, ...status.recent]) {
    if (item.stage === "failed" || item.stage === "reverted") {
      entries.push({
        id: `fail-${item.id}`,
        kind: "failed",
        badge: "Falha",
        title: `Item falhou: ${item.title}`,
        subtitle: item.reason || item.note || undefined,
        item,
      });
    } else if (item.stage === "merged") {
      entries.push({
        id: `merge-${item.id}`,
        kind: "merged",
        badge: "Integrado",
        title: `Integrado na main: ${item.title}`,
        subtitle: item.note || `#${item.id.slice(0, 8)}`,
        item,
      });
    }
  }

  for (const ev of getOrgfyPipelineEvents(10)) {
    if (ev.empresa && ev.empresa !== tenant) continue;
    entries.push({
      id: `ev-${ev.id}`,
      kind: ev.type.includes("failed") || ev.type.includes("loop") ? "failed" : "event",
      badge: ev.type,
      title: ev.summary || ev.type,
      subtitle: ev.issueId ? `#${ev.issueId.slice(0, 8)}` : undefined,
    });
  }

  return entries.slice(0, 8);
}

export function renderCooUpdatesFeedCard(props: {
  h: any;
  tenant: string;
  status: FactoryStatusPayload;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectItem: (item: FactoryWorkItem) => void;
  onSendUpdatesToCoo: (entries: CooUpdateEntry[]) => void;
  sending?: boolean;
}) {
  const { h, tenant, status, expanded, onToggleExpanded, onSelectItem, onSendUpdatesToCoo, sending } = props;
  const entries = buildCooUpdatesFeed(status, tenant);
  if (entries.length === 0) return null;

  return h(
    "section",
    {
      "data-coo-updates-feed": "true",
      className: "of-card",
      style: { borderColor: "var(--border)" },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "8px 12px",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
        },
      },
      h(
        "button",
        {
          type: "button",
          onClick: onToggleExpanded,
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "transparent",
            border: "none",
            color: "var(--foreground)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
          },
        },
        h("span", { className: "of-dot", "data-tone": entries.some((e) => e.kind === "failed" || e.kind === "paused") ? "waiting" : "done" }),
        h("span", null, `Status para o COO · ${entries.length} update${entries.length > 1 ? "s" : ""}`),
        h("span", { className: "of-muted", style: { fontSize: "11px" } }, expanded ? "▾" : "▸")
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-btn",
          disabled: sending,
          style: { padding: "3px 9px", fontSize: "11px" },
          onClick: () => onSendUpdatesToCoo(entries),
        },
        sending ? "Enviando..." : "Enviar ao COO ↗"
      )
    ),
    expanded &&
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        entries.map((entry, idx) =>
          h(
            "div",
            {
              key: entry.id,
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "8px 12px",
                borderTop: idx > 0 ? "1px solid var(--border)" : "none",
                fontSize: "12px",
              },
            },
            h(
              "div",
              { style: { minWidth: 0, flex: 1 } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "10.5px", marginBottom: "2px" } },
                h(
                  "span",
                  {
                    className: "of-pill",
                    "data-tone": entry.kind === "merged" ? "done" : entry.kind === "failed" ? "failed" : "waiting",
                    style: { padding: "0 6px", fontSize: "9.5px" },
                  },
                  entry.badge
                ),
                h("span", { className: "of-mono of-muted" }, tenant)
              ),
              h("div", { style: { fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, entry.title),
              entry.subtitle && h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "1px" } }, entry.subtitle)
            ),
            entry.item &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  style: { padding: "2px 7px", fontSize: "11px", color: "var(--primary)", flexShrink: 0 },
                  onClick: () => onSelectItem(entry.item!),
                },
                `#${entry.item.id.slice(0, 6)} ↗`
              )
          )
        )
      )
  );
}
