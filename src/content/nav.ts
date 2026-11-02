/* The site's links, in one place, so the menu, the footer and the sitemap cannot drift apart. */
export const NAV_MAIN = [
  { href: "/", label: "Home" },
  { href: "/swap", label: "Compare routes" },
  { href: "/permissions", label: "Permissions" },
  { href: "/access", label: "Access proof" },
  { href: "/venues", label: "Venues" },
  { href: "/guides", label: "Guides" },
];
export const NAV_OTHER = [
  { href: "/how", label: "How it works" },
  { href: "/token", label: "Token" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];
export const SOURCES = ["Uniswap v2", "Uniswap v3", "Uniswap v4", "Pons", "Permit2", "Robinhood Chain", "Chainlink ETH/USD", "Noir", "UltraHonk"] as const;
