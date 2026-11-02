import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { ChainProvider } from "@/components/providers/ChainProvider";
import { Footer } from "@/components/shell/Footer";
import { Shell } from "@/components/shell/Shell";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { HOME_DESCRIPTION, HOME_TITLE, siteLd } from "@/lib/seo";

const inter = localFont({ src: "./fonts/inter-opsz.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
const geistMono = localFont({ src: "./fonts/GeistMono-Variable.woff2", weight: "100 900", variable: "--font-geist-mono", display: "swap" });
const gasoek = localFont({ src: "./fonts/gasoek-one.woff2", weight: "400", variable: "--font-gasoek", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: HOME_TITLE, template: `%s | ${BRAND.name}` },
  description: HOME_DESCRIPTION,
  applicationName: BRAND.name,
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "black-translucent" },
  openGraph: { type: "website", url: BRAND.url, siteName: BRAND.name, title: HOME_TITLE, description: HOME_DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", site: BRAND.xHandle, creator: BRAND.xHandle, title: HOME_TITLE, description: HOME_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060606",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} ${gasoek.variable}`}>
      <head>
        <JsonLd data={siteLd} />
      </head>
      <body>
        <WalletProvider>
          <WalletModalProvider>
            <ChainProvider>
              <Shell>
                <main>{children}</main>
                <Footer />
              </Shell>
            </ChainProvider>
          </WalletModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
