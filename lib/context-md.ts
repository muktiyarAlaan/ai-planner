import { getGeminiModel } from "@/lib/gemini";

type QaItem = { question: string; answer: string };

type RequirementBlock = {
  functional?: string[];
  nonFunctional?: string[];
  outOfScope?: string[];
};

type EntityNodeBlock = {
  id: string;
  data: {
    name: string;
    description?: string;
    fields?: Array<{ name: string; type: string; isPrimary: boolean; isNullable: boolean }>;
  };
};

type EntityEdgeBlock = { source: string; target: string; label?: string };

type UserFlowNodeBlock = { id: string; type?: string; data: { label: string } };
type UserFlowEdgeBlock = { source: string; target: string; label?: string };

type ApiEndpointBlock = {
  method: string;
  path: string;
  description: string;
  auth: boolean;
  requestBody?: unknown;
  responseBody?: unknown;
};

type SecurityReviewBlock = {
  summary?: { passed: number; warnings: number; failed: number };
  checklist?: Array<{ status: string; title: string; description: string }>;
  threatModel?: Array<{ threat: string; likelihood: string; impact: string; mitigation: string }>;
  recommendations?: Array<{ priority: number; title: string; detail: string }>;
};

type LinearTicketBlock = {
  title: string;
  type: string;
  description?: string;
  acceptanceCriteria?: string[];
  url?: string;
  children?: unknown[];
};

/** Recursively flatten the full ticket tree into indented markdown lines */
function ticketTreeToLines(
  tickets: LinearTicketBlock[],
  depth = 0,
): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const t of tickets) {
    const link = t.url ? ` ([view](${t.url}))` : "";
    lines.push(`${indent}- **[${t.type}]** ${t.title}${link}`);
    if (t.description) lines.push(`${indent}  ${t.description}`);
    if (t.acceptanceCriteria?.length) {
      for (const ac of t.acceptanceCriteria) lines.push(`${indent}  - [ ] ${ac}`);
    }
    if (t.children?.length) {
      lines.push(
        ...ticketTreeToLines(
          t.children as LinearTicketBlock[],
          depth + 1,
        ),
      );
    }
  }
  return lines;
}

export function buildContextDataPayload(plan: Record<string, unknown>): string {
  const sections: string[] = [];

  sections.push(`PLAN TITLE: ${plan.title}`);
  sections.push(`ORIGINAL REQUIREMENT:\n${plan.rawRequirement}`);

  const qaContext = plan.qaContext as QaItem[] | null;
  if (qaContext?.length) {
    const answered = qaContext.filter((qa) => qa.answer?.trim());
    if (answered.length) {
      sections.push(
        "DESIGN DECISIONS (from engineer clarifications):\n" +
          answered.map((qa) => `  Q: ${qa.question}\n  A: ${qa.answer}`).join("\n"),
      );
    }
  }

  const requirements = plan.requirements as RequirementBlock | null;
  if (requirements) {
    if (requirements.functional?.length) {
      sections.push(
        "FUNCTIONAL REQUIREMENTS:\n" + requirements.functional.map((r) => `  - ${r}`).join("\n"),
      );
    }
    if (requirements.nonFunctional?.length) {
      sections.push(
        "NON-FUNCTIONAL REQUIREMENTS:\n" + requirements.nonFunctional.map((r) => `  - ${r}`).join("\n"),
      );
    }
    if (requirements.outOfScope?.length) {
      sections.push(
        "OUT OF SCOPE:\n" + requirements.outOfScope.map((r) => `  - ${r}`).join("\n"),
      );
    }
  }

  const entities = plan.entities as { nodes: EntityNodeBlock[]; edges: EntityEdgeBlock[] } | null;
  if (entities?.nodes?.length) {
    const entityLines: string[] = ["DATA MODEL:"];
    for (const node of entities.nodes) {
      const d = node.data;
      entityLines.push(`  Entity: ${d.name}${d.description ? " — " + d.description : ""}`);
      for (const f of d.fields ?? []) {
        entityLines.push(
          `    - ${f.name}: ${f.type}${f.isPrimary ? " (PK)" : ""}${f.isNullable ? " nullable" : " not null"}`,
        );
      }
    }
    if (entities.edges?.length) {
      entityLines.push("  Relationships:");
      for (const edge of entities.edges) {
        const src = entities.nodes.find((n) => n.id === edge.source)?.data?.name ?? edge.source;
        const tgt = entities.nodes.find((n) => n.id === edge.target)?.data?.name ?? edge.target;
        entityLines.push(`    - ${src} ${edge.label ?? "→"} ${tgt}`);
      }
    }
    sections.push(entityLines.join("\n"));
  }

  const userFlows = plan.userFlows as { nodes: UserFlowNodeBlock[]; edges: UserFlowEdgeBlock[] } | null;
  if (userFlows?.nodes?.length) {
    const nodeMap: Record<string, string> = {};
    for (const n of userFlows.nodes) nodeMap[n.id] = n.data?.label ?? n.id;
    const flowLines = ["USER FLOW STEPS:"];
    for (const e of userFlows.edges ?? []) {
      const lbl = e.label ? ` [${e.label}]` : "";
      flowLines.push(`  ${nodeMap[e.source] ?? e.source} →${lbl} ${nodeMap[e.target] ?? e.target}`);
    }
    sections.push(flowLines.join("\n"));
  }

  const apiEndpoints = plan.apiEndpoints as ApiEndpointBlock[] | null;
  if (apiEndpoints?.length) {
    const epLines = ["API ENDPOINTS:"];
    for (const ep of apiEndpoints) {
      epLines.push(`  ${ep.method} ${ep.path} — ${ep.description} (auth required: ${ep.auth})`);
      if (ep.requestBody) epLines.push(`    Request body: ${JSON.stringify(ep.requestBody)}`);
      if (ep.responseBody) epLines.push(`    Response body: ${JSON.stringify(ep.responseBody)}`);
    }
    sections.push(epLines.join("\n"));
  }

  const securityReview = plan.securityReview as SecurityReviewBlock | null;
  if (securityReview) {
    const secLines = ["SECURITY REVIEW:"];
    if (securityReview.summary) {
      const s = securityReview.summary;
      secLines.push(`  ${s.passed} checks passed, ${s.warnings} warnings, ${s.failed} failed`);
    }
    for (const item of securityReview.checklist ?? []) {
      secLines.push(`  [${item.status}] ${item.title}: ${item.description}`);
    }
    for (const threat of securityReview.threatModel ?? []) {
      secLines.push(
        `  Threat: ${threat.threat} | Likelihood: ${threat.likelihood} | Impact: ${threat.impact} | Mitigation: ${threat.mitigation}`,
      );
    }
    if (securityReview.recommendations?.length) {
      secLines.push("  Recommendations:");
      for (const r of securityReview.recommendations) {
        secLines.push(`    ${r.priority}. ${r.title}: ${r.detail}`);
      }
    }
    sections.push(secLines.join("\n"));
  }

  const linearTickets = plan.linearTickets as LinearTicketBlock[] | null;
  if (linearTickets?.length) {
    sections.push(
      "IMPLEMENTATION TICKETS (full hierarchy, all levels):\n" +
        ticketTreeToLines(linearTickets).join("\n"),
    );
  }

  return sections.join("\n\n");
}

export async function generateContextMarkdown(plan: Record<string, unknown>): Promise<string> {
  const dataPayload = buildContextDataPayload(plan);

  const prompt = `You are a senior staff engineer writing a comprehensive technical context document for a software feature.

Using the structured plan data provided below, write a complete CONTEXT.md file that will be loaded by AI coding assistants (Claude Code, Cursor, Copilot) to give them complete context before writing any code.

STRICT RULES:
1. Write as an expert technical author. Never copy-paste the original requirement or Q&A verbatim. Synthesize and rewrite everything as a professional reference document.
2. Use the design decisions/clarifications to inform WHAT you write (architecture choices, constraints, tradeoffs) — do not list them as Q&A.
3. Include concrete artifacts: schema tables (SQL-style), pseudocode/algorithm descriptions, request/response examples, ASCII architecture diagrams where helpful.
4. Organize with clear numbered sections, sub-sections, tables, and code blocks.
5. Be comprehensive — a developer reading this should be able to build the feature without any other document.
6. Only include sections where there is actual data to write about.
7. Do NOT add a "Generated by" footer, meta-comments, or preamble. Output ONLY the markdown content.

PLAN DATA TO SYNTHESIZE:
${dataPayload}`;

  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
