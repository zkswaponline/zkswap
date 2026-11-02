import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { GroupManager } from "@/components/access/GroupManager";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/access/manage", title: `Run a group | ${BRAND.name}`, description: `Create an access group on ${BRAND.name}, add member commitments, publish the root and manage per-group roles.`, noindex: true });

export default function Page() {
  return <GroupManager />;
}
