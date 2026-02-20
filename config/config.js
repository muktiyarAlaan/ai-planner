require("dotenv").config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

module.exports = {
  development: {
    url: DATABASE_URL,
    dialect: "postgres",
    dialectOptions: {},
    logging: false,
  },
  test: {
    url: DATABASE_URL,
    dialect: "postgres",
    logging: false,
  },
  production: {
    url: DATABASE_URL,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  },
};
