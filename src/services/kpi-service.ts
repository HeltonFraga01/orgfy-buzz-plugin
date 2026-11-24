import type { Context } from "@buzz/author";

export interface DailySeriesPoint {
  dia: string;
  merges: number;
  retrabalhos: number;
  conflitos: number;
}

export interface ModelUsageRow {
  modelo: string;
  grupo: string;
  requisicoes: number;
  custo_usd: number;
  tokens_totais: number;
  cache_hit_pct: number;
  latencia_media_ms: number;
}

export interface OrphanCardEntry {
  issue_id: string;
  titulo: string;
  estado: string;
}

export interface StagnatedEntry {
  chave: string;
  ciclos: number;
  nivel: number;
}

export interface ActiveKpiAlert {
  codigo: string;
  severidade: "info" | "warn" | "critical";
  mensagem: string;
  acao_sugerida: string;
}

export interface KpisEsteiraPayload {
  schema_version: string;
  gerado_em: string;
  janela_dias: number;
  fontes: {
    scratch_dir?: string;
    transicoes_linhas: number;
    nm_usage_itens: number;
    placar_arquivo: string | null;
    sentinela_entradas: number;
  };
  fluxo: {
    vazao_total_feito: number;
    vazao_7d: number;
    vazao_30d: number;
    fila_revisao_atual: number;
    revisao_espera_p50_min: number | null;
    revisao_espera_p90_min: number | null;
    lead_time_p50_min: number | null;
    lead_time_p90_min: number | null;
    taxa_conflito_pct: number;
    serie_diaria_14d: DailySeriesPoint[];
  };
  qualidade: {
    fpy_real_pct: number | null;
    cards_aceitos_primeira: number;
    cards_com_retrabalho: number;
    taxa_retrabalho_pct: number;
    total_loops_revisao_execucao: number;
    total_conflitos_integracao: number;
  };
  economia: {
    teto_diario_tokens: number;
    tokens_hoje: number;
    tokens_7d: number;
    tokens_30d: number;
    tokens_historico_acumulado?: number;
    uso_teto_diario_pct: number;
    status_orcamento: "OK" | "ALERTA_80" | "BLOQUEADO_100";
    cards_integrados_30d: number;
    tokens_por_card_integrado: number | null;
    cpi_real: number | null;
    custo_usd_total_amostra: number;
    cache_hit_ratio_pct: number;
    por_modelo: ModelUsageRow[];
  };
  higiene: {
    wip_total_ativo: number;
    wip_atribuido: number;
    orphan_wip_count: number;
    orphan_wip_pct: number;
    top_orfaos: OrphanCardEntry[];
    estagnados_nivel_3: number;
    estagnados_nivel_2: number;
    top_estagnados: StagnatedEntry[];
  };
  alertas_ativos: ActiveKpiAlert[];
}

export interface KpiHistoryPoint {
  ts: string;
  fpy_real_pct: number | null;
  fila_revisao_atual: number;
  orphan_wip_count: number;
  uso_teto_diario_pct: number;
  vazao_7d: number;
}

export interface KpiReadResult {
  disponivel: boolean;
  error: string | null;
  sourcePath: string;
  kpis: KpisEsteiraPayload | null;
  history: KpiHistoryPoint[];
}

export const KPI_SNAPSHOT_PATH = "/Users/heltonfraga/.buzz/.scratch/kpis-esteira.json";
export const KPI_SCRIPT_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy/ferramentas/esteira/gerar_kpis_esteira.py";
const ARTIFACT_COLLECTION = "orgfy_kpi_history_v1";
const LOCAL_STORAGE_KEY = "orgfy_kpi_history_v1";
const MAX_HISTORY_POINTS = 60;

async function readHistory(ctx: Context): Promise<KpiHistoryPoint[]> {
  try {
    const store = (ctx as any).artifactStorage;
    if (store?.list) {
      const items = await store.list(ARTIFACT_COLLECTION);
      if (Array.isArray(items)) {
        return items
          .map((it: any) => it?.value ?? it)
          .filter((p: any) => p && typeof p.ts === "string")
          .slice(-MAX_HISTORY_POINTS);
      }
    }
  } catch {
    // Fallback silencioso para localStorage
  }

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(-MAX_HISTORY_POINTS);
      }
    }
  } catch {
    // Ignore storage errors in headless tests
  }
  return [];
}

export async function recordKpiSnapshotHistory(
  ctx: Context,
  kpis: KpisEsteiraPayload
): Promise<KpiHistoryPoint[]> {
  const point: KpiHistoryPoint = {
    ts: kpis.gerado_em || new Date().toISOString(),
    fpy_real_pct: kpis.qualidade?.fpy_real_pct ?? null,
    fila_revisao_atual: kpis.fluxo?.fila_revisao_atual ?? 0,
    orphan_wip_count: kpis.higiene?.orphan_wip_count ?? 0,
    uso_teto_diario_pct: kpis.economia?.uso_teto_diario_pct ?? 0,
    vazao_7d: kpis.fluxo?.vazao_7d ?? 0,
  };

  try {
    const store = (ctx as any).artifactStorage;
    if (store?.put) {
      await store.put(ARTIFACT_COLLECTION, point.ts, point);
    }
  } catch {
    // Continua com localStorage fallback
  }

  const prev = await readHistory(ctx);
  const filtered = prev.filter((p) => p.ts !== point.ts);
  const next = [...filtered, point].slice(-MAX_HISTORY_POINTS);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore
  }
  return next;
}

function decodeHostFile(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (obj.bytes instanceof Uint8Array) return new TextDecoder("utf-8").decode(obj.bytes);
    if (ArrayBuffer.isView(raw)) {
      return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
    }
  }
  return String(raw ?? "");
}

export async function fetchKpisEsteira(ctx: Context): Promise<KpiReadResult> {
  const host = (ctx as any).host;
  const history = await readHistory(ctx);

  if (!host?.readFile) {
    return {
      disponivel: false,
      error: "API ctx.host.readFile indisponível neste ambiente.",
      sourcePath: KPI_SNAPSHOT_PATH,
      kpis: null,
      history,
    };
  }

  try {
    const raw = await host.readFile(KPI_SNAPSHOT_PATH);
    const text = decodeHostFile(raw);
    const parsed = JSON.parse(text) as KpisEsteiraPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.fluxo || !parsed.economia) {
      return {
        disponivel: false,
        error: "Arquivo kpis-esteira.json inválido ou incompleto.",
        sourcePath: KPI_SNAPSHOT_PATH,
        kpis: null,
        history,
      };
    }
    const updatedHistory = await recordKpiSnapshotHistory(ctx, parsed);
    return {
      disponivel: true,
      error: null,
      sourcePath: KPI_SNAPSHOT_PATH,
      kpis: parsed,
      history: updatedHistory,
    };
  } catch (err: any) {
    return {
      disponivel: false,
      error: err?.message || "Não foi possível ler kpis-esteira.json.",
      sourcePath: KPI_SNAPSHOT_PATH,
      kpis: null,
      history,
    };
  }
}

export async function recalculateKpisNow(ctx: Context): Promise<{
  ok: boolean;
  output: string;
  result: KpiReadResult;
}> {
  const host = (ctx as any).host;
  let output = "";

  try {
    // manifest.json declara o processo pelo id "python" (program: "python3") e "bash" (args: ["-c"]).
    // Chamar "python3" como id disparava "Process is not declared" no sandbox do Buzz Desktop.
    if (host?.exec) {
      let res = await host.exec("python", [KPI_SCRIPT_PATH, "--output", KPI_SNAPSHOT_PATH]);
      if (res?.exitCode && res.exitCode !== 0) {
        res = await host.exec("bash", [
          "-c",
          `python3 "${KPI_SCRIPT_PATH}" --output "${KPI_SNAPSHOT_PATH}"`,
        ]);
      }
      output = [res?.stdout, res?.stderr].filter(Boolean).join("\n").trim();
    } else if (host?.spawn) {
      const proc = await host.spawn("python", [KPI_SCRIPT_PATH, "--output", KPI_SNAPSHOT_PATH]);
      if (proc?.exited) {
        await proc.exited;
      }
      output = "Recálculo executado via subprocesso (python).";
    }
  } catch (err: any) {
    output = `Aviso ao executar script: ${err?.message || err}`;
  }

  const result = await fetchKpisEsteira(ctx);
  return {
    ok: result.disponivel,
    output,
    result,
  };
}


export interface GooseLoopSession {
  session_id: string;
  agente: string;
  nome: string;
  ativa?: boolean;
  channel_id?: string | null;
  thread_root?: string | null;
  agent_pubkey?: string | null;
  worktree?: string | null;
  duracao_min: number;
  thread_lifetime_min?: number;
  ultima_atualizacao_min: number;
  msgs: number;
  shells: number;
  comandos_unicos_pct?: number;
  max_repeticao_recente?: number;
  erros_consecutivos?: number;
  help_calls: number;
  severidade: "ok" | "warn" | "critical";
  flags: string[];
  ultimo_shell: string;
  acao_sugerida?: string;
}

export interface GooseLoopRadarPayload {
  ok: boolean;
  error: string | null;
  gerado_em: string;
  resumo: {
    total_recentes: number;
    ativas_total?: number;
    criticos: number;
    criticos_ativos?: number;
    criticos_historico_3h?: number;
    avisos: number;
    avisos_ativos?: number;
    duplicadas: number;
    duplicadas_ativas?: number;
  };
  sessoes: GooseLoopSession[];
}

export const GOOSE_LOOP_RADAR_SCRIPT_PATH =
  "/Users/heltonfraga/.buzz/REPOS/orgfy-buzz-plugin/scripts/goose_loop_radar.py";
export const GOOSE_LOOP_RADAR_SNAPSHOT_PATH =
  "/Users/heltonfraga/.buzz/.scratch/goose-loop-radar.json";

export async function fetchGooseLoopRadar(ctx: Context): Promise<GooseLoopRadarPayload> {
  const host = (ctx as any).host;
  const empty: GooseLoopRadarPayload = {
    ok: false,
    error: "Leitura do radar Goose indisponível neste ambiente.",
    gerado_em: new Date().toISOString(),
    resumo: {
      total_recentes: 0,
      ativas_total: 0,
      criticos: 0,
      criticos_ativos: 0,
      criticos_historico_3h: 0,
      avisos: 0,
      avisos_ativos: 0,
      duplicadas: 0,
      duplicadas_ativas: 0,
    },
    sessoes: [],
  };

  // 1. Tenta atualizar o snapshot via host.spawn("python", { args: [...] }) (API oficial @buzz/author)
  try {
    if (host?.spawn) {
      const proc = await host.spawn("python", { args: [GOOSE_LOOP_RADAR_SCRIPT_PATH] });
      if (proc?.exited) {
        await proc.exited;
      }
    } else if (host?.exec) {
      await host.exec("python", [GOOSE_LOOP_RADAR_SCRIPT_PATH]);
    }
  } catch {
    // Se falhar o spawn, segue para ler o último snapshot gravado em disco
  }

  // 2. Lê o JSON gravado em ~/.buzz/.scratch/goose-loop-radar.json via host.readFile
  try {
    if (host?.readFile) {
      const raw = await host.readFile(GOOSE_LOOP_RADAR_SNAPSHOT_PATH);
      const text = decodeHostFile(raw);
      const parsed = JSON.parse(text) as GooseLoopRadarPayload;
      if (parsed && typeof parsed === "object" && parsed.resumo) {
        return parsed;
      }
    }
    return empty;
  } catch (err: any) {
    return { ...empty, error: err?.message || "Snapshot goose-loop-radar.json ainda não gerado." };
  }
}

export function filterGooseLoopRadar(
  payload: GooseLoopRadarPayload,
  opts?: { apenas_ativos?: boolean; agente?: string }
) {
  const onlyActive = opts?.apenas_ativos !== false;
  const agentFilter = (opts?.agente || "").trim().toLowerCase();

  let filtered = payload.sessoes || [];
  if (onlyActive) {
    filtered = filtered.filter((s) => (typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15));
  }
  if (agentFilter) {
    filtered = filtered.filter(
      (s) =>
        s.agente.toLowerCase().includes(agentFilter) ||
        s.nome.toLowerCase().includes(agentFilter)
    );
  }

  return {
    ok: payload.ok,
    error: payload.error,
    gerado_em: payload.gerado_em,
    filtro_aplicado: { apenas_ativos: onlyActive, agente: agentFilter || null },
    resumo: payload.resumo,
    total_exibidas: filtered.length,
    sessoes: filtered,
    protocolo_resolucao: [
      "COMANDO_REPETIDO / ERRO_REPETIDO / STALLED_THINKING (critico): Loop real confirmado no turno atual (mesmo comando >=3x sem mudança de estado, >=3 erros consecutivos ou thinking travado >=10m). Inspecione ultimo_shell e chame orgfy_session_stop({ agente, agent_pubkey, channel_id, thread_root, action: 'interrupt', release_issue_id? }).",
      "SESSAO_DUPLICADA (warn): Só dispara em colisão real na mesma thread_root ou mesmo worktree (threads diferentes = paralelismo legítimo). Encerre a sessão redundante com orgfy_session_stop.",
      "TURNO_LONGO (warn): Turno longo com comandos distintos indica trabalho produtivo; só interrompa se ultimo_shell confirmar tarefa obsoleta (ex: PR já fechado).",
    ],
  };
}
