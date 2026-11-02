import Link from "next/link";
import { ASSETS } from "@/config/assets";
import { BRAND, hasGithub } from "@/config/brand";
import { NAV_MAIN, NAV_OTHER } from "@/content/nav";
import { XLogo } from "@/components/site/Icons";
import { CtaForm } from "@/components/shell/CtaForm";
import { Eyebrow, Reveal } from "@/components/ui/kit";

/** The closing band (a real entry to the route table) and the footer. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <>
      <section className="cta" style={{ backgroundImage: `linear-gradient(to bottom, rgba(6,6,6,0) 40%, #060606 88%), url(${ASSETS.panelField})` }}>
        <div className="col2" style={{ color: "#fff", ["--fg" as string]: "#fff", ["--muted" as string]: "rgba(255,255,255,.9)" }}>
          <Reveal>
            <Eyebrow>Get started</Eyebrow>
            <h2 className="h-sec" style={{ maxWidth: 560 }}>
              Start with one quote
            </h2>
            <p className="lede">Paste a token address and see every route that answers right now. No account, nothing signed.</p>
            <CtaForm />
          </Reveal>
        </div>
      </section>
      <footer className="sec" style={{ paddingTop: 1 }}>
        <div className="grid4 rule">
          <div className="cell" style={{ display: "grid", placeItems: "center", borderRight: 0 }}>
            <img src={ASSETS.mark} alt="" width={130} height={130} />
          </div>
          <div className="cell" style={{ borderRight: 0 }}>
            <p className="t-mono-s" style={{ color: "var(--faint)" }}>
              SITE
            </p>
            <ul className="mt-4 space-y-3">
              {NAV_MAIN.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[16px] font-light" style={{ color: "var(--muted)" }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="cell" style={{ borderRight: 0 }}>
            <p className="t-mono-s" style={{ color: "var(--faint)" }}>
              MORE
            </p>
            <ul className="mt-4 space-y-3">
              {NAV_OTHER.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[16px] font-light" style={{ color: "var(--muted)" }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="cell">
            <p className="t-mono-s" style={{ color: "var(--faint)" }}>
              FOLLOW
            </p>
            <div className="mt-4 flex gap-3">
              <a href={BRAND.x} target="_blank" rel="noreferrer" className="social" aria-label="X">
                <XLogo size={15} />
              </a>
            </div>
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer" className="mt-4 block text-[14px] link">
                Source code
              </a>
            ) : null}
            <p className="t-body mt-6" style={{ fontSize: 13, lineHeight: "20px" }}>
              Not financial advice. An access proof does not make a swap anonymous.
            </p>
          </div>
        </div>
        <div className="rule" style={{ paddingTop: 48 }}>
          <div className="bigword" aria-hidden="true">
            {BRAND.slug}
          </div>
          <p className="t-mono-s" style={{ textAlign: "center", padding: "16px 20px 24px" }}>
            ©{year} {BRAND.name}. MIT licensed code. {BRAND.domain}
          </p>
        </div>
      </footer>
    </>
  );
}
