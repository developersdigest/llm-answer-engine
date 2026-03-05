/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix for GitHub Codespaces (and other proxy setups) where Server Actions
  // requests may arrive with forwarded hosts that don't match the `origin`
  // header. Next.js blocks these by default for CSRF protection.
  //
  // Next.js 14.1.x expects this under `experimental.serverActions`.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#allowedorigins
  experimental: {
    serverActions: {
      allowedOrigins: [
        // local dev
        'localhost',
        '127.0.0.1',

        // GitHub Codespaces
        '*.app.github.dev',

        // Vercel preview/prod (VERCEL_URL is e.g. "my-app.vercel.app")
        ...(process.env.VERCEL_URL ? [process.env.VERCEL_URL] : []),
      ],
    },
  },
};

export default nextConfig;
