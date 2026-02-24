import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { AgentContext } from "@/models/AgentContext";
import { autoLayoutEntities } from "@/lib/erd-layout";
import { Op } from "sequelize";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { requirement, context, answers, selectedPod, selectedPods } = body as {
    requirement: string;
    context?: string;
    answers: Array<{ questionId: string; question: string; answer: string }>;
    selectedPod?: string | null;
    selectedPods?: string[] | null;
  };

  if (!requirement?.trim()) {
    return NextResponse.json({ error: "Requirement is required" }, { status: 400 });
  }

  try {
    const normalizedSelectedPods = Array.from(
      new Set(
        (selectedPods && selectedPods.length > 0
          ? selectedPods
          : selectedPod
          ? [selectedPod]
          : []
        )
          .map((podName) => podName?.trim())
          .filter((podName): podName is string => Boolean(podName))
      )
    );

    // Fetch agent contexts from DB
    await sequelize.authenticate();
    const [instructionRow, companyRow, podRows] = await Promise.all([
      AgentContext.findOne({ where: { type: "instruction" } }),
      AgentContext.findOne({ where: { type: "company" } }),
      normalizedSelectedPods.length > 0
        ? AgentContext.findAll({
            where: { type: "pod", podName: { [Op.in]: normalizedSelectedPods } },
          })
        : Promise.resolve(null),
    ]);

    const systemInstruction = instructionRow?.content ?? undefined;
    const companyContext = companyRow?.content ?? null;
    const podContextByName = new Map((podRows ?? []).map((podRow) => [podRow.podName, podRow.content]));
    const podContextBlocks = normalizedSelectedPods
      .map((podName) => {
        const podContext = podContextByName.get(podName);
        if (!podContext) return "";
        return `## Pod Context (${podName})\n${podContext}`;
      })
      .filter(Boolean);

    const model = getGeminiModel("gemini-3-pro-preview", systemInstruction);

    const answersText = (answers ?? [])
      .filter((a) => a.answer?.trim())
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join("\n\n");

    const contextBlock = [
      companyContext ? `## Company Context\n${companyContext}` : "",
      ...podContextBlocks,
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `${contextBlock ? `${contextBlock}\n\n` : ""}## Requirement
${requirement}

${context ? `## Additional Context\n${context}\n` : ""}${answersText ? `## Clarifications From the Engineer\n${answersText}` : ""}

Generate a comprehensive technical plan. Return ONLY a JSON object with this exact structure, no other text:

{
  "title": "Short descriptive title for this feature",

  "requirements": {
    "functional": ["requirement 1", "requirement 2"],
    "nonFunctional": ["requirement 1", "requirement 2"],
    "outOfScope": ["thing not included 1"]
  },

  "entities": {
    "nodes": [
      {
        "id": "entity-1",
        "type": "entityNode",
        "position": { "x": 100, "y": 100 },
        "data": {
          "name": "EntityName",
          "description": "What this entity represents, who owns it, and its lifecycle states",
          "fields": [
            { "name": "id",        "type": "UUID",         "isPrimary": true,  "isNullable": false },
            { "name": "ownerId",   "type": "UUID",         "isPrimary": false, "isNullable": false },
            { "name": "status",    "type": "ENUM",         "isPrimary": false, "isNullable": false },
            { "name": "fieldName", "type": "VARCHAR(255)", "isPrimary": false, "isNullable": false },
            { "name": "createdAt", "type": "TIMESTAMP",    "isPrimary": false, "isNullable": false },
            { "name": "updatedAt", "type": "TIMESTAMP",    "isPrimary": false, "isNullable": false },
            { "name": "deletedAt", "type": "TIMESTAMP",    "isPrimary": false, "isNullable": true  }
          ]
        }
      }
    ],
    "edges": [
      {
        "id": "edge-1-2",
        "source": "entity-1",
        "target": "entity-2",
        "type": "erdEdge",
        "data": { "relationshipType": "has many", "label": "has many" }
      }
    ]
  },

  CRITICAL — Entity field rules:
  - Every entity MUST include: id (UUID), createdAt (TIMESTAMP), updatedAt (TIMESTAMP)
  - Include deletedAt (TIMESTAMP, nullable) for any user-owned, financially sensitive, or audit-sensitive entity
  - All FK fields must end in "Id" (e.g., userId, tenantId, roleId)
  - Status/state fields must use type "ENUM"; document possible values in the entity description
  - Approved types only: UUID, VARCHAR(n), TEXT, INTEGER, BIGINT, BOOLEAN, TIMESTAMP, DECIMAL(10,2), JSONB, ENUM
  - Scale entity count to complexity: simple CRUD = 3-5 entities; auth/RBAC/multi-actor features = 7-14 entities
  - Do NOT compress distinct business concepts into one entity — model them separately

  CRITICAL — Entities edge rules:
  - relationshipType MUST be exactly one of: "has many", "belongs to", "has one", "many to many", "references"
  - "has many": source = parent (one side), target = child (many side)
  - "belongs to": source = child, target = parent
  - "many to many": only for pure associations with NO own attributes — otherwise create an explicit junction entity
  - For EVERY FK field (any field ending in "Id") in an entity, create a corresponding edge. No exceptions.
  - Junction/pivot tables MUST have edges from ALL parent entities they reference
  - No entity may be isolated (every entity needs at least one edge)

  "userFlows": {
    "nodes": [
      // ── MULTI-FLOW ARCHITECTURE ────────────────────────────────────────────
      // Generate 2-4 separate self-contained flow subgraphs for any feature
      // with multiple actors or parallel journeys. Each subgraph has its own
      // flowStart → steps → flowEnd(s) chain with NO cross-flow edges.
      // Offset flows horizontally: Flow 1 at x≈300, Flow 2 at x≈1100, Flow 3 at x≈1900
      //
      // EXAMPLE — two-flow layout (Admin invitation + User acceptance):
      // ── Flow 1 (x center ≈ 300) ──────────────────────────────────────────
      {
        "id": "f1-start",
        "type": "flowStart",
        "position": { "x": 300, "y": 60 },
        "data": { "label": "Admin: Open user management" }
      },
      {
        "id": "f1-step1",
        "type": "flowStep",
        "position": { "x": 300, "y": 220 },
        "data": { "label": "Admin: Enter email + select role, submit invitation form" }
      },
      {
        "id": "f1-decision1",
        "type": "flowDecision",
        "position": { "x": 300, "y": 400 },
        "data": { "label": "System: Email already registered in tenant?" }
      },
      {
        "id": "f1-step2",
        "type": "flowStep",
        "position": { "x": 140, "y": 580 },
        "data": { "label": "System: Return 409 Conflict with duplicate email message" }
      },
      {
        "id": "f1-step3",
        "type": "flowStep",
        "position": { "x": 460, "y": 580 },
        "data": { "label": "System: Create UserInvitation record with status PENDING, send invitation email" }
      },
      {
        "id": "f1-end-err",
        "type": "flowEnd",
        "position": { "x": 140, "y": 740 },
        "data": { "label": "Admin: Sees duplicate email error toast" }
      },
      {
        "id": "f1-end-ok",
        "type": "flowEnd",
        "position": { "x": 460, "y": 740 },
        "data": { "label": "Admin: Sees success confirmation, invitee appears as PENDING in list" }
      },
      // ── Flow 2 (x center ≈ 1100) ─────────────────────────────────────────
      {
        "id": "f2-start",
        "type": "flowStart",
        "position": { "x": 1100, "y": 60 },
        "data": { "label": "User: Click invitation link from email" }
      },
      {
        "id": "f2-decision1",
        "type": "flowDecision",
        "position": { "x": 1100, "y": 220 },
        "data": { "label": "System: Invitation token valid and not expired?" }
      },
      {
        "id": "f2-end-expired",
        "type": "flowEnd",
        "position": { "x": 940, "y": 400 },
        "data": { "label": "User: Sees expired link page with re-request option" }
      },
      {
        "id": "f2-step1",
        "type": "flowStep",
        "position": { "x": 1260, "y": 400 },
        "data": { "label": "User: Set password and complete profile on onboarding form" }
      },
      {
        "id": "f2-step2",
        "type": "flowStep",
        "position": { "x": 1260, "y": 560 },
        "data": { "label": "System: Activate user, assign role, mark UserInvitation as ACCEPTED" }
      },
      {
        "id": "f2-end-ok",
        "type": "flowEnd",
        "position": { "x": 1260, "y": 720 },
        "data": { "label": "User: Lands on dashboard with assigned role permissions active" }
      }
    ],
    "edges": [
      // Flow 1 edges
      { "id": "fe-f1-1-2",  "source": "f1-start",     "target": "f1-step1",     "label": "" },
      { "id": "fe-f1-2-3",  "source": "f1-step1",     "target": "f1-decision1", "label": "" },
      { "id": "fe-f1-3-err","source": "f1-decision1", "target": "f1-step2",     "label": "Yes" },
      { "id": "fe-f1-3-ok", "source": "f1-decision1", "target": "f1-step3",     "label": "No" },
      { "id": "fe-f1-e1",   "source": "f1-step2",     "target": "f1-end-err",   "label": "" },
      { "id": "fe-f1-ok1",  "source": "f1-step3",     "target": "f1-end-ok",    "label": "" },
      // Flow 2 edges
      { "id": "fe-f2-1-2",  "source": "f2-start",     "target": "f2-decision1", "label": "" },
      { "id": "fe-f2-exp",  "source": "f2-decision1", "target": "f2-end-expired","label": "No" },
      { "id": "fe-f2-ok",   "source": "f2-decision1", "target": "f2-step1",     "label": "Yes" },
      { "id": "fe-f2-2-3",  "source": "f2-step1",     "target": "f2-step2",     "label": "" },
      { "id": "fe-f2-3-end","source": "f2-step2",     "target": "f2-end-ok",    "label": "" }
    ]
  },

  "apiEndpoints": [
    {
      "method": "GET",
      "path": "/api/resource",
      "description": "What this endpoint does",
      "auth": true,
      "requestBody": null,
      "responseBody": { "items": "array", "total": "number" }
    },
    {
      "method": "POST",
      "path": "/api/resource",
      "description": "Create a new resource",
      "auth": true,
      "requestBody": { "field1": "string", "field2": "number" },
      "responseBody": { "id": "uuid", "field1": "string" }
    }
  ],

  "linearTickets": [
    {
      "title": "Ticket title",
      "type": "Epic",
      "description": "Full ticket description with context",
      "acceptanceCriteria": ["criteria 1", "criteria 2"],
      "children": [
        {
          "title": "Sub-task title",
          "type": "Story",
          "description": "Description",
          "acceptanceCriteria": ["criteria 1"]
        }
      ]
    }
  ]
}

ERD positioning: spread entities horizontally with ~390px gaps, vertically with ~320px gaps. Positions are auto-corrected server-side, but still aim for a logical left-to-right or top-to-bottom reading order.

USER FLOWS — MULTI-FLOW ARCHITECTURE (mandatory):
Analyse the feature. For any feature with multiple distinct actors or parallel journeys, generate 2-4 separate self-contained flow subgraphs on the same canvas.
- Each flow: own flowStart → steps/decisions → flowEnd(s). ZERO edges between flows.
- Horizontal offsets: Flow 1 center x≈300, Flow 2 x≈1100, Flow 3 x≈1900, Flow 4 x≈2700.
- flowStart label = the flow title, e.g. "Admin: Send User Invitation" or "User: Accept Invitation Link".
- Step labels: always prefix with actor ("User: ", "System: ", "Admin: ", "API: "). Be implementation-specific.
- Decision nodes: label is a concrete yes/no question. Both outgoing edges MUST be labeled (Yes/No, Granted/Denied, etc.). Error branches end in a flowEnd with a specific failure description.
- Every flowDecision has exactly 2 outgoing edges. No dangling nodes.

Scale to complexity: simple CRUD = 3-5 entities, 1 flow (6-8 nodes); auth/RBAC/multi-actor = 7-14 entities, 2-4 flows (8-16 nodes total), 5-10 API endpoints, 3-5 Linear epics with stories.`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON object from response (might be wrapped in code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Gemini response");
    }

    const planData = JSON.parse(jsonMatch[0]);

    // Auto-layout entities so they never overlap regardless of what the AI placed
    if (planData.entities?.nodes && planData.entities?.edges) {
      planData.entities.nodes = autoLayoutEntities(
        planData.entities.nodes,
        planData.entities.edges,
      );
    }

    const plan = await Plan.create({
      userId: session.id,
      title: planData.title || "Untitled Plan",
      rawRequirement: requirement,
      qaContext: answers ?? [],
      requirements: planData.requirements ?? null,
      entities: planData.entities ?? null,
      userFlows: planData.userFlows ?? null,
      apiEndpoints: planData.apiEndpoints ?? null,
      linearTickets: planData.linearTickets ?? null,
      model: "gemini-3-pro-preview",
    });

    return NextResponse.json({ planId: plan.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating plan:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
