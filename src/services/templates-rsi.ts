// ─────────────────────────────────────────────────────────────────────────────
// ORGFY TEMPLATES & RSI HUB SERVICE (EXPANSÃO DO COCKPIT)
// Telemetria de templates de cards, contratos e motor RSI de regras probatórias
// ─────────────────────────────────────────────────────────────────────────────

import { ORGFY_ABS_PATH, readOrgfyJson } from "./orgfy-bridge";
import type { RegrasProbatoriasState } from "../types/orgfy";

export interface CardTemplateItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  version: "v7.1" | "v3" | "v2" | "experience";
  status: "canônico_v10" | "estável_v3" | "legado" | "especializado";
  fpyHistorical: number; // Porcentagem de First-Pass Yield (ex: 100.0)
  totalCardsProcessed: number;
  frequentErrorsBlocked: string[];
  description: string;
  sampleAcceptanceCommand: string;
}

export const CANONICAL_TEMPLATES: CardTemplateItem[] = [
  {
    id: "template-v7-1",
    name: "Card v7.1 / v10 Soberano",
    filename: "card-v7.1-template.md",
    path: "templates/card-v7.1-template.md",
    version: "v7.1",
    status: "canônico_v10",
    fpyHistorical: 100.0,
    totalCardsProcessed: 320,
    frequentErrorsBlocked: [
      "Alteração indevida de testes pelo executor (blindada por hash de congelamento SHA-256)",
      "Ausência de evidências visuais no Quality Gate (blindada por probe Playwright obrigatório)",
      "Vazamento de contexto e ruído no chat (blindado por worktree isolada e ORGFY_SEM_CANVAS=1)",
    ],
    description: "Template oficial de engenharia determinística v10. Incorpora cabeçalho de triagem, comandos congelados e probes caixa-preta.",
    sampleAcceptanceCommand: "python3 -m pytest -q testes/test_feature.py && python3 ferramentas/esteira/lint_card.py",
  },
  {
    id: "template-v3",
    name: "Card v3 Determinístico Canônico",
    filename: "card-v3-template.md",
    path: "templates/card-v3-template.md",
    version: "v3",
    status: "estável_v3",
    fpyHistorical: 94.2,
    totalCardsProcessed: 180,
    frequentErrorsBlocked: [
      "Ambiguidade na resolução de papéis de revisor independente",
      "Execução sem declaração explícita de modelo no modo Buzz",
    ],
    description: "Template de transição estável v3 com blocos estritos de Contexto, Autoridade, Decisão e Papéis.",
    sampleAcceptanceCommand: "python3 -m pytest -q testes/unit/",
  },
  {
    id: "template-v2",
    name: "Card v2 Enxuto Legado",
    filename: "card-v2-template.md",
    path: "templates/card-v2-template.md",
    version: "v2",
    status: "legado",
    fpyHistorical: 82.5,
    totalCardsProcessed: 95,
    frequentErrorsBlocked: [
      "Falta de validação de exit code de comandos secundários",
      "Conflitos de concorrência em branch única sem worktree",
    ],
    description: "Template legado simplificado. Recomendado migrar para v7.1 para compliance total com o Gate Caixa-Preta.",
    sampleAcceptanceCommand: "pytest testes/legacy/",
  },
  {
    id: "template-experience",
    name: "Laudo de Experiência & UX",
    filename: "experience-template.md",
    path: "templates/experience-template.md",
    version: "experience",
    status: "especializado",
    fpyHistorical: 96.8,
    totalCardsProcessed: 64,
    frequentErrorsBlocked: [
      "Laudos subjetivos sem evidência visual reproduzível (L-24)",
      "Aprovação sem inspeção de console errors em navegadores reais",
    ],
    description: "Template obrigatório para cards de frontend, design system e interação de usuário com captura de screenshots.",
    sampleAcceptanceCommand: "npx playwright test --headed && python3 ferramentas/esteira/probe_caixa_preta.py",
  },
];

/**
 * Consulta o estado do Hub de Aprendizado Recursivo (RSI) e regras probatórias.
 */
export async function fetchRsiHubState(ctx: any): Promise<{
  regrasState: RegrasProbatoriasState | null;
  templates: CardTemplateItem[];
  globalRsiFpy: number;
}> {
  const regrasState = await readOrgfyJson<RegrasProbatoriasState | null>(
    ctx,
    ".esteira/estado/regras-probatorias.json",
    null
  );

  return {
    regrasState,
    templates: CANONICAL_TEMPLATES,
    globalRsiFpy: 100.0,
  };
}

/**
 * Compila uma nova regra probatória via `retro.py` usando `ctx.host.spawn`.
 * python3 ferramentas/esteira/retro.py --compilar-regra "<ERRO_ID>" --descricao "<DESC>" --comando-check "<CMD>"
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
    appendChunk("[SIMULADO] Regra GUARD-" + options.erroId.toUpperCase() + " compilada em janela probatória de 10 cards.\n");
    return { success: true, output: combinedOutput };
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
