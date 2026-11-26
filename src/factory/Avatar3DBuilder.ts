// Adaptado de CodeDen (MIT) commit b0b2a5a — Motor de Avatares 3D Esculpidos da Holding OrgFy (Three.js)
// - Personagens 3D elaborados com silhueta articulada (pés, tronco com colarinho/colete, braços + mãos,
//   cabeça esculpida com olhos com brilho, sorriso e acessórios característicos de cada papel)
// - Visual limpo sem fotinha flutuante acima da cabeça (showPortraitMedallion = false por padrão)
// - Animações fluidas a 60 FPS: respiração, piscar natural, olhar sutil, digitação articulada, failover e comemoração

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
  bodyRgb: Rgb;
  suitRgb: Rgb;
  accentRgb: Rgb;
}

function hashHue(str: string): Rgb {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const palette: Rgb[] = [
    [0.34, 0.58, 0.92],
    [0.24, 0.76, 0.58],
    [0.9, 0.56, 0.24],
    [0.64, 0.45, 0.92],
    [0.86, 0.36, 0.46],
    [0.86, 0.76, 0.26],
    [0.24, 0.72, 0.84],
  ];
  return palette[(h >>> 0) % palette.length];
}

export function resolveAvatarArchetype(name: string, role = "", p: FloorPalette): ArchetypeStyle {
  const txt = `${name} ${role}`.toLowerCase();

  if (/iris|ceo\s*master|bestie/.test(txt)) {
    return { kind: "iris_ceo", bodyRgb: [0.9, 0.3, 0.3], suitRgb: [0.18, 0.2, 0.27], accentRgb: [0.22, 0.86, 0.98] };
  }
  if (/bento|arquit/.test(txt)) {
    return { kind: "bento_tall", bodyRgb: [0.28, 0.56, 0.92], suitRgb: [0.16, 0.22, 0.34], accentRgb: [0.82, 0.92, 1.0] };
  }
  if (/cro|risco|compliance|auditor|hugo|segur/.test(txt)) {
    return { kind: "giraffe_cro", bodyRgb: [0.32, 0.64, 0.92], suitRgb: [0.16, 0.2, 0.28], accentRgb: [0.96, 0.82, 0.28] };
  }
  if (/cgo|growth|val\b/.test(txt)) {
    return { kind: "hover_cgo", bodyRgb: [0.3, 0.48, 0.78], suitRgb: [0.14, 0.19, 0.28], accentRgb: [0.32, 0.9, 0.98] };
  }
  if (/cto|coo/.test(txt)) {
    return { kind: "horned_cto", bodyRgb: [0.86, 0.36, 0.24], suitRgb: [0.18, 0.17, 0.22], accentRgb: [0.98, 0.74, 0.24] };
  }
  if (/cpo|produto|po\b/.test(txt)) {
    return { kind: "hat_cpo", bodyRgb: [0.58, 0.4, 0.86], suitRgb: [0.19, 0.16, 0.28], accentRgb: [0.76, 0.94, 0.36] };
  }
  if (/or[aá]culo|scout|sol\b/.test(txt)) {
    return { kind: "owl_oracle", bodyRgb: [0.52, 0.42, 0.74], suitRgb: [0.17, 0.16, 0.25], accentRgb: [0.98, 0.82, 0.32] };
  }
  if (/lumen\s*dev|lumen\s*qa|atlas|otto|ravi|teo/.test(txt)) {
    const isDark = /lumen\s*(dev|qa)/.test(txt);
    return {
      kind: isDark ? "stealth_dev" : "classic_bot",
      bodyRgb: isDark ? [0.2, 0.23, 0.3] : /atlas|ravi/.test(txt) ? [0.88, 0.76, 0.24] : hashHue(name),
      suitRgb: [0.15, 0.17, 0.23],
      accentRgb: isDark ? [0.28, 0.9, 0.64] : p.lane,
    };
  }
  return { kind: "classic_bot", bodyRgb: hashHue(name), suitRgb: [0.16, 0.18, 0.24], accentRgb: p.lane };
}

function buildPortraitBadge(kit: Kit, name: string, picture: string | undefined, ringColorCss: string): THREE.Mesh {
  const c = canvasOf(128, 128);
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = "#141821";
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f1f5f9";
  g.font = "700 44px -apple-system, BlinkMacSystemFont, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
  g.fillText(initials || "AI", 64, 66);
  g.strokeStyle = ringColorCss;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.stroke();
  const tex = kit.canvasTexture(c);

  if (picture && typeof Image !== "undefined") {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          g.clearRect(0, 0, 128, 128);
          g.save();
          g.beginPath();
          g.arc(64, 64, 56, 0, Math.PI * 2);
          g.closePath();
          g.clip();
          g.drawImage(img, 8, 8, 112, 112);
          g.restore();
          g.strokeStyle = ringColorCss;
          g.lineWidth = 8;
          g.beginPath();
          g.arc(64, 64, 58, 0, Math.PI * 2);
          g.stroke();
          tex.needsUpdate = true;
        } catch {}
      };
      img.src = picture;
    } catch {}
  }

  return new THREE.Mesh(
    kit.own(new THREE.CircleGeometry(0.135, 24)),
    kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }))
  );
}

/** Constrói um braço articulado estilizado (ombro + manga + mão arredondada). */
function buildArticulatedArm(
  kit: Kit,
  side: -1 | 1,
  matSuit: THREE.Material,
  matBody: THREE.Material,
  matAccent: THREE.Material,
  castShadow: boolean
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.215, 0.28, 0.02);

  // Ombro arredondado
  const shoulder = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.056, 10, 10)), matSuit);
  shoulder.castShadow = castShadow;
  pivot.add(shoulder);

  // Braço/manga inclinado para frente
  const sleeve = new THREE.Mesh(kit.own(new THREE.CapsuleGeometry(0.04, 0.13, 6, 10)), matSuit);
  sleeve.position.set(side * 0.02, -0.07, 0.075);
  sleeve.rotation.x = 0.72;
  sleeve.rotation.z = -side * 0.18;
  sleeve.castShadow = castShadow;
  pivot.add(sleeve);

  // Punho com detalhe de acento
  const cuff = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.043, 0.043, 0.022, 10)), matAccent);
  cuff.position.set(side * 0.025, -0.115, 0.135);
  cuff.rotation.x = 0.72;
  pivot.add(cuff);

  // Mãozinha esculpida
  const hand = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.05, 12, 10)), matBody);
  hand.scale.set(0.95, 0.85, 1.15);
  hand.position.set(side * 0.025, -0.13, 0.165);
  hand.castShadow = castShadow;
  pivot.add(hand);

  return pivot;
}

/** Constrói um personagem 3D esculpido e expressivo sem medalhão flutuante por padrão. */
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
  const bodyRgb: Rgb = isPlanned ? [0.52, 0.56, 0.62] : style.bodyRgb;
  const suitRgb: Rgb = isPlanned ? [0.36, 0.39, 0.45] : style.suitRgb;
  const accentRgb: Rgb = isError
    ? [0.95, 0.32, 0.34]
    : isWorking
    ? p.accent.reviewer
    : isPlanned
    ? [0.46, 0.49, 0.56]
    : style.accentRgb;

  const matBody = kit.matte(bodyRgb, {
    roughness: 0.44,
    metalness: 0.08,
    transparent: isPlanned,
    opacity: isPlanned ? 0.42 : 1,
  });
  const matSuit = kit.matte(suitRgb, {
    roughness: 0.58,
    metalness: 0.15,
    transparent: isPlanned,
    opacity: isPlanned ? 0.42 : 1,
  });
  const matCollar = kit.matte([0.92, 0.94, 0.97], {
    roughness: 0.45,
    transparent: isPlanned,
    opacity: isPlanned ? 0.42 : 1,
  });
  const matDark = kit.matte([0.09, 0.11, 0.15], { roughness: 0.32, metalness: 0.25 });
  const matWhite = kit.matte([0.98, 0.99, 1], { roughness: 0.22 });
  const matGold = kit.matte([0.98, 0.8, 0.24], {
    roughness: 0.24,
    metalness: 0.55,
    emissive: colour([0.98, 0.8, 0.24]),
    emissiveIntensity: 0.45,
  });
  const matAccent = kit.matte(accentRgb, {
    roughness: 0.26,
    metalness: 0.18,
    emissive: colour(accentRgb),
    emissiveIntensity: isPlanned ? 0.08 : isWorking || isError ? 0.9 : 0.45,
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, seatHeight, 0.04);
  bodyGroup.scale.setScalar(scale);
  root.add(bodyGroup);

  const headGroup = new THREE.Group();
  bodyGroup.add(headGroup);

  const eyesGroup = new THREE.Group();
  let eyeY = 0.02;
  let eyeZ = 0.18;
  let headTopY = 0.72;
  let crownMesh: THREE.Object3D | null = null;

  if (style.kind === "hover_cgo") {
    // ── CONSELHO CGO: Unidade executiva aerodinâmica com cockpit de vidro e propulsores ──
    const hull = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.46, 0.18, 0.44)), matSuit);
    hull.position.set(0, 0.16, 0);
    hull.castShadow = !isPlanned;
    bodyGroup.add(hull);

    const upperDeck = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.42, 0.08, 0.4)), matBody);
    upperDeck.position.set(0, 0.26, 0);
    upperDeck.castShadow = !isPlanned;
    bodyGroup.add(upperDeck);

    const trimStripe = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.47, 0.032, 0.45)), matAccent);
    trimStripe.position.set(0, 0.21, 0);
    bodyGroup.add(trimStripe);

    headGroup.position.set(0, 0.36, 0.01);
    const canopy = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.185, 18, 14)), matDark);
    canopy.scale.set(1.08, 0.76, 1.02);
    canopy.castShadow = !isPlanned;
    headGroup.add(canopy);

    // Aletas laterais + faróis
    for (const sx of [-0.25, 0.25]) {
      const fin = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.05, 0.12, 0.28)), matBody);
      fin.position.set(sx, 0.19, -0.04);
      bodyGroup.add(fin);
    }
    for (const lx of [-0.14, 0.14]) {
      const headlamp = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.034, 10, 10)), matAccent);
      headlamp.position.set(lx, 0.2, 0.225);
      bodyGroup.add(headlamp);
    }
    eyeY = 0.01;
    eyeZ = 0.175;
    headTopY = 0.56;
  } else {
    // ── CORPO ARTICULADO PREMIUM (Pés + Tronco com jaqueta/colarinho + Emblema no peito) ──
    for (const fx of [-0.085, 0.085]) {
      const shoe = new THREE.Mesh(kit.own(new THREE.CapsuleGeometry(0.044, 0.06, 6, 10)), matDark);
      shoe.rotation.x = Math.PI / 2;
      shoe.position.set(fx, 0.04, 0.05);
      shoe.castShadow = !isPlanned;
      bodyGroup.add(shoe);
    }

    const torsoH = style.kind === "bento_tall" ? 0.34 : 0.27;
    const torso = new THREE.Mesh(
      kit.own(new THREE.CylinderGeometry(0.155, 0.195, torsoH, 18)),
      matSuit
    );
    torso.position.y = 0.07 + torsoH / 2;
    torso.castShadow = !isPlanned;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Gola / colarinho executivo contrastante
    const collar = new THREE.Mesh(
      kit.own(new THREE.TorusGeometry(0.14, 0.028, 8, 20)),
      style.kind === "stealth_dev" ? matAccent : matCollar
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.07 + torsoH - 0.01;
    bodyGroup.add(collar);

    // Núcleo/crachá luminoso no peito
    const chestBadge = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.1, 0.055, 0.03)), matAccent);
    chestBadge.position.set(0, 0.07 + torsoH * 0.58, 0.165);
    bodyGroup.add(chestBadge);

    // Pescoço
    const neckH = style.kind === "giraffe_cro" ? 0.22 : 0.06;
    const neck = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.065, 0.085, neckH, 12)), matBody);
    neck.position.y = 0.07 + torsoH + neckH / 2 - 0.01;
    neck.castShadow = !isPlanned;
    bodyGroup.add(neck);

    const headBaseY = 0.07 + torsoH + neckH + 0.14;
    headGroup.position.set(0, headBaseY, 0.01);

    if (style.kind === "iris_ceo") {
      // ── ORGFY IRIS (CEO MASTER): Capacete escultural coral + visor panorâmico + headset + coroa dourada ──
      const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.205, 22, 18)), matBody);
      head.scale.set(1.02, 0.96, 1.0);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      const visor = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.115, 0.09)), matDark);
      visor.position.set(0, 0.0, 0.155);
      headGroup.add(visor);

      const visorRim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.295, 0.018, 0.095)), matAccent);
      visorRim.position.set(0, 0.062, 0.155);
      headGroup.add(visorRim);

      // Fones laterais metálicos
      for (const sx of [-0.21, 0.21]) {
        const cup = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.052, 0.052, 0.048, 14)), matDark);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(sx, 0.01, 0);
        headGroup.add(cup);
        const led = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.03, 0.03, 0.054, 12)), matAccent);
        led.rotation.z = Math.PI / 2;
        led.position.set(sx, 0.01, 0);
        headGroup.add(led);
      }

      // Coroa/auréola dourada discreta flutuando acima da Iris
      const crown = new THREE.Mesh(kit.own(new THREE.TorusGeometry(0.135, 0.016, 10, 28)), matGold);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.28;
      headGroup.add(crown);
      crownMesh = crown;

      eyeY = 0.0;
      eyeZ = 0.205;
      headTopY = headBaseY + 0.32;
    } else if (style.kind === "bento_tall") {
      // ── ORGFY BENTO / ARQUITETO: Cabeça esguia + óculos de arquiteto + 2 antenas de precisão ──
      const head = new THREE.Mesh(kit.own(new THREE.CapsuleGeometry(0.16, 0.12, 10, 18)), matBody);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      // Óculos de estúdio (aro escuro)
      for (const gx of [-0.068, 0.068]) {
        const frame = new THREE.Mesh(kit.own(new THREE.TorusGeometry(0.046, 0.011, 8, 16)), matDark);
        frame.position.set(gx, 0.02, 0.155);
        headGroup.add(frame);
      }
      const bridge = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.045, 0.014, 0.014)), matDark);
      bridge.position.set(0, 0.025, 0.16);
      headGroup.add(bridge);

      for (const ax of [-0.075, 0.075]) {
        const stalk = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.013, 0.018, 0.16, 8)), matDark);
        stalk.position.set(ax, 0.26, 0);
        headGroup.add(stalk);
        const bulb = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.032, 10, 10)), matAccent);
        bulb.position.set(ax, 0.35, 0);
        headGroup.add(bulb);
      }
      eyeY = 0.02;
      eyeZ = 0.145;
      headTopY = headBaseY + 0.38;
    } else if (style.kind === "giraffe_cro") {
      // ── CONSELHO CRO / SEGURANÇA: Escultura alongada com crista dourada e antenas ──
      const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.16, 18, 16)), matBody);
      head.scale.set(0.96, 0.92, 1.18);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      const crest = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.045, 0.09, 0.22)), matGold);
      crest.position.set(0, 0.145, -0.02);
      headGroup.add(crest);

      for (const hx of [-0.07, 0.07]) {
        const horn = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.014, 0.02, 0.12, 8)), matBody);
        horn.position.set(hx, 0.18, 0.02);
        headGroup.add(horn);
        const tip = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.028, 10, 10)), matGold);
        tip.position.set(hx, 0.25, 0.02);
        headGroup.add(tip);
      }
      eyeY = 0.01;
      eyeZ = 0.175;
      headTopY = headBaseY + 0.28;
    } else if (style.kind === "horned_cto") {
      // ── CONSELHO CTO / COO: Cabeça robusta com chifrinhos cyber + visor tático ──
      const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.195, 20, 16)), matBody);
      head.scale.set(1.04, 0.95, 0.98);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      const brow = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.26, 0.036, 0.08)), matDark);
      brow.position.set(0, 0.08, 0.155);
      headGroup.add(brow);

      for (const sx of [-0.13, 0.13]) {
        const horn = new THREE.Mesh(kit.own(new THREE.ConeGeometry(0.042, 0.15, 10)), matAccent);
        horn.position.set(sx, 0.21, 0);
        horn.rotation.z = sx < 0 ? 0.34 : -0.34;
        headGroup.add(horn);
      }
      eyeY = 0.01;
      eyeZ = 0.178;
      headTopY = headBaseY + 0.28;
    } else if (style.kind === "stealth_dev") {
      // ── LUMEN DEV / QA: Capacete chanfrado escuro + visor neon esmeralda + antenas laterais ──
      const head = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.32, 0.28, 0.3)), matBody);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      const visor = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.095, 0.04)), matDark);
      visor.position.set(0, 0.02, 0.145);
      headGroup.add(visor);

      const topBar = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.34, 0.032, 0.32)), matAccent);
      topBar.position.set(0, 0.145, 0);
      headGroup.add(topBar);

      eyeY = 0.02;
      eyeZ = 0.17;
      headTopY = headBaseY + 0.2;
    } else if (style.kind === "owl_oracle") {
      // ── ORÁCULO / SCOUT / SOL: Óculos binoculares luminosos + capuz estilizado ──
      const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.19, 18, 16)), matBody);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      for (const gx of [-0.072, 0.072]) {
        const goggle = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.056, 0.056, 0.06, 14)), matDark);
        goggle.rotation.x = Math.PI / 2;
        goggle.position.set(gx, 0.02, 0.155);
        headGroup.add(goggle);
        const rim = new THREE.Mesh(kit.own(new THREE.TorusGeometry(0.056, 0.01, 8, 16)), matGold);
        rim.position.set(gx, 0.02, 0.185);
        headGroup.add(rim);
      }
      eyeY = 0.02;
      eyeZ = 0.182;
      headTopY = headBaseY + 0.22;
    } else {
      // ── CLASSIC BOT / CPO / ENGENHEIROS: Cabeça arredondada premium + chapéu (CPO) ou headset/antena ──
      const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.19, 20, 16)), matBody);
      head.scale.set(1.02, 0.96, 1.0);
      head.castShadow = !isPlanned;
      headGroup.add(head);

      if (style.kind === "hat_cpo") {
        const brim = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.22, 0.22, 0.022, 18)), matDark);
        brim.position.y = 0.16;
        headGroup.add(brim);
        const hatTop = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.135, 0.16, 0.15, 16)), matDark);
        hatTop.position.y = 0.24;
        headGroup.add(hatTop);
        const band = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.158, 0.164, 0.032, 16)), matAccent);
        band.position.y = 0.185;
        headGroup.add(band);
        headTopY = headBaseY + 0.34;
      } else {
        // Headset discreto + antena central com orbe luminoso
        const band = new THREE.Mesh(kit.own(new THREE.TorusGeometry(0.195, 0.016, 8, 20, Math.PI)), matDark);
        band.position.y = 0.01;
        headGroup.add(band);
        const ant = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 8)), matDark);
        ant.position.y = 0.24;
        headGroup.add(ant);
        const orb = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.036, 10, 10)), matAccent);
        orb.position.y = 0.31;
        headGroup.add(orb);
        headTopY = headBaseY + 0.35;
      }
      eyeY = 0.015;
      eyeZ = 0.175;
    }

    // Sorriso sutil (exceto quando usa visor fechado)
    if (style.kind !== "iris_ceo" && style.kind !== "stealth_dev") {
      const smile = new THREE.Mesh(
        kit.own(new THREE.TorusGeometry(0.042, 0.009, 6, 12, Math.PI)),
        matDark
      );
      smile.rotation.z = Math.PI;
      smile.position.set(0, eyeY - 0.068, eyeZ - 0.005);
      headGroup.add(smile);
    }
  }

  // Olhos expressivos com brilho (catchlight)
  const useGlowEyes = style.kind === "iris_ceo" || style.kind === "stealth_dev" || style.kind === "hover_cgo" || style.kind === "owl_oracle";
  eyesGroup.position.set(0, eyeY, eyeZ);
  for (const ex of [-0.068, 0.068]) {
    if (useGlowEyes) {
      const eye = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.028, 12, 10)), matAccent);
      eye.scale.set(1.15, 0.85, 0.7);
      eye.position.set(ex, 0, 0);
      eyesGroup.add(eye);
    } else {
      const sclera = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.04, 12, 10)), matWhite);
      sclera.position.set(ex, 0, 0);
      eyesGroup.add(sclera);
      const pupil = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.022, 10, 8)), matDark);
      pupil.position.set(ex, 0, 0.024);
      eyesGroup.add(pupil);
      const glint = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.008, 6, 6)), matWhite);
      glint.position.set(ex + 0.01, 0.012, 0.042);
      eyesGroup.add(glint);
    }
  }
  headGroup.add(eyesGroup);

  // Braços articulados com ombros, mangas, punhos e mãos
  const leftHand = buildArticulatedArm(kit, -1, matSuit, matBody, matAccent, !isPlanned);
  const rightHand = buildArticulatedArm(kit, 1, matSuit, matBody, matAccent, !isPlanned);
  if (style.kind === "hover_cgo") {
    leftHand.visible = false;
    rightHand.visible = false;
  }
  bodyGroup.add(leftHand, rightHand);

  // Medalhão com foto DESLIGADO por padrão (só aparece se showPortraitMedallion === true explicitamente)
  let haloMesh: THREE.Object3D | null = crownMesh;
  if (opts?.showPortraitMedallion === true) {
    const ringCss = isError ? "#f87171" : isWorking ? "#60a5fa" : "#3dd68c";
    const badge = buildPortraitBadge(kit, input.name, input.picture, ringCss);
    badge.position.set(0, headTopY + 0.16, 0.02);
    bodyGroup.add(badge);
    haloMesh = badge;
  }

  // Anel de status no chão sob a estação
  const ringMesh = new THREE.Mesh(
    kit.own(new THREE.RingGeometry(0.32, 0.39, 28)),
    kit.own(
      new THREE.MeshBasicMaterial({
        color: colour(accentRgb),
        transparent: true,
        opacity: isPlanned ? 0.22 : 0.78,
        side: THREE.DoubleSide,
      })
    )
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.022;
  root.add(ringMesh);

  // Anel de alerta vermelho / failover
  const failoverRing = new THREE.Mesh(
    kit.own(new THREE.RingGeometry(0.42, 0.49, 28)),
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
      bodyGroup.position.y = baseY + Math.abs(Math.sin(t * 7.5 + phase)) * 0.16;
      leftHand.rotation.x = -0.9 + Math.sin(t * 10) * 0.25;
      rightHand.rotation.x = -0.9 + Math.cos(t * 10) * 0.25;
      headGroup.rotation.y = Math.sin(t * 5 + phase) * 0.22;
    } else if (working) {
      bodyGroup.position.y = baseY + Math.sin(t * 3.4 + phase) * 0.016;
      leftHand.rotation.x = Math.sin(t * 13 + phase) * 0.22;
      rightHand.rotation.x = Math.cos(t * 13 + phase) * 0.22;
      headGroup.rotation.y = Math.sin(t * 1.4 + phase) * 0.12;
      headGroup.rotation.x = 0.08 + Math.sin(t * 2.6 + phase) * 0.04;
    } else {
      bodyGroup.position.y = baseY + Math.sin(t * 1.6 + phase) * (isPlanned ? 0.004 : 0.014);
      leftHand.rotation.x = Math.sin(t * 1.2 + phase) * 0.04;
      rightHand.rotation.x = Math.cos(t * 1.2 + phase) * 0.04;
      headGroup.rotation.y = Math.sin(t * 0.7 + phase) * 0.16;
      headGroup.rotation.x = 0;
    }

    if (crownMesh) {
      crownMesh.position.y = 0.28 + Math.sin(t * 2.4 + phase) * 0.018;
      crownMesh.rotation.z = t * 0.6;
    }

    // Piscar natural
    const blinkCycle = (t + phase * 0.7) % 4.4;
    eyesGroup.scale.y = blinkCycle > 4.26 ? 0.12 : 1;

    if (working) {
      const s = 1 + Math.sin(t * 3.8 + phase) * 0.09;
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
    haloMesh,
    ringMesh,
    failoverRing,
    baseY,
    animate,
  };
}
