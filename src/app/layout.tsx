import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { ContentfulInspectionProvider } from "@/components/contentful";
import { Footer, Header } from "@/components/layout";
import { LocalBusinessJsonLd, PageMetadataInspectButton } from "@/components/metadata";
import { buildBaseMetadata } from "@/helpers";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { ApolloProvider } from "@/lib/apollo-client";
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
  const siteMetaConfig = await getSiteMetaConfig();
  return buildBaseMetadata(siteMetaConfig);
}

export const viewport: Viewport = {
  themeColor: "#1b2638",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteMetaConfig = await getSiteMetaConfig();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerifDisplay.variable} h-full antialiased`}
    >
      <head>
        {siteMetaConfig ? <LocalBusinessJsonLd config={siteMetaConfig} /> : null}
      </head>
      <body className="flex min-h-full flex-col bg-surface text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-dark focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Suspense fallback={null}>
          <PageMetadataInspectButton />
        </Suspense>
        <Suspense fallback={<span>Loading...</span>}>
          <ContentfulInspectionProvider
            spaceId={process.env.CONTENTFUL_SPACE_ID ?? ""}
            environmentId={process.env.CONTENTFUL_ENVIRONMENT ?? "master"}
          >
            <ApolloProvider>
              <Header config={siteMetaConfig} />
              <main id="main" className="flex flex-1 flex-col">
                {children}
              </main>
              <Footer config={siteMetaConfig} />
            </ApolloProvider>
          </ContentfulInspectionProvider>
        </Suspense>
      </body>
    </html>
  );
}
