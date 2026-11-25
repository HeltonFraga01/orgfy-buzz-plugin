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
assert.equal(h1.tools.size, 17, "devem existir exatamente 17 agentTools registradas");
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
assert.equal(failoverRes.ok, true, "failover deve eleger o melhor modelo free online");
assert.equal(failoverRes.selectedModel, "qwen/qwen3-coder:free", "deve pular o 503 e escolher o mais inteligente online");
assert.equal(failoverRes.retriggered, true);
assert.equal(savedChanges.length, 1);
assert.equal(savedChanges[0].change.config.model, "qwen/qwen3-coder:free");
assert.equal(failoverWakes.length, 1);
assert.equal(failoverWakes[0].payload.root, "25c49b323d299d3a81ca260197cecd5b6208668d84bb8788971ba347fb15b193");
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
  assert.ok(s1.wakes[0].payload.text.includes("@Lumen Lara"));

  // Caso B (Nível 2): Próprio COO (OrgFy Bento) entra em loop na Lumen IPTV -> escala para CEO da empresa (Lumen Lara), ainda preservando a Iris
  const s2 = await runEscalationScenario("41315b4e-6d9a-42e9-9521-f8ce1f9dbc15", "OrgFy Bento", "20261124_esc_n2");
  assert.equal(s2.res.ok, true);
  assert.equal(s2.wakes.length, 1, "deve disparar 1 wake para a CEO da subsidiária");
  assert.equal(s2.wakes[0].agentKey, "local:lumen-lara", "se o COO travar na Lumen IPTV, deve escalar para Lumen Lara (CEO da empresa), não direto para Iris");
  assert.ok(s2.wakes[0].payload.text.includes("@Lumen Lara"));
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
  assert.ok(hydrated.executorModel && hydrated.executorModel.length > 0, "deve ler modelo real de OrgFy Lia em agents/state/");
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

  const nativeEvents = { relay: 0, completions: 0, actions: 0, sidebars: [], shortcuts: 0, attentionSources: 0, hooks: [], agentTabs: [] };
  const nativeCtx = {
    react: { createElement: () => null },
    relay: {
      snapshot: () => ({ status: "ready", generation: 1 }),
      subscribe: () => { nativeEvents.relay++; return () => {}; },
    },
    conversation: {
      registerCompletion: () => { nativeEvents.completions++; },
      registerMessageAction: () => { nativeEvents.actions++; },
    },
    reflect: {
      get: (name) => name === "sidebarSections" ? { register: (sec) => { nativeEvents.sidebars.push(sec); } } : undefined,
    },
    shortcuts: { register: () => { nativeEvents.shortcuts++; } },
    agents: {
      addAttentionSource: () => { nativeEvents.attentionSources++; },
      registerHook: (hk) => { nativeEvents.hooks.push(hk); },
      registerTab: (tab) => { nativeEvents.agentTabs.push(tab); },
    },
  };

  const nativeState = orgfyMod.registerBuzzNativeIntegrations(nativeCtx);
  assert.equal(nativeState.relayConnected, true);
  assert.equal(nativeState.conversationRegistered, true);
  assert.equal(nativeState.sidebarRegistered, true);
  assert.equal(nativeEvents.sidebars.length, 1);
  const sidebarSec = nativeEvents.sidebars[0];
  assert.strictEqual(sidebarSec.rows.snapshot(), sidebarSec.rows.snapshot(), "sidebar snapshot() deve retornar referência estável para useSyncExternalStore");
  assert.equal(sidebarSec.select(sidebarSec.rows.snapshot()[0]).pluginId, "digital.cortexx.orgfy", "sidebar select() deve usar pluginId digital.cortexx.orgfy");
  assert.equal(nativeState.shortcutsRegistered, true);
  assert.equal(nativeState.attentionSourceRegistered, true);
  assert.equal(nativeState.otelHookRegistered, true);
  assert.equal(nativeState.agentTabRegistered, true, "aba OrgFy deve ser registrada nos perfis dos agentes via ctx.agents.registerTab");
  assert.equal(nativeEvents.agentTabs.length, 1);
  assert.equal(nativeEvents.agentTabs[0].title, "OrgFy");
  assert.equal(orgfyMod.getBuzzNativeState().agentTabRegistered, true);

  const failHook = nativeEvents.hooks.find((hk) => hk.event === "turn.failed");
  assert.ok(failHook, "hook OTel turn.failed deve estar registrado");
  failHook.run({ model: "gemini-3.8-flash-medium", error: "HTTP 429" }, { agent: "OrgFy Val", session: "s1" });
  failHook.run({ model: "gemini-3.8-flash-medium", error: "HTTP 429" }, { agent: "OrgFy Val", session: "s1" });

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
  assert.ok(autoStops.some((s) => s.action === "new"), "deve renovar a sessão ('new') após trocar o modelo antes do wake");
  assert.equal(autoSaves.length, 1, "deve salvar novo modelo automaticamente via ctx.agents.save");
  assert.equal(autoSaves[0].change.config.model, "gemini-2.5-flash-thinking", "deve pular claude-opus (blocked), mistral-large (503 no probe) e gemini-3.1-flash-lite (atual)");
  assert.ok(probedModels.includes("mistralai/mistral-large-4-1t-a52b"), "deve testar ao vivo mistral-large antes de trocar");
  assert.ok(probedModels.includes("gemini-2.5-flash-thinking"), "deve validar gemini-2.5-flash-thinking ao vivo");
  assert.equal(autoWakes.length, 1, "deve re-disparar o agente automaticamente na thread original");
  assert.equal(autoWakes[0].payload.root, "4406f509983396ed055d9739185f30bface744d032df4d1452035e6e4c00c7cd");

  // Segundo failover consecutivo: NÃO pode fazer ping-pong voltando para mistral-large ou gemini-3.1-flash-lite (ambos em quarentena)
  const failoverAuto = autoTools.get("orgfy_model_failover");
  const secondRes = JSON.parse(await failoverAuto.call({}, {}, {
    agente: "OrgFy Bento",
    apply: true,
    retrigger: false,
  }));
  assert.equal(secondRes.ok, true);
  assert.equal(secondRes.selectedModel, "gemini-3-flash", "quarentena deve impedir ping-pong para modelos que falharam recentemente");
  console.log("[AUTO-FAILOVER WATCHDOG + LIVE PROBE + ANTI-PINGPONG OK]", JSON.stringify({
    first: autoSaves[0].change.config.model,
    second: secondRes.selectedModel,
    probed: probedModels,
  }));
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
  assert.equal(cronSaves.length, 1, "deve trocar modelo imediatamente no 1º erro fatal (last_msg_is_provider_error=true)");
  assert.equal(cronSaves[0].change.config.model, "claude-sonnet-5-5");
  assert.equal(cronWakes.length, 1, "deve re-disparar OrgFy Cron automaticamente");

  const r2 = JSON.parse(await govCron.call({}, {}, { dry_run: false, auto_wake: true }));
  assert.equal(cronSaves.length, 1, "mesmo timestamp de erro não deve disparar failover duplicado");
  assert.ok(r2.skippedByCooldown.some((s) => s.includes("auto_failover_already_healed:OrgFy Cron")));
  console.log("[AUTO-FAILOVER 1ST CRASH 404 + DEDUP OK]", JSON.stringify({ switchedTo: cronSaves[0].change.config.model }));
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

  const turnFailedHook = hooks.find((hk) => hk.id === "orgfy-turn-failed-model-failover");
  assert.ok(turnFailedHook, "hook orgfy-turn-failed-model-failover deve estar registrado");
  await turnFailedHook.run({
    agentName: "OrgFy Bento Arquiteto",
    agentPubkey: "6d2ab612cc8e091e5c4381694728ce3f8873661156adeeda1522737af334b271",
    model: "auto/claude-sonnet",
    error: "Request failed: Bad request (400): No target in combo auto/claude-sonnet supports tool calling; request carried 50 tools",
    channelId: "e445491d-2fb3-4ebd-8e2e-f6813c33fb03",
    threadRoot: "39a75068da62278de10a7b638f65ed91ca0e35eb508aed4477c0511e4354b3ba",
  });

  assert.equal(saves.length, 1, "hook turn.failed deve salvar novo modelo saudável via ctx.agents.save");
  assert.equal(saves[0].change.config.model, "gemini-3.8-flash-medium", "deve ignorar tab_jump_flash_lite_preview e auto/claude-sonnet");
  assert.ok(probePayloads.length >= 1 && Array.isArray(probePayloads[0].tools) && probePayloads[0].tools.length === 1, "probe ao vivo deve enviar tools para validar tool-calling");
  assert.ok(sessions.some((s) => s.action === "new" && s.place.root === "39a75068da62278de10a7b638f65ed91ca0e35eb508aed4477c0511e4354b3ba"), "deve renovar a sessão ('new') antes do wake");
  assert.equal(wakes.length, 1, "deve re-disparar o agente na thread original");
  console.log("[AUTO-FAILOVER V2 TOOL-CALLING + SESSION RESET OK]", JSON.stringify({ selected: saves[0].change.config.model, sessionResets: sessions.length }));
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
