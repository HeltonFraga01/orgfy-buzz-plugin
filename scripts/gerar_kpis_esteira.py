#!/usr/bin/env python3
"""
OrgFy v11 — Motor Determinístico de KPIs & Saneamento de Telemetria (Onda 1)
Spec: docs/specs/SPEC-ONDA-1-KPIS-TELEMETRIA.md

Lê fontes locais de telemetria em ~/.buzz/.scratch/ (somente leitura) e gera
um snapshot consolidado kpis-esteira.json sem dependências externas.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def resolve_default_scratch_dir() -> Path:
    # 1. Variável de ambiente explícita
    env_dir = os.environ.get("ORGFY_SCRATCH_DIR")
    if env_dir:
        return Path(env_dir)
    # 2. Relativo à árvore do repositório (~/.buzz/REPOS/orgfy-buzz-plugin/scripts -> ~/.buzz/.scratch)
    script_path = Path(__file__).resolve()
    for parent in script_path.parents:
        candidate = parent / ".scratch"
        if candidate.is_dir() and (candidate / "esteira-transicoes.jsonl").exists():
            return candidate
    # 3. Caminho padrão ~/.buzz/.scratch
    home_candidate = Path.home() / ".buzz" / ".scratch"
    if home_candidate.is_dir():
        return home_candidate
    return Path("/Users/heltonfraga/.buzz/.scratch")


DEFAULT_SCRATCH_DIR = resolve_default_scratch_dir()
DEFAULT_OUTPUT_PATH = DEFAULT_SCRATCH_DIR / "kpis-esteira.json"
DEFAULT_DAILY_TOKEN_CAP = 2_000_000
PLANNED_TOKENS_PER_CARD = 250_000


def parse_timestamp(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        ts = float(val)
        if ts <= 0:
            return None
        if ts > 1e12:
            ts = ts / 1000.0
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except (ValueError, OSError, OverflowError):
            return None
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            try:
                return parse_timestamp(float(s))
            except ValueError:
                return None
    return None


def percentile(values: List[float], p: float) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 2)
    k = (len(ordered) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(ordered[int(k)], 2)
    d0 = ordered[f] * (c - k)
    d1 = ordered[c] * (k - f)
    return round(d0 + d1, 2)


def safe_load_json(path: Path) -> Optional[Any]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def find_latest_placar(scratch_dir: Path) -> Optional[Path]:
    candidates = sorted(
        scratch_dir.glob("placar-*.json"),
        key=lambda p: (p.name, p.stat().st_mtime),
        reverse=True,
    )
    return candidates[0] if candidates else None


def analyze_transitions(
    jsonl_path: Path, now_utc: datetime
) -> Tuple[Dict[str, Any], Dict[str, Any], int]:
    events: List[Dict[str, Any]] = []
    if jsonl_path.exists():
        try:
            with jsonl_path.open("r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        if isinstance(obj, dict):
                            events.append(obj)
                    except json.JSONDecodeError:
                        continue
        except Exception:
            events = []

    by_issue: Dict[str, List[Tuple[datetime, Dict[str, Any]]]] = defaultdict(list)
    daily_counts: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"merges": 0, "retrabalhos": 0, "conflitos": 0}
    )

    total_loops_rev_exec = 0
    total_conflitos = 0
    all_parsed_ts: List[datetime] = []

    for ev in events:
        dt = parse_timestamp(ev.get("ts") or ev.get("timestamp"))
        if dt is None:
            continue
        all_parsed_ts.append(dt)
        day_key = dt.strftime("%Y-%m-%d")
        prev_st = str(ev.get("estado_anterior") or "").strip().lower()
        new_st = str(ev.get("estado_novo") or "").strip().lower()
        issue_id = str(ev.get("issue_id") or "").strip()

        if new_st == "feito":
            daily_counts[day_key]["merges"] += 1
        if new_st == "conflito":
            total_conflitos += 1
            daily_counts[day_key]["conflitos"] += 1
        if prev_st in ("revisao", "integracao", "conflito") and new_st == "execucao":
            total_loops_rev_exec += 1
            daily_counts[day_key]["retrabalhos"] += 1

        if issue_id:
            by_issue[issue_id].append((dt, ev))

    # Anchor rolling windows to now_utc (or latest event date if clock differs)
    anchor = now_utc
    if all_parsed_ts:
        latest_ev = max(all_parsed_ts)
        if latest_ev > anchor:
            anchor = latest_ev

    cutoff_7d = anchor - timedelta(days=7)
    cutoff_30d = anchor - timedelta(days=30)

    review_waits_min: List[float] = []
    lead_times_min: List[float] = []
    issues_feito = 0
    issues_feito_7d = 0
    issues_feito_30d = 0
    cards_aceitos_primeira = 0
    cards_com_retrabalho = 0
    issues_com_conflito = 0

    for issue_id, seq in by_issue.items():
        seq.sort(key=lambda item: item[0])
        first_ts = seq[0][0]
        reached_feito_ts: Optional[datetime] = None
        had_rework = False
        had_conflict = False

        for idx, (ts, ev) in enumerate(seq):
            prev_st = str(ev.get("estado_anterior") or "").strip().lower()
            new_st = str(ev.get("estado_novo") or "").strip().lower()

            if new_st == "conflito":
                had_conflict = True
                had_rework = True
            if prev_st in ("revisao", "integracao", "conflito") and new_st == "execucao":
                had_rework = True

            if new_st == "revisao" and idx + 1 < len(seq):
                next_ts = seq[idx + 1][0]
                wait_min = (next_ts - ts).total_seconds() / 60.0
                if 0.0 <= wait_min <= 60 * 24 * 30:
                    review_waits_min.append(wait_min)

            if new_st == "feito" and reached_feito_ts is None:
                reached_feito_ts = ts

        if had_conflict:
            issues_com_conflito += 1

        if reached_feito_ts is not None:
            issues_feito += 1
            if reached_feito_ts >= cutoff_7d:
                issues_feito_7d += 1
            if reached_feito_ts >= cutoff_30d:
                issues_feito_30d += 1
            lt_min = (reached_feito_ts - first_ts).total_seconds() / 60.0
            if 0.0 <= lt_min <= 60 * 24 * 60:
                lead_times_min.append(lt_min)
            if had_rework:
                cards_com_retrabalho += 1
            else:
                cards_aceitos_primeira += 1

    # 14-day daily series
    serie_14d: List[Dict[str, Any]] = []
    for offset in range(13, -1, -1):
        day_str = (anchor - timedelta(days=offset)).strftime("%Y-%m-%d")
        c = daily_counts.get(day_str, {"merges": 0, "retrabalhos": 0, "conflitos": 0})
        serie_14d.append(
            {
                "dia": day_str,
                "merges": c["merges"],
                "retrabalhos": c["retrabalhos"],
                "conflitos": c["conflitos"],
            }
        )

    total_issues = len(by_issue)
    taxa_conflito_pct = round((issues_com_conflito / total_issues) * 100.0, 2) if total_issues > 0 else 0.0
    fpy_real_pct = round((cards_aceitos_primeira / issues_feito) * 100.0, 2) if issues_feito > 0 else None
    taxa_retrabalho_pct = round((cards_com_retrabalho / issues_feito) * 100.0, 2) if issues_feito > 0 else 0.0

    fluxo = {
        "vazao_total_feito": issues_feito,
        "vazao_7d": issues_feito_7d,
        "vazao_30d": issues_feito_30d,
        "fila_revisao_atual": 0,  # preenchido pelo placar mais recente
        "revisao_espera_p50_min": percentile(review_waits_min, 50),
        "revisao_espera_p90_min": percentile(review_waits_min, 90),
        "lead_time_p50_min": percentile(lead_times_min, 50),
        "lead_time_p90_min": percentile(lead_times_min, 90),
        "taxa_conflito_pct": taxa_conflito_pct,
        "serie_diaria_14d": serie_14d,
    }

    qualidade = {
        "fpy_real_pct": fpy_real_pct,
        "cards_aceitos_primeira": cards_aceitos_primeira,
        "cards_com_retrabalho": cards_com_retrabalho,
        "taxa_retrabalho_pct": taxa_retrabalho_pct,
        "total_loops_revisao_execucao": total_loops_rev_exec,
        "total_conflitos_integracao": total_conflitos,
    }

    return fluxo, qualidade, len(events)


def analyze_economy(
    metricas_path: Path,
    nm_usage_path: Path,
    cards_integrados_30d: int,
    now_utc: datetime,
    daily_token_cap: int,
) -> Tuple[Dict[str, Any], int]:
    metricas = safe_load_json(metricas_path) or {}
    nm_usage = safe_load_json(nm_usage_path) or {}

    gov = metricas.get("governanca_orcamento") if isinstance(metricas, dict) else {}
    if isinstance(gov, dict) and isinstance(gov.get("orcamento_diario_tokens"), (int, float)):
        cap = int(gov["orcamento_diario_tokens"])
        if cap > 0:
            daily_token_cap = cap

    items: List[Dict[str, Any]] = []
    if isinstance(nm_usage, dict):
        data_block = nm_usage.get("data")
        if isinstance(data_block, dict) and isinstance(data_block.get("items"), list):
            items = [it for it in data_block["items"] if isinstance(it, dict)]
        elif isinstance(nm_usage.get("items"), list):
            items = [it for it in nm_usage["items"] if isinstance(it, dict)]

    today_str = now_utc.strftime("%Y-%m-%d")
    cutoff_7d = now_utc - timedelta(days=7)
    cutoff_30d = now_utc - timedelta(days=30)

    tokens_hoje = 0
    tokens_7d = 0
    tokens_30d = 0
    total_cost_usd = 0.0
    total_input_tokens = 0
    total_cache_read_tokens = 0

    by_model: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for it in items:
        in_tok = int(it.get("input_tokens") or 0)
        out_tok = int(it.get("output_tokens") or 0)
        cache_read = int(it.get("cache_read_tokens") or 0)
        cache_create = int(it.get("cache_creation_tokens") or 0)
        tok_sum = in_tok + out_tok + cache_read + cache_create
        cost = float(it.get("actual_cost") if it.get("actual_cost") is not None else (it.get("total_cost") or 0.0))
        dur_ms = float(it.get("duration_ms") or 0.0)

        total_cost_usd += cost
        total_input_tokens += in_tok
        total_cache_read_tokens += cache_read

        dt = parse_timestamp(it.get("created_at"))
        if dt is not None:
            if dt.strftime("%Y-%m-%d") == today_str:
                tokens_hoje += tok_sum
            if dt >= cutoff_7d:
                tokens_7d += tok_sum
            if dt >= cutoff_30d:
                tokens_30d += tok_sum

        model_name = str(it.get("model") or it.get("upstream_model") or "desconhecido")
        grp_obj = it.get("group")
        group_name = str(grp_obj.get("name") if isinstance(grp_obj, dict) else (it.get("group_id") or "default"))
        key = (model_name, group_name)
        if key not in by_model:
            by_model[key] = {
                "modelo": model_name,
                "grupo": group_name,
                "requisicoes": 0,
                "custo_usd": 0.0,
                "tokens_totais": 0,
                "input_tokens": 0,
                "cache_read_tokens": 0,
                "duration_ms_sum": 0.0,
            }
        rec = by_model[key]
        rec["requisicoes"] += 1
        rec["custo_usd"] += cost
        rec["tokens_totais"] += tok_sum
        rec["input_tokens"] += in_tok
        rec["cache_read_tokens"] += cache_read
        rec["duration_ms_sum"] += dur_ms

    # Também checa se metricas_turnos.json traz por_dia para o dia corrente
    if isinstance(metricas, dict):
        por_dia = metricas.get("por_dia") or metricas.get("dias")
        if isinstance(por_dia, dict) and today_str in por_dia:
            day_entry = por_dia[today_str]
            if isinstance(day_entry, dict):
                mt_today = int(day_entry.get("tokens_totais") or day_entry.get("tokens") or 0)
                if mt_today > tokens_hoje:
                    tokens_hoje = mt_today

    uso_teto_pct = round((tokens_hoje / daily_token_cap) * 100.0, 2) if daily_token_cap > 0 else 0.0
    if uso_teto_pct >= 100.0:
        status_orcamento = "BLOQUEADO_100"
    elif uso_teto_pct >= 80.0:
        status_orcamento = "ALERTA_80"
    else:
        status_orcamento = "OK"

    # Tokens por card integrado e CPI real (corrigindo o bug de cards_integrados == 0)
    tokens_por_card: Optional[int] = None
    cpi_real: Optional[float] = None
    if cards_integrados_30d > 0 and tokens_30d > 0:
        tokens_por_card = round(tokens_30d / cards_integrados_30d)
        cpi_real = round(PLANNED_TOKENS_PER_CARD / tokens_por_card, 3)

    cache_denom = total_input_tokens + total_cache_read_tokens
    cache_hit_ratio_pct = round((total_cache_read_tokens / cache_denom) * 100.0, 2) if cache_denom > 0 else 0.0

    por_modelo_list: List[Dict[str, Any]] = []
    for rec in by_model.values():
        m_denom = rec["input_tokens"] + rec["cache_read_tokens"]
        por_modelo_list.append(
            {
                "modelo": rec["modelo"],
                "grupo": rec["grupo"],
                "requisicoes": rec["requisicoes"],
                "custo_usd": round(rec["custo_usd"], 4),
                "tokens_totais": rec["tokens_totais"],
                "cache_hit_pct": round((rec["cache_read_tokens"] / m_denom) * 100.0, 2) if m_denom > 0 else 0.0,
                "latencia_media_ms": round(rec["duration_ms_sum"] / rec["requisicoes"], 1) if rec["requisicoes"] > 0 else 0.0,
            }
        )
    por_modelo_list.sort(key=lambda r: r["custo_usd"], reverse=True)

    # Registra diagnóstico explícito do bug histórico em metricas_turnos.json
    tokens_historico_bruto = 0
    if isinstance(metricas, dict):
        tokens_historico_bruto = int(
            metricas.get("tokens_totais")
            or (gov.get("tokens_consumidos") if isinstance(gov, dict) else 0)
            or 0
        )

    economia = {
        "teto_diario_tokens": daily_token_cap,
        "tokens_hoje": tokens_hoje,
        "tokens_7d": tokens_7d,
        "tokens_30d": tokens_30d,
        "tokens_historico_acumulado": tokens_historico_bruto,
        "uso_teto_diario_pct": uso_teto_pct,
        "status_orcamento": status_orcamento,
        "cards_integrados_30d": cards_integrados_30d,
        "tokens_por_card_integrado": tokens_por_card,
        "cpi_real": cpi_real,
        "custo_usd_total_amostra": round(total_cost_usd, 4),
        "cache_hit_ratio_pct": cache_hit_ratio_pct,
        "por_modelo": por_modelo_list[:15],
    }

    return economia, len(items)


def analyze_hygiene(
    placar_path: Optional[Path], sentinela_path: Path
) -> Tuple[Dict[str, Any], int, int]:
    placar = safe_load_json(placar_path) if placar_path else None
    sentinela = safe_load_json(sentinela_path) or {}

    fila_revisao = 0
    wip_total_ativo = 0
    wip_atribuido = 0
    orphan_count = 0
    top_orfaos: List[Dict[str, Any]] = []

    if isinstance(placar, dict):
        cards_por_estado = placar.get("cards_por_estado")
        if isinstance(cards_por_estado, dict):
            fila_revisao = int(cards_por_estado.get("revisao") or 0)

        detalhes = placar.get("cards_ativos_detalhes")
        if isinstance(detalhes, list):
            for c in detalhes:
                if not isinstance(c, dict):
                    continue
                estado = str(c.get("estado") or "").strip().lower()
                if estado == "feito":
                    continue
                wip_total_ativo += 1
                bola = str(c.get("bola") or "").strip().lower()
                resp = str(c.get("responsavel") or c.get("executor") or "").strip().lower()
                is_orphan = (bola in ("", "nenhum", "none", "null")) and (
                    resp in ("", "nenhum", "none", "null")
                )
                if is_orphan:
                    orphan_count += 1
                    if len(top_orfaos) < 10:
                        top_orfaos.append(
                            {
                                "issue_id": str(c.get("issue_id") or c.get("id") or "")[:12],
                                "titulo": str(c.get("titulo") or c.get("title") or "Sem título")[:90],
                                "estado": estado or "desconhecido",
                            }
                        )
                else:
                    wip_atribuido += 1

    orphan_pct = round((orphan_count / wip_total_ativo) * 100.0, 2) if wip_total_ativo > 0 else 0.0

    estagnados_n3 = 0
    estagnados_n2 = 0
    stagnated_list: List[Dict[str, Any]] = []
    sentinela_count = 0

    if isinstance(sentinela, dict):
        sentinela_count = len(sentinela)
        for chave, entry in sentinela.items():
            if not isinstance(entry, dict):
                continue
            nivel = int(entry.get("nivel_notificado") or 0)
            ciclos = int(entry.get("ciclos") or 0)
            if nivel >= 3:
                estagnados_n3 += 1
            elif nivel == 2:
                estagnados_n2 += 1
            if nivel >= 2 and ciclos > 0:
                stagnated_list.append(
                    {
                        "chave": str(chave),
                        "ciclos": ciclos,
                        "nivel": nivel,
                    }
                )

    stagnated_list.sort(key=lambda x: (x["nivel"], x["ciclos"]), reverse=True)

    higiene = {
        "wip_total_ativo": wip_total_ativo,
        "wip_atribuido": wip_atribuido,
        "orphan_wip_count": orphan_count,
        "orphan_wip_pct": orphan_pct,
        "top_orfaos": top_orfaos,
        "estagnados_nivel_3": estagnados_n3,
        "estagnados_nivel_2": estagnados_n2,
        "top_estagnados": stagnated_list[:8],
    }

    return higiene, fila_revisao, sentinela_count


def build_alerts(
    fluxo: Dict[str, Any],
    qualidade: Dict[str, Any],
    economia: Dict[str, Any],
    higiene: Dict[str, Any],
) -> List[Dict[str, str]]:
    alerts: List[Dict[str, str]] = []

    if economia["status_orcamento"] == "BLOQUEADO_100":
        alerts.append(
            {
                "codigo": "BUDGET_HARD_CAP_100",
                "severidade": "critical",
                "mensagem": f"Teto diário de tokens atingido ({economia['uso_teto_diario_pct']}%).",
                "acao_sugerida": "Novos dispatches bloqueados até amanhã ou boardOverride manual.",
            }
        )
    elif economia["status_orcamento"] == "ALERTA_80":
        alerts.append(
            {
                "codigo": "BUDGET_SOFT_CAP_80",
                "severidade": "warn",
                "mensagem": f"Consumo diário em {economia['uso_teto_diario_pct']}% do teto.",
                "acao_sugerida": "Priorizar modelos Tier 1 econômicos e revisar loops abertos.",
            }
        )

    p90_rev = fluxo.get("revisao_espera_p90_min")
    fila_rev = fluxo.get("fila_revisao_atual", 0)
    if fila_rev >= 10 or (fila_rev > 0 and p90_rev is not None and p90_rev > 60.0):
        alerts.append(
            {
                "codigo": "REVIEW_QUEUE_BOTTLENECK",
                "severidade": "warn",
                "mensagem": f"Gargalo em revisão: {fila_rev} cards na fila (P90 espera: {p90_rev if p90_rev is not None else '--'} min).",
                "acao_sugerida": "Acionar revisor via ctx.agents.wake e segurar novos dispatches.",
            }
        )

    if higiene["orphan_wip_pct"] >= 25.0 and higiene["orphan_wip_count"] > 0:
        alerts.append(
            {
                "codigo": "ORPHAN_WIP_HIGH",
                "severidade": "warn",
                "mensagem": f"{higiene['orphan_wip_count']} cards ativos sem responsável ({higiene['orphan_wip_pct']}% do WIP).",
                "acao_sugerida": "Reatribuir ou arquivar cards órfãos para restaurar métricas de execução.",
            }
        )

    if higiene["estagnados_nivel_3"] > 0:
        alerts.append(
            {
                "codigo": "STAGNATION_LEVEL_3",
                "severidade": "warn",
                "mensagem": f"{higiene['estagnados_nivel_3']} entradas no sentinela em nível 3 de estagnação.",
                "acao_sugerida": "Inspecionar top worktrees estagnados e liberar locks travados.",
            }
        )

    if qualidade["taxa_retrabalho_pct"] >= 20.0:
        alerts.append(
            {
                "codigo": "REWORK_RATE_ELEVATED",
                "severidade": "warn",
                "mensagem": f"Taxa de retrabalho em {qualidade['taxa_retrabalho_pct']}% ({qualidade['cards_com_retrabalho']} cards).",
                "acao_sugerida": "Compilar nova regra probatória L-90 para os motivos recorrentes de recusa.",
            }
        )

    return alerts


def generate_kpis(
    scratch_dir: Path = DEFAULT_SCRATCH_DIR,
    daily_token_cap: int = DEFAULT_DAILY_TOKEN_CAP,
    now_utc: Optional[datetime] = None,
) -> Dict[str, Any]:
    now = now_utc or datetime.now(timezone.utc)

    transicoes_path = scratch_dir / "esteira-transicoes.jsonl"
    metricas_path = scratch_dir / "metricas_turnos.json"
    nm_usage_path = scratch_dir / "nm_usage.json"
    sentinela_path = scratch_dir / "sentinela-esteira-state.json"
    placar_path = find_latest_placar(scratch_dir)

    fluxo, qualidade, transicoes_linhas = analyze_transitions(transicoes_path, now)
    economia, nm_usage_itens = analyze_economy(
        metricas_path=metricas_path,
        nm_usage_path=nm_usage_path,
        cards_integrados_30d=fluxo["vazao_30d"],
        now_utc=now,
        daily_token_cap=daily_token_cap,
    )
    higiene, fila_revisao, sentinela_entradas = analyze_hygiene(placar_path, sentinela_path)
    fluxo["fila_revisao_atual"] = fila_revisao

    alertas = build_alerts(fluxo, qualidade, economia, higiene)

    return {
        "schema_version": "1.0.0",
        "gerado_em": now.isoformat(),
        "janela_dias": 30,
        "fontes": {
            "scratch_dir": str(scratch_dir),
            "transicoes_linhas": transicoes_linhas,
            "nm_usage_itens": nm_usage_itens,
            "placar_arquivo": placar_path.name if placar_path else None,
            "sentinela_entradas": sentinela_entradas,
        },
        "fluxo": fluxo,
        "qualidade": qualidade,
        "economia": economia,
        "higiene": higiene,
        "alertas_ativos": alertas,
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Gera snapshot determinístico kpis-esteira.json a partir da telemetria local do OrgFy."
    )
    parser.add_argument(
        "--scratch-dir",
        type=Path,
        default=DEFAULT_SCRATCH_DIR,
        help="Diretório contendo os arquivos .scratch (padrão: ~/.buzz/.scratch)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Caminho do JSON de saída (padrão: ~/.buzz/.scratch/kpis-esteira.json)",
    )
    parser.add_argument(
        "--daily-cap",
        type=int,
        default=DEFAULT_DAILY_TOKEN_CAP,
        help="Teto diário de tokens (padrão: 2000000)",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Imprime o JSON gerado no stdout além de salvar no arquivo.",
    )
    args = parser.parse_args(argv)

    payload = generate_kpis(scratch_dir=args.scratch_dir, daily_token_cap=args.daily_cap)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = args.output.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    os.replace(tmp_path, args.output)

    if args.stdout:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(
            json.dumps(
                {
                    "ok": True,
                    "output": str(args.output),
                    "vazao_total_feito": payload["fluxo"]["vazao_total_feito"],
                    "fpy_real_pct": payload["qualidade"]["fpy_real_pct"],
                    "status_orcamento": payload["economia"]["status_orcamento"],
                    "orphan_wip_count": payload["higiene"]["orphan_wip_count"],
                    "alertas": len(payload["alertas_ativos"]),
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
