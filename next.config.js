/** @type {import('next').NextConfig} */

// Security headers applied to every response.
// Notes on choices:
// - HSTS: only meaningful over HTTPS in production. We still emit it; browsers
//   ignore it on http://localhost.
// - CSP is intentionally NOT set here: Next.js inlines runtime scripts whose
//   nonces require per-request middleware. Adding a strict CSP without nonces
//   would break the app. A nonce-based CSP is a separate piece of work.
// - X-Frame-Options=DENY blocks clickjacking via iframe embedding.
// - Referrer-Policy=strict-origin-when-cross-origin avoids leaking full URLs
//   (which may contain story keys / IDs) to third-party links.
// - Permissions-Policy disables sensors/cameras/microphone/etc. that the app
//   does not use.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
  },
];

const nextConfig = {
  typescript: {
    // Enable strict TypeScript checking
    ignoreBuildErrors: false,
  },
  eslint: {
    // Existing codebase has many style-only lint warnings.
    // Surface them via `npm run lint` but don't fail the production build.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
