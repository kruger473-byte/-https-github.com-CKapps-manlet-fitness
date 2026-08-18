import { createHash, randomUUID } from "node:crypto";
import type { Platform } from "@prisma/client";

export const ATTRIBUTION_COOKIE = "mf_attr";
export const VISITOR_COOKIE = "mf_vid";
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 90; // 90-day window

export type AttributionData = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  channelId?: string;
  linkSlug?: string;
  clickId?: string;
  clickIdType?: "fbclid" | "ttclid" | "gclid";
  landedAt: string;
};

/** Click-ID query params, in priority order, mapped to their platform. */
const CLICK_ID_PARAMS: Array<{
  param: string;
  type: AttributionData["clickIdType"];
  platform: Platform;
}> = [
  { param: "fbclid", type: "fbclid", platform: "META" },
  { param: "ttclid", type: "ttclid", platform: "TIKTOK" },
  { param: "gclid", type: "gclid", platform: "GOOGLE" },
];

/**
 * Read attribution out of a request URL.
 *
 * Precedence: explicit click IDs beat UTMs beat the referrer. A click ID is
 * the strongest signal because it survives the ad platform's own redirect and
 * is what their conversion API needs back to close the loop.
 */
export function parseAttribution(url: URL, referrer?: string | null): AttributionData {
  const q = url.searchParams;
  const data: AttributionData = { landedAt: new Date().toISOString() };

  for (const { param, type } of CLICK_ID_PARAMS) {
    const value = q.get(param);
    if (value) {
      data.clickId = value;
      data.clickIdType = type;
      break;
    }
  }

  data.source = q.get("utm_source") ?? undefined;
  data.medium = q.get("utm_medium") ?? undefined;
  data.campaign = q.get("utm_campaign") ?? undefined;
  data.content = q.get("utm_content") ?? undefined;

  if (!data.source && data.clickIdType) {
    data.source = platformFromClickId(data.clickIdType).toLowerCase();
    data.medium ??= "paid_social";
  }

  if (!data.source && referrer) {
    const inferred = inferSourceFromReferrer(referrer);
    if (inferred) {
      data.source = inferred;
      data.medium ??= "organic_social";
    }
  }

  return data;
}

export function platformFromClickId(
  type: NonNullable<AttributionData["clickIdType"]>,
): Platform {
  const match = CLICK_ID_PARAMS.find((c) => c.type === type);
  return match?.platform ?? "DIRECT";
}

export function inferSourceFromReferrer(referrer: string): string | null {
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.")) return "facebook";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
  if (host.includes("google")) return "google";
  return null;
}

export function platformFromSource(source?: string | null): Platform {
  switch ((source ?? "").toLowerCase()) {
    case "instagram":
      return "INSTAGRAM";
    case "facebook":
    case "meta":
      return "META";
    case "tiktok":
      return "TIKTOK";
    case "google":
      return "GOOGLE";
    case "youtube":
      return "YOUTUBE";
    case "email":
      return "EMAIL";
    default:
      return "DIRECT";
  }
}

export function encodeAttribution(data: AttributionData): string {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

export function decodeAttribution(raw?: string | null): AttributionData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof parsed === "object" && parsed ? (parsed as AttributionData) : null;
  } catch {
    return null;
  }
}

export function newVisitorId(): string {
  return randomUUID();
}

/**
 * SHA-256 of a normalised value — the match-key format every major
 * conversion API expects. Raw PII never leaves this process.
 */
export function hashPII(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  return createHash("sha256").update(normalised).digest("hex");
}

/** Stable dedupe key so browser pixel + server event collapse into one. */
export function conversionDedupeKey(
  type: string,
  subjectId: string,
  bucket?: string,
): string {
  return `${type}:${subjectId}${bucket ? `:${bucket}` : ""}`;
}
