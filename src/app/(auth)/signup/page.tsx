import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { signupAction } from "../actions";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  if (await readSession()) redirect("/dashboard");
  const { plan } = await searchParams;
  return <AuthForm mode="signup" action={signupAction} plan={plan} />;
}
