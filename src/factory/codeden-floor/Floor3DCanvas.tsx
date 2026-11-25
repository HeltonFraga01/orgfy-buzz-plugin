// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/floor/floor-scene.tsx, roster.tsx, cards.tsx
// Componente React que monta o motor 3D Three.js oficial do CodeDen (Workshop + Lookout isométrico) 1:1 isolado por empresa do OrgFy.

import type { Context } from "@buzz/author";
import type { FactoryStatusPayload, FactoryWorkItem as OrgfyWorkItem } from "../factory-adapter";
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
  focus: StoreyFocus;
  onSelectItem: (item: OrgfyWorkItem) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
}

export function createFloor3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function CodeDenFloor3D({ tenant, status, liveCrew, focus, onSelectItem, onOpenAgentDm }: Floor3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const stageRef = React.useRef<FloorStage | null>(null);
    const seatingRef = React.useRef<Seating>(NO_SEATING);
    const layoutRef = React.useRef<WorkshopLayout | null>(null);
    const [webglLost, setWebglLost] = React.useState<boolean>(false);
    const [rosterOpen, setRosterOpen] = React.useState<boolean>(true);
    const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

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
            const agent = scene.agents.find((a: SceneAgent) => a.key === key);
            if (agent?.card?.item) {
              const found = [...status.backlog, ...status.inProgress, ...status.recent].find(
                (i) => i.id === agent.card?.item.id
              );
              if (found) onSelectItem(found);
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
    const runningCount = tenantAgents.filter((a) => a.running).length;
    const inBuzzCount = tenantAgents.filter((a) => a.inBuzz).length;

    if (webglLost) {
      return h(
        "div",
        { className: "of-card-pad", style: { textAlign: "center", padding: "32px" } },
        h("strong", null, "WebGL indisponível neste ambiente"),
        h("div", { className: "of-muted", style: { marginTop: "6px" } }, "O Andar 3D requer WebGL ativo; use a aba Board para acompanhar os cards.")
      );
    }

    const renderCrewRow = (ag: (typeof tenantAgents)[number]) =>
      h(
        "div",
        {
          key: ag.agentKey || ag.name,
          className: "of-nav-btn",
          "data-active": selectedKey === ag.agentKey ? "true" : "false",
          style: { alignItems: "flex-start", padding: "6px 8px" },
          onClick: () => {
            setSelectedKey(ag.agentKey);
            stageRef.current?.select(ag.agentKey);
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 } },
          h(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600 } },
            h("span", {
              className: "of-dot",
              "data-tone": ag.running ? "running" : ag.inBuzz ? "done" : "idle",
              title: ag.running ? "Em execução no Buzz" : ag.inBuzz ? "Disponível no Buzz" : "A provisionar",
            }),
            h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ag.name)
          ),
          h("span", { className: "of-muted", style: { fontSize: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ag.funcao),
          h("span", { className: "of-mono of-muted", style: { fontSize: "9.5px" } }, ag.model)
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
              style: { padding: "2px 5px", fontSize: "10px", color: "var(--primary)", flexShrink: 0 },
              onClick: (e: any) => {
                e.stopPropagation();
                onOpenAgentDm({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name });
              },
            },
            "DM ↗"
          )
      );

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
              "aside",
              {
                style: {
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  bottom: "10px",
                  width: "238px",
                  zIndex: 20,
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "rgba(15, 17, 22, 0.90)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                },
              },
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "11.5px",
                    fontWeight: 700,
                  },
                },
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, `Equipe ${empresaNome} · ${tenantAgents.length}`),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { padding: "2px 6px" },
                    onClick: () => setRosterOpen(false),
                  },
                  "‹"
                )
              ),
              h(
                "div",
                { style: { flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "4px" } },
                h("div", { className: "of-meter-label", style: { padding: "2px 4px" } }, `OFICINA & LIDERANÇA · ${leadershipAndExec.length}`),
                leadershipAndExec.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "4px 6px", fontSize: "10.5px" } }, "Sem agentes no manifesto.")
                  : leadershipAndExec.map(renderCrewRow),
                h("div", { className: "of-meter-label", style: { marginTop: "8px", padding: "2px 4px" } }, `REVISORES L-01 & MIRANTE · ${reviewAndOps.length}`),
                reviewAndOps.length === 0
                  ? h("div", { className: "of-muted", style: { padding: "4px 6px", fontSize: "10.5px" } }, "Sem revisores definidos.")
                  : reviewAndOps.map(renderCrewRow)
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

        activeHoverAgent &&
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 20,
                width: "240px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                background: "rgba(18, 20, 26, 0.92)",
                padding: "10px 12px",
                fontSize: "11.5px",
              },
            },
            h("div", { style: { fontWeight: 700 } }, activeHoverAgent.role === "pm" ? `${status.tenantManifest?.coo || "COO"} (${empresaNome})` : activeHoverAgent.role === "scout" ? "Oráculo · Scout" : activeHoverAgent.card?.item.title || activeHoverAgent.area || activeHoverAgent.key),
            h("div", { className: "of-mono of-muted", style: { marginTop: "2px" } }, `${activeHoverAgent.status} · ${activeHoverAgent.model || "padrão"}`),
            activeHoverAgent.progress && h("div", { className: "of-muted", style: { marginTop: "4px" } }, activeHoverAgent.progress)
          ),

        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            style: {
              position: "absolute",
              right: "12px",
              bottom: "12px",
              zIndex: 20,
              background: "rgba(18, 20, 26, 0.88)",
            },
            title: "Enquadrar todo o andar 3D (ou clique duplo)",
            onClick: () => stageRef.current?.fit(true),
          },
          "⤢ Fit"
        )
      ),
      h(
        "div",
        { className: "of-muted", style: { textAlign: "center", fontSize: "11px" } },
        `Fábrica ${empresaNome} (${tenant}) · ${inBuzzCount}/${tenantAgents.length} agentes no Buzz · ${runningCount} ativo(s) agora · ${sceneSummary(scene)}`
      )
    );
  };
}
