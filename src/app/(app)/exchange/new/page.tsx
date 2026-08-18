import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { NewThreadForm } from "@/components/exchange-forms";
import { createThreadAction } from "../actions";
import { PageHeader, ButtonLink, Card, LockIcon } from "@/components/ui";

export const metadata: Metadata = { title: "New thread" };
export const dynamic = "force-dynamic";

export default async function NewThreadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const entitlement = entitlementFor(user.subscriptions);

  if (entitlement.tier < 1) {
    return (
      <>
        <Link href="/exchange" className="text-sm text-ink-400 hover:text-ink-100">
          ← Exchange
        </Link>
        <Card className="mt-6 border-volt-500/30 text-center">
          <LockIcon className="mx-auto h-8 w-8 text-volt-500" />
          <h1 className="mt-3 text-lg font-bold">Posting is for members</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            Reading the exchange stays free. Posting and replying come with Core.
          </p>
          <ButtonLink href="/account/billing" className="mt-5">
            See plans
          </ButtonLink>
        </Card>
      </>
    );
  }

  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <Link href="/exchange" className="text-sm text-ink-400 hover:text-ink-100">
        ← Exchange
      </Link>
      <div className="mt-4 max-w-2xl">
        <PageHeader
          title="Start a thread"
          description="The threads that get good answers give the specifics up front."
        />
        <NewThreadForm
          action={createThreadAction}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </>
  );
}
