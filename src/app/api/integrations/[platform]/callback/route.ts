import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/settings";
import type { Platform } from "@prisma/client";

const OAUTH_STATE_COOKIE = "mf_oauth_state";

const PLATFORM_MAP: Record<string, Platform> = {
  meta: "META",
  google: "GOOGLE",
  tiktok: "TIKTOK",
};

/**
 * OAuth callback: verify state, exchange the code, store the tokens on the
 * Channel row. Tokens live in your database — the platform relationship
 * belongs to the creator, not to an agency or a third-party tool.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { platform } = await params;
  const appUrl = await getAppUrl();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithMessage(`${platform} declined: ${oauthError}`, appUrl);
  }

  const stored = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;
  if (!stored || stored !== `${platform}:${state}`) {
    return redirectWithMessage(
      "OAuth state did not match — the request was not started here. Nothing was connected.",
      appUrl,
    );
  }
  if (!code) return redirectWithMessage("No authorisation code was returned.", appUrl);

  const mapped = PLATFORM_MAP[platform];
  if (!mapped) return redirectWithMessage(`Unknown platform "${platform}".`, appUrl);

  const redirectUri = `${appUrl}/api/integrations/${platform}/callback`;

  let tokens: { accessToken: string; refreshToken?: string; expiresIn?: number };
  try {
    tokens = await exchangeCode(platform, code, redirectUri);
  } catch (error) {
    return redirectWithMessage(
      `Token exchange failed: ${error instanceof Error ? error.message : "unknown error"}`,
      appUrl,
    );
  }

  await db.channel.upsert({
    where: { platform_handle: { platform: mapped, handle: `${platform}-connected` } },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      isConnected: true,
      connectedAt: new Date(),
    },
    create: {
      platform: mapped,
      handle: `${platform}-connected`,
      displayName: `${platform} (connected)`,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      isConnected: true,
      connectedAt: new Date(),
    },
  });

  const response = redirectWithMessage(`${platform} connected.`, appUrl);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

async function exchangeCode(
  platform: string,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  if (platform === "meta") {
    const res = await fetch(
      `https://graph.facebook.com/${env.meta.apiVersion}/oauth/access_token` +
        `?client_id=${encodeURIComponent(env.meta.appId)}` +
        `&client_secret=${encodeURIComponent(env.meta.appSecret)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code=${encodeURIComponent(code)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    return { accessToken: json.access_token, expiresIn: json.expires_in };
  }

  if (platform === "google") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
    };
  }

  if (platform === "tiktok") {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.tiktok.clientKey,
        client_secret: env.tiktok.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
    };
  }

  throw new Error(`Unsupported platform "${platform}"`);
}

function redirectWithMessage(message: string, appUrl: string) {
  const target = new URL("/admin/growth", appUrl);
  target.searchParams.set("integration", message);
  return NextResponse.redirect(target, { status: 307 });
}
