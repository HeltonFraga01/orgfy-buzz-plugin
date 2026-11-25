// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/styles/globals.css
// Isolamento CSS via Shadow DOM (attachShadow({ mode: "open" })) e mapeamento de tokens Buzz -> CodeDen.

export const FACTORY_SHADOW_CSS = `
:host, [data-orgfy-factory-root="true"] {
  --background: var(--surface-base, #0b0d10);
  --card: var(--surface-panel, #111419);
  --card-elevated: var(--surface-elevated, #161a21);
  --foreground: var(--text-standard, #f3f4f6);
  --muted-foreground: var(--text-tertiary, #9ca3af);
  --border: var(--border-standard, rgba(255, 255, 255, 0.09));
  --border-strong: rgba(255, 255, 255, 0.16);
  --primary: #f59e0b;
  --primary-soft: rgba(245, 158, 11, 0.14);
  --primary-foreground: #0b0d10;
  --success: #10b981;
  --success-soft: rgba(16, 185, 129, 0.14);
  --destructive: var(--surface-status-danger, #ef4444);
  --destructive-soft: rgba(239, 68, 68, 0.15);
  --info: #38bdf8;
  --info-soft: rgba(56, 189, 248, 0.14);
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
}

.of-shell {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
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
  padding: 14px 12px;
  background: var(--card);
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

.of-brand-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--foreground);
}

.of-tenant-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.of-tenant-select {
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--card-elevated);
  color: var(--foreground);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
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
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.of-nav-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--foreground);
}

.of-nav-btn[data-active="true"] {
  background: var(--primary-soft);
  border-color: rgba(245, 158, 11, 0.35);
  color: var(--primary);
  font-weight: 600;
}

.of-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 22px;
  gap: 16px;
  box-sizing: border-box;
}

.of-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-sizing: border-box;
}

.of-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.of-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  border: 1px solid var(--border);
  background: var(--card-elevated);
  color: var(--foreground);
}

.of-pill[data-tone="ok"] {
  background: var(--success-soft);
  border-color: rgba(16, 185, 129, 0.4);
  color: var(--success);
}

.of-pill[data-tone="warn"] {
  background: var(--primary-soft);
  border-color: rgba(245, 158, 11, 0.4);
  color: var(--primary);
}

.of-pill[data-tone="danger"] {
  background: var(--destructive-soft);
  border-color: rgba(239, 68, 68, 0.45);
  color: #f87171;
}

.of-pill[data-tone="muted"] {
  color: var(--muted-foreground);
}

.of-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-elevated);
  color: var(--foreground);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.of-btn:hover {
  border-color: var(--border-strong);
}

.of-btn[data-variant="primary"] {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}

.of-btn[data-variant="danger"] {
  background: var(--destructive-soft);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.of-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.of-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
}

.of-kpi-label {
  font-size: 11px;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.of-kpi-value {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-mono);
  margin-top: 4px;
}

.of-kpi-sub {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 4px;
}

.of-pipeline-flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.of-pipeline-entry {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 8px;
}

.of-pipeline-lanes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.of-lane {
  display: grid;
  grid-template-columns: 112px repeat(3, minmax(0, 1fr)) 130px;
  gap: 8px;
  align-items: stretch;
}

.of-lane-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-radius: 8px;
  border: 1px dashed var(--border-strong);
  color: var(--muted-foreground);
  background: rgba(255, 255, 255, 0.02);
  padding: 6px;
}

.of-node {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-elevated);
  min-height: 76px;
  box-sizing: border-box;
}

.of-node[data-empty="true"] {
  opacity: 0.62;
}

.of-node[data-alert="true"] {
  border-color: rgba(239, 68, 68, 0.55);
}

.of-node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.of-node-title {
  font-size: 12px;
  font-weight: 600;
}

.of-node-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted-foreground);
}

.of-help-btn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.of-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.of-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 10.5px;
  font-family: var(--font-mono);
  font-weight: 600;
  cursor: pointer;
}

.of-chip[data-alert="true"] {
  border-color: rgba(239, 68, 68, 0.55);
  background: var(--destructive-soft);
  color: #f87171;
}

.of-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.of-table th,
.of-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.of-table th {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-foreground);
}

.of-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.of-floor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}

.of-muted {
  color: var(--muted-foreground);
  font-size: 12px;
}

.of-mono {
  font-family: var(--font-mono);
}
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
