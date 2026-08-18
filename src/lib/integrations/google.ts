import { env } from "../env";
import { hashPII } from "../attribution";
import type { ConversionPayload, DispatchResult } from "./types";

/**
 * Google Ads offline conversion upload (enhanced conversions for leads).
 *
 * Google's REST surface needs an OAuth access token minted from the stored
 * refresh token; when credentials are absent we skip rather than throw so
 * the rest of the dispatch still runs.
 */
export async function sendGoogleConversion(
  payload: ConversionPayload,
  accessToken?: string | null,
): Promise<DispatchResult> {
  if (!env.google.configured) {
    return {
      platform: "google",
      ok: false,
      skipped: true,
      reason: "GOOGLE_ADS_CUSTOMER_ID / GOOGLE_ADS_DEVELOPER_TOKEN not set",
    };
  }
  if (!accessToken) {
    return {
      platform: "google",
      ok: false,
      skipped: true,
      reason: "no Google Ads OAuth token — connect the channel first",
    };
  }
  if (!payload.clickId && !payload.email) {
    return {
      platform: "google",
      ok: false,
      skipped: true,
      reason: "needs gclid or email to match",
    };
  }

  const customerId = env.google.adsCustomerId.replace(/-/g, "");
  const conversion: Record<string, unknown> = {
    conversionAction: env.google.adsConversionAction,
    conversionDateTime: formatGoogleDateTime(payload.occurredAt),
    conversionValue: payload.valueCents / 100,
    currencyCode: payload.currency.toUpperCase(),
    orderId: payload.eventId,
  };
  if (payload.clickId) conversion.gclid = payload.clickId;

  const emailHash = hashPII(payload.email);
  if (emailHash) {
    conversion.userIdentifiers = [{ hashedEmail: emailHash }];
  }

  try {
    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "developer-token": env.google.adsDeveloperToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversions: [conversion],
          partialFailure: true,
        }),
      },
    );
    const text = await res.text();
    return {
      platform: "google",
      ok: res.ok,
      skipped: false,
      detail: text.slice(0, 500),
      reason: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      platform: "google",
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "request failed",
    };
  }
}

/** Google Ads wants "YYYY-MM-DD HH:MM:SS+00:00". */
export function formatGoogleDateTime(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace("T", " ")}+00:00`;
}

export function googleOAuthUrl(redirectUri: string, state: string): string | null {
  if (!env.google.oauthConfigured) return null;
  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/adwords",
  ].join(" ");
  return (
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${encodeURIComponent(env.google.clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code" +
    "&access_type=offline&prompt=consent" +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scopes)}`
  );
}
