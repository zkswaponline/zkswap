"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAIN, explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { CONTRACTS, bookLive } from "@/config/contracts";
import { KEYS } from "@/config/storage";
import { TreeView } from "@/components/access/TreeView";
import { Eyebrow, PixelButton, PixelLink } from "@/components/ui/kit";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { explain, rpcCall, waitForReceipt } from "@/lib/client";
import { bookCall, epochNow, hasAccessLive, listGroups, loadLeaves, loadPractice, savePass, savePractice, scopeFor, type Group } from "@/lib/zk/book";
import { commitmentOf, decodeIdentity, encodeIdentity, leafOf, newIdentity, rootOf, toHex32, type Identity } from "@/lib/zk/core";
import { useProver, type ProveResult } from "@/lib/zk/useProver";

const REVEALS = [
  { k: "Stays private", v: "Your secret, which entry in the tree is yours, and your expiry epoch." },
  { k: "Becomes public", v: "The wallet that records the proof, the group, the epoch and a one-time tag." },
  { k: "Never changes", v: "Your swaps. Address, tokens, amounts and activity stay visible on an EVM chain." },
];

export function AccessDesk() {
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const { prove, verify, phase } = useProver();
  const live = bookLive();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [expiry, setExpiry] = useState("");
  const [leaves, setLeaves] = useState<bigint[]>([]);
  const [epoch, setEpoch] = useState<bigint | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proof, setProof] = useState<ProveResult | null>(null);
  const [localOk, setLocalOk] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);

  const group = useMemo(() => groups.find((g) => g.id.toString() === groupId) ?? null, [groups, groupId]);
  const commitment = identity ? commitmentOf(identity) : null;

  const refresh = useCallback(async () => {
    try {
      const list = await listGroups();
      setGroups(list);
      setGroupId((v) => v || (list[list.length - 1]?.id.toString() ?? ""));
    } catch {
      setErr("The groups could not be read right now.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage and chain after mount
    void refresh();
    try {
      const saved = window.localStorage.getItem(KEYS.identity);
      if (saved) setIdentity(decodeIdentity(saved));
    } catch {
      // A damaged saved identity is ignored; the visitor can load the file again.
    }
  }, [refresh]);

  useEffect(() => {
    if (!group) return;
    let stop = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets what belongs to the previous group
    setProof(null);
    setLocalOk(null);
    setTx(null);
    setRecorded(false);
    void (async () => {
      try {
        const [l, e] = await Promise.all([loadLeaves(group.id), epochNow(group)]);
        if (stop) return;
        setLeaves(l);
        setEpoch(e);
        if (!group.practice && address) setRecorded(await hasAccessLive(group.id, address));
      } catch {
        if (!stop) setErr("That group could not be read right now.");
      }
    })();
    return () => {
      stop = true;
    };
  }, [group, address]);

  const recomputed = useMemo(() => toHex32(rootOf(leaves)), [leaves]);
  const rootMatches = group ? group.rootSeq === 0 || recomputed.toLowerCase() === group.root.toLowerCase() : null;

  const yours = useMemo(() => {
    if (!commitment || !/^\d{1,10}$/.test(expiry)) return null;
    const leaf = leafOf(commitment, BigInt(expiry));
    const i = leaves.findIndex((x) => x === leaf);
    return i < 0 ? null : i;
  }, [commitment, expiry, leaves]);

  const makeIdentity = () => {
    const id = newIdentity();
    setIdentity(id);
    window.localStorage.setItem(KEYS.identity, encodeIdentity(id));
    setNotice("New identity made in this browser. Download the file: without it, this membership cannot be proved from another device.");
  };

  const download = () => {
    if (!identity) return;
    const url = URL.createObjectURL(new Blob([encodeIdentity(identity)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "zkswap-access-identity.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const practiceStart = () => {
    if (!identity || !commitment) return setErr("Make an identity first.");
    const epochSeconds = 86_400;
    const now = BigInt(Math.floor(Date.now() / 1000 / epochSeconds));
    const exp = now + 30n;
    const leaf = leafOf(commitment, exp);
    const list = loadPractice();
    const id = String((list.reduce((m, g) => Math.max(m, Number(g.id)), 0) || 0) + 1);
    // Two filler entries, so the tree is not just you.
    const fill = [leafOf(BigInt(id) * 1009n + 7n, exp), leafOf(BigInt(id) * 2003n + 11n, exp)].map((x) => toHex32(x));
    list.push({ id, name: `Practice group ${id}`, epochSeconds, leaves: [fill[0], toHex32(leaf), fill[1]], state: "Open", desk: [{ tokenIn: "0x0000000000000000000000000000000000000000", tokenOut: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", label: "ETH to USDG" }] });
    savePractice(list);
    setExpiry(exp.toString());
    setGroupId(id);
    setErr(null);
    void refresh();
  };

  const onProve = async () => {
    setErr(null);
    setNotice(null);
    setProof(null);
    setLocalOk(null);
    setTx(null);
    if (!group) return setErr("Pick a group.");
    if (!identity) return setErr("Make or load an identity first.");
    if (!/^\d{1,10}$/.test(expiry)) return setErr("Enter the expiry epoch your curator gave you.");
    if (group.state !== "Open") return setErr(`This group is ${group.state.toLowerCase()}; it does not take proofs now.`);
    if (!group.practice && !address) return open();
    if (rootMatches === false) return setErr("The published root does not match the published leaves. Ask the group's curator before going on.");
    try {
      const e = await epochNow(group);
      setEpoch(e);
      const binder = BigInt(address ?? "0x1");
      const result = await prove({ identity, expiryEpoch: BigInt(expiry), leaves, scope: scopeFor(group), epoch: e, binder });
      setProof(result);
      const ok = await verify(result.proof, result.publicInputs);
      setLocalOk(ok);
      if (ok && group.practice) savePass({ groupId: group.id.toString(), epoch: e.toString(), nullifier: toHex32(result.nullifier) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The proof could not be made.");
    }
  };

  const onRecord = async () => {
    if (!group || !proof || epoch === null) return;
    setSending(true);
    setErr(null);
    try {
      const call = bookCall("recordAccess", [group.id, proof.proof, toHex32(proof.root), Number(epoch), toHex32(proof.nullifier)]);
      // A read of the same call first: a stale epoch or a used tag is cheaper to learn here than in a wallet.
      await rpcCall("eth_call", [{ from: address, to: call.to, data: call.data, gas: `0x${(3_900_000).toString(16)}` }, "latest"]);
      const hash = await sendTransaction(call);
      setTx(hash);
      const r = await waitForReceipt(hash);
      if (!r.ok) throw new Error("The transaction reverted.");
      setRecorded(true);
    } catch (e) {
      setErr(explain(e));
    } finally {
      setSending(false);
    }
  };

  const busy = phase !== "idle";
  const phaseText = phase === "loading" ? "Loading the prover (about 11 MB, once)…" : phase === "proving" ? "Proving in this browser. This can take a while on a phone." : phase === "checking" ? "Checking the proof locally…" : null;

  return (
    <>
      <section className="split sec" style={{ alignItems: "stretch" }}>
        <div style={{ paddingTop: 170, paddingBottom: 60, borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <div className="pad">
            <Eyebrow>Access proof</Eyebrow>
            <h1 className="h-page">Show you belong, not who you are</h1>
            <p className="lede">Optional. Prove a live membership of a group from your browser, and group screens open in this interface. An access proof does not make a swap anonymous: address, tokens, amounts and activity stay visible on an EVM chain.</p>
            {live ? null : (
              <p className="note warn mt-5" data-testid="practice-note">
                Practice mode. The access book is not deployed yet, so groups live in this browser. The proof below is real and checked locally; nothing is recorded on chain.
              </p>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 rule">
            <div className="p-10 max-[639px]:pb-3" style={{ minWidth: 0 }}>
              <label className="fld">
                Group
                <select className="inp" value={groupId} onChange={(e) => setGroupId(e.target.value)} data-testid="group-select">
                  {groups.length === 0 ? <option value="">No groups yet</option> : null}
                  {groups.map((g) => (
                    <option key={g.id.toString()} value={g.id.toString()}>
                      #{g.id.toString()} {g.name} · {g.state}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="p-10" style={{ minWidth: 0 }}>
              <label className="fld">
                Your expiry epoch
                <input className="inp" inputMode="numeric" placeholder={epoch !== null ? `now ${epoch}` : "epoch number"} value={expiry} onChange={(e) => setExpiry(e.target.value.trim())} data-testid="expiry" />
              </label>
              {group && /^\d{1,10}$/.test(expiry) ? (
                <p className="t-mono-s mt-2">Ends about {new Date(Number(BigInt(expiry) + 1n) * group.epochSeconds * 1000).toISOString().slice(0, 10)}.</p>
              ) : null}
            </div>
          </div>

          <div className="p-10 rule" style={{ minWidth: 0 }}>
            <p className="fld">Your identity</p>
            {identity ? (
              <div className="mt-3">
                <p className="t-mono-s">COMMITMENT (give this to a curator, it reveals nothing else)</p>
                <p className="addr mt-1" data-testid="commitment">
                  {toHex32(commitment!)}
                </p>
              </div>
            ) : (
              <p className="t-body mt-2">An identity is two random numbers kept in this browser. No wallet needed to make one.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="sbtn" onClick={makeIdentity} data-testid="make-identity">
                {identity ? "Make a new one" : "Make an identity"}
              </button>
              <button type="button" className="sbtn" disabled={!identity} onClick={download}>
                Download file
              </button>
              <label className="sbtn cursor-pointer">
                Load file
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || f.size > 4096) return;
                    try {
                      const id = decodeIdentity(await f.text());
                      setIdentity(id);
                      window.localStorage.setItem(KEYS.identity, encodeIdentity(id));
                      setErr(null);
                    } catch (x) {
                      setErr(x instanceof Error ? x.message : "That file could not be read.");
                    }
                  }}
                />
              </label>
              {!live ? (
                <button type="button" className="sbtn" disabled={!identity} onClick={practiceStart} data-testid="practice-start">
                  Start a practice group with me in it
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-10 rule" style={{ minWidth: 0 }}>
            <div className="flex flex-wrap items-center gap-3">
              <PixelButton tone="light" disabled={busy || !group || !identity} onClick={onProve} data-testid="prove" style={{ width: 240 }}>
                {busy ? "Working…" : "Make the proof"}
              </PixelButton>
              <Link className="sbtn" href="/access/manage">
                Run a group
              </Link>
              <Link className="sbtn" href="/access/desk">
                Member desk
              </Link>
            </div>
            {phaseText ? (
              <p className="t-mono-s mt-3" data-testid="prover-phase">
                {phaseText}
              </p>
            ) : null}
            {notice ? <p className="note mt-3">{notice}</p> : null}
            {err ? (
              <p className="note bad mt-3" role="alert" data-testid="access-error">
                {err}
              </p>
            ) : null}
            {proof ? (
              <div className="mt-5" data-testid="proof-result">
                <p className={`note ${localOk ? "good" : localOk === false ? "bad" : ""}`} data-testid="proof-local">
                  {localOk === null ? "Proof made, checking…" : localOk ? `Proof made in ${(proof.ms / 1000).toFixed(1)} s on this device, and it verifies locally.` : "The proof did not verify locally."}
                </p>
                <dl className="mt-3">
                  <div className="kv">
                    <dt>Size</dt>
                    <dd>{(proof.proof.length - 2) / 2} bytes</dd>
                  </div>
                  <div className="kv">
                    <dt>Root</dt>
                    <dd className="addr">{toHex32(proof.root)}</dd>
                  </div>
                  <div className="kv">
                    <dt>One-time tag</dt>
                    <dd className="addr">{toHex32(proof.nullifier)}</dd>
                  </div>
                  <div className="kv">
                    <dt>Epoch</dt>
                    <dd>{epoch?.toString()}</dd>
                  </div>
                  <div className="kv">
                    <dt>Bound to wallet</dt>
                    <dd className="addr">{address ?? "None (practice)"}</dd>
                  </div>
                </dl>
                {group?.practice ? (
                  <PixelLink href="/access/desk" tone="light" className="mt-4">
                    Open the member desk
                  </PixelLink>
                ) : !onRobinhoodChain ? (
                  <PixelButton tone="light" className="mt-4" onClick={() => void switchNetwork()}>
                    Switch network
                  </PixelButton>
                ) : (
                  <PixelButton tone="light" className="mt-4" disabled={sending || recorded || !localOk} onClick={onRecord} data-testid="record" style={{ width: 280 }}>
                    {recorded ? "Recorded this epoch" : sending ? "Confirm in wallet…" : "Record on chain, from this wallet"}
                  </PixelButton>
                )}
                {tx ? (
                  <p className="t-mono-s mt-3">
                    <a className="link" href={explorerTx(tx)} target="_blank" rel="noreferrer">
                      {shortAddress(tx, 10, 8)}
                    </a>{" "}
                    {recorded ? "· confirmed" : "· waiting"}
                  </p>
                ) : null}
                {recorded ? (
                  <PixelLink href={`/access/desk?group=${group?.id}`} tone="light" className="mt-4">
                    Open the member desk
                  </PixelLink>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative" style={{ background: "#141414", paddingTop: 110, minWidth: 0, color: "#fff" }}>
          <div className="px-8 pb-8">
            <TreeView leafCount={leaves.length} yours={yours} root={group ? (leaves.length ? recomputed : null) : null} />
            {group ? (
              <p className={`note mt-4 ${rootMatches ? "good" : "bad"}`} style={{ color: "#fff" }} data-testid="root-check">
                {group.rootSeq === 0 ? "No root published yet." : rootMatches ? "Root recomputed in your browser from the published entries: it matches." : "The published root does not match the published entries."}
              </p>
            ) : null}
            {yours !== null ? (
              <p className="t-mono-s mt-3" style={{ color: "#fff" }} data-testid="found-self">
                Your entry is in this tree. Nobody else can tell which one from a proof.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="sec rule">
        <div className="grid4">
          {REVEALS.map((r) => (
            <div key={r.k} className="cell">
              <p className="t-mono-s uppercase" style={{ color: "var(--faint)" }}>
                {r.k}
              </p>
              <p className="mt-3 text-[18px] leading-[25px] font-light">{r.v}</p>
            </div>
          ))}
          <div className="cell">
            <p className="t-mono-s uppercase" style={{ color: "var(--faint)" }}>
              Contracts
            </p>
            {live ? (
              <p className="mt-3 text-[14px] leading-[22px]">
                <a className="addr link" href={explorerAddress(CONTRACTS.book)} target="_blank" rel="noreferrer">
                  ZkswapAccessBook {shortAddress(CONTRACTS.book)}
                </a>
                <br />
                <span className="t-mono-s">On {CHAIN.name}</span>
              </p>
            ) : (
              <p className="mt-3 text-[18px] leading-[25px] font-light">ZkswapAccessBook is written and tested, and not deployed yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
