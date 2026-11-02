"use client";

import { useState } from "react";
import { BRAND, TOKEN, shortAddress } from "@/config/brand";
import { CheckIcon, CopyIcon } from "@/components/site/Icons";

/** Copy CA, from one source: a compact chip in the header, a full block on the token page. Disabled until launch. */
export function CopyCa({ variant = "chip" }: { variant?: "chip" | "full" }) {
  const [done, setDone] = useState(false);
  const live = TOKEN.isLive;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BRAND.ca);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      // Clipboard refused: the address stays readable on the token page.
    }
  };
  if (variant === "full") {
    return (
      <div className="flex flex-wrap items-center gap-3" data-testid="ca-full">
        <code className="addr" data-testid="ca-value">
          {live ? BRAND.ca : "At launch"}
        </code>
        <button type="button" className="sbtn" disabled={!live} onClick={copy} data-testid="ca-copy">
          {done ? <CheckIcon size={13} /> : <CopyIcon size={13} />} {done ? "Copied" : live ? "Copy address" : "At launch"}
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="chip ca-chip" disabled={!live} onClick={copy} title={live ? BRAND.ca : "The address appears here at launch"} aria-label={live ? `Copy the ${BRAND.symbol} address` : `${BRAND.symbol} address: at launch`} data-testid="ca-chip">
      <span className="ca-long">
        {BRAND.symbol} · {live ? (done ? "Copied" : shortAddress(BRAND.ca, 5, 4)) : "At launch"}
      </span>
      <span className="ca-short" aria-hidden="true">
        CA
      </span>
      {live ? done ? <CheckIcon size={12} /> : <CopyIcon size={12} /> : null}
    </button>
  );
}
