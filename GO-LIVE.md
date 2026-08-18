# Putting your app online

This guide assumes you have never written code and have never deployed
anything. Follow it top to bottom and you will have a working fitness
subscription business at your own web address, taking real payments.

**Time:** about two hours, most of it waiting for other companies to approve
things.

**Cost to start:** about $0–25/month. Details in [Step 1](#step-1-what-this-will-cost).

You will be copying and pasting a lot. That is normal and expected. You do not
need to understand what you are pasting.

---

### The map

| | Step | What it is |
| --- | --- | --- |
| 1 | [What this will cost](#step-1-what-this-will-cost) | So there are no surprises |
| 2 | [Make three free accounts](#step-2-make-three-free-accounts) | GitHub, Neon, Vercel |
| 3 | [Get your own copy of the code](#step-3-get-your-own-copy-of-the-code) | Onto GitHub |
| 4 | [Create the database](#step-4-create-the-database) | Where members are stored |
| 5 | [Put the app online](#step-5-put-the-app-online) | The actual deploy |
| 6 | [Make yourself the owner](#step-6-make-yourself-the-owner) | Just sign up first |
| 7 | [Brand it](#step-7-brand-it) | Your name, logo, colour |
| 8 | [Use your own web address](#step-8-use-your-own-web-address) | yourname.com |
| 9 | [Take real payments](#step-9-take-real-payments) | Stripe |
| 10 | [Put your videos in](#step-10-put-your-videos-in) | Properly protected |
| 11 | [Add your content](#step-11-add-your-content) | Programs, plans, articles |
| 12 | [Connect Instagram, TikTok, Google](#step-12-connect-instagram-tiktok-and-google) | Optional but valuable |
| 13 | [Before you tell anyone](#step-13-before-you-tell-anyone) | Final checklist |

There is also [**What to do when something breaks**](#what-to-do-when-something-breaks)
at the end. Read that section when something goes wrong, not before.

---

## Step 1: What this will cost

You can start on free plans and pay nothing until you have members.

| What | Free to start? | When you'd start paying |
| --- | --- | --- |
| **Vercel** (runs the app) | Yes | ~$20/month once you have real traffic |
| **Neon** (the database) | Yes | ~$19/month at a few thousand members |
| **Stripe** (payments) | No monthly fee | Takes about 2.9% + 30¢ per payment |
| **Your web address** | No | ~$12/year |
| **Video hosting** | Small free tier | ~$20/month once you have real video |

So: roughly **$12 for the domain** to begin, and nothing else until people are
actually paying you.

**A note on why this setup:** you are selling directly through your own website
instead of through an app store. App stores take 15–30% of every subscription
forever. On $5,000/month of subscriptions that is $750–1,500 a month, every
month. This is why the app is a website first.

---

## Step 2: Make three free accounts

Sign up for these now. Use the same email for all three.

1. **GitHub** — <https://github.com/signup> — stores your code
2. **Neon** — <https://neon.tech> — stores your members and content
3. **Vercel** — <https://vercel.com/signup> — runs the website

> When Vercel asks how you want to sign up, **choose "Continue with GitHub"**.
> This connects them automatically and saves you a step later.

Keep all three tabs open. You will move between them.

---

## Step 3: Get your own copy of the code

The code currently lives in a repository. You need your own copy that Vercel can
read.

1. Open the repository page on GitHub.
2. Top right, click **Fork**.
3. Leave everything as-is and click **Create fork**.

You now have your own copy. The web address will look like
`github.com/your-username/manlet-fitness`.

> **"Fork" just means "my own copy."** Changes you make don't affect the
> original, and changes there don't affect yours.

---

## Step 4: Create the database

This is where every member, payment and piece of content is stored.

1. Go to <https://console.neon.tech> and click **New Project**.
2. Name it `manlet-fitness`. Pick the region closest to most of your audience.
3. Click **Create project**.
4. You will land on a screen showing a **connection string**. It looks like:

   ```
   postgresql://neondb_owner:AbCd1234@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

5. **Copy it and paste it somewhere safe** — a notes app is fine for now.

> ⚠️ **Treat this like a password.** Anyone with this string can read every
> member's details. Never put it in an email, a screenshot, or a message.

**If you see a choice between "Pooled" and "Direct" connection, choose
"Pooled".** Vercel needs the pooled one. If you don't see that choice, don't
worry — the default is right.

---

## Step 5: Put the app online

1. Go to <https://vercel.com/new>.
2. Find your forked repository in the list and click **Import**.
3. **Do not change the build settings.** Vercel already knows what to do.
4. Expand the **Environment Variables** section. You are adding three.

**Variable 1 — the database**

- Name: `DATABASE_URL`
- Value: the connection string you copied from Neon

**Variable 2 — the security key**

- Name: `SESSION_SECRET`
- Value: a long random string

To make one, open <https://www.random.org/strings/> and set: 8 strings,
20 characters each, tick digits and both letter options, then click **Get
Strings**. Delete the line breaks and paste the result as one long blob. Any
long unpredictable string works.

> ⚠️ This key is what stops strangers logging in as your members. Never reuse a
> password you use elsewhere, and never share it.

**Variable 3 — your web address**

- Name: `APP_URL`
- Value: `https://your-project-name.vercel.app`

You don't know the exact address yet. Guess based on your project name — you
will correct it in Step 8.

5. Click **Deploy**.

Wait two to three minutes. When it finishes you will see confetti and a
**Continue to Dashboard** button. Click **Visit** to see your site.

**You should see the landing page.** If you see an error instead, jump to
[What to do when something breaks](#what-to-do-when-something-breaks).

---

## Step 6: Make yourself the owner

This is the easiest step. **The first person to sign up on a new site becomes
the owner automatically.** Make sure that person is you.

1. Go to your live site and click **Start free**.
2. Sign up with your real email and a strong password.

That's it. You will land straight on the **Branding** page with a message
confirming you're the owner, and the sidebar will now show **Revenue**,
**Content**, **Pricing** and **Branding**. Your three starter plans (Free, Core,
Elite) have been created for you as well.

> ⚠️ **Do this before you share the link with anyone.** Only the *first* account
> becomes the owner — everyone who signs up afterwards is an ordinary member.
> That is what stops a stranger claiming your site, but it also means you should
> not advertise the site until you've signed up yourself.

If you accidentally let someone else sign up first, see
[I'm not the owner](#im-not-the-owner-someone-else-signed-up-first) in the
troubleshooting section.

---

## Step 7: Brand it

The fun part, and no code involved.

1. In the sidebar click **Branding**.
2. Set:
   - **Brand name** — what members see everywhere
   - **Monogram** — 1–3 letters, used until you upload a logo
   - **Accent colour** — click the swatch and pick yours
   - **Tagline** — one line, shows in the browser tab
   - **Search & share description** — what appears on Google and when someone
     shares your link
3. Click **Save branding**.
4. On the right, under **Logo**, choose your logo file and click **Upload logo**.
   Square images work best. Under 256KB.

Changes are live instantly. Open your site in another tab to see them.

> **The colour picker handles contrast for you.** Pick a dark navy and the button
> text turns white automatically, so nothing becomes unreadable.

---

## Step 8: Use your own web address

Right now your site is at `something.vercel.app`. Here is how to use
`yourname.com`.

**Buy the address.** Any registrar works — Namecheap, Cloudflare, GoDaddy.
About $12/year. Buy it, then come back.

**Tell Vercel about it:**

1. In Vercel, open your project → **Settings** → **Domains**.
2. Type your domain and click **Add**.
3. Vercel shows you one or two records to create. It looks like:

   ```
   Type: A      Name: @      Value: 76.76.21.21
   Type: CNAME  Name: www    Value: cname.vercel-dns.com
   ```

**Tell your registrar about it:**

4. Log in where you bought the domain, find **DNS settings**, and add exactly
   those records.
5. Save.

Now wait. It usually works within 30 minutes, occasionally a few hours. Vercel
shows a green tick when it's ready.

**Then, two things you must not skip:**

6. In Vercel → **Settings** → **Environment Variables**, edit `APP_URL` to your
   real address (`https://yourname.com`). Then go to **Deployments**, click the
   `…` on the newest one, and choose **Redeploy**.
7. On your site, go to **Branding** and set **Public domain** to `yourname.com`.

> **Why both?** The environment variable is used while the app starts up. The
> Branding setting is used for links the app hands to other companies — Stripe,
> Instagram, Google. If they disagree, payments can fail in confusing ways.

---

## Step 9: Take real payments

Until now, the "buy" buttons work but no money moves. This connects Stripe.

### 9a. Create your Stripe account

Go to <https://stripe.com>, sign up, and complete the business details. Stripe
will ask for ID and bank details — this is normal and legally required. Approval
is usually minutes, occasionally a day or two.

### 9b. Create your prices

In the Stripe dashboard, click **Product catalogue** → **Add product**.

Make one product per plan you sell. For **Core**:

- Name: `Core`
- Price: your monthly price, set to **Recurring**, **Monthly**
- Click **Add another price**, same amount ×10ish, **Recurring**, **Yearly**
- Save

Repeat for **Elite**.

Now click into each price and copy its **price ID**. It looks like
`price_1QxYzABC123`. You need four in total (Core monthly, Core yearly, Elite
monthly, Elite yearly).

### 9c. Put those IDs into your app

1. On your site, go to **Pricing** in the sidebar.
2. Click the **Core** row to expand it.
3. Paste the two Core price IDs into **Stripe price ID — monthly** and
   **— yearly**.
4. Click **Save plan**. Repeat for **Elite**.

> If a plan has a price but no Stripe price ID, the Pricing page shows a red
> **No Stripe price** warning. That warning means checkout will fail for that
> plan. Don't ignore it.

### 9d. Get your secret key

1. In Stripe, click **Developers** → **API keys**.
2. Next to **Secret key**, click **Reveal** and copy it. Starts with `sk_live_`.
3. In Vercel → **Settings** → **Environment Variables**, add:
   - Name: `STRIPE_SECRET_KEY`
   - Value: the key you copied

> ⚠️ This key can move money. Never paste it into a chat, an email, or a
> screenshot. If it ever leaks, click **Roll key** in Stripe immediately.

### 9e. Set up the webhook — do not skip this

This is the single most important step on this page.

**What it does:** when someone pays, Stripe has to tell your app "this person
paid, give them access." That message is the webhook. Without it, **people will
be charged and get nothing**, and you will not find out until they email you
angry.

1. In Stripe, go to **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL:** `https://yourname.com/api/stripe/webhook`
   (your real domain, and exactly that path)
3. Click **Select events** and tick these six:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Click **Add endpoint**.
5. On the endpoint's page, find **Signing secret**, click **Reveal**, copy it.
   Starts with `whsec_`.
6. In Vercel → **Environment Variables**, add:
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: the signing secret

7. Go to **Deployments** in Vercel, click `…` on the newest, **Redeploy**.

### 9f. Test it with your own money

Do not skip this either. It takes five minutes and catches almost every mistake.

1. Open your site in a **private/incognito window**.
2. Sign up as a brand new member with a different email.
3. Subscribe to a plan with a real card.
4. **Check that you immediately get access** to the paid content.
5. In Stripe, find the payment and click **Refund**.

If access appeared: you are done, it works. If it did not, the webhook is
wrong — see [What to do when something breaks](#what-to-do-when-something-breaks).

---

## Step 10: Put your videos in

**Important:** by default, a video is just a web address. Anyone who finds it can
share it, and people who never paid can watch. Fine while you're testing; not
fine for content you're selling.

For real content use **Mux** (<https://mux.com>), which gives every viewer a
private link that expires.

1. Sign up at Mux and upload a video.
2. Go to **Settings** → **Access Tokens** → **Generate new token**, with
   permission for Mux Video. Copy both the **Token ID** and **Token Secret**.
3. Go to **Settings** → **Signing Keys** → **Generate new key**. Copy the
   **Key ID** and the **Private Key**.
4. In Vercel → **Environment Variables**, add all four:
   - `MUX_TOKEN_ID`
   - `MUX_TOKEN_SECRET`
   - `MUX_SIGNING_KEY_ID`
   - `MUX_SIGNING_KEY_SECRET`
5. Redeploy.

Then when you add a session in **Content**, set **Video host** to `Mux` and paste
the video's **Playback ID** from Mux.

> **In plain terms:** without this, your paid videos can be passed around a
> WhatsApp group. With it, each link works for one viewer for a few hours.

---

## Step 11: Add your content

Everything here is point-and-click. Sidebar → **Content**.

**Training programs.** Click **New program** → fill in the title and
description → **Create program**. Then add sessions one at a time: title, how
long it is, and the video.

> **Tick "Free preview" on the first session of every program.** Letting someone
> watch one real session converts far better than any description.

**Diet plans.** Set the daily calorie and macro target, then add meals day by
day. The editor warns you if a day's meals miss your own stated target by more
than 150 calories — that mistake is easy to make and embarrassing to publish.
Ingredients go one per line and become the member's shopping list.

**Supplement plans.** Add items graded **core** (good evidence), **optional**
(small or uncertain), or **situational**. There's a separate box for what the
evidence actually says. Use it honestly — it's what makes this different from an
affiliate list, and members can tell.

**Knowledge base.** Write the answer to every question you get asked twice. Make
the basics **free** — they bring people in from Google. Keep the deeper material
behind the plan.

**Nothing is visible until you tick "Published".** Drafts are yours alone. You
can also flip Live/Draft straight from the list.

### Selling something on its own

Some people will never subscribe but will happily pay once for one program.

Go to **Pricing** → **New product** → give it a name and price → pick which
program or plan it unlocks → **Create product**.

It appears under **Buy individually**. Whoever buys it gets that content
permanently, whatever plan they're on, and **keeps it even if they cancel**.

You can also select **A bundle of several items** to sell a few things together.

---

## Step 12: Connect Instagram, TikTok and Google

Entirely optional. Skip it today and come back when you're posting regularly.

**What this gives you:** you post a link in your Instagram bio. Someone clicks
it, browses, and subscribes eleven days later. Normally you'd have no idea which
post earned that money. With this, you know exactly — and can see which content
actually pays rent, rather than guessing from likes.

**The easy half — start today, no accounts needed:**

1. Go to **Growth** in the sidebar.
2. Under **New tracked link**, create one: slug `ig-bio`, sending people to
   `/pricing`.
3. Copy the link it gives you and put it in your Instagram bio instead of your
   plain website address.

That's it. **Revenue** now shows how many members and how much money that link
produced.

**The harder half — server-side conversions:**

This tells Instagram and TikTok's ad systems which posts produced buyers, so
their advertising gets better at finding people like your buyers. It requires a
Meta Business account and a TikTok Business account, and it is genuinely fiddly.
The **Growth** page lists exactly which values it needs.

Once added, click **Send test conversion** on that page. It tells you plainly
whether each platform accepted it, and why not if it didn't.

> **Do this later.** Tracked links are 80% of the value for 5% of the effort.

---

## Step 13: Before you tell anyone

Go through this properly. Each one is a real problem that has bitten someone.

- [ ] Your domain loads and shows a padlock in the address bar
- [ ] `APP_URL` in Vercel matches your real domain
- [ ] **Public domain** in Branding matches too
- [ ] You can sign in and see the creator console
- [ ] Your logo, name and colour are set
- [ ] Every paid plan has its Stripe price IDs (no red warnings on Pricing)
- [ ] The Stripe webhook exists and `STRIPE_WEBHOOK_SECRET` is set
- [ ] **You bought a subscription with a real card, got access, then refunded it**
- [ ] At least one program with a free-preview session
- [ ] At least one diet plan and a few free knowledge articles
- [ ] Videos are on Mux, not plain links
- [ ] Backups are on in Neon (Settings → they're on by default; confirm)
- [ ] You signed up in an incognito window as a stranger would, and it made sense

---

## What to do when something breaks

### "Application error" or a blank page

Almost always a missing or mistyped environment variable.

1. Vercel → your project → **Settings** → **Environment Variables**.
2. Check `DATABASE_URL`, `SESSION_SECRET` and `APP_URL` all exist.
3. Check `DATABASE_URL` starts with `postgresql://` and has no line breaks or
   spaces. This is the most common cause by far.
4. Fix it, then **Deployments** → `…` → **Redeploy**.

### Someone paid and got nothing

The webhook. Go to Stripe → **Developers** → **Webhooks** → click your endpoint.

- **No events listed?** The URL is wrong. It must be your live domain plus
  `/api/stripe/webhook`.
- **Events showing red or "failed"?** Click one and read the response.
  - Says *"signature verification failed"* → `STRIPE_WEBHOOK_SECRET` in Vercel
    doesn't match. Copy it again and redeploy.
  - Says *"Stripe is not configured"* → `STRIPE_SECRET_KEY` is missing.

To fix the affected member right now: go to **Pricing** → **Give access
manually**, enter their email, pick what they bought. Then fix the webhook so it
doesn't happen again.

### I can't see the creator console

You're signed in as a member, not the owner. Sign out and sign in with the email
you used for the *very first* signup on the site.

### I'm not the owner — someone else signed up first

Only the first account becomes the owner, so you'll need to promote yourself
directly in the database. It's two lines.

1. Open <https://console.neon.tech>, choose your project, click **SQL Editor**.
2. Paste this, with your own email, and click **Run**:

   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
   ```

3. On your site, **sign out and sign back in.** Your old login was issued before
   the change and doesn't know you're an owner yet.

While you're there, you may want to demote whoever signed up first:

```sql
UPDATE "User" SET role = 'MEMBER' WHERE email = 'them@example.com';
```

### The pricing page is empty

Plans are created automatically on the first signup. If the page is empty,
nobody has signed up yet — do [Step 6](#step-6-make-yourself-the-owner).

If you've signed up and it's still empty, someone deleted the plans. Go to
**Pricing** in the sidebar and check whether they're marked **Hidden** rather
than missing.

### Checkout says "No Stripe price is configured"

That plan is missing its price ID. **Pricing** → expand the plan → paste the
`price_...` ID from Stripe → **Save plan**.

### My domain isn't working

DNS is usually just slow — give it a few hours. If it's been a day, check the
records at your registrar match Vercel's exactly, including the `Name` column
(`@` and `www` are not interchangeable).

### Changes to content aren't showing

Check the item is **Published**, not a draft. Then hard-refresh: `Ctrl+Shift+R`
on Windows, `Cmd+Shift+R` on Mac.

---

## Things worth knowing

**You cannot break it by clicking around.** Deleting asks for confirmation and
tells you what else goes with it. Everything else is editable.

**Changing a price doesn't change what existing members pay.** They keep the
price they signed up at until they switch plans themselves.

**Cancelled members keep access until the end of the period they paid for.**
That's deliberate — it's fair, and it makes people more willing to subscribe.

**A failed card doesn't lock someone out immediately.** They keep access while
Stripe retries. Locking people out on the first failed payment turns a
recoverable card problem into a lost customer. You'll see them under **Payment
failures** on the Revenue page — those are worth chasing personally.

**Never run the demo-data command on your live site.** Anything described as
"seed" wipes everything and inserts fake data. The app refuses to do this in
production, but don't test that.

---

## Getting help

When you ask someone for help, give them:

1. What you were doing when it broke
2. The exact error text (a screenshot is fine)
3. Which step of this guide you were on

**Never send anyone** your `DATABASE_URL`, `SESSION_SECRET`, or any Stripe key.
Nobody legitimate needs them.

If you're comfortable in a terminal, or you're handing this to a developer,
[DEPLOYMENT-TECHNICAL.md](DEPLOYMENT-TECHNICAL.md) covers the same ground plus
Docker and self-hosting.
