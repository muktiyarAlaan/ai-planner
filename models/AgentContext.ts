import "reflect-metadata";
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";

export type AgentContextType = "instruction" | "company" | "pod";

@Table({
  tableName: "AgentContexts",
  timestamps: true,
})
export class AgentContext extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.ENUM("instruction", "company", "pod"))
  declare type: AgentContextType;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare podName: string | null;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare updatedBy: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
