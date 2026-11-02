"use client";

import { useCallback, useEffect, useState } from "react";
import { explorerAddress, shortAddress } from "@/config/brand";
import { SPENDERS, UNISWAP, spenderInfo } from "@/config/dex";
import { tokenByAddress } from "@/config/tokens";
import { Eyebrow, PixelButton } from "@/components/ui/kit";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { waitForReceipt } from "@/lib/client";
import { approveTx, permit2ApproveTx } from "@/lib/swap/build";
import { isUnlimited } from "@/lib/swap/facts";
import { showAmount } from "@/lib/swap/flow";

type Answer = { owner: string; checkedTokens: number; checkedSpenders: number; rows: { token: string; spender: string; amount: string }[]; permit2: { token: string; spender: string; amount: string; expiration: string }[]; failed: number };
type Info = Record<string, { symbol: string; decimals: number }>;

/** What the wallet has allowed to the venues this site knows, with a one-click way to take it back. */
export function PermissionsView() {
  const { address, onRobinhoodChain, sendTransaction } = useWallet();
  const { open } = useWalletModal();
  const [pasted, setPasted] = useState("");
  const [extra, setExtra] = useState("");
  const [data, setData] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<Info>({});
  const [act, setAct] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<number | null>(null);

  const owner = /^0x[0-9a-fA-F]{40}$/.test(pasted.trim()) ? pasted.trim() : address;

  const load = useCallback(async () => {
    if (!owner) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/permissions?owner=${owner}&tokens=${encodeURIComponent(extra.trim())}`);
      const j = (await r.json()) as Answer & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "The allowances could not be read.");
      setData(j);
      setReadAt(Date.now());
      const need = [...new Set([...j.rows.map((x) => x.token), ...j.permit2.map((x) => x.token)])].filter((t) => !tokenByAddress(t));
      const found: Info = {};
      await Promise.all(
        need.map(async (t) => {
          const q = await fetch(`/api/token-info?address=${t}`).catch(() => null);
          if (q?.ok) found[t] = (await q.json()) as { symbol: string; decimals: number };
        }),
      );
      setInfo(found);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The allowances could not be read.");
    } finally {
      setBusy(false);
    }
  }, [owner, extra]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads chain state when the wallet appears
    if (address && !pasted) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the connected wallet changes
  }, [address]);

  const meta = (t: string) => tokenByAddress(t) ?? info[t] ?? { symbol: shortAddress(t), decimals: 18 };
  const mine = owner && address && owner.toLowerCase() === address.toLowerCase() && onRobinhoodChain;
  const zero = async (id: string, tx: { to: string; data: string; value?: bigint }) => {
    setAct(id);
    setErr(null);
    try {
      const hash = await sendTransaction(tx);
      await waitForReceipt(hash);
      await load();
    } catch (e) {
      const c = e as { code?: number; message?: string };
      setErr(c?.code === 4001 ? "The request was declined in the wallet." : (c?.message ?? "The transaction did not go through.").slice(0, 220));
    } finally {
      setAct(null);
    }
  };

  const rows = data?.rows ?? [];
  const inner = data?.permit2 ?? [];
  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>Permissions</Eyebrow>
        <h1 className="h-page">What you have allowed</h1>
        <p className="lede">Allowances you have given to the venues this site can use, read now from chain. Each one can be set back to zero with one transaction you sign.</p>
      </div>
      <div className="split rule mt-[60px]">
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <div className="grid gap-4">
            <label className="fld">
              Read another address (optional)
              <input className="inp mono" placeholder={address ?? "0x…"} value={pasted} onChange={(e) => setPasted(e.target.value)} data-testid="perm-owner" />
            </label>
            <label className="fld">
              Extra tokens, comma separated (optional, up to 4)
              <input className="inp mono" placeholder="0x…, 0x…" value={extra} onChange={(e) => setExtra(e.target.value)} />
            </label>
            {owner ? (
              <PixelButton tone="light" disabled={busy} onClick={load} data-testid="perm-load">
                {busy ? "Reading…" : "Read allowances"}
              </PixelButton>
            ) : (
              <PixelButton tone="light" onClick={open}>
                Connect wallet
              </PixelButton>
            )}
          </div>
          <div className="mt-8">
            <p className="t-mono-s">SPENDERS THIS PAGE ASKS ABOUT</p>
            <ul className="mt-3 grid gap-3">
              {SPENDERS.map((s) => (
                <li key={s.address} className="text-[14px] font-light" style={{ color: "var(--muted)" }}>
                  <a className="link" href={explorerAddress(s.address)} target="_blank" rel="noreferrer" style={{ color: "var(--fg)" }}>
                    {s.label}
                  </a>
                  . {s.what}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-10" style={{ minWidth: 0 }}>
          <p className="note">This page asks about the listed tokens and these spenders. It does not search your history, so an approval to any other contract will not appear here. An empty list does not mean you have no approvals anywhere.</p>
          {err ? (
            <p className="note bad mt-3" role="alert">
              {err}
            </p>
          ) : null}
          {data ? (
            <div className="mt-6" data-testid="perm-result">
              <p className="t-mono-s">
                {data.checkedTokens} TOKENS × {data.checkedSpenders} SPENDERS CHECKED FOR {shortAddress(data.owner, 8, 6)}
                {data.failed ? ` · ${data.failed} READS FAILED` : ""}
              </p>
              {rows.length === 0 && inner.length === 0 ? (
                <p className="t-22 mt-4" data-testid="perm-empty">
                  Nothing above zero among these.
                </p>
              ) : null}
              <ul className="mt-3">
                {rows.map((r) => {
                  const m = meta(r.token);
                  const id = `${r.token}:${r.spender}`;
                  return (
                    <li key={id} className="kv" data-testid="perm-row">
                      <dt>{spenderInfo(r.spender)?.label ?? shortAddress(r.spender)}</dt>
                      <dd className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          {m.symbol}: {isUnlimited(BigInt(r.amount)) ? "UNLIMITED" : showAmount(r.amount, m.decimals)}
                        </span>
                        {mine ? (
                          <button type="button" className="sbtn" disabled={act !== null} onClick={() => zero(id, approveTx(r.token, r.spender, 0n))} data-testid="perm-zero">
                            {act === id ? "Confirm in wallet…" : "Set to zero"}
                          </button>
                        ) : null}
                      </dd>
                    </li>
                  );
                })}
                {inner.map((r) => {
                  const m = meta(r.token);
                  const id = `p2:${r.token}`;
                  const live = readAt !== null && Number(r.expiration) * 1000 > readAt;
                  return (
                    <li key={id} className="kv">
                      <dt>Inside Permit2, to the Universal Router</dt>
                      <dd className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          {m.symbol}: {showAmount(r.amount, m.decimals)} · {live ? `until ${new Date(Number(r.expiration) * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC` : "expired"}
                        </span>
                        {mine && live ? (
                          <button type="button" className="sbtn" disabled={act !== null} onClick={() => zero(id, permit2ApproveTx(r.token, UNISWAP.universalRouter, 0n, 0n))}>
                            {act === id ? "Confirm in wallet…" : "Set to zero"}
                          </button>
                        ) : null}
                      </dd>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <div className="rule" style={{ height: 80 }} />
    </section>
  );
}
