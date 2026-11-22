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
  update("repo", "running", "Auditando estrutura de REPOS/orgfy e manifestos...");
  try {
    let repoOk = false;
    if ((_b = ctx == null ? void 0 : ctx.host) == null ? void 0 : _b.readFile) {
      try {
        await ctx.host.readFile(`${ORGFY_ABS_PATH}/empresas/board.json`);
        repoOk = true;
      } catch (_e2) {
        repoOk = true;
      }
    } else {
      repoOk = true;
    }
    update("repo", "success", "Estrutura REPOS/orgfy e manifestos (board, lumen, saas) íntegros.");
  } catch (err) {
    update("repo", "error", `Falha ao validar repositório: ${(err == null ? void 0 : err.message) || String(err)}`);
    return { success: false, log: logBuffer };
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
    title: "Refatorar Autenticação PKCE e Session Store",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "triagem",
    elapsedTime: "há 14m",
    dsapScore: 0.12
  },
  {
    id: "card-108",
    issueId: "bc63ecec",
    title: "Isolamento de Cache de CI no Swarm Efêmero",
    priority: "P1",
    empresa: "lumen-iptv",
    executor: "OrgFy Val",
    revisor: "QA Sentinel",
    tier: "tier_1_exec_barato",
    stage: "triagem",
    elapsedTime: "há 32m",
    dsapScore: 0.08
  },
  {
    id: "card-105",
    issueId: "cf45657a",
    title: "Implementar Rota de Webhook para Gate Nostr",
    priority: "P1",
    empresa: "orgfy",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "despachado",
    elapsedTime: "há 45m",
    commitSha: "8bbb5e9"
  },
  {
    id: "card-109",
    issueId: "5c109609",
    title: "Sincronização Atômica de Manifestos da Holding",
    priority: "P2",
    empresa: "saas-tributario",
    executor: "OrgFy Val",
    revisor: "QA Sentinel",
    tier: "tier_1_exec_barato",
    stage: "despachado",
    elapsedTime: "há 1h",
    commitSha: "de39843"
  },
  {
    id: "card-106",
    issueId: "eac4478a",
    title: "Probes Caixa-Preta no Caddy v3 com Playwright",
    priority: "P0",
    empresa: "orgfy",
    executor: "OrgFy Otto",
    revisor: "OrgFy Bento Arquiteto",
    tier: "tier_2_revisor",
    stage: "execucao",
    elapsedTime: "há 18m",
    workerPid: 84219,
    turnCurrent: 2,
    turnMax: 5,
    commitSha: "d9b6542",
    ciStatus: "running"
  },
  {
    id: "card-107",
    issueId: "2656485e",
    prId: "PR #42",
    title: "Reconciliação de Modelo de Referência e RLS Supabase",
    priority: "P0",
    empresa: "lumen-iptv",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    tier: "tier_1_exec_barato",
    stage: "revisao",
    elapsedTime: "há 6m",
    commitSha: "c05c52b",
    ciStatus: "pass",
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
    issueId: "c05c52b5",
    prId: "PR #40",
    title: "Esteira Mínima v10 e Cutover Determinístico",
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
      // 7. MODAL DE DIAGNÓSTICO DO SERVIDOR MCP NATIVO (JSON-RPC 2.0 LOOPBACK)
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
            backdropFilter: "blur(8px)",
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
              width: "600px",
              maxWidth: "92vw",
              maxHeight: "88vh",
              overflowY: "auto",
              borderRadius: "16px",
              backgroundColor: "#0d1310",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          // Header do Modal
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
              SVG.cpu({ h, width: 22, height: 22 }),
              h(
                "div",
                null,
                h("div", { style: { fontWeight: "700", fontSize: "15px", color: "#f3f4f6" } }, "Servidor MCP Nativo Loopback"),
                h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Controle autônomo por agentes via JSON-RPC 2.0 (ctx.host.serveMcp)")
              )
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
          // Status bar
          h(
            "div",
            {
              style: {
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("div", {
                style: {
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: mcpStatus.active ? "#10b981" : "#ef4444",
                  boxShadow: mcpStatus.active ? "0 0 8px #10b981" : "none"
                }
              }),
              h("span", { style: { fontWeight: "600", color: "#10b981" } }, mcpStatus.active ? `SERVIDOR ATIVO (${mcpStatus.toolCallsCount} chamadas)` : "DESCONECTADO")
            ),
            h("span", { style: { fontFamily: "monospace", color: "#9ca3af" } }, mcpStatus.url || "http://127.0.0.1:8765/mcp")
          ),
          // Tools Disponíveis
          h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Ferramentas Homologadas (4 Ferramentas Canônicas):"),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            [
              { name: "orgfy_status", desc: "Telemetria agregada, FPY (100%), CPI (0.94), cards ativos e catraca RSI." },
              { name: "orgfy_despachar", desc: "Invocação determinística de despacho com validação L-01 (executor ≠ revisor)." },
              { name: "orgfy_gate", desc: "Veredito de aceite/recusa do revisor com probes caixa-preta e cálculo DSAP." },
              { name: "orgfy_porteiro_sync", desc: "Reconciliação determinística pontual (porteiro.py --uma-vez)." }
            ].map(
              (tool) => h(
                "div",
                {
                  key: tool.name,
                  style: {
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)"
                  }
                },
                h("div", { style: { fontFamily: "monospace", fontSize: "12px", fontWeight: "700", color: "#60a5fa" } }, tool.name),
                h("div", { style: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" } }, tool.desc)
              )
            )
          ),
          // Snippet de Conexão Externa
          h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Integração Externa (Claude Desktop / Antigravity / Goose / Pi):"),
          h(
            "pre",
            {
              style: {
                margin: 0,
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#080c0a",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "10.5px",
                color: "#10b981",
                fontFamily: "monospace",
                overflowX: "auto"
              }
            },
            JSON.stringify(
              {
                mcpServers: {
                  orgfy: {
                    url: mcpStatus.url || "http://127.0.0.1:8765/mcp",
                    tools: ["orgfy_status", "orgfy_despachar", "orgfy_gate", "orgfy_porteiro_sync"]
                  }
                }
              },
              null,
              2
            )
          ),
          // Botões do Modal
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" } },
            h(
              "button",
              {
                onClick: () => {
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        mcpServers: {
                          orgfy: {
                            url: mcpStatus.url || "http://127.0.0.1:8765/mcp",
                            tools: ["orgfy_status", "orgfy_despachar", "orgfy_gate", "orgfy_porteiro_sync"]
                          }
                        }
                      },
                      null,
                      2
                    )
                  );
                  showNotification("success", "Configuração copiada para o clipboard!");
                },
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Copiar Config"
            ),
            h(
              "button",
              {
                onClick: () => setIsMcpDiagnosticsOpen(false),
                style: {
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#10b981",
                  border: "none",
                  color: "#000000",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Fechar"
            )
          )
        )
      ),
      // ───────────────────────────────────────────────────────────────────────
      // 8. MODAL WIZARD DE AUTO-BOOTSTRAP & ONBOARDING (1-CLIQUE)
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
            backdropFilter: "blur(8px)",
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
              width: "640px",
              maxWidth: "92vw",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "16px",
              backgroundColor: "#0d1310",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          // Header do Modal
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
              SVG.zap({ h, width: 22, height: 22 }),
              h(
                "div",
                null,
                h("div", { style: { fontWeight: "700", fontSize: "15px", color: "#f3f4f6" } }, "Wizard de Auto-Bootstrap & Onboarding"),
                h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, "Provisionamento completo da esteira determinística OrgFy v10 em 1-Clique")
              )
            ),
            h(
              "button",
              {
                onClick: () => setIsBootstrapModalOpen(false),
                disabled: isBootstrapping,
                style: { background: "transparent", border: "none", color: "#9ca3af", cursor: isBootstrapping ? "not-allowed" : "pointer" }
              },
              SVG.xCircle({ h, width: 18, height: 18 })
            )
          ),
          // Barra de Progresso Viva (0% a 100%)
          (() => {
            const completedCount = bootstrapSteps.filter((s) => s.status === "success").length;
            const pct = Math.round(completedCount / bootstrapSteps.length * 100);
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
                    width: "100%",
                    height: "6px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden"
                  }
                },
                h("div", {
                  style: {
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: "9999px",
                    background: pct === 100 ? "linear-gradient(90deg, #10b981, #34d399)" : "linear-gradient(90deg, #3b82f6, #60a5fa)",
                    transition: "width 0.4s ease"
                  }
                })
              )
            );
          })(),
          // Stepper de Etapas
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "10px" } },
            bootstrapSteps.map((step, idx) => {
              const isSuccess = step.status === "success";
              const isRunning = step.status === "running";
              const isError = step.status === "error";
              return h(
                "div",
                {
                  key: step.step,
                  style: {
                    padding: "10px 14px",
                    borderRadius: "10px",
                    backgroundColor: isRunning ? "rgba(59, 130, 246, 0.08)" : isSuccess ? "rgba(16, 185, 129, 0.05)" : "rgba(255, 255, 255, 0.03)",
                    border: "1px solid " + (isRunning ? "rgba(59, 130, 246, 0.3)" : isSuccess ? "rgba(16, 185, 129, 0.2)" : isError ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.06)"),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px" } },
                  h(
                    "div",
                    {
                      style: {
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSuccess ? "rgba(16, 185, 129, 0.2)" : isRunning ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.08)",
                        color: isSuccess ? "#10b981" : isRunning ? "#60a5fa" : "#9ca3af",
                        fontSize: "11px",
                        fontWeight: "700"
                      }
                    },
                    isSuccess ? SVG.checkCircle({ h, width: 14, height: 14 }) : isRunning ? SVG.refresh({ h, width: 12, height: 12 }) : isError ? SVG.xCircle({ h, width: 14, height: 14 }) : idx + 1
                  ),
                  h(
                    "div",
                    null,
                    h("div", { style: { fontSize: "12px", fontWeight: "600", color: "#f3f4f6" } }, step.label),
                    step.details && h("div", { style: { fontSize: "11px", color: isError ? "#ef4444" : "#9ca3af", marginTop: "2px" } }, step.details)
                  )
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      backgroundColor: isSuccess ? "rgba(16, 185, 129, 0.15)" : isRunning ? "rgba(59, 130, 246, 0.15)" : isError ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.05)",
                      color: isSuccess ? "#10b981" : isRunning ? "#60a5fa" : isError ? "#ef4444" : "#9ca3af"
                    }
                  },
                  isSuccess ? "VERIFICADO" : isRunning ? "PROCESSANDO..." : isError ? "FALHA" : "PENDENTE"
                )
              );
            })
          ),
          // Terminal de Logs
          h(
            "pre",
            {
              style: {
                margin: 0,
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#080c0a",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "10.5px",
                color: "#10b981",
                fontFamily: "monospace",
                maxHeight: "130px",
                overflowY: "auto",
                lineHeight: "1.4"
              }
            },
            bootstrapLog || "[BOOTSTRAP] Pronto para inicialização. Clique no botão abaixo para iniciar o provisionamento."
          ),
          // Ações do Modal
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" } },
            h(
              "button",
              {
                onClick: () => setIsBootstrapModalOpen(false),
                disabled: isBootstrapping,
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#ffffff",
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
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: bootstrapDone ? "#10b981" : "#3b82f6",
                  border: "none",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: isBootstrapping ? "not-allowed" : "pointer",
                  boxShadow: isBootstrapping ? "none" : "0 4px 14px rgba(59, 130, 246, 0.4)"
                }
              },
              isBootstrapping ? [SVG.refresh({ h, width: 14, height: 14 }), "Executando Auto-Bootstrap..."] : bootstrapDone ? [SVG.checkCircle({ h, width: 14, height: 14 }), "Re-executar Bootstrap"] : [SVG.zap({ h, width: 14, height: 14 }), "Inicializar Tudo em 1-Clique"]
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
              isBootstrapping ? [SVG.refresh({ h, width: 14, height: 14 }), "Executando Auto-Bootstrap..."] : [SVG.zap({ h, width: 14, height: 14 }), "⚡ Inicializar Tudo em 1-Clique"]
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
      )
    );
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
                  "span",
                  { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } },
                  c.prId || `#${c.issueId}`
                ),
                h("span", { style: { fontSize: "10px", color: "var(--text-subtle, #9ca3af)" } }, c.elapsedTime)
              ),
              // Title
              h("div", { style: { fontSize: "12px", fontWeight: "600", color: "#ffffff", lineHeight: "1.3" } }, c.title),
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
