import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { GUIDES, guideBySlug } from "@/content/guides";
import { Eyebrow, PixelLink } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return pageMeta({ path: `/guides/${g.slug}`, title: `${g.title} | ${BRAND.name}`, description: g.dek, type: "article" });
}

export default async function Page({ params }: P) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  return (
    <article className="sec on-paper" style={{ paddingTop: 170, paddingBottom: 110 }}>
      <div className="col2">
        <Eyebrow>
          {g.date} · {g.mins} mins read
        </Eyebrow>
        <h1 className="h-page">{g.title}</h1>
        <p className="lede">{g.dek}</p>
      </div>
      <div className="mt-[50px]" style={{ height: 360, background: `#0d0d0d url(${g.img}) center / cover no-repeat` }} />
      <div className="col2 mt-[50px]" style={{ maxWidth: "none" }}>
        <div style={{ maxWidth: 660 }}>
          {g.body.map((b, i) => (
            <div key={i} className="mb-8">
              {b.h ? <h2 className="t-card mb-3">{b.h}</h2> : null}
              <p className="text-[16px] leading-[27.2px] font-light" style={{ color: "var(--fg)" }}>
                {b.p}
              </p>
            </div>
          ))}
          <PixelLink href="/swap" className="mt-4">
            Compare routes
          </PixelLink>
        </div>
      </div>
    </article>
  );
}
