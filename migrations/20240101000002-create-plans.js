"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Plans", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      rawRequirement: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      qaContext: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      requirements: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      entities: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      userFlows: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      apiEndpoints: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      contextMd: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      linearTickets: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "claude-sonnet-4-6",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("Plans", ["userId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Plans");
  },
};
