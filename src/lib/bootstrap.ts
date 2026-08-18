import { db } from "./db";

/**
 * Make a brand-new deployment usable without a terminal.
 *
 * A fresh production database has no plans and no admin, and signing up through
 * the site creates an ordinary member — so without this, the owner is locked
 * out of their own product and has to run SQL by hand. That is the single most
 * error-prone step of going live, so the app does it itself.
 *
 * Both operations below are guarded: they only ever fire on a database that has
 * nothing in it yet, and are no-ops from then on.
 */

const DEFAULT_PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "Taste the method. No card.",
    tier: 0,
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    trialDays: 0,
    sortOrder: 0,
    includesCoaching: false,
    coachingCreditsPerMonth: 0,
    features: [
      "3 full workout sessions",
      "Knowledge base essentials",
      "Read the community",
    ],
  },
  {
    key: "core",
    name: "Core",
    tagline: "The full training system.",
    tier: 1,
    priceMonthlyCents: 2900,
    priceYearlyCents: 29000,
    trialDays: 7,
    sortOrder: 1,
    includesCoaching: false,
    coachingCreditsPerMonth: 0,
    features: [
      "Every program and workout video",
      "All structured diet plans",
      "Full knowledge base",
      "Post in the member exchange",
      "Progress tracking",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    tagline: "Everything, plus a coach in your corner.",
    tier: 2,
    priceMonthlyCents: 9900,
    priceYearlyCents: 99000,
    trialDays: 7,
    sortOrder: 2,
    includesCoaching: true,
    coachingCreditsPerMonth: 2,
    features: [
      "Everything in Core",
      "2 x 1-1 coaching calls each month",
      "Private classroom with your coach",
      "Form review with written feedback",
      "Plan built around your numbers",
    ],
  },
];

/**
 * Create the starter plan catalogue and settings row if the database is empty.
 * Never touches existing rows, so editing or deleting a plan later sticks.
 */
export async function ensureStarterData(): Promise<void> {
  try {
    if ((await db.plan.count()) === 0) {
      for (const plan of DEFAULT_PLANS) {
        const { features, ...rest } = plan;
        await db.plan.create({
          data: { ...rest, features: JSON.stringify(features) },
        });
      }
    }

    const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      await db.siteSettings.create({ data: { id: "singleton" } });
    }
  } catch (error) {
    // Bootstrapping must never block a signup. If it fails, the owner can still
    // create plans by hand from the Pricing page.
    console.error("Starter data bootstrap failed:", error);
  }
}

/**
 * Promote the very first account on an ownerless deployment to ADMIN.
 *
 * Only ever true when no admin exists at all, which is the case exactly once
 * per deployment. On an established site this returns false immediately, so a
 * later signup can never gain admin.
 *
 * There is a narrow race if two people sign up in the same instant on a brand
 * new site — the outcome is two owners, not an outsider gaining access.
 */
export async function claimOwnershipIfUnclaimed(userId: string): Promise<boolean> {
  try {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) return false;

    await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
    return true;
  } catch (error) {
    console.error("Ownership claim failed:", error);
    return false;
  }
}
