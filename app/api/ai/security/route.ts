import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { ApiEndpoint, RFNode } from "@/types/plan";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { planId } = body as { planId: string };

  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { id: planId, userId: session.id } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const p = plan.toJSON() as Record<string, unknown>;
    const entities = p.entities as { nodes: Array<RFNode> } | null;
    const apiEndpoints = p.apiEndpoints as ApiEndpoint[] | null;
    const userFlows = p.userFlows as { nodes: Array<RFNode> } | null;

    const entitiesText = entities?.nodes
      ?.map((n) => {
        const data = n.data as { name?: string; fields?: Array<{ name: string; type: string }> };
        const fields = data.fields?.map((f) => `${f.name} (${f.type})`).join(", ") ?? "";
        return `${data.name}: ${fields}`;
      })
      .join("\n") ?? "none";

    const endpointsText = apiEndpoints
      ?.map((e) => `${e.method} ${e.path} — auth: ${e.auth}`)
      .join("\n") ?? "none";

    const flowsText = userFlows?.nodes
      ?.map((n) => (n.data as { label?: string }).label)
      .filter(Boolean)
      .join(" → ") ?? "none";

    const prompt = `You are a security engineer reviewing a technical plan before implementation.

PLAN TITLE: ${p.title}
REQUIREMENT: ${p.rawRequirement}

ENTITIES AND FIELDS:
${entitiesText}

API ENDPOINTS:
${endpointsText}

USER FLOWS:
${flowsText}

Perform a security review of this plan. Return ONLY a JSON object, no other text:

{
  "summary": {
    "passed": 0,
    "warnings": 0,
    "failed": 0
  },
  "checklist": [
    {
      "id": "check-1",
      "status": "PASS",
      "category": "Auth",
      "title": "Authentication required on sensitive endpoints",
      "description": "All endpoints that return or modify user data have auth: true. This prevents unauthorized access."
    },
    {
      "id": "check-2",
      "status": "WARN",
      "category": "Data",
      "title": "PII fields identified without encryption note",
      "description": "Fields like 'email' and 'name' contain PII. Ensure these are encrypted at rest and never logged."
    },
    {
      "id": "check-3",
      "status": "FAIL",
      "category": "API",
      "title": "No rate limiting specified on auth endpoints",
      "description": "POST endpoints handling authentication have no rate limiting defined. This exposes the system to brute force attacks. Add rate limiting: 5 requests per 15 minutes per IP."
    }
  ],
  "threatModel": [
    {
      "threat": "Unauthorized data access",
      "likelihood": "Medium",
      "impact": "High",
      "mitigation": "Ensure row-level security so users can only access their own data. Validate userId from JWT, never from request body."
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Add rate limiting to all POST endpoints",
      "detail": "Implement rate limiting middleware before deploying to production.",
      "codeSnippet": "// Express example\napp.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }))"
    }
  ]
}

Status values: PASS, WARN, FAIL, INFO
Category values: Auth, Data, API, Input, Logging, Infra
Likelihood/Impact values: High, Medium, Low
Generate 6-10 checklist items specific to this plan. Be specific — reference actual entity names, field names, and endpoint paths from the plan.`;

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Gemini response");
    }

    const securityReview = JSON.parse(jsonMatch[0]);

    await plan.update({ securityReview });

    return NextResponse.json({ securityReview });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating security review:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
