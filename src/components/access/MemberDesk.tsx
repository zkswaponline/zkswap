"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { tokenByAddress } from "@/config/tokens";
import { Eyebrow, PixelButton, PixelLink, PlannedTag } from "@/components/ui/kit";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { epochNow, hasAccessLive, listGroups, loadDesk, loadPass, type DeskPair, type Group } from "@/lib/zk/book";

const name = (a: string) => (/^0x0{40}$/.test(a) ? "ETH" : (tokenByAddress(a)?.symbol ?? `${a.slice(0, 8)}…`));

/** The group-gated screen. The gate is in this interface only: everything on it is public on chain. */
export function MemberDesk() {
  const params = useSearchParams();
  const { address } = useWallet();
  const { open } = useWalletModal();
  const [groups, setGroups] = useState<Group[]>([]);
  const [id, setId] = useState(params.get("group") ?? "");
  const [state, setState] = useState<"idle" | "checking" | "open" | "locked">("idle");
  const [desk, setDesk] = useState<DeskPair[]>([]);
  const group = useMemo(() => groups.find((g) => g.id.toString() === id) ?? null, [groups, id]);

  useEffect(() => {
    void listGroups()
      .then((list) => {
        setGroups(list);
        setId((v) => v || (list[list.length - 1]?.id.toString() ?? ""));
      })
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!group) return;
    let stop = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the check below replaces this
    setState("checking");
    void (async () => {
      try {
        let ok = false;
        if (group.practice) {
          const pass = loadPass();
          const e = await epochNow(group);
          ok = pass !== null && pass.groupId === group.id.toString() && pass.epoch === e.toString();
        } else if (address) {
          ok = await hasAccessLive(group.id, address);
        }
        if (stop) return;
        setState(ok ? "open" : "locked");
        setDesk(ok ? await loadDesk(group) : []);
      } catch {
        if (!stop) setState("locked");
      }
    })();
    return () => {
      stop = true;
    };
  }, [group, address]);

  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>Member desk</Eyebrow>
        <h1 className="h-page">Your group&apos;s desk</h1>
        <p className="lede">This screen opens for a wallet with an access record in the current epoch. The gate is at the app level: pools and routers do not check it, the desk&apos;s presets are public on chain, and any swap you make from here stays visible like any other.</p>
      </div>
      <div className="split rule mt-[60px]" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <label className="fld">
            Group
            <select className="inp" value={id} onChange={(e) => setId(e.target.value)} data-testid="desk-group">
              {groups.length === 0 ? <option value="">No groups yet</option> : null}
              {groups.map((g) => (
                <option key={g.id.toString()} value={g.id.toString()}>
                  #{g.id.toString()} {g.name}
                </option>
              ))}
            </select>
          </label>
          <p className="t-mono-s mt-5" data-testid="desk-state">
            {state === "checking" ? "Checking the record…" : state === "open" ? "OPEN FOR THIS EPOCH" : state === "locked" ? "LOCKED" : "PICK A GROUP"}
          </p>
          {state === "locked" ? (
            <div className="mt-4 grid gap-3">
              <p className="t-body">No access record for this {group?.practice ? "browser" : "wallet"} in the current epoch.</p>
              {group && !group.practice && !address ? (
                <PixelButton tone="light" onClick={open}>
                  Connect wallet
                </PixelButton>
              ) : (
                <PixelLink href="/access" tone="light">
                  Make a proof
                </PixelLink>
              )}
            </div>
          ) : null}
          <p className="mt-8 flex flex-wrap items-center gap-3">
            <span className="t-card">Pools that enforce this</span> <PlannedTag />
          </p>
          <p className="t-body mt-2">A pool that checks a proof on chain before a swap is planned, not built. Nothing on this page limits who can use a venue.</p>
        </div>
        <div className="p-10" style={{ minWidth: 0 }} data-testid="desk-panel">
          <p className="t-mono-s">PRESET PAIRS</p>
          {state !== "open" ? (
            <p className="t-22 mt-4">Opens with a record for this epoch.</p>
          ) : desk.length === 0 ? (
            <p className="t-22 mt-4">The curator has not set any pairs for this group.</p>
          ) : (
            <ul className="mt-3">
              {desk.map((d) => (
                <li key={d.label} className="kv" data-testid="desk-pair">
                  <span>{d.label}</span>
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="t-mono">
                      {name(d.tokenIn)} → {name(d.tokenOut)}
                    </span>
                    <Link className="sbtn" href={`/swap?in=${/^0x0{40}$/.test(d.tokenIn) ? "ETH" : d.tokenIn}&out=${/^0x0{40}$/.test(d.tokenOut) ? "ETH" : d.tokenOut}`}>
                      Compare routes
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div style={{ height: 80 }} />
    </section>
  );
}
