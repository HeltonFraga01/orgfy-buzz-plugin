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
assert.equal(h1.tools.size, 13, "devem existir exatamente 13 agentTools registradas");
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
