import "./globals.css";

export const metadata = {
  title: "Content admin",
  robots: { index: false, follow: false },
};

/**
 * cms root layout. Internal editor tool, not the marketing site — no
 * fonts/SEO metadata beyond noindex. See root README -> Architecture.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-surface text-foreground">
        {children}
      </body>
    </html>
  );
}
