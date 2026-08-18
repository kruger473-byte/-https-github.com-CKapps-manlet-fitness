import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/entitlements";
import { stripeConfigured } from "@/lib/stripe";
import { grantTargetsFor, describeTargets } from "@/lib/grants";
import { AdminBreadcrumb, EditorSection } from "@/components/admin-list";
import {
  AdminForm,
  TextField,
  TextArea,
  CheckboxField,
  DangerForm,
} from "@/components/admin-forms";
import { ProductForm, ManualGrantForm, type ContentOption } from "@/components/product-form";
import {
  savePlanAction,
  saveProductAction,
  deleteProductAction,
  toggleProductAction,
  grantAccessManuallyAction,
  revokeGrantAction,
} from "./actions";
import { PageHeader, Card, Badge, Alert, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Pricing & products" };
export const dynamic = "force-dynamic";

export default async function PricingAdminPage() {
  const [plans, products, programs, dietPlans, supplements, articles, grants] =
    await Promise.all([
      db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
      db.product.findMany({ orderBy: { sortOrder: "asc" } }),
      db.program.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true } }),
      db.dietPlan.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
      db.supplementPlan.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true },
      }),
      db.article.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
      db.accessGrant.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

  const options: ContentOption[] = [
    ...programs.map((p) => ({ ref: `PROGRAM:${p.id}`, type: "PROGRAM", label: p.title })),
    ...dietPlans.map((p) => ({ ref: `DIET_PLAN:${p.id}`, type: "DIET_PLAN", label: p.title })),
    ...supplements.map((p) => ({
      ref: `SUPPLEMENT_PLAN:${p.id}`,
      type: "SUPPLEMENT_PLAN",
      label: p.title,
    })),
    ...articles.map((p) => ({ ref: `ARTICLE:${p.id}`, type: "ARTICLE", label: p.title })),
  ];

  const productRows = await Promise.all(
    products.map(async (product) => ({
      product,
      includes: await describeTargets(grantTargetsFor(product)),
    })),
  );

  const grantLabels = await describeTargets(
    grants.map((g) => ({ contentType: g.contentType, contentId: g.contentId })),
  );

  return (
    <>
      <AdminBreadcrumb
        items={[{ label: "Creator console", href: "/admin" }, { label: "Pricing & products" }]}
      />
      <PageHeader
        title="Pricing & products"
        description="Change subscription prices, and sell any piece of content on its own. Nothing here needs a developer."
        action={
          <ButtonLink href="/admin/content" variant="secondary">
            Content
          </ButtonLink>
        }
      />

      {!stripeConfigured() ? (
        <div className="mb-6">
          <Alert tone="warning">
            Stripe isn&apos;t connected, so checkout runs in demo mode. Prices set
            here still apply — you just can&apos;t take real money yet.
          </Alert>
        </div>
      ) : null}

      {/* Subscription plans -------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold">Subscription plans</h2>
        <p className="mb-4 text-sm text-ink-400">
          Changing a price affects new subscribers only. People already paying keep
          the price they signed up at until they switch plan.
        </p>

        <div className="space-y-3">
          {plans.map((plan) => {
            const features = (JSON.parse(plan.features) as string[]).join("\n");
            const missingStripe =
              stripeConfigured() &&
              plan.priceMonthlyCents > 0 &&
              !plan.stripePriceIdMonthly;

            return (
              <details key={plan.id} className="card p-0">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{plan.name}</span>
                    <Badge tone={plan.isActive ? "success" : "neutral"}>
                      {plan.isActive ? "On sale" : "Hidden"}
                    </Badge>
                    {plan.includesCoaching ? <Badge tone="volt">Coaching</Badge> : null}
                    {missingStripe ? <Badge tone="danger">No Stripe price</Badge> : null}
                  </span>
                  <span className="text-sm tabular-nums text-ink-400">
                    {plan.priceMonthlyCents === 0
                      ? "Free"
                      : `${formatMoney(plan.priceMonthlyCents, plan.currency)}/mo · ${formatMoney(plan.priceYearlyCents, plan.currency)}/yr`}
                  </span>
                </summary>

                <div className="border-t border-ink-800 p-5">
                  {missingStripe ? (
                    <div className="mb-4">
                      <Alert tone="danger">
                        This plan has a price but no Stripe price ID, so checkout will
                        fail. Create the price in Stripe and paste its ID below.
                      </Alert>
                    </div>
                  ) : null}

                  <AdminForm
                    action={savePlanAction}
                    hiddenFields={{ id: plan.id }}
                    submitLabel="Save plan"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Name" name="name" defaultValue={plan.name} required />
                      <TextField
                        label="Tagline"
                        name="tagline"
                        defaultValue={plan.tagline}
                        required
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <TextField
                        label="Price / month"
                        name="priceMonthly"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={(plan.priceMonthlyCents / 100).toFixed(2)}
                      />
                      <TextField
                        label="Price / year"
                        name="priceYearly"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={(plan.priceYearlyCents / 100).toFixed(2)}
                      />
                      <TextField
                        label="Currency"
                        name="currency"
                        defaultValue={plan.currency}
                      />
                      <TextField
                        label="Trial days"
                        name="trialDays"
                        type="number"
                        min={0}
                        max={90}
                        defaultValue={plan.trialDays}
                      />
                    </div>
                    <TextArea
                      label="Features"
                      name="features"
                      defaultValue={features}
                      rows={5}
                      hint="One per line. These are the ticks on the pricing page."
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Stripe price ID — monthly"
                        name="stripePriceIdMonthly"
                        defaultValue={plan.stripePriceIdMonthly}
                        placeholder="price_…"
                      />
                      <TextField
                        label="Stripe price ID — yearly"
                        name="stripePriceIdYearly"
                        defaultValue={plan.stripePriceIdYearly}
                        placeholder="price_…"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Coaching calls per month"
                        name="coachingCredits"
                        type="number"
                        min={0}
                        defaultValue={plan.coachingCreditsPerMonth}
                      />
                      <TextField
                        label="Sort order"
                        name="sortOrder"
                        type="number"
                        defaultValue={plan.sortOrder}
                      />
                    </div>
                    <CheckboxField
                      label="Includes 1-1 coaching"
                      name="includesCoaching"
                      defaultChecked={plan.includesCoaching}
                    />
                    <CheckboxField
                      label="On sale"
                      name="isActive"
                      defaultChecked={plan.isActive}
                      hint="Hidden plans keep existing subscribers but accept no new ones."
                    />
                  </AdminForm>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* Products ------------------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold">Sell items individually</h2>
        <p className="mb-4 text-sm text-ink-400">
          A one-off purchase unlocks that content permanently, whatever plan the buyer
          is on — and they keep it if they cancel. Good for people who won&apos;t
          subscribe.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {productRows.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-400">
                  Nothing on sale individually yet. Create your first product with the
                  form beside this.
                </p>
              </Card>
            ) : (
              productRows.map(({ product, includes }) => (
                <details key={product.id} className="card p-0">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{product.name}</span>
                      <Badge tone={product.isActive ? "success" : "neutral"}>
                        {product.isActive ? "On sale" : "Hidden"}
                      </Badge>
                      {product.contentType === "BUNDLE" ? <Badge tone="volt">Bundle</Badge> : null}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {formatMoney(product.priceCents, product.currency)}
                    </span>
                  </summary>
                  <div className="border-t border-ink-800 p-5">
                    <p className="mb-3 text-xs text-ink-400">
                      Unlocks: {includes.map((i) => i.title).join(", ") || "nothing — fix this"}
                    </p>
                    <ProductForm
                      action={saveProductAction}
                      options={options}
                      submitLabel="Save product"
                      initial={{
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        price: (product.priceCents / 100).toFixed(2),
                        currency: product.currency,
                        stripePriceId: product.stripePriceId,
                        contentType: product.contentType,
                        selectedRefs: grantTargetsFor(product).map(
                          (t) => `${t.contentType}:${t.contentId}`,
                        ),
                        isActive: product.isActive,
                        sortOrder: product.sortOrder,
                      }}
                    />
                    <div className="mt-4 flex flex-wrap gap-3 border-t border-ink-800 pt-4">
                      <form action={toggleProductAction}>
                        <input type="hidden" name="id" value={product.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:bg-ink-800"
                        >
                          {product.isActive ? "Take off sale" : "Put on sale"}
                        </button>
                      </form>
                      <DangerForm
                        action={deleteProductAction}
                        hiddenFields={{ id: product.id }}
                        label="Delete product"
                        confirmMessage={`Delete "${product.name}"? Members who already bought it keep their access.`}
                      />
                    </div>
                  </div>
                </details>
              ))
            )}
          </div>

          <Card>
            <h3 className="mb-1 text-sm font-semibold">New product</h3>
            <p className="mb-4 text-xs text-ink-400">
              Pick anything you&apos;ve published and put a price on it.
            </p>
            <ProductForm action={saveProductAction} options={options} />
          </Card>
        </div>
      </section>

      {/* Manual grants -------------------------------------------------- */}
      <section>
        <h2 className="mb-1 text-base font-semibold">Give access manually</h2>
        <p className="mb-4 text-sm text-ink-400">
          For refunds, prizes and support fixes — no payment involved.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-0">
            {grants.length === 0 ? (
              <p className="p-5 text-sm text-ink-400">No access granted yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-400">
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-5 py-3 font-medium">Item</th>
                      <th className="px-5 py-3 font-medium">How</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((grant, i) => (
                      <tr key={grant.id} className="border-b border-ink-800 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{grant.user.name}</p>
                          <p className="text-xs text-ink-400">{grant.user.email}</p>
                        </td>
                        <td className="px-5 py-3 text-ink-300">
                          {grantLabels[i]?.title ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={grant.source === "PURCHASE" ? "success" : "info"}>
                            {grant.source.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <form action={revokeGrantAction}>
                            <input type="hidden" name="id" value={grant.id} />
                            <button
                              type="submit"
                              className="text-xs text-ink-400 transition-colors hover:text-red-300"
                            >
                              Revoke
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold">Grant access</h3>
            <ManualGrantForm action={grantAccessManuallyAction} options={options} />
          </Card>
        </div>
      </section>

      <p className="mt-8 text-xs text-ink-400">
        Need to change the brand or domain instead?{" "}
        <Link href="/admin/settings" className="text-volt-500 hover:underline">
          Branding
        </Link>
        .
      </p>
    </>
  );
}
