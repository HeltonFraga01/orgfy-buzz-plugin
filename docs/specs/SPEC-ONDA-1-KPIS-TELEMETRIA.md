# SPEC-ONDA-1 — Motor Determinístico de KPIs & Saneamento de Telemetria (`gerar_kpis_esteira.py`)

**Versão:** 1.0  
**Escopo:** `orgfy-buzz-plugin/scripts/gerar_kpis_esteira.py` → `/Users/heltonfraga/.buzz/.scratch/kpis-esteira.json`  
**Dependências:** Python 3.10+ (stdlib pura, zero pacotes externos)

## 1. Problema e Motivação
A auditoria dos arquivos locais em `/Users/heltonfraga/.buzz/.scratch/` expôs dois erros silenciosos que distorcem a tomada de decisão e quatro fontes ricas subaproveitadas:
1. `metricas_turnos.json` soma `10.962.849.855` tokens históricos (`data_filtro: null`) contra um teto **diário** de `2.000.000` tokens, travando `status_governanca: "BLOQUEADO"` permanentemente e mantendo `cards_integrados: 0` (`cpi_tokens: 1.0` artificial).
2. `placar-*.json` mistura WIP ativo atribuído com cards órfãos (`bola: "nenhum"`, `responsavel: "nenhum"`), inflando a contagem e o tempo médio de `execucao`.
3. `esteira-transicoes.jsonl` (append-only) e `nm_usage.json` (custos USD, latência e cache read por modelo do NexusMind) não são consolidados em indicadores de fluxo, retrabalho e ROI.

## 2. Fontes de Entrada (Leitura Somente)
- `/Users/heltonfraga/.buzz/.scratch/esteira-transicoes.jsonl` — transições de estágio (`ts`, `issue_id`, `estado_anterior`, `estado_novo`, `bola`, `autor_transicao`, `sha`, `detalhe`).
- `/Users/heltonfraga/.buzz/.scratch/metricas_turnos.json` — turnos e tokens agregados por dia/agente.
- `/Users/heltonfraga/.buzz/.scratch/placar-*.json` (mais recente por data/mtime) — cards ativos, estágios e responsáveis.
- `/Users/heltonfraga/.buzz/.scratch/nm_usage.json` — requisições do NexusMind com `model`, `group.name`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `actual_cost`, `duration_ms`, `created_at`.
- `/Users/heltonfraga/.buzz/.scratch/sentinela-esteira-state.json` — ciclos de estagnação e `nivel_notificado` por worktree/issue/despacho.

## 3. Contrato de Saída (`kpis-esteira.json`)
```json
{
  "schema_version": "1.0.0",
  "gerado_em": "ISO-8601",
  "janela_dias": 30,
  "fontes": {
    "transicoes_linhas": 0,
    "nm_usage_itens": 0,
    "placar_arquivo": "placar-YYYYMMDD.json",
    "sentinela_entradas": 0
  },
  "fluxo": {
    "vazao_total_feito": 0,
    "vazao_7d": 0,
    "vazao_30d": 0,
    "fila_revisao_atual": 0,
    "revisao_espera_p50_min": 0.0,
    "revisao_espera_p90_min": 0.0,
    "lead_time_p50_min": 0.0,
    "lead_time_p90_min": 0.0,
    "taxa_conflito_pct": 0.0,
    "serie_diaria_14d": [{ "dia": "YYYY-MM-DD", "merges": 0, "retrabalhos": 0, "conflitos": 0 }]
  },
  "qualidade": {
    "fpy_real_pct": 0.0,
    "cards_aceitos_primeira": 0,
    "cards_com_retrabalho": 0,
    "taxa_retrabalho_pct": 0.0,
    "total_loops_revisao_execucao": 0,
    "total_conflitos_integracao": 0
  },
  "economia": {
    "teto_diario_tokens": 2000000,
    "tokens_hoje": 0,
    "tokens_7d": 0,
    "tokens_30d": 0,
    "uso_teto_diario_pct": 0.0,
    "status_orcamento": "OK | ALERTA_80 | BLOQUEADO_100",
    "cards_integrados_30d": 0,
    "tokens_por_card_integrado": null,
    "cpi_real": null,
    "custo_usd_total_amostra": 0.0,
    "cache_hit_ratio_pct": 0.0,
    "por_modelo": [
      {
        "modelo": "string",
        "grupo": "string",
        "requisicoes": 0,
        "custo_usd": 0.0,
        "tokens_totais": 0,
        "cache_hit_pct": 0.0,
        "latencia_media_ms": 0.0
      }
    ]
  },
  "higiene": {
    "wip_total_ativo": 0,
    "wip_atribuido": 0,
    "orphan_wip_count": 0,
    "orphan_wip_pct": 0.0,
    "top_orfaos": [{ "issue_id": "string", "titulo": "string", "estado": "string" }],
    "estagnados_nivel_3": 0,
    "estagnados_nivel_2": 0,
    "top_estagnados": [{ "chave": "string", "ciclos": 0, "nivel": 0 }]
  },
  "alertas_ativos": [
    { "codigo": "string", "severidade": "info | warn | critical", "mensagem": "string", "acao_sugerida": "string" }
  ]
}
```

## 4. Critérios de Aceite (Gate L-22)
1. **Determinismo & Zero Dependências:** `python3 scripts/gerar_kpis_esteira.py --output /Users/heltonfraga/.buzz/.scratch/kpis-esteira.json` retorna exit code `0` usando apenas stdlib Python.
2. **Correção do Bug de Orçamento:** `economia.tokens_hoje` contabiliza exclusivamente o dia corrente (nunca o acumulado histórico de `10,96B`), classificando corretamente `OK` (<80%), `ALERTA_80` (80%–99.9%) ou `BLOQUEADO_100` (>=100%).
3. **FPY e Retrabalho Reais:** `qualidade.fpy_real_pct` deriva diretamente de `esteira-transicoes.jsonl` verificando se cada `issue_id` que alcançou `feito` passou por loop `revisao -> execucao` ou `integracao -> conflito`.
4. **Resiliência a Arquivos Ausentes:** se qualquer arquivo de entrada não existir, o script não falha — registra `null`/`0` no bloco correspondente e preserva o schema íntegro.
