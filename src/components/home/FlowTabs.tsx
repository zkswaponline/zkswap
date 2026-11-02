"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ASSETS } from "@/config/assets";

const TABS = [
  {
    id: "Quote",
    img: ASSETS.tabs.quote,
    say: "Every venue with a pool answers at the same block, so the rows can be compared with each other.",
    small: "Output, pool fee, cost against current price, minimum received.",
    go: { href: "/swap", label: "COMPARE ROUTES" },
    rows: [["Router", "Quoter call"], ["Block", "One, for all rows"], ["Hooks", "Flagged"]],
  },
  {
    id: "Permission",
    img: ASSETS.tabs.permission,
    say: "Before anything is approved you see the spender by name, what it holds today, and the exact amount this swap needs.",
    small: "Unlimited only when you tick it yourself.",
    go: { href: "/permissions", label: "SEE MY PERMISSIONS" },
    rows: [["Default", "Exact amount"], ["Permit2", "Two layers shown"], ["Lowering", "One transaction"]],
  },
  {
    id: "Review",
    img: ASSETS.tabs.review,
    say: "The bytes your wallet will sign are read back into plain lines, then run as a simulation from your address.",
    small: "A failed simulation keeps the wallet closed.",
    go: { href: "/guides/reading-calldata", label: "READ THE GUIDE" },
    rows: [["Decoded", "From raw bytes"], ["Simulated", "Newest block"], ["Signed", "In your wallet"]],
  },
  {
    id: "Proof",
    img: ASSETS.tabs.proof,
    say: "Optional. A browser-made proof shows you hold a live membership of a group, without saying which one.",
    small: "It does not make a swap anonymous. Address, tokens and amounts stay visible.",
    go: { href: "/access", label: "OPEN ACCESS PROOF" },
    rows: [["Circuit", "Noir, membership + expiry"], ["Runs in", "A browser worker"], ["Gate", "App level"]],
  },
] as const;

export function FlowTabs() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setI((v) => (v + 1) % TABS.length), 7000);
    return () => clearTimeout(id);
  }, [i, paused]);
  const t = TABS[i];
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="tabs" role="tablist">
        {TABS.map((x, k) => (
          <button key={x.id} type="button" role="tab" aria-selected={k === i} className={`tab ${k === i ? "on" : ""}`} onClick={() => setI(k)} data-testid={`flow-${x.id}`}>
            {x.id.toUpperCase()}
            {k === i && !paused ? <span key={i} className="tab-bar" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <div className="tabs-body" role="tabpanel">
        <div className="tabs-art" style={{ backgroundImage: `url(${t.img})` }}>
          <div className="win">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
              <span aria-hidden="true">●●●</span>
              <span className="t-mono" style={{ fontSize: 11, color: "#fff" }}>
                {t.id}
              </span>
            </div>
            <div className="win-b">
              {t.rows.map(([a, b]) => (
                <div key={a} className="win-row">
                  <span style={{ color: "rgba(255,255,255,.55)" }}>{a}</span>
                  <span style={{ textAlign: "right" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-10 p-10">
          <p style={{ fontSize: 22, lineHeight: "26.4px", maxWidth: 500 }}>{t.say}</p>
          <div>
            <p className="lede" style={{ marginTop: 0 }}>
              {t.small}
            </p>
            <Link href={t.go.href} className="pill mt-4">
              {t.go.label}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
