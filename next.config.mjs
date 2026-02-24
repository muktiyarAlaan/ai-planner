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
  // Keep pg and sequelize as external packages so Vercel's file tracer
  // includes them in the serverless function deployment. Sequelize dynamically
  // requires 'pg' via its dialect loader — bundling breaks this resolution,
  // while external mode lets Node resolve it from node_modules at runtime.
  serverExternalPackages: ["pg", "pg-hstore", "sequelize", "sequelize-typescript"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        // pg-native is an optional C++ binary — exclude it so webpack doesn't
        // try to bundle it. Sequelize falls back to pure-JS pg automatically.
        ({ request }, callback) => {
          if (request === "pg-native") return callback(null, "commonjs pg-native");
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
