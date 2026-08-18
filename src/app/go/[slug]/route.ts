import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  ATTRIBUTION_COOKIE,
  VISITOR_COOKIE,
  ATTRIBUTION_MAX_AGE,
  encodeAttribution,
} from "@/lib/attribution";

/**
 * Tracked-link redirect: /go/<slug>
 *
 * Records the click, stamps first-party attribution, then forwards to the
 * destination. This is what makes "which TikTok clip produced paying members"
 * answerable without depending on a platform's own reporting.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);

  const link = await db.trackedLink.findUnique({
    where: { slug },
    include: { channel: true },
  });

  // Unknown slug: send people to the homepage rather than a dead end.
  if (!link) {
    return NextResponse.redirect(new URL("/", env.appUrl), { status: 307 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const visitorId =
    readCookie(cookieHeader, VISITOR_COOKIE) ?? randomUUID();

  const clickId =
    url.searchParams.get("fbclid") ??
    url.searchParams.get("ttclid") ??
    url.searchParams.get("gclid");

  // Never let click logging break the redirect — the member's journey
  // matters more than the analytics row.
  try {
    await db.click.create({
      data: {
        trackedLinkId: link.id,
        visitorId,
        clickId,
        referrer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent")?.slice(0, 300),
      },
    });
  } catch (error) {
    console.error(`Click logging failed for /go/${slug}:`, error);
  }

  const destination = new URL(link.destination, env.appUrl);
  const response = NextResponse.redirect(destination, { status: 307 });

  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE,
    secure: env.isProd,
  });

  // First touch wins: only stamp attribution if none is set.
  if (!readCookie(cookieHeader, ATTRIBUTION_COOKIE)) {
    response.cookies.set(
      ATTRIBUTION_COOKIE,
      encodeAttribution({
        source: link.channel?.platform.toLowerCase(),
        medium: link.medium ?? undefined,
        campaign: link.campaign ?? undefined,
        channelId: link.channelId ?? undefined,
        linkSlug: link.slug,
        clickId: clickId ?? undefined,
        landedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ATTRIBUTION_MAX_AGE,
        secure: env.isProd,
      },
    );
  }

  return response;
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}
