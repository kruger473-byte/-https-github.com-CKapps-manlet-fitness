import { PrismaClient, type Platform } from "@prisma/client";
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

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);

async function main() {
  // This seed is DESTRUCTIVE — it wipes every table before inserting demo data.
  // Refuse to run against a production database unless explicitly forced, so a
  // stray `npm run db:seed` on a deploy host cannot delete real members.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "yes") {
    console.error(
      "Refusing to seed: NODE_ENV=production and this script deletes all data.\n" +
        "Use `npm run bootstrap` to set up a production instance non-destructively.\n" +
        "If you really mean it, set ALLOW_DESTRUCTIVE_SEED=yes.",
    );
    process.exit(1);
  }

  console.log("Seeding Manlet Fitness...");

  // --- wipe (child rows first) ---------------------------------------------
  await db.$transaction([
    db.click.deleteMany(),
    db.trackedLink.deleteMany(),
    db.contentPost.deleteMany(),
    db.conversionEvent.deleteMany(),
    db.classroomMessage.deleteMany(),
    db.coachingSession.deleteMany(),
    db.availabilitySlot.deleteMany(),
    db.coachProfile.deleteMany(),
    db.reaction.deleteMany(),
    db.post.deleteMany(),
    db.thread.deleteMany(),
    db.article.deleteMany(),
    db.meal.deleteMany(),
    db.dietPlan.deleteMany(),
    db.progress.deleteMany(),
    db.workout.deleteMany(),
    db.program.deleteMany(),
    db.videoAsset.deleteMany(),
    db.payment.deleteMany(),
    db.subscription.deleteMany(),
    db.oAuthAccount.deleteMany(),
    db.category.deleteMany(),
    db.user.deleteMany(),
    db.channel.deleteMany(),
    db.plan.deleteMany(),
    db.webhookEvent.deleteMany(),
    db.siteSettings.deleteMany(),
  ]);

  // --- site settings --------------------------------------------------------
  // Seeded explicitly so the branding page has a row to edit from the start.
  await db.siteSettings.create({
    data: {
      id: "singleton",
      brandName: "Manlet Fitness",
      monogram: "MF",
      tagline: "Training, nutrition and coaching that stays yours",
      accentColor: "#c8f31d",
      supportEmail: "help@manlet.fit",
    },
  });

  // --- plans ----------------------------------------------------------------
  const [free, core, elite] = await Promise.all([
    db.plan.create({
      data: {
        key: "free",
        name: "Free",
        tagline: "Taste the method. No card.",
        tier: 0,
        priceMonthlyCents: 0,
        priceYearlyCents: 0,
        trialDays: 0,
        sortOrder: 0,
        features: JSON.stringify([
          "3 full workout sessions",
          "Knowledge base essentials",
          "Read the community",
        ]),
      },
    }),
    db.plan.create({
      data: {
        key: "core",
        name: "Core",
        tagline: "The full training system.",
        tier: 1,
        priceMonthlyCents: 2900,
        priceYearlyCents: 29000,
        trialDays: 7,
        sortOrder: 1,
        features: JSON.stringify([
          "Every program and workout video",
          "All structured diet plans",
          "Full knowledge base",
          "Post in the member exchange",
          "Progress tracking",
        ]),
      },
    }),
    db.plan.create({
      data: {
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
        features: JSON.stringify([
          "Everything in Core",
          "2 x 1-1 coaching calls each month",
          "Private classroom with your coach",
          "Form review with written feedback",
          "Plan built around your numbers",
        ]),
      },
    }),
  ]);

  // --- channels -------------------------------------------------------------
  const channelSpecs: Array<{ platform: Platform; handle: string; display: string }> = [
    { platform: "INSTAGRAM", handle: "@manlet.fitness", display: "Instagram — main" },
    { platform: "TIKTOK", handle: "@manletfitness", display: "TikTok — clips" },
    { platform: "GOOGLE", handle: "search-brand", display: "Google Ads — brand" },
    { platform: "YOUTUBE", handle: "@manletfitness", display: "YouTube — long form" },
  ];
  const channels = await Promise.all(
    channelSpecs.map((c) =>
      db.channel.create({
        data: {
          platform: c.platform,
          handle: c.handle,
          displayName: c.display,
          isConnected: false,
        },
      }),
    ),
  );
  const [ig, tiktok, google, youtube] = channels;

  // --- users ----------------------------------------------------------------
  const pw = await hash("password123");

  const admin = await db.user.create({
    data: {
      email: "admin@manlet.fit",
      passwordHash: pw,
      name: "Chris K",
      role: "ADMIN",
      bio: "Founder. Built this so the revenue stays here.",
      timezone: "Europe/Copenhagen",
    },
  });

  const coachUser = await db.user.create({
    data: {
      email: "coach@manlet.fit",
      passwordHash: pw,
      name: "Dana Reyes",
      role: "COACH",
      bio: "S&C coach, 11 years. Strength and body recomposition.",
      timezone: "America/New_York",
    },
  });

  const coach = await db.coachProfile.create({
    data: {
      userId: coachUser.id,
      headline: "Strength & recomposition coach",
      bio: "I coach lifters who are past the beginner phase and stuck. We fix execution, then we fix the plan.",
      specialties: JSON.stringify(["Strength", "Recomposition", "Injury-aware programming"]),
      rateCents: 9000,
    },
  });

  const memberSpecs = [
    { email: "sam@example.com", name: "Sam Ortiz", channel: ig, plan: elite, days: 84 },
    { email: "jules@example.com", name: "Jules Fenwick", channel: tiktok, plan: core, days: 61 },
    { email: "robin@example.com", name: "Robin Achebe", channel: ig, plan: core, days: 45 },
    { email: "morgan@example.com", name: "Morgan Li", channel: google, plan: core, days: 30 },
    { email: "alex@example.com", name: "Alex Dubois", channel: youtube, plan: elite, days: 21 },
    { email: "kai@example.com", name: "Kai Nakamura", channel: tiktok, plan: core, days: 12 },
    { email: "free@manlet.fit", name: "Taylor Brooks", channel: null, plan: null, days: 4 },
  ];

  const members = [];
  for (const spec of memberSpecs) {
    const user = await db.user.create({
      data: {
        email: spec.email,
        passwordHash: pw,
        name: spec.name,
        role: "MEMBER",
        createdAt: daysAgo(spec.days),
        goal: spec.plan === elite ? "Build strength" : "Lose fat, keep muscle",
        experienceLevel: "intermediate",
        attributedChannelId: spec.channel?.id ?? null,
        attributionSource: spec.channel?.platform.toLowerCase() ?? null,
        attributionMedium: spec.channel ? "organic_social" : null,
        attributionCampaign: spec.channel ? "evergreen-bio-link" : null,
      },
    });
    members.push(user);

    if (spec.plan) {
      const interval = spec.days > 60 ? "year" : "month";
      const priceCents =
        interval === "year" ? spec.plan.priceYearlyCents : spec.plan.priceMonthlyCents;

      await db.subscription.create({
        data: {
          userId: user.id,
          planId: spec.plan.id,
          status: spec.days < 7 ? "TRIALING" : "ACTIVE",
          interval,
          currentPeriodStart: daysAgo(spec.days % 30),
          currentPeriodEnd: daysAhead(interval === "year" ? 300 : 30 - (spec.days % 30)),
          coachingCreditsLeft: spec.plan.coachingCreditsPerMonth,
        },
      });

      await db.payment.create({
        data: {
          userId: user.id,
          amountCents: priceCents,
          status: "succeeded",
          kind: "subscription",
          description: `${spec.plan.name} (${interval}ly)`,
          createdAt: daysAgo(spec.days),
        },
      });

      await db.conversionEvent.create({
        data: {
          type: "SUBSCRIBE",
          userId: user.id,
          channelId: spec.channel?.id ?? null,
          valueCents: priceCents,
          campaign: "evergreen-bio-link",
          dedupeKey: `SUBSCRIBE:${user.id}:seed`,
          occurredAt: daysAgo(spec.days),
        },
      });
    }
  }

  // --- video assets + programs ---------------------------------------------
  const SAMPLE_VIDEO =
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

  async function makeAsset(durationSec: number) {
    return db.videoAsset.create({
      data: { provider: "local", sourceUrl: SAMPLE_VIDEO, durationSec, status: "ready" },
    });
  }

  const programSpecs = [
    {
      slug: "foundation-strength",
      title: "Foundation Strength",
      subtitle: "8 weeks to a real base",
      description:
        "Squat, hinge, press, pull. Three sessions a week with a progression you can actually follow while working a full-time job.",
      level: "beginner",
      category: "strength",
      weeks: 8,
      minTier: 1,
      workouts: [
        "Week 1 — Squat pattern & bracing",
        "Week 1 — Hinge & row",
        "Week 1 — Press & carry",
        "Week 2 — Squat volume",
        "Week 2 — Deadlift technique",
        "Week 2 — Upper body push/pull",
      ],
    },
    {
      slug: "lean-recomp-12",
      title: "Lean Recomp 12",
      subtitle: "Lose fat without losing the lifts",
      description:
        "Twelve weeks pairing a moderate deficit with enough hard training to hold onto muscle. Built for people who have dieted badly before.",
      level: "intermediate",
      category: "recomp",
      weeks: 12,
      minTier: 1,
      workouts: [
        "Full body A — Heavy",
        "Full body B — Volume",
        "Conditioning — Zone 2 base",
        "Full body C — Density",
      ],
    },
    {
      slug: "home-minimal-kit",
      title: "Home, Minimal Kit",
      subtitle: "One pair of dumbbells, no excuses",
      description:
        "Four weeks of full training with a single pair of adjustable dumbbells and a floor. Designed for travel and small flats.",
      level: "beginner",
      category: "home",
      weeks: 4,
      minTier: 0,
      workouts: ["Push day", "Pull day", "Legs & core"],
    },
    {
      slug: "elite-peaking",
      title: "Elite Peaking Block",
      subtitle: "Six weeks to a tested max",
      description:
        "A peaking block for lifters with a real base. Heavy singles, tight autoregulation, and a taper into a test day.",
      level: "advanced",
      category: "strength",
      weeks: 6,
      minTier: 2,
      workouts: ["Squat peak — wave 1", "Bench peak — wave 1", "Deadlift peak — wave 1"],
    },
  ];

  for (const [pi, spec] of programSpecs.entries()) {
    const program = await db.program.create({
      data: {
        slug: spec.slug,
        title: spec.title,
        subtitle: spec.subtitle,
        description: spec.description,
        level: spec.level,
        category: spec.category,
        weeks: spec.weeks,
        minTier: spec.minTier,
        sortOrder: pi,
      },
    });

    for (const [wi, title] of spec.workouts.entries()) {
      const durationSec = 1500 + wi * 180;
      const asset = await makeAsset(durationSec);
      await db.workout.create({
        data: {
          programId: program.id,
          title,
          description:
            "Full session with coaching cues, warm-up, working sets and a cool-down.",
          weekNumber: Math.floor(wi / 3) + 1,
          dayNumber: (wi % 3) + 1,
          sortOrder: wi,
          durationSec,
          equipment: JSON.stringify(
            spec.category === "home" ? ["Dumbbells"] : ["Barbell", "Rack", "Bench"],
          ),
          videoAssetId: asset.id,
          isFreePreview: wi === 0,
        },
      });
    }
  }

  // --- diet plans -----------------------------------------------------------
  const dietSpecs = [
    {
      slug: "cut-2200",
      title: "The 2,200 Cut",
      description:
        "A moderate deficit built around high protein and enough carbs to keep training quality up. Seven repeatable days.",
      goal: "cut",
      kcal: 2200,
      p: 190,
      c: 200,
      f: 65,
      minTier: 1,
    },
    {
      slug: "lean-bulk-3000",
      title: "Lean Bulk 3,000",
      description:
        "A controlled surplus for people who gain fat easily. Protein stays fixed; carbs carry the increase around training.",
      goal: "bulk",
      kcal: 3000,
      p: 200,
      c: 340,
      f: 85,
      minTier: 1,
    },
    {
      slug: "maintenance-simple",
      title: "Simple Maintenance",
      description:
        "Five meals, minimal cooking, no weighing. A starting point if you have never tracked anything.",
      goal: "maintain",
      kcal: 2500,
      p: 170,
      c: 260,
      f: 80,
      minTier: 0,
    },
  ];

  const MEALS = [
    { slot: "breakfast", title: "Greek yoghurt, oats, berries", kcal: 480, p: 40, c: 55, f: 12 },
    { slot: "lunch", title: "Chicken, rice, roasted veg", kcal: 620, p: 55, c: 70, f: 14 },
    { slot: "snack", title: "Whey shake & apple", kcal: 280, p: 28, c: 32, f: 3 },
    { slot: "dinner", title: "Salmon, potatoes, greens", kcal: 700, p: 48, c: 60, f: 28 },
  ];

  for (const d of dietSpecs) {
    const plan = await db.dietPlan.create({
      data: {
        slug: d.slug,
        title: d.title,
        description: d.description,
        goal: d.goal,
        kcalTarget: d.kcal,
        proteinG: d.p,
        carbsG: d.c,
        fatG: d.f,
        minTier: d.minTier,
        durationDays: 7,
      },
    });

    for (let day = 1; day <= 7; day++) {
      for (const [mi, m] of MEALS.entries()) {
        await db.meal.create({
          data: {
            dietPlanId: plan.id,
            dayNumber: day,
            slot: m.slot,
            title: m.title,
            ingredients: JSON.stringify([
              "See the shopping list for exact quantities",
            ]),
            method: "Prep in batches; this repeats across the week on purpose.",
            kcal: m.kcal,
            proteinG: m.p,
            carbsG: m.c,
            fatG: m.f,
            sortOrder: mi,
          },
        });
      }
    }
  }

  // --- knowledge base -------------------------------------------------------
  const categories = await Promise.all(
    [
      { slug: "training", name: "Training", blurb: "Programming, technique, recovery." },
      { slug: "nutrition", name: "Nutrition", blurb: "Calories, protein, and real life." },
      { slug: "mindset", name: "Mindset", blurb: "Adherence beats optimisation." },
      { slug: "getting-started", name: "Getting started", blurb: "Read these first." },
    ].map((c, i) => db.category.create({ data: { ...c, sortOrder: i } })),
  );

  const articles = [
    {
      slug: "how-many-sets",
      title: "How many sets you actually need",
      cat: 0,
      tier: 0,
      excerpt:
        "More is not better past a point. Here is how to find your own working range.",
      body: `Most people either do far too little hard work or bury themselves in junk volume.\n\n## The range that matters\n\nFor a given muscle, somewhere between 10 and 20 hard sets a week covers nearly everyone. Below 10 you are usually leaving growth on the table. Above 20 the returns flatten and recovery starts to cost you.\n\n## How to find yours\n\nStart at 12 sets a week. Hold it for three weeks. If performance is climbing and you are not beaten up, add two sets. Repeat until progress stalls or recovery suffers, then step back one notch. That number is your range for this phase.\n\n## Why "hard" is doing the work in that sentence\n\nA set taken to five reps in reserve is barely a stimulus. Count a set only if you finished within about three reps of failure.`,
    },
    {
      slug: "protein-target",
      title: "Setting a protein target you will hit",
      cat: 1,
      tier: 0,
      excerpt: "The number is less important than whether you can repeat it daily.",
      body: `Around 1.6g of protein per kg of bodyweight per day covers the evidence for muscle retention and growth. Going much higher has small returns.\n\n## Make it repeatable\n\nDivide the target across the meals you already eat. If you eat four times a day and need 160g, that is 40g a meal. Now the question is not "how much protein should I eat" but "does this meal have 40g in it".\n\n## When dieting\n\nIn a deficit, protein does more work: it protects lean mass and it keeps you full. This is the one number worth defending when calories come down.`,
    },
    {
      slug: "first-90-days",
      title: "Your first 90 days here",
      cat: 3,
      tier: 0,
      excerpt: "What to do in week one, and what to deliberately ignore.",
      body: `## Week 1\n\nPick one program and one diet plan. Do not read everything. Do the first three sessions exactly as written, even if they feel easy — they are calibration.\n\n## Weeks 2-4\n\nStart logging. Weight on the same day each week, sessions as you finish them. You are building a baseline, not chasing a number.\n\n## Weeks 5-12\n\nNow the data means something. This is where a coaching call is worth booking, because you will have real numbers to look at instead of guesses.`,
    },
    {
      slug: "training-through-soreness",
      title: "Training through soreness (and when not to)",
      cat: 0,
      tier: 1,
      excerpt: "Soreness is a poor signal. Here are the ones worth listening to.",
      body: `Muscle soreness tells you a movement was novel or eccentric-heavy. It does not tell you whether the session worked.\n\n## Signals worth respecting\n\n- Sharp, localised joint pain\n- Strength down more than 10% across a whole session\n- Sleep quality falling for several nights running\n\n## Signals to ignore\n\n- General soreness two days after a new exercise\n- Feeling unmotivated before a session you have done many times\n\nWhen in doubt, warm up and do the first working set. Decide after that set, not before it.`,
    },
    {
      slug: "diet-breaks",
      title: "Diet breaks: what they fix and what they don't",
      cat: 1,
      tier: 1,
      excerpt: "A structured break helps adherence more than metabolism.",
      body: `A one-to-two week return to maintenance calories during a long diet is a useful tool. The mechanism is mostly psychological and behavioural.\n\n## What it does\n\nRestores training quality, gives you a break from constant restriction, and makes the next block of dieting more likely to be executed properly.\n\n## What it doesn't\n\nIt does not "reset your metabolism". Adaptive thermogenesis is real but small, and a week at maintenance does not undo it.`,
    },
    {
      slug: "autoregulation",
      title: "Autoregulation without overthinking it",
      cat: 0,
      tier: 2,
      excerpt: "RPE, RIR and load drops — the minimum viable version.",
      body: `Autoregulation means adjusting today's work to today's readiness. You do not need a spreadsheet.\n\n## The minimum viable version\n\nProgram a top set at a target RIR. If you hit the target rep range at or above the target RIR, keep the load. If you fall short, drop the load 5% next session. That is it.\n\n## For the peaking block\n\nDuring a peak, cap total hard sets and let intensity float. The goal is expression of strength, not accumulation of fatigue.`,
    },
  ];

  for (const a of articles) {
    await db.article.create({
      data: {
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        categoryId: categories[a.cat].id,
        minTier: a.tier,
        readMinutes: 3 + (a.body.length % 5),
        viewCount: 40 + a.body.length % 300,
      },
    });
  }

  // --- coaching -------------------------------------------------------------
  for (let i = 1; i <= 10; i++) {
    const start = daysAhead(i);
    start.setHours(9 + (i % 6), 0, 0, 0);
    const end = new Date(start.getTime() + 45 * 60 * 1000);
    await db.availabilitySlot.create({
      data: { coachId: coach.id, startsAt: start, endsAt: end },
    });
  }

  const bookedSlot = await db.availabilitySlot.findFirst({
    where: { coachId: coach.id },
    orderBy: { startsAt: "asc" },
  });
  if (bookedSlot) {
    await db.availabilitySlot.update({
      where: { id: bookedSlot.id },
      data: { isBooked: true },
    });
    const session = await db.coachingSession.create({
      data: {
        coachId: coach.id,
        clientId: members[0].id,
        slotId: bookedSlot.id,
        startsAt: bookedSlot.startsAt,
        endsAt: bookedSlot.endsAt,
        roomCode: "room-" + randomBytes(4).toString("hex"),
        agenda: "Squat depth and week 5 load selection.",
        clientGoals: "Add 10kg to squat without the knee flaring up.",
        paidWithCredit: true,
      },
    });
    await db.classroomMessage.createMany({
      data: [
        {
          sessionId: session.id,
          authorId: coachUser.id,
          body: "Send me a side-on video of your working set before we meet.",
        },
        {
          sessionId: session.id,
          authorId: members[0].id,
          body: "Uploaded — it is the last set of week 4, 5 reps at 120kg.",
        },
      ],
    });
  }

  // --- exchange -------------------------------------------------------------
  const threadSpecs: Array<{
    title: string;
    body: string;
    author: number;
    cat: number;
    pinned?: boolean;
    replies: Array<{ author: number | null; body: string; coach?: boolean }>;
  }> = [
    {
      title: "Down 8kg in 11 weeks — the boring version worked",
      body: "No secret. 2,200 cut plan, three sessions a week, walked more. Posting the numbers in case it helps someone who thinks they need something clever.",
      author: 0,
      cat: 1,
      pinned: true,
      replies: [
        { author: 1, body: "The boring version always works. What did you do about weekends?" },
        { author: 0, body: "Kept the same breakfast and lunch, let dinner float. That was enough." },
      ],
    },
    {
      title: "Knee pain on the squat — anyone else?",
      body: "Sharp pain at the bottom on the left side only. Fine on leg press. Not sure whether to push through.",
      author: 2,
      cat: 0,
      replies: [
        {
          author: null,
          body: "Sharp and one-sided is worth a look from someone in person. In the meantime, box squat to a depth that is pain-free and keep training.",
          coach: true,
        },
      ],
    },
    {
      title: "Best way to hit protein without shakes?",
      body: "Shakes wreck my stomach. What are people eating instead?",
      author: 3,
      cat: 1,
      replies: [
        { author: 4, body: "Skyr, cottage cheese, and a lot of eggs. Boring but easy." },
        { author: 5, body: "Frozen prawns. 20g of protein in three minutes." },
      ],
    },
  ];

  for (const t of threadSpecs) {
    const thread = await db.thread.create({
      data: {
        slug: t.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60),
        title: t.title,
        body: t.body,
        authorId: members[t.author].id,
        categoryId: categories[t.cat].id,
        isPinned: Boolean(t.pinned),
        viewCount: 60 + t.title.length * 3,
        createdAt: daysAgo(t.author + 2),
      },
    });
    for (const r of t.replies) {
      await db.post.create({
        data: {
          threadId: thread.id,
          authorId: r.author === null ? coachUser.id : members[r.author].id,
          body: r.body,
          isCoachAnswer: Boolean(r.coach),
        },
      });
    }
  }

  // --- tracked links + clicks ----------------------------------------------
  const linkSpecs = [
    { slug: "ig-bio", channel: ig, campaign: "evergreen-bio-link", clicks: 240, dest: "/pricing" },
    { slug: "ig-reel-squat", channel: ig, campaign: "reel-squat-cues", clicks: 180, dest: "/knowledge/how-many-sets" },
    { slug: "tt-clip", channel: tiktok, campaign: "clip-protein", clicks: 320, dest: "/pricing" },
    { slug: "yt-desc", channel: youtube, campaign: "long-form-desc", clicks: 95, dest: "/programs" },
    { slug: "g-brand", channel: google, campaign: "brand-search", clicks: 60, dest: "/pricing" },
  ];

  for (const l of linkSpecs) {
    const link = await db.trackedLink.create({
      data: {
        slug: l.slug,
        destination: l.dest,
        channelId: l.channel.id,
        campaign: l.campaign,
        medium: l.channel.platform === "GOOGLE" ? "cpc" : "organic_social",
        note: `Seeded demo link for ${l.channel.displayName}`,
      },
    });
    const rows = Array.from({ length: l.clicks }, (_, i) => ({
      trackedLinkId: link.id,
      visitorId: `seed-visitor-${l.slug}-${i}`,
      clickedAt: daysAgo(Math.floor((i / l.clicks) * 60)),
      referrer: `https://${l.channel.platform.toLowerCase()}.com/`,
      userAgent: "seed",
    }));
    for (let i = 0; i < rows.length; i += 100) {
      await db.click.createMany({ data: rows.slice(i, i + 100) });
    }
  }

  // --- content posts --------------------------------------------------------
  const contentSpecs = [
    { channel: ig, caption: "3 cues that fixed my squat depth", impressions: 48000, likes: 3100, comments: 212, shares: 640 },
    { channel: ig, caption: "What 1.6g/kg of protein actually looks like", impressions: 31000, likes: 2400, comments: 180, shares: 410 },
    { channel: tiktok, caption: "Stop counting junk sets", impressions: 122000, likes: 9800, comments: 540, shares: 2100 },
    { channel: youtube, caption: "The 8-week foundation block, explained", impressions: 14000, likes: 900, comments: 130, shares: 88 },
  ];
  for (const [i, c] of contentSpecs.entries()) {
    await db.contentPost.create({
      data: {
        channelId: c.channel.id,
        caption: c.caption,
        mediaType: "VIDEO",
        publishedAt: daysAgo(i * 6 + 3),
        impressions: c.impressions,
        likes: c.likes,
        comments: c.comments,
        shares: c.shares,
      },
    });
  }

  console.log(`Seeded:
  plans      ${await db.plan.count()}
  users      ${await db.user.count()}
  programs   ${await db.program.count()}
  workouts   ${await db.workout.count()}
  dietPlans  ${await db.dietPlan.count()}
  meals      ${await db.meal.count()}
  articles   ${await db.article.count()}
  threads    ${await db.thread.count()}
  channels   ${await db.channel.count()}
  clicks     ${await db.click.count()}

  Sign in with any of:
    admin@manlet.fit / password123   (creator console)
    coach@manlet.fit / password123   (coach view)
    sam@example.com  / password123   (Elite member)
    free@manlet.fit  / password123   (free member)
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
