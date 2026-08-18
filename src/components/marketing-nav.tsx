import Link from "next/link";
import { ButtonLink } from "./ui";
import { Brand, type BrandInfo } from "./brand";
import { getSiteSettings } from "@/lib/settings";

export async function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const settings = await getSiteSettings();
  const brand: BrandInfo = settings;
  return (
    <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Brand brand={brand} href="/" className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />

        <nav className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
          <Link href="/#how" className="transition-colors hover:text-ink-100">
            How it works
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-ink-100">
            Pricing
          </Link>
          <Link href="/knowledge" className="transition-colors hover:text-ink-100">
            Knowledge base
          </Link>
          <Link href="/coaching" className="transition-colors hover:text-ink-100">
            Coaching
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <ButtonLink href="/dashboard" variant="primary">
              Open app
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup">Start free</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export async function MarketingFooter() {
  const settings = await getSiteSettings();
  return (
    <footer className="mt-24 border-t border-ink-800 bg-ink-900/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Brand brand={settings} href="/" size="sm" />
          <p className="mt-3 text-sm text-ink-400">
            Sold direct. No app-store cut, no platform middleman.
          </p>
        </div>
        <FooterCol
          title="Train"
          links={[
            ["Programs", "/programs"],
            ["Nutrition", "/nutrition"],
            ["Knowledge base", "/knowledge"],
          ]}
        />
        <FooterCol
          title="Community"
          links={[
            ["Member exchange", "/exchange"],
            ["1-1 coaching", "/coaching"],
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            ["Pricing", "/pricing"],
            ["Sign in", "/login"],
            ["Create account", "/signup"],
          ]}
        />
      </div>
      <div className="border-t border-ink-800 px-4 py-5 text-center text-xs text-ink-400">
        © {new Date().getFullYear()} {settings.brandName}. Training content is
        general information, not medical advice.
        {settings.supportEmail ? (
          <>
            {" "}
            <a
              href={`mailto:${settings.supportEmail}`}
              className="underline transition-colors hover:text-ink-100"
            >
              {settings.supportEmail}
            </a>
          </>
        ) : null}
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-ink-400">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="transition-colors hover:text-ink-100">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
