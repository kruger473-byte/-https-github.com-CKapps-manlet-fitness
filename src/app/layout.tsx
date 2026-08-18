import type { Metadata, Viewport } from "next";
import { getSiteSettings, accentPalette, getAppUrl } from "@/lib/settings";
import { BrandTheme } from "@/components/brand";
import "./globals.css";

/**
 * Metadata is generated per-request from the site settings, so renaming the
 * brand or changing the domain updates page titles, share cards and the
 * canonical URL without a redeploy.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [settings, appUrl] = await Promise.all([getSiteSettings(), getAppUrl()]);

  return {
    metadataBase: safeUrl(appUrl),
    title: {
      default: `${settings.brandName} — ${settings.tagline}`,
      template: `%s · ${settings.brandName}`,
    },
    description: settings.metaDescription,
    openGraph: {
      title: settings.brandName,
      description: settings.metaDescription,
      siteName: settings.brandName,
      type: "website",
    },
    ...(settings.logoUrl ? { icons: { icon: settings.logoUrl } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <html lang="en">
      <head>
        <BrandTheme palette={accentPalette(settings.accentColor)} />
      </head>
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
