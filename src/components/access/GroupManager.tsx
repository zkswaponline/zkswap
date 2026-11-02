"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { explorerTx, shortAddress } from "@/config/brand";
import { bookLive } from "@/config/contracts";
import { Eyebrow, PixelButton } from "@/components/ui/kit";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { explain, rpcCall, waitForReceipt } from "@/lib/client";
import { bookCall, epochNow, listGroups, loadDesk, loadLeaves, loadPractice, rolesOf, savePractice, type DeskPair, type Group } from "@/lib/zk/book";
import { parseMembers, rootOf, toHex32 } from "@/lib/zk/core";

const EPOCHS = [
  { v: 3600, l: "1 hour" },
  { v: 86_400, l: "1 day" },
  { v: 604_800, l: "1 week" },
  { v: 2_592_000, l: "30 days" },
];

export function GroupManager() {
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const live = bookLive();

  const [groups, setGroups] = useState<Group[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [epochSeconds, setEpochSeconds] = useState(86_400);
  const [members, setMembers] = useState("");
  const [leaves, setLeaves] = useState<bigint[]>([]);
  const [epoch, setEpoch] = useState<bigint | null>(null);
  const [roles, setRoles] = useState({ admin: false, curator: false, pending: false });
  const [desk, setDesk] = useState<DeskPair[]>([]);
  const [pair, setPair] = useState({ tokenIn: "", tokenOut: "", label: "" });
  const [curator, setCurator] = useState("");
  const [nextAdmin, setNextAdmin] = useState("");
  const [removeIndex, setRemoveIndex] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<{ hash: string; done: boolean } | null>(null);

  const group = useMemo(() => groups.find((g) => g.id.toString() === id) ?? null, [groups, id]);

  const refresh = useCallback(async () => {
    try {
      const list = await listGroups();
      setGroups(list);
      setId((v) => v || (list[list.length - 1]?.id.toString() ?? ""));
    } catch {
      setErr("The groups could not be read right now.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads chain and browser storage after mount
    void refresh();
  }, [refresh]);

  const reloadGroup = useCallback(async (g: Group) => {
    const [l, e, r, d] = await Promise.all([loadLeaves(g.id), epochNow(g), rolesOf(g, address), loadDesk(g)]);
    setLeaves(l);
    setEpoch(e);
    setRoles(r);
    setDesk(d);
  }, [address]);

  useEffect(() => {
    if (!group) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the chosen group from chain
    void reloadGroup(group).catch(() => setErr("That group could not be read right now."));
  }, [group, reloadGroup]);

  /** Runs a practice change or sends a live transaction. */
  const act = async (fn: string, args: readonly unknown[], practice: () => void) => {
    setErr(null);
    setBusy(true);
    try {
      if (!live) {
        practice();
      } else {
        if (!address) return open();
        if (!onRobinhoodChain) return void switchNetwork();
        // A read of the same call first: the contract's refusal comes back in plain words, before any wallet prompt.
        const call = bookCall(fn, args);
        await rpcCall("eth_call", [{ from: address, ...call }, "latest"]);
        const hash = await sendTransaction(call);
        setTx({ hash, done: false });
        const r = await waitForReceipt(hash);
        if (!r.ok) throw new Error("The transaction reverted.");
        setTx({ hash, done: true });
      }
      await refresh();
      const fresh = (await listGroups()).find((g) => g.id.toString() === (group?.id.toString() ?? id));
      if (fresh) await reloadGroup(fresh);
    } catch (e) {
      setErr(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const patchPractice = (mut: (g: ReturnType<typeof loadPractice>[number]) => void) => {
    const list = loadPractice();
    const g = list.find((x) => x.id === id);
    if (!g) throw new Error("That practice group is gone.");
    mut(g);
    savePractice(list);
  };

  const createGroup = () =>
    act("createGroup", [name.trim(), epochSeconds], () => {
      const list = loadPractice();
      const nid = String(list.reduce((m, g) => Math.max(m, Number(g.id)), 0) + 1);
      list.push({ id: nid, name: name.trim() || `Practice group ${nid}`, epochSeconds, leaves: [], state: "Forming", desk: [] });
      savePractice(list);
      setId(nid);
    });

  const parsed = useMemo(() => parseMembers(members), [members]);
  const nextLeaves = useMemo(() => [...leaves, ...parsed.leaves], [leaves, parsed]);
  const nextRoot = useMemo(() => (parsed.leaves.length ? toHex32(rootOf(nextLeaves)) : null), [parsed, nextLeaves]);

  const addMembers = () => {
    if (parsed.error) return setErr(parsed.error);
    if (!parsed.leaves.length || !nextRoot) return setErr("Add at least one line.");
    void act("addMembers", [group!.id, parsed.leaves.map(toHex32), nextRoot], () =>
      patchPractice((g) => {
        g.leaves.push(...parsed.leaves.map(toHex32));
      }),
    ).then(() => setMembers(""));
  };

  const removeMember = () => {
    const i = Number(removeIndex);
    if (!Number.isInteger(i) || i < 0 || i >= leaves.length) return setErr("That entry number does not exist.");
    const next = leaves.slice();
    next[i] = 0n;
    void act("replaceMember", [group!.id, BigInt(i), toHex32(0n), toHex32(rootOf(next))], () =>
      patchPractice((g) => {
        g.leaves[i] = toHex32(0n);
      }),
    );
  };

  const setState = (fn: "openGroup" | "suspendGroup" | "retireGroup", to: "Open" | "Suspended" | "Retired") =>
    act(fn, [group!.id], () =>
      patchPractice((g) => {
        if (to === "Open" && g.leaves.length === 0) throw new Error("Publish members first; a group cannot open without a root.");
        g.state = to;
      }),
    );

  const addPair = () => {
    const zero = "0x0000000000000000000000000000000000000000";
    const a = pair.tokenIn.trim() || zero;
    const b = pair.tokenOut.trim() || zero;
    if (!/^0x[0-9a-fA-F]{40}$/.test(a) || !/^0x[0-9a-fA-F]{40}$/.test(b)) return setErr("A desk pair needs two addresses (leave one empty for ETH).");
    if (!pair.label.trim()) return setErr("A desk pair needs a label.");
    void act("setDeskPair", [group!.id, BigInt(desk.length), a, b, pair.label.trim()], () =>
      patchPractice((g) => {
        g.desk.push({ tokenIn: a, tokenOut: b, label: pair.label.trim() });
      }),
    );
  };

  const canEdit = group && group.state !== "Retired" && (group.practice || roles.admin || roles.curator);
  const canAdmin = group && group.state !== "Retired" && (group.practice || roles.admin);

  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>Run a group</Eyebrow>
        <h1 className="h-page">Admins and curators</h1>
        <p className="lede">Each group has its own admin and curators; nobody has power over every group. A member sends you a commitment, you add it with an expiry epoch and publish the new root. Your browser computes the root; every reader can recompute it from the entries.</p>
        {live ? null : (
          <p className="note warn mt-5" data-testid="manage-practice">
            Practice mode: the access book is not deployed yet. Changes here stay in this browser.
          </p>
        )}
      </div>

      <div className="split rule mt-[60px]" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <h2 className="t-card">New group</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="fld">
              Name, up to 48 plain characters
              <input className="inp" maxLength={48} value={name} onChange={(e) => setName(e.target.value)} data-testid="new-group-name" />
            </label>
            <label className="fld">
              Epoch length (fixed once created)
              <select className="inp" value={epochSeconds} onChange={(e) => setEpochSeconds(Number(e.target.value))}>
                {EPOCHS.map((x) => (
                  <option key={x.v} value={x.v}>
                    {x.l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <PixelButton tone="light" className="mt-4" disabled={busy || (live && !name.trim())} onClick={createGroup} data-testid="create-group">
            {live && !address ? "Connect to create" : "Create group"}
          </PixelButton>

          <h2 className="t-card mt-10">Group</h2>
          <label className="fld mt-3">
            Choose
            <select className="inp" value={id} onChange={(e) => setId(e.target.value)} data-testid="manage-group">
              {groups.length === 0 ? <option value="">No groups yet</option> : null}
              {groups.map((g) => (
                <option key={g.id.toString()} value={g.id.toString()}>
                  #{g.id.toString()} {g.name} · {g.state}
                </option>
              ))}
            </select>
          </label>
          {group ? (
            <dl className="mt-4">
              <div className="kv">
                <dt>State</dt>
                <dd data-testid="manage-state">{group.state}</dd>
              </div>
              <div className="kv">
                <dt>Admin</dt>
                <dd className="addr">{group.admin}</dd>
              </div>
              <div className="kv">
                <dt>Entries</dt>
                <dd>{leaves.length}</dd>
              </div>
              <div className="kv">
                <dt>Root</dt>
                <dd className="addr">{group.rootSeq ? group.root : "None yet"}</dd>
              </div>
              <div className="kv">
                <dt>Epoch now</dt>
                <dd>
                  {epoch?.toString() ?? "—"} · one epoch is {Math.round(group.epochSeconds / 3600)} h
                </dd>
              </div>
              <div className="kv">
                <dt>Your role</dt>
                <dd>{group.practice ? "This browser" : !address ? "Connect a wallet" : roles.admin ? "Admin" : roles.curator ? "Curator" : roles.pending ? "Offered admin" : "None"}</dd>
              </div>
            </dl>
          ) : null}
          {group ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="sbtn" disabled={busy || !canAdmin} onClick={() => setState("openGroup", "Open")} data-testid="open-group">
                Open
              </button>
              <button type="button" className="sbtn" disabled={busy || !canAdmin} onClick={() => setState("suspendGroup", "Suspended")}>
                Suspend
              </button>
              <button
                type="button"
                className="sbtn"
                disabled={busy || !canAdmin}
                onClick={() => {
                  if (window.confirm("Retire this group? There is no way back.")) void setState("retireGroup", "Retired");
                }}
              >
                Retire
              </button>
              {roles.pending && !group.practice ? (
                <button type="button" className="sbtn" disabled={busy} onClick={() => act("acceptAdmin", [group.id], () => {})}>
                  Accept admin
                </button>
              ) : null}
            </div>
          ) : null}
          {err ? (
            <p className="note bad mt-4" role="alert" data-testid="manage-error">
              {err}
            </p>
          ) : null}
          {tx ? (
            <p className="t-mono-s mt-3">
              <a className="link" href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
                {shortAddress(tx.hash, 10, 8)}
              </a>{" "}
              {tx.done ? "· confirmed" : "· waiting"}
            </p>
          ) : null}
        </div>

        <div className="p-10" style={{ minWidth: 0 }}>
          <h2 className="t-card">Add members</h2>
          <label className="fld mt-3">
            One per line: commitment, expiry epoch
            <textarea className="inp mono" placeholder={`0x1234…, ${epoch !== null ? (epoch + 30n).toString() : "20400"}`} value={members} onChange={(e) => setMembers(e.target.value)} data-testid="members" />
          </label>
          {parsed.error ? <p className="note warn mt-2">{parsed.error}</p> : null}
          {nextRoot ? (
            <p className="t-mono-s mt-2" data-testid="next-root">
              New root {nextRoot.slice(0, 18)}…, over {nextLeaves.length} entries.
            </p>
          ) : null}
          <PixelButton tone="light" className="mt-4" disabled={busy || !canEdit || !parsed.leaves.length} onClick={addMembers} data-testid="add-members">
            Publish members
          </PixelButton>

          <h2 className="t-card mt-10">Remove a member</h2>
          <p className="t-body mt-2">Empties one entry and publishes a new root. Older roots stay accepted for a short window; use the cut-off below for an urgent removal.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className="inp" style={{ width: 120, marginTop: 0 }} inputMode="numeric" placeholder="Entry #" value={removeIndex} onChange={(e) => setRemoveIndex(e.target.value)} aria-label="Entry number" />
            <button type="button" className="sbtn" disabled={busy || !canEdit} onClick={removeMember}>
              Empty entry
            </button>
            {group && !group.practice ? (
              <button type="button" className="sbtn" disabled={busy || !canAdmin || group.rootSeq === 0} onClick={() => act("cutOffRoots", [group.id, group.rootSeq], () => {})}>
                Accept only the newest root
              </button>
            ) : null}
          </div>

          <h2 className="t-card mt-10">Desk pairs</h2>
          <p className="t-body mt-2">Swap pairs the member desk shows. They are a public record, not a secret.</p>
          <ul className="mt-3">
            {desk.map((d) => (
              <li key={d.label} className="kv">
                <span>{d.label}</span>
                <span className="addr">
                  {shortAddress(d.tokenIn)} → {shortAddress(d.tokenOut)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input className="inp mono" style={{ marginTop: 0 }} placeholder="In (empty = ETH)" value={pair.tokenIn} onChange={(e) => setPair({ ...pair, tokenIn: e.target.value })} aria-label="Token in" />
            <input className="inp mono" style={{ marginTop: 0 }} placeholder="Out (empty = ETH)" value={pair.tokenOut} onChange={(e) => setPair({ ...pair, tokenOut: e.target.value })} aria-label="Token out" />
            <input className="inp" style={{ marginTop: 0 }} maxLength={32} placeholder="Label" value={pair.label} onChange={(e) => setPair({ ...pair, label: e.target.value })} aria-label="Label" />
          </div>
          <button type="button" className="sbtn mt-3" disabled={busy || !canEdit} onClick={addPair}>
            Add pair
          </button>

          {group && !group.practice ? (
            <>
              <h2 className="t-card mt-10">Roles in this group</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className="inp mono" style={{ marginTop: 0, flex: "1 1 220px" }} placeholder="0x… curator" value={curator} onChange={(e) => setCurator(e.target.value.trim())} aria-label="Curator" />
                <button type="button" className="sbtn" disabled={busy || !canAdmin} onClick={() => act("setCurator", [group.id, curator, true], () => {})}>
                  Add
                </button>
                <button type="button" className="sbtn" disabled={busy || !canAdmin} onClick={() => act("setCurator", [group.id, curator, false], () => {})}>
                  Remove
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className="inp mono" style={{ marginTop: 0, flex: "1 1 220px" }} placeholder="0x… next admin" value={nextAdmin} onChange={(e) => setNextAdmin(e.target.value.trim())} aria-label="Next admin" />
                <button type="button" className="sbtn" disabled={busy || !canAdmin} onClick={() => act("offerAdmin", [group.id, nextAdmin], () => {})}>
                  Offer admin
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ height: 80 }} />
    </section>
  );
}
