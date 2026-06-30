/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We use Node runtime on API routes so we can talk to the local Postgres
  // and the remove.bg REST API. Static export is disabled.
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
};

export default nextConfig;
