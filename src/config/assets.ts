/*
 * Every image path the site uses. The logo set is the owner's artwork (2026/november/1/assets/apply-owner-art.mjs); the
 * panels under public/art are still drawn by referensi/tools/make-brand.mjs. To swap an image, replace the file at the same path or point the path here at a new file; no component
 * hard-codes an image path.
 */
export const ASSETS = {
  /** Transparent white mark (header, footer, film strip). */
  mark: "/brand/mark.webp",
  /** Padded mark on the dark plate (wallet avatar, token avatar). */
  markSquare: "/brand/mark-square.webp",
  /** Square PNG served by Next from src/app/icon.png (structured data needs a PNG logo). */
  logoPng: "/icon.png",
  og: "/opengraph-image.jpg",
  heroBlocks: "/art/hero-blocks.webp",
  panelCells: "/art/panel-cells.webp",
  panelLens: "/art/panel-lens.webp",
  panelField: "/art/panel-field.webp",
  panelMenu: "/art/panel-menu.webp",
  panelGlobe: "/art/panel-globe.webp",
  guides: ["/art/guide-1.webp", "/art/guide-2.webp", "/art/guide-3.webp", "/art/guide-4.webp", "/art/guide-5.webp"],
  tabs: { quote: "/art/tab-quote.webp", permission: "/art/tab-permission.webp", review: "/art/tab-review.webp", proof: "/art/tab-proof.webp" },
  strata: ["/art/strata-ember.webp", "/art/strata-glacier.webp", "/art/strata-canyon.webp"],
} as const;
