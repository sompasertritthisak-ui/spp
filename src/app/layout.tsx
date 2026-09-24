import type { Metadata, Viewport } from "next";
import { Anton, Bangers, Bebas_Neue, Black_Ops_One, Bricolage_Grotesque, Caveat, Geist, Instrument_Serif, JetBrains_Mono, Lobster, Montserrat, Noto_Sans_Lao, Oswald, Pacifico, Permanent_Marker, Playfair_Display, Righteous } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/site/Providers";
import { getContent } from "@/lib/content";
import { absoluteUrl, env } from "@/lib/env";
import "./globals.css";

// next/font downloads these at BUILD time and self-hosts them with the site —
// no runtime request to Google, so nothing for an ISP to block.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

// SPP Studio typeface library. `preload: false` — the @font-face rules are declared
// site-wide but a file is only fetched when a design actually uses that face.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap", preload: false });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap", preload: false });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap", preload: false });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico", display: "swap", preload: false });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker", display: "swap", preload: false });
const lobster = Lobster({ subsets: ["latin"], weight: "400", variable: "--font-lobster", display: "swap", preload: false });
const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--font-righteous", display: "swap", preload: false });
const bangers = Bangers({ subsets: ["latin"], weight: "400", variable: "--font-bangers", display: "swap", preload: false });
const blackops = Black_Ops_One({ subsets: ["latin"], weight: "400", variable: "--font-blackops", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap", preload: false });
const notoLao = Noto_Sans_Lao({ subsets: ["lao", "latin"], variable: "--font-notolao", display: "swap", preload: false });
const studioFonts = [anton, bebas, oswald, playfair, pacifico, marker, lobster, righteous, bangers, blackops, montserrat, caveat, notoLao].map((f) => f.variable).join(" ");

export const viewport: Viewport = { themeColor: "#08091c", colorScheme: "dark", width: "device-width", initialScale: 1 };

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getContent();
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: settings.seo.defaultTitle, template: settings.seo.titleTemplate },
    description: settings.seo.defaultDescription,
    keywords: settings.seo.keywords,
    applicationName: settings.companyName,
    alternates: { canonical: absoluteUrl("/") },
    openGraph: { type: "website", siteName: settings.companyName, locale: "en_LA", title: settings.seo.defaultTitle, description: settings.seo.defaultDescription, url: absoluteUrl("/") },
    twitter: { card: "summary_large_image", title: settings.seo.defaultTitle, description: settings.seo.defaultDescription },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings } = await getContent();
  const org = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": absoluteUrl("/#organization"),
    name: settings.legalName,
    alternateName: settings.companyName,
    description: settings.description,
    url: absoluteUrl("/"),
    email: settings.email,
    ...(settings.phone ? { telephone: settings.phone } : {}),
    foundingDate: String(settings.foundedYear),
    address: { "@type": "PostalAddress", addressLocality: settings.address.city, addressCountry: "LA", streetAddress: settings.address.line1 },
    geo: { "@type": "GeoCoordinates", latitude: settings.address.lat, longitude: settings.address.lng },
    areaServed: { "@type": "Country", name: "Laos" },
    sameAs: settings.social.map((s) => s.url),
    openingHoursSpecification: settings.hours.map((h) => ({ "@type": "OpeningHoursSpecification", description: `${h.days} ${h.time}` })),
  };
  return (
    <html lang="en" suppressHydrationWarning className={`no-js ${bricolage.variable} ${instrument.variable} ${geist.variable} ${jetbrains.variable} ${studioFonts}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.remove('no-js')" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, "\\u003c") }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
