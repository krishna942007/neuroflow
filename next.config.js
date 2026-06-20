/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.0.104", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://vercel.live https://*.vercel-scripts.com https://unpkg.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
      "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://vercel.live https://*.vercel-scripts.com https://unpkg.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "style-src-elem 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://vercel.live https://*.vercel-insights.com https://generativelanguage.googleapis.com https://api.groq.com https://api.openai.com https://openrouter.ai https://oauth2.googleapis.com https://esm.sh https://unpkg.com https://cdn.tailwindcss.com",
      "frame-src https://accounts.google.com https://vercel.live",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
    ] }];
  },
};

module.exports = nextConfig;
