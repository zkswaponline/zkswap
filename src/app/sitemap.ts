import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
import { VENUES } from "@/config/venues";
import { GUIDES } from "@/content/guides";

// Every indexable page. Wallet screens (/permissions, /access/manage, /access/desk) and the owner page stay out.
export const ROUTES = ["", "/swap", "/access", "/venues", "/guides", "/how", "/token", "/terms", "/privacy", ...VENUES.map((v) => `/venues/${v.slug}`), ...GUIDES.map((g) => `/guides/${g.slug}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({ url: `${BRAND.url}${r}`, lastModified: now, changeFrequency: r === "" ? "daily" : "weekly", priority: r === "" ? 1 : 0.6 }));
}
