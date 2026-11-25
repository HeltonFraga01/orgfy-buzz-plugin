// Adaptado de CodeDen (MIT) commit b0b2a5a: apps/web/src/components/factory-view/quick-chat.tsx e floor/pm-chat.tsx
// Painel lateral de Chat com o COO (OrgFy Bento por padrão) ou qualquer agente selecionado do Buzz, com envio real via ctx.agents.wake e botão Chat completo ↗.

import type { Context } from "@buzz/author";
import type { LiveCrewAgent } from "./FactoryBoardAndFloor";

export interface AgentChatMessage {
  id: string;
  sender: "user" | "system";
  agentName: string;
  text: string;
  at: string;
}

export interface AgentQuickChatProps {
  tenant: string;
  liveCrew: LiveCrewAgent[];
  onCollapse: () => void;
  onNotify?: (msg: string) => void;
}

export function createAgentQuickChatComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function AgentQuickChat({ tenant, liveCrew, onCollapse, onNotify }: AgentQuickChatProps) {
    // Padrão: COO (OrgFy Bento), 1 nível abaixo do Orquestrador Master (Iris), com seletor livre para qualquer agente
    const defaultAgentKey = React.useMemo(() => {
      const coo = liveCrew.find((a) => /bento/i.test(a.name) && !/arquiteto/i.test(a.name));
      if (coo) return coo.key;
      const anyCoo = liveCrew.find((a) => /coo|bento/i.test(a.name));
      if (anyCoo) return anyCoo.key;
      return liveCrew[0]?.key || "local:orgfy-bento";
    }, [liveCrew]);

    const [selectedKey, setSelectedKey] = React.useState<string>(defaultAgentKey);
    const [draft, setDraft] = React.useState<string>("");
    const [sending, setSending] = React.useState<boolean>(false);
    const [messages, setMessages] = React.useState<AgentChatMessage[]>([]);

    React.useEffect(() => {
      if (liveCrew.length > 0 && !liveCrew.some((a) => a.key === selectedKey)) {
        setSelectedKey(defaultAgentKey);
      }
    }, [liveCrew, selectedKey, defaultAgentKey]);

    const activeAgent = liveCrew.find((a) => a.key === selectedKey) || {
      key: selectedKey,
      name: "OrgFy Bento (COO)",
      model: "claude-sonnet-5-5",
      provider: "nexusmind_anthropic",
      running: false,
    };

    const handleSend = React.useCallback(async () => {
      const text = draft.trim();
      if (!text || sending) return;
      setSending(true);
      const nowStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, sender: "user", agentName: activeAgent.name, text, at: nowStr },
      ]);
      setDraft("");
      try {
        if ((ctx as any)?.agents?.wake) {
          await (ctx as any).agents.wake(activeAgent.key, {
            text: `[OrgFy Factory · ${tenant}] ${text}`,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `s-${Date.now()}`,
              sender: "system",
              agentName: activeAgent.name,
              text: `Mensagem enviada para ${activeAgent.name} via Buzz Agents. Clique em "Chat completo ↗" para acompanhar a resposta ao vivo.`,
              at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          onNotify?.(`Mensagem enviada para ${activeAgent.name}.`);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `s-${Date.now()}`,
              sender: "system",
              agentName: activeAgent.name,
              text: "ctx.agents.wake não está disponível nesta sessão.",
              at: nowStr,
            },
          ]);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            sender: "system",
            agentName: activeAgent.name,
            text: `Erro ao acionar ${activeAgent.name}: ${err?.message || err}`,
            at: nowStr,
          },
        ]);
      } finally {
        setSending(false);
      }
    }, [draft, sending, activeAgent, tenant, onNotify]);

    const handleOpenFullChat = React.useCallback(async () => {
      try {
        if ((ctx as any)?.navigation?.open) {
          await (ctx as any).navigation.open({ kind: "agent", agentKey: activeAgent.key });
          return;
        }
      } catch {}
      onNotify?.(`Abrindo conversa completa de ${activeAgent.name} no Buzz.`);
    }, [activeAgent, onNotify]);

    return h(
      "aside",
      {
        style: {
          width: "320px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid var(--border)",
          background: "var(--panel)",
          minHeight: 0,
          overflow: "hidden",
        },
      },
      // Cabeçalho do Chat Lateral (COO / Seletor de Agente + Chat completo ↗ + Recolher)
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
          h(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 } },
            h("span", { className: "of-dot", "data-tone": activeAgent.running ? "running" : "done" }),
            "Chat · COO & Agentes"
          ),
          h(
            "div",
            { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "ghost",
                style: { padding: "2px 6px", fontSize: "11px", color: "var(--primary)" },
                onClick: handleOpenFullChat,
              },
              "Chat completo ↗"
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "ghost",
                style: { padding: "2px 6px" },
                title: "Recolher chat lateral",
                onClick: onCollapse,
              },
              "›"
            )
          )
        ),
        // Seletor de qualquer agente do Buzz
        h(
          "select",
          {
            className: "of-tenant-select",
            value: selectedKey,
            onChange: (e: any) => setSelectedKey(e.target.value),
          },
          liveCrew.length > 0
            ? liveCrew.map((a) =>
                h(
                  "option",
                  { key: a.key, value: a.key },
                  `${a.name}${a.running ? " (ativo)" : ""} · ${a.model}`
                )
              )
            : h("option", { value: "local:orgfy-bento" }, "OrgFy Bento (COO)")
        )
      ),

      // Histórico / Estado do agente selecionado
      h(
        "div",
        {
          style: {
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          },
        },
        messages.length === 0
          ? h(
              "div",
              { className: "of-surface", style: { padding: "10px 12px", fontSize: "11.5px", lineHeight: 1.45 } },
              h("div", { style: { fontWeight: 600, marginBottom: "4px" } }, activeAgent.name),
              h(
                "div",
                { className: "of-muted" },
                `Pronto para receber ordens no workspace ${tenant}. Envie uma mensagem abaixo para acionar diretamente pelo Buzz (ctx.agents.wake) ou abra o Chat completo.`
              )
            )
          : messages.map((m) =>
              h(
                "div",
                {
                  key: m.id,
                  className: "of-surface",
                  style: {
                    padding: "8px 10px",
                    fontSize: "11.5px",
                    borderColor: m.sender === "user" ? "var(--primary)" : "var(--border)",
                    alignSelf: m.sender === "user" ? "flex-end" : "stretch",
                    maxWidth: m.sender === "user" ? "90%" : "100%",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted-foreground)", marginBottom: "3px" } },
                  h("span", null, m.sender === "user" ? "Você" : m.agentName),
                  h("span", null, m.at)
                ),
                h("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.4 } }, m.text)
              )
            )
      ),

      // Composer inferior (igual ao CodeDen PM chat)
      h(
        "div",
        {
          style: {
            padding: "10px 12px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        h("textarea", {
          className: "of-textarea",
          style: { minHeight: "56px", fontFamily: "inherit", fontSize: "12px" },
          placeholder: `Mensagem para ${activeAgent.name}... (Cmd/Ctrl+Enter para enviar)`,
          value: draft,
          onChange: (e: any) => setDraft(e.target.value),
          onKeyDown: (e: any) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          },
        }),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
          h("span", { className: "of-mono of-muted", style: { fontSize: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, activeAgent.model),
          h(
            "button",
            {
              type: "button",
              className: "of-btn",
              "data-variant": "primary",
              disabled: sending || !draft.trim(),
              onClick: handleSend,
            },
            sending ? "Enviando..." : "Enviar ↑"
          )
        )
      )
    );
  };
}
