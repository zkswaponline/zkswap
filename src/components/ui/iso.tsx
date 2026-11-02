/* Isometric line drawings, ours: one stroke weight, no fill, built for the dark and the pale sections alike. */

type P = { size?: number };
const S = ({ size = 120, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    {children}
  </svg>
);

/** Two stacked plates joined by a path of beads: comparing routes. */
export const IsoRoutes = (p: P) => (
  <S {...p}>
    <path d="M18 34l26-13 26 13-26 13z" />
    <path d="M18 34v7l26 13 26-13v-7" />
    <path d="M36 32l8-4 8 4-8 4z" />
    <path d="M52 92l26-13 26 13-26 13z" />
    <path d="M52 92v7l26 13 26-13v-7" />
    <path d="M70 90l8-4 8 4-8 4z" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <circle key={i} cx={46 + i * 5} cy={56 + i * 4} r="2.4" />
    ))}
  </S>
);

/** A padlock on a block with a dial: what you allow. */
export const IsoPermission = (p: P) => (
  <S {...p}>
    <path d="M34 54l34-17 22 11-34 17z" />
    <path d="M34 54v38l22 11V65" />
    <path d="M56 65v38l34-17V48" />
    <path d="M44 46V32c0-10 8-16 16-12s12 12 12 22v2" />
    <path d="M53 41V32c0-5 3-7 7-5s6 6 6 11v2" />
    <ellipse cx="45" cy="78" rx="5" ry="7" />
    <path d="M45 76v5" />
    <circle cx="74" cy="76" r="9" />
    <circle cx="74" cy="76" r="4" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <path key={a} d={`M${74 + 9 * Math.cos((a * Math.PI) / 180)} ${76 + 9 * Math.sin((a * Math.PI) / 180)}L${74 + 12 * Math.cos((a * Math.PI) / 180)} ${76 + 12 * Math.sin((a * Math.PI) / 180)}`} />
    ))}
  </S>
);

/** A box opened up to show a fan of layers: reading a transaction. */
export const IsoReview = (p: P) => (
  <S {...p}>
    <path d="M30 40l40-20 24 12-40 20z" />
    <path d="M30 40v44l24 12V52" />
    <path d="M54 52v44l40-20V32" />
    <circle cx="74" cy="64" r="15" />
    <circle cx="74" cy="64" r="4" />
    <path d="M74 60c-2-5 0-9 3-11M78 64c5-2 9 0 11 3M74 68c2 5 0 9-3 11M70 64c-5 2-9 0-11-3" />
    <path d="M37 54l10 5M37 62l10 5M37 70l10 5" />
    <circle cx="40" cy="83" r="1.6" />
  </S>
);

/** A cylinder and a sheet behind it: leaves of a tree and the proof over them. */
export const IsoProof = (p: P) => (
  <S {...p}>
    <path d="M58 22l32 16v52L58 74z" />
    <path d="M90 38l6-3v52l-6 3" />
    <path d="M58 22l6-3 32 16" />
    {[48, 62, 76].map((y) => (
      <g key={y}>
        <ellipse cx="44" cy={y} rx="20" ry="9" />
        <path d={`M24 ${y}v12c0 5 9 9 20 9s20-4 20-9v-12`} />
      </g>
    ))}
    <circle cx="33" cy="60" r="1" />
    <circle cx="33" cy="74" r="1" />
    <circle cx="33" cy="88" r="1" />
  </S>
);

/** Small round glyphs used in the stack of circles and in table heads. */
export const GlyphRoute = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="6" cy="7" r="2.5" />
    <circle cx="20" cy="19" r="2.5" />
    <path d="M8.5 7H15a4 4 0 010 8h-4a4 4 0 000 8" transform="translate(0 -2)" />
  </svg>
);
export const GlyphKey = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <rect x="6" y="12" width="14" height="10" />
    <path d="M9 12V8a4 4 0 018 0v4" />
    <path d="M13 16v2" />
  </svg>
);
export const GlyphEye = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M3 13c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" />
    <circle cx="13" cy="13" r="3.2" />
  </svg>
);
export const GlyphTree = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="13" cy="5" r="2.2" />
    <circle cx="6" cy="14" r="2.2" />
    <circle cx="20" cy="14" r="2.2" />
    <circle cx="10" cy="22" r="1.8" />
    <circle cx="16" cy="22" r="1.8" />
    <path d="M11.6 6.8L7.3 12.2M14.4 6.8l4.3 5.4M19 16l-2.6 4.4M7 16l2.6 4.4" />
  </svg>
);
