import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { AccessDesk } from "@/components/access/AccessDesk";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/access", title: `ZK access proof | ${BRAND.name}`, description: `Prove a live membership of a group from your browser with ${BRAND.name}. The gate is at the app level, and an access proof does not make a swap anonymous.` });

export default function Page() {
  return <AccessDesk />;
}
