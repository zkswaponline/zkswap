import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { Eyebrow } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/privacy", title: `Privacy | ${BRAND.name}`, description: `What ${BRAND.name} sees and stores: no accounts, no analytics, and an identity secret that stays in your browser.` });

const ITEMS = [
  ["No account", "There is no sign-up and no profile on this site."],
  ["What reaches our server", "To read chain data, your browser asks this site's server, and that request carries your IP address and whatever address or token you asked about. Network addresses are used for rate limits only and are not stored as records."],
  ["What stays in your browser", "Your access identity secret, practice groups, and your slippage setting live in this browser's storage. The prover runs in a worker here and sends nothing to us."],
  ["What is public anyway", "Anything you send to a chain is public: your address, tokens, amounts, and any access record. An access proof does not change that."],
  ["Your wallet", "Your wallet provider and any RPC it uses have their own policies, which we do not control."],
];

export default function Page() {
  return (
    <section className="sec on-paper" style={{ paddingTop: 170, paddingBottom: 110 }}>
      <div className="col2">
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="h-page">What we see, and what we do not</h1>
        <div className="mt-10" style={{ maxWidth: 660 }}>
          {ITEMS.map(([t, p]) => (
            <div key={t} className="mb-8">
              <h2 className="t-card">{t}</h2>
              <p className="t-body mt-2" style={{ color: "var(--fg)" }}>
                {p}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
