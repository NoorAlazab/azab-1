/**
 * Brand asset paths and helper functions
 */

export const brandAssets = {
  logos: {
    mark: "/branding/logo-mark.svg",
    wordmark: "/branding/logo-wordmark.svg", 
    horizontal: "/branding/logo-horizontal.svg",
  },
  favicons: {
    ico: "/favicon.ico",
    png16: "/favicon-16x16.png",
    png32: "/favicon-32x32.png",
    png192: "/favicon-192x192.png", 
    png512: "/favicon-512x512.png",
    appleTouchIcon: "/apple-touch-icon.png",
  },
  og: {
    image: "/og-image.png",
  },
  manifest: "/site.webmanifest",
} as const;

/**
 * Get OpenGraph meta tags for the app
 */
export function getOpenGraphMeta(options: {
  title?: string;
  description?: string;
  url?: string;
} = {}) {
  const title = options.title ? `${options.title} | QA CaseForge` : "QA CaseForge";
  const description = options.description || "Generate, curate, and sync test cases—straight from your Jira stories.";
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: options.url,
      siteName: "QA CaseForge",
      images: [
        {
          url: brandAssets.og.image,
          width: 1200,
          height: 630,
          alt: "QA CaseForge",
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [brandAssets.og.image],
    },
  };
}

/**
 * Get favicon link tags
 */
export function getFaviconLinks() {
  return [
    { rel: "icon", type: "image/x-icon", href: brandAssets.favicons.ico },
    { rel: "icon", type: "image/png", sizes: "16x16", href: brandAssets.favicons.png16 },
    { rel: "icon", type: "image/png", sizes: "32x32", href: brandAssets.favicons.png32 },
    { rel: "apple-touch-icon", sizes: "180x180", href: brandAssets.favicons.appleTouchIcon },
    { rel: "manifest", href: brandAssets.manifest },
  ];
}

/**
 * Theme color for meta tags
 */
export const themeColor = "#8B5CF6"; // Brand primary

/**
 * Brand colors as CSS custom properties
 */
export const brandColors = {
  primary: "hsl(265, 85%, 56%)",
  primaryForeground: "hsl(0, 0%, 100%)",
  success: "hsl(142, 76%, 36%)",
  successForeground: "hsl(0, 0%, 100%)",
  warning: "hsl(38, 92%, 50%)",
  warningForeground: "hsl(0, 0%, 100%)",
} as const;