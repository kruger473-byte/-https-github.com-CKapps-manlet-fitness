import type { Metadata } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSiteSettings, getAppUrl } from "@/lib/settings";
import {
  BrandingForm,
  LogoForm,
  ResetBrandingForm,
} from "@/components/branding-form";
import {
  saveSettingsAction,
  uploadLogoAction,
  removeLogoAction,
  resetBrandingAction,
} from "./actions";
import { PageHeader, Card, Alert, Badge, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Branding" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const [settings, appUrl, linkCount] = await Promise.all([
    getSiteSettings(),
    getAppUrl(),
    db.trackedLink.count(),
  ]);

  const usingSettingsDomain = Boolean(settings.canonicalUrl);

  return (
    <>
      <PageHeader
        eyebrow="Creator console"
        title="Branding & domain"
        description="Make the product yours. Changes apply everywhere immediately — no redeploy, no code."
        action={
          <ButtonLink href="/admin" variant="secondary">
            Revenue
          </ButtonLink>
        }
      />

      {welcome ? (
        <div className="mb-6">
          <Alert tone="success">
            <strong>You&apos;re the owner of this site.</strong> The first account
            on a new deployment becomes the owner automatically, and the starter
            plans have been created for you. Nobody who signs up after this gets
            owner access.
            <span className="mt-2 block">
              Start here: set your brand name, colour and logo below. Then add
              your content under <strong>Content</strong>, and set your prices
              under <strong>Pricing</strong>.
            </span>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-1 text-base font-semibold">Identity</h2>
            <p className="mb-5 text-sm text-ink-400">
              Name, monogram, colour and the copy search engines show.
            </p>
            <BrandingForm
              action={saveSettingsAction}
              appUrlFallback={env.appUrl}
              initial={{
                brandName: settings.brandName,
                monogram: settings.monogram,
                logoUrl: settings.logoUrl,
                tagline: settings.tagline,
                metaDescription: settings.metaDescription,
                accentColor: settings.accentColor,
                canonicalUrl: settings.canonicalUrl ?? "",
                supportEmail: settings.supportEmail ?? "",
              }}
            />
          </Card>

          <Card>
            <h2 className="mb-1 text-base font-semibold">Where your domain is used</h2>
            <p className="mb-4 text-sm text-ink-400">
              The public domain above is the origin this app hands to other
              systems. Setting it wrong breaks payments and attribution, so it is
              validated before saving.
            </p>
            <dl className="space-y-3 text-sm">
              <UsageRow
                term="Tracked links"
                detail={`${linkCount} link${linkCount === 1 ? "" : "s"} are shared as ${appUrl}/go/<slug>`}
              />
              <UsageRow
                term="Stripe checkout"
                detail="Success and cancel URLs members return to after paying"
              />
              <UsageRow
                term="OAuth callbacks"
                detail="Redirect URIs for connecting Meta, TikTok and Google"
              />
              <UsageRow
                term="Metadata"
                detail="Canonical URL and link-preview cards"
              />
            </dl>

            <div className="mt-5">
              <Alert tone={usingSettingsDomain ? "success" : "info"}>
                {usingSettingsDomain ? (
                  <>
                    Serving links as <strong>{appUrl}</strong>. Point your DNS at
                    this deployment and add the domain at your host, then update
                    the redirect URIs in Stripe and each ad platform to match.
                  </>
                ) : (
                  <>
                    No domain set, so links use <strong>{env.appUrl}</strong> from
                    the <code>APP_URL</code> environment variable. Add your domain
                    above once DNS is pointing here.
                  </>
                )}
              </Alert>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-1 text-base font-semibold">Logo</h2>
            <p className="mb-4 text-sm text-ink-400">
              Replaces the monogram in every header and the browser tab.
            </p>
            <LogoForm
              uploadAction={uploadLogoAction}
              removeAction={removeLogoAction}
              currentLogo={settings.logoUrl}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold">Applies to</h2>
            <div className="flex flex-wrap gap-2">
              {[
                "Landing page",
                "Pricing",
                "Sign in / sign up",
                "Member app",
                "Creator console",
                "Browser tab",
                "Link previews",
              ].map((p) => (
                <Badge key={p}>{p}</Badge>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-base font-semibold">Reset</h2>
            <ResetBrandingForm action={resetBrandingAction} />
          </Card>
        </div>
      </div>
    </>
  );
}

function UsageRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-ink-300">{term}</dt>
      <dd className="text-ink-400">{detail}</dd>
    </div>
  );
}
