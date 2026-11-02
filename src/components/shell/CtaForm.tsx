"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelButton } from "@/components/ui/kit";

/** Sends a pasted token address straight to the route table. Nothing is stored or sent anywhere else. */
export function CtaForm() {
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  const router = useRouter();
  return (
    <>
      <form
        className="inform"
        onSubmit={(e) => {
          e.preventDefault();
          const a = v.trim();
          if (a && !/^0x[0-9a-fA-F]{40}$/.test(a)) return setBad(true);
          setBad(false);
          router.push(a ? `/swap?out=${a}` : "/swap");
        }}
      >
        <input aria-label="Token address" placeholder="0x… token address" value={v} onChange={(e) => setV(e.target.value)} />
        <PixelButton type="submit" tone="light" style={{ width: 150 }}>
          Compare
        </PixelButton>
      </form>
      {bad ? (
        <p className="mt-2 text-[13px]" role="alert">
          That is not a 0x address with 40 hex characters.
        </p>
      ) : null}
    </>
  );
}
