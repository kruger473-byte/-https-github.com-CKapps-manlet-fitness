import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

/**
 * Returns a Stripe client, or null when no key is configured.
 * Callers must handle null — the app runs in "demo billing" mode without
 * Stripe so the product can be built and demoed before the account exists.
 */
export function getStripe(): Stripe | null {
  if (!env.stripe.configured) return null;
  if (!client) {
    client = new Stripe(env.stripe.secretKey, {
      apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion,
      appInfo: { name: "Manlet Fitness", version: "0.1.0" },
    });
  }
  return client;
}

export function stripeConfigured(): boolean {
  return env.stripe.configured;
}

/** Map a Stripe subscription status onto our enum. */
export function mapStripeStatus(
  status: Stripe.Subscription.Status,
): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "PAUSED" {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "paused":
      return "PAUSED";
    default:
      return "INCOMPLETE";
  }
}
