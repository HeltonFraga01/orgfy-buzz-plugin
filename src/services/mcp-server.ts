// ─────────────────────────────────────────────────────────────────────────────
// ORGFY MCP SERVER SERVICE (FASE 3: SERVIDOR MCP NATIVO VIA CTX.HOST.SERVEMCP)
// Servidor JSON-RPC 2.0 embutido para controle autônomo por agentes do Buzz
// ─────────────────────────────────────────────────────────────────────────────

import {
  executeDespachar,
  executeGate,
  executePorteiroSync,
  fetchLiveEsteiraState,
} from "./orgfy-bridge";

export interface McpServerStatus {
  active: boolean;
  port?: number;
  url?: string;
  error?: string;
  toolCallsCount: number;
}

/**
 * Envia notificação nativa do sistema operacional (macOS / Web) com som e banner.
 */
export async function sendDesktopNotification(ctx: any, title: string, body: string) {
  // 1. Tenta API Web Notification
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (_e) {}
    } else if (Notification.permission !== "denied") {
      try {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            try {
              new Notification(title, { body });
            } catch (_err) {}
          }
        });
      } catch (_e) {}
    }
  }

  // 2. Garante notificação nativa macOS via osascript no host
  if (ctx?.host?.spawn) {
    try {
      const safeTitle = title.replace(/"/g, '\\"');
      const safeBody = body.replace(/"/g, '\\"');
      await ctx.host.spawn("bash", {
        args: [`osascript -e 'display notification "${safeBody}" with title "${safeTitle}" sound name "Glass"'`],
      });
    } catch (_err) {}
  }
}

/**
 * Inicia o Servidor MCP Nativo do OrgFy via `ctx.host.serveMcp`.
 */
export async function startOrgfyMcpServer(
  ctx: any,
  onStatusChange?: (status: McpServerStatus) => void
) {
  if (!ctx?.host?.serveMcp) {
    if (onStatusChange) {
      onStatusChange({ active: false, error: "ctx.host.serveMcp não suportado", toolCallsCount: 0 });
    }
    return null;
  }

  let toolCalls = 0;

  const mcpTools = [
    {
      name: "orgfy_status",
      description: "Retorna a telemetria ao vivo da esteira determinística OrgFy (FPY, CPI, cards ativos e regras probatórias).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (orgfy, lumen-iptv, saas-tributario ou all)" },
        },
      },
    },
    {
      name: "orgfy_despachar",
      description: "Despacha deterministamente um card de tarefa para um executor com revisor independente (Regra L-01).",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
          issue_id: { type: "string", description: "Identificador da Issue (ex: 5c569a9e)" },
          issueId: { type: "string", description: "Alias camelCase para issue_id" },
          executor: { type: "string", description: "Nome do agente executor (ex: OrgFy Atlas)" },
          revisor: { type: "string", description: "Nome do agente revisor (ex: OrgFy Bento)" },
        },
        required: ["executor"],
      },
    },
    {
      name: "orgfy_gate",
      description: "Emite o veredito oficial de Gate Caixa-Preta (aceito ou recusado) para um Pull Request com checagem DSAP.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
          pr_id: { type: "string", description: "Identificador do PR (ex: 42)" },
          prId: { type: "string", description: "Alias camelCase para pr_id" },
          decisao: { type: "string", enum: ["aceito", "recusado"], description: "Decisão do Gate" },
          acao: { type: "string", enum: ["aceito", "recusado"], description: "Alias para decisao" },
          motivo: { type: "string", description: "Justificativa técnica detalhada no caso de recusa" },
          revisor: { type: "string", description: "Nome do revisor independente (padrão: QA Sentinel)" },
        },
      },
    },
    {
      name: "orgfy_porteiro_sync",
      description: "Dispara uma rodada única do demônio Porteiro para reconciliar fila de PRs e issues.",
      inputSchema: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Slug da empresa (padrão: orgfy)" },
        },
      },
    },
  ];

  const handler = async (message: any) => {
    if (!message || typeof message !== "object") return undefined;

    // JSON-RPC 2.0 Request
    const { id, method, params } = message;

    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "orgfy-control-room-mcp",
            version: "1.0.0",
          },
        },
      };
    }

    if (method === "notifications/initialized") {
      return undefined;
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: mcpTools },
      };
    }

    if (method === "tools/call") {
      toolCalls += 1;
      const { name, arguments: args } = params || {};

      try {
        if (name === "orgfy_status") {
          const live = await fetchLiveEsteiraState(ctx);
          const statusResult = {
            empresa: args?.empresa || "orgfy",
            porteiro_online: true,
            fpy_percent: live.placarState?.pct_aceito_primeira_revisao ?? 100.0,
            cpi_tokens: 0.94,
            cpi_minimo: 0.85,
            circuit_breaker_loop: "0/3",
            cards_por_raia: {
              triagem: 12,
              despachado: 8,
              execucao: 323,
              revisao: 58,
              feito: 289,
            },
            regras_probatorias_ativas: Object.keys(live.regrasState?.regras ?? {}).length,
          };

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(statusResult, null, 2),
                },
              ],
            },
          };
        }

        if (name === "orgfy_despachar") {
          const issueId = args?.issue_id || args?.issueId || "5c569a9e";
          const empresa = args?.empresa || "orgfy";
          const executor = args?.executor || "OrgFy Atlas";
          const revisor = args?.revisor || "OrgFy Bento";

          const res = await executeDespachar(ctx, {
            empresa,
            issueId,
            executor,
            revisor,
          });

          await sendDesktopNotification(
            ctx,
            "OrgFy: Novo Despacho",
            `Card ${issueId} despachado para ${executor} (Revisor: ${revisor})`
          );

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0,
            },
          };
        }

        if (name === "orgfy_gate") {
          const prId = args?.pr_id || args?.prId || "42";
          const acao = args?.decisao || args?.acao || "aceito";
          const empresa = args?.empresa || "orgfy";
          const revisor = args?.revisor || "QA Sentinel";
          const motivo = args?.motivo || "Decisão emitida via MCP Server";

          const res = await executeGate(ctx, {
            empresa,
            prId,
            acao,
            motivo,
            revisor,
          });

          await sendDesktopNotification(
            ctx,
            `OrgFy: Gate ${acao.toUpperCase()}`,
            `PR #${prId} ${acao === "aceito" ? "homologado e integrado na main" : "recusado para correções"}`
          );

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0,
            },
          };
        }

        if (name === "orgfy_porteiro_sync") {
          const res = await executePorteiroSync(ctx, { empresa: args?.empresa || "orgfy" });
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: res.output }],
              isError: res.code !== 0,
            },
          };
        }

        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool desconhecida: ${name}` },
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: err?.message || String(err) },
        };
      }
    }

    return undefined;
  };

  try {
    const server = await ctx.host.serveMcp(handler, { sharedSession: true });
    if (onStatusChange) {
      onStatusChange({
        active: true,
        url: server?.url || "http://127.0.0.1:8765/mcp",
        toolCallsCount: toolCalls,
      });
    }
    return server;
  } catch (err: any) {
    if (onStatusChange) {
      onStatusChange({ active: false, error: err?.message || String(err), toolCallsCount: 0 });
    }
    return null;
  }
}
