import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getGeminiModel } from "@/lib/gemini";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

const DEFAULT_CHIPS = [
  "What's missing from this plan?",
  "Review the security model",
  "Suggest improvements",
  "Explain the user flow step by step",
];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ chips: DEFAULT_CHIPS });
  }

  const body = await req.json() as { planId: string };
  if (!body.planId) {
    return NextResponse.json({ chips: DEFAULT_CHIPS });
  }

  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({
      where: { id: body.planId, userId: session.id },
    });

    if (!plan) {
      return NextResponse.json({ chips: DEFAULT_CHIPS });
    }

    const model = getGeminiModel("gemini-2.0-flash-lite");

    const prompt = `You are an expert software architect reviewing technical plans.

Plan title: "${plan.title}"
Requirement: "${(plan.rawRequirement ?? "").slice(0, 600)}"

Generate exactly 4 short, highly specific review questions an engineer would ask about THIS exact plan.
Questions should be domain-specific — reference the actual feature, not generic advice.
Keep each question under 60 characters.

Return ONLY a JSON array of 4 strings, no other text. Example format:
["Is privilege escalation handled?", "Should we add an audit log entity?", "How is data migration handled?", "Are webhook retries needed?"]`;

    const result = await model.generateContent(prompt);
    const text   = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return NextResponse.json({ chips: DEFAULT_CHIPS });

    const chips = JSON.parse(jsonMatch[0]) as string[];
    if (!Array.isArray(chips) || chips.length === 0) {
      return NextResponse.json({ chips: DEFAULT_CHIPS });
    }

    return NextResponse.json({ chips: chips.slice(0, 4) });
  } catch {
    return NextResponse.json({ chips: DEFAULT_CHIPS });
  }
}
