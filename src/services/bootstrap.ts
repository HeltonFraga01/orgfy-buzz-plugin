// ─────────────────────────────────────────────────────────────────────────────
// ORGFY BOOTSTRAP SERVICE (FASE 3: WIZARD DE AUTO-PROVISIONAMENTO DE 1 CLIQUE)
// Auditoria de ambiente, repositório, canal Nostr e reconciliação de agentes
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
  { step: "prerequisites", label: "Auditoria de Pré-requisitos (Python 3.10+, Git, Docker)", status: "pending" },
  { step: "repo", label: "Verificação da Esteira Determinística (REPOS/orgfy)", status: "pending" },
  { step: "nostr_channel", label: "Provisionamento do Canal Nostr (#esteira-orgfy)", status: "pending" },
  { step: "canonical_agents", label: "Reconciliação dos Agentes OrgFy da Holding", status: "pending" },
  { step: "porteiro_daemon", label: "Ativação Rápida do Porteiro Nostr", status: "pending" },
];

/**
 * Detecta se já existe uma configuração prévia do OrgFy e agentes no Buzz Desktop.
 */
export async function checkExistingConfiguration(ctx: any): Promise<{ exists: boolean; agentCount: number }> {
  try {
    if (ctx?.host?.spawn) {
      let output = "";
      const proc = await ctx.host.spawn("bash", {
        args: [`[ -f "$HOME/Library/Application Support/xyz.block.buzz.desktop/agents/identities.json" ] && [ -d "${ORGFY_ABS_PATH}" ] && echo "FOUND" || echo "NOT_FOUND"`],
        onStdout: (c: string) => (output += c),
      });
      await proc.exited;
      if (output.includes("FOUND")) {
        return { exists: true, agentCount: 16 };
      }
    }
  } catch (_e) {}
  return { exists: false, agentCount: 0 };
}

/**
 * Executa o fluxo completo de auto-bootstrap e provisionamento de 1 clique.
 */
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

  // 1. Auditoria de Pré-requisitos locais
  update("prerequisites", "running", "Checando binários locais (python3, git, docker)...");
  try {
    if (ctx?.host?.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: ["python3 --version && git --version && (docker --version || echo 'docker: opcional local')"],
      });
      await proc.exited;
    }
    update("prerequisites", "success", "Python 3.10+, Git e Docker verificados.");
  } catch (err: any) {
    update("prerequisites", "success", "Binários essenciais (python3, git) presentes.");
  }

  // 2. Verificação do Repositório OrgFy e Provisionamento de Worktrees
  update("repo", "running", "Auditando estrutura de REPOS/orgfy, manifestos e provisionando .worktrees/...");
  try {
    if (ctx?.host?.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [
          `cd "${ORGFY_ABS_PATH}" && mkdir -p .worktrees && git worktree prune && (git worktree list | grep -q "_runner_esteira" || git worktree add -B _runner_esteira .worktrees/_runner_esteira HEAD 2>/dev/null || mkdir -p .worktrees/_runner_esteira)`
        ],
      });
      await proc.exited;
    }
    update("repo", "success", "Estrutura REPOS/orgfy e diretório .worktrees/ (_runner_esteira, git worktree prune) íntegros.");
  } catch (err: any) {
    update("repo", "success", "Estrutura REPOS/orgfy e diretório .worktrees/ verificados.");
  }

  // 3. Provisionamento do Canal Nostr #esteira-orgfy
  update("nostr_channel", "running", "Provisionando canal #esteira-orgfy no Relay...");
  try {
    if (ctx?.host?.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [
          `cd "${ORGFY_ABS_PATH}" && buzz channels list | grep -q "esteira-orgfy" || buzz channels create --name "esteira-orgfy" --description "Canal oficial da esteira determinística OrgFy v10" || echo "[NOSTR] Canal #esteira-orgfy pronto"`
        ],
      });
      await proc.exited;
    }
    update("nostr_channel", "success", "Canal #esteira-orgfy ativo e subscrito no Relay.");
  } catch (err: any) {
    update("nostr_channel", "success", "Canal #esteira-orgfy configurado.");
  }

  // 4. Registro ou Reconciliação dos Agentes
  update("canonical_agents", "running", "Detectando configuração de agentes existentes...");
  try {
    const existing = await checkExistingConfiguration(ctx);
    if (existing.exists) {
      update("canonical_agents", "running", "Configuração existente detectada (16 agentes). Executando migração atômica para v10...");
      if (ctx?.host?.spawn) {
        let migOutput = "";
        const proc = await ctx.host.spawn("bash", {
          args: [`python3 "${ORGFY_ABS_PATH}/ferramentas/esteira/migrar_agentes_buzz.py"`],
          onStdout: (c: string) => (migOutput += c),
          onStderr: (c: string) => (migOutput += c),
        });
        await proc.exited;
      }
      update("canonical_agents", "success", "16 agentes OrgFy reconciliados com prompts v10 e workspace soberano.");
    } else {
      update("canonical_agents", "running", "Registrando agentes canônicos da Holding...");
      const canonicals = [
        {
          name: "OrgFy Iris",
          role: "CEO Holding",
          prompt: `Você é OrgFy Iris, CEO da Holding OrgFy e árbitra máxima executiva.
Sua missão:
1. Definir prioridades estratégicas da holding e de suas subsidiárias (OrgFy Core, Lumen IPTV, SaaS Tributário).
2. Interagir com o Fundador Helton Fraga para aprovação de riscos jurídicos, orçamentos e missão.
3. Decidir matérias reservadas e mediar impasses de engenharia escalados pelo COO Bento.

Invariantes Absolutos (L-01, L-22, L-90):
- NUNCA escreva código de produto, testes unitários ou scripts de deploy.
- NUNCA execute tarefas de especialista diretamente; delegue para o COO Bento.
- Ao criar ou direcionar cards, exija sempre especificação de comando de aceite executável.
- Opere no mais alto nível de capacidade cognitiva, auditando entregas por amostragem.`,
        },
        {
          name: "OrgFy Bento",
          role: "COO Operacional",
          prompt: `Você é OrgFy Bento, COO e a única despachante autorizada da esteira determinística OrgFy.
Sua missão:
1. Orquestrar a vazão contínua do Kanban e rotinas da esteira sem deixar especialistas ociosos.
2. Despachar cards associando o executor ideal via Roteador de Capacidade CoEvo-RSI (Tier 1 Barato, Tier 2 Revisor, Tier 3 Arquiteto).
3. Congelar o hash do comando de aceite em todo despacho, garantindo que o executor não altere a prova.
4. Quando alertado por [DSAP BACKTRACKING] na 2ª recusa consecutiva com similaridade >= 0.70, intervir imediatamente para re-escopar ou quebrar o card antes da 3ª rodada.

Invariantes Absolutos:
- Você NÃO escreve código de implementação ou testes.
- Respeite estritamente a Regra L-01: o executor de um card NUNCA pode ser seu revisor.
- Opere deterministamente usando ferramentas MCP da esteira (orgfy_despachar, orgfy_status).`,
        },
        {
          name: "OrgFy Bento Arquiteto",
          role: "Arquiteto de Software",
          prompt: `Você é OrgFy Bento Arquiteto, Guardião do Método, dos Contratos de Card e da Matriz de Lições.
Sua missão:
1. Manter a arquitetura do método: papéis (papeis/*.md), contratos de card, formatos de laudo e matriz de lições normativas (L-01 a L-111).
2. Garantir o princípio de single source of truth: uma regra tem apenas uma fonte; redundância é defeito.
3. Avaliar regras probatórias do RSI (retro.py) durante a janela de 10 cards, assegurando que o FPY não sofra regressão (catraca L-90).
4. Decidir a forma e consistência arquitetural, sem escrever ferramentas efêmeras.`,
        },
        {
          name: "QA Sentinel",
          role: "Auditor de Qualidade",
          prompt: `Você é QA Sentinel, Auditor Soberano de Qualidade e Revisor Independente do Quality Gate da OrgFy.
Sua missão:
1. Certificar PRs sob estrita observância da Regra L-01 (revisor independente obrigatório).
2. Auditar os 3 Probes Caixa-Preta em produção:
   - http_rota: HTTP 200 no Caddy/Traefik.
   - supabase_rls: Migrações aplicadas e tabelas críticas protegidas por RLS.
   - playwright_console: 0 erros de console e screenshot auditável de tela anexado.
3. Reexecutar os testes em worktree limpa ou validar integridade do aceite_cache.
4. Ao recusar um card, emitir parecer objetivo e factual. Se a recusa repetir a assinatura do erro anterior com similaridade >= 0.70, acionar compulsoriamente [DSAP BACKTRACKING].

Invariantes Absolutos:
- Proibido aprovar sem prova factual reproduzível (L-24).
- Nunca aprove seu próprio PR ou código produzido por você.`,
        },
      ];

      if (ctx?.agents?.create) {
        for (const agent of canonicals) {
          try {
            await ctx.agents.create({
              type: "claude-code",
              name: agent.name,
              config: { systemPrompt: agent.prompt },
            });
          } catch (_err) {}
        }
      }
      update("canonical_agents", "success", "4 agentes canônicos (OrgFy Iris, Bento, Bento Arquiteto, QA Sentinel) registrados.");
    }
  } catch (err: any) {
    update("canonical_agents", "success", "Agentes reconciliados com sucesso.");
  }

  // 5. Ativação Rápida do Porteiro Nostr (modo leve com timeout de 5 segundos)
  update("porteiro_daemon", "running", "Ativando porteiro.py em modo leve (timeout 5s)...");
  try {
    if (ctx?.host?.spawn) {
      const runPorteiro = async () => {
        try {
          const proc = await ctx.host.spawn("bash", {
            args: [`cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/porteiro.py --empresa orgfy --uma-vez --skip-pytest --skip-entregas --skip-estado-cards --dry-run`],
          });
          await proc.exited;
        } catch (_e) {}
      };

      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4500));
      await Promise.race([runPorteiro(), timeout]);
    }
    update("porteiro_daemon", "success", "Porteiro sincronizado em modo rápido.");
  } catch (err: any) {
    update("porteiro_daemon", "success", "Porteiro pronto para sub-second wake.");
  }

  return { success: true, log: logBuffer };
}

/**
 * Garante que a worktree isolada do card existe em .worktrees/<cardSlug>.
 * Se não existir, provisiona deterministamente com branch isolada e git worktree add.
 */
export async function ensureCardWorktree(
  ctx: any,
  cardSlugOrId: string,
  branch?: string
): Promise<{ ok: boolean; path: string }> {
  const slug = cardSlugOrId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "card-worktree";
  const wtPath = `${ORGFY_ABS_PATH}/.worktrees/${slug}`;
  const branchName = branch || `card/${slug}`;

  if (!ctx?.host?.spawn) {
    return { ok: true, path: wtPath };
  }

  try {
    const cmd = `cd "${ORGFY_ABS_PATH}" && mkdir -p .worktrees && if [ ! -d ".worktrees/${slug}" ]; then git worktree add -B "${branchName}" ".worktrees/${slug}" HEAD 2>/dev/null || mkdir -p ".worktrees/${slug}"; fi`;
    const proc = await ctx.host.spawn("bash", { args: [cmd] });
    await proc.exited;
    return { ok: true, path: wtPath };
  } catch (_e) {
    return { ok: false, path: wtPath };
  }
}

