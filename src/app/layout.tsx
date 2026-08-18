import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Manlet Fitness — training, nutrition and coaching that stays yours",
    template: "%s · Manlet Fitness",
  },
  description:
    "A subscription training platform: video programs, structured diet plans, a real knowledge base, 1-1 coaching and a member community — sold direct, so the revenue stays with the coach.",
  openGraph: {
    title: "Manlet Fitness",
    description:
      "Video programs, diet plans, knowledge base, 1-1 coaching and a member community.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">{children}</body>
    </html>
  );
}
