import { cache } from "react";
import { db } from "./db";
import { env } from "./env";

export type SiteSettings = {
  brandName: string;
  monogram: string;
  logoUrl: string | null;
  tagline: string;
  metaDescription: string;
  accentColor: string;
  canonicalUrl: string | null;
  supportEmail: string | null;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: "Manlet Fitness",
  monogram: "MF",
  logoUrl: null,
  tagline: "Training, nutrition and coaching that stays yours",
  metaDescription:
    "Video programs, structured diet plans, a real knowledge base, 1-1 coaching and a member community — sold direct, so the revenue stays with the coach.",
  accentColor: "#c8f31d",
  canonicalUrl: null,
  supportEmail: null,
};

/**
 * Read the site settings.
 *
 * `cache()` de-duplicates this across a single render pass, so a page that
 * shows the logo in three places still makes one query. Falls back to defaults
 * when the row is missing or the database is unreachable — branding must never
 * be the reason a page fails to render.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row = await db.siteSettings.findUnique({ where: { id: "singleton" } });
    if (!row) return DEFAULT_SETTINGS;
    return {
      brandName: row.brandName,
      monogram: row.monogram,
      logoUrl: row.logoUrl,
      tagline: row.tagline,
      metaDescription: row.metaDescription,
      accentColor: row.accentColor,
      canonicalUrl: row.canonicalUrl,
      supportEmail: row.supportEmail,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/**
 * The origin to use when handing a URL to something outside this app —
 * Stripe redirects, tracked links, OAuth callbacks.
 *
 * Precedence is settings → env → localhost. The setting wins because it is
 * changeable without a redeploy; APP_URL remains the fallback so a fresh
 * install works before anyone opens the settings page.
 */
export async function getAppUrl(): Promise<string> {
  const settings = await getSiteSettings();
  return normaliseOrigin(settings.canonicalUrl) ?? env.appUrl;
}

/** Strip trailing slashes and reject anything that isn't a valid http(s) origin. */
export function normaliseOrigin(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Accent colour derivation                                                   */
/* -------------------------------------------------------------------------- */

export type AccentPalette = {
  base: string;
  light: string;
  dark: string;
  /** Text colour that stays readable on top of `base`. */
  foreground: string;
};

/**
 * Derive the full accent palette from one hex value.
 *
 * The foreground is picked by relative luminance rather than assuming a light
 * accent: a creator who brands in navy would otherwise get near-black text on
 * a near-black button.
 */
export function accentPalette(hex: string): AccentPalette {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_SETTINGS.accentColor)!;
  return {
    base: rgbToHex(rgb),
    light: rgbToHex(adjust(rgb, 0.18)),
    dark: rgbToHex(adjust(rgb, -0.18)),
    foreground: relativeLuminance(rgb) > 0.45 ? "#08090c" : "#ffffff",
  };
}

export function isValidHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Positive amount lightens toward white, negative darkens toward black. */
function adjust({ r, g, b }: Rgb, amount: number): Rgb {
  const target = amount > 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  return {
    r: r + (target - r) * ratio,
    g: g + (target - g) * ratio,
    b: b + (target - b) * ratio,
  };
}

/** WCAG relative luminance. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
