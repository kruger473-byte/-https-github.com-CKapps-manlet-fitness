"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import {
  ATTRIBUTION_COOKIE,
  decodeAttribution,
  platformFromClickId,
  platformFromSource,
} from "@/lib/attribution";
import { recordConversion, resolveChannel } from "@/lib/integrations/hub";

export type AuthFormState = { error?: string };

const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you."),
  email: z.email("That email does not look right."),
  password: z.string().min(8, "Use at least 8 characters."),
  plan: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email("That email does not look right."),
  password: z.string().min(1, "Enter your password."),
});

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    plan: formData.get("plan") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { name, email, password, plan } = parsed.data;
  const normalisedEmail = email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email: normalisedEmail } });
  if (existing) {
    return { error: "An account with that email already exists. Try signing in." };
  }

  // Attach the acquisition data captured by middleware on first landing.
  const cookieStore = await cookies();
  const attribution = decodeAttribution(cookieStore.get(ATTRIBUTION_COOKIE)?.value);

  let channelId: string | null = null;
  if (attribution) {
    const platform = attribution.clickIdType
      ? platformFromClickId(attribution.clickIdType)
      : platformFromSource(attribution.source);
    channelId = await resolveChannel(platform, attribution.source ?? platform.toLowerCase());
  }

  const user = await db.user.create({
    data: {
      name,
      email: normalisedEmail,
      passwordHash: await hashPassword(password),
      attributedChannelId: channelId,
      attributionSource: attribution?.source ?? null,
      attributionMedium: attribution?.medium ?? null,
      attributionCampaign: attribution?.campaign ?? null,
      landingClickId: attribution?.clickId ?? null,
    },
  });

  // Fire the signup conversion to every configured ad platform, server-side.
  const headerList = await headers();
  await recordConversion({
    type: "SIGNUP",
    userId: user.id,
    channelId,
    email: user.email,
    firstName: user.name.split(" ")[0],
    campaign: attribution?.campaign ?? null,
    clickId: attribution?.clickId ?? null,
    clientIp: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  });

  await createSession({ userId: user.id, email: user.email, role: user.role });

  if (plan && plan !== "free") {
    redirect(`/account/billing?plan=${encodeURIComponent(plan)}`);
  }
  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.trim().toLowerCase() },
  });

  // Same message either way — don't confirm which emails exist.
  const ok = user && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !ok) {
    return { error: "That email and password combination did not work." };
  }

  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await createSession({ userId: user.id, email: user.email, role: user.role });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
