// Adaptado de CodeDen (MIT) commit b0b2a5a + integração nativa do Claw3D (iamlukethedev/Claw3D, MIT)
// Embute o Claw3D real (/office e /office/builder) dentro do Buzz Desktop via ctx.browser.View,
// conectado ao adaptador OrgFy Gateway (ws://127.0.0.1:18791) e com fallback 3D nativo offline.

import type { Context } from "@buzz/author";
import { createVirtualOffice3DComponent, type VirtualOffice3DProps } from "./VirtualOffice3DCanvas";

const CLAW3D_BASE_URL = "http://localhost:3430";
const START_CMD = "bash ~/.buzz/REPOS/claw3d/start-orgfy-claw3d.sh";

export function createClaw3DEmbedComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;
  const NativeFallback3D = createVirtualOffice3DComponent(ctx);

  return function Claw3DEmbedView(props: VirtualOffice3DProps) {
    const [surface, setSurface] = React.useState<"claw3d_office" | "claw3d_builder" | "native_3d">("claw3d_office");
    const [reloadTick, setReloadTick] = React.useState(0);
    const [copiedCmd, setCopiedCmd] = React.useState(false);
    const [serverOnline, setServerOnline] = React.useState<boolean | null>(null);

    const browserApi = (ctx as any)?.browser || (ctx as any)?.reflect?.get?.("browser");
    const BrowserView = browserApi?.View || null;
    const browserAvailable = Boolean(BrowserView && browserApi?.available !== false);

    // Probe discreto para indicar se o Claw3D local (:3430) já está online
    React.useEffect(() => {
      if (surface === "native_3d") return;
      let cancelled = false;
      const check = async () => {
        try {
          const res = await fetch(`${CLAW3D_BASE_URL}/office`, { mode: "no-cors" });
          if (!cancelled && res) setServerOnline(true);
        } catch {
          if (!cancelled) setServerOnline(false);
        }
      };
      void check();
      const timer = window.setInterval(() => void check(), 8000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }, [surface, reloadTick]);

    const targetUrl =
      surface === "claw3d_builder"
        ? `${CLAW3D_BASE_URL}/office/builder`
        : `${CLAW3D_BASE_URL}/office`;

    const handleCopyStartCmd = () => {
      try {
        void navigator?.clipboard?.writeText?.(START_CMD);
        setCopiedCmd(true);
        window.setTimeout(() => setCopiedCmd(false), 2200);
      } catch {}
    };

    const handleOpenExternal = () => {
      try {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      } catch {}
    };

    return h(
      "div",
      {
        "data-claw3d-embed": "true",
        "data-virtual-office-3d": "true",
        "data-claw3d-surface": surface,
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flex: 1,
          minHeight: "580px",
          height: "100%",
        },
      },
      // Barra superior compacta de navegação do Claw3D
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            padding: "6px 10px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--card)",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
          h(
            "div",
            { className: "of-segmented", role: "tablist", "aria-label": "Modo do Escritório 3D" },
            (
              [
                { id: "claw3d_office", label: "Claw3D Escritório" },
                { id: "claw3d_builder", label: "Claw3D Builder" },
                { id: "native_3d", label: "3D Nativo (Offline)" },
              ] as const
            ).map((tab) =>
              h(
                "button",
                {
                  key: tab.id,
                  type: "button",
                  className: "of-seg-btn",
                  "data-active": surface === tab.id ? "true" : "false",
                  onClick: () => setSurface(tab.id),
                },
                tab.label
              )
            )
          ),
          surface !== "native_3d" &&
            h(
              "span",
              {
                className: "of-pill",
                "data-tone": serverOnline === true ? "done" : serverOnline === false ? "waiting" : "idle",
                style: { fontSize: "10.5px" },
              },
              serverOnline === true
                ? "● Claw3D Online (:3430)"
                : serverOnline === false
                ? "○ Claw3D Offline (:3430)"
                : "Conectando :3430..."
            )
        ),
        surface !== "native_3d" &&
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { fontSize: "11px", padding: "4px 8px" },
                onClick: () => setReloadTick((n) => n + 1),
              },
              "↻ Recarregar"
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                style: { fontSize: "11px", padding: "4px 8px" },
                title: START_CMD,
                onClick: handleCopyStartCmd,
              },
              copiedCmd ? "✓ Comando copiado" : "Copiar comando"
            ),
            h(
              "button",
              {
                type: "button",
                className: "of-btn",
                "data-variant": "primary",
                style: { fontSize: "11px", padding: "4px 9px" },
                onClick: handleOpenExternal,
              },
              "Abrir no Navegador ↗"
            )
          )
      ),

      // Corpo principal: Claw3D real embarcado via ctx.browser.View / iframe OU Fallback 3D Nativo
      surface === "native_3d"
        ? h(NativeFallback3D, props)
        : h(
            "div",
            {
              style: {
                position: "relative",
                flex: 1,
                minHeight: "530px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "#0b0e14",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              },
            },
            serverOnline === false &&
              h(
                "div",
                {
                  style: {
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border)",
                    background: "rgba(245, 158, 11, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                    fontSize: "11.5px",
                  },
                },
                h(
                  "span",
                  null,
                  "Claw3D não está rodando na porta 3430. Rode no terminal: ",
                  h("code", { className: "of-mono" }, START_CMD)
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "of-btn",
                    style: { fontSize: "11px", padding: "3px 8px" },
                    onClick: () => setSurface("native_3d"),
                  },
                  "Usar 3D Nativo enquanto isso"
                )
              ),
            browserAvailable && BrowserView
              ? h(BrowserView, {
                  key: `${surface}-${reloadTick}`,
                  url: targetUrl,
                  storage: "orgfy-claw3d-office",
                  label: surface === "claw3d_builder" ? "Claw3D Builder" : "Claw3D Escritório 3D",
                })
              : h("iframe", {
                  key: `${surface}-${reloadTick}`,
                  src: targetUrl,
                  title: "Claw3D Escritório 3D",
                  style: { width: "100%", height: "100%", flex: 1, border: "none", background: "#0b0e14" },
                  allow: "clipboard-read; clipboard-write; fullscreen",
                })
          )
    );
  };
}
