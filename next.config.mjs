/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.JOBSYNC_DESKTOP === "1"
    ? { distDir: ".next-desktop", output: "standalone" }
    : process.env.JOBSYNC_LOCAL_RUNTIME === "1"
    ? { distDir: ".next-local" }
    : { output: "standalone" }),
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
