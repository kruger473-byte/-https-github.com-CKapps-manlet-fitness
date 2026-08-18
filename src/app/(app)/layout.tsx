import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { getSiteSettings } from "@/lib/settings";
import { logoutAction } from "../(auth)/actions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitlement = entitlementFor(user.subscriptions);
  const settings = await getSiteSettings();

  return (
    <AppShell
      logout={logoutAction}
      brand={settings}
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        planName: entitlement.planName,
        isTrialing: entitlement.isTrialing,
        inGracePeriod: entitlement.inGracePeriod,
      }}
    >
      {children}
    </AppShell>
  );
}
