// Adaptado de CodeDen (MIT) commit b0b2a5a — Torre da Holding Cortexx / OrgFy (Visualização 3D Multi-Andares em Corte Isométrico)
// - Cobertura: Sala do Conselho da Holding + Escritório Iris com holograma giratório
// - Andares inferiores: Uma laje viva para cada subsidiária (OrgFy Core, Lumen IPTV, SaaS Tributário...)
// - Elevador de Dados central com cápsulas luminosas subindo/descendo entre andares
// - Esteiras animadas com pacotes de PR/cards trafegando em tempo real + avatares 3D reais
// - Câmera cinematográfica com voo suave (lerp) ao clicar no andar + toggle Dia / Dark Factory

import * as THREE from "three";
import type { Context } from "@buzz/author";
import { readPalette, type FloorPalette } from "./codeden-floor/floor/palette";
import { Lights } from "./codeden-floor/floor/lights";
import { Kit, colour, canvasOf } from "./codeden-floor/floor/kit";
import type { Rgb } from "./codeden-floor/oklch";
import type { HoldingControlPlaneSnapshot } from "../services/holding-service";
import type { BuzzLiveTelemetrySnapshot } from "./buzz-live-telemetry";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";
import { buildCustomAvatar3D, type Avatar3DHandle } from "./Avatar3DBuilder";

export interface HoldingTowerFloorInfo {
  slug: string;
  nome: string;
  estagio: string;
  isBoard?: boolean;
  agentesCount: number;
  workingCount: number;
  errorCount: number;
  agents: Array<{ name: string; role?: string; picture?: string; status: "active" | "working" | "planned" | "error" }>;
}

export interface HoldingTower3DProps {
  holding?: HoldingControlPlaneSnapshot | null;
  liveCrew: LiveCrewAgent[];
  telemetry?: BuzzLiveTelemetrySnapshot;
  activeTenant: string;
  onEnterFloor: (slug: string) => void;
  onOpenChannel?: (slug: string) => void;
  onOpenBoard?: (slug: string) => void;
}

function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  const rr = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gg = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bb = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return alpha >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${alpha})`;
}

function makeFloorSignTexture(kit: Kit, title: string, subtitle: string, accent: Rgb, isDark: boolean): THREE.CanvasTexture {
  const c = canvasOf(512, 112);
  const g = c.getContext("2d")!;
  g.fillStyle = isDark ? "#11151d" : "#1d222c";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = rgbToCss(accent);
  g.fillRect(0, 0, 12, c.height);
  g.fillRect(12, c.height - 8, c.width - 12, 8);
  g.fillStyle = "#f8fafc";
  g.font = "700 32px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText(title.toUpperCase().slice(0, 22), 28, 48);
  g.fillStyle = "#94a3b8";
  g.font = "600 18px ui-monospace, Menlo, monospace";
  g.fillText(subtitle.slice(0, 34), 28, 82);
  return kit.canvasTexture(c);
}

export function createHoldingTower3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function HoldingTower3DCanvas(props: HoldingTower3DProps) {
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const mountRef = React.useRef<HTMLDivElement | null>(null);
    const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
    const [hoveredSlug, setHoveredSlug] = React.useState<string | null>(null);
    const [fitTick, setFitTick] = React.useState(0);
    const [darkFactoryMode, setDarkFactoryMode] = React.useState(true);
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    // Monta a pilha de andares de baixo para cima: Subsidiárias + Cobertura (Conselho & Iris)
    const floors = React.useMemo<HoldingTowerFloorInfo[]>(() => {
      const byPk = props.telemetry?.byPubkey || {};
      const crew = props.liveCrew || [];

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
        const matchingCrew = crew.filter((a) => {
          const n = a.name.toLowerCase();
          if (slugLower === "orgfy") return n.startsWith("orgfy") && !n.includes("iris");
          if (slugLower.includes("lumen")) return n.includes("lumen");
          return n.includes(slugLower);
        });
        let workingCount = 0;
        let errorCount = 0;
        const agents = matchingCrew.slice(0, 6).map((a) => {
          const turn = a.pubkey ? byPk[a.pubkey.toLowerCase()] : undefined;
          const isErr = turn?.state === "error";
          const isWork = Boolean(turn && !isErr);
          if (isErr) errorCount += 1;
          if (isWork) workingCount += 1;
          return {
            name: a.name,
            picture: a.picture,
            status: (isErr ? "error" : isWork ? "working" : "active") as "active" | "working" | "planned" | "error",
          };
        });
        return {
          slug: emp.slug,
          nome: emp.nome || emp.slug,
          estagio: emp.estagio || "operacional",
          agentesCount: matchingCrew.length || emp.agentesTotal || 0,
          workingCount,
          errorCount,
          agents:
            agents.length > 0
              ? agents
              : emp.estagio === "planejado"
              ? [{ name: `${emp.nome} PO`, status: "planned" as const }]
              : [{ name: `${emp.nome} Dev`, status: "active" as const }],
        };
      });

      // Cobertura: Conselho da Holding + OrgFy Iris
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
                name: a.name,
                picture: a.picture,
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
        agents: boardAgents,
      };

      return [...subsidiaryFloors, penthouse];
    }, [props.holding, props.liveCrew, props.telemetry]);

    const floorsSignature = floors.map((f) => `${f.slug}:${f.workingCount}:${f.errorCount}:${f.agentesCount}`).join("|");
    const targetFloorYRef = React.useRef<number | null>(null);
    const targetFrustumRef = React.useRef<number | null>(null);

    React.useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const palette = readPalette();
      const kit = new Kit();
      const width = Math.max(320, container.clientWidth || 780);
      const height = Math.max(320, container.clientHeight || 520);

      const scene = new THREE.Scene();
      scene.background = darkFactoryMode ? new THREE.Color(0x090b10) : new THREE.Color(0xeef2f7);

      const FLOOR_H = 3.2;
      const totalH = floors.length * FLOOR_H;
      const defaultCenterY = Math.max(2.2, totalH * 0.45);
      const defaultFrustum = Math.max(12.5, totalH * 1.15);

      let theta = 0.68;
      let phi = 1.02;
      let frustum = defaultFrustum;
      const target = new THREE.Vector3(0, defaultCenterY, 0);
      targetFloorYRef.current = defaultCenterY;
      targetFrustumRef.current = defaultFrustum;

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
        const w = Math.max(320, container.clientWidth || width);
        const hh = Math.max(320, container.clientHeight || height);
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
      renderer.toneMappingExposure = darkFactoryMode ? 1.15 : 1.02;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      const lights = new Lights();
      scene.add(lights.hemi, lights.sun, lights.sun.target);
      lights.set([{ x0: -6.5, x1: 6.5, y0: 0, y1: totalH + 2, z0: -4.5, z1: 4.5 }], palette, false);

      if (!darkFactoryMode) {
        const dayFill = new THREE.DirectionalLight(0xffffff, 0.85);
        dayFill.position.set(-10, 18, 12);
        scene.add(dayFill);
      }

      // Materiais compartilhados
      const matSlab = kit.matte(darkFactoryMode ? [0.13, 0.15, 0.19] : [0.82, 0.84, 0.88], { roughness: 0.82 });
      const matWall = kit.matte(darkFactoryMode ? [0.16, 0.18, 0.22] : [0.89, 0.9, 0.93], { roughness: 0.85 });
      const matSteel = kit.matte(palette.steel, { roughness: 0.42, metalness: 0.45 });
      const matWood = kit.matte(palette.wood, { roughness: 0.55 });
      const matGlass = kit.own(
        new THREE.MeshPhysicalMaterial({
          color: darkFactoryMode ? 0x60a5fa : 0x3b82f6,
          transparent: true,
          opacity: 0.16,
          roughness: 0.1,
        })
      );

      // ── ELEVADOR DE DADOS CENTRAL (Duto de vidro conectando todos os andares) ──
      const shaftX = -4.2;
      const shaftZ = -2.2;
      const shaft = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.95, totalH + 0.6, 0.95)), matGlass);
      shaft.position.set(shaftX, totalH / 2, shaftZ);
      scene.add(shaft);

      for (const sx of [-0.46, 0.46]) {
        for (const sz of [-0.46, 0.46]) {
          const rail = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.03, 0.03, totalH + 0.7, 8)), matSteel);
          rail.position.set(shaftX + sx, totalH / 2, shaftZ + sz);
          scene.add(rail);
        }
      }

      // Cápsulas de dados subindo/descendo no elevador
      const dataCapsules: Array<{ mesh: THREE.Mesh; speed: number; offset: number }> = [];
      for (let i = 0; i < 4; i += 1) {
        const cap = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(0.42, 0.24, 0.42)),
          kit.matte(palette.lane, { roughness: 0.2, emissive: colour(palette.lane), emissiveIntensity: 0.85 })
        );
        cap.position.set(shaftX, 0.5, shaftZ);
        scene.add(cap);
        dataCapsules.push({ mesh: cap, speed: 0.22 + i * 0.06, offset: i * 0.25 });
      }

      // ── CONSTRUÇÃO DE CADA ANDAR DA TORRE ──
      const avatars: Array<{ handle: Avatar3DHandle; phase: number; working: boolean; error: boolean }> = [];
      const conveyorPackets: Array<{ mesh: THREE.Mesh; y: number; z: number; speed: number; offset: number }> = [];
      const warningBeacons: Array<{ mesh: THREE.Mesh; phase: number }> = [];
      const holoCores: THREE.Object3D[] = [];
      const hitTargets: THREE.Object3D[] = [];
      const floorByHit = new WeakMap<THREE.Object3D, { floor: HoldingTowerFloorInfo; y: number }>();

      const floorW = 10.6;
      const floorD = 6.2;

      floors.forEach((floor, fIdx) => {
        const y0 = fIdx * FLOOR_H;
        const floorGroup = new THREE.Group();
        floorGroup.position.set(0, y0, 0);
        scene.add(floorGroup);

        const floorAccent: Rgb = floor.errorCount > 0
          ? [0.95, 0.32, 0.34]
          : floor.isBoard
          ? [0.96, 0.78, 0.24]
          : floor.workingCount > 0
          ? palette.accent.reviewer
          : floor.estagio === "planejado"
          ? [0.45, 0.48, 0.55]
          : palette.lane;

        const matAccent = kit.matte(floorAccent, {
          roughness: 0.3,
          emissive: colour(floorAccent),
          emissiveIntensity: darkFactoryMode ? 0.65 : 0.35,
        });

        // Laje + filete frontal luminoso
        const slab = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW, 0.26, floorD)), matSlab);
        slab.position.set(0, -0.13, 0);
        slab.receiveShadow = true;
        slab.castShadow = true;
        floorGroup.add(slab);

        const trimFront = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW + 0.04, 0.07, 0.07)), matAccent);
        trimFront.position.set(0, -0.02, floorD / 2);
        floorGroup.add(trimFront);

        const trimRight = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.07, 0.07, floorD + 0.04)), matAccent);
        trimRight.position.set(floorW / 2, -0.02, 0);
        floorGroup.add(trimRight);

        // Paredes em L em corte (altura parcial para ver dentro de todos os andares)
        const wallH = FLOOR_H - 0.32;
        const backWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(floorW, wallH, 0.18)), matWall);
        backWall.position.set(0, wallH / 2, -floorD / 2 + 0.09);
        backWall.receiveShadow = true;
        floorGroup.add(backWall);

        const leftWall = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.18, wallH, floorD)), matWall);
        leftWall.position.set(-floorW / 2 + 0.09, wallH / 2, 0);
        leftWall.receiveShadow = true;
        floorGroup.add(leftWall);

        // Pilares de aço nos cantos abertos
        for (const [px, pz] of [
          [floorW / 2 - 0.14, -floorD / 2 + 0.14],
          [floorW / 2 - 0.14, floorD / 2 - 0.14],
          [-floorW / 2 + 0.14, floorD / 2 - 0.14],
        ]) {
          const col = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.14, wallH, 0.14)), matSteel);
          col.position.set(px, wallH / 2, pz);
          floorGroup.add(col);
        }

        // Placa do Andar na parede de fundo
        const subText = floor.isBoard
          ? `${floor.agentesCount} conselheiros · ${floor.workingCount} em turno`
          : `${floor.estagio.toUpperCase()} · ${floor.agentesCount} agentes · ${floor.workingCount} ativos`;
        const signTex = makeFloorSignTexture(kit, `${fIdx + 1}F · ${floor.nome}`, subText, floorAccent, darkFactoryMode);
        const signMesh = new THREE.Mesh(
          kit.own(new THREE.PlaneGeometry(3.4, 0.74)),
          kit.own(new THREE.MeshBasicMaterial({ map: signTex }))
        );
        signMesh.position.set(1.4, wallH - 0.62, -floorD / 2 + 0.21);
        floorGroup.add(signMesh);

        // Farol de alerta se houver erro/quarentena neste andar
        if (floor.errorCount > 0) {
          const beacon = new THREE.Mesh(
            kit.own(new THREE.CylinderGeometry(0.14, 0.18, 0.24, 12)),
            kit.matte([0.98, 0.25, 0.28], { roughness: 0.2, emissive: 0xef4444, emissiveIntensity: 1.2 })
          );
          beacon.position.set(4.5, 0.14, 2.3);
          floorGroup.add(beacon);
          warningBeacons.push({ mesh: beacon, phase: fIdx * 1.1 });
        }

        if (floor.isBoard) {
          // ── COBERTURA: MESA DO CONSELHO + HOLOGRAMA CENTRAL + AVATARES VIP ──
          const table = new THREE.Mesh(kit.own(new THREE.BoxGeometry(4.4, 0.12, 1.9)), matWood);
          table.position.set(0.6, 0.62, 0.2);
          table.castShadow = true;
          table.receiveShadow = true;
          floorGroup.add(table);

          const holo = new THREE.Mesh(
            kit.own(new THREE.OctahedronGeometry(0.38, 0)),
            kit.own(
              new THREE.MeshBasicMaterial({
                color: colour(floorAccent),
                wireframe: true,
                transparent: true,
                opacity: 0.85,
              })
            )
          );
          holo.position.set(0.6, 1.38, 0.2);
          floorGroup.add(holo);
          holoCores.push(holo);

          const slots: Array<[number, number, number]> = [
            [-2.0, 0, 0.2],
            [-0.5, 0, 1.55],
            [0.7, 0, 1.55],
            [1.9, 0, 1.55],
            [-0.2, 0, -1.15],
            [1.4, 0, -1.15],
          ];
          floor.agents.slice(0, slots.length).forEach((ag, idx) => {
            const av = buildCustomAvatar3D(kit, palette, ag, { seatHeight: 0.12, scale: 0.92, showPortraitMedallion: true });
            const [ax, ay, az] = slots[idx];
            av.root.position.set(ax, ay, az);
            av.root.rotation.y = idx === 0 ? Math.PI / 2 : az > 0.2 ? Math.PI : 0;
            floorGroup.add(av.root);
            avatars.push({ handle: av, phase: idx * 0.9, working: ag.status === "working", error: ag.status === "error" });
          });
        } else {
          // ── ANDAR DE SUBSIDIÁRIA: ESTEIRA ANIMADA + BANCADAS + AVATARES REAIS ──
          const belt = new THREE.Mesh(kit.own(new THREE.BoxGeometry(7.2, 0.12, 0.85)), matSteel);
          belt.position.set(0.8, 0.18, 1.45);
          belt.receiveShadow = true;
          floorGroup.add(belt);

          // Pacotes luminosos percorrendo a esteira
          const pktCount = floor.estagio === "planejado" ? 1 : 3;
          for (let pIdx = 0; pIdx < pktCount; pIdx += 1) {
            const pkt = new THREE.Mesh(
              kit.own(new THREE.BoxGeometry(0.44, 0.28, 0.44)),
              kit.matte(floorAccent, { roughness: 0.35, emissive: colour(floorAccent), emissiveIntensity: 0.45 })
            );
            pkt.position.set(0, y0 + 0.38, 1.45);
            pkt.castShadow = true;
            scene.add(pkt);
            conveyorPackets.push({
              mesh: pkt,
              y: y0 + 0.38,
              z: 1.45,
              speed: floor.workingCount > 0 ? 1.5 : 0.65,
              offset: pIdx / pktCount,
            });
          }

          // Estações de trabalho + avatares 3D reais
          floor.agents.slice(0, 6).forEach((ag, idx) => {
            const dx = -2.2 + idx * 1.35;
            const dz = -0.85;
            const desk = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.92, 0.56, 0.54)), matWood);
            desk.position.set(dx, 0.28, dz + 0.42);
            desk.castShadow = true;
            floorGroup.add(desk);

            const av = buildCustomAvatar3D(kit, palette, ag, { seatHeight: 0.08, scale: 0.86, showPortraitMedallion: true });
            av.root.position.set(dx, 0, dz - 0.15);
            floorGroup.add(av.root);
            avatars.push({ handle: av, phase: fIdx * 1.7 + idx * 0.8, working: ag.status === "working", error: ag.status === "error" });
          });
        }

        // Hitbox do andar inteiro para seleção/voo de câmera
        const hitBox = new THREE.Mesh(
          kit.own(new THREE.BoxGeometry(floorW, FLOOR_H - 0.2, floorD)),
          kit.own(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitBox.position.set(0, FLOOR_H / 2 - 0.1, 0);
        floorGroup.add(hitBox);
        hitTargets.push(hitBox);
        floorByHit.set(hitBox, { floor, y: y0 + 1.1 });
      });

      // Interações de mouse (orbit, zoom, clique para focar andar, duplo clique para entrar)
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;

      const pickFloor = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(hitTargets, false);
        if (hits.length === 0) return null;
        return floorByHit.get(hits[0].object) || null;
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
          phi = Math.max(0.42, Math.min(1.3, phi - dy * 0.006));
          lastX = e.clientX;
          lastY = e.clientY;
          updateCamera();
          return;
        }
        const hit = pickFloor(e);
        setHoveredSlug(hit ? hit.floor.slug : null);
        renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      };

      const onUp = (e: MouseEvent) => {
        if (dragging && !moved) {
          const hit = pickFloor(e);
          if (hit) {
            setSelectedSlug(hit.floor.slug);
            targetFloorYRef.current = hit.y;
            targetFrustumRef.current = 8.4;
          } else {
            setSelectedSlug(null);
            targetFloorYRef.current = defaultCenterY;
            targetFrustumRef.current = defaultFrustum;
          }
        }
        dragging = false;
        renderer.domElement.style.cursor = "grab";
      };

      const onDblClick = (e: MouseEvent) => {
        const hit = pickFloor(e);
        if (hit) props.onEnterFloor(hit.floor.slug);
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const nextF = Math.max(6.2, Math.min(24, frustum + e.deltaY * 0.01));
        frustum = nextF;
        targetFrustumRef.current = nextF;
        updateCamera();
      };

      const dom = renderer.domElement;
      dom.style.cursor = "grab";
      dom.addEventListener("mousedown", onDown);
      dom.addEventListener("mousemove", onMove);
      dom.addEventListener("dblclick", onDblClick);
      window.addEventListener("mouseup", onUp);
      dom.addEventListener("wheel", onWheel, { passive: false });

      let rafId = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Voo suave (lerp) da câmera ao focar um andar
        let camDirty = false;
        if (targetFloorYRef.current !== null && Math.abs(target.y - targetFloorYRef.current) > 0.01) {
          target.y += (targetFloorYRef.current - target.y) * 0.09;
          camDirty = true;
        }
        if (targetFrustumRef.current !== null && Math.abs(frustum - targetFrustumRef.current) > 0.02) {
          frustum += (targetFrustumRef.current - frustum) * 0.09;
          camDirty = true;
        }
        if (camDirty) updateCamera();

        // Anima avatares 3D
        for (const a of avatars) {
          a.handle.animate(t, a.phase, { working: a.working, error: a.error });
        }

        // Anima cápsulas no elevador de dados
        for (const cap of dataCapsules) {
          const frac = (t * cap.speed + cap.offset) % 1;
          const pingPong = frac < 0.5 ? frac * 2 : (1 - frac) * 2;
          cap.mesh.position.y = 0.4 + pingPong * Math.max(1, totalH - 0.9);
          cap.mesh.rotation.y = t * 1.4;
        }

        // Anima pacotes percorrendo as esteiras das subsidiárias
        for (const pkt of conveyorPackets) {
          const frac = (t * pkt.speed * 0.16 + pkt.offset) % 1;
          pkt.mesh.position.x = -2.4 + frac * 6.4;
          pkt.mesh.position.y = pkt.y + Math.sin(t * 4 + pkt.offset * 6) * 0.02;
        }

        // Anima hologramas da Cobertura e beacons de alerta
        for (const holo of holoCores) {
          holo.rotation.y = t * 0.9;
          holo.rotation.x = Math.sin(t * 0.7) * 0.25;
        }
        for (const b of warningBeacons) {
          b.mesh.scale.setScalar(1 + Math.sin(t * 7 + b.phase) * 0.14);
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
        dom.removeEventListener("mousedown", onDown);
        dom.removeEventListener("mousemove", onMove);
        dom.removeEventListener("dblclick", onDblClick);
        window.removeEventListener("mouseup", onUp);
        dom.removeEventListener("wheel", onWheel);
        lights.dispose();
        kit.dispose();
        renderer.dispose();
      };
    }, [floorsSignature, fitTick, darkFactoryMode]);

    const focusedFloor =
      floors.find((f) => f.slug === (selectedSlug || hoveredSlug)) || null;

    const focusFloorBySlug = (slug: string | null) => {
      setSelectedSlug(slug);
      if (!slug) {
        setFitTick((n) => n + 1);
        return;
      }
      const idx = floors.findIndex((f) => f.slug === slug);
      if (idx >= 0) {
        targetFloorYRef.current = idx * 3.2 + 1.1;
        targetFrustumRef.current = 8.4;
      }
    };

    return h(
      "div",
      {
        "data-holding-tower-3d": "true",
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
            background: darkFactoryMode ? "#090b10" : "#eef2f7",
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
              background: "rgba(14, 17, 24, 0.9)",
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
                style: { justifyContent: "space-between", fontSize: "11px", padding: "4px 8px", minWidth: "164px" },
                onClick: () => focusFloorBySlug(active ? null : f.slug),
              },
              h("span", null, `${floorNum}F · ${f.isBoard ? "Conselho" : f.nome}`),
              h(
                "span",
                { className: "of-mono", style: { fontSize: "10px", opacity: 0.85 } },
                f.errorCount > 0 ? `!${f.errorCount}` : f.workingCount > 0 ? `⚡${f.workingCount}` : `${f.agentesCount}`
              )
            );
          })
        ),

        // Card flutuante do andar selecionado/hover no canto superior direito
        focusedFloor &&
          h(
            "div",
            {
              style: {
                position: "absolute",
                top: "12px",
                right: "12px",
                zIndex: 22,
                width: "268px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                background: "rgba(15, 18, 24, 0.94)",
                backdropFilter: "blur(10px)",
                padding: "11px 13px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
              h("strong", { style: { fontSize: "12.5px" } }, focusedFloor.nome),
              h(
                "span",
                {
                  className: "of-pill",
                  "data-tone": focusedFloor.errorCount > 0 ? "failed" : focusedFloor.workingCount > 0 ? "running" : "done",
                  style: { fontSize: "10px" },
                },
                focusedFloor.estagio
              )
            ),
            h(
              "div",
              { className: "of-muted", style: { fontSize: "11px" } },
              `${focusedFloor.agentesCount} agentes · ${focusedFloor.workingCount} respondendo${focusedFloor.errorCount > 0 ? ` · ${focusedFloor.errorCount} com erro` : ""}`
            ),
            h(
              "div",
              { style: { display: "flex", gap: "6px" } },
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "primary",
                  style: { flex: 1, justifyContent: "center", fontSize: "11px" },
                  onClick: () => props.onEnterFloor(focusedFloor.slug),
                },
                focusedFloor.isBoard ? "Entrar na Sala 3D ↗" : "Entrar no Andar 3D ↗"
              ),
              props.onOpenChannel &&
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    style: { fontSize: "11px" },
                    onClick: () => props.onOpenChannel!(focusedFloor.slug),
                  },
                  "Canal"
                )
            )
          ),

        // Controles no canto inferior direito (Dia/Noite Dark Factory, Tela cheia, Fit)
        h(
          "div",
          { style: { position: "absolute", right: "12px", bottom: "12px", zIndex: 20, display: "inline-flex", gap: "6px" } },
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
                setSelectedSlug(null);
                setFitTick((n) => n + 1);
              },
            },
            "⤢ Fit"
          )
        )
      ),
      h(
        "div",
        { className: "of-muted", style: { textAlign: "center", fontSize: "11px" } },
        `Torre da Holding Cortexx · ${floors.length} andares ao vivo · Clique no andar para aproximar · Duplo clique para entrar`
      )
    );
  };
}
