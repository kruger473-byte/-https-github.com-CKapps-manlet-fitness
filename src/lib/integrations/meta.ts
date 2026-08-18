import { env } from "../env";
import { hashPII } from "../attribution";
import type { ConversionPayload, DispatchResult } from "./types";

/**
 * Meta Conversions API (server-side).
 *
 * Why server-side: iOS ATT and browser tracking-prevention delete a large
 * share of pixel events. Sending from the server with hashed match keys plus
 * the fbclid recovers attribution the pixel alone loses, and `event_id`
 * de-duplicates against the browser pixel when both fire.
 */
export async function sendMetaConversion(
  payload: ConversionPayload,
): Promise<DispatchResult> {
  if (!env.meta.configured) {
    return {
      platform: "meta",
      ok: false,
      skipped: true,
      reason: "META_PIXEL_ID / META_CONVERSIONS_TOKEN not set",
    };
  }

  const userData: Record<string, unknown> = {};
  const em = hashPII(payload.email);
  const ph = hashPII(payload.phone);
  const fn = hashPII(payload.firstName);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (payload.clickId) userData.fbc = toFbc(payload.clickId, payload.occurredAt);
  if (payload.clientIp) userData.client_ip_address = payload.clientIp;
  if (payload.userAgent) userData.client_user_agent = payload.userAgent;

  const body = {
    data: [
      {
        event_name: payload.eventName,
        event_time: Math.floor(payload.occurredAt.getTime() / 1000),
        event_id: payload.eventId,
        event_source_url: payload.sourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: payload.currency.toLowerCase(),
          value: payload.valueCents / 100,
        },
      },
    ],
  };

  const url =
    `https://graph.facebook.com/${env.meta.apiVersion}/${env.meta.pixelId}/events` +
    `?access_token=${encodeURIComponent(env.meta.accessToken)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return {
      platform: "meta",
      ok: res.ok,
      skipped: false,
      detail: text.slice(0, 500),
      reason: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      platform: "meta",
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "request failed",
    };
  }
}

/** Meta expects fbc in the form `fb.1.<timestamp_ms>.<fbclid>`. */
export function toFbc(fbclid: string, at: Date): string {
  return `fb.1.${at.getTime()}.${fbclid}`;
}

/** Pull recent Instagram media + insights for a connected channel. */
export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
): Promise<
  Array<{
    id: string;
    caption: string;
    permalink: string;
    mediaType: string;
    timestamp: string;
    likes: number;
    comments: number;
  }>
> {
  const fields = "id,caption,permalink,media_type,timestamp,like_count,comments_count";
  const url =
    `https://graph.facebook.com/${env.meta.apiVersion}/${igUserId}/media` +
    `?fields=${fields}&limit=25&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instagram media fetch failed: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };

  return (json.data ?? []).map((m) => ({
    id: String(m.id ?? ""),
    caption: String(m.caption ?? ""),
    permalink: String(m.permalink ?? ""),
    mediaType: String(m.media_type ?? "IMAGE"),
    timestamp: String(m.timestamp ?? new Date().toISOString()),
    likes: Number(m.like_count ?? 0),
    comments: Number(m.comments_count ?? 0),
  }));
}

export function metaOAuthUrl(redirectUri: string, state: string): string | null {
  if (!env.meta.oauthConfigured) return null;
  const scopes = [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_show_list",
    "business_management",
  ].join(",");
  return (
    `https://www.facebook.com/${env.meta.apiVersion}/dialog/oauth` +
    `?client_id=${encodeURIComponent(env.meta.appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scopes)}`
  );
}
