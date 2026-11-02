import { BRAND, LAUNCHPAD, TOKEN } from "@/config/brand";

/* Answers are written to be true today; anything not built says planned. */
export type FaqItem = { q: string; a: string };
export type FaqGroup = { tab: string; items: FaqItem[] };

export const FAQ: FaqGroup[] = [
  {
    tab: "Overview",
    items: [
      { q: `What is ${BRAND.name}?`, a: `A swap interface for ${BRAND.chainName} that slows the last step down. It compares quotes across venues, shows the allowance a route needs and who gets it, decodes the transaction, simulates it, and then your wallet signs a direct transaction to the venue.` },
      { q: `Does ${BRAND.name} hold my funds?`, a: `No. There is no ${BRAND.name} router or pool in a swap. Your wallet talks straight to Uniswap or Pons. The only contract of ours is the access book, which holds no funds or tokens and is not in the swap path.` },
      { q: "Do I need a wallet to look around?", a: "No. Quotes, venue facts and guides work without one. You need a wallet to read your own allowances, to simulate from your own address and to sign." },
      { q: "Is this financial advice?", a: "No. Routes are ranked by what the quoters returned at one block. Nothing here tells you whether to trade." },
    ],
  },
  {
    tab: "Risks",
    items: [
      { q: "What can still go wrong after a clean simulation?", a: "The simulation describes one block. Other swaps can land first and move the price; your minimum received then makes the transaction revert rather than fill badly. A token can take a tax, change its rules or stop transfers later. A clean simulation is not a safety statement about a token." },
      { q: "Is an unlimited approval ever needed?", a: "Not for a swap here. The default is an approval of exactly the amount. Unlimited is available only if you tick it yourself, and the review says so in capitals. An exact approval costs a little more gas next time; an unlimited one stays open until you lower it." },
      { q: "Does an access proof make my swap anonymous?", a: "No. A proof hides which member of a group you are. The wallet that records it, the tokens, the amounts and all of that wallet's activity stay visible on an EVM chain." },
      { q: "What are the risks of the contract?", a: "The access book is new code with no admin and no upgrade path, so a mistake in it cannot be patched in place. A group's curator can add any member, and a root is only as honest as its curator; the site recomputes every root from the published leaves and shows the result. No funds are ever at stake in it." },
    ],
  },
  {
    tab: "Venues",
    items: [
      { q: "Which venues are compared?", a: "Uniswap v2, v3 and v4 on Robinhood Chain, and Pons bonding curves. Each answers at the same block. A venue with no pool for the pair is simply absent from the table." },
      { q: "Why does a route show an estimate?", a: "Selling into a Pons curve pulls tokens with an allowance, which a plain read cannot grant. The number is the curve's reserve formula with its fee and tax, marked as an estimate. Once the allowance exists, the simulation step runs the real call." },
      { q: "What is cost against current price?", a: "The gap between what the quoter returned and what the same amount would buy at each pool's price right now. It is price impact plus pool fees, shown as one number." },
      { q: "Why Permit2 for v4 routes?", a: "The Universal Router pulls tokens through Permit2. That means two layers: the token allows Permit2, and Permit2 allows the router with an amount and an expiry. The permission check shows both." },
    ],
  },
  {
    tab: "Token",
    items: [
      { q: `What is ${BRAND.symbol}?`, a: `The project's token, ${TOKEN.isLive ? `live on ${LAUNCHPAD.name}` : `launching on ${LAUNCHPAD.name}`}. Every feature on this site works without it. Any utility for it is planned, not built, and it carries no promise of value.` },
      { q: "Which address is the real one?", a: `Only the address shown on this site's token page and posted by ${BRAND.xHandle}. ${TOKEN.isLive ? "" : "There is no address yet: anything claiming to be it today is not ours."}` },
      { q: "Will holding it unlock anything?", a: "Not today. Using the token for access or features is planned and would be announced only when it exists. Access groups here run on membership proofs, not on holding a token." },
    ],
  },
];
