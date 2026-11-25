/**
 * Configuração centralizada de caminhos do OrgFy Control Room / Factory (R4.2 / Fase 2).
 * Resolve todos os caminhos dinamicamente a partir de `$HOME` (zero caminhos fixos de usuário).
 */

function resolveHomeDir(): string {
  try {
    const env = (globalThis as any)?.process?.env;
    if (env?.ORGFY_HOME && String(env.ORGFY_HOME).trim()) {
      return String(env.ORGFY_HOME).trim().replace(/\/+$/, "");
    }
    if (env?.HOME && String(env.HOME).trim()) {
      return String(env.HOME).trim().replace(/\/+$/, "");
    }
  } catch {
    // Ambiente browser sem process.env
  }
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("orgfy_home_dir") : null;
    if (stored && stored.trim()) return stored.trim().replace(/\/+$/, "");
  } catch {
    // Ignore
  }
  return "~";
}

export function getHomeDir(): string {
  return resolveHomeDir();
}

export function joinHome(...parts: string[]): string {
  const base = resolveHomeDir();
  const clean = parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean);
  return [base, ...clean].join("/");
}

export const BUZZ_ROOT = joinHome(".buzz");
export const SCRATCH_ROOT = joinHome(".buzz", ".scratch");
export const ORGFY_REPO_ROOT = joinHome(".buzz", "REPOS", "orgfy");
export const ORGFY_PLUGIN_ROOT = joinHome(".buzz", "REPOS", "orgfy-buzz-plugin");
export const ORGFY_ESTADO_DIR = joinHome(".buzz", "REPOS", "orgfy", ".esteira", "estado");
export const ORGFY_EMPRESAS_DIR = joinHome(".buzz", "REPOS", "orgfy", "empresas");
export const ORGFY_CARDS_DIR = joinHome(".buzz", "REPOS", "orgfy", "cards");
export const ORGFY_VAULT_ENV_PATH = joinHome(".buzz", "vault-forense", "sentinela-esteira.env");

export const KPI_SNAPSHOT_PATH = joinHome(".buzz", ".scratch", "kpis-esteira.json");
export const KPI_SCRIPT_PATH = joinHome(".buzz", "REPOS", "orgfy", "ferramentas", "esteira", "gerar_kpis_esteira.py");
export const GOOSE_LOOP_RADAR_SCRIPT_PATH = joinHome(".buzz", "REPOS", "orgfy-buzz-plugin", "scripts", "goose_loop_radar.py");
export const GOOSE_LOOP_RADAR_SNAPSHOT_PATH = joinHome(".buzz", ".scratch", "goose-loop-radar.json");
export const FABRICA_STATUS_SCRIPT_PATH = joinHome(".buzz", "REPOS", "orgfy", "ferramentas", "esteira", "fabrica_status.py");

export function getControlePath(tenant: string): string {
  const slug = (tenant || "orgfy").trim().toLowerCase() || "orgfy";
  return joinHome(".buzz", "REPOS", "orgfy", ".esteira", "estado", `controle-${slug}.json`);
}

export function compactHomeDisplay(rawPath: string): string {
  const home = resolveHomeDir();
  if (home && home !== "~" && rawPath.startsWith(home + "/")) {
    return "~/" + rawPath.slice(home.length + 1);
  }
  return rawPath.replace(/^\/Users\/[^/]+\//, "~/");
}
