// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/index.css
// Design system oficial do CodeDen (slate frio + âmbar quente + status semânticos) isolado em Shadow DOM.

export const FACTORY_SHADOW_CSS = `
:host, [data-orgfy-factory-root="true"] {
  --background: var(--surface-base, oklch(0.165 0.008 264));
  --foreground: var(--text-standard, oklch(0.94 0.006 264));
  --card: var(--surface-panel, oklch(0.195 0.009 264));
  --surface: var(--surface-elevated, oklch(0.185 0.009 264));
  --panel: oklch(0.155 0.008 264);
  --sidebar: oklch(0.145 0.007 264);
  --muted: oklch(0.225 0.009 264);
  --muted-foreground: var(--text-tertiary, oklch(0.66 0.014 264));
  --accent: oklch(0.255 0.011 264);
  --border: var(--border-standard, rgba(255, 255, 255, 0.085));
  --border-strong: rgba(255, 255, 255, 0.16);
  --primary: oklch(0.8 0.15 70);
  --primary-soft: rgba(245, 158, 11, 0.12);
  --primary-foreground: oklch(0.21 0.04 60);

  --status-running: oklch(0.72 0.13 235);
  --status-waiting: oklch(0.8 0.15 75);
  --status-done: oklch(0.74 0.14 155);
  --status-failed: var(--surface-status-danger, oklch(0.68 0.19 24));
  --status-idle: oklch(0.55 0.012 264);

  --chart-1: oklch(0.8 0.15 70);
  --chart-2: oklch(0.7 0.12 230);
  --chart-3: oklch(0.72 0.14 155);
  --chart-4: oklch(0.7 0.15 300);
  --chart-5: oklch(0.7 0.17 25);

  --radius: 10px;
  --font-sans: inherit;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  display: block;
  width: 100%;
  height: 100%;
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-sans);
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

@keyframes of-rise {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

@keyframes of-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}

.of-shell {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  overflow: hidden;
  box-sizing: border-box;
}

.of-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 10px;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  box-sizing: border-box;
}

.of-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
}

.of-brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--foreground);
}

.of-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 800;
}

.of-tenant-select, .of-input, .of-textarea {
  width: 100%;
  padding: 6px 9px;
  border-radius: 7px;
  background: var(--surface);
  color: var(--foreground);
  border: 1px solid var(--border);
  font-size: 12px;
  font-family: inherit;
  box-sizing: border-box;
}

.of-textarea {
  font-family: var(--font-mono);
  min-height: 64px;
  resize: vertical;
}

.of-nav-group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground);
  padding: 8px 8px 2px;
}

.of-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.of-nav-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.of-nav-btn:hover {
  background: rgba(255, 255, 255, 0.045);
  color: var(--foreground);
}

.of-nav-btn[data-active="true"] {
  background: var(--accent);
  border-color: var(--border);
  color: var(--foreground);
  font-weight: 600;
}

.of-nav-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--muted-foreground);
}

.of-nav-badge[data-tone="warn"] {
  background: rgba(245, 158, 11, 0.16);
  color: var(--status-waiting);
}

.of-nav-badge[data-tone="danger"] {
  background: rgba(239, 68, 68, 0.18);
  color: var(--status-failed);
}

.of-workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.of-page-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}

.of-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 28px;
  gap: 14px;
  box-sizing: border-box;
}

.of-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.of-card-pad {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  box-sizing: border-box;
}

.of-surface {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  box-sizing: border-box;
}

.of-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.of-panel-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px;
}

.of-alert-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.08);
  font-size: 11.5px;
  color: var(--foreground);
}

.of-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--font-mono);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted-foreground);
  white-space: nowrap;
}

.of-pill[data-tone="running"] {
  background: rgba(56, 189, 248, 0.13);
  border-color: rgba(56, 189, 248, 0.35);
  color: var(--status-running);
}

.of-pill[data-tone="ok"], .of-pill[data-tone="done"] {
  background: rgba(16, 185, 129, 0.13);
  border-color: rgba(16, 185, 129, 0.35);
  color: var(--status-done);
}

.of-pill[data-tone="warn"], .of-pill[data-tone="waiting"] {
  background: rgba(245, 158, 11, 0.13);
  border-color: rgba(245, 158, 11, 0.38);
  color: var(--status-waiting);
}

.of-pill[data-tone="danger"], .of-pill[data-tone="failed"] {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.42);
  color: var(--status-failed);
}

.of-exp-badge {
  border-radius: 9999px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  color: var(--primary);
}

.of-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--foreground);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.of-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--accent);
}

.of-btn[data-variant="primary"] {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}

.of-btn[data-variant="danger"] {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.45);
  color: var(--status-failed);
}

.of-btn[data-variant="ghost"] {
  background: transparent;
  border-color: transparent;
  color: var(--muted-foreground);
}

.of-btn[data-variant="ghost"]:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--foreground);
}

.of-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.of-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.of-seg-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.of-seg-btn[data-active="true"] {
  background: var(--accent);
  color: var(--foreground);
}

/* ── CodeDen Progress Meters ── */
.of-meters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.of-meter {
  min-width: 145px;
  flex: 1 1 155px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 8px 12px;
}

.of-meter-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.of-meter-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
}

.of-meter-val {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.of-bar-track {
  margin-top: 6px;
  height: 4px;
  border-radius: 9999px;
  background: var(--muted);
  overflow: hidden;
}

.of-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.25s ease;
}

/* ── CodeDen Live Pipeline Diagram (pipeline-diagram.tsx) ── */
.of-pd-scroll {
  overflow-x: auto;
  padding: 4px 0 8px;
}

.of-pd-canvas {
  display: flex;
  align-items: stretch;
  gap: 4px;
  min-width: 900px;
}

.of-pd-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.of-pd-arrow {
  display: inline-flex;
  align-items: center;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.of-pd-arrow-line {
  width: 12px;
  height: 1px;
  background: rgba(156, 163, 175, 0.55);
}

.of-pd-arrow-line[data-dashed="true"] {
  background: transparent;
  border-top: 1px dashed rgba(156, 163, 175, 0.55);
}

.of-pd-fan {
  position: relative;
  display: grid;
  width: 24px;
  flex-shrink: 0;
  grid-template-rows: repeat(3, 1fr);
  align-self: stretch;
}

.of-pd-fan-spine {
  position: absolute;
  top: 16.6%;
  bottom: 16.6%;
  left: 50%;
  border-left: 1px solid rgba(156, 163, 175, 0.45);
}

.of-pd-fan-stem {
  position: absolute;
  top: 50%;
  height: 1px;
  width: 50%;
  background: rgba(156, 163, 175, 0.45);
}

.of-pd-lanes {
  display: grid;
  grid-template-rows: repeat(3, auto);
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.of-pd-lane {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 6px,
    rgba(255, 255, 255, 0.025) 6px,
    rgba(255, 255, 255, 0.025) 7px
  );
  padding: 20px 8px 10px;
}

.of-pd-lane-tag {
  position: absolute;
  top: 4px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.of-pd-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 68px;
  min-width: 0;
  flex: 1;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 14px 8px 8px;
  text-align: center;
  box-sizing: border-box;
}

.of-pd-node[data-active="true"] {
  border-color: rgba(245, 158, 11, 0.55);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.of-pd-badge {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 6px;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.of-pd-badge[data-kind="llm"] { color: var(--chart-4); border-color: rgba(192, 132, 252, 0.35); }
.of-pd-badge[data-kind="auto"] { color: var(--status-done); border-color: rgba(16, 185, 129, 0.35); }
.of-pd-badge[data-kind="checks"] { color: var(--status-running); border-color: rgba(56, 189, 248, 0.35); }

.of-pd-revise {
  position: absolute;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  border-radius: 9999px;
  border: 1px dashed var(--border-strong);
  background: var(--card);
  font-size: 9.5px;
  line-height: 16px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.of-pd-revise[data-active="true"] {
  border-color: rgba(245, 158, 11, 0.6);
  color: var(--status-waiting);
}

.of-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 15px;
  cursor: pointer;
}

.of-chip:hover {
  border-color: rgba(245, 158, 11, 0.6);
  background: rgba(245, 158, 11, 0.08);
}

.of-chip[data-queued="true"] {
  border-style: dashed;
  color: var(--muted-foreground);
}

.of-chip[data-alert="true"] {
  border-color: rgba(245, 158, 11, 0.55);
  color: var(--status-waiting);
}

.of-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.of-dot[data-tone="running"] { background: var(--status-running); animation: of-pulse 1.8s ease-in-out infinite; }
.of-dot[data-tone="waiting"] { background: var(--status-waiting); }
.of-dot[data-tone="done"] { background: var(--status-done); }
.of-dot[data-tone="failed"] { background: var(--status-failed); }
.of-dot[data-tone="idle"] { background: var(--status-idle); }

.of-help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 9.5px;
  cursor: pointer;
  padding: 0;
}

.of-help-pop {
  font-size: 11px;
  line-height: 1.4;
  color: var(--muted-foreground);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}

/* ── 3-column Factory Panel grid & Tables ── */
.of-grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.of-grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.of-stats-6 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.of-board-6 {
  display: grid;
  grid-template-columns: repeat(6, minmax(175px, 1fr));
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.of-stage-col {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.of-stage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
}

.of-view-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
  animation: of-rise 180ms ease both;
}

.of-view-card:hover {
  border-color: rgba(245, 158, 11, 0.55);
}

.of-view-card[data-state="person"] {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.05);
}

.of-view-card[data-state="failed"] {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.06);
}

.of-needs-you {
  border-radius: 11px;
  border: 1px solid rgba(245, 158, 11, 0.42);
  background: rgba(245, 158, 11, 0.05);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Factory Floor (Workshop + Lookout Blueprint) ── */
.of-floor-shell {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 12px;
  min-height: 440px;
}

.of-floor-hall {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background:
    radial-gradient(circle at 15% 10%, rgba(245, 158, 11, 0.06), transparent 45%),
    linear-gradient(180deg, oklch(0.18 0.009 264), oklch(0.15 0.008 264));
}

.of-floor-zones {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 8px;
  overflow-x: auto;
}

.of-zone-bay {
  border-radius: 9px;
  border: 1px dashed var(--border-strong);
  background: rgba(255, 255, 255, 0.02);
  padding: 8px;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.of-repair-bay {
  border-radius: 9px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background: repeating-linear-gradient(
    -45deg,
    rgba(245, 158, 11, 0.06),
    rgba(245, 158, 11, 0.06) 8px,
    transparent 8px,
    transparent 16px
  );
  padding: 10px 12px;
}

.of-lookout-pods {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  gap: 8px;
}

/* ── Slide-over ItemSheet Drawer ── */
.of-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: flex-end;
}

.of-sheet-panel {
  width: min(440px, 94vw);
  height: 100%;
  background: var(--card);
  border-left: 1px solid var(--border-strong);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 18px;
  gap: 14px;
  box-sizing: border-box;
}

.of-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.of-table th, .of-table td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
}

.of-table th {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
}

.of-muted { color: var(--muted-foreground); font-size: 11.5px; }
.of-mono { font-family: var(--font-mono); }
.of-num { font-variant-numeric: tabular-nums; }
`;

/**
 * Monta um container com Shadow DOM (open) e injeta FACTORY_SHADOW_CSS sem vazar
 * regras para o DOM global do Buzz Desktop.
 */
export function attachFactoryShadowStyles(hostEl: HTMLElement): ShadowRoot | null {
  if (!hostEl || typeof hostEl.attachShadow !== "function") return null;
  const shadow = hostEl.shadowRoot || hostEl.attachShadow({ mode: "open" });
  if (!shadow.querySelector("style[data-orgfy-factory-css]")) {
    const styleEl = hostEl.ownerDocument.createElement("style");
    styleEl.setAttribute("data-orgfy-factory-css", "true");
    styleEl.textContent = FACTORY_SHADOW_CSS;
    shadow.appendChild(styleEl);
  }
  if (!shadow.querySelector("slot")) {
    const slotEl = hostEl.ownerDocument.createElement("slot");
    shadow.appendChild(slotEl);
  }
  return shadow;
}
