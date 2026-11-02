"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ASSETS } from "@/config/assets";
import { BRAND, CHAIN } from "@/config/brand";
import { NAV_MAIN, NAV_OTHER } from "@/content/nav";
import { CopyCa } from "@/components/site/CopyCa";
import { ArrowUpRight, XLogo } from "@/components/site/Icons";
import { NavWallet } from "@/components/wallet/WalletButton";

/** The fixed logo and menu bars, the wallet + CA chips, and the full-screen menu. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  const path = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the visitor's date is only known in the browser
    setToday(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  const shut = () => setOpen(false);
  return (
    <>
      <Link href="/" className="hd-logo" aria-label={`${BRAND.name} home`} onClick={shut}>
        <img src={ASSETS.mark} alt="" width={30} height={30} />
        <span className="wm">{BRAND.slug}</span>
      </Link>
      <div className={`hd-right ${open ? "off" : ""}`}>
        <CopyCa />
        <NavWallet />
      </div>
      <button type="button" className={`hd-burger ${open ? "x" : ""}`} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="menu-toggle">
        <i />
        <i />
      </button>

      <div className={`menu ${open ? "open" : ""}`} aria-hidden={!open} data-testid="menu">
        <div className="menu-a" style={{ backgroundImage: `url(${ASSETS.panelMenu})` }}>
          <div className="menu-lead">
            <p className="text-[16px] font-light">
              {BRAND.name} {new Date().getFullYear()}
            </p>
            <h2>{BRAND.tagline}</h2>
          </div>
          <p className="t-mono-s" style={{ color: "#fff" }}>
            {CHAIN.name.toUpperCase()} · CHAIN ID {CHAIN.id}
          </p>
        </div>
        <nav className="menu-b" aria-label="Site">
          <div>
            <p className="t-mono-s" style={{ color: "#1a1a1a" }}>
              SITE
            </p>
            <ul>
              {NAV_MAIN.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={shut} tabIndex={open ? 0 : -1} aria-current={path === l.href ? "page" : undefined}>
                    {l.label} <ArrowUpRight size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="t-mono-s" style={{ color: "#1a1a1a" }}>
              MORE
            </p>
            <ul>
              {NAV_OTHER.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={shut} tabIndex={open ? 0 : -1}>
                    {l.label} <ArrowUpRight size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <div className="menu-c" style={{ backgroundImage: `url(${ASSETS.panelCells})` }}>
          <div className="menu-foot">
            <span>{today}</span>
            <a href={BRAND.x} target="_blank" rel="noreferrer" className="social" aria-label="X" tabIndex={open ? 0 : -1}>
              <XLogo size={15} />
            </a>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
