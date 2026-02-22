import { Sequelize } from "sequelize-typescript";
import { User } from "@/models/User";
import { Plan } from "@/models/Plan";

const DATABASE_URL = process.env.DATABASE_URL!;

let sequelize: Sequelize;

declare global {
  // eslint-disable-next-line no-var
  var __sequelize: Sequelize | undefined;
}

if (process.env.NODE_ENV === "production") {
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    models: [User, Plan],
  });
} else {
  if (!global.__sequelize) {
    global.__sequelize = new Sequelize(DATABASE_URL, {
      dialect: "postgres",
      logging: false,
      models: [User, Plan],
    });
  }
  sequelize = global.__sequelize;
  // Re-register models on every module load to handle hot-reload in development.
  // After a reload, the cached sequelize instance holds stale model classes, so
  // any direct model import (e.g. User.findOrCreate) would fail with
  // "needs to be added to a Sequelize instance".
  sequelize.addModels([User, Plan]);
}

export { sequelize };
