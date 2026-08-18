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
