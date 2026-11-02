"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ChainSnapshot } from "@/lib/server/snapshot";

/* One poll of /api/chain for the whole site, plus what was sampled since the page opened. Nothing here is stored. */

type Sample = { at: number; block: number | null; txs: number | null; gas: number | null; eth: number | null };
type ChainState = { snap: ChainSnapshot | null; samples: Sample[]; failed: boolean };

const Ctx = createContext<ChainState>({ snap: null, samples: [], failed: false });
const POLL = 12_000;
const KEEP = 40;

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChainState>({ snap: null, samples: [], failed: false });
  const last = useRef<number | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/chain", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const snap = (await r.json()) as ChainSnapshot;
        if (stop) return;
        setState((s) => {
          const fresh = snap.block !== null && snap.block !== last.current;
          last.current = snap.block;
          const samples = fresh ? [...s.samples, { at: Date.now(), block: snap.block, txs: snap.blockTxs, gas: snap.gasGwei, eth: snap.ethUsd }].slice(-KEEP) : s.samples;
          return { snap, samples, failed: false };
        });
      } catch {
        if (!stop) setState((s) => ({ ...s, failed: true }));
      }
    };
    void tick();
    const id = setInterval(() => {
      if (!document.hidden) void tick();
    }, POLL);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useChain = () => useContext(Ctx);
