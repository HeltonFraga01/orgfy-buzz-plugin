import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  return { tools, panels, hooks, notifications, wakes, artifacts, getMcp: () => mcpHandler };
}

// 1. Testes Originais (Kanban & Status Positivo/Negativo + MCP)
const h1 = makeHarness(false);
assert.equal(h1.tools.size, 9, "devem existir exatamente 9 agentTools registradas");
assert.ok(h1.panels.has("orgfy-channel-pulse"), "sidebar panel orgfy-channel-pulse deve ser registrado");
assert.ok(h1.hooks.length >= 1, "hooks de governança devem ser registrados");

const kanban = JSON.parse(await h1.tools.get("orgfy_kanban_read").call({}, {}, { empresa: "orgfy" }));
assert.equal(kanban.ok, true);
assert.ok(kanban.total > 10);
assert.ok(kanban.cards.some((c) => c.stage === "triagem"));
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

// 4. Onda 3: orgfy_governanca_avaliar (Dry-run + Execução Real + Cooldown Anti-Spam)
const govTool = h1.tools.get("orgfy_governanca_avaliar");
const govDry = JSON.parse(await govTool.call({}, {}, { dry_run: true, auto_wake: true }));
assert.equal(govDry.ok, true);
assert.ok(govDry.alertsDetected >= 1);
assert.equal(h1.notifications.length, 0, "dry_run não pode disparar notificações");

const govReal1 = JSON.parse(await govTool.call({}, {}, { dry_run: false, auto_wake: true }));
assert.equal(govReal1.ok, true);
assert.ok(
  govReal1.notificationsSent.length + govReal1.wakesTriggered.length >= 1,
  "execução real deve disparar notificações ou wakes para alertas ativos"
);

const govReal2 = JSON.parse(await govTool.call({}, {}, { dry_run: false, auto_wake: true }));
assert.equal(govReal2.ok, true);
assert.equal(govReal2.notificationsSent.length, 0, "segunda execução imediata deve ser bloqueada por cooldown anti-spam");
assert.ok(govReal2.skippedByCooldown.length >= 1);
console.log("[ONDA 3 GOVERNANCA & COOLDOWN OK]", JSON.stringify({
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
console.log("[ONDA 3 LINT CARD OK]", JSON.stringify({ bad_issues: lintBad.issues.length, good_score: lintGood.score }));
