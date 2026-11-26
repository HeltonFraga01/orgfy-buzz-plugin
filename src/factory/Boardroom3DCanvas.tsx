// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/floor/*
// Sala de Reunião do Conselho da Holding (Boardroom 3D) reconstruída no mesmo motor isométrico,
// iluminação com sombras suaves, paleta dinâmica do Buzz (readPalette + MutationObserver) e
// personagens oficiais CodeDen (crewGeometry) do Andar 3D.

import * as THREE from "three";
import type { Context } from "@buzz/author";
import { readPalette, type FloorPalette } from "./codeden-floor/floor/palette";
import { Lights } from "./codeden-floor/floor/lights";
import { Kit, colour, canvasOf } from "./codeden-floor/floor/kit";
import { crewGeometry, type CrewGeometry } from "./codeden-floor/floor/crew-geometry";
import type { Rgb } from "./codeden-floor/oklch";
import type { FactoryStatusPayload } from "./factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "./buzz-live-telemetry";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import { buildCustomAvatar3D, type Avatar3DHandle } from "./Avatar3DBuilder";

export interface BoardroomSeat {
  id: string;
  label: string;
  role: string;
  agentName?: string;
  agentKey?: string;
  pubkey?: string;
  status: "active" | "working" | "planned";
  onClick?: () => void;
}

export interface Boardroom3DProps {
  seats: BoardroomSeat[];
  title?: string;
  fullHeight?: boolean;
  status?: FactoryStatusPayload;
  holding?: any;
  liveCrew?: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenAgentProfile?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenTurnInSideChat?: (turn: LiveAgentTurn) => void;
}

interface BoardroomCompletedTurn {
  turn: LiveAgentTurn;
  finishedAt: number;
  dismissed?: boolean;
}

const BOARDROOM_BUBBLE_TTL_MS = 3 * 60 * 1000;

function fmtBoardroomClock(tsMs?: number | null): string {
  if (!tsMs || !Number.isFinite(tsMs)) return "0s";
  const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const rem = diffSec % 60;
  if (mins < 60) return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtBoardroomElapsed(tsMs?: number | string | null): string {
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

function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  const rr = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gg = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bb = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return alpha >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${alpha})`;
}

/** Cria textura Canvas de placa estilo CodeDen (ex: CONSELHO DA HOLDING) com filete no acento do Buzz. */
function makeWallSignTexture(kit: Kit, text: string, p: FloorPalette): THREE.CanvasTexture {
  const c = canvasOf(512, 112);
  const g = c.getContext("2d")!;
  g.fillStyle = rgbToCss(p.sign);
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 4;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.fillStyle = rgbToCss(p.lane);
  g.fillRect(18, c.height - 14, c.width - 36, 7);
  g.fillStyle = p.signInk;
  g.font = "700 40px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text.toUpperCase(), c.width / 2, c.height / 2 - 4);
  return kit.canvasTexture(c);
}

/** Cria textura Canvas da tela executiva principal do Conselho (3 slides interativos clicáveis). */
function makeExecutiveScreenTexture(
  kit: Kit,
  seats: BoardroomSeat[],
  p: FloorPalette,
  slideIndex: number = 0,
  status?: FactoryStatusPayload,
  holding?: any
): THREE.CanvasTexture {
  const c = canvasOf(1024, 420);
  const g = c.getContext("2d")!;
  const accent = rgbToCss(p.lane);
  const accentSoft = rgbToCss(p.lane, 0.16);
  const blue = rgbToCss(p.accent.reviewer);

  // Fundo escuro fosco estilo dashboard executivo
  g.fillStyle = p.dark ? "#0e1116" : "#161922";
  g.fillRect(0, 0, c.width, c.height);

  // Grid sutil de fundo
  g.strokeStyle = "rgba(255,255,255,0.035)";
  g.lineWidth = 1;
  for (let x = 32; x < c.width; x += 48) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.height);
    g.stroke();
  }
  for (let y = 32; y < c.height; y += 48) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }

  // Barra superior
  g.fillStyle = "rgba(255,255,255,0.04)";
  g.fillRect(0, 0, c.width, 58);
  g.fillStyle = accent;
  g.fillRect(0, 56, c.width, 3);

  g.fillStyle = "#f4f6fb";
  g.font = "700 22px -apple-system, BlinkMacSystemFont, sans-serif";
  const slideTitles = [
    "CONSELHO DA HOLDING · PAINEL EXECUTIVO (1/3)",
    "FINOPS & NEXUSMIND GATEWAY · AUTOPILOTO VIP (2/3)",
    "PORTFÓLIO DAS SUBSIDIÁRIAS · HOLDING CORTEXX (3/3)",
  ];
  g.fillText(slideTitles[slideIndex % 3], 28, 37);

  // Pill AO VIVO no topo direito
  g.fillStyle = accentSoft;
  g.fillRect(c.width - 170, 14, 142, 30);
  g.strokeStyle = accent;
  g.lineWidth = 1.5;
  g.strokeRect(c.width - 170, 14, 142, 30);
  g.fillStyle = accent;
  g.beginPath();
  g.arc(c.width - 150, 29, 5, 0, Math.PI * 2);
  g.fill();
  g.font = "700 14px ui-monospace, Menlo, monospace";
  g.fillText("L-01 · ATIVO", c.width - 134, 34);

  // Contadores reais dos assentos + FinOps + Portfólio por slide
  const activeCnt = seats.filter((s) => s.status === "active").length;
  const workingCnt = seats.filter((s) => s.status === "working").length;
  const plannedCnt = seats.filter((s) => s.status === "planned").length;
  const spendUsd = status?.spendToday?.usd ?? 0;
  const budgetUsd = status?.limits?.dailyBudget?.usd ?? 50;
  const merges7d = status?.stats?.merged7d ?? 0;
  const empresas = Array.isArray(holding?.empresas) ? holding.empresas : [];

  const kpis =
    slideIndex % 3 === 1
      ? [
          { label: "GASTO HOJE", val: `$${spendUsd.toFixed(2)}`, sub: `orçamento $${budgetUsd}/dia`, col: accent },
          { label: "MERGES (7D)", val: String(merges7d), sub: "esteira determinística", col: blue },
          { label: "ESCUDO VIP", val: "ATIVO", sub: "Iris & Conselho isolados", col: "#fbbf24" },
        ]
      : slideIndex % 3 === 2
      ? [
          { label: "SUBSIDIÁRIAS", val: String(empresas.length || 3), sub: "no portfólio Cortexx", col: accent },
          { label: "OPERACIONAIS", val: String(empresas.filter((e: any) => e.estagio === "operacional").length || 2), sub: "rodando no Buzz", col: blue },
          { label: "WIP ATIVO", val: String(status?.wip?.openPrs ?? 0), sub: `limite ${status?.wip?.limit ?? 6} PRs`, col: "#9ca3af" },
        ]
      : [
          { label: "ASSENTOS ATIVOS", val: String(activeCnt + workingCnt), sub: `${seats.length} no conselho`, col: accent },
          { label: "EM EXECUÇÃO", val: String(workingCnt), sub: "turnos ao vivo", col: blue },
          { label: "PLANEJADOS", val: String(plannedCnt), sub: "em incubação", col: "#9ca3af" },
        ];

  kpis.forEach((k, idx) => {
    const x = 28 + idx * 324;
    const y = 78;
    const w = 304;
    const h = 104;
    g.fillStyle = "rgba(255,255,255,0.035)";
    g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(255,255,255,0.09)";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, w, h);
    g.fillStyle = k.col;
    g.fillRect(x, y, 5, h);

    g.fillStyle = "#94a3b8";
    g.font = "600 13px ui-monospace, Menlo, monospace";
    g.fillText(k.label, x + 18, y + 28);

    g.fillStyle = "#f8fafc";
    g.font = "700 40px ui-monospace, Menlo, monospace";
    g.fillText(k.val, x + 18, y + 72);

    g.fillStyle = k.col;
    g.font = "500 13px -apple-system, sans-serif";
    g.fillText(k.sub, x + 98, y + 68);
  });

  // Lista de cadeiras / subsidiárias na esquerda + gráfico de barras na direita
  const listY = 204;
  g.fillStyle = "rgba(255,255,255,0.025)";
  g.fillRect(28, listY, 510, 190);
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.strokeRect(28, listY, 510, 190);

  g.fillStyle = "#94a3b8";
  g.font = "700 12px ui-monospace, Menlo, monospace";
  g.fillText("CADEIRAS DO CONSELHO", 46, listY + 26);

  seats.slice(0, 5).forEach((s, idx) => {
    const ry = listY + 52 + idx * 27;
    const dotCol = s.status === "working" ? blue : s.status === "active" ? accent : "#6b7280";
    g.fillStyle = dotCol;
    g.beginPath();
    g.arc(52, ry - 4, 4.5, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#f1f5f9";
    g.font = "600 15px -apple-system, sans-serif";
    g.fillText(s.label.slice(0, 24), 68, ry);

    g.fillStyle = "#94a3b8";
    g.font = "500 13px ui-monospace, Menlo, monospace";
    g.fillText(s.role.slice(0, 22), 290, ry);
  });

  // Mini gráfico de ritmo / confiança da holding à direita
  const chartX = 560;
  g.fillStyle = "rgba(255,255,255,0.025)";
  g.fillRect(chartX, listY, 436, 190);
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.strokeRect(chartX, listY, 436, 190);

  g.fillStyle = "#94a3b8";
  g.font = "700 12px ui-monospace, Menlo, monospace";
  g.fillText("CADÊNCIA & CONFIANÇA DA HOLDING", chartX + 18, listY + 26);

  const bars = [0.42, 0.56, 0.51, 0.68, 0.74, 0.82, 0.79, 0.91, 0.95, 0.97];
  bars.forEach((v, i) => {
    const bw = 28;
    const gap = 11;
    const bx = chartX + 24 + i * (bw + gap);
    const bh = Math.round(v * 116);
    const by = listY + 168 - bh;
    g.fillStyle = i >= 8 ? accent : rgbToCss(p.lane, 0.42 + i * 0.05);
    g.fillRect(bx, by, bw, bh);
  });

  return kit.canvasTexture(c);
}

/** Cria textura do mapa estratégico da Holding sobre a mesa (no estilo do mapa do Mirante do Andar 3D). */
function makeTableVisionBoardTexture(kit: Kit, seats: BoardroomSeat[], p: FloorPalette): THREE.CanvasTexture {
  const c = canvasOf(512, 256);
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f1e8";
  g.fillRect(0, 0, c.width, c.height);

  // Moldura técnica
  g.strokeStyle = "#cbd5e1";
  g.lineWidth = 4;
  g.strokeRect(10, 10, c.width - 20, c.height - 20);

  // Grid de planta baixa
  g.strokeStyle = "rgba(100,116,139,0.16)";
  g.lineWidth = 1;
  for (let x = 28; x < c.width - 14; x += 28) {
    g.beginPath();
    g.moveTo(x, 14);
    g.lineTo(x, c.height - 14);
    g.stroke();
  }
  for (let y = 28; y < c.height - 14; y += 28) {
    g.beginPath();
    g.moveTo(14, y);
    g.lineTo(c.width - 14, y);
    g.stroke();
  }

  // Blocos coloridos de roadmap / empresas (estilo post-its / mapa do Mirante)
  const paletteBlocks = [
    rgbToCss(p.lane, 0.35),
    "rgba(96, 165, 250, 0.32)",
    "rgba(192, 132, 252, 0.3)",
    "rgba(251, 191, 36, 0.32)",
  ];
  const cols = Math.min(4, Math.max(2, seats.length));
  const bw = Math.floor((c.width - 72 - (cols - 1) * 14) / cols);
  for (let i = 0; i < cols; i++) {
    const bx = 36 + i * (bw + 14);
    const by = 48;
    g.fillStyle = paletteBlocks[i % paletteBlocks.length];
    g.fillRect(bx, by, bw, 152);
    g.strokeStyle = "rgba(30,41,59,0.28)";
    g.lineWidth = 2;
    g.strokeRect(bx, by, bw, 152);

    g.fillStyle = "#1e293b";
    g.font = "700 13px ui-monospace, Menlo, monospace";
    g.fillText((seats[i]?.label || `EMPRESA ${i + 1}`).slice(0, 12).toUpperCase(), bx + 8, by + 26);

    // Linhas de especificação simuladas
    g.fillStyle = "rgba(30,41,59,0.25)";
    g.fillRect(bx + 8, by + 44, bw - 20, 7);
    g.fillRect(bx + 8, by + 60, bw - 34, 7);
    g.fillRect(bx + 8, by + 76, bw - 16, 7);
    g.fillStyle = rgbToCss(p.lane);
    g.fillRect(bx + 8, by + 124, Math.round((bw - 16) * 0.72), 10);
  }

  return kit.canvasTexture(c);
}

/** Cria textura pintada no piso (igual PREP / BUILD / REVIEW do Andar 3D). */
function makeFloorPaintTexture(kit: Kit, text: string, p: FloorPalette): THREE.CanvasTexture {
  const c = canvasOf(512, 96);
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = p.paint;
  g.font = "700 42px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text.toUpperCase(), c.width / 2, c.height / 2);
  return kit.canvasTexture(c);
}

/** Monta uma cadeira executiva ergonômica no estilo arquitetônico CodeDen. */
function buildExecutiveChair(
  kit: Kit,
  matLeather: THREE.Material,
  matSteel: THREE.Material,
  matChrome: THREE.Material
): THREE.Group {
  const chair = new THREE.Group();

  // Base estrela + pistão cromado
  const baseRing = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.24, 0.27, 0.04, 16)), matChrome);
  baseRing.position.y = 0.02;
  baseRing.castShadow = true;
  baseRing.receiveShadow = true;
  chair.add(baseRing);

  const stem = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.038, 0.045, 0.34, 12)), matSteel);
  stem.position.y = 0.21;
  stem.castShadow = true;
  chair.add(stem);

  // Assento acolchoado
  const seat = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.56, 0.09, 0.54)), matLeather);
  seat.position.y = 0.42;
  seat.castShadow = true;
  seat.receiveShadow = true;
  chair.add(seat);

  // Encosto alto executivo (em -z local para que o bonequinho olhe para +z)
  const back = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.54, 0.64, 0.09)), matLeather);
  back.position.set(0, 0.74, -0.24);
  back.rotation.x = -0.08;
  back.castShadow = true;
  back.receiveShadow = true;
  chair.add(back);

  // Apoios de braço em aço
  for (const sx of [-0.27, 0.27]) {
    const post = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.04, 0.2, 0.05)), matSteel);
    post.position.set(sx, 0.54, -0.02);
    chair.add(post);
    const pad = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.06, 0.04, 0.34)), matLeather);
    pad.position.set(sx, 0.64, 0.02);
    pad.castShadow = true;
    chair.add(pad);
  }

  return chair;
}

/** Monta um bonequinho oficial CodeDen (crewGeometry) sentado na sala do Conselho. */
function buildCodeDenDirector(
  kit: Kit,
  crew: CrewGeometry,
  p: FloorPalette,
  seat: BoardroomSeat,
  index: number
): {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  eyesMesh: THREE.Mesh;
  dotsMesh: THREE.Mesh | null;
  ringMesh: THREE.Mesh;
} {
  const root = new THREE.Group();
  const isCeo = index === 0 || /ceo|iris|holding/i.test(`${seat.label} ${seat.role}`);
  const isPlanned = seat.status === "planned";
  const isWorking = seat.status === "working";

  // Corpo estilo gota oficial do CodeDen (branco fosco ou azulado suave para CEO, translúcido para planejado)
  const bodyRgb: Rgb = isCeo ? [0.46, 0.66, 0.94] : isPlanned ? [0.55, 0.58, 0.64] : [0.92, 0.93, 0.95];
  const matBody = kit.matte(bodyRgb, {
    roughness: 0.62,
    transparent: isPlanned,
    opacity: isPlanned ? 0.42 : 1,
  });
  const matInk = kit.matte(p.ink, { roughness: 0.4 });
  const matWhite = kit.matte([1, 1, 1], { roughness: 0.3 });
  const accentRgb: Rgb = isWorking
    ? p.accent.reviewer
    : isCeo
    ? p.lane
    : isPlanned
    ? [0.45, 0.48, 0.54]
    : p.lane;

  const matAccent = kit.matte(accentRgb, {
    roughness: 0.35,
    emissive: colour(accentRgb),
    emissiveIntensity: isPlanned ? 0.08 : isWorking ? 0.72 : 0.45,
  });

  const bodyGroup = new THREE.Group();
  // Sentado sobre o assento da cadeira (y = 0.45) com escala executiva proporcional à mesa
  bodyGroup.position.set(0, 0.45, 0.04);
  bodyGroup.scale.setScalar(1.18);
  root.add(bodyGroup);

  const bodyMesh = new THREE.Mesh(crew.body, matBody);
  bodyMesh.castShadow = !isPlanned;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  const tipMesh = new THREE.Mesh(crew.tip, matAccent);
  bodyGroup.add(tipMesh);

  // Olhos + brilho (catchlights) + sorriso
  const eyesMesh = new THREE.Mesh(crew.eyes, matInk);
  bodyGroup.add(eyesMesh);

  const catchMesh = new THREE.Mesh(crew.catchlights, matWhite);
  bodyGroup.add(catchMesh);

  const mouthGeo = isPlanned ? crew["mouth:flat-short"] : isCeo ? crew["mouth:wide-smile"] : crew["mouth:smile"];
  const mouthMesh = new THREE.Mesh(mouthGeo, matInk);
  bodyGroup.add(mouthMesh);

  // Mãozinhas apoiadas para frente em direção à mesa
  const leftHand = new THREE.Mesh(crew.hand, matBody);
  leftHand.position.set(-0.21, 0.24, 0.14);
  leftHand.castShadow = !isPlanned;
  bodyGroup.add(leftHand);

  const rightHand = new THREE.Mesh(crew.hand, matBody);
  rightHand.position.set(0.21, 0.24, 0.14);
  rightHand.castShadow = !isPlanned;
  bodyGroup.add(rightHand);

  // Pezinhos
  for (const fx of [-0.09, 0.09]) {
    const foot = new THREE.Mesh(crew.foot, matBody);
    foot.position.set(fx, 0.03, 0.08);
    bodyGroup.add(foot);
  }

  // Acessório executivo por papel (Headset PM no CEO, Óculos / Colar / Lenço nas subsidiárias)
  const matAccessory = kit.matte(isCeo ? p.ink : accentRgb, { roughness: 0.45 });
  if (isCeo) {
    bodyGroup.add(new THREE.Mesh(crew.headset, matAccessory));
    bodyGroup.add(new THREE.Mesh(crew.mic, matAccessory));
  } else if (index % 3 === 1) {
    bodyGroup.add(new THREE.Mesh(crew.neckerchief, matAccessory));
  } else if (index % 3 === 2) {
    bodyGroup.add(new THREE.Mesh(crew.glasses, matInk));
    bodyGroup.add(new THREE.Mesh(crew.collar, matAccessory));
  } else {
    bodyGroup.add(new THREE.Mesh(crew.collar, matAccessory));
  }

  // Medalha / Crachá frontal
  const rimMesh = new THREE.Mesh(crew.rim, matAccent);
  bodyGroup.add(rimMesh);

  // Pontinhos girando acima da antena quando em execução
  let dotsMesh: THREE.Mesh | null = null;
  if (isWorking) {
    dotsMesh = new THREE.Mesh(crew.dots, matAccent);
    dotsMesh.position.set(0, 0.72, 0);
    bodyGroup.add(dotsMesh);
  }

  // Anel tracejado oficial CodeDen no chão sob a cadeira
  const matRing = kit.own(
    new THREE.MeshBasicMaterial({
      color: colour(accentRgb),
      transparent: true,
      opacity: isPlanned ? 0.32 : 0.85,
      side: THREE.DoubleSide,
    })
  );
  const ringMesh = new THREE.Mesh(crew.ring, matRing);
  ringMesh.scale.setScalar(1.38);
  ringMesh.position.y = 0.025;
  root.add(ringMesh);

  return { root, bodyGroup, eyesMesh, dotsMesh, ringMesh };
}

/** Monta um notebook aberto + caneca + bloco de notas na mesa diante de cada cadeira. */
function buildSeatDeskProps(
  kit: Kit,
  p: FloorPalette,
  status: BoardroomSeat["status"]
): THREE.Group {
  const g = new THREE.Group();
  const matLaptop = kit.matte(p.laptop, { roughness: 0.42, metalness: 0.25 });
  const screenRgb: Rgb =
    status === "working" ? p.accent.reviewer : status === "active" ? p.lane : [0.22, 0.24, 0.28];
  const matScreen = kit.matte(screenRgb, {
    roughness: 0.25,
    emissive: colour(screenRgb),
    emissiveIntensity: status === "planned" ? 0.05 : 0.45,
  });

  // Base do laptop
  const base = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.42, 0.022, 0.28)), matLaptop);
  base.position.set(0, 0.011, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Tampa/tela inclinada virada para o assento (-z local)
  const lid = new THREE.Group();
  lid.position.set(0, 0.022, 0.13);
  lid.rotation.x = -0.28;
  const lidBack = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.42, 0.28, 0.018)), matLaptop);
  lidBack.position.set(0, 0.14, 0);
  lidBack.castShadow = true;
  lid.add(lidBack);

  const lidDisplay = new THREE.Mesh(kit.own(new THREE.PlaneGeometry(0.38, 0.24)), matScreen);
  lidDisplay.position.set(0, 0.14, -0.01);
  lidDisplay.rotation.y = Math.PI;
  lid.add(lidDisplay);
  g.add(lid);

  // Caneca de café ao lado direito
  const mug = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.042, 0.036, 0.085, 12)), kit.matte(p.paper, { roughness: 0.4 }));
  mug.position.set(0.31, 0.043, -0.03);
  mug.castShadow = true;
  g.add(mug);

  // Bloco de notas / post-it à esquerda
  const pad = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.16, 0.012, 0.2)), kit.matte(p.notes[0] || p.paper, { roughness: 0.85 }));
  pad.position.set(-0.33, 0.006, 0.01);
  pad.rotation.y = 0.12;
  pad.receiveShadow = true;
  g.add(pad);

  return g;
}

/** Planta arquitetônica estilizada para os cantos da sala. */
function buildCornerPlant(kit: Kit, p: FloorPalette): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    kit.own(new THREE.CylinderGeometry(0.28, 0.21, 0.44, 14)),
    kit.matte(p.steel, { roughness: 0.65 })
  );
  pot.position.y = 0.22;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);

  const soil = new THREE.Mesh(
    kit.own(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 12)),
    kit.matte([0.16, 0.13, 0.11], { roughness: 0.95 })
  );
  soil.position.y = 0.43;
  g.add(soil);

  const leafMat = kit.matte(p.lamp.green, { roughness: 0.72 });
  const leafDark = kit.matte([p.lamp.green[0] * 0.78, p.lamp.green[1] * 0.78, p.lamp.green[2] * 0.78], { roughness: 0.75 });
  const fronds: Array<[number, number, number, number]> = [
    [0, 0.82, 0, 0.26],
    [-0.14, 0.66, 0.12, 0.2],
    [0.15, 0.69, -0.09, 0.21],
    [-0.08, 0.62, -0.15, 0.18],
    [0.12, 0.64, 0.14, 0.19],
  ];
  fronds.forEach(([x, y, z, r], i) => {
    const f = new THREE.Mesh(kit.own(new THREE.DodecahedronGeometry(r, 0)), i % 2 === 0 ? leafMat : leafDark);
    f.position.set(x, y, z);
    f.castShadow = true;
    g.add(f);
  });

  return g;
}

export function createBoardroom3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function Boardroom3DCanvas(props: Boardroom3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const mountRef = React.useRef<HTMLDivElement | null>(null);
    const bubbleNodesRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
    const prevActiveByPubkeyRef = React.useRef<Record<string, LiveAgentTurn>>({});
    const [fitTick, setFitTick] = React.useState(0);
    const [themeVersion, setThemeVersion] = React.useState(0);
    const [screenSlide, setScreenSlide] = React.useState(0);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [rosterOpen, setRosterOpen] = React.useState(false);
    const [rosterFilter, setRosterFilter] = React.useState<"all" | "active">("all");
    const [hoveredSeatId, setHoveredSeatId] = React.useState<string | null>(null);
    const [selectedSeatId, setSelectedSeatId] = React.useState<string | null>(null);
    const [completedTurns, setCompletedTurns] = React.useState<Record<string, BoardroomCompletedTurn>>({});
    const [, setClockTick] = React.useState(0);

    // Observa trocas ao vivo de acento/tema no Buzz Desktop (igual ao Andar 3D)
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
      const currentMap = props.telemetry?.byPubkey || {};
      const prevMap = prevActiveByPubkeyRef.current;
      const now = Date.now();
      let changed = false;
      const updates: Record<string, BoardroomCompletedTurn | null> = {};
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
          const copy: Record<string, BoardroomCompletedTurn> = { ...prev };
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
    }, [props.telemetry]);

    const seats = React.useMemo<BoardroomSeat[]>(
      () =>
        props.seats.length > 0
          ? props.seats
          : [
              { id: "ceo", label: "OrgFy Iris", role: "CEO Holding", status: "active" },
              { id: "orgfy", label: "OrgFy Core", role: "16/16 agentes", status: "active" },
              { id: "lumen", label: "Lumen IPTV", role: "10/10 agentes", status: "active" },
              { id: "saas", label: "SaaS Tributário", role: "planejado", status: "planned" },
            ],
      [props.seats]
    );

    const seatsKey = seats.map((s) => `${s.id}:${s.status}:${s.label}:${s.role}`).join("|");

    React.useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const palette = readPalette();
      const kit = new Kit();
      const crew = crewGeometry();
      for (const geo of Object.values(crew)) kit.own(geo);

      const width = Math.max(320, container.clientWidth || 720);
      const height = Math.max(260, container.clientHeight || 380);

      const scene = new THREE.Scene();
      const bgColor = palette.dark ? new THREE.Color(0x0d0f13) : colour(palette.sky);
      scene.background = bgColor;

      // Câmera ortográfica isométrica 1:1 com a estética arquitetônica do Andar 3D
      let theta = 0.62;
      let phi = 0.96;
      let frustum = 9.4;
      const target = new THREE.Vector3(0, 0.72, -0.15);

      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2,
        (frustum * aspect) / 2,
        frustum / 2,
        -frustum / 2,
        0.1,
        120
      );

      const updateCamera = () => {
        const w = Math.max(320, container.clientWidth || width);
        const hh = Math.max(260, container.clientHeight || height);
        const asp = w / hh;
        camera.left = (-frustum * asp) / 2;
        camera.right = (frustum * asp) / 2;
        camera.top = frustum / 2;
        camera.bottom = -frustum / 2;
        const dist = 28;
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
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      } catch {
        kit.dispose();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = palette.dark ? 1.12 : 1.02;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      // Iluminação oficial CodeDen (Hemisphere + Sol com sombras suaves)
      const lights = new Lights();
      scene.add(lights.hemi, lights.sun, lights.sun.target);
      lights.set([{ x0: -6.2, x1: 6.2, y0: 0, y1: 3.8, z0: -4.2, z1: 4.2 }], palette, false);

      // Luz de preenchimento suave quente vinda da tela/mesa
      const accentFill = new THREE.PointLight(colour(palette.lane), palette.dark ? 0.55 : 0.25, 14);
      accentFill.position.set(0, 2.5, -2.0);
      scene.add(accentFill);

      // ── 1. LAJE ARQUITETÔNICA + TAPETE + FILETES NO ACENTO DO BUZZ ──
      const matFloor = kit.matte(palette.floor, { roughness: 0.88 });
      const matWall = kit.matte(palette.wall, { roughness: 0.84 });
      const matSteel = kit.matte(palette.steel, { roughness: 0.48, metalness: 0.35 });
      const matChrome = kit.matte(palette.chrome, { roughness: 0.25, metalness: 0.72 });
      const matWood = kit.matte(palette.wood, { roughness: 0.55 });
      const matLane = kit.matte(palette.lane, {
        roughness: 0.35,
        emissive: colour(palette.lane),
        emissiveIntensity: 0.45,
      });
      const matLeather = kit.matte(palette.dark ? [0.16, 0.18, 0.23] : [0.26, 0.29, 0.35], { roughness: 0.65 });
      const matGlass = kit.own(
        new THREE.MeshPhysicalMaterial({
          color: colour(palette.glass),
          transparent: true,
          opacity: palette.dark ? 0.18 : 0.28,
          roughness: 0.12,
          metalness: 0.05,
        })
      );

      // Laje principal do piso
      const slab = new THREE.Mesh(kit.own(new THREE.BoxGeometry(11.4, 0.34, 7.6)), matFloor);
      slab.position.set(0, -0.17, 0);
      slab.receiveShadow = true;
      scene.add(slab);

      // Filete de acento do Buzz contornando a borda frontal da laje (assinatura visual do Mirante 3D)
      const frontTrim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(11.44, 0.08, 0.08)), matLane);
      frontTrim.position.set(0, -0.04, 3.8);
      scene.add(frontTrim);

      const rightTrim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.08, 7.64)), matLane);
      rightTrim.position.set(5.7, -0.04, 0);
      scene.add(rightTrim);

      // Tapete executivo central + moldura no acento do Buzz
      const rug = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(8.6, 0.024, 5.1)),
        kit.matte(palette.dark ? [0.22, 0.24, 0.29] : [0.85, 0.84, 0.81], { roughness: 0.95 })
      );
      rug.position.set(0, 0.012, 0.1);
      rug.receiveShadow = true;
      scene.add(rug);

      for (const rz of [-2.45, 2.65]) {
        const line = new THREE.Mesh(kit.own(new THREE.BoxGeometry(8.62, 0.015, 0.045)), matLane);
        line.position.set(0, 0.024, rz);
        scene.add(line);
      }

      // Pintura no piso à frente da mesa (igual PREP / BUILD / REVIEW no Andar 3D)
      const paintTex = makeFloorPaintTexture(kit, "CONSELHO DA HOLDING", palette);
      const floorPaint = new THREE.Mesh(
        kit.own(new THREE.PlaneGeometry(4.4, 0.78)),
        kit.own(new THREE.MeshBasicMaterial({ map: paintTex, transparent: true, depthWrite: false }))
      );
      floorPaint.rotation.x = -Math.PI / 2;
      floorPaint.position.set(0, 0.018, 3.22);
      scene.add(floorPaint);

      // ── 2. PAREDES EM L + DIVISÓRIA DE VIDRO (ESTILO PM BOOTH DO ANDAR 3D) ──
      const backWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(11.4, 3.3, 0.24)), matWall);
      backWall.position.set(0, 1.65, -3.68);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.24, 3.3, 7.6)), matWall);
      leftWall.position.set(-5.58, 1.65, 0);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      // Rodapé e arremate superior em aço
      const backCap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(11.44, 0.08, 0.28)), matSteel);
      backCap.position.set(0, 3.32, -3.68);
      scene.add(backCap);

      const leftCap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.08, 7.64)), matSteel);
      leftCap.position.set(-5.58, 3.32, 0);
      scene.add(leftCap);

      // Parede de vidro arquitetônica no fundo direito com montantes de aço
      const glassPane = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.06, 2.75, 4.2)), matGlass);
      glassPane.position.set(5.58, 1.38, -1.5);
      scene.add(glassPane);

      for (const gz of [-3.56, -1.5, 0.56]) {
        const mullion = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.1, 2.82, 0.1)), matSteel);
        mullion.position.set(5.58, 1.41, gz);
        mullion.castShadow = true;
        scene.add(mullion);
      }
      const glassTopRail = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.1, 0.08, 4.22)), matSteel);
      glassTopRail.position.set(5.58, 2.8, -1.5);
      scene.add(glassTopRail);

      // ── 3. TELA EXECUTIVA + PLACA CODEDEN NA PAREDE DE FUNDO ──
      const screenBezel = new THREE.Mesh(kit.own(new THREE.BoxGeometry(5.1, 2.02, 0.12)), kit.matte(palette.sign, { roughness: 0.45 }));
      screenBezel.position.set(0, 1.68, -3.5);
      screenBezel.castShadow = true;
      scene.add(screenBezel);

      const screenTex = makeExecutiveScreenTexture(kit, seats, palette, screenSlide, props.status, props.holding);
      const screenDisplay = new THREE.Mesh(
        kit.own(new THREE.PlaneGeometry(4.84, 1.78)),
        kit.own(new THREE.MeshBasicMaterial({ map: screenTex }))
      );
      screenDisplay.position.set(0, 1.68, -3.435);
      screenDisplay.userData.isExecutiveScreen = true;
      scene.add(screenDisplay);

      const screenTrim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(5.1, 0.05, 0.14)), matLane);
      screenTrim.position.set(0, 0.65, -3.49);
      scene.add(screenTrim);

      // Placa superior estilo CodeDen ("CONSELHO")
      const signTex = makeWallSignTexture(kit, "CONSELHO", palette);
      const signBoard = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(2.1, 0.44, 0.08)),
        [
          matSteel,
          matSteel,
          matSteel,
          matSteel,
          kit.own(new THREE.MeshBasicMaterial({ map: signTex })),
          matSteel,
        ]
      );
      signBoard.position.set(0, 2.98, -3.52);
      signBoard.castShadow = true;
      scene.add(signBoard);

      // Aparador (credenza) na parede esquerda com fichários e blueprints
      const credenza = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.75, 0.72, 2.8)), matWood);
      credenza.position.set(-5.05, 0.36, -0.1);
      credenza.castShadow = true;
      credenza.receiveShadow = true;
      scene.add(credenza);

      const credenzaTop = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.8, 0.06, 2.86)), matSteel);
      credenzaTop.position.set(-5.05, 0.75, -0.1);
      credenzaTop.receiveShadow = true;
      scene.add(credenzaTop);

      // Blueprint enrolado + pastas sobre o aparador
      const blueprint = new THREE.Mesh(
        kit.own(new THREE.CylinderGeometry(0.055, 0.055, 0.56, 12)),
        kit.matte(palette.blueprint, { roughness: 0.6 })
      );
      blueprint.rotation.x = Math.PI / 2;
      blueprint.position.set(-5.0, 0.84, 0.45);
      blueprint.castShadow = true;
      scene.add(blueprint);

      const stackPaper = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(0.32, 0.09, 0.42)),
        kit.matte(palette.paper, { roughness: 0.85 })
      );
      stackPaper.position.set(-5.02, 0.82, -0.55);
      stackPaper.castShadow = true;
      scene.add(stackPaper);

      // Plantas arquitetônicas nos dois cantos da parede de fundo
      const plantL = buildCornerPlant(kit, palette);
      plantL.position.set(-4.65, 0, -2.85);
      scene.add(plantL);

      const plantR = buildCornerPlant(kit, palette);
      plantR.position.set(4.65, 0, -2.85);
      scene.add(plantR);

      // ── 4. MESA EXECUTIVA DE MADEIRA + MAPA ESTRATÉGICO DA HOLDING ──
      const tableGroup = new THREE.Group();
      tableGroup.position.set(0, 0, 0.15);
      scene.add(tableGroup);

      // Tampo de madeira quente (igual às bancadas do Andar 3D) com borda em aço
      const tableFrame = new THREE.Mesh(kit.own(new THREE.BoxGeometry(5.68, 0.09, 2.38)), matSteel);
      tableFrame.position.y = 0.78;
      tableFrame.castShadow = true;
      tableFrame.receiveShadow = true;
      tableGroup.add(tableFrame);

      const tableTop = new THREE.Mesh(kit.own(new THREE.BoxGeometry(5.54, 0.07, 2.24)), matWood);
      tableTop.position.y = 0.855;
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      tableGroup.add(tableTop);

      // Canaleta central metálica + filete fino no acento do Buzz
      const tray = new THREE.Mesh(kit.own(new THREE.BoxGeometry(3.8, 0.02, 0.24)), matSteel);
      tray.position.y = 0.895;
      tableGroup.add(tray);

      const inlay = new THREE.Mesh(kit.own(new THREE.BoxGeometry(3.6, 0.015, 0.06)), matLane);
      inlay.position.y = 0.908;
      tableGroup.add(inlay);

      // Mapa estratégico da Holding sobre o centro da mesa (referência ao mapa do Mirante 3D)
      const visionBoardTex = makeTableVisionBoardTexture(kit, seats, palette);
      const visionBoard = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(1.75, 0.026, 0.9)),
        [
          matWood,
          matWood,
          kit.own(new THREE.MeshBasicMaterial({ map: visionBoardTex })),
          matWood,
          matWood,
          matWood,
        ]
      );
      visionBoard.position.set(0, 0.915, 0);
      visionBoard.castShadow = true;
      visionBoard.receiveShadow = true;
      tableGroup.add(visionBoard);

      // Pedestais duplos em aço + sapatas cromadas
      for (const lx of [-1.75, 1.75]) {
        const pillar = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.24, 0.72, 1.1)), matSteel);
        pillar.position.set(lx, 0.39, 0);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        tableGroup.add(pillar);

        const foot = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.46, 0.05, 1.48)), matChrome);
        foot.position.set(lx, 0.025, 0);
        foot.castShadow = true;
        foot.receiveShadow = true;
        tableGroup.add(foot);
      }

      // ── 5. ASSENTOS COM CADEIRAS EXECUTIVAS, NOTEBOOKS E BONEQUINHOS CODEDEN ──
      // Cada coordenada define posição do assento, rotação (olhando para a mesa) e posição do laptop na mesa
      const seatSlots: Array<{
        pos: [number, number, number];
        rotY: number;
        deskPos: [number, number, number];
      }> = [
        { pos: [-3.42, 0, 0.15], rotY: Math.PI / 2, deskPos: [-2.32, 0.89, 0.15] }, // Cabeceira esquerda (CEO Holding)
        { pos: [-1.55, 0, 1.78], rotY: Math.PI, deskPos: [-1.55, 0.89, 0.95] },
        { pos: [0.0, 0, 1.78], rotY: Math.PI, deskPos: [0.0, 0.89, 0.95] },
        { pos: [1.55, 0, 1.78], rotY: Math.PI, deskPos: [1.55, 0.89, 0.95] },
        { pos: [-1.55, 0, -1.48], rotY: 0, deskPos: [-1.55, 0.89, -0.65] },
        { pos: [0.0, 0, -1.48], rotY: 0, deskPos: [0.0, 0.89, -0.65] },
        { pos: [1.55, 0, -1.48], rotY: 0, deskPos: [1.55, 0.89, -0.65] },
        { pos: [3.42, 0, 0.15], rotY: -Math.PI / 2, deskPos: [2.32, 0.89, 0.15] },
      ];

      // ── HOLOGRAMA CENTRAL DE REUNIÃO SOBRE A MESA ──
      const holoGroup = new THREE.Group();
      holoGroup.position.set(0, 1.62, 0.15);
      scene.add(holoGroup);

      const holoCore = new THREE.Mesh(
        kit.own(new THREE.OctahedronGeometry(0.32, 0)),
        kit.own(
          new THREE.MeshBasicMaterial({
            color: colour(palette.lane),
            wireframe: true,
            transparent: true,
            opacity: 0.72,
          })
        )
      );
      holoGroup.add(holoCore);

      const holoRing = new THREE.Mesh(
        kit.own(new THREE.TorusGeometry(0.48, 0.014, 8, 32)),
        kit.own(
          new THREE.MeshBasicMaterial({
            color: colour(palette.accent.reviewer),
            transparent: true,
            opacity: 0.55,
          })
        )
      );
      holoRing.rotation.x = Math.PI / 2;
      holoGroup.add(holoRing);

      interface AnimatedDirector {
        seat: BoardroomSeat;
        seatGroup: THREE.Group;
        avatar: Avatar3DHandle;
        phase: number;
        pos: [number, number, number];
        hitTarget: THREE.Object3D;
      }

      const animated: AnimatedDirector[] = [];
      const hitTargets: THREE.Object3D[] = [screenDisplay];
      const seatByObject = new WeakMap<THREE.Object3D, { seat: BoardroomSeat; pos: [number, number, number] }>();
      const crewList = props.liveCrew || [];

      seats.slice(0, seatSlots.length).forEach((seat, idx) => {
        const slot = seatSlots[idx];
        const seatGroup = new THREE.Group();
        seatGroup.position.set(...slot.pos);
        seatGroup.rotation.y = slot.rotY;
        scene.add(seatGroup);

        const chair = buildExecutiveChair(kit, matLeather, matSteel, matChrome);
        seatGroup.add(chair);

        const displayName = seat.agentName || seat.role || seat.label;
        const pk = (seat.pubkey || "").toLowerCase();
        const crewMatch = crewList.find(
          (c) => (pk && c.pubkey?.toLowerCase() === pk) || c.name.toLowerCase() === displayName.toLowerCase()
        );
        const liveTurn = pk && props.telemetry?.byPubkey ? props.telemetry.byPubkey[pk] : undefined;
        const avStatus = liveTurn?.state === "error" ? "error" : seat.status;

        const avatar = buildCustomAvatar3D(
          kit,
          palette,
          { name: displayName, role: seat.role, picture: crewMatch?.picture, status: avStatus, index: idx },
          { seatHeight: 0.44, scale: 1.08, showPortraitMedallion: true }
        );
        seatGroup.add(avatar.root);

        // Feixe luminoso ligando conselheiros ativos ao holograma central da mesa
        if (seat.status === "working") {
          const startPt = new THREE.Vector3(slot.pos[0], 1.15, slot.pos[2]);
          const midPt = new THREE.Vector3(slot.pos[0] * 0.45, 1.85, (slot.pos[2] + 0.15) * 0.45);
          const endPt = new THREE.Vector3(0, 1.62, 0.15);
          const curve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);
          const beam = new THREE.Mesh(
            kit.own(new THREE.TubeGeometry(curve, 20, 0.018, 6, false)),
            kit.own(
              new THREE.MeshBasicMaterial({
                color: colour(palette.accent.reviewer),
                transparent: true,
                opacity: 0.65,
              })
            )
          );
          scene.add(beam);
        }

        const propsGroup = buildSeatDeskProps(kit, palette, seat.status);
        propsGroup.position.set(...slot.deskPos);
        propsGroup.rotation.y = slot.rotY;
        scene.add(propsGroup);

        const hitBox = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.95, 1.45, 0.95)),
          kit.own(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitBox.position.set(0, 0.72, 0);
        seatGroup.add(hitBox);
        hitTargets.push(hitBox);
        seatByObject.set(hitBox, { seat, pos: slot.pos });

        animated.push({
          seat,
          seatGroup,
          avatar,
          phase: idx * 1.37,
          pos: slot.pos,
          hitTarget: hitBox,
        });
      });

      const defaultTarget = new THREE.Vector3(0, 0.72, -0.15);
      const desiredTarget = defaultTarget.clone();
      let desiredFrustum = 9.4;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;

      const pickHit = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(hitTargets, false);
        if (hits.length === 0) return null;
        const obj = hits[0].object;
        if (obj.userData?.isExecutiveScreen) return { kind: "screen" as const };
        const entry = seatByObject.get(obj);
        return entry ? { kind: "seat" as const, ...entry } : null;
      };

      const onDown = (e: MouseEvent) => {
        dragging = true;
        moved = false;
        lastX = e.clientX;
        lastY = e.clientY;
        renderer.domElement.style.cursor = "grabbing";
      };

      const onMove = (e: MouseEvent) => {
        if (dragging) {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
          theta -= dx * 0.008;
          phi = Math.max(0.48, Math.min(1.22, phi - dy * 0.006));
          lastX = e.clientX;
          lastY = e.clientY;
          updateCamera();
          return;
        }
        const hit = pickHit(e);
        const hitSeatId = hit?.kind === "seat" ? hit.seat.id : null;
        setHoveredSeatId((cur) => (cur === hitSeatId ? cur : hitSeatId));
        renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      };

      const onUp = (e: MouseEvent) => {
        if (dragging && !moved) {
          const hit = pickHit(e);
          if (hit?.kind === "screen") {
            setScreenSlide((s) => (s + 1) % 3);
          } else if (hit?.kind === "seat") {
            setSelectedSeatId(hit.seat.id);
            desiredTarget.set(hit.pos[0] * 0.65, 0.9, hit.pos[2] * 0.65);
            desiredFrustum = 6.6;
          } else {
            setSelectedSeatId(null);
            desiredTarget.copy(defaultTarget);
            desiredFrustum = 9.4;
          }
        }
        dragging = false;
        renderer.domElement.style.cursor = "grab";
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        frustum = Math.max(5.4, Math.min(14.5, frustum + e.deltaY * 0.008));
        desiredFrustum = frustum;
        updateCamera();
      };

      const onLeave = () => {
        setHoveredSeatId(null);
      };

      const dom = renderer.domElement;
      dom.style.cursor = "grab";
      dom.addEventListener("mousedown", onDown);
      dom.addEventListener("mousemove", onMove);
      dom.addEventListener("mouseleave", onLeave);
      window.addEventListener("mouseup", onUp);
      dom.addEventListener("wheel", onWheel, { passive: false });

      let rafId = 0;
      const clock = new THREE.Clock();
      const headVec = new THREE.Vector3();
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;

        // Voo cinematográfico suave (lerp) da câmera ao focar um conselheiro
        let camDirty = false;
        if (target.distanceTo(desiredTarget) > 0.01) {
          target.lerp(desiredTarget, 0.09);
          camDirty = true;
        }
        if (Math.abs(frustum - desiredFrustum) > 0.015) {
          frustum += (desiredFrustum - frustum) * 0.09;
          camDirty = true;
        }
        if (camDirty) updateCamera();

        // Anima holograma central
        holoCore.rotation.y = t * 0.85;
        holoCore.rotation.x = Math.sin(t * 0.6) * 0.28;
        holoGroup.position.y = 1.62 + Math.sin(t * 1.8) * 0.05;
        holoRing.rotation.z = -t * 0.6;

        const projectedBubbles: Array<{ node: HTMLDivElement; cx: number; bottom: number; w: number; h: number }> = [];
        for (const a of animated) {
          a.avatar.animate(t, a.phase, { working: a.seat.status === "working" });

          const bubbleNode = bubbleNodesRef.current.get(a.seat.id);
          if (bubbleNode) {
            headVec.set(0, 1.55, 0).applyMatrix4(a.seatGroup.matrixWorld).project(camera);
            const sx = (headVec.x * 0.5 + 0.5) * cw;
            const sy = (-headVec.y * 0.5 + 0.5) * ch;
            const bw = bubbleNode.offsetWidth || 224;
            const bh = bubbleNode.offsetHeight || 86;
            const cx = Math.max(bw / 2 + 10, Math.min(cw - bw / 2 - 10, sx));
            const bottom = Math.max(bh + 12, Math.min(ch - 18, sy - 14));
            projectedBubbles.push({ node: bubbleNode, cx, bottom, w: bw, h: bh });
          }
        }
        // Evita sobreposição entre balões de conselheiros adjacentes
        projectedBubbles.sort((a, b) => a.bottom - b.bottom);
        for (let i = 0; i < projectedBubbles.length; i += 1) {
          const cur = projectedBubbles[i];
          for (let j = 0; j < i; j += 1) {
            const prev = projectedBubbles[j];
            const overlapX = Math.abs(cur.cx - prev.cx) < (cur.w + prev.w) * 0.48;
            const overlapY = Math.abs(cur.bottom - prev.bottom) < prev.h + 8;
            if (overlapX && overlapY) {
              cur.bottom = Math.max(cur.h + 14, prev.bottom - prev.h - 10);
            }
          }
          cur.node.style.transform = `translate3d(${Math.round(cur.cx)}px, ${Math.round(cur.bottom)}px, 0) translate(-50%, -100%)`;
          cur.node.style.opacity = "1";
          cur.node.style.pointerEvents = "auto";
        }
        renderer.render(scene, camera);
      };
      animate();

      const resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              const w = Math.max(320, container.clientWidth || width);
              const hh = Math.max(260, container.clientHeight || height);
              renderer.setSize(w, hh);
              updateCamera();
            })
          : null;
      resizeObserver?.observe(container);

      return () => {
        cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
        dom.removeEventListener("mousedown", onDown);
        dom.removeEventListener("mousemove", onMove);
        dom.removeEventListener("mouseleave", onLeave);
        window.removeEventListener("mouseup", onUp);
        dom.removeEventListener("wheel", onWheel);
        lights.dispose();
        kit.dispose();
        renderer.dispose();
      };
    }, [seatsKey, fitTick, themeVersion, screenSlide]);

    const liveCrew = props.liveCrew || [];
    const resolveSeatMeta = (s: BoardroomSeat) => {
      const displayName = s.agentName || s.role || s.label;
      const pk = (s.pubkey || "").toLowerCase();
      const crewMatch =
        liveCrew.find((c) => (pk && c.pubkey?.toLowerCase() === pk) || c.name.toLowerCase() === displayName.toLowerCase()) ||
        null;
      const resolvedPk = pk || (crewMatch?.pubkey || "").toLowerCase();
      const liveTurn = resolvedPk && props.telemetry?.byPubkey ? props.telemetry.byPubkey[resolvedPk] || null : null;
      const doneRec = resolvedPk ? completedTurns[resolvedPk] : undefined;
      const hasFreshDone = Boolean(doneRec && !doneRec.dismissed && Date.now() - doneRec.finishedAt < BOARDROOM_BUBBLE_TTL_MS);
      return {
        seat: s,
        displayName,
        committee: s.id === "bestie-iris" ? s.role : s.label,
        pubkey: resolvedPk,
        agentKey: s.agentKey || crewMatch?.key || s.id,
        picture: crewMatch?.picture,
        provider: crewMatch?.provider || "nexusmind_anthropic",
        model: crewMatch?.model || "claude-sonnet-5-5",
        inBuzz: Boolean(crewMatch || resolvedPk),
        running: Boolean(crewMatch?.running || liveTurn),
        liveTurn,
        doneRec: hasFreshDone ? doneRec : undefined,
      };
    };

    const enrichedSeats = seats.map(resolveSeatMeta);
    const workingNowCount = enrichedSeats.filter((e) => Boolean(e.liveTurn)).length;
    const inBuzzCount = enrichedSeats.filter((e) => e.inBuzz).length;

    const speechBubbles = (() => {
      const seenPk = new Set<string>();
      return enrichedSeats.filter((e) => {
        if (!e.liveTurn && !e.doneRec) return false;
        if (e.pubkey) {
          if (seenPk.has(e.pubkey)) return false;
          seenPk.add(e.pubkey);
        }
        return true;
      });
    })();

    React.useEffect(() => {
      if (speechBubbles.length === 0) return;
      const timer = window.setInterval(() => {
        setClockTick((n) => n + 1);
        const now = Date.now();
        setCompletedTurns((prev) => {
          let expired = false;
          const next: Record<string, BoardroomCompletedTurn> = {};
          for (const [pk, item] of Object.entries(prev)) {
            if (!item.dismissed && now - item.finishedAt < BOARDROOM_BUBBLE_TTL_MS) next[pk] = item;
            else expired = true;
          }
          return expired ? next : prev;
        });
      }, 1000);
      return () => window.clearInterval(timer);
    }, [speechBubbles.length]);

    const filterRows = (list: typeof enrichedSeats) =>
      rosterFilter === "active" ? list.filter((e) => Boolean(e.liveTurn || e.running)) : list;
    const leadershipRows = filterRows(enrichedSeats.slice(0, 1));
    const committeeRows = filterRows(enrichedSeats.slice(1));

    const focusSeatId = selectedSeatId || hoveredSeatId;
    const focusedMeta = focusSeatId ? enrichedSeats.find((e) => e.seat.id === focusSeatId) || null : null;

    const renderRosterRow = (e: (typeof enrichedSeats)[number]) => {
      const isSelected = selectedSeatId === e.seat.id;
      const statusLabel = e.liveTurn
        ? e.liveTurn.state === "error"
          ? "Erro"
          : "Respondendo"
        : e.running
        ? "Em execução"
        : e.inBuzz
        ? "Disponível"
        : "Pendente";
      const stepLine = e.liveTurn?.stepLabel || e.committee;

      return h(
        "div",
        {
          key: e.seat.id,
          role: "button",
          tabIndex: 0,
          "data-floor3d-roster-row": e.seat.id,
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
          onMouseEnter: () => setHoveredSeatId(e.seat.id),
          onMouseLeave: () => setHoveredSeatId((cur) => (cur === e.seat.id ? null : cur)),
          onClick: () => setSelectedSeatId(e.seat.id),
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 } },
          h(
            "button",
            {
              type: "button",
              "data-agent-profile-trigger": e.displayName,
              title: `Abrir perfil de ${e.displayName} na coluna lateral`,
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
                cursor: props.onOpenAgentProfile ? "pointer" : "inherit",
                textAlign: "left",
              },
              onClick: (ev: any) => {
                if (!props.onOpenAgentProfile) return;
                ev.stopPropagation();
                props.onOpenAgentProfile({ key: e.agentKey, pubkey: e.pubkey, name: e.displayName });
              },
            },
            e.picture
              ? h("img", { src: e.picture, alt: e.displayName, style: { width: "16px", height: "16px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 } })
              : h("span", {
                  className: "of-dot",
                  "data-tone": e.liveTurn ? (e.liveTurn.state === "error" ? "failed" : "running") : e.inBuzz ? "done" : "idle",
                }),
            h("span", { style: { fontSize: "11.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, e.displayName)
          )
        ),
        h(
          "div",
          { style: { fontSize: "10px", color: e.liveTurn ? "var(--status-running)" : "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: `${stepLine} · ${statusLabel}` },
          `${stepLine} · ${statusLabel}`
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "1px" } },
          h("span", { className: "of-mono of-muted", style: { fontSize: "9.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, `${e.provider} · ${e.model}`),
          h(
            "div",
            { style: { display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 } },
            props.onOpenAgentProfile &&
              e.pubkey &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  title: `Abrir perfil nativo de ${e.displayName} no Buzz`,
                  style: { padding: "1px 5px", fontSize: "9.5px" },
                  onClick: (ev: any) => {
                    ev.stopPropagation();
                    props.onOpenAgentProfile!({ key: e.agentKey, pubkey: e.pubkey, name: e.displayName });
                  },
                },
                "Perfil"
              ),
            props.onOpenAgentDm &&
              e.pubkey &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  title: `Abrir DM nativa com ${e.displayName} no Buzz`,
                  style: { padding: "1px 5px", fontSize: "9.5px", color: "var(--primary)" },
                  onClick: (ev: any) => {
                    ev.stopPropagation();
                    props.onOpenAgentDm!({ key: e.agentKey, pubkey: e.pubkey, name: e.displayName });
                  },
                },
                "DM ↗"
              )
          )
        )
      );
    };

    return h(
      "div",
      {
        "data-boardroom-3d": "true",
        "data-boardroom-codeden-v2": "true",
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
            background: "radial-gradient(circle at 50% 40%, #15171d, #0a0b0f)",
            overflow: "hidden",
          },
        },
        h("div", {
          ref: mountRef,
          style: { width: "100%", height: "100%", background: "var(--background)" },
        }),

        // Camada de balões de chat ao vivo sobre a cabeça dos conselheiros (1:1 com Andar 3D)
        h(
          "div",
          {
            "data-floor3d-speech-layer": "true",
            style: { position: "absolute", inset: 0, zIndex: 18, pointerEvents: "none", overflow: "hidden" },
          },
          speechBubbles.map((e) => {
            const isDone = !e.liveTurn && Boolean(e.doneRec);
            const turn = e.liveTurn || e.doneRec!.turn;
            const isErr = !isDone && turn.state === "error";
            const borderColor = isDone
              ? "rgba(16, 185, 129, 0.72)"
              : isErr
              ? "rgba(239, 68, 68, 0.72)"
              : "rgba(59, 130, 246, 0.65)";
            const accentColor = isDone ? "#34d399" : isErr ? "#f87171" : "#60a5fa";
            const handleOpenResponse = (ev: any) => {
              ev.stopPropagation();
              if (isDone && e.pubkey) {
                setCompletedTurns((prev) => {
                  const cur = prev[e.pubkey];
                  if (!cur) return prev;
                  return { ...prev, [e.pubkey]: { ...cur, dismissed: true } };
                });
              }
              if (turn.channelId && props.onOpenTurnInSideChat) props.onOpenTurnInSideChat(turn);
              else if (props.onOpenAgentDm) props.onOpenAgentDm({ key: e.agentKey, pubkey: e.pubkey, name: e.displayName });
            };

            return h(
              "div",
              {
                key: e.seat.id,
                "data-floor3d-speech-bubble": e.seat.id,
                "data-bubble-state": isDone ? "done" : isErr ? "error" : "working",
                ref: (el: HTMLDivElement | null) => {
                  if (el) bubbleNodesRef.current.set(e.seat.id, el);
                  else bubbleNodesRef.current.delete(e.seat.id);
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
                onClick: () => setSelectedSeatId(e.seat.id),
              },
              h(
                "div",
                {
                  style: {
                    borderRadius: "10px",
                    border: `1px solid ${borderColor}`,
                    background: "rgba(15, 18, 24, 0.94)",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 10px 26px rgba(0,0,0,0.48)",
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
                  h("span", {
                    style: {
                      width: "7px",
                      height: "7px",
                      borderRadius: "999px",
                      background: accentColor,
                      boxShadow: `0 0 8px ${accentColor}`,
                      flexShrink: 0,
                    },
                  }),
                  h("span", { style: { fontSize: "11px", fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, e.displayName),
                  h("span", { className: "of-mono", style: { fontSize: "9.5px", color: accentColor, flexShrink: 0 } }, isDone ? "Respondeu" : fmtBoardroomClock(turn.startedAt))
                ),
                h(
                  "div",
                  { style: { fontSize: "11px", color: isErr ? "#fca5a5" : "rgba(229, 231, 235, 0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: turn.stepLabel },
                  isDone ? "Resposta pronta no chat do Buzz" : turn.stepLabel || "Pensando..."
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": isDone ? "primary" : "ghost",
                    onClick: handleOpenResponse,
                    style: { width: "100%", justifyContent: "center", padding: "3px 8px", fontSize: "10px", fontWeight: 600 },
                  },
                  isDone ? "Abrir resposta ↗" : "Ver chat ↗"
                )
              ),
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

        // Roster lateral flutuante 1:1 com o Andar 3D
        rosterOpen
          ? h(
              "nav",
              {
                "aria-label": "Roster do Conselho",
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
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "Equipe Conselho"),
                h("span", { className: "of-pill of-num", style: { fontSize: "10px", padding: "0 5px" } }, String(enrichedSeats.length)),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { marginLeft: "auto", padding: "1px 6px", fontSize: "10px" },
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
                    },
                  },
                  h("span", null, "BESTIE · ORQUESTRADORA"),
                  h("span", { className: "of-num" }, String(leadershipRows.length))
                ),
                leadershipRows.map(renderRosterRow),
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
                    },
                  },
                  h("span", null, "COMITÊS DO CONSELHO"),
                  h("span", { className: "of-num" }, String(committeeRows.length))
                ),
                committeeRows.map(renderRosterRow)
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
              `Equipe Conselho (${enrichedSeats.length}) ›`
            ),

        // Popover flutuante no canto superior direito 1:1 com o Andar 3D
        focusedMeta &&
          h(
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
                  title: `Abrir perfil de ${focusedMeta.displayName} na coluna lateral`,
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
                    cursor: props.onOpenAgentProfile && focusedMeta.pubkey ? "pointer" : "default",
                    textAlign: "left",
                  },
                  onClick: () => {
                    if (props.onOpenAgentProfile && focusedMeta.pubkey) {
                      props.onOpenAgentProfile({ key: focusedMeta.agentKey, pubkey: focusedMeta.pubkey, name: focusedMeta.displayName });
                    }
                  },
                },
                focusedMeta.picture && h("img", { src: focusedMeta.picture, alt: focusedMeta.displayName, style: { width: "20px", height: "20px", borderRadius: "5px", objectFit: "cover" } }),
                h("strong", { style: { fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, focusedMeta.displayName)
              ),
              h(
                "div",
                { style: { display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 } },
                h(
                  "span",
                  {
                    className: "of-pill",
                    "data-tone": focusedMeta.liveTurn ? (focusedMeta.liveTurn.state === "error" ? "failed" : "running") : focusedMeta.inBuzz ? "done" : "idle",
                    style: { fontSize: "10px", padding: "1px 6px" },
                  },
                  focusedMeta.liveTurn ? "Respondendo" : focusedMeta.running ? "Em execução" : focusedMeta.inBuzz ? "Disponível" : "Pendente"
                ),
                selectedSeatId &&
                  h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "ghost",
                      style: { padding: "1px 5px", fontSize: "12px" },
                      title: "Fechar",
                      onClick: () => setSelectedSeatId(null),
                    },
                    "×"
                  )
              )
            ),
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "64px 1fr", gap: "4px 8px", fontSize: "11px" } },
              h("span", { className: "of-muted" }, "Etapa"),
              h("span", { style: { fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: focusedMeta.liveTurn?.stepLabel || focusedMeta.committee }, focusedMeta.liveTurn?.stepLabel || focusedMeta.committee),
              h("span", { className: "of-muted" }, "Na etapa"),
              h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px" } }, fmtBoardroomElapsed(focusedMeta.liveTurn?.startedAt || props.status?.lastTickAt)),
              h("span", { className: "of-muted" }, "Agente"),
              h("span", { className: "of-mono of-muted", style: { fontSize: "10.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: `${focusedMeta.provider} · ${focusedMeta.model}` }, `${focusedMeta.provider} · ${focusedMeta.model}`)
            ),
            h(
              "div",
              { style: { display: "flex", gap: "6px", paddingTop: "2px" } },
              props.onOpenAgentDm && focusedMeta.pubkey &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    style: { flex: 1, justifyContent: "center", fontSize: "11px", padding: "5px 8px" },
                    onClick: () => props.onOpenAgentDm!({ key: focusedMeta.agentKey, pubkey: focusedMeta.pubkey, name: focusedMeta.displayName }),
                  },
                  "Abrir chat lateral ↗"
                ),
              props.onOpenAgentProfile && focusedMeta.pubkey &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    style: { fontSize: "11px", padding: "5px 8px" },
                    onClick: () => props.onOpenAgentProfile!({ key: focusedMeta.agentKey, pubkey: focusedMeta.pubkey, name: focusedMeta.displayName }),
                  },
                  "Perfil ↗"
                )
            )
          ),

        // Controles flutuantes no canto inferior direito 1:1 com o Andar 3D
        h(
          "div",
          { style: { position: "absolute", right: "12px", bottom: "12px", zIndex: 20, display: "inline-flex", gap: "6px" } },
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              style: { background: "rgba(18, 20, 26, 0.88)" },
              title: isFullscreen ? "Sair da tela cheia" : "Tela cheia na Sala de Reunião 3D",
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
              title: "Enquadrar a Sala de Reunião 3D",
              onClick: () => setFitTick((n) => n + 1),
            },
            "⤢ Fit"
          )
        )
      ),
      h(
        "div",
        { className: "of-muted", style: { textAlign: "center", fontSize: "11px" } },
        `Conselho da Holding (board) · ${inBuzzCount}/${enrichedSeats.length} no Buzz · ${workingNowCount} respondendo agora · Sala de Reunião 3D`
      )
    );
  };
}
