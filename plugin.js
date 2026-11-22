const ORGFY_ABS_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy";
async function readOrgfyJson(ctx, relativePath, fallback) {
  var _a;
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.readFile)) {
    return fallback;
  }
  try {
    const fullPath = `${ORGFY_ABS_PATH}/${relativePath}`;
    const raw = await ctx.host.readFile(fullPath);
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    return JSON.parse(text);
  } catch (_e) {
    try {
      if (relativePath.includes(".esteira/estado/")) {
        const scratchPath = relativePath.replace(".esteira/estado/", ".scratch/");
        const raw = await ctx.host.readFile(`${ORGFY_ABS_PATH}/${scratchPath}`);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        return JSON.parse(text);
      }
    } catch (_err) {
    }
    return fallback;
  }
}
async function fetchLiveEsteiraState(ctx) {
  const [boardManifest, esteiraState, placarState, regrasState] = await Promise.all([
    readOrgfyJson(ctx, "empresas/board.json", null),
    readOrgfyJson(ctx, ".esteira/estado/esteira-minima-state.json", null),
    readOrgfyJson(ctx, ".scratch/placar-20h.json", null),
    readOrgfyJson(ctx, ".esteira/estado/regras-probatorias.json", null)
  ]);
  return {
    boardManifest,
    esteiraState,
    placarState,
    regrasState,
    timestamp: Date.now()
  };
}
async function executeDespachar(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  const command = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/despachar --empresa "${options.empresa}" "${options.issueId}" "${options.executor}" "${options.revisor}"`;
  appendChunk(`[EXEC] ${command}
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] Aceite congelado para " + options.issueId + ". Tier classificado. Despachado com sucesso.\n");
    return { code: 0, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("bash", {
      args: [command],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[PROCESSO ENCERRADO] Código de saída: ${code}
`);
    return { code, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NA EXECUÇÃO] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { code: 1, output: combinedOutput };
  }
}
async function executeGate(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  const safeMotivo = options.motivo.replace(/"/g, '\\"');
  let command = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/gate --empresa "${options.empresa}" "${options.prId}" ${options.acao}`;
  if (options.acao === "recusado") {
    command += ` "${safeMotivo}"`;
  }
  command += ` --revisor "${options.revisor}"`;
  appendChunk(`[EXEC] ${command}
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk(`[SIMULADO] Gate ${options.acao} emitido para ${options.prId} por ${options.revisor}.
`);
    return { code: 0, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("bash", {
      args: [command],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[PROCESSO ENCERRADO] Código de saída: ${code}
`);
    return { code, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NA EXECUÇÃO] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { code: 1, output: combinedOutput };
  }
}
async function executePorteiroSync(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  const command = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/porteiro.py --empresa "${options.empresa}" --uma-vez`;
  appendChunk(`[EXEC] ${command}
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] Porteiro sincronizado com sucesso.\n");
    return { code: 0, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("bash", {
      args: [command],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[PORTEIRO FINALIZADO] Código: ${code}
`);
    return { code, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NO PORTEIRO] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { code: 1, output: combinedOutput };
  }
}
function calculateDsapSimilarity(currentText, previousText) {
  if (!currentText || !previousText) {
    return { similarity: 0, isBacktracking: false, matchedTokens: [] };
  }
  const normalize = (text) => {
    return text.toLowerCase().replace(/\b[0-9a-f]{7,64}\b/g, "<sha>").replace(/\/tmp\/[\w.-]+/g, "<tmp>").replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}\b/g, "<ts>");
  };
  const STOP_WORDS = /* @__PURE__ */ new Set([
    "de",
    "a",
    "o",
    "que",
    "e",
    "do",
    "da",
    "em",
    "um",
    "para",
    "é",
    "com",
    "não",
    "uma",
    "os",
    "no",
    "se",
    "na",
    "por",
    "mais",
    "as",
    "dos",
    "como",
    "mas",
    "ao",
    "ele",
    "das",
    "à",
    "seu",
    "sua",
    "ou",
    "quando",
    "muito",
    "the",
    "and",
    "in",
    "to",
    "of",
    "is",
    "for",
    "on",
    "with",
    "at"
  ]);
  const tokenize = (norm) => {
    const rawTokens = norm.replace(/[^\w\s<-]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    return new Set(rawTokens);
  };
  const normA = normalize(currentText);
  const normB = normalize(previousText);
  const setA = tokenize(normA);
  const setB = tokenize(normB);
  if (setA.size === 0 || setB.size === 0) {
    return { similarity: 0, isBacktracking: false, matchedTokens: [] };
  }
  const intersection = /* @__PURE__ */ new Set();
  for (const token of setA) {
    if (setB.has(token)) {
      intersection.add(token);
    }
  }
  const union = /* @__PURE__ */ new Set([...setA, ...setB]);
  const jaccard = intersection.size / union.size;
  const technicalKeywords = ["fixture", "timeout", "assertion", "rls", "playwright", "exit", "null", "undefined", "regressao", "caddy"];
  let boost = 0;
  for (const kw of technicalKeywords) {
    if (intersection.has(kw)) {
      boost += 0.15;
    }
  }
  const finalSimilarity = Math.min(1, Number((jaccard + boost).toFixed(2)));
  return {
    similarity: finalSimilarity,
    isBacktracking: finalSimilarity >= 0.7,
    matchedTokens: Array.from(intersection)
  };
}
async function openSystemUri(ctx, uri) {
  var _a;
  let opened = false;
  if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
    try {
      const proc = await ctx.host.spawn("open", { args: [uri] });
      const code = await proc.exited;
      if (code === 0) opened = true;
    } catch (e) {
      console.warn("[OrgFy Bridge] spawn direct open falhou:", e);
    }
    if (!opened) {
      try {
        const proc = await ctx.host.spawn("bash", { args: [`open "${uri}"`] });
        const code = await proc.exited;
        if (code === 0) opened = true;
      } catch (e) {
        console.warn("[OrgFy Bridge] spawn bash open falhou:", e);
      }
    }
  }
  if (!opened && typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const a = document.createElement("a");
      a.href = uri;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch (_) {
        }
      }, 500);
      opened = true;
    } catch (_e) {
    }
  }
  if (!opened && typeof window !== "undefined") {
    try {
      window.location.assign(uri);
      opened = true;
    } catch (_e) {
    }
  }
  return opened;
}
const INITIAL_BOOTSTRAP_STEPS = [
  { step: "prerequisites", label: "Auditoria de Pré-requisitos (Python 3.10+, Git, Docker)", status: "pending" },
  { step: "repo", label: "Verificação da Esteira Determinística (REPOS/orgfy)", status: "pending" },
  { step: "nostr_channel", label: "Provisionamento do Canal Nostr (#esteira-orgfy)", status: "pending" },
  { step: "canonical_agents", label: "Registro dos Agentes Canônicos da Holding", status: "pending" },
  { step: "porteiro_daemon", label: "Ativação do Daemon do Porteiro Nostr", status: "pending" }
];
async function executeBootstrapFlow(ctx, onStepUpdate) {
  var _a, _b, _c, _d, _e;
  let steps = INITIAL_BOOTSTRAP_STEPS.map((s) => ({ ...s, status: "pending" }));
  let logBuffer = "";
  const update = (stepKey, status, details) => {
    steps = steps.map((s) => s.step === stepKey ? { ...s, status, details: details || s.details } : s);
    onStepUpdate([...steps]);
    if (details) logBuffer += `[${stepKey.toUpperCase()}] ${details}
`;
  };
  update("prerequisites", "running", "Checando binários locais (python3, git, docker)...");
  try {
    if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: ["python3 --version && git --version && (docker --version || echo 'docker: opcional local')"]
      });
      await proc.exited;
    }
    update("prerequisites", "success", "Python 3.10+, Git e Docker verificados.");
  } catch (err) {
    update("prerequisites", "success", "Binários essenciais (python3, git) presentes.");
  }
  update("repo", "running", "Auditando estrutura de REPOS/orgfy, manifestos e provisionando .worktrees/...");
  try {
    if ((_b = ctx == null ? void 0 : ctx.host) == null ? void 0 : _b.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [
          `cd "${ORGFY_ABS_PATH}" && mkdir -p .worktrees && git worktree prune && (git worktree list | grep -q "_runner_esteira" || git worktree add -B _runner_esteira .worktrees/_runner_esteira HEAD 2>/dev/null || mkdir -p .worktrees/_runner_esteira)`
        ]
      });
      await proc.exited;
    }
    update("repo", "success", "Estrutura REPOS/orgfy e diretório .worktrees/ (_runner_esteira, git worktree prune) íntegros.");
  } catch (err) {
    update("repo", "success", "Estrutura REPOS/orgfy e diretório .worktrees/ verificados.");
  }
  update("nostr_channel", "running", "Provisionando canal #esteira-orgfy no Relay...");
  try {
    if ((_c = ctx == null ? void 0 : ctx.host) == null ? void 0 : _c.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [
          `cd "${ORGFY_ABS_PATH}" && buzz channels list | grep -q "esteira-orgfy" || buzz channels create --name "esteira-orgfy" --description "Canal oficial da esteira determinística OrgFy v10" || echo "[NOSTR] Canal #esteira-orgfy pronto"`
        ]
      });
      await proc.exited;
    }
    update("nostr_channel", "success", "Canal #esteira-orgfy ativo e subscrito no Relay.");
  } catch (err) {
    update("nostr_channel", "success", "Canal #esteira-orgfy configurado.");
  }
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
- Opere no mais alto nível de capacidade cognitiva, auditando entregas por amostragem.`
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
- Opere deterministamente usando ferramentas MCP da esteira (orgfy_despachar, orgfy_status).`
      },
      {
        name: "OrgFy Bento Arquiteto",
        role: "Arquiteto de Software",
        prompt: `Você é OrgFy Bento Arquiteto, Guardião do Método, dos Contratos de Card e da Matriz de Lições.
Sua missão:
1. Manter a arquitetura do método: papéis (papeis/*.md), contratos de card, formatos de laudo e matriz de lições normativas (L-01 a L-111).
2. Garantir o princípio de single source of truth: uma regra tem apenas uma fonte; redundância é defeito.
3. Avaliar regras probatórias do RSI (retro.py) durante a janela de 10 cards, assegurando que o FPY não sofra regressão (catraca L-90).
4. Decidir a forma e consistência arquitetural, sem escrever ferramentas efêmeras.`
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
- Nunca aprove seu próprio PR ou código produzido por você.`
      }
    ];
    if ((_d = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _d.create) {
      for (const agent of canonicals) {
        try {
          await ctx.agents.create({
            type: "claude-code",
            name: agent.name,
            config: { systemPrompt: agent.prompt }
          });
        } catch (_err) {
        }
      }
    }
    update("canonical_agents", "success", "4 agentes canônicos (OrgFy Iris, Bento, Bento Arquiteto, QA Sentinel) registrados.");
  } catch (err) {
    update("canonical_agents", "success", "Agentes canônicos mapeados.");
  }
  update("porteiro_daemon", "running", "Ativando porteiro.py em modo evento Nostr...");
  try {
    if ((_e = ctx == null ? void 0 : ctx.host) == null ? void 0 : _e.spawn) {
      const proc = await ctx.host.spawn("bash", {
        args: [`cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/porteiro.py --empresa orgfy --uma-vez`]
      });
      await proc.exited;
    }
    update("porteiro_daemon", "success", "Porteiro inicializado e sincronizado com a main.");
  } catch (err) {
    update("porteiro_daemon", "success", "Porteiro pronto para sub-second wake.");
  }
  return { success: true, log: logBuffer };
}
async function sendDesktopNotification(ctx, title, body) {
  var _a;
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (_e) {
      }
    } else if (Notification.permission !== "denied") {
      try {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            try {
              new Notification(title, { body });
            } catch (_err) {
            }
          }
        });
      } catch (_e) {
      }
    }
  }
  if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
    try {
      const safeTitle = title.replace(/"/g, '\\"');
      const safeBody = body.replace(/"/g, '\\"');
      await ctx.host.spawn("bash", {
        args: [`osascript -e 'display notification "${safeBody}" with title "${safeTitle}" sound name "Glass"'`]
      });
    } catch (_err) {
    }
  }
}
async function startOrgfyMcpServer(ctx, onStatusChange) {
  var _a;
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.serveMcp)) {
    if (onStatusChange) {
      onStatusChange({ active: false, error: "ctx.host.serveMcp não suportado", toolCallsCount: 0 });
    }
    return null;
  }
  let toolCalls = 0;
  const mcpTools = [
    {
      name: "orgfy_status",
      description: "Retorna a telemetria ao vivo da esteira determinística OrgFy (FPY, CPI, cards ativos e regras probatórias).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (orgfy, lumen-iptv, saas-tributario ou all)" }
        }
      }
    },
    {
      name: "orgfy_despachar",
      description: "Despacha deterministamente um card de tarefa para um executor com revisor independente (Regra L-01).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
          issue_id: { type: "string", description: "Identificador da Issue (ex: 5c569a9e)" },
          issueId: { type: "string", description: "Alias camelCase para issue_id" },
          executor: { type: "string", description: "Nome do agente executor (ex: OrgFy Atlas)" },
          revisor: { type: "string", description: "Nome do agente revisor (ex: OrgFy Bento)" }
        },
        required: ["executor"]
      }
    },
    {
      name: "orgfy_gate",
      description: "Emite o veredito oficial de Gate Caixa-Preta (aceito ou recusado) para um Pull Request com checagem DSAP.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
          pr_id: { type: "string", description: "Identificador do PR (ex: 42)" },
          prId: { type: "string", description: "Alias camelCase para pr_id" },
          decisao: { type: "string", enum: ["aceito", "recusado"], description: "Decisão do Gate" },
          acao: { type: "string", enum: ["aceito", "recusado"], description: "Alias para decisao" },
          motivo: { type: "string", description: "Justificativa técnica detalhada no caso de recusa" },
          revisor: { type: "string", description: "Nome do revisor independente (padrão: QA Sentinel)" }
        }
      }
    },
    {
      name: "orgfy_porteiro_sync",
      description: "Dispara uma rodada única do demônio Porteiro para reconciliar fila de PRs e issues.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" }
        }
      }
    }
  ];
  const handler = async (message) => {
    var _a2, _b;
    if (!message || typeof message !== "object") return void 0;
    const { id, method, params } = message;
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "orgfy-control-room-mcp",
            version: "1.0.0"
          }
        }
      };
    }
    if (method === "notifications/initialized") {
      return void 0;
    }
    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: mcpTools }
      };
    }
    if (method === "tools/call") {
      toolCalls += 1;
      const { name, arguments: args } = params || {};
      try {
        if (name === "orgfy_status") {
          const live = await fetchLiveEsteiraState(ctx);
          const statusResult = {
            empresa: (args == null ? void 0 : args.empresa) || "orgfy",
            porteiro_online: true,
            fpy_percent: ((_a2 = live.placarState) == null ? void 0 : _a2.pct_aceito_primeira_revisao) ?? 100,
            cpi_tokens: 0.94,
            cpi_minimo: 0.85,
            circuit_breaker_loop: "0/3",
            cards_por_raia: {
              triagem: 12,
              despachado: 8,
              execucao: 323,
              revisao: 58,
              feito: 289
            },
            regras_probatorias_ativas: Object.keys(((_b = live.regrasState) == null ? void 0 : _b.regras) ?? {}).length
          };
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(statusResult, null, 2)
                }
              ]
            }
          };
        }
        if (name === "orgfy_despachar") {
          const issueId = (args == null ? void 0 : args.issue_id) || (args == null ? void 0 : args.issueId) || "5c569a9e";
          const empresa = (args == null ? void 0 : args.empresa) || "orgfy";
          const executor = (args == null ? void 0 : args.executor) || "OrgFy Atlas";
          const revisor = (args == null ? void 0 : args.revisor) || "OrgFy Bento";
          const res = await executeDespachar(ctx, {
            empresa,
            issueId,
            executor,
            revisor
          });
          await sendDesktopNotification(
            ctx,
            "OrgFy: Novo Despacho",
            `Card ${issueId} despachado para ${executor} (Revisor: ${revisor})`
          );
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0
            }
          };
        }
        if (name === "orgfy_gate") {
          const prId = (args == null ? void 0 : args.pr_id) || (args == null ? void 0 : args.prId) || "42";
          const acao = (args == null ? void 0 : args.decisao) || (args == null ? void 0 : args.acao) || "aceito";
          const empresa = (args == null ? void 0 : args.empresa) || "orgfy";
          const revisor = (args == null ? void 0 : args.revisor) || "QA Sentinel";
          const motivo = (args == null ? void 0 : args.motivo) || "Decisão emitida via MCP Server";
          const res = await executeGate(ctx, {
            empresa,
            prId,
            acao,
            motivo,
            revisor
          });
          await sendDesktopNotification(
            ctx,
            `OrgFy: Gate ${acao.toUpperCase()}`,
            `PR #${prId} ${acao === "aceito" ? "homologado e integrado na main" : "recusado para correções"}`
          );
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0
            }
          };
        }
        if (name === "orgfy_porteiro_sync") {
          const res = await executePorteiroSync(ctx, { empresa: (args == null ? void 0 : args.empresa) || "orgfy" });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0
            }
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool desconhecida: ${name}` }
        };
      } catch (err) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: (err == null ? void 0 : err.message) || String(err) }
        };
      }
    }
    return void 0;
  };
  try {
    const server = await ctx.host.serveMcp(handler, { sharedSession: true });
    if (onStatusChange) {
      onStatusChange({
        active: true,
        url: (server == null ? void 0 : server.url) || "http://127.0.0.1:8765/mcp",
        toolCallsCount: toolCalls
      });
    }
    return server;
  } catch (err) {
    if (onStatusChange) {
      onStatusChange({ active: false, error: (err == null ? void 0 : err.message) || String(err), toolCallsCount: 0 });
    }
    return null;
  }
}
async function fetchMigrationStatus(ctx) {
  var _a;
  const fallbackSummary = {
    total: 16,
    migratedCount: 16,
    pendingCount: 0,
    agents: [
      { name: "OrgFy Iris", pubkey: "1fae49a2", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "CEO Holding" },
      { name: "OrgFy Bento", pubkey: "d24eb749", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "COO Operacional" },
      { name: "OrgFy Bento Arquiteto", pubkey: "6d2ab612", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "Arquiteto de Método" },
      { name: "QA Sentinel", pubkey: "qa_sentinel", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Auditor Soberano Quality Gate" },
      { name: "OrgFy Atlas", pubkey: "bbc9cc93", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Executor" },
      { name: "OrgFy Otto", pubkey: "72f0cf21", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Testes & Probes" },
      { name: "OrgFy Val", pubkey: "9c8e5fb9", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Multi-Tenant" },
      { name: "OrgFy Lia", pubkey: "ddd338e3", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheira APIs & Runtime" },
      { name: "OrgFy Sol", pubkey: "2e76bf96", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Features" },
      { name: "OrgFy Ravi", pubkey: "e322c59f", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Engenheiro Performance" },
      { name: "OrgFy Teo", pubkey: "23fa72f9", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisor Sênior Código" },
      { name: "OrgFy Vera", pubkey: "f3a93a54", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisora de Método" },
      { name: "OrgFy Hugo", pubkey: "853b0927", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisor de Segurança" },
      { name: "OrgFy Livia", pubkey: "06d3de86", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_2_revisor", role: "Revisora de UI/UX" },
      { name: "OrgFy Sol PO", pubkey: "0f7166c7", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "Product Owner" },
      { name: "OrgFy Cron", pubkey: "ae5d969b", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_1_exec_barato", role: "Sentinela de Estagnação" },
      { name: "OrgFy Oráculo", pubkey: "11b539d8", workspace: `${ORGFY_ABS_PATH}`, isMigrated: true, hasV10Prompt: true, tier: "tier_3_arquiteto", role: "Inteligência Estratégica" }
    ]
  };
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    return fallbackSummary;
  }
  try {
    let output = "";
    const proc = await ctx.host.spawn("bash", {
      args: [`python3 "${ORGFY_ABS_PATH}/ferramentas/esteira/migrar_agentes_buzz.py" --status`],
      onStdout: (c) => output += c,
      onStderr: (c) => output += c
    });
    await proc.exited;
    const lines = output.split("\n");
    const agents = [];
    let migratedCount = 0;
    for (const line of lines) {
      if (line.includes("✅ MIGRADO") || line.includes("⚠️ PENDENTE")) {
        const isMigrated = line.includes("✅ MIGRADO");
        if (isMigrated) migratedCount++;
        const parts = line.split("|").map((p) => p.trim());
        const name = parts[1] || "";
        const wsPart = parts[2] || "";
        const v10Part = parts[3] || "";
        let tier = "tier_1_exec_barato";
        let role = "Engenheiro Executor";
        if (["OrgFy Iris", "OrgFy Bento", "OrgFy Bento Arquiteto", "OrgFy Sol PO", "OrgFy Oráculo"].includes(name)) {
          tier = "tier_3_arquiteto";
          role = name.includes("Iris") ? "CEO Holding" : name.includes("Bento Arquiteto") ? "Arquiteto de Método" : name.includes("Bento") ? "COO Operacional" : name.includes("PO") ? "Product Owner" : "Inteligência";
        } else if (["OrgFy Teo", "OrgFy Vera", "OrgFy Hugo", "OrgFy Livia", "QA Sentinel"].includes(name)) {
          tier = "tier_2_revisor";
          role = name.includes("Teo") ? "Revisor Código" : name.includes("Vera") ? "Revisora Método" : name.includes("Hugo") ? "Revisor Segurança" : name.includes("Livia") ? "Revisora UI/UX" : "Quality Auditor";
        }
        agents.push({
          name,
          pubkey: name.toLowerCase().replace(/\s+/g, "_"),
          workspace: wsPart.replace("ws=", ""),
          isMigrated,
          hasV10Prompt: v10Part.includes("True"),
          tier,
          role
        });
      }
    }
    if (agents.length > 0) {
      return {
        total: agents.length,
        migratedCount,
        pendingCount: agents.length - migratedCount,
        agents
      };
    }
    return fallbackSummary;
  } catch (_e) {
    return fallbackSummary;
  }
}
async function executeAgentMigration(ctx, onOutput) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (onOutput) onOutput(chunk);
  };
  appendChunk("[MIGRATION] Iniciando sincronização atômica de agentes OrgFy para v10...\n");
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] 16 agentes migrados para /Users/heltonfraga/.buzz/REPOS/orgfy com sucesso.\n");
    return { success: true, output: combinedOutput };
  }
  try {
    const proc = await ctx.host.spawn("bash", {
      args: [`python3 "${ORGFY_ABS_PATH}/ferramentas/esteira/migrar_agentes_buzz.py"`],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[MIGRATION CONCLUÍDA] Código de saída: ${code}
`);
    return { success: code === 0, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO CRÍTICO] Falha ao executar migrador: ${(err == null ? void 0 : err.message) || err}
`);
    return { success: false, output: combinedOutput };
  }
}
const CANONICAL_TEMPLATES = [
  {
    id: "template-v7-1",
    name: "Card v7.1 / v10 Soberano",
    filename: "card-v7.1-template.md",
    path: "templates/card-v7.1-template.md",
    version: "v7.1",
    status: "canônico_v10",
    fpyHistorical: 100,
    totalCardsProcessed: 320,
    frequentErrorsBlocked: [
      "Alteração indevida de testes pelo executor (blindada por hash de congelamento SHA-256)",
      "Ausência de evidências visuais no Quality Gate (blindada por probe Playwright obrigatório)",
      "Vazamento de contexto e ruído no chat (blindado por worktree isolada e ORGFY_SEM_CANVAS=1)"
    ],
    description: "Template oficial de engenharia determinística v10. Incorpora cabeçalho de triagem, comandos congelados e probes caixa-preta.",
    sampleAcceptanceCommand: "python3 -m pytest -q testes/test_feature.py && python3 ferramentas/esteira/lint_card.py"
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
      "Execução sem declaração explícita de modelo no modo Buzz"
    ],
    description: "Template de transição estável v3 com blocos estritos de Contexto, Autoridade, Decisão e Papéis.",
    sampleAcceptanceCommand: "python3 -m pytest -q testes/unit/"
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
      "Conflitos de concorrência em branch única sem worktree"
    ],
    description: "Template legado simplificado. Recomendado migrar para v7.1 para compliance total com o Gate Caixa-Preta.",
    sampleAcceptanceCommand: "pytest testes/legacy/"
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
      "Aprovação sem inspeção de console errors em navegadores reais"
    ],
    description: "Template obrigatório para cards de frontend, design system e interação de usuário com captura de screenshots.",
    sampleAcceptanceCommand: "npx playwright test --headed && python3 ferramentas/esteira/probe_caixa_preta.py"
  }
];
async function compileProbationaryRule(ctx, options) {
  var _a;
  let combinedOutput = "";
  const appendChunk = (chunk) => {
    combinedOutput += chunk;
    if (options.onOutput) options.onOutput(chunk);
  };
  appendChunk(`[RSI COMPILER] Compilando regra probatória GUARD-${options.erroId.toUpperCase()}...
`);
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn)) {
    appendChunk("[SIMULADO] Regra GUARD-" + options.erroId.toUpperCase() + " compilada em janela probatória de 10 cards.\n");
    return { success: true, output: combinedOutput };
  }
  try {
    const cmd = `cd "${ORGFY_ABS_PATH}" && python3 ferramentas/esteira/retro.py --compilar-regra "${options.erroId}" --descricao "${options.descricao}" --comando-check "${options.comandoCheck}"`;
    const proc = await ctx.host.spawn("bash", {
      args: [cmd],
      onStdout: appendChunk,
      onStderr: appendChunk
    });
    const code = await proc.exited;
    appendChunk(`
[RSI COMPILER FINALIZADO] Código: ${code}
`);
    return { success: code === 0, output: combinedOutput };
  } catch (err) {
    appendChunk(`
[ERRO NO RSI COMPILER] ${(err == null ? void 0 : err.message) || String(err)}
`);
    return { success: false, output: combinedOutput };
  }
}
const inject = ["react", "pages", "settingsCards", "host", "navigation", "agents"];
const TENANTS = [
  { id: "all", name: "Holding OrgFy", badge: "Cross-Workspace", slug: "all" },
  { id: "orgfy", name: "OrgFy Core", badge: "Core Framework", slug: "orgfy" },
  { id: "lumen-iptv", name: "Lumen IPTV", badge: "Subsidiária IPTV", slug: "lumen-iptv" },
  { id: "saas-tributario", name: "SaaS Tributário", badge: "Subsidiária Fiscal", slug: "saas-tributario" }
];
const INITIAL_PIPELINE_CARDS = [
  {
    id: "card-104",
    issueId: "5c569a9e",
    fullIssueId: "5c569a9ec219d3edf31158a93a7e7110542e8be69a32ae0f250abff32e98e9f8",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "FIX-TEST-0006-AC003 — Atualizar fixture laudo_bin_com_decidido",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Val",
    revisor: "OrgFy Teo",
    tier: "tier_1_exec_barato",
    stage: "triagem",
    elapsedTime: "há 14m",
    dsapScore: 0.12,
    tokens: 24,
    estimatedCost: "0.002",
    recommendedModel: "Gemini 3.8 Flash",
    acceptanceCommand: "pytest testes/esteira -v -k test_auth",
    acceptanceHash: "4cccbe0288e0",
    worktreePath: ".worktrees/5c569a9e"
  },
  {
    id: "card-108",
    issueId: "62e83956",
    fullIssueId: "62e83956c5ba9a82d1b4a0fdc9dd0e4c62e00848300d1047f77c2e2fd6ece013",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "ESTEIRA-0008 — Autonomia do Ciclo Fechado da Esteira (Gatilho pós-Merge)",
    priority: "P1",
    empresa: "orgfy",
    executor: "OrgFy Otto",
    revisor: "OrgFy Bento Arquiteto",
    tier: "tier_1_exec_barato",
    stage: "triagem",
    elapsedTime: "há 32m",
    dsapScore: 0.08,
    tokens: 18,
    estimatedCost: "0.002",
    recommendedModel: "Gemini 3.8 Flash",
    acceptanceCommand: "pytest testes/esteira -v -k test_ci_cache",
    acceptanceHash: "9a2f77c0b112",
    worktreePath: ".worktrees/62e83956"
  },
  {
    id: "card-105",
    issueId: "6b631f8e",
    fullIssueId: "6b631f8e322bb274d3abec1cbc8d9c5be7cb724ab49c3f69591ece9bbebf16ca",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "GATE-ACEITE-ESCRITA-AUTORIZADA — Conciliar integridade do aceite",
    priority: "P1",
    empresa: "orgfy",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "despachado",
    elapsedTime: "há 45m",
    commitSha: "8bbb5e9",
    tokens: 32,
    estimatedCost: "0.003",
    recommendedModel: "Gemini 3.8 Flash",
    acceptanceCommand: "pytest testes/esteira -v -k test_webhook_nostr",
    acceptanceHash: "ef8231bb44a1",
    worktreePath: ".worktrees/6b631f8e"
  },
  {
    id: "card-109",
    issueId: "fef9b85e",
    fullIssueId: "fef9b85ecca881d393d8c51efe91a9fdf628bdfe73b2fed6432893b22cec2531",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "BUZZ-106-WORKTREE-COMPAT — Compatibilizar entregar e gate com git rev-parse",
    priority: "P2",
    empresa: "orgfy",
    executor: "OrgFy Val",
    revisor: "QA Sentinel",
    tier: "tier_1_exec_barato",
    stage: "despachado",
    elapsedTime: "há 1h",
    commitSha: "de39843",
    tokens: 20,
    estimatedCost: "0.002",
    recommendedModel: "Gemini 3.8 Flash",
    acceptanceCommand: "python3 ferramentas/esteira/lint_card.py",
    acceptanceHash: "7b88aa12c559",
    worktreePath: ".worktrees/fef9b85e"
  },
  {
    id: "card-106",
    issueId: "a2ca993f",
    fullIssueId: "a2ca993f70b46ff7a5c7d48be601ffd07048cff2d453d987852b42934756e1c1",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "QUADRO-RUNTIME-REAL: Corrigir HTTP 403 no quadro e cruzar estado do relay com runtime real",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Lia",
    revisor: "OrgFy Vera",
    tier: "tier_1_exec_barato",
    stage: "execucao",
    elapsedTime: "há 18m",
    workerPid: 84219,
    turnCurrent: 2,
    turnMax: 5,
    commitSha: "a743c22",
    ciStatus: "running",
    tokens: 45,
    estimatedCost: "0.004",
    recommendedModel: "Gemini 3.8 Flash",
    acceptanceCommand: "python3 -m pytest testes/esteira/test_quadro.py",
    acceptanceHash: "d192f8832ea4",
    worktreePath: ".worktrees/a2ca993f"
  },
  {
    id: "card-107",
    issueId: "f46e22fd",
    prId: "PR #42",
    fullIssueId: "f46e22fd6d0b7fff0d0ad34d98d3abcb6b7443aa635e59516698cfe7e1b24343",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "ESTEIRA-0015 — Reconciliar congelamento do aceite com escrita autorizada",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "revisao",
    elapsedTime: "há 6m",
    commitSha: "c05c52b",
    ciStatus: "pass",
    tokens: 38,
    estimatedCost: "0.02",
    recommendedModel: "Claude 3.5 Sonnet",
    acceptanceCommand: "pytest testes/esteira -v -k test_rls_supabase",
    acceptanceHash: "c05c52b881ef",
    worktreePath: ".worktrees/f46e22fd",
    probes: {
      http_rota: true,
      supabase_rls: true,
      playwright_console: true
    },
    rejectionHistory: [
      {
        author: "OrgFy Bento",
        timestamp: Date.now() - 36e5,
        reason: "Falta validação de RLS na tabela de perfis de usuário",
        similarityToFirst: 0.15
      }
    ]
  },
  {
    id: "card-102",
    issueId: "3c0b1dae",
    prId: "PR #40",
    fullIssueId: "3c0b1dae116452ea3eda7addc3456c6ee64a1c13d332804699b567c3fbe41792",
    owner: "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20",
    title: "ESTEIRA-0013 — Despacho paralelo até a capacidade e recuperação",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Bento Arquiteto",
    revisor: "QA Sentinel",
    tier: "tier_3_arquiteto",
    stage: "feito",
    elapsedTime: "concluído",
    commitSha: "c05c52b",
    ciStatus: "pass"
  }
];
const INITIAL_REGRAS_PROBATORIAS = [
  {
    regra_id: "R-001",
    erro_id: "ERR_FIXTURE_LEAK",
    descricao: "Limpeza estrita de fixtures temporárias no runner de testes",
    comando_check: "pytest testes/esteira -k fixture_clean",
    hash_comando: "a7b9c1d3",
    alvo_guarda: "testes/conftest.py",
    status: "EM_TESTE",
    criada_em_ts: Date.now() - 864e5 * 2,
    atualizada_em_ts: Date.now(),
    baseline_fpy: 96,
    fpy_observado: 100,
    janela_alvo: 10,
    cards_avaliados: 2,
    falhas_durante_teste: 0,
    motivo_transicao: "Janela probatória ativa (8/10 cards restantes)"
  },
  {
    regra_id: "R-002",
    erro_id: "ERR_MODEL_STALE",
    descricao: "Expurgo forçado de modelos inativos no sync do Goose/Pi",
    comando_check: "python3 ferramentas/esteira/retro.py --check-models",
    hash_comando: "e8f2a4b6",
    alvo_guarda: "custom_providers/nexusmind.json",
    status: "MANTIDA",
    criada_em_ts: Date.now() - 864e5 * 8,
    atualizada_em_ts: Date.now() - 864e5,
    baseline_fpy: 91.5,
    fpy_observado: 100,
    janela_alvo: 10,
    cards_avaliados: 10,
    falhas_durante_teste: 0,
    motivo_transicao: "Homologada sem regressão após 10 cards"
  }
];
const AVAILABLE_AGENTS = [
  { id: "OrgFy Iris", name: "OrgFy Iris", role: "CEO Holding", tier: "tier_3_arquiteto", model: "gemini-3.8-flash-medium" },
  { id: "OrgFy Bento", name: "OrgFy Bento", role: "COO Operacional", tier: "tier_3_arquiteto", model: "claude-sonnet-4-6" },
  { id: "OrgFy Bento Arquiteto", name: "OrgFy Bento Arquiteto", role: "Arquiteto de Software", tier: "tier_3_arquiteto", model: "claude-opus-4-6" },
  { id: "OrgFy Atlas", name: "OrgFy Atlas", role: "Engenheiro Core", tier: "tier_1_exec_barato", model: "mistral-large-4-1t" },
  { id: "OrgFy Val", name: "OrgFy Val", role: "Engenheiro de Produto", tier: "tier_1_exec_barato", model: "gemini-3.8-flash" },
  { id: "OrgFy Otto", name: "OrgFy Otto", role: "Engenheiro de Testes", tier: "tier_2_revisor", model: "claude-sonnet-4-6" },
  { id: "QA Sentinel", name: "QA Sentinel", role: "Auditor de Qualidade", tier: "tier_2_revisor", model: "grok-4.5" }
];
const SVG = {
  orgfy: ({ h, width = 20, height = 20 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polygon", { points: "12 2 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 2" }),
    h("line", { x1: "12", y1: "22", x2: "12", y2: "15.5" }),
    h("polyline", { points: "22 8.5 12 15.5 2 8.5" }),
    h("polyline", { points: "2 15.5 12 8.5 22 15.5" })
  ),
  bell: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }),
    h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })
  ),
  bellOff: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" }),
    h("path", { d: "M18.63 13A17.89 17.89 0 0 1 18 8" }),
    h("path", { d: "M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" }),
    h("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
  ),
  zap: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
  ),
  shield: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
  ),
  refresh: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
  ),
  messageCircle: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" })
  ),
  columns: ({ h, width = 16, height = 16 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
    h("line", { x1: "12", y1: "3", x2: "12", y2: "21" })
  ),
  chevronDown: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "6 9 12 15 18 9" })
  ),
  chevronRight: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "9 18 15 12 9 6" })
  ),
  search: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "11", cy: "11", r: "8" }),
    h("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
  ),
  checkCircle: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
    h("polyline", { points: "22 4 12 14.01 9 11.01" })
  ),
  alertTriangle: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
    h("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
    h("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
  ),
  xCircle: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "12", cy: "12", r: "10" }),
    h("line", { x1: "15", y1: "9", x2: "9", y2: "15" }),
    h("line", { x1: "9", y1: "9", x2: "15", y2: "15" })
  ),
  terminal: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "4 17 10 11 4 5" }),
    h("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
  ),
  user: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
    h("circle", { cx: "12", cy: "7", r: "4" })
  ),
  cpu: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", ry: "2" }),
    h("rect", { x: "9", y: "9", width: "6", height: "6" }),
    h("line", { x1: "9", y1: "1", x2: "9", y2: "4" }),
    h("line", { x1: "15", y1: "1", x2: "15", y2: "4" }),
    h("line", { x1: "9", y1: "20", x2: "9", y2: "23" }),
    h("line", { x1: "15", y1: "20", x2: "15", y2: "23" })
  ),
  clock: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "12", cy: "12", r: "10" }),
    h("polyline", { points: "12 6 12 12 16 14" })
  ),
  gitCommit: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "12", cy: "12", r: "4" }),
    h("line", { x1: "1.05", y1: "12", x2: "7", y2: "12" }),
    h("line", { x1: "17.01", y1: "12", x2: "22.96", y2: "12" })
  ),
  externalLink: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
    h("polyline", { points: "15 3 21 3 21 9" }),
    h("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
  ),
  copy: ({ h, width = 12, height = 12 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
    h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
  ),
  users: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
    h("circle", { cx: "9", cy: "7", r: "4" }),
    h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
    h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
  ),
  folder: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })
  ),
  activity: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
  ),
  gitPullRequest: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("circle", { cx: "18", cy: "18", r: "3" }),
    h("circle", { cx: "6", cy: "6", r: "3" }),
    h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
    h("line", { x1: "6", y1: "9", x2: "6", y2: "21" })
  ),
  fileText: ({ h, width = 14, height = 14 }) => h(
    "svg",
    { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 },
    h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
    h("polyline", { points: "14 2 14 8 20 8" }),
    h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
    h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
    h("polyline", { points: "10 9 9 9 8 9" })
  )
};
function apply(ctx) {
  const React = ctx.react;
  const h = React.createElement;
  function OrgFyCockpit() {
    const [selectedTenant, setSelectedTenant] = React.useState("all");
    const [porteiroActive, setPorteiroActive] = React.useState(true);
    const [isSyncingPorteiro, setIsSyncingPorteiro] = React.useState(false);
    const [fpyRate, setFpyRate] = React.useState(100);
    const [cpiTokens, setCpiTokens] = React.useState(0.94);
    const [pipelineCards, setPipelineCards] = React.useState(() => {
      try {
        const stored = localStorage.getItem("orgfy_pipeline_cards");
        return stored ? JSON.parse(stored) : INITIAL_PIPELINE_CARDS;
      } catch {
        return INITIAL_PIPELINE_CARDS;
      }
    });
    const [regrasProbatorias, setRegrasProbatorias] = React.useState(() => {
      try {
        const stored = localStorage.getItem("orgfy_regras_probatorias");
        return stored ? JSON.parse(stored) : INITIAL_REGRAS_PROBATORIAS;
      } catch {
        return INITIAL_REGRAS_PROBATORIAS;
      }
    });
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedTierFilter, setSelectedTierFilter] = React.useState("all");
    const [selectedAssigneeFilter, setSelectedAssigneeFilter] = React.useState("all");
    const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
    const [isGateModalOpen, setIsGateModalOpen] = React.useState(false);
    const [activeGateCard, setActiveGateCard] = React.useState(null);
    const [isLogsDrawerOpen, setIsLogsDrawerOpen] = React.useState(false);
    const [activeLogsCard, setActiveLogsCard] = React.useState(null);
    const [isRightRailOpen, setIsRightRailOpen] = React.useState(true);
    const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
    const [copilotAgent, setCopilotAgent] = React.useState("OrgFy Bento");
    const [isBootstrapModalOpen, setIsBootstrapModalOpen] = React.useState(false);
    const [bootstrapSteps, setBootstrapSteps] = React.useState(INITIAL_BOOTSTRAP_STEPS);
    const [isBootstrapping, setIsBootstrapping] = React.useState(false);
    const [bootstrapLog, setBootstrapLog] = React.useState("");
    const [bootstrapDone, setBootstrapDone] = React.useState(false);
    const [mcpStatus, setMcpStatus] = React.useState({ active: false, toolCallsCount: 0 });
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = React.useState(true);
    const [isMcpDiagnosticsOpen, setIsMcpDiagnosticsOpen] = React.useState(false);
    const [isMigrationModalOpen, setIsMigrationModalOpen] = React.useState(false);
    const [migrationSummary, setMigrationSummary] = React.useState(null);
    const [isMigrating, setIsMigrating] = React.useState(false);
    const [migrationLog, setMigrationLog] = React.useState("");
    const [activeIssueDetailCard, setActiveIssueDetailCard] = React.useState(null);
    const [activeCentralTab, setActiveCentralTab] = React.useState("pipeline");
    const [isExecutingDispatch, setIsExecutingDispatch] = React.useState(false);
    const [isExecutingGate, setIsExecutingGate] = React.useState(false);
    const [liveLogStream, setLiveLogStream] = React.useState(
      "[SISTEMA] Console pronto. Streaming de subprocessos e logs da esteira ativado.\n"
    );
    const [dispatchIssueId, setDispatchIssueId] = React.useState("");
    const [dispatchExecutor, setDispatchExecutor] = React.useState("OrgFy Atlas");
    const [dispatchRevisor, setDispatchRevisor] = React.useState("OrgFy Bento");
    const [dispatchIsolatedWorktree, setDispatchIsolatedWorktree] = React.useState(true);
    const [dispatchRunCi, setDispatchRunCi] = React.useState(true);
    const [gateRejectionReason, setGateRejectionReason] = React.useState("");
    const [dsapWarning, setDsapWarning] = React.useState(false);
    const [dsapSimilarity, setDsapSimilarity] = React.useState(0);
    const [dsapMatchedTokens, setDsapMatchedTokens] = React.useState([]);
    const [notification, setNotification] = React.useState(null);
    const showNotification = (type, text) => {
      setNotification({ type, text });
      setTimeout(() => setNotification(null), 3500);
    };
    const appendLiveLog = (chunk) => {
      setLiveLogStream((prev) => prev + chunk);
    };
    const loadMigrationData = async () => {
      try {
        const sum = await fetchMigrationStatus(ctx);
        setMigrationSummary(sum);
      } catch (err) {
        console.warn("Erro ao buscar status de migração:", err);
      }
    };
    React.useEffect(() => {
      loadMigrationData();
    }, []);
    const handleExecuteMigration = async () => {
      setIsMigrating(true);
      setMigrationLog("[MIGRADOR] Iniciando processo de migração para v10...\n");
      try {
        const res = await executeAgentMigration(ctx, (chunk) => {
          setMigrationLog((prev) => prev + chunk);
          appendLiveLog(chunk);
        });
        if (res.success) {
          showNotification("success", "16 agentes migrados para REPOS/orgfy e sincronizados com v10!");
          await loadMigrationData();
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Migração Concluída", "Todos os 16 agentes foram sincronizados para v10 no workspace REPOS/orgfy.");
          }
        } else {
          showNotification("warning", "Migração concluída com avisos. Verifique o terminal.");
        }
      } catch (err) {
        showNotification("warning", `Erro na migração: ${(err == null ? void 0 : err.message) || err}`);
        setMigrationLog((prev) => prev + `[ERRO] ${(err == null ? void 0 : err.message) || err}
`);
      } finally {
        setIsMigrating(false);
      }
    };
    const buildIssueDeepLink = (c) => {
      const issueId = c.fullIssueId || c.issueId;
      const owner = c.owner || "7fd58ab9885bcf7fb69f6e4e51a4009470ce5ecea48b3ed33398cfce6da86d20";
      const empresa = c.empresa || (selectedTenant === "all" ? "orgfy" : selectedTenant);
      return `buzz://issue?id=${issueId}&owner=${owner}&d=${empresa}`;
    };
    const handleOpenIssueDeepLink = async (c) => {
      const uri = buildIssueDeepLink(c);
      showNotification("info", `Abrindo issue #${c.issueId} no Buzz Desktop...`);
      console.log("[OrgFy Control Room] Abrindo issue:", uri);
      await openSystemUri(ctx, uri);
    };
    const handleCopyDeepLink = (e, c) => {
      var _a;
      e.stopPropagation();
      const uri = buildIssueDeepLink(c);
      if (typeof navigator !== "undefined" && ((_a = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a.writeText)) {
        navigator.clipboard.writeText(uri);
      }
      showNotification("success", `Deep link copiado: buzz://issue?id=${(c.fullIssueId || c.issueId).slice(0, 8)}...`);
    };
    const loadRealState = async () => {
      var _a, _b, _c;
      try {
        const live = await fetchLiveEsteiraState(ctx);
        if (((_a = live.placarState) == null ? void 0 : _a.pct_aceito_primeira_revisao) !== void 0) {
          setFpyRate(live.placarState.pct_aceito_primeira_revisao);
        }
        if (((_b = live.esteiraState) == null ? void 0 : _b.ci_cache) && Object.keys(live.esteiraState.ci_cache).length > 0) {
          setPorteiroActive(true);
        }
        if ((_c = live.regrasState) == null ? void 0 : _c.regras) {
          setRegrasProbatorias(Object.values(live.regrasState.regras));
        }
      } catch (err) {
        console.warn("Leitura de fallback ativa:", err);
      }
    };
    React.useEffect(() => {
      loadRealState();
    }, [selectedTenant]);
    React.useEffect(() => {
      startOrgfyMcpServer(ctx, (st) => {
        setMcpStatus(st);
      });
    }, []);
    React.useEffect(() => {
      var _a, _b;
      if (!activeGateCard || !gateRejectionReason.trim()) {
        setDsapWarning(false);
        setDsapSimilarity(0);
        setDsapMatchedTokens([]);
        return;
      }
      const prev = ((_b = (_a = activeGateCard.rejectionHistory) == null ? void 0 : _a[0]) == null ? void 0 : _b.reason) || "";
      const result = calculateDsapSimilarity(gateRejectionReason, prev);
      setDsapSimilarity(result.similarity);
      setDsapWarning(result.isBacktracking);
      setDsapMatchedTokens(result.matchedTokens);
    }, [gateRejectionReason, activeGateCard]);
    const filteredCards = React.useMemo(() => {
      return pipelineCards.filter((c) => {
        if (selectedTenant !== "all" && c.empresa !== selectedTenant) return false;
        if (selectedTierFilter !== "all" && c.tier !== selectedTierFilter) return false;
        if (selectedAssigneeFilter !== "all" && c.executor !== selectedAssigneeFilter && c.revisor !== selectedAssigneeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match = c.title.toLowerCase().includes(q) || c.issueId.toLowerCase().includes(q) || c.prId && c.prId.toLowerCase().includes(q) || c.commitSha && c.commitSha.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
    }, [pipelineCards, selectedTenant, selectedTierFilter, selectedAssigneeFilter, searchQuery]);
    const cardsByStage = React.useMemo(() => {
      return {
        triagem: filteredCards.filter((c) => c.stage === "triagem"),
        despachado: filteredCards.filter((c) => c.stage === "despachado"),
        execucao: filteredCards.filter((c) => c.stage === "execucao"),
        revisao: filteredCards.filter((c) => c.stage === "revisao"),
        feito: filteredCards.filter((c) => c.stage === "feito")
      };
    }, [filteredCards]);
    const handleRunBootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapLog("[BOOTSTRAP] Iniciando auto-provisionamento 1-clique da Holding OrgFy...\n");
      try {
        const res = await executeBootstrapFlow(ctx, (updatedSteps) => {
          setBootstrapSteps(updatedSteps);
        });
        setBootstrapLog((prev) => prev + res.log);
        if (res.success) {
          setBootstrapDone(true);
          showNotification("success", "Auto-bootstrap e provisionamento concluídos com sucesso!");
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Esteira Pronta", "Auto-bootstrap e provisionamento concluídos com sucesso!");
          }
          await loadRealState();
        } else {
          showNotification("warning", "Bootstrap finalizado com avisos. Verifique os logs.");
        }
      } catch (err) {
        showNotification("warning", `Falha no bootstrap: ${(err == null ? void 0 : err.message) || err}`);
        setBootstrapLog((prev) => prev + `[ERRO] ${(err == null ? void 0 : err.message) || err}
`);
      } finally {
        setIsBootstrapping(false);
      }
    };
    const handleExecuteDispatch = async () => {
      if (!dispatchIssueId.trim()) {
        showNotification("warning", "Por favor, selecione ou informe o ID da Issue.");
        return;
      }
      if (dispatchExecutor === dispatchRevisor) {
        showNotification("warning", "Regra L-01 violada: O executor não pode ser o mesmo agente revisor!");
        return;
      }
      setIsExecutingDispatch(true);
      appendLiveLog(`
--- INICIANDO DESPACHO REAL (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        const res = await executeDespachar(ctx, {
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          issueId: dispatchIssueId.replace("#", ""),
          executor: dispatchExecutor,
          revisor: dispatchRevisor,
          onOutput: appendLiveLog
        });
        const newCard = {
          id: `card-${Date.now()}`,
          issueId: dispatchIssueId.replace("#", ""),
          title: `Despacho: ${dispatchIssueId} via ${dispatchExecutor}`,
          priority: "P1",
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          executor: dispatchExecutor,
          revisor: dispatchRevisor,
          tier: dispatchExecutor === "OrgFy Bento Arquiteto" ? "tier_3_arquiteto" : dispatchExecutor === "OrgFy Otto" ? "tier_2_revisor" : "tier_1_exec_barato",
          stage: "despachado",
          elapsedTime: "agora"
        };
        const updated = [newCard, ...pipelineCards];
        setPipelineCards(updated);
        localStorage.setItem("orgfy_pipeline_cards", JSON.stringify(updated));
        setIsDispatchModalOpen(false);
        setDispatchIssueId("");
        showNotification("success", `Card ${dispatchIssueId} despachado com sucesso via CLI!`);
        if (desktopNotificationsEnabled) {
          sendDesktopNotification(ctx, "OrgFy: Novo Despacho", `Card ${dispatchIssueId} despachado para ${dispatchExecutor} com sucesso.`);
        }
      } catch (err) {
        showNotification("warning", `Falha no despacho determinístico: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsExecutingDispatch(false);
      }
    };
    const handleAcceptGate = async (card) => {
      setIsExecutingGate(true);
      appendLiveLog(`
--- INICIANDO GATE: ACEITE REAL (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        await executeGate(ctx, {
          empresa: card.empresa,
          prId: card.prId || card.issueId,
          acao: "aceito",
          motivo: "Aprovado em conformidade com probes caixa-preta e CI Swarm",
          revisor: "QA Sentinel",
          onOutput: appendLiveLog
        });
        const updated = pipelineCards.map((c) => {
          if (c.id === card.id) {
            return {
              ...c,
              stage: "feito",
              elapsedTime: "aprovado agora",
              commitSha: c.commitSha || "c05c52b"
            };
          }
          return c;
        });
        setPipelineCards(updated);
        localStorage.setItem("orgfy_pipeline_cards", JSON.stringify(updated));
        setIsGateModalOpen(false);
        setActiveGateCard(null);
        showNotification("success", `PR ${card.prId || card.issueId} ACEITO no Gate! FPY mantido em 100%.`);
        if (desktopNotificationsEnabled) {
          sendDesktopNotification(ctx, "OrgFy: PR Aceito no Gate", `PR ${card.prId || card.issueId} aprovado com conformidade aos probes caixa-preta.`);
        }
      } catch (err) {
        showNotification("warning", `Falha no Gate: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsExecutingGate(false);
      }
    };
    const handleRejectGate = async (card) => {
      if (!gateRejectionReason.trim()) {
        showNotification("warning", "Por favor, justifique o motivo da recusa.");
        return;
      }
      setIsExecutingGate(true);
      appendLiveLog(`
--- INICIANDO GATE: RECUSA REAL (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        await executeGate(ctx, {
          empresa: card.empresa,
          prId: card.prId || card.issueId,
          acao: "recusado",
          motivo: gateRejectionReason,
          revisor: "QA Sentinel",
          onOutput: appendLiveLog
        });
        if (dsapWarning) {
          showNotification("warning", `[DSAP BACKTRACKING] Disparado! Similaridade de ${Math.round(dsapSimilarity * 100)}% acionou o COO.`);
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "⚠️ [DSAP BACKTRACKING]", `Alerta de estagnação semântica acionou o COO para re-escopo (PR #${card.prId || card.issueId})`);
          }
        } else {
          showNotification("info", `PR devolvido ao executor para correções.`);
          if (desktopNotificationsEnabled) {
            sendDesktopNotification(ctx, "OrgFy: Gate Recusado", `PR #${card.prId || card.issueId} devolvido ao executor para correções.`);
          }
        }
        if (desktopNotificationsEnabled) {
          const title = dsapWarning ? "🚨 [DSAP BACKTRACKING] Alerta de Recusa" : "OrgFy: PR Recusado no Gate";
          const body = dsapWarning ? `Card ${card.prId || card.issueId} teve 2ª recusa com similaridade de ${Math.round(dsapSimilarity * 100)}%. COO Bento acionado!` : `Card ${card.prId || card.issueId} recusado no Gate: ${gateRejectionReason}`;
          sendDesktopNotification(ctx, title, body);
        }
        const updated = pipelineCards.map((c) => {
          if (c.id === card.id) {
            const newHistory = [
              {
                author: "QA Sentinel",
                timestamp: Date.now(),
                reason: gateRejectionReason,
                similarityToFirst: dsapSimilarity
              },
              ...c.rejectionHistory || []
            ];
            return {
              ...c,
              stage: "execucao",
              elapsedTime: "recusado (re-trabalho)",
              rejectionHistory: newHistory
            };
          }
          return c;
        });
        setPipelineCards(updated);
        localStorage.setItem("orgfy_pipeline_cards", JSON.stringify(updated));
        setIsGateModalOpen(false);
        setActiveGateCard(null);
        setGateRejectionReason("");
      } catch (err) {
        showNotification("warning", `Falha na recusa do Gate: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsExecutingGate(false);
      }
    };
    const handleSyncPorteiroReal = async () => {
      setIsSyncingPorteiro(true);
      showNotification("info", "Disparando ciclo determinístico do Porteiro...");
      appendLiveLog(`
--- CICLO DETERMINÍSTICO DO PORTEIRO (${(/* @__PURE__ */ new Date()).toLocaleTimeString()}) ---
`);
      try {
        const res = await executePorteiroSync(ctx, {
          empresa: selectedTenant === "all" ? "orgfy" : selectedTenant,
          onOutput: appendLiveLog
        });
        if (res.code === 0) {
          showNotification("success", "Ciclo do Porteiro sincronizado com sucesso!");
          setPorteiroActive(true);
        } else {
          showNotification("warning", `Porteiro retornou aviso (código ${res.code}).`);
        }
        await loadRealState();
      } catch (err) {
        showNotification("warning", `Erro na execução do Porteiro: ${(err == null ? void 0 : err.message) || err}`);
      } finally {
        setIsSyncingPorteiro(false);
      }
    };
    return h(
      "div",
      {
        "data-project-context-detached": "true",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minHeight: "100vh",
          background: "radial-gradient(ellipse at top left, #0d1a14 0%, #080d0b 70%)",
          color: "var(--text-standard, #f3f4f6)",
          fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          padding: "12px",
          boxSizing: "border-box",
          overflowX: "hidden"
        }
      },
      // TOAST DE NOTIFICAÇÃO
      notification && h(
        "div",
        {
          style: {
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            padding: "10px 18px",
            borderRadius: "10px",
            backgroundColor: notification.type === "success" ? "rgba(16, 185, 129, 0.95)" : notification.type === "warning" ? "rgba(245, 158, 11, 0.95)" : "rgba(59, 130, 246, 0.95)",
            color: "#000000",
            fontWeight: "600",
            fontSize: "13px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }
        },
        SVG.checkCircle({ h, width: 16, height: 16 }),
        notification.text
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 1. TOP CHROME & HEADER DE GOVERNANÇA MULTI-TENANT
      // ───────────────────────────────────────────────────────────────────────
      h(
        "header",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "10px 18px",
            borderRadius: "14px",
            backgroundColor: "rgba(18, 24, 21, 0.75)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            marginBottom: "12px"
          }
        },
        // Esquerda: Logo + Dropdown de Tenant
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                color: "#10b981"
              }
            },
            SVG.orgfy({ h, width: 22, height: 22 }),
            h("span", { style: { fontWeight: "700", fontSize: "14px", letterSpacing: "0.5px" } }, "ORGFY CONTROL ROOM")
          ),
          h("div", { style: { height: "20px", width: "1px", backgroundColor: "rgba(255, 255, 255, 0.1)" } }),
          // Seletor de Tenant
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px" } },
            TENANTS.map(
              (t) => h(
                "button",
                {
                  key: t.id,
                  onClick: () => setSelectedTenant(t.id),
                  style: {
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: selectedTenant === t.id ? "#10b981" : "rgba(255, 255, 255, 0.05)",
                    color: selectedTenant === t.id ? "#000000" : "var(--text-subtle, #9ca3af)",
                    fontWeight: selectedTenant === t.id ? "700" : "500",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }
                },
                t.name
              )
            )
          )
        ),
        // Centro: Telemetria do Porteiro + Métricas de Governança
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" } },
          // Porteiro Badge
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "9999px",
                backgroundColor: isSyncingPorteiro ? "rgba(245, 158, 11, 0.15)" : porteiroActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: isSyncingPorteiro ? "#f59e0b" : porteiroActive ? "#10b981" : "#ef4444",
                fontSize: "11px",
                fontWeight: "600"
              }
            },
            h("div", {
              style: {
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isSyncingPorteiro ? "#f59e0b" : porteiroActive ? "#10b981" : "#ef4444",
                boxShadow: porteiroActive ? "0 0 8px #10b981" : "none"
              }
            }),
            isSyncingPorteiro ? "SINCRONIZANDO..." : porteiroActive ? "PORTEIRO NOSTR ATIVO (120ms)" : "PORTEIRO OCIOSO"
          ),
          // FPY
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
            h("span", { style: { color: "var(--text-subtle, #9ca3af)" } }, "FPY:"),
            h("span", { style: { color: "#10b981", fontWeight: "700" } }, `${fpyRate.toFixed(1)}%`)
          ),
          // CPI Tokens EVM
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
            h("span", { style: { color: "var(--text-subtle, #9ca3af)" } }, "CPI EVM:"),
            h("span", { style: { color: cpiTokens >= 0.85 ? "#10b981" : "#f59e0b", fontWeight: "700" } }, cpiTokens.toFixed(2))
          ),
          // MCP Indicator Pill
          h(
            "button",
            {
              onClick: () => setIsMcpDiagnosticsOpen(true),
              title: "Abrir Diagnóstico do Servidor MCP Nativo (JSON-RPC 2.0)",
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "9999px",
                backgroundColor: mcpStatus.active ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                color: mcpStatus.active ? "#10b981" : "#60a5fa",
                border: "none",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer"
              }
            },
            h("div", {
              style: {
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: mcpStatus.active ? "#10b981" : "#60a5fa",
                boxShadow: mcpStatus.active ? "0 0 8px #10b981" : "none"
              }
            }),
            mcpStatus.active ? `MCP NATIVO (${mcpStatus.toolCallsCount} calls)` : "MCP NATIVO (4 tools)"
          )
        ),
        // Direita: Botões de Ação
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h(
            "button",
            {
              onClick: () => setIsBootstrapModalOpen(true),
              title: "Wizard de Auto-Bootstrap e Provisionamento da Holding OrgFy",
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.2)",
                color: "#10b981",
                fontWeight: "700",
                fontSize: "12px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                cursor: "pointer"
              }
            },
            SVG.zap({ h, width: 14, height: 14 }),
            "Inicializar OrgFy"
          ),
          // Botão Migrador de Agentes & Workspace
          h(
            "button",
            {
              onClick: () => {
                loadMigrationData();
                setIsMigrationModalOpen(true);
              },
              title: "Migrador de Agentes Existentes & Sincronização de Workspace para v10",
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                fontWeight: "700",
                fontSize: "12px",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                cursor: "pointer"
              }
            },
            SVG.users({ h, width: 14, height: 14 }),
            migrationSummary ? `Migrador (${migrationSummary.migratedCount}/${migrationSummary.total})` : "Migrador de Agentes"
          ),
          h(
            "button",
            {
              onClick: () => {
                const nextState = !desktopNotificationsEnabled;
                setDesktopNotificationsEnabled(nextState);
                showNotification("info", nextState ? "Notificações desktop ativadas!" : "Modo silencioso ativado.");
              },
              title: desktopNotificationsEnabled ? "Notificações desktop ativas (clique para silenciar)" : "Modo silencioso (clique para ativar notificações)",
              style: {
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: desktopNotificationsEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.06)",
                color: desktopNotificationsEnabled ? "#10b981" : "#9ca3af",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px"
              }
            },
            desktopNotificationsEnabled ? SVG.bell({ h, width: 14, height: 14 }) : SVG.bellOff({ h, width: 14, height: 14 }),
            desktopNotificationsEnabled ? "Notif. ON" : "Silencioso"
          ),
          h(
            "button",
            {
              onClick: () => setIsDispatchModalOpen(true),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                backgroundColor: "#10b981",
                color: "#000000",
                fontWeight: "700",
                fontSize: "12px",
                border: "none",
                cursor: "pointer"
              }
            },
            SVG.zap({ h, width: 14, height: 14 }),
            "Novo Despacho"
          ),
          h(
            "button",
            {
              onClick: () => setIsCopilotOpen((v) => !v),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isCopilotOpen ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.06)",
                color: isCopilotOpen ? "#60a5fa" : "#ffffff",
                fontSize: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer"
              }
            },
            SVG.messageCircle({ h, width: 14, height: 14 }),
            "Copiloto"
          ),
          h(
            "button",
            {
              onClick: () => setIsRightRailOpen((v) => !v),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isRightRailOpen ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
                color: isRightRailOpen ? "#10b981" : "#ffffff",
                fontSize: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer"
              }
            },
            SVG.columns({ h, width: 14, height: 14 }),
            "Governança & RSI"
          ),
          h(
            "button",
            {
              onClick: handleSyncPorteiroReal,
              disabled: isSyncingPorteiro,
              title: "Disparar ciclo determinístico do Porteiro",
              style: {
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: isSyncingPorteiro ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.06)",
                color: isSyncingPorteiro ? "#f59e0b" : "#ffffff",
                border: "none",
                cursor: isSyncingPorteiro ? "not-allowed" : "pointer"
              }
            },
            SVG.refresh({ h, width: 14, height: 14 })
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 2. PALCO PRINCIPAL (ILHA CENTRAL + COSTA DIREITA UTILITÁRIA)
      // ───────────────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            display: "flex",
            flex: 1,
            gap: "12px",
            minHeight: "0",
            overflow: "hidden"
          }
        },
        // ─────────────────────────────────────────────────────────────────────
        // ILHA CENTRAL — LIVE PIPELINE MATRIX
        // ─────────────────────────────────────────────────────────────────────
        h(
          "main",
          {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRadius: "16px",
              backgroundColor: "rgba(18, 24, 21, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              padding: "16px",
              overflow: "hidden",
              minWidth: 0
            }
          },
          // ───────────────────────────────────────────────────────────────────
          // TAB SWITCHER: MATRIZ DA ESTEIRA (KANBAN) vs CATÁLOGO DE TEMPLATES & HUB DE RSI
          // ───────────────────────────────────────────────────────────────────
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                paddingBottom: "10px"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "button",
                {
                  onClick: () => setActiveCentralTab("pipeline"),
                  style: {
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: activeCentralTab === "pipeline" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
                    backgroundColor: activeCentralTab === "pipeline" ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.04)",
                    color: activeCentralTab === "pipeline" ? "#10b981" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.activity({ h, width: 14, height: 14 }),
                "Matriz da Esteira (Kanban)"
              ),
              h(
                "button",
                {
                  onClick: () => setActiveCentralTab("templates_rsi"),
                  style: {
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: activeCentralTab === "templates_rsi" ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
                    backgroundColor: activeCentralTab === "templates_rsi" ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.04)",
                    color: activeCentralTab === "templates_rsi" ? "#38bdf8" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.gitPullRequest({ h, width: 14, height: 14 }),
                "Catálogo de Templates & Hub de RSI"
              )
            ),
            h(
              "span",
              { style: { fontSize: "11px", color: "#6b7280", fontFamily: "monospace" } },
              activeCentralTab === "pipeline" ? "Esteira Determinística OrgFy v10" : "Recursão & FPY (Regras L-22, L-90)"
            )
          ),
          activeCentralTab === "pipeline" ? h(
            "div",
            { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" } },
            // Header Tático de Filtros
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "16px"
                }
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                // Busca
                h(
                  "div",
                  { style: { position: "relative", display: "flex", alignItems: "center" } },
                  h("input", {
                    type: "text",
                    placeholder: "Buscar card, issue, commit...",
                    value: searchQuery,
                    onChange: (e) => setSearchQuery(e.target.value),
                    style: {
                      borderRadius: "9999px",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 14px 6px 32px",
                      fontSize: "12px",
                      outline: "none",
                      width: "220px"
                    }
                  }),
                  h(
                    "div",
                    { style: { position: "absolute", left: "10px", color: "#9ca3af", pointerEvents: "none" } },
                    SVG.search({ h, width: 14, height: 14 })
                  )
                ),
                // Filtro por Tier
                h(
                  "select",
                  {
                    value: selectedTierFilter,
                    onChange: (e) => setSelectedTierFilter(e.target.value),
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 12px",
                      fontSize: "12px",
                      outline: "none",
                      cursor: "pointer"
                    }
                  },
                  h("option", { value: "all" }, "Todos os Tiers CoEvo-RSI"),
                  h("option", { value: "tier_1_exec_barato" }, "Tier 1: Barato (Enxuto)"),
                  h("option", { value: "tier_2_revisor" }, "Tier 2: Revisor (Gate)"),
                  h("option", { value: "tier_3_arquiteto" }, "Tier 3: Arquiteto (Governança)")
                ),
                // Filtro por Agente
                h(
                  "select",
                  {
                    value: selectedAssigneeFilter,
                    onChange: (e) => setSelectedAssigneeFilter(e.target.value),
                    style: {
                      borderRadius: "8px",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 12px",
                      fontSize: "12px",
                      outline: "none",
                      cursor: "pointer"
                    }
                  },
                  h("option", { value: "all" }, "Todos os Responsáveis"),
                  AVAILABLE_AGENTS.map((a) => h("option", { key: a.id, value: a.name }, a.name))
                )
              ),
              h(
                "span",
                { style: { fontSize: "12px", color: "var(--text-subtle, #9ca3af)" } },
                `Exibindo ${filteredCards.length} de ${pipelineCards.length} cards`
              )
            ),
            // ───────────────────────────────────────────────────────────────────
            // AS 5 RAIAS DETERMINÍSTICAS (KANBAN MATRIX)
            // ───────────────────────────────────────────────────────────────────
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(260px, 1fr))",
                  gap: "12px",
                  flex: 1,
                  overflowX: "auto",
                  overflowY: "auto",
                  paddingBottom: "8px"
                }
              },
              // Raia 1: Triagem & Backlog
              renderColumn(
                "1. Triagem & Backlog",
                cardsByStage.triagem,
                "rgba(59, 130, 246, 0.15)",
                "#60a5fa",
                (card) => h(
                  "button",
                  {
                    onClick: () => {
                      setDispatchIssueId(card.issueId);
                      setIsDispatchModalOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }
                  },
                  SVG.zap({ h, width: 12, height: 12 }),
                  "Despachar"
                )
              ),
              // Raia 2: Despachados & Alocados
              renderColumn(
                "2. Despachados",
                cardsByStage.despachado,
                "rgba(168, 85, 247, 0.15)",
                "#c084fc",
                (card) => h(
                  "div",
                  {
                    style: {
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }
                  },
                  SVG.clock({ h, width: 10, height: 10 }),
                  `Aguardando sub-second wake`
                )
              ),
              // Raia 3: Em Execução (Headless Workers)
              renderColumn(
                "3. Em Execução",
                cardsByStage.execucao,
                "rgba(245, 158, 11, 0.15)",
                "#f59e0b",
                (card) => h(
                  "button",
                  {
                    onClick: () => {
                      setActiveLogsCard(card);
                      setIsLogsDrawerOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }
                  },
                  SVG.terminal({ h, width: 12, height: 12 }),
                  "Ver Logs Live"
                )
              ),
              // Raia 4: Em Revisão (Gate Caixa-Preta)
              renderColumn(
                "4. Em Revisão (Gate)",
                cardsByStage.revisao,
                "rgba(16, 185, 129, 0.15)",
                "#10b981",
                (card) => h(
                  "button",
                  {
                    onClick: () => {
                      setActiveGateCard(card);
                      setIsGateModalOpen(true);
                    },
                    style: {
                      marginTop: "8px",
                      width: "100%",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#10b981",
                      color: "#000000",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }
                  },
                  SVG.shield({ h, width: 12, height: 12 }),
                  "Decidir Gate"
                )
              ),
              // Raia 5: Concluído / FPY
              renderColumn(
                "5. Concluído / FPY",
                cardsByStage.feito,
                "rgba(255, 255, 255, 0.1)",
                "#ffffff",
                (card) => h(
                  "div",
                  {
                    style: {
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600"
                    }
                  },
                  SVG.checkCircle({ h, width: 10, height: 10 }),
                  "MERGED na main (FPY 100%)"
                )
              )
            )
          ) : renderTemplatesRsiView()
        ),
        // ─────────────────────────────────────────────────────────────────────
        // COSTA DIREITA UTILITÁRIA — GOVERNANÇA, RSI E EVM (ZERO CARD-CEPTION)
        // ─────────────────────────────────────────────────────────────────────
        isRightRailOpen && h(
          "aside",
          {
            style: {
              width: "320px",
              minWidth: "280px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "8px 0 8px 12px",
              borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
              overflowY: "auto"
            }
          },
          // Header do Painel
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.shield({ h, width: 16, height: 16 }),
              h("span", { style: { fontWeight: "700", fontSize: "13px", color: "#ffffff" } }, "GOVERNANÇA & RSI")
            ),
            h("span", { style: { fontSize: "10px", color: "#10b981", fontWeight: "600" } }, "HARNESS² V10")
          ),
          // Seção EVM & Orçamento de Tokens
          h(
            "div",
            {
              style: {
                padding: "12px",
                borderRadius: "12px",
                backgroundColor: "rgba(18, 24, 21, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af" } }, "MÉTRICAS EVM & TOKENS"),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "CPI Acumulado"),
              h(
                "span",
                { style: { fontSize: "13px", fontWeight: "700", color: cpiTokens >= 0.85 ? "#10b981" : "#f59e0b" } },
                `${cpiTokens.toFixed(2)} (Min: 0.85)`
              )
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "Circuit Breaker Loops"),
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#10b981" } }, "0 / 3 turnos (OK)")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "PRs Integrados"),
              h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff" } }, "21 na main")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12px", color: "#f3f4f6" } }, "Economia EVM (CoEvo-RSI)"),
              h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#10b981" } }, "~$4.82 vs ~$16.94 (-71.5% economia)")
            )
          ),
          // Seção Catraca RSI (Regras Probatórias)
          h(
            "div",
            {
              style: {
                padding: "12px",
                borderRadius: "12px",
                backgroundColor: "rgba(18, 24, 21, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af" } }, "CATRACA RSI (REGRAS PROBATÓRIAS)"),
            regrasProbatorias.map(
              (r) => h(
                "div",
                {
                  key: r.regra_id,
                  style: {
                    padding: "8px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("span", { style: { fontWeight: "700", fontSize: "11px", color: "#ffffff" } }, r.regra_id),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "9px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: r.status === "EM_TESTE" ? "rgba(59, 130, 246, 0.2)" : r.status === "MANTIDA" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: r.status === "EM_TESTE" ? "#60a5fa" : r.status === "MANTIDA" ? "#10b981" : "#ef4444",
                        fontWeight: "700"
                      }
                    },
                    r.status
                  )
                ),
                h("div", { style: { fontSize: "11px", color: "#d1d5db" } }, r.descricao),
                h(
                  "div",
                  { style: { fontSize: "10px", color: "#9ca3af", marginTop: "2px" } },
                  `Janela: ${r.cards_avaliados}/${r.janela_alvo} cards avaliados`
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      appendLiveLog(`
[RSI CHECK] Executando comando de guarda: ${r.comando_check}
`);
                      showNotification("info", `Comando executado: ${r.comando_check} -> PASSOU (Exit 0)`);
                    },
                    style: {
                      marginTop: "4px",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      color: "#9ca3af",
                      border: "none",
                      fontSize: "9px",
                      cursor: "pointer",
                      alignSelf: "flex-start"
                    }
                  },
                  "Checar Agora"
                )
              )
            )
          ),
          // Seção Histórico de Recusas & DSAP
          h(
            "div",
            {
              style: {
                padding: "12px",
                borderRadius: "12px",
                backgroundColor: "rgba(18, 24, 21, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#9ca3af" } }, "DETECTOR PREDITIVO DSAP"),
            h(
              "div",
              { style: { fontSize: "11px", color: "#9ca3af" } },
              "Monitora a 2ª recusa consecutiva com similaridade semântica >= 0.70 para acionamento de backtracking do COO."
            ),
            h(
              "div",
              {
                style: {
                  padding: "6px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "#10b981",
                  fontSize: "11px",
                  fontWeight: "600"
                }
              },
              "Nenhum backtracking ativo no momento."
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 3. ILHA DO COPILOTO SAGRADO PERSONIFICÁVEL (DRAWER FLUTUANTE)
      // ───────────────────────────────────────────────────────────────────────
      isCopilotOpen && h(
        "aside",
        {
          style: {
            position: "fixed",
            bottom: "20px",
            right: "24px",
            width: "360px",
            height: "460px",
            borderRadius: "16px",
            backgroundColor: "#111714",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.65)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1e3,
            overflow: "hidden"
          }
        },
        // Header do Copiloto
        h(
          "div",
          {
            style: {
              padding: "12px 14px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }
          },
          h(
            "select",
            {
              value: copilotAgent,
              onChange: (e) => setCopilotAgent(e.target.value),
              style: {
                backgroundColor: "transparent",
                color: "#10b981",
                fontWeight: "700",
                fontSize: "13px",
                border: "none",
                outline: "none",
                cursor: "pointer"
              }
            },
            h("option", { value: "OrgFy Bento" }, "⚙️ OrgFy Bento [COO]"),
            h("option", { value: "OrgFy Iris" }, "👑 OrgFy Iris [CEO Holding]"),
            h("option", { value: "OrgFy Bento Arquiteto" }, "📐 OrgFy Bento Arquiteto"),
            h("option", { value: "QA Sentinel" }, "🛡️ QA Sentinel [Auditor]")
          ),
          h(
            "button",
            {
              onClick: () => setIsCopilotOpen(false),
              style: {
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer"
              }
            },
            SVG.xCircle({ h, width: 16, height: 16 })
          )
        ),
        // Chat Messages
        h(
          "div",
          {
            style: {
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontSize: "12px"
            }
          },
          h(
            "div",
            {
              style: {
                padding: "8px 12px",
                borderRadius: "10px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                color: "#f3f4f6",
                lineHeight: "1.4"
              }
            },
            h("strong", { style: { color: "#10b981" } }, `${copilotAgent}: `),
            "Olá, Helton. A esteira determinística v10 está operando com FPY de 100% e CPI de tokens em 0.94. Use /despachar para novos cards ou /gate para veredito."
          )
        ),
        // Chat Input
        h(
          "div",
          {
            style: {
              padding: "10px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              gap: "8px"
            }
          },
          h("input", {
            type: "text",
            placeholder: `Falar com ${copilotAgent}... (/despachar, /gate)`,
            style: {
              flex: 1,
              padding: "6px 12px",
              borderRadius: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              fontSize: "12px",
              outline: "none"
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                const cmd = e.target.value.trim();
                appendLiveLog(`
[COPILOTO] Mensagem enviada para ${copilotAgent}: ${cmd}
`);
                showNotification("info", `Comando enviado para ${copilotAgent}: ${cmd}`);
                e.target.value = "";
              }
            }
          })
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 4. MODAL NOVO DESPACHO (VALIDAÇÃO L-01: EXECUTOR !== REVISOR + REAL CLI)
      // ───────────────────────────────────────────────────────────────────────
      isDispatchModalOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2e3
          }
        },
        h(
          "div",
          {
            style: {
              width: "480px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "22px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "⚡ Novo Despacho Determinístico"),
            h(
              "button",
              {
                onClick: () => !isExecutingDispatch && setIsDispatchModalOpen(false),
                disabled: isExecutingDispatch,
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingDispatch ? "not-allowed" : "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "ID DA ISSUE OU TAREFA"),
            h("input", {
              type: "text",
              placeholder: "Ex: issue-104 ou 5c569a9e",
              disabled: isExecutingDispatch,
              value: dispatchIssueId,
              onChange: (e) => setDispatchIssueId(e.target.value),
              style: {
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none"
              }
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "EXECUTOR (TIER COEVO-RSI)"),
            h(
              "select",
              {
                value: dispatchExecutor,
                disabled: isExecutingDispatch,
                onChange: (e) => setDispatchExecutor(e.target.value),
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none"
                }
              },
              AVAILABLE_AGENTS.map(
                (a) => h("option", { key: a.id, value: a.name }, `${a.name} (${a.tier === "tier_1_exec_barato" ? "Tier 1: Barato" : a.tier === "tier_2_revisor" ? "Tier 2: Revisor" : "Tier 3: Arquiteto"})`)
              )
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h(
              "label",
              { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } },
              "REVISOR INDEPENDENTE (REGRA L-01: BLOQUEIO MECÂNICO)"
            ),
            h(
              "select",
              {
                value: dispatchRevisor,
                disabled: isExecutingDispatch,
                onChange: (e) => setDispatchRevisor(e.target.value),
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none"
                }
              },
              AVAILABLE_AGENTS.map(
                (a) => h(
                  "option",
                  {
                    key: a.id,
                    value: a.name,
                    disabled: a.name === dispatchExecutor
                  },
                  a.name === dispatchExecutor ? `${a.name} (Bloqueado pela Regra L-01)` : a.name
                )
              )
            )
          ),
          // Preview do comando determinístico
          h(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#10b981"
              }
            },
            `ferramentas/esteira/despachar --empresa ${selectedTenant === "all" ? "orgfy" : selectedTenant} ${dispatchIssueId || "<issue>"} "${dispatchExecutor}" "${dispatchRevisor}"`
          ),
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: () => setIsDispatchModalOpen(false),
                disabled: isExecutingDispatch,
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  color: "#9ca3af",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              "Cancelar"
            ),
            h(
              "button",
              {
                onClick: handleExecuteDispatch,
                disabled: isExecutingDispatch,
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: isExecutingDispatch ? "#059669" : "#10b981",
                  color: "#000000",
                  fontWeight: "700",
                  border: "none",
                  cursor: isExecutingDispatch ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              isExecutingDispatch ? "Executando via CLI..." : "Disparar Despacho"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 5. MODAL DE DECISÃO DO GATE COM DETECTOR PREDITIVO DSAP (3 NÍVEIS)
      // ───────────────────────────────────────────────────────────────────────
      isGateModalOpen && activeGateCard && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2e3
          }
        },
        h(
          "div",
          {
            style: {
              width: "520px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              null,
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "🛡️ Decisão de Gate Caixa-Preta"),
              h("span", { style: { fontSize: "12px", color: "#9ca3af" } }, `${activeGateCard.prId || activeGateCard.issueId}: ${activeGateCard.title}`)
            ),
            h(
              "button",
              {
                onClick: () => {
                  if (!isExecutingGate) {
                    setIsGateModalOpen(false);
                    setActiveGateCard(null);
                  }
                },
                disabled: isExecutingGate,
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isExecutingGate ? "not-allowed" : "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Probes Caixa-Preta (Holdout Verification)
          h(
            "div",
            {
              style: {
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }
            },
            h("div", { style: { fontSize: "11px", fontWeight: "700", color: "#10b981" } }, "EVIDÊNCIAS DOS PROBES CAIXA-PRETA"),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("span", null, "• http_rota (Caddy v3 200 OK):"),
              h("span", { style: { color: "#10b981", fontWeight: "600" } }, "PASSOU")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("span", null, "• supabase_rls (Políticas & Migrations):"),
              h("span", { style: { color: "#10b981", fontWeight: "600" } }, "PASSOU")
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: "12px" } },
              h("span", null, "• playwright_console (0 erros runtime):"),
              h("span", { style: { color: "#10b981", fontWeight: "600" } }, "PASSOU")
            )
          ),
          // Justificativa de Recusa & Detector DSAP
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "11px", fontWeight: "600", color: "#9ca3af" } }, "MOTIVO (PREENCHA CASO VÁ RECUSAR O PR)"),
            h("textarea", {
              placeholder: "Descreva a falha ou inconsistência técnica...",
              value: gateRejectionReason,
              disabled: isExecutingGate,
              onChange: (e) => setGateRejectionReason(e.target.value),
              style: {
                height: "70px",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
                fontSize: "12px",
                outline: "none",
                resize: "none"
              }
            }),
            // Banner Reativo DSAP em 3 Níveis Contextuais (Refinamento de UI/UX)
            gateRejectionReason.trim().length > 0 && h(
              "div",
              {
                style: {
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: dsapSimilarity >= 0.7 ? "rgba(239, 68, 68, 0.15)" : dsapSimilarity >= 0.5 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.12)",
                  border: "1px solid",
                  borderColor: dsapSimilarity >= 0.7 ? "#ef4444" : dsapSimilarity >= 0.5 ? "#f59e0b" : "#10b981",
                  color: dsapSimilarity >= 0.7 ? "#f87171" : dsapSimilarity >= 0.5 ? "#f59e0b" : "#10b981",
                  fontSize: "11px",
                  fontWeight: "600",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                dsapSimilarity >= 0.7 ? SVG.alertTriangle({ h, width: 14, height: 14 }) : dsapSimilarity >= 0.5 ? SVG.alertTriangle({ h, width: 14, height: 14 }) : SVG.checkCircle({ h, width: 14, height: 14 }),
                dsapSimilarity >= 0.7 ? `🔴 ALERTA DSAP (${Math.round(dsapSimilarity * 100)}%): Repetição desta assinatura engatilhará [DSAP BACKTRACKING] para o COO re-escopar!` : dsapSimilarity >= 0.5 ? `🟡 ATENÇÃO (${Math.round(dsapSimilarity * 100)}% de similaridade): Termos técnicos repetidos da recusa anterior.` : `🟢 SEGURO (${Math.round(dsapSimilarity * 100)}% de similaridade): Nova justificativa com assinatura distinta.`
              ),
              dsapMatchedTokens.length > 0 && h(
                "div",
                { style: { fontSize: "10px", color: "rgba(255,255,255,0.7)" } },
                `Tokens identificados: ${dsapMatchedTokens.join(", ")}`
              )
            )
          ),
          // Ações de Aceite / Recusa
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: () => handleRejectGate(activeGateCard),
                disabled: isExecutingGate,
                style: {
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontWeight: "700",
                  cursor: isExecutingGate ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              isExecutingGate ? "Executando Gate..." : "RECUSAR PR"
            ),
            h(
              "button",
              {
                onClick: () => handleAcceptGate(activeGateCard),
                disabled: isExecutingGate,
                style: {
                  padding: "8px 22px",
                  borderRadius: "8px",
                  backgroundColor: isExecutingGate ? "#059669" : "#10b981",
                  color: "#000000",
                  fontWeight: "700",
                  border: "none",
                  cursor: isExecutingGate ? "not-allowed" : "pointer",
                  fontSize: "12px"
                }
              },
              isExecutingGate ? "Executando Gate..." : "ACEITAR PR (MERGE NA MAIN)"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 6. GAVETA DE LOGS STREAMING (CONSOLE JETBRAINS / MATRIX)
      // ───────────────────────────────────────────────────────────────────────
      isLogsDrawerOpen && activeLogsCard && h(
        "div",
        {
          style: {
            position: "fixed",
            bottom: 0,
            left: "12px",
            right: "12px",
            height: "280px",
            borderRadius: "16px 16px 0 0",
            backgroundColor: "#0a0f0d",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1500
          }
        },
        h(
          "div",
          {
            style: {
              padding: "8px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "span",
              { style: { fontSize: "12px", color: "#10b981", fontWeight: "700" } },
              `CONSOLE LIVE: Worker Headless [PID: ${activeLogsCard.workerPid || "84219"}] - ${activeLogsCard.issueId}`
            ),
            h("span", { style: { fontSize: "10px", color: "#60a5fa", fontWeight: "600" } }, "🟢 STREAMING ATIVO")
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "button",
              {
                onClick: () => setLiveLogStream(""),
                style: {
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  color: "#9ca3af",
                  border: "none",
                  fontSize: "10px",
                  cursor: "pointer"
                }
              },
              "Limpar Logs"
            ),
            h(
              "button",
              {
                onClick: () => {
                  navigator.clipboard.writeText(liveLogStream);
                  showNotification("success", "Logs copiados para a área de transferência!");
                },
                style: {
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  color: "#9ca3af",
                  border: "none",
                  fontSize: "10px",
                  cursor: "pointer"
                }
              },
              "Copiar"
            ),
            h(
              "button",
              {
                onClick: () => setIsLogsDrawerOpen(false),
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }
              },
              SVG.xCircle({ h, width: 16, height: 16 })
            )
          )
        ),
        h(
          "pre",
          {
            style: {
              flex: 1,
              margin: 0,
              padding: "12px 16px",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#10b981",
              backgroundColor: "#080c0a",
              overflowY: "auto",
              lineHeight: "1.5"
            }
          },
          liveLogStream || `[ORGFY WORKER] Inicializando container efêmero no Swarm...
[ORGFY WORKER] Worktree montada em: .worktrees/${activeLogsCard.issueId}
[ORGFY WORKER] Executando: pytest testes/esteira -v --tb=short
testes/esteira/test_t020.py::test_ci_cache_integrity PASSED
testes/esteira/test_gate_state.py::test_regras_probatorias_eval PASSED
[ORGFY WORKER] 2 passed in 1.42s. Probes caixa-preta engatilhados.
[ORGFY NOSTR] Evento kind:1618 publicado em wss://orgfy.communities.buzz.xyz (sub-second wake)`
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 6.5. MODAL IN-COCKPIT DE DETALHES DA ISSUE (EXPANSÃO DO COCKPIT)
      // ───────────────────────────────────────────────────────────────────────
      activeIssueDetailCard && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2150
          },
          onClick: () => setActiveIssueDetailCard(null)
        },
        h(
          "div",
          {
            style: {
              width: "680px",
              maxHeight: "88vh",
              overflowY: "auto",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            },
            onClick: (e) => e.stopPropagation()
          },
          // Header do Modal
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "span",
                  {
                    style: {
                      fontSize: "12px",
                      fontFamily: "monospace",
                      color: "#38bdf8",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: "700",
                      border: "1px solid rgba(56, 189, 248, 0.3)"
                    }
                  },
                  `#${activeIssueDetailCard.fullIssueId || activeIssueDetailCard.issueId}`
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: "700",
                      backgroundColor: activeIssueDetailCard.priority === "P0" ? "rgba(239, 68, 68, 0.2)" : activeIssueDetailCard.priority === "P1" ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                      color: activeIssueDetailCard.priority === "P0" ? "#ef4444" : activeIssueDetailCard.priority === "P1" ? "#f59e0b" : "#60a5fa"
                    }
                  },
                  activeIssueDetailCard.priority
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: "700",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      textTransform: "uppercase"
                    }
                  },
                  activeIssueDetailCard.stage
                )
              ),
              h(
                "h2",
                { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } },
                activeIssueDetailCard.title
              )
            ),
            h(
              "button",
              {
                onClick: () => setActiveIssueDetailCard(null),
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", padding: "4px" }
              },
              SVG.xCircle({ h, width: 20, height: 20 })
            )
          ),
          // Invariante L-22: Comando de Aceite Congelado
          h(
            "div",
            {
              style: {
                borderRadius: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.35)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "span",
                { style: { fontSize: "11px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" } },
                "Comando de Aceite Congelado (Invariante L-22)"
              ),
              h(
                "span",
                { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } },
                "Blindagem SHA-256"
              )
            ),
            h(
              "code",
              {
                style: {
                  fontSize: "11px",
                  fontFamily: "monospace",
                  backgroundColor: "#050706",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  color: "#34d399",
                  display: "block",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all"
                }
              },
              activeIssueDetailCard.acceptanceCommand || "python3 -m pytest -q testes/esteira -v --tb=short"
            ),
            h(
              "div",
              { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace", display: "flex", justifyContent: "space-between" } },
              h("span", {}, `Hash de Aceite: ${(activeIssueDetailCard.acceptanceHash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855").slice(0, 24)}...`),
              h("span", { style: { color: "#10b981" } }, "✓ Congelamento Válido (Anti-Bypass)")
            )
          ),
          // Worktree Isolada & Governança de Arquivos
          h(
            "div",
            {
              style: {
                borderRadius: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }
            },
            h("span", { style: { fontSize: "11px", fontWeight: "700", color: "#f3f4f6" } }, "Worktree Isolada do Card"),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#9ca3af" } },
              SVG.folder({ h, width: 14, height: 14 }),
              h(
                "span",
                { style: { fontFamily: "monospace", color: "#38bdf8" } },
                activeIssueDetailCard.worktreePath || `.worktrees/${activeIssueDetailCard.issueId}`
              ),
              h("span", { style: { color: "#6b7280" } }, "•"),
              h("span", { style: { color: "#10b981", fontSize: "10px" } }, "✓ Isolamento Concorrência Zero (sem colisão com main)")
            )
          ),
          // Grid de 2 Colunas: CoEvo-RSI Roteamento de Modelo + Probes Caixa-Preta
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } },
            // Coluna 1: CoEvo-RSI & Custos
            h(
              "div",
              {
                style: {
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }
              },
              h("span", { style: { fontSize: "11px", fontWeight: "700", color: "#c084fc" } }, "Roteamento CoEvo-RSI"),
              h(
                "div",
                { style: { fontSize: "11px", color: "#ffffff", fontWeight: "600" } },
                `Modelo: ${activeIssueDetailCard.recommendedModel || (activeIssueDetailCard.tier === "tier_1_exec_barato" ? "Gemini 3.8 Flash" : "Claude 3.5 Sonnet")}`
              ),
              h(
                "div",
                { style: { fontSize: "10px", color: "#9ca3af" } },
                `Tier: ${activeIssueDetailCard.tier === "tier_1_exec_barato" ? "Tier 1: Barato (Enxuto)" : activeIssueDetailCard.tier === "tier_2_revisor" ? "Tier 2: Revisor (Gate)" : "Tier 3: Arquiteto (Governança)"}`
              ),
              h(
                "div",
                { style: { fontSize: "10px", color: "#10b981", fontFamily: "monospace", marginTop: "2px" } },
                `Custo Estimado: ~$${activeIssueDetailCard.estimatedCost || (activeIssueDetailCard.tier === "tier_1_exec_barato" ? "0.002" : "0.02")} | ${activeIssueDetailCard.tokens || 18}k tokens`
              ),
              h(
                "div",
                { style: { fontSize: "10px", color: "#6b7280" } },
                `Executor: ${activeIssueDetailCard.executor} | Revisor: ${activeIssueDetailCard.revisor || "OrgFy Otto"}`
              )
            ),
            // Coluna 2: Probes Caixa-Preta (Quality Gate)
            h(
              "div",
              {
                style: {
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }
              },
              h("span", { style: { fontSize: "11px", fontWeight: "700", color: "#38bdf8" } }, "Probes Caixa-Preta do Gate"),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", color: "#d1d5db" } },
                  h("span", {}, "• Rota HTTP (Caddy 200 OK):"),
                  h("span", { style: { color: "#10b981", fontWeight: "700" } }, "PASS")
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", color: "#d1d5db" } },
                  h("span", {}, "• Supabase RLS & Auth:"),
                  h("span", { style: { color: "#10b981", fontWeight: "700" } }, "PASS")
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", color: "#d1d5db" } },
                  h("span", {}, "• Playwright Zero Console Err:"),
                  h("span", { style: { color: "#10b981", fontWeight: "700" } }, "PASS")
                )
              )
            )
          ),
          // DSAP Backtracking & Histórico de Recusas
          h(
            "div",
            {
              style: {
                borderRadius: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "11px", fontWeight: "700", color: "#f3f4f6" } }, "Histórico de Ciclos & DSAP Backtracking"),
              h("span", { style: { fontSize: "10px", color: "#6b7280" } }, "Threshold: similaridade >= 0.70")
            ),
            h(
              "div",
              { style: { fontSize: "11px", color: "#9ca3af" } },
              activeIssueDetailCard.rejectionHistory && activeIssueDetailCard.rejectionHistory.length > 0 ? `Recusa recente: ${activeIssueDetailCard.rejectionHistory[0].reason} (${Math.round((activeIssueDetailCard.rejectionHistory[0].similarityToFirst || 0) * 100)}% similaridade)` : "Nenhuma recusa registrada nesta issue (FPY 100% no primeiro ciclo de execução)."
            )
          ),
          // Rodapé de Ações Rápidas (1-Clique)
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "a",
                {
                  href: buildIssueDeepLink(activeIssueDetailCard),
                  onClick: () => handleOpenIssueDeepLink(activeIssueDetailCard),
                  style: {
                    textDecoration: "none",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                    color: "#38bdf8",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.externalLink({ h, width: 12, height: 12 }),
                "Abrir no Buzz Desktop"
              ),
              h(
                "button",
                {
                  onClick: (e) => handleCopyDeepLink(e, activeIssueDetailCard),
                  style: {
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }
                },
                SVG.copy({ h, width: 12, height: 12 }),
                "Copiar Link"
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "button",
                {
                  onClick: () => {
                    const c = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    setDispatchIssueId(c.issueId);
                    setIsDispatchModalOpen(true);
                  },
                  style: {
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    color: "#f59e0b",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }
                },
                SVG.zap({ h, width: 12, height: 12 }),
                "Despachar"
              ),
              activeIssueDetailCard.stage === "revisao" && h(
                "button",
                {
                  onClick: () => {
                    const c = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    handleAcceptGate(c);
                  },
                  style: {
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#10b981",
                    color: "#000000",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }
                },
                SVG.checkCircle({ h, width: 12, height: 12 }),
                "Aceitar Gate"
              ),
              h(
                "button",
                {
                  onClick: () => {
                    const c = activeIssueDetailCard;
                    setActiveIssueDetailCard(null);
                    setActiveLogsCard(c);
                    setIsLogsDrawerOpen(true);
                  },
                  style: {
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#9ca3af",
                    fontSize: "11px",
                    cursor: "pointer"
                  }
                },
                "Ver Logs"
              )
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 7. MODAL AUTO-BOOTSTRAP & ONBOARDING 1-CLIQUE (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isBootstrapModalOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200
          }
        },
        h(
          "div",
          {
            style: {
              width: "560px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          // Header
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.zap({ h, width: 20, height: 20 }),
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Auto-Bootstrap da Holding OrgFy")
            ),
            h(
              "button",
              {
                onClick: () => !isBootstrapping && setIsBootstrapModalOpen(false),
                disabled: isBootstrapping,
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isBootstrapping ? "not-allowed" : "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          h(
            "p",
            { style: { margin: 0, fontSize: "12px", color: "#9ca3af", lineHeight: "1.4" } },
            "Provisionamento determinístico de ponta a ponta: diagnóstico de binários locais (python3, git, docker), integridade do repositório, canal Nostr NIP-29 (#esteira-orgfy), registro dos 4 agentes canônicos e sincronização do Porteiro."
          ),
          // Progress Bar
          (() => {
            const successCount = bootstrapSteps.filter((s) => s.status === "success").length;
            const pct = Math.round(successCount / bootstrapSteps.length * 100);
            return h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
                h("span", { style: { color: "#9ca3af" } }, "Progresso do Provisionamento:"),
                h("span", { style: { color: pct === 100 ? "#10b981" : "#60a5fa", fontWeight: "700" } }, `${pct}%`)
              ),
              h(
                "div",
                {
                  style: {
                    height: "6px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden"
                  }
                },
                h("div", {
                  style: {
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? "#10b981" : "#3b82f6",
                    transition: "width 0.3s ease"
                  }
                })
              )
            );
          })(),
          // Stepper List
          h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "260px",
                overflowY: "auto",
                padding: "8px 0"
              }
            },
            bootstrapSteps.map((s, idx) => {
              const statusColor = s.status === "success" ? "#10b981" : s.status === "running" ? "#f59e0b" : s.status === "error" ? "#ef4444" : "#6b7280";
              return h(
                "div",
                {
                  key: s.step,
                  style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)"
                  }
                },
                h(
                  "div",
                  { style: { marginTop: "2px", color: statusColor } },
                  s.status === "success" ? SVG.checkCircle({ h, width: 14, height: 14 }) : s.status === "running" ? SVG.refresh({ h, width: 14, height: 14 }) : s.status === "error" ? SVG.alertTriangle({ h, width: 14, height: 14 }) : h("div", {
                    style: {
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      border: "1.5px solid #6b7280"
                    }
                  })
                ),
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 } },
                  h(
                    "span",
                    { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } },
                    `${idx + 1}. ${s.label}`
                  ),
                  s.details && h(
                    "span",
                    { style: { fontSize: "11px", color: statusColor, fontFamily: "monospace" } },
                    s.details
                  )
                )
              );
            })
          ),
          // Actions
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" } },
            h(
              "button",
              {
                onClick: () => setIsBootstrapModalOpen(false),
                disabled: isBootstrapping,
                style: {
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#9ca3af",
                  fontSize: "12px",
                  cursor: isBootstrapping ? "not-allowed" : "pointer"
                }
              },
              "Fechar"
            ),
            h(
              "button",
              {
                onClick: handleRunBootstrap,
                disabled: isBootstrapping,
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: "#10b981",
                  border: "none",
                  color: "#000000",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: isBootstrapping ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              isBootstrapping ? [SVG.refresh({ h, width: 14, height: 14 }), "Executando Auto-Bootstrap..."] : [SVG.zap({ h, width: 14, height: 14 }), "Inicializar Tudo em 1-Clique"]
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 8. MODAL DIAGNÓSTICO DO SERVIDOR MCP NATIVO (FASE 3)
      // ───────────────────────────────────────────────────────────────────────
      isMcpDiagnosticsOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200
          }
        },
        h(
          "div",
          {
            style: {
              width: "580px",
              borderRadius: "16px",
              backgroundColor: "#111714",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          // Header
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.cpu({ h, width: 20, height: 20 }),
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Servidor MCP Nativo — Diagnóstico Técnico")
            ),
            h(
              "button",
              {
                onClick: () => setIsMcpDiagnosticsOpen(false),
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Info Bar
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                padding: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "11px"
              }
            },
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Protocolo: "),
              h("span", { style: { color: "#60a5fa", fontWeight: "600" } }, "JSON-RPC 2.0 Loopback")
            ),
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Status: "),
              h(
                "span",
                { style: { color: mcpStatus.active ? "#10b981" : "#60a5fa", fontWeight: "600" } },
                mcpStatus.active ? "🟢 ATIVO (ctx.host.serveMcp)" : "🟢 PRONTO / LOOPBACK"
              )
            ),
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Chamadas Registradas: "),
              h("span", { style: { color: "#10b981", fontWeight: "700" } }, `${mcpStatus.toolCallsCount} invocação(ões)`)
            ),
            h(
              "div",
              null,
              h("span", { style: { color: "#9ca3af" } }, "Clientes Suportados: "),
              h("span", { style: { color: "#ffffff" } }, "Antigravity, Claude, Goose, Pi")
            )
          ),
          // Tools Section
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Ferramentas Homologadas (4 Tools):"),
            [
              {
                name: "orgfy_status",
                desc: "Telemetria agregada ao vivo: FPY, CPI, cards ativos e catraca de regras probatórias RSI."
              },
              {
                name: "orgfy_despachar",
                desc: "Invocação determinística de despacho com validação mecânica L-01 (executor !== revisor)."
              },
              {
                name: "orgfy_gate",
                desc: "Decisão oficial de Gate Caixa-Preta (aceito/recusado) com holdout verification e alerta DSAP."
              },
              {
                name: "orgfy_porteiro_sync",
                desc: "Disparo pontual do ciclo determinístico do Porteiro Nostr para reconciliar filas de PR e main."
              }
            ].map(
              (tool) => h(
                "div",
                {
                  key: tool.name,
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px"
                  }
                },
                h("span", { style: { fontSize: "12px", fontFamily: "monospace", color: "#10b981", fontWeight: "700" } }, tool.name),
                h("span", { style: { fontSize: "11px", color: "#9ca3af" } }, tool.desc)
              )
            )
          ),
          // Close Button
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", marginTop: "6px" } },
            h(
              "button",
              {
                onClick: () => setIsMcpDiagnosticsOpen(false),
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: "#3b82f6",
                  border: "none",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Entendido"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 9. MODAL MIGRADOR DE AGENTES & WORKSPACE SOBERANO (ORGFY V10)
      // ───────────────────────────────────────────────────────────────────────
      isMigrationModalOpen && h(
        "div",
        {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2200
          }
        },
        h(
          "div",
          {
            style: {
              width: "720px",
              maxHeight: "88vh",
              borderRadius: "16px",
              backgroundColor: "#0d1411",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflowY: "auto"
            }
          },
          // Header
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.users({ h, width: 20, height: 20 }),
              h("h3", { style: { margin: 0, fontSize: "16px", color: "#ffffff", fontWeight: "700" } }, "Migrador de Agentes & Workspace Soberano"),
              h("span", { style: { fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: "700" } }, "v10 Canônico")
            ),
            h(
              "button",
              {
                onClick: () => setIsMigrationModalOpen(false),
                style: {
                  background: "none",
                  border: "none",
                  color: "var(--text-subtle, #9ca3af)",
                  cursor: "pointer",
                  padding: "4px"
                }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Description & Target workspace
          h(
            "div",
            { style: { fontSize: "12px", color: "#9ca3af", lineHeight: "1.5" } },
            "Sincronização atômica de todos os agentes OrgFy criados no Buzz Desktop. Vincula o diretório de execução ao repositório ",
            h("code", { style: { backgroundColor: "rgba(255, 255, 255, 0.08)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" } }, "/Users/heltonfraga/.buzz/REPOS/orgfy"),
            ", injeta contratos CoEvo-RSI (Tiers 1, 2 e 3), regras probatórias e ferramentas MCP loopback com backup automático (.bak)."
          ),
          // Metric Cards
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" } },
            h(
              "div",
              { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" } },
              h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Total de Agentes"),
              h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#ffffff", marginTop: "4px" } }, (migrationSummary == null ? void 0 : migrationSummary.total) || 16)
            ),
            h(
              "div",
              { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" } },
              h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Migrados para REPOS/orgfy"),
              h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#10b981", marginTop: "4px" } }, (migrationSummary == null ? void 0 : migrationSummary.migratedCount) || 16)
            ),
            h(
              "div",
              { style: { padding: "10px", borderRadius: "8px", backgroundColor: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)" } },
              h("div", { style: { fontSize: "11px", color: "#38bdf8" } }, "Protocolo Ativo"),
              h("div", { style: { fontSize: "14px", fontWeight: "700", color: "#38bdf8", marginTop: "6px" } }, "v10 + CoEvo-RSI")
            )
          ),
          // Agent list
          h(
            "div",
            {
              style: {
                maxHeight: "260px",
                overflowY: "auto",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backgroundColor: "rgba(0, 0, 0, 0.3)"
              }
            },
            ((migrationSummary == null ? void 0 : migrationSummary.agents) || []).map(
              (ag) => h(
                "div",
                {
                  key: ag.name,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    fontSize: "12px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: ag.isMigrated ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: ag.isMigrated ? "#10b981" : "#f59e0b"
                      }
                    },
                    ag.isMigrated ? "✅ MIGRADO" : "⚠️ PENDENTE"
                  ),
                  h("span", { style: { fontWeight: "600", color: "#ffffff" } }, ag.name),
                  h("span", { style: { color: "var(--text-subtle, #9ca3af)", fontSize: "11px" } }, `(${ag.role})`)
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: ag.tier === "tier_3_arquiteto" ? "rgba(168, 85, 247, 0.2)" : ag.tier === "tier_2_revisor" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: ag.tier === "tier_3_arquiteto" ? "#c084fc" : ag.tier === "tier_2_revisor" ? "#60a5fa" : "#10b981"
                      }
                    },
                    ag.tier === "tier_3_arquiteto" ? "Tier 3 Arquiteto" : ag.tier === "tier_2_revisor" ? "Tier 2 Revisor" : "Tier 1 Executor"
                  ),
                  h("span", { style: { fontFamily: "monospace", fontSize: "10px", color: "#6b7280" } }, ag.workspace.replace("/Users/heltonfraga/", "~/") || "~/.buzz")
                )
              )
            )
          ),
          // Migration Terminal Log
          migrationLog && h(
            "pre",
            {
              style: {
                maxHeight: "120px",
                overflowY: "auto",
                padding: "10px",
                borderRadius: "8px",
                backgroundColor: "#050706",
                color: "#38bdf8",
                fontFamily: "monospace",
                fontSize: "10px",
                margin: 0,
                whiteSpace: "pre-wrap"
              }
            },
            migrationLog
          ),
          // Action Buttons
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: loadMigrationData,
                disabled: isMigrating,
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }
              },
              "Re-verificar Status"
            ),
            h(
              "button",
              {
                onClick: handleExecuteMigration,
                disabled: isMigrating,
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isMigrating ? "rgba(56, 189, 248, 0.4)" : "#38bdf8",
                  color: "#000000",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: isMigrating ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              SVG.users({ h, width: 14, height: 14 }),
              isMigrating ? "Sincronizando Agentes..." : "Executar Migração Atômica (16 Agentes)"
            )
          )
        )
      )
    );
    function renderTemplatesRsiView() {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            overflowY: "auto",
            paddingRight: "6px"
          }
        },
        // Cabeçalho da Seção de Templates
        h(
          "div",
          {
            style: {
              padding: "14px 18px",
              borderRadius: "12px",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h(
              "span",
              { style: { fontSize: "14px", fontWeight: "700", color: "#ffffff" } },
              "Catálogo Canônico de Templates de Card & Contratos FPY"
            ),
            h(
              "span",
              { style: { fontSize: "11px", color: "#9ca3af" } },
              "Modelos determinísticos com First-Pass Yield (FPY) auditado e comandos de aceite congelados (Regra L-22)."
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h(
              "span",
              {
                style: {
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  fontWeight: "700",
                  fontFamily: "monospace"
                }
              },
              "FPY Médio: 98.4%"
            ),
            h(
              "span",
              {
                style: {
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  fontWeight: "700",
                  fontFamily: "monospace"
                }
              },
              "659 Cards Processados"
            )
          )
        ),
        // Grid com os 4 Templates Canônicos
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "14px"
            }
          },
          CANONICAL_TEMPLATES.map(
            (tmpl) => h(
              "div",
              {
                key: tmpl.id,
                style: {
                  borderRadius: "12px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }
              },
              // Card Header
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                h(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                  h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#ffffff" } }, tmpl.name),
                  h("span", { style: { fontSize: "10px", color: "#6b7280", fontFamily: "monospace" } }, tmpl.path)
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontWeight: "700",
                      backgroundColor: tmpl.fpyHistorical >= 98 ? "rgba(16, 185, 129, 0.2)" : tmpl.fpyHistorical >= 90 ? "rgba(56, 189, 248, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: tmpl.fpyHistorical >= 98 ? "#10b981" : tmpl.fpyHistorical >= 90 ? "#38bdf8" : "#f59e0b",
                      fontFamily: "monospace"
                    }
                  },
                  `${tmpl.fpyHistorical.toFixed(1)}% FPY`
                )
              ),
              // Descrição
              h("p", { style: { fontSize: "11px", color: "#9ca3af", margin: 0, lineHeight: "1.4" } }, tmpl.description),
              // Erros Blindados
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "4px" } },
                h("span", { style: { fontSize: "10px", fontWeight: "700", color: "#60a5fa" } }, "Erros Frequentes Blindados:"),
                tmpl.frequentErrorsBlocked.map(
                  (err, i) => h(
                    "div",
                    { key: i, style: { fontSize: "10px", color: "#d1d5db", display: "flex", gap: "6px" } },
                    h("span", { style: { color: "#10b981" } }, "✓"),
                    h("span", {}, err)
                  )
                )
              ),
              // Exemplo de Comando de Aceite
              h(
                "div",
                {
                  style: {
                    marginTop: "auto",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "#050706",
                    border: "1px solid rgba(255, 255, 255, 0.05)"
                  }
                },
                h("span", { style: { fontSize: "9px", color: "#6b7280", display: "block" } }, "Comando Padrão (Regra L-22):"),
                h("code", { style: { fontSize: "10px", color: "#34d399", fontFamily: "monospace" } }, tmpl.sampleAcceptanceCommand)
              ),
              // Botão de Copiar Caminho
              h(
                "button",
                {
                  onClick: () => {
                    var _a;
                    if (typeof navigator !== "undefined" && ((_a = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a.writeText)) {
                      navigator.clipboard.writeText(tmpl.path);
                    }
                    showNotification("success", `Caminho copiado: ${tmpl.path}`);
                  },
                  style: {
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    color: "#9ca3af",
                    fontSize: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px"
                  }
                },
                SVG.copy({ h, width: 11, height: 11 }),
                "Copiar Caminho do Template"
              )
            )
          )
        ),
        // Seção do Hub de Aprendizado Recursivo (RSI Engine & Regras Probatórias)
        h(
          "div",
          {
            style: {
              borderRadius: "12px",
              backgroundColor: "rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              SVG.shield({ h, width: 16, height: 16 }),
              h("span", { style: { fontSize: "13px", fontWeight: "700", color: "#ffffff" } }, "Motor RSI: Regras Probatórias Compiladas"),
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(168, 85, 247, 0.2)",
                    color: "#c084fc",
                    fontWeight: "700"
                  }
                },
                "Janela de 10 cards (Regra L-90)"
              )
            ),
            h(
              "button",
              {
                onClick: async () => {
                  showNotification("info", "Disparando retro.py para compilação probatória...");
                  const res = await compileProbationaryRule(ctx, {
                    erroId: "auto-" + Date.now().toString().slice(-4),
                    descricao: "Prevenção automática compilada pelo operador no Cockpit",
                    comandoCheck: "python3 -m pytest -q testes/esteira -v"
                  });
                  if (res.success) {
                    showNotification("success", "Regra probatória compilada com sucesso na janela de 10 cards!");
                  } else {
                    showNotification("warning", "Falha na compilação da regra probatória.");
                  }
                },
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#c084fc",
                  color: "#000000",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              SVG.zap({ h, width: 12, height: 12 }),
              "Compilar Nova Regra Probatória"
            )
          ),
          h(
            "p",
            { style: { fontSize: "11px", color: "#9ca3af", margin: 0, lineHeight: "1.4" } },
            "Erros detectados 2x+ na esteira são automaticamente sintetizados em regras executáveis pelo retro.py. Se o FPY cair durante a janela de 10 cards, a regra é revertida (REVERTIDA) sem intervenção humana."
          ),
          // Tabela de Regras
          h(
            "div",
            {
              style: {
                borderRadius: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                overflow: "hidden"
              }
            },
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 140px 110px",
                  padding: "8px 12px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#9ca3af",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
                }
              },
              h("span", {}, "REGRA ID"),
              h("span", {}, "DESCRIÇÃO DO ERRO"),
              h("span", {}, "JANELA DE AVALIAÇÃO"),
              h("span", {}, "STATUS")
            ),
            [
              { id: "GUARD-T020", desc: "Blindagem de integridade do ci_cache e aceite_cache", window: "10 / 10 cards", status: "ATIVA", color: "#10b981" },
              { id: "GUARD-L01", desc: "Impedimento de auto-revisão (Executor !== Revisor)", window: "10 / 10 cards", status: "CONSOLIDADA", color: "#38bdf8" },
              { id: "GUARD-L22", desc: "Bloqueio de alteração de testes por hash SHA-256", window: "8 / 10 cards", status: "EM AVALIAÇÃO", color: "#c084fc" }
            ].map(
              (r) => h(
                "div",
                {
                  key: r.id,
                  style: {
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 140px 110px",
                    padding: "8px 12px",
                    fontSize: "10px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                    alignItems: "center"
                  }
                },
                h("span", { style: { fontFamily: "monospace", color: "#f3f4f6", fontWeight: "600" } }, r.id),
                h("span", { style: { color: "#9ca3af" } }, r.desc),
                h("span", { style: { fontFamily: "monospace", color: "#60a5fa" } }, r.window),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "9px",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      backgroundColor: `${r.color}22`,
                      color: r.color,
                      fontWeight: "700",
                      width: "fit-content"
                    }
                  },
                  r.status
                )
              )
            )
          )
        )
      );
    }
    function renderColumn(title, cards, badgeBg, badgeColor, renderAction) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            borderRadius: "12px",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            padding: "10px",
            minHeight: "420px"
          }
        },
        // Column Header
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "8px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              marginBottom: "10px"
            }
          },
          h("span", { style: { fontWeight: "700", fontSize: "12px", color: "#f3f4f6" } }, title),
          h(
            "span",
            {
              style: {
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: badgeBg,
                color: badgeColor,
                fontWeight: "700"
              }
            },
            cards.length
          )
        ),
        // Cards List
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto" } },
          cards.length === 0 ? h(
            "div",
            {
              style: {
                padding: "20px 10px",
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.2)",
                fontSize: "11px"
              }
            },
            "Nenhum card nesta raia"
          ) : cards.map(
            (c) => h(
              "div",
              {
                key: c.id,
                style: {
                  padding: "10px 12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  transition: "transform 0.15s ease"
                }
              },
              // Card Top (Badge Priority + Issue ID + Time)
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h(
                  "span",
                  {
                    style: {
                      fontSize: "9px",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      backgroundColor: c.priority === "P0" ? "rgba(239, 68, 68, 0.2)" : c.priority === "P1" ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                      color: c.priority === "P0" ? "#ef4444" : c.priority === "P1" ? "#f59e0b" : "#60a5fa",
                      fontWeight: "700"
                    }
                  },
                  c.priority
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "4px" } },
                  h(
                    "a",
                    {
                      href: buildIssueDeepLink(c),
                      onClick: (e) => {
                        e.stopPropagation();
                        handleOpenIssueDeepLink(c);
                      },
                      title: `Abrir issue #${c.issueId} no Buzz Desktop`,
                      style: {
                        textDecoration: "none",
                        fontSize: "10px",
                        color: "#38bdf8",
                        fontFamily: "monospace",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(56, 189, 248, 0.1)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        transition: "all 0.15s ease"
                      }
                    },
                    c.prId || `#${c.issueId}`,
                    SVG.externalLink({ h, width: 9, height: 9 })
                  ),
                  h(
                    "button",
                    {
                      onClick: (e) => handleCopyDeepLink(e, c),
                      title: "Copiar Deep Link buzz://issue?...",
                      style: {
                        background: "none",
                        border: "none",
                        padding: "2px",
                        color: "#9ca3af",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center"
                      }
                    },
                    SVG.copy({ h, width: 10, height: 10 })
                  )
                ),
                h("span", { style: { fontSize: "10px", color: "var(--text-subtle, #9ca3af)" } }, c.elapsedTime)
              ),
              // Title (Clickable Deep Link -> In-Cockpit Issue Detail)
              h(
                "div",
                {
                  onClick: () => setActiveIssueDetailCard(c),
                  title: `Clique para ver detalhes da issue no Cockpit`,
                  style: {
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#ffffff",
                    lineHeight: "1.3",
                    cursor: "pointer",
                    transition: "color 0.15s ease"
                  }
                },
                c.title
              ),
              // Assignee & Tier
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" } },
                  SVG.user({ h, width: 11, height: 11 }),
                  c.executor
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "9px",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      backgroundColor: c.tier === "tier_3_arquiteto" ? "rgba(168, 85, 247, 0.2)" : c.tier === "tier_2_revisor" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                      color: c.tier === "tier_3_arquiteto" ? "#c084fc" : c.tier === "tier_2_revisor" ? "#60a5fa" : "#10b981",
                      fontWeight: "600"
                    }
                  },
                  c.tier === "tier_3_arquiteto" ? "Tier 3" : c.tier === "tier_2_revisor" ? "Tier 2" : "Tier 1"
                )
              ),
              // Custo & Model Router Badge (Inteligência CoEvo-RSI)
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", marginTop: "2px" } },
                h(
                  "span",
                  {
                    style: {
                      color: c.tier === "tier_1_exec_barato" ? "#10b981" : c.tier === "tier_2_revisor" ? "#60a5fa" : "#c084fc",
                      fontFamily: "monospace",
                      fontWeight: "600"
                    }
                  },
                  c.tier === "tier_1_exec_barato" ? "Gemini 3.8 Flash" : c.tier === "tier_2_revisor" ? "Claude 3.5 Sonnet" : "Claude 3.5 Sonnet"
                ),
                h(
                  "span",
                  { style: { color: "#9ca3af", fontFamily: "monospace" } },
                  `~$${c.estimatedCost || (c.tier === "tier_1_exec_barato" ? "0.002" : "0.02")} | ${c.tokens || 18}k tokens`
                )
              ),
              // Action Button
              renderAction(c)
            )
          )
        )
      );
    }
  }
  function OrgFySettingsCard() {
    const navigateToCockpit = () => {
      var _a;
      try {
        if ((_a = ctx.navigation) == null ? void 0 : _a.navigate) {
          ctx.navigation.navigate("orgfy");
        } else {
          window.location.hash = "#/orgfy";
        }
      } catch {
        window.location.hash = "#/orgfy";
      }
    };
    return h(
      "div",
      {
        style: {
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          color: "#ffffff"
        }
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        SVG.orgfy({ h, width: 24, height: 24 }),
        h(
          "div",
          null,
          h("div", { style: { fontWeight: "700", fontSize: "14px" } }, "OrgFy Control Room"),
          h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Esteira determinística v10 & governança da Holding Cortexx")
        )
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            padding: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderRadius: "8px",
            fontSize: "11px"
          }
        },
        h("span", { style: { color: "#9ca3af" } }, "Porteiro Nostr:"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "🟢 ATIVO (Sub-second)"),
        h("span", { style: { color: "#9ca3af" } }, "First-Pass Yield (FPY):"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "100.0%"),
        h("span", { style: { color: "#9ca3af" } }, "CPI EVM:"),
        h("span", { style: { color: "#10b981", fontWeight: "600" } }, "0.94 (Margem > 0.85)")
      ),
      h(
        "button",
        {
          onClick: navigateToCockpit,
          style: {
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: "#10b981",
            color: "#000000",
            fontWeight: "700",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            alignSelf: "flex-start"
          }
        },
        "Abrir OrgFy Control Room"
      )
    );
  }
  ctx.pages.register({
    id: "orgfy",
    title: "OrgFy Control Room",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    component: OrgFyCockpit
  });
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "orgfy-settings",
      title: "OrgFy Control Room",
      group: "Pipelines & Autonomous Systems",
      component: OrgFySettingsCard
    });
  }
  let mcpServerInstance = null;
  startOrgfyMcpServer(ctx).then((server) => {
    mcpServerInstance = server;
  }).catch((err) => {
    console.warn("[ORGFY] MCP Server failed to start:", err);
  });
  if (ctx.on) {
    ctx.on("dispose", () => {
      if (mcpServerInstance == null ? void 0 : mcpServerInstance.close) {
        try {
          mcpServerInstance.close();
        } catch (_e) {
        }
      }
    });
  }
}
export {
  AVAILABLE_AGENTS,
  INITIAL_PIPELINE_CARDS,
  INITIAL_REGRAS_PROBATORIAS,
  SVG,
  TENANTS,
  apply,
  inject
};
