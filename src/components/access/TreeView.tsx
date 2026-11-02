"use client";

/* The right-hand panel of the access page: the shape of the group's tree. Leaf entries are public; which is yours is not. */
export function TreeView({ leafCount, yours, root }: { leafCount: number; yours: number | null; root: string | null }) {
  const shown = Math.min(16, Math.max(leafCount, 0));
  const W = 640;
  const levels = 4;
  const nodes: { x: number; y: number; lvl: number; i: number }[] = [];
  for (let l = 0; l <= levels; l++) {
    const n = 2 ** l;
    for (let i = 0; i < n; i++) nodes.push({ x: ((i + 0.5) / n) * W, y: 40 + l * 88, lvl: l, i });
  }
  const leafFilled = (i: number) => i < shown;
  return (
    <svg viewBox={`0 0 ${W} 440`} className="h-auto w-full" role="img" aria-label={`Tree with ${leafCount} member entries`} data-testid="tree-view">
      {nodes
        .filter((n) => n.lvl > 0)
        .map((n) => {
          const px = ((Math.floor(n.i / 2) + 0.5) / 2 ** (n.lvl - 1)) * W;
          const py = 40 + (n.lvl - 1) * 88;
          return <line key={`${n.lvl}-${n.i}`} x1={px} y1={py} x2={n.x} y2={n.y} stroke="rgba(255,255,255,.2)" />;
        })}
      {nodes.map((n) => {
        const leaf = n.lvl === levels;
        const filled = leaf ? leafFilled(n.i) : leafCount > 0 && n.i * 2 ** (levels - n.lvl) < shown;
        const isYours = leaf && yours === n.i;
        return <circle key={`c${n.lvl}-${n.i}`} cx={n.x} cy={n.y} r={leaf ? 9 : n.lvl === 0 ? 14 : 8} fill={isYours ? "#39d98a" : filled ? "#e2e2e2" : "transparent"} stroke="rgba(255,255,255,.45)" />;
      })}
      <text x={W / 2 + 24} y={45} fill="rgba(255,255,255,.8)" fontSize="13" fontFamily="var(--font-geist-mono)">
        root {root ? `${root.slice(0, 10)}…${root.slice(-6)}` : "—"}
      </text>
      <text x={8} y={432} fill="rgba(255,255,255,.55)" fontSize="12" fontFamily="var(--font-geist-mono)">
        {leafCount} entries · first 16 of 65,536 slots shown{yours !== null ? " · green is only marked on this screen" : ""}
      </text>
    </svg>
  );
}
