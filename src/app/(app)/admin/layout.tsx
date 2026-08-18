import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/** The creator console is admin-only. Non-admins get a 404, not a hint. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  return <>{children}</>;
}
