# Deploying — technical reference

> **Not a developer?** Read **[GO-LIVE.md](GO-LIVE.md)** instead. It walks
> through the same thing in plain language with no assumed knowledge. This page
> is the condensed version for someone comfortable with a terminal.


This app is a single Next.js service plus a Postgres database. Anywhere that
runs those two things will work. Pick one path below.

- [1. Before you deploy anywhere](#1-before-you-deploy-anywhere)
- [2. Deploy — Vercel](#2-deploy--vercel-fastest)
- [3. Deploy — Docker](#3-deploy--docker-any-host-or-your-own-vps)
- [4. First-run setup](#4-first-run-setup)
- [5. Your domain](#5-your-domain)
- [6. Stripe](#6-stripe-taking-real-money)
- [7. Video hosting](#7-video-hosting)
- [8. Meta, TikTok and Google](#8-meta-tiktok-and-google)
- [9. Go-live checklist](#9-go-live-checklist)
- [10. Operating it](#10-operating-it)

---

## 1. Before you deploy anywhere

### Switch the database to Postgres

Development uses SQLite, which is a single file and won't survive a
container restart on most hosts. Production should use Postgres.

In `prisma/schema.prisma`, change one line:

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Then generate a migration against a Postgres database and commit it:

```bash
# point at any Postgres — a local one in Docker is fine
export DATABASE_URL="postgresql://user:pass@localhost:5432/manlet"
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "Add initial Postgres migration"
```

Committing `prisma/migrations/` is what lets deploys run `prisma migrate deploy`
and get a repeatable, reviewable schema history. Do this before you have real
members — after that, every schema change needs its own migration.

> Managed Postgres that works out of the box: Neon, Supabase, Railway, Render,
> Fly Postgres, or RDS. Any of them gives you a `DATABASE_URL`.

### Generate a session secret

Sessions are signed with `SESSION_SECRET`. The dev fallback is insecure and
publicly known — anyone could forge a session cookie with it.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Environment variables

`DATABASE_URL`, `APP_URL` and `SESSION_SECRET` are the only ones you need to
boot. Everything else is optional; see `.env.example` for the full list with
notes. Unconfigured integrations are skipped, not fatal.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `APP_URL` | Yes | e.g. `https://train.example.com` — fallback for the in-app domain setting |
| `SESSION_SECRET` | Yes | 48 random bytes. Rotating it signs everyone out |
| `STRIPE_SECRET_KEY` | For payments | Without it, checkout runs in demo mode |
| `STRIPE_WEBHOOK_SECRET` | For payments | From the webhook endpoint you create |
| `META_*`, `TIKTOK_*`, `GOOGLE_*` | Optional | Server-side conversions and content sync |
| `VIDEO_PROVIDER`, `MUX_*` | For real video | See [section 7](#7-video-hosting) |

---

## 2. Deploy — Vercel (fastest)

Best fit: it's the same company that builds Next.js, and the free tier will
carry you until you have paying members.

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo. The framework is detected;
   leave the build settings alone.
3. Under **Settings → Environment Variables**, add the variables from the table
   above for the Production environment.
4. Deploy.

The build runs `prisma generate && next build`. To also apply migrations on
every deploy, set the build command to:

```
prisma migrate deploy && prisma generate && next build
```

**One caveat that will bite you:** Vercel functions are serverless, so each one
opens its own database connection. Use a pooled connection string — Neon and
Supabase both offer one (Supabase's is on port `6543`), or put PgBouncer in
front. Without pooling you will hit connection limits under real traffic.

---

## 3. Deploy — Docker (any host, or your own VPS)

Use this for Fly.io, Railway, Render, Cloud Run, Hetzner, or a box you own.
Owning the host is the most literal version of owning your revenue.

### Locally, with Postgres included

```bash
cp .env.example .env
# set SESSION_SECRET and APP_URL in .env, then:
docker compose up --build
```

That starts Postgres and the app on <http://localhost:3000>, applies the schema,
and keeps the database in a named volume across restarts.

### Just the image

```bash
docker build -t manlet-fitness .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e APP_URL="https://train.example.com" \
  -e SESSION_SECRET="..." \
  manlet-fitness
```

The container applies migrations on boot before serving. If you haven't
committed migrations yet it falls back to `prisma db push` and says so loudly in
the logs — fine for a first run, but generate migrations before you have real
members.

> **Note:** the Dockerfile and compose file here are written but were not built
> in the environment this was developed in (no Docker daemon available), so
> treat the first `docker compose up --build` as the real test. The
> `output: "standalone"` build it depends on *was* verified.

### Put TLS in front

On your own VPS, terminate TLS with Caddy (simplest — automatic certificates):

```
train.example.com {
    reverse_proxy localhost:3000
}
```

Nginx with Certbot works equally well if you already run it.

---

## 4. First-run setup

A fresh production database has no plans and no admin account. Sign-up only
creates members, so bootstrap yourself in:

```bash
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='a-strong-password' \
npm run bootstrap
```

That creates the three plans, the site-settings row and your admin account. It
is **non-destructive and safe to re-run** — it only fills in what's missing.

If you'd rather sign up through the app first, do that, then promote yourself:

```bash
ADMIN_EMAIL=you@example.com npm run bootstrap
```

> **Never run `npm run db:seed` on production.** It wipes every table and
> inserts demo content. It refuses to run when `NODE_ENV=production`, but don't
> rely on that as your only safeguard.

Then sign in and open **Creator console → Branding** to set your name, logo,
colour and domain.

---

## 5. Your domain

There are two halves, and both need doing.

**Half one — routing.** Point DNS at your deployment and add the domain at your
host.

| Host | What to do |
| --- | --- |
| Vercel | Settings → Domains → add it, then create the CNAME/A record it shows |
| Fly/Railway/Render | Add a custom domain in the dashboard, follow its DNS instructions |
| Own VPS | `A` record → your server's IP; Caddy or Certbot issues the certificate |

**Half two — telling the app.** Open **Creator console → Branding** and set
**Public domain** to `train.example.com`. That's the origin the app hands to
other systems: Stripe redirects, `/go/` tracked links, OAuth callbacks and
link-preview metadata. It's validated before saving, and you can change it later
without a redeploy.

Set `APP_URL` in the environment too — it's the fallback used before anyone
opens the settings page, and during the deploy itself.

**When you change domains, update these as well**, or payments and attribution
break quietly:

- Stripe webhook endpoint URL
- OAuth redirect URIs in Meta, TikTok and Google
- Any tracked links already printed in a bio or caption (they'll 404 on the old
  domain)

---

## 6. Stripe (taking real money)

1. Create the products and prices in the Stripe dashboard — one monthly and one
   yearly price for **Core** and for **Elite**.
2. Put those price ids on the plan records. Either in the database directly, or
   with a one-off script:

   ```sql
   UPDATE "Plan" SET "stripePriceIdMonthly" = 'price_...',
                     "stripePriceIdYearly"  = 'price_...'
   WHERE key = 'core';
   ```

   Checkout returns a clear error if a price id is missing, rather than failing
   silently.
3. Add a webhook endpoint pointing at `https://your-domain/api/stripe/webhook`,
   subscribed to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

**The webhook is not optional.** It is the only thing that grants entitlement —
a member returning from checkout does not get access from the redirect. If the
webhook secret is wrong, payments succeed and nobody gets what they paid for.

Test it locally before you trust it:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

Do a real £1 subscription against live keys, confirm access is granted, then
refund it.

---

## 7. Video hosting

The default `VIDEO_PROVIDER=local` plays whatever URL is on the asset record.
That is fine for development and hopeless for paid content — the URL can be
copied out of the page and shared.

For real content use a provider with signed, expiring playback:

```env
VIDEO_PROVIDER=mux
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_SIGNING_KEY_ID=...
MUX_SIGNING_KEY_SECRET=...
```

With signing keys set, playback URLs are minted per request behind the
entitlement check and expire after four hours. Cloudflare Stream and Bunny are
supported in the same abstraction (`src/lib/video/index.ts`) if you prefer their
pricing.

---

## 8. Meta, TikTok and Google

All optional — the app works without them, and each unconfigured destination is
skipped rather than erroring.

For **server-side conversions** (the thing that survives cookie loss), you need
the pixel/token pairs: `META_PIXEL_ID` + `META_CONVERSIONS_TOKEN`,
`TIKTOK_PIXEL_CODE` + `TIKTOK_ACCESS_TOKEN`, and the Google Ads customer id,
developer token and conversion action.

For **connecting accounts** to pull content stats, you need the OAuth client
ids/secrets, plus these redirect URIs registered with each platform:

```
https://your-domain/api/integrations/meta/callback
https://your-domain/api/integrations/tiktok/callback
https://your-domain/api/integrations/google/callback
```

Then verify before trusting any of it: **Creator console → Growth → Send test
conversion** runs the whole dispatch path and reports exactly what each platform
said, including which ones were skipped and why.

---

## 9. Go-live checklist

- [ ] `provider` switched to `postgresql`, migrations generated and committed
- [ ] `SESSION_SECRET` set to real random bytes (not the dev fallback)
- [ ] `APP_URL` matches the live domain
- [ ] Pooled connection string if deploying serverless
- [ ] `npm run bootstrap` run; you can sign in as admin
- [ ] Branding set: name, logo, colour, public domain
- [ ] Stripe price ids on the plan records
- [ ] Stripe webhook created and `STRIPE_WEBHOOK_SECRET` set
- [ ] One real subscription bought end to end, access granted, then refunded
- [ ] Video moved off `local` to signed playback
- [ ] Test conversion sent and confirmed for each ad platform you use
- [ ] A tracked link clicked → signup → verified attribution in the revenue console
- [ ] Database backups switched on at your provider

---

## 10. Operating it

**Backups.** Every managed Postgres has automatic backups — turn them on. On
your own VPS, a nightly `pg_dump` to object storage is enough.

**Schema changes.** Edit `prisma/schema.prisma`, run `npx prisma migrate dev
--name what-changed` locally, commit the migration, deploy. Never run
`prisma db push` against production once you have members — it can drop columns
without warning.

**Smoke test after deploying.** The suite in `scripts/e2e.mjs` drives real
flows. Point it at any environment:

```bash
E2E_BASE_URL=https://staging.example.com npm run e2e
```

Don't run it against production: it creates accounts, books coaching slots and
posts to the community.

**What to watch first.** Failed payments (the revenue console shows members in
grace period — these are recoverable, chase them), the conversion delivery log
in Growth (silent failures there mean your ad platforms are optimising blind),
and churn.

**Rotating `SESSION_SECRET`** signs every member out at once. Only do it if you
believe the secret leaked.
