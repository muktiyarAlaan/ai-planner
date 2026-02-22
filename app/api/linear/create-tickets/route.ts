import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { User } from "@/models/User";
import { LinearTicket } from "@/types/plan";

const LINEAR_API = "https://api.linear.app/graphql";

async function linearQuery<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]?.message ?? "Linear API error");
  return data.data as T;
}

/** Fetch viewer ID and the team's "Todo" workflow state ID in one round-trip. */
async function fetchLinearContext(
  token: string,
  teamId: string,
): Promise<{ viewerId: string; todoStateId: string | null }> {
  const data = await linearQuery<{
    viewer: { id: string };
    team: { states: { nodes: Array<{ id: string; name: string; type: string }> } };
  }>(token, `
    query Context($teamId: String!) {
      viewer { id }
      team(id: $teamId) {
        states { nodes { id name type } }
      }
    }
  `, { teamId });

  const states = data.team?.states?.nodes ?? [];

  // Prefer a state literally named "Todo", fall back to first "unstarted" type
  const todo =
    states.find((s) => s.name.toLowerCase() === "todo") ??
    states.find((s) => s.type === "unstarted") ??
    null;

  return {
    viewerId:    data.viewer.id,
    todoStateId: todo?.id ?? null,
  };
}

const CREATE_ISSUE = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier url }
    }
  }
`;

function buildDescription(ticket: LinearTicket): string {
  let md = ticket.description ?? "";
  if (ticket.acceptanceCriteria?.length) {
    md += "\n\n## Acceptance Criteria\n";
    md += ticket.acceptanceCriteria.map((ac) => `- [ ] ${ac}`).join("\n");
  }
  return md.trim();
}

interface IssueCreated { id: string; identifier: string; url: string; }
interface IssueContext { token: string; teamId: string; assigneeId: string; stateId: string | null; }

async function createOne(
  ctx: IssueContext,
  title: string,
  description: string,
  parentId?: string,
): Promise<IssueCreated> {
  const input: Record<string, unknown> = {
    title,
    description,
    teamId:     ctx.teamId,
    assigneeId: ctx.assigneeId,
  };
  if (ctx.stateId)  input.stateId  = ctx.stateId;
  if (parentId)     input.parentId = parentId;

  const data = await linearQuery<{ issueCreate: { success: boolean; issue: IssueCreated } }>(
    ctx.token, CREATE_ISSUE, { input }
  );
  if (!data.issueCreate?.success) throw new Error(`Failed to create issue: ${title}`);
  return data.issueCreate.issue;
}

/** Recursively create a ticket and all its children. Returns the ticket with url filled in. */
async function createTree(
  ctx: IssueContext,
  ticket: LinearTicket,
  parentId?: string,
): Promise<LinearTicket> {
  const created = await createOne(ctx, ticket.title, buildDescription(ticket), parentId);

  const children: LinearTicket[] = [];
  for (const child of ticket.children ?? []) {
    children.push(await createTree(ctx, child, created.id));
  }

  return { ...ticket, url: created.url, children: children.length ? children : ticket.children };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.linearAccessToken) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 });
  }

  let body: { planId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const { planId } = body;
  if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });

  try {
    await sequelize.authenticate();

    // Get the user's selected Linear team
    const user = await User.findOne({
      where: { id: session.id },
      attributes: ["linearTeamId"],
    });
    if (!user?.linearTeamId) {
      return NextResponse.json(
        { error: "No Linear team selected. Go to the sidebar → Set up → choose a team." },
        { status: 400 }
      );
    }

    // Get the plan (need title + tickets)
    const plan = await Plan.findOne({
      where: { id: planId, userId: session.id },
      attributes: ["id", "title", "linearTickets"],
    });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const tickets = plan.linearTickets as LinearTicket[] | null;
    if (!tickets?.length) {
      return NextResponse.json({ error: "No tickets to create" }, { status: 400 });
    }

    const token  = session.linearAccessToken;
    const teamId = user.linearTeamId;

    // Fetch viewer ID (for assignee) + Todo state ID — single round-trip
    const { viewerId, todoStateId } = await fetchLinearContext(token, teamId);

    const ctx: IssueContext = {
      token,
      teamId,
      assigneeId: viewerId,
      stateId:    todoStateId,
    };

    // Create umbrella issue for the whole plan
    const umbrella = await createOne(
      ctx,
      plan.title,
      `Technical plan: ${plan.title}\n\nThis issue tracks all epics, stories, and tasks for this feature.`,
    );

    // Create all original tickets as children of the umbrella
    const createdChildren: LinearTicket[] = [];
    for (const ticket of tickets) {
      createdChildren.push(await createTree(ctx, ticket, umbrella.id));
    }

    // Store back as a single umbrella ticket wrapping everything
    const result: LinearTicket[] = [{
      title:              plan.title,
      type:               "Epic",
      description:        `Technical plan: ${plan.title}`,
      acceptanceCriteria: [],
      url:                umbrella.url,
      children:           createdChildren,
    }];

    await plan.update({ linearTickets: result });

    return NextResponse.json({ success: true, tickets: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create tickets";
    console.error("Linear create-tickets error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
