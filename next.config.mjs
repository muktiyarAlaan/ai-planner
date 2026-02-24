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
  // Bundle sequelize and pg into the serverless function via webpack.
  // When sequelize is marked as serverExternalPackages, Vercel's file tracer
  // runs AFTER sequelize's code and misses its dynamic require('pg') call,
  // causing "Please install pg package manually" at runtime.
  // By bundling everything, webpack intercepts require('pg') and resolves it
  // from the bundle — no filesystem lookup needed at runtime.
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
