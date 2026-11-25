// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/floor/floor-scene.tsx, roster.tsx, cards.tsx
// Componente React que monta o motor 3D Three.js oficial do CodeDen (Workshop + Lookout isométrico) 1:1 dentro do Buzz Desktop.

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

  for (const agent of liveCrew) {
    const sid = agent.key;
    const isPm = /bento|iris|coo|ceo|pm/i.test(agent.name);
    const isScout = /oraculo|oráculo|scout/i.test(agent.name);
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

  // Sempre inclui o Lookout (2º andar) com os 8 pods e o Oráculo/Scout para espelhar 1:1 o Andar 3D oficial
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
        sessionId: `scout-${area}`,
        status: status.loopState === "discovering" ? "running" : "idle",
        active: status.loopState === "discovering",
        reported: false,
      })),
      provider: "claude",
      model: "claude-sonnet-5-5",
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
  status: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  focus: StoreyFocus;
  onSelectItem: (item: OrgfyWorkItem) => void;
}

export function createFloor3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function CodeDenFloor3D({ status, liveCrew, focus, onSelectItem }: Floor3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const stageRef = React.useRef<FloorStage | null>(null);
    const seatingRef = React.useRef<Seating>(NO_SEATING);
    const layoutRef = React.useRef<WorkshopLayout | null>(null);
    const [webglLost, setWebglLost] = React.useState<boolean>(false);
    const [rosterOpen, setRosterOpen] = React.useState<boolean>(true);
    const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

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
      stageRef.current?.setInset(rosterOpen ? 236 : 0);
    }, [rosterOpen]);

    const workshopAgents = scene.agents.filter((a: SceneAgent) => a.role !== "scout" && a.role !== "area");
    const lookoutAgents = scene.agents.filter((a: SceneAgent) => a.role === "scout" || a.role === "area");
    const activeHoverAgent = scene.agents.find((a: SceneAgent) => a.key === (hoveredKey || selectedKey)) || null;

    if (webglLost) {
      return h(
        "div",
        { className: "of-card-pad", style: { textAlign: "center", padding: "32px" } },
        h("strong", null, "WebGL indisponível neste ambiente"),
        h("div", { className: "of-muted", style: { marginTop: "6px" } }, "O Andar 3D requer WebGL ativo; use a aba Board para acompanhar os cards.")
      );
    }

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
                  width: "224px",
                  zIndex: 20,
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "rgba(15, 17, 22, 0.88)",
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
                    fontSize: "12px",
                    fontWeight: 600,
                  },
                },
                h("span", null, `Crew · ${scene.agents.length}`),
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
                { style: { flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "8px" } },
                h("div", { className: "of-meter-label" }, `WORKSHOP · ${workshopAgents.length}`),
                workshopAgents.map((a: SceneAgent) =>
                  h(
                    "button",
                    {
                      key: a.key,
                      type: "button",
                      className: "of-nav-btn",
                      "data-active": selectedKey === a.key ? "true" : "false",
                      onClick: () => {
                        setSelectedKey(a.key);
                        stageRef.current?.select(a.key);
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                      h(
                        "span",
                        { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 } },
                        h("span", { className: "of-dot", "data-tone": a.status === "working" ? "running" : a.status === "blocked" ? "failed" : "idle" }),
                        h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, a.role === "pm" ? "Project manager" : a.card?.item.title || a.key)
                      ),
                      h("span", { className: "of-mono of-muted", style: { fontSize: "10px" } }, `${a.provider || "orgfy"} · ${a.model || "ativo"}`)
                    )
                  )
                ),
                h("div", { className: "of-meter-label", style: { marginTop: "6px" } }, `LOOKOUT · ${lookoutAgents.length}`),
                lookoutAgents.map((a: SceneAgent) =>
                  h(
                    "button",
                    {
                      key: a.key,
                      type: "button",
                      className: "of-nav-btn",
                      "data-active": selectedKey === a.key ? "true" : "false",
                      onClick: () => {
                        setSelectedKey(a.key);
                        stageRef.current?.select(a.key);
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                      h(
                        "span",
                        { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 } },
                        h("span", { className: "of-dot", "data-tone": a.status === "working" ? "running" : "idle" }),
                        h("span", null, a.role === "scout" ? "Scout (Oráculo)" : a.area || a.key)
                      ),
                      h("span", { className: "of-mono of-muted", style: { fontSize: "10px" } }, `${a.provider || "claude"} · ${a.model || "idle"}`)
                    )
                  )
                )
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
              `Crew (${scene.agents.length}) ›`
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
            h("div", { style: { fontWeight: 700 } }, activeHoverAgent.role === "pm" ? "Project manager" : activeHoverAgent.role === "scout" ? "Scout (Oráculo)" : activeHoverAgent.card?.item.title || activeHoverAgent.area || activeHoverAgent.key),
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
        sceneSummary(scene)
      )
    );
  };
}
