#!/usr/bin/env python3
"""Radar de Loops & Sessões Zumbis (Goose Live) — leitura somente-leitura (mode=ro).
Analisa APENAS o turno atual (desde o último <turn-context>/<mention>) para evitar
falsos positivos de sessões longas multi-turno e paralelismo legítimo entre threads.

Detecção calibrada (zero falso positivo em trabalho produtivo):
- COMANDO_REPETIDO (critical): mesmo comando shell normalizado repetido >= 3x nos últimos 12 shells do turno atual (ou unicidade < 50% com >= 8 shells no turno)
- ERRO_REPETIDO (critical): >= 3 erros consecutivos no final do turno atual
- STALLED_THINKING (critical): última mensagem do turno terminou só em thinking e ficou parada entre 10m e 60m
- SESSAO_DUPLICADA (warn): mesmo agente com >= 2 sessões ativas na MESMA thread_root ou MESMO worktree (threads diferentes = paralelismo planejado)
- EXPLORACAO_CLI_HELP (warn): >= 5 chamadas shell com --help ou -h no turno atual
- TURNO_LONGO (warn): turno atual >= 30 min e >= 30 shells sem repetição (monitorar, não cortar trabalho produtivo)
"""
from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ACTIVE_WINDOW_MIN = 15.0
RE_CHANNEL_ID = re.compile(r"Channel:\s*[^\n]*?\(#([0-9a-fA-F-]{36})\)")
RE_THREAD_ROOT = re.compile(r"Thread root:\s*([0-9a-fA-F]{64})")
RE_AGENT_PUBKEY = re.compile(r"Agent:\s*([0-9a-fA-F]{64})")
RE_WORKTREE = re.compile(r"\.worktrees/([A-Za-z0-9._-]+)")


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


def _normalize_cmd(cmd: str) -> str:
    return re.sub(r"\s+", " ", cmd).strip()


def _is_error_response(items: list[dict]) -> bool:
    for it in items:
        if not isinstance(it, dict):
            continue
        t = it.get("type")
        if t == "error":
            return True
        if t == "toolResponse":
            tr = it.get("toolResult") or {}
            if tr.get("status") == "error":
                return True
            val = tr.get("value") or {}
            if isinstance(val, dict) and val.get("isError") is True:
                return True
    return False


def sugerir_acao(flags: list[str], ativa: bool) -> str:
    if not flags:
        return ""
    if not ativa:
        return "Sessão já encerrada (>15m sem atividade); usar apenas como insumo de RSI."
    if "COMANDO_REPETIDO" in flags or "ERRO_REPETIDO" in flags:
        return (
            "LOOP REAL DETECTADO: comando ou erro repetido sem mudança de estado. "
            "INTERROMPER via orgfy_session_stop(action='interrupt'), inspecionar ultimo_shell e liberar lock se necessário."
        )
    if "STALLED_THINKING" in flags:
        return (
            "Sessão travada em thinking (>=10m sem resposta). "
            "INTERROMPER via orgfy_session_stop(action='interrupt') e reatribuir se necessário."
        )
    if "SESSAO_DUPLICADA" in flags:
        return (
            "Colisão real na mesma thread/worktree; encerrar a sessão redundante via orgfy_session_stop(action='interrupt')."
        )
    if "EXPLORACAO_CLI_HELP" in flags:
        return (
            "Agente gastando >=5 turnos em --help; interromper via orgfy_session_stop se persistir "
            "e fornecer sintaxe exata do comando."
        )
    if "TURNO_LONGO" in flags:
        return (
            "Turno longo mas com comandos distintos (trabalho produtivo provável); "
            "checar ultimo_shell antes de decidir interromper."
        )
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

        # Passagem 1: extrai metadados e comandos do turno atual de cada sessão
        extracted = []
        thread_collision_counts: Counter[tuple[str, str]] = Counter()
        worktree_collision_counts: Counter[tuple[str, str]] = Counter()

        for sid, name, created_at, updated_at in rows:
            ag = (name or "Desconhecido").split("·")[0].strip()
            dt_upd = parse_utc(updated_at)
            dt_cre = parse_utc(created_at)
            age_upd_min = round((now - dt_upd).total_seconds() / 60.0, 1) if dt_upd else 999.0
            thread_lifetime_min = round(max(0.0, (dt_upd - dt_cre).total_seconds() / 60.0), 1) if (dt_upd and dt_cre) else 0.0
            ativa = age_upd_min <= ACTIVE_WINDOW_MIN

            cur.execute(
                "SELECT role, created_timestamp, content_json FROM messages WHERE session_id=? ORDER BY id ASC",
                (sid,),
            )
            msgs = cur.fetchall()

            channel_id = None
            thread_root = None
            agent_pubkey = None
            last_turn_idx = 0
            last_turn_ts = None

            for idx, (role, ts, cj) in enumerate(msgs):
                if role == "user":
                    raw_cj = cj or ""
                    if "<turn-context>" in raw_cj or "<mention>" in raw_cj:
                        last_turn_idx = idx
                        last_turn_ts = ts
                    if channel_id is None or thread_root is None or agent_pubkey is None:
                        try:
                            items = json.loads(raw_cj)
                        except Exception:
                            items = []
                        for it in items:
                            if not isinstance(it, dict) or it.get("type") != "text":
                                continue
                            txt = str(it.get("text") or "")
                            if channel_id is None:
                                m_ch = RE_CHANNEL_ID.search(txt)
                                if m_ch:
                                    channel_id = m_ch.group(1).lower()
                            if thread_root is None:
                                m_tr = RE_THREAD_ROOT.search(txt)
                                if m_tr:
                                    thread_root = m_tr.group(1).lower()
                            if agent_pubkey is None:
                                m_ag = RE_AGENT_PUBKEY.search(txt)
                                if m_ag:
                                    agent_pubkey = m_ag.group(1).lower()

            turn_msgs = msgs[last_turn_idx:] if msgs else []
            end_ts = msgs[-1][1] if msgs else None
            if isinstance(last_turn_ts, (int, float)) and isinstance(end_ts, (int, float)) and end_ts >= last_turn_ts:
                turno_min = round((end_ts - last_turn_ts) / 60.0, 1)
            else:
                turno_min = thread_lifetime_min

            turn_cmds: list[str] = []
            help_count = 0
            last_shell = ""
            last_worktree = None
            last_only_thinking = False
            consecutive_errors = 0

            for role, _ts, cj in turn_msgs:
                try:
                    items = json.loads(cj)
                except Exception:
                    continue
                if not isinstance(items, list):
                    continue
                types = [it.get("type") for it in items if isinstance(it, dict)]
                if role == "assistant":
                    last_only_thinking = (types == ["thinking"])
                if _is_error_response(items):
                    consecutive_errors += 1
                elif role == "assistant" or any(t == "toolResponse" for t in types):
                    consecutive_errors = 0

                for it in items:
                    if isinstance(it, dict) and it.get("type") == "toolRequest":
                        tc = (it.get("toolCall") or {}).get("value") or {}
                        if tc.get("name") == "shell":
                            cmd = _normalize_cmd(str((tc.get("arguments") or {}).get("command") or ""))
                            if cmd:
                                turn_cmds.append(cmd)
                                last_shell = cmd[:140]
                                if "--help" in cmd or " -h" in cmd:
                                    help_count += 1
                                m_wt = RE_WORKTREE.search(cmd)
                                if m_wt:
                                    last_worktree = m_wt.group(1)

            if ativa:
                if thread_root:
                    thread_collision_counts[(ag, thread_root)] += 1
                if last_worktree:
                    worktree_collision_counts[(ag, last_worktree)] += 1

            extracted.append({
                "sid": sid,
                "name": name or sid,
                "ag": ag,
                "ativa": ativa,
                "channel_id": channel_id,
                "thread_root": thread_root,
                "agent_pubkey": agent_pubkey,
                "last_worktree": last_worktree,
                "turno_min": turno_min,
                "thread_lifetime_min": thread_lifetime_min,
                "age_upd_min": age_upd_min,
                "total_msgs": len(msgs),
                "turn_cmds": turn_cmds,
                "help_count": help_count,
                "last_shell": last_shell,
                "last_only_thinking": last_only_thinking,
                "consecutive_errors": consecutive_errors,
            })

        conn.close()

        # Passagem 2: aplica heurística calibrada (zero falso positivo em trabalho produtivo)
        sessoes = []
        ativas_total = 0
        criticos = 0
        criticos_ativos = 0
        criticos_historico_3h = 0
        avisos = 0
        avisos_ativos = 0
        duplicadas = 0
        duplicadas_ativas = 0

        for item in extracted:
            ativa = item["ativa"]
            if ativa:
                ativas_total += 1

            turn_cmds = item["turn_cmds"]
            shell_count = len(turn_cmds)
            recent_cmds = turn_cmds[-12:]
            rep_recent_max = Counter(recent_cmds).most_common(1)[0][1] if recent_cmds else 0
            uniq_ratio = round(len(set(turn_cmds)) / shell_count, 2) if shell_count > 0 else 1.0

            flags: list[str] = []
            severidade = "ok"

            # 1. Loop real por repetição de comando ou baixa unicidade no turno atual
            if rep_recent_max >= 3 or (shell_count >= 8 and uniq_ratio < 0.50):
                flags.append("COMANDO_REPETIDO")
                severidade = "critical"

            # 2. Loop real por erros consecutivos no final do turno
            if item["consecutive_errors"] >= 3:
                flags.append("ERRO_REPETIDO")
                severidade = "critical"

            # 3. Travado apenas em thinking por >= 10 min (e <= 60 min)
            if item["last_only_thinking"] and 10.0 <= item["age_upd_min"] <= 60.0:
                flags.append("STALLED_THINKING")
                severidade = "critical"

            # 4. Colisão real: mesmo agente na MESMA thread_root ou MESMO worktree (não threads distintas!)
            same_thread_dup = bool(item["thread_root"] and thread_collision_counts[(item["ag"], item["thread_root"])] >= 2)
            same_wt_dup = bool(item["last_worktree"] and worktree_collision_counts[(item["ag"], item["last_worktree"])] >= 2)
            if ativa and (same_thread_dup or same_wt_dup):
                flags.append("SESSAO_DUPLICADA")
                duplicadas += 1
                duplicadas_ativas += 1
                if severidade == "ok":
                    severidade = "warn"

            # 5. Exploração excessiva de --help no turno atual (>= 5)
            if item["help_count"] >= 5:
                flags.append("EXPLORACAO_CLI_HELP")
                if severidade == "ok":
                    severidade = "warn"

            # 6. Turno longo sem repetição (aviso informativo, não crítico)
            if severidade == "ok" and item["turno_min"] >= 30.0 and shell_count >= 30:
                flags.append("TURNO_LONGO")
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

            if ativa or flags or len(sessoes) < 8:
                sessoes.append({
                    "session_id": item["sid"],
                    "agente": item["ag"],
                    "nome": item["name"],
                    "ativa": ativa,
                    "channel_id": item["channel_id"],
                    "thread_root": item["thread_root"],
                    "agent_pubkey": item["agent_pubkey"],
                    "worktree": item["last_worktree"],
                    "duracao_min": item["turno_min"],
                    "thread_lifetime_min": item["thread_lifetime_min"],
                    "ultima_atualizacao_min": item["age_upd_min"],
                    "msgs": item["total_msgs"],
                    "shells": shell_count,
                    "comandos_unicos_pct": round(uniq_ratio * 100),
                    "max_repeticao_recente": rep_recent_max,
                    "erros_consecutivos": item["consecutive_errors"],
                    "help_calls": item["help_count"],
                    "severidade": severidade,
                    "flags": flags,
                    "ultimo_shell": item["last_shell"],
                    "acao_sugerida": sugerir_acao(flags, ativa),
                })

        ordem = {"critical": 0, "warn": 1, "ok": 2}
        sessoes.sort(
            key=lambda s: (
                0 if s["ativa"] else 1,
                ordem.get(s["severidade"], 3),
                -s["max_repeticao_recente"],
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
