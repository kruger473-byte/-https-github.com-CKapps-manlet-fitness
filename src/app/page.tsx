import Link from "next/link";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { formatMoney } from "@/lib/entitlements";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import {
  ButtonLink,
  Badge,
  CheckIcon,
  DumbbellIcon,
  AppleIcon,
  BookIcon,
  UsersIcon,
  VideoIcon,
  ChartIcon,
  ArrowRightIcon,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [session, plans, counts] = await Promise.all([
    readSession(),
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    Promise.all([
      db.workout.count(),
      db.dietPlan.count(),
      db.article.count(),
      db.user.count({ where: { role: "MEMBER" } }),
    ]),
  ]);

  const [workoutCount, dietCount, articleCount, memberCount] = counts;
  const core = plans.find((p) => p.key === "core");

  return (
    <>
      <MarketingNav signedIn={Boolean(session)} />

      {/* Hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-ink-800">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(200,243,29,0.14) 0%, rgba(8,9,12,0) 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <Badge tone="volt" className="mb-6">
            Built for coaches who want to own their audience
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
            Your training system.
            <br />
            <span className="text-volt-500">Your subscribers. Your revenue.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-ink-300 sm:text-lg">
            Video programs, structured diet plans, a real knowledge base, 1-1 coaching
            and a member community — in one subscription you sell directly. No brand
            deals to chase, no algorithm to beg, no platform taking a cut of every
            payment.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" className="px-6 py-3 text-base">
              Start free — no card
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" className="px-6 py-3 text-base">
              See plans
              {core ? ` — from ${formatMoney(core.priceMonthlyCents)}/mo` : ""}
            </ButtonLink>
          </div>
          <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [String(workoutCount), "workout videos"],
              [String(dietCount), "diet plans"],
              [String(articleCount), "guides"],
              [String(memberCount), "members"],
            ].map(([value, label]) => (
              <div key={label} className="card p-4">
                <dt className="text-2xl font-bold tabular-nums text-volt-500">{value}</dt>
                <dd className="mt-0.5 text-xs text-ink-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pillars --------------------------------------------------------- */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything a member pays for, in one place
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-400">
            Five products that would normally be five separate subscriptions. Bundled,
            they justify a price a single ebook never could.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Pillar
            icon={<VideoIcon className="h-6 w-6" />}
            title="Video programs"
            body="Structured multi-week blocks, not a loose library. Every session has a video, cues, equipment and a place in the plan. Playback URLs are signed and expire, so a paid video cannot be passed around."
            href="/programs"
          />
          <Pillar
            icon={<AppleIcon className="h-6 w-6" />}
            title="Diet plans"
            body="Full day-by-day meal plans with macros that add up, plus a calculator that turns a member's own numbers into a target they can actually follow."
            href="/nutrition"
          />
          <Pillar
            icon={<BookIcon className="h-6 w-6" />}
            title="Knowledge base"
            body="The searchable answer to every question you get asked twice. Free articles pull people in from search; the deeper material sits behind the membership."
            href="/knowledge"
          />
          <Pillar
            icon={<DumbbellIcon className="h-6 w-6" />}
            title="1-1 coaching classroom"
            body="Members book a slot from your real calendar, meet you in a private room, and keep the notes, agenda and chat between calls. Elite plans include monthly credits."
            href="/coaching"
          />
          <Pillar
            icon={<UsersIcon className="h-6 w-6" />}
            title="Member exchange"
            body="A community your members cannot get anywhere else, with your answers marked as coach replies. This is what makes them stay past month three."
            href="/exchange"
          />
          <Pillar
            icon={<ChartIcon className="h-6 w-6" />}
            title="Revenue console"
            body="MRR, churn, LTV, and which Instagram reel or TikTok clip actually produced paying members — measured first-party, not guessed from a dashboard you don't own."
            href="/login"
          />
        </div>
      </section>

      {/* The pitch ------------------------------------------------------- */}
      <section className="border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Stop renting an audience you already have
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-400">
            Sponsorship money is lumpy, one-off, and disappears the month you stop
            posting. Subscriptions compound. The platform is built around that
            difference.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-400">
                Brand-deal treadmill
              </h3>
              <ul className="space-y-3 text-sm text-ink-300">
                {[
                  "Income restarts at zero every month",
                  "Paid on reach, which the algorithm controls",
                  "You never learn who your audience actually is",
                  "One policy change ends the business",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="mt-0.5 text-red-400">✕</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card border-volt-500/30 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-volt-500">
                Owned subscription
              </h3>
              <ul className="space-y-3 text-sm text-ink-300">
                {[
                  "Recurring revenue that carries month to month",
                  "Paid on value delivered, not impressions",
                  "Every member is an email address you own",
                  "Social becomes a channel, not a landlord",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-volt-500" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 card p-6">
            <h3 className="text-base font-semibold">
              Social still matters — it just stops being the business
            </h3>
            <p className="mt-2 text-sm text-ink-400">
              Every link you post is tracked. When someone clicks a TikTok caption and
              subscribes eleven days later, that revenue is attributed to that clip.
              Conversions are sent back to Meta, TikTok and Google server-side, so ad
              platforms can optimise even after browsers drop the cookie — and you can
              see cost per paying member per channel instead of guessing.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Instagram", "Meta CAPI", "TikTok Events API", "Google Ads", "Stripe"].map(
                (t) => (
                  <Badge key={t}>{t}</Badge>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Plans ----------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
          <p className="mt-3 text-sm text-ink-400">
            Cancel any time. Yearly saves roughly two months.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const features = JSON.parse(plan.features) as string[];
            const featured = plan.key === "core";
            return (
              <div
                key={plan.id}
                className={`card flex flex-col p-6 ${featured ? "border-volt-500/50 ring-1 ring-volt-500/20" : ""}`}
              >
                {featured ? (
                  <Badge tone="volt" className="mb-3 self-start">
                    Most popular
                  </Badge>
                ) : null}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-ink-400">{plan.tagline}</p>
                <p className="mt-5">
                  <span className="text-4xl font-black tabular-nums">
                    {plan.priceMonthlyCents === 0
                      ? "Free"
                      : formatMoney(plan.priceMonthlyCents)}
                  </span>
                  {plan.priceMonthlyCents > 0 ? (
                    <span className="text-sm text-ink-400"> /month</span>
                  ) : null}
                </p>
                {plan.priceYearlyCents > 0 ? (
                  <p className="mt-1 text-xs text-ink-400">
                    or {formatMoney(plan.priceYearlyCents)}/year
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
                  href={plan.priceMonthlyCents === 0 ? "/signup" : `/signup?plan=${plan.key}`}
                  variant={featured ? "primary" : "secondary"}
                  className="mt-6 w-full"
                >
                  {plan.priceMonthlyCents === 0
                    ? "Create free account"
                    : `Start ${plan.trialDays}-day trial`}
                </ButtonLink>
              </div>
            );
          })}
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}

function Pillar({
  icon,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex flex-col p-6 transition-colors hover:border-volt-500/40"
    >
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-volt-500/10 text-volt-500">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-volt-500">
        Explore
        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
