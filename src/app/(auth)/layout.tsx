import { Brand } from "@/components/brand";
import { getSiteSettings } from "@/lib/settings";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Brand brand={settings} href="/" />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
