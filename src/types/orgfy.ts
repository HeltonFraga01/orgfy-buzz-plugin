// ─────────────────────────────────────────────────────────────────────────────
// TIPOS CANÔNICOS DO ORGFY CONTROL ROOM (ESTEIRA DETERMINÍSTICA V10)
// ─────────────────────────────────────────────────────────────────────────────

export interface BoardManifest {
  empresa: "board";
  nivel: "board";
  nome: string;
  relay: string;
  workspace_buzz: string;
  fundador: { nome: string; pubkey: string };
  ceo_holding: { nome: string; pubkey: string; acesso_multi_workspace: boolean };
  core_framework: { empresa: string; repositorio: string; responsabilidade: string };
  subsidiarias: Array<{
    slug: string;
    manifesto: string;
    workspace_buzz: string;
    ceo_empresa: string;
    reporta_a: string;
  }>;
  protocolo_governanca: {
    cadeia_comando: string[];
    invariantes: string[];
  };
}

export interface EmpresaManifest {
  empresa: string;
  repo_id: string;
  repo_owner: string;
  canal: string;
  relay: string;
  hierarquia: {
    nivel: "core_framework" | "subsidiaria";
    workspace_buzz: string;
    reporta_a: string;
    ceo_holding: string;
    ceo_empresa: string;
    canal_board_reporte: string;
  };
  agentes_persistentes_chat: string[];
  modo_execucao_workers: "efemero_headless";
  ci_runner: {
    modo_padrao: "swarm_efemero" | "local";
    fallback_local: boolean;
    endpoint_id: number;
    image: string;
    cmd: string[];
  };
  probes_caixa_preta: {
    obrigatorio_no_gate: boolean;
    probes_padrao: Array<{
      tipo: "http_rota" | "supabase_rls" | "playwright_console" | "comando";
      url?: string;
      status_esperado?: number;
      tabelas_obrigatorias?: string[];
      exigir_screenshot?: boolean;
      cmd?: string;
    }>;
  };
  governanca_orcamento?: {
    budget_tokens_diario: number;
    tokens_planejados_por_card: number;
    cpi_minimo: number;
    max_consecutive_agent_replies: number;
  };
  papeis: Record<string, string>;
  revisores_por_superficie?: Record<string, string>;
  revisores?: string[];
  executores?: string[];
}

export interface AceiteCacheItem {
  issue_id: string;
  sha_pr: string;
  comando: string;
  status: "VERDE" | "FALHOU";
  exit_code: number;
  resumo: string;
  timestamp: number;
}

export interface CiCacheItem {
  status: "ok" | "fail";
  exit_code: number;
  resumo: string;
  timestamp: number;
}

export interface EsteiraMinimaState {
  aceite_cache: Record<string, AceiteCacheItem>;
  aceites: Record<string, any>;
  ci: Record<string, string>;
  ci_cache: Record<string, CiCacheItem>;
  ci_failure_notifications: Record<string, any>;
  cutover_at: number;
  merge_failures?: Record<string, any>;
  merged: Record<string, any>;
  timings?: Record<string, any>;
}

export interface PlacarCardAtivo {
  id: string;
  tipo: "issue" | "pr";
  estado: "triagem" | "despachado" | "execucao" | "revisao" | "feito";
  bola: string;
  responsavel: string;
}

export interface PlacarState {
  cards_por_estado: {
    triagem?: number;
    execucao: number;
    revisao: number;
    integracao: number;
    conflito: number;
    feito: number;
  };
  tempo_por_estado?: Record<string, number>;
  voltas_revisao?: number;
  pct_aceito_primeira_revisao: number;
  aprovado_no_tip_e_parado?: number;
  alarme_aprovado_no_tip_e_parado?: boolean;
  cards_ativos_detalhes: PlacarCardAtivo[];
}

export interface RegraProbatoria {
  regra_id: string;
  erro_id: string;
  descricao: string;
  comando_check: string;
  hash_comando: string;
  alvo_guarda: string;
  status: "EM_TESTE" | "MANTIDA" | "REVERTIDA";
  criada_em_ts: number;
  atualizada_em_ts: number;
  baseline_fpy: number;
  fpy_observado: number;
  janela_alvo: number;
  cards_avaliados: number;
  falhas_durante_teste: number;
  motivo_transicao: string;
}

export interface RegrasProbatoriasState {
  regras: Record<string, RegraProbatoria>;
}

export interface PipelineCard {
  id: string;
  issueId: string;
  prId?: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  empresa: string;
  executor: string;
  revisor: string;
  tier: "tier_1_exec_barato" | "tier_2_revisor" | "tier_3_arquiteto";
  stage: "triagem" | "despachado" | "execucao" | "revisao" | "feito";
  commitSha?: string;
  elapsedTime: string;
  dsapScore?: number;
  workerPid?: number;
  turnCurrent?: number;
  turnMax?: number;
  ciStatus?: "pass" | "running" | "fail";
  probes?: {
    http_rota: boolean;
    supabase_rls: boolean;
    playwright_console: boolean;
  };
  rejectionHistory?: Array<{
    author: string;
    timestamp: number;
    reason: string;
    similarityToFirst?: number;
  }>;
}
