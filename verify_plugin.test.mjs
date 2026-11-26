import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Evita ExperimentalWarning do Node v22+ ao inspecionar globalThis.localStorage sem --localstorage-file
const _memStore = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: {
    getItem: (k) => (_memStore.has(String(k)) ? _memStore.get(String(k)) : null),
    setItem: (k, v) => _memStore.set(String(k), String(v)),
    removeItem: (k) => _memStore.delete(String(k)),
    clear: () => _memStore.clear(),
  },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginUrl = pathToFileURL(path.resolve(__dirname, "plugin.js")).href;
const orgfyMod = await import(pluginUrl);

assert.ok(Array.isArray(orgfyMod.inject), "inject deve ser array");
assert.equal(typeof orgfyMod.apply, "function", "apply deve ser function");

function makeHarness(failReads = false) {
  const tools = new Map();
  const panels = new Map();
  const hooks = [];
  const notifications = [];
  const wakes = [];
  const sessionActions = [];
  const assignedFolders = [];
  const injectedSections = [];
  const artifacts = new Map();
  let mcpHandler = null;

  const ctx = {
    react: { createElement: () => null },
    pages: { register: () => {} },
    settingsCards: { register: () => {} },
    panels: {
      register: (p) => panels.set(p.id, p),
    },
    artifactStorage: {
      get: async (k) => artifacts.get(k) ?? null,
      set: async (k, v) => {
        artifacts.set(k, v);
      },
    },
    notifications: {
      notify: async (n) => {
        notifications.push(n);
      },
    },
    navigation: { open: async () => ({ status: "opened" }) },
    agents: {
      addInstructions: () => {},
      addTool: (t) => tools.set(t.name, t),
      registerHook: (h) => hooks.push(h),
      wake: async (w) => {
        wakes.push(w);
      },
      snapshot: () => ({
        agents: [
          { key: "local:orgfy-teo", pubkey: "23fa72f980088b18344c7a2d836f723e92f21709be998a7c8cc2a77812002ce8", name: "OrgFy Teo", place: "here" },
          { key: "local:orgfy-bento-arq", pubkey: "6d2ab612cc8e091e5c4381694728ce3f8873661156adeeda1522737af334b271", name: "OrgFy Bento Arquiteto", place: "here" },
        ],
        running: [
          { key: "local:orgfy-teo", pubkey: "23fa72f980088b18344c7a2d836f723e92f21709be998a7c8cc2a77812002ce8", name: "OrgFy Teo", place: "here" },
        ],
      }),
      sessionState: () => "active",
      session: async (agentKey, place, action) => {
        sessionActions.push({ agentKey, place, action });
      },
      assignConversationFolder: async (convId, folder) => {
        assignedFolders.push({ convId, folder });
      },
      setConversationSections: async (convId, sections) => {
        injectedSections.push({ convId, sections });
      },
      ui: {
        Transcript: () => null,
      },
    },
    host: {
      readFile: async (filePath) => {
        if (failReads) throw new Error("ENOENT simulated");
        // Simula o retorno real do Buzz Desktop (Uint8Array)
        return new Uint8Array(fs.readFileSync(filePath));
      },
      writeFile: async (filePath, content) => {
        if (failReads) throw new Error("EACCES simulated");
        // Isola escritas de teste em memória para não sujar .scratch/orgfy-locks.json
        artifacts.set(`fs:${filePath}`, content);
      },
      serveMcp: async (handler) => {
        mcpHandler = handler;
        return { url: "mcp://test", close: () => {} };
      },
    },
  };

  orgfyMod.apply(ctx);
  return { tools, panels, hooks, notifications, wakes, sessionActions, assignedFolders, injectedSections, artifacts, getMcp: () => mcpHandler };
}

// 1. Testes Originais (Kanban & Status Positivo/Negativo + MCP)
const h1 = makeHarness(false);
assert.equal(h1.tools.size, 22, "devem existir exatamente 22 agentTools registradas");
assert.ok(h1.panels.has("orgfy-channel-pulse"), "sidebar panel orgfy-channel-pulse deve ser registrado");
assert.ok(h1.hooks.length >= 1, "hooks de governança devem ser registrados");

const kanban = JSON.parse(await h1.tools.get("orgfy_kanban_read").call({}, {}, { empresa: "orgfy" }));
assert.equal(kanban.ok, true);
assert.ok(Array.isArray(kanban.cards));
assert.equal(kanban.total, kanban.cards.length);
assert.ok(!kanban.cards.some((c) => c.id === "card-104"));

const status = JSON.parse(await h1.tools.get("orgfy_status").call({}, {}, { empresa: "orgfy" }));
const sumRaias = Object.values(status.cards_por_raia).reduce((a, b) => a + b, 0);
assert.equal(sumRaias, status.total_cards_kanban);
assert.equal(status.total_cards_kanban, kanban.total);
assert.equal(status.placar_20h.disponivel, true);
assert.equal(status.esteira_runtime.disponivel, true);
console.log("[ORGFY POSITIVO OK]", JSON.stringify({ total: kanban.total, cards_por_raia: status.cards_por_raia, fpy: status.fpy_percent, cpi: status.cpi_tokens }));

const h2 = makeHarness(true);
const kanbanFail = JSON.parse(await h2.tools.get("orgfy_kanban_read").call({}, {}, { empresa: "orgfy" }));
assert.equal(kanbanFail.ok, false);
assert.equal(kanbanFail.total, 0);
assert.deepEqual(kanbanFail.cards, []);

const statusFail = JSON.parse(await h2.tools.get("orgfy_status").call({}, {}, { empresa: "orgfy" }));
assert.equal(statusFail.fpy_percent, null);
assert.equal(statusFail.cpi_tokens, null);
assert.equal(statusFail.total_merged_gate, null);
assert.deepEqual(statusFail.cards_por_raia, { triagem: 0, despachado: 0, execucao: 0, revisao: 0, feito: 0 });
console.log("[ORGFY NEGATIVO OK] zero fallbacks hardcoded");

const mcp = h1.getMcp();
assert.ok(mcp);
const badDispatch = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "orgfy_despachar", arguments: { executor: "OrgFy Atlas" } } });
assert.equal(badDispatch.result.isError, true);
const badGate = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "orgfy_gate", arguments: {} } });
assert.equal(badGate.result.isError, true);
console.log("[ORGFY MCP VALIDATION OK]");

// 2. Onda 1 & 2: orgfy_kpis (Positivo + Negativo + Persistência de Histórico)
const kpisOk = JSON.parse(await h1.tools.get("orgfy_kpis").call({}, {}, {}));
assert.equal(kpisOk.disponivel, true, "kpis-esteira.json real deve estar disponível");
assert.equal(typeof kpisOk.kpis.qualidade.fpy_real_pct, "number");
assert.equal(kpisOk.kpis.economia.status_orcamento, "OK");
assert.ok(kpisOk.kpis.fluxo.vazao_total_feito > 0);
assert.ok(kpisOk.history_points >= 1, "artifactStorage deve gravar histórico de KPIs");
console.log("[ONDA 1/2 KPIS POSITIVO OK]", JSON.stringify({
  fpy_real: kpisOk.kpis.qualidade.fpy_real_pct,
  vazao_total: kpisOk.kpis.fluxo.vazao_total_feito,
  status_orcamento: kpisOk.kpis.economia.status_orcamento,
  alertas: kpisOk.kpis.alertas_ativos.length,
}));

const kpisFail = JSON.parse(await h2.tools.get("orgfy_kpis").call({}, {}, {}));
assert.equal(kpisFail.disponivel, false);
assert.equal(kpisFail.kpis, null);
console.log("[ONDA 1/2 KPIS NEGATIVO OK] sem dados sintéticos em caso de erro");

// 3. Onda 3: orgfy_checkout_lock (Acquire -> Conflict -> Release -> Re-acquire)
const lockTool = h1.tools.get("orgfy_checkout_lock");
const testIssue = `test-lock-${Date.now()}`;
const acq1 = JSON.parse(await lockTool.call({}, {}, { action: "acquire", issue_id: testIssue, agent_id: "OrgFy Atlas", ttl_minutes: 30 }));
assert.equal(acq1.ok, true);
assert.equal(acq1.code, "ACQUIRED");

const acqConflict = JSON.parse(await lockTool.call({}, {}, { action: "acquire", issue_id: testIssue, agent_id: "OrgFy Val", ttl_minutes: 30 }));
assert.equal(acqConflict.ok, false);
assert.equal(acqConflict.code, "LOCK_CONFLICT");

const rel1 = JSON.parse(await lockTool.call({}, {}, { action: "release", issue_id: testIssue, agent_id: "OrgFy Atlas" }));
assert.equal(rel1.ok, true);
assert.equal(rel1.code, "RELEASED");

const acq2 = JSON.parse(await lockTool.call({}, {}, { action: "acquire", issue_id: testIssue, agent_id: "OrgFy Val", ttl_minutes: 30 }));
assert.equal(acq2.ok, true);
assert.equal(acq2.code, "ACQUIRED");
await lockTool.call({}, {}, { action: "release", issue_id: testIssue, agent_id: "OrgFy Val" });
console.log("[ONDA 3 CHECKOUT LOCK OK]");

// 4. Onda 3: orgfy_governanca_avaliar (Snapshot real + cenário sintético de alertas com cooldown anti-spam)
const govTool = h1.tools.get("orgfy_governanca_avaliar");
const govDryReal = JSON.parse(await govTool.call({}, {}, { dry_run: true, auto_wake: true }));
assert.equal(govDryReal.ok, true);
assert.equal(h1.notifications.length, 0, "dry_run não pode disparar notificações");

// Harness dedicado com alerta sintético para validar disparo + cooldown independentemente da esteira estar zerada
const hAlert = makeHarness(false);
const origRead = hAlert.tools;
const alertCtxNotifications = [];
const alertCtxWakes = [];
const alertTools = new Map();
const fakeKpisWithAlert = JSON.stringify({
  schema_version: "1.0.0",
  gerado_em: new Date().toISOString(),
  janela_dias: 30,
  fluxo: { vazao_total_feito: 10, fila_revisao_atual: 12 },
  qualidade: { fpy_real_pct: 95 },
  economia: { status_orcamento: "OK", uso_teto_diario_pct: 10 },
  higiene: { wip_total_ativo: 12, orphan_wip_count: 0, estagnados_nivel_3: 2 },
  alertas_ativos: [
    { codigo: "REVIEW_QUEUE_BOTTLENECK", severidade: "warn", mensagem: "Teste fila 12", acao_sugerida: "Acordar revisor" },
  ],
});
orgfyMod.apply({
  react: { createElement: () => null },
  pages: { register: () => {} },
  settingsCards: { register: () => {} },
  panels: { register: () => {} },
  navigation: { open: async () => ({ status: "opened" }) },
  notifications: { notify: async (n) => alertCtxNotifications.push(n) },
  agents: {
    addInstructions: () => {},
    addTool: (t) => alertTools.set(t.name, t),
    registerHook: () => {},
    wake: async (w) => alertCtxWakes.push(w),
  },
  host: {
    readFile: async () => new TextEncoder().encode(fakeKpisWithAlert),
    writeFile: async () => {},
    serveMcp: async () => ({ url: "mcp://test-alert", close: () => {} }),
  },
});
const govAlertTool = alertTools.get("orgfy_governanca_avaliar");
const govReal1 = JSON.parse(await govAlertTool.call({}, {}, { dry_run: false, auto_wake: true }));
assert.equal(govReal1.ok, true);
assert.ok(govReal1.notificationsSent.length >= 1, "execução real deve disparar notificação para alerta ativo");

const govReal2 = JSON.parse(await govAlertTool.call({}, {}, { dry_run: false, auto_wake: true }));
assert.equal(govReal2.ok, true);
assert.equal(govReal2.notificationsSent.length, 0, "segunda execução imediata deve ser bloqueada por cooldown anti-spam");
assert.ok(govReal2.skippedByCooldown.length >= 1);
console.log("[ONDA 3 GOVERNANCA & COOLDOWN OK]", JSON.stringify({
  real_alerts: govDryReal.alertsDetected,
  notifications: govReal1.notificationsSent.length,
  wakes: govReal1.wakesTriggered.length,
  cooldown_skipped: govReal2.skippedByCooldown.length,
}));

// 5. Onda 3: orgfy_lint_card (Reprova violações L-01/L-22 e aprova card válido)
const lintTool = h1.tools.get("orgfy_lint_card");
const lintBad = JSON.parse(await lintTool.call({}, {}, {
  title: "Fix",
  executor: "OrgFy Atlas",
  revisor: "OrgFy Atlas",
  acceptance_command: "",
}));
assert.equal(lintBad.approved, false);
assert.ok(lintBad.issues.length >= 2);

const lintGood = JSON.parse(await lintTool.call({}, {}, {
  title: "Implementar validação determinística de webhook de pagamento",
  objective: "Validar assinatura HMAC-SHA256 e idempotência no endpoint /webhooks/stripe",
  done_when: "Todos os testes unitários e de integração de assinatura passam com exit code 0",
  acceptance_command: "npm test -- webhook-hmac.test.ts",
  executor: "OrgFy Atlas",
  revisor: "OrgFy Bento",
}));
assert.equal(lintGood.approved, true);
assert.equal(lintGood.issues.length, 0);

const lintBadTemplate = JSON.parse(await lintTool.call({}, {}, {
  title: "CI-PORTEIRO-LOCK-ISOLADO Isolar lock do porteiro.py nos testes de CI",
  acceptance_command: "python3 -m pytest -q testes/esteira-0002/test_porteiro_dry_run.py",
  executor: "OrgFy Val",
  revisor: "OrgFy Teo",
  card_markdown: "## Objetivo\nIsolar lock\n## Papéis\n- Executor: OrgFy Val",
}));
assert.equal(lintBadTemplate.approved, false, "card fora do template OrgFy/Spec-Kit deve ser recusado");
assert.ok(lintBadTemplate.issues.some((i) => i.includes("Template OrgFy")), "deve acusar ausência de marcador de template");
assert.ok(lintBadTemplate.issues.some((i) => i.includes("Spec-Kit")), "deve acusar ausência de Spec-Kit");

const lintGoodTemplate = JSON.parse(await lintTool.call({}, {}, {
  title: "SPEC-0011 T001 Isolar lock do porteiro.py nos testes de CI",
  acceptance_command: "python3 -m pytest -q testes/esteira-0002/test_porteiro_dry_run.py",
  executor: "OrgFy Val",
  revisor: "OrgFy Teo",
  card_markdown: [
    "<!-- orgfy:card v4 -->",
    "# SPEC-0011 T001 Isolar lock do porteiro.py",
    "## Objetivo / Goal",
    "Isolar --state-file em tmp_path.",
    "## Papéis e ambiente",
    "- **Autoridade:** specs/planned/0011-porteiro/spec.md",
    "- **Executor:** OrgFy Val",
    "- **Revisor:** OrgFy Teo",
    "- **Decisor:** OrgFy Iris",
    "## Escopo",
    "### Paths",
    "- **Leitura:** ferramentas/esteira/porteiro.py",
    "- **Escrita exclusiva:** testes/esteira-0002/test_porteiro_dry_run.py",
  ].join("\n"),
}));
assert.equal(lintGoodTemplate.approved, true, "card no template OrgFy/Spec-Kit completo deve ser aprovado");
console.log("[ONDA 3 LINT CARD OK]", JSON.stringify({ bad_issues: lintBad.issues.length, bad_tpl_issues: lintBadTemplate.issues.length, good_score: lintGood.score }));

// 6. Onda 3+: orgfy_bind_context (assignConversationFolder + setConversationSections)
const bindTool = h1.tools.get("orgfy_bind_context");
const bindRes = JSON.parse(await bindTool.call({}, {}, {
  conversation_id: "conv-test-001",
  issue_id: "5c569a9e",
  worktree_path: "/Users/heltonfraga/.buzz/REPOS/orgfy/.worktrees/5c569a9e",
  title: "Validar contexto injetado na sessão",
  acceptance_command: "pytest tests/test_ok.py",
  acceptance_hash: "abc123def456",
  executor: "OrgFy Atlas",
  revisor: "OrgFy Bento",
}));
assert.equal(bindRes.ok, true);
assert.equal(bindRes.folderAssigned, true);
assert.equal(bindRes.sectionsInjected, true);
assert.equal(bindRes.sectionsCount, 2);
assert.equal(h1.assignedFolders.length, 1);
assert.equal(h1.injectedSections.length, 1);
console.log("[ONDA 3+ BIND CONTEXT OK]", JSON.stringify({ folderAssigned: bindRes.folderAssigned, sectionsCount: bindRes.sectionsCount }));

// 7. Arquivo de Resolvidas sob demanda: orgfy_historico_buscar (Positivo + Negativo)
const histTool = h1.tools.get("orgfy_historico_buscar");
const histOk = JSON.parse(await histTool.call({}, {}, { query: "porteiro", limit: 5 }));
assert.equal(histOk.disponivel, true);
assert.ok(histOk.total_encontrados >= 2, "deve encontrar issues resolvidas do porteiro");
assert.ok(histOk.resultados[0].deepLink.startsWith("buzz://issue?"));
const histFail = JSON.parse(await h2.tools.get("orgfy_historico_buscar").call({}, {}, { query: "porteiro" }));
assert.equal(histFail.disponivel, false);
assert.equal(histFail.total_encontrados, 0);
console.log("[ARQUIVO RESOLVIDAS OK]", JSON.stringify({ total_arquivo: histOk.total_arquivo, porteiro_hits: histOk.total_encontrados }));

// 8. Radar de Loops & Sessões Zumbis: orgfy_loop_radar (agentTool + MCP + negativo)
const radarTool = h1.tools.get("orgfy_loop_radar");
assert.ok(radarTool, "agentTool orgfy_loop_radar deve estar registrada");
const radarAll = JSON.parse(await radarTool.call({}, {}, { apenas_ativos: false }));
assert.equal(radarAll.ok, true, "snapshot goose-loop-radar.json deve ser lido");
assert.ok(typeof radarAll.resumo.criticos_ativos === "number");
assert.ok(Array.isArray(radarAll.protocolo_resolucao) && radarAll.protocolo_resolucao.length >= 3);

const mcpToolsList = await mcp({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
assert.ok(mcpToolsList.result.tools.some((t) => t.name === "orgfy_loop_radar"), "MCP deve expor orgfy_loop_radar");
const mcpRadarRes = await mcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "orgfy_loop_radar", arguments: { apenas_ativos: true } } });
assert.equal(mcpRadarRes.result.isError, false);
const mcpRadarJson = JSON.parse(mcpRadarRes.result.content[0].text);
assert.equal(mcpRadarJson.ok, true);

const radarFail = JSON.parse(await h2.tools.get("orgfy_loop_radar").call({}, {}, { apenas_ativos: true }));
assert.equal(radarFail.ok, false);
console.log("[RADAR LOOPS AGENT+MCP OK]", JSON.stringify({ criticos_ativos: radarAll.resumo.criticos_ativos, criticos_hist: radarAll.resumo.criticos_historico_3h, exibidas_ativas: mcpRadarJson.total_exibidas }));

// 9. Stop / Interrupt nativo de sessão em loop: orgfy_session_stop (agentTool + MCP + negativo)
const stopTool = h1.tools.get("orgfy_session_stop");
assert.ok(stopTool, "agentTool orgfy_session_stop deve estar registrada");
const stopRes = JSON.parse(await stopTool.call({}, {}, {
  agente: "OrgFy Teo",
  channel_id: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
  thread_root: "77655d509b0abc2a2caa2708dac2510be7cb1630537ba24c54098e1c1122e3fb",
  action: "interrupt",
  reason: "PR duplicado fechado",
}));
assert.equal(stopRes.ok, true);
assert.equal(stopRes.agentKey, "local:orgfy-teo");
assert.equal(stopRes.action, "interrupt");
assert.equal(stopRes.previousState, "active");
assert.equal(h1.sessionActions.length, 1);
assert.equal(h1.sessionActions[0].place.root, "77655d509b0abc2a2caa2708dac2510be7cb1630537ba24c54098e1c1122e3fb");

assert.ok(mcpToolsList.result.tools.some((t) => t.name === "orgfy_session_stop"), "MCP deve expor orgfy_session_stop");
const mcpStopRes = await mcp({
  jsonrpc: "2.0",
  id: 5,
  method: "tools/call",
  params: { name: "orgfy_session_stop", arguments: { agente: "Bento Arquiteto", action: "interrupt" } },
});
assert.equal(mcpStopRes.result.isError, false);
const mcpStopJson = JSON.parse(mcpStopRes.result.content[0].text);
assert.equal(mcpStopJson.ok, true);
assert.equal(mcpStopJson.agentKey, "local:orgfy-bento-arq");

const stopMissing = JSON.parse(await stopTool.call({}, {}, { agente: "Agente Inexistente" }));
assert.equal(stopMissing.ok, false);
console.log("[SESSION STOP AGENT+MCP OK]", JSON.stringify({ stopped: h1.sessionActions.length, lastAgent: mcpStopJson.agentName }));

// 10. Blindagem contra ID sintético repetido em orgfy_checkout_lock
const syntheticRes = JSON.parse(await lockTool.call({}, {}, {
  action: "acquire",
  issue_id: "ef97ba1cef97ba1cef97ba1cef97ba1cef97ba1cef97ba1cef97ba1cef97ba1c",
  agent_id: "OrgFy Teo",
}));
assert.equal(syntheticRes.ok, false, "ID sintético repetido deve ser recusado");
assert.ok(syntheticRes.message.includes("INVALID_SYNTHETIC_ID"));
console.log("[SYNTHETIC LOCK GUARD OK]");

// 11. Auto-Failover de Modelo via NexusMind Ping Real: orgfy_model_failover
const failoverTools = new Map();
const savedChanges = [];
const failoverWakes = [];
orgfyMod.apply({
  react: { createElement: () => null },
  pages: { register: () => {} },
  settingsCards: { register: () => {} },
  panels: { register: () => {} },
  navigation: { open: async () => ({ status: "opened" }) },
  notifications: { notify: async () => {} },
  agents: {
    addInstructions: () => {},
    addTool: (t) => failoverTools.set(t.name, t),
    registerHook: () => {},
    snapshot: () => ({
      agents: [
        { key: "local:orgfy-cron", pubkey: "aaa111", name: "OrgFy Cron", place: "here", config: { model: "kilocode-fast-free", provider: "nexusmind_openai" } },
      ],
      running: [],
    }),
    save: async (agentKey, change) => savedChanges.push({ agentKey, change }),
    wake: async (agentKey, payload) => failoverWakes.push({ agentKey, payload }),
  },
  host: {
    request: async (req) => {
      if (req.url.endsWith("/v1/models")) {
        return {
          status: 200,
          body: JSON.stringify({
            data: [
              { id: "kilocode-fast-free" },
              { id: "deepseek/deepseek-r1:free" },
              { id: "qwen/qwen3-coder:free" },
              { id: "mini-nano-free" },
            ],
          }),
        };
      }
      const body = JSON.parse(req.body || "{}");
      if (body.model === "deepseek/deepseek-r1:free") {
        return { status: 503, body: JSON.stringify({ error: { message: "No available accounts" } }) };
      }
      return { status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) };
    },
    readFile: async () => { throw new Error("unused"); },
    writeFile: async () => {},
    serveMcp: async () => ({ url: "mcp://test-failover", close: () => {} }),
  },
});
const failoverTool = failoverTools.get("orgfy_model_failover");
assert.ok(failoverTool, "agentTool orgfy_model_failover deve estar registrada");
const failoverRes = JSON.parse(await failoverTool.call({}, {}, {
  agente: "OrgFy Cron",
  failed_model: "kilocode-fast-free",
  prefer_free: true,
  apply: true,
  retrigger: true,
  channel_id: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
  thread_root: "25c49b323d299d3a81ca260197cecd5b6208668d84bb8788971ba347fb15b193",
}));
assert.equal(failoverRes.ok, true, "R4.6: failover deve delegar ao NexusMind via evento");
assert.equal(failoverRes.delegated, true, "R4.6: OrgFy deve apenas delegar failover ao NexusMind");
assert.equal(failoverRes.event, orgfyMod.ORGFY_FAILOVER_REQUEST_EVENT);
assert.equal(savedChanges.length, 0, "R4.6: OrgFy nao deve chamar ctx.agents.save() no failover");
console.log("[MODEL FAILOVER NEXUSMIND OK]", JSON.stringify({ selected: failoverRes.selectedModel, tested: failoverRes.candidatesTested, retriggered: failoverRes.retriggered }));

// 12. Escalação Hierárquica Multi-Empresa no Radar (COO -> CEO da Empresa -> Iris só em último caso)
{
  const runEscalationScenario = async (channelId, loopingAgent, sessionId) => {
    const tools = new Map();
    const wakes = [];
    const fakeKpis = JSON.stringify({
      schema_version: "1.0.0",
      gerado_em: new Date().toISOString(),
      janela_dias: 30,
      fluxo: { vazao_total_feito: 10, fila_revisao_atual: 0 },
      qualidade: { fpy_real_pct: 100 },
      economia: { status_orcamento: "OK", uso_teto_diario_pct: 5 },
      higiene: { wip_total_ativo: 1, orphan_wip_count: 0, estagnados_nivel_3: 0 },
      alertas_ativos: [],
    });
    const fakeRadar = JSON.stringify({
      ok: true,
      gerado_em: new Date().toISOString(),
      resumo: { criticos: 1, criticos_ativos: 1, avisos: 0, duplicadas: 0 },
      sessoes: [
        {
          session_id: sessionId,
          agente: loopingAgent,
          severidade: "critical",
          ativa: true,
          ultima_atualizacao_min: 1,
          duracao_min: 25,
          shells: 30,
          flags: ["LOOP_SUSPEITO"],
          channel_id: channelId,
          thread_root: "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000",
        },
      ],
    });
    orgfyMod.apply({
      react: { createElement: () => null },
      pages: { register: () => {} },
      settingsCards: { register: () => {} },
      panels: { register: () => {} },
      navigation: { open: async () => ({ status: "opened" }) },
      notifications: { notify: async () => {} },
      agents: {
        addInstructions: () => {},
        addTool: (t) => tools.set(t.name, t),
        registerHook: () => {},
        snapshot: () => ({
          agents: [
            { key: "local:orgfy-bento", name: "OrgFy Bento", place: "here" },
            { key: "local:lumen-lara", name: "Lumen Lara", place: "here" },
            { key: "local:orgfy-iris", name: "OrgFy Iris", place: "here" },
          ],
          running: [],
        }),
        wake: async (agentKey, payload) => wakes.push({ agentKey, payload }),
      },
      host: {
        readFile: async (p) => {
          if (p.endsWith("kpis-esteira.json")) return new TextEncoder().encode(fakeKpis);
          if (p.endsWith("goose-loop-radar.json")) return new TextEncoder().encode(fakeRadar);
          return new Uint8Array(fs.readFileSync(p));
        },
        writeFile: async () => {},
        serveMcp: async () => ({ url: "mcp://test-esc", close: () => {} }),
      },
    });
    const gov = tools.get("orgfy_governanca_avaliar");
    const res = JSON.parse(await gov.call({}, {}, { dry_run: false, auto_wake: true }));
    return { res, wakes };
  };

  // Caso A (Nível 1): Loop de executor na Lumen IPTV -> acorda o COO (OrgFy Bento), NÃO a Iris
  const s1 = await runEscalationScenario("41315b4e-6d9a-42e9-9521-f8ce1f9dbc15", "Lumen Dev", "20261124_esc_n1");
  assert.equal(s1.res.ok, true);
  assert.equal(s1.wakes.length, 1, "deve disparar 1 wake para o COO da empresa");
  assert.equal(s1.wakes[0].agentKey, "local:orgfy-bento", "loop normal deve acordar o COO (OrgFy Bento), não a Iris");
  assert.ok(s1.wakes[0].payload.text.includes("@OrgFy Bento"));
  assert.ok(
    s1.wakes[0].payload.text.includes("@OrgFy Iris") || s1.wakes[0].payload.text.includes("@Lumen Lara"),
    "deve mencionar a CEO configurada em lumen-iptv.json"
  );

  // Caso B (Nível 2): Próprio COO (OrgFy Bento) entra em loop na Lumen IPTV -> escala para CEO da empresa
  const s2 = await runEscalationScenario("41315b4e-6d9a-42e9-9521-f8ce1f9dbc15", "OrgFy Bento", "20261124_esc_n2");
  assert.equal(s2.res.ok, true);
  assert.equal(s2.wakes.length, 1, "deve disparar 1 wake para a CEO configurada");
  assert.ok(
    ["local:orgfy-iris", "local:lumen-lara"].includes(s2.wakes[0].agentKey),
    "se o COO travar na Lumen IPTV, deve escalar para a CEO ativa no manifesto"
  );
  assert.ok(s2.wakes[0].payload.text.includes("@OrgFy Iris") || s2.wakes[0].payload.text.includes("@Lumen Lara"));
  assert.ok(s2.wakes[0].payload.text.includes("Nível 2"));
  console.log("[HIERARCHICAL ESCALATION COO->CEO OK]", JSON.stringify({ n1: s1.wakes[0].agentKey, n2: s2.wakes[0].agentKey }));
}

// 13. Stop + Relaunch Atômico com @menção e Escopo Fechado (orgfy_session_stop)
{
  const relaunchRes = JSON.parse(await stopTool.call({}, {}, {
    agente: "OrgFy Teo",
    channel_id: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
    thread_root: "77655d509b0abc2a2caa2708dac2510be7cb1630537ba24c54098e1c1122e3fb",
    action: "interrupt",
    reason: "ESCOPO_ABERTO",
    relaunch: true,
    reset_session_before_relaunch: true,
    relaunch_instruction: "Validar apenas o diff da PR e emitir GATE.",
    target_files: ["ferramentas/esteira/auto_fix_ci.py", "testes/esteira-0001/test_auto_fix_ci.py"],
    acceptance_command: "python3 -m pytest -q testes/esteira-0001/test_auto_fix_ci.py",
    max_shells: 8,
  }));
  assert.equal(relaunchRes.ok, true);
  assert.equal(relaunchRes.relaunched, true);
  assert.equal(relaunchRes.next_required_action, null);
  assert.ok(relaunchRes.relaunchMessage.includes("@OrgFy Teo"));
  assert.ok(relaunchRes.relaunchMessage.includes("ferramentas/esteira/auto_fix_ci.py"));
  assert.ok(relaunchRes.relaunchMessage.includes("máximo 8 comandos shell"));
  assert.ok(h1.wakes.length >= 1, "deve ter disparado wake para o agente relançado");

  // Sem relaunch -> deve devolver next_required_action obrigatório para o COO
  assert.ok(stopRes.next_required_action && stopRes.next_required_action.includes("AÇÃO OBRIGATÓRIA DO COO"));
  console.log("[SESSION STOP ATOMIC RELAUNCH OK]", JSON.stringify({ relaunched: relaunchRes.relaunched, wakes: h1.wakes.length }));

  // Guarda de Identidade por Menção & Anti-Loop de Wake por Thread
  const { checkMentionTargetIdentity, checkThreadWakeAntiLoop, resetThreadWakeGuardForTests } = orgfyMod;
  const mismatch = checkMentionTargetIdentity({
    messageText: "Por favor @OrgFy Hugo rode o GATE deste PR.",
    currentAgentName: "OrgFy Teo",
  });
  assert.equal(mismatch.isForMe, false);
  assert.equal(mismatch.action, "[SILENT]");

  const matchOk = checkMentionTargetIdentity({
    messageText: "Por favor @OrgFy Teo valide o PR.",
    currentAgentName: "OrgFy Teo",
  });
  assert.equal(matchOk.isForMe, true);
  assert.equal(matchOk.action, "PROCEED");

  resetThreadWakeGuardForTests();
  const w1 = checkThreadWakeAntiLoop({
    agentKey: "OrgFy Bento",
    threadRoot: "thread-abc-123",
    contextText: "PR entregue, verificando fila.",
    nowMs: 1_000_000,
  });
  assert.equal(w1.allow, true);
  const w2 = checkThreadWakeAntiLoop({
    agentKey: "OrgFy Bento",
    threadRoot: "thread-abc-123",
    contextText: "PR entregue, verificando fila.",
    nowMs: 1_000_000 + 60_000,
  });
  assert.equal(w2.allow, false);
  assert.equal(w2.reason, "thread_wake_cooldown_10m");

  const wGate = checkThreadWakeAntiLoop({
    agentKey: "OrgFy Bento",
    threadRoot: "thread-gate-999",
    contextText: "Aguardando GATE de OrgFy Hugo na T021.",
    nowMs: 2_000_000,
  });
  assert.equal(wGate.allow, false);
  assert.equal(wGate.reason, "waiting_for_other_reviewer_gate");
  console.log("[MENTION IDENTITY & WAKE ANTI-LOOP OK]");

  // Zero-Mock Issue Modal: garante ausência do hash falso e testa hidratação real de SPEC-0006-T020
  const pluginBundleText = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
  assert.ok(
    !pluginBundleText.includes("7b88aa12c5596489b91e92051dc73ff539e6a0082f42a5482329dc3309aef411"),
    "plugin.js não pode conter hash de aceite hardcoded"
  );
  const hydrated = await orgfyMod.hydrateIssueDetail(
    {
      host: {
        readFile: async (p) => new Uint8Array(fs.readFileSync(p)),
      },
    },
    {
      id: "card-t020",
      issueId: "7f8311ac",
      fullIssueId: "7f8311acbc5018c01e800afa7b4fccd9cccad37a865d67218846a3c23b98c9d7",
      title: "SPEC-0006-T020 Implementar descoberta-lint e cleanup-check (xfail para pass)",
      stage: "execucao",
      priority: "P1",
      empresa: "orgfy",
      executor: "OrgFy Lia",
    }
  );
  assert.equal(hydrated.cardFileFound, "cards/SPEC-0006-T020.md");
  assert.ok(hydrated.contexto && hydrated.contexto.includes("SPEC-0006"));
  assert.equal(hydrated.acceptanceFrozenValid, false, "sem arquivo em aceites/, não pode marcar congelamento válido");
  assert.equal(hydrated.acceptanceHash, null);
  // R4.1: leitura direta de agents/state/ removida; modelo vem de ctx.agents.snapshot() no runtime
  assert.ok(hydrated.probes.some((p) => p.status === "NA"), "orgfy CLI não deve exibir Caddy/Supabase/Playwright como PASS");
  console.log("[ZERO-MOCK ISSUE MODAL OK]", JSON.stringify({
    cardFileFound: hydrated.cardFileFound,
    executorModel: `${hydrated.executorProvider}/${hydrated.executorModel}`,
    acceptanceFrozenValid: hydrated.acceptanceFrozenValid,
    probes: hydrated.probes.map((p) => `${p.label}:${p.status}`),
  }));
}

// 13. Onda 4: Schema-First Card Creator + Buzz Attention + Decision Router
{
  const badCard = await orgfyMod.createCanonicalCard({}, {
    slug: "bad-l01",
    titulo: "Teste L-01",
    autoridade: "DECIDIDO Iris",
    decisao: "Teste",
    executor: "OrgFy Val",
    revisor: "OrgFy Val",
    escrita_exclusiva: ["src/a.ts"],
    feito_quando: "exit 0",
    acceptance_command: "pytest",
  });
  assert.equal(badCard.ok, false);
  assert.equal(badCard.code, "L01_SEGREGATION_VIOLATION");

  const mockDecCtx = {
    decisions: {
      decide: async () => ({
        outcome: "answered",
        backend: "nexusmind-fast",
        model: "gemini-3.8-flash-medium",
        answers: {
          escopo_atomico: { type: "yes_no", probability: 0.93 },
          risco_tier: { type: "score", score: 3, confidence: 0.9, probabilities: {} },
          modelo_tier: { type: "choice", choice: "tier3_frontier", confidence: 0.89, probabilities: {} },
          politica_attention: { type: "choice", choice: "event_driven", confidence: 0.92, probabilities: {} },
        },
      }),
    },
  };
  const goodCard = await orgfyMod.createCanonicalCard(mockDecCtx, {
    slug: "wave4-attention",
    titulo: "Integrar Attention nativo no despacho",
    autoridade: "DECIDIDO Iris",
    decisao: "Substituir goal por Attention",
    executor: "OrgFy Val",
    revisor: "OrgFy Teo",
    escrita_exclusiva: ["src/services/decision-router.ts"],
    feito_quando: "node --test passa",
    acceptance_command: "node --test verify_plugin.test.mjs",
  });
  assert.equal(goodCard.ok, true);
  assert.equal(goodCard.acceptanceHashSha256.length, 64);
  assert.equal(goodCard.triage.decisionSource, "decisions_api");
  assert.equal(goodCard.triage.modeloTier, "tier3_frontier");
  assert.ok(goodCard.attentionContract.event_watch_payload, "event_driven deve gerar event_watch_payload com classifier");
  assert.ok(goodCard.markdown.includes("Modo:** goal"));
  assert.ok(goodCard.markdown.includes("Modo Attention:** attention (event_driven)"));
  assert.ok(goodCard.markdown.includes("Goal max turns:** 20"));
  assert.ok(goodCard.markdown.includes("Provider:** "));
  assert.ok(goodCard.markdown.includes("Pais:** nenhum"));

  const diffCheck = await orgfyMod.triageDiffWithDecisions({}, {
    escrita_exclusiva: ["src/services/decision-router.ts"],
    arquivos_alterados: ["src/services/decision-router.ts", "src/fora.ts"],
    resumo_entrega: "100% pronto",
    saida_aceite: "",
  });
  assert.equal(diffCheck.escopoRespeitado, false);
  assert.equal(diffCheck.alegacaoSemProvaL24, true);
  assert.equal(diffCheck.acaoRecomendada, "pedir_ajuste_executor");
  console.log("[ONDA 4 SCHEMA-FIRST + ATTENTION + DECISIONS OK]", JSON.stringify({
    slug: goodCard.slug,
    tier: goodCard.triage.modeloTier,
    policy: goodCard.attentionContract.policy,
    diffOutOfScope: diffCheck.arquivosForaEscopo,
  }));
}

// 14. v13 Frontier: Zero-Mock Hardcodes Purged + Unified Tool Registry + Buzz Native Synergy + OTel GenAI
{
  assert.equal(orgfyMod.INITIAL_PIPELINE_CARDS.length, 0, "INITIAL_PIPELINE_CARDS deve ser vazio (Zero Mock v13)");
  assert.equal(orgfyMod.INITIAL_REGRAS_PROBATORIAS.length, 0, "INITIAL_REGRAS_PROBATORIAS deve ser vazio (Zero Mock v13)");
  assert.equal(orgfyMod.AVAILABLE_AGENTS.length, 0, "AVAILABLE_AGENTS deve ser vazio (lido ao vivo de ctx.agents.snapshot)");

  orgfyMod.resetTelemetryForTests();

  const nativeEvents = { relay: 0, completions: [], actions: [], tools: [], sidebars: [], shortcuts: [], attentionSources: [], hooks: [], agentTabs: [] };
  const nativeCtx = {
    react: { createElement: () => null },
    relay: {
      snapshot: () => ({ status: "ready", generation: 1 }),
      subscribe: () => { nativeEvents.relay++; return () => {}; },
    },
    conversation: {
      registerCompletion: (comp) => { nativeEvents.completions.push(comp); },
      registerMessageAction: (act) => { nativeEvents.actions.push(act); },
      registerTool: (tool) => { nativeEvents.tools.push(tool); },
    },
    reflect: {
      get: (name) => name === "sidebarSections" ? { register: (sec) => { nativeEvents.sidebars.push(sec); } } : undefined,
    },
    shortcuts: { register: (sc) => { nativeEvents.shortcuts.push(sc); } },
    agents: {
      addAttentionSource: (src) => { nativeEvents.attentionSources.push(src); },
      registerHook: (hk) => { nativeEvents.hooks.push(hk); },
      registerTab: (tab) => { nativeEvents.agentTabs.push(tab); },
    },
  };

  const nativeState = orgfyMod.registerBuzzNativeIntegrations(nativeCtx);
  assert.equal(nativeState.relayConnected, true);
  assert.equal(nativeState.conversationRegistered, true);
  assert.equal(nativeEvents.completions.length, 1);
  assert.equal(typeof nativeEvents.completions[0].match, "function", "registerCompletion deve usar match()");
  assert.deepEqual(nativeEvents.completions[0].match({ text: "/orgfy-card", end: 11, revision: 1 }, {}), { start: 0, end: 11, query: "orgfy-card" });
  assert.equal(nativeEvents.actions.length, 1);
  assert.equal(nativeEvents.actions[0].id, "orgfy-message-actions");
  assert.equal(typeof nativeEvents.actions[0].matches, "function", "registerMessageAction deve usar matches()");
  assert.equal(typeof nativeEvents.actions[0].icon, "function", "registerMessageAction deve expor ícone");
  assert.equal(nativeState.composerToolRegistered, true, "registerTool do composer deve estar ativo");
  assert.equal(nativeEvents.tools.length, 1);
  assert.equal(nativeEvents.tools[0].id, "orgfy-picker");
  assert.equal(nativeState.sidebarRegistered, true);
  assert.equal(nativeEvents.sidebars.length, 1);
  const sidebarSec = nativeEvents.sidebars[0];
  assert.strictEqual(sidebarSec.rows.snapshot(), sidebarSec.rows.snapshot(), "sidebar snapshot() deve retornar referência estável para useSyncExternalStore");
  assert.equal(sidebarSec.select(sidebarSec.rows.snapshot()[0]).pluginId, "digital.cortexx.orgfy", "sidebar select() deve usar pluginId digital.cortexx.orgfy");
  assert.equal(nativeState.shortcutsRegistered, true);
  assert.deepEqual(nativeEvents.shortcuts[0].binding, { key: "o", mod: true, shift: true }, "shortcut deve usar objeto KeyBinding");
  assert.equal(nativeState.attentionSourceRegistered, true);
  assert.equal(typeof nativeEvents.attentionSources[0].run, "function", "AttentionSource deve implementar run(input)");
  assert.equal(nativeState.otelHookRegistered, true);
  assert.equal(nativeState.agentTabRegistered, true, "aba OrgFy deve ser registrada nos perfis dos agentes via ctx.agents.registerTab");
  assert.equal(nativeEvents.agentTabs.length, 1);
  assert.equal(nativeEvents.agentTabs[0].title, "OrgFy");
  assert.equal(orgfyMod.getBuzzNativeState().agentTabRegistered, true);

  const failHook = nativeEvents.hooks.find((hk) => hk.harness === "buzz.pi/pi" && hk.event === "afterTool");
  assert.ok(failHook, "hook OTel buzz.pi/pi afterTool deve estar registrado");
  failHook.run({ toolName: "bash", isError: true, error: "HTTP 429" }, { agent: "OrgFy Val", session: "s1" });
  failHook.run({ toolName: "bash", isError: true, error: "HTTP 429" }, { agent: "OrgFy Val", session: "s1" });

  await orgfyMod.triageCardWithDecisions({}, {
    titulo: "Atualizar README de fixture",
    escrita_exclusiva: ["README.md"],
    acceptance_command: "pytest -q",
  });

  const snap = orgfyMod.getTelemetrySnapshot();
  assert.ok(snap.totalSpans >= 3, "spans OTel devem ser capturados");
  assert.equal(snap.decisionsSavings.totalCalls, 1);
  assert.equal(snap.decisionsSavings.wakesOrEscalationsAvoided, 1);
  assert.ok(snap.decisionsSavings.estimatedTokensSaved > 0);
  assert.equal(snap.retryCascadeAlerts.length, 1, "deve detectar retry cascade após 2 erros consecutivos");
  console.log("[v13 FRONTIER BUZZ-NATIVE + OTEL OK]", JSON.stringify({
    nativeState,
    totalSpans: snap.totalSpans,
    tokensSaved: snap.decisionsSavings.estimatedTokensSaved,
    retryCascadeAlerts: snap.retryCascadeAlerts.length,
  }));
}

// 15. v13.1: Checklist Vivo & Progresso no Card (orgfy_card_progress + colorização Mermaid)
{
  const sampleCard = await orgfyMod.createCanonicalCard({}, {
    slug: "progress-demo",
    titulo: "Validar checklist vivo no card",
    autoridade: "DECIDIDO Iris",
    decisao: "Usar checklist P1..Pn",
    executor: "OrgFy Atlas",
    revisor: "OrgFy Bento",
    escrita_exclusiva: ["src/demo.ts"],
    passos: ["Implementar funcao", "Adicionar teste", "Rodar aceite L-22"],
    feito_quando: "exit 0",
    acceptance_command: "pytest -q",
  });
  assert.equal(sampleCard.ok, true);
  assert.ok(sampleCard.markdown.includes("- [ ] **P1:** Implementar funcao"));

  const p0 = orgfyMod.parseCardProgress(sampleCard.markdown);
  assert.equal(p0.total, 3);
  assert.equal(p0.done, 0);
  assert.equal(p0.pct, 0);
  assert.equal(p0.nextPendingStepId, "P1");

  const step1 = orgfyMod.applyStepUpdateToMarkdown(sampleCard.markdown, "P1", "done", "commit abc1234", "OrgFy Atlas");
  assert.equal(step1.matched, true);
  assert.equal(step1.progress.done, 1);
  assert.equal(step1.progress.pct, 33);
  assert.equal(step1.progress.nextPendingStepId, "P2");
  assert.ok(step1.updatedMarkdown.includes("- [x] **P1:** Implementar funcao"));
  assert.ok(step1.updatedMarkdown.includes("style P1 fill:#064e3b,stroke:#10b981,color:#d1fae5"));

  const step2 = orgfyMod.applyStepUpdateToMarkdown(step1.updatedMarkdown, "P2", "in_progress", "escrevendo pytest", "OrgFy Atlas");
  assert.equal(step2.progress.inProgress, 1);
  assert.ok(step2.updatedMarkdown.includes("- [/] **P2:** Adicionar teste"));
  assert.ok(step2.updatedMarkdown.includes("style P2 fill:#451a03,stroke:#f59e0b,color:#fef3c7"));
  console.log("[v13.1 CARD PROGRESS CHECKLIST + MERMAID OK]", JSON.stringify({
    done: step2.progress.done,
    total: step2.progress.total,
    pct: step2.progress.pct,
    next: step2.progress.nextPendingStepId,
  }));
}

// 16. Auto-Failover Autônomo no Watchdog (TEMPESTADE_5XX -> probe ao vivo -> quarentena anti-ping-pong -> ctx.agents.save + retrigger)
{
  const autoTools = new Map();
  const autoSaves = [];
  const autoWakes = [];
  const autoStops = [];
  const probedModels = [];
  let bentoModel = "gemini-3.1-flash-lite";
  let quarantineFile = "{}";

  const fakeKpis = JSON.stringify({
    schema_version: "1.0.0",
    gerado_em: new Date().toISOString(),
    janela_dias: 30,
    fluxo: { vazao_total_feito: 10, fila_revisao_atual: 0 },
    qualidade: { fpy_real_pct: 100 },
    economia: { status_orcamento: "OK", uso_teto_diario_pct: 5 },
    higiene: { wip_total_ativo: 1, orphan_wip_count: 0, estagnados_nivel_3: 0 },
    alertas_ativos: [],
  });
  const fakeRadar503 = JSON.stringify({
    ok: true,
    gerado_em: new Date().toISOString(),
    resumo: { criticos: 1, criticos_ativos: 1, avisos: 0, duplicadas: 0 },
    sessoes: [
      {
        session_id: "20261124_auto503",
        agente: "OrgFy Bento",
        agent_pubkey: "d24eb749d921ee4f3465073252abc3779faa92dee1d333e40d6b03c6fb814711",
        severidade: "critical",
        ativa: true,
        ultima_atualizacao_min: 1.0,
        duracao_min: 8.0,
        shells: 2,
        errors_5xx: 5,
        recent_provider_errors: 3,
        last_provider_error_ts: Math.floor(Date.now() / 1000),
        flags: ["TEMPESTADE_5XX"],
        channel_id: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
        thread_root: "4406f509983396ed055d9739185f30bface744d032df4d1452035e6e4c00c7cd",
      },
    ],
  });
  const fakeRanking = JSON.stringify({
    version: 2,
    policy: {
      strategy: "balanced",
      forceFree: false,
      autoAssignBlocked: ["claude-opus-5-5"],
    },
    models: [
      { rank: 1, model: "claude-opus-5-5", group: "nexusmind_anthropic", score: 95, online: true, autoAssignBlocked: true },
      { rank: 2, model: "mistralai/mistral-large-4-1t-a52b", group: "nexusmind_openai", score: 87, online: true, autoAssignBlocked: false },
      { rank: 3, model: "gemini-3.1-flash-lite", group: "nexusmind_antigravity", score: 80, online: true, autoAssignBlocked: false },
      { rank: 4, model: "gemini-2.5-flash-thinking", group: "nexusmind_antigravity", score: 78, online: true, autoAssignBlocked: false },
      { rank: 5, model: "gemini-3-flash", group: "nexusmind_antigravity", score: 76, online: true, autoAssignBlocked: false },
    ],
  });

  orgfyMod.apply({
    react: { createElement: () => null },
    pages: { register: () => {} },
    settingsCards: { register: () => {} },
    panels: { register: () => {} },
    navigation: { open: async () => ({ status: "opened" }) },
    notifications: { notify: async () => {} },
    agents: {
      addInstructions: () => {},
      addTool: (t) => autoTools.set(t.name, t),
      registerHook: () => {},
      snapshot: () => ({
        agents: [
          {
            key: "local:orgfy-bento",
            pubkey: "d24eb749d921ee4f3465073252abc3779faa92dee1d333e40d6b03c6fb814711",
            name: "OrgFy Bento",
            place: "here",
            config: { model: bentoModel, provider: "nexusmind_antigravity" },
          },
        ],
        running: [],
      }),
      session: async (agentKey, place, action) => autoStops.push({ agentKey, place, action }),
      save: async (agentKey, change) => {
        autoSaves.push({ agentKey, change });
        bentoModel = change.config.model;
      },
      wake: async (agentKey, payload) => autoWakes.push({ agentKey, payload }),
    },
    host: {
      request: async (req) => {
        const body = JSON.parse(req.body || "{}");
        probedModels.push(body.model);
        // Simula mistral-large também em 503 No available accounts
        if (body.model === "mistralai/mistral-large-4-1t-a52b") {
          return { status: 503, body: JSON.stringify({ error: { message: "No available accounts" } }) };
        }
        return { status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) };
      },
      readFile: async (p) => {
        if (p.endsWith("kpis-esteira.json")) return new TextEncoder().encode(fakeKpis);
        if (p.endsWith("goose-loop-radar.json")) return new TextEncoder().encode(fakeRadar503);
        if (p.endsWith("nexusmind-model-ranking.json")) return new TextEncoder().encode(fakeRanking);
        if (p.endsWith("orgfy-model-quarantine.json")) return new TextEncoder().encode(quarantineFile);
        return new Uint8Array(fs.readFileSync(p));
      },
      writeFile: async (p, content) => {
        if (p.endsWith("orgfy-model-quarantine.json")) quarantineFile = String(content);
      },
      serveMcp: async () => ({ url: "mcp://test-auto503", close: () => {} }),
    },
  });

  const govAuto = autoTools.get("orgfy_governanca_avaliar");
  const autoRes = JSON.parse(await govAuto.call({}, {}, { dry_run: false, auto_wake: true, bypass_cooldown: true }));
  assert.equal(autoRes.ok, true);
  assert.ok(autoStops.some((s) => s.action === "interrupt"), "deve interromper sessão travada em 503 antes de trocar");
  // R4.6: renovação de sessão após troca de modelo fica sob responsabilidade do NexusMind
  assert.equal(autoSaves.length, 0, "R4.6: watchdog do OrgFy delega failover ao NexusMind sem mutar ctx.agents.save()");
  const failoverAuto = autoTools.get("orgfy_model_failover");
  const secondRes = JSON.parse(await failoverAuto.call({}, {}, { agente: "OrgFy Bento", apply: true, retrigger: false }));
  assert.equal(secondRes.ok, true);
  assert.equal(secondRes.delegated, true);
  assert.equal(secondRes.event, orgfyMod.ORGFY_FAILOVER_REQUEST_EVENT);
  console.log("[R4.6 FAILOVER DELEGATED TO NEXUSMIND OK]", JSON.stringify({ event: secondRes.event, directSaves: autoSaves.length }));
}

// 17. Auto-Failover Imediato no 1º Erro Fatal de LLM (last_msg_is_provider_error=true, ex.: 404 Resource not found no OrgFy Cron)
{
  const cronTools = new Map();
  const cronSaves = [];
  const cronWakes = [];
  let cronModel = "nous-research/stepfun/step-3.7-flash:free-high";
  const errTs = Math.floor(Date.now() / 1000);

  const fakeKpis = JSON.stringify({
    schema_version: "1.0.0",
    gerado_em: new Date().toISOString(),
    janela_dias: 30,
    fluxo: { vazao_total_feito: 10, fila_revisao_atual: 0 },
    qualidade: { fpy_real_pct: 100 },
    economia: { status_orcamento: "OK", uso_teto_diario_pct: 5 },
    higiene: { wip_total_ativo: 1, orphan_wip_count: 0, estagnados_nivel_3: 0 },
    alertas_ativos: [],
  });
  const fakeRadarSingle404 = JSON.stringify({
    ok: true,
    gerado_em: new Date().toISOString(),
    resumo: { criticos: 1, criticos_ativos: 1, avisos: 0, duplicadas: 0 },
    sessoes: [
      {
        session_id: "20261124_cron404",
        agente: "OrgFy Cron",
        agent_pubkey: "c09b31023b060000000000000000000000000000000000000000000000000000",
        severidade: "critical",
        ativa: true,
        ultima_atualizacao_min: 1.5,
        duracao_min: 2.0,
        shells: 0,
        errors_5xx: 1,
        recent_provider_errors: 1,
        last_msg_is_provider_error: true,
        last_provider_error_ts: errTs,
        last_provider_error_text: "Request failed: Resource not found (404): Model requires available accounts",
        flags: ["TEMPESTADE_5XX"],
        channel_id: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
        thread_root: "9988776655443322110099887766554433221100998877665544332211009988",
      },
    ],
  });
  const fakeRanking = JSON.stringify({
    version: 2,
    policy: { strategy: "balanced", forceFree: false, autoAssignBlocked: [] },
    models: [
      { rank: 1, model: "claude-sonnet-5-5", group: "nexusmind_anthropic", score: 92, online: true },
      { rank: 2, model: "gpt-6.1-terra", group: "nexusmind_openai", score: 88, online: true },
    ],
  });

  orgfyMod.apply({
    react: { createElement: () => null },
    pages: { register: () => {} },
    settingsCards: { register: () => {} },
    panels: { register: () => {} },
    navigation: { open: async () => ({ status: "opened" }) },
    notifications: { notify: async () => {} },
    agents: {
      addInstructions: () => {},
      addTool: (t) => cronTools.set(t.name, t),
      registerHook: () => {},
      snapshot: () => ({
        agents: [
          {
            key: "local:orgfy-cron",
            pubkey: "c09b31023b060000000000000000000000000000000000000000000000000000",
            name: "OrgFy Cron",
            place: "here",
            config: { model: cronModel, provider: "nexusmind_openai" },
          },
        ],
        running: [],
      }),
      session: async () => {},
      save: async (agentKey, change) => {
        cronSaves.push({ agentKey, change });
        cronModel = change.config.model;
      },
      wake: async (agentKey, payload) => cronWakes.push({ agentKey, payload }),
    },
    host: {
      request: async () => ({ status: 200, body: JSON.stringify({ content: [{ type: "text", text: "ok" }] }) }),
      readFile: async (p) => {
        if (p.endsWith("kpis-esteira.json")) return new TextEncoder().encode(fakeKpis);
        if (p.endsWith("goose-loop-radar.json")) return new TextEncoder().encode(fakeRadarSingle404);
        if (p.endsWith("nexusmind-model-ranking.json")) return new TextEncoder().encode(fakeRanking);
        if (p.endsWith("orgfy-model-quarantine.json")) return new TextEncoder().encode("{}");
        return new Uint8Array(fs.readFileSync(p));
      },
      writeFile: async () => {},
      serveMcp: async () => ({ url: "mcp://test-cron404", close: () => {} }),
    },
  });

  const govCron = cronTools.get("orgfy_governanca_avaliar");
  const r1 = JSON.parse(await govCron.call({}, {}, { dry_run: false, auto_wake: true }));
  assert.equal(r1.ok, true);
  assert.equal(cronSaves.length, 0, "R4.6: OrgFy delega 404 ao NexusMind sem mutar ctx.agents.save()");
  const r2 = JSON.parse(await govCron.call({}, {}, { dry_run: false, auto_wake: true }));
  assert.ok(r2.skippedByCooldown.some((s) => s.includes("auto_failover_already_healed:OrgFy Cron")));
  console.log("[R4.6 1ST CRASH 404 DELEGATED + DEDUP OK]");
}

// 18. Specsfy Enforcement em orgfy_card_create (Effort 1-10, spec_path obrigatório em Effort>=3, skills Specsfy, TDD, gate:implementacao)
{
  const blockedZ3 = await orgfyMod.createCanonicalCard({}, {
    slug: "z3-sem-spec",
    titulo: "Feature Z3 sem spec.md deve falhar",
    autoridade: "DECIDIDO Iris",
    decisao: "Aprovado",
    executor: "OrgFy Otto",
    revisor: "OrgFy Teo",
    escrita_exclusiva: ["ferramentas/novo.py"],
    feito_quando: "pytest exit 0",
    acceptance_command: "pytest -q",
    effort: 5,
  });
  assert.equal(blockedZ3.ok, false, "Effort >= 3 sem spec_path deve ser bloqueado fail-closed");
  assert.equal(blockedZ3.code, "MISSING_SPECSFY_SPEC");

  const validZ3 = await orgfyMod.createCanonicalCard({}, {
    slug: "z3-com-spec",
    titulo: "Implementar entrega Z3 com spec.md e TDD",
    autoridade: "specs/completed/0009-saneamento-hermes/spec.md + DECIDIDO Iris",
    decisao: "Aprovado",
    executor: "OrgFy Otto",
    revisor: "OrgFy Teo",
    escrita_exclusiva: ["ferramentas/novo.py"],
    feito_quando: "pytest exit 0",
    acceptance_command: "pytest -q",
    effort: 5,
    spec_path: "specs/completed/0009-saneamento-hermes/spec.md",
  });
  assert.equal(validZ3.ok, true);
  assert.equal(validZ3.effort, 5);
  assert.equal(validZ3.ato, "ato_3");
  assert.ok(validZ3.markdown.includes("specsfy-07-implement"), "deve injetar skill Specsfy do Ato III");
  assert.ok(validZ3.markdown.includes("- **Effort:** 5/10"), "deve registrar Effort no card");
  assert.ok(validZ3.markdown.includes("- **Spec:** specs/completed/0009-saneamento-hermes/spec.md"), "deve registrar Spec no card");
  assert.ok(validZ3.markdown.includes("RED"), "passos padrão devem exigir ciclo TDD RED->GREEN");
  assert.ok(validZ3.publishCommand.includes("--gate gate:implementacao"), "execucao não pode mais emitir --gate gate:qa");
  console.log("[SPECSFY CARD-CREATOR ENFORCEMENT OK]", JSON.stringify({ effort: validZ3.effort, ato: validZ3.ato, gate: "gate:implementacao" }));
}

// 19. Auto-Failover v2: bloqueio de tab_jump/auto/*, probe com tools, reset de sessão ("new") e hook turn.failed para 400 tool calling
{
  const hooks = [];
  const saves = [];
  const sessions = [];
  const wakes = [];
  const probePayloads = [];
  let arqModel = "tab_jump_flash_lite_preview";

  const fakeRankingBad = JSON.stringify({
    version: 2,
    policy: { strategy: "balanced", forceFree: false, autoAssignBlocked: [] },
    models: [
      { rank: 1, model: "tab_jump_flash_lite_preview", group: "nexusmind_antigravity", score: 99, online: null, autoAssignBlocked: false },
      { rank: 2, model: "auto/claude-sonnet", group: "nexusmind_openai", score: 98, online: null, autoAssignBlocked: false },
      { rank: 3, model: "gemini-3.8-flash-medium", group: "nexusmind_antigravity", score: 89.6, online: true, autoAssignBlocked: false },
    ],
  });

  orgfyMod.apply({
    react: { createElement: () => null },
    pages: { register: () => {} },
    settingsCards: { register: () => {} },
    panels: { register: () => {} },
    navigation: { open: async () => ({ status: "opened" }) },
    notifications: { notify: async () => {} },
    agents: {
      addInstructions: () => {},
      addTool: () => {},
      registerHook: (hk) => hooks.push(hk),
      snapshot: () => ({
        agents: [
          {
            key: "local:orgfy-bento-arq",
            pubkey: "6d2ab612cc8e091e5c4381694728ce3f8873661156adeeda1522737af334b271",
            name: "OrgFy Bento Arquiteto",
            place: "here",
            config: { model: arqModel, provider: "nexusmind_antigravity" },
          },
        ],
        running: [],
      }),
      session: async (agentKey, place, action) => sessions.push({ agentKey, place, action }),
      save: async (agentKey, change) => {
        saves.push({ agentKey, change });
        arqModel = change.config.model;
      },
      wake: async (agentKey, payload) => wakes.push({ agentKey, payload }),
    },
    host: {
      request: async (req) => {
        const body = JSON.parse(req.body || "{}");
        probePayloads.push(body);
        return { status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) };
      },
      readFile: async (p) => {
        if (p.endsWith("nexusmind-model-ranking.json")) return new TextEncoder().encode(fakeRankingBad);
        if (p.endsWith("orgfy-model-quarantine.json")) return new TextEncoder().encode("{}");
        return new Uint8Array(fs.readFileSync(p));
      },
      writeFile: async () => {},
      serveMcp: async () => ({ url: "mcp://test-failover-v2", close: () => {} }),
    },
  });

  const turnFailedHook = hooks.find((hk) => hk.id === "orgfy-claude-tool-failure-failover");
  assert.ok(turnFailedHook, "hook orgfy-claude-tool-failure-failover deve estar registrado");
  await turnFailedHook.run({
    agentName: "OrgFy Bento Arquiteto",
    agentPubkey: "6d2ab612cc8e091e5c4381694728ce3f8873661156adeeda1522737af334b271",
    model: "auto/claude-sonnet",
    error: "Request failed: Bad request (400): No target in combo auto/claude-sonnet supports tool calling; request carried 50 tools",
    channelId: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
    threadRoot: "39a75068da62278de10a7b638f65ed91ca0e35eb508aed4477c0511e4354b3ba",
  });

  // B2: Verifica filtro fiel de buzz-app/src/features/agents/hooks.ts:50 para TODOS os hooks registrados
  const VALID_BUZZ_EVENTS = {
    "buzz.pi/pi": new Set(["beforeTool", "afterTool"]),
    "buzz.claude-code/claude-code": new Set(["PreToolUse", "PostToolUse", "PostToolUseFailure", "Stop"]),
  };
  const handlers = (harness, event) => hooks.filter((hk) => hk.harness === harness && hk.event === event);
  for (const hk of hooks) {
    assert.ok(VALID_BUZZ_EVENTS[hk.harness], `harness inválido registrado: ${hk.harness}`);
    assert.ok(VALID_BUZZ_EVENTS[hk.harness].has(hk.event), `evento inválido para ${hk.harness}: ${hk.event}`);
    assert.ok(handlers(hk.harness, hk.event).some((x) => x.id === hk.id), `handlers(${hk.harness}, ${hk.event}) deve encontrar ${hk.id}`);
  }
  assert.equal(handlers("all", "turn.failed").length, 0, "não deve existir hook harness=all/turn.failed");
  assert.equal(handlers("buzz.claude-code/claude-code", "beforeTool").length, 0, "claude-code não usa beforeTool");

  assert.equal(saves.length, 0, "R4.6: hook delega failover ao NexusMind sem chamar ctx.agents.save()");
  console.log("[R4.6 HOOK DELEGATED OK]", JSON.stringify({ directSaves: saves.length }));
}

// 20. SOTA AAA: Write-Set Conflict Guard (WRITE_SET_CONFLICT) em orgfy_checkout_lock
{
  const wsIssueA = "1111222233334444555566667777888899990000aaaabbbbccccddddeeee0001";
  const wsIssueB = "1111222233334444555566667777888899990000aaaabbbbccccddddeeee0002";
  const wsIssueC = "1111222233334444555566667777888899990000aaaabbbbccccddddeeee0003";

  const lockA = JSON.parse(await lockTool.call({}, {}, {
    action: "acquire",
    issue_id: wsIssueA,
    agent_id: "OrgFy Otto",
    exclusive_paths: ["ferramentas/esteira/"],
  }));
  assert.equal(lockA.ok, true);

  // Card B toca arquivo dentro do diretório de A -> WRITE_SET_CONFLICT (impede conflito de merge antes de executar!)
  const lockB = JSON.parse(await lockTool.call({}, {}, {
    action: "acquire",
    issue_id: wsIssueB,
    agent_id: "OrgFy Val",
    exclusive_paths: ["ferramentas/esteira/porteiro.py"],
  }));
  assert.equal(lockB.ok, false);
  assert.equal(lockB.code, "WRITE_SET_CONFLICT");
  assert.ok(lockB.conflictingPaths.includes("ferramentas/esteira/porteiro.py"));

  // Card C toca caminho independente -> liberado em paralelo!
  const lockC = JSON.parse(await lockTool.call({}, {}, {
    action: "acquire",
    issue_id: wsIssueC,
    agent_id: "OrgFy Atlas",
    exclusive_paths: ["docs/NOVO_GUIA.md"],
  }));
  assert.equal(lockC.ok, true);

  await lockTool.call({}, {}, { action: "release", issue_id: wsIssueA, agent_id: "OrgFy Otto" });
  await lockTool.call({}, {}, { action: "release", issue_id: wsIssueC, agent_id: "OrgFy Atlas" });
  console.log("[SOTA WRITE-SET CONFLICT GUARD OK]", JSON.stringify({ blockedCode: lockB.code, independentParallelOk: lockC.ok }));
}

// 21. v13.5: Presence & Lease Reconciler (mata estado 'trabalhando zumbi' após Stop/crash/restart)
{
  orgfyMod.resetPresenceStateForTests();
  const baseNow = Date.now();
  const zombieIssue = "aaaa111122223333444455556666777788889999aaaabbbbccccddddeeee0021";
  const liveIssue = "aaaa111122223333444455556666777788889999aaaabbbbccccddddeeee0022";
  const memFiles = new Map();
  const mockPresenceCtx = {
    agents: {
      snapshot: () => ({
        agents: [
          { key: "local:orgfy-otto", name: "OrgFy Otto", config: { model: "gemini-3.8-flash-medium", provider: "nexusmind_antigravity" } },
          { key: "local:orgfy-val", name: "OrgFy Val", config: { model: "gemini-3.8-flash-medium", provider: "nexusmind_antigravity" } },
        ],
        running: [
          { key: "local:orgfy-otto", name: "OrgFy Otto", config: { model: "gemini-3.8-flash-medium", provider: "nexusmind_antigravity" } },
        ],
      }),
      sessionState: (k) => (k === "local:orgfy-otto" ? "active" : "idle"),
    },
    host: {
      readFile: async (p) => {
        if (memFiles.has(p)) return new TextEncoder().encode(memFiles.get(p));
        throw new Error("ENOENT");
      },
      writeFile: async (p, c) => memFiles.set(p, String(c)),
    },
  };

  await lockTool.call({}, {}, { action: "acquire", issue_id: zombieIssue, agent_id: "OrgFy Val", exclusive_paths: ["src/zumbi.ts"] });
  await lockTool.call({}, {}, { action: "acquire", issue_id: liveIssue, agent_id: "OrgFy Otto", exclusive_paths: ["src/ativo.ts"] });

  const recon = await orgfyMod.reconcileAgentPresenceAndLocks(mockPresenceCtx, {
    nowMs: baseNow + 5 * 60 * 1000,
    orphanGraceMs: 3 * 60 * 1000,
  });
  assert.equal(recon.ok, true);
  assert.ok(recon.orphanedReleased.some((o) => o.issueId === zombieIssue && o.agentKey === "OrgFy Val"), "lock zumbi de Val deve ser liberado automaticamente");
  assert.ok(recon.activeLocks.some((l) => l.issueId === liveIssue && l.agentKey === "OrgFy Otto"), "lock real de Otto (running) deve ser preservado/renovado");
  assert.ok(orgfyMod.getOrgfyPipelineEvents(10).some((e) => e.type === "lock.orphaned_released" && e.issueId === zombieIssue));
  await lockTool.call({}, {}, { action: "release", issue_id: liveIssue, agent_id: "OrgFy Otto" });
  console.log("[v13.5 PRESENCE & LEASE RECONCILER OK]", JSON.stringify({ orphanedReleased: recon.orphanedReleased.length, renewed: recon.renewedCount }));
}

// 22. v13.5: orgfy_roster_live (Raio-X unificado de presença real em 1 chamada)
{
  const rosterTool = h1.tools.get("orgfy_roster_live");
  assert.ok(rosterTool, "agentTool orgfy_roster_live deve estar registrada");
  const rosterRes = await orgfyMod.buildLiveAgentRoster(
    {
      agents: {
        snapshot: () => ({
          agents: [
            { key: "local:orgfy-teo", name: "OrgFy Teo", config: { model: "claude-sonnet-5-5", provider: "nexusmind_anthropic" } },
            { key: "local:orgfy-bento-arq", name: "OrgFy Bento Arquiteto", config: { model: "gemini-3.8-flash-medium", provider: "nexusmind_antigravity" } },
          ],
          running: [
            { key: "local:orgfy-teo", name: "OrgFy Teo", config: { model: "claude-sonnet-5-5", provider: "nexusmind_anthropic" } },
          ],
        }),
        sessionState: (k) => (k === "local:orgfy-teo" ? "active" : "idle"),
      },
      host: {
        readFile: async () => { throw new Error("ENOENT"); },
        writeFile: async () => {},
      },
    },
    { empresa: "orgfy", reconcile: true }
  );
  assert.equal(rosterRes.ok, true);
  assert.equal(rosterRes.resumo.total, 2);
  assert.ok(rosterRes.agentes.some((a) => a.name === "OrgFy Teo" && a.status === "WORKING_REAL"), "OrgFy Teo (running) deve aparecer WORKING_REAL");
  assert.ok(rosterRes.agentes.some((a) => a.name === "OrgFy Bento Arquiteto" && a.status === "FREE"), "OrgFy Bento Arquiteto (idle) deve aparecer FREE");
  console.log("[v13.5 ROSTER LIVE OK]", JSON.stringify(rosterRes.resumo));
}

// 23. v13.5: orgfy_handoff_pack (Pacote de retomada P1..Pn + L-22 + Escrita exclusiva)
{
  const handoffTool = h1.tools.get("orgfy_handoff_pack");
  assert.ok(handoffTool, "agentTool orgfy_handoff_pack deve estar registrada");
  const sampleMd = [
    "<!-- orgfy:card v4 -->",
    "# SPEC-9999 T001 Teste Handoff",
    "- **Escrita exclusiva:** `src/a.ts`, `src/b.ts`",
    "- **Comando de aceite (L-22):** `pytest -q tests/test_a.py`",
    "## O que fazer",
    "- [x] **P1:** Criar teste RED",
    "- [ ] **P2:** Implementar código GREEN",
  ].join("\n");
  const pack = JSON.parse(await handoffTool.call({}, {}, { slug: "SPEC-9999-T001", card_markdown: sampleMd }));
  assert.equal(pack.ok, true);
  assert.equal(pack.progress.done, 1);
  assert.equal(pack.progress.nextPendingStepId, "P2");
  assert.deepEqual(pack.exclusivePaths, ["src/a.ts", "src/b.ts"]);
  assert.ok(pack.resumePrompt.includes("P2"));
  assert.ok(pack.resumePrompt.includes("pytest -q tests/test_a.py"));
  console.log("[v13.5 HANDOFF PACK OK]", JSON.stringify({ next: pack.progress.nextPendingStepId, paths: pack.exclusivePaths }));
}

// 24. v13.5: One-Shot Decision Dispatcher (orgfy_smart_dispatch com L-01 + ctx.decisions + auto-execute + Attention cleanup)
{
  const smartWakes = [];
  const smartCtx = {
    agents: {
      snapshot: () => ({
        agents: [
          { key: "local:orgfy-otto", name: "OrgFy Otto", config: { model: "gemini-3.8-flash-medium", provider: "nexusmind_antigravity" } },
          { key: "local:orgfy-atlas", name: "OrgFy Atlas", config: { model: "gemini-3.8-flash-medium", provider: "nexusmind_antigravity" } },
          { key: "local:orgfy-teo", name: "OrgFy Teo", config: { model: "claude-sonnet-5-5", provider: "nexusmind_anthropic" } },
        ],
        running: [],
      }),
      sessionState: () => "idle",
      wake: async (agentKey, payload) => smartWakes.push({ agentKey, payload }),
    },
    decisions: {
      decide: async (req) => {
        if (req?.questions?.best_executor) {
          return {
            outcome: "answered",
            backend: "nexusmind-fast",
            model: "gemini-3.8-flash-medium",
            answers: {
              best_executor: { type: "choice", choice: "OrgFy Atlas", confidence: 0.93 },
            },
          };
        }
        return {
          outcome: "answered",
          backend: "nexusmind-fast",
          model: "gemini-3.8-flash-medium",
          answers: {
            escopo_atomico: { type: "yes_no", probability: 0.95 },
            risco_tier: { type: "score", score: 1, confidence: 0.9, probabilities: {} },
            modelo_tier: { type: "choice", choice: "tier1_fast", confidence: 0.9 },
            politica_attention: { type: "choice", choice: "event_driven", confidence: 0.9 },
          },
        };
      },
    },
    host: {
      readFile: async () => { throw new Error("ENOENT"); },
      writeFile: async () => {},
    },
  };

  const smartIssue = "bbbb111122223333444455556666777788889999aaaabbbbccccddddeeee0024";
  const dispRes = await orgfyMod.runOneShotDecisionDispatch(smartCtx, {
    issue_id: smartIssue,
    slug: "smart-demo",
    titulo: "Ajuste pontual de fixture de teste",
    revisor: "OrgFy Teo",
    exclusive_paths: ["testes/fixture_demo.py"],
    acceptance_command: "pytest -q testes/fixture_demo.py",
    auto_execute: true,
  });
  assert.equal(dispRes.ok, true);
  assert.equal(dispRes.action, "AUTO_DISPATCHED");
  assert.equal(dispRes.decisionSource, "decisions_api");
  assert.equal(dispRes.selectedAgent, "OrgFy Atlas");
  assert.ok(!dispRes.candidatesEvaluated.includes("OrgFy Teo"), "L-01: revisor não pode entrar como candidato a executor");
  assert.equal(dispRes.wokeAgent, true);
  assert.equal(smartWakes.length, 1);

  const cleanup = await orgfyMod.cleanupAttentionOnStageChange(smartCtx, {
    issueId: smartIssue,
    slug: "smart-demo",
    newStage: "feito",
  });
  assert.equal(cleanup.ok, true);
  assert.equal(cleanup.lockReleased, true);
  assert.equal(cleanup.event.type, "attention.cleaned_up");
  console.log("[v13.5 ONE-SHOT DECISION DISPATCHER + ATTENTION CLEANUP OK]", JSON.stringify({
    selected: dispRes.selectedAgent,
    confidence: dispRes.confidence,
    woke: dispRes.wokeAgent,
    cleaned: cleanup.lockReleased,
  }));

  // R5.1: Cadeia de failover baseada no eval real de 10 cards (docs/eval-modelos-onda5.md)
  assert.ok(Array.isArray(orgfyMod.VERIFIED_TOOLCALL_FAILOVER_CHAIN), "R5.1: VERIFIED_TOOLCALL_FAILOVER_CHAIN deve ser exportada");
  const chainModels = orgfyMod.VERIFIED_TOOLCALL_FAILOVER_CHAIN.map((c) => c.model);
  assert.deepEqual(chainModels, [
    "gemini-2.5-flash",
    "claude-sonnet-4-6",
  ]);
  assert.equal(orgfyMod.isUnsupportedAgentModel("grok-4.5"), true, "B3: grok-4.5 (503) deve ser bloqueado no failover");
  assert.equal(
    orgfyMod.isUnsupportedAgentModel("mistralai/mistral-large-4-1t-a52b"),
    true,
    "B3: mistral-large-4-1t-a52b (timeout >20s) deve ser bloqueado no failover"
  );
  assert.equal(orgfyMod.isUnsupportedAgentModel("claude-sonnet-4-6"), false);
  assert.equal(orgfyMod.isUnsupportedAgentModel("claude-haiku-5-5"), false);
  console.log("[B3 FAILOVER CHAIN VERIFIED OK]", JSON.stringify({ chainModels }));
}

// 25. Fase 2 (PRD v15): Adaptador FactoryStatus real (orgfy + lumen-iptv), Kill Switch/Drain, Isolamento CSS Shadow DOM e Atribuição MIT
{
  const { execFileSync } = await import("node:child_process");
  const orgfyHome = process.env.ORGFY_HOME || process.env.HOME || "";
  const fabricaScript = path.resolve(orgfyHome, ".buzz", "REPOS", "orgfy", "ferramentas", "esteira", "fabrica_status.py");

  if (fs.existsSync(fabricaScript)) {
    for (const tenantSlug of ["orgfy", "lumen-iptv"]) {
      const rawOut = execFileSync("python3", [fabricaScript, "--empresa", tenantSlug, "--json"], {
        encoding: "utf8",
        env: { ...process.env, HOME: orgfyHome },
      });
      const parsed = orgfyMod.parseFactoryStatus(JSON.parse(rawOut));
      assert.equal(parsed.projectId, tenantSlug);
      assert.equal(parsed.tenant, tenantSlug);
      assert.ok(Array.isArray(parsed.indisponivel));
      assert.ok(["ativo", "parado"].includes(parsed.coordenador));
    }
  }

  // Teste de persistência real de Kill Switch + Drain + Limites via writeTenantControl
  const memControls = new Map();
  const ctrlCtx = {
    host: {
      readFile: async (p) => {
        if (memControls.has(p)) return new TextEncoder().encode(memControls.get(p));
        throw new Error("ENOENT");
      },
      writeFile: async (p, content) => {
        memControls.set(p, String(content));
      },
    },
  };
  const ksRes = await orgfyMod.writeTenantControl(ctrlCtx, "orgfy", {
    killSwitch: true,
    drain: true,
    mode: "assisted",
    pausedReason: "Teste Fase 2",
    limits: { gastoDiaUsd: 25, mergesDia: 10 },
  });
  assert.equal(ksRes.ok, true);
  assert.equal(ksRes.control.killSwitch, true);
  assert.equal(ksRes.control.drain, true);
  assert.equal(ksRes.control.mode, "assisted");
  assert.equal(ksRes.control.limits.gastoDiaUsd, 25);
  assert.ok(memControls.get(ksRes.path).includes("\"killSwitch\": true"));

  // Isolamento CSS Shadow DOM: zero seletores globais body/html vazando para o Buzz
  const css = orgfyMod.FACTORY_SHADOW_CSS;
  assert.equal(typeof css, "string");
  assert.ok(css.includes(":host"), "CSS da fábrica deve usar :host para Shadow DOM");
  assert.ok(!/(^|\n)\s*(html|body|\*)\s*\{/m.test(css), "CSS da fábrica não pode vazar seletores globais html/body/*");

  // Raia Docs mantém Revisor L-01 no diagrama pt-BR
  assert.ok(
    orgfyMod.PT_BR.pipelines.lanes.docs.steps.some((s) => s.id === "review_docs" && s.label === "Revisar"),
    "Raia de Documentação deve manter etapa de Revisor (L-01)"
  );

  // Atribuição MIT obrigatória (THIRD_PARTY_NOTICES.md + cabeçalho em src/factory/*)
  const noticesPath = path.resolve(__dirname, "THIRD_PARTY_NOTICES.md");
  assert.ok(fs.existsSync(noticesPath), "THIRD_PARTY_NOTICES.md obrigatório");
  assert.ok(fs.readFileSync(noticesPath, "utf8").includes("b0b2a5a"), "THIRD_PARTY_NOTICES.md deve citar commit b0b2a5a do CodeDen");
  const factoryDir = path.resolve(__dirname, "src", "factory");
  for (const f of fs.readdirSync(factoryDir).filter((n) => n.endsWith(".ts") || n.endsWith(".tsx"))) {
    const firstLine = fs.readFileSync(path.join(factoryDir, f), "utf8").split("\n")[0] || "";
    assert.ok(firstLine.includes("Adaptado de CodeDen (MIT) commit b0b2a5a"), `${f} deve conter atribuição MIT no cabeçalho`);
  }

  console.log("[FASE 2 FACTORY ADAPTER + KILL SWITCH + SHADOW CSS + MIT OK]");
}

// 26. Bloco D (v17): Segurança do manifest (sem osascript/python irrestrito) e fim da UI antiga
{
  const { test } = await import("node:test");
  test("manifest.json não permite osascript, open ou python irrestrito em host.processes", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "manifest.json"), "utf8"));
    const procs = manifest?.host?.processes || [];
    for (const p of procs) {
      assert.notEqual(p.program, "osascript", "osascript irrestrito é proibido");
      assert.notEqual(p.program, "open", "open irrestrito é proibido");
      if (p.program === "python3" || p.program === "python") {
        assert.ok(Array.isArray(p.args) && p.args.length > 0, "python irrestrito sem args fixos é proibido");
      }
    }
  });

  test("plugin.js não contém spawn de osascript nem toggle da UI antiga Control Room clássico", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    assert.ok(!bundle.includes('spawn("osascript"'), "plugin.js não deve chamar host.spawn('osascript')");
    assert.ok(!bundle.includes("Control Room clássico"), "botão da UI antiga deve estar removido");
    assert.ok(!bundle.includes("orgfy.view.toggle"), "switcher da UI antiga deve estar removido");
  });

  test("sidebar CodeDen 1:1 recolhível (SidebarRail + Command Palette Cmd+K) presente no bundle", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    assert.ok(bundle.includes("of-sidebar-rail"), "SidebarRail recolhida deve estar no bundle");
    assert.ok(bundle.includes("Buscar ou executar"), "barra de busca Command Palette deve estar no bundle");
    assert.ok(bundle.includes("of-sb-tree"), "árvore expansível de empresas estilo CodeDen deve estar no bundle");
    assert.ok(bundle.includes("of-sb-footer"), "footer com status e 4 utilitários deve estar no bundle");
  });

  test("v17.2: Overview modular 1:1 CodeDen + fix de scroll + header minimalista estilo Apple + Boardroom 3D + APIs de agentes", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    const css = orgfyMod.FACTORY_SHADOW_CSS;
    assert.ok(css.includes("of-overview-stack"), "CSS deve conter wrapper .of-overview-stack");
    assert.ok(css.includes("overscroll-behavior: contain"), "CSS deve habilitar scroll suave em .of-main");
    assert.ok(css.includes("of-apple-chat-bar"), "CSS deve conter estilo minimalista .of-apple-chat-bar");
    assert.ok(bundle.includes("data-overview-modular"), "Overview deve renderizar blocos modulares individuais");
    assert.ok(bundle.includes("of-now-next"), "Overview deve renderizar bloco AGORA + PRÓXIMOS");
    assert.ok(bundle.includes("SESSÕES & AGENTES"), "Overview deve renderizar bloco Sessões & Agentes");
    assert.ok(bundle.includes("AUTOMAÇÕES"), "Overview deve renderizar bloco Automações");
    assert.ok(bundle.includes("data-apple-header-chat"), "Header superior direito deve usar controle minimalista estilo Apple");
    const factoryAppSrc = fs.readFileSync(path.resolve(__dirname, "src", "factory", "FactoryApp.tsx"), "utf8");
    assert.ok(!factoryAppSrc.includes('"Canal no Buzz ↗"'), "botão redundante Canal no Buzz ↗ deve ter sido removido do header");
    assert.ok(!factoryAppSrc.includes("Andar 3D (${tenantTotalAgentsCount})"), "botão redundante Andar 3D no header deve ter sido removido");
    assert.ok(bundle.includes("data-boardroom-3d"), "Tema 3D leve boardroom deve estar presente no bundle");
    assert.ok(bundle.includes("data-reconcile-r51"), "Botão de reconciliação Eval R5.1 via ctx.agents.save deve estar presente");
  });

  test("v17.3: Buzz Repos nativo (session.repositories/projectGit), deep link 1-salto, Canvas editável, Thread e AgentProfileDrawer/Transcript", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    const bridgeSrc = fs.readFileSync(path.resolve(__dirname, "src", "services", "orgfy-bridge.ts"), "utf8");
    assert.ok(bridgeSrc.includes("ctx?.relay?.snapshot"), "openIssueInBuzz deve resolver scope via ctx.relay.snapshot()");
    assert.ok(bundle.includes("data-buzz-repo-detail"), "ItemSheetDrawer deve renderizar detalhe NIP-34 do Buzz Repos");
    assert.ok(bundle.includes("data-embedded-buzz-thread"), "ItemSheetDrawer deve suportar ctx.conversation.ui.Thread");
    assert.ok(bundle.includes("data-canvas-live-editor"), "Aba Canvas deve suportar edição e salvamento via session.canvas.save");
    assert.ok(bundle.includes("data-agent-profile-drawer"), "Drawer de Perfil & Transcript do Agente deve estar presente");
    assert.ok(bundle.includes("data-agent-nip-ap-editor"), "Editor NIP-AP inline via ctx.agents.save deve estar presente");
  });

  test("Onda 3: addAttentionSource real (bus + polling dedup), MessageAction contextual e ComposerTool picker", async () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    assert.ok(bundle.includes("data-orgfy-message-action-modal"), "Modal contextual de MessageAction deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-composer-picker"), "Picker de composer registerTool deve estar no bundle");
    assert.ok(bundle.includes("orgfy-picker"), "ID orgfy-picker deve estar registrado no bundle");

    // 1. AttentionSource real: entrega de eventos do barramento + filtro + dedup + polling real + abort limpo
    const emitted = [];
    const ac = new AbortController();
    const fakeRadar = JSON.stringify({
      ok: true,
      gerado_em: new Date().toISOString(),
      resumo: { criticos: 1, criticos_ativos: 1, avisos: 0, duplicadas: 0 },
      sessoes: [
        {
          session_id: "sess-onda3-loop",
          agente: "OrgFy Otto",
          severidade: "critical",
          ativa: true,
          ultima_atualizacao_min: 1,
          duracao_min: 19,
          shells: 24,
          flags: ["LOOP_SUSPEITO"],
        },
      ],
    });
    const fakeKpis = JSON.stringify({
      schema_version: "1.0.0",
      gerado_em: new Date().toISOString(),
      janela_dias: 30,
      fluxo: { vazao_total_feito: 10, fila_revisao_atual: 0 },
      qualidade: { fpy_real_pct: 96.5 },
      economia: { status_orcamento: "ALERTA", uso_teto_diario_pct: 84.2 },
      higiene: { wip_total_ativo: 1, orphan_wip_count: 0, estagnados_nivel_3: 0 },
      alertas_ativos: [
        { codigo: "CI_BROKEN", severidade: "critical", mensagem: "CI falhou na etapa pytest", acao_sugerida: "Checar log" },
      ],
    });
    const src = orgfyMod.createOrgfyPipelineAttentionSource({
      host: {
        readFile: async (p) => {
          if (p.endsWith("goose-loop-radar.json")) return new TextEncoder().encode(fakeRadar);
          if (p.endsWith("kpis-esteira.json")) return new TextEncoder().encode(fakeKpis);
          throw new Error("ENOENT");
        },
      },
    });
    const runPromise = src.run({
      id: "watch-onda3",
      agent: "local:orgfy-bento",
      watch: {
        config: {
          empresa: "orgfy",
          events: ["card.ready_for_review", "loop.detected", "ci.failed", "budget.80pct"],
          pollMs: 60000,
        },
      },
      signal: ac.signal,
      emit: (txt) => emitted.push(txt),
    });

    await new Promise((r) => setTimeout(r, 40));
    orgfyMod.emitOrgfyPipelineEvent({
      type: "card.ready_for_review",
      empresa: "orgfy",
      issueId: "abcd1234",
      agent: "OrgFy Teo",
      summary: "PR pronto para Gate",
    });
    orgfyMod.emitOrgfyPipelineEvent({
      type: "card.ready_for_review",
      empresa: "lumen-iptv",
      issueId: "ffff9999",
      summary: "Outro tenant deve ser filtrado",
    });
    ac.abort();
    await runPromise;

    assert.ok(emitted.some((t) => t.includes("card.ready_for_review") && t.includes("abcd1234")), "deve emitir evento do barramento em tempo real");
    assert.ok(!emitted.some((t) => t.includes("ffff9999")), "deve filtrar eventos de outra empresa");
    assert.ok(emitted.some((t) => t.includes("loop.detected") && t.includes("OrgFy Otto")), "deve emitir loop.detected do radar");
    assert.ok(emitted.some((t) => t.includes("budget.80pct") && t.includes("84.2%")), "deve emitir budget.80pct quando >=80%");
    assert.ok(emitted.some((t) => t.includes("ci.failed") && t.includes("CI_BROKEN")), "deve emitir ci.failed para alertas críticos");

    // 2. MessageAction contextual parser
    const fakeHex = "a1b2c3d4".repeat(8);
    const parsedPr = orgfyMod.parseOrgfyMessageContext({
      id: "msg-1",
      channelId: "ch-1",
      authorId: "pub-1",
      content: `DECIDIDO: revisar SPEC-0040-T002 em buzz://pr?id=${fakeHex}&owner=${fakeHex}&d=lumen-iptv\nGATE pendente`,
    });
    assert.equal(parsedPr.citedEntity?.type, "pr");
    assert.equal(parsedPr.citedEntity?.id, fakeHex);
    assert.equal(parsedPr.citedEntity?.dtag, "lumen-iptv");
    assert.equal(parsedPr.citedSlug, "SPEC-0040-T002");
    assert.equal(parsedPr.hasGateKeyword, true);
    assert.equal(parsedPr.hasDecidedKeyword, true);

    // 3. ComposerTool picker insertResource + fallback insertText + snippets
    assert.ok(orgfyMod.ORGFY_GATE_SNIPPETS.length >= 4, "deve oferecer snippets de Gate/Spec/Bloqueado");
    const uri = orgfyMod.buildBuzzEntityUri("issue", fakeHex, fakeHex, "orgfy");
    assert.ok(uri.startsWith(`buzz://issue?id=${fakeHex}&owner=${fakeHex}&d=orgfy`));
    let focused = false;
    let insertedRes = null;
    const resOk = orgfyMod.insertOrgfyPickerEntry(
      { id: "i1", category: "repos", badge: "ISSUE", title: "Card 1", subtitle: "orgfy", resource: { uri, label: "Card 1" }, insertText: `[Card 1](${uri}) ` },
      { insertResource: (r) => { insertedRes = r; return true; }, focus: () => { focused = true; } }
    );
    assert.equal(resOk.ok, true);
    assert.equal(insertedRes.uri, uri);
    assert.equal(focused, true);

    let fallbackTxt = "";
    const resFallback = orgfyMod.insertOrgfyPickerEntry(
      { id: "i2", category: "repos", badge: "ISSUE", title: "Card 2", subtitle: "orgfy", resource: { uri, label: "Card 2" }, insertText: `[Card 2](${uri}) ` },
      { insertResource: () => "Link rejeitado", insertText: (t) => { fallbackTxt = t; return true; } }
    );
    assert.equal(resFallback.ok, true);
    assert.ok(fallbackTxt.includes(uri), "fallback deve usar insertText se insertResource recusar");
  });

  test("v17.4: fix de persistência de Limites (WIP/mergePolicy), popover 3D interativo, guia Como funciona e card estruturado no Inspector", async () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    assert.ok(bundle.includes("data-floor3d-agent-popover"), "Popover interativo ao clicar nos bonequinhos 3D deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-factory-guide"), "Modal Como funciona o loop da Fábrica deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-structured-card"), "Renderizador estruturado de campos do card OrgFy deve estar no bundle");

    // 1. writeTenantControl persiste prsAbertos (WIP), mergePolicy e autoMerge sem sobrescrever nem falhar silenciosamente
    const savedFiles = new Map();
    const okCtx = {
      host: {
        readFile: async (p) => {
          if (savedFiles.has(p)) return new TextEncoder().encode(savedFiles.get(p));
          throw new Error("ENOENT");
        },
        writeFile: async (p, content) => {
          savedFiles.set(p, String(content));
        },
      },
    };
    const saveRes = await orgfyMod.writeTenantControl(okCtx, "orgfy", {
      mode: "software_factory",
      mergePolicy: "fast",
      autoMerge: true,
      limits: { gastoDiaUsd: 80, mergesDia: 30, agentes: 5, prsAbertos: 12, falhasSeguidas: 4 },
    });
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.control.limits.prsAbertos, 12);
    assert.equal(saveRes.control.mergePolicy, "fast");
    assert.equal(saveRes.control.autoMerge, true);
    const writtenJson = JSON.parse(savedFiles.get(saveRes.path));
    assert.equal(writtenJson.limits.prsAbertos, 12);
    assert.equal(writtenJson.mergePolicy, "fast");
    assert.equal(writtenJson.autoMerge, true);

    // Erro de escrita retorna ok: false com mensagem explícita em error
    const failCtx = {
      host: {
        readFile: async () => { throw new Error("ENOENT"); },
        writeFile: async () => { throw new Error("EACCES: read-only"); },
      },
    };
    const failRes = await orgfyMod.writeTenantControl(failCtx, "orgfy", { limits: { prsAbertos: 9 } });
    assert.equal(failRes.ok, false);
    assert.ok(failRes.error && failRes.error.includes("EACCES"));

    // 2. parseOrgfyCardStructure extrai Estado, Papéis, Escrita exclusiva, Checklist e Aceite L-22
    const sampleCanonical = [
      "<!-- orgfy:card v4 -->",
      "## Objetivo",
      "Implementar P1: Main-CI Watchdog com auto-revert pós-merge na main.",
      "",
      "## Estado",
      "- **Contexto:** Pontos de inserção confirmados em ferramentas/esteira/porteiro.py.",
      "- **Autoridade:** OrgFy Iris",
      "- **Decisão:** DECIDIDO (01:28) - Relatório CodeDen vs OrgFy",
      "",
      "## Papéis e ambiente",
      "- **Tipo:** seguranca",
      "- **Executor:** OrgFy Otto",
      "- **Revisor:** OrgFy Vera",
      "- **Decisor:** OrgFy Iris",
      "- **Effort:** 4/10",
      "",
      "## Escopo",
      "- **Escrita exclusiva:** `ferramentas/esteira/porteiro.py`, `testes/test_watchdog.py`",
      "- [x] **P1:** Criar teste RED do watchdog",
      "- [ ] **P2:** Implementar auto-revert e pausa da esteira",
      "",
      "## Aceite (L-22)",
      "- **Feito quando:** pytest passa com exit 0",
      "- **Comando de aceite:** `python3 -m pytest -q testes/test_watchdog.py`",
    ].join("\n");

    const parsed = orgfyMod.parseOrgfyCardStructure(sampleCanonical);
    assert.ok(parsed, "parseOrgfyCardStructure deve reconhecer card canônico OrgFy");
    assert.ok(parsed.objetivo.includes("Main-CI Watchdog"));
    assert.equal(parsed.estado.autoridade, "OrgFy Iris");
    assert.ok(parsed.estado.decisao.includes("DECIDIDO"));
    assert.equal(parsed.papeis.tipo, "seguranca");
    assert.equal(parsed.papeis.executor, "OrgFy Otto");
    assert.equal(parsed.papeis.revisor, "OrgFy Vera");
    assert.equal(parsed.papeis.decisor, "OrgFy Iris");
    assert.equal(parsed.papeis.effort, "4/10");
    assert.deepEqual(parsed.escopo.escritaExclusiva, ["ferramentas/esteira/porteiro.py", "testes/test_watchdog.py"]);
    assert.equal(parsed.escopo.passos.length, 2);
    assert.equal(parsed.escopo.passos[0].done, true);
    assert.equal(parsed.escopo.passos[1].done, false);
    assert.equal(parsed.aceite.comandoAceite, "python3 -m pytest -q testes/test_watchdog.py");
  });

  test("v17.5: botão atualizar ícone fixo sem shift, ? minimalista em painel lateral, Perfil nativo do Buzz, Roster 3D CodeDen, Oráculo, checklist interativo e Editor Visual de Automações", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    const css = orgfyMod.FACTORY_SHADOW_CSS;
    assert.ok(css.includes("@keyframes of-spin"), "CSS deve conter animação @keyframes of-spin");
    assert.ok(css.includes(".of-icon-circle-btn"), "CSS deve conter botão circular fixo .of-icon-circle-btn");
    assert.ok(bundle.includes("data-factory-refresh-icon"), "Botão de atualizar ícone fixo deve estar no bundle");
    assert.ok(bundle.includes("data-factory-guide-trigger"), "Botão ? minimalista deve estar no bundle");
    assert.ok(bundle.includes("data-guide-docked"), "Guia Como funciona deve abrir acoplado na lateral direita");
    assert.ok(bundle.includes("buzz.agents"), "Navegação para o Perfil nativo de agente no Buzz (pluginId: buzz.agents) deve estar no bundle");
    assert.ok(bundle.includes("data-codeden-floor-roster"), "Roster completo 1:1 CodeDen no Andar 3D deve estar no bundle");
    assert.ok(bundle.includes("data-run-scout-now"), "Botão Executar Oráculo agora deve estar no bundle");
    assert.ok(bundle.includes("data-interactive-checklist"), "Checklist P1..Pn interativo no Inspector deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-automation-editor"), "Editor Visual de Automações deve estar no bundle");

    const defaults = orgfyMod.buildDefaultAutomations("orgfy", "OrgFy Core");
    assert.ok(defaults.length >= 3, "deve inicializar automações padrão da OrgFy");
    const nextRuns = orgfyMod.computeNextAutomationRuns(defaults[0], 3, new Date("2026-11-26T10:00:00Z"));
    assert.equal(nextRuns.length, 3, "deve calcular exatamente as próximas 3 execuções");
    const yaml = orgfyMod.exportAutomationToBuzzWorkflowYaml(defaults[1], "orgfy");
    assert.ok(yaml.includes("cron:"), "YAML exportado deve incluir expressão cron");
    assert.ok(yaml.includes("OrgFy Oráculo"), "YAML exportado deve incluir agente alvo");
  });

  test("Onda 2 (v17.6): persistência real via host.runCommand orgfy-controle-write, Feed de Updates do COO, Chat Vivo (registerLink/Preview/CodeBlock) e Diff Review ancorado", async () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "manifest.json"), "utf8"));
    assert.ok(
      (manifest.host?.commands || []).some((c) => c.id === "orgfy-controle-write" && c.maxInputBytes >= 16384),
      "manifest.json deve declarar comando seguro orgfy-controle-write com maxInputBytes"
    );
    assert.ok(bundle.includes("data-coo-updates-feed"), "Feed de Updates do COO deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-live-link"), "Chat Vivo registerLink deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-link-preview"), "Chat Vivo registerLinkPreview deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-codeblock-card"), "Chat Vivo registerCodeBlock deve estar no bundle");
    assert.ok(bundle.includes("data-diff-review-bar"), "Barra de revisão ancorada no Diff deve estar no bundle");
    assert.ok(bundle.includes("data-diff-anchor-composer"), "Compositor de comentário por linha no Diff deve estar no bundle");

    // 1. writeTenantControl via host.runCommand (caminho real do Buzz Desktop sem host.writeFile)
    let capturedStdin = "";
    const buzzDesktopCtx = {
      host: {
        runCommand: async (id, input) => {
          assert.equal(id, "orgfy-controle-write");
          capturedStdin = String(input || "");
          const parsed = JSON.parse(capturedStdin);
          return JSON.stringify({ ok: true, path: "/tmp/controle-orgfy.json", control: parsed.control });
        },
      },
    };
    const resCmd = await orgfyMod.writeTenantControl(buzzDesktopCtx, "orgfy", {
      limits: { prsAbertos: 10 },
      mergePolicy: "strict",
    });
    assert.equal(resCmd.ok, true);
    assert.equal(resCmd.control.limits.prsAbertos, 10);
    assert.ok(capturedStdin.includes("\"prsAbertos\":10"));

    // 2. Chat Vivo parser para buzz://pr e buzz://issue
    const p1 = orgfyMod.parseBuzzOrgfyEntityUrl("buzz://pr?id=abcdef123456&owner=7fd58ab9&d=orgfy");
    assert.equal(p1?.kind, "pr");
    assert.equal(p1?.id, "abcdef123456");
    assert.equal(p1?.dtag, "orgfy");
    assert.equal(orgfyMod.parseBuzzOrgfyEntityUrl("https://example.com"), null);

    // 3. Feed de Updates do COO gera entradas para killSwitch + itens merged/failed
    const st = orgfyMod.buildEmptyFactoryStatus("orgfy");
    st.killSwitch = true;
    st.recent = [{ id: "12345678", title: "PR #11 fix", workKey: "pr:11", stage: "merged", step: "done", type: "bug", attempts: 1, sessionId: null, activeSessionId: null, reason: null, note: null, updatedAt: Date.now() }];
    const feed = orgfyMod.buildCooUpdatesFeed(st, "orgfy");
    assert.ok(feed.some((e) => e.kind === "paused"));
    assert.ok(feed.some((e) => e.kind === "merged" && e.title.includes("PR #11")));
  });

  test("Onda 3 (v17.7): Preview visual (ctx.browser.View), CRDT sync (ctx.artifactStorage.open) e Question Cards no Inbox", async () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    assert.ok(bundle.includes("data-orgfy-browser-preview"), "Aba Preview visual via ctx.browser.View deve estar no bundle");
    assert.ok(bundle.includes("data-visual-evidence-bar"), "Barra de evidência visual no Preview deve estar no bundle");
    assert.ok(bundle.includes("data-orgfy-question-cards"), "Painel de Question Cards estruturados no Inbox deve estar no bundle");
    assert.ok(bundle.includes("orgfy_question_card"), "agentTool orgfy_question_card deve estar no bundle");

    // 1. Mock fiel de ctx.artifactStorage.open() (ArtifactCollection oficial do Buzz)
    const entries = new Map();
    const listeners = new Set();
    let openedDef = null;
    const crdtCtx = {
      artifactStorage: {
        open(def) {
          openedDef = def;
          return {
            scope: { viewer: "pub-founder", relay: "wss://relay.cortexx.digital", partition: "default" },
            async get(id) {
              return entries.get(id);
            },
            async page({ index, value }) {
              const matched = [];
              for (const entry of entries.values()) {
                const projected = def.project(entry);
                if (projected.some((p) => p.index === index && p.value === value)) {
                  matched.push(entry);
                }
              }
              return { entries: matched };
            },
            subscribe(fn) {
              listeners.add(fn);
              return () => listeners.delete(fn);
            },
            preferences: {
              async get(id) {
                return entries.get(id)?.preference;
              },
              async update(id, change) {
                const cur = entries.get(id) || { record: { id, availability: { state: "available" } } };
                const nextPref = change(cur.preference);
                entries.set(id, { ...cur, preference: nextPref });
                for (const l of listeners) l();
              },
            },
            async importBatch(batch) {
              for (const r of batch.records || []) {
                entries.set(r.id, { record: { id: r.id, local: r.local, availability: { state: "available" } } });
              }
              for (const p of batch.preferences || []) {
                const cur = entries.get(p.id) || { record: { id: p.id, availability: { state: "available" } } };
                entries.set(p.id, { ...cur, preference: p.value });
              }
              for (const l of listeners) l();
            },
            async imported() {
              return false;
            },
            close() {},
          };
        },
      },
    };

    const store = orgfyMod.getOrgfyCrdtStore(crdtCtx);
    const info = store.getBackendInfo();
    assert.equal(info.mode, "buzz_artifact_collection", "deve usar ArtifactCollection oficial quando ctx.artifactStorage.open() existe");
    assert.equal(info.scope?.relay, "wss://relay.cortexx.digital");
    assert.equal(openedDef?.name, "orgfy_factory_state_v1");

    let notifyCount = 0;
    const unsub = store.subscribe(() => { notifyCount++; });

    const createdCard = await store.createQuestionCard({
      tenant: "orgfy",
      title: "Aprovar rollout do Gateway v2?",
      question: "Podemos ativar o novo roteador para 100% dos tenants?",
      requestedBy: "OrgFy Bento",
      selectionMode: "single",
      options: [
        { id: "sim", label: "Sim, ativar 100%" },
        { id: "canary", label: "Canary 20% primeiro" },
      ],
      timeoutMinutes: 60,
    });
    assert.equal(createdCard.status, "pending");
    assert.equal(createdCard.options.length, 2);
    assert.ok(notifyCount >= 1, "store.subscribe deve disparar ao criar Question Card");

    const listed = await store.listQuestionCards("orgfy");
    assert.ok(listed.some((c) => c.id === createdCard.id && c.status === "pending"));

    const answered = await store.answerQuestionCard(createdCard.id, {
      selectedIds: ["canary"],
      freeText: "Validar latência p95 por 2h antes de subir para 100%.",
      answeredBy: "Fundador",
    });
    assert.equal(answered?.status, "answered");
    assert.deepEqual(answered?.answer?.selectedIds, ["canary"]);

    // 2. Evidência visual sincronizada no mesmo CRDT store
    const ev = await store.recordVisualEvidence({
      tenant: "lumen-iptv",
      itemId: "pr-visual-01",
      url: "http://localhost:5173",
      note: "Player responsivo validado em 1440px",
      verdict: "approved",
    });
    assert.equal(ev.verdict, "approved");
    const evList = await store.listVisualEvidence("lumen-iptv", "pr-visual-01");
    assert.equal(evList.length, 1);

    unsub();

    // 3. agentTool orgfy_question_card registrada em h1 cria Question Card e auto-captura context.channel / client.pubkey
    const qTool = h1.tools.get("orgfy_question_card");
    assert.ok(qTool, "agentTool orgfy_question_card deve estar registrada");
    const realDmUuid = "11112222-3333-4444-5555-666677778888";
    const bentoPubkey = "a".repeat(64);
    const toolRes = JSON.parse(await qTool.call(
      { pubkey: bentoPubkey, name: "OrgFy Bento" },
      { channel: realDmUuid },
      {
        title: "Escolher estratégia de cache",
        question: "Qual TTL padrão usar no feed do COO?",
        channel_id: "Registered",
        tenant: "orgfy",
        options: [{ label: "5 minutos" }, { label: "15 minutos" }],
      }
    ));
    assert.equal(toolRes.ok, true);
    assert.equal(toolRes.card.requestedBy, "OrgFy Bento");
    assert.equal(toolRes.card.requestedByPubkey, bentoPubkey);
    assert.equal(toolRes.card.channelId, realDmUuid, "context.channel UUID deve prevalecer sobre channel_id inválido ('Registered')");
    assert.equal(toolRes.card.options.length, 2);

    // 4. Regressão: FactoryApp.tsx usa assinatura oficial AgentWake ({ channel, root?, topLevel?, text })
    const factoryAppSrc = fs.readFileSync(path.resolve(__dirname, "src", "factory", "FactoryApp.tsx"), "utf8");
    assert.ok(factoryAppSrc.includes("wakeAgentInBuzz"), "FactoryApp deve centralizar wakes em wakeAgentInBuzz");
    assert.ok(!factoryAppSrc.includes("threadRoot: card.threadRoot } : {}"), "não deve passar threadRoot em vez de root para ctx.agents.wake");
  });

  test("v17.8: Balões de chat ao vivo no Andar 3D (pensando/executando -> concluído com Abrir resposta)", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "plugin.js"), "utf8");
    assert.ok(bundle.includes("data-floor3d-speech-layer"), "Camada de balões de fala 3D deve estar no bundle");
    assert.ok(bundle.includes("data-floor3d-speech-bubble"), "Balões de fala individuais ancorados no 3D devem estar no bundle");
    assert.ok(bundle.includes("data-floor3d-open-response"), "Botão Abrir resposta no balão 3D deve estar no bundle");
    assert.ok(bundle.includes("Abrir resposta ↗"), "CTA Abrir resposta ↗ deve estar no bundle");
    assert.ok(bundle.includes("Resposta pronta no chat do Buzz"), "Estado concluído do balão 3D deve estar no bundle");
    const floorSrc = fs.readFileSync(path.resolve(__dirname, "src", "factory", "codeden-floor", "Floor3DCanvas.tsx"), "utf8");
    assert.ok(floorSrc.includes("onOpenTurnInSideChat"), "Floor3DCanvas deve aceitar onOpenTurnInSideChat para abrir a resposta exata");
    assert.ok(floorSrc.includes("positionBubblesRef.current(figures)"), "FloorStage onFrame deve posicionar balões diretamente via DOM sem re-render");
  });

  test("v17.9: Resposta do Question Card posta mensagem real Kind 9 no DM/thread via session.messages.send/reply", async () => {
    const sent = [];
    const replies = [];
    const wakes = [];
    const dmId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const chanId = "11111111-2222-4333-8444-555555555555";
    const rootId = "b".repeat(64);
    const bentoPubkey = "c".repeat(64);

    const chatCtx = {
      relay: {
        snapshot: () => ({
          status: "ready",
          session: {
            channels: {
              list: () => ({
                channels: [
                  { id: dmId, channelType: "dm", name: "OrgFy Bento", members: [bentoPubkey, "d".repeat(64)] },
                  { id: chanId, channelType: "stream", name: "OrgFy", members: [bentoPubkey, "d".repeat(64)] },
                ],
              }),
            },
            channelWrites: {
              refreshMembership: async (id) =>
                id === dmId
                  ? { id: dmId, channelType: "dm", members: [bentoPubkey, "d".repeat(64)] }
                  : { id: chanId, channelType: "stream", members: [bentoPubkey, "d".repeat(64)] },
            },
            messages: {
              send: (cid, content, mentions) => {
                sent.push({ cid, content, mentions });
                return "e".repeat(64);
              },
              reply: (cid, root, content, mentions) => {
                replies.push({ cid, root, content, mentions });
                return "f".repeat(64);
              },
            },
          },
        }),
      },
      agents: {
        wake: async (key, payload) => wakes.push({ key, payload }),
      },
    };

    // 1. DM: deve chamar session.messages.send(dmId, text, [bentoPubkey]) (mensagem visível no DM + menção ao agente)
    const dmRes = await orgfyMod.sendBuzzChatMessageOrWake(chatCtx, {
      agentKey: "local:orgfy-bento",
      agentName: "OrgFy Bento",
      pubkey: bentoPubkey,
      channelId: dmId,
      preferDm: true,
      postInChat: true,
      text: "@OrgFy Bento **Teste**\n- **Escolha:** Sim",
    });
    assert.equal(dmRes.ok, true);
    assert.equal(dmRes.mode, "chat_message");
    assert.equal(dmRes.eventId, "e".repeat(64));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].cid, dmId);
    assert.deepEqual(sent[0].mentions, [bentoPubkey]);
    assert.equal(wakes.length, 0, "quando session.messages.send funciona, não precisa de wake invisível duplicado");

    // 2. Thread de canal: deve chamar session.messages.reply(chanId, rootId, text, [bentoPubkey])
    const threadRes = await orgfyMod.sendBuzzChatMessageOrWake(chatCtx, {
      agentKey: "local:orgfy-bento",
      agentName: "OrgFy Bento",
      pubkey: bentoPubkey,
      channelId: chanId,
      threadRoot: rootId,
      postInChat: true,
      text: "@OrgFy Bento Resposta na thread",
    });
    assert.equal(threadRes.ok, true);
    assert.equal(threadRes.mode, "chat_message");
    assert.equal(threadRes.threadRoot, rootId);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].cid, chanId);
    assert.equal(replies[0].root, rootId);
    assert.deepEqual(replies[0].mentions, [bentoPubkey]);

    // 3. Fallback quando session.messages indisponível -> cai para ctx.agents.wake
    const wakeOnlyCtx = {
      relay: { snapshot: () => ({ status: "ready", session: { channels: { list: () => ({ channels: [{ id: dmId, channelType: "dm", members: [bentoPubkey] }] }) } } }) },
      agents: { wake: async (key, payload) => wakes.push({ key, payload }) },
    };
    const fbRes = await orgfyMod.sendBuzzChatMessageOrWake(wakeOnlyCtx, {
      agentKey: "local:orgfy-bento",
      agentName: "OrgFy Bento",
      pubkey: bentoPubkey,
      channelId: dmId,
      postInChat: true,
      text: "Fallback wake",
    });
    assert.equal(fbRes.ok, true);
    assert.equal(fbRes.mode, "wake_fallback");
    assert.equal(wakes.length, 1);
    assert.equal(wakes[0].payload.channel, dmId);
  });
}
