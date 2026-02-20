import "reflect-metadata";
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  Unique,
  AllowNull,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";

@Table({
  tableName: "Users",
  timestamps: true,
})
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare name: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare image: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare claudeApiKey: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare linearAccessToken: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare linearTeamId: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
