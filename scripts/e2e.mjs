/**
 * End-to-end smoke suite.
 *
 * Drives a real browser through the flows that matter commercially:
 * attribution, signup, paywalls, checkout, coaching, community and the
 * creator console. Run against a built app:
 *
 *   npm run build && npm run start &
 *   npm run e2e
 *
 * Requires a Chromium binary. Set CHROMIUM_PATH if it is not on the default
 * Playwright path.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || ".";
const CHROMIUM =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

try {
  // 1. Tracked link click -> attribution + redirect
  const resp = await page.goto(`${BASE}/go/ig-bio?fbclid=TESTCLICK123`, { waitUntil: "networkidle" });
  check("tracked link redirects to destination", page.url().includes("/pricing"), page.url());
  const cookies = await ctx.cookies();
  check("attribution cookie set by /go", cookies.some((c) => c.name === "mf_attr"));
  check("visitor cookie set by /go", cookies.some((c) => c.name === "mf_vid"));

  // 2. Signup a brand new member (should inherit attribution)
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', "E2E Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  check("signup lands on dashboard", page.url().includes("/dashboard"));
  check("dashboard greets new member", (await page.locator("main").innerText()).includes("E2E"));

  // 3. Free member sees locked content
  await page.goto(`${BASE}/programs`, { waitUntil: "networkidle" });
  const programsHtml = await page.locator("main").innerText();
  check("programs page lists programs", programsHtml.includes("Foundation Strength"));
  check("free tier shows locked programs", programsHtml.includes("Unlock with"));
  await page.screenshot({ path: `${OUT}/shot-programs-free.png`, fullPage: false });

  // 4. Free preview workout is playable
  await page.goto(`${BASE}/programs/home-minimal-kit`, { waitUntil: "networkidle" });
  const workoutHrefs = await page
    .locator('a[href*="/programs/home-minimal-kit/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  await page.goto(`${BASE}${workoutHrefs[0]}`, { waitUntil: "networkidle" });
  check("free program workout opens a player", (await page.locator("video").count()) > 0);

  // 5. Locked elite program blocks playback
  await page.goto(`${BASE}/programs/elite-peaking`, { waitUntil: "networkidle" });
  check(
    "elite program is gated for free member",
    (await page.locator("main").innerText()).includes("needs the Elite plan"),
  );

  // 6. Knowledge base search
  await page.goto(`${BASE}/knowledge?q=protein`, { waitUntil: "networkidle" });
  check("knowledge search finds article", (await page.locator("main").innerText()).includes("protein target"));

  // 7. Nutrition calculator renders and computes
  await page.goto(`${BASE}/nutrition`, { waitUntil: "networkidle" });
  const calcText = await page.locator("text=kcal/day").first().textContent();
  check("macro calculator computes a target", Boolean(calcText));
  await page.screenshot({ path: `${OUT}/shot-nutrition.png`, fullPage: false });

  // 8. Exchange: reading free, posting gated
  await page.goto(`${BASE}/exchange`, { waitUntil: "networkidle" });
  check("exchange lists threads", (await page.locator("main").innerText()).includes("Down 8kg"));
  await page.goto(`${BASE}/exchange/new`, { waitUntil: "networkidle" });
  check("posting gated for free members", (await page.locator("main").innerText()).includes("Posting is for members"));

  // 9. Upgrade via demo checkout
  await page.goto(`${BASE}/account/billing`, { waitUntil: "networkidle" });
  check("billing shows demo-mode warning", (await page.locator("main").innerText()).includes("demo mode"));
  await page.locator('form:has(input[value="elite"]) button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  const billingHtml = await page.locator("main").innerText();
  check("demo checkout activates plan", billingHtml.includes("activated locally"));
  await page.screenshot({ path: `${OUT}/shot-billing.png`, fullPage: false });

  // 10. Elite content now unlocked
  await page.goto(`${BASE}/programs/elite-peaking`, { waitUntil: "networkidle" });
  const eliteAfter = await page.locator("main").innerText();
  check(
    "elite program unlocked after upgrade",
    !eliteAfter.includes("needs the Elite plan") && eliteAfter.includes("Squat peak"),
  );

  // 11. Coaching booking with a credit
  await page.goto(`${BASE}/coaching`, { waitUntil: "networkidle" });
  const coachingHtml = await page.locator("main").innerText();
  check("coaching shows available slots", coachingHtml.includes("Open slots"));
  await page.locator('label:has(input[name="slotId"])').first().click();
  await page.fill('input[name="agenda"]', "E2E agenda check");
  await page.locator('button[type="submit"]:has-text("Book this slot")').click();
  await page.waitForURL("**/coaching/room/**", { timeout: 20000 });
  check("booking creates a classroom", page.url().includes("/coaching/room/"));

  // 12. Classroom chat posts a message
  await page.fill('input[name="body"]', "Hello from the e2e test");
  await page.locator('button[type="submit"]:has-text("Send")').click();
  await page.waitForTimeout(2500);
  check("classroom message persists", (await page.locator("main").innerText()).includes("Hello from the e2e test"));
  await page.screenshot({ path: `${OUT}/shot-classroom.png`, fullPage: false });

  // 13. Exchange posting now allowed
  await page.goto(`${BASE}/exchange/new`, { waitUntil: "networkidle" });
  await page.fill('input[name="title"]', "E2E thread about squat depth");
  await page.fill('textarea[name="body"]', "This thread was created by the automated end-to-end test to verify posting works for paid members.");
  await page.locator('form:has(textarea[name="body"]) button[type="submit"]').click();
  await page.waitForURL((u) => /\/exchange\/e2e-thread/.test(u.pathname), { timeout: 20000 });
  const threadText = await page.locator("main").innerText();
  check(
    "paid member can post a thread",
    threadText.includes("E2E thread about squat depth"),
    page.url(),
  );

  // 14. Video progress API rejects unentitled writes
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const progressStatus = await page.evaluate(async () => {
    const r = await fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workoutId: "does-not-exist", secondsWatched: 10, completed: true }),
    });
    return r.status;
  });
  check("progress API 404s unknown workout", progressStatus === 404, `status ${progressStatus}`);

  // 15. Admin console is hidden from members
  const adminStatus = await page.evaluate(async () => (await fetch("/admin")).status);
  check("admin console 404s for non-admin", adminStatus === 404, `status ${adminStatus}`);

  // 16. Admin login sees revenue console with attribution
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "admin@manlet.fit");
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const adminHtml = await page.locator("main").innerText();
  check("admin revenue console renders", adminHtml.includes("MRR"));
  check("channel attribution table populated", adminHtml.includes("INSTAGRAM") && adminHtml.includes("TIKTOK"));
  await page.screenshot({ path: `${OUT}/shot-admin-revenue.png`, fullPage: false });

  await page.goto(`${BASE}/admin/growth`, { waitUntil: "networkidle" });
  const growthHtml = await page.locator("main").innerText();
  check("growth console shows tracked links", growthHtml.includes("/go/ig-bio"));
  check("integration status reported", growthHtml.includes("not configured"));
  await page.screenshot({ path: `${OUT}/shot-admin-growth.png`, fullPage: false });

  // 17. Branding: rename, recolour, and set a domain
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  check("branding page renders", (await page.locator("main").innerText()).includes("Branding & domain"));

  await page.fill('input[name="brandName"]', "Ironworks Club");
  await page.fill('input[name="monogram"]', "IW");
  await page.fill('input[name="accentColor"]', "#1d4ed8"); // dark accent on purpose
  await page.fill('input[name="canonicalUrl"]', "train.ironworks.test");
  await page.locator('form:has(input[name="brandName"]) button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check(
    "branding saves",
    (await page.locator("main").innerText()).includes("Branding saved"),
  );

  // Brand name propagates into the shell and the document title
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("brand name applied in app shell", (await page.locator("body").innerText()).includes("Ironworks Club"));
  check("brand name applied to page title", (await page.title()).includes("Ironworks Club"));

  // Saving with the optional domain left blank must not be blocked
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await page.fill('input[name="canonicalUrl"]', "");
  await page.fill('input[name="brandName"]', "Ironworks Club");
  await page.locator('form:has(input[name="brandName"]) button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check(
    "branding saves with blank domain",
    (await page.locator("main").innerText()).includes("Branding saved"),
  );
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("brand name reaches the landing page title", (await page.title()).includes("Ironworks Club"));

  // Restore the domain for the checks below
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await page.fill('input[name="canonicalUrl"]', "train.ironworks.test");
  await page.fill('input[name="accentColor"]', "#1d4ed8");
  await page.locator('form:has(input[name="brandName"]) button[type="submit"]').click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

  // A dark accent must flip the on-accent text to white, or buttons go unreadable
  const accentFg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-accent-fg").trim(),
  );
  check("dark accent gets light foreground", accentFg === "#ffffff", accentFg);

  const accentBase = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-volt-500").trim(),
  );
  check("accent colour applied", accentBase === "#1d4ed8", accentBase);

  // The saved domain is what tracked links are shared as
  await page.goto(`${BASE}/admin/growth`, { waitUntil: "networkidle" });
  check(
    "tracked links use the configured domain",
    (await page.locator("main").innerText()).includes("https://train.ironworks.test/go/"),
  );

  // An unparseable domain is rejected rather than silently stored
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await page.fill('input[name="canonicalUrl"]', "not a domain!!");
  await page.locator('form:has(input[name="brandName"]) button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check(
    "invalid domain rejected",
    (await page.locator("main").innerText()).includes("is not a valid domain"),
  );

  // 18. Reset branding so the run is idempotent
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await page.locator('form:has(button:has-text("Reset to defaults")) button[type="submit"]').click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("branding reset restores defaults", (await page.locator("body").innerText()).includes("Manlet Fitness"));

  // 19. Wrong password rejected
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "admin@manlet.fit");
  await page.fill('input[name="password"]', "wrongpassword");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  check("bad password rejected", (await page.locator("main").innerText()).includes("did not work"));
  // 19b. Content CMS: create real content through the admin UI, confirm members
  // see it, then delete it so the run is repeatable.
  page.on("dialog", (d) => void d.accept()); // DangerForm uses window.confirm

  // The bad-password check above cleared the session, so sign back in.
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "admin@manlet.fit");
  await page.fill('input[name="password"]', "password123");
  await page.click('form button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });

  await page.goto(`${BASE}/admin/content`, { waitUntil: "domcontentloaded" });
  check("content hub renders", (await page.locator("main").innerText()).includes("Training programs"));

  await page.goto(`${BASE}/admin/content/programs/new`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="title"]', "E2E CMS Program");
  await page.fill('textarea[name="description"]', "Created by the end-to-end test to prove the CMS writes real content.");
  await page.selectOption('select[name="minTier"]', "0");
  await page.check('input[name="isPublished"]');
  await page.locator('form:has(input[name="title"]) button[type="submit"]').click();
  await page.waitForURL(/\/admin\/content\/programs\/(?!new)/, { timeout: 20000 });
  const programEditorUrl = page.url();
  check("program created via CMS", /\/admin\/content\/programs\/c/.test(programEditorUrl));

  const addSession = page.locator('div:has(> h3:text("Add a session")) form');
  await addSession.locator('input[name="title"]').fill("E2E CMS Session");
  await addSession.locator('input[name="durationSec"]').fill("600");
  await addSession.locator('input[name="videoUrl"]').fill("https://example.com/v.mp4");
  await addSession.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check("session added to program", (await page.locator("main").innerText()).includes("E2E CMS Session"));

  await page.goto(`${BASE}/programs`, { waitUntil: "domcontentloaded" });
  check("CMS program visible to members", (await page.locator("main").innerText()).includes("E2E CMS Program"));

  // Unpublishing must actually hide it
  await page.goto(`${BASE}/admin/content/programs`, { waitUntil: "domcontentloaded" });
  const cmsRow = page.locator('div.card:has-text("E2E CMS Program")').first();
  await cmsRow.locator('form button:text("Live")').click();
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/programs`, { waitUntil: "domcontentloaded" });
  check(
    "unpublished program hidden from members",
    !(await page.locator("main").innerText()).includes("E2E CMS Program"),
  );

  // Validation must refuse bad input rather than saving junk
  await page.goto(`${BASE}/admin/content/articles/new`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="title"]', "x");
  await page.fill('textarea[name="excerpt"]', "too short");
  await page.fill('textarea[name="body"]', "tiny");
  await page.locator('form:has(input[name="title"]) button[type="submit"]').click();
  await page.waitForTimeout(2000);
  check(
    "CMS validation rejects bad input",
    (await page.locator("main").innerText()).includes("Give the article a title.") &&
      page.url().endsWith("/new"),
  );

  // Clean up
  await page.goto(programEditorUrl, { waitUntil: "domcontentloaded" });
  await page.locator('form:has(button:text("Delete program")) button[type="submit"]').click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/admin/content/programs`, { waitUntil: "domcontentloaded" });
  check(
    "CMS content deletes cleanly",
    !(await page.locator("main").innerText()).includes("E2E CMS Program"),
  );

  // 19c. Pricing & products: change a price, create a product, grant access.
  await page.goto(`${BASE}/admin/pricing`, { waitUntil: "domcontentloaded" });
  check("pricing admin renders", (await page.locator("main").innerText()).includes("Subscription plans"));

  const corePlan = page.locator('details:has-text("Core")').first();
  await corePlan.locator("summary").click();
  await corePlan.locator('input[name="priceMonthly"]').fill("39.00");
  await corePlan.locator('form button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check("plan price saved", (await page.locator("main").innerText()).includes("Plan saved"));

  await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
  check(
    "price change is live on the public pricing page",
    (await page.locator("body").innerText()).includes("$39"),
  );

  // The free tier must stay free — it is the fallback for everyone unsubscribed
  await page.goto(`${BASE}/admin/pricing`, { waitUntil: "domcontentloaded" });
  const freePlan = page.locator('details:has-text("Free")').first();
  await freePlan.locator("summary").click();
  await freePlan.locator('input[name="priceMonthly"]').fill("10.00");
  await freePlan.locator('form button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check(
    "free plan refuses a price",
    (await page.locator("main").innerText()).includes("must stay at zero"),
  );

  // Restore, so a repeat run starts from the seeded price
  await page.goto(`${BASE}/admin/pricing`, { waitUntil: "domcontentloaded" });
  const coreAgain = page.locator('details:has-text("Core")').first();
  await coreAgain.locator("summary").click();
  await coreAgain.locator('input[name="priceMonthly"]').fill("29.00");
  await coreAgain.locator('form button[type="submit"]').click();
  await page.waitForTimeout(2500);

  // A product with no item selected must not be created
  await page.goto(`${BASE}/admin/pricing`, { waitUntil: "domcontentloaded" });
  const newProduct = page.locator('div.card:has(h3:text("New product"))');
  await newProduct.locator('input[name="name"]').fill("E2E Broken Product");
  await newProduct.locator('textarea[name="description"]').fill("No item selected.");
  await newProduct.locator('input[name="price"]').fill("10.00");
  await newProduct.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check(
    "product without an item is rejected",
    (await page.locator("main").innerText()).includes("Choose which item"),
  );

  // Manual grant, then confirm the member can actually open the content
  await page.goto(`${BASE}/admin/pricing`, { waitUntil: "domcontentloaded" });
  const grantCard = page.locator('div.card:has(h3:text("Grant access"))');
  await grantCard.locator('input[name="email"]').fill("free@manlet.fit");
  await grantCard
    .locator('select[name="contentRef"]')
    .selectOption({ label: "Elite Peaking Block" });
  await grantCard.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check("manual grant applied", (await page.locator("main").innerText()).includes("now has access"));

  const grantedCtx = await browser.newContext();
  const granted = await grantedCtx.newPage();
  await granted.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await granted.fill('input[name="email"]', "free@manlet.fit");
  await granted.fill('input[name="password"]', "password123");
  await granted.click('form button[type="submit"]');
  await granted.waitForURL("**/dashboard", { timeout: 20000 });
  await granted.goto(`${BASE}/programs/elite-peaking`, { waitUntil: "domcontentloaded" });
  const grantedText = await granted.locator("main").innerText();
  check(
    "manually granted member opens Elite content on a free plan",
    !grantedText.includes("needs the Elite plan") && grantedText.includes("Squat peak"),
  );
  await grantedCtx.close();

  // 20. Per-item access: buying one program unlocks exactly that program.
  // Runs in a fresh context so this member is on the free plan throughout —
  // the point is that a grant works *without* a subscription tier.
  const buyerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const buyer = await buyerCtx.newPage();
  const buyerEmail = `e2e-buyer-${Date.now()}@example.com`;
  await buyer.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await buyer.fill('input[name="name"]', "E2E Buyer");
  await buyer.fill('input[name="email"]', buyerEmail);
  await buyer.fill('input[name="password"]', "password123");
  await buyer.click('form button[type="submit"]');
  await buyer.waitForURL("**/dashboard", { timeout: 20000 });

  await buyer.goto(`${BASE}/programs/elite-peaking`, { waitUntil: "networkidle" });
  check(
    "elite program locked before purchase",
    (await buyer.locator("main").innerText()).includes("needs the Elite plan"),
  );

  await buyer.goto(`${BASE}/supplements`, { waitUntil: "networkidle" });
  const supplementsText = await buyer.locator("main").innerText();
  check("supplement plans listed", supplementsText.includes("The short, boring list"));
  check("supplement plan gated by tier", supplementsText.includes("Unlock with"));

  await buyer.goto(`${BASE}/store`, { waitUntil: "networkidle" });
  check("store lists one-off products", (await buyer.locator("main").innerText()).includes("Elite Peaking Block"));
  await buyer.locator('form:has(input[name="productId"]) button[type="submit"]').first().click();
  await buyer.waitForTimeout(3000);
  check("one-off purchase completes", (await buyer.locator("main").innerText()).includes("Unlocked"));

  await buyer.goto(`${BASE}/programs/elite-peaking`, { waitUntil: "networkidle" });
  const boughtText = await buyer.locator("main").innerText();
  check(
    "purchased program opens without a subscription",
    !boughtText.includes("needs the Elite plan") && boughtText.includes("Squat peak"),
  );

  const boughtHref = await buyer
    .locator('a[href*="/programs/elite-peaking/"]')
    .first()
    .getAttribute("href");
  await buyer.goto(`${BASE}${boughtHref}`, { waitUntil: "networkidle" });
  check("purchased program's video plays", (await buyer.locator("video").count()) > 0);

  await buyer.goto(`${BASE}/programs`, { waitUntil: "networkidle" });
  check("programs list marks it Purchased", (await buyer.locator("main").innerText()).includes("Purchased"));

  // The grant must be scoped to what was bought, not a blanket tier upgrade.
  await buyer.goto(`${BASE}/knowledge/autoregulation`, { waitUntil: "networkidle" });
  check(
    "unrelated Elite content stays locked",
    (await buyer.locator("main").innerText()).includes("for Elite members"),
  );
  await buyerCtx.close();
} catch (error) {
  check("run completed without exception", false, String(error).slice(0, 300));
} finally {
  console.log("\n--- console/page errors ---");
  console.log(errors.length ? errors.slice(0, 10).join("\n") : "(none)");
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(`${OUT}/e2e-results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}
