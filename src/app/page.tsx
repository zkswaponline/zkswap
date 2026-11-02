import type { Metadata } from "next";
import Link from "next/link";
import { ASSETS } from "@/config/assets";
import { BRAND } from "@/config/brand";
import { VENUES } from "@/config/venues";
import { FAQ } from "@/content/faq";
import { GUIDES } from "@/content/guides";
import { SOURCES } from "@/content/nav";
import { JsonLd } from "@/components/JsonLd";
import { FaqBlock } from "@/components/home/FaqBlock";
import { FlowTabs } from "@/components/home/FlowTabs";
import { BlockTag, Dash, ThreeStats } from "@/components/home/LiveStats";
import { RouteCanvas } from "@/components/home/RouteCanvas";
import { Chevrons, Eyebrow, Marquee, PixelLink, ScrollWords } from "@/components/ui/kit";
import { GlyphEye, GlyphKey, GlyphRoute, GlyphTree, IsoPermission, IsoProof, IsoReview, IsoRoutes } from "@/components/ui/iso";
import { HOME_DESCRIPTION, HOME_TITLE, appLd, faqLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

const LIST = ["Route comparison", "Permission check", "Transaction review", "ZK access proof"];

const FEATURES = [
  { Icon: IsoRoutes, t: "Route Compare", p: "Quotes from Uniswap v2, v3, v4 and Pons curves at one block, with fee, cost against the current price and your minimum." },
  { Icon: IsoPermission, t: "Permission Check", p: "See the spender by name, what it can move today, and the exact amount this swap needs. Unlimited is never the default." },
  { Icon: IsoReview, t: "Tx Review", p: "The exact bytes your wallet will sign, decoded into plain lines and simulated from your address before the prompt opens." },
  { Icon: IsoProof, t: "Access Proof", p: "An optional Noir proof made in your browser: you hold a live membership of a group, without saying which one." },
];

const APPROACH = [
  { Icon: IsoRoutes, t: "Compare", p: "All routes at one block, ranked by what they return. Nothing is hidden behind a single best price." },
  { Icon: IsoPermission, t: "Verify", p: "Spender, allowance, calldata and simulation. You see each one before the wallet asks for anything." },
  { Icon: IsoReview, t: "Swap", p: "A direct transaction from your wallet to the venue. No router of ours, no custody, no fee of ours." },
];

const LIMITS = [
  { side: "The swap", t: "A proof does not make a swap anonymous", s: "Stated", p: "An access proof hides which member you are. Your address, the tokens, the amounts and your activity stay visible on an EVM chain." },
  { side: "The gate", t: "The gate lives in this interface", s: "App level", p: "A proof unlocks screens on this site and is recorded on chain. Pools and routers do not look at it. Enforcing it in a pool is planned, not built." },
  { side: "The quote", t: "A quote holds for one block", s: "One block", p: "The next swap in a pool moves it. Your minimum received is what the transaction enforces if the price moves." },
  { side: "The check", t: "A clean simulation is not a safety claim", s: "Narrow", p: "It says this call would not revert right now. It says nothing about whether a token is sound or whether you can sell it later." },
];

export default function HomePage() {
  const [big, ...small] = GUIDES;
  return (
    <>
      <JsonLd data={[appLd, faqLd(FAQ.flatMap((g) => g.items))]} />
      <section className="hero sec" style={{ backgroundImage: `url(/art/grain.webp), linear-gradient(to right, rgba(255,255,255,.075) 1px, transparent 1px), url(${ASSETS.heroBlocks})`, backgroundSize: "192px 192px, 25% 100%, cover", backgroundPosition: "0 0, -1px 0, center", ["--fg" as string]: "#fff" }}>
        <ul className="hero-list max-[809px]:order-2">
          {LIST.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="hero-marq">
          <Marquee items={["UNISWAP V2", "UNISWAP V3", "UNISWAP V4", "PONS", "PERMIT2", "ROBINHOOD CHAIN"]} />
        </div>
        <div className="hero-main">
          <h1 className="h-hero">{BRAND.slogan}</h1>
          <p className="lede" style={{ color: "#fff", maxWidth: 500 }}>
            {BRAND.tagline} On {BRAND.chainName}, signed in your own wallet.
          </p>
          <PixelLink href="/swap" className="mt-8" tone="light" data-testid="hero-cta">
            Compare routes
          </PixelLink>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 270 }}>
        <div className="col2">
          <div className="stack" aria-hidden="true">
            <span>
              <GlyphRoute />
            </span>
            <span>
              <GlyphKey />
            </span>
            <span>
              <GlyphEye />
            </span>
            <span>
              <GlyphTree />
            </span>
          </div>
          <ScrollWords className="statement" text="A swap is three questions before it is a signature. Which route pays what, right now? What am I allowing, and to whom? What exactly am I about to sign? This site answers them in the open, then steps aside." />
          <p className="lede">Your wallet makes the transaction, straight to the venue. There is no router of ours in the path and no balance of yours anywhere near us.</p>
        </div>
        <div className="grid4 rule" style={{ marginTop: 120 }}>
          {FEATURES.map(({ Icon, t, p }) => (
            <div key={t} className="cell" style={{ paddingTop: 44 }}>
              <div className="dotted grid place-items-center" style={{ height: 210, marginBottom: 36 }}>
                <Icon size={130} />
              </div>
              <h3 className="t-card">{t}</h3>
              <p className="t-body mt-5">{p}</p>
            </div>
          ))}
        </div>

        <div className="rule in25" style={{ paddingTop: 110, paddingBottom: 90 }}>
          <Eyebrow>Live from the chain</Eyebrow>
          <p className="t-22 mt-6" style={{ maxWidth: 430 }}>
            Nothing below is a claim about us. These are readings from {BRAND.chainName}, taken a few seconds ago.
          </p>
          <PixelLink href="/how" className="mt-8">
            How it works
          </PixelLink>
        </div>
        <ThreeStats />
        <div className="film" style={{ backgroundImage: `url(${ASSETS.panelCells})` }}>
          <BlockTag />
          <img src={ASSETS.mark} alt="" width={120} height={120} className="absolute" style={{ left: "calc(50% - 60px)", top: "calc(50% - 30px)" }} />
        </div>
      </section>

      <section className="sec on-paper" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>Venues</Eyebrow>
          <h2 className="h-sec">Four venues, one table</h2>
          <p className="lede">Each venue quotes in its own way and asks for a different permission. Here is what each one reads, what you sign, and what the numbers leave out.</p>
        </div>
        <div className="mt-[75px]">
          {VENUES.map((v) => (
            <Link key={v.slug} href={`/venues/${v.slug}`} className="vrow" data-testid="venue-row">
              <span className="vrow-tag">{v.tag.replace("//", "")}</span>
              <span className="col-a t-mono">
                {v.tag}
              </span>
              <span className="col-b">
                <span className="t-22 block">{v.name}</span>
                <span className="t-mono mt-6 block" style={{ maxWidth: 430 }}>
                  {v.short}
                </span>
              </span>
              <span className="chev">
                <Chevrons />
              </span>
            </Link>
          ))}
        </div>
        <div className="rule in25" style={{ paddingTop: 60, paddingBottom: 100 }}>
          <PixelLink href="/venues">All venues</PixelLink>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>The flow</Eyebrow>
          <h2 className="h-sec">Read it before you sign</h2>
          <p className="lede">Six steps in a fixed order. The wallet opens at the end, not at the start, and only for a transaction that survived its simulation.</p>
        </div>
        <div className="mt-[60px]">
          <RouteCanvas />
        </div>
        <div className="grid4 rule mt-[60px]">
          {[
            ["One table", "Every venue with a pool answers at one block, so the rows are comparable."],
            ["Exact by default", "An approval covers this swap and no more. Anything wider is your explicit choice."],
            ["Decoded bytes", "The review starts from the raw calldata, not from what the builder meant to write."],
            ["Local proving", "A membership proof is made in a browser worker. The secret never reaches this site."],
          ].map(([t, p]) => (
            <div key={t} className="cell">
              <h3 className="t-card">{t}</h3>
              <p className="t-body mt-5">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec rule" style={{ paddingTop: 170, paddingBottom: 110 }}>
        <div className="col2">
          <Eyebrow>Chain readings</Eyebrow>
          <h2 className="h-sec">The chain, right now</h2>
          <p className="lede">Block pace, gas and the ETH reference price, polled every few seconds through this site&apos;s read relay. A dash means there is no reading yet.</p>
        </div>
        <div className="mt-[60px]">
          <Dash />
        </div>
      </section>

      <section className="split sec on-paper">
        <div className="split-art" style={{ backgroundImage: `url(${ASSETS.panelLens})` }} />
        <div style={{ paddingTop: 120 }}>
          <div style={{ padding: "0 40px" }}>
            <Eyebrow>Our approach</Eyebrow>
            <h2 className="h-sec">Three words, in order</h2>
            <p className="lede">Compare first, verify second, swap last. The order is the product: each step has to answer before the next one opens.</p>
          </div>
          <div className="mt-[60px] grid grid-cols-1 sm:grid-cols-2" style={{ borderTop: "1px solid var(--line)" }}>
            {APPROACH.map(({ Icon, t, p }) => (
              <div key={t} className="p-10" style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                <Icon size={72} />
                <h3 className="t-card mt-8">{t}</h3>
                <p className="t-body mt-4">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>Step by step</Eyebrow>
          <h2 className="h-sec">What each step shows you</h2>
          <p className="lede">Four checks, the same four whether you trade a stock token, a launch still on its curve, or plain ETH.</p>
        </div>
        <div className="mt-[60px]">
          <FlowTabs />
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 150 }}>
        <div className="col2">
          <Eyebrow>Built on</Eyebrow>
          <ScrollWords className="statement" text="zkSwap is a clearer window, not a new market. The liquidity is the venues'. The prices come from their quoters. The proof system is open. Each name below is something you can check without us." />
        </div>
        <div className="gridsrc mt-[80px]">
          {[...SOURCES, "EIP-6963", "Blockscout", "MIT license"].map((s) => (
            <div key={s} className="srccell">
              <span>{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec on-paper" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>Plain limits</Eyebrow>
          <h2 className="h-sec">What this does not do</h2>
          <p className="lede">Four things worth reading before the first quote. They are also on the pages where they apply.</p>
        </div>
        <div className="lcards mt-[60px]">
          {LIMITS.map((l) => (
            <article key={l.t} className="lcard" data-testid="limit-card">
              <div className="lside">
                <GlyphEye />
                <span>{l.side}</span>
              </div>
              <div className="lbody">
                <h3 className="t-22" style={{ minHeight: 86 }}>
                  {l.t}
                </h3>
                <p className="t-mono-s mt-10" style={{ color: "var(--fg)" }}>
                  STATUS
                </p>
                <p className="mt-2">
                  <span className="tag">{l.s}</span>
                </p>
                <p className="t-mono-s mt-auto pt-10" style={{ color: "var(--fg)" }}>
                  WHY IT MATTERS
                </p>
                <p className="t-body mt-3">{l.p}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="py-5" style={{ borderBottom: "1px solid var(--line)" }}>
          <Marquee items={["COMPARE", "VERIFY", "SWAP", "NOT FINANCIAL ADVICE", "SIGNED IN YOUR WALLET", "NO CUSTODY"]} />
        </div>
      </section>

      <section className="sec on-paper" style={{ paddingTop: 170 }}>
        <div className="col2">
          <Eyebrow>Guides</Eyebrow>
          <h2 className="h-sec">Read before you swap</h2>
          <p className="lede">Short notes on what the numbers mean and where they stop. Written for people who read the transaction, or want to start.</p>
        </div>
        <div className="mt-[60px] grid grid-cols-1 min-[810px]:grid-cols-[2fr_1fr_1fr] rule">
          <div className="p-10">
            <Link href={`/guides/${big.slug}`} className="gcard" style={{ backgroundImage: `url(${big.img})`, height: 380 }}>
              <h3>{big.title}</h3>
            </Link>
            <p className="t-mono-s mt-10 uppercase">{big.date}</p>
            <p className="t-mono-s uppercase">{big.mins} mins read</p>
            <p className="t-body mt-5" style={{ fontSize: 14, lineHeight: "21px", maxWidth: 410 }}>
              {big.dek}
            </p>
          </div>
          {small.slice(0, 2).map((g) => (
            <div key={g.slug} className="p-10" style={{ borderLeft: "1px solid var(--line)" }}>
              <Link href={`/guides/${g.slug}`} className="block">
                <span className="gcard" style={{ backgroundImage: `url(${g.img})`, height: 200 }} />
                <span className="t-22 mt-6 block">{g.title}</span>
              </Link>
              <p className="t-mono-s mt-6 uppercase">{g.date}</p>
              <p className="t-mono-s uppercase">{g.mins} mins read</p>
            </div>
          ))}
        </div>
        <div className="rule in50 flex flex-wrap items-center justify-between gap-4 py-10">
          <div>
            <p className="t-mono-s mb-4">All guides, in one place.</p>
            <PixelLink href="/guides">All guides</PixelLink>
          </div>
        </div>
      </section>

      <section className="split sec on-paper rule">
        <div className="flex flex-col justify-between gap-10 p-10">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="h-sec">Common questions</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: 520 }}>
              What the site does, what it leaves to you, and where the token fits. Cannot find it? Ask on X.
            </p>
            <PixelLink href={BRAND.x} className="mt-6">
              Ask on X
            </PixelLink>
          </div>
        </div>
        <div style={{ borderLeft: "1px solid var(--line)" }}>
          <FaqBlock />
        </div>
      </section>
    </>
  );
}
