"use client";

import { encodeFunctionData, type Abi } from "viem";
import { CHAIN } from "@/config/brand";
import { CONTRACTS, bookLive } from "@/config/contracts";
import { KEYS } from "@/config/storage";
import { BOOK_ABI } from "@/lib/abi";
import { read, readMany } from "@/lib/client";
import { rootOf, scopeOf, toHex32 } from "@/lib/zk/core";

/*
 * The group model the access screens use, from one of two sources:
 *   live      the ZkswapAccessBook on chain (read through the relay, written by the connected wallet)
 *   practice  a group kept in this browser, while no book is deployed. Proofs are just as real and are verified locally;
 *             nothing is recorded anywhere.
 */

export const STATE_NAMES = ["None", "Forming", "Open", "Suspended", "Retired"] as const;
export type StateName = (typeof STATE_NAMES)[number];

export type DeskPair = { tokenIn: string; tokenOut: string; label: string };
export type Group = {
  id: bigint;
  name: string;
  state: StateName;
  admin: string;
  pendingAdmin: string;
  epochSeconds: number;
  rootSeq: number;
  minRootSeq: number;
  recordCount: number;
  root: string;
  practice: boolean;
};

const ABI = BOOK_ABI as Abi;
const book = () => CONTRACTS.book;

type RawGroup = { admin: string; pendingAdmin: string; state: number; epochSeconds: number; curatorCount: number; rootSeq: number; minRootSeq: number; createdAt: bigint; createdAtBlock: bigint; recordCount: bigint; root: string; name: string };

const fromRaw = (id: bigint, g: RawGroup): Group => ({ id, name: g.name, state: STATE_NAMES[g.state] ?? "None", admin: g.admin, pendingAdmin: g.pendingAdmin, epochSeconds: Number(g.epochSeconds), rootSeq: Number(g.rootSeq), minRootSeq: Number(g.minRootSeq), recordCount: Number(g.recordCount), root: g.root, practice: false });

/* ------------------------------------------------------------------ practice groups */

export type PracticeGroup = { id: string; name: string; epochSeconds: number; leaves: string[]; state: StateName; desk: DeskPair[] };

export function loadPractice(): PracticeGroup[] {
  try {
    const raw = window.localStorage.getItem(KEYS.practiceGroups);
    const list = raw ? (JSON.parse(raw) as PracticeGroup[]) : [];
    return Array.isArray(list) ? list.filter((g) => typeof g?.id === "string" && Array.isArray(g.leaves)) : [];
  } catch {
    return [];
  }
}

export function savePractice(list: PracticeGroup[]) {
  window.localStorage.setItem(KEYS.practiceGroups, JSON.stringify(list));
}

const practiceToGroup = (p: PracticeGroup): Group => ({
  id: BigInt(p.id),
  name: p.name,
  state: p.state,
  admin: "this browser",
  pendingAdmin: "0x0000000000000000000000000000000000000000",
  epochSeconds: p.epochSeconds,
  rootSeq: p.leaves.length ? 1 : 0,
  minRootSeq: 0,
  recordCount: 0,
  root: toHex32(rootOf(p.leaves.map(BigInt))),
  practice: true,
});

/* ------------------------------------------------------------------ reads */

export async function listGroups(): Promise<Group[]> {
  if (!bookLive()) return loadPractice().map(practiceToGroup);
  const raw = await read<readonly RawGroup[]>({ to: book(), abi: ABI, fn: "groupsFrom", args: [1n, 100n] });
  return raw.map((g, i) => fromRaw(BigInt(i + 1), g));
}

export async function loadLeaves(groupId: bigint): Promise<bigint[]> {
  if (!bookLive()) {
    const p = loadPractice().find((g) => g.id === groupId.toString());
    return p ? p.leaves.map(BigInt) : [];
  }
  const out: bigint[] = [];
  for (let start = 0n; ; start += 200n) {
    const page = await read<readonly string[]>({ to: book(), abi: ABI, fn: "leavesOf", args: [groupId, start, 200n] });
    out.push(...page.map(BigInt));
    if (page.length < 200) return out;
  }
}

/** The epoch the book would accept right now. Practice groups use the same arithmetic on this device's clock. */
export async function epochNow(g: Group): Promise<bigint> {
  if (g.practice) return BigInt(Math.floor(Date.now() / 1000 / g.epochSeconds));
  return BigInt(await read<number>({ to: book(), abi: ABI, fn: "currentEpoch", args: [g.id] }));
}

export const practiceBook = "0x0000000000000000000000000000000000000000";
export const scopeFor = (g: Group) => scopeOf(CHAIN.id, g.practice ? practiceBook : book(), g.id);

export async function hasAccessLive(groupId: bigint, account: string): Promise<boolean> {
  return read<boolean>({ to: book(), abi: ABI, fn: "hasAccess", args: [groupId, account] });
}

export async function loadDesk(g: Group): Promise<DeskPair[]> {
  if (g.practice) return (loadPractice().find((p) => p.id === g.id.toString())?.desk ?? []).filter((d) => d.label);
  const d = await read<readonly DeskPair[]>({ to: book(), abi: ABI, fn: "deskOf", args: [g.id] });
  return d.filter((x) => x.label);
}

export async function rolesOf(g: Group, account: string | null) {
  if (g.practice) return { admin: true, curator: true, pending: false };
  if (!account) return { admin: false, curator: false, pending: false };
  const [cur] = await readMany([{ to: book(), abi: ABI, fn: "isCurator", args: [g.id, account] }]);
  return { admin: g.admin.toLowerCase() === account.toLowerCase(), curator: cur === true, pending: g.pendingAdmin.toLowerCase() === account.toLowerCase() };
}

/* ------------------------------------------------------------------ writes (encoded here, signed by the wallet) */

export const bookCall = (fn: string, args: readonly unknown[]) => ({ to: book(), data: encodeFunctionData({ abi: ABI, functionName: fn, args } as never) });

/* ------------------------------------------------------------------ a practice pass */

export type PracticePass = { groupId: string; epoch: string; nullifier: string };

export function savePass(p: PracticePass) {
  window.localStorage.setItem(KEYS.practicePass, JSON.stringify(p));
}

export function loadPass(): PracticePass | null {
  try {
    const raw = window.localStorage.getItem(KEYS.practicePass);
    return raw ? (JSON.parse(raw) as PracticePass) : null;
  } catch {
    return null;
  }
}
