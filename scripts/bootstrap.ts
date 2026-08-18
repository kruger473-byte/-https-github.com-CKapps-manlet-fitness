/**
 * Non-destructive production setup.
 *
 * Unlike `prisma/seed.ts` (which wipes everything and inserts demo content),
 * this only fills in what is missing: the plan catalogue, the site settings row
 * and an admin account. It is safe to re-run on a live database.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run bootstrap
 *
 * Re-running with an existing ADMIN_EMAIL promotes that user to ADMIN without
 * touching their password, which is how you grant yourself access after signing
 * up through the normal form.
 */
import { PrismaClient } from "@prisma/client";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const db = new PrismaClient();
const scryptAsync = promisify(scrypt) as (
  p: string,
  s: Buffer,
  k: number,
) => Promise<Buffer>;

async function hash(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const PLANS = [
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

async function main() {
  console.log("Bootstrapping (non-destructive)...\n");

  // --- plans ---------------------------------------------------------------
  for (const plan of PLANS) {
    const existing = await db.plan.findUnique({ where: { key: plan.key } });
    if (existing) {
      console.log(`  plan "${plan.key}" already exists — left unchanged`);
      continue;
    }
    const { features, ...rest } = plan;
    await db.plan.create({
      data: { ...rest, features: JSON.stringify(features) },
    });
    console.log(`  created plan "${plan.key}"`);
  }

  // --- site settings -------------------------------------------------------
  const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  if (settings) {
    console.log("  site settings already exist — left unchanged");
  } else {
    await db.siteSettings.create({ data: { id: "singleton" } });
    console.log("  created default site settings");
  }

  // --- admin ---------------------------------------------------------------
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) {
    console.log(
      "\n  No ADMIN_EMAIL set, so no admin account was created or promoted.",
    );
  } else {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === "ADMIN") {
        console.log(`\n  ${email} is already an admin — nothing to do`);
      } else {
        await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
        console.log(`\n  promoted existing user ${email} to ADMIN`);
      }
    } else {
      if (!password || password.length < 8) {
        console.error(
          `\n  ${email} does not exist and ADMIN_PASSWORD is missing or under 8 characters.`,
        );
        process.exit(1);
      }
      await db.user.create({
        data: {
          email,
          name: process.env.ADMIN_NAME?.trim() || "Owner",
          passwordHash: await hash(password),
          role: "ADMIN",
        },
      });
      console.log(`\n  created admin ${email}`);
    }
  }

  const counts = {
    plans: await db.plan.count(),
    users: await db.user.count(),
    admins: await db.user.count({ where: { role: "ADMIN" } }),
  };
  console.log(
    `\nDone. plans=${counts.plans} users=${counts.users} admins=${counts.admins}`,
  );
  if (counts.admins === 0) {
    console.log(
      "\nNo admin yet. Sign up through the app, then re-run with:\n" +
        "  ADMIN_EMAIL=you@example.com npm run bootstrap",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
