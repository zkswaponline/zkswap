"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { useEffect, useRef, useState } from "react";

/* Everything here is read from chain through /api/chain. Before the first answer the slots show a dash. */

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

export function ThreeStats() {
  const { snap } = useChain();
  const rows = [
    { v: snap?.block != null ? compact(snap.block) : "—", cap: "Newest Robinhood Chain block, read through this site." },
    { v: snap?.gasGwei != null ? `${snap.gasGwei < 0.01 ? snap.gasGwei.toFixed(4) : snap.gasGwei.toFixed(3)}` : "—", unit: "gwei", cap: "Gas price the chain reports right now." },
    { v: snap?.ethUsd != null ? `$${Math.round(snap.ethUsd).toLocaleString("en-US")}` : "—", cap: "ETH / USD from the Chainlink feed on this chain." },
  ];
  return (
    <div className="grid4 rule" style={{ borderBottom: "1px solid var(--line)" }} data-testid="stats">
      <div className="cell max-[809px]:hidden" aria-hidden="true" style={{ borderBottom: 0, borderRight: 0 }} />
      {rows.map((r) => (
        <div key={r.cap} className="stat" style={{ borderBottom: 0 }}>
          <p className="num" data-testid="stat-value">
            {r.v}
            {r.unit ? <span style={{ fontSize: "0.42em", letterSpacing: 0, marginLeft: 6 }}>{r.unit}</span> : null}
          </p>
          <p className="t-mono mt-3" style={{ maxWidth: 215 }}>
            {r.cap}
          </p>
        </div>
      ))}
    </div>
  );
}

export function BlockTag() {
  const { snap, failed } = useChain();
  return (
    <span className="film-tag t-mono" style={{ color: "#fff" }}>
      <span className={`zs-dot ${failed ? "bad" : ""}`} aria-hidden="true" />
      {snap?.block != null ? `Block ${snap.block.toLocaleString("en-US")}` : "Reading the chain"}
    </span>
  );
}

/** Ring gauge drawn from tick marks. */
function Ring({ value, max, children }: { value: number | null; max: number; children: React.ReactNode }) {
  const f = value === null || max <= 0 ? 0 : Math.min(1, value / max);
  const R = 92;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto my-auto grid place-items-center" style={{ width: 240, height: 240, maxWidth: "100%" }}>
      <svg width="240" height="240" viewBox="0 0 240 240" className="absolute inset-0" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="120" cy="120" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="30" />
        <circle cx="120" cy="120" r={R} fill="none" stroke="#e8e8e8" strokeWidth="30" strokeDasharray={`${C * f} ${C}`} style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)" }} />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * 2 * Math.PI;
          return <line key={i} x1={120 + 62 * Math.cos(a)} y1={120 + 62 * Math.sin(a)} x2={120 + 70 * Math.cos(a)} y2={120 + 70 * Math.sin(a)} stroke="rgba(255,255,255,.3)" />;
        })}
      </svg>
      <div className="text-center">{children}</div>
    </div>
  );
}

function CardHead({ title, sub, v, icon }: { title: string; sub: string; v: string; icon: React.ReactNode }) {
  return (
    <>
      <div className="dhead">
        <span className="tile">{icon}</span>
        <h3>{title}</h3>
        <span className="v">{v}</span>
      </div>
      <p className="t-body mt-3">{sub}</p>
    </>
  );
}

const Ic = {
  ring: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 2.5A7.5 7.5 0 0117.5 10" strokeWidth="3" />
    </svg>
  ),
  bars: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 17V9M10 17V3M16 17v-5" />
    </svg>
  ),
  gauge: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 14a7 7 0 1114 0" />
      <path d="M10 14l3.5-4.5" />
    </svg>
  ),
  line: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 15l4.5-5 3.5 3 6-7" />
    </svg>
  ),
};

export function Dash() {
  const { snap, samples } = useChain();
  const txs = samples.map((s) => s.txs ?? 0);
  const maxTx = Math.max(1, ...txs);
  const gasNow = snap?.gasGwei ?? null;
  const gasMax = Math.max(0.000001, ...samples.map((s) => s.gas ?? 0));
  const eth = samples.map((s) => s.eth).filter((v): v is number => v !== null);
  return (
    <div className="dash" data-testid="dash">
      <div className="dcard">
        <CardHead title="Block pace" sub="Average seconds per block, over the last 3,000 blocks." v={snap?.blockPace != null ? `${snap.blockPace.toFixed(2)}s` : "—"} icon={Ic.ring} />
        <Ring value={snap?.blockPace ?? null} max={1}>
          <p style={{ fontSize: 56, lineHeight: "56px", letterSpacing: -2 }}>{snap?.blockTxs ?? "—"}</p>
          <p className="t-mono" style={{ fontSize: 11 }}>
            txs, newest block
          </p>
        </Ring>
      </div>
      <div className="dcard">
        <CardHead title="Transactions per block" sub="One line per new block since you opened this page." v={samples.length ? `${samples.length} read` : "—"} icon={Ic.bars} />
        <div className="relative mt-auto flex items-end gap-[3%]" style={{ height: 240, borderBottom: "1px solid var(--line2)" }}>
          {samples.length === 0 ? <p className="t-mono m-auto">Waiting for the first block</p> : null}
          {samples.slice(-16).map((s) => (
            <span key={s.at} className="relative flex-1" style={{ height: `${Math.max(6, ((s.txs ?? 0) / maxTx) * 100)}%`, borderLeft: "1px solid rgba(255,255,255,.6)", transition: "height .6s" }}>
              <i className="absolute block" style={{ width: 7, height: 7, borderRadius: 9, background: "#fff", top: -3, left: -4 }} />
            </span>
          ))}
        </div>
      </div>
      <div className="dcard">
        <CardHead title="Gas price" sub="Against the highest reading since you opened this page." v={gasNow != null ? `${gasNow.toFixed(4)}` : "—"} icon={Ic.gauge} />
        <Ring value={gasNow} max={gasMax}>
          <p style={{ fontSize: 44, lineHeight: "46px", letterSpacing: -1.5 }}>{gasNow != null ? gasNow.toFixed(3) : "—"}</p>
          <p className="t-mono" style={{ fontSize: 11 }}>
            gwei
          </p>
        </Ring>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[18px]" data-testid="book-groups">
              {snap?.book?.groups ?? "—"}
            </p>
            <p className="t-mono-s">GROUPS</p>
          </div>
          <div>
            <p className="text-[18px]">{snap?.book?.records ?? "—"}</p>
            <p className="t-mono-s">RECORDS</p>
          </div>
        </div>
      </div>
      <div className="dcard wide">
        <CardHead title="ETH / USD" sub="Chainlink feed on Robinhood Chain, sampled since you opened this page. A reference for gas costs, not a trading signal." v={snap?.ethUsdAt ? new Date(snap.ethUsdAt * 1000).toISOString().slice(11, 16) + " UTC" : "—"} icon={Ic.line} />
        <div className="mt-6 grid flex-1 grid-cols-1 gap-6 sm:grid-cols-[220px_1fr]">
          <div>
            <p style={{ fontSize: 70, lineHeight: "70px", fontWeight: 300 }}>{snap?.ethUsd != null ? Math.round(snap.ethUsd).toLocaleString("en-US") : "—"}</p>
            <p className="t-mono-s mt-3">USD PER ETH</p>
          </div>
          <Spark values={eth} />
        </div>
      </div>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const H = 200;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${values.length > 1 ? (i / (values.length - 1)) * w : w / 2},${hi === lo ? H / 2 : H - ((v - lo) / (hi - lo)) * (H - 10) - 5}`);
  return (
    <div ref={ref} className="dotted min-w-0" style={{ height: H }}>
      {values.length > 1 ? (
        <svg width={w} height={H} aria-hidden="true">
          <polyline points={pts.join(" ")} fill="none" stroke="#fff" strokeWidth="1.5" />
        </svg>
      ) : (
        <p className="t-mono p-4">The line starts with the second reading.</p>
      )}
    </div>
  );
}
