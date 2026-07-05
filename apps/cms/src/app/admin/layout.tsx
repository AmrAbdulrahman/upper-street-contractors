// Carried over from the old apps/website/src/app/admin/layout.tsx — the admin
// area is private and outside any marketing chrome (there is none here anymore).
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-neutral-100">{children}</div>;
}
