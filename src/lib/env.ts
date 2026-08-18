/**
 * Environment access with safe fallbacks.
 *
 * The app is designed to boot and be fully explorable with zero third-party
 * credentials. Each integration reports `configured: false` and falls back to
 * a local stub instead of throwing, so you can develop the product before you
 * have Stripe/Meta/TikTok/Google accounts approved.
 */

function str(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  appUrl: str("APP_URL", "http://localhost:3000"),
  sessionSecret: str(
    "SESSION_SECRET",
    "dev-only-insecure-secret-change-me-in-production-0123456789",
  ),
  isProd: process.env.NODE_ENV === "production",

  stripe: {
    secretKey: str("STRIPE_SECRET_KEY"),
    webhookSecret: str("STRIPE_WEBHOOK_SECRET"),
    get configured() {
      return this.secretKey.startsWith("sk_");
    },
  },

  meta: {
    appId: str("META_APP_ID"),
    appSecret: str("META_APP_SECRET"),
    pixelId: str("META_PIXEL_ID"),
    accessToken: str("META_CONVERSIONS_TOKEN"),
    apiVersion: str("META_API_VERSION", "v21.0"),
    get configured() {
      return Boolean(this.pixelId && this.accessToken);
    },
    get oauthConfigured() {
      return Boolean(this.appId && this.appSecret);
    },
  },

  tiktok: {
    clientKey: str("TIKTOK_CLIENT_KEY"),
    clientSecret: str("TIKTOK_CLIENT_SECRET"),
    pixelCode: str("TIKTOK_PIXEL_CODE"),
    accessToken: str("TIKTOK_ACCESS_TOKEN"),
    get configured() {
      return Boolean(this.pixelCode && this.accessToken);
    },
    get oauthConfigured() {
      return Boolean(this.clientKey && this.clientSecret);
    },
  },

  google: {
    clientId: str("GOOGLE_CLIENT_ID"),
    clientSecret: str("GOOGLE_CLIENT_SECRET"),
    adsCustomerId: str("GOOGLE_ADS_CUSTOMER_ID"),
    adsDeveloperToken: str("GOOGLE_ADS_DEVELOPER_TOKEN"),
    adsConversionAction: str("GOOGLE_ADS_CONVERSION_ACTION"),
    get configured() {
      return Boolean(this.adsCustomerId && this.adsDeveloperToken);
    },
    get oauthConfigured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  video: {
    provider: str("VIDEO_PROVIDER", "local"),
    muxTokenId: str("MUX_TOKEN_ID"),
    muxTokenSecret: str("MUX_TOKEN_SECRET"),
    muxSigningKeyId: str("MUX_SIGNING_KEY_ID"),
    muxSigningKeySecret: str("MUX_SIGNING_KEY_SECRET"),
  },
};

export type Env = typeof env;
