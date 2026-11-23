#!/usr/bin/env python3
"""Wrapper canônico: delega 100% para REPOS/orgfy/ferramentas/esteira/gerar_kpis_esteira.py
para impedir divergência de cálculo de KPIs e orçamento entre o plugin e o core OrgFy.
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

CANONICAL_SCRIPT = (
    Path(__file__).resolve().parent.parent.parent
    / "orgfy"
    / "ferramentas"
    / "esteira"
    / "gerar_kpis_esteira.py"
)

if not CANONICAL_SCRIPT.exists():
    sys.stderr.write(f"[ERRO] Script canônico não encontrado: {CANONICAL_SCRIPT}\n")
    raise SystemExit(1)

if __name__ == "__main__":
    runpy.run_path(str(CANONICAL_SCRIPT), run_name="__main__")
