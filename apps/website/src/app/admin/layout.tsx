import type { Metadata } from "next";

// The admin area is private and outside the marketing chrome.
export const metadata: Metadata = {
  title: "Content admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-neutral-100">{children}</div>;
}
