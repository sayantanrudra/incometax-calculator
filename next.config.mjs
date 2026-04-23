import WebpackBar from "webpackbar";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  /**
   * Dev reliability: polling + ignored paths so edits reliably trigger rebuilds
   * (fixes common macOS EMFILE / native watcher gaps). Fast Refresh is built into Next.
   */
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 200,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
      };
      config.plugins.push(
        new WebpackBar({
          name: isServer ? "server" : "client",
          color: isServer ? "#0d9488" : "#7c3aed",
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
