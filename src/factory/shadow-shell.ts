// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/index.css
// Design system oficial do CodeDen (slate frio + âmbar quente + status semânticos) isolado em Shadow DOM.

export const FACTORY_SHADOW_CSS = `
:host, [data-orgfy-factory-root="true"] {
  /* Cores 100% nativas do Buzz Desktop (herda modo light/dark e acento personalizado: bee, citrus, cobalt, iris, magenta, mono) */
  --background: var(--bg-app, var(--surface-base, #101010));
  --foreground: var(--text-primary, var(--text-standard, #f3f4f6));
  --card: var(--bg-panel, var(--surface-panel, #18181b));
  --surface: var(--affordance-subtle, var(--surface-inset, #202024));
  --bg-inset: var(--surface-inset, var(--surface-inset-subtle, var(--surface)));
  --panel: var(--bg-panel, var(--surface-panel, #161619));
  --sidebar: var(--bg-app, var(--surface-base, #121215));
  --muted: var(--affordance-subtle, #232327);
  --muted-foreground: var(--text-tertiary, var(--text-metadata, var(--text-subtle, #9ca3af)));
  --accent: var(--affordance-selected, var(--affordance-subtle-hover, #2c2c32));
  --border: var(--border-primary, var(--border-standard, rgba(255, 255, 255, 0.09)));
  --border-strong: var(--border-prominent, var(--border-control, var(--border-primary, rgba(255, 255, 255, 0.16))));
  --primary: var(--affordance-accent-prominent, var(--accent-9, var(--green-11, #3dd68c)));
  --primary-hover: var(--affordance-accent-prominent-hover, var(--accent-10, var(--primary)));
  --primary-pressed: var(--affordance-accent-prominent-pressed, var(--accent-pressed, var(--primary)));
  --primary-soft: var(--accent-3, color-mix(in srgb, var(--primary) 14%, transparent));
  --primary-border: var(--accent-7, color-mix(in srgb, var(--primary) 42%, transparent));
  --primary-text: var(--accent-link, var(--accent-11, var(--primary)));
  --primary-foreground: var(--text-on-accent, var(--accent-contrast, var(--text-on-prominent, #08120c)));

  --status-running: var(--blue-11, #60a5fa);
  --status-waiting: var(--amber-11, #fbbf24);
  --status-done: var(--green-11, #3dd68c);
  --status-failed: var(--red-11, var(--surface-status-danger, #f87171));
  --status-idle: var(--text-tertiary, #71717a);
  --diff-add: var(--green-11, #3dd68c);
  --diff-del: var(--red-11, #f87171);

  --chart-1: var(--primary);
  --chart-2: var(--chart-series-1, var(--blue-11, #60a5fa));
  --chart-3: var(--chart-series-3, var(--green-11, #3dd68c));
  --chart-4: var(--chart-series-4, var(--purple-11, #c084fc));
  --chart-5: var(--red-11, #f87171);

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

:host button, :host input, :host select, :host textarea,
[data-orgfy-factory-root="true"] button,
[data-orgfy-factory-root="true"] input,
[data-orgfy-factory-root="true"] select,
[data-orgfy-factory-root="true"] textarea {
  font-family: inherit;
  font-size: inherit;
}

@keyframes of-rise {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

@keyframes of-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}

@keyframes of-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.of-spin {
  animation: of-spin 0.8s linear infinite;
}

.of-icon-circle-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--muted-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
}

.of-icon-circle-btn:hover {
  background: var(--muted);
  color: var(--foreground);
  border-color: var(--border-strong);
}

.of-icon-circle-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.of-shell {
  display: grid;
  grid-template-columns: 244px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--background);
  color: var(--foreground);
  overflow: hidden;
  box-sizing: border-box;
  transition: grid-template-columns 0.14s ease;
}

.of-shell[data-collapsed="true"] {
  grid-template-columns: 54px minmax(0, 1fr);
}

.of-shell[data-density="compact"] .of-nav-btn,
.of-shell[data-density="compact"] .of-sb-child-btn {
  padding-top: 4px;
  padding-bottom: 4px;
  font-size: 11.5px;
}

.of-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 10px 0;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  overflow: hidden;
  box-sizing: border-box;
  min-height: 0;
}

.of-sidebar-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 0;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  overflow: hidden;
  box-sizing: border-box;
  min-height: 0;
}

.of-rail-head {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  margin-bottom: 4px;
}

.of-rail-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.of-rail-divider {
  width: 24px;
  height: 1px;
  background: var(--border);
  margin: 8px 0;
  flex-shrink: 0;
}

.of-rail-projects {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  padding-bottom: 6px;
}

.of-rail-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.of-rail-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--foreground);
}

.of-rail-btn[data-active="true"] {
  background: var(--accent);
  border-color: var(--border);
  color: var(--foreground);
}

.of-rail-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 9999px;
  background: var(--status-waiting);
  color: #0b0d10;
  font-size: 9px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.of-rail-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: var(--status-waiting);
  box-shadow: 0 0 0 2px var(--sidebar);
}

.of-rail-dot[data-tone="running"] {
  background: var(--status-running);
}

.of-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.of-icon-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--foreground);
}

.of-sb-search {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 31px;
  width: 100%;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.25);
  color: var(--muted-foreground);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
  box-sizing: border-box;
}

.of-sb-search:hover {
  border-color: var(--border-strong);
  color: var(--foreground);
}

.of-kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted-foreground);
}

.of-sb-bot-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: var(--primary-soft);
  color: var(--primary);
}

.of-sb-waiting {
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.22);
  background: rgba(245, 158, 11, 0.05);
  padding: 6px 6px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.of-sb-waiting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 3px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--status-waiting);
}

.of-sb-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 8px;
}

.of-sb-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 2px 6px;
}

.of-sb-project {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.of-sb-project-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  border-radius: 7px;
  color: var(--muted-foreground);
  transition: background 0.12s ease, color 0.12s ease;
}

.of-sb-project-head:hover {
  background: rgba(255, 255, 255, 0.045);
  color: var(--foreground);
}

.of-sb-project-head[data-active="true"] {
  color: var(--foreground);
}

.of-sb-project-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 3px 2px;
  text-align: left;
}

.of-sb-chevron {
  display: inline-flex;
  color: var(--muted-foreground);
  transition: transform 0.14s ease;
}

.of-sb-chevron[data-open="true"] {
  transform: rotate(90deg);
}

.of-sb-project-actions {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.of-sb-project-head:hover .of-sb-project-actions,
.of-sb-project-head:focus-within .of-sb-project-actions {
  opacity: 1;
}

.of-sb-tree {
  margin-left: 11px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 4px;
}

.of-sb-child-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 7px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.of-sb-child-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--foreground);
}

.of-sb-pm-pill {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 9999px;
  background: var(--primary-soft);
  color: var(--primary);
}

.of-sb-age {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted-foreground);
  opacity: 0.75;
  flex-shrink: 0;
}

.of-sb-footer {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-top: 1px solid var(--border);
  margin: 0 -10px;
  padding-left: 10px;
  padding-right: 8px;
  flex-shrink: 0;
}

.of-sb-footer[data-compact="true"] {
  flex-direction: column;
  margin: 0;
  padding: 8px 0;
  width: 100%;
}

.of-sb-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--muted-foreground);
}

.of-palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9500;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

.of-palette-box {
  width: min(520px, 92vw);
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--card);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.of-palette-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
}

.of-palette-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 13px;
  outline: none;
}

.of-palette-list {
  max-height: 340px;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.of-palette-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 12.5px;
  cursor: pointer;
}

.of-palette-row:hover {
  background: var(--accent);
}

.of-palette-group {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
  min-width: 78px;
  text-align: left;
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

.of-project-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.of-project-tabs {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  padding: 0 18px;
  height: 38px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
  overflow-x: auto;
}

.of-project-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 4px;
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s ease, border-color 0.12s ease;
}

.of-project-tab:hover {
  color: var(--foreground);
  background: transparent !important;
}

.of-project-tab[data-active="true"] {
  color: var(--foreground);
  font-weight: 600;
  border-bottom-color: var(--primary);
  border-radius: 0 !important;
  background: transparent !important;
}

.of-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 18px 22px 36px;
  gap: 16px;
  box-sizing: border-box;
}

.of-overview-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 100%;
  margin: 0;
  flex-shrink: 0;
  box-sizing: border-box;
}

.of-section-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.of-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.of-section-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.of-now-next {
  display: grid;
  grid-template-columns: minmax(0, 1.85fr) minmax(320px, 430px);
  gap: 16px;
  align-items: start;
  flex-shrink: 0;
}

@media (max-width: 980px) {
  .of-now-next {
    grid-template-columns: minmax(0, 1fr);
  }
}

.of-now-empty {
  border-radius: 11px;
  border: 1px dashed var(--border);
  background: color-mix(in srgb, var(--card) 55%, transparent);
  padding: 22px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--muted-foreground);
}

.of-now-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding: 2px;
  box-sizing: border-box;
}

.of-now-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-width: 0;
  max-width: none;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 9px 11px;
  text-align: left;
  color: var(--foreground);
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease;
}

.of-now-card:hover {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background: var(--surface);
}

.of-next-list {
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.of-next-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.of-next-row:hover {
  background: var(--surface);
}

.of-list-card {
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card);
  overflow: hidden;
  flex-shrink: 0;
}

.of-list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.of-list-row:last-child {
  border-bottom: none;
}

.of-list-row:hover {
  background: var(--surface);
}

.of-spend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(110px, 160px));
  gap: 18px;
  margin-top: 10px;
}

.of-header-icon-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--surface) 75%, transparent);
  border: 1px solid var(--border);
  margin-left: 6px;
}

.of-header-icon-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  min-width: 30px;
  padding: 0 7px !important;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  line-height: 1;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.of-header-icon-tab:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--foreground);
}

.of-header-icon-tab[data-active="true"] {
  background: var(--accent);
  border-color: var(--border-strong);
  color: var(--primary);
}

.of-apple-chat-bar {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.of-apple-select {
  appearance: none;
  -webkit-appearance: none;
  height: 30px;
  max-width: 210px;
  padding: 0 26px 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 15 5 5 5-5'/%3E%3Cpath d='m7 9 5-5 5 5'/%3E%3C/svg%3E") no-repeat right 8px center;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.of-apple-select:hover, .of-apple-select:focus {
  border-color: var(--border-strong);
  outline: none;
}

.of-apple-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0 !important;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--foreground);
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease, color 0.12s ease;
}

.of-apple-icon-btn svg {
  width: 15px;
  height: 15px;
  display: block;
  flex-shrink: 0;
}

.of-apple-icon-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
  background: var(--primary-soft);
  color: var(--primary);
}

.of-apple-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.of-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-sizing: border-box;
}

.of-card-pad {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.of-surface {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  flex-shrink: 0;
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
  border: 1px solid var(--primary-border);
  background: var(--primary-soft);
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  color: var(--primary-text);
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

.of-btn[data-variant="primary"]:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: var(--primary-foreground);
}

.of-btn[data-variant="primary"]:active:not(:disabled) {
  background: var(--primary-pressed);
  border-color: var(--primary-pressed);
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
  overflow-y: visible;
  padding: 6px 2px 12px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.of-pd-canvas {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  min-width: max-content;
  box-sizing: border-box;
}

.of-pd-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.of-pd-arrow {
  display: inline-flex;
  align-items: center;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.of-pd-arrow-line {
  width: 14px;
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
  width: 26px;
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
  gap: 12px;
  flex: 1 0 430px;
  min-width: 430px;
}

.of-pd-lane {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: max-content;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 6px,
    rgba(255, 255, 255, 0.025) 6px,
    rgba(255, 255, 255, 0.025) 7px
  );
  padding: 28px 10px 14px;
  box-sizing: border-box;
}

.of-pd-lane-tag {
  position: absolute;
  top: 6px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.of-pd-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 76px;
  min-width: 118px;
  flex: 1 0 118px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 16px 10px 12px;
  text-align: center;
  box-sizing: border-box;
}

.of-pd-node[data-active="true"] {
  border-color: var(--primary-border);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.of-pd-node[data-stalled="true"] {
  border-color: color-mix(in srgb, var(--status-waiting) 58%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-waiting) 14%, transparent);
}

.of-pd-node[data-waiting="true"] {
  border-color: var(--border-strong);
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
  border-color: var(--primary-border);
  background: var(--primary-soft);
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
  border-color: var(--primary-border);
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
    radial-gradient(circle at 15% 10%, var(--primary-soft), transparent 45%),
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
.of-spend-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }

/* ── v18.9: Canvas / Visão Executive Workspace & Configurações Fluidas ── */
.of-vision-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.of-vision-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 13px;
  border: 1px solid var(--primary-border);
  background:
    radial-gradient(circle at 0% 0%, var(--primary-soft), transparent 52%),
    var(--card);
  box-sizing: border-box;
}

.of-vision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(340px, 0.95fr);
  gap: 16px;
  align-items: start;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 1080px) {
  .of-vision-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.of-vision-aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  position: sticky;
  top: 0;
}

.of-toc-link {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.of-toc-link:hover {
  background: var(--surface);
  color: var(--foreground);
}

.of-settings-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.of-settings-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  width: 100%;
}

.of-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
  gap: 16px;
  align-items: start;
  width: 100%;
}

@media (max-width: 980px) {
  .of-settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.of-preset-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
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
