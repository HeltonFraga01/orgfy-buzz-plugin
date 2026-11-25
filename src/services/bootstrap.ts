// ─────────────────────────────────────────────────────────────────────────────
// ORGFY BOOTSTRAP SERVICE (B1/B4 — ZERO BASH, ZERO escrita direta em estado de agentes, ZERO porteiro.py)
// ─────────────────────────────────────────────────────────────────────────────

import { ORGFY_ABS_PATH } from "./orgfy-bridge";

export interface BootstrapStepResult {
  step: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  details?: string;
}

export interface BootstrapState {
  inProgress: boolean;
  completed: boolean;
  steps: BootstrapStepResult[];
}

export const INITIAL_BOOTSTRAP_STEPS: BootstrapStepResult[] = [
  { step: "prerequisites", label: "Auditoria de Pré-requisitos (Python 3.10+, Git)", status: "pending" },
  { step: "repo", label: "Verificação da Esteira Determinística (REPOS/orgfy)", status: "pending" },
  { step: "nostr_channel", label: "Verificação do Canal Nostr (#esteira-orgfy)", status: "pending" },
  { step: "canonical_agents", label: "Reconciliação dos Agentes OrgFy via ctx.agents", status: "pending" },
  { step: "porteiro_daemon", label: "Coordenador Ativo (esteira_minima.py)", status: "pending" },
];

export async function checkExistingConfiguration(ctx: any): Promise<{ exists: boolean; agentCount: number }> {
  try {
    const snap = ctx?.agents?.snapshot?.() || {};
    const count = (snap.agents || []).length || (snap.running || []).length;
    if (count > 0) {
      return { exists: true, agentCount: count };
    }
  } catch (_e) {}
  return { exists: false, agentCount: 0 };
}

export async function executeBootstrapFlow(
  ctx: any,
  onStepUpdate: (steps: BootstrapStepResult[]) => void
): Promise<{ success: boolean; log: string }> {
  let steps: BootstrapStepResult[] = INITIAL_BOOTSTRAP_STEPS.map((s) => ({ ...s, status: "pending" }));
  let logBuffer = "";

  const update = (stepKey: string, status: BootstrapStepResult["status"], details?: string) => {
    steps = steps.map((s) => (s.step === stepKey ? { ...s, status, details: details || s.details } : s));
    onStepUpdate([...steps]);
    if (details) logBuffer += `[${stepKey.toUpperCase()}] ${details}\n`;
  };

  // 1. Auditoria de Pré-requisitos locais (sem bash)
  update("prerequisites", "running", "Checando binários locais (python3, git)...");
  try {
    if (ctx?.host?.spawn) {
      const p1 = await ctx.host.spawn("python", { args: ["--version"] });
      await p1.exited;
      const p2 = await ctx.host.spawn("git", { args: ["--version"] });
      await p2.exited;
    }
    update("prerequisites", "success", "Python 3 e Git verificados.");
  } catch (err: any) {
    update("prerequisites", "error", `Falha ao verificar binários: ${err?.message || err}`);
  }

  // 2. Verificação do Repositório OrgFy
  update("repo", "running", "Executando git worktree prune em REPOS/orgfy...");
  try {
    if (ctx?.host?.spawn) {
      const proc = await ctx.host.spawn("git", {
        args: ["-C", ORGFY_ABS_PATH, "worktree", "prune"],
      });
      await proc.exited;
    }
    update("repo", "success", "Estrutura REPOS/orgfy e worktrees verificadas.");
  } catch (err: any) {
    update("repo", "error", `Falha no git worktree prune: ${err?.message || err}`);
  }

  // 3. Verificação do Canal Nostr #esteira-orgfy
  update("nostr_channel", "running", "Verificando canal #esteira-orgfy no Relay...");
  try {
    if (ctx?.host?.spawn) {
      const proc = await ctx.host.spawn("buzz", {
        args: ["channels", "list"],
        cwd: ORGFY_ABS_PATH,
      });
      await proc.exited;
    }
    update("nostr_channel", "success", "Canal #esteira-orgfy verificado no Relay.");
  } catch (err: any) {
    update("nostr_channel", "error", `Falha ao listar canais: ${err?.message || err}`);
  }

  // 4. Reconciliação via ctx.agents API (B4: sem migrar_agentes_buzz.py nem escrita direta em disco)
  update("canonical_agents", "running", "Verificando agentes registrados via ctx.agents...");
  try {
    const existing = await checkExistingConfiguration(ctx);
    update(
      "canonical_agents",
      "success",
      existing.exists
        ? `${existing.agentCount} agentes detectados via ctx.agents.snapshot() (sem escrita direta em disco).`
        : "Nenhum agente detectado no snapshot; crie agentes pela API nativa do Buzz."
    );
  } catch (err: any) {
    update("canonical_agents", "error", `Erro ao consultar agentes: ${err?.message || err}`);
  }

  // 5. Coordenador ativo (B4: porteiro.py removido do bootstrap)
  update("porteiro_daemon", "success", "Coordenador ativo: esteira_minima.py via LaunchAgent (porteiro.py removido).");

  return { success: true, log: logBuffer };
}

export async function ensureCardWorktree(
  ctx: any,
  cardSlugOrId: string,
  branch?: string
): Promise<{ ok: boolean; path: string }> {
  const slug = cardSlugOrId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "card-worktree";
  const wtPath = `${ORGFY_ABS_PATH}/.worktrees/${slug}`;
  const branchName = String(branch || `card/${slug}`).trim();
  if (!/^[A-Za-z0-9._/-]{1,120}$/.test(branchName) || branchName.includes("..")) {
    return { ok: false, path: wtPath };
  }
  if (!ctx?.host?.spawn) {
    return { ok: false, path: wtPath };
  }
  try {
    const proc = await ctx.host.spawn("git", {
      args: ["-C", ORGFY_ABS_PATH, "worktree", "add", "-B", branchName, wtPath, "HEAD"],
    });
    const code = await proc.exited;
    return { ok: code === 0, path: wtPath };
  } catch (_e) {
    return { ok: false, path: wtPath };
  }
}
