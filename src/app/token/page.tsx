import type { Metadata } from "next";
import { ASSETS } from "@/config/assets";
import { BRAND, LAUNCHPAD, TOKEN, buyUrl } from "@/config/brand";
import { CopyCa } from "@/components/site/CopyCa";
import { TokenLive } from "@/components/token/TokenLive";
import { Eyebrow, PixelLink, PlannedTag } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/token", title: `${BRAND.name} (${BRAND.symbol}) Token`, description: `The ${BRAND.name} token ${BRAND.symbol} on ${BRAND.chainName}: the one real contract address, its launch on ${LAUNCHPAD.name} and what is planned for it.` });

const PLANNED = ["Gated pools tied to on-chain proof checks", "Developer API access", "Anything else the token might do inside the product"];

export default function Page() {
  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>Token</Eyebrow>
        <h1 className="h-page">{BRAND.symbol}</h1>
        <p className="lede">The project&apos;s token on {BRAND.chainName}, {TOKEN.isLive ? `live on ${LAUNCHPAD.name}` : `launching on ${LAUNCHPAD.name}`}. Every feature on this site works without it. It carries no promised value. Not financial advice.</p>
      </div>
      <div className="split rule mt-[60px]">
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <p className="t-mono-s">CONTRACT ADDRESS</p>
          <div className="mt-3">
            <CopyCa variant="full" />
          </div>
          <p className="t-body mt-4">This page and {BRAND.xHandle} are the only places the real address is published. We never send it first in a DM.</p>
          <div className="mt-6">
            <TokenLive />
          </div>
          <PixelLink href={buyUrl()} tone="light" className="mt-6">
            {TOKEN.isLive ? `Open on ${LAUNCHPAD.name}` : `At launch · ${LAUNCHPAD.name}`}
          </PixelLink>
        </div>
        <div className="p-10" style={{ minWidth: 0, background: `linear-gradient(rgba(6,6,6,.55),rgba(6,6,6,.85)), url(${ASSETS.panelMenu}) center / cover` }}>
          <p className="flex items-center gap-3">
            <span className="t-card" style={{ color: "#fff" }}>
              Token utility
            </span>
            <PlannedTag />
          </p>
          <ul className="mt-5 grid gap-3">
            {PLANNED.map((p) => (
              <li key={p} className="t-body" style={{ color: "rgba(255,255,255,.85)" }}>
                {p}
              </li>
            ))}
          </ul>
          <p className="t-body mt-6" style={{ color: "rgba(255,255,255,.85)" }}>
            None of this exists today. If it ever does, it will be announced here. Access groups run on membership proofs, not on holding a token.
          </p>
        </div>
      </div>
      <div className="rule" style={{ height: 80 }} />
    </section>
  );
}
