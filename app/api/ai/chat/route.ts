import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { AgentContext } from "@/models/AgentContext";
import { generateContextMarkdown } from "@/lib/context-md";

// ── Structured proposal returned by AI in Phase 1 ────────────────────────────
interface AiProposal {
  primaryChange: {
    changeType: "new" | "modified" | "deleted";
    section:    "entities" | "userFlows" | "apiEndpoints" | "requirements" | "contextMd" | "linearTickets";
    name:        string;
    description: string;
    fieldCount?: number;
  };
  relatedChanges: Array<{
    changeType:    "add" | "update" | "verify" | "delete";
    description:   string;
    targetSection?: string;
    targetName?:   string;
  }>;
  affectedSections: string[];
}

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
  userFlows?: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: { label: string };
    }>;
    edges: Array<{ id: string; source: string; target: string; label?: string }>;
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
  reply:     string;
  patch:     AiPatch | null;
  proposal?: AiProposal | null;
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildPrompt(planContext: string, agentInstruction?: string | null): string {
  return `You are a thoughtful AI plan assistant helping engineers design technical systems.

${agentInstruction ? `══════════════════════════════════════════════════════════════════
AGENT INSTRUCTIONS (HIGHEST PRIORITY — FOLLOW EXACTLY)
══════════════════════════════════════════════════════════════════
${agentInstruction}

` : ""}${planContext}

══════════════════════════════════════════════════════════════════
CONSULTATION-FIRST BEHAVIOUR — MANDATORY
══════════════════════════════════════════════════════════════════

You MUST follow this two-phase workflow for every modification request:

PHASE 1 — DISCUSS (default for any change request):
  • Share your architectural perspective on the proposed change
  • Highlight tradeoffs, risks, or better alternatives you see
  • End with a clear question: ask if they want to proceed, or explore alternatives
  • Set patch: null — do NOT apply changes yet

PHASE 2 — APPLY (only when the user explicitly confirms):
  Confirmation phrases that trigger this phase:
  "yes", "do it", "apply it", "yes please", "looks good", "go ahead",
  "proceed", "confirm", "apply the change", "make it so", "sounds good"

  When confirmed: apply ALL changes across every affected section simultaneously.
  THINK HOLISTICALLY — a single change often affects multiple sections:
  • "Add audit logging" → entity + user flow + API endpoints + requirements + contextMd + Linear tickets
  • "Add authentication" → entities (User, Session) + endpoints + requirements + contextMd + tickets
  • "Remove notifications" → remove entity + endpoints + update requirements + contextMd + tickets

NEVER apply a patch without first going through Phase 1, UNLESS the user's very first
message is already an explicit confirmation (e.g. "Apply X, I'm sure").

══════════════════════════════════════════════════════════════════
RESPONSE FORMAT — ALWAYS VALID JSON, NO EXTRA TEXT
══════════════════════════════════════════════════════════════════

Phase 1 (discuss only) — pure Q&A / analysis, no change proposed:
{"reply":"Answer","patch":null}

Phase 1 (discuss only) — when proposing a change, include a "proposal" object
so the user can see exactly what will be affected before confirming:
{
  "reply": "Your architectural perspective + question asking if they want to proceed",
  "patch": null,
  "proposal": {
    "primaryChange": {
      "changeType": "new",
      "section": "entities",
      "name": "CorporateRole",
      "description": "Corporate organisational roles separate from system permissions",
      "fieldCount": 8
    },
    "relatedChanges": [
      {"changeType": "add",    "description": "Add corporate_role_id FK to User entity",          "targetSection": "entities",     "targetName": "User"},
      {"changeType": "update", "description": "Add CRUD API endpoints for corporate roles",        "targetSection": "apiEndpoints"},
      {"changeType": "verify", "description": "CorporateRole self-referencing hierarchy",          "targetSection": "entities"},
      {"changeType": "verify", "description": "CorporateRole belongs to Tenant relationship",      "targetSection": "entities"}
    ],
    "affectedSections": ["entities", "apiEndpoints", "requirements"]
  }
}

proposal field rules:
- changeType for primaryChange: "new" | "modified" | "deleted"
- changeType for relatedChanges: "add" (new FK/field/endpoint), "update" (modifying existing), "verify" (relationship/cascade), "delete" (removing)
- section / targetSection must be one of: "entities" | "userFlows" | "apiEndpoints" | "requirements" | "contextMd" | "linearTickets"
- affectedSections: list every section that will be touched in Phase 2
- targetName: optional — the name of the specific entity/endpoint being affected
- fieldCount: optional — number of fields for entity changes
- Omit "proposal" entirely for pure Q&A responses

Phase 2 (apply confirmed change):
{
  "reply": "Summary of every change applied and why",
  "patch": {
    "entities":      { ...full format below... },
    "userFlows":     { ...full format below... },
    "requirements":  { ...full format below... },
    "apiEndpoints":  [ ...full format below... ],
    "contextMd":     "...full updated markdown...",
    "linearTickets": [ ...full format below... ]
  }
}

Only include patch keys for sections that actually changed.

══════════════════════════════════════════════════════════════════
SECTION FORMATS (used only in Phase 2 patch)
══════════════════════════════════════════════════════════════════

▸ entities — ALL existing nodes + any new/modified ones:
{
  "nodes": [
    {
      "id": "entity-1700000001",
      "type": "entityNode",
      "position": {"x": 100, "y": 100},
      "data": {
        "name": "AuditLog",
        "description": "Records every user action for compliance. Owned by User. Lifecycle: CREATED only (immutable).",
        "fields": [
          {"name":"id",          "type":"UUID",         "isPrimary":true,  "isNullable":false},
          {"name":"userId",      "type":"UUID",         "isPrimary":false, "isNullable":false},
          {"name":"entityType",  "type":"VARCHAR(100)", "isPrimary":false, "isNullable":false},
          {"name":"entityId",    "type":"UUID",         "isPrimary":false, "isNullable":false},
          {"name":"action",      "type":"VARCHAR(255)", "isPrimary":false, "isNullable":false},
          {"name":"metadata",    "type":"JSONB",        "isPrimary":false, "isNullable":true},
          {"name":"createdAt",   "type":"TIMESTAMP",    "isPrimary":false, "isNullable":false},
          {"name":"updatedAt",   "type":"TIMESTAMP",    "isPrimary":false, "isNullable":false}
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "e-1700000002",
      "source": "entity-user-id",
      "target": "entity-1700000001",
      "type": "erdEdge",
      "data": { "relationshipType": "has many", "label": "has many" }
    }
  ]
}

Entity field rules:
- Every entity MUST include: id (UUID), createdAt (TIMESTAMP), updatedAt (TIMESTAMP)
- Include deletedAt (TIMESTAMP, nullable) for user-owned, financially sensitive, or audit entities
- FK fields must end in "Id" (userId, tenantId, roleId). For every FK field, include a corresponding edge.
- Status/state fields use type "ENUM"; document possible values in the description
- Approved types: UUID, VARCHAR(n), TEXT, INTEGER, BIGINT, BOOLEAN, TIMESTAMP, DECIMAL(10,2), JSONB, ENUM
- entity description must state what it represents, who owns it, and its lifecycle states

Edge rules (non-negotiable):
- Edge must have: id, source, target, type="erdEdge", data.relationshipType, data.label
- relationshipType MUST be exactly one of: "has many" | "belongs to" | "has one" | "many to many" | "references"
- "has many": source=parent, target=child. "belongs to": source=child, target=parent.
- Never use notation strings like "1:N" — always use the semantic label ("has many")
- Junction tables must have edges from ALL parent entities they reference. No isolated entities.
Position new entities offset from existing ones (x += 390 or y += 320).

▸ requirements — ALL items (existing + new):
{"functional":["..."],"nonFunctional":["..."],"outOfScope":["..."]}

▸ userFlows — complete flow graph (MULTI-FLOW ARCHITECTURE):
When the feature has multiple actors or parallel journeys, return 2-4 self-contained subgraphs on the same canvas.
Each subgraph has its own flowStart → steps/decisions → flowEnd(s). ZERO edges between flows.
Horizontal offsets: Flow 1 center x≈300, Flow 2 x≈1100, Flow 3 x≈1900, Flow 4 x≈2700.

{
  "nodes": [
    // Flow 1
    {"id":"f1-start","type":"flowStart","position":{"x":300,"y":60},"data":{"label":"Admin: Open user management"}},
    {"id":"f1-step1","type":"flowStep","position":{"x":300,"y":220},"data":{"label":"Admin: Enter email + select role, submit invitation form"}},
    {"id":"f1-dec1","type":"flowDecision","position":{"x":300,"y":400},"data":{"label":"System: Email already registered in tenant?"}},
    {"id":"f1-end-err","type":"flowEnd","position":{"x":140,"y":580},"data":{"label":"Admin: Sees duplicate email error toast"}},
    {"id":"f1-end-ok","type":"flowEnd","position":{"x":460,"y":580},"data":{"label":"Admin: Invitation sent, invitee appears as PENDING"}},
    // Flow 2
    {"id":"f2-start","type":"flowStart","position":{"x":1100,"y":60},"data":{"label":"User: Click invitation link from email"}},
    {"id":"f2-dec1","type":"flowDecision","position":{"x":1100,"y":220},"data":{"label":"System: Token valid and not expired?"}},
    {"id":"f2-end-exp","type":"flowEnd","position":{"x":940,"y":400},"data":{"label":"User: Sees expired link page with re-request option"}},
    {"id":"f2-step1","type":"flowStep","position":{"x":1260,"y":400},"data":{"label":"User: Set password and complete profile"}},
    {"id":"f2-step2","type":"flowStep","position":{"x":1260,"y":560},"data":{"label":"System: Activate user, assign role, mark invitation ACCEPTED"}},
    {"id":"f2-end-ok","type":"flowEnd","position":{"x":1260,"y":720},"data":{"label":"User: Lands on dashboard with assigned role permissions"}}
  ],
  "edges": [
    {"id":"fe-f1-1","source":"f1-start","target":"f1-step1"},
    {"id":"fe-f1-2","source":"f1-step1","target":"f1-dec1"},
    {"id":"fe-f1-3","source":"f1-dec1","target":"f1-end-err","label":"Yes"},
    {"id":"fe-f1-4","source":"f1-dec1","target":"f1-end-ok","label":"No"},
    {"id":"fe-f2-1","source":"f2-start","target":"f2-dec1"},
    {"id":"fe-f2-2","source":"f2-dec1","target":"f2-end-exp","label":"No"},
    {"id":"fe-f2-3","source":"f2-dec1","target":"f2-step1","label":"Yes"},
    {"id":"fe-f2-4","source":"f2-step1","target":"f2-step2"},
    {"id":"fe-f2-5","source":"f2-step2","target":"f2-end-ok"}
  ]
}

Flow quality rules:
- flowStart label = the flow title (e.g. "Admin: Send User Invitation")
- All step/decision labels MUST be prefixed with the actor: "User: ", "System: ", "Admin: ", "API: "
- Be implementation-specific: not "Submit form" → "User: Submit invitation with email + role selection"
- System steps must name the concrete operation: "System: Create UserInvitation with status PENDING"
- Decision nodes: label is a concrete yes/no question; BOTH outgoing edges need explicit condition labels (Yes/No, Granted/Denied)
- Error branches MUST terminate in a flowEnd with a specific failure description — never a generic "Error"
- Every flowDecision has exactly 2 outgoing edges. No dangling nodes.
- Return ALL existing nodes + edges + any new/modified ones (full replacement, not delta).

▸ apiEndpoints — ALL endpoints (existing + new):
[{"method":"POST","path":"/audit-log","description":"...","auth":true,"requestBody":{...},"responseBody":{...}}]
Methods: GET | POST | PUT | DELETE | PATCH

▸ contextMd — full regenerated markdown reflecting ALL current plan state:
"# Title\\n\\n## Overview\\n...\\n## Data Model\\n...\\n## API Endpoints\\n...\\n## Requirements\\n..."

▸ linearTickets — ALL tickets (existing + new) in Epic > Story > Task hierarchy:
[{"title":"...","type":"Epic","description":"...","acceptanceCriteria":["..."],"children":[...]}]`;
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

    // Fetch plan + agent instruction concurrently
    const [plan, instructionRow] = await Promise.all([
      Plan.findOne({ where: { id: planId, userId: session.id } }),
      AgentContext.findOne({ where: { type: "instruction" } }),
    ]);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const agentInstruction = instructionRow?.content ?? null;

    const p = plan.toJSON() as Record<string, unknown>;

    // Pass the FULL current state of every patchable section
    const planContext = `CURRENT PLAN STATE:
Title: ${p.title}
Original Requirement: ${p.rawRequirement}

Requirements:
${JSON.stringify(p.requirements, null, 2)}

Entities (full node + edge data):
${JSON.stringify(p.entities, null, 2)}

User Flows (full node + edge data):
${JSON.stringify(p.userFlows, null, 2)}

API Endpoints:
${JSON.stringify(p.apiEndpoints, null, 2)}

Linear Tickets (current):
${JSON.stringify(p.linearTickets, null, 2)}

Security Review (current):
${JSON.stringify(p.securityReview, null, 2)}

Context Markdown (current):
${typeof p.contextMd === "string" && p.contextMd ? p.contextMd.slice(0, 3000) + (p.contextMd.length > 3000 ? "\n...[truncated]" : "") : "Not yet generated"}`;

    const model = getGeminiModel();
    const chat  = model.startChat({
      history: [
        {
          role:  "user",
          parts: [{ text: buildPrompt(planContext, agentInstruction) }],
        },
        {
          role:  "model",
          parts: [{
            text: '{"reply":"Ready. I\'ll discuss changes first and only apply them once you confirm.","patch":null}',
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
    // Gemini sometimes emits literal newlines/tabs inside string values, making
    // the JSON technically invalid. We sanitise before parsing.
    let reply:    string           = raw;
    let patch:    AiPatch | null   = null;
    let proposal: AiProposal | null = null;

    try {
      // Strip markdown code fences, extract just the JSON object
      const stripped = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const jsonBlock = stripped.match(/\{[\s\S]*\}/)?.[0] ?? stripped;
      const parsed = JSON.parse(escapeJsonStrings(jsonBlock)) as AiResponse;
      reply    = parsed.reply    ?? raw;
      patch    = parsed.patch    ?? null;
      proposal = parsed.proposal ?? null;
    } catch {
      // Last-resort: try a regex extraction of just the reply value
      const m = raw.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"patch"/);
      if (m) {
        try { reply = JSON.parse(`"${m[1]}"`); } catch { reply = m[1]; }
      } else {
        reply = raw;
      }
      patch    = null;
      proposal = null;
    }

    // ── Persist every patched section to the database ─────────────────────────
    if (patch) {
      const updates: Record<string, unknown> = {};
      if (patch.entities)      updates.entities      = patch.entities;
      if (patch.userFlows)     updates.userFlows     = patch.userFlows;
      if (patch.requirements)  updates.requirements  = patch.requirements;
      if (patch.apiEndpoints)  updates.apiEndpoints  = patch.apiEndpoints.map((ep: Record<string, unknown>) => ({
        method:       (ep.method       || "GET")  as string,
        path:         (ep.path         || "")     as string,
        description:  (ep.description  || "")     as string,
        auth:         ep.auth          ?? false,
        requestBody:  ep.requestBody   ?? null,
        responseBody: ep.responseBody  ?? null,
      }));
      if (patch.contextMd)     updates.contextMd     = patch.contextMd;
      if (patch.linearTickets) updates.linearTickets = patch.linearTickets;

      // Keep chat "update context" output aligned with Context tab generation.
      if (patch.contextMd) {
        const mergedPlan = { ...p, ...updates };
        const regenerated = await generateContextMarkdown(mergedPlan);
        updates.contextMd = regenerated;
        patch.contextMd = regenerated;
      }

      if (Object.keys(updates).length > 0) {
        await Plan.update(updates, { where: { id: planId } });
      }
    }

    return NextResponse.json({ reply, patch, proposal });
  } catch (error) {
    console.error("Error in AI chat:", error);
    const friendly = friendlyApiError(error);
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Walk a JSON string character-by-character and escape any bare control
 * characters (newlines, carriage returns, tabs) that appear inside string
 * values. Gemini occasionally emits these, making the JSON unparseable.
 */
function escapeJsonStrings(raw: string): string {
  let out     = "";
  let inStr   = false;
  let escaped = false;

  for (const ch of raw) {
    if (escaped)           { out += ch; escaped = false; continue; }
    if (ch === "\\")       { out += ch; escaped = true;  continue; }
    if (ch === '"')        { out += ch; inStr = !inStr;  continue; }
    if (inStr && ch === "\n") { out += "\\n"; continue; }
    if (inStr && ch === "\r") { out += "\\r"; continue; }
    if (inStr && ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  return out;
}

/** Map known API error types to short, friendly messages. */
function friendlyApiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("high demand")) {
    return "The model is currently overloaded. Please try again in a moment.";
  }
  if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("RESOURCE_EXHAUSTED")) {
    return "Rate limit reached. Please wait a moment before sending another message.";
  }
  if (msg.includes("401") || msg.includes("403") || msg.includes("API key") || msg.includes("permission")) {
    return "API authentication error. Please check your Gemini API key configuration.";
  }
  if (msg.includes("timeout") || msg.includes("DEADLINE_EXCEEDED")) {
    return "The request timed out. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
