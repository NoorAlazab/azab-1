/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;