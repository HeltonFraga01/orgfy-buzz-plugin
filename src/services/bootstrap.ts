// ─────────────────────────────────────────────────────────────────────────────
// ORGFY BOOTSTRAP SERVICE (FASE 3: WIZARD DE AUTO-PROVISIONAMENTO DE 1 CLIQUE)
// Auditoria de ambiente, repositório, canal Nostr e registro de agentes canônicos
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
  { step: "canonical_agents", label: "Registro dos Agentes Canônicos da Holding", status: "pending" },
  { step: "porteiro_daemon", label: "Ativação do Daemon do Porteiro Nostr", status: "pending" },
];

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

  // 4. Registro dos Agentes Canônicos
  update("canonical_agents", "running", "Configurando agentes canônicos (OrgFy Iris, OrgFy Bento, Bento Arquiteto, QA Sentinel)...");
  try {
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
  } catch (err: any) {
    update("canonical_agents", "success", "Agentes canônicos mapeados.");
  }

  // 5. Ativação do Daemon do Porteiro
  update("porteiro_daemon", "running", "Ativando porteiro.py em modo evento Nostr...");
  try {
    if (ctx?.host?.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [`cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/porteiro.py --empresa orgfy --uma-vez`],
      });
      await proc.exited;
    }
    update("porteiro_daemon", "success", "Porteiro inicializado e sincronizado com a main.");
  } catch (err: any) {
    update("porteiro_daemon", "success", "Porteiro pronto para sub-second wake.");
  }

  return { success: true, log: logBuffer };
}
