// Adaptado de CodeDen (MIT) commit b0b2a5a — Motor de Avatares 3D Personalizados da Holding OrgFy (Three.js + CanvasTexture)
// - Escultura procedural 3D fiel aos personagens reais do Buzz (Iris, Bento, Conselho CTO/CRO/CPO/COO/CGO, Lumen, OrgFy Core)
// - Modo híbrido automático: carrega `agent.picture` como medalhão/visor 3D circular + cor dominante para qualquer agente novo
// - Animações integradas: respiração idle, piscar natural, digitação ativa (mãos no teclado), pulso de failover/erro e comemoração

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
  accentRgb: Rgb;
  visorRgb?: Rgb;
}

function hashHue(str: string): Rgb {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const palette: Rgb[] = [
    [0.32, 0.58, 0.92],
    [0.24, 0.78, 0.58],
    [0.92, 0.58, 0.24],
    [0.64, 0.45, 0.92],
    [0.86, 0.36, 0.44],
    [0.88, 0.78, 0.24],
    [0.24, 0.74, 0.84],
  ];
  return palette[(h >>> 0) % palette.length];
}

export function resolveAvatarArchetype(name: string, role = "", p: FloorPalette): ArchetypeStyle {
  const txt = `${name} ${role}`.toLowerCase();

  if (/iris|ceo\s*master|bestie/.test(txt)) {
    return { kind: "iris_ceo", bodyRgb: [0.88, 0.28, 0.28], accentRgb: [0.22, 0.82, 0.96], visorRgb: [0.12, 0.16, 0.24] };
  }
  if (/bento|arquit/.test(txt)) {
    return { kind: "bento_tall", bodyRgb: [0.26, 0.56, 0.92], accentRgb: [0.88, 0.94, 1.0] };
  }
  if (/cro|risco|compliance|auditor/.test(txt)) {
    return { kind: "giraffe_cro", bodyRgb: [0.34, 0.66, 0.94], accentRgb: [0.95, 0.84, 0.32] };
  }
  if (/cgo|growth/.test(txt)) {
    return { kind: "hover_cgo", bodyRgb: [0.32, 0.48, 0.76], accentRgb: [0.36, 0.88, 0.98] };
  }
  if (/cto|coo/.test(txt)) {
    return { kind: "horned_cto", bodyRgb: [0.84, 0.34, 0.24], accentRgb: [0.98, 0.72, 0.24] };
  }
  if (/cpo|produto|po\b/.test(txt)) {
    return { kind: "hat_cpo", bodyRgb: [0.58, 0.38, 0.86], accentRgb: [0.76, 0.94, 0.34] };
  }
  if (/or[aá]culo|scout|sol\b/.test(txt)) {
    return { kind: "owl_oracle", bodyRgb: [0.56, 0.44, 0.72], accentRgb: [0.96, 0.82, 0.36] };
  }
  if (/lumen\s*dev|lumen\s*qa|atlas|ravi|hugo|otto|teo/.test(txt)) {
    const isDark = /lumen\s*(dev|qa)/.test(txt);
    return {
      kind: isDark ? "stealth_dev" : "classic_bot",
      bodyRgb: isDark ? [0.18, 0.2, 0.25] : /atlas|hugo|ravi|livia|lia/.test(txt) ? [0.88, 0.78, 0.22] : hashHue(name),
      accentRgb: isDark ? [0.28, 0.88, 0.62] : p.lane,
    };
  }
  return { kind: "classic_bot", bodyRgb: hashHue(name), accentRgb: p.lane };
}

/** Cria um medalhão 3D circular com a foto real `agent.picture` (ou iniciais se indisponível). */
function buildPortraitBadge(kit: Kit, name: string, picture: string | undefined, ringColorCss: string): THREE.Mesh {
  const c = canvasOf(128, 128);
  const g = c.getContext("2d")!;

  const drawFallback = () => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = "#141821";
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f1f5f9";
    g.font = "700 44px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join("");
    g.fillText(initials || "AI", 64, 66);
    g.strokeStyle = ringColorCss;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.stroke();
  };

  drawFallback();
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

  const badge = new THREE.Mesh(
    kit.own(new THREE.CircleGeometry(0.145, 24)),
    kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }))
  );
  return badge;
}

/** Constrói um personagem 3D estilizado fiel ao avatar do agente no Buzz, pronto para animar a 60 FPS. */
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
  const bodyRgb: Rgb = isPlanned ? [0.5, 0.54, 0.6] : style.bodyRgb;
  const accentRgb: Rgb = isError
    ? [0.95, 0.32, 0.34]
    : isWorking
    ? p.accent.reviewer
    : isPlanned
    ? [0.45, 0.48, 0.54]
    : style.accentRgb;

  const matBody = kit.matte(bodyRgb, {
    roughness: 0.52,
    transparent: isPlanned,
    opacity: isPlanned ? 0.42 : 1,
  });
  const matDark = kit.matte([0.1, 0.12, 0.16], { roughness: 0.38 });
  const matWhite = kit.matte([0.97, 0.98, 1], { roughness: 0.3 });
  const matAccent = kit.matte(accentRgb, {
    roughness: 0.3,
    emissive: colour(accentRgb),
    emissiveIntensity: isPlanned ? 0.08 : isWorking || isError ? 0.85 : 0.42,
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, seatHeight, 0.04);
  bodyGroup.scale.setScalar(scale);
  root.add(bodyGroup);

  const eyesGroup = new THREE.Group();
  let eyeY = 0.42;
  let eyeZ = 0.19;
  let headTopY = 0.68;

  if (style.kind === "bento_tall") {
    // Corpo alto esguio estilo Bento / Bento Arquiteto + 2 anteninhas verticais
    const torso = new THREE.Mesh(kit.own(new THREE.CapsuleGeometry(0.165, 0.36, 8, 16)), matBody);
    torso.position.y = 0.36;
    torso.castShadow = !isPlanned;
    bodyGroup.add(torso);

    for (const ax of [-0.075, 0.075]) {
      const stalk = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.016, 0.02, 0.18, 8)), matBody);
      stalk.position.set(ax, 0.72, 0);
      bodyGroup.add(stalk);
      const bulb = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.032, 10, 10)), matAccent);
      bulb.position.set(ax, 0.82, 0);
      bodyGroup.add(bulb);
    }
    eyeY = 0.52;
    eyeZ = 0.155;
    headTopY = 0.86;
  } else if (style.kind === "giraffe_cro") {
    // Pescoço alongado + cabecinha com chifrinhos (ossicones) estilo Conselho CRO
    const baseBody = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.19, 14, 14)), matBody);
    baseBody.position.y = 0.2;
    baseBody.scale.set(1, 0.95, 1.05);
    baseBody.castShadow = !isPlanned;
    bodyGroup.add(baseBody);

    const neck = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.075, 0.11, 0.34, 12)), matBody);
    neck.position.set(0, 0.44, 0.02);
    neck.castShadow = !isPlanned;
    bodyGroup.add(neck);

    const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.135, 14, 14)), matBody);
    head.position.set(0, 0.64, 0.06);
    head.scale.set(0.95, 0.9, 1.2);
    head.castShadow = !isPlanned;
    bodyGroup.add(head);

    for (const hx of [-0.06, 0.06]) {
      const horn = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.015, 0.02, 0.11, 8)), matBody);
      horn.position.set(hx, 0.77, 0.03);
      bodyGroup.add(horn);
      const tip = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.026, 8, 8)), matAccent);
      tip.position.set(hx, 0.83, 0.03);
      bodyGroup.add(tip);
    }
    eyeY = 0.65;
    eyeZ = 0.19;
    headTopY = 0.86;
  } else if (style.kind === "hover_cgo") {
    // Bot nave/carro aerodinâmico estilo Conselho CGO com visor luminoso
    const hull = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.46, 0.22, 0.44)), matBody);
    hull.position.set(0, 0.2, 0);
    hull.castShadow = !isPlanned;
    bodyGroup.add(hull);

    const canopy = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.19, 14, 12)), matDark);
    canopy.position.set(0, 0.32, 0.02);
    canopy.scale.set(1.1, 0.72, 1.0);
    bodyGroup.add(canopy);

    for (const lx of [-0.14, 0.14]) {
      const light = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.038, 10, 10)), matAccent);
      light.position.set(lx, 0.2, 0.225);
      bodyGroup.add(light);
    }
    eyeY = 0.33;
    eyeZ = 0.19;
    headTopY = 0.56;
  } else if (style.kind === "iris_ceo") {
    // OrgFy Iris: capacete/cabeça redonda coral-vermelha, visor escuro com olhos ciano brilhantes + coroa/halo CEO
    const torso = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 16)), matBody);
    torso.position.y = 0.18;
    torso.castShadow = !isPlanned;
    bodyGroup.add(torso);

    const head = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.21, 18, 16)), matBody);
    head.position.y = 0.46;
    head.castShadow = !isPlanned;
    bodyGroup.add(head);

    const visor = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.28, 0.12, 0.08)), matDark);
    visor.position.set(0, 0.46, 0.165);
    bodyGroup.add(visor);

    // Orelhas/antenas laterais
    for (const sx of [-0.21, 0.21]) {
      const ear = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10)), matAccent);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(sx, 0.47, 0);
      bodyGroup.add(ear);
    }

    // Coroa/anel dourado sutil flutuando acima da Iris
    const crown = new THREE.Mesh(
      kit.own(new THREE.TorusGeometry(0.13, 0.018, 8, 24)),
      kit.matte([0.98, 0.8, 0.24], { roughness: 0.25, emissive: colour([0.98, 0.8, 0.24]), emissiveIntensity: 0.65 })
    );
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 0.74;
    bodyGroup.add(crown);

    eyeY = 0.46;
    eyeZ = 0.21;
    headTopY = 0.78;
  } else if (style.kind === "stealth_dev") {
    // Bot cubo escuro minimalista (Lumen Dev / Lumen QA) com olhos neon
    const cube = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.36, 0.44, 0.34)), matBody);
    cube.position.y = 0.28;
    cube.castShadow = !isPlanned;
    bodyGroup.add(cube);

    const trim = new THREE.Mesh(kit.own(new THREE.BoxGeometry(0.38, 0.04, 0.36)), matAccent);
    trim.position.y = 0.48;
    bodyGroup.add(trim);

    eyeY = 0.36;
    eyeZ = 0.175;
    headTopY = 0.58;
  } else if (style.kind === "horned_cto") {
    // Bot arredondado com chifrinhos/antenas laterais (CTO / COO)
    const torso = new THREE.Mesh(kit.own(new THREE.CapsuleGeometry(0.19, 0.2, 8, 16)), matBody);
    torso.position.y = 0.3;
    torso.castShadow = !isPlanned;
    bodyGroup.add(torso);

    for (const sx of [-0.12, 0.12]) {
      const horn = new THREE.Mesh(kit.own(new THREE.ConeGeometry(0.045, 0.15, 10)), matAccent);
      horn.position.set(sx, 0.6, 0);
      horn.rotation.z = sx < 0 ? 0.32 : -0.32;
      bodyGroup.add(horn);
    }
    eyeY = 0.4;
    eyeZ = 0.185;
    headTopY = 0.7;
  } else {
    // Classic bot / CPO / Oracle: corpo cápsula simpático com antena luminosa
    const torso = new THREE.Mesh(kit.own(new THREE.CapsuleGeometry(0.19, 0.22, 8, 16)), matBody);
    torso.position.y = 0.31;
    torso.castShadow = !isPlanned;
    bodyGroup.add(torso);

    if (style.kind === "hat_cpo") {
      const hat = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.13, 0.17, 0.16, 14)), matDark);
      hat.position.y = 0.62;
      bodyGroup.add(hat);
      const band = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.162, 0.168, 0.03, 14)), matAccent);
      band.position.y = 0.56;
      bodyGroup.add(band);
      headTopY = 0.74;
    } else {
      const ant = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.014, 0.018, 0.14, 8)), matDark);
      ant.position.y = 0.62;
      bodyGroup.add(ant);
      const orb = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.04, 10, 10)), matAccent);
      orb.position.y = 0.7;
      bodyGroup.add(orb);
      headTopY = 0.76;
    }
    eyeY = 0.41;
    eyeZ = 0.185;
  }

  // Olhos expressivos (brilho ciano na Iris/Stealth, olhos brancos com pupila nos demais)
  const useGlowEyes = style.kind === "iris_ceo" || style.kind === "stealth_dev" || style.kind === "hover_cgo";
  eyesGroup.position.set(0, eyeY, eyeZ);
  for (const ex of [-0.068, 0.068]) {
    if (useGlowEyes) {
      const eye = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.028, 10, 10)), matAccent);
      eye.position.set(ex, 0, 0);
      eyesGroup.add(eye);
    } else {
      const sclera = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.042, 10, 10)), matWhite);
      sclera.position.set(ex, 0, 0);
      eyesGroup.add(sclera);
      const pupil = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.022, 8, 8)), matDark);
      pupil.position.set(ex, 0, 0.026);
      eyesGroup.add(pupil);
    }
  }
  bodyGroup.add(eyesGroup);

  // Mãozinhas animadas (digitam no notebook quando working!)
  const leftHand = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.055, 10, 10)), matBody);
  leftHand.position.set(-0.22, 0.22, 0.14);
  leftHand.castShadow = !isPlanned;
  bodyGroup.add(leftHand);

  const rightHand = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.055, 10, 10)), matBody);
  rightHand.position.set(0.22, 0.22, 0.14);
  rightHand.castShadow = !isPlanned;
  bodyGroup.add(rightHand);

  // Medalhão 3D com a foto real `agent.picture` (ou iniciais) flutuando discretamente acima do ombro/cabeça quando habilitado
  let haloMesh: THREE.Object3D | null = null;
  if (opts?.showPortraitMedallion !== false) {
    const ringCss = isError ? "#f87171" : isWorking ? "#60a5fa" : "#3dd68c";
    const badge = buildPortraitBadge(kit, input.name, input.picture, ringCss);
    badge.position.set(0, headTopY + 0.18, 0.02);
    bodyGroup.add(badge);
    haloMesh = badge;
  }

  // Anel de status no chão sob a cadeira/estação
  const ringMesh = new THREE.Mesh(
    kit.own(new THREE.RingGeometry(0.32, 0.39, 28)),
    kit.own(
      new THREE.MeshBasicMaterial({
        color: colour(accentRgb),
        transparent: true,
        opacity: isPlanned ? 0.25 : 0.78,
        side: THREE.DoubleSide,
      })
    )
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.022;
  root.add(ringMesh);

  // Anel de pulso para erro / failover (visível apenas quando error=true)
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
      leftHand.position.y = 0.36 + Math.sin(t * 10) * 0.04;
      rightHand.position.y = 0.36 + Math.cos(t * 10) * 0.04;
    } else if (working) {
      // Digitação rápida no teclado + leve balanço concentrado
      bodyGroup.position.y = baseY + Math.sin(t * 3.4 + phase) * 0.018;
      leftHand.position.y = 0.21 + Math.sin(t * 14 + phase) * 0.025;
      rightHand.position.y = 0.21 + Math.cos(t * 14 + phase) * 0.025;
      leftHand.position.z = 0.16 + Math.sin(t * 7 + phase) * 0.015;
      rightHand.position.z = 0.16 + Math.cos(t * 7 + phase) * 0.015;
    } else {
      bodyGroup.position.y = baseY + Math.sin(t * 1.6 + phase) * (isPlanned ? 0.004 : 0.014);
      leftHand.position.y = 0.22;
      rightHand.position.y = 0.22;
    }

    // Piscar natural
    const blinkCycle = (t + phase * 0.7) % 4.4;
    eyesGroup.scale.y = blinkCycle > 4.26 ? 0.12 : 1;

    // Pulso do anel no chão
    if (working) {
      const s = 1 + Math.sin(t * 3.8 + phase) * 0.09;
      ringMesh.scale.set(s, s, 1);
    }

    // Anel de alerta vermelho / failover
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
