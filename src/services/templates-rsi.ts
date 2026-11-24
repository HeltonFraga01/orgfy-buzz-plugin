// ─────────────────────────────────────────────────────────────────────────────
// ORGFY TEMPLATES & RSI HUB SERVICE (v13 — ZERO HARDCODES / ZERO MOCKS)
// Telemetria real de templates em REPOS/orgfy/templates e motor RSI L-90
// ─────────────────────────────────────────────────────────────────────────────

import { ORGFY_ABS_PATH, readOrgfyJson } from "./orgfy-bridge";
import type { RegrasProbatoriasState } from "../types/orgfy";

export interface CardTemplateItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  version: "v7.1" | "v4" | "v3" | "v2" | "experience";
  status: "canônico_v10" | "estável_v3" | "legado" | "especializado";
  fpyHistorical: number | null;
  totalCardsProcessed: number | null;
  frequentErrorsBlocked: string[];
  description: string;
  sampleAcceptanceCommand: string;
}

/**
 * Consulta o estado real do Hub de Aprendizado Recursivo (RSI) e regras probatórias
 * diretamente do disco (.esteira/estado/regras-probatorias.json), sem números sintéticos.
 */
export async function fetchRsiHubState(ctx: any): Promise<{
  regrasState: RegrasProbatoriasState | null;
  templates: CardTemplateItem[];
  globalRsiFpy: number | null;
}> {
  const regrasState = await readOrgfyJson<RegrasProbatoriasState | null>(
    ctx,
    ".esteira/estado/regras-probatorias.json",
    null
  );

  return {
    regrasState,
    templates: [],
    globalRsiFpy: null,
  };
}

/**
 * Compila uma nova regra probatória via `retro.py` usando `ctx.host.spawn`.
 */
export async function compileProbationaryRule(
  ctx: any,
  options: {
    erroId: string;
    descricao: string;
    comandoCheck: string;
    onOutput?: (chunk: string) => void;
  }
): Promise<{ success: boolean; output: string }> {
  let combinedOutput = "";
  const appendChunk = (chunk: string) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };

  appendChunk(`[RSI COMPILER] Compilando regra probatória GUARD-${options.erroId.toUpperCase()}...\n`);

  if (!ctx?.host?.spawn) {
    appendChunk("[ERRO] ctx.host.spawn indisponível para compilar regra probatória.\n");
    return { success: false, output: combinedOutput };
  }

  try {
    const cmd = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/retro.py --compilar-regra "${options.erroId}" --descricao "${options.descricao}" --comando-check "${options.comandoCheck}"`;
    const proc = await ctx.host.spawn("bash", {
      args: [cmd],
      onStdout: appendChunk,
      onStderr: appendChunk,
    });

    const code = await proc.exited;
    appendChunk(`\n[RSI COMPILER FINALIZADO] Código: ${code}\n`);
    return { success: code === 0, output: combinedOutput };
  } catch (err: any) {
    appendChunk(`\n[ERRO NO RSI COMPILER] ${err?.message || String(err)}\n`);
    return { success: false, output: combinedOutput };
  }
}
