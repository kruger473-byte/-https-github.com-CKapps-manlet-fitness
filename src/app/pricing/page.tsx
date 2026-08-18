import type { Metadata } from "next";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { formatMoney } from "@/lib/entitlements";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ButtonLink, Badge, Card, CheckIcon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One subscription for video programs, diet plans, the knowledge base, the member community and 1-1 coaching.",
};
export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "Can I cancel whenever I want?",
    a: "Yes, from your own billing page — no email, no phone call. You keep access until the end of the period you already paid for.",
  },
  {
    q: "What happens after the free trial?",
    a: "You're charged the plan price and continue. Cancel any time before the trial ends and you pay nothing.",
  },
  {
    q: "Is the free plan actually useful?",
    a: "Yes. You get the first session of every program, the free tier of the knowledge base and read access to the community. It's enough to judge whether the coaching style suits you.",
  },
  {
    q: "What is included in a coaching call?",
    a: "45 minutes 1-1 in a private classroom that keeps your agenda, goals, chat and the coach's written notes. Elite includes two calls a month; you can also book one-off sessions.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes, up or down, at any time. Changes are prorated by Stripe.",
  },
];

export default async function PricingPage() {
  const [session, plans] = await Promise.all([
    readSession(),
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <MarketingNav signedIn={Boolean(session)} />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mb-12 text-center">
          <Badge tone="volt" className="mb-4">
            Cancel any time
          </Badge>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            One subscription. The whole system.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-300">
            Programs, nutrition, the knowledge base, the member exchange and coaching —
            priced so it&apos;s obviously cheaper than the five things it replaces.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const features = JSON.parse(plan.features) as string[];
            const featured = plan.key === "core";
            const yearlySaving =
              plan.priceMonthlyCents > 0
                ? plan.priceMonthlyCents * 12 - plan.priceYearlyCents
                : 0;

            return (
              <div
                key={plan.id}
                className={`card flex flex-col p-6 ${
                  featured ? "border-volt-500/50 ring-1 ring-volt-500/20" : ""
                }`}
              >
                {featured ? (
                  <Badge tone="volt" className="mb-3 self-start">
                    Most popular
                  </Badge>
                ) : null}

                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-ink-400">{plan.tagline}</p>

                <p className="mt-6">
                  <span className="text-4xl font-black tabular-nums">
                    {plan.priceMonthlyCents === 0
                      ? "Free"
                      : formatMoney(plan.priceMonthlyCents)}
                  </span>
                  {plan.priceMonthlyCents > 0 ? (
                    <span className="text-sm text-ink-400"> /month</span>
                  ) : null}
                </p>
                {yearlySaving > 0 ? (
                  <p className="mt-1.5 text-xs text-volt-500">
                    {formatMoney(plan.priceYearlyCents)}/year — save{" "}
                    {formatMoney(yearlySaving)}
                  </p>
                ) : null}

                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-300">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-volt-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={
                    plan.priceMonthlyCents === 0
                      ? "/signup"
                      : `/signup?plan=${plan.key}`
                  }
                  variant={featured ? "primary" : "secondary"}
                  className="mt-7 w-full"
                >
                  {plan.priceMonthlyCents === 0
                    ? "Create free account"
                    : `Start ${plan.trialDays}-day free trial`}
                </ButtonLink>

                {plan.priceMonthlyCents > 0 ? (
                  <p className="mt-3 text-center text-xs text-ink-400">
                    No card charged until the trial ends
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">
            Questions people actually ask
          </h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <Card key={item.q}>
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Start with the free plan</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-400">
            No card, no trial timer. Upgrade when the training has earned it.
          </p>
          <ButtonLink href="/signup" className="mt-6 px-6 py-3 text-base">
            Create your account
          </ButtonLink>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
