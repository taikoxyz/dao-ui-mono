/** @type {import('next').NextConfig} */
// Stable per deploy (commit SHA on Vercel), unique per build otherwise. Used as
// the persisted react-query cache buster so any build invalidates stale caches.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || `dev-${Date.now()}`;

const nextConfig = {
  trailingSlash: true,
  transpilePackages: ["@aragon/ods"],
  generateBuildId: () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
