// Adaptado de CodeDen (MIT) commit b0b2a5a + inspirado em pixel-agents (MIT) e ai-office (MIT)
// Escritório Virtual 3D Coworking Editável: planta baixa 16x12 interativa (paredes, vidro, mesas,
// café, sofás, racks, plantas e pisos), 3 presets arquitetônicos, agentes vivos caminhando com
// pathfinding A*, iluminação Dia/Noite 24h + modo Dark Factory e balões de chat sem sobreposição.

import * as THREE from "three";
import type { Context } from "@buzz/author";
import { readPalette, type FloorPalette } from "./codeden-floor/floor/palette";
import { Lights } from "./codeden-floor/floor/lights";
import { Kit, colour, canvasOf } from "./codeden-floor/floor/kit";
import type { Rgb } from "./codeden-floor/oklch";
import type { FactoryStatusPayload } from "./factory-adapter";
import type { BuzzLiveTelemetrySnapshot, LiveAgentTurn } from "./buzz-live-telemetry";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import { buildCustomAvatar3D, type Avatar3DHandle } from "./Avatar3DBuilder";
import {
  buildOfficePreset,
  findGridPathAStar,
  getInteractionSpot,
  isTileWalkable,
  loadSavedOfficeLayout,
  OFFICE_COLS,
  OFFICE_ROWS,
  paintFloorTile,
  placeOrReplaceFurniture,
  removeFurnitureAt,
  saveOfficeLayout,
  tileIndex,
  type FloorTileKind,
  type OfficeFurnitureItem,
  type OfficeFurnitureKind,
  type OfficeLayoutData,
} from "./office-layout-engine";

export interface VirtualOffice3DProps {
  holding?: any;
  activeTenant: string;
  tenantLabel?: string;
  liveCrew?: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  status?: FactoryStatusPayload;
  onSelectTenant?: (tenantId: string) => void;
  onOpenAgentDm?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenAgentProfile?: (agent: { key?: string; pubkey?: string; name?: string }) => void;
  onOpenTurnInSideChat?: (turn: LiveAgentTurn) => void;
}

type EditorTool =
  | { mode: "furniture"; kind: OfficeFurnitureKind; label: string }
  | { mode: "floor"; kind: FloorTileKind; label: string }
  | { mode: "erase"; label: string };

const EDITOR_TOOLS: EditorTool[] = [
  { mode: "furniture", kind: "desk", label: "Mesa + PC" },
  { mode: "furniture", kind: "wall", label: "Parede" },
  { mode: "furniture", kind: "glass_wall", label: "Vidro" },
  { mode: "furniture", kind: "meeting_table", label: "Reunião" },
  { mode: "furniture", kind: "sofa", label: "Sofá" },
  { mode: "furniture", kind: "coffee_bar", label: "Café" },
  { mode: "furniture", kind: "plant", label: "Planta" },
  { mode: "furniture", kind: "server_rack", label: "Rack" },
  { mode: "floor", kind: "wood", label: "Piso Madeira" },
  { mode: "floor", kind: "carpet", label: "Carpete" },
  { mode: "floor", kind: "lounge", label: "Lounge" },
  { mode: "floor", kind: "slate", label: "Ardósia" },
  { mode: "erase", label: "Apagar" },
];

const TILE_SIZE = 1.0;

function gridToWorld(gx: number, gz: number, cols = OFFICE_COLS, rows = OFFICE_ROWS): [number, number] {
  return [(gx - cols / 2 + 0.5) * TILE_SIZE, (gz - rows / 2 + 0.5) * TILE_SIZE];
}

function worldToGrid(wx: number, wz: number, cols = OFFICE_COLS, rows = OFFICE_ROWS): { gx: number; gz: number } {
  return {
    gx: Math.floor(wx / TILE_SIZE + cols / 2),
    gz: Math.floor(wz / TILE_SIZE + rows / 2),
  };
}

function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  const rr = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gg = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bb = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return alpha >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${alpha})`;
}

function fmtClock(tsMs?: number | null): string {
  if (!tsMs || !Number.isFinite(tsMs)) return "0s";
  const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const rem = diffSec % 60;
  if (mins < 60) return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function makeOfficeSignTexture(kit: Kit, title: string, subtitle: string, p: FloorPalette): THREE.CanvasTexture {
  const c = canvasOf(640, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = rgbToCss(p.sign);
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 4;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.fillStyle = rgbToCss(p.lane);
  g.fillRect(20, c.height - 14, c.width - 40, 7);
  g.fillStyle = p.signInk;
  g.font = "700 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(title.toUpperCase().slice(0, 26), c.width / 2, 48);
  g.fillStyle = "rgba(203,213,225,0.85)";
  g.font = "600 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.fillText(subtitle.toUpperCase().slice(0, 42), c.width / 2, 86);
  return kit.canvasTexture(c);
}

function makeMonitorScreenTexture(kit: Kit, p: FloorPalette, variant: number): THREE.CanvasTexture {
  const c = canvasOf(128, 80);
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b1120";
  g.fillRect(0, 0, c.width, c.height);
  const accent = rgbToCss(variant % 2 === 0 ? p.lane : p.accent.reviewer);
  g.fillStyle = accent;
  g.fillRect(8, 10, 44, 6);
  g.fillStyle = "rgba(148,163,184,0.55)";
  for (let row = 0; row < 5; row += 1) {
    const w = 36 + ((variant * 19 + row * 23) % 64);
    g.fillRect(8, 22 + row * 10, Math.min(110, w), 5);
  }
  g.fillStyle = accent;
  g.fillRect(92, 54, 24, 16);
  return kit.canvasTexture(c);
}

interface SharedMaterials {
  wood: THREE.Material;
  woodDark: THREE.Material;
  steel: THREE.Material;
  chrome: THREE.Material;
  wall: THREE.Material;
  glass: THREE.Material;
  lane: THREE.Material;
  fabric: THREE.Material;
  fabricAccent: THREE.Material;
  leaf: THREE.Material;
  leafDark: THREE.Material;
  mug: THREE.Material;
  screenA: THREE.Material;
  screenB: THREE.Material;
  ledGreen: THREE.Material;
  ledBlue: THREE.Material;
}

function buildFurnitureMesh(
  kit: Kit,
  item: OfficeFurnitureItem,
  mats: SharedMaterials,
  p: FloorPalette,
  ledMeshes: THREE.Mesh[]
): THREE.Group {
  const g = new THREE.Group();
  g.rotation.y = (item.rot % 4) * (Math.PI / 2);

  switch (item.kind) {
    case "wall": {
      const body = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.98, 1.85, 0.24)), mats.wall);
      body.position.y = 0.925;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      const cap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1.0, 0.06, 0.28)), mats.steel);
      cap.position.y = 1.88;
      g.add(cap);
      const base = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1.0, 0.08, 0.27)), mats.steel);
      base.position.y = 0.04;
      g.add(base);
      break;
    }

    case "glass_wall": {
      const pane = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.96, 1.8, 0.06)), mats.glass);
      pane.position.y = 0.92;
      g.add(pane);
      const topRail = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1.0, 0.07, 0.1)), mats.steel);
      topRail.position.y = 1.84;
      g.add(topRail);
      const botRail = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1.0, 0.08, 0.1)), mats.steel);
      botRail.position.y = 0.04;
      g.add(botRail);
      for (const sx of [-0.46, 0.46]) {
        const post = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 1.86, 0.1)), mats.steel);
        post.position.set(sx, 0.93, 0);
        post.castShadow = true;
        g.add(post);
      }
      break;
    }

    case "desk": {
      const top = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.9, 0.06, 0.56)), mats.wood);
      top.position.set(0, 0.62, -0.06);
      top.castShadow = true;
      top.receiveShadow = true;
      g.add(top);
      // Pernas metálicas
      for (const lx of [-0.39, 0.39]) {
        const leg = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.05, 0.6, 0.48)), mats.steel);
        leg.position.set(lx, 0.3, -0.06);
        leg.castShadow = true;
        g.add(leg);
      }
      // Monitor com tela viva
      const stand = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.16, 0.06)), mats.chrome);
      stand.position.set(0, 0.72, -0.2);
      g.add(stand);
      const bezel = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.52, 0.32, 0.04)), mats.steel);
      bezel.position.set(0, 0.88, -0.2);
      bezel.castShadow = true;
      g.add(bezel);
      const disp = new THREE.Mesh(
        kit.own(new THREE.PlaneGeometry(0.46, 0.26)),
        (item.gx + item.gz) % 2 === 0 ? mats.screenA : mats.screenB
      );
      disp.position.set(0, 0.88, -0.178);
      g.add(disp);
      // Teclado + caneca
      const kb = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.32, 0.018, 0.11)), mats.steel);
      kb.position.set(-0.04, 0.66, 0.04);
      g.add(kb);
      const mug = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.036, 0.032, 0.075, 10)), mats.mug);
      mug.position.set(0.3, 0.69, 0.04);
      g.add(mug);
      // Cadeira encaixada na frente (+z)
      const seat = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.36, 0.06, 0.34)), mats.fabric);
      seat.position.set(0, 0.34, 0.32);
      seat.castShadow = true;
      g.add(seat);
      const back = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.34, 0.36, 0.06)), mats.fabric);
      back.position.set(0, 0.52, 0.46);
      back.castShadow = true;
      g.add(back);
      const stem = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 8)), mats.chrome);
      stem.position.set(0, 0.16, 0.32);
      g.add(stem);
      break;
    }

    case "meeting_table": {
      const top = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.96, 0.07, 0.92)), mats.wood);
      top.position.y = 0.64;
      top.castShadow = true;
      top.receiveShadow = true;
      g.add(top);
      const inlay = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.76, 0.015, 0.1)), mats.lane);
      inlay.position.y = 0.68;
      g.add(inlay);
      const ped = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.62, 0.46)), mats.steel);
      ped.position.y = 0.31;
      ped.castShadow = true;
      g.add(ped);
      const base = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.56, 0.04, 0.62)), mats.chrome);
      base.position.y = 0.02;
      g.add(base);
      break;
    }

    case "sofa": {
      const base = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.92, 0.24, 0.72)), mats.fabricAccent);
      base.position.set(0, 0.18, 0.04);
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);
      const back = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.92, 0.46, 0.18)), mats.fabricAccent);
      back.position.set(0, 0.44, -0.24);
      back.castShadow = true;
      g.add(back);
      for (const sx of [-0.41, 0.41]) {
        const arm = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.12, 0.34, 0.72)), mats.fabric);
        arm.position.set(sx, 0.32, 0.04);
        arm.castShadow = true;
        g.add(arm);
      }
      break;
    }

    case "coffee_bar": {
      const counter = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.92, 0.76, 0.66)), mats.woodDark);
      counter.position.y = 0.38;
      counter.castShadow = true;
      counter.receiveShadow = true;
      g.add(counter);
      const top = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.96, 0.06, 0.7)), mats.steel);
      top.position.y = 0.79;
      g.add(top);
      // Máquina de espresso
      const mach = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.38, 0.34, 0.3)), mats.chrome);
      mach.position.set(-0.14, 0.99, -0.06);
      mach.castShadow = true;
      g.add(mach);
      const led = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.03, 0.02)), mats.ledGreen);
      led.position.set(-0.14, 1.08, 0.1);
      g.add(led);
      ledMeshes.push(led);
      // Xícaras
      for (const cx of [0.22, 0.34]) {
        const cup = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.04, 0.032, 0.08, 10)), mats.mug);
        cup.position.set(cx, 0.86, 0.08);
        g.add(cup);
      }
      break;
    }

    case "plant": {
      const pot = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.24, 0.18, 0.38, 12)), mats.steel);
      pot.position.y = 0.19;
      pot.castShadow = true;
      pot.receiveShadow = true;
      g.add(pot);
      const fronds: Array<[number, number, number, number]> = [
        [0, 0.72, 0, 0.24],
        [-0.14, 0.56, 0.1, 0.18],
        [0.14, 0.59, -0.09, 0.19],
        [-0.08, 0.53, -0.13, 0.16],
        [0.11, 0.55, 0.12, 0.17],
      ];
      fronds.forEach(([x, y, z, r], i) => {
        const f = new THREE.Mesh(kit.own(new THREE.DodecahedronGeometry(r, 0)), i % 2 === 0 ? mats.leaf : mats.leafDark);
        f.position.set(x, y, z);
        f.castShadow = true;
        g.add(f);
      });
      break;
    }

    case "server_rack": {
      const cab = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.76, 1.56, 0.68)), mats.steel);
      cab.position.y = 0.78;
      cab.castShadow = true;
      cab.receiveShadow = true;
      g.add(cab);
      const frontTrim = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(0.68, 1.44, 0.03)),
        kit.matte(p.dark ? [0.08, 0.1, 0.14] : [0.14, 0.17, 0.22], { roughness: 0.4 })
      );
      frontTrim.position.set(0, 0.78, 0.34);
      g.add(frontTrim);
      for (let row = 0; row < 5; row += 1) {
        const led = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.46, 0.035, 0.02)),
          row % 2 === 0 ? mats.ledBlue : mats.ledGreen
        );
        led.position.set(0, 0.3 + row * 0.24, 0.365);
        g.add(led);
        ledMeshes.push(led);
      }
      break;
    }
  }

  return g;
}

export function createVirtualOffice3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function VirtualOffice3DCanvas(props: VirtualOffice3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const mountRef = React.useRef<HTMLDivElement | null>(null);
    const bubbleNodesRef = React.useRef<Map<string, HTMLDivElement>>(new Map());

    const [layout, setLayout] = React.useState<OfficeLayoutData>(() => loadSavedOfficeLayout(props.activeTenant));
    const [editMode, setEditMode] = React.useState(false);
    const [activeToolIdx, setActiveToolIdx] = React.useState(0);
    const [toolRot, setToolRot] = React.useState<0 | 1 | 2 | 3>(0);
    const [timeHour, setTimeHour] = React.useState<number>(14);
    const [darkFactory, setDarkFactory] = React.useState<boolean>(true);
    const [fitTick, setFitTick] = React.useState(0);
    const [themeVersion, setThemeVersion] = React.useState(0);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [selectedAgentKey, setSelectedAgentKey] = React.useState<string | null>(null);
    const [copiedJson, setCopiedJson] = React.useState(false);
    const [, setClockTick] = React.useState(0);

    // Sincroniza planta ao trocar de empresa
    React.useEffect(() => {
      setLayout(loadSavedOfficeLayout(props.activeTenant));
      setSelectedAgentKey(null);
    }, [props.activeTenant]);

    // Persiste alterações do editor automaticamente
    React.useEffect(() => {
      saveOfficeLayout(props.activeTenant, layout);
    }, [props.activeTenant, layout]);

    // Observa trocas de tema/acento do Buzz Desktop
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

    // Atalho de teclado "R" para girar móvel durante edição
    React.useEffect(() => {
      if (!editMode) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "r" || e.key === "R") {
          setToolRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3));
        } else if (e.key === "Escape") {
          setEditMode(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [editMode]);

    // Refs para evitar recriar cena quando apenas ferramenta/rotação do editor mudam
    const editModeRef = React.useRef(editMode);
    editModeRef.current = editMode;
    const activeToolRef = React.useRef(EDITOR_TOOLS[activeToolIdx]);
    activeToolRef.current = EDITOR_TOOLS[activeToolIdx];
    const toolRotRef = React.useRef(toolRot);
    toolRotRef.current = toolRot;
    const layoutRef = React.useRef(layout);
    layoutRef.current = layout;

    const crewList = React.useMemo<LiveCrewAgent[]>(() => {
      const src = props.liveCrew && props.liveCrew.length > 0 ? props.liveCrew : [];
      return src.slice(0, 14);
    }, [props.liveCrew]);

    // Balões deduplicados por pubkey para nunca duplicar o mesmo agente
    const speechBubbles = React.useMemo(() => {
      const byPk = props.telemetry?.byPubkey || {};
      const seenPk = new Set<string>();
      const out: Array<{ agent: LiveCrewAgent; turn: LiveAgentTurn }> = [];
      for (const agent of crewList) {
        const pk = (agent.pubkey || "").toLowerCase();
        if (!pk || seenPk.has(pk)) continue;
        const turn = byPk[pk];
        if (!turn) continue;
        seenPk.add(pk);
        out.push({ agent, turn });
      }
      return out;
    }, [crewList, props.telemetry]);

    React.useEffect(() => {
      if (speechBubbles.length === 0) return;
      const id = window.setInterval(() => setClockTick((n) => n + 1), 1000);
      return () => window.clearInterval(id);
    }, [speechBubbles.length]);

    const crewSig = crewList.map((c) => `${c.key}:${c.pubkey || ""}:${c.running ? 1 : 0}`).join("|");
    const layoutSig = `${layout.presetName}:${layout.items.length}:${layout.items
      .map((i) => `${i.kind}@${i.gx},${i.gz},${i.rot}`)
      .join(";")}:${layout.floors.join("")}`;
    const workingKeysSig = speechBubbles.map((b) => b.agent.key).join(",");

    React.useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const palette = readPalette();
      const kit = new Kit();
      const width = Math.max(360, container.clientWidth || 780);
      const height = Math.max(340, container.clientHeight || 500);

      const scene = new THREE.Scene();
      // Iluminação 24h + Dark Factory
      const dayFactor = darkFactory
        ? 0.08
        : Math.max(0, Math.sin(((timeHour - 5) / 14) * Math.PI));
      const skyColor = darkFactory
        ? new THREE.Color(0x0b0e14)
        : new THREE.Color().setHSL(0.61, 0.25, 0.09 + dayFactor * 0.72);
      scene.background = skyColor;

      // Câmera ortográfica isométrica 1:1 com CodeDen
      let theta = 0.72;
      let phi = 0.96;
      let frustum = 14.2;
      const defaultTarget = new THREE.Vector3(0, 0.4, 0.2);
      const target = defaultTarget.clone();
      const desiredTarget = defaultTarget.clone();
      let desiredFrustum = frustum;

      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2,
        (frustum * aspect) / 2,
        frustum / 2,
        -frustum / 2,
        0.1,
        160
      );

      const updateCamera = () => {
        const w = Math.max(360, container.clientWidth || width);
        const hh = Math.max(340, container.clientHeight || height);
        const asp = w / hh;
        camera.left = (-frustum * asp) / 2;
        camera.right = (frustum * asp) / 2;
        camera.top = frustum / 2;
        camera.bottom = -frustum / 2;
        const dist = 36;
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
      renderer.toneMappingExposure = darkFactory ? 1.12 : 0.88 + dayFactor * 0.24;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      // Iluminação CodeDen + ângulo solar 24h
      const lights = new Lights();
      scene.add(lights.hemi, lights.sun, lights.sun.target);
      lights.set([{ x0: -8.5, x1: 8.5, y0: 0, y1: 4.5, z0: -6.5, z1: 6.5 }], palette, false);
      const sunAngle = ((timeHour - 6) / 12) * Math.PI;
      lights.sun.position.set(Math.cos(sunAngle) * 14, 9 + Math.max(0, Math.sin(sunAngle)) * 8, 9);
      lights.sun.intensity = darkFactory ? 1.05 : 0.45 + dayFactor * 1.15;
      lights.hemi.intensity = darkFactory ? 0.65 : 0.35 + dayFactor * 0.65;

      // Luz ambiente de escritório / neon Dark Factory
      const officeGlow = new THREE.PointLight(
        darkFactory ? colour(palette.lane) : 0xfff3d6,
        darkFactory ? 0.7 : 0.45 * (1 - dayFactor * 0.5),
        22
      );
      officeGlow.position.set(0, 4.2, 0);
      scene.add(officeGlow);

      // ── MATERIAIS COMPARTILHADOS ──
      const mats: SharedMaterials = {
        wood: kit.matte(palette.wood, { roughness: 0.58 }),
        woodDark: kit.matte([palette.wood[0] * 0.65, palette.wood[1] * 0.62, palette.wood[2] * 0.6], { roughness: 0.62 }),
        steel: kit.matte(palette.steel, { roughness: 0.48, metalness: 0.35 }),
        chrome: kit.matte(palette.chrome, { roughness: 0.24, metalness: 0.75 }),
        wall: kit.matte(palette.wall, { roughness: 0.84 }),
        glass: kit.own(
          new THREE.MeshPhysicalMaterial({
            color: colour(palette.glass),
            transparent: true,
            opacity: darkFactory ? 0.22 : 0.32,
            roughness: 0.1,
            metalness: 0.05,
          })
        ),
        lane: kit.matte(palette.lane, {
          roughness: 0.35,
          emissive: colour(palette.lane),
          emissiveIntensity: darkFactory ? 0.55 : 0.3,
        }),
        fabric: kit.matte(darkFactory ? [0.18, 0.2, 0.26] : [0.28, 0.32, 0.39], { roughness: 0.78 }),
        fabricAccent: kit.matte(darkFactory ? [0.22, 0.28, 0.38] : [0.32, 0.42, 0.56], { roughness: 0.8 }),
        leaf: kit.matte(palette.lamp.green, { roughness: 0.72 }),
        leafDark: kit.matte([palette.lamp.green[0] * 0.76, palette.lamp.green[1] * 0.76, palette.lamp.green[2] * 0.76], {
          roughness: 0.75,
        }),
        mug: kit.matte(palette.paper, { roughness: 0.4 }),
        screenA: kit.own(new THREE.MeshBasicMaterial({ map: makeMonitorScreenTexture(kit, palette, 0) })),
        screenB: kit.own(new THREE.MeshBasicMaterial({ map: makeMonitorScreenTexture(kit, palette, 1) })),
        ledGreen: kit.own(new THREE.MeshBasicMaterial({ color: 0x34d399 })),
        ledBlue: kit.own(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })),
      };

      // ── 1. LAJE PRINCIPAL + FILETES DE ACENTO DO BUZZ ──
      const slabW = layout.cols * TILE_SIZE + 0.5;
      const slabD = layout.rows * TILE_SIZE + 0.5;
      const baseSlab = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(slabW, 0.36, slabD)),
        kit.matte(palette.floor, { roughness: 0.9 })
      );
      baseSlab.position.set(0, -0.18, 0);
      baseSlab.receiveShadow = true;
      scene.add(baseSlab);

      const frontTrim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(slabW + 0.04, 0.08, 0.08)), mats.lane);
      frontTrim.position.set(0, -0.04, slabD / 2);
      scene.add(frontTrim);
      const rightTrim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.08, 0.08, slabD + 0.04)), mats.lane);
      rightTrim.position.set(slabW / 2, -0.04, 0);
      scene.add(rightTrim);

      // ── 2. PISOS POR CÉLULA (WOOD / SLATE / CARPET / LOUNGE) ──
      const floorTileMats: Record<FloorTileKind, THREE.Material> = {
        wood: kit.matte(darkFactory ? [0.27, 0.22, 0.17] : [0.68, 0.56, 0.42], { roughness: 0.74 }),
        slate: kit.matte(darkFactory ? [0.15, 0.17, 0.21] : [0.42, 0.45, 0.5], { roughness: 0.86 }),
        carpet: kit.matte(darkFactory ? [0.17, 0.2, 0.28] : [0.34, 0.4, 0.52], { roughness: 0.96 }),
        lounge: kit.matte(darkFactory ? [0.25, 0.21, 0.2] : [0.76, 0.67, 0.57], { roughness: 0.85 }),
      };

      const tileGeo = kit.own(new THREE.BoxGeometry(TILE_SIZE - 0.03, 0.03, TILE_SIZE - 0.03));
      for (let gz = 0; gz < layout.rows; gz += 1) {
        for (let gx = 0; gx < layout.cols; gx += 1) {
          const kind = layout.floors[tileIndex(gx, gz, layout.cols)] || "wood";
          const tile = new THREE.Mesh(tileGeo, floorTileMats[kind]);
          const [wx, wz] = gridToWorld(gx, gz, layout.cols, layout.rows);
          tile.position.set(wx, 0.015, wz);
          tile.receiveShadow = true;
          scene.add(tile);
        }
      }

      // Plano invisível para raycast preciso no grid do editor
      const floorPickPlane = new THREE.Mesh(
        kit.own(new THREE.PlaneGeometry(layout.cols * TILE_SIZE, layout.rows * TILE_SIZE)),
        kit.own(new THREE.MeshBasicMaterial({ visible: false }))
      );
      floorPickPlane.rotation.x = -Math.PI / 2;
      floorPickPlane.position.y = 0.035;
      scene.add(floorPickPlane);

      // ── 3. PAREDES PERIMETRAIS EM L + PLACA CODEDEN ──
      const wallH = 2.95;
      const backWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(slabW, wallH, 0.24)), mats.wall);
      backWall.position.set(0, wallH / 2, -slabD / 2 + 0.12);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.24, wallH, slabD)), mats.wall);
      leftWall.position.set(-slabW / 2 + 0.12, wallH / 2, 0);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const backCap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(slabW + 0.04, 0.08, 0.28)), mats.steel);
      backCap.position.set(0, wallH + 0.02, -slabD / 2 + 0.12);
      scene.add(backCap);
      const leftCap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.08, slabD + 0.04)), mats.steel);
      leftCap.position.set(-slabW / 2 + 0.12, wallH + 0.02, 0);
      scene.add(leftCap);

      // Placa arquitetônica na parede norte
      const signTex = makeOfficeSignTexture(
        kit,
        `ESCRITÓRIO 3D · ${props.tenantLabel || props.activeTenant}`,
        `${crewList.length} agentes · ${layout.items.filter((i) => i.kind === "desk").length} mesas · A* ativo`,
        palette
      );
      const signMesh = new THREE.Mesh(
        kit.own(new THREE.BoxGeometry(4.2, 0.84, 0.08)),
        [mats.steel, mats.steel, mats.steel, mats.steel, kit.own(new THREE.MeshBasicMaterial({ map: signTex })), mats.steel]
      );
      signMesh.position.set(0, 2.05, -slabD / 2 + 0.28);
      signMesh.castShadow = true;
      scene.add(signMesh);

      // ── 4. MOBILIÁRIO & DIVISÓRIAS DO LAYOUT ATUAL ──
      const ledMeshes: THREE.Mesh[] = [];
      for (const item of layout.items) {
        const mesh = buildFurnitureMesh(kit, item, mats, palette, ledMeshes);
        const [wx, wz] = gridToWorld(item.gx, item.gz, layout.cols, layout.rows);
        mesh.position.set(wx, 0.03, wz);
        scene.add(mesh);
      }

      // ── 5. CURSOR FANTASMA 3D DO EDITOR DE ESCRITÓRIO ──
      const ghostGroup = new THREE.Group();
      ghostGroup.visible = false;
      const ghostMat = kit.own(
        new THREE.MeshBasicMaterial({
          color: colour(palette.lane),
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        })
      );
      const ghostBox = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.94, 0.72, 0.94)), ghostMat);
      ghostBox.position.y = 0.38;
      ghostGroup.add(ghostBox);
      const ghostBorder = new THREE.Mesh(
        kit.own(new THREE.RingGeometry(0.42, 0.5, 4)),
        kit.own(new THREE.MeshBasicMaterial({ color: colour(palette.lane), side: THREE.DoubleSide }))
      );
      ghostBorder.rotation.x = -Math.PI / 2;
      ghostBorder.rotation.z = Math.PI / 4;
      ghostBorder.position.y = 0.05;
      ghostGroup.add(ghostBorder);
      scene.add(ghostGroup);

      // ── 6. AGENTES VIVOS COM PATHFINDING A* ──
      const desks = layout.items.filter((i) => i.kind === "desk");
      const socialTargets = layout.items.filter(
        (i) => i.kind === "coffee_bar" || i.kind === "sofa" || i.kind === "meeting_table"
      );

      interface WalkingAgent {
        agent: LiveCrewAgent;
        group: THREE.Group;
        avatar: Avatar3DHandle;
        homeSpot: { gx: number; gz: number; lookAt: [number, number] };
        gx: number;
        gz: number;
        path: Array<{ gx: number; gz: number }>;
        pathIdx: number;
        segProgress: number;
        waitTimer: number;
        working: boolean;
        phase: number;
        hitBox: THREE.Mesh;
      }

      const workingKeySet = new Set(speechBubbles.map((b) => b.agent.key));
      const walkers: WalkingAgent[] = [];
      const agentHitTargets: THREE.Object3D[] = [];
      const agentByHit = new WeakMap<THREE.Object3D, WalkingAgent>();

      const findFallbackSpot = (idx: number): { gx: number; gz: number; lookAt: [number, number] } => {
        for (let tries = 0; tries < 40; tries += 1) {
          const gx = 2 + ((idx * 3 + tries) % (layout.cols - 4));
          const gz = 2 + ((idx * 2 + Math.floor(tries / 4)) % (layout.rows - 4));
          if (isTileWalkable(layout, gx, gz)) {
            const [wx, wz] = gridToWorld(gx, gz, layout.cols, layout.rows);
            return { gx, gz, lookAt: [wx, wz + 1] };
          }
        }
        return { gx: 7, gz: 6, lookAt: [0, 1] };
      };

      crewList.forEach((agent, idx) => {
        const desk = desks[idx % Math.max(1, desks.length)];
        let homeSpot = findFallbackSpot(idx);
        if (desk) {
          const spot = getInteractionSpot(layout, desk);
          if (spot) {
            const [dwx, dwz] = gridToWorld(desk.gx, desk.gz, layout.cols, layout.rows);
            homeSpot = { gx: spot.gx, gz: spot.gz, lookAt: [dwx, dwz] };
          }
        }

        const isWorking = workingKeySet.has(agent.key) || Boolean(agent.running);
        const pk = (agent.pubkey || "").toLowerCase();
        const liveTurn = pk && props.telemetry?.byPubkey ? props.telemetry.byPubkey[pk] : undefined;
        const avStatus = liveTurn?.state === "error" ? "error" : isWorking ? "working" : "active";

        const group = new THREE.Group();
        const [wx, wz] = gridToWorld(homeSpot.gx, homeSpot.gz, layout.cols, layout.rows);
        group.position.set(wx, 0.03, wz);
        group.rotation.y = Math.atan2(homeSpot.lookAt[0] - wx, homeSpot.lookAt[1] - wz);
        scene.add(group);

        const avatar = buildCustomAvatar3D(
          kit,
          palette,
          { name: agent.name, role: agent.model || "", picture: agent.picture, status: avStatus, index: idx },
          { seatHeight: 0.02, scale: 0.92, showPortraitMedallion: true }
        );
        group.add(avatar.root);

        const hitBox = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.75, 1.35, 0.75)),
          kit.own(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitBox.position.set(0, 0.68, 0);
        group.add(hitBox);
        agentHitTargets.push(hitBox);

        const w: WalkingAgent = {
          agent,
          group,
          avatar,
          homeSpot,
          gx: homeSpot.gx,
          gz: homeSpot.gz,
          path: [],
          pathIdx: 0,
          segProgress: 0,
          waitTimer: 2 + (idx % 5) * 1.6,
          working: isWorking,
          phase: idx * 1.17,
          hitBox,
        };
        walkers.push(w);
        agentByHit.set(hitBox, w);
      });

      // ── 7. INTERAÇÃO DO MOUSE (ÓRBITA + EDITOR 3D + CLIQUE EM AGENTE) ──
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;

      const setPointer = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
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
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
          theta -= dx * 0.008;
          phi = Math.max(0.45, Math.min(1.22, phi - dy * 0.006));
          lastX = e.clientX;
          lastY = e.clientY;
          updateCamera();
          return;
        }
        setPointer(e);
        if (editModeRef.current) {
          const hit = raycaster.intersectObject(floorPickPlane, false)[0];
          if (hit) {
            const { gx, gz } = worldToGrid(hit.point.x, hit.point.z, layout.cols, layout.rows);
            if (gx >= 0 && gx < layout.cols && gz >= 0 && gz < layout.rows) {
              const [wx, wz] = gridToWorld(gx, gz, layout.cols, layout.rows);
              ghostGroup.visible = true;
              ghostGroup.position.set(wx, 0.03, wz);
              ghostGroup.rotation.y = (toolRotRef.current % 4) * (Math.PI / 2);
              const isErase = activeToolRef.current.mode === "erase";
              ghostMat.color.set(isErase ? 0xef4444 : colour(palette.lane));
              renderer.domElement.style.cursor = "crosshair";
              return;
            }
          }
          ghostGroup.visible = false;
          renderer.domElement.style.cursor = "grab";
          return;
        }
        ghostGroup.visible = false;
        const hitAgent = raycaster.intersectObjects(agentHitTargets, false)[0];
        renderer.domElement.style.cursor = hitAgent ? "pointer" : "grab";
      };

      const onUp = (e: MouseEvent) => {
        if (dragging && !moved) {
          setPointer(e);
          if (editModeRef.current) {
            const hit = raycaster.intersectObject(floorPickPlane, false)[0];
            if (hit) {
              const { gx, gz } = worldToGrid(hit.point.x, hit.point.z, layout.cols, layout.rows);
              if (gx >= 0 && gx < layout.cols && gz >= 0 && gz < layout.rows) {
                const tool = activeToolRef.current;
                const rot = toolRotRef.current;
                setLayout((prev) => {
                  if (tool.mode === "erase") return removeFurnitureAt(prev, gx, gz);
                  if (tool.mode === "floor") return paintFloorTile(prev, gx, gz, tool.kind);
                  return placeOrReplaceFurniture(prev, tool.kind, gx, gz, rot);
                });
              }
            }
          } else {
            const hitAgent = raycaster.intersectObjects(agentHitTargets, false)[0];
            if (hitAgent) {
              const w = agentByHit.get(hitAgent.object);
              if (w) {
                setSelectedAgentKey(w.agent.key);
                desiredTarget.set(w.group.position.x * 0.7, 0.6, w.group.position.z * 0.7);
                desiredFrustum = 8.4;
              }
            } else {
              setSelectedAgentKey(null);
              desiredTarget.copy(defaultTarget);
              desiredFrustum = 14.2;
            }
          }
        }
        dragging = false;
        renderer.domElement.style.cursor = editModeRef.current ? "crosshair" : "grab";
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        frustum = Math.max(6.2, Math.min(20.5, frustum + e.deltaY * 0.01));
        desiredFrustum = frustum;
        updateCamera();
      };

      const dom = renderer.domElement;
      dom.style.cursor = "grab";
      dom.addEventListener("mousedown", onDown);
      dom.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      dom.addEventListener("wheel", onWheel, { passive: false });

      // ── 8. LOOP DE ANIMAÇÃO (A* WALKING + LEDS + BALÕES SEM SOBREPOSIÇÃO) ──
      let rafId = 0;
      const clock = new THREE.Clock();
      const headVec = new THREE.Vector3();

      const pickIdleDestination = (w: WalkingAgent): { gx: number; gz: number } | null => {
        if (Math.random() < 0.65 && socialTargets.length > 0) {
          const targetItem = socialTargets[Math.floor(Math.random() * socialTargets.length)];
          const spot = getInteractionSpot(layoutRef.current, targetItem);
          if (spot) return spot;
        }
        // Ou volta para a própria mesa
        if (w.gx !== w.homeSpot.gx || w.gz !== w.homeSpot.gz) {
          return { gx: w.homeSpot.gx, gz: w.homeSpot.gz };
        }
        for (let tries = 0; tries < 10; tries += 1) {
          const rx = 1 + Math.floor(Math.random() * (layout.cols - 2));
          const rz = 1 + Math.floor(Math.random() * (layout.rows - 2));
          if (isTileWalkable(layoutRef.current, rx, rz)) return { gx: rx, gz: rz };
        }
        return null;
      };

      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const dt = Math.min(0.05, clock.getDelta());
        const t = clock.elapsedTime;
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;

        // Voo suave da câmera
        let camDirty = false;
        if (target.distanceTo(desiredTarget) > 0.01) {
          target.lerp(desiredTarget, 0.09);
          camDirty = true;
        }
        if (Math.abs(frustum - desiredFrustum) > 0.02) {
          frustum += (desiredFrustum - frustum) * 0.09;
          camDirty = true;
        }
        if (camDirty) updateCamera();

        // Pisca sutil dos LEDs dos racks
        for (let i = 0; i < ledMeshes.length; i += 1) {
          ledMeshes[i].visible = Math.sin(t * 3.5 + i * 1.7) > -0.65;
        }

        // Atualiza agentes com A* + coleta projeções de balões para resolver colisões
        const projectedBubbles: Array<{ node: HTMLDivElement; cx: number; bottom: number; w: number; h: number }> = [];

        for (const w of walkers) {
          w.avatar.animate(t, w.phase, { working: w.working });

          if (w.path.length > 1 && w.pathIdx < w.path.length - 1) {
            // Caminhando ao longo do caminho A*
            const speed = w.working ? 2.6 : 1.55;
            w.segProgress += dt * speed;
            while (w.segProgress >= 1 && w.pathIdx < w.path.length - 1) {
              w.segProgress -= 1;
              w.pathIdx += 1;
              w.gx = w.path[w.pathIdx].gx;
              w.gz = w.path[w.pathIdx].gz;
            }
            if (w.pathIdx < w.path.length - 1) {
              const a = w.path[w.pathIdx];
              const b = w.path[w.pathIdx + 1];
              const [ax, az] = gridToWorld(a.gx, a.gz, layout.cols, layout.rows);
              const [bx, bz] = gridToWorld(b.gx, b.gz, layout.cols, layout.rows);
              const px = ax + (bx - ax) * w.segProgress;
              const pz = az + (bz - az) * w.segProgress;
              const bob = Math.abs(Math.sin(t * 9.5 + w.phase)) * 0.06;
              w.group.position.set(px, 0.03 + bob, pz);
              const targetYaw = Math.atan2(bx - ax, bz - az);
              w.group.rotation.y += Math.atan2(Math.sin(targetYaw - w.group.rotation.y), Math.cos(targetYaw - w.group.rotation.y)) * 0.2;
            } else {
              const [fx, fz] = gridToWorld(w.gx, w.gz, layout.cols, layout.rows);
              w.group.position.set(fx, 0.03, fz);
              w.path = [];
              w.waitTimer = 5 + Math.random() * 8;
            }
          } else {
            // Parado na mesa ou lounge
            if (w.working && (w.gx !== w.homeSpot.gx || w.gz !== w.homeSpot.gz)) {
              const path = findGridPathAStar(layoutRef.current, { gx: w.gx, gz: w.gz }, { gx: w.homeSpot.gx, gz: w.homeSpot.gz });
              if (path.length > 1) {
                w.path = path;
                w.pathIdx = 0;
                w.segProgress = 0;
              }
            } else if (!w.working && !editModeRef.current) {
              w.waitTimer -= dt;
              if (w.waitTimer <= 0) {
                const dest = pickIdleDestination(w);
                if (dest && (dest.gx !== w.gx || dest.gz !== w.gz)) {
                  const path = findGridPathAStar(layoutRef.current, { gx: w.gx, gz: w.gz }, dest);
                  if (path.length > 1) {
                    w.path = path;
                    w.pathIdx = 0;
                    w.segProgress = 0;
                  } else {
                    w.waitTimer = 6;
                  }
                } else {
                  w.waitTimer = 6;
                }
              }
            }
          }

          // Projeta balão se o agente estiver respondendo ao vivo
          const bubbleNode = bubbleNodesRef.current.get(w.agent.key);
          if (bubbleNode) {
            headVec.set(0, 1.48, 0).applyMatrix4(w.group.matrixWorld).project(camera);
            const sx = (headVec.x * 0.5 + 0.5) * cw;
            const sy = (-headVec.y * 0.5 + 0.5) * ch;
            const bw = bubbleNode.offsetWidth || 212;
            const bh = bubbleNode.offsetHeight || 78;
            const cx = Math.max(bw / 2 + 10, Math.min(cw - bw / 2 - 10, sx));
            const bottom = Math.max(bh + 14, Math.min(ch - 18, sy - 12));
            projectedBubbles.push({ node: bubbleNode, cx, bottom, w: bw, h: bh });
          }
        }

        // Resolução de colisão vertical entre balões (evita sobreposição)
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
              const w = Math.max(360, container.clientWidth || width);
              const hh = Math.max(340, container.clientHeight || height);
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
        window.removeEventListener("mouseup", onUp);
        dom.removeEventListener("wheel", onWheel);
        lights.dispose();
        kit.dispose();
        renderer.dispose();
      };
    }, [layoutSig, crewSig, workingKeysSig, timeHour, darkFactory, fitTick, themeVersion, props.activeTenant, props.tenantLabel]);

    const focusedAgent = selectedAgentKey ? crewList.find((c) => c.key === selectedAgentKey) || null : null;
    const focusedTurn =
      focusedAgent?.pubkey && props.telemetry?.byPubkey
        ? props.telemetry.byPubkey[focusedAgent.pubkey.toLowerCase()] || null
        : null;

    const handleExportJson = () => {
      try {
        const json = JSON.stringify(layout, null, 2);
        void navigator?.clipboard?.writeText?.(json);
        setCopiedJson(true);
        window.setTimeout(() => setCopiedJson(false), 2000);
      } catch {}
    };

    const empresas: Array<{ id: string; nome: string }> = React.useMemo(() => {
      const list = Array.isArray(props.holding?.empresas)
        ? props.holding.empresas.map((e: any) => ({ id: String(e.id || e.slug), nome: String(e.nome || e.id) }))
        : [{ id: props.activeTenant, nome: props.tenantLabel || props.activeTenant }];
      return list;
    }, [props.holding, props.activeTenant, props.tenantLabel]);

    return h(
      "div",
      {
        "data-virtual-office-3d": "true",
        "data-office-preset": layout.presetName,
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
            background: "#0b0e14",
            overflow: "hidden",
          },
        },
        h("div", { ref: mountRef, style: { width: "100%", height: "100%" } }),

        // Camada de balões de chat ao vivo (sem sobreposição)
        h(
          "div",
          {
            "data-office-speech-layer": "true",
            style: { position: "absolute", inset: 0, zIndex: 18, pointerEvents: "none", overflow: "hidden" },
          },
          speechBubbles.map(({ agent, turn }) => {
            const isErr = turn.state === "error";
            const borderColor = isErr ? "rgba(239, 68, 68, 0.72)" : "rgba(59, 130, 246, 0.65)";
            const accentColor = isErr ? "#f87171" : "#60a5fa";
            return h(
              "div",
              {
                key: agent.key,
                "data-office-speech-bubble": agent.key,
                ref: (el: HTMLDivElement | null) => {
                  if (el) bubbleNodesRef.current.set(agent.key, el);
                  else bubbleNodesRef.current.delete(agent.key);
                },
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  opacity: 0,
                  pointerEvents: "none",
                  willChange: "transform",
                  width: "212px",
                },
                onClick: () => setSelectedAgentKey(agent.key),
              },
              h(
                "div",
                {
                  style: {
                    borderRadius: "10px",
                    border: `1px solid ${borderColor}`,
                    background: "rgba(15, 18, 24, 0.94)",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
                    padding: "6px 9px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    cursor: "pointer",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px" } },
                  h("span", { style: { width: "6px", height: "6px", borderRadius: "999px", background: accentColor, flexShrink: 0 } }),
                  h("span", { style: { fontSize: "11px", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, agent.name),
                  h("span", { className: "of-mono", style: { fontSize: "9.5px", color: accentColor } }, fmtClock(turn.startedAt))
                ),
                h(
                  "div",
                  { style: { fontSize: "10.5px", color: isErr ? "#fca5a5" : "rgba(229,231,235,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  turn.stepLabel || "Trabalhando..."
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "ghost",
                    style: { width: "100%", justifyContent: "center", padding: "2px 6px", fontSize: "10px" },
                    onClick: (ev: any) => {
                      ev.stopPropagation();
                      if (turn.channelId && props.onOpenTurnInSideChat) props.onOpenTurnInSideChat(turn);
                      else if (props.onOpenAgentDm) props.onOpenAgentDm({ key: agent.key, pubkey: agent.pubkey, name: agent.name });
                    },
                  },
                  "Ver chat ↗"
                )
              )
            );
          })
        ),

        // Barra superior esquerda: Seletor de Empresa + Botão Editar Escritório + Presets
        h(
          "div",
          {
            style: {
              position: "absolute",
              top: "10px",
              left: "10px",
              zIndex: 22,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
              maxWidth: "calc(100% - 260px)",
            },
          },
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": editMode ? "primary" : undefined,
              "data-office-edit-toggle": "true",
              style: { background: editMode ? undefined : "rgba(18, 20, 26, 0.9)", fontWeight: 600 },
              onClick: () => setEditMode((v) => !v),
            },
            editMode ? "✓ Concluir Edição" : "✎ Editar Escritório"
          ),
          empresas.length > 1 &&
            h(
              "select",
              {
                value: props.activeTenant,
                onChange: (ev: any) => props.onSelectTenant?.(ev.target.value),
                style: {
                  background: "rgba(18, 20, 26, 0.9)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  padding: "4px 8px",
                  fontSize: "11px",
                },
              },
              empresas.map((emp) => h("option", { key: emp.id, value: emp.id }, emp.nome))
            ),
          (["holding_suites", "startup_open", "cyber_lab"] as const).map((presetKey) => {
            const labels = { holding_suites: "Holding Suites", startup_open: "Startup Open", cyber_lab: "Cyber Lab" };
            const active = layout.presetName === presetKey;
            return h(
              "button",
              {
                key: presetKey,
                type: "button",
                className: "of-btn",
                "data-variant": active ? "primary" : "ghost",
                style: {
                  background: active ? undefined : "rgba(18, 20, 26, 0.85)",
                  fontSize: "10.5px",
                  padding: "4px 8px",
                },
                onClick: () => setLayout(buildOfficePreset(presetKey)),
              },
              labels[presetKey]
            );
          })
        ),

        // Barra superior direita: Slider Dia/Noite 24h + Dark Factory
        h(
          "div",
          {
            style: {
              position: "absolute",
              top: "10px",
              right: "10px",
              zIndex: 22,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(18, 20, 26, 0.9)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "4px 9px",
              backdropFilter: "blur(8px)",
            },
          },
          !darkFactory &&
            h(
              "label",
              { style: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10.5px" } },
              h("span", { className: "of-mono" }, `${String(Math.round(timeHour)).padStart(2, "0")}h`),
              h("input", {
                type: "range",
                min: 6,
                max: 23,
                step: 1,
                value: timeHour,
                onChange: (ev: any) => setTimeHour(Number(ev.target.value)),
                style: { width: "68px", accentColor: "var(--primary)" },
              })
            ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": darkFactory ? "primary" : "ghost",
              style: { fontSize: "10.5px", padding: "3px 7px" },
              onClick: () => setDarkFactory((d) => !d),
            },
            darkFactory ? "☾ Dark Factory" : "☀ Dia/Noite"
          )
        ),

        // Paleta do Editor Interativo (quando editMode === true)
        editMode &&
          h(
            "div",
            {
              "data-office-editor-bar": "true",
              style: {
                position: "absolute",
                left: "10px",
                right: "160px",
                bottom: "10px",
                zIndex: 24,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                flexWrap: "wrap",
                padding: "7px 9px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                background: "rgba(15, 18, 24, 0.95)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
              },
            },
            EDITOR_TOOLS.map((tool, idx) =>
              h(
                "button",
                {
                  key: `${tool.mode}:${"kind" in tool ? tool.kind : "x"}`,
                  type: "button",
                  className: "of-btn",
                  "data-variant": activeToolIdx === idx ? "primary" : "ghost",
                  style: { fontSize: "10.5px", padding: "3px 7px" },
                  onClick: () => setActiveToolIdx(idx),
                },
                tool.label
              )
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { fontSize: "10.5px", padding: "3px 7px", marginLeft: "auto" },
                title: "Girar móvel em 90° (atalho: R)",
                onClick: () => setToolRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3)),
              },
              `↻ ${toolRot * 90}° [R]`
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { fontSize: "10.5px", padding: "3px 7px" },
                onClick: handleExportJson,
              },
              copiedJson ? "✓ JSON Copiado" : "⤓ JSON"
            )
          ),

        // Popover do agente selecionado
        focusedAgent &&
          !editMode &&
          h(
            "div",
            {
              "data-office-agent-popover": "true",
              style: {
                position: "absolute",
                top: "52px",
                right: "10px",
                zIndex: 25,
                width: "260px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                background: "rgba(18, 20, 26, 0.95)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
              h(
                "div",
                { style: { display: "inline-flex", alignItems: "center", gap: "7px", minWidth: 0 } },
                focusedAgent.picture &&
                  h("img", {
                    src: focusedAgent.picture,
                    alt: focusedAgent.name,
                    style: { width: "22px", height: "22px", borderRadius: "5px", objectFit: "cover" },
                  }),
                h("strong", { style: { fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, focusedAgent.name)
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  style: { padding: "1px 5px" },
                  onClick: () => setSelectedAgentKey(null),
                },
                "×"
              )
            ),
            h(
              "div",
              { className: "of-muted", style: { fontSize: "11px" } },
              focusedTurn?.stepLabel || `${focusedAgent.provider} · ${focusedAgent.model}` || "Caminhando pelo escritório (A*)"
            ),
            h(
              "div",
              { style: { display: "flex", gap: "6px" } },
              props.onOpenAgentDm &&
                focusedAgent.pubkey &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    "data-variant": "primary",
                    style: { flex: 1, justifyContent: "center", fontSize: "11px", padding: "4px 8px" },
                    onClick: () =>
                      props.onOpenAgentDm!({ key: focusedAgent.key, pubkey: focusedAgent.pubkey, name: focusedAgent.name }),
                  },
                  "Abrir chat ↗"
                ),
              props.onOpenAgentProfile &&
                focusedAgent.pubkey &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    style: { fontSize: "11px", padding: "4px 8px" },
                    onClick: () =>
                      props.onOpenAgentProfile!({ key: focusedAgent.key, pubkey: focusedAgent.pubkey, name: focusedAgent.name }),
                  },
                  "Perfil ↗"
                )
            )
          ),

        // Controles inferiores direitos: Tela cheia + Fit
        h(
          "div",
          { style: { position: "absolute", right: "10px", bottom: "10px", zIndex: 22, display: "inline-flex", gap: "6px" } },
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
              onClick: () => setFitTick((n) => n + 1),
            },
            "⤢ Fit"
          )
        )
      ),
      h(
        "div",
        { className: "of-muted", style: { textAlign: "center", fontSize: "11px" } },
        editMode
          ? `Modo Editor ativo · Clique no piso para construir/pintar · Tecla R gira 90° · Layout salvo automaticamente`
          : `Escritório 3D (${props.tenantLabel || props.activeTenant}) · ${crewList.length} agentes com A* · ${layout.items.length} móveis/divisórias · Arraste para orbitar`
      )
    );
  };
}
