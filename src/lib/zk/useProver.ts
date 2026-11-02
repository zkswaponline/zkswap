"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccessRequest } from "@/lib/zk/core";

/* Talks to the prover worker (public/zk/prover.js). The worker is created on first use; it downloads about 11 MB once. */

export type ProveResult = { proof: string; publicInputs: string[]; nullifier: bigint; root: bigint; index: number; ms: number };
type Answer = { id: number; ok: boolean; error?: string } & Record<string, unknown>;

export function useProver() {
  const ref = useRef<Worker | null>(null);
  const seq = useRef(0);
  const waiting = useRef(new Map<number, { ok: (v: Answer) => void; no: (e: Error) => void }>());
  const [phase, setPhase] = useState<"idle" | "loading" | "proving" | "checking">("idle");

  const worker = useCallback(() => {
    if (ref.current) return ref.current;
    const w = new Worker("/zk/prover.js", { type: "module" });
    w.onmessage = (e: MessageEvent<Answer>) => {
      const p = waiting.current.get(e.data.id);
      if (!p) return;
      waiting.current.delete(e.data.id);
      if (e.data.ok) p.ok(e.data);
      else p.no(new Error(e.data.error ?? "The prover stopped."));
    };
    w.onerror = () => {
      for (const p of waiting.current.values()) p.no(new Error("The prover could not start in this browser."));
      waiting.current.clear();
    };
    ref.current = w;
    return w;
  }, []);

  useEffect(
    () => () => {
      ref.current?.terminate();
      ref.current = null;
    },
    [],
  );

  const ask = useCallback(
    (msg: Record<string, unknown>) =>
      new Promise<Answer>((ok, no) => {
        const id = ++seq.current;
        waiting.current.set(id, { ok, no });
        worker().postMessage({ id, ...msg });
      }),
    [worker],
  );

  const prove = useCallback(
    async (request: AccessRequest): Promise<ProveResult> => {
      try {
        setPhase("loading");
        await ask({ kind: "warm" });
        setPhase("proving");
        const a = await ask({ kind: "prove", request });
        return { proof: a.proof as string, publicInputs: a.publicInputs as string[], nullifier: a.nullifier as bigint, root: a.root as bigint, index: a.index as number, ms: a.ms as number };
      } finally {
        setPhase("idle");
      }
    },
    [ask],
  );

  const verify = useCallback(
    async (proof: string, publicInputs: string[]) => {
      try {
        setPhase("checking");
        const a = await ask({ kind: "verify", proof, publicInputs });
        return a.valid === true;
      } finally {
        setPhase("idle");
      }
    },
    [ask],
  );

  return { prove, verify, phase };
}
