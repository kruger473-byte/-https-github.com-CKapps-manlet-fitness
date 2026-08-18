import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { metaOAuthUrl } from "@/lib/integrations/meta";
import { tiktokOAuthUrl } from "@/lib/integrations/tiktok";
import { googleOAuthUrl } from "@/lib/integrations/google";

const OAUTH_STATE_COOKIE = "mf_oauth_state";

/**
 * Begin an OAuth connection for a creator-owned channel.
 *
 * A random `state` value is stored in an httpOnly cookie and checked on the
 * callback — without it, an attacker could complete the flow and bind their
 * own social account to this deployment.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { platform } = await params;
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${env.appUrl}/api/integrations/${platform}/callback`;

  let authUrl: string | null = null;
  switch (platform) {
    case "meta":
      authUrl = metaOAuthUrl(redirectUri, state);
      break;
    case "tiktok":
      authUrl = tiktokOAuthUrl(redirectUri, state);
      break;
    case "google":
      authUrl = googleOAuthUrl(redirectUri, state);
      break;
    default:
      return NextResponse.json(
        { error: `Unknown platform "${platform}".` },
        { status: 404 },
      );
  }

  if (!authUrl) {
    return NextResponse.json(
      {
        error: `${platform} OAuth is not configured.`,
        hint: `Set the client id and secret for ${platform} in your environment, then try again.`,
      },
      { status: 503 },
    );
  }

  const response = NextResponse.redirect(authUrl, { status: 307 });
  response.cookies.set(OAUTH_STATE_COOKIE, `${platform}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: env.isProd,
  });
  return response;
}
