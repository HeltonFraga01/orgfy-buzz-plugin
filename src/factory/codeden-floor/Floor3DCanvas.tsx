// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/floor/floor-scene.tsx, roster.tsx, cards.tsx
// Componente React que monta o motor 3D Three.js oficial do CodeDen (Workshop + Lookout isométrico) 1:1 isolado por empresa do OrgFy.

import type { Context } from "@buzz/author";
import type { FactoryStatusPayload, FactoryWorkItem as OrgfyWorkItem } from "../factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "../buzz-live-telemetry";
import type { LiveCrewAgent } from "../FactoryBoardAndFloor";
import {
  AREA_LABEL,
  DISCOVERY_AREAS,
  type DiscoveryArea,
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
import { FloorStage, type ScreenFigure } from "./floor/stage";

function toCodeDenStage(item: OrgfyWorkItem): ViewStageId {
  const st = String(item.stage || "");
  if (st === "merged") return "merged";
  if (item.step === "merge" || st === "watching") return "merge";
  if (st === "verifying" || String(item.step).includes("review")) return "reviewing";
  if (st === "building" || st === "in_progress") return "building";
  if (st === "candidate" || item.step === "intake") return "type";
  return "intake";
}

function adaptStatusFor3D(
  status: FactoryStatusPayload,
  liveCrew: LiveCrewAgent[],
  telemetry?: BuzzLiveTelemetrySnapshot,
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
          pubkey: a.pubkey || "",
          name: a.name,
          model: a.model,
          provider: a.provider,
          running: a.running,
          papel: a.papel,
        }))
      : liveCrew.map((a) => ({ ...a, pubkey: a.pubkey || "", papel: "" }));

  for (const agent of pool) {
    const sid = agent.key;
    const liveTurn = agent.pubkey && telemetry?.byPubkey ? telemetry.byPubkey[agent.pubkey.toLowerCase()] || null : null;
    const isPm = agent.papel === "coo" || agent.papel === "ceo_empresa" || /bento|iris|coo|ceo|pm/i.test(agent.name);
    const isScout = agent.papel === "oraculo" || /oraculo|oráculo|scout/i.test(agent.name);
    if (isPm && !pmSessionId) pmSessionId = sid;
    if (isScout && !scoutSessionId) scoutSessionId = sid;
    sessions.set(sid, {
      status: liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : agent.running ? "running" : "idle",
      progress: liveTurn?.stepLabel || (agent.running ? `Executando (${agent.model})` : "Aguardando"),
      progressAt: new Date(liveTurn?.startedAt || Date.now()).toISOString(),
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
  // Limita a amostra no palco 3D para manter fluidez e leitura clara das caixas e bancadas
  const allOrgfy = [
    ...status.backlog.slice(0, 12),
    ...status.inProgress.slice(0, 16),
    ...status.recent.slice(0, 8),
  ];

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
    const stageStr = String(raw.stage || "");
    const isFailed = stageStr === "failed" || stageStr === "reverted";
    const isPerson = stageStr === "escalated";
    const card: ViewCard = {
      item,
      place: isFailed || isPerson ? "needs_you" : place,
      state: isFailed
        ? "failed"
        : isPerson
        ? "person"
        : stageStr === "building" || stageStr === "in_progress" || stageStr === "verifying"
        ? "running"
        : "idle",
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
    scout: (() => {
      // Mapeia cada uma das 8 lentes do Mirante 1:1 para um agente real do Buzz da empresa ativa (zero bonecos fantasmas)
      const areaMatchers: Record<DiscoveryArea, RegExp> = {
        features: /^(po|pesquisa|produto)$|sol\s*po|sol$/i,
        ux: /^(frontend|ui|revisor_ui)$|livia/i,
        performance: /^(backend|performance)$|otto/i,
        tech_debt: /^(arquiteto)$|arquiteto/i,
        test_gaps: /^(qa|revisor_codigo)$|teo/i,
        security: /^(seguranca|revisor_seguranca)$|hugo/i,
        bugs: /^(infra|release)$|atlas|ravi/i,
        docs: /^(prompts|revisor_metodo|docs)$|lia|vera/i,
      };
      const usedKeys = new Set<string>([pmSessionId || "", scoutSessionId || ""].filter(Boolean));
      const pickAgentForArea = (area: DiscoveryArea) => {
        const rx = areaMatchers[area];
        const exact = pool.find((a) => !usedKeys.has(a.key) && (rx.test(a.papel || "") || rx.test(a.name)));
        if (exact) {
          usedKeys.add(exact.key);
          return exact;
        }
        const fallback = pool.find((a) => !usedKeys.has(a.key)) || pool.find((a) => a.key !== scoutSessionId) || pool[0] || null;
        if (fallback) usedKeys.add(fallback.key);
        return fallback;
      };
      const scoutAgent = pool.find((a) => a.key === scoutSessionId) || null;
      return {
        sessionId: scoutSessionId,
        phase: status.loopState === "discovering" ? "reviewing" : "idle",
        rounds: 2,
        lenses: DISCOVERY_AREAS.map((area) => {
          const assigned = pickAgentForArea(area);
          const sid = assigned?.key || `scout-${status.projectId}-${area}`;
          const sess = sessions.get(sid);
          const isRunning = sess?.status === "running" || status.loopState === "discovering";
          return {
            area,
            sessionId: sid,
            status: isRunning ? "running" : "idle",
            active: isRunning,
            reported: false,
          };
        }),
        provider: scoutAgent?.provider || "nexusmind_antigravity",
        model: scoutAgent?.model || "gemini-2.5-flash",
        lastRoundAt: null,
      };
    })(),
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
  onOpenTurnInSideChat?: (turn: LiveAgentTurn) => void;
}

interface CompletedBubbleTurn {
  turn: LiveAgentTurn;
  finishedAt: number;
  dismissed?: boolean;
}

interface SpeechBubbleEntry {
  figureKey: string;
  agentKey: string;
  agentPubkey: string;
  agentName: string;
  picture?: string;
  kind: "working" | "error" | "done";
  turn: LiveAgentTurn;
  /** Todos os turnos simultâneos deste agente (evita empilhar vários balões no mesmo bonequinho) */
  turns: LiveAgentTurn[];
  finishedAt?: number;
}

const COMPLETED_BUBBLE_TTL_MS = 3 * 60 * 1000;

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

function formatBubbleClock(tsMs?: number | null): string {
  if (!tsMs || !Number.isFinite(tsMs)) return "0s";
  const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const rem = diffSec % 60;
  if (mins < 60) return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function createFloor3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function CodeDenFloor3D({ tenant, status, liveCrew, telemetry, focus, onSelectItem, onOpenAgentDm, onOpenAgentProfile, onOpenTurnInSideChat }: Floor3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const stageRef = React.useRef<FloorStage | null>(null);
    const seatingRef = React.useRef<Seating>(NO_SEATING);
    const layoutRef = React.useRef<WorkshopLayout | null>(null);
    const bubbleNodesRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
    const lastFiguresRef = React.useRef<readonly ScreenFigure[]>([]);
    const prevActiveByPubkeyRef = React.useRef<Record<string, LiveAgentTurn>>({});
    const [webglLost, setWebglLost] = React.useState<boolean>(false);
    const [rosterOpen, setRosterOpen] = React.useState<boolean>(true);
    const [rosterFilter, setRosterFilter] = React.useState<"all" | "active">("all");
    const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
    const [completedTurns, setCompletedTurns] = React.useState<Record<string, CompletedBubbleTurn>>({});
    const [, setClockTick] = React.useState<number>(0);
    const [themeVersion, setThemeVersion] = React.useState<number>(0);

    const tenantAgents = status.tenantManifest?.agentes || [];
    const empresaNome = status.tenantManifest?.nome || tenant;

    const adapted = React.useMemo(() => adaptStatusFor3D(status, liveCrew, telemetry), [status, liveCrew, telemetry]);
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

    // Detecta transições ativo -> concluído para exibir balão "Respondeu · Abrir resposta ↗" acima do bonequinho 3D
    React.useEffect(() => {
      const currentMap = telemetry?.byPubkey || {};
      const prevMap = prevActiveByPubkeyRef.current;
      const now = Date.now();
      let changed = false;
      const updates: Record<string, CompletedBubbleTurn | null> = {};

      for (const [pk, prevTurn] of Object.entries(prevMap)) {
        if (!currentMap[pk]) {
          updates[pk] = { turn: prevTurn, finishedAt: now };
          changed = true;
        }
      }
      for (const pk of Object.keys(currentMap)) {
        updates[pk] = null;
        changed = true;
      }
      prevActiveByPubkeyRef.current = { ...currentMap };
      if (changed) {
        setCompletedTurns((prev) => {
          let mutated = false;
          const copy: Record<string, CompletedBubbleTurn> = { ...prev };
          for (const [pk, val] of Object.entries(updates)) {
            if (val === null) {
              if (copy[pk]) {
                delete copy[pk];
                mutated = true;
              }
            } else {
              copy[pk] = val;
              mutated = true;
            }
          }
          return mutated ? copy : prev;
        });
      }
    }, [telemetry]);

    // Posiciona os balões HTML sobre a cabeça dos bonequinhos 3D com anti-colisão entre agentes vizinhos (60fps)
    const positionBubbles = React.useCallback((figures: readonly ScreenFigure[]) => {
      const host = hostRef.current;
      if (!host) return;
      const hostW = host.clientWidth || 1;
      const hostH = host.clientHeight || 1;
      const byKey = new Map<string, ScreenFigure>();
      for (const f of figures) byKey.set(f.key, f);

      const candidates: Array<{ node: HTMLDivElement; cx: number; bottom: number; w: number; h: number }> = [];
      for (const [figKey, node] of bubbleNodesRef.current.entries()) {
        const fig = byKey.get(figKey);
        if (!fig || !fig.head.inView) {
          node.style.opacity = "0";
          node.style.pointerEvents = "none";
          continue;
        }
        const w = node.offsetWidth || 228;
        const h = node.offsetHeight || 88;
        const halfW = w / 2 + 8;
        const cx = Math.max(halfW, Math.min(hostW - halfW, fig.head.x));
        const bottom = Math.max(h + 12, Math.min(hostH - 20, fig.head.y - 16));
        candidates.push({ node, cx, bottom, w, h });
      }

      // Ordena da esquerda para a direita e resolve sobreposição de bounding boxes entre balões vizinhos
      candidates.sort((a, b) => a.cx - b.cx || b.bottom - a.bottom);
      const placed: Array<{ left: number; right: number; top: number; bottom: number }> = [];
      const PAD = 10;
      for (const c of candidates) {
        let cx = c.cx;
        let bottom = c.bottom;
        const halfW = c.w / 2;
        for (let guard = 0; guard < 6; guard++) {
          const left = cx - halfW;
          const right = cx + halfW;
          const top = bottom - c.h;
          const hit = placed.find(
            (p) => left < p.right + PAD && right > p.left - PAD && top < p.bottom + PAD && bottom > p.top - PAD
          );
          if (!hit) break;
          const nextBottom = hit.top - PAD;
          if (nextBottom - c.h >= 12) {
            bottom = nextBottom;
          } else {
            const shiftRight = hit.right + PAD + halfW;
            const shiftLeft = hit.left - PAD - halfW;
            if (shiftRight + halfW <= hostW - 8) cx = shiftRight;
            else if (shiftLeft - halfW >= 8) cx = shiftLeft;
            else bottom = Math.max(c.h + 12, nextBottom);
          }
        }
        placed.push({ left: cx - halfW, right: cx + halfW, top: bottom - c.h, bottom });
        c.node.style.transform = `translate3d(${Math.round(cx)}px, ${Math.round(bottom)}px, 0) translate(-50%, -100%)`;
        c.node.style.opacity = "1";
        c.node.style.pointerEvents = "auto";
      }
    }, []);

    // Refs sempre atualizados para evitar closure obsoleta no callback onTap/onFrame do Three.js
    const sceneRef = React.useRef(scene);
    const statusRef = React.useRef(status);
    const onSelectItemRef = React.useRef(onSelectItem);
    const positionBubblesRef = React.useRef(positionBubbles);
    sceneRef.current = scene;
    statusRef.current = status;
    onSelectItemRef.current = onSelectItem;
    positionBubblesRef.current = positionBubbles;

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
          onFrame: (figures) => {
            lastFiguresRef.current = figures;
            positionBubblesRef.current(figures);
          },
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
      const root = globalThis.document?.documentElement;
      if (!root || typeof MutationObserver === "undefined") return;
      const obs = new MutationObserver(() => setThemeVersion((v) => v + 1));
      obs.observe(root, {
        attributes: true,
        attributeFilter: ["class", "style", "data-accent", "data-color-mode", "data-color-level"],
      });
      return () => obs.disconnect();
    }, []);

    React.useEffect(() => {
      const st = stageRef.current;
      if (!st) return;
      const palette = readPalette();
      st.update({ layout, scene, palette, lookout });
    }, [layout, scene, lookout, themeVersion]);

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

    // Mapeia turnos ao vivo (pensando/executando) e turnos recém-concluídos para os bonequinhos 3D da cena
    const speechBubbles = React.useMemo<SpeechBubbleEntry[]>(() => {
      const now = Date.now();
      const entries: SpeechBubbleEntry[] = [];
      const usedFigures = new Set<string>();
      const areaFigures = scene.agents.filter((a: SceneAgent) => a.role === "area").map((a: SceneAgent) => a.key);
      const workerFigures = scene.agents.filter((a: SceneAgent) => a.role !== "pm" && a.role !== "scout" && a.role !== "area");
      let areaCursor = 0;

      const resolveFigureKey = (ag: (typeof tenantAgents)[number]): string | null => {
        const isPm = ag.agentKey === adapted.pmSessionId || ag.papel === "coo" || ag.papel === "ceo_empresa" || /bento|iris|coo|ceo|pm/i.test(ag.name);
        if (isPm && !usedFigures.has("pm") && scene.agents.some((s: SceneAgent) => s.key === "pm")) {
          return "pm";
        }
        const isScout = ag.papel === "oraculo" || /oraculo|oráculo|scout/i.test(ag.name);
        if (isScout && !usedFigures.has("scout") && scene.agents.some((s: SceneAgent) => s.key === "scout")) {
          return "scout";
        }
        const directWorker = workerFigures.find(
          (w: SceneAgent) =>
            !usedFigures.has(w.key) &&
            (w.sessionId === ag.agentKey || Boolean(w.card?.item.note && w.card.item.note.toLowerCase().includes(ag.name.toLowerCase())))
        );
        if (directWorker) return directWorker.key;
        const directArea = scene.agents.find(
          (a: SceneAgent) => a.role === "area" && !usedFigures.has(a.key) && a.sessionId === ag.agentKey
        );
        if (directArea) return directArea.key;
        while (areaCursor < areaFigures.length) {
          const candidate = areaFigures[areaCursor++];
          if (!usedFigures.has(candidate)) return candidate;
        }
        if (!usedFigures.has("pm") && scene.agents.some((s: SceneAgent) => s.key === "pm")) return "pm";
        return null;
      };

      for (const ag of tenantAgents) {
        const pk = (ag.pubkey || "").toLowerCase();
        if (!pk) continue;
        const liveTurnsList: LiveAgentTurn[] =
          telemetry?.turnsByPubkey?.[pk]?.length
            ? telemetry.turnsByPubkey[pk]
            : telemetry?.byPubkey?.[pk]
            ? [telemetry.byPubkey[pk]]
            : [];
        const liveTurn = liveTurnsList[0] || null;
        const doneRec = completedTurns[pk];
        const hasFreshDone = Boolean(doneRec && !doneRec.dismissed && now - doneRec.finishedAt < COMPLETED_BUBBLE_TTL_MS);
        if (!liveTurn && !hasFreshDone) continue;

        const figureKey = resolveFigureKey(ag);
        if (!figureKey) continue;
        usedFigures.add(figureKey);
        const liveMatch = liveCrew.find((c) => c.key === ag.agentKey || (c.pubkey && c.pubkey.toLowerCase() === pk));
        if (liveTurn) {
          const hasError = liveTurnsList.some((t) => t.state === "error");
          entries.push({
            figureKey,
            agentKey: ag.agentKey,
            agentPubkey: pk,
            agentName: ag.name,
            picture: liveMatch?.picture,
            kind: hasError ? "error" : "working",
            turn: liveTurn,
            turns: liveTurnsList,
          });
        } else if (doneRec) {
          entries.push({
            figureKey,
            agentKey: ag.agentKey,
            agentPubkey: pk,
            agentName: ag.name,
            picture: liveMatch?.picture,
            kind: "done",
            turn: doneRec.turn,
            turns: [doneRec.turn],
            finishedAt: doneRec.finishedAt,
          });
        }
      }
      return entries;
    }, [tenantAgents, telemetry, completedTurns, scene.agents, adapted.pmSessionId, liveCrew]);

    // Atualiza o relógio dos balões a cada 1s enquanto houver balão ativo/recente e expira balões antigos
    React.useEffect(() => {
      if (speechBubbles.length === 0) return;
      const timer = window.setInterval(() => {
        setClockTick((n) => n + 1);
        const now = Date.now();
        setCompletedTurns((prev) => {
          let expired = false;
          const next: Record<string, CompletedBubbleTurn> = {};
          for (const [pk, item] of Object.entries(prev)) {
            if (!item.dismissed && now - item.finishedAt < COMPLETED_BUBBLE_TTL_MS) {
              next[pk] = item;
            } else {
              expired = true;
            }
          }
          return expired ? next : prev;
        });
      }, 1000);
      return () => window.clearInterval(timer);
    }, [speechBubbles.length]);

    // Posiciona imediatamente novos balões usando as coordenadas 3D do último frame
    React.useEffect(() => {
      if (lastFiguresRef.current.length > 0) {
        positionBubbles(lastFiguresRef.current);
      }
    }, [speechBubbles, positionBubbles]);

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
            const fig = scene.agents.find(
              (a: SceneAgent) => a.sessionId === ag.agentKey || a.key === ag.agentKey
            );
            setSelectedKey(fig ? fig.key : ag.agentKey);
            stageRef.current?.select(fig ? fig.key : ag.agentKey);
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 } },
          h(
            "button",
            {
              type: "button",
              "data-agent-profile-trigger": ag.name,
              title: `Abrir perfil de ${ag.name} na coluna lateral`,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                color: "inherit",
                font: "inherit",
                padding: 0,
                cursor: onOpenAgentProfile ? "pointer" : "inherit",
                textAlign: "left",
              },
              onClick: (ev: any) => {
                if (!onOpenAgentProfile) return;
                ev.stopPropagation();
                onOpenAgentProfile({ key: ag.agentKey, pubkey: ag.pubkey, name: ag.name });
              },
            },
            liveMatch?.picture
              ? h("img", { src: liveMatch.picture, alt: ag.name, style: { width: "16px", height: "16px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 } })
              : h("span", {
                  className: "of-dot",
                  "data-tone": liveTurn ? (liveTurn.state === "error" ? "failed" : "running") : ag.inBuzz ? "done" : "idle",
                }),
            h("span", { style: { fontSize: "11.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, ag.name)
          ),
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
        // Camada de balões de chat ao vivo ancorados sobre a cabeça dos bonequinhos 3D
        h(
          "div",
          {
            "data-floor3d-speech-layer": "true",
            style: {
              position: "absolute",
              inset: 0,
              zIndex: 18,
              pointerEvents: "none",
              overflow: "hidden",
            },
          },
          speechBubbles.map((b) => {
            const isDone = b.kind === "done";
            const isErr = b.kind === "error";
            const borderColor = isDone
              ? "rgba(16, 185, 129, 0.72)"
              : isErr
              ? "rgba(239, 68, 68, 0.72)"
              : "rgba(59, 130, 246, 0.65)";
            const accentColor = isDone ? "#34d399" : isErr ? "#f87171" : "#60a5fa";
            const handleOpenResponse = (e: any) => {
              e.stopPropagation();
              if (isDone) {
                setCompletedTurns((prev) => {
                  const cur = prev[b.agentPubkey];
                  if (!cur) return prev;
                  return { ...prev, [b.agentPubkey]: { ...cur, dismissed: true } };
                });
              }
              if (b.turn.channelId && onOpenTurnInSideChat) {
                onOpenTurnInSideChat(b.turn);
              } else if (onOpenAgentDm) {
                onOpenAgentDm({ key: b.agentKey, pubkey: b.agentPubkey, name: b.agentName });
              }
            };
            const handleDismiss = (e: any) => {
              e.stopPropagation();
              setCompletedTurns((prev) => {
                const cur = prev[b.agentPubkey];
                if (!cur) return prev;
                return { ...prev, [b.agentPubkey]: { ...cur, dismissed: true } };
              });
            };

            return h(
              "div",
              {
                key: `${b.figureKey}:${b.agentPubkey}`,
                "data-floor3d-speech-bubble": b.figureKey,
                "data-bubble-state": b.kind,
                ref: (el: HTMLDivElement | null) => {
                  if (el) bubbleNodesRef.current.set(b.figureKey, el);
                  else bubbleNodesRef.current.delete(b.figureKey);
                },
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  opacity: 0,
                  pointerEvents: "none",
                  willChange: "transform",
                  width: "224px",
                  maxWidth: "240px",
                },
                onClick: () => {
                  setSelectedKey(b.agentKey);
                  stageRef.current?.select(b.figureKey);
                },
              },
              h(
                "div",
                {
                  style: {
                    borderRadius: "10px",
                    border: `1px solid ${borderColor}`,
                    background: "rgba(15, 18, 24, 0.94)",
                    backdropFilter: "blur(10px)",
                    boxShadow: isDone
                      ? "0 10px 26px rgba(0,0,0,0.48), 0 0 18px rgba(16,185,129,0.16)"
                      : "0 10px 26px rgba(0,0,0,0.48), 0 0 18px rgba(59,130,246,0.16)",
                    padding: "7px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    cursor: "pointer",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 } },
                  isDone
                    ? h(
                        "span",
                        {
                          style: {
                            width: "14px",
                            height: "14px",
                            borderRadius: "999px",
                            background: "rgba(16, 185, 129, 0.22)",
                            color: "#34d399",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "9.5px",
                            fontWeight: 700,
                            flexShrink: 0,
                          },
                        },
                        "✓"
                      )
                    : h("span", {
                        style: {
                          width: "7px",
                          height: "7px",
                          borderRadius: "999px",
                          background: accentColor,
                          boxShadow: `0 0 8px ${accentColor}`,
                          animation: "of-pulse 1.5s ease-in-out infinite",
                          flexShrink: 0,
                        },
                      }),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--foreground)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      },
                    },
                    b.agentName
                  ),
                  h(
                    "span",
                    {
                      className: "of-mono",
                      style: {
                        fontSize: "9.5px",
                        color: accentColor,
                        flexShrink: 0,
                      },
                    },
                    isDone ? "Respondeu" : formatBubbleClock(b.turn.startedAt)
                  ),
                  isDone &&
                    h(
                      "button",
                      {
                        type: "button",
                        title: "Dispensar balão",
                        "aria-label": "Dispensar balão",
                        onClick: handleDismiss,
                        style: {
                          border: "none",
                          background: "transparent",
                          color: "var(--muted-foreground)",
                          cursor: "pointer",
                          padding: "0 2px",
                          fontSize: "12px",
                          lineHeight: 1,
                          flexShrink: 0,
                        },
                      },
                      "×"
                    )
                ),
                !isDone && b.turns.length > 1
                  ? h(
                      "div",
                      {
                        "data-floor3d-multi-session": String(b.turns.length),
                        style: { display: "flex", flexDirection: "column", gap: "4px" },
                      },
                      h(
                        "div",
                        { style: { fontSize: "9.5px", color: accentColor, fontWeight: 600 } },
                        `${b.turns.length} sessões simultâneas`
                      ),
                      ...b.turns.slice(0, 3).map((t, idx) =>
                        h(
                          "div",
                          {
                            key: `${t.channelId}:${t.threadRootId || t.messageId || idx}`,
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 6px",
                              borderRadius: "6px",
                              background: "rgba(255,255,255,0.04)",
                              fontSize: "10.5px",
                            },
                          },
                          h(
                            "span",
                            {
                              style: {
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: t.state === "error" ? "#fca5a5" : "rgba(229, 231, 235, 0.9)",
                              },
                              title: t.stepLabel,
                            },
                            t.stepLabel || "Pensando..."
                          ),
                          h("span", { className: "of-mono of-muted", style: { fontSize: "9px", flexShrink: 0 } }, formatBubbleClock(t.startedAt)),
                          h(
                            "button",
                            {
                              type: "button",
                              onClick: (ev: any) => {
                                ev.stopPropagation();
                                if (t.channelId && onOpenTurnInSideChat) onOpenTurnInSideChat(t);
                                else if (onOpenAgentDm) onOpenAgentDm({ key: b.agentKey, pubkey: b.agentPubkey, name: b.agentName });
                              },
                              style: {
                                border: "none",
                                background: "transparent",
                                color: accentColor,
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "9.5px",
                                fontWeight: 600,
                                flexShrink: 0,
                              },
                            },
                            "Ver ↗"
                          )
                        )
                      ),
                      b.turns.length > 3 &&
                        h("span", { className: "of-muted", style: { fontSize: "9.5px" } }, `+${b.turns.length - 3} sessões ativas`)
                    )
                  : h(
                      "div",
                      {
                        style: {
                          fontSize: "11px",
                          color: isErr ? "#fca5a5" : "rgba(229, 231, 235, 0.88)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.35,
                        },
                        title: b.turn.stepLabel,
                      },
                      isDone ? "Resposta pronta no chat do Buzz" : b.turn.stepLabel || "Pensando..."
                    ),
                isDone
                  ? h(
                      "button",
                      {
                        type: "button",
                        "data-floor3d-open-response": b.agentKey,
                        className: "of-btn",
                        "data-variant": "primary",
                        onClick: handleOpenResponse,
                        style: {
                          width: "100%",
                          justifyContent: "center",
                          padding: "4px 8px",
                          fontSize: "10.5px",
                          fontWeight: 600,
                          marginTop: "1px",
                        },
                      },
                      "Abrir resposta ↗"
                    )
                  : b.turns.length <= 1 &&
                    h(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "9.5px",
                          color: "var(--muted-foreground)",
                        },
                      },
                      h("span", { className: "of-mono" }, "Buzz ao vivo"),
                      h(
                        "button",
                        {
                          type: "button",
                          onClick: handleOpenResponse,
                          style: {
                            border: "none",
                            background: "transparent",
                            color: accentColor,
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "10px",
                            fontWeight: 600,
                          },
                        },
                        "Ver chat ↗"
                      )
                    )
              ),
              // Pontinha do balão de fala apontando para a cabeça do bonequinho 3D
              h("div", {
                style: {
                  width: 0,
                  height: 0,
                  margin: "0 auto",
                  borderLeft: "7px solid transparent",
                  borderRight: "7px solid transparent",
                  borderTop: `7px solid ${borderColor}`,
                },
              })
            );
          })
        ),
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
          const sceneAg = scene.agents.find((a: SceneAgent) => a.key === focusKey || a.sessionId === focusKey) || null;
          const matchedTenantAg =
            (sceneAg?.sessionId ? tenantAgents.find((a) => a.agentKey === sceneAg.sessionId) : null) ||
            tenantAgents.find((a) => a.agentKey === focusKey || a.name === focusKey) ||
            (sceneAg?.role === "pm"
              ? tenantAgents.find((a) => a.papel === "coo" || /bento|coo/i.test(a.name))
              : sceneAg?.role === "scout"
              ? tenantAgents.find((a) => a.papel === "oraculo" || /oraculo|oráculo|scout/i.test(a.name))
              : null) ||
            null;
          const matchedLive = matchedTenantAg
            ? liveCrew.find((c) => c.key === matchedTenantAg.agentKey || (matchedTenantAg.pubkey && c.pubkey?.toLowerCase() === matchedTenantAg.pubkey.toLowerCase()))
            : liveCrew.find((c) => c.key === focusKey || (sceneAg?.sessionId && c.key === sceneAg.sessionId)) || null;
          const liveTurn = matchedTenantAg ? turnOf(matchedTenantAg) : null;
          const areaTag = sceneAg?.area ? `Mirante · ${AREA_LABEL[sceneAg.area]}` : null;
          const displayTitle =
            matchedTenantAg?.name ||
            (sceneAg?.role === "pm"
              ? `${status.tenantManifest?.coo || "COO"} (${empresaNome})`
              : sceneAg?.role === "scout"
              ? "Oráculo · Scout"
              : sceneAg?.card?.item.title || areaTag || focusKey);
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
            (areaTag && matchedTenantAg?.funcao ? `${areaTag} — ${matchedTenantAg.funcao}` : areaTag) ||
            matchedTenantAg?.funcao ||
            sceneAg?.progress ||
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
                "button",
                {
                  type: "button",
                  title: `Abrir perfil de ${displayTitle} na coluna lateral`,
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    font: "inherit",
                    padding: 0,
                    cursor: onOpenAgentProfile && (matchedTenantAg || matchedLive) ? "pointer" : "default",
                    textAlign: "left",
                  },
                  onClick: () => {
                    if (onOpenAgentProfile && (matchedTenantAg || matchedLive)) {
                      onOpenAgentProfile({
                        key: matchedTenantAg?.agentKey || matchedLive?.key,
                        pubkey: matchedTenantAg?.pubkey || matchedLive?.pubkey,
                        name: displayTitle,
                      });
                    }
                  },
                },
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
