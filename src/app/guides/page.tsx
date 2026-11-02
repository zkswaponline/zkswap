import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { GUIDES } from "@/content/guides";
import { Eyebrow } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/guides", title: `Guides | ${BRAND.name}`, description: `${BRAND.name} guides: reading a route table, exact approvals, decoded transactions, what a simulation proves and what an access proof leaves public.` });

export default function Page() {
  return (
    <section className="sec" style={{ paddingTop: 170 }}>
      <div className="col2">
        <Eyebrow>All guides</Eyebrow>
        <h1 className="h-page">What the numbers mean, and where they stop</h1>
        <p className="lede">Short notes for reading a route, an approval, a transaction and a proof. Nothing here tells you what to trade.</p>
      </div>
      <div className="mt-[60px] grid grid-cols-1 min-[810px]:grid-cols-2 rule">
        {GUIDES.map((g, i) => (
          <article key={g.slug} className="p-10" style={{ borderRight: i % 2 === 0 ? "1px solid var(--line)" : 0, borderBottom: "1px solid var(--line)", minWidth: 0 }}>
            <Link href={`/guides/${g.slug}`} className="gcard" style={{ backgroundImage: `url(${g.img})`, height: 380 }} data-testid="guide-card">
              <h2 style={{ position: "absolute", left: 30, right: 30, bottom: 30, fontSize: 22, lineHeight: "28.6px" }}>{g.title}</h2>
            </Link>
            <p className="t-mono-s mt-8 uppercase">{g.date}</p>
            <p className="t-mono-s uppercase">{g.mins} mins read</p>
            <p className="t-body mt-5" style={{ fontSize: 14, lineHeight: "21px", maxWidth: 480 }}>
              {g.dek}
            </p>
          </article>
        ))}
      </div>
      <div style={{ height: 80 }} />
    </section>
  );
}
