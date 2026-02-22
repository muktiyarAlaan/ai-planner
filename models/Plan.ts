import "reflect-metadata";
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "./User";

@Table({
  tableName: "Plans",
  timestamps: true,
})
export class Plan extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare rawRequirement: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare qaContext: object | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare requirements: object | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare entities: object | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare userFlows: object | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare apiEndpoints: object | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare contextMd: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare linearTickets: object | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare securityReview: object | null;

  @Default("gemini-2.0-flash-lite")
  @Column(DataType.STRING)
  declare model: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING, unique: true })
  declare shareToken: string | null;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isShared: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => User)
  declare user: User;
}
