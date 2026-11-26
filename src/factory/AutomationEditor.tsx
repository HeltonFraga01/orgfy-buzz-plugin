// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/automations/* e routes/automations.tsx
// Sistema completo de Automações & Workflows 1:1 CodeDen para a OrgFy Factory:
// 3 abas (Automações | Execuções | Templates), Catálogo de 7 Templates + Starter Set,
// Editor em 2 colunas (Básico, Quando executa [Cron/Eventos/Manual], O que faz [Prompt com gutter numerado + Inserir placeholder],
// Permissões [Read-only/Supervised/Auto/Full], Opções Avançadas [Guards], ScheduleCard lateral [Run now, Skip next, Pause, Duplicate, Export .md/YAML, Import .md]).

export type AutomationTriggerKind = "schedule" | "event" | "manual";
export type AutomationScheduleFreq =
  | "minutes"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "custom";
export type AutomationActionKind = "agent_session" | "message_pm" | "triage_issue";
export type AutomationAutonomy = "read_only" | "supervised" | "auto" | "full";
export type AutomationOverlapPolicy = "skip-if-running" | "queue" | "run-anyway";

export type AutomationEventKind =
  | "pr_opened"
  | "pr_review_requested"
  | "pr_merged"
  | "pr_checks_failed"
  | "ci_failed"
  | "issue_created"
  | "issue_labeled"
  | "issue_commented"
  | "session_finished"
  | "session_failed"
  | "session_needs_input";

export interface AutomationRunRecord {
  id: string;
  at: string;
  status: "ok" | "error" | "skipped" | "running";
  reason?: string;
  durationMs?: number;
  detail: string;
  automationId?: string;
  automationName?: string;
}

export interface AutomationGuards {
  overlapPolicy: AutomationOverlapPolicy;
  maxConcurrent: number;
  maxPerDay: number | null;
  quietHours: { start: string; end: string } | null;
  catchUpMissed: boolean;
}

export interface OrgfyAutomation {
  id: string;
  name: string;
  description: string;
  scope: "project" | "all";
  enabled: boolean;
  paused?: boolean;
  skipNextAt?: string | null;
  source?: "orgfy" | "template" | "file" | "pm";
  templateId?: string;
  workKey?: string;
  sessionTitle?: string;
  triggerKind: AutomationTriggerKind;
  frequency: AutomationScheduleFreq;
  intervalValue?: number;
  dayOfWeek: number; // 0 = Dom .. 6 = Sáb
  dayOfMonth?: number; // 1..28
  timeHHMM: string; // "04:00"
  customCron?: string;
  timezone: string;
  eventKind: AutomationEventKind;
  eventFilter?: { labels?: string[]; branches?: string[]; authors?: string[] };
  actionKind: AutomationActionKind;
  targetAgent: string;
  autonomy?: AutomationAutonomy;
  guards?: AutomationGuards;
  prompt: string;
  recentRuns: AutomationRunRecord[];
}

export interface AutomationTemplateDef {
  id: string;
  name: string;
  description: string;
  starter: boolean;
  triggerKind: AutomationTriggerKind;
  frequency: AutomationScheduleFreq;
  dayOfWeek: number;
  dayOfMonth?: number;
  timeHHMM: string;
  eventKind: AutomationEventKind;
  actionKind: AutomationActionKind;
  defaultAgent: string;
  autonomy: AutomationAutonomy;
  overlapPolicy: AutomationOverlapPolicy;
  prompt: string;
}

export const AUTOMATION_PLACEHOLDERS = [
  "{{project.name}}",
  "{{date}}",
  "{{time}}",
  "{{tenant}}",
  "{{repo}}",
  "{{channel}}",
] as const;

export const EVENT_PLACEHOLDERS: Record<string, string[]> = {
  pr: ["{{pr.number}}", "{{pr.title}}", "{{pr.branch}}", "{{pr.base}}", "{{pr.failedChecks}}"],
  issue: ["{{issue.number}}", "{{issue.title}}", "{{issue.author}}", "{{issue.labels}}"],
  session: ["{{session.id}}", "{{session.workKey}}", "{{session.outcome}}"],
};

const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const EVENT_LABELS_PT: Record<AutomationEventKind, string> = {
  pr_opened: "Quando um PR é aberto (NIP-34)",
  pr_review_requested: "Quando revisão L-01 é solicitada em um PR",
  pr_merged: "Quando um PR é integrado na main",
  pr_checks_failed: "Quando os checks de um PR falham",
  ci_failed: "Quando o CI da esteira falha",
  issue_created: "Quando uma nova Issue é aberta",
  issue_labeled: "Quando uma label é adicionada a uma Issue",
  issue_commented: "Quando alguém comenta em uma Issue",
  session_finished: "Quando uma sessão de agente termina",
  session_failed: "Quando uma sessão de agente falha",
  session_needs_input: "Quando uma sessão aguarda decisão",
};

export const ACTION_LABELS_PT: Record<AutomationActionKind, string> = {
  agent_session: "Iniciar sessão de agente",
  message_pm: "Mensagem para COO / CEO",
  triage_issue: "Triar issue",
};

export const OVERLAP_LABELS_PT: Record<AutomationOverlapPolicy, string> = {
  "skip-if-running": "Pular se rodando",
  queue: "Enfileirar",
  "run-anyway": "Rodar mesmo assim",
};

export const DEFAULT_GUARDS: AutomationGuards = {
  overlapPolicy: "skip-if-running",
  maxConcurrent: 1,
  maxPerDay: null,
  quietHours: null,
  catchUpMissed: false,
};

export const ORGFY_AUTOMATION_TEMPLATES: AutomationTemplateDef[] = [
  {
    id: "security-audit",
    name: "Auditoria de segurança",
    description: "Revisa código, configurações e dependências em busca de vulnerabilidades, segredos vazados e padrões inseguros; corrige pequenos problemas em 1 PR e abre issues para achados confirmados.",
    starter: true,
    triggerKind: "schedule",
    frequency: "weekly",
    dayOfWeek: 1,
    timeHHMM: "03:00",
    eventKind: "pr_opened",
    actionKind: "agent_session",
    defaultAgent: "OrgFy Vera",
    autonomy: "read_only",
    overlapPolicy: "skip-if-running",
    prompt: `Você está executando a **auditoria semanal de segurança** de {{project.name}} ({{date}}).\n\n## 1. Inspecionar\n- Verifique segredos expostos, permissões amplas, comandos shell não sanitizados e dependências críticas em {{repo}}.\n\n## 2. Entregar\n- Corrija falhas triviais em um único PR enxuto com teste L-22.\n- Para achados maiores, abra 1 issue canônica por vulnerabilidade confirmada.`,
  },
  {
    id: "dependency-updates",
    name: "Atualização de dependências",
    description: "Aplica atualizações patch e minor que passam nos testes em um único PR; upgrades major e quebras viram issues priorizadas.",
    starter: true,
    triggerKind: "schedule",
    frequency: "weekly",
    dayOfWeek: 2,
    timeHHMM: "05:00",
    eventKind: "pr_opened",
    actionKind: "agent_session",
    defaultAgent: "OrgFy Otto",
    autonomy: "auto",
    overlapPolicy: "skip-if-running",
    prompt: `Você está rodando a **atualização semanal de dependências** de {{project.name}} ({{date}}).\n\n## 1. Atualizar\n- Aplique apenas bumps patch/minor seguros e rode a suíte completa de testes.\n- Se tudo ficar verde, abra 1 PR objetivo; se houver breaking change major, abra issue descrevendo o impacto.`,
  },
  {
    id: "ui-review",
    name: "Revisão de UI & Acessibilidade",
    description: "Percorre a aplicação em desktop e telas estreitas, verifica layout, acessibilidade e erros de console, abre issues com evidência e corrige defeitos pequenos.",
    starter: false,
    triggerKind: "schedule",
    frequency: "weekly",
    dayOfWeek: 3,
    timeHHMM: "06:00",
    eventKind: "pr_opened",
    actionKind: "agent_session",
    defaultAgent: "OrgFy Oráculo",
    autonomy: "auto",
    overlapPolicy: "skip-if-running",
    prompt: `Execute a **revisão semanal de UI** de {{project.name}} ({{date}}).\n\n## 1. Auditar\n- Cheque overflow, alinhamento, contraste, foco de teclado e erros de console.\n- Corrija micro-defeitos seguros ou abra issue detalhada com passos de reprodução.`,
  },
  {
    id: "test-coverage",
    name: "Cobertura de testes críticos",
    description: "Busca semanal por código crítico sem testes; adiciona testes focados para os maiores riscos em 1 PR e abre issues para o restante.",
    starter: true,
    triggerKind: "schedule",
    frequency: "weekly",
    dayOfWeek: 4,
    timeHHMM: "04:00",
    eventKind: "pr_opened",
    actionKind: "agent_session",
    defaultAgent: "OrgFy Oráculo",
    autonomy: "auto",
    overlapPolicy: "skip-if-running",
    prompt: `Você está rodando a revisão agendada de **cobertura de testes** de {{project.name}} ({{date}}). Feche os gaps mais valiosos com testes determinísticos (L-22); não persiga porcentagem vazia.\n\n## 1. Medir\n- Leia AGENTS.md e identifique caminhos críticos com menor proteção de testes.\n\n## 2. Cobrir\n- Adicione testes de alta confiança em um único PR focado e registre o restante como issues.`,
  },
  {
    id: "refactor-sweep",
    name: "Varredura de refatoração",
    description: "Uma limpeza pequena preservando 100% do comportamento em um ponto quente do código, entregue como PR cirúrgico.",
    starter: false,
    triggerKind: "schedule",
    frequency: "monthly",
    dayOfWeek: 1,
    dayOfMonth: 1,
    timeHHMM: "04:00",
    eventKind: "pr_merged",
    actionKind: "agent_session",
    defaultAgent: "OrgFy Lia",
    autonomy: "auto",
    overlapPolicy: "skip-if-running",
    prompt: `Execute uma **varredura cirúrgica de refatoração** em {{project.name}} ({{date}}).\n- Escolha apenas 1 arquivo com alta complexidade ou código morto.\n- Preserve 100% do comportamento (testes existentes verdes) e abra um PR pequeno.`,
  },
  {
    id: "stale-pr-followup",
    name: "Follow-up de PRs parados",
    description: "Encontra PRs ociosos há 5+ dias; faz rebase e corrige PRs da própria esteira, aciona o COO/revisor nos demais — nunca faz merge direto.",
    starter: true,
    triggerKind: "schedule",
    frequency: "weekdays",
    dayOfWeek: 1,
    timeHHMM: "08:00",
    eventKind: "pr_opened",
    actionKind: "message_pm",
    defaultAgent: "OrgFy Bento",
    autonomy: "supervised",
    overlapPolicy: "skip-if-running",
    prompt: `Faça o **follow-up diário de PRs parados** de {{project.name}} ({{date}}).\n- Liste PRs abertos há mais de 48h ou em quarentena.\n- Separe PRs de smoke/teste (candidatos a fechamento) de entregas reais pendentes de revisão L-01.`,
  },
  {
    id: "issue-triage",
    name: "Triagem de issues (COO)",
    description: "Quando uma nova issue entra no relay NIP-34, o COO classifica tipo, risco, duplicidade e decide despacho ou escalada.",
    starter: true,
    triggerKind: "event",
    frequency: "daily",
    dayOfWeek: 1,
    timeHHMM: "09:00",
    eventKind: "issue_created",
    actionKind: "triage_issue",
    defaultAgent: "OrgFy Bento",
    autonomy: "supervised",
    overlapPolicy: "queue",
    prompt: `Faça a triagem da issue {{issue.number}} — **{{issue.title}}** em {{project.name}}.\n- Valide L-01 (executor ≠ revisor), L-22 (comando de aceite) e Escrita Exclusiva.\n- Se faltar critério objetivo, solicite clarificação; se estiver pronta, prepare despacho.`,
  },
];

export function buildDefaultAutomations(tenant: string, companyName: string): OrgfyAutomation[] {
  return [
    {
      id: `rotina-ceo-${tenant}`,
      name: "Rotina Executiva CEO",
      description: `Revisão diária de FPY, gargalos de revisão L-01, orçamento e prioridades de ${companyName}.`,
      scope: "project",
      enabled: true,
      source: "orgfy",
      workKey: `automation:rotina-ceo-${tenant}`,
      triggerKind: "schedule",
      frequency: "daily",
      dayOfWeek: 1,
      timeHHMM: "08:30",
      timezone: "America/Sao_Paulo",
      eventKind: "pr_merged",
      actionKind: "message_pm",
      targetAgent: "OrgFy Iris",
      autonomy: "supervised",
      guards: { ...DEFAULT_GUARDS },
      prompt: `Execute a **Rotina Executiva** de {{project.name}} ({{date}}).\n\n1. Verifique FPY, PRs abertos e itens travados.\n2. Priorize bloqueios críticos e proponha no máximo 3 ações objetivas.`,
      recentRuns: [],
    },
    {
      id: `test-coverage-${tenant}`,
      name: "Cobertura de testes críticos",
      description: "Busca semanal por código crítico sem testes; abre PR focado nos maiores riscos e cria issues para o restante.",
      scope: "project",
      enabled: true,
      source: "template",
      templateId: "test-coverage",
      workKey: "automation:test-coverage",
      triggerKind: "schedule",
      frequency: "weekly",
      dayOfWeek: 4,
      timeHHMM: "04:00",
      timezone: "America/Sao_Paulo",
      eventKind: "pr_opened",
      actionKind: "agent_session",
      targetAgent: "OrgFy Oráculo",
      autonomy: "auto",
      guards: { ...DEFAULT_GUARDS },
      prompt: `Você está rodando a revisão agendada de **cobertura de testes** de {{project.name}} ({{date}}).\nFeche os gaps mais valiosos com testes determinísticos (L-22); não persiga porcentagem vazia.`,
      recentRuns: [],
    },
    {
      id: `doc-gardening-${tenant}`,
      name: "Doc-Gardening & Coleta de Lixo",
      description: "Detecta drift entre código, Canvas/Visão e AGENTS.md; abre micro-PRs de limpeza automática.",
      scope: "project",
      enabled: false,
      source: "orgfy",
      workKey: `automation:doc-gardening-${tenant}`,
      triggerKind: "schedule",
      frequency: "weekly",
      dayOfWeek: 0,
      timeHHMM: "03:00",
      timezone: "America/Sao_Paulo",
      eventKind: "pr_merged",
      actionKind: "agent_session",
      targetAgent: "OrgFy Lia",
      autonomy: "auto",
      guards: { ...DEFAULT_GUARDS },
      prompt: `Rode a coleta de lixo documental de {{project.name}} ({{date}}) no repo {{repo}}.\nIdentifique caminhos obsoletos, código morto ou regras em conflito e abra micro-PR limpo.`,
      recentRuns: [],
    },
  ];
}

/**
 * Automation-from-Session (Onda 2 · 5/5): converte qualquer sessão/turno de agente
 * em uma Automação recorrente pronta para salvar e exportar como Workflow Kind 30620.
 */
export function buildAutomationFromSession(input: {
  tenant: string;
  companyName?: string;
  agentName: string;
  sessionTitle?: string;
  stepLabel?: string;
  promptHint?: string;
}): Partial<OrgfyAutomation> {
  const safeAgent = String(input.agentName || "OrgFy Bento").trim();
  const baseTitle = String(input.sessionTitle || input.stepLabel || `Rotina ${safeAgent}`).trim();
  const slug = baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "sessao";
  const promptBody = input.promptHint?.trim()
    ? input.promptHint.trim()
    : [
        `Repita a rotina validada na sessão **${baseTitle}** de {{project.name}} ({{date}}).`,
        ``,
        `## 1. Contexto`,
        `- Empresa: {{tenant}} ({{repo}})`,
        `- Agente responsável: ${safeAgent}`,
        input.stepLabel ? `- Última etapa observada: ${input.stepLabel}` : "",
        ``,
        `## 2. Critério de entrega`,
        `- Execute em worktree isolada seguindo L-01 e L-22; se tudo ficar verde, abra PR enxuto ou reporte status objetivo no canal {{channel}}.`,
      ]
        .filter(Boolean)
        .join("\n");

  return {
    id: `from-session-${slug}-${Date.now().toString(36).slice(-4)}`,
    name: `Rotina: ${baseTitle}`,
    description: `Criada em 1 clique a partir de uma sessão de ${safeAgent} em ${input.companyName || input.tenant}.`,
    scope: "project",
    enabled: true,
    source: "pm",
    workKey: `automation:session:${slug}`,
    sessionTitle: baseTitle,
    triggerKind: "schedule",
    frequency: "weekdays",
    dayOfWeek: 1,
    timeHHMM: "09:00",
    timezone: "America/Sao_Paulo",
    eventKind: "session_finished",
    actionKind: "agent_session",
    targetAgent: safeAgent,
    autonomy: "supervised",
    guards: { ...DEFAULT_GUARDS },
    prompt: promptBody,
    recentRuns: [],
  };
}

export function describeAutomationTrigger(auto: OrgfyAutomation): string {
  if (auto.triggerKind === "manual") return "Apenas manual";
  if (auto.triggerKind === "event") return EVENT_LABELS_PT[auto.eventKind] || `Evento: ${auto.eventKind}`;
  const t = auto.timeHHMM || "04:00";
  switch (auto.frequency) {
    case "minutes":
      return `A cada ${auto.intervalValue || 15} min`;
    case "hourly":
      return `A cada ${auto.intervalValue && auto.intervalValue > 1 ? `${auto.intervalValue} horas` : "hora"}`;
    case "daily":
      return `Todo dia às ${t}`;
    case "weekdays":
      return `Dias úteis às ${t}`;
    case "monthly":
      return `Todo dia ${auto.dayOfMonth || 1} às ${t}`;
    case "custom":
      return `Cron: ${auto.customCron || "0 9 * * 1-5"}`;
    case "weekly":
    default:
      return `Toda ${WEEKDAYS_PT[auto.dayOfWeek] || "Quinta"} às ${t}`;
  }
}

export function computeNextRunDates(auto: OrgfyAutomation, count = 3, now = new Date()): Date[] {
  if (auto.triggerKind !== "schedule") return [];
  const [hhRaw, mmRaw] = String(auto.timeHHMM || "04:00").split(":");
  const hh = Math.max(0, Math.min(23, Number(hhRaw) || 0));
  const mm = Math.max(0, Math.min(59, Number(mmRaw) || 0));
  const out: Date[] = [];
  const cursor = new Date(now.getTime());

  if (auto.frequency === "minutes") {
    const step = Math.max(5, Math.min(59, Number(auto.intervalValue) || 15));
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + step);
    for (let i = 0; i < count; i++) out.push(new Date(cursor.getTime() + i * step * 60_000));
    return out;
  }

  if (auto.frequency === "hourly") {
    const step = Math.max(1, Math.min(12, Number(auto.intervalValue) || 1));
    cursor.setMinutes(mm, 0, 0);
    if (cursor <= now) cursor.setHours(cursor.getHours() + step);
    for (let i = 0; i < count; i++) out.push(new Date(cursor.getTime() + i * step * 3600_000));
    return out;
  }

  if (auto.frequency === "daily" || auto.frequency === "custom") {
    cursor.setHours(hh, mm, 0, 0);
    if (cursor <= now) cursor.setDate(cursor.getDate() + 1);
    for (let i = 0; i < count; i++) out.push(new Date(cursor.getTime() + i * 86_400_000));
    return out;
  }

  if (auto.frequency === "weekdays") {
    cursor.setHours(hh, mm, 0, 0);
    if (cursor <= now) cursor.setDate(cursor.getDate() + 1);
    while (out.length < count) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) out.push(new Date(cursor.getTime()));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  if (auto.frequency === "monthly") {
    const dom = Math.max(1, Math.min(28, Number(auto.dayOfMonth) || 1));
    cursor.setDate(dom);
    cursor.setHours(hh, mm, 0, 0);
    if (cursor <= now) cursor.setMonth(cursor.getMonth() + 1);
    for (let i = 0; i < count; i++) {
      const d = new Date(cursor.getTime());
      d.setMonth(d.getMonth() + i);
      out.push(d);
    }
    return out;
  }

  // weekly
  cursor.setHours(hh, mm, 0, 0);
  const diffDays = (auto.dayOfWeek - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + diffDays);
  if (cursor <= now) cursor.setDate(cursor.getDate() + 7);
  for (let i = 0; i < count; i++) out.push(new Date(cursor.getTime() + i * 7 * 86_400_000));
  return out;
}

export function computeNextAutomationRuns(auto: OrgfyAutomation, count = 3, now = new Date()): string[] {
  return computeNextRunDates(auto, count, now).map(
    (d) =>
      `${WEEKDAYS_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  );
}

export function formatRelativeUntil(target: Date | null | undefined, now = new Date()): string {
  if (!target) return "Não agendada";
  const diffMin = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  if (diffMin < 1) return "em <1 min";
  if (diffMin < 60) return `em ${diffMin} min`;
  const hrs = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (hrs < 24) return remMin > 0 ? `em ${hrs}h ${remMin}min` : `em ${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `em ${days}d ${remHrs}h` : `em ${days}d`;
}

export function buildCronExpression(auto: OrgfyAutomation): string {
  if (auto.frequency === "custom" && auto.customCron?.trim()) return auto.customCron.trim();
  const [hh, mm] = (auto.timeHHMM || "04:00").split(":");
  const m = Number(mm) || 0;
  const h = Number(hh) || 0;
  if (auto.frequency === "minutes") return `*/${Math.max(5, Number(auto.intervalValue) || 15)} * * * *`;
  if (auto.frequency === "hourly") return `${m} */${Math.max(1, Number(auto.intervalValue) || 1)} * * *`;
  if (auto.frequency === "daily") return `${m} ${h} * * *`;
  if (auto.frequency === "weekdays") return `${m} ${h} * * 1-5`;
  if (auto.frequency === "monthly") return `${m} ${h} ${auto.dayOfMonth || 1} * *`;
  return `${m} ${h} * * ${auto.dayOfWeek}`;
}

export function exportAutomationToBuzzWorkflowYaml(auto: OrgfyAutomation, tenant: string): string {
  const cronExpr = buildCronExpression(auto);
  return [
    `# Buzz Workflow (Kind 30620) gerado pela OrgFy Factory`,
    `id: ${auto.id}`,
    `name: "${auto.name.replace(/"/g, '\\"')}"`,
    `enabled: ${auto.enabled}`,
    `tenant: ${tenant}`,
    `workKey: "${auto.workKey || `automation:${auto.id}`}"`,
    `autonomy: ${auto.autonomy || "auto"}`,
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

export function exportAutomationToMarkdown(auto: OrgfyAutomation): string {
  const g = auto.guards || DEFAULT_GUARDS;
  const lines = [
    "---",
    `name: ${auto.name}`,
    auto.description ? `description: ${auto.description}` : "",
    "trigger:",
    auto.triggerKind === "schedule"
      ? `  type: cron\n  expression: "${buildCronExpression(auto)}"\n  timezone: ${auto.timezone || "America/Sao_Paulo"}`
      : auto.triggerKind === "event"
      ? `  type: event\n  event: ${auto.eventKind}`
      : "  type: manual",
    `action: ${auto.actionKind === "agent_session" ? "start_session" : auto.actionKind === "message_pm" ? "message_pm" : "triage"}`,
    `agent: ${auto.targetAgent}`,
    `workKey: "${auto.workKey || `automation:${auto.id}`}"`,
    `autonomy: ${auto.autonomy || "auto"}`,
    "guards:",
    `  overlapPolicy: ${g.overlapPolicy}`,
    `  maxConcurrent: ${g.maxConcurrent}`,
    g.maxPerDay ? `  maxPerDay: ${g.maxPerDay}` : "",
    g.quietHours ? `  quietHours:\n    start: "${g.quietHours.start}"\n    end: "${g.quietHours.end}"` : "",
    `  catchUpMissed: ${Boolean(g.catchUpMissed)}`,
    "---",
    auto.prompt,
  ].filter(Boolean);
  return lines.join("\n") + "\n";
}

export function parseAutomationFromMarkdown(
  rawMd: string,
  tenant: string,
  defaultAgent = "OrgFy Bento"
): { ok: true; automation: OrgfyAutomation; warning?: string } | { ok: false; error: string } {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(String(rawMd || "").trim());
  if (!m) return { ok: false, error: "Formato inválido: esperado frontmatter YAML entre linhas ---." };
  const fm = m[1];
  const body = m[2].trim();
  if (!body) return { ok: false, error: "O corpo do Markdown (prompt para o agente) está vazio." };
  const pick = (key: string) => {
    const rx = new RegExp(`^\\s*${key}:\\s*(.+)$`, "m");
    const hit = rx.exec(fm);
    return hit ? hit[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  const name = pick("name") || "Automação importada";
  const description = pick("description") || "Importada via Markdown (.md)";
  const trigType = pick("type");
  const actionRaw = pick("action");
  const autonomyRaw = pick("autonomy") as AutomationAutonomy;
  const autonomy: AutomationAutonomy = ["read_only", "supervised", "auto", "full"].includes(autonomyRaw)
    ? autonomyRaw
    : "auto";
  const actionKind: AutomationActionKind =
    actionRaw === "message_pm" ? "message_pm" : actionRaw === "triage" ? "triage_issue" : "agent_session";

  const auto: OrgfyAutomation = {
    id: `imp-${Date.now().toString(36)}`,
    name,
    description,
    scope: "project",
    enabled: false, // Regra de segurança CodeDen: toda automação importada inicia desligada
    source: "file",
    workKey: pick("workKey") || `automation:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    triggerKind: trigType === "event" ? "event" : trigType === "manual" ? "manual" : "schedule",
    frequency: pick("expression") ? "custom" : "weekly",
    customCron: pick("expression") || undefined,
    dayOfWeek: 1,
    timeHHMM: "09:00",
    timezone: pick("timezone") || "America/Sao_Paulo",
    eventKind: (pick("event") as AutomationEventKind) || "pr_opened",
    actionKind,
    targetAgent: pick("agent") || defaultAgent,
    autonomy,
    guards: { ...DEFAULT_GUARDS },
    prompt: body,
    recentRuns: [],
  };
  return {
    ok: true,
    automation: auto,
    warning: autonomy === "full" ? "Atenção: esta automação pede permissão Full (sem pedir confirmação). Revise o prompt antes de ativar." : undefined,
  };
}

// ── INLINE LUCIDE SVGS (1:1 CodeDen) ──
function AutoIcon({ h, name, size = 14, color }: { h: any; name: string; size?: number; color?: string }) {
  const p = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0, display: "block" },
    "aria-hidden": "true",
  };
  switch (name) {
    case "schedule":
      return h("svg", p, h("rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }), h("path", { d: "M16 2v4M8 2v4M3 10h18" }), h("circle", { cx: 16, cy: 16, r: 3 }), h("path", { d: "M16 14.8V16l.8.8" }));
    case "event":
      return h("svg", p, h("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }));
    case "manual":
      return h("svg", p, h("path", { d: "M18 11V6a2 2 0 0 0-4 0v4" }), h("path", { d: "M14 10V4a2 2 0 0 0-4 0v6" }), h("path", { d: "M10 10.5V6a2 2 0 0 0-4 0v8" }), h("path", { d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" }));
    case "play":
      return h("svg", p, h("polygon", { points: "6 3 20 12 6 21 6 3" }));
    case "pause":
      return h("svg", p, h("rect", { x: 6, y: 4, width: 4, height: 16 }), h("rect", { x: 14, y: 4, width: 4, height: 16 }));
    case "skip":
      return h("svg", p, h("polygon", { points: "5 4 15 12 5 20 5 4" }), h("line", { x1: 19, y1: 5, x2: 19, y2: 19 }));
    case "copy":
      return h("svg", p, h("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }), h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }));
    case "trash":
      return h("svg", p, h("path", { d: "M3 6h18" }), h("path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }), h("path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }));
    case "share":
      return h("svg", p, h("circle", { cx: 18, cy: 5, r: 3 }), h("circle", { cx: 6, cy: 12, r: 3 }), h("circle", { cx: 18, cy: 19, r: 3 }), h("line", { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }), h("line", { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 }));
    case "folder":
      return h("svg", p, h("path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }));
    case "globe":
      return h("svg", p, h("circle", { cx: 12, cy: 12, r: 10 }), h("line", { x1: 2, y1: 12, x2: 22, y2: 12 }), h("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" }));
    case "bot":
      return h("svg", p, h("path", { d: "M12 8V4H8" }), h("rect", { width: 16, height: 12, x: 4, y: 8, rx: 2 }), h("path", { d: "M2 14h2M20 14h2M15 13v2M9 13v2" }));
    case "message":
      return h("svg", p, h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }));
    case "filter":
      return h("svg", p, h("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" }));
    case "braces":
      return h("svg", p, h("path", { d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" }), h("path", { d: "M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" }));
    case "clock":
      return h("svg", p, h("circle", { cx: 12, cy: 12, r: 10 }), h("polyline", { points: "12 6 12 12 16 14" }));
    case "sparkles":
      return h("svg", p, h("path", { d: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" }));
    case "back":
      return h("svg", p, h("path", { d: "m15 18-6-6 6-6" }));
    case "shield":
      return h("svg", p, h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" }));
    default:
      return null;
  }
}

export interface AutomationEditorProps {
  h: any;
  tenant: string;
  companyName: string;
  automations: OrgfyAutomation[];
  selectedId: string;
  onSelectId: (id: string) => void;
  onUpdateAutomation: (id: string, patch: Partial<OrgfyAutomation>) => void;
  onCreateAutomation: (initial?: Partial<OrgfyAutomation>) => void;
  onDuplicateAutomation?: (auto: OrgfyAutomation) => void;
  onDeleteAutomation: (id: string) => void;
  onSaveAutomations: () => void;
  onRunNow: (auto: OrgfyAutomation) => void;
  onExportYaml: (auto: OrgfyAutomation) => void;
  onExportMarkdown?: (auto: OrgfyAutomation) => void;
  onImportAutomation?: (auto: OrgfyAutomation) => void;
  onAddStarterSet?: () => void;
  runningId: string | null;
  availableAgents: string[];
  activeSubTab?: "automations" | "runs" | "templates";
  onChangeSubTab?: (t: "automations" | "runs" | "templates") => void;
  editingView?: "list" | "detail";
  onChangeEditingView?: (v: "list" | "detail") => void;
}

function ToggleSwitch({ h, checked, onChange, label }: { h: any; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return h(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      "aria-label": label,
      onClick: (e: any) => {
        e.stopPropagation();
        onChange(!checked);
      },
      style: {
        width: "34px",
        height: "19px",
        borderRadius: "999px",
        border: "none",
        padding: "2px",
        cursor: "pointer",
        background: checked ? "#f59e0b" : "rgba(255,255,255,0.16)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: checked ? "flex-end" : "flex-start",
        transition: "background 0.15s ease",
        flexShrink: 0,
      },
    },
    h("span", {
      style: {
        width: "15px",
        height: "15px",
        borderRadius: "999px",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      },
    })
  );
}

export function renderAutomationEditor(props: AutomationEditorProps) {
  const {
    h,
    tenant,
    companyName,
    automations,
    selectedId,
    onSelectId,
    onUpdateAutomation,
    onCreateAutomation,
    onDuplicateAutomation,
    onDeleteAutomation,
    onSaveAutomations,
    onRunNow,
    onExportYaml,
    onExportMarkdown,
    onImportAutomation,
    onAddStarterSet,
    runningId,
    availableAgents,
    activeSubTab = "automations",
    onChangeSubTab,
    editingView = "detail",
    onChangeEditingView,
  } = props;

  const active = automations.find((a) => a.id === selectedId) || automations[0] || null;
  const nextDates = active ? computeNextRunDates(active, 3) : [];
  const nextRuns = active ? computeNextAutomationRuns(active, 3) : [];
  const allRuns: AutomationRunRecord[] = automations
    .flatMap((a) => (a.recentRuns || []).map((r) => ({ ...r, automationId: a.id, automationName: a.name })))
    .slice(0, 40);

  const openEditorFor = (id: string) => {
    onSelectId(id);
    onChangeSubTab?.("automations");
    onChangeEditingView?.("detail");
  };

  const addFromTemplate = (tpl: AutomationTemplateDef, enable: boolean) => {
    const newId = `${tpl.id}-${tenant}-${Date.now().toString(36).slice(-4)}`;
    onCreateAutomation({
      id: newId,
      name: tpl.name,
      description: tpl.description,
      scope: "project",
      enabled: enable,
      source: "template",
      templateId: tpl.id,
      workKey: `automation:${tpl.id}`,
      triggerKind: tpl.triggerKind,
      frequency: tpl.frequency,
      dayOfWeek: tpl.dayOfWeek,
      dayOfMonth: tpl.dayOfMonth,
      timeHHMM: tpl.timeHHMM,
      timezone: "America/Sao_Paulo",
      eventKind: tpl.eventKind,
      actionKind: tpl.actionKind,
      targetAgent: availableAgents.includes(tpl.defaultAgent) ? tpl.defaultAgent : availableAgents[0] || tpl.defaultAgent,
      autonomy: tpl.autonomy,
      guards: { ...DEFAULT_GUARDS, overlapPolicy: tpl.overlapPolicy },
      prompt: tpl.prompt,
      recentRuns: [],
    });
    if (!enable) {
      onChangeSubTab?.("automations");
      onChangeEditingView?.("detail");
    }
  };

  // ── ABA TEMPLATES (1:1 CodeDen templates-gallery.tsx) ──
  if (activeSubTab === "templates") {
    const existingTplIds = new Set(automations.map((a) => a.templateId).filter(Boolean));
    return h(
      "div",
      { "data-orgfy-automation-templates": "true", style: { display: "flex", flexDirection: "column", gap: "14px" } },
      // Banner Starter Set
      h(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(245, 158, 11, 0.32)",
            background: "rgba(245, 158, 11, 0.06)",
          },
        },
        AutoIcon({ h, name: "sparkles", size: 18, color: "#f59e0b" }),
        h(
          "div",
          { style: { flex: 1, minWidth: "220px" } },
          h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "Conjunto inicial (Starter set)"),
          h("div", { className: "of-muted", style: { fontSize: "11.5px", marginTop: "2px" } }, "Os 5 templates marcados como Starter adaptados para a OrgFy, ativados juntos. Você pode pausar cada um depois.")
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            "data-variant": "primary",
            onClick: () => {
              if (onAddStarterSet) onAddStarterSet();
              else ORGFY_AUTOMATION_TEMPLATES.filter((t) => t.starter && !existingTplIds.has(t.id)).forEach((t) => addFromTemplate(t, true));
            },
          },
          "Ativar conjunto inicial"
        )
      ),
      // Grid de 7 templates
      h(
        "div",
        { className: "of-grid-3" },
        ORGFY_AUTOMATION_TEMPLATES.map((tpl) => {
          const added = existingTplIds.has(tpl.id);
          const triggerSummary = describeAutomationTrigger({
            ...buildDefaultAutomations(tenant, companyName)[0],
            triggerKind: tpl.triggerKind,
            frequency: tpl.frequency,
            dayOfWeek: tpl.dayOfWeek,
            dayOfMonth: tpl.dayOfMonth,
            timeHHMM: tpl.timeHHMM,
            eventKind: tpl.eventKind,
          });
          return h(
            "div",
            {
              key: tpl.id,
              className: "of-card-pad",
              "data-automation-template-card": tpl.id,
              style: { display: "flex", flexDirection: "column", gap: "10px", padding: "14px" },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "flex-start", gap: "10px" } },
              h(
                "span",
                {
                  style: {
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted-foreground)",
                    flexShrink: 0,
                  },
                },
                AutoIcon({ h, name: tpl.triggerKind, size: 15 })
              ),
              h(
                "div",
                { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: "13px", fontWeight: 600 } }, tpl.name),
                h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "1px" } }, triggerSummary)
              ),
              tpl.starter &&
                h(
                  "span",
                  {
                    style: {
                      borderRadius: "999px",
                      background: "rgba(245, 158, 11, 0.14)",
                      color: "#fbbf24",
                      padding: "2px 7px",
                      fontSize: "10px",
                      fontWeight: 600,
                      flexShrink: 0,
                    },
                  },
                  "Starter"
                )
            ),
            h("div", { className: "of-muted", style: { fontSize: "11.5px", lineHeight: 1.5, flex: 1 } }, tpl.description),
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "5px", fontSize: "10.5px" } },
              h("span", { className: "of-pill" }, ACTION_LABELS_PT[tpl.actionKind]),
              h("span", { className: "of-pill" }, OVERLAP_LABELS_PT[tpl.overlapPolicy]),
              h("span", { className: "of-pill" }, tpl.defaultAgent)
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)" } },
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "primary",
                  style: { fontSize: "11px", padding: "4px 10px" },
                  onClick: () => addFromTemplate(tpl, false),
                },
                "Usar template"
              ),
              added
                ? h("span", { style: { fontSize: "11px", color: "var(--status-done)" } }, "✓ Nesta empresa")
                : h(
                    "button",
                    {
                      type: "button",
                      className: "of-btn",
                      "data-variant": "ghost",
                      style: { fontSize: "11px", padding: "4px 8px" },
                      onClick: () => addFromTemplate(tpl, true),
                    },
                    "+ Adicionar e ativar"
                  )
            )
          );
        })
      )
    );
  }

  // ── ABA EXECUÇÕES / RUNS (1:1 CodeDen runs-table.tsx) ──
  if (activeSubTab === "runs") {
    return h(
      "div",
      { className: "of-card-pad", "data-orgfy-automation-runs": "true", style: { display: "flex", flexDirection: "column", gap: "10px" } },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("strong", { style: { fontSize: "13.5px" } }, `Histórico de Execuções · ${companyName}`),
        h("span", { className: "of-muted", style: { fontSize: "11px" } }, `${allRuns.length} execução(ões) registrada(s)`)
      ),
      allRuns.length === 0
        ? h(
            "div",
            { style: { padding: "36px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" } },
            AutoIcon({ h, name: "clock", size: 24, color: "var(--muted-foreground)" }),
            h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "Nenhuma execução ainda"),
            h("div", { className: "of-muted", style: { fontSize: "11.5px", maxWidth: "360px" } }, "Execuções aparecem aqui quando um agendamento, evento ou clique em Executar agora dispara uma automação.")
          )
        : h(
            "table",
            { className: "of-table" },
            h("thead", null, h("tr", null, h("th", null, "Automação"), h("th", null, "Status"), h("th", null, "Horário"), h("th", null, "Detalhe / Motivo"))),
            h(
              "tbody",
              null,
              allRuns.map((r) =>
                h(
                  "tr",
                  { key: r.id },
                  h(
                    "td",
                    { style: { fontWeight: 600 } },
                    h(
                      "button",
                      {
                        type: "button",
                        style: { background: "none", border: "none", color: "var(--foreground)", cursor: "pointer", padding: 0, fontWeight: 600 },
                        onClick: () => r.automationId && openEditorFor(r.automationId),
                      },
                      r.automationName || r.automationId || "—"
                    )
                  ),
                  h(
                    "td",
                    null,
                    h(
                      "span",
                      { className: "of-pill", "data-tone": r.status === "ok" ? "done" : r.status === "error" ? "failed" : "waiting" },
                      r.status === "ok" ? "Concluída" : r.status === "error" ? "Falhou" : r.status === "skipped" ? "Pulada" : "Rodando"
                    )
                  ),
                  h("td", { className: "of-mono of-muted" }, r.at),
                  h("td", { className: "of-muted" }, r.reason ? `${r.reason} · ${r.detail}` : r.detail)
                )
              )
            )
          )
    );
  }

  // ── ABA AUTOMAÇÕES — MODO LISTA (1:1 CodeDen automations-panel.tsx) ──
  if (editingView === "list" || !active) {
    return h(
      "div",
      { "data-orgfy-automation-list": "true", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
        h("span", { className: "of-muted", style: { fontSize: "12px" } }, `${automations.filter((a) => a.enabled).length} de ${automations.length} ativas em ${companyName}`),
        h(
          "div",
          { style: { display: "inline-flex", gap: "6px", flexWrap: "wrap" } },
          onImportAutomation &&
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                onClick: () => {
                  const md = window.prompt("Cole o Markdown (.md) com frontmatter YAML da automação:");
                  if (!md) return;
                  const parsed = parseAutomationFromMarkdown(md, tenant, availableAgents[0] || "OrgFy Bento");
                  if (!parsed.ok) {
                    window.alert(`Erro ao importar: ${parsed.error}`);
                    return;
                  }
                  if (parsed.warning) window.alert(parsed.warning);
                  onImportAutomation(parsed.automation);
                },
              },
              "Importar .md"
            ),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "primary",
              onClick: () => {
                onCreateAutomation();
                onChangeEditingView?.("detail");
              },
            },
            "+ Nova automação"
          )
        )
      ),
      h(
        "div",
        { className: "of-card-pad", style: { padding: 0, overflow: "hidden" } },
        automations.map((a, idx) => {
          const dates = computeNextRunDates(a, 1);
          const last = a.recentRuns?.[0];
          return h(
            "div",
            {
              key: a.id,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 14px",
                borderTop: idx > 0 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              },
              onClick: () => openEditorFor(a.id),
            },
            ToggleSwitch({ h, checked: a.enabled, label: `Ativar ${a.name}`, onChange: (v) => onUpdateAutomation(a.id, { enabled: v }) }),
            h(
              "span",
              { style: { color: a.enabled ? "#f59e0b" : "var(--muted-foreground)" } },
              AutoIcon({ h, name: a.triggerKind, size: 15 })
            ),
            h(
              "div",
              { style: { flex: 1, minWidth: 0 } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h("strong", { style: { fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, a.name),
                a.paused && h("span", { className: "of-pill", "data-tone": "waiting" }, "Pausada"),
                h("span", { className: "of-muted", style: { fontSize: "11px" } }, a.targetAgent)
              ),
              h(
                "div",
                { className: "of-muted", style: { fontSize: "11px", marginTop: "2px" } },
                `${describeAutomationTrigger(a)} · ${ACTION_LABELS_PT[a.actionKind]}${a.triggerKind === "schedule" && a.enabled && !a.paused && dates[0] ? ` · próxima ${formatRelativeUntil(dates[0])}` : ""}`
              )
            ),
            last &&
              h(
                "span",
                { className: "of-pill", "data-tone": last.status === "ok" ? "done" : "failed", style: { fontSize: "10px" } },
                `Última: ${last.at}`
              ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { padding: "4px 10px", fontSize: "11px" },
                disabled: runningId === a.id,
                onClick: (e: any) => {
                  e.stopPropagation();
                  onRunNow(a);
                },
              },
              runningId === a.id ? "Rodando..." : "▶ Rodar"
            )
          );
        })
      )
    );
  }

  // ── ABA AUTOMAÇÕES — EDITOR 1:1 CODEDEN (2 COLUNAS EXATAMENTE IGUAL AO PRINT) ──
  const guards = active.guards || DEFAULT_GUARDS;
  const autonomy: AutomationAutonomy = active.autonomy || "auto";
  const promptLines = Math.max(6, active.prompt.split("\n").length);
  const eventGroup = active.eventKind.startsWith("pr_") || active.eventKind === "ci_failed"
    ? "pr"
    : active.eventKind.startsWith("issue_")
    ? "issue"
    : active.eventKind.startsWith("session_")
    ? "session"
    : null;
  const contextualPlaceholders = [
    ...AUTOMATION_PLACEHOLDERS,
    ...(active.triggerKind === "event" && eventGroup ? EVENT_PLACEHOLDERS[eventGroup] : []),
  ];

  const insertPlaceholder = (ph: string) => {
    onUpdateAutomation(active.id, {
      prompt: `${active.prompt}${active.prompt.endsWith(" ") || active.prompt.endsWith("\n") ? "" : " "}${ph}`,
    });
  };

  return h(
    "div",
    {
      "data-orgfy-automation-editor": "true",
      "data-codeden-automation-v2": "true",
      style: { display: "flex", flexDirection: "column", gap: "14px" },
    },

    // ── BARRA SUPERIOR 1:1 CODEDEN (< projeto / Nome | Duplicar · Lixeira · Exportar · Salvar) ──
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--border)",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 } },
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            "data-variant": "ghost",
            style: { padding: "4px 6px" },
            title: "Voltar para lista de automações",
            onClick: () => onChangeEditingView?.("list"),
          },
          AutoIcon({ h, name: "back", size: 15 })
        ),
        h("span", { className: "of-muted", style: { fontSize: "12.5px" } }, `${tenant} /`),
        h("strong", { style: { fontSize: "13.5px" } }, active.name),
        h(
          "span",
          { className: "of-muted", style: { fontSize: "11.5px", marginLeft: "4px" } },
          `${describeAutomationTrigger(active)} · ${ACTION_LABELS_PT[active.actionKind]}`
        )
      ),
      h(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            style: { fontSize: "11.5px", padding: "5px 10px" },
            onClick: () => {
              if (onDuplicateAutomation) onDuplicateAutomation(active);
              else
                onCreateAutomation({
                  ...active,
                  id: `${active.id}-copy-${Date.now().toString(36).slice(-3)}`,
                  name: `${active.name} (cópia)`,
                  enabled: false,
                  recentRuns: [],
                });
            },
          },
          AutoIcon({ h, name: "copy", size: 13 }),
          "Duplicar"
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            style: { fontSize: "11.5px", padding: "5px 10px" },
            title: "Copiar Markdown (.md) compatível com CodeDen",
            onClick: () => (onExportMarkdown ? onExportMarkdown(active) : onExportYaml(active)),
          },
          AutoIcon({ h, name: "share", size: 13 }),
          "Exportar .md"
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            style: { fontSize: "11.5px", padding: "5px 10px" },
            title: "Copiar YAML Workflow Kind 30620 do Buzz",
            onClick: () => onExportYaml(active),
          },
          "YAML 30620"
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            "data-variant": "primary",
            style: { fontSize: "11.5px", padding: "5px 12px" },
            onClick: onSaveAutomations,
          },
          "Salvar"
        )
      )
    ),

    // ── GRID 2 COLUNAS 1:1 CODEDEN (Esquerda: Form | Direita: ScheduleCard + Recent Runs) ──
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 292px", gap: "16px", alignItems: "start" } },

      // ── COLUNA ESQUERDA ──
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } },

        // 1. BÁSICO
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "11px" } },
          h("div", { style: { fontSize: "13px", fontWeight: 600, paddingBottom: "8px", borderBottom: "1px solid var(--border)" } }, "Básico"),
          h(
            "label",
            { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", fontWeight: 500 } },
            "Nome",
            h("input", {
              className: "of-input",
              value: active.name,
              placeholder: "Verificação semanal de dependências",
              onChange: (e: any) => onUpdateAutomation(active.id, { name: e.target.value }),
            })
          ),
          h(
            "label",
            { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "11.5px", fontWeight: 500 } },
            "Descrição",
            h("textarea", {
              className: "of-textarea",
              style: { minHeight: "56px" },
              value: active.description,
              placeholder: "Uma linha de resumo para a lista (opcional)",
              onChange: (e: any) => onUpdateAutomation(active.id, { description: e.target.value }),
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "5px" } },
            h("span", { style: { fontSize: "11.5px", fontWeight: 500 } }, "Executa em"),
            h(
              "div",
              { className: "of-segmented", style: { width: "fit-content" } },
              h(
                "button",
                {
                  type: "button",
                  className: "of-seg-btn",
                  "data-active": active.scope === "project" ? "true" : "false",
                  style: { display: "inline-flex", alignItems: "center", gap: "6px" },
                  onClick: () => onUpdateAutomation(active.id, { scope: "project" }),
                },
                AutoIcon({ h, name: "folder", size: 13 }),
                `Esta empresa (${tenant})`
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "of-seg-btn",
                  "data-active": active.scope === "all" ? "true" : "false",
                  style: { display: "inline-flex", alignItems: "center", gap: "6px" },
                  onClick: () => onUpdateAutomation(active.id, { scope: "all" }),
                },
                AutoIcon({ h, name: "globe", size: 13 }),
                "Todas as empresas"
              )
            )
          )
        ),

        // 2. QUANDO EXECUTA
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h("div", { style: { fontSize: "13px", fontWeight: 600, paddingBottom: "8px", borderBottom: "1px solid var(--border)" } }, "Quando executa"),
          h(
            "div",
            { className: "of-grid-3" },
            ([
              { id: "schedule", label: "Agendado", sub: "A cada poucos min, diário, semanal..." },
              { id: "event", label: "Quando algo acontece", sub: "Um PR, uma issue ou uma sessão" },
              { id: "manual", label: "Apenas quando eu rodar", sub: "Executar agora, ou pelo COO" },
            ] as const).map((t) => {
              const sel = active.triggerKind === t.id;
              return h(
                "button",
                {
                  key: t.id,
                  type: "button",
                  className: "of-surface",
                  style: {
                    padding: "10px 11px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "var(--foreground)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "9px",
                    borderColor: sel ? "rgba(245, 158, 11, 0.75)" : undefined,
                    background: sel ? "rgba(245, 158, 11, 0.08)" : undefined,
                    boxShadow: sel ? "0 0 0 1px rgba(245, 158, 11, 0.25)" : undefined,
                  },
                  onClick: () => onUpdateAutomation(active.id, { triggerKind: t.id }),
                },
                h("span", { style: { marginTop: "2px", color: sel ? "#f59e0b" : "var(--muted-foreground)" } }, AutoIcon({ h, name: t.id, size: 15 })),
                h(
                  "span",
                  null,
                  h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, t.label),
                  h("div", { className: "of-muted", style: { fontSize: "10.5px", marginTop: "2px", lineHeight: 1.35 } }, t.sub)
                )
              );
            })
          ),
          active.triggerKind === "schedule" &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "10px" } },
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
                  h("option", { value: "minutes" }, "A cada N minutos"),
                  h("option", { value: "hourly" }, "A cada hora"),
                  h("option", { value: "daily" }, "Diário"),
                  h("option", { value: "weekdays" }, "Dias úteis (Seg–Sex)"),
                  h("option", { value: "weekly" }, "Semanal"),
                  h("option", { value: "monthly" }, "Mensal"),
                  h("option", { value: "custom" }, "Cron personalizado")
                ),
                (active.frequency === "minutes" || active.frequency === "hourly") &&
                  h("input", {
                    type: "number",
                    min: active.frequency === "minutes" ? 5 : 1,
                    max: active.frequency === "minutes" ? 59 : 12,
                    className: "of-input",
                    style: { width: "74px" },
                    value: active.intervalValue || (active.frequency === "minutes" ? 15 : 1),
                    onChange: (e: any) => onUpdateAutomation(active.id, { intervalValue: Number(e.target.value) }),
                  }),
                active.frequency === "weekly" &&
                  h(
                    "span",
                    { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
                    h("span", { className: "of-muted" }, "em"),
                    h(
                      "select",
                      {
                        className: "of-tenant-select",
                        value: String(active.dayOfWeek),
                        onChange: (e: any) => onUpdateAutomation(active.id, { dayOfWeek: Number(e.target.value) }),
                      },
                      WEEKDAYS_PT.map((d, idx) => h("option", { key: d, value: String(idx) }, d))
                    )
                  ),
                active.frequency === "monthly" &&
                  h(
                    "span",
                    { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
                    h("span", { className: "of-muted" }, "no dia"),
                    h("input", {
                      type: "number",
                      min: 1,
                      max: 28,
                      className: "of-input",
                      style: { width: "68px" },
                      value: active.dayOfMonth || 1,
                      onChange: (e: any) => onUpdateAutomation(active.id, { dayOfMonth: Number(e.target.value) }),
                    })
                  ),
                active.frequency !== "minutes" && active.frequency !== "custom" &&
                  h(
                    "span",
                    { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" } },
                    h("span", { className: "of-muted" }, "às"),
                    h("input", {
                      type: "time",
                      className: "of-input",
                      style: { width: "110px" },
                      value: active.timeHHMM,
                      onChange: (e: any) => onUpdateAutomation(active.id, { timeHHMM: e.target.value }),
                    })
                  ),
                active.frequency === "custom" &&
                  h("input", {
                    className: "of-input of-mono",
                    style: { width: "190px" },
                    placeholder: "0 9 * * 1-5",
                    value: active.customCron || "0 9 * * 1-5",
                    onChange: (e: any) => onUpdateAutomation(active.id, { customCron: e.target.value }),
                  })
              ),
              h(
                "label",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", fontWeight: 500, maxWidth: "280px" } },
                "Timezone",
                h("input", {
                  className: "of-input",
                  placeholder: "America/Sao_Paulo",
                  value: active.timezone,
                  onChange: (e: any) => onUpdateAutomation(active.id, { timezone: e.target.value }),
                }),
                h("span", { className: "of-muted", style: { fontSize: "10.5px", fontWeight: 400 } }, "Vazio: usa o fuso da empresa (America/Sao_Paulo).")
              ),
              nextRuns.length > 0 &&
                h(
                  "div",
                  {
                    className: "of-surface",
                    style: { padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "11.5px" },
                  },
                  h("span", { style: { marginTop: "2px", color: "#f59e0b" } }, AutoIcon({ h, name: "schedule", size: 15 })),
                  h(
                    "div",
                    null,
                    h(
                      "div",
                      { style: { fontWeight: 600 } },
                      `${describeAutomationTrigger(active)} `,
                      h("span", { className: "of-muted", style: { fontWeight: 400 } }, `· ${active.timezone || "America/Sao_Paulo"}`)
                    ),
                    h("div", { className: "of-mono of-muted", style: { marginTop: "3px", fontSize: "11px" } }, `Próximas: ${nextRuns.join("  ·  ")}`)
                  )
                )
            ),
          active.triggerKind === "event" &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "9px" } },
              h(
                "select",
                {
                  className: "of-tenant-select",
                  style: { maxWidth: "360px" },
                  value: active.eventKind,
                  onChange: (e: any) => onUpdateAutomation(active.id, { eventKind: e.target.value as AutomationEventKind }),
                },
                (Object.keys(EVENT_LABELS_PT) as AutomationEventKind[]).map((ev) =>
                  h("option", { key: ev, value: ev }, EVENT_LABELS_PT[ev])
                )
              ),
              (eventGroup === "pr" || eventGroup === "issue") &&
                h(
                  "div",
                  { className: "of-grid-2" },
                  h(
                    "label",
                    { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px" } },
                    "Filtro: labels (separadas por vírgula)",
                    h("input", {
                      className: "of-input",
                      placeholder: "Qualquer (ex: bug, seguranca)",
                      value: (active.eventFilter?.labels || []).join(", "),
                      onChange: (e: any) =>
                        onUpdateAutomation(active.id, {
                          eventFilter: {
                            ...active.eventFilter,
                            labels: String(e.target.value).split(",").map((s) => s.trim()).filter(Boolean),
                          },
                        }),
                    })
                  ),
                  eventGroup === "pr" &&
                    h(
                      "label",
                      { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px" } },
                      "Filtro: branches",
                      h("input", {
                        className: "of-input",
                        placeholder: "Qualquer (ex: main, feat/*)",
                        value: (active.eventFilter?.branches || []).join(", "),
                        onChange: (e: any) =>
                          onUpdateAutomation(active.id, {
                            eventFilter: {
                              ...active.eventFilter,
                              branches: String(e.target.value).split(",").map((s) => s.trim()).filter(Boolean),
                            },
                          }),
                      })
                    )
                )
            )
        ),

        // 3. O QUE FAZ + PROMPT COM GUTTER NUMERADO + INSERIR PLACEHOLDER
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "11px" } },
          h("div", { style: { fontSize: "13px", fontWeight: 600, paddingBottom: "8px", borderBottom: "1px solid var(--border)" } }, "O que faz"),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" } },
            h(
              "div",
              { className: "of-segmented" },
              ([
                { id: "agent_session", label: "Iniciar sessão de agente", icon: "bot" },
                { id: "message_pm", label: "Mensagem para COO/CEO", icon: "message" },
                { id: "triage_issue", label: "Triar issue", icon: "filter" },
              ] as const).map((act) =>
                h(
                  "button",
                  {
                    key: act.id,
                    type: "button",
                    className: "of-seg-btn",
                    "data-active": active.actionKind === act.id ? "true" : "false",
                    style: { display: "inline-flex", alignItems: "center", gap: "6px" },
                    onClick: () => onUpdateAutomation(active.id, { actionKind: act.id }),
                  },
                  AutoIcon({ h, name: act.icon, size: 13 }),
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
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
            h(
              "span",
              { style: { fontSize: "11.5px", fontWeight: 500 } },
              active.actionKind === "agent_session"
                ? "Prompt para o agente"
                : active.actionKind === "message_pm"
                ? "Mensagem para o COO / CEO"
                : "Orientação extra de triagem (opcional)"
            ),
            h(
              "select",
              {
                className: "of-tenant-select",
                style: { fontSize: "11px", fontFamily: "var(--font-mono)" },
                value: "",
                "aria-label": "Inserir placeholder",
                onChange: (e: any) => {
                  if (e.target.value) insertPlaceholder(e.target.value);
                  e.target.value = "";
                },
              },
              h("option", { value: "" }, "{ } Inserir placeholder ▾"),
              contextualPlaceholders.map((ph) => h("option", { key: ph, value: ph }, ph))
            )
          ),
          // Editor com numeração de linhas (1:1 CodeDen PromptField)
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "34px 1fr",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.28)",
                overflow: "hidden",
              },
            },
            h(
              "div",
              {
                "aria-hidden": "true",
                className: "of-mono of-muted",
                style: {
                  padding: "10px 6px",
                  textAlign: "right",
                  fontSize: "11px",
                  lineHeight: "1.6",
                  userSelect: "none",
                  borderRight: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.02)",
                  opacity: 0.55,
                },
              },
              Array.from({ length: promptLines }, (_, i) => h("div", { key: i }, String(i + 1)))
            ),
            h("textarea", {
              className: "of-mono",
              style: {
                width: "100%",
                minHeight: "150px",
                padding: "10px 12px",
                border: "none",
                outline: "none",
                resize: "vertical",
                background: "transparent",
                color: "var(--foreground)",
                fontSize: "12px",
                lineHeight: "1.6",
              },
              value: active.prompt,
              onChange: (e: any) => onUpdateAutomation(active.id, { prompt: e.target.value }),
            })
          )
        ),

        // 4. PERMISSÕES (4 cards 1:1 CodeDen permissions-field.tsx)
        active.actionKind === "agent_session" &&
          h(
            "section",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h(
              "div",
              { style: { paddingBottom: "8px", borderBottom: "1px solid var(--border)" } },
              h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "Permissões"),
              h("div", { className: "of-muted", style: { fontSize: "11px", marginTop: "2px" } }, "O que o agente pode fazer sozinho enquanto ninguém está olhando.")
            ),
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" } },
              ([
                { id: "read_only", label: "Somente leitura", desc: "Lê e roda checks; nunca edita nem faz push." },
                { id: "supervised", label: "Supervisionado", desc: "Pede confirmação antes de editar ou rodar comandos." },
                { id: "auto", label: "Auto", desc: "Trabalha livre na worktree; só pede em ações de risco." },
                { id: "full", label: "Full", desc: "Nunca pede confirmação, mesmo sem supervisão." },
              ] as const).map((lvl) => {
                const sel = autonomy === lvl.id;
                return h(
                  "button",
                  {
                    key: lvl.id,
                    type: "button",
                    className: "of-surface",
                    style: {
                      padding: "9px 10px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--foreground)",
                      borderColor: sel ? "rgba(245, 158, 11, 0.75)" : undefined,
                      background: sel ? "rgba(245, 158, 11, 0.08)" : undefined,
                    },
                    onClick: () => onUpdateAutomation(active.id, { autonomy: lvl.id }),
                  },
                  h("div", { style: { fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" } }, AutoIcon({ h, name: "shield", size: 12, color: sel ? "#f59e0b" : undefined }), lvl.label),
                  h("div", { className: "of-muted", style: { fontSize: "10px", marginTop: "3px", lineHeight: 1.35 } }, lvl.desc)
                );
              })
            ),
            autonomy === "full" &&
              h("div", { style: { fontSize: "11px", color: "var(--status-waiting)" } }, "⚠ Full nunca pede confirmação antes de agir. Use apenas em fluxos confiáveis.")
          ),

        // 5. OPÇÕES AVANÇADAS / GUARDAS (colapsável 1:1 CodeDen guards-editor.tsx)
        h(
          "details",
          { className: "of-card-pad", style: { padding: 0, overflow: "hidden" } },
          h(
            "summary",
            { style: { padding: "11px 14px", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, listStyle: "none", display: "flex", alignItems: "center", gap: "8px" } },
            "▸ Opções avançadas",
            h("span", { className: "of-muted", style: { fontSize: "11px", fontWeight: 400 } }, "Work key, sobreposição, limites diários, horário silencioso, recuperação")
          ),
          h(
            "div",
            { style: { padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "12px" } },
            h(
              "div",
              { className: "of-grid-2" },
              h(
                "label",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
                "Título da sessão",
                h("input", {
                  className: "of-input",
                  placeholder: active.name,
                  value: active.sessionTitle || "",
                  onChange: (e: any) => onUpdateAutomation(active.id, { sessionTitle: e.target.value }),
                })
              ),
              h(
                "label",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
                "Work key (evita sobreposição)",
                h("input", {
                  className: "of-input of-mono",
                  placeholder: `automation:${active.id}`,
                  value: active.workKey || "",
                  onChange: (e: any) => onUpdateAutomation(active.id, { workKey: e.target.value }),
                })
              )
            ),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "5px" } },
              h("span", { style: { fontSize: "11.5px", fontWeight: 500 } }, "Quando já houver trabalho igual rodando"),
              h(
                "div",
                { className: "of-segmented", style: { width: "fit-content" } },
                (["skip-if-running", "queue", "run-anyway"] as const).map((pol) =>
                  h(
                    "button",
                    {
                      key: pol,
                      type: "button",
                      className: "of-seg-btn",
                      "data-active": guards.overlapPolicy === pol ? "true" : "false",
                      onClick: () => onUpdateAutomation(active.id, { guards: { ...guards, overlapPolicy: pol } }),
                    },
                    OVERLAP_LABELS_PT[pol]
                  )
                )
              )
            ),
            h(
              "div",
              { className: "of-grid-2" },
              h(
                "label",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
                "Execuções simultâneas",
                h("input", {
                  type: "number",
                  min: 1,
                  className: "of-input",
                  style: { width: "96px" },
                  value: guards.maxConcurrent,
                  onChange: (e: any) => onUpdateAutomation(active.id, { guards: { ...guards, maxConcurrent: Math.max(1, Number(e.target.value) || 1) } }),
                })
              ),
              h(
                "label",
                { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" } },
                "Máximo por dia (vazio = sem limite)",
                h("input", {
                  type: "number",
                  min: 1,
                  className: "of-input",
                  style: { width: "120px" },
                  placeholder: "Sem limite",
                  value: guards.maxPerDay ?? "",
                  onChange: (e: any) =>
                    onUpdateAutomation(active.id, {
                      guards: { ...guards, maxPerDay: e.target.value ? Math.max(1, Number(e.target.value)) : null },
                    }),
                })
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", fontSize: "11.5px" } },
              ToggleSwitch({
                h,
                checked: Boolean(guards.quietHours),
                label: "Horário silencioso",
                onChange: (on) =>
                  onUpdateAutomation(active.id, { guards: { ...guards, quietHours: on ? { start: "22:00", end: "07:00" } : null } }),
              }),
              h("span", { style: { fontWeight: 500 } }, "Horário silencioso"),
              guards.quietHours &&
                h(
                  "span",
                  { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
                  h("input", {
                    type: "time",
                    className: "of-input",
                    style: { width: "98px" },
                    value: guards.quietHours.start,
                    onChange: (e: any) => onUpdateAutomation(active.id, { guards: { ...guards, quietHours: { ...guards.quietHours!, start: e.target.value } } }),
                  }),
                  h("span", { className: "of-muted" }, "até"),
                  h("input", {
                    type: "time",
                    className: "of-input",
                    style: { width: "98px" },
                    value: guards.quietHours.end,
                    onChange: (e: any) => onUpdateAutomation(active.id, { guards: { ...guards, quietHours: { ...guards.quietHours!, end: e.target.value } } }),
                  })
                )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px", fontSize: "11.5px" } },
              ToggleSwitch({
                h,
                checked: Boolean(guards.catchUpMissed),
                label: "Recuperar execução perdida",
                onChange: (v) => onUpdateAutomation(active.id, { guards: { ...guards, catchUpMissed: v } }),
              }),
              h("span", null, "Recuperar execução perdida se o Mac estava desligado/suspenso")
            )
          )
        )
      ),

      // ── COLUNA DIREITA: SCHEDULE CARD + RECENT RUNS (1:1 CodeDen schedule-card.tsx) ──
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "14px" } },
        h(
          "section",
          { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            ToggleSwitch({
              h,
              checked: active.enabled,
              label: `Ativar ${active.name}`,
              onChange: (v) => onUpdateAutomation(active.id, { enabled: v }),
            }),
            h("strong", { style: { fontSize: "13px" } }, active.enabled ? "Ativa" : "Desativada"),
            h(
              "span",
              { className: "of-muted", style: { marginLeft: "auto", fontSize: "11px" } },
              !active.enabled ? "Desligada" : active.paused ? "Pausada" : "Ligada"
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "7px", paddingTop: "10px", borderTop: "1px solid var(--border)", fontSize: "11.5px" } },
            active.triggerKind === "schedule" &&
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", gap: "8px" } },
                h("span", { className: "of-muted" }, "Próxima execução"),
                h(
                  "span",
                  { title: nextRuns[0] || "" },
                  active.enabled && !active.paused ? formatRelativeUntil(nextDates[0]) : "Pausada",
                  active.skipNextAt && nextRuns[0] && active.skipNextAt === nextRuns[0] &&
                    h("span", { style: { color: "var(--status-waiting)" } }, " · pular")
                )
              ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "8px" } },
              h("span", { className: "of-muted" }, "Fonte"),
              h("span", null, `OrgFy${active.templateId ? ` · ${active.templateId}` : ""}`)
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "8px" } },
              h("span", { className: "of-muted" }, "Work key"),
              h("code", { className: "of-mono", style: { fontSize: "10.5px" } }, active.workKey || `automation:${active.id}`)
            ),
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: "8px" } },
              h("span", { className: "of-muted" }, "Aplica-se a"),
              h("span", null, active.scope === "all" ? "Todas as empresas" : "Esta empresa")
            )
          ),
          // Barra de ações idêntica ao print: [▶ Executar agora] [⏭ Pular próxima] [⏸ Pausar] [🗑]
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "10px", borderTop: "1px solid var(--border)" } },
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                "data-automation-run-now": "true",
                disabled: runningId === active.id,
                style: { fontSize: "11.5px", padding: "5px 11px", background: "#f59e0b", color: "#111", borderColor: "#f59e0b", fontWeight: 600 },
                onClick: () => onRunNow(active),
              },
              AutoIcon({ h, name: "play", size: 12, color: "#111" }),
              runningId === active.id ? "Rodando..." : "Executar agora"
            ),
            active.triggerKind === "schedule" &&
              active.enabled &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  style: { fontSize: "11.5px", padding: "5px 9px" },
                  onClick: () =>
                    onUpdateAutomation(active.id, {
                      skipNextAt: active.skipNextAt && nextRuns[0] === active.skipNextAt ? null : nextRuns[0] || null,
                    }),
                },
                AutoIcon({ h, name: "skip", size: 12 }),
                active.skipNextAt && nextRuns[0] === active.skipNextAt ? "Desfazer" : "Pular próxima"
              ),
            active.enabled &&
              active.triggerKind !== "manual" &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  style: { fontSize: "11.5px", padding: "5px 8px" },
                  onClick: () => onUpdateAutomation(active.id, { paused: !active.paused }),
                },
                AutoIcon({ h, name: active.paused ? "play" : "pause", size: 12 }),
                active.paused ? "Retomar" : "Pausar"
              ),
            automations.length > 1 &&
              h(
                "button",
                {
                  type: "button",
                  className: "of-btn",
                  "data-variant": "ghost",
                  title: "Excluir automação",
                  style: { marginLeft: "auto", padding: "5px 7px", color: "var(--muted-foreground)" },
                  onClick: () => onDeleteAutomation(active.id),
                },
                AutoIcon({ h, name: "trash", size: 13 })
              )
          )
        ),

        // EXECUÇÕES RECENTES (1:1 CodeDen)
        h(
          "section",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          h("div", { className: "of-meter-label", style: { paddingLeft: "2px" } }, "EXECUÇÕES RECENTES"),
          h(
            "div",
            { className: "of-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px" } },
            active.recentRuns.length === 0
              ? h(
                  "div",
                  { style: { padding: "22px 10px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" } },
                  h(
                    "span",
                    { style: { width: "32px", height: "32px", borderRadius: "8px", background: "var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" } },
                    AutoIcon({ h, name: "clock", size: 16 })
                  ),
                  h("div", { style: { fontSize: "12.5px", fontWeight: 600 } }, "Nenhuma execução ainda"),
                  h("div", { className: "of-muted", style: { fontSize: "11px", lineHeight: 1.45 } }, "As execuções aparecem aqui quando um agendamento, evento ou Executar agora dispara.")
                )
              : active.recentRuns.slice(0, 6).map((r) =>
                  h(
                    "div",
                    { key: r.id, className: "of-surface", style: { padding: "7px 9px", fontSize: "11px" } },
                    h(
                      "div",
                      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                      h("span", { className: "of-pill", "data-tone": r.status === "ok" ? "done" : r.status === "error" ? "failed" : "waiting", style: { fontSize: "9.5px", padding: "0 5px" } }, r.status === "ok" ? "OK" : r.status === "error" ? "ERRO" : "PULADA"),
                      h("span", { className: "of-mono of-muted", style: { fontSize: "9.5px" } }, r.at)
                    ),
                    h("div", { className: "of-muted", style: { marginTop: "3px" } }, r.detail)
                  )
                )
          )
        )
      )
    )
  );
}
