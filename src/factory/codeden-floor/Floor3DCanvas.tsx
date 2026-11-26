// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/floor/floor-scene.tsx, roster.tsx, cards.tsx
// Componente React que monta o motor 3D Three.js oficial do CodeDen (Workshop + Lookout isométrico) 1:1 isolado por empresa do OrgFy.

import type { Context } from "@buzz/author";
import type { FactoryStatusPayload, FactoryWorkItem as OrgfyWorkItem } from "../factory-adapter";
import type { BuzzLiveTelemetrySnapshot } from "../buzz-live-telemetry";
import type { LiveCrewAgent } from "../FactoryBoardAndFloor";
import {
  DISCOVERY_AREAS,
  type FactoryStatus,
  type FactoryWorkItem,
  type SessionInfo,
  type ViewCard,
  type ViewPipeline,
  type ViewStageId,
} from "./contracts-shim";
import { workshopLayout, type WorkshopLayout } from "./scene/layout";
import { lookoutLayout } from "./scene/lookout";
import { sceneOf, sceneSummary } from "./scene/scene-model";
import type { SceneAgent } from "./scene/agents";
import { NO_SEATING, type Seating } from "./scene/seating";
import type { StoreyFocus } from "./scene/storeys";
import { readPalette } from "./floor/palette";
import { FloorStage } from "./floor/stage";

function toCodeDenStage(item: OrgfyWorkItem): ViewStageId {
  if (item.stage === "merged") return "merged";
  if (item.step === "merge" || item.stage === "watching") return "merge";
  if (item.stage === "verifying" || String(item.step).includes("review")) return "reviewing";
  if (item.stage === "building") return "building";
  if (item.stage === "candidate" || item.step === "intake") return "type";
  return "intake";
}

function adaptStatusFor3D(
  status: FactoryStatusPayload,
  liveCrew: LiveCrewAgent[],
): {
  f: FactoryStatus;
  pipeline: ViewPipeline;
  sessions: Map<string, SessionInfo>;
  pmSessionId: string | null;
} {
  const sessions = new Map<string, SessionInfo>();
  let pmSessionId: string | null = null;
  let scoutSessionId: string | null = null;

  // Usa preferencialmente os agentes reais DAQUELA empresa (empresas/<tenant>.json × Buzz)
  const tenantAgents = status.tenantManifest?.agentes || [];
  const pool =
    tenantAgents.length > 0
      ? tenantAgents.map((a) => ({
          key: a.agentKey,
          name: a.name,
          model: a.model,
          provider: a.provider,
          running: a.running,
          papel: a.papel,
        }))
      : liveCrew.map((a) => ({ ...a, papel: "" }));

  for (const agent of pool) {
    const sid = agent.key;
    const isPm = agent.papel === "coo" || agent.papel === "ceo_empresa" || /bento|iris|coo|ceo|pm/i.test(agent.name);
    const isScout = agent.papel === "oraculo" || /oraculo|oráculo|scout/i.test(agent.name);
    if (isPm && !pmSessionId) pmSessionId = sid;
    if (isScout && !scoutSessionId) scoutSessionId = sid;
    sessions.set(sid, {
      status: agent.running ? "running" : "idle",
      progress: agent.running ? `Executando (${agent.model})` : "Aguardando",
      progressAt: new Date().toISOString(),
      provider: agent.provider || "claude",
      providerId: agent.provider || "claude",
      model: agent.model || null,
      workKey: null,
    });
  }

  const mapItem = (w: OrgfyWorkItem): FactoryWorkItem => ({
    id: w.id,
    title: w.title,
    workKey: w.workKey,
    stage: w.stage,
    step: (w.step as any) || "implement",
    type: w.type,
    attempts: w.attempts || 0,
    sessionId: w.sessionId,
    activeSessionId: w.activeSessionId,
    reason: w.reason,
    note: w.note,
    updatedAt: w.updatedAt || Date.now(),
  });

  const backlog = status.backlog.map(mapItem);
  const inProgress = status.inProgress.map(mapItem);
  const recent = status.recent.map(mapItem);
  const allOrgfy = [...status.backlog, ...status.inProgress, ...status.recent];

  const stages: Record<ViewStageId, ViewCard[]> = {
    intake: [],
    type: [],
    building: [],
    reviewing: [],
    merge: [],
    merged: [],
  };
  const needsYou: ViewCard[] = [];

  for (const raw of allOrgfy) {
    const item = mapItem(raw);
    const place = toCodeDenStage(raw);
    const isFailed = raw.stage === "failed" || raw.stage === "reverted";
    const isPerson = raw.stage === "escalated";
    const card: ViewCard = {
      item,
      place: isFailed || isPerson ? "needs_you" : place,
      state: isFailed ? "failed" : isPerson ? "person" : raw.stage === "building" || raw.stage === "verifying" ? "running" : "idle",
      need: isFailed
        ? { kind: "retry", label: "Retry" }
        : isPerson
        ? { kind: "merge", label: "Review & merge" }
        : null,
      activity: raw.note || raw.reason || raw.step || raw.stage,
      since: new Date(raw.updatedAt || Date.now()).toISOString(),
      pr: null,
      session: raw.activeSessionId ? sessions.get(raw.activeSessionId) ?? null : null,
      sessionId: raw.activeSessionId || raw.sessionId || null,
    };
    if (isFailed || isPerson) {
      needsYou.push(card);
    } else {
      stages[place].push(card);
    }
  }

  const f: FactoryStatus = {
    projectId: status.projectId,
    mode: "dark_factory",
    experimental: status.experimental,
    loopState: status.loopState,
    pausedReason: status.pausedReason,
    killSwitch: status.killSwitch,
    globalKillSwitch: status.globalKillSwitch,
    drain: status.drain,
    limits: {
      ...status.limits,
      maxConcurrentSessions: Math.max(4, status.limits.maxConcurrentSessions || 4),
    },
    spendToday: status.spendToday,
    mergesToday: status.mergesToday,
    stats: status.stats,
    consecutiveFailures: status.consecutiveFailures,
    activeSessions: status.activeSessions,
    wip: status.wip,
    backlog,
    inProgress,
    pullRequests: [],
    recent,
    viewRecent: recent,
    ignored: status.ignored.map(mapItem),
    held: [],
    scout: {
      sessionId: scoutSessionId,
      phase: status.loopState === "discovering" ? "reviewing" : "idle",
      rounds: 2,
      lenses: DISCOVERY_AREAS.map((area) => ({
        area,
        sessionId: `scout-${status.projectId}-${area}`,
        status: status.loopState === "discovering" ? "running" : "idle",
        active: status.loopState === "discovering",
        reported: false,
      })),
      provider: "claude",
      model: "claude-sonnet-4-6",
      lastRoundAt: null,
    },
  };

  return {
    f,
    pipeline: {
      stages,
      needsYou,
      needsPerson: needsYou.length,
      failed: needsYou.filter((c) => c.state === "failed").length,
    },
    sessions,
    pmSessionId,
  };
}

export interface Floor3DProps {
  tenant: string;
  status: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  focus: StoreyFocus;
  onSelectItem: (item: OrgfyWorkItem) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenAgentProfile?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
}

function formatElapsedStep(tsMs?: number | string | null): string {
  if (!tsMs) return "—";
  const ms = typeof tsMs === "number" ? tsMs : Date.parse(String(tsMs));
  if (!Number.isFinite(ms)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return diffSec < 10 ? "agora" : `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

export function createFloor3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function CodeDenFloor3D({ tenant, status, liveCrew, telemetry, focus, onSelectItem, onOpenAgentDm, onOpenAgentProfile }: Floor3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const stageRef = React.useRef<FloorStage | null>(null);
    const seatingRef = React.useRef<Seating>(NO_SEATING);
    const layoutRef = React.useRef<WorkshopLayout | null>(null);
    const [webglLost, setWebglLost] = React.useState<boolean>(false);
    const [rosterOpen, setRosterOpen] = React.useState<boolean>(true);
    const [rosterFilter, setRosterFilter] = React.useState<"all" | "active">("all");
    const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);

    const tenantAgents = status.tenantManifest?.agentes || [];
    const empresaNome = status.tenantManifest?.nome || tenant;

    const adapted = React.useMemo(() => adaptStatusFor3D(status, liveCrew), [status, liveCrew]);
    const { scene, layout } = React.useMemo(() => {
      let nextLayout = layoutRef.current;
      const nextScene = sceneOf(
        {
          f: adapted.f,
          pipeline: adapted.pipeline,
          sessions: adapted.sessions,
          pmSessionId: adapted.pmSessionId,
        },
        seatingRef.current,
        (demand) => {
          nextLayout = workshopLayout(adapted.f.limits.maxConcurrentSessions, demand, layoutRef.current);
          return nextLayout.stations;
        }
      );
      const finalLayout = nextLayout || workshopLayout(adapted.f.limits.maxConcurrentSessions, {}, layoutRef.current);
      layoutRef.current = finalLayout;
      seatingRef.current = nextScene.seating;
      return { scene: nextScene, layout: finalLayout };
    }, [adapted]);
    const lookout = React.useMemo(() => lookoutLayout(layout), [layout]);

    // Refs sempre atualizados para evitar closure obsoleta no callback onTap do Three.js
    const sceneRef = React.useRef(scene);
    const statusRef = React.useRef(status);
    const onSelectItemRef = React.useRef(onSelectItem);
    sceneRef.current = scene;
    statusRef.current = status;
    onSelectItemRef.current = onSelectItem;

    React.useEffect(() => {
      const el = hostRef.current;
      if (!el) return;
      try {
        const st = new FloorStage(el, {
          onLost: () => setWebglLost(true),
          onHover: (key) => setHoveredKey(key),
          onTap: (key) => {
            setSelectedKey(key);
            if (!key) return;
            const latestScene = sceneRef.current;
            const latestStatus = statusRef.current;
            const agent = latestScene.agents.find((a: SceneAgent) => a.key === key);
            if (agent?.card?.item) {
              const found = [...latestStatus.backlog, ...latestStatus.inProgress, ...latestStatus.recent].find(
                (i) => i.id === agent.card?.item.id
              );
              if (found) onSelectItemRef.current(found);
            }
          },
          onFrame: () => {},
        });
        stageRef.current = st;
        setWebglLost(false);
      } catch {
        setWebglLost(true);
        return;
      }
      return () => {
        stageRef.current?.dispose();
        stageRef.current = null;
      };
    }, []);

    React.useEffect(() => {
      const st = stageRef.current;
      if (!st) return;
      const palette = readPalette();
      st.update({ layout, scene, palette, lookout });
    }, [layout, scene, lookout]);

    React.useEffect(() => {
      stageRef.current?.setFocus(focus);
    }, [focus]);

    React.useEffect(() => {
      stageRef.current?.setInset(rosterOpen ? 248 : 0);
    }, [rosterOpen]);

    const leadershipAndExec = tenantAgents.filter((a) => a.categoria === "lideranca" || a.categoria === "execucao");
    const reviewAndOps = tenantAgents.filter((a) => a.categoria === "revisao" || a.categoria === "operacao");
    const activeHoverAgent = scene.agents.find((a: SceneAgent) => a.key === (hoveredKey || selectedKey)) || null;
    const turnOf = (ag: (typeof tenantAgents)[number]) =>
      ag.pubkey && telemetry?.byPubkey ? telemetry.byPubkey[ag.pubkey.toLowerCase()] || null : null;
    const workingNowCount = tenantAgents.filter((a) => Boolean(turnOf(a))).length;
    const inBuzzCount = tenantAgents.filter((a) => a.inBuzz).length;

    if (webglLost) {
      return h(
        "div",
        { className: "of-card-pad", style: { textAlign: "center", padding: "32px" } },
        h("strong", null, "WebGL indisponível neste ambiente"),
        h("div", { className: "of-muted", style: { marginTop: "6px" } }, "O Andar 3D requer WebGL ativo; use a aba Board para acompanhar os cards.")
      );
    }

    const allWorkItems = [...status.inProgress, ...status.backlog, ...status.recent];
    const findAssignedWork = (agName: string) =>
      allWorkItems.find((w) => w.note && w.note.toLowerCase().includes(agName.toLowerCase())) || null;

    const renderCrewRow = (ag: (typeof tenantAgents)[number]) => {
      const liveTurn = turnOf(ag);
      const liveMatch = liveCrew.find((c) => c.key === ag.agentKey || (ag.pubkey && c.pubkey?.toLowerCase() === ag.pubkey.toLowerCase()));
      const assignedItem = findAssignedWork(ag.name);
      const isSelected = selectedKey === ag.agentKey;
      const statusLabel = liveTurn
        ? liveTurn.state === "error"
          ? "Erro"
          : "Respondendo"
        : ag.running
        ? "Em execução"
        : ag.inBuzz
        ? "Disponível"
        : "Pendente";
      const stepLine = liveTurn?.stepLabel || assignedItem?.step || ag.funcao;

      return h(
        "div",
        {
          key: ag.agentKey || ag.name,
          role: "button",
          tabIndex: 0,
          "data-floor3d-roster-row": ag.agentKey || ag.name,
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            padding: "8px 10px",
            borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            background: isSelected ? "var(--affordance-selected, rgba(255,255,255,0.08))" : "transparent",
            cursor: "pointer",
            textAlign: "left",
          },
          onMouseEnter: () => setHoveredKey(ag.agentKey),
          onMouseLeave: () => setHoveredKey((cur) => (cur === ag.agentKey ? null : cur)),
          onClick: () => {
            setSelectedKey(ag.agentKey);
            stageRef.current?.select(ag.agentKey);
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 } },
          liveMatch?.picture
            ? h("img", { src: liveMatch.picture, alt: ag.name, style: { width: "16px", height: "16px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 } })
            : h("span", {
                className: "of-dot",
                "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : ag.inBuzz ? "done" : "idle",
              }),
          h("span", { style: { fontSize: "11.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, ag.name),
          assignedItem &&
            h("span", { className: "of-mono of-muted", style: { fontSize: "9.5px", flexShrink: 0 } }, `#${assignedItem.id.slice(0, 6)}`)
        ),
        assignedItem &&
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: assignedItem.title },
            assignedItem.title
          ),
        h(
          "div",
          { style: { fontSize: "10px", color: liveTurn ? "var(--status-running)" : "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: `${stepLine} · ${statusLabel}` },
          `${stepLine} · ${statusLabel}`
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "1px" } },
          h("span", { className: "of-mono of-muted", style: { fontSize: "9.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, `${ag.provider || liveMatch?.provider || "buzz"} · ${ag.model}`),
          h(
            "div",
            { style: { display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 } },
            onOpenAgentProfile &&
              ag.pubkey &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  title: `Abrir perfil nativo de ${ag.name} no Buzz`,
                  style: { padding: "1px 5px", fontSize: "9.5px" },
                  onClick: (e: any) => {
                    e.stopPropagation();
                    onOpenAgentProfile({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name });
                  },
                },
                "Perfil"
              ),
            onOpenAgentDm &&
              ag.pubkey &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  title: `Abrir DM nativa com ${ag.name} no Buzz`,
                  style: { padding: "1px 5px", fontSize: "9.5px", color: "var(--primary)" },
                  onClick: (e: any) => {
                    e.stopPropagation();
                    onOpenAgentDm({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name });
                  },
                },
                "DM ↗"
              )
          )
        )
      );
    };

    const filterRows = (list: typeof tenantAgents) =>
      rosterFilter === "active" ? list.filter((a) => Boolean(turnOf(a) || a.running)) : list;
    const workshopRows = filterRows(leadershipAndExec);
    const lookoutRows = filterRows(reviewAndOps);

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: "560px" } },
      h(
        "div",
        {
          ref: hostRef,
          style: {
            position: "relative",
            flex: 1,
            minHeight: "520px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "radial-gradient(circle at 50% 40%, #15171d, #0a0b0f)",
            overflow: "hidden",
          },
        },
        rosterOpen
          ? h(
              "nav",
              {
                "aria-label": "Roster da equipe",
                "data-codeden-floor-roster": "true",
                style: {
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  bottom: "10px",
                  width: "256px",
                  zIndex: 20,
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "rgba(15, 17, 22, 0.93)",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.4)",
                },
              },
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    flexShrink: 0,
                  },
                },
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, `Equipe ${empresaNome}`),
                h("span", { className: "of-pill of-num", style: { fontSize: "10px", padding: "0 5px" } }, String(tenantAgents.length)),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { marginLeft: "auto", padding: "1px 6px", fontSize: "10px" },
                    title: rosterFilter === "active" ? "Mostrar todos" : "Mostrar apenas ativos",
                    onClick: () => setRosterFilter((f) => (f === "all" ? "active" : "all")),
                  },
                  rosterFilter === "active" ? `Ativos (${workingNowCount})` : "Todos"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { padding: "1px 6px" },
                    title: "Recolher roster",
                    onClick: () => setRosterOpen(false),
                  },
                  "‹"
                )
              ),
              h(
                "div",
                { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" } },
                h(
                  "div",
                  {
                    style: {
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 10px",
                      fontSize: "9.5px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      background: "rgba(22, 25, 32, 0.94)",
                      borderBottom: "1px solid var(--border)",
                      backdropFilter: "blur(6px)",
                    },
                  },
                  h("span", null, "OFICINA & LIDERANÇA"),
                  h("span", { className: "of-num" }, String(workshopRows.length))
                ),
                workshopRows.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "8px 10px", fontSize: "10.5px" } }, rosterFilter === "active" ? "Nenhum agente ativo na oficina." : "Sem agentes no manifesto.")
                  : workshopRows.map(renderCrewRow),
                h(
                  "div",
                  {
                    style: {
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 10px",
                      fontSize: "9.5px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      background: "rgba(22, 25, 32, 0.94)",
                      borderTop: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                      backdropFilter: "blur(6px)",
                    },
                  },
                  h("span", null, "MIRANTE & REVISORES L-01"),
                  h("span", { className: "of-num" }, String(lookoutRows.length))
                ),
                lookoutRows.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "8px 10px", fontSize: "10.5px" } }, rosterFilter === "active" ? "Nenhum revisor ativo no mirante." : "Sem revisores definidos.")
                  : lookoutRows.map(renderCrewRow)
              )
            )
          : h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { position: "absolute", top: "10px", left: "10px", zIndex: 20 },
                onClick: () => setRosterOpen(true),
              },
              `Equipe ${empresaNome} (${tenantAgents.length}) ›`
            ),

        (() => {
          const focusKey = selectedKey || hoveredKey;
          if (!focusKey) return null;
          const sceneAg = scene.agents.find((a: SceneAgent) => a.key === focusKey) || null;
          const matchedTenantAg =
            tenantAgents.find((a) => a.agentKey === focusKey || a.name === focusKey) ||
            (sceneAg?.role === "pm"
              ? tenantAgents.find((a) => a.papel === "coo" || /bento|coo/i.test(a.name))
              : sceneAg?.role === "scout"
              ? tenantAgents.find((a) => a.papel === "oraculo" || /oraculo|oráculo|scout/i.test(a.name))
              : null) ||
            null;
          const matchedLive = matchedTenantAg
            ? liveCrew.find((c) => c.key === matchedTenantAg.agentKey || (matchedTenantAg.pubkey && c.pubkey?.toLowerCase() === matchedTenantAg.pubkey.toLowerCase()))
            : liveCrew.find((c) => c.key === focusKey) || null;
          const liveTurn = matchedTenantAg ? turnOf(matchedTenantAg) : null;
          const displayTitle =
            matchedTenantAg?.name ||
            (sceneAg?.role === "pm"
              ? `${status.tenantManifest?.coo || "COO"} (${empresaNome})`
              : sceneAg?.role === "scout"
              ? "Oráculo · Scout"
              : sceneAg?.card?.item.title || sceneAg?.area || focusKey);
          const statusText = liveTurn
            ? "Respondendo"
            : matchedTenantAg?.running || sceneAg?.status === "working"
            ? "Em execução"
            : matchedTenantAg?.inBuzz
            ? "Disponível"
            : "Ocioso";
          const statusTone = liveTurn
            ? liveTurn.state === "error"
              ? "failed"
              : "running"
            : matchedTenantAg?.inBuzz
            ? "done"
            : "idle";
          const stepLabel =
            liveTurn?.stepLabel ||
            sceneAg?.card?.item.title ||
            sceneAg?.progress ||
            matchedTenantAg?.funcao ||
            "Aguardando tarefa";
          const modelLabel = `${matchedLive?.provider || matchedTenantAg?.provider || "buzz"} · ${matchedLive?.model || matchedTenantAg?.model || sceneAg?.model || "padrão"}`;

          return h(
            "div",
            {
              "data-floor3d-agent-popover": "true",
              style: {
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 25,
                width: "276px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                background: "rgba(18, 20, 26, 0.95)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
                padding: "11px 13px",
                fontSize: "11.5px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "7px" } },
              h(
                "div",
                { style: { display: "inline-flex", alignItems: "center", gap: "7px", minWidth: 0 } },
                matchedLive?.picture && h("img", { src: matchedLive.picture, alt: displayTitle, style: { width: "20px", height: "20px", borderRadius: "5px", objectFit: "cover" } }),
                h("strong", { style: { fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, displayTitle)
              ),
              h(
                "div",
                { style: { display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 } },
                h("span", { className: "of-pill", "data-tone": statusTone, style: { fontSize: "10px", padding: "1px 6px" } }, statusText),
                selectedKey &&
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "ghost",
                      style: { padding: "1px 5px", fontSize: "12px" },
                      title: "Fechar",
                      onClick: () => setSelectedKey(null),
                    },
                    "×"
                  )
              )
            ),
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "64px 1fr", gap: "4px 8px", fontSize: "11px" } },
              h("span", { className: "of-muted" }, "Etapa"),
              h("span", { style: { fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: stepLabel }, stepLabel),
              h("span", { className: "of-muted" }, "Na etapa"),
              h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px" } }, formatElapsedStep((liveTurn as any)?.startedAt || sceneAg?.since || status.lastTickAt)),
              h("span", { className: "of-muted" }, "Agente"),
              h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: modelLabel }, modelLabel)
            ),
            h(
              "div",
              { style: { display: "flex", gap: "6px", paddingTop: "2px" } },
              onOpenAgentDm && (matchedTenantAg || matchedLive) &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    style: { flex: 1, justifyContent: "center", fontSize: "11px", padding: "5px 8px" },
                    onClick: () =>
                      onOpenAgentDm({
                        key: matchedTenantAg?.agentKey || matchedLive?.key,
                        pubkey: matchedTenantAg?.pubkey || matchedLive?.pubkey,
                        name: displayTitle,
                      }),
                  },
                  "Abrir chat lateral ↗"
                ),
              onOpenAgentProfile && (matchedTenantAg || matchedLive) &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    style: { fontSize: "11px", padding: "5px 8px" },
                    onClick: () =>
                      onOpenAgentProfile({
                        key: matchedTenantAg?.agentKey || matchedLive?.key,
                        pubkey: matchedTenantAg?.pubkey || matchedLive?.pubkey,
                        name: displayTitle,
                      }),
                  },
                  "Perfil ↗"
                )
            )
          );
        })(),

        h(
          "div",
          { style: { position: "absolute", right: "12px", bottom: "12px", zIndex: 20, display: "inline-flex", gap: "6px" } },
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { background: "rgba(18, 20, 26, 0.88)" },
              title: isFullscreen ? "Sair da tela cheia" : "Tela cheia no Andar 3D",
              onClick: () => {
                const el = hostRef.current;
                if (!el) return;
                try {
                  if (document.fullscreenElement) {
                    void document.exitFullscreen?.();
                    setIsFullscreen(false);
                  } else {
                    void el.requestFullscreen?.();
                    setIsFullscreen(true);
                  }
                } catch {}
              },
            },
            isFullscreen ? "↙ Sair" : "⛶ Tela cheia"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { background: "rgba(18, 20, 26, 0.88)" },
              title: "Enquadrar todo o andar 3D (ou clique duplo)",
              onClick: () => stageRef.current?.fit(true),
            },
            "⤢ Fit"
          )
        )
      ),
      h(
        "div",
        { className: "of-muted", style: { textAlign: "center", fontSize: "11px" } },
        `Fábrica ${empresaNome} (${tenant}) · ${inBuzzCount}/${tenantAgents.length} no Buzz · ${workingNowCount} respondendo agora · ${sceneSummary(scene)}`
      )
    );
  };
}
