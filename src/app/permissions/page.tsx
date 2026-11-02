import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { PermissionsView } from "@/components/swap/PermissionsView";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/permissions", title: `Token permissions | ${BRAND.name}`, description: `See the token allowances you gave to swap venues on ${BRAND.chainName}, and set any of them back to zero with ${BRAND.name}.`, noindex: true });

export default function Page() {
  return <PermissionsView />;
}
