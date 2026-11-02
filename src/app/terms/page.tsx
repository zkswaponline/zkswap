import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { Eyebrow } from "@/components/ui/kit";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/terms", title: `Terms | ${BRAND.name}`, description: `The terms of using ${BRAND.name}: an interface that reads public data and prepares transactions you sign yourself.` });

const TERMS = [
  ["What this is", `${BRAND.name} is an interface. It reads public chain data and prepares transactions that you read and sign in your own wallet. It does not hold funds, keys or tokens, and it does not trade for you.`],
  ["Your decisions", "Quotes, checks and simulations describe a moment in time. They are not advice and not a promise of any outcome. You decide whether to send a transaction, and a sent transaction cannot be recalled."],
  ["Third parties", "Swaps run on venues we do not operate. Their contracts, fees and rules are theirs. Your wallet is also not ours."],
  ["Access groups", "Groups in the access book are run by their own admins and curators. We do not check who they are or what they admit."],
  ["The token", `${BRAND.symbol} carries no promised value, no share of anything and no claim on anyone. Any planned use is labelled as planned.`],
  ["No warranty", "The site and its code are provided as they are, without warranty. The code is under the MIT license."],
];

export default function Page() {
  return (
    <section className="sec on-paper" style={{ paddingTop: 170, paddingBottom: 110 }}>
      <div className="col2">
        <Eyebrow>Terms</Eyebrow>
        <h1 className="h-page">Plain terms</h1>
        <div className="mt-10" style={{ maxWidth: 660 }}>
          {TERMS.map(([t, p]) => (
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
