import { env } from "../env";
import { hashPII } from "../attribution";
import type { ConversionPayload, DispatchResult } from "./types";

/**
 * TikTok Events API 2.0 (server-side).
 * Mirrors Meta CAPI: hashed match keys + ttclid, de-duplicated by event_id.
 */
export async function sendTikTokConversion(
  payload: ConversionPayload,
): Promise<DispatchResult> {
  if (!env.tiktok.configured) {
    return {
      platform: "tiktok",
      ok: false,
      skipped: true,
      reason: "TIKTOK_PIXEL_CODE / TIKTOK_ACCESS_TOKEN not set",
    };
  }

  const user: Record<string, unknown> = {};
  const email = hashPII(payload.email);
  const phone = hashPII(payload.phone);
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (payload.clickId) user.ttclid = payload.clickId;
  if (payload.clientIp) user.ip = payload.clientIp;
  if (payload.userAgent) user.user_agent = payload.userAgent;

  const body = {
    event_source: "web",
    event_source_id: env.tiktok.pixelCode,
    data: [
      {
        event: payload.eventName,
        event_time: Math.floor(payload.occurredAt.getTime() / 1000),
        event_id: payload.eventId,
        user,
        properties: {
          currency: payload.currency.toUpperCase(),
          value: payload.valueCents / 100,
        },
        page: payload.sourceUrl ? { url: payload.sourceUrl } : undefined,
      },
    ],
  };

  try {
    const res = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Access-Token": env.tiktok.accessToken,
        },
        body: JSON.stringify(body),
      },
    );
    const text = await res.text();
    // TikTok returns HTTP 200 with a non-zero `code` on logical failures.
    let ok = res.ok;
    try {
      const parsed = JSON.parse(text) as { code?: number };
      if (typeof parsed.code === "number") ok = ok && parsed.code === 0;
    } catch {
      /* non-JSON body: fall back to the HTTP status */
    }
    return {
      platform: "tiktok",
      ok,
      skipped: false,
      detail: text.slice(0, 500),
      reason: ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      platform: "tiktok",
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "request failed",
    };
  }
}

export function tiktokOAuthUrl(redirectUri: string, state: string): string | null {
  if (!env.tiktok.oauthConfigured) return null;
  return (
    "https://www.tiktok.com/v2/auth/authorize/" +
    `?client_key=${encodeURIComponent(env.tiktok.clientKey)}` +
    `&scope=${encodeURIComponent("user.info.basic,video.list")}` +
    "&response_type=code" +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`
  );
}

/** Pull a creator's recent videos and their stats. */
export async function fetchTikTokVideos(accessToken: string): Promise<
  Array<{
    id: string;
    caption: string;
    permalink: string;
    timestamp: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>
> {
  const res = await fetch(
    "https://open.tiktokapis.com/v2/video/list/?fields=" +
      encodeURIComponent(
        "id,title,video_description,share_url,create_time,view_count,like_count,comment_count,share_count",
      ),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ max_count: 20 }),
    },
  );
  if (!res.ok) throw new Error(`TikTok video list failed: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { videos?: Array<Record<string, unknown>> };
  };

  return (json.data?.videos ?? []).map((v) => ({
    id: String(v.id ?? ""),
    caption: String(v.video_description ?? v.title ?? ""),
    permalink: String(v.share_url ?? ""),
    timestamp: new Date(Number(v.create_time ?? 0) * 1000).toISOString(),
    views: Number(v.view_count ?? 0),
    likes: Number(v.like_count ?? 0),
    comments: Number(v.comment_count ?? 0),
    shares: Number(v.share_count ?? 0),
  }));
}
