"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { NATIVE, UNISWAP } from "@/config/dex";
import { KEYS } from "@/config/storage";
import { TOKENS, tokenByAddress } from "@/config/tokens";
import { Eyebrow, PixelButton } from "@/components/ui/kit";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { waitForReceipt } from "@/lib/client";
import { approveTx, buildSwap, permit2ApproveTx, type SwapTx } from "@/lib/swap/build";
import { decodeTx, type Decoded, type TokenNames } from "@/lib/swap/decode";
import { MAX_UINT, MAX_UINT160, approvalSteps, feeText, hasHook, isUnlimited, spenderLabel, venueContract } from "@/lib/swap/facts";
import { DEADLINE_SECONDS, PERMIT2_EXPIRY_SECONDS, behindBest, costText, parseAmount, showAmount, slippageBps, topThree } from "@/lib/swap/flow";
import { minOut, type QuoteAnswer, type Route, type TokenInfo } from "@/lib/swap/types";

type Picked = { address: string; symbol: string; decimals: number };
const ETH: Picked = { address: NATIVE, symbol: "ETH", decimals: 18 };
const USD = TOKENS[1];

function TokenPick({ label, value, onChange, testid }: { label: string; value: Picked; onChange: (t: Picked) => void; testid: string }) {
  const listed = tokenByAddress(value.address);
  const [paste, setPaste] = useState(listed ? "" : value.address);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(
    async (a: string) => {
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch(`/api/token-info?address=${a}`);
        const j = (await r.json()) as TokenInfo & { error?: string };
        if (!r.ok) throw new Error(j.error ?? "That token could not be read.");
        onChange({ address: j.address.toLowerCase(), symbol: j.symbol, decimals: j.decimals });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "That token could not be read.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );
  return (
    <div>
      <label className="fld">
        {label}
        <select
          className="inp"
          value={listed ? value.address : "paste"}
          data-testid={testid}
          onChange={(e) => {
            if (e.target.value === "paste") {
              setPaste("");
              return;
            }
            const t = tokenByAddress(e.target.value);
            if (t) onChange({ address: t.address, symbol: t.symbol, decimals: t.decimals });
          }}
        >
          {TOKENS.map((t) => (
            <option key={t.address} value={t.address}>
              {t.symbol} · {t.name}
            </option>
          ))}
          <option value="paste">{listed ? "Paste an address…" : `${value.symbol} (pasted)`}</option>
        </select>
      </label>
      {!listed || paste ? (
        <input
          className="inp mono"
          placeholder="0x… token address"
          aria-label={`${label} token address`}
          value={paste}
          onChange={(e) => {
            const v = e.target.value.trim();
            setPaste(v);
            if (/^0x[0-9a-fA-F]{40}$/.test(v)) void load(v);
          }}
        />
      ) : null}
      {busy ? <p className="t-mono-s mt-1">Reading the token…</p> : null}
      {err ? (
        <p className="mt-1 text-[13px]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function DecodedView({ d, depth = 0 }: { d: Decoded; depth?: number }) {
  return (
    <div style={{ marginLeft: depth ? 14 : 0, paddingLeft: depth ? 12 : 0, borderLeft: depth ? "1px solid var(--line2)" : 0 }} data-testid="decoded">
      <p className="addr" style={{ color: "var(--fg)" }}>
        {d.contract} · <b style={{ fontWeight: 500 }}>{d.fn}</b>
      </p>
      {d.known ? null : <p className="mt-1 text-[13px]">Not a call this site recognises.</p>}
      <dl className="mt-2">
        {d.lines.map((l) => (
          <div key={l.name + l.value} className="kv">
            <dt>{l.name}</dt>
            <dd className={l.kind === "address" ? "addr" : ""}>{l.value}</dd>
          </div>
        ))}
      </dl>
      {d.inner?.map((x, i) => (
        <div key={i} className="mt-3">
          <DecodedView d={x} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

type Permission = { allowance: string | null; balance: string | null; firstSpender: string; permit2: { amount: string; expiration: string } | null; spender: { label: string; what: string; known: boolean; hasCode: boolean } };
type Sim = { ok: boolean; revert?: string; gas?: string | null; block?: number; simulatedFrom?: string } | null;

export function SwapDesk() {
  const params = useSearchParams();
  const { address, onRobinhoodChain, sendTransaction, switchNetwork, refreshBalance } = useWallet();
  const { open: openWallet } = useWalletModal();

  const [tin, setTin] = useState<Picked>(ETH);
  const [tout, setTout] = useState<Picked>({ address: USD.address, symbol: USD.symbol, decimals: USD.decimals });
  const [amount, setAmount] = useState("0.01");
  const [slip, setSlip] = useState("0.5");
  const [quote, setQuote] = useState<QuoteAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);
  const [when, setWhen] = useState<number | null>(null);
  const seq = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEYS.slippage);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    if (saved && slippageBps(saved) !== null) setSlip(saved);
  }, []);

  const compare = useCallback(async (from: Picked, to: Picked, amt: string) => {
    const id = ++seq.current;
    setLoading(true);
    setErr(null);
    setRouteLabel(null);
    try {
      const r = await fetch(`/api/quote?in=${from.address === NATIVE ? "ETH" : from.address}&out=${to.address === NATIVE ? "ETH" : to.address}&amount=${encodeURIComponent(amt.trim())}`);
      const j = (await r.json()) as QuoteAnswer & { error?: string };
      if (id !== seq.current) return;
      if (!r.ok) throw new Error(j.error ?? "Quotes are not available right now.");
      setQuote(j);
      setWhen(Date.now());
    } catch (e) {
      if (id !== seq.current) return;
      setQuote(null);
      setErr(e instanceof Error ? e.message : "Quotes are not available right now.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  // Deep links from the home page, guides and the member desk: /swap?in=&out=&amount=
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const read = async (a: string | null): Promise<Picked | null> => {
      if (!a) return null;
      if (a.toUpperCase() === "ETH" || /^0x0{40}$/.test(a)) return ETH;
      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
      const known = tokenByAddress(a);
      if (known) return known;
      const r = await fetch(`/api/token-info?address=${a}`).catch(() => null);
      if (!r || !r.ok) return null;
      const j = (await r.json()) as TokenInfo;
      return { address: j.address.toLowerCase(), symbol: j.symbol, decimals: j.decimals };
    };
    void (async () => {
      const a = await read(params.get("in"));
      const b = await read(params.get("out"));
      const amt = params.get("amount");
      if (a) setTin(a);
      if (b) setTout(b);
      if (amt && /^\d{1,30}(\.\d{1,36})?$/.test(amt)) setAmount(amt);
      if (a || b) void compare(a ?? ETH, b ?? tout, amt ?? amount);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, for the query string the page opened with
  }, []);

  const amountIn = useMemo(() => parseAmount(amount, tin.decimals), [amount, tin.decimals]);
  const bps = slippageBps(slip);
  const routes = useMemo(() => quote?.routes ?? [], [quote]);
  const { left, mid, right } = topThree(routes);
  const route = routes.find((r) => r.label === routeLabel) ?? null;
  const decimalsOut = quote?.tokenOut.decimals ?? tout.decimals;
  const symbolOut = quote?.tokenOut.symbol ?? tout.symbol;

  const swapIt = () => {
    if (!amountIn) return setErr(`Enter an amount ${tin.symbol} can hold (${tin.decimals} decimals).`);
    if (tin.address === tout.address) return setErr("Pick two different assets.");
    void compare(tin, tout, amount);
  };

  const plan = (r: Route | null, place: string, hot = false) => (
    <div className={`plan ${hot ? "hot" : ""}`} data-testid={hot ? "route-best" : "route-card"}>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center" style={{ width: 34, height: 34, background: hot ? "rgba(255,255,255,.14)" : "var(--sunk)", font: "400 11px/1 var(--font-gasoek)" }}>
          {r ? venueContract(r.exec).label.includes("v2") ? "V2" : r.venue.includes("v3") ? "V3" : r.venue.includes("v4") ? "V4" : "PN" : "—"}
        </span>
        <h3 className="text-[20px] leading-[26px]">{r ? r.venue : place}</h3>
      </div>
      <p className="t-body mt-4" style={{ minHeight: 76 }}>
        {r ? `${r.label}. ${r.estimate ? "An estimate from the curve's reserves, not a simulation." : "Simulated by the venue's own quoter."}` : loading ? "Reading the venues…" : quote ? "No other route answered for this pair." : "Run a comparison to fill this column."}
      </p>
      <p className="amt mt-4">{r ? showAmount(r.amountOut, decimalsOut) : "—"}</p>
      <p className="t-mono-s">{r ? symbolOut : " "}</p>
      <div className="mt-5">
        <PixelButton tone={hot ? "light" : "dark"} disabled={!r} onClick={() => r && setRouteLabel(r.label)} data-testid={hot ? "pick-best" : "pick-route"}>
          {r && routeLabel === r.label ? "Selected" : "Use this route"}
        </PixelButton>
      </div>
    </div>
  );

  const row = (k: string, f: (r: Route) => React.ReactNode) => (
    <div className="tr" key={k}>
      <div>{k}</div>
      <div data-head={left?.venue ?? ""}>{left ? f(left) : "—"}</div>
      <div className="hot" data-head={mid?.venue ?? ""}>
        {mid ? f(mid) : "—"}
      </div>
      <div data-head={right?.venue ?? ""}>{right ? f(right) : "—"}</div>
    </div>
  );

  return (
    <>
      <section className="sec on-paper" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>Routes</Eyebrow>
          <h1 className="h-page">Compare every route before you sign</h1>
          <p className="lede">Each venue with a pool answers at the same block. Pick a route; the next two steps open below it. Not financial advice.</p>
        </div>

        <div className="plans mt-[70px]">
          <div className="p-10 max-[809px]:pb-2" style={{ minWidth: 0 }}>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                swapIt();
              }}
            >
              <TokenPick label="You pay" value={tin} onChange={setTin} testid="token-in" />
              <TokenPick label="You receive" value={tout} onChange={setTout} testid="token-out" />
              <label className="fld">
                Amount of {tin.symbol}
                <input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="amount" />
              </label>
              <label className="fld">
                Slippage, %
                <input
                  className="inp"
                  inputMode="decimal"
                  value={slip}
                  onChange={(e) => {
                    setSlip(e.target.value);
                    if (slippageBps(e.target.value) !== null) window.localStorage.setItem(KEYS.slippage, e.target.value);
                  }}
                  data-testid="slippage"
                />
              </label>
              <PixelButton type="submit" tone="dark" wide disabled={loading} data-testid="compare">
                {loading ? "Reading venues…" : "Compare routes"}
              </PixelButton>
              {err ? (
                <p className="note bad" role="alert" data-testid="swap-error">
                  {err}
                </p>
              ) : null}
              {quote && when ? (
                <p className="t-mono-s" data-testid="quote-block">
                  Read at block {quote.block.toLocaleString("en-US")}, {routes.length} route{routes.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </form>
          </div>
          {plan(left, "Second best")}
          {plan(mid, "Best output", true)}
          {plan(right, "Third best")}
        </div>

        <p className="tsec" style={{ borderBottom: "1px solid var(--line)" }}>
          What each route costs
        </p>
        {row("Expected output", (r) => `${showAmount(r.amountOut, decimalsOut)} ${symbolOut}`)}
        {row("Behind the best", (r) => (mid ? (behindBest(r, mid) ?? "Best") : "—"))}
        {row("Pool fee", (r) => feeText(r.exec))}
        {row("Cost against current price", (r) => costText(r))}
        {row(`Minimum at ${slip}%`, (r) => (bps === null ? "—" : `${showAmount(minOut(BigInt(r.amountOut), bps), decimalsOut)} ${symbolOut}`))}
        <p className="tsec">How it runs</p>
        {row("Quote is", (r) => (r.estimate ? "An estimate" : "A simulation"))}
        {row("Contract you call", (r) => venueContract(r.exec).label)}
        {row("Hook on the pool", (r) => (hasHook(r.exec) ? "Yes" : "No"))}
        {row("Approval needed", (r) => (tin.address === NATIVE ? "None, pays in ETH" : r.exec.kind === "v4" ? "Two layers (Permit2)" : "One layer"))}

        {routes.length > 3 ? (
          <div className="rule px-10 py-10">
            <p className="t-mono-s uppercase">Other routes that answered</p>
            <ul className="mt-4 grid gap-2">
              {routes.slice(3).map((r) => (
                <li key={r.label} className="flex flex-wrap items-center justify-between gap-3 py-2" style={{ borderTop: "1px solid var(--line)" }}>
                  <span className="text-[15px] font-light">{r.label}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="addr">
                      {showAmount(r.amountOut, decimalsOut)} {symbolOut} · {costText(r)}
                    </span>
                    <button type="button" className="sbtn" onClick={() => setRouteLabel(r.label)}>
                      {routeLabel === r.label ? "Selected" : "Use"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rule" style={{ height: 80 }} />
      </section>

      {route && quote && amountIn && bps !== null ? (
        <Review key={route.label + quote.block} route={route} quote={quote} amountIn={amountIn} bps={bps} account={address} onChain={onRobinhoodChain} openWallet={openWallet} switchNetwork={switchNetwork} send={sendTransaction} refresh={refreshBalance} />
      ) : (
        <section className="sec rule" style={{ padding: "80px 0" }}>
          <div className="col2">
            <Eyebrow>Next</Eyebrow>
            <p className="t-22 mt-4" style={{ maxWidth: 520 }}>
              Pick a route above. Its permission check and its transaction review open here.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

function Review({
  route,
  quote,
  amountIn,
  bps,
  account,
  onChain,
  openWallet,
  switchNetwork,
  send,
  refresh,
}: {
  route: Route;
  quote: QuoteAnswer;
  amountIn: bigint;
  bps: number;
  account: string | null;
  onChain: boolean;
  openWallet: () => void;
  switchNetwork: () => Promise<void>;
  send: (tx: { to?: string; data: string; value?: bigint }) => Promise<string>;
  refresh: () => void;
}) {
  const [perm, setPerm] = useState<Permission | null>(null);
  const [permErr, setPermErr] = useState<string | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [sim, setSim] = useState<Sim>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ hash: string; ok: boolean | null; what: string }[]>([]);
  const [deadline] = useState(() => BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS));

  const names: TokenNames = useMemo(
    () => ({
      [NATIVE]: { symbol: "ETH", decimals: 18 },
      [quote.tokenIn.address.toLowerCase()]: { symbol: quote.tokenIn.symbol, decimals: quote.tokenIn.decimals },
      [quote.tokenOut.address.toLowerCase()]: { symbol: quote.tokenOut.symbol, decimals: quote.tokenOut.decimals },
    }),
    [quote],
  );
  const minimum = minOut(BigInt(route.amountOut), bps);
  const recipient = account ?? "0x00000000000000000000000000000000000f1140";
  const tx: SwapTx | null = useMemo(() => {
    try {
      return buildSwap({ exec: route.exec, tokenIn: quote.tokenIn.address, tokenOut: quote.tokenOut.address, amountIn, minOut: minimum, recipient, deadline });
    } catch {
      return null;
    }
  }, [route, quote, amountIn, minimum, recipient, deadline]);
  const decoded = useMemo(() => (tx ? decodeTx(tx, names) : null), [tx, names]);
  const needsApproval = tx?.approval ?? null;

  const loadPerm = useCallback(async () => {
    if (!needsApproval || !account) return;
    setPermErr(null);
    try {
      const r = await fetch(`/api/permission?owner=${account}&token=${needsApproval.token}&spender=${needsApproval.spender}&via=${needsApproval.via}`);
      const j = (await r.json()) as Permission & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "The allowance could not be read.");
      setPerm(j);
    } catch (e) {
      setPermErr(e instanceof Error ? e.message : "The allowance could not be read.");
    }
  }, [needsApproval, account]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads chain state for the chosen route
    void loadPerm();
  }, [loadPerm]);

  const steps = useMemo(() => {
    if (!needsApproval || !perm || perm.allowance === null) return null;
    return approvalSteps(needsApproval, amountIn, BigInt(perm.allowance), perm.permit2 ? { amount: BigInt(perm.permit2.amount), expiration: BigInt(perm.permit2.expiration) } : undefined);
  }, [needsApproval, perm, amountIn]);
  const ready = !needsApproval || (steps?.every((s) => s.ok) ?? false);
  const lowBalance = perm?.balance != null && BigInt(perm.balance) < amountIn;

  const runSim = useCallback(async () => {
    if (!tx) return;
    setSimBusy(true);
    setSim(null);
    try {
      const r = await fetch("/api/simulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: account, to: tx.to, data: tx.data, value: tx.value.toString() }) });
      const j = (await r.json()) as Sim & { error?: string };
      if (!r.ok) throw new Error(j?.error ?? "The simulation could not run.");
      setSim(j);
    } catch (e) {
      setSim({ ok: false, revert: e instanceof Error ? e.message : "The simulation could not run." });
    } finally {
      setSimBusy(false);
    }
  }, [tx, account]);

  const sendStep = async (what: string, t: { to: string; data: string; value?: bigint }, after?: () => void) => {
    setTxErr(null);
    setBusy(what);
    try {
      const hash = await send(t);
      setSent((s) => [...s, { hash, ok: null, what }]);
      const r = await waitForReceipt(hash);
      setSent((s) => s.map((x) => (x.hash === hash ? { ...x, ok: r.ok } : x)));
      refresh();
      after?.();
    } catch (e) {
      const c = e as { code?: number; message?: string };
      setTxErr(c?.code === 4001 ? "The request was declined in the wallet." : (c?.message ?? "The transaction did not go through.").slice(0, 220));
    } finally {
      setBusy(null);
    }
  };

  const approveAmount = unlimited ? MAX_UINT : amountIn;
  const firstStep = needsApproval ? approveTx(needsApproval.token, needsApproval.via === "permit2" ? UNISWAP.permit2 : needsApproval.spender, approveAmount) : null;
  // The expiry is fixed when the signature is requested, so it is counted from that moment.
  const secondStep = () => permit2ApproveTx(needsApproval!.token, needsApproval!.spender, unlimited ? MAX_UINT160 : amountIn, BigInt(Math.floor(Date.now() / 1000) + PERMIT2_EXPIRY_SECONDS));
  const wrongChain = Boolean(account) && !onChain;
  const c = venueContract(route.exec);

  return (
    <section className="sec" style={{ paddingTop: 110, paddingBottom: 110 }} data-testid="review">
      <div className="col2">
        <Eyebrow>Step 2 · Permission check</Eyebrow>
        <h2 className="h-sec" style={{ maxWidth: 620 }}>
          What this route asks you to allow
        </h2>
      </div>
      <div className="split mt-[50px] rule">
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          {!needsApproval ? (
            <p className="note good" data-testid="no-approval">
              This route pays in ETH. The swap needs no token approval.
            </p>
          ) : (
            <>
              <dl>
                <div className="kv">
                  <dt>Token</dt>
                  <dd>
                    {quote.tokenIn.symbol}{" "}
                    <a className="addr link" href={explorerAddress(needsApproval.token)} target="_blank" rel="noreferrer">
                      {shortAddress(needsApproval.token, 8, 6)}
                    </a>
                  </dd>
                </div>
                <div className="kv">
                  <dt>Spender</dt>
                  <dd data-testid="spender-name">
                    {spenderLabel(needsApproval)}{" "}
                    <a className="addr link" href={explorerAddress(needsApproval.spender)} target="_blank" rel="noreferrer">
                      {shortAddress(needsApproval.spender, 8, 6)}
                    </a>
                  </dd>
                </div>
                {perm ? (
                  <div className="kv">
                    <dt>Who that is</dt>
                    <dd>
                      {perm.spender.label}. {perm.spender.what}
                    </dd>
                  </div>
                ) : null}
                <div className="kv">
                  <dt>This swap needs</dt>
                  <dd data-testid="need-amount">
                    {showAmount(amountIn, quote.tokenIn.decimals)} {quote.tokenIn.symbol}
                  </dd>
                </div>
                {!account ? (
                  <div className="kv">
                    <dt>You allow today</dt>
                    <dd>Connect a wallet to read it.</dd>
                  </div>
                ) : (
                  steps?.map((s) => (
                    <div key={s.kind} className="kv">
                      <dt>{s.kind === "erc20" ? (needsApproval.via === "permit2" ? "Token → Permit2" : "You allow today") : "Permit2 → router"}</dt>
                      <dd data-testid={`allow-${s.kind}`}>
                        {isUnlimited(s.have) ? "Unlimited" : `${showAmount(s.have, quote.tokenIn.decimals)} ${quote.tokenIn.symbol}`}. {s.note}
                      </dd>
                    </div>
                  ))
                )}
                {lowBalance ? (
                  <div className="kv">
                    <dt>Balance</dt>
                    <dd>
                      {showAmount(perm!.balance!, quote.tokenIn.decimals)} {quote.tokenIn.symbol}: below this swap&apos;s amount.
                    </dd>
                  </div>
                ) : null}
              </dl>
              {permErr ? (
                <p className="note bad mt-3" role="alert">
                  {permErr}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="p-10" style={{ minWidth: 0 }}>
          {needsApproval && account ? (
            <>
              <label className="flex items-start gap-3 text-[14px] font-light" style={{ color: "var(--fg)" }}>
                <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} className="mt-1" data-testid="unlimited" />
                <span>Allow unlimited instead of the exact amount. It stays open until you lower it. Not needed for this swap.</span>
              </label>
              {unlimited ? (
                <p className="note warn mt-3" data-testid="unlimited-warning">
                  UNLIMITED: this spender could move all of your {quote.tokenIn.symbol}, now and later.
                </p>
              ) : null}
              <div className="mt-5 grid gap-3">
                {firstStep && steps && !steps[0].ok ? (
                  <PixelButton tone="light" wide disabled={busy !== null || wrongChain} onClick={() => sendStep(`Approve ${unlimited ? "unlimited" : "exact amount"}`, firstStep, loadPerm)} data-testid="approve">
                    {busy?.startsWith("Approve") ? "Confirm in wallet…" : unlimited ? "Approve UNLIMITED" : `Approve exactly ${showAmount(amountIn, quote.tokenIn.decimals)} ${quote.tokenIn.symbol}`}
                  </PixelButton>
                ) : null}
                {needsApproval.via === "permit2" && steps && steps[0].ok && !steps[1]?.ok ? (
                  <PixelButton tone="light" wide disabled={busy !== null || wrongChain} onClick={() => sendStep("Permit2 allowance", secondStep(), loadPerm)} data-testid="approve-permit2">
                    {busy === "Permit2 allowance" ? "Confirm in wallet…" : "Allow the router inside Permit2 (30 minutes)"}
                  </PixelButton>
                ) : null}
                {ready ? (
                  <p className="note good" data-testid="permission-ok">
                    Allowance is enough for this swap.
                  </p>
                ) : null}
              </div>
              {firstStep && steps && !steps[0].ok ? (
                <div className="mt-5">
                  <p className="t-mono-s">THE APPROVAL YOU WOULD SIGN</p>
                  <div className="mt-2">
                    <DecodedView d={decodeTx(firstStep, names)} />
                  </div>
                </div>
              ) : null}
            </>
          ) : needsApproval ? (
            <PixelButton tone="light" onClick={openWallet}>
              Connect to read it
            </PixelButton>
          ) : (
            <p className="t-body">Nothing to approve. Lower or remove older approvals any time on the permissions page.</p>
          )}
          <p className="t-mono-s mt-6">
            <Link href="/permissions" className="link">
              See and lower every allowance this site can read
            </Link>
          </p>
        </div>
      </div>

      <div className="col2 mt-[90px]">
        <Eyebrow>Step 3 · Transaction review</Eyebrow>
        <h2 className="h-sec" style={{ maxWidth: 620 }}>
          What your wallet will be asked to sign
        </h2>
      </div>
      <div className="split mt-[50px] rule" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <p className="t-mono-s">DECODED FROM THE BYTES</p>
          <p className="t-body mt-2">
            Call to{" "}
            <a className="link" href={explorerAddress(c.address)} target="_blank" rel="noreferrer">
              {c.label}
            </a>
            . No contract of ours is in this transaction.
          </p>
          <div className="mt-4">{decoded ? <DecodedView d={decoded} /> : <p className="note bad">This route cannot be turned into a transaction for these assets. Pick another.</p>}</div>
          {tx ? (
            <details className="mt-4">
              <summary className="t-mono-s cursor-pointer">Raw calldata</summary>
              <p className="addr mt-2" data-testid="raw-calldata">
                {tx.data}
              </p>
            </details>
          ) : null}
        </div>
        <div className="p-10" style={{ minWidth: 0 }}>
          <p className="t-mono-s">SIMULATION</p>
          <p className="t-body mt-2">An eth_call of these exact bytes against the newest block, {account ? "from your address" : "from a throwaway address given ETH for one call"}. Nothing is sent.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PixelButton tone="light" disabled={!tx || simBusy} onClick={runSim} data-testid="simulate">
              {simBusy ? "Simulating…" : sim ? "Simulate again" : "Run simulation"}
            </PixelButton>
          </div>
          {sim ? (
            <div className={`note mt-4 ${sim.ok ? "good" : "bad"}`} data-testid="sim-result">
              {sim.ok ? (
                <>
                  Would not revert at block {sim.block?.toLocaleString("en-US")}
                  {sim.gas ? `, about ${Number(sim.gas).toLocaleString("en-US")} gas` : ""}. This describes this block only; it is not a statement about the token.
                </>
              ) : (
                <>
                  Would revert: {sim.revert}
                  {!ready ? " The allowance above is not in place yet, which is the usual reason." : ""}
                </>
              )}
            </div>
          ) : null}
          <div className="mt-8">
            {!account ? (
              <PixelButton tone="light" wide onClick={openWallet} data-testid="connect-to-sign">
                Connect wallet to sign
              </PixelButton>
            ) : wrongChain ? (
              <PixelButton tone="light" wide onClick={() => void switchNetwork()}>
                Switch to Robinhood Chain
              </PixelButton>
            ) : (
              <PixelButton tone="light" wide disabled={!tx || !sim?.ok || !ready || busy !== null} onClick={() => tx && sendStep("Swap", { to: tx.to, data: tx.data, value: tx.value })} data-testid="sign-swap">
                {busy === "Swap" ? "Confirm in wallet…" : !sim?.ok ? "Simulate first" : "Sign in wallet"}
              </PixelButton>
            )}
          </div>
          {txErr ? (
            <p className="note bad mt-3" role="alert" data-testid="tx-error">
              {txErr}
            </p>
          ) : null}
          {sent.length ? (
            <ul className="mt-4 grid gap-2">
              {sent.map((s) => (
                <li key={s.hash} className="kv" data-testid="sent-tx">
                  <span>{s.what}</span>
                  <span>
                    <a className="addr link" href={explorerTx(s.hash)} target="_blank" rel="noreferrer">
                      {shortAddress(s.hash, 10, 8)}
                    </a>{" "}
                    {s.ok === null ? "· waiting" : s.ok ? "· confirmed" : "· reverted"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="t-mono-s mt-6" style={{ lineHeight: "20px" }}>
            Your address, the tokens and the amounts of this swap will be public on {`Robinhood Chain`}. Not financial advice.
          </p>
        </div>
      </div>
    </section>
  );
}
