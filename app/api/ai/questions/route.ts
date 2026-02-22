import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { requirement, context } = body as { requirement: string; context?: string };

  if (!requirement?.trim()) {
    return NextResponse.json({ error: "Requirement is required" }, { status: 400 });
  }

  try {
    const model = getGeminiModel();

    const prompt = `You are a senior software architect helping an engineering team plan a new feature.

A developer has submitted this requirement:
"${requirement}"

${context ? `Additional context provided:\n${context}\n` : ""}
Your job is to ask clarifying questions to fully understand what needs to be built before creating a technical plan.

Generate 4-6 questions that would most change the technical design if answered differently.
Focus on: scope boundaries, data relationships, integration points, user types, edge cases.

Return ONLY a JSON array, no other text:
[
  {
    "id": "q1",
    "question": "What is the scope of this feature?",
    "type": "MULTI_CHOICE",
    "options": ["Option A", "Option B", "Option C", "Something else"]
  },
  {
    "id": "q2",
    "question": "Describe any technical constraints or existing systems this must integrate with.",
    "type": "FREE_TEXT"
  }
]

Rules:
- type must be MULTI_CHOICE (when there are clear distinct options) or FREE_TEXT (when open-ended)
- MULTI_CHOICE must always have "Something else" as the last option
- 3-4 questions should be MULTI_CHOICE, 1-2 FREE_TEXT
- Questions should be specific to the requirement, not generic
- Do not ask about timeline, team size, or non-technical concerns`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON array from response (might be wrapped in code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No JSON array found in Gemini response");
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating questions:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
