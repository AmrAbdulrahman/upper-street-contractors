import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Geist, Geist_Mono } from "next/font/google";
import { buildBaseMetadata } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: "400",
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
  themeColor: "#1b2638",
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
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerifDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface text-foreground">
        {children}
      </body>
    </html>
  );
}
