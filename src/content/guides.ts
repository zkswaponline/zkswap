import { ASSETS } from "@/config/assets";

/* Guides are short and practical. Every number in them comes from how the site computes things, never from market data. */
export type Guide = { slug: string; title: string; dek: string; date: string; mins: number; img: string; body: { h?: string; p: string }[] };

export const GUIDES: Guide[] = [
  {
    slug: "reading-a-route-table",
    title: "How to read a route table without fooling yourself",
    dek: "The biggest output number is a good start and a poor finish. Fee, cost against the current price and your minimum tell you the rest.",
    date: "Nov 1, 2026",
    mins: 3,
    img: ASSETS.guides[0],
    body: [
      { p: "Every row in the table answers one question: if this amount went through this route at this block, what comes out? All rows are read at the same block, so they can be compared with each other. They cannot be compared with a screenshot from a minute ago." },
      { h: "Expected output", p: "This is what the venue's own quoter returned. It already includes the pool fee. If the route has a token that taxes transfers, the quote may include that too, or may not: it depends on the venue and the direction." },
      { h: "Cost against current price", p: "The site prices your amount at each pool's price right now, with no fee and no movement, and compares it with the quote. The gap is price impact plus fees. A large gap on a small trade tells you the pool is thin." },
      { h: "Minimum received", p: "This is your slippage setting applied to the expected output, and it is what the transaction enforces. If the pool moves past it, the swap reverts and you lose only gas. Set it wider and you accept worse fills; set it too tight and the swap fails more often." },
      { h: "A hook on the route", p: "A Uniswap v4 pool may carry a hook, which runs code during your swap. The table flags it. The quoter simulated the hook as it behaves at this block, and that is all anyone can say about it from here." },
    ],
  },
  {
    slug: "exact-approvals",
    title: "Exact approvals, and what unlimited really costs",
    dek: "An approval outlives the swap that asked for it. Here is what it allows, and how to take it back.",
    date: "Nov 1, 2026",
    mins: 2,
    img: ASSETS.guides[1],
    body: [
      { p: "An ERC-20 approval lets a contract move your token later, without asking again. Swapping needs one because the router pulls the token from you. The amount is yours to choose." },
      { h: "Why this site defaults to exact", p: "An approval of exactly the swap amount is used up by the swap. Nothing stays open afterwards. It costs one more approval next time, which is the whole of the downside." },
      { h: "When unlimited is a choice", p: "Some people trade the same token often and prefer to pay for one approval. That is a fair choice as long as it is a choice. Here it sits behind a box you tick, and the review prints it in capitals." },
      { h: "Permit2 has two layers", p: "Uniswap v4 routes go through Permit2. The token allows Permit2, then Permit2 allows the router for an amount until an expiry. The site sets a 30-minute expiry on the second layer." },
      { h: "Taking it back", p: "Setting an allowance to zero is an ordinary transaction. The permissions page lists what you have given to the venues this site can use, and writes the zero for you to sign. It cannot see approvals to contracts it does not know about." },
    ],
  },
  {
    slug: "reading-calldata",
    title: "What the decoded transaction is telling you",
    dek: "The review panel reads back the exact bytes your wallet will sign. Four lines deserve your attention.",
    date: "Nov 1, 2026",
    mins: 3,
    img: ASSETS.guides[2],
    body: [
      { p: "The decoder is separate from the code that builds the transaction, on purpose. It starts from the raw bytes, so a mistake in the builder would show here instead of hiding behind it." },
      { h: "The contract", p: "This should be the venue you picked: a Uniswap router or the curve of that token. If it names anything else, stop." },
      { h: "The recipient", p: "This should be your wallet. On routes that pay out ETH through a wrap, the first step pays the router and the next call unwraps to you; both lines are shown." },
      { h: "The minimum", p: "This is the number that protects you, in the token's own units and in raw units. It should match the table." },
      { h: "The deadline", p: "The transaction reverts after this time. The site sets 20 minutes." },
      { h: "Then compare with your wallet", p: "Your wallet shows the same transaction in its own words. Reading both is the point: this site is not the last word on what you sign, your wallet is." },
    ],
  },
  {
    slug: "what-a-simulation-proves",
    title: "What a simulation proves, and what it does not",
    dek: "A clean eth_call says one thing about one block. That is useful and it is narrow.",
    date: "Nov 1, 2026",
    mins: 2,
    img: ASSETS.guides[3],
    body: [
      { p: "Before the wallet opens, the site runs the exact transaction as a read against the newest block, from your address, and estimates its gas. Nothing is sent." },
      { h: "A clean result tells you", p: "At this block, from this address, with these allowances and this balance, the call would not revert." },
      { h: "It does not tell you", p: "That it will still be true when your transaction lands. That the token is well behaved. That you can sell it later. That the price is fair. Those are different questions." },
      { h: "A failed result", p: "The site prints the reason when the contract gives one, and will not open your wallet for that transaction. The most common causes are a missing allowance, a low balance and a minimum the pool can no longer meet." },
    ],
  },
  {
    slug: "access-proofs",
    title: "What an access proof shows, and what stays public",
    dek: "A group can check that you belong without learning which member you are. Your swaps stay exactly as visible as before.",
    date: "Nov 1, 2026",
    mins: 4,
    img: ASSETS.guides[4],
    body: [
      { p: "A group's curator publishes a tree of member entries and its root. You hold a secret that matches one entry. Your browser builds a proof that says: I know a secret for some entry under this root, it has not expired, and this one-time tag belongs to this epoch." },
      { h: "What the proof keeps private", p: "Which entry is yours, your secret, and when your membership expires. The proving happens in a worker inside your browser; none of it is sent to this site." },
      { h: "What stays public", p: "The wallet that records the proof, and that the wallet recorded one for this group in this epoch. Then every swap that wallet makes: address, tokens, amounts, timing. On an EVM chain, all of that is visible to anyone. A proof does not change it." },
      { h: "So what is it for", p: "Unlocking group screens without a member list that names wallets. The gate is in this site's interface: pools and routers never look at the record, and anyone can read a group's presets from chain. Pools that enforce a proof on chain are planned, not built." },
      { h: "Using two wallets", p: "Recording from a fresh wallet separates the record from your main address, as far as that wallet stays separate. Funding it from your main wallet links them again. This site does not help with that and cannot promise anything about it." },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
