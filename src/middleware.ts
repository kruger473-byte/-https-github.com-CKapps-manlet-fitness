import { NextResponse, type NextRequest } from "next/server";

/**
 * Capture acquisition data on the very first request of a visit.
 *
 * This runs before any page renders, so a click from an Instagram bio or a
 * TikTok caption is attributed even if the visitor browses for a week before
 * signing up. Both cookies are first-party — no third-party pixel required
 * for us to know where a member came from.
 */

const ATTRIBUTION_COOKIE = "mf_attr";
const VISITOR_COOKIE = "mf_vid";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const CLICK_ID_PARAMS = ["fbclid", "ttclid", "gclid"] as const;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const url = request.nextUrl;

  // Stable first-party visitor id, used to stitch clicks to signups.
  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  const hasClickId = CLICK_ID_PARAMS.some((p) => url.searchParams.has(p));
  const hasUtm = url.searchParams.has("utm_source");
  const existing = request.cookies.get(ATTRIBUTION_COOKIE);

  // First touch wins: don't let a later organic visit overwrite the paid
  // click that actually earned the member.
  if ((hasClickId || hasUtm) && !existing) {
    const clickIdParam = CLICK_ID_PARAMS.find((p) => url.searchParams.has(p));
    const payload = {
      source: url.searchParams.get("utm_source") ?? undefined,
      medium: url.searchParams.get("utm_medium") ?? undefined,
      campaign: url.searchParams.get("utm_campaign") ?? undefined,
      content: url.searchParams.get("utm_content") ?? undefined,
      clickId: clickIdParam ? url.searchParams.get(clickIdParam) : undefined,
      clickIdType: clickIdParam,
      landedAt: new Date().toISOString(),
    };

    response.cookies.set(
      ATTRIBUTION_COOKIE,
      Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE,
        secure: process.env.NODE_ENV === "production",
      },
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)"],
};
