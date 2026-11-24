#!/usr/bin/env python3
"""Radar de Loops & Sessões Zumbis (Goose Live) — leitura somente-leitura (mode=ro).
Retorna JSON estruturado com sessões ativas/recentes (últimas 3h), separando
alertas ATIVOS (últimos 15 min) de HISTÓRICOS (15m–3h), com detecção de:
- LOOP_SUSPEITO (>= 20 chamadas shell ou duração >= 30 min com >= 10 shells)
- SESSAO_LONGA (duração >= 15 min e >= 6 shells)
- STALLED_THINKING (última mensagem da sessão terminou apenas em bloco thinking)
- SESSAO_DUPLICADA (mesmo agente com >= 2 sessões ativas nos últimos 45 min)
- EXPLORACAO_CLI_HELP (>= 3 chamadas shell com --help ou -h)
"""
from __future__ import annotations

import json
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ACTIVE_WINDOW_MIN = 15.0


def _resolve_goose_db() -> Path:
    candidates = [
        Path.home() / ".local" / "share" / "goose" / "sessions" / "sessions.db",
        Path(__file__).resolve().parents[3] / ".local" / "share" / "goose" / "sessions" / "sessions.db",
        Path("/Users/heltonfraga/.local/share/goose/sessions/sessions.db"),
    ]
    for cand in candidates:
        if cand.exists():
            return cand
    return candidates[0]


GOOSE_DB = _resolve_goose_db()
RADAR_SNAPSHOT_PATH = Path("/Users/heltonfraga/.buzz/.scratch/goose-loop-radar.json")


def parse_utc(ts_str: str | None) -> datetime | None:
    if not ts_str:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return datetime.strptime(ts_str[:19], fmt[:19]).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def sugerir_acao(flags: list[str], ativa: bool) -> str:
    if not flags:
        return ""
    if not ativa:
        return "Sessão já encerrada (>15m sem atividade); usar apenas como insumo de RSI."
    if "SESSAO_DUPLICADA" in flags:
        return "Não re-mencionar nem cobrar este agente; aguardar o turno atual concluir para evitar corrida."
    if "STALLED_THINKING" in flags:
        return "Sessão parada em thinking; se >15m sem resposta, liberar lock via orgfy_checkout_lock(release) e reatribuir."
    if "LOOP_SUSPEITO" in flags:
        return "Ler ultimo_shell e enviar 1 instrução cirúrgica destravando o comando atual (nunca cobrança genérica) ou liberar lock."
    if "EXPLORACAO_CLI_HELP" in flags:
        return "Agente gastando turnos em --help; fornecer sintaxe exata do comando e registrar no addInstructions."
    if "SESSAO_LONGA" in flags:
        return "Monitorar avanço antes de cobrar; evitar novas menções redundantes."
    return ""


def _empty_resumo() -> dict:
    return {
        "total_recentes": 0,
        "ativas_total": 0,
        "criticos": 0,
        "criticos_ativos": 0,
        "criticos_historico_3h": 0,
        "avisos": 0,
        "avisos_ativos": 0,
        "duplicadas": 0,
        "duplicadas_ativas": 0,
    }


def main() -> int:
    now = datetime.now(timezone.utc)
    if not GOOSE_DB.exists():
        print(json.dumps({
            "ok": False,
            "error": f"Banco Goose não encontrado: {GOOSE_DB}",
            "gerado_em": now.isoformat(),
            "resumo": _empty_resumo(),
            "sessoes": [],
        }, ensure_ascii=False))
        return 0

    try:
        conn = sqlite3.connect(f"file:{GOOSE_DB}?mode=ro", uri=True, timeout=5)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, created_at, updated_at
            FROM sessions
            WHERE updated_at >= datetime('now', '-3 hours')
            ORDER BY updated_at DESC
            LIMIT 40
            """
        )
        rows = cur.fetchall()

        # Conta sessões por agente atualizadas nos últimos 45 min para detectar concorrência duplicada
        recent_agent_counts: Counter[str] = Counter()
        parsed_rows = []
        for sid, name, created_at, updated_at in rows:
            ag = (name or "Desconhecido").split("·")[0].strip()
            dt_upd = parse_utc(updated_at)
            dt_cre = parse_utc(created_at)
            age_since_update_min = round((now - dt_upd).total_seconds() / 60.0, 1) if dt_upd else 999.0
            duration_min = round(max(0.0, (dt_upd - dt_cre).total_seconds() / 60.0), 1) if (dt_upd and dt_cre) else 0.0
            if age_since_update_min <= 45.0:
                recent_agent_counts[ag] += 1
            parsed_rows.append((sid, name or sid, ag, duration_min, age_since_update_min, updated_at))

        sessoes = []
        ativas_total = 0
        criticos = 0
        criticos_ativos = 0
        criticos_historico_3h = 0
        avisos = 0
        avisos_ativos = 0
        duplicadas = 0
        duplicadas_ativas = 0

        for sid, name, ag, duration_min, age_upd_min, updated_at in parsed_rows:
            ativa = age_upd_min <= ACTIVE_WINDOW_MIN
            if ativa:
                ativas_total += 1

            cur.execute(
                "SELECT role, content_json FROM messages WHERE session_id=? ORDER BY id ASC",
                (sid,),
            )
            msgs = cur.fetchall()
            shell_count = 0
            help_count = 0
            last_shell = ""
            last_only_thinking = False

            for role, cj in msgs:
                try:
                    items = json.loads(cj)
                except Exception:
                    continue
                types = [it.get("type") for it in items if isinstance(it, dict)]
                last_only_thinking = (role == "assistant" and types == ["thinking"])
                for it in items:
                    if isinstance(it, dict) and it.get("type") == "toolRequest":
                        tc = (it.get("toolCall") or {}).get("value") or {}
                        if tc.get("name") == "shell":
                            shell_count += 1
                            cmd = str((tc.get("arguments") or {}).get("command") or "").strip().replace("\n", " ")
                            if "--help" in cmd or " -h" in cmd:
                                help_count += 1
                            if cmd:
                                last_shell = cmd[:140]

            flags: list[str] = []
            severidade = "ok"
            if shell_count >= 20 or (duration_min >= 30.0 and shell_count >= 10):
                flags.append("LOOP_SUSPEITO")
                severidade = "critical"
            elif duration_min >= 15.0 and shell_count >= 6:
                flags.append("SESSAO_LONGA")
                severidade = "warn"

            if last_only_thinking and age_upd_min <= 60.0:
                flags.append("STALLED_THINKING")
                severidade = "critical"

            if recent_agent_counts[ag] >= 2 and age_upd_min <= 45.0:
                flags.append("SESSAO_DUPLICADA")
                duplicadas += 1
                if ativa:
                    duplicadas_ativas += 1
                if severidade == "ok":
                    severidade = "warn"

            if help_count >= 3:
                flags.append("EXPLORACAO_CLI_HELP")
                if severidade == "ok":
                    severidade = "warn"

            if severidade == "critical":
                criticos += 1
                if ativa:
                    criticos_ativos += 1
                else:
                    criticos_historico_3h += 1
            elif severidade == "warn":
                avisos += 1
                if ativa:
                    avisos_ativos += 1

            # Exibe todas as sessões ativas + sessões com alerta
            if ativa or flags or len(sessoes) < 8:
                sessoes.append({
                    "session_id": sid,
                    "agente": ag,
                    "nome": name,
                    "ativa": ativa,
                    "duracao_min": duration_min,
                    "ultima_atualizacao_min": age_upd_min,
                    "msgs": len(msgs),
                    "shells": shell_count,
                    "help_calls": help_count,
                    "severidade": severidade,
                    "flags": flags,
                    "ultimo_shell": last_shell,
                    "acao_sugerida": sugerir_acao(flags, ativa),
                })

        conn.close()
        # Ordena: sessões ATIVAS primeiro, depois severidade (critical > warn > ok), depois mais shells
        ordem = {"critical": 0, "warn": 1, "ok": 2}
        sessoes.sort(
            key=lambda s: (
                0 if s["ativa"] else 1,
                ordem.get(s["severidade"], 3),
                -s["shells"],
                -s["duracao_min"],
            )
        )

        payload = {
            "ok": True,
            "error": None,
            "gerado_em": now.isoformat(),
            "resumo": {
                "total_recentes": len(rows),
                "ativas_total": ativas_total,
                "criticos": criticos,
                "criticos_ativos": criticos_ativos,
                "criticos_historico_3h": criticos_historico_3h,
                "avisos": avisos,
                "avisos_ativos": avisos_ativos,
                "duplicadas": duplicadas,
                "duplicadas_ativas": duplicadas_ativas,
            },
            "sessoes": sessoes[:16],
        }
        serialized = json.dumps(payload, ensure_ascii=False, indent=2)
        try:
            RADAR_SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            RADAR_SNAPSHOT_PATH.write_text(serialized + "\n", encoding="utf-8")
        except Exception:
            pass
        print(serialized)
        return 0
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "error": str(exc),
            "gerado_em": now.isoformat(),
            "resumo": _empty_resumo(),
            "sessoes": [],
        }, ensure_ascii=False))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
