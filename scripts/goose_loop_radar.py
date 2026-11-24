#!/usr/bin/env python3
"""Radar de Loops & Sessões Zumbis (Goose Live) — leitura somente-leitura (mode=ro).
Retorna JSON estruturado com sessões ativas/recentes (últimas 3h), alertas de:
- LOOP_SUSPEITO (>= 20 chamadas shell ou duração >= 30 min com >= 10 shells)
- SESSAO_LONGA (duração >= 15 min)
- STALLED_THINKING (última mensagem da sessão terminou apenas em bloco thinking)
- SESSAO_DUPLICADA (mesmo agente com >= 2 sessões ativas na última hora)
"""
from __future__ import annotations

import json
import os
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

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


def main() -> int:
    now = datetime.now(timezone.utc)
    if not GOOSE_DB.exists():
        print(json.dumps({
            "ok": False,
            "error": f"Banco Goose não encontrado: {GOOSE_DB}",
            "gerado_em": now.isoformat(),
            "resumo": {"total_recentes": 0, "criticos": 0, "avisos": 0, "duplicadas": 0},
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

        # Conta sessões por agente atualizadas na última 1h para detectar concorrência duplicada
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
        criticos = 0
        avisos = 0
        duplicadas = 0

        for sid, name, ag, duration_min, age_upd_min, updated_at in parsed_rows:
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
                                last_shell = cmd[:120]

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
                if severidade == "ok":
                    severidade = "warn"

            if severidade == "critical":
                criticos += 1
            elif severidade == "warn":
                avisos += 1

            # Exibe todas as sessões com alerta + as 8 mais recentes ativas
            if flags or len(sessoes) < 8:
                sessoes.append({
                    "session_id": sid,
                    "agente": ag,
                    "nome": name,
                    "duracao_min": duration_min,
                    "ultima_atualizacao_min": age_upd_min,
                    "msgs": len(msgs),
                    "shells": shell_count,
                    "help_calls": help_count,
                    "severidade": severidade,
                    "flags": flags,
                    "ultimo_shell": last_shell,
                })

        conn.close()
        # Ordena: críticos primeiro, depois avisos, depois mais recentes
        ordem = {"critical": 0, "warn": 1, "ok": 2}
        sessoes.sort(key=lambda s: (ordem.get(s["severidade"], 3), -s["shells"], -s["duracao_min"]))

        print(json.dumps({
            "ok": True,
            "error": None,
            "gerado_em": now.isoformat(),
            "resumo": {
                "total_recentes": len(rows),
                "criticos": criticos,
                "avisos": avisos,
                "duplicadas": duplicadas,
            },
            "sessoes": sessoes[:12],
        }, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "error": str(exc),
            "gerado_em": now.isoformat(),
            "resumo": {"total_recentes": 0, "criticos": 0, "avisos": 0, "duplicadas": 0},
            "sessoes": [],
        }, ensure_ascii=False))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
