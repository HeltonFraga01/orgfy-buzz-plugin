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

export interface BoardroomSeat {
  id: string;
  label: string;
  role: string;
  status: "active" | "working" | "planned";
  onClick?: () => void;
}

export interface Boardroom3DProps {
  seats: BoardroomSeat[];
  title?: string;
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

/** Cria textura Canvas da tela executiva principal do Conselho (KPIs, empresas e gráfico no acento do Buzz). */
function makeExecutiveScreenTexture(kit: Kit, seats: BoardroomSeat[], p: FloorPalette): THREE.CanvasTexture {
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
  g.fillText("CONSELHO DA HOLDING · PAINEL EXECUTIVO", 28, 37);

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

  // Contadores reais dos assentos
  const activeCnt = seats.filter((s) => s.status === "active").length;
  const workingCnt = seats.filter((s) => s.status === "working").length;
  const plannedCnt = seats.filter((s) => s.status === "planned").length;

  const kpis = [
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
    const [fitTick, setFitTick] = React.useState(0);
    const [themeVersion, setThemeVersion] = React.useState(0);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [hoveredSeat, setHoveredSeat] = React.useState<BoardroomSeat | null>(null);

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

      const screenTex = makeExecutiveScreenTexture(kit, seats, palette);
      const screenDisplay = new THREE.Mesh(
        kit.own(new THREE.PlaneGeometry(4.84, 1.78)),
        kit.own(new THREE.MeshBasicMaterial({ map: screenTex }))
      );
      screenDisplay.position.set(0, 1.68, -3.435);
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

      interface AnimatedDirector {
        seat: BoardroomSeat;
        bodyGroup: THREE.Group;
        eyesMesh: THREE.Mesh;
        dotsMesh: THREE.Mesh | null;
        ringMesh: THREE.Mesh;
        phase: number;
        baseY: number;
        hitTarget: THREE.Object3D;
      }

      const animated: AnimatedDirector[] = [];
      const hitTargets: THREE.Object3D[] = [];
      const seatByObject = new WeakMap<THREE.Object3D, BoardroomSeat>();

      seats.slice(0, seatSlots.length).forEach((seat, idx) => {
        const slot = seatSlots[idx];
        const seatGroup = new THREE.Group();
        seatGroup.position.set(...slot.pos);
        seatGroup.rotation.y = slot.rotY;
        scene.add(seatGroup);

        const chair = buildExecutiveChair(kit, matLeather, matSteel, matChrome);
        seatGroup.add(chair);

        const director = buildCodeDenDirector(kit, crew, palette, seat, idx);
        seatGroup.add(director.root);

        // Laptop + caneca + bloco de notas na mesa diante do assento
        const propsGroup = buildSeatDeskProps(kit, palette, seat.status);
        propsGroup.position.set(...slot.deskPos);
        propsGroup.rotation.y = slot.rotY;
        scene.add(propsGroup);

        // Hitbox invisível para clique/hover confortável
        const hitBox = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.95, 1.45, 0.95)),
          kit.own(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitBox.position.set(0, 0.72, 0);
        seatGroup.add(hitBox);
        hitTargets.push(hitBox);
        seatByObject.set(hitBox, seat);

        animated.push({
          seat,
          bodyGroup: director.bodyGroup,
          eyesMesh: director.eyesMesh,
          dotsMesh: director.dotsMesh,
          ringMesh: director.ringMesh,
          phase: idx * 1.37,
          baseY: director.bodyGroup.position.y,
          hitTarget: hitBox,
        });
      });

      // ── 6. INTERAÇÃO: ÓRBITA SUAVE + ZOOM + HOVER/CLIQUE NOS DIRETORES ──
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;

      const pickSeat = (e: MouseEvent): BoardroomSeat | null => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(hitTargets, false);
        if (hits.length === 0) return null;
        return seatByObject.get(hits[0].object) || null;
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
        const hit = pickSeat(e);
        setHoveredSeat((cur) => (cur?.id === hit?.id ? cur : hit));
        renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      };

      const onUp = (e: MouseEvent) => {
        if (dragging && !moved) {
          const hit = pickSeat(e);
          if (hit?.onClick) hit.onClick();
        }
        dragging = false;
        renderer.domElement.style.cursor = "grab";
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        frustum = Math.max(5.8, Math.min(14.5, frustum + e.deltaY * 0.008));
        updateCamera();
      };

      const onLeave = () => {
        setHoveredSeat(null);
      };

      const dom = renderer.domElement;
      dom.style.cursor = "grab";
      dom.addEventListener("mousedown", onDown);
      dom.addEventListener("mousemove", onMove);
      dom.addEventListener("mouseleave", onLeave);
      window.addEventListener("mouseup", onUp);
      dom.addEventListener("wheel", onWheel, { passive: false });

      // Loop de animação leve: respiração orgânica, piscada periódica e rotação de status
      let rafId = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        for (const a of animated) {
          const speed = a.seat.status === "working" ? 3.2 : 1.7;
          const amp = a.seat.status === "planned" ? 0.004 : 0.015;
          a.bodyGroup.position.y = a.baseY + Math.sin(t * speed + a.phase) * amp;

          // Piscada natural a cada ~4.2s
          const blinkCycle = (t + a.phase) % 4.2;
          const blinkScale = blinkCycle > 4.06 ? 0.14 : 1;
          a.eyesMesh.scale.y = blinkScale;

          if (a.dotsMesh) {
            a.dotsMesh.rotation.y = t * 2.4;
          }
          if (a.seat.status === "working") {
            const s = 1.38 + Math.sin(t * 3.6 + a.phase) * 0.08;
            a.ringMesh.scale.set(s, s, 1);
          }
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
    }, [seatsKey, fitTick, themeVersion]);

    return h(
      "div",
      {
        ref: hostRef,
        className: "of-card",
        "data-boardroom-3d": "true",
        "data-boardroom-codeden-v2": "true",
        style: { position: "relative", overflow: "hidden" },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 14px",
            borderBottom: "1px solid var(--border)",
            fontSize: "12px",
          },
        },
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
          h("strong", null, props.title || "Sala de Reunião do Conselho · Boardroom 3D"),
          h(
            "span",
            {
              className: "of-pill",
              style: {
                background: "var(--primary-soft)",
                borderColor: "var(--primary-border)",
                color: "var(--primary-text)",
              },
            },
            `${seats.length} assentos`
          )
        ),
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "ghost",
              style: { fontSize: "11px", padding: "3px 8px" },
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
              "data-variant": "ghost",
              style: { fontSize: "11px", padding: "3px 8px" },
              onClick: () => setFitTick((n) => n + 1),
            },
            "⤢ Enquadrar"
          )
        )
      ),
      h(
        "div",
        { style: { position: "relative", width: "100%", height: isFullscreen ? "calc(100vh - 88px)" : "380px" } },
        h("div", {
          ref: mountRef,
          style: { width: "100%", height: "100%", background: "var(--background)" },
        }),
        hoveredSeat &&
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: "12px",
                left: "12px",
                pointerEvents: "none",
                padding: "7px 11px",
                borderRadius: "8px",
                border: "1px solid var(--primary-border)",
                background: "rgba(15, 17, 22, 0.92)",
                backdropFilter: "blur(8px)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11.5px",
                boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
              },
            },
            h("span", {
              className: "of-dot",
              "data-tone": hoveredSeat.status === "working" ? "running" : hoveredSeat.status === "active" ? "done" : "idle",
            }),
            h("strong", null, hoveredSeat.label),
            h("span", { className: "of-muted" }, `· ${hoveredSeat.role}`),
            hoveredSeat.onClick && h("span", { style: { color: "var(--primary-text)", fontSize: "10.5px" } }, "Clique para abrir ↗")
          )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            padding: "8px 12px",
            borderTop: "1px solid var(--border)",
            background: "var(--panel)",
          },
        },
        seats.map((s) =>
          h(
            "button",
            {
              key: s.id,
              type: "button",
              className: "of-chip",
              onClick: s.onClick,
              onMouseEnter: () => setHoveredSeat(s),
              onMouseLeave: () => setHoveredSeat((cur) => (cur?.id === s.id ? null : cur)),
              title: `${s.label} — ${s.role}`,
            },
            h("span", {
              className: "of-dot",
              "data-tone": s.status === "working" ? "running" : s.status === "active" ? "done" : "idle",
            }),
            h("span", null, s.label),
            h("span", { className: "of-muted", style: { fontSize: "10px" } }, `· ${s.role}`)
          )
        )
      )
    );
  };
}
