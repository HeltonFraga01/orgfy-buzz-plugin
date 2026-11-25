// Onda 4 (R4.4): Constantes de tema, tenants e SVGs extraídas de src/index.tsx

export const TENANTS = [
  { id: "all", name: "Holding OrgFy", badge: "Cross-Workspace", slug: "all" },
  { id: "orgfy", name: "OrgFy Core", badge: "Core Framework", slug: "orgfy" },
  { id: "lumen-iptv", name: "Lumen IPTV", badge: "Subsidiária IPTV", slug: "lumen-iptv" },
  { id: "saas-tributario", name: "SaaS Tributário", badge: "Subsidiária Fiscal", slug: "saas-tributario" },
];


// ─────────────────────────────────────────────────────────────────────────────
// SVGs MINIMALISTAS GEOMÉTRICOS (ZERO EMOJIS FUNCIONAIS)
// ─────────────────────────────────────────────────────────────────────────────

export const SVG = {
  orgfy: ({ h, width = 20, height = 20 }: any) =>
    h(
      "svg",
      { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polygon", { points: "12 2 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 2" }),
      h("line", { x1: "12", y1: "22", x2: "12", y2: "15.5" }),
      h("polyline", { points: "22 8.5 12 15.5 2 8.5" }),
      h("polyline", { points: "2 15.5 12 8.5 22 15.5" })
    ),
  bell: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }),
      h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })
    ),
  bellOff: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" }),
      h("path", { d: "M18.63 13A17.89 17.89 0 0 1 18 8" }),
      h("path", { d: "M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" }),
      h("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
    ),
  zap: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
    ),
  shield: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
    ),
  refresh: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
    ),
  messageCircle: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" })
    ),
  columns: ({ h, width = 16, height = 16 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
      h("line", { x1: "12", y1: "3", x2: "12", y2: "21" })
    ),
  chevronDown: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "6 9 12 15 18 9" })
    ),
  chevronRight: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "9 18 15 12 9 6" })
    ),
  search: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "11", cy: "11", r: "8" }),
      h("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
    ),
  checkCircle: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
      h("polyline", { points: "22 4 12 14.01 9 11.01" })
    ),
  alertTriangle: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
      h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
      h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
    ),
  xCircle: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "12", cy: "12", r: "10" }),
      h("line", { x1: "15", y1: "9", x2: "9", y2: "15" }),
      h("line", { x1: "9", y1: "9", x2: "15", y2: "15" })
    ),
  terminal: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "4 17 10 11 4 5" }),
      h("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
    ),
  user: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: "12", cy: "7", r: "4" })
    ),
  cpu: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", ry: "2" }),
      h("rect", { x: "9", y: "9", width: "6", height: "6" }),
      h("line", { x1: "9", y1: "1", x2: "9", y2: "4" }),
      h("line", { x1: "15", y1: "1", x2: "15", y2: "4" }),
      h("line", { x1: "9", y1: "20", x2: "9", y2: "23" }),
      h("line", { x1: "15", y1: "20", x2: "15", y2: "23" })
    ),
  clock: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "12", cy: "12", r: "10" }),
      h("polyline", { points: "12 6 12 12 16 14" })
    ),
  gitCommit: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "12", cy: "12", r: "4" }),
      h("line", { x1: "1.05", y1: "12", x2: "7", y2: "12" }),
      h("line", { x1: "17.01", y1: "12", x2: "22.96", y2: "12" })
    ),
  externalLink: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
      h("polyline", { points: "15 3 21 3 21 9" }),
      h("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
    ),
  copy: ({ h, width = 12, height = 12 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
      h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
    ),
  users: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: "9", cy: "7", r: "4" }),
      h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
      h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
    ),
  folder: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })
    ),
  activity: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
    ),
  gitPullRequest: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("circle", { cx: "18", cy: "18", r: "3" }),
      h("circle", { cx: "6", cy: "6", r: "3" }),
      h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
      h("line", { x1: "6", y1: "9", x2: "6", y2: "21" })
    ),
  fileText: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
      h("polyline", { points: "14 2 14 8 20 8" }),
      h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
      h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
      h("polyline", { points: "10 9 9 9 8 9" })
    ),
  list: ({ h, width = 14, height = 14 }: any) =>
    h("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
      h("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
      h("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
      h("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
      h("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
      h("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
      h("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE LADDER & PALETA TONAL LINEAR (ANTI-AI SLOP)
// ─────────────────────────────────────────────────────────────────────────────
export const THEME = {
  canvas: "#0e0f12",          // Level 0: App Canvas neutro chumbo
  columnBg: "#15161a",        // Level 1: Recipiente sutil das colunas
  cardBg: "#1c1d23",          // Level 2: Superfície elevada dos cards
  cardHover: "#23252d",       // Level 2 hover
  hairline: "rgba(255, 255, 255, 0.06)",
  borderCard: "rgba(255, 255, 255, 0.08)",
  accentPrimary: "#10b981",   // Esmeralda limpo para botão primário de despacho
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (BUZZ WORKSPACE COCKPIT)
// ─────────────────────────────────────────────────────────────────────────────

