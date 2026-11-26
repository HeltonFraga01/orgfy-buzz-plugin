// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/shell/sidebar/sidebar.tsx, sidebar-rail.tsx, sidebar-footer.tsx, project-group.tsx e command-palette.tsx
// Sidebar 1:1 estilo CodeDen com modo recolhível (SidebarRail 54px preservando todas as funções), árvore expansível por empresa, Command Palette (Cmd/Ctrl+K) e integração nativa com APIs e deep links do Buzz.

import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "./buzz-live-telemetry";
import { PT_BR } from "../i18n/pt-BR";

export type FactorySidebarTab =
  | "holding"
  | "inbox"
  | "costs"
  | "automations"
  | "overview"
  | "board"
  | "floor"
  | "agents"
  | "vision"
  | "settings";

export interface SidebarWorkspaceItem {
  slug: string;
  nome: string;
  estagio: string;
  canal: string;
  agentesInfo?: string;
  cooNome?: string;
  cooPubkey?: string;
}

export interface FactorySidebarProps {
  h: any;
  collapsed: boolean;
  onToggleCollapse: () => void;
  paletteOpen: boolean;
  onSetPaletteOpen: (open: boolean) => void;
  tab: FactorySidebarTab;
  onSelectTab: (tab: FactorySidebarTab) => void;
  tenant: string;
  onSelectTenant: (slug: string, targetTab?: FactorySidebarTab) => void;
  workspaces: SidebarWorkspaceItem[];
  expandedProjects: Record<string, boolean>;
  onToggleProject: (slug: string) => void;
  status: FactoryStatusPayload;
  telemetry: BuzzLiveTelemetrySnapshot;
  masterAgentName: string;
  masterAgentPubkey: string;
  masterTurn: LiveAgentTurn | null;
  pendingApprovals: number;
  inboxCount: number;
  urgentInbox: boolean;
  waitingItems: FactoryWorkItem[];
  onOpenMasterDm: () => void;
  onOpenAgentDm: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenChannelInBuzz: (slug?: string) => void;
  onSelectItem: (item: FactoryWorkItem) => void;
  onOpenTurnInSideChat: (turn: LiveAgentTurn) => void;
  onRefresh: () => void;
  onToggleDrain: () => void;
  onToggleKillSwitch: (next: boolean) => void;
  compactDensity: boolean;
  onToggleDensity: () => void;
  liveCrew: Array<{ key: string; pubkey?: string; name: string; model: string; running: boolean }>;
}

const SESSION_LIMIT = 5;

function projectHue(slug: string): number {
  let acc = 0;
  for (let i = 0; i < slug.length; i++) acc += slug.charCodeAt(i);
  return (acc * 29) % 360;
}

function formatShortAge(tsMs?: number | null): string {
  if (!tsMs || tsMs <= 0) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - tsMs) / 60000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

function svgIcon(h: any, paths: string[], size = 14) {
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { flexShrink: 0, display: "block" },
      "aria-hidden": "true",
    },
    paths.map((d, i) => h("path", { key: i, d }))
  );
}

const ICONS = {
  panelClose: (h: any, s = 15) => svgIcon(h, ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18", "M16 15l-3-3 3-3"], s),
  panelOpen: (h: any, s = 15) => svgIcon(h, ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18", "M14 9l3 3-3 3"], s),
  search: (h: any, s = 13) => svgIcon(h, ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"], s),
  bot: (h: any, s = 13) => svgIcon(h, ["M12 8V4H8", "M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M9 13h.01", "M15 13h.01"], s),
  inbox: (h: any, s = 14) => svgIcon(h, ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"], s),
  chart: (h: any, s = 14) => svgIcon(h, ["M3 3v18h18", "M7 16v-4", "M12 16V8", "M17 16v-6"], s),
  board: (h: any, s = 14) => svgIcon(h, ["M12 2 3 7l9 5 9-5-9-5z", "M3 17l9 5 9-5", "M3 12l9 5 9-5"], s),
  chevron: (h: any, s = 12) => svgIcon(h, ["M9 18l6-6-6-6"], s),
  home: (h: any, s = 12) => svgIcon(h, ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"], s),
  external: (h: any, s = 12) => svgIcon(h, ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"], s),
  workflow: (h: any, s = 13) => svgIcon(h, ["M3 3h6v6H3z", "M15 15h6v6h-6z", "M9 6h6a3 3 0 0 1 3 3v6"], s),
  archive: (h: any, s = 13) => svgIcon(h, ["M21 8v13H3V8", "M1 3h22v5H1z", "M10 12h4"], s),
  keyboard: (h: any, s = 14) => svgIcon(h, ["M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z", "M6 10h.01", "M10 10h.01", "M14 10h.01", "M18 10h.01", "M8 14h8"], s),
  sliders: (h: any, s = 14) => svgIcon(h, ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"], s),
  sun: (h: any, s = 14) => svgIcon(h, ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M12 2v2", "M12 20v2", "M4.93 4.93l1.41 1.41", "M17.66 17.66l1.41 1.41", "M2 12h2", "M20 12h2", "M6.34 17.66l-1.41 1.41", "M19.07 4.93l-1.41 1.41"], s),
  settings: (h: any, s = 14) => svgIcon(h, ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"], s),
};

function renderProjectTile(h: any, slug: string, nome: string, size = 18) {
  const hue = projectHue(slug);
  return h(
    "span",
    {
      className: "of-project-tile",
      style: {
        width: `${size}px`,
        height: `${size}px`,
        fontSize: size >= 22 ? "11px" : "9.5px",
        background: `oklch(0.7 0.11 ${hue} / 0.22)`,
        color: `oklch(0.78 0.13 ${hue})`,
      },
      "aria-hidden": "true",
    },
    (nome || slug).charAt(0).toUpperCase()
  );
}

function runnerStatusMeta(status: FactoryStatusPayload): { tone: string; label: string; detail: string } {
  if (status.killSwitch) {
    return { tone: "failed", label: "Kill Switch", detail: status.pausedReason || "Kill switch ativo" };
  }
  if (status.drain) {
    return { tone: "waiting", label: "Drenando", detail: "Modo dreno ativo — aguardando conclusão" };
  }
  if (status.coordenador !== "ativo") {
    return { tone: "failed", label: "Parado", detail: status.pausedReason || "Coordenador parado" };
  }
  return { tone: "done", label: "Pronto", detail: `Coordenador ${status.launchAgent || "ativo"} operacional` };
}

export function renderFactorySidebar(
  props: FactorySidebarProps,
  showAllByProject: Record<string, boolean>,
  onToggleShowAll: (slug: string) => void
) {
  const { h, collapsed } = props;
  const runner = runnerStatusMeta(props.status);
  const globalTabs = new Set<FactorySidebarTab>(["holding", "inbox", "costs", "automations"]);

  const renderFooter = (compact: boolean) =>
    h(
      "div",
      { className: "of-sb-footer", "data-compact": compact ? "true" : "false" },
      !compact
        ? h(
            "div",
            { className: "of-sb-status", title: runner.detail },
            h("span", { className: "of-dot", "data-tone": runner.tone }),
            h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, runner.label)
          )
        : h("span", { className: "of-dot", "data-tone": runner.tone, title: `${runner.label} — ${runner.detail}`, style: { marginBottom: "4px" } }),
      h(
        "button",
        {
          type: "button",
          className: "of-icon-btn",
          title: "Busca e atalhos (⌘K / Ctrl+K)",
          "aria-label": "Busca e atalhos",
          onClick: () => props.onSetPaletteOpen(true),
        },
        ICONS.keyboard(h, 14)
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-icon-btn",
          title: props.compactDensity ? "Densidade padrão" : "Densidade compacta",
          "aria-label": "Alternar densidade visual",
          onClick: props.onToggleDensity,
        },
        ICONS.sun(h, 14)
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-icon-btn",
          title: "Agentes & modelos da empresa",
          "aria-label": "Configuração de agentes",
          onClick: () => props.onSelectTab("agents"),
        },
        ICONS.sliders(h, 14)
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-icon-btn",
          title: "Configurações, Kill Switch e limites",
          "aria-label": "Configurações",
          onClick: () => props.onSelectTab("settings"),
        },
        ICONS.settings(h, 14)
      )
    );

  // ── MODO RECOLHIDO: SidebarRail (54px) preservando 100% das funções ──
  if (collapsed) {
    return h(
      "aside",
      { className: "of-sidebar-rail", "data-sidebar-rail": "true", "aria-label": "Menu lateral recolhido" },
      h(
        "div",
        { className: "of-rail-head", title: PT_BR.appTitle },
        h("span", { className: "of-brand-icon" }, "<>")
      ),
      h(
        "div",
        { className: "of-rail-stack" },
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            title: "Expandir menu lateral (⌘B / Ctrl+B)",
            "aria-label": "Expandir menu lateral",
            onClick: props.onToggleCollapse,
          },
          ICONS.panelOpen(h, 15)
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            title: "Buscar ou executar (⌘K / Ctrl+K)",
            "aria-label": "Buscar ou executar",
            onClick: () => props.onSetPaletteOpen(true),
          },
          ICONS.search(h, 15)
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            title: `Orquestrador · ${props.masterAgentName} (abrir DM lateral)`,
            "aria-label": "Orquestrador",
            onClick: props.onOpenMasterDm,
          },
          h("span", { style: { color: "var(--primary)", display: "inline-flex" } }, ICONS.bot(h, 15)),
          props.masterTurn && h("span", { className: "of-rail-dot", "data-tone": "running" })
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            "data-active": props.tab === "holding" ? "true" : "false",
            title: props.pendingApprovals > 0 ? `Conselho (Board) · ${props.pendingApprovals} pendente(s)` : "Conselho (Board)",
            "aria-label": "Conselho (Board)",
            onClick: () => props.onSelectTab("holding"),
          },
          ICONS.board(h, 15),
          props.pendingApprovals > 0 && h("span", { className: "of-rail-badge" }, String(props.pendingApprovals))
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            "data-active": props.tab === "inbox" ? "true" : "false",
            title: props.inboxCount > 0 ? `Inbox · ${props.inboxCount}` : "Inbox",
            "aria-label": "Inbox",
            onClick: () => props.onSelectTab("inbox"),
          },
          ICONS.inbox(h, 15),
          props.inboxCount > 0 && h("span", { className: "of-rail-badge" }, String(props.inboxCount))
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            "data-active": props.tab === "costs" ? "true" : "false",
            title: "Uso & Custos",
            "aria-label": "Uso & Custos",
            onClick: () => props.onSelectTab("costs"),
          },
          ICONS.chart(h, 15)
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-rail-btn",
            "data-active": props.tab === "automations" ? "true" : "false",
            title: "Automações",
            "aria-label": "Automações",
            onClick: () => props.onSelectTab("automations"),
          },
          ICONS.workflow(h, 15)
        )
      ),
      h("div", { className: "of-rail-divider" }),
      h(
        "div",
        { className: "of-rail-projects" },
        props.workspaces.map((w) => {
          const unread = w.canal ? props.telemetry.unreadByChannel[w.canal] || 0 : 0;
          const isSelected = !globalTabs.has(props.tab) && props.tenant === w.slug;
          return h(
            "button",
            {
              key: w.slug,
              type: "button",
              className: "of-rail-btn",
              "data-active": isSelected ? "true" : "false",
              title: `${w.nome}${unread > 0 ? ` · ${unread} não lida(s)` : ""}`,
              "aria-label": w.nome,
              onClick: () => props.onSelectTenant(w.slug, "overview"),
            },
            renderProjectTile(h, w.slug, w.nome, 24),
            unread > 0 && h("span", { className: "of-rail-dot", "data-tone": "waiting" })
          );
        })
      ),
      renderFooter(true)
    );
  }

  // ── MODO EXPANDIDO: Sidebar 1:1 CodeDen ──
  return h(
    "aside",
    { className: "of-sidebar", "data-sidebar-expanded": "true", "aria-label": "Menu lateral OrgFy Factory" },
    // 1. Header com logo + botão recolher
    h(
      "div",
      { className: "of-brand" },
      h(
        "span",
        { className: "of-brand-mark" },
        h("span", { className: "of-brand-icon" }, "<>"),
        PT_BR.appTitle
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-icon-btn",
          title: "Recolher menu lateral (⌘B / Ctrl+B)",
          "aria-label": "Recolher menu lateral",
          onClick: props.onToggleCollapse,
        },
        ICONS.panelClose(h, 15)
      )
    ),

    // 2. Barra de busca / Command Palette (⌘K)
    h(
      "button",
      {
        type: "button",
        className: "of-sb-search",
        onClick: () => props.onSetPaletteOpen(true),
      },
      ICONS.search(h, 13),
      h("span", { style: { flex: 1, textAlign: "left" } }, "Buscar ou executar…"),
      h("kbd", { className: "of-kbd" }, "⌘K")
    ),

    // 3. Navegação Global (Orquestrador, Conselho, Inbox, Uso & Custos)
    h(
      "nav",
      { className: "of-nav" },
      h(
        "button",
        {
          type: "button",
          className: "of-nav-btn",
          title: `Abrir DM lateral com ${props.masterAgentName} no Buzz`,
          onClick: props.onOpenMasterDm,
        },
        h(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px", minWidth: 0 } },
          h("span", { className: "of-sb-bot-badge" }, ICONS.bot(h, 12)),
          h("span", { style: { fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "Orquestrador")
        ),
        h("span", {
          className: "of-dot",
          "data-tone": props.masterTurn ? "running" : "done",
          title: props.masterTurn ? props.masterTurn.stepLabel : `${props.masterAgentName} online`,
        })
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-nav-btn",
          "data-active": props.tab === "holding" ? "true" : "false",
          onClick: () => props.onSelectTab("holding"),
        },
        h(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
          ICONS.board(h, 14),
          h("span", null, "Conselho (Board)")
        ),
        props.pendingApprovals > 0 && h("span", { className: "of-nav-badge", "data-tone": "warn" }, String(props.pendingApprovals))
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-nav-btn",
          "data-active": props.tab === "inbox" ? "true" : "false",
          onClick: () => props.onSelectTab("inbox"),
        },
        h(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
          ICONS.inbox(h, 14),
          h("span", null, PT_BR.nav.inbox)
        ),
        props.inboxCount > 0 &&
          h("span", { className: "of-nav-badge", "data-tone": props.urgentInbox ? "warn" : undefined }, String(props.inboxCount))
      ),
      h(
        "button",
        {
          type: "button",
          className: "of-nav-btn",
          "data-active": props.tab === "costs" ? "true" : "false",
          onClick: () => props.onSelectTab("costs"),
        },
        h(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
          ICONS.chart(h, 14),
          h("span", null, "Uso & Custos")
        )
      )
    ),

    // 4. Caixa "Aguardando você" (WaitingOnYou do CodeDen)
    props.waitingItems.length > 0 &&
      h(
        "div",
        { className: "of-sb-waiting" },
        h(
          "div",
          { className: "of-sb-waiting-head" },
          h("span", null, "Aguardando você"),
          h("span", { className: "of-num" }, String(props.waitingItems.length))
        ),
        props.waitingItems.slice(0, 4).map((item) =>
          h(
            "button",
            {
              key: item.id,
              type: "button",
              className: "of-sb-child-btn",
              onClick: () => props.onSelectItem(item),
            },
            h("span", { className: "of-dot", "data-tone": item.stage === "failed" ? "failed" : "waiting" }),
            h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, item.title)
          )
        )
      ),

    // 5. Árvore expansível de Projetos / Empresas (scroll interno)
    h(
      "div",
      { className: "of-sb-scroll" },
      h(
        "div",
        { className: "of-sb-section-head" },
        h("span", { className: "of-nav-group-label", style: { padding: 0 } }, "Empresas"),
        h(
          "button",
          {
            type: "button",
            className: "of-icon-btn",
            title: "Abrir canal da empresa ativa no Buzz",
            "aria-label": "Abrir canal no Buzz",
            onClick: () => props.onOpenChannelInBuzz(props.tenant),
          },
          ICONS.external(h, 12)
        )
      ),
      props.workspaces.map((w) => {
        const isOpen = props.expandedProjects[w.slug] ?? w.slug === props.tenant;
        const isSelected = !globalTabs.has(props.tab) && props.tenant === w.slug;
        const unread = w.canal ? props.telemetry.unreadByChannel[w.canal] || 0 : 0;
        const isCurrentTenant = w.slug === props.tenant;

        // Turnos ao vivo da empresa + itens do board quando é o tenant ativo
        const liveTurnsForWorkspace = w.canal
          ? props.telemetry.activeTurns.filter((t) => t.channelId === w.canal)
          : [];
        const boardItemsForWorkspace = isCurrentTenant
          ? [...props.status.inProgress, ...props.status.backlog]
          : [];
        const mergedCount = isCurrentTenant ? props.status.recent.length : 0;
        const showAll = Boolean(showAllByProject[w.slug]);
        const visibleItems = showAll ? boardItemsForWorkspace : boardItemsForWorkspace.slice(0, SESSION_LIMIT);

        const cooName = isCurrentTenant
          ? props.status.tenantManifest?.coo || w.cooNome || "OrgFy Bento"
          : w.cooNome || "OrgFy Bento";
        const cooAgent =
          (isCurrentTenant && props.status.tenantManifest?.agentes.find((a) => a.name.toLowerCase() === cooName.toLowerCase())) ||
          props.liveCrew.find((a) => a.name.toLowerCase() === cooName.toLowerCase()) ||
          null;
        const cooPubkey = (cooAgent && "pubkey" in cooAgent ? cooAgent.pubkey : "") || w.cooPubkey || "";
        const cooTurn = cooPubkey ? props.telemetry.byPubkey[cooPubkey.toLowerCase()] || null : null;

        return h(
          "div",
          { key: w.slug, className: "of-sb-project" },
          h(
            "div",
            { className: "of-sb-project-head", "data-active": isSelected ? "true" : "false" },
            h(
              "button",
              {
                type: "button",
                className: "of-sb-project-toggle",
                "aria-expanded": isOpen ? "true" : "false",
                onClick: () => {
                  props.onToggleProject(w.slug);
                  if (!isSelected) props.onSelectTenant(w.slug, "overview");
                },
              },
              h(
                "span",
                { className: "of-sb-chevron", "data-open": isOpen ? "true" : "false" },
                ICONS.chevron(h, 12)
              ),
              renderProjectTile(h, w.slug, w.nome, 18),
              h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: "12.5px" } }, w.nome)
            ),
            !isOpen && (unread > 0 || liveTurnsForWorkspace.length > 0) &&
              h(
                "span",
                { className: "of-nav-badge", "data-tone": "warn", style: { marginLeft: "auto" } },
                unread > 0 ? String(unread) : `⚡${liveTurnsForWorkspace.length}`
              ),
            h(
              "div",
              { className: "of-sb-project-actions" },
              h(
                "button",
                {
                  type: "button",
                  className: "of-icon-btn",
                  title: `Visão geral de ${w.nome}`,
                  onClick: () => props.onSelectTenant(w.slug, "overview"),
                },
                ICONS.home(h, 12)
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "of-icon-btn",
                  title: `Abrir canal de ${w.nome} no Buzz`,
                  onClick: () => props.onOpenChannelInBuzz(w.slug),
                },
                ICONS.external(h, 12)
              )
            )
          ),

          isOpen &&
            h(
              "div",
              { className: "of-sb-tree" },
              // PM / COO row (igual ao "Project manager [PM] ●" do CodeDen!)
              h(
                "button",
                {
                  type: "button",
                  className: "of-sb-child-btn",
                  title: `Abrir DM lateral com ${cooName} (COO) no Buzz`,
                  onClick: () => props.onOpenAgentDm({ key: cooAgent && "agentKey" in cooAgent ? cooAgent.agentKey : cooAgent?.key, pubkey: cooPubkey, name: cooName }),
                },
                h("span", { style: { color: "var(--primary)", display: "inline-flex" } }, ICONS.bot(h, 13)),
                h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, cooName),
                h("span", { className: "of-sb-pm-pill" }, "COO"),
                h("span", { className: "of-dot", "data-tone": cooTurn ? "running" : "done" })
              ),

              // Turnos ao vivo no Buzz para esta empresa
              liveTurnsForWorkspace.map((turn) =>
                h(
                  "button",
                  {
                    key: `turn-${turn.agentPubkey}-${turn.threadRootId || turn.channelId}`,
                    type: "button",
                    className: "of-sb-child-btn",
                    title: `${turn.agentName}: ${turn.stepLabel} (abrir chat lateral)`,
                    onClick: () => props.onOpenTurnInSideChat(turn),
                  },
                  h("span", { className: "of-dot", "data-tone": turn.state === "error" ? "failed" : "running" }),
                  h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, `${turn.agentName} · ${turn.stepLabel}`),
                  h("span", { className: "of-sb-age" }, "vivo")
                )
              ),

              // Itens ativos do Board da empresa selecionada
              visibleItems.map((item) =>
                h(
                  "button",
                  {
                    key: item.id,
                    type: "button",
                    className: "of-sb-child-btn",
                    title: `${item.title} (${item.stage})`,
                    onClick: () => props.onSelectItem(item),
                  },
                  h("span", {
                    className: "of-dot",
                    "data-tone":
                      item.stage === "failed"
                        ? "failed"
                        : item.stage === "escalated"
                        ? "waiting"
                        : item.stage === "building" || item.stage === "verifying"
                        ? "running"
                        : "idle",
                  }),
                  h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, item.title),
                  item.updatedAt && h("span", { className: "of-sb-age" }, formatShortAge(item.updatedAt))
                )
              ),

              boardItemsForWorkspace.length > SESSION_LIMIT &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-sb-child-btn of-muted",
                    onClick: () => onToggleShowAll(w.slug),
                  },
                  showAll ? "Mostrar menos" : `Mostrar mais ${boardItemsForWorkspace.length - SESSION_LIMIT}`
                ),

              // Automações da empresa
              h(
                "button",
                {
                  type: "button",
                  className: "of-sb-child-btn",
                  onClick: () => props.onSelectTab("automations"),
                },
                ICONS.workflow(h, 13),
                h("span", { style: { flex: 1 } }, "Automações"),
                h("span", { className: "of-sb-age" }, w.slug === "orgfy" ? "2 on ›" : "0 on ›")
              ),

              // Concluídos / Arquivados
              mergedCount > 0 &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-sb-child-btn of-muted",
                    onClick: () => props.onSelectTenant(w.slug, "board"),
                  },
                  ICONS.archive(h, 13),
                  h("span", null, `${mergedCount} concluídos`)
                )
            )
        );
      })
    ),

    // 6. Footer fixo
    renderFooter(false)
  );
}

export function renderCommandPalette(
  props: FactorySidebarProps,
  query: string,
  onQueryChange: (q: string) => void
) {
  const { h } = props;
  if (!props.paletteOpen) return null;

  const q = query.trim().toLowerCase();
  const entries: Array<{ id: string; group: string; label: string; hint?: string; run: () => void }> = [
    { id: "act-master", group: "Orquestração", label: `DM lateral com ${props.masterAgentName} (Orquestrador)`, hint: "Buzz DM", run: props.onOpenMasterDm },
    { id: "act-collapse", group: "Interface", label: props.collapsed ? "Expandir menu lateral" : "Recolher menu lateral", hint: "⌘B", run: props.onToggleCollapse },
    { id: "act-channel", group: "Buzz", label: `Abrir canal de ${props.tenant} no Buzz`, hint: "Deep link", run: () => props.onOpenChannelInBuzz(props.tenant) },
    { id: "act-refresh", group: "Fábrica", label: "Atualizar snapshot da fábrica agora", hint: "Refresh", run: props.onRefresh },
    { id: "act-drain", group: "Controles", label: props.status.drain ? "Cancelar modo Dreno" : "Ativar modo Dreno", hint: "Drain", run: props.onToggleDrain },
    { id: "act-kill", group: "Controles", label: props.status.killSwitch ? "Liberar Kill Switch" : "Acionar Kill Switch imediatamente", hint: "P0", run: () => props.onToggleKillSwitch(!props.status.killSwitch) },
    { id: "nav-holding", group: "Navegação", label: "Conselho (Board da Holding)", run: () => props.onSelectTab("holding") },
    { id: "nav-inbox", group: "Navegação", label: "Inbox de alertas e aprovações", run: () => props.onSelectTab("inbox") },
    { id: "nav-costs", group: "Navegação", label: "Uso & Custos", run: () => props.onSelectTab("costs") },
    { id: "nav-board", group: "Navegação", label: "Fábrica · Board", run: () => props.onSelectTab("board") },
    { id: "nav-floor", group: "Navegação", label: "Andar 3D", run: () => props.onSelectTab("floor") },
    { id: "nav-agents", group: "Navegação", label: "Agentes & Modelos", run: () => props.onSelectTab("agents") },
    { id: "nav-settings", group: "Navegação", label: "Configurações", run: () => props.onSelectTab("settings") },
    ...props.workspaces.map((w) => ({
      id: `ws-${w.slug}`,
      group: "Empresas",
      label: `Ir para ${w.nome}`,
      hint: w.slug,
      run: () => props.onSelectTenant(w.slug, "overview"),
    })),
    ...props.liveCrew.slice(0, 20).map((a) => ({
      id: `ag-${a.key}`,
      group: "Agentes (DM Buzz)",
      label: `Conversar com ${a.name}`,
      hint: a.model,
      run: () => props.onOpenAgentDm(a),
    })),
  ];

  const filtered = q
    ? entries.filter((e) => e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q) || (e.hint || "").toLowerCase().includes(q))
    : entries.slice(0, 14);

  return h(
    "div",
    {
      className: "of-palette-backdrop",
      onClick: () => props.onSetPaletteOpen(false),
    },
    h(
      "div",
      {
        className: "of-palette-box",
        onClick: (e: any) => e.stopPropagation(),
      },
      h(
        "div",
        { className: "of-palette-head" },
        ICONS.search(h, 14),
        h("input", {
          type: "text",
          autoFocus: true,
          className: "of-palette-input",
          placeholder: "Buscar empresa, agente, aba ou comando…",
          value: query,
          onChange: (e: any) => onQueryChange(e.target.value),
          onKeyDown: (e: any) => {
            if (e.key === "Escape") props.onSetPaletteOpen(false);
            if (e.key === "Enter" && filtered[0]) {
              filtered[0].run();
              props.onSetPaletteOpen(false);
            }
          },
        }),
        h("kbd", { className: "of-kbd" }, "ESC")
      ),
      h(
        "div",
        { className: "of-palette-list" },
        filtered.length === 0
          ? h("div", { className: "of-muted", style: { padding: "16px", textAlign: "center" } }, "Nenhum resultado.")
          : filtered.map((e) =>
              h(
                "button",
                {
                  key: e.id,
                  type: "button",
                  className: "of-palette-row",
                  onClick: () => {
                    e.run();
                    props.onSetPaletteOpen(false);
                  },
                },
                h("span", { className: "of-palette-group" }, e.group),
                h("span", { style: { flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.label),
                e.hint && h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px" } }, e.hint)
              )
            )
      )
    )
  );
}
