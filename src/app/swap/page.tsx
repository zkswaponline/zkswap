import type { Metadata } from "next";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { SwapDesk } from "@/components/swap/SwapDesk";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/swap",
  title: `Compare swap routes on ${BRAND.chainName} | ${BRAND.name}`,
  description: `Compare swap quotes on ${BRAND.chainName} in ${BRAND.name}: fee, price impact and minimum received, a permission check and a decoded transaction before your wallet signs.`,
});

export default function SwapPage() {
  return (
    <Suspense>
      <SwapDesk />
    </Suspense>
  );
}
