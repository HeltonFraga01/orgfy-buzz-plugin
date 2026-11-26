// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/routes/automations.tsx
// Editor Visual de Automações da OrgFy Factory: Agendamento, Eventos, Manual, Timezone, Próximas 3 Execuções,
// Placeholders no Prompt, Persistência em estado/automacoes-<tenant>.json, Execução Real via ctx.agents.wake e Exportação YAML Kind 30620.

export type AutomationTriggerKind = "schedule" | "event" | "manual";
export type AutomationScheduleFreq = "hourly" | "daily" | "weekly";
export type AutomationActionKind = "agent_session" | "message_pm" | "triage_issue";

export interface AutomationRunRecord {
  id: string;
  at: string;
  status: "ok" | "error";
  detail: string;
}

export interface OrgfyAutomation {
  id: string;
  name: string;
  description: string;
  scope: "project" | "all";
  enabled: boolean;
  triggerKind: AutomationTriggerKind;
  frequency: AutomationScheduleFreq;
  dayOfWeek: number; // 0 = Dom .. 6 = Sáb
  timeHHMM: string; // "04:00"
  timezone: string;
  eventKind: "pr_opened" | "ci_failed" | "issue_created" | "pr_merged";
  actionKind: AutomationActionKind;
  targetAgent: string;
  prompt: string;
  recentRuns: AutomationRunRecord[];
}

export const AUTOMATION_PLACEHOLDERS = [
  "{{project.name}}",
  "{{date}}",
  "{{tenant}}",
  "{{repo}}",
  "{{channel}}",
] as const;

const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function buildDefaultAutomations(tenant: string, companyName: string): OrgfyAutomation[] {
  return [
    {
      id: `rotina-ceo-${tenant}`,
      name: "Rotina Executiva CEO",
      description: `Revisão diária de FPY, gargalos de revisão L-01, orçamento e prioridades de ${companyName}.`,
      scope: "project",
      enabled: true,
      triggerKind: "schedule",
      frequency: "daily",
      dayOfWeek: 1,
      timeHHMM: "08:30",
      timezone: "America/Sao_Paulo",
      eventKind: "pr_merged",
      actionKind: "message_pm",
      targetAgent: "OrgFy Iris",
      prompt: `Execute a **Rotina Executiva** de {{project.name}} ({{date}}).\n\n1. Verifique FPY, PRs abertos e itens travados.\n2. Priorize bloqueios críticos e proponha no máximo 3 ações objetivas.`,
      recentRuns: [],
    },
    {
      id: `test-coverage-${tenant}`,
      name: "Cobertura de testes críticos",
      description: "Busca semanal por código crítico sem testes; abre PR focado nos maiores riscos e cria issues para o restante.",
      scope: "project",
      enabled: true,
      triggerKind: "schedule",
      frequency: "weekly",
      dayOfWeek: 4,
      timeHHMM: "04:00",
      timezone: "America/Sao_Paulo",
      eventKind: "pr_opened",
      actionKind: "agent_session",
      targetAgent: "OrgFy Oráculo",
      prompt: `Você está rodando a revisão agendada de **cobertura de testes** de {{project.name}} ({{date}}).\nFeche os gaps mais valiosos com testes determinísticos (L-22); não persiga porcentagem vazia.`,
      recentRuns: [],
    },
    {
      id: `doc-gardening-${tenant}`,
      name: "Doc-Gardening & Coleta de Lixo",
      description: "Detecta drift entre código, Canvas/Visão e AGENTS.md; abre micro-PRs de limpeza automática.",
      scope: "project",
      enabled: false,
      triggerKind: "schedule",
      frequency: "weekly",
      dayOfWeek: 0,
      timeHHMM: "03:00",
      timezone: "America/Sao_Paulo",
      eventKind: "pr_merged",
      actionKind: "agent_session",
      targetAgent: "OrgFy Lia",
      prompt: `Rode a coleta de lixo documental de {{project.name}} ({{date}}) no repo {{repo}}.\nIdentifique caminhos obsoletos, código morto ou regras em conflito e abra micro-PR limpo.`,
      recentRuns: [],
    },
  ];
}

export function computeNextAutomationRuns(auto: OrgfyAutomation, count = 3, now = new Date()): string[] {
  if (auto.triggerKind !== "schedule") return [];
  const [hhRaw, mmRaw] = String(auto.timeHHMM || "04:00").split(":");
  const hh = Math.max(0, Math.min(23, Number(hhRaw) || 0));
  const mm = Math.max(0, Math.min(59, Number(mmRaw) || 0));
  const out: string[] = [];
  const cursor = new Date(now.getTime());

  if (auto.frequency === "hourly") {
    cursor.setMinutes(mm, 0, 0);
    if (cursor <= now) cursor.setHours(cursor.getHours() + 1);
    for (let i = 0; i < count; i++) {
      const d = new Date(cursor.getTime() + i * 3600_000);
      out.push(`${WEEKDAYS_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }
    return out;
  }

  if (auto.frequency === "daily") {
    cursor.setHours(hh, mm, 0, 0);
    if (cursor <= now) cursor.setDate(cursor.getDate() + 1);
    for (let i = 0; i < count; i++) {
      const d = new Date(cursor.getTime() + i * 86_400_000);
      out.push(`${WEEKDAYS_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
    return out;
  }

  // weekly
  cursor.setHours(hh, mm, 0, 0);
  const diffDays = (auto.dayOfWeek - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + diffDays);
  if (cursor <= now) cursor.setDate(cursor.getDate() + 7);
  for (let i = 0; i < count; i++) {
    const d = new Date(cursor.getTime() + i * 7 * 86_400_000);
    out.push(`${WEEKDAYS_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

export function exportAutomationToBuzzWorkflowYaml(auto: OrgfyAutomation, tenant: string): string {
  const [hh, mm] = (auto.timeHHMM || "04:00").split(":");
  const cronExpr =
    auto.frequency === "hourly"
      ? `${Number(mm) || 0} * * * *`
      : auto.frequency === "daily"
      ? `${Number(mm) || 0} ${Number(hh) || 0} * * *`
      : `${Number(mm) || 0} ${Number(hh) || 0} * * ${auto.dayOfWeek}`;
  return [
    `# Buzz Workflow (Kind 30620) gerado pela OrgFy Factory`,
    `id: ${auto.id}`,
    `name: "${auto.name.replace(/"/g, '\\"')}"`,
    `enabled: ${auto.enabled}`,
    `tenant: ${tenant}`,
    `trigger:`,
    auto.triggerKind === "schedule"
      ? `  type: schedule\n  cron: "${cronExpr}"\n  timezone: "${auto.timezone || "America/Sao_Paulo"}"`
      : auto.triggerKind === "event"
      ? `  type: event\n  event: ${auto.eventKind}`
      : `  type: manual`,
    `action:`,
    `  kind: ${auto.actionKind}`,
    `  agent: "${auto.targetAgent}"`,
    `  prompt: |`,
    ...auto.prompt.split("\n").map((l) => `    ${l}`),
  ].join("\n");
}

export interface AutomationEditorProps {
  h: any;
  tenant: string;
  companyName: string;
  automations: OrgfyAutomation[];
  selectedId: string;
  onSelectId: (id: string) => void;
  onUpdateAutomation: (id: string, patch: Partial<OrgfyAutomation>) => void;
  onCreateAutomation: () => void;
  onDeleteAutomation: (id: string) => void;
  onSaveAutomations: () => void;
  onRunNow: (auto: OrgfyAutomation) => void;
  onExportYaml: (auto: OrgfyAutomation) => void;
  runningId: string | null;
  availableAgents: string[];
}

export function renderAutomationEditor(props: AutomationEditorProps) {
  const {
    h,
    tenant,
    automations,
    selectedId,
    onSelectId,
    onUpdateAutomation,
    onCreateAutomation,
    onDeleteAutomation,
    onSaveAutomations,
    onRunNow,
    onExportYaml,
    runningId,
    availableAgents,
  } = props;

  const active = automations.find((a) => a.id === selectedId) || automations[0] || null;
  const nextRuns = active ? computeNextAutomationRuns(active, 3) : [];

  return h(
    "div",
    {
      "data-orgfy-automation-editor": "true",
      style: { display: "grid", gridTemplateColumns: "230px minmax(0, 1fr) 250px", gap: "12px", alignItems: "start" },
    },

    // ── COLUNA 1: LISTA DE AUTOMAÇÕES ──
    h(
      "div",
      { className: "of-card-pad", style: { padding: "10px", display: "flex", flexDirection: "column", gap: "6px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "6px", borderBottom: "1px solid var(--border)" } },
        h("span", { className: "of-meter-label" }, `Automações (${automations.length})`),
        h(
          "button",
          { type: "button", className: "of-btn", style: { padding: "2px 7px", fontSize: "11px" }, onClick: onCreateAutomation },
          "+ Nova"
        )
      ),
      automations.map((a) =>
        h(
          "button",
          {
            key: a.id,
            type: "button",
            className: "of-nav-btn",
            "data-active": active?.id === a.id ? "true" : "false",
            style: { flexDirection: "column", alignItems: "flex-start", gap: "2px", padding: "7px 9px" },
            onClick: () => onSelectId(a.id),
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", width: "100%" } },
            h("span", { className: "of-dot", "data-tone": a.enabled ? "done" : "idle" }),
            h("span", { style: { fontWeight: 600, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, a.name)
          ),
          h(
            "span",
            { className: "of-muted", style: { fontSize: "10px" } },
            a.triggerKind === "schedule"
              ? `${a.frequency === "weekly" ? WEEKDAYS_SHORT[a.dayOfWeek] : a.frequency === "daily" ? "Diário" : "Por hora"} · ${a.timeHHMM}`
              : a.triggerKind === "event"
              ? `Evento: ${a.eventKind}`
              : "Manual"
          )
        )
      )
    ),

    // ── COLUNA 2: EDITOR PRINCIPAL (Print 5 1:1 CodeDen) ──
    active
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          // Básico
          h(
            "section",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("div", { className: "of-meter-label" }, "Básico"),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Nome",
              h("input", {
                className: "of-input",
                value: active.name,
                onChange: (e: any) => onUpdateAutomation(active.id, { name: e.target.value }),
              })
            ),
            h(
              "label",
              { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
              "Descrição",
              h("textarea", {
                className: "of-textarea",
                style: { minHeight: "54px" },
                value: active.description,
                onChange: (e: any) => onUpdateAutomation(active.id, { description: e.target.value }),
              })
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("span", { className: "of-muted", style: { fontSize: "11px" } }, "Escopo:"),
              h(
                "div",
                { className: "of-segmented" },
                h(
                  "button",
                  { type: "button", className: "of-seg-btn", "data-active": active.scope === "project" ? "true" : "false", onClick: () => onUpdateAutomation(active.id, { scope: "project" }) },
                  `Esta empresa (${tenant})`
                ),
                h(
                  "button",
                  { type: "button", className: "of-seg-btn", "data-active": active.scope === "all" ? "true" : "false", onClick: () => onUpdateAutomation(active.id, { scope: "all" }) },
                  "Todas as empresas"
                )
              )
            )
          ),

          // Quando executa
          h(
            "section",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("div", { className: "of-meter-label" }, "Quando executa"),
            h(
              "div",
              { className: "of-grid-3" },
              ([
                { id: "schedule", label: "Agendado", sub: "Por hora, diário ou semanal" },
                { id: "event", label: "Por evento", sub: "PR, issue ou falha de CI" },
                { id: "manual", label: "Apenas manual", sub: "Executar agora ou via COO" },
              ] as const).map((t) =>
                h(
                  "button",
                  {
                    key: t.id,
                    type: "button",
                    className: "of-surface",
                    style: {
                      padding: "9px 10px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--foreground)",
                      borderColor: active.triggerKind === t.id ? "var(--primary)" : undefined,
                      background: active.triggerKind === t.id ? "var(--primary-soft)" : undefined,
                    },
                    onClick: () => onUpdateAutomation(active.id, { triggerKind: t.id }),
                  },
                  h("div", { style: { fontSize: "12px", fontWeight: 600 } }, t.label),
                  h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "2px" } }, t.sub)
                )
              )
            ),
            active.triggerKind === "schedule" &&
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" } },
                  h(
                    "select",
                    {
                      className: "of-tenant-select",
                      value: active.frequency,
                      onChange: (e: any) => onUpdateAutomation(active.id, { frequency: e.target.value as AutomationScheduleFreq }),
                    },
                    h("option", { value: "hourly" }, "A cada hora"),
                    h("option", { value: "daily" }, "Diário"),
                    h("option", { value: "weekly" }, "Semanal")
                  ),
                  active.frequency === "weekly" &&
                    h(
                      "select",
                      {
                        className: "of-tenant-select",
                        value: String(active.dayOfWeek),
                        onChange: (e: any) => onUpdateAutomation(active.id, { dayOfWeek: Number(e.target.value) }),
                      },
                      WEEKDAYS_PT.map((d, idx) => h("option", { key: d, value: String(idx) }, d))
                    ),
                  h("input", {
                    type: "time",
                    className: "of-input",
                    style: { width: "110px" },
                    value: active.timeHHMM,
                    onChange: (e: any) => onUpdateAutomation(active.id, { timeHHMM: e.target.value }),
                  }),
                  h("input", {
                    className: "of-input",
                    style: { width: "165px" },
                    placeholder: "America/Sao_Paulo",
                    value: active.timezone,
                    onChange: (e: any) => onUpdateAutomation(active.id, { timezone: e.target.value }),
                  })
                ),
                nextRuns.length > 0 &&
                  h(
                    "div",
                    { className: "of-surface", style: { padding: "8px 10px", fontSize: "11px" } },
                    h("div", { style: { fontWeight: 600 } }, `Próximas 3 execuções (${active.timezone}):`),
                    h("div", { className: "of-mono of-muted", style: { marginTop: "3px" } }, nextRuns.join("  ·  "))
                  )
              ),
            active.triggerKind === "event" &&
              h(
                "select",
                {
                  className: "of-tenant-select",
                  value: active.eventKind,
                  onChange: (e: any) => onUpdateAutomation(active.id, { eventKind: e.target.value as any }),
                },
                h("option", { value: "pr_opened" }, "Quando um PR for aberto (NIP-34)"),
                h("option", { value: "ci_failed" }, "Quando o CI falhar"),
                h("option", { value: "issue_created" }, "Quando uma nova Issue entrar"),
                h("option", { value: "pr_merged" }, "Quando um PR for integrado na main")
              )
          ),

          // O que faz + Prompt + Placeholders
          h(
            "section",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("div", { className: "of-meter-label" }, "O que faz"),
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" } },
              h(
                "div",
                { className: "of-segmented" },
                ([
                  { id: "agent_session", label: "Sessão de agente" },
                  { id: "message_pm", label: "Mensagem para COO/CEO" },
                  { id: "triage_issue", label: "Triar issue" },
                ] as const).map((act) =>
                  h(
                    "button",
                    {
                      key: act.id,
                      type: "button",
                      className: "of-seg-btn",
                      "data-active": active.actionKind === act.id ? "true" : "false",
                      onClick: () => onUpdateAutomation(active.id, { actionKind: act.id }),
                    },
                    act.label
                  )
                )
              ),
              h(
                "select",
                {
                  className: "of-tenant-select",
                  value: active.targetAgent,
                  onChange: (e: any) => onUpdateAutomation(active.id, { targetAgent: e.target.value }),
                },
                (availableAgents.length > 0 ? availableAgents : [active.targetAgent]).map((name) =>
                  h("option", { key: name, value: name }, name)
                )
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" } },
              h("span", { style: { fontSize: "11.5px", fontWeight: 600 } }, "Prompt para o agente"),
              h(
                "div",
                { style: { display: "inline-flex", gap: "4px", flexWrap: "wrap" } },
                AUTOMATION_PLACEHOLDERS.map((ph) =>
                  h(
                    "button",
                    {
                      key: ph,
                      type: "button",
                      className: "of-btn",
                      "data-variant": "ghost",
                      style: { padding: "1px 6px", fontSize: "10px", fontFamily: "var(--font-mono)" },
                      onClick: () => onUpdateAutomation(active.id, { prompt: `${active.prompt}${active.prompt.endsWith(" ") ? "" : " "}${ph}` }),
                    },
                    ph
                  )
                )
              )
            ),
            h("textarea", {
              className: "of-textarea",
              style: { minHeight: "120px", fontFamily: "var(--font-mono)", fontSize: "11.5px" },
              value: active.prompt,
              onChange: (e: any) => onUpdateAutomation(active.id, { prompt: e.target.value }),
            })
          )
        )
      : h("div", { className: "of-card-pad of-muted" }, "Selecione ou crie uma automação."),

    // ── COLUNA 3: CONTROLE + EXECUÇÕES RECENTES ──
    active &&
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            h("strong", { style: { fontSize: "12.5px" } }, active.enabled ? "Ativa" : "Pausada"),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": active.enabled ? "primary" : undefined,
                style: { padding: "3px 10px", fontSize: "11px" },
                onClick: () => onUpdateAutomation(active.id, { enabled: !active.enabled }),
              },
              active.enabled ? "Ligada" : "Desligada"
            )
          ),
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "82px 1fr", gap: "4px 6px", fontSize: "11px" } },
            h("span", { className: "of-muted" }, "Próxima"),
            h("span", { className: "of-mono" }, nextRuns[0] || (active.triggerKind === "event" ? active.eventKind : "Manual")),
            h("span", { className: "of-muted" }, "Work key"),
            h("span", { className: "of-mono of-muted", style: { overflow: "hidden", textOverflow: "ellipsis" } }, `auto:${active.id}`)
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                "data-automation-run-now": "true",
                disabled: runningId === active.id,
                style: { justifyContent: "center" },
                onClick: () => onRunNow(active),
              },
              runningId === active.id ? "Disparando..." : "▶ Executar agora"
            ),
            h(
              "button",
              { type: "button", className: "of-btn", style: { justifyContent: "center" }, onClick: onSaveAutomations },
              "Salvar automações"
            ),
            h(
              "button",
              { type: "button", className: "of-btn", style: { justifyContent: "center", fontSize: "11px" }, onClick: () => onExportYaml(active) },
              "Copiar YAML Kind 30620"
            ),
            automations.length > 1 &&
              h(
                "button",
                { type: "button", className: "of-btn", "data-variant": "danger", style: { justifyContent: "center", fontSize: "11px" }, onClick: () => onDeleteAutomation(active.id) },
                "Remover"
              )
          )
        ),
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
          h("div", { className: "of-meter-label" }, "Execuções recentes"),
          active.recentRuns.length === 0
            ? h("div", { className: "of-muted", style: { fontSize: "11.5px" } }, "Nenhuma execução registrada ainda. Clique em Executar agora para disparar via Buzz.")
            : active.recentRuns.slice(0, 6).map((r) =>
                h(
                  "div",
                  { key: r.id, className: "of-surface", style: { padding: "6px 8px", fontSize: "11px" } },
                  h(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { className: "of-pill", "data-tone": r.status === "ok" ? "done" : "failed", style: { fontSize: "9.5px", padding: "0 5px" } }, r.status === "ok" ? "OK" : "ERRO"),
                    h("span", { className: "of-mono of-muted", style: { fontSize: "9.5px" } }, r.at)
                  ),
                  h("div", { className: "of-muted", style: { marginTop: "3px" } }, r.detail)
                )
              )
        )
      )
  );
}
