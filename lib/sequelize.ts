import { Sequelize } from "sequelize-typescript";
import pg from "pg";
import { User } from "@/models/User";
import { Plan } from "@/models/Plan";
import { AgentContext } from "@/models/AgentContext";

declare global {
  // eslint-disable-next-line no-var
  var __sequelize: Sequelize | undefined;
}

function buildSequelize(): Sequelize {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");

  if (process.env.NODE_ENV === "production") {
    return new Sequelize(url, {
      dialect: "postgres",
      dialectModule: pg,
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      models: [User, Plan, AgentContext],
    });
  }

  if (!global.__sequelize) {
    global.__sequelize = new Sequelize(url, {
      dialect: "postgres",
      dialectModule: pg,
      logging: false,
      models: [User, Plan, AgentContext],
    });
  }

  // Re-register models on every module load to handle hot-reload in development.
  // After a reload, the cached sequelize instance holds stale model classes, so
  // any direct model import (e.g. User.findOrCreate) would fail with
  // "needs to be added to a Sequelize instance".
  global.__sequelize.addModels([User, Plan, AgentContext]);
  return global.__sequelize;
}

// Lazy proxy — Sequelize is only instantiated on first property/method access,
// not at module load time. This prevents build failures when DATABASE_URL is
// not available in the build environment.
let _instance: Sequelize | null = null;

export const sequelize = new Proxy({} as Sequelize, {
  get(_target, prop) {
    if (!_instance) _instance = buildSequelize();
    const value = (_instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});
