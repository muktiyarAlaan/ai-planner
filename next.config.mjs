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
  // Sequelize dynamically requires 'pg' at runtime via ConnectionManager.
  // Vercel's static output file tracer cannot detect dynamic requires, so
  // pg/pg-hstore never make it into the serverless bundle automatically.
  // outputFileTracingIncludes forces them into every API route bundle.
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg/**/*",
      "./node_modules/pg-hstore/**/*",
    ],
  },
  serverExternalPackages: ["sequelize", "sequelize-typescript", "pg", "pg-hstore"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Only exclude pg-native — optional C++ binary, not present on Vercel.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "pg-native",
      ];
    }
    return config;
  },
};

export default nextConfig;
