import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { requirement, context, answers } = body as {
    requirement: string;
    context?: string;
    answers: Array<{ questionId: string; question: string; answer: string }>;
  };

  if (!requirement?.trim()) {
    return NextResponse.json({ error: "Requirement is required" }, { status: 400 });
  }

  try {
    const model = getGeminiModel();

    const answersText = (answers ?? [])
      .filter((a) => a.answer?.trim())
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join("\n\n");

    const prompt = `You are a senior software architect. Generate a complete technical plan based on the following:

REQUIREMENT:
${requirement}

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ""}
${answersText ? `CLARIFICATIONS FROM THE ENGINEER:\n${answersText}` : ""}

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
          "description": "What this entity represents",
          "fields": [
            { "name": "id", "type": "UUID", "isPrimary": true, "isNullable": false },
            { "name": "fieldName", "type": "VARCHAR(255)", "isPrimary": false, "isNullable": false }
          ]
        }
      }
    ],
    "edges": [
      {
        "id": "edge-1-2",
        "source": "entity-1",
        "target": "entity-2",
        "label": "has many",
        "type": "smoothstep"
      }
    ]
  },

  "userFlows": {
    "nodes": [
      {
        "id": "flow-1",
        "type": "flowStart",
        "position": { "x": 400, "y": 50 },
        "data": { "label": "User opens feature" }
      },
      {
        "id": "flow-2",
        "type": "flowStep",
        "position": { "x": 400, "y": 200 },
        "data": { "label": "Step description" }
      },
      {
        "id": "flow-3",
        "type": "flowDecision",
        "position": { "x": 400, "y": 380 },
        "data": { "label": "Decision?" }
      },
      {
        "id": "flow-4",
        "type": "flowEnd",
        "position": { "x": 400, "y": 560 },
        "data": { "label": "Success state" }
      }
    ],
    "edges": [
      {
        "id": "fe-1-2",
        "source": "flow-1",
        "target": "flow-2",
        "label": ""
      },
      {
        "id": "fe-2-3",
        "source": "flow-2",
        "target": "flow-3",
        "label": ""
      },
      {
        "id": "fe-3-4a",
        "source": "flow-3",
        "target": "flow-4",
        "label": "Yes"
      }
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

Position entities in the ERD so they don't overlap — spread them horizontally with ~350px gaps, vertically with ~250px gaps.
Position flow nodes vertically top to bottom, x centered around 400, y incrementing by ~150px. Decision nodes should have two outgoing edges with Yes/No labels.
Generate 3-6 entities, 5-10 flow nodes, 3-8 API endpoints, 2-4 Linear epics with stories.`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON object from response (might be wrapped in code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Gemini response");
    }

    const planData = JSON.parse(jsonMatch[0]);

    await sequelize.authenticate();
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
