import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { VENUES } from "@/config/venues";
import { Chevrons, Eyebrow } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/venues", title: `Swap venues on ${BRAND.chainName} | ${BRAND.name}`, description: `The venues ${BRAND.name} compares on ${BRAND.chainName}: Uniswap v2, v3, v4 and Pons curves, how each one is quoted and what you sign.` });

export default function Page() {
  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>Venues</Eyebrow>
        <h1 className="h-page">The venues behind every quote</h1>
        <p className="lede">We do not run a pool or a router. These are the contracts your wallet calls, how a quote is read from each, and where its numbers stop.</p>
      </div>
      <div className="mt-[75px]" style={{ borderBottom: "1px solid var(--line)" }}>
        {VENUES.map((v) => (
          <Link key={v.slug} href={`/venues/${v.slug}`} className="vrow">
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
      <div style={{ height: 100 }} />
    </section>
  );
}
