# Manlet Fitness

A fitness **subscription platform** you own end to end: video training programs,
diet plans, a knowledge base, 1-1 coaching, a member community, direct payments,
and first-party attribution back to Instagram/Meta, TikTok and Google.

The point of the architecture is the business model. Brand deals restart at zero
every month and pay on reach you don't control. Subscriptions compound, and every
member is an email address you own. Social becomes an acquisition *channel*
instead of the business itself — so the platform is built to measure exactly
which post produced which paying member.

## Quick start

```bash
npm install
cp .env.example .env      # DATABASE_URL is the only required value
npm run setup             # generate client, create the DB, seed demo data
npm run dev               # http://localhost:3000
```

No third-party credentials are needed to run it. Stripe, Meta, TikTok, Google
and hosted video are all optional; unconfigured integrations are skipped rather
than throwing, and billing falls back to a clearly-labelled demo mode.

### Demo accounts

All use the password `password123`:

| Email | Role |
| --- | --- |
| `admin@manlet.fit` | Creator console — revenue, growth, channels |
| `coach@manlet.fit` | Coach — schedule and classrooms |
| `sam@example.com` | Elite member — coaching credits |
| `free@manlet.fit` | Free member — sees the paywalls |

## What's in it

**Membership & payments.** Three tiers (Free / Core / Elite) with monthly and
yearly pricing, free trials, Stripe Checkout, the Stripe customer portal, and
cancel-at-period-end. The webhook is the sole authority on entitlement — a
browser redirect never grants access. Every Stripe event id is stored, so
retries are no-ops. Failed payments move a member to `PAST_DUE`, which *keeps*
access during dunning: locking someone out on the first card decline converts a
retryable failure into a cancellation.

**Video programs.** Multi-week structured blocks rather than a loose library.
Playback URLs are minted per request behind an entitlement check and expire;
swapping Mux for Cloudflare Stream or Bunny is one file (`src/lib/video`). The
player reports progress on a throttle, and the progress API re-checks
entitlement server-side so it can't be used to record progress on locked
content.

**Diet plans.** Day-by-day meals whose macros total to the plan's target, a
running comparison against that target, an aggregated shopping list, and a
Mifflin-St Jeor calculator that turns a member's own numbers into a target.

**Knowledge base.** Searchable, category-filtered, tier-gated articles. Free
articles are the top of the funnel; deeper material sits behind the membership.

**1-1 coaching classroom.** Members book from the coach's real availability.
Slots are claimed with a conditional update so two members hitting the same slot
cannot both win, and a failed booking releases the slot instead of stranding it.
Each session gets a private classroom — persistent chat, agenda, client goals
and coach-only notes — visible to the two participants and nobody else.

**Member exchange.** Threads, replies and reactions, with coach answers marked
so members can tell advice from opinion. Reading is free; posting is a paid
feature. This is what keeps members past month three.

**Creator console.** MRR, ARR, ARPU, churn, estimated LTV, collected-revenue
trend, and a per-channel funnel from clicks → signups → paying members →
revenue. Plus tracked links, channel management, and a conversion delivery log.

## How attribution works

This is the part that replaces the influencer-payout treadmill with something
measurable.

1. **Tracked links.** `/go/<slug>` records the click and forwards the visitor.
   Put it in an Instagram bio or a TikTok caption. Click logging failures never
   break the redirect — the member's journey matters more than the analytics row.
2. **First-touch capture.** Middleware stores click IDs (`fbclid`, `ttclid`,
   `gclid`) and UTMs in a first-party 90-day cookie on the first request of a
   visit. First touch wins, so a later organic visit can't steal credit from the
   paid click that actually earned the member.
3. **Stitching.** On signup the captured data is written onto the member record,
   including the channel it came from. Someone who clicks a TikTok clip and
   subscribes eleven days later is still attributed to that clip.
4. **Server-side conversions.** Signups and subscriptions are forwarded to Meta
   Conversions API, TikTok Events API and Google Ads offline conversion import,
   with SHA-256 hashed match keys — raw PII never leaves the process. Server-side
   delivery survives the cookie loss that guts browser pixels, and a stable
   `event_id` de-duplicates against the browser pixel when both fire.
5. **Your record is the source of truth.** Conversions are written locally first;
   the ad platforms are downstream consumers. If they're unconfigured or failing,
   your own revenue attribution is still intact.

Verify credentials with the **Send test conversion** button in
`/admin/growth` — it runs the whole dispatch path and reports what each platform
actually said.

## Architecture

```
src/
  app/
    (marketing)  landing, pricing              — public
    (auth)       login, signup                 — server actions
    (app)        dashboard, programs, nutrition, knowledge,
                 coaching, exchange, account/billing, admin/*
    api/         progress, stripe/webhook, integrations/*
    go/[slug]    tracked-link redirect
  lib/
    auth.ts          scrypt hashing + JWT session cookies
    entitlements.ts  tier -> content access
    stripe.ts        client, degrades to demo mode
    attribution.ts   click IDs, UTMs, PII hashing
    analytics.ts     MRR, churn, LTV, channel funnels
    video/           playback-URL signing per provider
    integrations/    meta, tiktok, google, dispatch hub
  components/    shared UI, no icon or chart dependencies
```

Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, Prisma 6,
Stripe. Nine runtime dependencies total — charts and icons are hand-rolled
rather than pulling ~100kB of library onto pages that render two series.

**Entitlement model.** Content carries a `minTier`; a member's plan carries a
`tier`. Access is `tier >= minTier`, checked on the server at every read *and*
every write. Client-side gating is presentation only.

## Branding it as your own

**Creator console → Branding** changes the product's identity without touching
code or redeploying:

- Brand name, monogram, tagline and the description search engines show
- Logo upload (PNG/JPEG/SVG/WebP), stored inline so there's no object-storage
  dependency; falls back to the monogram when unset
- Accent colour, with the shade and on-accent text variants derived from one
  hex — the text colour is picked by luminance, so a dark brand colour still
  reads on buttons
- Public domain, used for Stripe redirects, `/go/` tracked links, OAuth
  callbacks and link previews

Everything updates immediately across the marketing site, the member app, the
creator console and the browser tab.

## Going to production

**[DEPLOYMENT.md](DEPLOYMENT.md) is the full guide** — Vercel, Docker and
self-hosted, with a go-live checklist. The short version:

1. **Database.** Change `provider` to `postgresql` in `prisma/schema.prisma`,
   generate a migration, then `npx prisma migrate deploy`.
2. **Secrets.** Set a real `SESSION_SECRET` (48 random bytes) and `APP_URL`.
3. **Stripe.** Add the keys, create your prices, and store the price ids on the
   `Plan` rows (`stripePriceIdMonthly` / `stripePriceIdYearly`). Point a webhook
   at `/api/stripe/webhook` for `checkout.session.completed`,
   `customer.subscription.*`, `invoice.paid` and `invoice.payment_failed`.
4. **Video.** Move off `local` to a signed-playback provider so paid videos
   can't be shared as plain URLs.
5. **Ad platforms.** Add the Meta/TikTok/Google credentials and confirm delivery
   with the test-conversion button.
6. **Bootstrap.** Run `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run
   bootstrap` to create the plans and your admin account. Never run
   `npm run db:seed` against production — it wipes every table.

### Why web-first

Selling the subscription through your own web checkout keeps the revenue.
Native app stores take 15–30% of every subscription — the same tax the
influencer platforms already charge in attention. The app is responsive and
works on phones; a native shell can wrap it later, with billing staying on the
web.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Generate Prisma client, then production build |
| `npm run setup` | Generate + create DB + seed |
| `npm run db:reset` | Drop, recreate and reseed the database |
| `npm run typecheck` | TypeScript, no emit |
| `npm run bootstrap` | Non-destructive production setup: plans, settings, admin |
| `npm run db:migrate` | Create a migration from schema changes |
| `npm run db:deploy` | Apply committed migrations (production) |
| `npm run e2e` | Browser smoke suite against a running server |

## Status

Built and verified end to end: a 38-check browser suite covers tracked-link
attribution, signup, paywalls on locked content, free previews, knowledge
search, the macro calculator, demo checkout and upgrade, coaching booking and
the classroom, community posting permissions, the progress API's entitlement
check, admin-route protection, the revenue and growth consoles, and branding
(rename, recolour, domain validation and the accent-contrast rule).

Not included, and the honest list of what you'd add next: email delivery
(receipts, dunning, win-back), a live video provider for the coaching call
itself (the classroom holds everything around it), content upload UI for the
creator (seeded and DB-driven today), and rate limiting on auth endpoints.
