export type ConversionPayload = {
  eventName: string;
  eventId: string;
  occurredAt: Date;
  valueCents: number;
  currency: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  clickId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  sourceUrl?: string;
};

export type DispatchResult = {
  platform: "meta" | "tiktok" | "google";
  ok: boolean;
  skipped: boolean;
  reason?: string;
  detail?: string;
};

export type ChannelMetrics = {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
};
