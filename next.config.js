/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Enable strict TypeScript checking
    ignoreBuildErrors: false,
  },
  eslint: {
    // Don't ignore eslint during builds
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;