import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Next dev blocks cross-origin requests to /_next dev assets by default.
  // Tunnels (cloudflared, ngrok) serve the app from another origin, so their
  // hostnames must be allowlisted or the client bundle never loads.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io"],
  reactStrictMode: true,
  typedRoutes: true,
  // The assistant reads an attached PDF with pdfjs-dist's legacy build on
  // the server. That build loads its worker through a specifier marked
  // `webpackIgnore`, which a bundled copy would resolve relative to the
  // emitted chunk instead of node_modules — working in dev and failing in
  // production. Keeping the package external makes it a plain Node require.
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      // Poster frames for the YouTube facade embed on the home page.
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
