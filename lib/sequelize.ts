import { Sequelize } from "sequelize-typescript";
import { User } from "@/models/User";
import { Plan } from "@/models/Plan";
import { AgentContext } from "@/models/AgentContext";

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
    models: [User, Plan, AgentContext],
  });
} else {
  if (!global.__sequelize) {
    global.__sequelize = new Sequelize(DATABASE_URL, {
      dialect: "postgres",
      logging: false,
      models: [User, Plan, AgentContext],
    });
  }
  sequelize = global.__sequelize;
  // Re-register models on every module load to handle hot-reload in development.
  // After a reload, the cached sequelize instance holds stale model classes, so
  // any direct model import (e.g. User.findOrCreate) would fail with
  // "needs to be added to a Sequelize instance".
  sequelize.addModels([User, Plan, AgentContext]);
}

export { sequelize };
