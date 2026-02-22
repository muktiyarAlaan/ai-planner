import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

// ── Structured patch returned by AI ──────────────────────────────────────────
interface AiPatch {
  entities?: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: { name: string; description: string; fields: Array<{ name: string; type: string; isPrimary: boolean; isNullable: boolean }> };
    }>;
    edges: Array<{ id: string; source: string; target: string; label: string }>;
  };
  requirements?: {
    functional:    string[];
    nonFunctional: string[];
    outOfScope:    string[];
  };
  apiEndpoints?: Array<{
    method:       "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    path:         string;
    description:  string;
    auth:         boolean;
    requestBody:  Record<string, unknown> | null;
    responseBody: Record<string, unknown> | null;
  }>;
  contextMd?:     string;
  linearTickets?: Array<{
    title:               string;
    type:                "Epic" | "Story" | "Task";
    description:         string;
    acceptanceCriteria:  string[];
    children?:           unknown[];
  }>;
}

interface AiResponse {
  reply: string;
  patch: AiPatch | null;
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildPrompt(planContext: string): string {
  return `You are an AI assistant that modifies and analyses technical plans.

${planContext}

══════════════════════════════════════════════════════════════════
RESPONSE RULES — READ CAREFULLY
══════════════════════════════════════════════════════════════════

1. ALWAYS respond with valid JSON only. No markdown fences, no extra text outside the JSON.
2. THINK HOLISTICALLY. A single user request often affects multiple sections simultaneously.
   Update EVERY section that is logically impacted by the change — without the user having
   to ask again. Examples:
   • "Add audit logging" → add entity + new API endpoints + update requirements + update contextMd + add Linear tickets
   • "Add user authentication" → add entities (User, Session) + API endpoints + requirements + contextMd + tickets
   • "Remove the notification system" → remove entity + remove endpoints + update requirements + contextMd + tickets
3. For pure QUESTIONS / ANALYSIS (no changes needed): set patch to null.
4. For any MODIFICATION: set patch to the complete updated content for every section that changed.
   Include ALL existing items PLUS the new/changed ones — not just the delta.

══════════════════════════════════════════════════════════════════
RESPONSE FORMAT
══════════════════════════════════════════════════════════════════

For questions: {"reply":"Your answer","patch":null}

For changes:
{
  "reply": "One-paragraph summary of every change made and why",
  "patch": {
    "entities":     { ...see format below... },
    "requirements": { ...see format below... },
    "apiEndpoints": [ ...see format below... ],
    "contextMd":    "...full updated markdown string...",
    "linearTickets": [ ...see format below... ]
  }
}

Only include the keys whose sections actually changed.

══════════════════════════════════════════════════════════════════
SECTION FORMATS
══════════════════════════════════════════════════════════════════

▸ entities — include ALL existing nodes + any new/modified ones:
{
  "nodes": [
    {
      "id": "entity-1700000001",
      "type": "entityNode",
      "position": {"x": 100, "y": 100},
      "data": {
        "name": "AuditLog",
        "description": "Records all user actions",
        "fields": [
          {"name":"id",        "type":"UUID",       "isPrimary":true,  "isNullable":false},
          {"name":"userId",    "type":"UUID",        "isPrimary":false, "isNullable":false},
          {"name":"action",    "type":"VARCHAR(255)","isPrimary":false, "isNullable":false},
          {"name":"createdAt", "type":"TIMESTAMP",   "isPrimary":false, "isNullable":false}
        ]
      }
    }
  ],
  "edges": [
    {"id":"e-1700000002","source":"entity-user-id","target":"entity-1700000001","label":"has many"}
  ]
}
Position new entities offset from existing ones (x += 360 or y += 280).
Relationship labels: "has many" | "belongs to" | "has one" | "many to many" | "references"
Field types: UUID, VARCHAR(255), TEXT, INTEGER, BIGINT, BOOLEAN, TIMESTAMP, DECIMAL(10,2), JSONB, ENUM

▸ requirements — always include ALL items (existing + new):
{
  "functional":    ["User can log in","..."],
  "nonFunctional": ["System must handle 1000 req/s","..."],
  "outOfScope":    ["Mobile app","..."]
}

▸ apiEndpoints — always include ALL endpoints (existing + new):
[
  {"method":"POST","path":"/audit-log","description":"Create audit log entry","auth":true,"requestBody":{"userId":"uuid","action":"string"},"responseBody":{"id":"uuid"}}
]
Methods: GET | POST | PUT | DELETE | PATCH

▸ contextMd — regenerate the full markdown context document reflecting ALL current plan state:
"# Project Title\\n\\n## Overview\\n...\\n## Data Model\\n...\\n## API Endpoints\\n...\\n## Requirements\\n..."

▸ linearTickets — include ALL tickets (existing + new) in Epic > Story > Task hierarchy:
[
  {
    "title": "Audit Logging Feature",
    "type": "Epic",
    "description": "Implement audit logging across the system",
    "acceptanceCriteria": ["All user actions produce an audit log entry"],
    "children": [
      {
        "title": "AuditLog entity & migration",
        "type": "Story",
        "description": "Create the AuditLog database table",
        "acceptanceCriteria": ["Migration runs without errors","Table has correct columns"],
        "children": [
          {
            "title": "Write AuditLog Sequelize model",
            "type": "Task",
            "description": "Create the Sequelize model with all fields",
            "acceptanceCriteria": ["Model validates correctly"]
          }
        ]
      }
    ]
  }
]`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { planId, message, history } = body as {
    planId:   string;
    message:  string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!planId || !message?.trim()) {
    return NextResponse.json({ error: "planId and message are required" }, { status: 400 });
  }

  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { id: planId, userId: session.id } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const p = plan.toJSON() as Record<string, unknown>;

    // Pass the FULL current state of every patchable section
    const planContext = `CURRENT PLAN STATE:
Title: ${p.title}
Original Requirement: ${p.rawRequirement}

Requirements:
${JSON.stringify(p.requirements, null, 2)}

Entities (full node + edge data):
${JSON.stringify(p.entities, null, 2)}

API Endpoints:
${JSON.stringify(p.apiEndpoints, null, 2)}

Linear Tickets (current):
${JSON.stringify(p.linearTickets, null, 2)}

Context Markdown (current):
${typeof p.contextMd === "string" && p.contextMd ? p.contextMd.slice(0, 3000) + (p.contextMd.length > 3000 ? "\n...[truncated]" : "") : "Not yet generated"}`;

    const model = getGeminiModel();
    const chat  = model.startChat({
      history: [
        {
          role:  "user",
          parts: [{ text: buildPrompt(planContext) }],
        },
        {
          role:  "model",
          parts: [{
            text: '{"reply":"I\'m ready to help. I\'ll update every relevant section in a single response when you request changes.","patch":null}',
          }],
        },
        ...(history ?? []).map((msg) => ({
          role:  msg.role === "assistant" ? "model" : ("user" as "user" | "model"),
          parts: [{ text: msg.content }],
        })),
      ],
    });

    const result = await chat.sendMessage(message);
    const raw    = result.response.text().trim();

    // ── Parse structured JSON response ────────────────────────────────────────
    let reply: string    = raw;
    let patch: AiPatch | null = null;

    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned) as AiResponse;
      reply = parsed.reply ?? raw;
      patch = parsed.patch ?? null;
    } catch {
      reply = raw;
      patch = null;
    }

    // ── Persist every patched section to the database ─────────────────────────
    if (patch) {
      const updates: Record<string, unknown> = {};
      if (patch.entities)      updates.entities      = patch.entities;
      if (patch.requirements)  updates.requirements  = patch.requirements;
      if (patch.apiEndpoints)  updates.apiEndpoints  = patch.apiEndpoints;
      if (patch.contextMd)     updates.contextMd     = patch.contextMd;
      if (patch.linearTickets) updates.linearTickets = patch.linearTickets;

      if (Object.keys(updates).length > 0) {
        await Plan.update(updates, { where: { id: planId } });
      }
    }

    return NextResponse.json({ reply, patch });
  } catch (error) {
    console.error("Error in AI chat:", error);
    return NextResponse.json({ error: "Failed to get reply" }, { status: 500 });
  }
}
