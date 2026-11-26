// Adaptado de CodeDen (MIT) commit b0b2a5a — Tema 3D leve "boardroom" (Sala de Reunião do Conselho da Holding) em Three.js procedural puro.
// Reutiliza o mesmo runtime Three.js do Andar 3D sem adicionar assets externos nem pesar o bundle.

import * as THREE from "three";
import type { Context } from "@buzz/author";

export interface BoardroomSeat {
  id: string;
  label: string;
  role: string;
  status: "active" | "working" | "planned";
  onClick?: () => void;
}

export interface Boardroom3DProps {
  seats: BoardroomSeat[];
  title?: string;
}

export function createBoardroom3DComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function Boardroom3DCanvas(props: Boardroom3DProps) {
    const mountRef = React.useRef<HTMLDivElement | null>(null);
    const [fitTick, setFitTick] = React.useState(0);

    React.useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const width = Math.max(320, container.clientWidth || 680);
      const height = Math.max(220, container.clientHeight || 280);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d0f13);

      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
      let theta = 0.65;
      let phi = 0.88;
      let radius = 11.5;

      const updateCamera = () => {
        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, 0.65, 0);
      };
      updateCamera();

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      // Iluminação suave estilo sala executiva
      const ambient = new THREE.AmbientLight(0xdbeafe, 0.65);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
      keyLight.position.set(5, 9, 6);
      scene.add(keyLight);

      const rimLight = new THREE.PointLight(0x3dd68c, 0.9, 18);
      rimLight.position.set(-4, 3.2, -3);
      scene.add(rimLight);

      // Piso + tapete central discreto
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 18),
        new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.9, metalness: 0.05 })
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const rug = new THREE.Mesh(
        new THREE.BoxGeometry(8.2, 0.02, 5.2),
        new THREE.MeshStandardMaterial({ color: 0x171b23, roughness: 0.95 })
      );
      rug.position.y = 0.01;
      scene.add(rug);

      // Mesa de reunião executiva
      const tableTop = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.14, 2.3),
        new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.35, metalness: 0.25 })
      );
      tableTop.position.set(0, 0.85, 0);
      scene.add(tableTop);

      // Friso luminoso central na mesa
      const inlay = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.02, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x3dd68c, emissive: 0x1a5c3c, emissiveIntensity: 0.7 })
      );
      inlay.position.set(0, 0.93, 0);
      scene.add(inlay);

      // Base da mesa
      for (const xOff of [-1.6, 1.6]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.22, 0.82, 14),
          new THREE.MeshStandardMaterial({ color: 0x181b22, metalness: 0.5, roughness: 0.4 })
        );
        leg.position.set(xOff, 0.41, 0);
        scene.add(leg);
      }

      // Painel de KPI na parede de fundo
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 3.6, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.85 })
      );
      wall.position.set(0, 1.8, -3.4);
      scene.add(wall);

      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 1.5, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x0b1512, emissive: 0x123828, emissiveIntensity: 0.85, roughness: 0.2 })
      );
      screen.position.set(0, 2.05, -3.28);
      scene.add(screen);

      // Cadeiras & avatares minimalistas para cada assento do Conselho
      const seats = props.seats.length > 0
        ? props.seats
        : [
            { id: "ceo", label: "CEO Holding", role: "Orquestração", status: "active" as const },
            { id: "orgfy", label: "OrgFy Core", role: "Operacional", status: "active" as const },
            { id: "lumen", label: "Lumen IPTV", role: "Operacional", status: "active" as const },
            { id: "saas", label: "SaaS Tributário", role: "Planejado", status: "planned" as const },
          ];

      const seatCoords: Array<[number, number, number]> = [
        [-3.25, 0, 0], // cabeceira esquerda (CEO Holding)
        [-1.3, 0, 1.65],
        [0.0, 0, 1.65],
        [1.3, 0, 1.65],
        [-1.3, 0, -1.65],
        [0.0, 0, -1.65],
        [1.3, 0, -1.65],
        [3.25, 0, 0],
      ];

      const pulseMeshes: THREE.Mesh[] = [];

      seats.slice(0, seatCoords.length).forEach((seat, idx) => {
        const [sx, , sz] = seatCoords[idx];
        const toneHex =
          seat.status === "working" ? 0x60a5fa : seat.status === "active" ? 0x3dd68c : 0x52525b;

        // Cadeira
        const chair = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.45, 0.62),
          new THREE.MeshStandardMaterial({ color: 0x1f2430, roughness: 0.7 })
        );
        chair.position.set(sx, 0.45, sz);
        scene.add(chair);

        // Busto estilizado minimalista
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.24, 0.42, 16),
          new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.5 })
        );
        body.position.set(sx, 0.9, sz);
        scene.add(body);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xd4d8e2, roughness: 0.4 })
        );
        head.position.set(sx, 1.28, sz);
        scene.add(head);

        // Anel de status luminoso sob a cadeira
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.36, 0.44, 24),
          new THREE.MeshBasicMaterial({ color: toneHex, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(sx, 0.03, sz);
        scene.add(ring);
        if (seat.status === "working") pulseMeshes.push(ring);
      });

      // Interação de órbita leve com arrasto do mouse
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const onDown = (e: MouseEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onMove = (e: MouseEvent) => {
        if (!dragging) return;
        theta -= (e.clientX - lastX) * 0.008;
        phi = Math.max(0.45, Math.min(1.25, phi - (e.clientY - lastY) * 0.006));
        lastX = e.clientX;
        lastY = e.clientY;
        updateCamera();
      };
      const onUp = () => {
        dragging = false;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        radius = Math.max(7.5, Math.min(16, radius + e.deltaY * 0.008));
        updateCamera();
      };

      const dom = renderer.domElement;
      dom.style.cursor = "grab";
      dom.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      dom.addEventListener("wheel", onWheel, { passive: false });

      let rafId = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        for (const m of pulseMeshes) {
          const s = 1 + Math.sin(t * 4) * 0.09;
          m.scale.set(s, s, 1);
        }
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const w = Math.max(320, container.clientWidth || 680);
        const hh = Math.max(220, container.clientHeight || 280);
        camera.aspect = w / hh;
        camera.updateProjectionMatrix();
        renderer.setSize(w, hh);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(rafId);
        dom.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        dom.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
      };
    }, [props.seats.length, fitTick]);

    return h(
      "div",
      {
        className: "of-card",
        "data-boardroom-3d": "true",
        style: { position: "relative", overflow: "hidden" },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 14px",
            borderBottom: "1px solid var(--border)",
            fontSize: "12px",
          },
        },
        h(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
          h("strong", null, props.title || "Sala de Reunião do Conselho · Tema Boardroom 3D"),
          h("span", { className: "of-pill", "data-tone": "done" }, `${props.seats.length} assentos`)
        ),
        h(
          "button",
          {
            type: "button",
            className: "of-btn",
            "data-variant": "ghost",
            style: { fontSize: "11px", padding: "3px 8px" },
            onClick: () => setFitTick((n) => n + 1),
          },
          "Enquadrar"
        )
      ),
      h("div", {
        ref: mountRef,
        style: { width: "100%", height: "270px", background: "#0d0f13" },
      }),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            padding: "8px 12px",
            borderTop: "1px solid var(--border)",
            background: "var(--panel)",
          },
        },
        props.seats.map((s) =>
          h(
            "button",
            {
              key: s.id,
              type: "button",
              className: "of-chip",
              onClick: s.onClick,
              title: `${s.label} — ${s.role}`,
            },
            h("span", {
              className: "of-dot",
              "data-tone": s.status === "working" ? "running" : s.status === "active" ? "done" : "idle",
            }),
            h("span", null, s.label),
            h("span", { className: "of-muted", style: { fontSize: "10px" } }, `· ${s.role}`)
          )
        )
      )
    );
  };
}
