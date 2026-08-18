import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { logoutAction } from "../(auth)/actions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitlement = entitlementFor(user.subscriptions);

  return (
    <AppShell
      logout={logoutAction}
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
