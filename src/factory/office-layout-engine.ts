// Adaptado de CodeDen (MIT) commit b0b2a5a + inspirado em pixel-agents (MIT) e ai-office (MIT)
// Engine determinística de planta baixa editável (16x12), presets arquitetônicos e Pathfinding A*
// Permite construir paredes, divisórias de vidro, salas, mesas, lounge de café, racks e plantas.

export type FloorTileKind = "wood" | "slate" | "carpet" | "lounge";

export type OfficeFurnitureKind =
  | "wall"
  | "glass_wall"
  | "desk"
  | "meeting_table"
  | "sofa"
  | "coffee_bar"
  | "plant"
  | "server_rack";

export interface OfficeFurnitureItem {
  id: string;
  kind: OfficeFurnitureKind;
  gx: number; // 0..cols-1
  gz: number; // 0..rows-1
  rot: 0 | 1 | 2 | 3; // múltiplos de 90 graus
  label?: string;
}

export interface OfficeLayoutData {
  version: 1;
  cols: number;
  rows: number;
  presetName: string;
  floors: FloorTileKind[]; // length = cols * rows
  items: OfficeFurnitureItem[];
}

export const OFFICE_COLS = 16;
export const OFFICE_ROWS = 12;

export function tileIndex(gx: number, gz: number, cols = OFFICE_COLS): number {
  return gz * cols + gx;
}

export function isInsideGrid(gx: number, gz: number, cols = OFFICE_COLS, rows = OFFICE_ROWS): boolean {
  return gx >= 0 && gx < cols && gz >= 0 && gz < rows;
}

/** Cria um preset arquitetônico de alto nível pronto para usar ou editar. */
export function buildOfficePreset(preset: "holding_suites" | "startup_open" | "cyber_lab"): OfficeLayoutData {
  const cols = OFFICE_COLS;
  const rows = OFFICE_ROWS;
  const floors: FloorTileKind[] = new Array(cols * rows).fill(preset === "cyber_lab" ? "slate" : "wood");
  const items: OfficeFurnitureItem[] = [];
  let seq = 1;
  const add = (kind: OfficeFurnitureKind, gx: number, gz: number, rot: 0 | 1 | 2 | 3 = 0, label?: string) => {
    if (!isInsideGrid(gx, gz, cols, rows)) return;
    if (items.some((i) => i.gx === gx && i.gz === gz)) return;
    items.push({ id: `it_${seq++}`, kind, gx, gz, rot, label });
  };
  const paintRect = (x0: number, z0: number, x1: number, z1: number, kind: FloorTileKind) => {
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (isInsideGrid(x, z, cols, rows)) floors[tileIndex(x, z, cols)] = kind;
      }
    }
  };

  if (preset === "holding_suites") {
    // Zona de Reunião Executiva (canto superior direito) com tapete + paredes de vidro
    paintRect(10, 1, 14, 5, "carpet");
    // Lounge / Café (canto inferior esquerdo)
    paintRect(1, 8, 5, 10, "lounge");
    // Área de Servidores (canto superior esquerdo)
    paintRect(1, 1, 3, 3, "slate");

    // Divisória de vidro da Sala de Reunião (com porta aberta em gx=10, gz=4)
    add("glass_wall", 10, 1, 1);
    add("glass_wall", 10, 2, 1);
    add("glass_wall", 10, 3, 1);
    add("glass_wall", 11, 5, 0);
    add("glass_wall", 12, 5, 0);
    add("glass_wall", 13, 5, 0);
    add("glass_wall", 14, 5, 0);

    // Mesas de reunião no centro da sala de vidro
    add("meeting_table", 12, 3, 0, "Conselho");
    add("meeting_table", 13, 3, 0);
    add("plant", 14, 1, 0);

    // Racks de servidores no canto superior esquerdo
    add("server_rack", 1, 1, 0, "Gateway");
    add("server_rack", 2, 1, 0, "NexusMind");
    add("wall", 4, 1, 1);
    add("wall", 4, 2, 1);

    // Ilhas de trabalho (8 mesas bem espaçadas com corredor livre)
    const deskCoords: Array<[number, number, 0 | 1 | 2 | 3]> = [
      [5, 2, 0],
      [7, 2, 0],
      [5, 5, 0],
      [7, 5, 0],
      [9, 7, 0],
      [11, 7, 0],
      [13, 7, 0],
      [9, 9, 2],
      [11, 9, 2],
      [13, 9, 2],
    ];
    for (const [dx, dz, dr] of deskCoords) add("desk", dx, dz, dr);

    // Lounge de Café + Sofás + Plantas
    add("coffee_bar", 1, 9, 1, "Café");
    add("sofa", 3, 10, 2);
    add("sofa", 4, 10, 2);
    add("plant", 1, 7, 0);
    add("plant", 14, 10, 0);
    add("plant", 6, 1, 0);
  } else if (preset === "startup_open") {
    paintRect(1, 1, 14, 10, "wood");
    paintRect(11, 7, 14, 10, "lounge");
    paintRect(1, 1, 5, 4, "carpet");

    add("meeting_table", 3, 2, 0, "War Room");
    add("meeting_table", 4, 2, 0);
    add("glass_wall", 6, 1, 1);
    add("glass_wall", 6, 2, 1);

    for (const [dx, dz] of [
      [8, 2], [10, 2], [12, 2],
      [8, 5], [10, 5], [12, 5],
      [2, 7], [4, 7], [6, 7], [8, 7],
    ]) {
      add("desk", dx, dz, 0);
    }

    add("coffee_bar", 14, 8, 3, "Café");
    add("sofa", 12, 9, 0);
    add("sofa", 13, 9, 0);
    add("server_rack", 14, 1, 0);
    add("plant", 1, 10, 0);
    add("plant", 14, 5, 0);
  } else {
    // cyber_lab: laboratório escuro com racks centrais e bancadas simétricas
    paintRect(6, 4, 9, 7, "carpet");
    add("server_rack", 7, 1, 0, "Core-A");
    add("server_rack", 8, 1, 0, "Core-B");
    add("glass_wall", 5, 3, 0);
    add("glass_wall", 10, 3, 0);
    add("meeting_table", 7, 5, 0, "Ops Hub");
    add("meeting_table", 8, 5, 0);

    for (const [dx, dz] of [
      [2, 2], [4, 2], [11, 2], [13, 2],
      [2, 5], [4, 5], [11, 5], [13, 5],
      [2, 8], [4, 8], [11, 8], [13, 8],
    ]) {
      add("desk", dx, dz, 0);
    }
    add("coffee_bar", 7, 10, 2);
    add("sofa", 9, 10, 2);
    add("plant", 1, 1, 0);
    add("plant", 14, 1, 0);
    add("plant", 1, 10, 0);
    add("plant", 14, 10, 0);
  }

  return {
    version: 1,
    cols,
    rows,
    presetName: preset,
    floors,
    items,
  };
}

export function placeOrReplaceFurniture(
  layout: OfficeLayoutData,
  kind: OfficeFurnitureKind,
  gx: number,
  gz: number,
  rot: 0 | 1 | 2 | 3 = 0
): OfficeLayoutData {
  if (!isInsideGrid(gx, gz, layout.cols, layout.rows)) return layout;
  const filtered = layout.items.filter((i) => !(i.gx === gx && i.gz === gz));
  const nextItem: OfficeFurnitureItem = {
    id: `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    gx,
    gz,
    rot,
  };
  return { ...layout, items: [...filtered, nextItem] };
}

export function removeFurnitureAt(layout: OfficeLayoutData, gx: number, gz: number): OfficeLayoutData {
  return {
    ...layout,
    items: layout.items.filter((i) => !(i.gx === gx && i.gz === gz)),
  };
}

export function paintFloorTile(
  layout: OfficeLayoutData,
  gx: number,
  gz: number,
  kind: FloorTileKind
): OfficeLayoutData {
  if (!isInsideGrid(gx, gz, layout.cols, layout.rows)) return layout;
  const nextFloors = [...layout.floors];
  nextFloors[tileIndex(gx, gz, layout.cols)] = kind;
  return { ...layout, floors: nextFloors };
}

export function isTileWalkable(layout: OfficeLayoutData, gx: number, gz: number): boolean {
  if (!isInsideGrid(gx, gz, layout.cols, layout.rows)) return false;
  return !layout.items.some((i) => i.gx === gx && i.gz === gz);
}

/** Retorna a célula caminhável adjacente a uma mesa/móvel para o agente sentar ou interagir. */
export function getInteractionSpot(
  layout: OfficeLayoutData,
  item: OfficeFurnitureItem
): { gx: number; gz: number } | null {
  const deltas: Array<[number, number]> = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  // Prioriza o lado frontal conforme rotação
  const rotOrder = [deltas[item.rot % 4], ...deltas.filter((_, i) => i !== item.rot % 4)];
  for (const [dx, dz] of rotOrder) {
    const nx = item.gx + dx;
    const nz = item.gz + dz;
    if (isTileWalkable(layout, nx, nz)) return { gx: nx, gz: nz };
  }
  return null;
}

/**
 * Pathfinding A* determinístico no grid 2D do escritório.
 * Contorna paredes, divisórias de vidro e móveis automaticamente.
 */
export function findGridPathAStar(
  layout: OfficeLayoutData,
  start: { gx: number; gz: number },
  goal: { gx: number; gz: number }
): Array<{ gx: number; gz: number }> {
  if (!isInsideGrid(start.gx, start.gz, layout.cols, layout.rows)) return [];
  if (!isInsideGrid(goal.gx, goal.gz, layout.cols, layout.rows)) return [];
  if (start.gx === goal.gx && start.gz === goal.gz) return [{ gx: goal.gx, gz: goal.gz }];

  const blocked = new Set<string>();
  for (const it of layout.items) {
    blocked.add(`${it.gx},${it.gz}`);
  }
  // Permite sair do ponto inicial mesmo se o agente estava temporariamente sobre um tile alterado
  blocked.delete(`${start.gx},${start.gz}`);
  if (blocked.has(`${goal.gx},${goal.gz}`)) return [];

  const keyOf = (x: number, z: number) => `${x},${z}`;
  const open: Array<{ gx: number; gz: number; g: number; f: number }> = [
    { gx: start.gx, gz: start.gz, g: 0, f: Math.abs(goal.gx - start.gx) + Math.abs(goal.gz - start.gz) },
  ];
  const gScore = new Map<string, number>([[keyOf(start.gx, start.gz), 0]]);
  const cameFrom = new Map<string, { gx: number; gz: number }>();
  const closed = new Set<string>();

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const curKey = keyOf(cur.gx, cur.gz);
    if (cur.gx === goal.gx && cur.gz === goal.gz) {
      const path: Array<{ gx: number; gz: number }> = [];
      let trace: { gx: number; gz: number } | undefined = { gx: cur.gx, gz: cur.gz };
      while (trace) {
        path.push(trace);
        trace = cameFrom.get(keyOf(trace.gx, trace.gz));
      }
      return path.reverse();
    }
    closed.add(curKey);

    for (const [dx, dz] of dirs) {
      const nx = cur.gx + dx;
      const nz = cur.gz + dz;
      if (!isInsideGrid(nx, nz, layout.cols, layout.rows)) continue;
      const nKey = keyOf(nx, nz);
      if (closed.has(nKey) || blocked.has(nKey)) continue;
      const tentativeG = cur.g + 1;
      const prevG = gScore.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        cameFrom.set(nKey, { gx: cur.gx, gz: cur.gz });
        gScore.set(nKey, tentativeG);
        const h = Math.abs(goal.gx - nx) + Math.abs(goal.gz - nz);
        open.push({ gx: nx, gz: nz, g: tentativeG, f: tentativeG + h });
      }
    }
  }

  return [];
}

export function loadSavedOfficeLayout(tenant: string): OfficeLayoutData {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(`orgfy_office_layout_v1_${tenant}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.floors) && Array.isArray(parsed.items)) {
        return parsed as OfficeLayoutData;
      }
    }
  } catch {}
  return buildOfficePreset(tenant === "lumen-iptv" ? "cyber_lab" : "holding_suites");
}

export function saveOfficeLayout(tenant: string, layout: OfficeLayoutData): void {
  try {
    (globalThis as any)?.localStorage?.setItem?.(`orgfy_office_layout_v1_${tenant}`, JSON.stringify(layout));
  } catch {}
}
