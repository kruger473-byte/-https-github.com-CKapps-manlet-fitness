import type { ConversionType, Platform } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { conversionDedupeKey } from "../attribution";
import { sendMetaConversion } from "./meta";
import { sendTikTokConversion } from "./tiktok";
import { sendGoogleConversion } from "./google";
import type { DispatchResult } from "./types";

/** Our conversion types mapped to each platform's expected event name. */
const EVENT_NAMES: Record<ConversionType, { meta: string; tiktok: string }> = {
  LEAD: { meta: "Lead", tiktok: "SubmitForm" },
  SIGNUP: { meta: "CompleteRegistration", tiktok: "CompleteRegistration" },
  TRIAL_START: { meta: "StartTrial", tiktok: "StartTrial" },
  SUBSCRIBE: { meta: "Subscribe", tiktok: "Subscribe" },
  PURCHASE: { meta: "Purchase", tiktok: "CompletePayment" },
  CHURN: { meta: "CustomerChurn", tiktok: "CustomerChurn" },
};

export type RecordConversionInput = {
  type: ConversionType;
  userId?: string | null;
  channelId?: string | null;
  valueCents?: number;
  currency?: string;
  campaign?: string | null;
  clickId?: string | null;
  /** Extra scope for the dedupe key, e.g. a Stripe invoice id. */
  dedupeScope?: string;
  email?: string | null;
  firstName?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
};

/**
 * Record a conversion we own, then forward it to every configured ad
 * platform. The local row is the source of truth — the platforms are
 * downstream consumers, so if they are all unconfigured we still keep a
 * complete first-party record of how revenue was actually acquired.
 */
export async function recordConversion(
  input: RecordConversionInput,
): Promise<{ id: string; dispatch: DispatchResult[] }> {
  const dedupeKey = conversionDedupeKey(
    input.type,
    input.userId ?? input.clickId ?? "anon",
    input.dedupeScope,
  );

  const existing = await db.conversionEvent.findUnique({ where: { dedupeKey } });
  if (existing) {
    return {
      id: existing.id,
      dispatch: [
        { platform: "meta", ok: true, skipped: true, reason: "already recorded" },
      ],
    };
  }

  const event = await db.conversionEvent.create({
    data: {
      type: input.type,
      userId: input.userId ?? null,
      channelId: input.channelId ?? null,
      valueCents: input.valueCents ?? 0,
      currency: input.currency ?? "usd",
      campaign: input.campaign ?? null,
      clickId: input.clickId ?? null,
      dedupeKey,
    },
  });

  const dispatch = await dispatchConversion(event.id, input);
  return { id: event.id, dispatch };
}

async function dispatchConversion(
  eventId: string,
  input: RecordConversionInput,
): Promise<DispatchResult[]> {
  const names = EVENT_NAMES[input.type];
  const occurredAt = new Date();
  const payload = {
    eventId,
    occurredAt,
    valueCents: input.valueCents ?? 0,
    currency: input.currency ?? "usd",
    email: input.email,
    firstName: input.firstName,
    clickId: input.clickId,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    sourceUrl: env.appUrl,
  };

  const [meta, tiktok, google] = await Promise.all([
    sendMetaConversion({ ...payload, eventName: names.meta }),
    sendTikTokConversion({ ...payload, eventName: names.tiktok }),
    sendGoogleConversion({ ...payload, eventName: names.meta }, await googleToken()),
  ]);

  const errors = [meta, tiktok, google]
    .filter((r) => !r.ok && !r.skipped)
    .map((r) => `${r.platform}: ${r.reason}`)
    .join("; ");

  await db.conversionEvent.update({
    where: { id: eventId },
    data: {
      metaSyncedAt: meta.ok ? new Date() : null,
      tiktokSyncedAt: tiktok.ok ? new Date() : null,
      googleSyncedAt: google.ok ? new Date() : null,
      lastError: errors || null,
    },
  });

  return [meta, tiktok, google];
}

async function googleToken(): Promise<string | null> {
  const channel = await db.channel.findFirst({
    where: { platform: "GOOGLE", isConnected: true },
    select: { accessToken: true },
  });
  return channel?.accessToken ?? null;
}

/** Resolve the Channel row for a raw utm_source/platform, creating it if new. */
export async function resolveChannel(
  platform: Platform,
  handle: string,
): Promise<string | null> {
  if (platform === "DIRECT") return null;
  const channel = await db.channel.upsert({
    where: { platform_handle: { platform, handle } },
    update: {},
    create: { platform, handle, displayName: handle },
  });
  return channel.id;
}

/** Which server-side destinations are live right now. */
export function integrationStatus() {
  return [
    {
      key: "meta",
      label: "Meta / Instagram",
      configured: env.meta.configured,
      oauth: env.meta.oauthConfigured,
      envVars: ["META_PIXEL_ID", "META_CONVERSIONS_TOKEN", "META_APP_ID", "META_APP_SECRET"],
      purpose: "Conversions API + Instagram content and insights sync",
    },
    {
      key: "tiktok",
      label: "TikTok",
      configured: env.tiktok.configured,
      oauth: env.tiktok.oauthConfigured,
      envVars: ["TIKTOK_PIXEL_CODE", "TIKTOK_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
      purpose: "Events API 2.0 + creator video stats",
    },
    {
      key: "google",
      label: "Google",
      configured: env.google.configured,
      oauth: env.google.oauthConfigured,
      envVars: ["GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      purpose: "Offline conversion import + Google sign-in",
    },
    {
      key: "stripe",
      label: "Stripe",
      configured: env.stripe.configured,
      oauth: false,
      envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      purpose: "Subscription billing, invoices, customer portal",
    },
  ];
}
