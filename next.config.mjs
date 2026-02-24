/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from Google user profiles
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Let Next.js handle pg/sequelize via its own output file tracing.
  // Do NOT add pg/pg-hstore to webpack externals — that prevents Vercel from
  // bundling them into the serverless function, causing "Please install pg manually".
  serverExternalPackages: ["sequelize", "sequelize-typescript", "pg", "pg-hstore"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Only exclude pg-native — it's an optional C++ binary that doesn't exist
      // on Vercel. pg/pg-hstore/sequelize must NOT be excluded here or Vercel's
      // serverless functions won't find them at runtime ("Please install pg manually").
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "pg-native",
      ];
    }
    return config;
  },
};

export default nextConfig;
