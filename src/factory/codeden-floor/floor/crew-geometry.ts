// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/floor/crew-geometry.ts
// Geometrias de personagens do Andar 3D (Oficina & Mirante) reconstruídas em estilo LEGO / Voxel
// para unificar visualmente toda a Holding (Torre 3D, Sala do Conselho 3D e Fábrica 3D).
import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BlockedIcon, Mouth } from "./figure-look";

export const DEPTH = 0.9;
/** Centro do pino LEGO luminoso de status no topo da cabeça. */
export const TIP_Y = 0.685;
/** Altura central dos olhos na face plana da cabeça cúbica LEGO. */
export const EYE_Y = 0.5;
/** Topo do bonequinho LEGO para ancoragem do balão. */
export const HEAD_Y = 0.76;

/** Superfície frontal (+z) da silhueta LEGO (tronco = 0.09, cabeça cúbica = 0.12). */
export const frontZ = (_x: number, y: number) => (y >= 0.36 ? 0.12 : 0.09);

export function placed(
  g: BufferGeometry,
  x: number,
  y: number,
  z: number,
  rot?: [number, number, number],
  scale?: [number, number, number],
) {
  if (scale) g.scale(...scale);
  if (rot) {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
  }
  g.translate(x, y, z);
  return g;
}

export function rod(from: [number, number, number], to: [number, number, number], r: number) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const dir = b.clone().sub(a);
  const g = new CylinderGeometry(r, r, dir.length(), 6);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  const mid = a.add(b).multiplyScalar(0.5);
  return g.translate(mid.x, mid.y, mid.z);
}

export function merged(parts: BufferGeometry[]): BufferGeometry {
  const indexed = parts.map((g) => {
    if (!g.index) {
      const count = g.getAttribute("position").count;
      g.setIndex(Array.from({ length: count }, (_, i) => i));
    }
    return g;
  });
  const out = mergeGeometries(indexed) as BufferGeometry;
  for (const g of indexed) g.dispose();
  return out;
}

function voxelSmile(y: number, z: number, wide = false) {
  const w = wide ? 0.09 : 0.068;
  return merged([
    placed(new BoxGeometry(w, 0.014, 0.01), 0, y, z),
    placed(new BoxGeometry(0.014, 0.014, 0.01), -w / 2 - 0.004, y + 0.01, z),
    placed(new BoxGeometry(0.014, 0.014, 0.01), w / 2 + 0.004, y + 0.01, z),
  ]);
}

function voxelFrown(y: number, z: number) {
  return merged([
    placed(new BoxGeometry(0.064, 0.014, 0.01), 0, y + 0.01, z),
    placed(new BoxGeometry(0.014, 0.014, 0.01), -0.036, y, z),
    placed(new BoxGeometry(0.014, 0.014, 0.01), 0.036, y, z),
  ]);
}

function mouths(): Record<Mouth, BufferGeometry> {
  const z = 0.124;
  return {
    smile: voxelSmile(0.425, z, false),
    "wide-smile": voxelSmile(0.425, z, true),
    "flat-short": placed(new BoxGeometry(0.042, 0.014, 0.01), 0, 0.43, z),
    flat: placed(new BoxGeometry(0.068, 0.014, 0.01), 0, 0.43, z),
    o: placed(new BoxGeometry(0.028, 0.028, 0.01), 0, 0.43, z),
    frown: voxelFrown(0.422, z),
  };
}

function icons(): Record<BlockedIcon, BufferGeometry> {
  return {
    hourglass: merged([
      placed(new ConeGeometry(0.035, 0.05, 10), 0, 0.025, 0, [Math.PI, 0, 0]),
      placed(new ConeGeometry(0.035, 0.05, 10), 0, -0.025, 0),
      placed(new CylinderGeometry(0.04, 0.04, 0.008, 12), 0, 0.054, 0),
      placed(new CylinderGeometry(0.04, 0.04, 0.008, 12), 0, -0.054, 0),
    ]),
    cable: placed(new TorusKnotGeometry(0.03, 0.008, 40, 6, 2, 3), 0, 0, 0),
    ticket: merged([
      placed(new BoxGeometry(0.09, 0.055, 0.006), 0, 0, 0, [0, 0, 0.2]),
      placed(new CylinderGeometry(0.008, 0.008, 0.008, 8), 0.03, 0.006, 0.002, [Math.PI / 2, 0, 0]),
    ]),
    person: merged([
      placed(new BoxGeometry(0.036, 0.036, 0.036), 0, 0.03, 0),
      placed(new BoxGeometry(0.055, 0.04, 0.036), 0, -0.02, 0),
    ]),
    chair: merged([
      placed(new BoxGeometry(0.06, 0.008, 0.06), 0, 0, 0),
      placed(new BoxGeometry(0.06, 0.06, 0.008), 0, 0.03, -0.026),
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) =>
          placed(new BoxGeometry(0.007, 0.045, 0.007), sx * 0.026, -0.024, sz * 0.026),
        ),
      ),
    ]),
  };
}

/** Peças do bonequinho LEGO / Voxel para o motor instanciado do Andar 3D. */
export function crewGeometry() {
  const eyeZ = 0.123;
  // Tronco LEGO com ombros chanfrados + cinto na base
  const torso = merged([
    placed(new BoxGeometry(0.27, 0.27, 0.175), 0, 0.225, 0),
    placed(new BoxGeometry(0.28, 0.035, 0.185), 0, 0.105, 0),
  ]);

  return {
    body: torso,
    /** Cabeça cúbica LEGO (pintada em tom pele/cerâmica clara no crew.ts). */
    head: placed(new BoxGeometry(0.245, 0.235, 0.24), 0, 0.485, 0),
    /** Cabelo/capacete LEGO em blocos no topo e nuca. */
    hair: merged([
      placed(new BoxGeometry(0.265, 0.07, 0.262), 0, 0.62, -0.004),
      placed(new BoxGeometry(0.265, 0.17, 0.052), 0, 0.51, -0.108),
    ]),
    /** Pino LEGO luminoso de status no topo da cabeça. */
    tip: placed(new CylinderGeometry(0.05, 0.05, 0.048, 12), 0, TIP_Y, 0),
    /** Pé/perna em bloco LEGO na origem. */
    foot: placed(new BoxGeometry(0.092, 0.095, 0.14), 0, 0.015, 0.01),
    /** Mãozinha em bloco LEGO na origem. */
    hand: new BoxGeometry(0.074, 0.074, 0.074),
    /** Olhos quadrados estilo LEGO/Minecraft na face plana. */
    eyes: merged(
      [-0.058, 0.058].map((x) => placed(new BoxGeometry(0.038, 0.044, 0.012), x, EYE_Y, eyeZ)),
    ),
    catchlights: merged(
      [-0.058, 0.058].map((x) =>
        placed(new BoxGeometry(0.013, 0.013, 0.008), x - 0.009, EYE_Y + 0.011, eyeZ + 0.007),
      ),
    ),
    /** Moldura e crachá frontal no tronco LEGO. */
    rim: placed(new BoxGeometry(0.115, 0.115, 0.012), 0, 0.225, 0.091),
    badge: placed(new CircleGeometry(0.048, 20), 0, 0.225, 0.099),
    shadow: placed(new CircleGeometry(0.24, 24), 0, 0.004, 0.02, [-Math.PI / 2, 0, 0]),
    // Builder: lenço/gola LEGO
    neckerchief: merged([
      placed(new BoxGeometry(0.285, 0.042, 0.195), 0, 0.355, 0),
      placed(new BoxGeometry(0.06, 0.09, 0.025), 0, 0.3, 0.096),
    ]),
    // Reviewer: óculos quadrados LEGO
    glasses: merged([
      ...[-0.058, 0.058].map((x) =>
        merged([
          placed(new BoxGeometry(0.068, 0.01, 0.012), x, EYE_Y + 0.032, eyeZ + 0.008),
          placed(new BoxGeometry(0.068, 0.01, 0.012), x, EYE_Y - 0.032, eyeZ + 0.008),
          placed(new BoxGeometry(0.01, 0.064, 0.012), x - 0.03, EYE_Y, eyeZ + 0.008),
          placed(new BoxGeometry(0.01, 0.064, 0.012), x + 0.03, EYE_Y, eyeZ + 0.008),
        ]),
      ),
      placed(new BoxGeometry(0.042, 0.01, 0.012), 0, EYE_Y + 0.008, eyeZ + 0.008),
    ]),
    // Rebaser / Integrator: gola técnica LEGO
    collar: placed(new BoxGeometry(0.29, 0.045, 0.2), 0, 0.35, 0),
    wrench: merged([
      placed(new BoxGeometry(0.022, 0.15, 0.022), 0.02, 0.07, 0.03),
      placed(new BoxGeometry(0.055, 0.045, 0.024), 0.02, 0.16, 0.03),
    ]),
    // PM: headset quadrado LEGO nas laterais da cabeça
    headset: merged([
      placed(new BoxGeometry(0.285, 0.026, 0.04), 0, 0.655, 0),
      ...[-0.14, 0.14].map((x) => placed(new BoxGeometry(0.038, 0.09, 0.085), x, 0.5, 0)),
    ]),
    mic: merged([
      rod([-0.14, 0.47, 0.03], [-0.045, 0.43, 0.135], 0.007),
      placed(new BoxGeometry(0.026, 0.02, 0.02), -0.045, 0.43, 0.135),
    ]),
    spyglass: merged([
      placed(new CylinderGeometry(0.018, 0.024, 0.16, 8), 0.02, 0.06, 0.04, [0.5, 0, 0]),
      placed(new CylinderGeometry(0.026, 0.026, 0.02, 8), 0.02, 0.13, 0.08, [0.5, 0, 0]),
    ]),
    magnifier: merged([
      placed(new BoxGeometry(0.018, 0.09, 0.018), 0.02, 0.05, 0.03),
      placed(new TorusGeometry(0.04, 0.009, 6, 12), 0.02, 0.135, 0.03),
    ]),
    lens: placed(new CircleGeometry(0.036, 12), 0.02, 0.135, 0.032),
    dots: merged(
      [0, 1, 2].map((i) => {
        const a = (i * Math.PI * 2) / 3;
        return placed(new BoxGeometry(0.026, 0.026, 0.026), Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
      }),
    ),
    halo: placed(new TorusGeometry(0.07, 0.008, 6, 24), 0, 0, 0, [Math.PI / 2, 0, 0]),
    mug: merged([
      placed(new BoxGeometry(0.065, 0.075, 0.065), 0.03, 0.035, 0.03),
      placed(new BoxGeometry(0.022, 0.045, 0.016), 0.07, 0.035, 0.03),
    ]),
    ticket: placed(new BoxGeometry(0.2, 0.012, 0.14), 0, 0, 0),
    crate: placed(new BoxGeometry(0.22, 0.17, 0.22), 0, 0, 0),
    confetti: new BoxGeometry(0.03, 0.004, 0.018),
    puff: new SphereGeometry(0.05, 8, 6),
    ring: dashedRing(0.32, 0.36, 16),
    ...prefixed(mouths()),
    ...prefixedIcons(icons()),
  };
}

function prefixed(m: Record<Mouth, BufferGeometry>) {
  const out = {} as Record<`mouth:${Mouth}`, BufferGeometry>;
  for (const [k, g] of Object.entries(m)) out[`mouth:${k as Mouth}`] = g;
  return out;
}

function prefixedIcons(m: Record<BlockedIcon, BufferGeometry>) {
  const out = {} as Record<`icon:${BlockedIcon}`, BufferGeometry>;
  for (const [k, g] of Object.entries(m)) out[`icon:${k as BlockedIcon}`] = g;
  return out;
}

export function dashedRing(inner: number, outer: number, n: number): BufferGeometry {
  const step = (Math.PI * 2) / n;
  return merged(
    Array.from({ length: n }, (_, i) =>
      placed(new RingGeometry(inner, outer, 4, 1, i * step, step * 0.6), 0, 0.006, 0, [
        -Math.PI / 2,
        0,
        0,
      ]),
    ),
  );
}

export type CrewGeometry = ReturnType<typeof crewGeometry>;
export type Part = keyof CrewGeometry;
