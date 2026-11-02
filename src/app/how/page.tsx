import type { Metadata } from "next";
import { ASSETS } from "@/config/assets";
import { BRAND } from "@/config/brand";
import { bookLive } from "@/config/contracts";
import { Eyebrow, PixelLink, PlannedTag, RealTag, Reveal } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/how", title: `How it works | ${BRAND.name}`, description: `How ${BRAND.name} works: route comparison, permission check, transaction review and the optional access proof, and what runs today against what is planned.` });

/* Counts are facts of the code (venues quoted, layers checked, public inputs), never performance claims. */
const COUNTS = [
  { n: "//01", v: 4, of: 4, label: "venues", t: "Route comparison", p: "Uniswap v2, v3, v4 and Pons curves, all quoted at one block." },
  { n: "//02", v: 2, of: 4, label: "layers", t: "Permission check", p: "The token allowance, and Permit2 with its expiry where a route uses it." },
  { n: "//03", v: 1, of: 4, label: "simulation", t: "Transaction review", p: "Decoded from the raw bytes, then run once against the newest block." },
  { n: "//04", v: 5, of: 5, label: "public inputs", t: "Access proof", p: "Root, scope, epoch, nullifier and wallet. Everything else stays in your browser." },
];

const REAL = [
  ["Route comparison", "Quotes through eth_call on Uniswap v2, v3, v4 and Pons, with fee, cost and minimum."],
  ["Permission check", "Current allowance, spender identity, exact approve by default, unlimited only by your choice."],
  ["Transaction review", "Decoded calldata and an eth_call simulation before the wallet prompt. You sign a direct venue transaction."],
  ["Access proof", "A Noir circuit proved in a browser worker, in a practice group until the book is deployed. A group-gated desk opens in this interface."],
  ["Access book", "ZkswapAccessBook: per-group admin, roots, per-epoch nullifiers. Live on Robinhood Chain with verified source."],
];

const PLANNED = [
  ["Gated pools", "Pools that enforce a proof on chain. Today the gate is only in this interface."],
  ["Developer API", "Routes and checks as an API for other builders."],
  [`${BRAND.symbol} utility`, "Any use of the token inside the product. It has none today."],
];

function Gauge({ v, of }: { v: number; of: number }) {
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
      {Array.from({ length: 40 }).map((_, i) => {
        const a = (i / 40) * 2 * Math.PI - Math.PI / 2;
        const on = i / 40 < v / of;
        return <line key={i} x1={55 + 34 * Math.cos(a)} y1={55 + 34 * Math.sin(a)} x2={55 + (on ? 52 : 46) * Math.cos(a)} y2={55 + (on ? 52 : 46) * Math.sin(a)} stroke="currentColor" strokeOpacity={on ? 0.9 : 0.25} />;
      })}
    </svg>
  );
}

export default function Page() {
  return (
    <>
      <section className="sec on-paper" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="h-page">A slower last step for every swap</h1>
          <p className="lede">{BRAND.name} is a {BRAND.category}. It helps you and your tools compare routes, read costs, understand token permissions and review a transaction before the wallet asks for approval.</p>
        </div>
        <div className="mt-[50px] grid grid-cols-1 min-[810px]:grid-cols-[1fr_2fr_1fr]" style={{ gap: 40, height: "auto" }}>
          {ASSETS.strata.map((s, i) => (
            <div key={s} style={{ height: 420, background: `url(${s}) center / cover no-repeat`, marginTop: 0 }} aria-hidden="true" data-i={i} />
          ))}
        </div>
        <div className="rule in25" style={{ paddingTop: 50, paddingBottom: 60, marginTop: 50 }}>
          <p className="text-[16px] leading-[27.2px] font-light" style={{ maxWidth: 660, color: "var(--fg)" }}>
            The product has no pool, no router and no balance of yours. It reads quotes the venues already offer, reads the allowances you already gave, and shows you the bytes before you sign them. The one contract of ours keeps a public book of access groups, and it is never in a swap&apos;s path.
          </p>
        </div>
        <div className="grid4 rule">
          {COUNTS.map((c) => (
            <Reveal key={c.n} className="cell">
              <p className="t-mono">{c.n}</p>
              <div className="relative mx-auto my-6 grid place-items-center" style={{ width: 110, height: 110 }}>
                <span className="absolute">
                  <Gauge v={c.v} of={c.of} />
                </span>
                <span className="text-[15px]">
                  {c.v}
                </span>
              </div>
              <p className="t-mono-s text-center">{c.label}</p>
              <h2 className="t-card mt-8">{c.t}</h2>
              <p className="t-body mt-4">{c.p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="sec on-paper rule" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>What runs today</Eyebrow>
          <h2 className="h-sec">Real means you can use it now</h2>
          <p className="lede">Everything in the left list works on this site. Everything in the right list does not exist yet, and says so wherever it comes up.</p>
        </div>
        <div className="split rule mt-[60px]" style={{ borderBottom: "1px solid var(--line)" }}>
          <ul className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
            {REAL.map(([t, p]) => (
              <li key={t} className="mb-8" data-testid="real-row">
                <p className="flex flex-wrap items-center gap-3">
                  <span className="t-card">{t}</span> {t === "Access book" && !bookLive() ? <span className="tag">WRITTEN, NOT DEPLOYED</span> : <RealTag />}
                </p>
                <p className="t-body mt-2">{p}</p>
              </li>
            ))}
          </ul>
          <ul className="p-10" style={{ minWidth: 0 }}>
            {PLANNED.map(([t, p]) => (
              <li key={t} className="mb-8" data-testid="planned-row">
                <p className="flex flex-wrap items-center gap-3">
                  <span className="t-card">{t}</span> <PlannedTag />
                </p>
                <p className="t-body mt-2">{p}</p>
              </li>
            ))}
            <p className="note warn">An access proof does not make a swap anonymous. On an EVM chain, your address, the tokens, the amounts and your activity stay visible.</p>
          </ul>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 150, paddingBottom: 110 }}>
        <div className="col2">
          <Eyebrow>The proof, briefly</Eyebrow>
          <h2 className="h-sec">What is proved, and what is not</h2>
        </div>
        <div className="grid grid-cols-1 min-[810px]:grid-cols-[1fr_1fr_1fr_1fr] rule mt-[60px]">
          <div className="p-10 min-[810px]:col-span-2" style={{ minWidth: 0 }}>
            <p className="text-[16px] leading-[27.2px] font-light">
              The circuit proves one sentence: I know a secret for an entry in the tree under this root, the entry has not expired at this epoch, this nullifier belongs to my secret, this group and this epoch, and this wallet is the one recording it. The book checks the proof, refuses a repeated nullifier, and records the wallet.
            </p>
            <p className="mt-5 text-[16px] leading-[27.2px] font-light">It does not prove that you are a person, that the curator was honest, or anything at all about the swap you make next.</p>
          </div>
          <div className="relative min-h-[300px] min-[810px]:col-span-2" style={{ background: `url(${ASSETS.panelGlobe}) center / cover no-repeat` }}>
            <div className="absolute bottom-8 left-8 right-8" style={{ color: "#fff" }}>
              <p className="t-22" style={{ color: "#fff" }}>
                Try it with a practice group. A real proof, no wallet needed.
              </p>
              <PixelLink href="/access" tone="light" className="mt-4">
                Open access proof
              </PixelLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
