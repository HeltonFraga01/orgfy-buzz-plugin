// Adaptado de CodeDen (MIT) commit b0b2a5a — Motor de Personagens 3D Estilo LEGO / Voxel (Three.js + CanvasTexture)
// - Silhueta limpa e icônica inspirada em LEGO Architecture / Minecraft / Claw3D
// - Rosto desenhado em CanvasTexture nítida (olhos expressivos, brilho, sorriso, óculos ou visor)
// - Uniforme/colete/gravata/crachá no tronco em blocos, cabelos/capacetes/coroa em voxels, braços e pernas articulados
// - Zero fotinha flutuante acima da cabeça (showPortraitMedallion = false por padrão)

import * as THREE from "three";
import { Kit, colour, canvasOf } from "./codeden-floor/floor/kit";
import type { FloorPalette } from "./codeden-floor/floor/palette";
import type { Rgb } from "./codeden-floor/oklch";

export interface Avatar3DInput {
  name: string;
  role?: string;
  picture?: string;
  status: "active" | "working" | "planned" | "error";
  index?: number;
}

export interface Avatar3DHandle {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  eyesGroup: THREE.Object3D;
  leftHand: THREE.Object3D;
  rightHand: THREE.Object3D;
  haloMesh: THREE.Object3D | null;
  ringMesh: THREE.Mesh;
  failoverRing: THREE.Mesh;
  baseY: number;
  animate: (t: number, phase: number, opts?: { working?: boolean; error?: boolean; celebrating?: boolean }) => void;
}

type ArchetypeKind =
  | "iris_ceo"
  | "bento_tall"
  | "giraffe_cro"
  | "hover_cgo"
  | "horned_cto"
  | "hat_cpo"
  | "stealth_dev"
  | "owl_oracle"
  | "classic_bot";

interface ArchetypeStyle {
  kind: ArchetypeKind;
  skinRgb: Rgb;
  shirtRgb: Rgb;
  pantsRgb: Rgb;
  hairRgb: Rgb;
  accentRgb: Rgb;
  faceStyle: "visor" | "glasses" | "smile" | "tactical";
}

function hashPick<T>(str: string, items: T[]): T {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return items[(h >>> 0) % items.length];
}

function rgbCss([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export function resolveAvatarArchetype(name: string, role = "", p: FloorPalette): ArchetypeStyle {
  const txt = `${name} ${role}`.toLowerCase();

  if (/iris|ceo\s*master|bestie/.test(txt)) {
    return {
      kind: "iris_ceo",
      skinRgb: [0.96, 0.84, 0.72],
      shirtRgb: [0.86, 0.24, 0.28],
      pantsRgb: [0.16, 0.18, 0.24],
      hairRgb: [0.18, 0.14, 0.18],
      accentRgb: [0.98, 0.8, 0.24],
      faceStyle: "visor",
    };
  }
  if (/bento|arquit/.test(txt)) {
    return {
      kind: "bento_tall",
      skinRgb: [0.95, 0.82, 0.68],
      shirtRgb: [0.22, 0.48, 0.88],
      pantsRgb: [0.16, 0.2, 0.28],
      hairRgb: [0.22, 0.16, 0.12],
      accentRgb: [0.56, 0.86, 1.0],
      faceStyle: "glasses",
    };
  }
  if (/cro|risco|compliance|auditor|hugo|segur/.test(txt)) {
    return {
      kind: "giraffe_cro",
      skinRgb: [0.92, 0.78, 0.64],
      shirtRgb: [0.2, 0.56, 0.82],
      pantsRgb: [0.15, 0.18, 0.24],
      hairRgb: [0.85, 0.72, 0.26],
      accentRgb: [0.96, 0.82, 0.28],
      faceStyle: "glasses",
    };
  }
  if (/cgo|growth|val\b/.test(txt)) {
    return {
      kind: "hover_cgo",
      skinRgb: [0.95, 0.82, 0.68],
      shirtRgb: [0.18, 0.66, 0.56],
      pantsRgb: [0.14, 0.18, 0.24],
      hairRgb: [0.28, 0.2, 0.14],
      accentRgb: [0.28, 0.9, 0.82],
      faceStyle: "smile",
    };
  }
  if (/cto|coo/.test(txt)) {
    return {
      kind: "horned_cto",
      skinRgb: [0.94, 0.8, 0.66],
      shirtRgb: [0.84, 0.36, 0.22],
      pantsRgb: [0.18, 0.18, 0.22],
      hairRgb: [0.16, 0.14, 0.16],
      accentRgb: [0.98, 0.74, 0.24],
      faceStyle: "glasses",
    };
  }
  if (/cpo|produto|po\b/.test(txt)) {
    return {
      kind: "hat_cpo",
      skinRgb: [0.95, 0.83, 0.7],
      shirtRgb: [0.54, 0.34, 0.84],
      pantsRgb: [0.18, 0.16, 0.26],
      hairRgb: [0.16, 0.14, 0.2],
      accentRgb: [0.76, 0.94, 0.36],
      faceStyle: "smile",
    };
  }
  if (/or[aá]culo|scout|sol\b/.test(txt)) {
    return {
      kind: "owl_oracle",
      skinRgb: [0.92, 0.8, 0.68],
      shirtRgb: [0.44, 0.36, 0.72],
      pantsRgb: [0.16, 0.16, 0.24],
      hairRgb: [0.88, 0.88, 0.92],
      accentRgb: [0.98, 0.82, 0.32],
      faceStyle: "glasses",
    };
  }
  if (/lumen/.test(txt)) {
    return {
      kind: "stealth_dev",
      skinRgb: [0.22, 0.25, 0.32],
      shirtRgb: [0.16, 0.19, 0.26],
      pantsRgb: [0.12, 0.14, 0.19],
      hairRgb: [0.14, 0.16, 0.22],
      accentRgb: [0.24, 0.9, 0.66],
      faceStyle: "tactical",
    };
  }

  const shirtPalette: Rgb[] = [
    [0.24, 0.56, 0.88],
    [0.2, 0.7, 0.52],
    [0.86, 0.54, 0.2],
    [0.62, 0.4, 0.86],
    [0.84, 0.72, 0.22],
    [0.22, 0.68, 0.78],
  ];
  const hairPalette: Rgb[] = [
    [0.18, 0.14, 0.12],
    [0.34, 0.22, 0.14],
    [0.14, 0.15, 0.18],
    [0.62, 0.44, 0.22],
  ];
  return {
    kind: "classic_bot",
    skinRgb: [0.96, 0.83, 0.68],
    shirtRgb: hashPick(name, shirtPalette),
    pantsRgb: [0.16, 0.19, 0.25],
    hairRgb: hashPick(`${name}_h`, hairPalette),
    accentRgb: p.lane,
    faceStyle: /atlas|otto|ravi|teo/.test(txt) ? "glasses" : "smile",
  };
}

/** Cria textura nítida de rosto LEGO / Voxel (estilo Minecraft + LEGO Minifig). */
function makeVoxelFaceTexture(
  kit: Kit,
  style: ArchetypeStyle,
  accentRgb: Rgb,
  isPlanned: boolean
): THREE.CanvasTexture {
  const c = canvasOf(128, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = isPlanned ? "#64748b" : rgbCss(style.skinRgb);
  g.fillRect(0, 0, 128, 128);

  // Sombreamento sutil no topo e base do rosto para profundidade voxel
  g.fillStyle = "rgba(0,0,0,0.06)";
  g.fillRect(0, 0, 128, 14);
  g.fillRect(0, 116, 128, 12);

  if (style.faceStyle === "visor" || style.faceStyle === "tactical") {
    // Visor tech estilo LEGO cyberpunk / bot com reflexo diagonal
    g.fillStyle = "#0b1120";
    g.fillRect(12, 36, 104, 42);
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = 2;
    g.strokeRect(13, 37, 102, 40);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(16, 40, 96, 8);
    g.fillStyle = rgbCss(accentRgb);
    g.fillRect(26, 49, 24, 15);
    g.fillRect(78, 49, 24, 15);
    g.fillStyle = "#ffffff";
    g.fillRect(30, 51, 7, 6);
    g.fillRect(82, 51, 7, 6);
    if (style.faceStyle === "visor") {
      g.fillStyle = "#1e293b";
      g.fillRect(48, 92, 32, 7);
      g.fillRect(44, 88, 6, 6);
      g.fillRect(78, 88, 6, 6);
    }
  } else {
    // Bochechas sutis para expressão mais viva
    if (!isPlanned) {
      g.fillStyle = "rgba(239, 108, 108, 0.16)";
      g.fillRect(16, 70, 16, 10);
      g.fillRect(96, 70, 16, 10);
    }

    // Olhos quadrados expressivos estilo LEGO/Minecraft com brilho duplo
    g.fillStyle = "#ffffff";
    g.fillRect(24, 42, 26, 24);
    g.fillRect(78, 42, 26, 24);
    g.fillStyle = "#0f172a";
    g.fillRect(32, 46, 14, 18);
    g.fillRect(82, 46, 14, 18);
    g.fillStyle = "#ffffff";
    g.fillRect(34, 48, 5, 5);
    g.fillRect(84, 48, 5, 5);
    g.fillRect(41, 58, 3, 3);
    g.fillRect(91, 58, 3, 3);

    // Sobrancelhas
    g.fillStyle = rgbCss(style.hairRgb);
    g.fillRect(24, 32, 26, 6);
    g.fillRect(78, 32, 26, 6);

    // Óculos com reflexo de lente sutil
    if (style.faceStyle === "glasses") {
      g.fillStyle = "rgba(147, 197, 253, 0.14)";
      g.fillRect(20, 38, 34, 32);
      g.fillRect(74, 38, 34, 32);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(24, 41, 10, 4);
      g.fillRect(78, 41, 10, 4);
      g.strokeStyle = "#111827";
      g.lineWidth = 6;
      g.strokeRect(20, 38, 34, 32);
      g.strokeRect(74, 38, 34, 32);
      g.fillStyle = "#111827";
      g.fillRect(54, 50, 20, 6);
    }

    // Sorriso LEGO clássico
    g.fillStyle = "#1e293b";
    g.fillRect(44, 88, 40, 8);
    g.fillRect(38, 82, 8, 8);
    g.fillRect(82, 82, 8, 8);
  }

  return kit.canvasTexture(c);
}

/** Cria textura de uniforme/jaqueta/lapela/gravata/crachá para o tronco LEGO/Voxel. */
function makeVoxelTorsoTexture(
  kit: Kit,
  style: ArchetypeStyle,
  accentRgb: Rgb,
  isPlanned: boolean
): THREE.CanvasTexture {
  const c = canvasOf(128, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = isPlanned ? "#475569" : rgbCss(style.shirtRgb);
  g.fillRect(0, 0, 128, 128);

  // Lapelas sutis do blazer / jaqueta nas bordas laterais
  g.fillStyle = "rgba(0,0,0,0.14)";
  g.fillRect(0, 0, 14, 108);
  g.fillRect(114, 0, 14, 108);

  // Gola em V branca com contorno
  g.fillStyle = "#f1f5f9";
  g.beginPath();
  g.moveTo(38, 0);
  g.lineTo(90, 0);
  g.lineTo(64, 38);
  g.closePath();
  g.fill();

  // Lapela interna escura
  g.strokeStyle = "rgba(15,23,42,0.45)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(36, 0);
  g.lineTo(64, 42);
  g.lineTo(92, 0);
  g.stroke();

  // Gravata ou zíper central no acento do papel
  g.fillStyle = rgbCss(accentRgb);
  g.fillRect(58, 22, 12, 72);
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.fillRect(61, 24, 4, 68);

  // Crachá funcional no bolso esquerdo com LED de status
  g.fillStyle = "#0f172a";
  g.fillRect(78, 42, 30, 20);
  g.fillStyle = rgbCss(accentRgb);
  g.fillRect(82, 46, 18, 5);
  g.fillStyle = "#f8fafc";
  g.fillRect(82, 54, 14, 3);
  g.fillStyle = "#34d399";
  g.fillRect(102, 46, 4, 4);

  // Pin dourado "Mônaco" na lapela direita para diretoria / Conselho
  if (
    !isPlanned &&
    (style.kind === "iris_ceo" ||
      style.kind === "horned_cto" ||
      style.kind === "giraffe_cro" ||
      style.kind === "hat_cpo" ||
      style.kind === "hover_cgo")
  ) {
    g.fillStyle = "#facc15";
    g.fillRect(26, 42, 10, 10);
    g.fillStyle = "#16a34a";
    g.fillRect(26, 46, 10, 2);
    g.fillStyle = "#1d4ed8";
    g.fillRect(26, 48, 10, 2);
  }

  // Cinto na base do tronco com fivela metálica
  g.fillStyle = "#0f172a";
  g.fillRect(0, 106, 128, 22);
  g.fillStyle = "#e2e8f0";
  g.fillRect(52, 110, 24, 14);
  g.fillStyle = "#0f172a";
  g.fillRect(58, 114, 12, 6);

  return kit.canvasTexture(c);
}

/** Constrói um personagem 3D limpo e icônico em estilo LEGO / Voxel. */
export function buildCustomAvatar3D(
  kit: Kit,
  p: FloorPalette,
  input: Avatar3DInput,
  opts?: { seatHeight?: number; scale?: number; showPortraitMedallion?: boolean }
): Avatar3DHandle {
  const root = new THREE.Group();
  const seatHeight = opts?.seatHeight ?? 0.45;
  const scale = opts?.scale ?? 1.05;
  const isPlanned = input.status === "planned";
  const isWorking = input.status === "working";
  const isError = input.status === "error";

  const style = resolveAvatarArchetype(input.name, input.role, p);
  const accentRgb: Rgb = isError
    ? [0.95, 0.3, 0.34]
    : isWorking
    ? p.accent.reviewer
    : isPlanned
    ? [0.5, 0.55, 0.62]
    : style.accentRgb;

  const matSkin = kit.matte(isPlanned ? [0.52, 0.56, 0.62] : style.skinRgb, {
    roughness: 0.5,
    transparent: isPlanned,
    opacity: isPlanned ? 0.45 : 1,
  });
  const matShirt = kit.matte(isPlanned ? [0.42, 0.46, 0.52] : style.shirtRgb, {
    roughness: 0.58,
    transparent: isPlanned,
    opacity: isPlanned ? 0.45 : 1,
  });
  const matPants = kit.matte(isPlanned ? [0.32, 0.35, 0.42] : style.pantsRgb, {
    roughness: 0.68,
    transparent: isPlanned,
    opacity: isPlanned ? 0.45 : 1,
  });
  const matHair = kit.matte(isPlanned ? [0.36, 0.4, 0.46] : style.hairRgb, {
    roughness: 0.65,
    transparent: isPlanned,
    opacity: isPlanned ? 0.45 : 1,
  });
  const matDark = kit.matte([0.1, 0.12, 0.16], { roughness: 0.4 });
  const matAccent = kit.matte(accentRgb, {
    roughness: 0.28,
    emissive: colour(accentRgb),
    emissiveIntensity: isPlanned ? 0.08 : isWorking || isError ? 0.85 : 0.45,
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, seatHeight, 0.04);
  bodyGroup.scale.setScalar(scale);
  root.add(bodyGroup);

  // ── 1. PERNAS & SAPATOS LEGO/VOXEL ──
  const isSeated = seatHeight > 0.2;
  for (const lx of [-0.075, 0.075]) {
    const leg = new THREE.Mesh(
      kit.own(new THREE.BoxGeometry(0.11, isSeated ? 0.12 : 0.22, isSeated ? 0.22 : 0.12)),
      matPants
    );
    leg.position.set(lx, isSeated ? 0.06 : 0.11, isSeated ? 0.08 : 0);
    leg.castShadow = !isPlanned;
    bodyGroup.add(leg);

    const shoe = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.112, 0.055, 0.09)), matDark);
    shoe.position.set(lx, isSeated ? 0.035 : 0.028, isSeated ? 0.21 : 0.03);
    bodyGroup.add(shoe);
  }

  // ── 2. TRONCO LEGO/VOXEL COM TEXTURA DE UNIFORME + CRACHÁ ──
  const torsoY = isSeated ? 0.26 : 0.36;
  const torsoTex = makeVoxelTorsoTexture(kit, style, accentRgb, isPlanned);
  const torsoFrontMat = kit.own(
    new THREE.MeshStandardMaterial({
      map: torsoTex,
      roughness: 0.54,
      transparent: isPlanned,
      opacity: isPlanned ? 0.45 : 1,
    })
  );
  const torso = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.3, 0.3, 0.18)), [
    matShirt,
    matShirt,
    matShirt,
    matShirt,
    torsoFrontMat, // +Z frente
    matShirt,
  ]);
  torso.position.set(0, torsoY, 0);
  torso.castShadow = !isPlanned;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  // Pescoço cilíndrico sutil estilo LEGO minifig
  const neck = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.055, 0.062, 0.06, 10)), matSkin);
  neck.position.set(0, torsoY + 0.165, 0);
  bodyGroup.add(neck);

  // ── 3. BRAÇOS ARTICULADOS EM BLOCOS LEGO/VOXEL COM OMBREIRA E PUNHO ──
  const makeVoxelArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.205, torsoY + 0.11, 0);

    const shoulder = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.108, 0.09, 0.11)), matShirt);
    shoulder.position.set(0, -0.01, 0);
    shoulder.castShadow = !isPlanned;
    pivot.add(shoulder);

    const sleeve = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.092, 0.2, 0.096)), matShirt);
    sleeve.position.set(0, -0.095, 0.045);
    sleeve.rotation.x = -0.58;
    sleeve.castShadow = !isPlanned;
    pivot.add(sleeve);

    const hand = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.082, 0.082, 0.082)), matSkin);
    hand.position.set(0, -0.18, 0.125);
    hand.castShadow = !isPlanned;
    pivot.add(hand);

    return pivot;
  };
  const leftHand = makeVoxelArm(-1);
  const rightHand = makeVoxelArm(1);
  bodyGroup.add(leftHand, rightHand);

  // ── 4. CABEÇA CÚBICA LEGO / MINECRAFT COM ROSTO EM CANVASTEXTURE ──
  const headGroup = new THREE.Group();
  headGroup.position.set(0, torsoY + 0.305, 0);
  bodyGroup.add(headGroup);

  const faceTex = makeVoxelFaceTexture(kit, style, accentRgb, isPlanned);
  const faceMat = kit.own(
    new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.48,
      transparent: isPlanned,
      opacity: isPlanned ? 0.45 : 1,
    })
  );

  const head = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.28, 0.28)), [
    matSkin,
    matSkin,
    matSkin,
    matSkin,
    faceMat, // +Z rosto
    matSkin,
  ]);
  head.castShadow = !isPlanned;
  head.receiveShadow = true;
  headGroup.add(head);

  // ── 5. CABELO / CAPACETE / COROA LEGO-VOXEL POR PAPEL ──
  let crownMesh: THREE.Object3D | null = null;
  if (style.kind === "iris_ceo") {
    // Cabelo bob voxel + pino/coroa LEGO dourada
    const hairTop = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.305, 0.08, 0.305)), matHair);
    hairTop.position.set(0, 0.145, -0.01);
    headGroup.add(hairTop);
    const hairBack = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.305, 0.26, 0.08)), matHair);
    hairBack.position.set(0, 0.01, -0.125);
    headGroup.add(hairBack);

    const crown = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.18, 0.055, 0.18)), matAccent);
    crown.position.set(0, 0.22, 0);
    headGroup.add(crown);
    crownMesh = crown;
  } else if (style.kind === "hat_cpo") {
    // Boné/Chapéu LEGO
    const brim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.33, 0.035, 0.36)), matDark);
    brim.position.set(0, 0.15, 0.03);
    headGroup.add(brim);
    const cap = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.29, 0.11, 0.29)), matShirt);
    cap.position.set(0, 0.21, 0);
    headGroup.add(cap);
  } else if (style.kind === "stealth_dev") {
    // Capacete voxel escuro com faixa neon
    const helm = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.31, 0.09, 0.31)), matHair);
    helm.position.set(0, 0.15, 0);
    headGroup.add(helm);
    const stripe = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.32, 0.035, 0.32)), matAccent);
    stripe.position.set(0, 0.12, 0);
    headGroup.add(stripe);
  } else {
    // Cabelo LEGO em blocos + stud sutil no topo
    const hairTop = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.3, 0.08, 0.3)), matHair);
    hairTop.position.set(0, 0.145, -0.005);
    hairTop.castShadow = !isPlanned;
    headGroup.add(hairTop);

    const hairBack = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.3, 0.2, 0.06)), matHair);
    hairBack.position.set(0, 0.04, -0.13);
    headGroup.add(hairBack);

    // Pino LEGO / indicador luminoso discreto de status no topo
    const stud = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 12)), isWorking || isError ? matAccent : matHair);
    stud.position.set(0, 0.205, 0);
    headGroup.add(stud);
  }

  // Headset lateral de operador para Bento / CTO / COO / Infra
  if (style.kind === "bento_tall" || style.kind === "horned_cto" || style.kind === "giraffe_cro") {
    for (const sx of [-0.155, 0.155]) {
      const ear = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.04, 0.09, 0.09)), matDark);
      ear.position.set(sx, 0.01, 0);
      headGroup.add(ear);
    }
  }

  // Grupo placeholder para compatibilidade de interface
  const eyesGroup = new THREE.Group();
  headGroup.add(eyesGroup);

  // Anel de status no chão sob a estação
  const ringMesh = new THREE.Mesh(
    kit.own(new THREE.RingGeometry(0.3, 0.36, 4)),
    kit.own(
      new THREE.MeshBasicMaterial({
        color: colour(accentRgb),
        transparent: true,
        opacity: isPlanned ? 0.22 : 0.72,
        side: THREE.DoubleSide,
      })
    )
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.rotation.z = Math.PI / 4;
  ringMesh.position.y = 0.022;
  root.add(ringMesh);

  // Anel de alerta vermelho / failover
  const failoverRing = new THREE.Mesh(
    kit.own(new THREE.RingGeometry(0.4, 0.46, 4)),
    kit.own(
      new THREE.MeshBasicMaterial({
        color: 0xf87171,
        transparent: true,
        opacity: isError ? 0.85 : 0,
        side: THREE.DoubleSide,
      })
    )
  );
  failoverRing.rotation.x = -Math.PI / 2;
  failoverRing.rotation.z = Math.PI / 4;
  failoverRing.position.y = 0.028;
  root.add(failoverRing);

  const baseY = seatHeight;

  const animate = (
    t: number,
    phase: number,
    animOpts?: { working?: boolean; error?: boolean; celebrating?: boolean }
  ) => {
    const working = animOpts?.working ?? isWorking;
    const err = animOpts?.error ?? isError;
    const celebrating = animOpts?.celebrating ?? false;

    if (celebrating) {
      bodyGroup.position.y = baseY + Math.abs(Math.sin(t * 7.5 + phase)) * 0.18;
      bodyGroup.rotation.z = Math.sin(t * 7.5 + phase) * 0.06;
      leftHand.rotation.x = -1.25 + Math.sin(t * 11 + phase) * 0.28;
      rightHand.rotation.x = -1.25 + Math.cos(t * 11 + phase) * 0.28;
      headGroup.rotation.y = Math.sin(t * 5 + phase) * 0.24;
      headGroup.rotation.x = -0.08;
      torso.scale.y = 1;
    } else if (working) {
      bodyGroup.position.y = baseY + Math.sin(t * 3.6 + phase) * 0.012;
      bodyGroup.rotation.z = Math.sin(t * 2.2 + phase) * 0.018;
      leftHand.rotation.x = -0.38 + Math.sin(t * 15 + phase) * 0.24;
      rightHand.rotation.x = -0.38 + Math.cos(t * 15 + phase + 0.6) * 0.24;
      headGroup.rotation.y = Math.sin(t * 1.35 + phase) * 0.14 + Math.sin(t * 0.45 + phase) * 0.05;
      headGroup.rotation.x = 0.08 + Math.sin(t * 2.8 + phase) * 0.025;
      torso.scale.y = 1 + Math.sin(t * 3.6 + phase) * 0.015;
    } else {
      const breath = Math.sin(t * 1.65 + phase);
      bodyGroup.position.y = baseY + breath * (isPlanned ? 0.004 : 0.011);
      bodyGroup.rotation.z = 0;
      leftHand.rotation.x = Math.sin(t * 1.15 + phase) * 0.05;
      rightHand.rotation.x = Math.cos(t * 1.15 + phase) * 0.05;
      headGroup.rotation.y = Math.sin(t * 0.58 + phase) * 0.19 + Math.sin(t * 0.21 + phase * 1.7) * 0.07;
      headGroup.rotation.x = Math.sin(t * 0.8 + phase) * 0.03;
      torso.scale.y = 1 + breath * (isPlanned ? 0.004 : 0.014);
    }

    if (crownMesh) {
      crownMesh.rotation.y = t * 0.8;
    }

    if (working) {
      const s = 1 + Math.sin(t * 3.8 + phase) * 0.08;
      ringMesh.scale.set(s, s, 1);
    }

    if (err) {
      const pulse = 1 + ((t * 1.4 + phase) % 1) * 0.35;
      failoverRing.scale.set(pulse, pulse, 1);
      (failoverRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - ((t * 1.4 + phase) % 1) * 0.9);
    } else {
      (failoverRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  };

  return {
    root,
    bodyGroup,
    eyesGroup,
    leftHand,
    rightHand,
    haloMesh: crownMesh,
    ringMesh,
    failoverRing,
    baseY,
    animate,
  };
}
