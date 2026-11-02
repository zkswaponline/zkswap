import type { Metadata } from "next";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { MemberDesk } from "@/components/access/MemberDesk";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/access/desk", title: `Member desk | ${BRAND.name}`, description: `The group-gated desk on ${BRAND.name}. It opens for a wallet with an access record this epoch; the gate is at the app level.`, noindex: true });

export default function Page() {
  return (
    <Suspense>
      <MemberDesk />
    </Suspense>
  );
}
