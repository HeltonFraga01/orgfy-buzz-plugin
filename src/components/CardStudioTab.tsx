// ─────────────────────────────────────────────────────────────────────────────
// ORGFY CARD STUDIO TAB (SCHEMA-FIRST + DECISIONS API + BUZZ ATTENTION)
// Construtor visual determinístico de cards OrgFy com:
// - Validação L-01 ao vivo (executor !== revisor)
// - Triagem automática via Decisions API (risco 1-5, modelo sugerido, Attention policy)
// - Hash L-22 SHA-256 congelado
// - Preview copiável de Markdown, payloads JSON Buzz Attention e comando buzz-issue-guard.sh
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { createCanonicalCard, type CardCreateResult } from "../services/card-creator";
import type { AttentionPolicyChoice } from "../services/decision-router";

export interface CardStudioTabProps {
  ctx: Context | any;
  liveAgents: Array<{ id: string; name: string; tier: string }>;
  defaultEmpresa: string;
  onNotify: (type: "success" | "warning" | "info", text: string) => void;
}

const CARD_BG = "rgba(0, 0, 0, 0.28)";
const BORDER = "1px solid rgba(255, 255, 255, 0.08)";
const INPUT_STYLE = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: "7px",
  backgroundColor: "rgba(0, 0, 0, 0.35)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#f3f4f6",
  fontSize: "12px",
  outline: "none",
  boxSizing: "border-box" as const,
};

export function createCardStudioTabComponent(ctx: Context) {
  const React = ctx?.react;
  const h = React.createElement;

  return function CardStudioTab({ liveAgents, defaultEmpresa, onNotify }: Omit<CardStudioTabProps, "ctx">) {
    const firstAgent = liveAgents[0]?.name || "OrgFy Atlas";
    const secondAgent = liveAgents.find((a) => a.name !== firstAgent)?.name || "OrgFy Bento";

    const [empresa, setEmpresa] = React.useState<string>(defaultEmpresa === "all" ? "orgfy" : defaultEmpresa);
    const [slug, setSlug] = React.useState<string>("");
    const [titulo, setTitulo] = React.useState<string>("");
    const [objetivo, setObjetivo] = React.useState<string>("");
    const [tipo, setTipo] = React.useState<"execucao" | "revisao" | "infraestrutura" | "seguranca" | "spec" | "pesquisa">("execucao");
    const [executor, setExecutor] = React.useState<string>(firstAgent);
    const [revisor, setRevisor] = React.useState<string>(secondAgent);
    const [autoridade, setAutoridade] = React.useState<string>("DECIDIDO Helton / OrgFy Iris");
    const [decisao, setDecisao] = React.useState<string>("Implementar com escopo fechado e validação L-22");
    const [escritaText, setEscritaText] = React.useState<string>("");
    const [acceptanceCmd, setAcceptanceCmd] = React.useState<string>("python3 -m pytest -q");
    const [feitoQuando, setFeitoQuando] = React.useState<string>("Comando de aceite L-22 retorna exit 0 sem regressões");
    const [attentionPolicy, setAttentionPolicy] = React.useState<AttentionPolicyChoice | "auto">("auto");

    const [busy, setBusy] = React.useState<boolean>(false);
    const [result, setResult] = React.useState<CardCreateResult | null>(null);
    const [previewTab, setPreviewTab] = React.useState<"markdown" | "attention" | "publish">("markdown");

    const l01Violation = executor.trim().toLowerCase() === revisor.trim().toLowerCase();

    const copyText = (text: string, label: string) => {
      try {
        (navigator as any)?.clipboard?.writeText(text);
        onNotify("success", `${label} copiado!`);
      } catch {
        onNotify("warning", "Clipboard indisponível neste ambiente.");
      }
    };

    const runCreate = async (writeToDisk: boolean) => {
      if (l01Violation) {
        onNotify("warning", "Regra L-01: Executor e Revisor precisam ser perfis diferentes.");
        return;
      }
      const paths = escritaText
        .split(/[\n,]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!titulo.trim() || paths.length === 0 || !acceptanceCmd.trim()) {
        onNotify("warning", "Preencha Título, ao menos 1 path em Escrita exclusiva e Comando de aceite L-22.");
        return;
      }

      setBusy(true);
      try {
        const res = await createCanonicalCard(ctx, {
          slug: slug.trim() || titulo.trim(),
          titulo: titulo.trim(),
          objetivo: objetivo.trim() || undefined,
          autoridade: autoridade.trim(),
          decisao: decisao.trim(),
          tipo,
          executor,
          revisor,
          escrita_exclusiva: paths,
          feito_quando: feitoQuando.trim(),
          acceptance_command: acceptanceCmd.trim(),
          attention_policy: attentionPolicy === "auto" ? undefined : attentionPolicy,
          empresa,
          write_file: writeToDisk,
          run_lint: writeToDisk,
        });
        setResult(res);
        onNotify(res.ok ? "success" : "warning", res.message);
      } catch (err: any) {
        onNotify("warning", `Erro ao gerar card: ${err?.message || err}`);
      } finally {
        setBusy(false);
      }
    };

    const agentOptions =
      liveAgents.length > 0
        ? liveAgents.map((a) => a.name)
        : ["OrgFy Atlas", "OrgFy Bento", "OrgFy Val", "OrgFy Teo", "OrgFy Iris", "QA Sentinel"];

    return h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: "14px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        },
      },
      // COLUNA ESQUERDA: FORMULÁRIO SCHEMA-FIRST
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            overflowY: "auto",
            minHeight: 0,
          },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("span", { style: { fontSize: "13.5px", fontWeight: "700", color: "#f3f4f6" } }, "Card Studio — Abertura Schema-First (L-01 + L-22 + Attention)"),
          h("span", { style: { fontSize: "10px", color: "#10b981", fontFamily: "monospace" } }, "orgfy_card_create")
        ),

        // Linha 1: Empresa, Slug, Tipo
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "EMPRESA"),
            h(
              "select",
              { value: empresa, onChange: (e: any) => setEmpresa(e.target.value), style: INPUT_STYLE },
              h("option", { value: "orgfy" }, "orgfy"),
              h("option", { value: "lumen-iptv" }, "lumen-iptv"),
              h("option", { value: "saas-tributario" }, "saas-tributario")
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "SLUG (OPCIONAL)"),
            h("input", {
              type: "text",
              placeholder: "ex: fix-rls-checkout",
              value: slug,
              onChange: (e: any) => setSlug(e.target.value),
              style: INPUT_STYLE,
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "TIPO"),
            h(
              "select",
              { value: tipo, onChange: (e: any) => setTipo(e.target.value), style: INPUT_STYLE },
              h("option", { value: "execucao" }, "execucao"),
              h("option", { value: "infraestrutura" }, "infraestrutura"),
              h("option", { value: "seguranca" }, "seguranca"),
              h("option", { value: "spec" }, "spec"),
              h("option", { value: "revisao" }, "revisao"),
              h("option", { value: "pesquisa" }, "pesquisa")
            )
          )
        ),

        // Título
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "TÍTULO DO CARD *"),
          h("input", {
            type: "text",
            placeholder: "Ex: Corrigir validação RLS no endpoint de billing",
            value: titulo,
            onChange: (e: any) => setTitulo(e.target.value),
            style: INPUT_STYLE,
          })
        ),

        // Executor, Revisor, Attention Policy
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "EXECUTOR *"),
            h(
              "select",
              { value: executor, onChange: (e: any) => setExecutor(e.target.value), style: INPUT_STYLE },
              agentOptions.map((n) => h("option", { key: n, value: n }, n))
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "REVISOR (L-01) *"),
            h(
              "select",
              { value: revisor, onChange: (e: any) => setRevisor(e.target.value), style: INPUT_STYLE },
              agentOptions.map((n) => h("option", { key: n, value: n }, n))
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "BUZZ ATTENTION"),
            h(
              "select",
              { value: attentionPolicy, onChange: (e: any) => setAttentionPolicy(e.target.value), style: INPUT_STYLE },
              h("option", { value: "auto" }, "Auto (Decisions API)"),
              h("option", { value: "timer_curto" }, "timer_curto"),
              h("option", { value: "event_driven" }, "event_driven"),
              h("option", { value: "watchdog_longo" }, "watchdog_longo")
            )
          )
        ),

        l01Violation &&
          h(
            "div",
            {
              style: {
                padding: "7px 10px",
                borderRadius: "6px",
                backgroundColor: "rgba(239, 68, 68, 0.14)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                fontSize: "11px",
                fontWeight: "600",
              },
            },
            "Regra L-01 violada: Executor e Revisor não podem ser o mesmo agente."
          ),

        // Escrita Exclusiva
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "ESCRITA EXCLUSIVA (1 PATH POR LINHA OU VÍRGULA) *"),
          h("textarea", {
            rows: 2,
            placeholder: "ex: src/services/billing.ts, testes/test_billing.py",
            value: escritaText,
            onChange: (e: any) => setEscritaText(e.target.value),
            style: { ...INPUT_STYLE, fontFamily: "monospace", resize: "vertical" },
          })
        ),

        // Comando de Aceite L-22
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#10b981", fontWeight: "700" } }, "COMANDO DE ACEITE CONGELADO (L-22 SHA-256) *"),
          h("input", {
            type: "text",
            value: acceptanceCmd,
            onChange: (e: any) => setAcceptanceCmd(e.target.value),
            style: { ...INPUT_STYLE, fontFamily: "monospace", color: "#34d399" },
          })
        ),

        // Feito Quando
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "FEITO QUANDO *"),
          h("input", {
            type: "text",
            value: feitoQuando,
            onChange: (e: any) => setFeitoQuando(e.target.value),
            style: INPUT_STYLE,
          })
        ),

        // Autoridade e Decisão
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "AUTORIDADE *"),
            h("input", {
              type: "text",
              value: autoridade,
              onChange: (e: any) => setAutoridade(e.target.value),
              style: INPUT_STYLE,
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "DECISÃO *"),
            h("input", {
              type: "text",
              value: decisao,
              onChange: (e: any) => setDecisao(e.target.value),
              style: INPUT_STYLE,
            })
          )
        ),

        // Objetivo opcional
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          h("label", { style: { fontSize: "10px", color: "#9ca3af", fontWeight: "700" } }, "OBJETIVO (OPCIONAL)"),
          h("textarea", {
            rows: 2,
            placeholder: "Detalhe o objetivo técnico se desejar complementar o título...",
            value: objetivo,
            onChange: (e: any) => setObjetivo(e.target.value),
            style: { ...INPUT_STYLE, resize: "vertical" },
          })
        ),

        // Botões de Ação
        h(
          "div",
          { style: { display: "flex", gap: "8px", marginTop: "4px" } },
          h(
            "button",
            {
              onClick: () => runCreate(false),
              disabled: busy || l01Violation,
              style: {
                flex: 1,
                padding: "9px 12px",
                borderRadius: "7px",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "#38bdf8",
                fontSize: "12px",
                fontWeight: "700",
                cursor: busy || l01Violation ? "not-allowed" : "pointer",
              },
            },
            busy ? "Processando..." : "⚡ Simular & Triar (Decisions API)"
          ),
          h(
            "button",
            {
              onClick: () => runCreate(true),
              disabled: busy || l01Violation,
              style: {
                flex: 1,
                padding: "9px 12px",
                borderRadius: "7px",
                border: "none",
                backgroundColor: "#10b981",
                color: "#000000",
                fontSize: "12px",
                fontWeight: "700",
                cursor: busy || l01Violation ? "not-allowed" : "pointer",
              },
            },
            busy ? "Gravando..." : "Gravar em cards/ + Lint"
          )
        )
      ),

      // COLUNA DIREITA: PREVIEW & CONTRATO DECISIONS / ATTENTION / L-22
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: CARD_BG,
            border: BORDER,
            overflowY: "auto",
            minHeight: 0,
          },
        },
        !result
          ? h(
              "div",
              {
                style: {
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: "8px",
                  color: "#9ca3af",
                  padding: "24px",
                },
              },
              h("div", { style: { fontSize: "13px", fontWeight: "700", color: "#f3f4f6" } }, "Preview Determinístico do Card"),
              h(
                "div",
                { style: { fontSize: "11.5px", maxWidth: "360px", lineHeight: "1.5" } },
                "Preencha os campos à esquerda e clique em 'Simular & Triar' para ver o veredito da Decisions API, o hash L-22 SHA-256 congelado, o Markdown canônico e os payloads nativos do Buzz Attention."
              )
            )
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0 } },
              // Resumo Decision Router + L-22
              h(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                  },
                },
                [
                  {
                    label: "Risco / Tier",
                    value: `${result.triage.riscoScore}/5 · ${result.triage.modeloTier}`,
                    color: result.triage.riscoScore >= 4 ? "#f87171" : "#10b981",
                  },
                  {
                    label: "Modelo Sugerido",
                    value: result.triage.modeloRecomendadoHint,
                    color: "#38bdf8",
                  },
                  {
                    label: "Fonte / Attention",
                    value: `${result.triage.decisionSource === "decisions_api" ? "Decisions API" : "Fallback"} · ${result.attentionContract.policy}`,
                    color: "#c084fc",
                  },
                ].map((box) =>
                  h(
                    "div",
                    { key: box.label, style: { padding: "8px 10px", borderRadius: "7px", backgroundColor: "rgba(255,255,255,0.03)", border: BORDER } },
                    h("div", { style: { fontSize: "9.5px", color: "#9ca3af", textTransform: "uppercase" } }, box.label),
                    h("div", { style: { fontSize: "11px", fontWeight: "700", color: box.color, fontFamily: "monospace", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, box.value)
                  )
                )
              ),

              // Barra L-22 SHA-256 & Status em Disco
              h(
                "div",
                {
                  style: {
                    padding: "8px 10px",
                    borderRadius: "7px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    fontSize: "10.5px",
                    fontFamily: "monospace",
                    color: "#a7f3d0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  },
                },
                h("span", null, `L-22 SHA-256: ${result.acceptanceHashSha256}`),
                h(
                  "span",
                  { style: { color: "#cbd5e1" } },
                  `Arquivo: ${result.cardPath} · Disco: ${result.writtenToDisk ? "GRAVADO" : "simulação"} · Lint: ${
                    result.lintPassed === null ? "não executado" : result.lintPassed ? "PASS" : "FAIL"
                  }`
                ),
                result.lintOutput && h("span", { style: { color: result.lintPassed ? "#34d399" : "#f87171" } }, result.lintOutput)
              ),

              // Sub-tabs de preview
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", gap: "6px" } },
                  [
                    { id: "markdown", label: "Markdown Canônico" },
                    { id: "attention", label: "Buzz Attention JSON" },
                    { id: "publish", label: "Publicar (Guard)" },
                  ].map((t) =>
                    h(
                      "button",
                      {
                        key: t.id,
                        onClick: () => setPreviewTab(t.id as any),
                        style: {
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: previewTab === t.id ? "1px solid rgba(56,189,248,0.5)" : BORDER,
                          backgroundColor: previewTab === t.id ? "rgba(56,189,248,0.16)" : "rgba(255,255,255,0.03)",
                          color: previewTab === t.id ? "#38bdf8" : "#9ca3af",
                          fontSize: "10.5px",
                          fontWeight: "600",
                          cursor: "pointer",
                        },
                      },
                      t.label
                    )
                  )
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      const content =
                        previewTab === "markdown"
                          ? result.markdown
                          : previewTab === "attention"
                          ? JSON.stringify(result.attentionContract, null, 2)
                          : result.publishCommand;
                      copyText(content, previewTab === "markdown" ? "Markdown" : previewTab === "attention" ? "Contrato Attention" : "Comando de publicação");
                    },
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(16,185,129,0.4)",
                      backgroundColor: "rgba(16,185,129,0.12)",
                      color: "#34d399",
                      fontSize: "10.5px",
                      fontWeight: "600",
                      cursor: "pointer",
                    },
                  },
                  "Copiar"
                )
              ),

              h(
                "pre",
                {
                  style: {
                    flex: 1,
                    margin: 0,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#06080a",
                    border: BORDER,
                    color: previewTab === "publish" ? "#34d399" : "#e5e7eb",
                    fontFamily: "monospace",
                    fontSize: "10.5px",
                    lineHeight: "1.45",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  },
                },
                previewTab === "markdown"
                  ? result.markdown
                  : previewTab === "attention"
                  ? JSON.stringify(result.attentionContract, null, 2)
                  : result.publishCommand
              )
            )
      )
    );
  };
}
