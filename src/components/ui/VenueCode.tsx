"use client";

import { useEffect, useState } from "react";

/** Shows whether a venue contract has code on chain right now. */
export function VenueCode({ address }: { address: string }) {
  const [size, setSize] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let stop = false;
    fetch("/api/venues")
      .then((r) => r.json())
      .then((j: { sizes?: Record<string, number | null> }) => {
        if (!stop) setSize(j.sizes?.[address.toLowerCase()] ?? null);
      })
      .catch(() => {
        if (!stop) setSize(null);
      });
    return () => {
      stop = true;
    };
  }, [address]);
  return (
    <span className="tag" data-testid="venue-code">
      {size === undefined ? "reading" : size === null ? "—" : size > 0 ? `${size.toLocaleString("en-US")} bytes of code` : "no code"}
    </span>
  );
}
