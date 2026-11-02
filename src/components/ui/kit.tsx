"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* The small parts every section shares: hatch label, pixel button, on-scroll reveal, the letter-by-letter statement. */

export function Hatch() {
  return (
    <svg width="25" height="10" viewBox="0 0 25 10" fill="currentColor" aria-hidden="true">
      {[0, 5, 10, 15, 20].map((x) => (
        <path key={x} d={`M${x} 0h2.4l5 10h-2.4z`} />
      ))}
    </svg>
  );
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`eyebrow ${className}`}>
      <Hatch />
      <span>{children}</span>
    </p>
  );
}

function Pix() {
  // Three columns of a small pixel arrow, lit one after the other.
  return (
    <svg className="pix" width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="2" height="2" />
      <rect x="1" y="6" width="2" height="2" />
      <rect x="1" y="10" width="2" height="2" />
      <rect x="6" y="4" width="2" height="2" />
      <rect x="6" y="8" width="2" height="2" />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="11" y="6" width="2" height="2" />
      <rect x="9" y="4" width="2" height="2" />
      <rect x="9" y="8" width="2" height="2" />
    </svg>
  );
}

type BtnProps = { children: React.ReactNode; tone?: "" | "dark" | "light"; wide?: boolean; className?: string };

export function PixelLink({ href, children, tone = "", wide, className = "", ...rest }: BtnProps & { href: string; target?: string; rel?: string }) {
  const cls = `pbtn ${tone} ${wide ? "wide" : ""} ${className}`;
  const inner = (
    <>
      <span className="ic">
        <Pix />
      </span>
      <span className="lb">{children}</span>
    </>
  );
  return href.startsWith("http") ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} {...rest}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

export function PixelButton({ children, tone = "", wide, className = "", ...rest }: BtnProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`pbtn ${tone} ${wide ? "wide" : ""} ${className}`} {...rest}>
      <span className="ic">
        <Pix />
      </span>
      <span className="lb">{children}</span>
    </button>
  );
}

/** Fades its children up once they enter the viewport. Stays visible for readers without script or with reduced motion. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`rv ${seen ? "in" : ""} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/** Text whose letters light up one by one as it scrolls through the viewport. */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = Array.from(el.querySelectorAll<HTMLElement>(".ch"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      chars.forEach((c) => (c.style.opacity = "1"));
      return;
    }
    let raf = 0;
    let lastLit = -1;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.max(0, Math.min(1, (vh * 0.86 - r.top) / (r.height + vh * 0.32)));
      const lit = Math.round(p * chars.length);
      if (lit === lastLit) return;
      const from = Math.min(lit, lastLit < 0 ? 0 : lastLit);
      const to = Math.max(lit, lastLit < 0 ? chars.length : lastLit);
      for (let i = from; i < to; i++) chars[i].style.opacity = i < lit ? "1" : "0.22";
      lastLit = lit;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <p ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((w, i, all) => (
        <span key={i} className="wd" aria-hidden="true">
          {Array.from(w).map((c, k) => (
            <span key={k} className="ch">
              {c}
            </span>
          ))}
          {i < all.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

export function Marquee({ items }: { items: readonly string[] }) {
  const twice = [...items, ...items];
  return (
    <div className="marq" aria-label={items.join(", ")}>
      <div className="marq-in" aria-hidden="true">
        {twice.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function Chevrons({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M6 5l8 8-8 8M13 5l8 8-8 8" />
    </svg>
  );
}

export function PlannedTag() {
  return <span className="tag">PLANNED</span>;
}

export function RealTag({ children = "RUNS TODAY" }: { children?: React.ReactNode }) {
  return <span className="tag real">{children}</span>;
}
