import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor, formatMoney, getAccessKeys, accessKey } from "@/lib/entitlements";
import { grantTargetsFor, describeTargets } from "@/lib/grants";
import { stripeConfigured } from "@/lib/stripe";
import { buyProductAction } from "./actions";
import { BuyButton } from "@/components/store-buttons";
import {
  PageHeader,
  Card,
  Badge,
  Alert,
  EmptyState,
  ButtonLink,
  CheckIcon,
} from "@/components/ui";

export const metadata: Metadata = { title: "Buy individually" };
export const dynamic = "force-dynamic";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { purchase } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitlement = entitlementFor(user.subscriptions);
  const accessKeys = await getAccessKeys(user.id);

  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const rows = await Promise.all(
    products.map(async (product) => {
      const targets = grantTargetsFor(product);
      const described = await describeTargets(targets);
      const owned =
        targets.length > 0 &&
        targets.every((t) => accessKeys.has(accessKey(t.contentType, t.contentId)));
      return { product, described, owned };
    }),
  );

  const ownedGrants = await db.accessGrant.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const ownedItems = await describeTargets(
    ownedGrants.map((g) => ({ contentType: g.contentType, contentId: g.contentId })),
  );

  return (
    <>
      <PageHeader
        eyebrow="One-off purchases"
        title="Buy a single program or plan"
        description="Don't want a subscription? Buy exactly the thing you want and keep it permanently. It unlocks whatever plan you're on."
      />

      {purchase === "success" ? (
        <div className="mb-6">
          <Alert tone="success">
            Payment received. Access unlocks as soon as Stripe confirms it —
            usually a few seconds. Refresh if it hasn&apos;t appeared.
          </Alert>
        </div>
      ) : null}
      {purchase === "demo" ? (
        <div className="mb-6">
          <Alert tone="success">
            Unlocked. This ran in demo mode because Stripe isn&apos;t configured —
            no money moved, but the grant and the sale record are real.
          </Alert>
        </div>
      ) : null}
      {purchase === "cancelled" ? (
        <div className="mb-6">
          <Alert tone="info">Checkout cancelled. Nothing was charged.</Alert>
        </div>
      ) : null}
      {!stripeConfigured() ? (
        <div className="mb-6">
          <Alert tone="warning">
            Stripe isn&apos;t configured, so purchases run in demo mode — access
            is granted locally and recorded like a real sale.
          </Alert>
        </div>
      ) : null}

      {entitlement.tier > 0 ? (
        <div className="mb-6">
          <Alert tone="info">
            You&apos;re on the {entitlement.planName} plan, so most of this is
            already included. One-off purchases are permanent and survive
            cancelling — useful for the things you want to keep.
          </Alert>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing for sale individually yet"
          description="Products created in the creator console will appear here."
          action={<ButtonLink href="/account/billing">See subscription plans</ButtonLink>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ product, described, owned }) => (
            <Card key={product.id} className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{product.name}</h2>
                {owned ? <Badge tone="success">Owned</Badge> : null}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-ink-400">
                {product.description}
              </p>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wider text-ink-400">
                  Includes
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-300">
                  {described.map((d) => (
                    <li key={`${d.contentType}:${d.contentId}`} className="flex gap-2">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-volt-500" />
                      {d.href && owned ? (
                        <Link href={d.href} className="hover:underline">
                          {d.title}
                        </Link>
                      ) : (
                        d.title
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-5 text-2xl font-black tabular-nums">
                {formatMoney(product.priceCents, product.currency)}
                <span className="text-xs font-normal text-ink-400"> once</span>
              </p>

              <div className="mt-4">
                {owned ? (
                  described[0]?.href ? (
                    <ButtonLink href={described[0].href} variant="secondary" className="w-full">
                      Open it
                    </ButtonLink>
                  ) : null
                ) : (
                  <BuyButton
                    productId={product.id}
                    label="Buy permanently"
                    action={buyProductAction}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {ownedItems.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold">What you own outright</h2>
          <p className="mb-4 text-sm text-ink-400">
            These stay yours whether or not you keep a subscription.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownedItems.map((item) => (
              <Card key={`${item.contentType}:${item.contentId}`}>
                <p className="text-xs uppercase tracking-wider text-ink-400">
                  {item.contentType.replace("_", " ").toLowerCase()}
                </p>
                <p className="mt-1 text-sm font-medium">{item.title}</p>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-2 inline-block text-xs font-medium text-volt-500 hover:underline"
                  >
                    Open →
                  </Link>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
