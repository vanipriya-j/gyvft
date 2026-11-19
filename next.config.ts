import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://*.clarity.ms https://scripts.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://www.facebook.com https://*.google-analytics.com https://*.googletagmanager.com https://*.clarity.ms",
      "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://graph.facebook.com https://*.clarity.ms https://api.resend.com https://api.openai.com",
      "frame-src 'self' https://www.googletagmanager.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/s/files/**",
      },
      { protocol: "https", hostname: "aarla.in", pathname: "/cdn/**" },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  outputFileTracingIncludes: {
    "/api/operations/demo-data": [
      "./public/images/gyvft/case-studies/bits-2001-reunion/hero.png",
      "./public/images/gyvft/case-studies/various-dance-schools/hero.png",
    ],
    "/api/setup": ["./supabase/migrations/*.sql"],
    "/studio/settings/migrations": ["./supabase/migrations/*.sql"],
  },
  async redirects() {
    return [
      {
        source: "/stories/dancer-gift-sets",
        destination: "/stories/various-dance-schools",
        permanent: true,
      },
      {
        source: "/stories/sishyakulam",
        destination: "/stories/various-music-schools",
        permanent: true,
      },
      {
        source: "/stories/barclays-team-award-badges",
        destination: "/stories/natwest-team-event-badges",
        permanent: true,
      },
      {
        source: "/stories/kumon-winner-gifts",
        destination: "/stories/kumon-delegate-gifting",
        permanent: true,
      },
    ];
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

export default nextConfig;
