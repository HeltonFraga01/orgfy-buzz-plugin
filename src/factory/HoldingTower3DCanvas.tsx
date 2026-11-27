// Adaptado de CodeDen (MIT) commit b0b2a5a — Torre da Holding Cortexx / OrgFy (Maquete LEGO / Voxel 3D Multi-Andares)
// - Estética LEGO Architecture / Voxel: pódio com pinos LEGO, plantas em blocos voxel, personagens LEGO/Voxel,
//   fachadas de vidro temperado, iluminação interna quente em cada andar e marcadores externos 1F..4F
// - Navegação livre 3D: Orbit 360° até nível do piso (phi 0.18..1.50), Pan (botão direito ou Shift+arrastar),
//   Zoom profundo até close-up (frustum 2.0..26) no ponto do cursor e teclas W/A/S/D + Q/E
// - Janela flutuante Picture-in-Picture (PiP) nativa estilo YouTube (captureStream + requestPictureInPicture)
// - Telemetria 100% real clicável: pacotes na esteira e cápsulas no elevador ligados a PRs/cards/turnos reais

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Context } from "@buzz/author";
import { readPalette, type FloorPalette } from "./codeden-floor/floor/palette";
import { Lights } from "./codeden-floor/floor/lights";
import { Kit, colour, canvasOf } from "./codeden-floor/floor/kit";
import type { Rgb } from "./codeden-floor/oklch";
import type { HoldingControlPlaneSnapshot } from "../services/holding-service";
import type { FactoryStatusPayload, FactoryWorkItem } from "./factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "./buzz-live-telemetry";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import { buildCustomAvatar3D, type Avatar3DHandle } from "./Avatar3DBuilder";

export interface TowerLivePacket {
  id: string;
  label: string;
  stage: "building" | "verifying" | "failed" | "intake" | "merged" | "turn";
  detail: string;
  floorSlug: string;
  workItem?: FactoryWorkItem;
  turn?: LiveAgentTurn;
}

export interface HoldingTowerFloorInfo {
  slug: string;
  nome: string;
  estagio: string;
  isBoard?: boolean;
  agentesCount: number;
  workingCount: number;
  errorCount: number;
  openPrsCount: number;
  openIssuesCount: number;
  packets: TowerLivePacket[];
  agents: Array<{
    key?: string;
    pubkey?: string;
    name: string;
    role?: string;
    picture?: string;
    status: "active" | "working" | "planned" | "error";
    stepLabel?: string;
    turn?: LiveAgentTurn;
  }>;
}

export interface HoldingTower3DProps {
  holding?: HoldingControlPlaneSnapshot | null;
  status?: FactoryStatusPayload;
  liveCrew: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  activeTenant: string;
  onEnterFloor: (slug: string) => void;
  onSelectItem?: (item: FactoryWorkItem) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenTurnInSideChat?: (turn: LiveAgentTurn) => void;
  onOpenChannel?: (slug: string) => void;
  onOpenBoard?: (slug: string) => void;
}

type TowerSelection =
  | { kind: "floor"; floor: HoldingTowerFloorInfo }
  | { kind: "packet"; packet: TowerLivePacket; floor: HoldingTowerFloorInfo }
  | { kind: "agent"; agent: HoldingTowerFloorInfo["agents"][number]; floor: HoldingTowerFloorInfo };

function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  const rr = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gg = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bb = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return alpha >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${alpha})`;
}

function stageColorRgb(stage: TowerLivePacket["stage"], p: FloorPalette): Rgb {
  switch (stage) {
    case "failed":
      return [0.95, 0.3, 0.34];
    case "verifying":
      return [0.22, 0.84, 0.56];
    case "building":
    case "turn":
      return p.accent.reviewer;
    case "merged":
      return [0.32, 0.78, 0.52];
    default:
      return [0.96, 0.72, 0.24];
  }
}

function sharpenCanvasTexture(tex: THREE.CanvasTexture, maxAnisotropy: number): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(16, maxAnisotropy));
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeFloorWallScreenTexture(
  kit: Kit,
  floorNum: number,
  floor: HoldingTowerFloorInfo,
  accent: Rgb,
  status?: FactoryStatusPayload,
  maxAnisotropy = 8
): THREE.CanvasTexture {
  const logicalW = 768;
  const logicalH = 224;
  const c = canvasOf(logicalW * 2, logicalH * 2);
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  const accCss = rgbToCss(accent);

  g.fillStyle = "#0e121a";
  g.fillRect(0, 0, logicalW, logicalH);

  g.strokeStyle = "rgba(255,255,255,0.045)";
  g.lineWidth = 1;
  for (let x = 24; x < logicalW; x += 48) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, logicalH);
    g.stroke();
  }

  g.fillStyle = accCss;
  g.fillRect(0, 0, 10, logicalH);
  g.fillStyle = "rgba(255,255,255,0.045)";
  g.fillRect(10, 0, logicalW - 10, 56);
  g.fillStyle = accCss;
  g.fillRect(10, 54, logicalW - 10, 3);

  g.fillStyle = "#f8fafc";
  g.font = "700 26px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText(`${floorNum}F · ${floor.nome.toUpperCase().slice(0, 26)}`, 26, 37);

  const pillText = floor.errorCount > 0 ? `${floor.errorCount} ALERTA` : floor.workingCount > 0 ? `${floor.workingCount} AO VIVO` : floor.estagio.toUpperCase();
  g.fillStyle = rgbToCss(accent, 0.18);
  g.fillRect(logicalW - 168, 12, 148, 30);
  g.strokeStyle = accCss;
  g.lineWidth = 1.5;
  g.strokeRect(logicalW - 168, 12, 148, 30);
  g.fillStyle = accCss;
  g.font = "700 14px ui-monospace, Menlo, monospace";
  g.textAlign = "center";
  g.fillText(pillText.slice(0, 14), logicalW - 94, 32);
  g.textAlign = "left";

  const cards = floor.isBoard
    ? [
        { k: "CONSELHEIROS", v: String(floor.agentesCount), sub: `${floor.workingCount} em turno` },
        { k: "MERGES (7D)", v: String(status?.stats?.merged7d ?? 0), sub: "holding cortexx" },
        { k: "GASTO HOJE", v: `$${(status?.spendToday?.usd ?? 0).toFixed(2)}`, sub: "finops ao vivo" },
      ]
    : [
        { k: "AGENTES", v: String(floor.agentesCount), sub: `${floor.workingCount} ativos agora` },
        { k: "ESTEIRA", v: String(floor.packets.length), sub: floor.packets.length > 0 ? "itens circulando" : "fila livre" },
        { k: "PRS / ISSUES", v: `${floor.openPrsCount}/${floor.openIssuesCount}`, sub: floor.estagio },
      ];

  cards.forEach((card, idx) => {
    const bx = 26 + idx * 242;
    const by = 74;
    const bw = 226;
    const bh = 128;
    g.fillStyle = "rgba(255,255,255,0.04)";
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = "rgba(255,255,255,0.11)";
    g.lineWidth = 1.5;
    g.strokeRect(bx, by, bw, bh);

    g.fillStyle = "#94a3b8";
    g.font = "700 13px ui-monospace, Menlo, monospace";
    g.fillText(card.k, bx + 16, by + 28);

    g.fillStyle = "#f8fafc";
    g.font = "700 42px ui-monospace, Menlo, monospace";
    g.fillText(card.v, bx + 16, by + 80);

    g.fillStyle = accCss;
    g.font = "500 14px -apple-system, sans-serif";
    g.fillText(card.sub.slice(0, 22), bx + 16, by + 110);
  });

  return sharpenCanvasTexture(kit.canvasTexture(c), maxAnisotropy);
}

function makeFloorBadgeTexture(kit: Kit, label: string, accent: Rgb, maxAnisotropy = 8): THREE.CanvasTexture {
  const logicalW = 128;
  const logicalH = 72;
  const c = canvasOf(logicalW * 2, logicalH * 2);
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  g.fillStyle = "#0f131b";
  g.fillRect(0, 0, logicalW, logicalH);
  g.strokeStyle = rgbToCss(accent);
  g.lineWidth = 6;
  g.strokeRect(4, 4, logicalW - 8, logicalH - 8);
  g.fillStyle = "#f8fafc";
  g.font = "700 38px ui-monospace, Menlo, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, logicalW / 2, logicalH / 2 + 2);
  return sharpenCanvasTexture(kit.canvasTexture(c), maxAnisotropy);
}

function makeDeskScreenTexture(kit: Kit, accent: Rgb, seed: number, maxAnisotropy = 8): THREE.CanvasTexture {
  const logicalW = 128;
  const logicalH = 80;
  const c = canvasOf(logicalW * 2, logicalH * 2);
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  g.fillStyle = "#0b1120";
  g.fillRect(0, 0, logicalW, logicalH);
  g.fillStyle = rgbToCss(accent);
  g.fillRect(8, 10, 42, 6);
  g.fillStyle = "rgba(148,163,184,0.55)";
  for (let row = 0; row < 5; row += 1) {
    const w = 34 + ((seed * 23 + row * 19) % 72);
    g.fillRect(8, 22 + row * 10, Math.min(110, w), 5);
  }
  return sharpenCanvasTexture(kit.canvasTexture(c), maxAnisotropy);
}

/** Balãozinho minimalista de "pensando / conversando" (• • • azul ou ! vermelho), sem texto poluindo a torre. */
function makeThinkingBubbleTexture(
  kit: Kit,
  kind: "working" | "error",
  maxAnisotropy = 8
): THREE.CanvasTexture {
  const logicalW = 96;
  const logicalH = 66;
  const c = canvasOf(logicalW * 2, logicalH * 2);
  const g = c.getContext("2d")!;
  g.scale(2, 2);

  const isErr = kind === "error";
  const fill = isErr ? "rgba(239, 68, 68, 0.92)" : "rgba(59, 130, 246, 0.92)";
  const stroke = isErr ? "#fca5a5" : "#93c5fd";

  const x = 10;
  const y = 8;
  const w = 76;
  const h = 42;
  const r = 16;

  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + w * 0.56, y + h);
  g.lineTo(x + w * 0.46, y + h + 11);
  g.lineTo(x + w * 0.39, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();

  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = stroke;
  g.lineWidth = 2.5;
  g.stroke();

  g.fillStyle = "#ffffff";
  if (isErr) {
    g.font = "800 26px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("!", x + w / 2, y + h / 2 + 1);
  } else {
    for (const dx of [-15, 0, 15]) {
      g.beginPath();
      g.arc(x + w / 2 + dx, y + h / 2, 4.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  return sharpenCanvasTexture(kit.canvasTexture(c), maxAnisotropy);
}

/** Planta estilo LEGO / Voxel em blocos empilhados. */
function buildVoxelPlantProp(kit: Kit, p: FloorPalette, matSteel: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.42, 0.36, 0.42)), matSteel);
  pot.position.y = 0.18;
  pot.castShadow = true;
  g.add(pot);

  const trunk = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.12, 0.24, 0.12)), kit.matte([0.36, 0.24, 0.15], { roughness: 0.8 }));
  trunk.position.y = 0.44;
  g.add(trunk);

  const leafA = kit.matte(p.lamp.green, { roughness: 0.7 });
  const leafB = kit.matte([p.lamp.green[0] * 0.76, p.lamp.green[1] * 0.76, p.lamp.green[2] * 0.76], { roughness: 0.74 });
  const tiers: Array<[number, number, number, number]> = [
    [0.48, 0.2, 0.48, 0.62],
    [0.34, 0.18, 0.34, 0.8],
    [0.18, 0.14, 0.18, 0.94],
  ];
  tiers.forEach(([w, h, d, y], i) => {
    const blk = new THREE.Mesh(kit.own(new THREE.BoxGeometry(w, h, d)), i % 2 === 0 ? leafA : leafB);
    blk.position.y = y;
    blk.castShadow = true;
    g.add(blk);
  });
  return g;
}

/** Estação de trabalho em blocos LEGO/Voxel (mesa, cadeira, monitor aceso, teclado e caneca). */
function buildWorkstationUnit(
  kit: Kit,
  matWood: THREE.Material,
  matSteel: THREE.Material,
  matChrome: THREE.Material,
  matLeather: THREE.Material,
  matPaper: THREE.Material,
  screenMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();

  const top = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1.06, 0.08, 0.62)), matWood);
  top.position.set(0, 0.62, 0.38);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  for (const lx of [-0.46, 0.46]) {
    const leg = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.58, 0.54)), matSteel);
    leg.position.set(lx, 0.29, 0.38);
    leg.castShadow = true;
    g.add(leg);
  }

  const stand = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.1, 0.14, 0.08)), matChrome);
  stand.position.set(0, 0.72, 0.52);
  g.add(stand);

  const bezel = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.54, 0.32, 0.06)), matSteel);
  bezel.position.set(0, 0.88, 0.52);
  bezel.castShadow = true;
  g.add(bezel);

  const display = new THREE.Mesh(kit.own(new THREE.PlaneGeometry(0.46, 0.24)), screenMat);
  display.position.set(0, 0.88, 0.488);
  display.rotation.y = Math.PI;
  g.add(display);

  const kb = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.34, 0.025, 0.12)), matSteel);
  kb.position.set(-0.04, 0.67, 0.28);
  g.add(kb);

  const mug = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.075, 0.08, 0.075)), matPaper);
  mug.position.set(0.36, 0.7, 0.28);
  g.add(mug);

  // Cadeira em blocos LEGO
  const base = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.38, 0.05, 0.38)), matChrome);
  base.position.set(0, 0.025, -0.14);
  g.add(base);
  const stem = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.28, 0.08)), matSteel);
  stem.position.set(0, 0.18, -0.14);
  g.add(stem);
  const seat = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.44, 0.08, 0.42)), matLeather);
  seat.position.set(0, 0.34, -0.14);
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.44, 0.46, 0.08)), matLeather);
  back.position.set(0, 0.58, -0.32);
  back.castShadow = true;
  g.add(back);

  return g;
}

function buildBoardChair(
  kit: Kit,
  matLeather: THREE.Material,
  matSteel: THREE.Material,
  matChrome: THREE.Material
): THREE.Group {
  const chair = new THREE.Group();
  const base = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.4, 0.05, 0.4)), matChrome);
  base.position.y = 0.025;
  chair.add(base);
  const stem = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.3, 0.08)), matSteel);
  stem.position.y = 0.18;
  chair.add(stem);
  const seat = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.48, 0.09, 0.46)), matLeather);
  seat.position.y = 0.36;
  seat.castShadow = true;
  chair.add(seat);
  const back = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.46, 0.54, 0.09)), matLeather);
  back.position.set(0, 0.64, -0.2);
  back.castShadow = true;
  chair.add(back);
  return chair;
}

export function createHoldingTower3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function HoldingTower3DCanvas(props: HoldingTower3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const mountRef = React.useRef<HTMLDivElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const pipVideoRef = React.useRef<HTMLVideoElement | null>(null);

    const [selection, setSelection] = React.useState<TowerSelection | null>(null);
    const [hoveredSlug, setHoveredSlug] = React.useState<string | null>(null);
    const [fitTick, setFitTick] = React.useState(0);
    const [darkFactoryMode, setDarkFactoryMode] = React.useState(true);
    const [explodedView, setExplodedView] = React.useState(false);
    const [isolateSelected, setIsolateSelected] = React.useState(false);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [isPipActive, setIsPipActive] = React.useState(false);

    // Refs de controle de câmera suave e visualização por camadas (60fps sem recriar WebGL)
    const desiredTargetRef = React.useRef<THREE.Vector3>(new THREE.Vector3(0, 6.2, 0));
    const desiredFrustumRef = React.useRef<number>(15.8);
    const desiredPhiRef = React.useRef<number | null>(null);
    const explodedRef = React.useRef<boolean>(false);
    const isolateRef = React.useRef<boolean>(false);
    const selectedSlugRef = React.useRef<string | null>(null);
    const hoveredSlugRef = React.useRef<string | null>(null);
    explodedRef.current = explodedView;
    isolateRef.current = isolateSelected;
    selectedSlugRef.current = selection?.floor.slug || null;
    hoveredSlugRef.current = hoveredSlug;

    const floors = React.useMemo<HoldingTowerFloorInfo[]>(() => {
      const byPk = props.telemetry?.byPubkey || {};
      const crew = props.liveCrew || [];
      const activeItems = props.status
        ? [...(props.status.inProgress || []), ...(props.status.backlog || []), ...(props.status.recent || []).slice(0, 3)]
        : [];

      const empresas =
        props.holding?.empresas && props.holding.empresas.length > 0
          ? props.holding.empresas
          : [
              { slug: "orgfy", nome: "OrgFy Core", estagio: "operacional", agentesTotal: 16, agentesProntos: 16 },
              { slug: "lumen-iptv", nome: "Lumen IPTV", estagio: "operacional", agentesTotal: 6, agentesProntos: 6 },
              { slug: "saas-tributario", nome: "SaaS Tributário", estagio: "planejado", agentesTotal: 0, agentesProntos: 0 },
            ];

      const subsidiaryFloors: HoldingTowerFloorInfo[] = empresas.map((emp: any) => {
        const slugLower = String(emp.slug || "").toLowerCase();
        const empCanal = String(emp.canal || "").trim().toLowerCase();
        const manifestAgents: any[] = Array.isArray(emp.agentes) ? emp.agentes : [];

        // Resolve cada agente a partir do manifesto real da empresa (1:1 com empresas/<slug>.json), cruzando com liveCrew
        let workingCount = 0;
        let errorCount = 0;
        const resolvedAgents =
          manifestAgents.length > 0
            ? manifestAgents.map((ma: any) => {
                const maName = String(ma.name || "Agente");
                const maPk = String(ma.pubkey || "").trim().toLowerCase();
                const liveMatch = crew.find(
                  (c) =>
                    (maPk && c.pubkey && c.pubkey.toLowerCase() === maPk) ||
                    c.name.toLowerCase() === maName.toLowerCase()
                );
                const pk = (liveMatch?.pubkey || maPk || "").toLowerCase();
                const rawTurn = pk ? byPk[pk] : undefined;
                // Isolamento por canal: agentes compartilhados (COO/CEO) só acendem balão no andar do canal daquele turno
                const turn =
                  rawTurn && (!empCanal || !rawTurn.channelId || rawTurn.channelId.toLowerCase() === empCanal)
                    ? rawTurn
                    : undefined;
                const isErr = turn?.state === "error";
                const isWork = Boolean(turn && !isErr);
                if (isErr) errorCount += 1;
                if (isWork) workingCount += 1;
                return {
                  key: liveMatch?.key,
                  pubkey: pk || undefined,
                  name: maName,
                  role: String(ma.papel || liveMatch?.model || ma.model || "agente"),
                  picture: liveMatch?.picture,
                  stepLabel: turn?.stepLabel,
                  turn,
                  status: (isErr ? "error" : isWork ? "working" : liveMatch ? "active" : "planned") as
                    | "active"
                    | "working"
                    | "planned"
                    | "error",
                };
              })
            : crew
                .filter((a) => {
                  const n = a.name.toLowerCase();
                  if (slugLower === "orgfy") return n.startsWith("orgfy") && !n.includes("iris");
                  if (slugLower.includes("lumen")) return n.includes("lumen");
                  return n.includes(slugLower);
                })
                .map((a) => {
                  const rawTurn = a.pubkey ? byPk[a.pubkey.toLowerCase()] : undefined;
                  const turn =
                    rawTurn && (!empCanal || !rawTurn.channelId || rawTurn.channelId.toLowerCase() === empCanal)
                      ? rawTurn
                      : undefined;
                  const isErr = turn?.state === "error";
                  const isWork = Boolean(turn && !isErr);
                  if (isErr) errorCount += 1;
                  if (isWork) workingCount += 1;
                  return {
                    key: a.key,
                    pubkey: a.pubkey,
                    name: a.name,
                    role: a.model,
                    picture: a.picture,
                    stepLabel: turn?.stepLabel,
                    turn,
                    status: (isErr ? "error" : isWork ? "working" : "active") as "active" | "working" | "planned" | "error",
                  };
                });

        const agents = resolvedAgents;

        const packets: TowerLivePacket[] = [];
        if (slugLower === String(props.activeTenant || "").toLowerCase()) {
          for (const it of activeItems.slice(0, 6)) {
            const st: TowerLivePacket["stage"] =
              it.stage === "failed" || it.stage === "reverted"
                ? "failed"
                : it.stage === "verifying" || it.stage === "watching"
                ? "verifying"
                : it.stage === "building"
                ? "building"
                : it.stage === "merged"
                ? "merged"
                : "intake";
            packets.push({
              id: it.id,
              label: it.title,
              stage: st,
              detail: it.note || it.reason || it.step || it.stage,
              floorSlug: emp.slug,
              workItem: it,
            });
          }
        }
        for (const ag of agents) {
          if (ag.turn && packets.length < 6) {
            packets.push({
              id: `turn-${ag.pubkey || ag.name}`,
              label: `${ag.name}: ${ag.turn.stepLabel || "executando"}`,
              stage: ag.turn.state === "error" ? "failed" : "turn",
              detail: ag.turn.toolName ? `Tool: ${ag.turn.toolName}` : "Turno ao vivo no Buzz",
              floorSlug: emp.slug,
              turn: ag.turn,
            });
          }
        }

        const openPrsCount =
          slugLower === String(props.activeTenant || "").toLowerCase()
            ? props.status?.wip?.openPrs ?? 0
            : Number(emp.prsAbertos ?? emp.emRevisao ?? 0);
        const openIssuesCount =
          slugLower === String(props.activeTenant || "").toLowerCase()
            ? props.status?.backlog?.length ?? 0
            : Number(emp.abertas ?? 0);

        return {
          slug: emp.slug,
          nome: emp.nome || emp.slug,
          estagio: emp.estagio || "operacional",
          agentesCount: agents.length || emp.agentesTotal || 0,
          workingCount,
          errorCount,
          openPrsCount,
          openIssuesCount,
          packets,
          agents:
            agents.length > 0
              ? agents
              : emp.estagio === "planejado"
              ? [{ name: `${emp.nome} PO`, status: "planned" as const }]
              : [{ name: `${emp.nome} Dev`, status: "active" as const }],
        };
      });

      const boardCrew = crew.filter((a) => /iris|conselho/i.test(a.name));
      let boardWork = 0;
      let boardErr = 0;
      const boardAgents =
        boardCrew.length > 0
          ? boardCrew.slice(0, 6).map((a) => {
              const turn = a.pubkey ? byPk[a.pubkey.toLowerCase()] : undefined;
              const isErr = turn?.state === "error";
              const isWork = Boolean(turn && !isErr);
              if (isErr) boardErr += 1;
              if (isWork) boardWork += 1;
              return {
                key: a.key,
                pubkey: a.pubkey,
                name: a.name,
                role: a.model,
                picture: a.picture,
                stepLabel: turn?.stepLabel,
                turn,
                status: (isErr ? "error" : isWork ? "working" : "active") as "active" | "working" | "planned" | "error",
              };
            })
          : [
              { name: "OrgFy Iris", role: "CEO Master", status: "active" as const },
              { name: "Conselho CTO", role: "CTO", status: "active" as const },
              { name: "Conselho CRO", role: "CRO", status: "active" as const },
              { name: "Conselho CPO", role: "CPO", status: "active" as const },
              { name: "Conselho COO", role: "COO", status: "active" as const },
              { name: "Conselho CGO", role: "CGO", status: "active" as const },
            ];

      const penthouse: HoldingTowerFloorInfo = {
        slug: "board",
        nome: "Conselho da Holding & Iris",
        estagio: "cobertura",
        isBoard: true,
        agentesCount: boardAgents.length,
        workingCount: boardWork,
        errorCount: boardErr,
        openPrsCount: 0,
        openIssuesCount: 0,
        packets: [],
        agents: boardAgents,
      };

      return [...subsidiaryFloors, penthouse];
    }, [props.holding, props.status, props.liveCrew, props.telemetry, props.activeTenant]);

    const floorsSignature = floors
      .map((f) => `${f.slug}:${f.workingCount}:${f.errorCount}:${f.agentesCount}:${f.packets.map((p) => `${p.id}:${p.stage}`).join(",")}`)
      .join("|");

    // ── PICTURE-IN-PICTURE (TELINHA FLUTUANTE ESTILO YOUTUBE FORA DO BUZZ) ──
    const handleTogglePiP = async () => {
      try {
        if ((document as any).pictureInPictureElement) {
          await (document as any).exitPictureInPicture();
          setIsPipActive(false);
          return;
        }
        const canvas = canvasRef.current;
        if (!canvas || typeof (canvas as any).captureStream !== "function") return;

        let video = pipVideoRef.current;
        if (!video) {
          video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.style.position = "fixed";
          video.style.width = "1px";
          video.style.height = "1px";
          video.style.opacity = "0";
          video.style.pointerEvents = "none";
          document.body.appendChild(video);
          pipVideoRef.current = video;
          video.addEventListener("leavepictureinpicture", () => setIsPipActive(false));
        }

        const stream = (canvas as any).captureStream(30);
        video.srcObject = stream;
        await video.play();
        if (typeof (video as any).requestPictureInPicture === "function") {
          await (video as any).requestPictureInPicture();
          setIsPipActive(true);
        }
      } catch {
        setIsPipActive(false);
      }
    };

    React.useEffect(() => {
      return () => {
        if (pipVideoRef.current) {
          try {
            pipVideoRef.current.remove();
          } catch {}
          pipVideoRef.current = null;
        }
      };
    }, []);

    React.useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const palette = readPalette();
      const kit = new Kit();
      const width = Math.max(320, container.clientWidth || 780);
      const height = Math.max(320, container.clientHeight || 540);

      const scene = new THREE.Scene();
      scene.background = darkFactoryMode ? new THREE.Color(0x090c12) : new THREE.Color(0xeef2f7);

      const FLOOR_H = 3.65;
      const totalH = floors.length * FLOOR_H;
      const defaultCenterY = Math.max(2.6, totalH * 0.46);
      const defaultFrustum = Math.max(14.0, totalH * 1.12);

      let theta = 0.66;
      let phi = 1.02;
      let frustum = defaultFrustum;
      const target = new THREE.Vector3(0, defaultCenterY, 0);
      desiredTargetRef.current.set(0, defaultCenterY, 0);
      desiredFrustumRef.current = defaultFrustum;
      desiredPhiRef.current = null;

      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2,
        (frustum * aspect) / 2,
        frustum / 2,
        -frustum / 2,
        0.1,
        180
      );

      const updateCamera = () => {
        const w = Math.max(320, container.clientWidth || width);
        const hh = Math.max(320, container.clientHeight || height);
        const asp = w / hh;
        camera.left = (-frustum * asp) / 2;
        camera.right = (frustum * asp) / 2;
        camera.top = frustum / 2;
        camera.bottom = -frustum / 2;
        const dist = 42;
        camera.position.set(
          target.x + dist * Math.sin(phi) * Math.sin(theta),
          target.y + dist * Math.cos(phi),
          target.z + dist * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(target);
        camera.updateProjectionMatrix();
      };
      updateCamera();

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true, // garante captura fluida no Picture-in-Picture (PiP)
          powerPreference: "high-performance",
        });
      } catch {
        kit.dispose();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = darkFactoryMode ? 1.24 : 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = "";
      container.appendChild(renderer.domElement);
      canvasRef.current = renderer.domElement;

      const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 8;
      // IBL PBR instantâneo via RoomEnvironment + PMREMGenerator (profundidade real em metais, vidros e lajes)
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      const envRT = pmremGenerator.fromScene(envScene, 0.04);
      scene.environment = envRT.texture;
      (scene as any).environmentIntensity = darkFactoryMode ? 0.48 : 0.78;
      envScene.dispose();

      const lights = new Lights();
      scene.add(lights.hemi, lights.sun, lights.sun.target);
      lights.set([{ x0: -7.5, x1: 7.5, y0: 0, y1: totalH + 2, z0: -5, z1: 5 }], palette, false);
      lights.hemi.intensity = darkFactoryMode ? 0.95 : 1.1;

      if (!darkFactoryMode) {
        const dayFill = new THREE.DirectionalLight(0xffffff, 0.85);
        dayFill.position.set(-10, 20, 12);
        scene.add(dayFill);
      } else {
        // Luz frontal suave para que 1F/2F/3F tenham ótima leitura em close-up
        const frontFill = new THREE.DirectionalLight(0xdbeafe, 0.52);
        frontFill.position.set(12, totalH * 0.55, 16);
        scene.add(frontFill);
      }

      const matPodium = kit.matte(darkFactoryMode ? [0.1, 0.12, 0.16] : [0.72, 0.75, 0.8], { roughness: 0.85 });
      const matSlab = kit.matte(darkFactoryMode ? [0.15, 0.17, 0.22] : [0.83, 0.85, 0.89], { roughness: 0.8 });
      const matFloorWood = kit.matte(darkFactoryMode ? [0.28, 0.22, 0.17] : [0.68, 0.57, 0.44], { roughness: 0.72 });
      const matFloorSlate = kit.matte(darkFactoryMode ? [0.12, 0.14, 0.19] : [0.46, 0.49, 0.54], { roughness: 0.86 });
      const matWall = kit.matte(darkFactoryMode ? [0.18, 0.2, 0.26] : [0.89, 0.91, 0.94], { roughness: 0.84 });
      const matSteel = kit.matte(palette.steel, { roughness: 0.36, metalness: 0.55 });
      const matChrome = kit.matte(palette.chrome, { roughness: 0.18, metalness: 0.82 });
      const matWood = kit.matte(palette.wood, { roughness: 0.55 });
      const matLeather = kit.matte(darkFactoryMode ? [0.16, 0.18, 0.24] : [0.28, 0.31, 0.38], { roughness: 0.68 });
      const matPaper = kit.matte(palette.paper, { roughness: 0.42 });
      const matGlass = kit.own(
        new THREE.MeshPhysicalMaterial({
          color: darkFactoryMode ? 0x7dd3fc : 0x3b82f6,
          transparent: true,
          opacity: darkFactoryMode ? 0.16 : 0.22,
          roughness: 0.06,
          metalness: 0.08,
          reflectivity: 0.9,
        })
      );

      const floorW = 11.8;
      const floorD = 7.0;

      // ── PÓDIO BASEPLATE LEGO ARCHITECTURE SOB O 1F (InstancedMesh = 1 draw call!) ──
      const podium = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW + 1.2, 0.55, floorD + 1.2)), matPodium);
      podium.position.set(0, -0.54, 0);
      podium.receiveShadow = true;
      scene.add(podium);

      const studPositions: number[] = [];
      for (let sx = -floorW / 2 - 0.3; sx <= floorW / 2 + 0.31; sx += 0.62) {
        studPositions.push(sx);
      }
      const studGeo = kit.own(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12));
      const studInstanced = new THREE.InstancedMesh(studGeo, matPodium, studPositions.length);
      const dummyStud = new THREE.Object3D();
      studPositions.forEach((sx, i) => {
        dummyStud.position.set(sx, -0.23, floorD / 2 + 0.32);
        dummyStud.updateMatrix();
        studInstanced.setMatrixAt(i, dummyStud.matrix);
      });
      studInstanced.instanceMatrix.needsUpdate = true;
      scene.add(studInstanced);

      // ── ELEVADOR PANORÂMICO DE DADOS ──
      const shaftX = -4.9;
      const shaftZ = -2.45;
      const shaft = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1.1, totalH + 0.5, 1.1)), matGlass);
      shaft.position.set(shaftX, totalH / 2, shaftZ);
      scene.add(shaft);

      for (const sx of [-0.54, 0.54]) {
        for (const sz of [-0.54, 0.54]) {
          const rail = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.032, 0.032, totalH + 0.65, 8)), matSteel);
          rail.position.set(shaftX + sx, totalH / 2, shaftZ + sz);
          scene.add(rail);
        }
      }

      const realElevatorEvents: Array<{
        packet: TowerLivePacket;
        floor: HoldingTowerFloorInfo;
        fromY: number;
        toY: number;
      }> = [];
      const topFloorY = (floors.length - 1) * FLOOR_H + 0.65;
      floors.forEach((f, fIdx) => {
        if (f.isBoard) return;
        for (const ag of f.agents) {
          if (ag.turn) {
            realElevatorEvents.push({
              packet: {
                id: `elev-${ag.pubkey || ag.name}`,
                label: `${ag.name} → Conselho`,
                stage: ag.turn.state === "error" ? "failed" : "turn",
                detail: ag.turn.stepLabel || "Telemetria ao vivo no Buzz",
                floorSlug: f.slug,
                turn: ag.turn,
              },
              floor: f,
              fromY: fIdx * FLOOR_H + 0.65,
              toY: topFloorY,
            });
          }
        }
      });

      const dataCapsules: Array<{
        mesh: THREE.Group;
        fromY: number;
        toY: number;
        speed: number;
        offset: number;
      }> = [];

      const hitTargets: THREE.Object3D[] = [];
      const selectionByHit = new WeakMap<THREE.Object3D, { sel: TowerSelection; focusPos: THREE.Vector3 }>();

      if (realElevatorEvents.length > 0) {
        realElevatorEvents.slice(0, 6).forEach((ev, i) => {
          const capRgb = stageColorRgb(ev.packet.stage, palette);
          const capGroup = new THREE.Group();
          const frame = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.68, 0.34, 0.68)), matSteel);
          capGroup.add(frame);
          const core = new THREE.Mesh(
            kit.own(new THREE.BoxGeometry(0.54, 0.24, 0.54)),
            kit.matte(capRgb, { roughness: 0.2, emissive: colour(capRgb), emissiveIntensity: 0.9 })
          );
          capGroup.add(core);
          capGroup.position.set(shaftX, ev.fromY, shaftZ);
          scene.add(capGroup);

          hitTargets.push(frame);
          selectionByHit.set(frame, {
            sel: { kind: "packet", packet: ev.packet, floor: ev.floor },
            focusPos: new THREE.Vector3(shaftX * 0.5, (ev.fromY + ev.toY) / 2, shaftZ * 0.5),
          });
          dataCapsules.push({
            mesh: capGroup,
            fromY: ev.fromY,
            toY: ev.toY,
            speed: 0.2 + (i % 3) * 0.05,
            offset: i / Math.max(1, realElevatorEvents.length),
          });
        });
      } else {
        const activeIdx = Math.max(0, floors.findIndex((f) => f.slug === props.activeTenant));
        const cabin = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.76, 0.9, 0.76)),
          kit.matte(palette.steel, { roughness: 0.35, metalness: 0.5 })
        );
        cabin.position.set(shaftX, activeIdx * FLOOR_H + 0.52, shaftZ);
        scene.add(cabin);
        const cabinLight = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.64, 0.08, 0.64)),
          kit.matte(palette.lane, { roughness: 0.2, emissive: colour(palette.lane), emissiveIntensity: 0.75 })
        );
        cabinLight.position.set(shaftX, activeIdx * FLOOR_H + 0.94, shaftZ);
        scene.add(cabinLight);
      }

      // ── CONSTRUÇÃO DE CADA ANDAR ──
      const floorEntries: Array<{
        slug: string;
        index: number;
        group: THREE.Group;
        edgeMat: THREE.LineBasicMaterial;
      }> = [];
      const avatars: Array<{ handle: Avatar3DHandle; phase: number; working: boolean; error: boolean }> = [];
      const thinkingSprites: Array<{ sprite: THREE.Sprite; baseY: number; phase: number }> = [];
      const thinkingMatWorking = kit.own(
        new THREE.SpriteMaterial({
          map: makeThinkingBubbleTexture(kit, "working", maxAniso),
          transparent: true,
          depthWrite: false,
        })
      );
      const thinkingMatError = kit.own(
        new THREE.SpriteMaterial({
          map: makeThinkingBubbleTexture(kit, "error", maxAniso),
          transparent: true,
          depthWrite: false,
        })
      );
      const attachThinkingBubble = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        kind: "working" | "error",
        phase: number
      ) => {
        const sprite = new THREE.Sprite(kind === "error" ? thinkingMatError : thinkingMatWorking);
        sprite.position.set(x, y, z);
        sprite.scale.set(0.68, 0.46, 1);
        sprite.renderOrder = 10;
        parent.add(sprite);
        thinkingSprites.push({ sprite, baseY: y, phase });
      };
      const conveyorPackets: Array<{ mesh: THREE.Group; y: number; z: number; speed: number; offset: number }> = [];
      const warningBeacons: Array<{ mesh: THREE.Mesh; phase: number }> = [];
      const rackLeds: THREE.Mesh[] = [];
      const holoCores: THREE.Object3D[] = [];

      const sharedSlabGeo = kit.own(new THREE.BoxGeometry(floorW, 0.28, floorD));
      const sharedSlabEdgesGeo = kit.own(new THREE.EdgesGeometry(sharedSlabGeo));

      floors.forEach((floor, fIdx) => {
        const y0 = fIdx * FLOOR_H;
        const floorGroup = new THREE.Group();
        floorGroup.position.set(0, y0, 0);
        scene.add(floorGroup);

        const floorAccent: Rgb =
          floor.errorCount > 0
            ? [0.95, 0.3, 0.34]
            : floor.isBoard
            ? [0.96, 0.78, 0.24]
            : floor.workingCount > 0
            ? palette.accent.reviewer
            : floor.estagio === "planejado"
            ? [0.45, 0.5, 0.6]
            : palette.lane;

        const matAccent = kit.matte(floorAccent, {
          roughness: 0.28,
          emissive: colour(floorAccent),
          emissiveIntensity: darkFactoryMode ? 0.68 : 0.36,
        });

        // Iluminação interna quente por andar para eliminar zonas escuras no 1F/2F/3F
        if (darkFactoryMode) {
          const interiorLight = new THREE.PointLight(floor.isBoard ? 0xfff1d6 : 0xe0f2fe, 0.85, 11.5);
          interiorLight.position.set(0.5, FLOOR_H - 0.85, 0.5);
          floorGroup.add(interiorLight);
        }

        const slab = new THREE.Mesh(sharedSlabGeo, matSlab);
        slab.position.set(0, -0.14, 0);
        slab.receiveShadow = true;
        slab.castShadow = true;
        floorGroup.add(slab);

        const edgeMat = kit.own(
          new THREE.LineBasicMaterial({
            color: colour(floorAccent),
            transparent: true,
            opacity: darkFactoryMode ? 0.22 : 0.18,
          })
        );
        const slabEdges = new THREE.LineSegments(sharedSlabEdgesGeo, edgeMat);
        slabEdges.position.set(0, -0.14, 0);
        floorGroup.add(slabEdges);
        floorEntries.push({ slug: floor.slug, index: fIdx, group: floorGroup, edgeMat });

        const trimFront = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW + 0.05, 0.075, 0.08)), matAccent);
        trimFront.position.set(0, -0.02, floorD / 2);
        floorGroup.add(trimFront);

        const trimRight = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.075, floorD + 0.05)), matAccent);
        trimRight.position.set(floorW / 2, -0.02, 0);
        floorGroup.add(trimRight);

        const wallH = FLOOR_H - 0.3;
        const backWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW, wallH, 0.2)), matWall);
        backWall.position.set(0, wallH / 2, -floorD / 2 + 0.1);
        backWall.receiveShadow = true;
        floorGroup.add(backWall);

        const leftWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.2, wallH, floorD)), matWall);
        leftWall.position.set(-floorW / 2 + 0.1, wallH / 2, 0);
        leftWall.receiveShadow = true;
        floorGroup.add(leftWall);

        const backCap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW + 0.04, 0.06, 0.24)), matSteel);
        backCap.position.set(0, wallH + 0.01, -floorD / 2 + 0.1);
        floorGroup.add(backCap);

        const rightGlass = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.05, wallH - 0.15, 3.4)), matGlass);
        rightGlass.position.set(floorW / 2 - 0.12, wallH / 2, -1.65);
        floorGroup.add(rightGlass);

        for (const [px, pz] of [
          [floorW / 2 - 0.14, -floorD / 2 + 0.14],
          [floorW / 2 - 0.14, 0.05],
          [floorW / 2 - 0.14, floorD / 2 - 0.14],
          [-floorW / 2 + 0.14, floorD / 2 - 0.14],
        ]) {
          const col = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.16, wallH, 0.16)), matSteel);
          col.position.set(px, wallH / 2, pz);
          col.castShadow = true;
          floorGroup.add(col);
        }

        const badgeTex = makeFloorBadgeTexture(kit, `${fIdx + 1}F`, floorAccent, maxAniso);
        const badgeMesh = new THREE.Mesh(
          kit.own(new THREE.PlaneGeometry(0.58, 0.34)),
          kit.own(new THREE.MeshBasicMaterial({ map: badgeTex }))
        );
        badgeMesh.position.set(floorW / 2 - 0.14, wallH - 0.38, floorD / 2 - 0.05);
        floorGroup.add(badgeMesh);

        const screenBezel = new THREE.Mesh(kit.own(new THREE.BoxGeometry(4.6, 1.38, 0.1)), kit.matte(palette.sign, { roughness: 0.45 }));
        screenBezel.position.set(0.95, wallH - 1.05, -floorD / 2 + 0.22);
        screenBezel.castShadow = true;
        floorGroup.add(screenBezel);

        const screenTex = makeFloorWallScreenTexture(kit, fIdx + 1, floor, floorAccent, props.status, maxAniso);
        const screenPlane = new THREE.Mesh(
          kit.own(new THREE.PlaneGeometry(4.42, 1.24)),
          kit.own(new THREE.MeshBasicMaterial({ map: screenTex }))
        );
        screenPlane.position.set(0.95, wallH - 1.05, -floorD / 2 + 0.275);
        floorGroup.add(screenPlane);

        if (floor.errorCount > 0) {
          const beacon = new THREE.Mesh(
            kit.own(new THREE.BoxGeometry(0.24, 0.26, 0.24)),
            kit.matte([0.98, 0.24, 0.28], { roughness: 0.2, emissive: 0xef4444, emissiveIntensity: 1.2 })
          );
          beacon.position.set(floorW / 2 - 0.7, 0.14, floorD / 2 - 0.65);
          floorGroup.add(beacon);
          warningBeacons.push({ mesh: beacon, phase: fIdx * 1.1 });
        }

        const cornerPlant = buildVoxelPlantProp(kit, palette, matSteel);
        cornerPlant.position.set(floorW / 2 - 0.85, 0, -floorD / 2 + 0.85);
        floorGroup.add(cornerPlant);

        if (floor.isBoard) {
          const rug = new THREE.Mesh(
            kit.own(new THREE.BoxGeometry(8.2, 0.025, 4.7)),
            kit.matte(darkFactoryMode ? [0.19, 0.21, 0.28] : [0.84, 0.83, 0.8], { roughness: 0.95 })
          );
          rug.position.set(0.6, 0.012, 0.25);
          rug.receiveShadow = true;
          floorGroup.add(rug);

          for (const rz of [-2.1, 2.6]) {
            const rugLine = new THREE.Mesh(kit.own(new THREE.BoxGeometry(8.24, 0.016, 0.045)), matAccent);
            rugLine.position.set(0.6, 0.024, rz);
            floorGroup.add(rugLine);
          }

          const tableFrame = new THREE.Mesh(kit.own(new THREE.BoxGeometry(4.9, 0.08, 2.08)), matSteel);
          tableFrame.position.set(0.6, 0.72, 0.25);
          tableFrame.castShadow = true;
          floorGroup.add(tableFrame);

          const tableTop = new THREE.Mesh(kit.own(new THREE.BoxGeometry(4.76, 0.07, 1.94)), matWood);
          tableTop.position.set(0.6, 0.79, 0.25);
          tableTop.castShadow = true;
          tableTop.receiveShadow = true;
          floorGroup.add(tableTop);

          const inlay = new THREE.Mesh(kit.own(new THREE.BoxGeometry(3.1, 0.015, 0.07)), matAccent);
          inlay.position.set(0.6, 0.835, 0.25);
          floorGroup.add(inlay);

          for (const lx of [-0.95, 2.15]) {
            const ped = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.22, 0.68, 0.95)), matSteel);
            ped.position.set(lx, 0.34, 0.25);
            ped.castShadow = true;
            floorGroup.add(ped);
          }

          const holoGroup = new THREE.Group();
          holoGroup.position.set(0.6, 1.56, 0.25);
          const holo = new THREE.Mesh(
            kit.own(new THREE.OctahedronGeometry(0.32, 0)),
            kit.own(new THREE.MeshBasicMaterial({ color: colour(floorAccent), wireframe: true, transparent: true, opacity: 0.82 }))
          );
          holoGroup.add(holo);
          const holoRing = new THREE.Mesh(
            kit.own(new THREE.TorusGeometry(0.46, 0.014, 8, 28)),
            kit.own(new THREE.MeshBasicMaterial({ color: colour(palette.accent.reviewer), transparent: true, opacity: 0.55 }))
          );
          holoRing.rotation.x = Math.PI / 2;
          holoGroup.add(holoRing);
          floorGroup.add(holoGroup);
          holoCores.push(holoGroup);

          const slots: Array<{ pos: [number, number, number]; rotY: number; lap: [number, number, number] }> = [
            { pos: [-2.4, 0, 0.25], rotY: Math.PI / 2, lap: [-1.4, 0.83, 0.25] },
            { pos: [-0.65, 0, 1.78], rotY: Math.PI, lap: [-0.65, 0.83, 0.98] },
            { pos: [0.6, 0, 1.78], rotY: Math.PI, lap: [0.6, 0.83, 0.98] },
            { pos: [1.85, 0, 1.78], rotY: Math.PI, lap: [1.85, 0.83, 0.98] },
            { pos: [-0.25, 0, -1.28], rotY: 0, lap: [-0.25, 0.83, -0.48] },
            { pos: [1.45, 0, -1.28], rotY: 0, lap: [1.45, 0.83, -0.48] },
          ];
          floor.agents.slice(0, slots.length).forEach((ag, idx) => {
            const slot = slots[idx];
            const seatWrap = new THREE.Group();
            seatWrap.position.set(...slot.pos);
            seatWrap.rotation.y = slot.rotY;
            seatWrap.add(buildBoardChair(kit, matLeather, matSteel, matChrome));

            const av = buildCustomAvatar3D(kit, palette, ag, { seatHeight: 0.4, scale: 0.96, showPortraitMedallion: false });
            seatWrap.add(av.root);
            floorGroup.add(seatWrap);

            const lap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.36, 0.025, 0.24)), matSteel);
            lap.position.set(...slot.lap);
            lap.rotation.y = slot.rotY;
            floorGroup.add(lap);

            if (ag.status === "working") {
              const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(slot.pos[0], 1.15, slot.pos[2]),
                new THREE.Vector3((slot.pos[0] + 0.6) * 0.5, 1.9, (slot.pos[2] + 0.25) * 0.5),
                new THREE.Vector3(0.6, 1.56, 0.25)
              );
              const beam = new THREE.Mesh(
                kit.own(new THREE.TubeGeometry(curve, 18, 0.016, 6, false)),
                kit.own(new THREE.MeshBasicMaterial({ color: colour(palette.accent.reviewer), transparent: true, opacity: 0.68 }))
              );
              floorGroup.add(beam);
            }

            if (ag.status === "working" || ag.status === "error") {
              attachThinkingBubble(floorGroup, slot.pos[0], 1.78, slot.pos[2], ag.status, idx * 1.15);
            }

            const aHit = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.85, 1.35, 0.85)), kit.own(new THREE.MeshBasicMaterial({ visible: false })));
            aHit.position.set(0, 0.68, 0);
            seatWrap.add(aHit);
            hitTargets.push(aHit);
            selectionByHit.set(aHit, {
              sel: { kind: "agent", agent: ag, floor },
              focusPos: new THREE.Vector3(slot.pos[0], y0 + 0.9, slot.pos[2]),
            });

            avatars.push({ handle: av, phase: idx * 0.95, working: ag.status === "working", error: ag.status === "error" });
          });
        } else if (floor.estagio === "planejado" && floor.agents.length <= 2) {
          const blueprintFloor = new THREE.Mesh(
            kit.own(new THREE.BoxGeometry(8.8, 0.025, 4.8)),
            kit.matte(darkFactoryMode ? [0.12, 0.17, 0.28] : [0.76, 0.83, 0.94], { roughness: 0.9 })
          );
          blueprintFloor.position.set(0.6, 0.012, 0.25);
          floorGroup.add(blueprintFloor);

          const draftTable = new THREE.Mesh(kit.own(new THREE.BoxGeometry(2.6, 0.08, 1.3)), matWood);
          draftTable.position.set(0.4, 0.72, 0.1);
          draftTable.castShadow = true;
          floorGroup.add(draftTable);
          for (const lx of [-1.05, 1.05]) {
            const leg = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.1, 0.7, 1.1)), matSteel);
            leg.position.set(0.4 + lx, 0.35, 0.1);
            floorGroup.add(leg);
          }
          const roll = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.055, 0.055, 0.75, 12)), kit.matte(palette.blueprint, { roughness: 0.5 }));
          roll.rotation.z = Math.PI / 2;
          roll.position.set(0.4, 0.81, 0.1);
          floorGroup.add(roll);

          floor.agents.slice(0, 2).forEach((ag, idx) => {
            const av = buildCustomAvatar3D(kit, palette, ag, { seatHeight: 0.02, scale: 0.92, showPortraitMedallion: false });
            av.root.position.set(-1.4 + idx * 1.4, 0, 0.1);
            av.root.rotation.y = Math.PI / 2;
            floorGroup.add(av.root);
            avatars.push({ handle: av, phase: fIdx * 1.4 + idx, working: false, error: false });
          });
        } else {
          const workZone = new THREE.Mesh(kit.own(new THREE.BoxGeometry(9.2, 0.022, 3.0)), matFloorWood);
          workZone.position.set(0.85, 0.011, -1.1);
          workZone.receiveShadow = true;
          floorGroup.add(workZone);

          const beltZone = new THREE.Mesh(kit.own(new THREE.BoxGeometry(9.2, 0.022, 2.3)), matFloorSlate);
          beltZone.position.set(0.85, 0.011, 1.85);
          beltZone.receiveShadow = true;
          floorGroup.add(beltZone);

          const dividerLine = new THREE.Mesh(kit.own(new THREE.BoxGeometry(9.2, 0.016, 0.05)), matAccent);
          dividerLine.position.set(0.85, 0.024, 0.52);
          floorGroup.add(dividerLine);

          const rack = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.75, 1.7, 0.7)), matSteel);
          rack.position.set(-4.85, 0.85, 0.65);
          rack.castShadow = true;
          floorGroup.add(rack);
          for (let r = 0; r < 5; r += 1) {
            const led = new THREE.Mesh(
              kit.own(new THREE.BoxGeometry(0.45, 0.036, 0.02)),
              kit.own(new THREE.MeshBasicMaterial({ color: r % 2 === 0 ? 0x38bdf8 : 0x34d399 }))
            );
            led.position.set(-4.85, 0.35 + r * 0.27, 1.01);
            floorGroup.add(led);
            rackLeds.push(led);
          }

          const belt = new THREE.Mesh(kit.own(new THREE.BoxGeometry(8.2, 0.14, 0.92)), matSteel);
          belt.position.set(0.85, 0.18, 1.9);
          belt.receiveShadow = true;
          belt.castShadow = true;
          floorGroup.add(belt);

          for (const rz of [1.42, 2.38]) {
            const rail = new THREE.Mesh(kit.own(new THREE.BoxGeometry(8.26, 0.04, 0.045)), matAccent);
            rail.position.set(0.85, 0.27, rz);
            floorGroup.add(rail);
          }

          const pktTotal = floor.packets.length;
          floor.packets.forEach((pktData, pIdx) => {
            const pktRgb = stageColorRgb(pktData.stage, palette);
            const pktGroup = new THREE.Group();
            const crate = new THREE.Mesh(
              kit.own(new THREE.BoxGeometry(0.56, 0.28, 0.48)),
              kit.matte(darkFactoryMode ? [0.18, 0.2, 0.26] : [0.3, 0.34, 0.4], { roughness: 0.45 })
            );
            crate.castShadow = true;
            pktGroup.add(crate);

            const capStripe = new THREE.Mesh(
              kit.own(new THREE.BoxGeometry(0.58, 0.06, 0.5)),
              kit.matte(pktRgb, { roughness: 0.25, emissive: colour(pktRgb), emissiveIntensity: 0.78 })
            );
            capStripe.position.y = 0.14;
            pktGroup.add(capStripe);

            pktGroup.position.set(-2.8, 0.41, 1.9);
            floorGroup.add(pktGroup);

            hitTargets.push(crate);
            selectionByHit.set(crate, {
              sel: { kind: "packet", packet: pktData, floor },
              focusPos: new THREE.Vector3(0.8, y0 + 0.7, 1.9),
            });

            conveyorPackets.push({
              mesh: pktGroup,
              y: 0.41,
              z: 1.9,
              speed: pktData.stage === "building" || pktData.stage === "turn" ? 1.35 : 0.72,
              offset: pIdx / Math.max(1, pktTotal),
            });
          });

          const screenMatA = kit.own(new THREE.MeshBasicMaterial({ map: makeDeskScreenTexture(kit, floorAccent, fIdx * 7 + 1, maxAniso) }));
          const screenMatB = kit.own(new THREE.MeshBasicMaterial({ map: makeDeskScreenTexture(kit, palette.accent.reviewer, fIdx * 7 + 2, maxAniso) }));

          // Renderiza TODOS os agentes correspondentes da empresa (1 fileira até 6; 2 fileiras organizadas de 7 a 16)
          const floorAgents = floor.agents.slice(0, 16);
          const totalAg = floorAgents.length;
          const useTwoRows = totalAg > 6;
          const backRowCount = useTwoRows ? Math.ceil(totalAg / 2) : totalAg;
          const frontRowCount = useTwoRows ? totalAg - backRowCount : 0;
          const unitScale = useTwoRows ? 0.76 : 0.94;
          const avatarScale = useTwoRows ? 0.76 : 0.92;

          floorAgents.forEach((ag, idx) => {
            const isFrontRow = useTwoRows && idx >= backRowCount;
            const rowCount = isFrontRow ? frontRowCount : backRowCount;
            const colIdx = isFrontRow ? idx - backRowCount : idx;
            const xMin = -3.35;
            const xMax = 4.65;
            const span = xMax - xMin;
            const dx = rowCount === 1 ? 0.65 : xMin + (colIdx / Math.max(1, rowCount - 1)) * span;
            const dz = useTwoRows ? (isFrontRow ? -0.22 : -1.78) : -1.05;

            const station = buildWorkstationUnit(
              kit,
              matWood,
              matSteel,
              matChrome,
              matLeather,
              matPaper,
              idx % 2 === 0 ? screenMatA : screenMatB
            );
            station.scale.setScalar(unitScale);
            station.position.set(dx, 0, dz);
            floorGroup.add(station);

            const av = buildCustomAvatar3D(kit, palette, ag, { seatHeight: 0.38 * unitScale, scale: avatarScale, showPortraitMedallion: false });
            av.root.position.set(dx, 0, dz - 0.14 * unitScale);
            floorGroup.add(av.root);

            if (ag.status === "working" || ag.status === "error") {
              attachThinkingBubble(floorGroup, dx, 1.72 * (useTwoRows ? 0.88 : 1), dz - 0.14 * unitScale, ag.status, fIdx * 1.9 + idx * 0.7);
            }

            const aHit = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.8, 1.35, 0.8)), kit.own(new THREE.MeshBasicMaterial({ visible: false })));
            aHit.position.set(dx, 0.68, dz - 0.14 * unitScale);
            floorGroup.add(aHit);
            hitTargets.push(aHit);
            selectionByHit.set(aHit, {
              sel: { kind: "agent", agent: ag, floor },
              focusPos: new THREE.Vector3(dx, y0 + 0.85, dz),
            });

            avatars.push({ handle: av, phase: fIdx * 1.7 + idx * 0.85, working: ag.status === "working", error: ag.status === "error" });
          });
        }

        const floorHit = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(floorW, 0.32, floorD)),
          kit.own(new THREE.MeshBasicMaterial({ visible: false }))
        );
        floorHit.position.set(0, -0.14, 0);
        floorGroup.add(floorHit);
        hitTargets.push(floorHit);
        selectionByHit.set(floorHit, {
          sel: { kind: "floor", floor },
          focusPos: new THREE.Vector3(0, y0 + 1.2, 0),
        });
      });

      // ── NAVEGAÇÃO 3D LIVRE: ORBIT + PAN (BOTÃO DIREITO/SHIFT) + ZOOM PROFUNDO NO CURSOR + WASD/QE ──
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragMode: "none" | "orbit" | "pan" = "none";
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      let isHoveringCanvas = false;

      const pickTarget = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(hitTargets, false);
        for (const hit of hits) {
          const entry = selectionByHit.get(hit.object);
          if (entry) return entry;
        }
        return null;
      };

      const onContextMenu = (e: MouseEvent) => e.preventDefault();

      const onDown = (e: MouseEvent) => {
        dragMode = e.button === 2 || e.button === 1 || e.shiftKey ? "pan" : "orbit";
        moved = false;
        lastX = e.clientX;
        lastY = e.clientY;
        desiredPhiRef.current = null;
        renderer.domElement.style.cursor = dragMode === "pan" ? "move" : "grabbing";
      };

      const getEffectiveTotalH = () =>
        floors.length * FLOOR_H + (explodedRef.current ? Math.max(0, floors.length - 1) * 1.95 : 0);

      const onMove = (e: MouseEvent) => {
        if (dragMode !== "none") {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
          lastX = e.clientX;
          lastY = e.clientY;

          if (dragMode === "orbit") {
            theta -= dx * 0.0085;
            // Ângulo phi ampliado até 1.50 rad (~86°): permite abaixar quase até o nível do piso!
            phi = Math.max(0.18, Math.min(1.5, phi - dy * 0.007));
          } else {
            // Pan 3D proporcional ao nível de zoom atual (cobre toda a altura da torre mesmo explodida)
            const rect = renderer.domElement.getBoundingClientRect();
            const unitsPerPx = frustum / Math.max(200, rect.height);
            const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
            const up = new THREE.Vector3(0, 1, 0);
            target.addScaledVector(right, -dx * unitsPerPx);
            target.addScaledVector(up, dy * unitsPerPx);
            target.x = Math.max(-12, Math.min(12, target.x));
            target.z = Math.max(-9, Math.min(9, target.z));
            target.y = Math.max(-1.0, Math.min(getEffectiveTotalH() + 4, target.y));
            desiredTargetRef.current.copy(target);
          }
          updateCamera();
          return;
        }
        const hit = pickTarget(e);
        setHoveredSlug(hit ? hit.sel.floor.slug : null);
        renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      };

      const onUp = (e: MouseEvent) => {
        if (dragMode === "orbit" && !moved) {
          const hit = pickTarget(e);
          if (hit) {
            setSelection(hit.sel);
            const stepH = FLOOR_H + (explodedRef.current ? 1.95 : 0);
            const fIdx = Math.max(0, floors.findIndex((fl) => fl.slug === hit.sel.floor.slug));
            desiredTargetRef.current.set(hit.focusPos.x, fIdx * stepH + 1.0, hit.focusPos.z);
            desiredFrustumRef.current = hit.sel.kind === "floor" ? 8.2 : 4.6;
          } else {
            setSelection(null);
            const effH = getEffectiveTotalH();
            desiredTargetRef.current.set(0, Math.max(2.6, effH * 0.48), 0);
            desiredFrustumRef.current = Math.max(14.5, effH * 1.18);
          }
        }
        dragMode = "none";
        renderer.domElement.style.cursor = "grab";
      };

      const onDblClick = (e: MouseEvent) => {
        const hit = pickTarget(e);
        if (hit) props.onEnterFloor(hit.sel.floor.slug);
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = renderer.domElement.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const prevFrustum = frustum;
        // Zoom amplo: de 48 (torre inteira explodida com folga) até 2.0 (close-up de uma mesa/personagem!)
        const factor = e.deltaY > 0 ? 1.1 : 0.91;
        const nextF = Math.max(2.0, Math.min(48, frustum * factor));
        const deltaF = prevFrustum - nextF;

        // Desloca suavemente o alvo na direção do cursor ao aproximar o zoom
        if (deltaF > 0) {
          const asp = rect.width / Math.max(1, rect.height);
          const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
          target.addScaledVector(right, nx * deltaF * asp * 0.25);
          target.y = Math.max(-1.0, Math.min(getEffectiveTotalH() + 4, target.y + ny * deltaF * 0.25));
          desiredTargetRef.current.copy(target);
        }
        frustum = nextF;
        desiredFrustumRef.current = nextF;
        updateCamera();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (!isHoveringCanvas) return;
        const step = Math.max(0.25, frustum * 0.06);
        const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
        const forward = new THREE.Vector3(-Math.sin(theta), 0, -Math.cos(theta));
        let handled = true;
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") desiredTargetRef.current.addScaledVector(forward, step);
        else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") desiredTargetRef.current.addScaledVector(forward, -step);
        else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") desiredTargetRef.current.addScaledVector(right, -step);
        else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") desiredTargetRef.current.addScaledVector(right, step);
        else if (e.key === "e" || e.key === "E") desiredTargetRef.current.y = Math.min(getEffectiveTotalH() + 4, desiredTargetRef.current.y + step);
        else if (e.key === "q" || e.key === "Q") desiredTargetRef.current.y = Math.max(-1, desiredTargetRef.current.y - step);
        else handled = false;
        if (handled) e.preventDefault();
      };

      const dom = renderer.domElement;
      dom.style.cursor = "grab";
      dom.addEventListener("contextmenu", onContextMenu);
      dom.addEventListener("mousedown", onDown);
      dom.addEventListener("mousemove", onMove);
      dom.addEventListener("dblclick", onDblClick);
      dom.addEventListener("mouseenter", () => { isHoveringCanvas = true; });
      dom.addEventListener("mouseleave", () => { isHoveringCanvas = false; });
      window.addEventListener("mouseup", onUp);
      window.addEventListener("keydown", onKeyDown);
      dom.addEventListener("wheel", onWheel, { passive: false });

      let rafId = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Visualização por Camadas (Vista Explodida + Isolamento/Cutaway + Highlight EdgesGeometry a 60fps)
        const explodeGap = explodedRef.current ? 1.95 : 0;
        const selSlug = selectedSlugRef.current;
        const hovSlug = hoveredSlugRef.current;
        const selIdx = selSlug ? floorEntries.findIndex((fe) => fe.slug === selSlug) : -1;
        for (const fe of floorEntries) {
          const targetY = fe.index * (FLOOR_H + explodeGap);
          if (Math.abs(fe.group.position.y - targetY) > 0.005) {
            fe.group.position.y += (targetY - fe.group.position.y) * 0.14;
          }
          fe.group.visible = !(isolateRef.current && selIdx >= 0 && fe.index > selIdx);
          const isSel = fe.slug === selSlug;
          const isHov = fe.slug === hovSlug;
          fe.edgeMat.opacity = isSel ? 0.85 : isHov ? 0.55 : darkFactoryMode ? 0.22 : 0.18;
        }

        let camDirty = false;
        if (target.distanceTo(desiredTargetRef.current) > 0.01) {
          target.lerp(desiredTargetRef.current, 0.12);
          camDirty = true;
        }
        if (Math.abs(frustum - desiredFrustumRef.current) > 0.015) {
          frustum += (desiredFrustumRef.current - frustum) * 0.12;
          camDirty = true;
        }
        if (desiredPhiRef.current !== null && Math.abs(phi - desiredPhiRef.current) > 0.005) {
          phi += (desiredPhiRef.current - phi) * 0.12;
          camDirty = true;
        }
        if (camDirty) updateCamera();

        for (const a of avatars) {
          a.handle.animate(t, a.phase, { working: a.working, error: a.error });
        }

        for (const cap of dataCapsules) {
          const frac = (t * cap.speed + cap.offset) % 1;
          const pingPong = frac < 0.5 ? frac * 2 : (1 - frac) * 2;
          cap.mesh.position.y = cap.fromY + pingPong * Math.max(0.5, cap.toY - cap.fromY);
          cap.mesh.rotation.y = t * 1.1;
        }

        for (const pkt of conveyorPackets) {
          const frac = (t * pkt.speed * 0.14 + pkt.offset) % 1;
          pkt.mesh.position.x = -2.9 + frac * 7.4;
          pkt.mesh.position.y = pkt.y + Math.sin(t * 3.8 + pkt.offset * 6) * 0.015;
        }

        for (let i = 0; i < rackLeds.length; i += 1) {
          rackLeds[i].visible = Math.sin(t * 3.4 + i * 1.5) > -0.65;
        }

        for (const holo of holoCores) {
          holo.rotation.y = t * 0.8;
          holo.position.y = 1.56 + Math.sin(t * 1.7) * 0.045;
        }

        for (const b of warningBeacons) {
          b.mesh.scale.setScalar(1 + Math.sin(t * 7 + b.phase) * 0.14);
        }

        for (const sp of thinkingSprites) {
          sp.sprite.position.y = sp.baseY + Math.sin(t * 3.4 + sp.phase) * 0.065;
          const pulse = 1 + Math.sin(t * 4.6 + sp.phase) * 0.07;
          sp.sprite.scale.set(0.68 * pulse, 0.46 * pulse, 1);
        }

        renderer.render(scene, camera);
      };
      animate();

      const ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              const w = Math.max(320, container.clientWidth || width);
              const hh = Math.max(320, container.clientHeight || height);
              renderer.setSize(w, hh);
              updateCamera();
            })
          : null;
      ro?.observe(container);

      return () => {
        cancelAnimationFrame(rafId);
        ro?.disconnect();
        dom.removeEventListener("contextmenu", onContextMenu);
        dom.removeEventListener("mousedown", onDown);
        dom.removeEventListener("mousemove", onMove);
        dom.removeEventListener("dblclick", onDblClick);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("keydown", onKeyDown);
        dom.removeEventListener("wheel", onWheel);
        envRT.dispose();
        pmremGenerator.dispose();
        lights.dispose();
        kit.dispose();
        renderer.dispose();
      };
    }, [floorsSignature, fitTick, darkFactoryMode, props.activeTenant]);

    const selectedSlug = selection?.floor.slug || null;
    const activeFloorCard = selection?.floor || floors.find((f) => f.slug === hoveredSlug) || null;

    const focusFloorBySlug = (slug: string | null) => {
      const stepH = 3.65 + (explodedRef.current ? 1.95 : 0);
      if (!slug) {
        setSelection(null);
        const effH = floors.length * 3.65 + (explodedRef.current ? (floors.length - 1) * 1.95 : 0);
        desiredTargetRef.current.set(0, Math.max(2.6, effH * 0.48), 0);
        desiredFrustumRef.current = Math.max(14.5, effH * 1.18);
        return;
      }
      const idx = floors.findIndex((f) => f.slug === slug);
      if (idx >= 0) {
        setSelection({ kind: "floor", floor: floors[idx] });
        desiredTargetRef.current.set(0, idx * stepH + 1.0, 0);
        desiredFrustumRef.current = 6.8;
      }
    };

    const handleEyeLevelView = () => {
      const idx = selectedSlug ? Math.max(0, floors.findIndex((f) => f.slug === selectedSlug)) : 0;
      const stepH = 3.65 + (explodedRef.current ? 1.95 : 0);
      desiredTargetRef.current.set(0, idx * stepH + 0.85, 0);
      desiredFrustumRef.current = 4.4;
      desiredPhiRef.current = 1.42; // ângulo bem baixo, quase no nível do piso!
    };

    const handleToggleExploded = () => {
      setExplodedView((prev) => {
        const next = !prev;
        const effH = floors.length * 3.65 + (next ? (floors.length - 1) * 1.95 : 0);
        desiredTargetRef.current.set(0, Math.max(2.6, effH * 0.48), 0);
        desiredFrustumRef.current = Math.max(14.5, effH * 1.18);
        return next;
      });
    };

    const totalLivePackets = floors.reduce((sum, f) => sum + f.packets.length, 0);

    return h(
      "div",
      {
        "data-holding-tower-3d": "true",
        "data-holding-tower-sculpted": "true",
        "data-holding-tower-lego": "true",
        style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: "560px" },
      },
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
            background: darkFactoryMode ? "#090c12" : "#eef2f7",
            overflow: "hidden",
          },
        },
        h("div", { ref: mountRef, style: { width: "100%", height: "100%" } }),

        // Seletor rápido de andares (Elevador na esquerda)
        h(
          "div",
          {
            style: {
              position: "absolute",
              top: "12px",
              left: "12px",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "rgba(14, 17, 24, 0.92)",
              backdropFilter: "blur(10px)",
            },
          },
          h("div", { style: { fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--muted-foreground)", padding: "0 4px 3px" } }, "TORRE CORTEXX"),
          [...floors].reverse().map((f, revIdx) => {
            const floorNum = floors.length - revIdx;
            const active = selectedSlug === f.slug;
            return h(
              "button",
              {
                key: f.slug,
                type: "button",
                className: "of-btn",
                "data-variant": active ? "primary" : undefined,
                style: { justifyContent: "space-between", fontSize: "11px", padding: "4px 8px", minWidth: "178px" },
                onClick: () => focusFloorBySlug(active ? null : f.slug),
              },
              h("span", null, `${floorNum}F · ${f.isBoard ? "Conselho" : f.nome}`),
              h(
                "span",
                { className: "of-mono", style: { fontSize: "10px", opacity: 0.85 } },
                f.errorCount > 0 ? `!${f.errorCount}` : f.workingCount > 0 ? `⚡${f.workingCount}` : f.packets.length > 0 ? `📦${f.packets.length}` : `${f.agentesCount}`
              )
            );
          })
        ),

        // Card flutuante contextual (Pacote / Agente / Andar)
        (selection || activeFloorCard) &&
          h(
            "div",
            {
              "data-tower-inspector-card": "true",
              style: {
                position: "absolute",
                top: "12px",
                right: "12px",
                zIndex: 22,
                width: "286px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                background: "rgba(15, 18, 24, 0.95)",
                backdropFilter: "blur(10px)",
                padding: "11px 13px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              },
            },
            selection?.kind === "packet"
              ? [
                  h(
                    "div",
                    { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                    h("strong", { style: { fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, selection.packet.label),
                    h("span", { className: "of-pill", "data-tone": selection.packet.stage === "failed" ? "failed" : "running", style: { fontSize: "10px" } }, selection.packet.stage)
                  ),
                  h("div", { key: "d", className: "of-muted", style: { fontSize: "11px" } }, `${selection.floor.nome} · ${selection.packet.detail}`),
                  h(
                    "div",
                    { key: "a", style: { display: "flex", gap: "6px" } },
                    selection.packet.workItem && props.onSelectItem &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          "data-variant": "primary",
                          style: { flex: 1, justifyContent: "center", fontSize: "11px" },
                          onClick: () => props.onSelectItem!(selection.packet.workItem!),
                        },
                        "Inspecionar Card/PR ↗"
                      ),
                    selection.packet.turn && props.onOpenTurnInSideChat &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          "data-variant": "primary",
                          style: { flex: 1, justifyContent: "center", fontSize: "11px" },
                          onClick: () => props.onOpenTurnInSideChat!(selection.packet.turn!),
                        },
                        "Abrir turno no chat ↗"
                      )
                  ),
                ]
              : selection?.kind === "agent"
              ? [
                  h(
                    "div",
                    { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                    h("strong", { style: { fontSize: "12.5px" } }, selection.agent.name),
                    h(
                      "span",
                      { className: "of-pill", "data-tone": selection.agent.status === "error" ? "failed" : selection.agent.status === "working" ? "running" : "done", style: { fontSize: "10px" } },
                      selection.agent.status === "working" ? "Em turno" : selection.agent.status === "error" ? "Erro" : "Online"
                    )
                  ),
                  h("div", { key: "d", className: "of-muted", style: { fontSize: "11px" } }, selection.agent.stepLabel || `${selection.floor.nome} · ${selection.agent.role || "Agente"}`),
                  h(
                    "div",
                    { key: "a", style: { display: "flex", gap: "6px" } },
                    props.onOpenAgentDm && selection.agent.pubkey &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          "data-variant": "primary",
                          style: { flex: 1, justifyContent: "center", fontSize: "11px" },
                          onClick: () => props.onOpenAgentDm!({ key: selection.agent.key, pubkey: selection.agent.pubkey, name: selection.agent.name }),
                        },
                        "Abrir chat ↗"
                      ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "of-btn",
                        style: { fontSize: "11px" },
                        onClick: () => props.onEnterFloor(selection.floor.slug),
                      },
                      "Entrar no Andar"
                    )
                  ),
                ]
              : activeFloorCard && [
                  h(
                    "div",
                    { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                    h("strong", { style: { fontSize: "12.5px" } }, activeFloorCard.nome),
                    h(
                      "span",
                      {
                        className: "of-pill",
                        "data-tone": activeFloorCard.errorCount > 0 ? "failed" : activeFloorCard.workingCount > 0 ? "running" : "done",
                        style: { fontSize: "10px" },
                      },
                      activeFloorCard.estagio
                    )
                  ),
                  h(
                    "div",
                    { key: "d", className: "of-muted", style: { fontSize: "11px" } },
                    `${activeFloorCard.agentesCount} agentes · ${activeFloorCard.workingCount} em turno · ${activeFloorCard.packets.length} item(ns) na esteira`
                  ),
                  h(
                    "div",
                    { key: "a", style: { display: "flex", gap: "6px" } },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "of-btn",
                        "data-variant": "primary",
                        style: { flex: 1, justifyContent: "center", fontSize: "11px" },
                        onClick: () => props.onEnterFloor(activeFloorCard.slug),
                      },
                      activeFloorCard.isBoard ? "Entrar na Sala 3D ↗" : "Entrar no Andar 3D ↗"
                    ),
                    props.onOpenChannel &&
                      h(
                        "button",
                        {
                          type: "button",
                          className: "of-btn",
                          style: { fontSize: "11px" },
                          onClick: () => props.onOpenChannel!(activeFloorCard.slug),
                        },
                        "Canal"
                      )
                  ),
                ]
          ),

        // Controles no canto inferior direito (Ângulo Piso, Flutuar PiP, Dia/Noite, Tela cheia, Fit)
        h(
          "div",
          { style: { position: "absolute", right: "12px", bottom: "12px", zIndex: 20, display: "inline-flex", gap: "6px", flexWrap: "wrap" } },
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-tower-exploded-btn": "true",
              "data-variant": explodedView ? "primary" : undefined,
              style: { background: explodedView ? undefined : "rgba(18, 20, 26, 0.88)" },
              onClick: handleToggleExploded,
              title: "Separar os andares verticalmente para inspecionar cada camada (Vista Explodida)",
            },
            explodedView ? "⊟ Compactar" : "⊞ Explodir"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-tower-isolate-btn": "true",
              "data-variant": isolateSelected ? "primary" : undefined,
              style: { background: isolateSelected ? undefined : "rgba(18, 20, 26, 0.88)" },
              onClick: () => {
                setIsolateSelected((v) => {
                  const next = !v;
                  if (next && !selection) {
                    const activeIdx = Math.max(0, floors.findIndex((f) => f.slug === props.activeTenant));
                    if (floors[activeIdx]) {
                      setSelection({ kind: "floor", floor: floors[activeIdx] });
                      desiredTargetRef.current.set(0, activeIdx * (3.65 + (explodedRef.current ? 1.95 : 0)) + 1.0, 0);
                      desiredFrustumRef.current = 6.8;
                    }
                  }
                  return next;
                });
              },
              title: "Ocultar os andares acima do andar selecionado para ver por dentro (Cutaway)",
            },
            isolateSelected ? "◫ Mostrar Todos" : "◫ Isolar Andar"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-tower-plan-btn": "true",
              style: { background: "rgba(18, 20, 26, 0.88)" },
              onClick: () => {
                const idx = selectedSlug ? Math.max(0, floors.findIndex((f) => f.slug === selectedSlug)) : 0;
                const stepH = 3.65 + (explodedRef.current ? 1.95 : 0);
                desiredTargetRef.current.set(0, idx * stepH + 0.6, 0);
                desiredFrustumRef.current = 7.4;
                desiredPhiRef.current = 0.34;
              },
              title: "Vista de Planta Baixa (ângulo superior inclinado)",
            },
            "⌖ Planta"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { background: "rgba(18, 20, 26, 0.88)" },
              onClick: handleEyeLevelView,
              title: "Aproximar câmera no nível do piso do andar selecionado",
            },
            "👁 Nível Piso"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-tower-pip-btn": "true",
              "data-variant": isPipActive ? "primary" : undefined,
              style: { background: isPipActive ? undefined : "rgba(18, 20, 26, 0.88)" },
              onClick: () => void handleTogglePiP(),
              title: "Abrir a Torre 3D como janela flutuante (Picture-in-Picture) fora do Buzz",
            },
            isPipActive ? "⧉ Fechar PiP" : "⧉ Flutuar (PiP)"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { background: "rgba(18, 20, 26, 0.88)" },
              onClick: () => setDarkFactoryMode((v) => !v),
              title: "Alternar iluminação Dia vs. Dark Factory",
            },
            darkFactoryMode ? "☀ Modo Dia" : "☾ Dark Factory"
          ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { background: "rgba(18, 20, 26, 0.88)" },
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
              onClick: () => {
                setSelection(null);
                const effH = floors.length * 3.65 + (explodedRef.current ? (floors.length - 1) * 1.95 : 0);
                desiredTargetRef.current.set(0, Math.max(2.6, effH * 0.48), 0);
                desiredFrustumRef.current = Math.max(14.5, effH * 1.18);
                desiredPhiRef.current = 1.02;
              },
            },
            "⤢ Fit"
          )
        )
      ),
      h(
        "div",
        { className: "of-muted", style: { textAlign: "center", fontSize: "11px" } },
        `Torre Cortexx · ${floors.length} andares · ${totalLivePackets} pacote(s) reais · Arraste: girar · Botão direito/Shift: mover · Scroll: zoom profundo · W/A/S/D/Q/E`
      )
    );
  };
}
