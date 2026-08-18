import { createHmac } from "node:crypto";
import { env } from "../env";

export type PlaybackTicket = {
  url: string;
  provider: string;
  expiresAt: Date;
  /** Poster frame, when the provider gives us one. */
  posterUrl?: string;
};

/**
 * Issue a short-lived playback URL for a video asset.
 *
 * Entitlement is checked by the caller; this only mints the token. Keeping
 * signing here means swapping Mux for Cloudflare Stream/Bunny is one file.
 */
export function signPlayback(asset: {
  provider: string;
  playbackId: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
}): PlaybackTicket {
  const ttlSeconds = 60 * 60 * 4;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  if (asset.provider === "mux" && asset.playbackId) {
    const token = signMuxToken(asset.playbackId, expiresAt);
    return {
      provider: "mux",
      url: `https://stream.mux.com/${asset.playbackId}.m3u8${token ? `?token=${token}` : ""}`,
      posterUrl: `https://image.mux.com/${asset.playbackId}/thumbnail.jpg`,
      expiresAt,
    };
  }

  if (asset.provider === "cloudflare" && asset.playbackId) {
    return {
      provider: "cloudflare",
      url: `https://customer-${asset.playbackId}.cloudflarestream.com/${asset.playbackId}/manifest/video.m3u8`,
      posterUrl: asset.thumbnailUrl ?? undefined,
      expiresAt,
    };
  }

  return {
    provider: "local",
    url: asset.sourceUrl ?? "",
    posterUrl: asset.thumbnailUrl ?? undefined,
    expiresAt,
  };
}

/**
 * Mux signed playback needs an RS256 JWT from their signing key. Without
 * credentials we return null and fall back to a public playback URL, which
 * keeps local development working.
 */
function signMuxToken(playbackId: string, expiresAt: Date): string | null {
  if (!env.video.muxSigningKeyId || !env.video.muxSigningKeySecret) return null;

  const header = { alg: "HS256", typ: "JWT", kid: env.video.muxSigningKeyId };
  const claims = {
    sub: playbackId,
    aud: "v",
    exp: Math.floor(expiresAt.getTime() / 1000),
    kid: env.video.muxSigningKeyId,
  };
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signature = createHmac("sha256", env.video.muxSigningKeySecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
