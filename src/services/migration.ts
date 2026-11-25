// ─────────────────────────────────────────────────────────────────────────────
// ORGFY AGENT & WORKSPACE MIGRATION SERVICE (B1/B4 — SOMENTE ctx.agents API)
// ─────────────────────────────────────────────────────────────────────────────

import { ORGFY_ABS_PATH } from "./orgfy-bridge";

export interface AgentMigrationItem {
  name: string;
  pubkey: string;
  workspace: string;
  isMigrated: boolean;
  hasV10Prompt: boolean;
  tier: string;
  role: string;
}

export interface MigrationSummary {
  total: number;
  migratedCount: number;
  pendingCount: number;
  agents: AgentMigrationItem[];
}

export async function fetchMigrationStatus(ctx: any): Promise<MigrationSummary> {
  try {
    const snap = ctx?.agents?.snapshot?.() || {};
    const pool: any[] = [...(snap.running || []), ...(snap.agents || [])];
    const seen = new Set<string>();
    const agents: AgentMigrationItem[] = [];
    let migratedCount = 0;

    for (const a of pool) {
      const name = String(a?.name || a?.key || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const ws = String(a?.config?.workspace || a?.config?.cwd || ORGFY_ABS_PATH);
      const isMigrated = ws.includes("REPOS/orgfy");
      if (isMigrated) migratedCount++;
      agents.push({
        name,
        pubkey: String(a?.pubkey || "").slice(0, 8),
        workspace: ws,
        isMigrated,
        hasV10Prompt: true,
        tier: "tier_1_exec_barato",
        role: "Agente Buzz",
      });
    }

    return {
      total: agents.length,
      migratedCount,
      pendingCount: agents.length - migratedCount,
      agents,
    };
  } catch (_err) {
    return { total: 0, migratedCount: 0, pendingCount: 0, agents: [] };
  }
}

export async function executeAgentMigration(
  ctx: any,
  onOutput?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  let combinedOutput = "";
  const appendChunk = (c: string) => {
    combinedOutput += c;
    if (onOutput) onOutput(c);
  };

  appendChunk("[MIGRATION] Sincronizando agentes OrgFy via ctx.agents.save() (B4)...\n");

  if (typeof ctx?.agents?.save !== "function") {
    appendChunk("[ERRO] ctx.agents.save indisponível; escrita direta em agents/state desativada.\n");
    return { success: false, output: combinedOutput };
  }

  try {
    const snap = ctx?.agents?.snapshot?.() || {};
    const pool: any[] = [...(snap.running || []), ...(snap.agents || [])];
    let updated = 0;
    for (const a of pool) {
      if (!a?.key) continue;
      const cfg = {
        ...(a.config && typeof a.config === "object" ? a.config : {}),
        workspace: ORGFY_ABS_PATH,
      };
      await ctx.agents.save(a.key, { config: cfg });
      updated++;
    }
    appendChunk(`\n[MIGRATION CONCLUÍDA] ${updated} agente(s) sincronizado(s) via ctx.agents.save.\n`);
    return { success: true, output: combinedOutput };
  } catch (err: any) {
    appendChunk(`\n[ERRO CRÍTICO] Falha ao sincronizar agentes: ${err?.message || err}\n`);
    return { success: false, output: combinedOutput };
  }
}
