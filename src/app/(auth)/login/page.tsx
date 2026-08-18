import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { loginAction } from "../actions";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await readSession()) redirect("/dashboard");
  return <AuthForm mode="login" action={loginAction} />;
}
