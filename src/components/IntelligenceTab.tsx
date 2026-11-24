import type { Context } from "@buzz/author";
import type {
  KpisEsteiraPayload,
  KpiHistoryPoint,
  DailySeriesPoint,
  GooseLoopRadarPayload,
  GooseLoopSession,
} from "../services/kpi-service";

export interface IntelligenceTabProps {
  h: any;
  kpis: KpisEsteiraPayload | null;
  history: KpiHistoryPoint[];
  error: string | null;
  isRecalculating: boolean;
  onRecalculate: () => void;
  onRunGovernanceEval?: () => void;
  governanceSummary?: string | null;
  loopRadar?: GooseLoopRadarPayload | null;
  onRefreshLoopRadar?: () => void;
  onWakeIrisForLoops?: () => void;
  onStopLoopSession?: (session: GooseLoopSession) => void;
  stoppingSessionId?: string | null;
}

const CARD_BG = "rgba(0, 0, 0, 0.28)";
const BORDER = "1px solid rgba(255, 255, 255, 0.08)";

function formatMin(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return "--";
  if (min < 60) return `${min.toFixed(0)}m`;
  const hrs = min / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}

function formatNum(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "--";
  return val.toLocaleString("pt-BR");
}

function renderDailyTrendSvg(h: any, series: DailySeriesPoint[]) {
  const width = 520;
  const height = 148;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    1,
    ...series.map((d) => Math.max(d.merges, d.retrabalhos + d.conflitos))
  );

  const barGroupW = series.length > 0 ? plotW / series.length : plotW;
  const barW = Math.max(6, Math.min(18, barGroupW * 0.48));

  return h(
    "svg",
    {
      viewBox: `0 0 ${width} ${height}`,
      style: { width: "100%", height: "148px", display: "block" },
    },
    // Grid lines
    [0, 0.5, 1].map((ratio, idx) => {
      const y = padTop + plotH * (1 - ratio);
      const label = Math.round(maxVal * ratio);
      return h(
        "g",
        { key: `grid-${idx}` },
        h("line", {
          x1: padLeft,
          y1: y,
          x2: width - padRight,
          y2: y,
          stroke: "rgba(255,255,255,0.08)",
          strokeDasharray: idx === 0 ? "none" : "3 3",
          strokeWidth: 1,
        }),
        h(
          "text",
          {
            x: padLeft - 6,
            y: y + 3,
            textAnchor: "end",
            fill: "#6b7280",
            fontSize: "9",
            fontFamily: "monospace",
          },
          String(label)
        )
      );
    }),
    // Bars
    series.map((d, i) => {
      const cx = padLeft + i * barGroupW + barGroupW / 2;
      const mergeH = (d.merges / maxVal) * plotH;
      const reworkTotal = d.retrabalhos + d.conflitos;
      const reworkH = (reworkTotal / maxVal) * plotH;
      const dayLabel = d.dia.slice(8, 10);

      return h(
        "g",
        { key: d.dia },
        h("rect", {
          x: cx - barW / 2,
          y: padTop + plotH - mergeH,
          width: barW,
          height: Math.max(mergeH, d.merges > 0 ? 2 : 0),
          rx: 3,
          fill: "#10b981",
        }),
        reworkTotal > 0 &&
          h("rect", {
            x: cx - barW / 2 + barW * 0.55,
            y: padTop + plotH - reworkH,
            width: Math.max(4, barW * 0.45),
            height: Math.max(reworkH, 3),
            rx: 2,
            fill: "#f59e0b",
          }),
        i % 2 === 0 &&
          h(
            "text",
            {
              x: cx,
              y: height - 8,
              textAnchor: "middle",
              fill: "#9ca3af",
              fontSize: "9",
              fontFamily: "monospace",
            },
            dayLabel
          )
      );
    })
  );
}

function renderBudgetGaugeSvg(h: any, pct: number, status: string) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fill =
    status === "BLOQUEADO_100"
      ? "#ef4444"
      : status === "ALERTA_80"
      ? "#f59e0b"
      : "#10b981";

  return h(
    "svg",
    {
      viewBox: "0 0 360 36",
      style: { width: "100%", height: "36px", display: "block" },
    },
    h("rect", {
      x: 0,
      y: 12,
      width: 360,
      height: 12,
      rx: 6,
      fill: "rgba(255,255,255,0.08)",
    }),
    h("rect", {
      x: 0,
      y: 12,
      width: Math.max(clamped > 0 ? 4 : 0, (clamped / 100) * 360),
      height: 12,
      rx: 6,
      fill,
    }),
    // Marca 80% (Soft Cap Paperclip)
    h("line", {
      x1: 288,
      y1: 8,
      x2: 288,
      y2: 28,
      stroke: "#f59e0b",
      strokeWidth: 1.5,
      strokeDasharray: "2 2",
    }),
    h(
      "text",
      {
        x: 288,
        y: 7,
        textAnchor: "middle",
        fill: "#f59e0b",
        fontSize: "8.5",
        fontFamily: "monospace",
      },
      "80%"
    ),
    // Marca 100% (Hard Cap)
    h("line", {
      x1: 359,
      y1: 8,
      x2: 359,
      y2: 28,
      stroke: "#ef4444",
      strokeWidth: 1.5,
    }),
    h(
      "text",
      {
        x: 348,
        y: 7,
        textAnchor: "end",
        fill: "#ef4444",
        fontSize: "8.5",
        fontFamily: "monospace",
      },
      "100%"
    )
  );
}

export function renderIntelligenceTab(props: IntelligenceTabProps) {
  const { h, kpis, history, error, isRecalculating, onRecalculate, onRunGovernanceEval, governanceSummary, loopRadar, onRefreshLoopRadar, onWakeIrisForLoops, onStopLoopSession, stoppingSessionId } = props;

  if (!kpis) {
    return h(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "32px",
          color: "#9ca3af",
          textAlign: "center",
        },
      },
      h(
        "div",
        { style: { fontSize: "14px", fontWeight: "700", color: "#f3f4f6" } },
        "Snapshot kpis-esteira.json ainda não disponível"
      ),
      h(
        "div",
        { style: { fontSize: "12px", maxWidth: "460px", lineHeight: "1.5" } },
        error || "Execute o motor determinístico da Onda 1 para consolidar transições, uso do NexusMind e higiene do backlog sem dados mockados."
      ),
      h(
        "button",
        {
          onClick: onRecalculate,
          disabled: isRecalculating,
          style: {
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#10b981",
            color: "#000000",
            fontWeight: "700",
            fontSize: "12px",
            cursor: isRecalculating ? "wait" : "pointer",
          },
        },
        isRecalculating ? "Recalculando KPIs..." : "Gerar KPIs Reais Agora"
      )
    );
  }

  const budgetColor =
    kpis.economia.status_orcamento === "BLOQUEADO_100"
      ? "#ef4444"
      : kpis.economia.status_orcamento === "ALERTA_80"
      ? "#f59e0b"
      : "#10b981";

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "6px",
      },
    },
    // Barra Superior de Ação e Freshness
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "10px",
          backgroundColor: CARD_BG,
          border: BORDER,
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        h(
          "span",
          { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } },
          "Painel de Inteligência & Saúde — Melhoria Contínua (Zero Vaidade)"
        ),
        h(
          "span",
          { style: { fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
          `Fontes: ${kpis.fontes.transicoes_linhas} transições · ${kpis.fontes.nm_usage_itens} reqs NexusMind · ${kpis.fontes.placar_arquivo || "sem placar"} · ${history.length} snapshots`
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        onRunGovernanceEval &&
          h(
            "button",
            {
              onClick: onRunGovernanceEval,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
              },
            },
            "Avaliar Governança (Onda 3)"
          ),
        h(
          "button",
          {
            onClick: onRecalculate,
            disabled: isRecalculating,
            style: {
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#10b981",
              color: "#000000",
              fontSize: "11px",
              fontWeight: "700",
              cursor: isRecalculating ? "wait" : "pointer",
            },
          },
          isRecalculating ? "Recalculando..." : "Recalcular KPIs agora"
        )
      )
    ),

    governanceSummary &&
      h(
        "div",
        {
          style: {
            padding: "10px 14px",
            borderRadius: "8px",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            fontSize: "11px",
            color: "#e0f2fe",
            fontFamily: "monospace",
          },
        },
        governanceSummary
      ),

    // 4 Cards Principais (4 Pilares de Decisão)
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "10px",
        },
      },
      // Pilar 1: Gargalo de Revisão
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "1. Gargalo de Revisão"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: kpis.fluxo.fila_revisao_atual >= 10 ? "#f59e0b" : "#10b981", marginTop: "4px" } },
          `${kpis.fluxo.fila_revisao_atual} na fila`
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `Espera P50 ${formatMin(kpis.fluxo.revisao_espera_p50_min)} · P90 ${formatMin(kpis.fluxo.revisao_espera_p90_min)}`
        )
      ),
      // Pilar 2: FPY Real & Retrabalho
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "2. Qualidade (FPY Real)"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: "#10b981", marginTop: "4px" } },
          kpis.qualidade.fpy_real_pct !== null ? `${kpis.qualidade.fpy_real_pct.toFixed(1)}%` : "--"
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `${kpis.qualidade.cards_aceitos_primeira} 1ª vez · ${kpis.qualidade.cards_com_retrabalho} retrabalho (${kpis.qualidade.taxa_retrabalho_pct}%)`
        )
      ),
      // Pilar 3: Economia & ROI
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "3. Economia & Cache"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: budgetColor, marginTop: "4px" } },
          `${kpis.economia.status_orcamento} (${kpis.economia.uso_teto_diario_pct}%)`
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `Cache ${kpis.economia.cache_hit_ratio_pct}% · ${formatNum(kpis.economia.tokens_por_card_integrado)} tok/card`
        )
      ),
      // Pilar 4: Higiene & Orphan WIP
      h(
        "div",
        { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
        h("div", { style: { fontSize: "10px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" } }, "4. Higiene & Estagnação"),
        h(
          "div",
          { style: { fontSize: "22px", fontWeight: "700", color: kpis.higiene.orphan_wip_pct >= 25 ? "#f59e0b" : "#10b981", marginTop: "4px" } },
          `${kpis.higiene.orphan_wip_count} órfãos (${kpis.higiene.orphan_wip_pct}%)`
        ),
        h(
          "div",
          { style: { fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" } },
          `Nível 3: ${kpis.higiene.estagnados_nivel_3} · Nível 2: ${kpis.higiene.estagnados_nivel_2}`
        )
      )
    ),

    // Linha 2: Gráfico SVG de Tendência 14d + Medidor Orçamento 80%/100%
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.45fr 1fr",
          gap: "12px",
        },
      },
      // Gráfico 14 dias
      h(
        "div",
        { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Vazão Diária (14 dias): Merges vs. Retrabalho"),
          h(
            "span",
            { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" } },
            `7d: ${kpis.fluxo.vazao_7d} · 30d: ${kpis.fluxo.vazao_30d}`
          )
        ),
        renderDailyTrendSvg(h, kpis.fluxo.serie_diaria_14d || [])
      ),
      // Medidor de Orçamento 80%/100% + Alertas
      h(
        "div",
        { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER, display: "flex", flexDirection: "column", gap: "10px" } },
        h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Guardrail Econômico (80% Alerta / 100% Trava)"),
        renderBudgetGaugeSvg(h, kpis.economia.uso_teto_diario_pct, kpis.economia.status_orcamento),
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } },
          h("span", null, `Hoje: ${formatNum(kpis.economia.tokens_hoje)} tok`),
          h("span", null, `Teto: ${formatNum(kpis.economia.teto_diario_tokens)} tok`)
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" } },
          kpis.alertas_ativos.length === 0
            ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhum alerta crítico ativo.")
            : kpis.alertas_ativos.map((al) =>
                h(
                  "div",
                  {
                    key: al.codigo,
                    style: {
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor:
                        al.severidade === "critical"
                          ? "rgba(239, 68, 68, 0.14)"
                          : "rgba(245, 158, 11, 0.12)",
                      border:
                        al.severidade === "critical"
                          ? "1px solid rgba(239, 68, 68, 0.35)"
                          : "1px solid rgba(245, 158, 11, 0.3)",
                      fontSize: "10.5px",
                      color: "#f3f4f6",
                    },
                  },
                  h("div", { style: { fontWeight: "700", color: al.severidade === "critical" ? "#f87171" : "#fbbf24" } }, al.mensagem),
                  h("div", { style: { color: "#cbd5e1", marginTop: "2px" } }, al.acao_sugerida)
                )
              )
        )
      )
    ),

    // Linha 3: Eficiência por Modelo NexusMind + Top Worktrees Estagnados
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.25fr 1fr",
          gap: "12px",
        },
      },
      // Tabela de Modelos
      h(
        "div",
        { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", marginBottom: "8px" } },
          h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "ROI & Eficiência por Modelo (NexusMind)"),
          h("span", { style: { fontSize: "11px", color: "#10b981", fontFamily: "monospace" } }, `Amostra: $${kpis.economia.custo_usd_total_amostra.toFixed(4)} USD`)
        ),
        kpis.economia.por_modelo.length === 0
          ? h("div", { style: { fontSize: "11px", color: "#6b7280" } }, "Sem registros em nm_usage.json.")
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto", paddingRight: "4px" } },
              kpis.economia.por_modelo.map((m) =>
                h(
                  "div",
                  {
                    key: `${m.modelo}-${m.grupo}`,
                    style: {
                      display: "grid",
                      gridTemplateColumns: "1.4fr 0.7fr 0.7fr 0.7fr 0.8fr",
                      gap: "6px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(255,255,255,0.03)",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      alignItems: "center",
                    },
                  },
                  h("span", { style: { color: "#f3f4f6", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" } }, `${m.modelo} (${m.grupo})`),
                  h("span", { style: { color: "#9ca3af" } }, `${m.requisicoes} req`),
                  h("span", { style: { color: "#10b981" } }, `$${m.custo_usd.toFixed(3)}`),
                  h("span", { style: { color: "#38bdf8" } }, `${m.cache_hit_pct}% hit`),
                  h("span", { style: { color: "#fbbf24", textAlign: "right" } }, `${Math.round(m.latencia_media_ms)}ms`)
                )
              )
            )
      ),
      // Coluna Direita: Radar de Loops (Goose Live) + Top Estagnados
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 } },
        // Radar de Loops & Sessões Zumbis (Goose Live)
        h(
          "div",
          { style: { padding: "14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER, display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              h("span", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6" } }, "Radar de Loops (Goose Live · 3h)"),
              loopRadar?.ok &&
                (() => {
                  const critAtivos = loopRadar.resumo.criticos_ativos ?? loopRadar.resumo.criticos;
                  const critHist = loopRadar.resumo.criticos_historico_3h ?? 0;
                  const dupAtivos = loopRadar.resumo.duplicadas_ativas ?? loopRadar.resumo.duplicadas;
                  return h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        fontFamily: "monospace",
                        fontWeight: "700",
                        padding: "2px 7px",
                        borderRadius: "9999px",
                        backgroundColor:
                          critAtivos > 0
                            ? "rgba(239, 68, 68, 0.18)"
                            : (loopRadar.resumo.avisos_ativos ?? loopRadar.resumo.avisos) > 0 || critHist > 0
                            ? "rgba(245, 158, 11, 0.18)"
                            : "rgba(16, 185, 129, 0.15)",
                        color:
                          critAtivos > 0
                            ? "#f87171"
                            : (loopRadar.resumo.avisos_ativos ?? loopRadar.resumo.avisos) > 0 || critHist > 0
                            ? "#fbbf24"
                            : "#10b981",
                      },
                    },
                    `${critAtivos} ativos · ${critHist} hist(3h) · ${dupAtivos} dup`
                  );
                })()
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px" } },
              onWakeIrisForLoops &&
                h(
                  "button",
                  {
                    onClick: onWakeIrisForLoops,
                    title: "Acionar OrgFy Iris imediatamente com o diagnóstico vivo do Radar",
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      backgroundColor: "rgba(239, 68, 68, 0.16)",
                      color: "#fca5a5",
                      fontSize: "10.5px",
                      fontWeight: "700",
                      cursor: "pointer",
                    },
                  },
                  "Acionar Iris"
                ),
              onRefreshLoopRadar &&
                h(
                  "button",
                  {
                    onClick: onRefreshLoopRadar,
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "#cbd5e1",
                      fontSize: "10.5px",
                      cursor: "pointer",
                    },
                  },
                  "Atualizar"
                )
            )
          ),
          !loopRadar || !loopRadar.ok
            ? h("div", { style: { fontSize: "11px", color: "#9ca3af" } }, loopRadar?.error || "Carregando telemetria live do Goose...")
            : loopRadar.sessoes.length === 0
            ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhuma sessão em loop ou travada nas últimas 3 horas.")
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto", paddingRight: "4px" } },
                loopRadar.sessoes.map((s) => {
                  const isActive = typeof s.ativa === "boolean" ? s.ativa : s.ultima_atualizacao_min <= 15;
                  return h(
                    "div",
                    {
                      key: s.session_id,
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        padding: "7px 9px",
                        borderRadius: "6px",
                        opacity: isActive ? 1 : 0.72,
                        backgroundColor:
                          isActive && s.severidade === "critical"
                            ? "rgba(239, 68, 68, 0.12)"
                            : s.severidade === "warn" || (!isActive && s.severidade === "critical")
                            ? "rgba(245, 158, 11, 0.08)"
                            : "rgba(255, 255, 255, 0.025)",
                        border:
                          isActive && s.severidade === "critical"
                            ? "1px solid rgba(239, 68, 68, 0.35)"
                            : s.severidade === "warn" || (!isActive && s.severidade === "critical")
                            ? "1px solid rgba(245, 158, 11, 0.25)"
                            : "1px solid rgba(255, 255, 255, 0.05)",
                        fontSize: "10.5px",
                        fontFamily: "monospace",
                      },
                    },
                    h(
                      "div",
                      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "6px" } },
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "8.5px",
                              fontWeight: "700",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              backgroundColor: isActive ? "rgba(16, 185, 129, 0.18)" : "rgba(156, 163, 175, 0.15)",
                              color: isActive ? "#34d399" : "#9ca3af",
                            },
                          },
                          isActive ? "ATIVA" : "HIST"
                        ),
                        h("span", { style: { color: "#f3f4f6", fontWeight: "700" } }, s.agente)
                      ),
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "8px" } },
                        h(
                          "span",
                          { style: { color: isActive && s.severidade === "critical" ? "#f87171" : s.severidade === "warn" ? "#fbbf24" : "#cbd5e1", fontWeight: "600" } },
                          `${formatMin(s.duracao_min)} · ${s.shells} shells`
                        ),
                        isActive &&
                          onStopLoopSession &&
                          h(
                            "button",
                            {
                              onClick: () => onStopLoopSession(s),
                              disabled: stoppingSessionId === s.session_id,
                              title: "Interromper (Stop) o turno atual deste agente imediatamente",
                              style: {
                                padding: "2px 8px",
                                borderRadius: "5px",
                                border: "1px solid rgba(239, 68, 68, 0.55)",
                                backgroundColor: stoppingSessionId === s.session_id ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.2)",
                                color: "#fecaca",
                                fontSize: "9.5px",
                                fontWeight: "700",
                                cursor: stoppingSessionId === s.session_id ? "wait" : "pointer",
                              },
                            },
                            stoppingSessionId === s.session_id ? "Parando..." : "■ Parar"
                          )
                      )
                    ),
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" } },
                      h(
                        "div",
                        { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                        (s.flags.length > 0 ? s.flags : ["OK"]).map((fl) =>
                          h(
                            "span",
                            {
                              key: fl,
                              style: {
                                fontSize: "9px",
                                fontWeight: "700",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                backgroundColor:
                                  fl === "OK"
                                    ? "rgba(16, 185, 129, 0.15)"
                                    : fl === "ITEM_JA_FECHADO" || fl === "CONTEXTO_COMPACTADO" || fl === "TURNO_EXCESSIVO" || fl === "COLISAO_WORKTREE" || fl === "COMANDO_REPETIDO" || fl === "ERRO_REPETIDO" || fl === "LOOP_SUSPEITO" || fl === "STALLED_THINKING"
                                    ? "rgba(239, 68, 68, 0.22)"
                                    : "rgba(245, 158, 11, 0.22)",
                                color:
                                  fl === "OK"
                                    ? "#10b981"
                                    : fl === "ITEM_JA_FECHADO" || fl === "CONTEXTO_COMPACTADO" || fl === "TURNO_EXCESSIVO" || fl === "COLISAO_WORKTREE" || fl === "COMANDO_REPETIDO" || fl === "ERRO_REPETIDO" || fl === "LOOP_SUSPEITO" || fl === "STALLED_THINKING"
                                    ? "#f87171"
                                    : "#fbbf24",
                              },
                            },
                            fl
                          )
                        )
                      ),
                      h(
                        "span",
                        { style: { fontSize: "9.5px", color: "#9ca3af" } },
                        `${s.session_id} · há ${s.ultima_atualizacao_min}m${s.compactions ? ` · ${s.compactions}x compact` : ""}${s.errors_5xx ? ` · ${s.errors_5xx}x 5xx` : ""}`
                      )
                    ),
                    s.gatilho_resumo &&
                      h(
                        "div",
                        { style: { fontSize: "9.5px", color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.gatilho_resumo },
                        `▸ ${s.gatilho_resumo}`
                      ),
                    s.ultimo_shell &&
                      h(
                        "div",
                        { style: { fontSize: "9.5px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.ultimo_shell },
                        `$ ${s.ultimo_shell}`
                      ),
                    isActive &&
                      s.acao_sugerida &&
                      h(
                        "div",
                        { style: { fontSize: "9.5px", color: "#38bdf8", lineHeight: "1.3" } },
                        `→ ${s.acao_sugerida}`
                      )
                  );
                })
              )
        ),
        // Top Estagnados
        h(
          "div",
          { style: { padding: "12px 14px", borderRadius: "10px", backgroundColor: CARD_BG, border: BORDER } },
          h("div", { style: { fontSize: "12px", fontWeight: "700", color: "#f3f4f6", marginBottom: "6px" } }, "Top Estagnados no Sentinela"),
          kpis.higiene.top_estagnados.length === 0
            ? h("div", { style: { fontSize: "11px", color: "#10b981" } }, "Nenhum worktree estagnado.")
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                kpis.higiene.top_estagnados.slice(0, 6).map((st) =>
                  h(
                    "div",
                    {
                      key: st.chave,
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(255,255,255,0.03)",
                        fontSize: "10.5px",
                        fontFamily: "monospace",
                      },
                    },
                    h("span", { style: { color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" } }, st.chave),
                    h("span", { style: { color: st.nivel >= 3 ? "#f87171" : "#fbbf24", fontWeight: "700" } }, `N${st.nivel} · ${st.ciclos} ciclos`)
                  )
                )
              )
        )
      )
    )
  );
}

export function createChannelPulsePanel(ctx: Context, fetchKpis: () => Promise<KpisEsteiraPayload | null>) {
  const React = ctx.react;
  const h = React.createElement;

  return function OrgFyChannelPulsePanel() {
    const [kpis, setKpis] = React.useState<KpisEsteiraPayload | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchKpis();
        setKpis(data);
      } finally {
        setLoading(false);
      }
    };

    React.useEffect(() => {
      load();
    }, []);

    return h(
      "div",
      {
        style: {
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          color: "#f3f4f6",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "12px",
        },
      },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("strong", { style: { fontSize: "13px" } }, "OrgFy Pulse"),
        h(
          "button",
          {
            onClick: load,
            style: {
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#cbd5e1",
              fontSize: "10px",
              cursor: "pointer",
            },
          },
          loading ? "..." : "Atualizar"
        )
      ),
      !kpis
        ? h("div", { style: { color: "#9ca3af", fontSize: "11px" } }, loading ? "Carregando telemetria..." : "Sem snapshot kpis-esteira.json.")
        : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } },
              h(
                "div",
                { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
                h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "Orçamento"),
                h("div", { style: { fontWeight: "700", color: kpis.economia.status_orcamento === "OK" ? "#10b981" : "#f59e0b" } }, kpis.economia.status_orcamento)
              ),
              h(
                "div",
                { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
                h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "FPY Real"),
                h("div", { style: { fontWeight: "700", color: "#10b981" } }, kpis.qualidade.fpy_real_pct !== null ? `${kpis.qualidade.fpy_real_pct}%` : "--")
              ),
              h(
                "div",
                { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
                h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "Fila Revisão"),
                h("div", { style: { fontWeight: "700", color: "#f59e0b" } }, `${kpis.fluxo.fila_revisao_atual} cards`)
              ),
              h(
                "div",
                { style: { padding: "8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)" } },
                h("div", { style: { fontSize: "10px", color: "#9ca3af" } }, "WIP Órfão"),
                h("div", { style: { fontWeight: "700", color: "#f87171" } }, `${kpis.higiene.orphan_wip_count} (${kpis.higiene.orphan_wip_pct}%)`)
              )
            ),
            kpis.alertas_ativos.slice(0, 3).map((al) =>
              h(
                "div",
                {
                  key: al.codigo,
                  style: {
                    padding: "6px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    fontSize: "10.5px",
                  },
                },
                al.mensagem
              )
            )
          )
    );
  };
}
