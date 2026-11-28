#!/usr/bin/env python3
"""Radar Forense de Loops & Sessões Zumbis (Goose Live) — leitura somente-leitura (mode=ro).

Heurística forense calibrada com evidências reais do sessions.db:
1. Ancora o turno atual no último <mention> real (NUNCA reseta em <turn-context> de compactação/retry).
2. Extrai gatilho_resumo + IDs/branches/SHAs do <buzz-event> e cruza com `git log main` e
   `resolved-issues-archive.json` para detectar `ITEM_JA_FECHADO` (trabalho em card/PR já integrado ou fechado).
3. Detecta sinais concretos de burnout/zumbi:
   - ITEM_JA_FECHADO (critical): sessão ativa trabalhando em issue/PR/branch já merged na main ou resolvida
   - CONTEXTO_COMPACTADO (critical): sessão ativa que já estourou a janela e sofreu compactação (>= 1)
   - TURNO_EXCESSIVO (critical): turno contínuo >= 35 min OU >= 35 shells desde o último <mention>
   - COLISAO_WORKTREE (critical): mesmo agente em >= 2 sessões ativas operando na mesma .worktrees/<card>
   - COMANDO_REPETIDO (critical): mesmo comando normalizado >= 3x nos últimos 12 shells ou unicidade < 50% (>= 8 shells)
   - ERRO_REPETIDO (critical): >= 3 erros consecutivos no fim do turno
   - STALLED_THINKING (critical): travado só em thinking entre 10m e 60m
   - TEMPESTADE_5XX (critical se >= 5, warn se >= 3): loop de retentativas HTTP 502/503
   - SESSAO_DUPLICADA (warn): mesmo agente com >= 2 sessões ativas na MESMA thread_root
   - EXPLORACAO_CLI_HELP (warn): >= 5 chamadas --help/-h no turno atual
"""
from __future__ import annotations

import json
import re
import sqlite3
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ACTIVE_WINDOW_MIN = 15.0
ORGFY_REPO = Path("/Users/heltonfraga/.buzz/REPOS/orgfy")
RESOLVED_ARCHIVE_PATH = Path("/Users/heltonfraga/.buzz/.scratch/resolved-issues-archive.json")
RADAR_SNAPSHOT_PATH = Path("/Users/heltonfraga/.buzz/.scratch/goose-loop-radar.json")

RE_CHANNEL_ID = re.compile(r"Channel:\s*[^\n]*?\(#([0-9a-fA-F-]{36})\)")
RE_THREAD_ROOT = re.compile(r"Thread root:\s*([0-9a-fA-F]{64})")
RE_AGENT_PUBKEY = re.compile(r"Agent:\s*([0-9a-fA-F]{64})")
RE_WORKTREE = re.compile(r"\.worktrees/([A-Za-z0-9._-]+)")
RE_HEX8 = re.compile(r"\b([0-9a-f]{7,64})\b", re.I)
RE_BRANCH = re.compile(r"\b(?:feat|fix|card)/([a-z0-9._-]+)\b", re.I)

IGNORED_WORKTREES = {"_porteiro", "_runner_esteira", "card"}
KNOWN_CLOSED_DUPLICATES = {
    "de398431": "Issue de398431 / PR 95546476 já fechado como duplicado",
    "95546476": "PR 95546476 (de398431) já fechado como duplicado",
}


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


def _load_closed_index() -> tuple[dict[str, str], dict[str, str]]:
    """Retorna (closed_hex_map, closed_slug_map) a partir de git log main + resolved-issues-archive.json."""
    closed_hex: dict[str, str] = dict(KNOWN_CLOSED_DUPLICATES)
    closed_slugs: dict[str, str] = {}

    if RESOLVED_ARCHIVE_PATH.exists():
        try:
            arch = json.loads(RESOLVED_ARCHIVE_PATH.read_text(encoding="utf-8"))
            for it in arch.get("itens", []):
                title = str(it.get("title") or it.get("codigo") or "issue resolvida")[:70]
                for k in ("issueId", "fullIssueId", "prId", "commitSha"):
                    v = str(it.get(k) or "").strip().lower()
                    if len(v) >= 7 and re.fullmatch(r"[0-9a-f]+", v):
                        closed_hex[v[:8]] = f"Já resolvida no arquivo ({title})"
                        closed_hex[v[:7]] = f"Já resolvida no arquivo ({title})"
        except Exception:
            pass

    if ORGFY_REPO.exists():
        try:
            out = subprocess.check_output(
                ["git", "-C", str(ORGFY_REPO), "log", "main", "-n", "120", "--format=%H %s"],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=4,
            )
            for line in out.splitlines():
                if not line.strip():
                    continue
                parts = line.split(" ", 1)
                sha = parts[0].strip().lower()
                subj = parts[1].strip() if len(parts) > 1 else ""
                subj_l = subj.lower()
                if len(sha) >= 7:
                    closed_hex[sha[:7]] = f"Commit {sha[:7]} já na main ({subj[:60]})"
                    closed_hex[sha[:8]] = f"Commit {sha[:7]} já na main ({subj[:60]})"
                for m in RE_HEX8.findall(subj_l):
                    if len(m) >= 8:
                        closed_hex[m[:8]] = f"Referência {m[:8]} já integrada na main ({subj[:60]})"
                for m_p in re.findall(r"\b(p[012]-\d+)\b", subj_l):
                    closed_slugs[m_p] = f"Marco {m_p} já integrado na main ({sha[:7]}: {subj[:55]})"
                if "telemetria" in subj_l or "tokens faturaveis" in subj_l:
                    closed_slugs["p0-4-telemetria-tokens"] = f"Já integrado na main ({sha[:7]}: {subj[:55]})"
                if "circuit breaker" in subj_l or "p0-2" in subj_l:
                    closed_slugs["p0-2-circuit-breaker-reset"] = f"Já integrado na main ({sha[:7]}: {subj[:55]})"
        except Exception:
            pass

    return closed_hex, closed_slugs


def _extract_event_content(raw_cj: str) -> str:
    if "<buzz-event>" not in raw_cj:
        return ""
    mc = re.search(r'\\"content\\":\\"(.*?)\\",\\"', raw_cj)
    if mc:
        return mc.group(1).replace("\\n", " ").replace('\\"', '"').strip()
    m = re.search(r"<buzz-event>\\n(.*?)\\n</buzz-event>", raw_cj)
    if m:
        try:
            ev = json.loads(m.group(1).replace('\\"', '"'))
            return str(ev.get("content") or "").replace("\n", " ").strip()
        except Exception:
            pass
    return ""


def sugerir_acao(flags: list[str], ativa: bool, closed_ev: str | None = None, compactions: int = 0) -> str:
    if not flags:
        return ""
    if not ativa:
        return "Sessão já encerrada (>15m sem atividade); usar apenas como insumo de RSI."
    if "ITEM_JA_FECHADO" in flags:
        return (
            f"PARAR AGORA via orgfy_session_stop(action='interrupt'): {closed_ev or 'item já fechado/merged na main'} — "
            "queimando tokens em tarefa concluída."
        )
    if "CONTEXTO_COMPACTADO" in flags:
        return (
            f"PARAR AGORA via orgfy_session_stop(action='interrupt'): sessão já compactou contexto {compactions}x "
            "(alto risco de deriva/loop); verificar entrega, parar e reabrir limpo se ainda faltar algo."
        )
    if "COMANDO_REPETIDO" in flags or "ERRO_REPETIDO" in flags:
        return (
            "PARAR AGORA via orgfy_session_stop(action='interrupt'): loop real de comando ou erro repetido sem mudança de estado."
        )
    if "STALLED_THINKING" in flags:
        return (
            "PARAR AGORA via orgfy_session_stop(action='interrupt'): travado em thinking >=10m sem resposta."
        )
    if "COLISAO_WORKTREE" in flags:
        return (
            "PARAR SESSÃO REDUNDANTE via orgfy_session_stop(action='interrupt'): mesmo agente rodando em paralelo na mesma worktree."
        )
    if "TURNO_EXCESSIVO" in flags:
        return (
            "PARAR AGORA via orgfy_session_stop(action='interrupt'): turno contínuo >=35m ou >=35 shells sem encerrar; "
            "checar gatilho e ultimo_shell antes de relançar."
        )
    if "TEMPESTADE_5XX" in flags:
        return (
            "PARAR/REINICIAR via orgfy_session_stop(action='interrupt'): tempestade de erros HTTP 502/503 desperdiçando turnos."
        )
    if "SESSAO_DUPLICADA" in flags:
        return "Colisão na mesma thread_root; encerrar a sessão redundante via orgfy_session_stop(action='interrupt')."
    if "EXPLORACAO_CLI_HELP" in flags:
        return "Agente gastando >=5 turnos em --help; parar via orgfy_session_stop e fornecer sintaxe exata."
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

    closed_hex, closed_slugs = _load_closed_index()

    try:
        conn = sqlite3.connect(f"file:{GOOSE_DB}?mode=ro", uri=True, timeout=5)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, created_at, updated_at
            FROM sessions
            WHERE updated_at >= datetime('now', '-3 hours')
            ORDER BY updated_at DESC
            LIMIT 45
            """
        )
        rows = cur.fetchall()

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
            last_mention_idx = 0
            last_mention_ts = None
            first_event_content = ""
            last_event_content = ""
            compactions = 0
            errors_5xx = 0
            recent_provider_errors = 0
            last_provider_error_ts = None
            last_provider_error_text = ""
            last_msg_is_provider_error = False
            now_epoch = now.timestamp()

            PROVIDER_ERR_MARKERS = (
                "503 service unavailable",
                "502 bad gateway",
                "504 gateway timeout",
                "no available accounts",
                "model requires available accounts",
                "service temporarily unavailable",
                "rate limit exceeded",
                "upstream rate limit",
                "too many requests",
                "http 429",
                "(429 ",
                "resource not found (404)",
                "[404]:",
                "bad request (400)",
                "no target in combo",
                "supports tool calling",
                "upstream request failed",
                "upstream_malformed_function_call",
                "overloaded_error",
                "model is overloaded",
                "network error",
                "stream decode error",
                "failed to parse streaming chunk",
                "eof while parsing",
                "connection reset",
                "broken pipe",
                "timed out",
            )

            for idx, (role, ts, cj) in enumerate(msgs):
                raw_cj = cj or ""
                if "Your context was compacted" in raw_cj:
                    compactions += 1
                # Conta erros reais de provider (ignora citações em <thread-context>/<mention> e notas buzz__mem_)
                low_cj = raw_cj.lower()
                is_context_quote = (
                    "<thread-context>" in low_cj
                    or "<mention>" in low_cj
                    or "buzz__mem_" in low_cj
                )
                has_provider_err_marker = any(mk in low_cj for mk in PROVIDER_ERR_MARKERS)
                is_real_provider_err = False
                if not is_context_quote and (has_provider_err_marker or '"type":"error"' in raw_cj or '"type": "error"' in raw_cj):
                    try:
                        cj_items = json.loads(raw_cj)
                    except Exception:
                        cj_items = []
                    if isinstance(cj_items, list):
                        for it in cj_items:
                            if not isinstance(it, dict):
                                continue
                            it_type = it.get("type")
                            if it_type == "error":
                                err_msg = str(it.get("message") or it.get("error") or "")
                                err_low = err_msg.lower()
                                if has_provider_err_marker or any(
                                    k in err_low
                                    for k in ("server error", "request failed", "provider", "upstream", "rate limit", "unavailable", "network error", "stream decode", "timed out", "connection reset", "eof while parsing", "404", "429", "502", "503", "504")
                                ):
                                    is_real_provider_err = True
                                    last_provider_error_text = err_msg[:180]
                                    break
                            if it_type == "toolResponse" and has_provider_err_marker and _is_error_response([it]):
                                is_real_provider_err = True
                                last_provider_error_text = str(it.get("toolResult") or "")[:180]
                                break
                    if is_real_provider_err:
                        errors_5xx += 1
                        if isinstance(ts, (int, float)) and (now_epoch - ts) <= 720:
                            recent_provider_errors += 1
                            last_provider_error_ts = int(ts)
                            last_msg_is_provider_error = True
                elif role == "assistant":
                    # Resposta bem-sucedida do assistente zera a sequência de erros recentes do provider
                    if '"type":"text"' in raw_cj or '"type":"toolRequest"' in raw_cj:
                        recent_provider_errors = 0
                        last_msg_is_provider_error = False

                if role == "user":
                    # Ancora APENAS em <mention> real (ignora <turn-context> de compactação/retry)
                    if "<mention>" in raw_cj and "Your context was compacted" not in raw_cj:
                        ev_txt = _extract_event_content(raw_cj)
                        # Só reinicia o relógio do turno se o <mention> for diferente do anterior (não retry do mesmo evento)
                        if not last_event_content or (ev_txt and ev_txt[:80] != last_event_content[:80]):
                            last_mention_idx = idx
                            last_mention_ts = ts
                        if ev_txt:
                            if not first_event_content:
                                first_event_content = ev_txt
                            last_event_content = ev_txt
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

            turn_msgs = msgs[last_mention_idx:] if msgs else []
            end_ts = msgs[-1][1] if msgs else None
            if isinstance(last_mention_ts, (int, float)) and isinstance(end_ts, (int, float)) and end_ts >= last_mention_ts:
                turno_min = round((end_ts - last_mention_ts) / 60.0, 1)
            else:
                turno_min = thread_lifetime_min

            turn_cmds: list[str] = []
            help_count = 0
            last_shell = ""
            active_worktree = None
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
                                # Só conta worktree como risco de colisão quando há mutação real (ignora leitura/inspeção de QA/COO)
                                m_wt = re.search(r"(?:cd|git\s+-C)\s+[^\s;&|]*\.worktrees/([A-Za-z0-9._-]+)", cmd)
                                if m_wt:
                                    wt_name = m_wt.group(1)
                                    is_mutating_cmd = bool(re.search(
                                        r"\b(git\s+(?:add|commit|rebase|merge|checkout|reset|cherry-pick|apply|am|stash|rm|mv)|"
                                        r"rm\s+-|mv\s+|cp\s+|tee\s+|sed\s+-i|perl\s+-i|patch\b|entregar\b)|"
                                        r"(?:^|[^0-9&])>(?!&|/?dev/null)",
                                        cmd,
                                    ))
                                    if (
                                        is_mutating_cmd
                                        and wt_name not in IGNORED_WORKTREES
                                        and not wt_name.startswith(("revisao-", "cron-"))
                                    ):
                                        active_worktree = wt_name

            # Detecta se o gatilho da sessão referencia item já fechado/merged na main
            # Remove citações de SHA de baseline/contexto (ex.: "origin/main (77ae73e)", "entrou em 77ae73e") para evitar falso positivo
            gatilho = (last_event_content or first_event_content or "")[:220]
            closed_ev = None
            raw_blob = f"{first_event_content} {last_event_content}".lower()
            check_blob = re.sub(
                r"(?:origin/main|em\s+main|descontando[^.\n]{0,40}|entrou\s+em|alinhados\s+em|saneado[^.\n]{0,40}|base\s+)[(\s`]*[0-9a-f]{7,40}[)\s`]*",
                " ",
                raw_blob,
            )
            for slug_key, reason in closed_slugs.items():
                if slug_key in check_blob:
                    closed_ev = reason
                    break
            if not closed_ev:
                for hx in RE_HEX8.findall(check_blob):
                    h8 = hx[:8].lower()
                    h7 = hx[:7].lower()
                    if h8 in closed_hex:
                        closed_ev = closed_hex[h8]
                        break
                    if h7 in closed_hex:
                        closed_ev = closed_hex[h7]
                        break

            extracted.append({
                "sid": sid,
                "name": name or sid,
                "ag": ag,
                "ativa": ativa,
                "channel_id": channel_id,
                "thread_root": thread_root,
                "agent_pubkey": agent_pubkey,
                "active_worktree": active_worktree,
                "gatilho_resumo": gatilho,
                "closed_ev": closed_ev,
                "compactions": compactions,
                "errors_5xx": errors_5xx,
                "recent_provider_errors": recent_provider_errors,
                "last_provider_error_ts": last_provider_error_ts,
                "last_provider_error_text": last_provider_error_text,
                "last_msg_is_provider_error": last_msg_is_provider_error,
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

        # Deduplicação pós-failover/relaunch: quando session(..., 'new') cria uma sessão mais nova
        # para o mesmo agente na mesma thread_root (ou mesmo nome de sessão), a sessão antiga que ficou
        # parada em erro de provider ou sem atualização recente (>1.0m atrás da nova) foi substituída
        # e não deve continuar marcada como ativa por 15 minutos.
        newest_by_thread: dict[tuple[str, str], dict] = {}
        newest_by_name: dict[tuple[str, str], dict] = {}
        for item in extracted:
            if not item["ativa"]:
                continue
            t_key = (item["ag"], item["thread_root"]) if item["thread_root"] else None
            n_key = (item["ag"], item["name"])
            newer = (newest_by_thread.get(t_key) if t_key else None) or newest_by_name.get(n_key)
            if newer is not None:
                age_gap = item["age_upd_min"] - newer["age_upd_min"]
                if item["last_msg_is_provider_error"] or age_gap >= 0.8:
                    item["ativa"] = False
                    item["superseded_by"] = newer["sid"]
            if item["ativa"]:
                if t_key and t_key not in newest_by_thread:
                    newest_by_thread[t_key] = item
                if n_key not in newest_by_name:
                    newest_by_name[n_key] = item

        for item in extracted:
            if item["ativa"]:
                if item["thread_root"]:
                    thread_collision_counts[(item["ag"], item["thread_root"])] += 1
                if item["active_worktree"]:
                    worktree_collision_counts[(item["ag"], item["active_worktree"])] += 1

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

            # 1. Trabalho em item já fechado / merged na main
            if item["closed_ev"] and (shell_count >= 3 or item["turno_min"] >= 5.0 or item["compactions"] >= 1):
                flags.append("ITEM_JA_FECHADO")
                severidade = "critical"

            # 2. Estouro de contexto (compactação) em sessão ativa (só crítico se houver trabalho/erro real, evitando auto-loop de telemetria)
            if item["compactions"] >= 1 and (
                shell_count >= 8 or item["consecutive_errors"] >= 2 or item["last_msg_is_provider_error"]
            ):
                flags.append("CONTEXTO_COMPACTADO")
                severidade = "critical"
            elif item["compactions"] >= 3:
                flags.append("CONTEXTO_COMPACTADO")
                if severidade == "ok":
                    severidade = "warn"

            # 3. Turno contínuo excessivo (>= 35m OU >= 35 shells desde último <mention> real)
            if item["turno_min"] >= 35.0 or shell_count >= 35:
                flags.append("TURNO_EXCESSIVO")
                severidade = "critical"

            # 4. Loop por repetição de comando ou baixa unicidade
            if rep_recent_max >= 3 or (shell_count >= 8 and uniq_ratio < 0.50):
                flags.append("COMANDO_REPETIDO")
                severidade = "critical"

            # 5. Erros consecutivos no fim do turno
            if item["consecutive_errors"] >= 3:
                flags.append("ERRO_REPETIDO")
                severidade = "critical"

            # 6. Travado em thinking >= 10m
            if item["last_only_thinking"] and 10.0 <= item["age_upd_min"] <= 60.0:
                flags.append("STALLED_THINKING")
                severidade = "critical"

            # 7. Colisão de worktree: mesmo agente em >= 2 sessões ativas na mesma worktree de card
            if ativa and item["active_worktree"] and worktree_collision_counts[(item["ag"], item["active_worktree"])] >= 2:
                flags.append("COLISAO_WORKTREE")
                severidade = "critical"

            # 8. Erro fatal de provider (502/503/504/429/404/400/malformed_function_call/No available accounts)
            if item["last_msg_is_provider_error"] or item["recent_provider_errors"] >= 2 or item["errors_5xx"] >= 3:
                flags.append("TEMPESTADE_5XX")
                if item["last_msg_is_provider_error"] or item["recent_provider_errors"] >= 2 or item["errors_5xx"] >= 4:
                    severidade = "critical"
                elif severidade == "ok":
                    severidade = "warn"

            # 9. Colisão na mesma thread_root
            if ativa and item["thread_root"] and thread_collision_counts[(item["ag"], item["thread_root"])] >= 2:
                flags.append("SESSAO_DUPLICADA")
                duplicadas += 1
                duplicadas_ativas += 1
                if severidade == "ok":
                    severidade = "warn"

            # 10. Exploração excessiva de --help no turno atual (>= 5)
            if item["help_count"] >= 5:
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

            if ativa or flags or len(sessoes) < 8:
                sessoes.append({
                    "session_id": item["sid"],
                    "agente": item["ag"],
                    "nome": item["name"],
                    "ativa": ativa,
                    "channel_id": item["channel_id"],
                    "thread_root": item["thread_root"],
                    "agent_pubkey": item["agent_pubkey"],
                    "worktree": item["active_worktree"],
                    "gatilho_resumo": item["gatilho_resumo"],
                    "item_fechado_evidencia": item["closed_ev"],
                    "compactions": item["compactions"],
                    "errors_5xx": item["errors_5xx"],
                    "recent_provider_errors": item["recent_provider_errors"],
                    "last_provider_error_ts": item["last_provider_error_ts"],
                    "last_provider_error_text": item["last_provider_error_text"],
                    "last_msg_is_provider_error": item["last_msg_is_provider_error"],
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
                    "acao_sugerida": sugerir_acao(flags, ativa, item["closed_ev"], item["compactions"]),
                })

        ordem = {"critical": 0, "warn": 1, "ok": 2}
        sessoes.sort(
            key=lambda s: (
                0 if s["ativa"] else 1,
                ordem.get(s["severidade"], 3),
                -s["duracao_min"],
                -s["shells"],
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
            "sessoes": sessoes[:18],
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
