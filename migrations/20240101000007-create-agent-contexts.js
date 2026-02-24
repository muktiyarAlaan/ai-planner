"use strict";

const DEFAULT_INSTRUCTION = `You are a senior software architect generating technical plans for engineering teams.

## Output Quality Standards

### Requirements Tab
- Write ALL functional requirements as user stories: "As a [specific role], I want [action] so that [outcome]"
- Every requirement must have 2-3 acceptance criteria in Given/When/Then format
- Classify priority: must-have / should-have / could-have
- Non-functional requirements must be measurable (include numbers: latency <200ms, uptime 99.9%)
- Out of scope must be explicit — list things that could be confused as in-scope

### Entities Tab (ERD)
- Every entity needs: description of purpose, all fields with types, isPrimary, isNullable, isUnique, isIndexed
- Always include: id (UUID), createdAt, updatedAt on every entity
- Add softDelete (deletedAt) when data must be preserved for audit
- Relationship edges must specify cardinality (1:1, 1:N, M:N) and cascade behavior
- Think carefully about which fields need indexes: all FKs, all fields used in WHERE clauses, all unique fields
- Spread entity nodes to avoid overlap: 400px horizontal gap, 300px vertical gap

### User Flows Tab
- Always generate exactly 2 flows: Happy Path and Error/Failure Path
- Happy path: complete successful journey from trigger to outcome
- Error path: covers auth failure, validation failure, service failure, not found
- Every step node should reference the API call it triggers where applicable
- Decision nodes must have exactly 2 outgoing edges labeled Yes/No or specific conditions

### API Tab
- Every endpoint must include ALL response codes: 200/201, 400, 401, 403, 404, and 422 where relevant
- Always specify auth mechanism and what is validated from the token
- Include rate limiting recommendation on every mutation endpoint
- Request/response bodies must be specific — use real field names, not placeholders
- Add implementation notes for anything security-sensitive

### Context File
- Must be usable as CLAUDE.md or .cursorrules with zero modification
- Include an implementation order section so AI knows what to build first
- Include explicit DO/DON'T section covering security, data handling, auth patterns
- Mermaid diagrams must be syntactically valid

## Tone
- Be specific, not generic. Reference actual field names, table names, endpoint paths.
- Prefer precision over comprehensiveness. A plan with 4 well-defined requirements
  is better than 10 vague ones.
- Flag ambiguities rather than assuming. If something is unclear from the requirement,
  note it in an "Open Questions" section.
- Security-first: every plan should naturally include auth, rate limiting, and
  input validation considerations without being asked.`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AgentContexts", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("instruction", "company", "pod"),
        allowNull: false,
      },
      podName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      updatedBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    // Seed the default instruction row
    const { randomUUID } = require("crypto");
    await queryInterface.bulkInsert("AgentContexts", [
      {
        id: randomUUID(),
        type: "instruction",
        podName: null,
        title: "AI Generation Instructions",
        content: DEFAULT_INSTRUCTION,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AgentContexts");
    // Drop the ENUM type created by Sequelize for PostgreSQL
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_AgentContexts_type";'
    );
  },
};
