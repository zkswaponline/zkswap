import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND, explorerAddress } from "@/config/brand";
import { VENUES, venueBySlug } from "@/config/venues";
import { VenueCode } from "@/components/ui/VenueCode";
import { Eyebrow, PixelLink } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => VENUES.map((v) => ({ slug: v.slug }));

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const v = venueBySlug((await params).slug);
  if (!v) return {};
  return pageMeta({ path: `/venues/${v.slug}`, title: `${v.name} | ${BRAND.name}`, description: `How ${BRAND.name} quotes ${v.name} on ${BRAND.chainName}, what you sign and what the numbers leave out.` });
}

export default async function Page({ params }: P) {
  const v = venueBySlug((await params).slug);
  if (!v) notFound();
  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>{v.tag}</Eyebrow>
        <h1 className="h-page">{v.name}</h1>
        <p className="lede">{v.short}</p>
      </div>
      <div className="split rule mt-[60px]">
        <div className="p-10" style={{ borderRight: "1px solid var(--line)", minWidth: 0 }}>
          {[
            ["How a quote is read", v.quote],
            ["What you sign", v.how],
            ["What it asks you to allow", v.approval],
          ].map(([t, p]) => (
            <div key={t} className="mb-9">
              <h2 className="t-card">{t}</h2>
              <p className="t-body mt-3">{p}</p>
            </div>
          ))}
          <PixelLink href="/swap">Compare routes</PixelLink>
        </div>
        <div className="p-10" style={{ minWidth: 0 }}>
          <h2 className="t-card">Contracts</h2>
          <ul className="mt-3">
            {v.contracts.map((c) => (
              <li key={c.address} className="kv">
                <span className="t-mono-s">{c.label}</span>
                <span>
                  <a className="addr link" href={explorerAddress(c.address)} target="_blank" rel="noreferrer">
                    {c.address}
                  </a>
                  <span className="mt-1 block">
                    <VenueCode address={c.address} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <h2 className="t-card mt-10">Where the numbers stop</h2>
          <ul className="mt-3 grid gap-3">
            {v.limits.map((l) => (
              <li key={l} className="t-body">
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rule" style={{ height: 80 }} />
    </section>
  );
}
