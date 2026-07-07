import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { buildBaseMetadata } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import "./globals.css";

// Self-hosted variable fonts (files committed under ./fonts).
const playfair = localFont({
  src: [
    {
      path: "./fonts/playfair-display-latin-wght-normal.woff2",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "./fonts/playfair-display-latin-wght-italic.woff2",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = localFont({
  src: [
    {
      path: "./fonts/montserrat-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/montserrat-latin-wght-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteMetaConfig = await getSiteMetaConfig();
    return buildBaseMetadata(siteMetaConfig);
  } catch {
    return buildBaseMetadata(null);
  }
}

export const viewport: Viewport = {
  themeColor: "#031021",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface text-foreground">
        {children}
      </body>
    </html>
  );
}
