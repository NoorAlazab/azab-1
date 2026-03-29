import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "QA CaseForge",
    template: "%s | QA CaseForge",
  },
  description: "Generate, curate, and sync test cases—straight from your Jira stories. AI-powered test case generation for modern QA teams.",
  keywords: [
    "QA",
    "test cases",
    "Jira",
    "AI",
    "test generation",
    "quality assurance",
    "automated testing",
    "test management",
  ],
  authors: [{ name: "QA CaseForge Team" }],
  creator: "QA CaseForge",
  publisher: "QA CaseForge",
  metadataBase: new URL("https://qacaseforge.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://qacaseforge.com",
    title: "QA CaseForge",
    description: "Generate, curate, and sync test cases—straight from your Jira stories",
    siteName: "QA CaseForge",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QA CaseForge - AI-powered test case generation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QA CaseForge",
    description: "Generate, curate, and sync test cases—straight from your Jira stories",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon-57x57.png", sizes: "57x57" },
      { url: "/apple-icon-60x60.png", sizes: "60x60" },
      { url: "/apple-icon-72x72.png", sizes: "72x72" },
      { url: "/apple-icon-76x76.png", sizes: "76x76" },
      { url: "/apple-icon-114x114.png", sizes: "114x114" },
      { url: "/apple-icon-120x120.png", sizes: "120x120" },
      { url: "/apple-icon-144x144.png", sizes: "144x144" },
      { url: "/apple-icon-152x152.png", sizes: "152x152" },
      { url: "/apple-icon-180x180.png", sizes: "180x180" },
    ],
    other: [
      {
        rel: "android-chrome-192x192",
        url: "/android-icon-192x192.png",
      },
    ],
  },
  other: {
    "theme-color": "hsl(265, 85%, 56%)",
    "msapplication-TileColor": "hsl(265, 85%, 56%)",
    "msapplication-TileImage": "/ms-icon-144x144.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}