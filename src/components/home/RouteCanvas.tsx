"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useChain } from "@/components/providers/ChainProvider";

/* The product panel on the home page: the real order of a swap on this site, drawn as a graph. It is a map, not a live run. */

const NODES = [
  { x: 2, y: 34, t: "Token in", s: "ETH or any ERC-20" },
  { x: 25, y: 34, t: "Quote", s: "4 venues, 1 block" },
  { x: 48, y: 20, t: "Best route", s: "Fee, impact, minimum", hot: true },
  { x: 72, y: 34, t: "Permission", s: "Exact by default" },
  { x: 48, y: 58, t: "Access proof", s: "Optional, app level" },
  { x: 72, y: 58, t: "Review", s: "Decode + simulate" },
] as const;

function Sphere() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const S = 150;
    c.width = S * 2;
    c.height = S * 2;
    g.scale(2, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(c);
    const pts: [number, number, number][] = [];
    const N = 900;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    const draw = (t: number) => {
      raf = reduced ? 0 : requestAnimationFrame(draw);
      if (!visible) return;
      g.clearRect(0, 0, S, S);
      const a = t / 6000;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (const [x, y, z] of pts) {
        const rx = x * ca - z * sa;
        const rz = x * sa + z * ca;
        if (rz < -0.05) continue;
        g.fillStyle = `rgba(255,255,255,${0.2 + rz * 0.75})`;
        g.fillRect(S / 2 + rx * (S / 2 - 3), S / 2 + y * (S / 2 - 3), 1.3, 1.3);
      }
    };
    draw(0);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);
  return <canvas ref={ref} style={{ width: 150, height: 150 }} aria-hidden="true" />;
}

export function RouteCanvas() {
  const [mode, setMode] = useState<"routes" | "proof">("routes");
  const { snap } = useChain();
  const proofDim = mode === "routes";
  return (
    <div className="canvas dotted" data-testid="route-canvas" style={{ color: "#fff" }}>
      <div className="canvas-left">
        <button type="button" className={`tgl w-full ${mode === "routes" ? "on" : ""}`} onClick={() => setMode("routes")} style={{ background: mode === "routes" ? "#fff" : "transparent" }}>
          ROUTES
        </button>
        <button type="button" className={`tgl mt-2 w-full ${mode === "proof" ? "on" : ""}`} onClick={() => setMode("proof")} style={{ background: mode === "proof" ? "#fff" : "transparent" }}>
          PROOF
        </button>
        <p className="t-mono mt-6" style={{ fontSize: 10, lineHeight: "12px", color: "#fff" }}>
          VENUES
        </p>
        <ul className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Venues">
          {["V2", "V3", "V4", "PN"].map((v) => (
            <li key={v} className="grid place-items-center border" style={{ height: 36, borderColor: "rgba(255,255,255,.2)", fontFamily: "var(--font-gasoek)", fontSize: 12 }}>
              {v}
            </li>
          ))}
        </ul>
        <p className="t-mono mt-8" style={{ fontSize: 10, color: "#fff" }}>
          BLOCK {snap?.block?.toLocaleString("en-US") ?? "—"}
        </p>
      </div>
      <div className="absolute" style={{ left: "calc(50% + 60px)", top: 14 }}>
        <Sphere />
      </div>
      <div className="absolute max-[809px]:left-0" style={{ left: 260, right: 20, top: 40, bottom: 130 }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M14 40 H25 M39 40 C44 40 44 26 48 26 M62 26 C68 26 66 40 72 40" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M39 40 C44 40 44 64 48 64 M62 64 H72" fill="none" stroke="rgba(255,255,255,.3)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M80 48 V58" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        {NODES.map((n) => {
          const isProof = n.t === "Access proof";
          return (
            <div key={n.t} className={`node ${"hot" in n ? "hot" : ""}`} style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: isProof ? (proofDim ? 0.55 : 1) : proofDim ? 1 : 0.55, transition: "opacity .3s", minWidth: 0, width: "22%" }}>
              <i aria-hidden="true" className="max-[809px]:hidden" />
              <span className="min-w-0">
                <b>{n.t}</b>
                <small>{n.s}</small>
              </span>
            </div>
          );
        })}
      </div>
      <div className="prompt flex flex-wrap items-center justify-between gap-3">
        <p className="t-mono" style={{ color: "rgba(255,255,255,.75)" }}>
          {mode === "routes" ? "The wallet signs last, and it signs a direct venue transaction." : "A proof opens group screens in this interface. The swap itself stays visible on chain."}
        </p>
        <Link href={mode === "routes" ? "/swap" : "/access"} className="pill" data-testid="canvas-go">
          {mode === "routes" ? "Compare routes" : "Open access proof"}
        </Link>
      </div>
    </div>
  );
}
