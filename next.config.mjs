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
  // Sequelize uses some Node.js built-ins that need to be marked as external
  serverExternalPackages: ["sequelize", "sequelize-typescript", "pg", "pg-hstore"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "pg",
        "pg-hstore",
        "pg-native",
        "sequelize",
        "sequelize-typescript",
      ];
    }
    return config;
  },
};

export default nextConfig;
