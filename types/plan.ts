export interface EntityField {
  name: string;
  type: string;
  isPrimary: boolean;
  isNullable: boolean;
}

export interface EntityNodeData {
  name: string;
  description: string;
  fields: EntityField[];
}

export interface FlowNodeData {
  label: string;
}

export interface PlanRequirements {
  functional: string[];
  nonFunctional: string[];
  outOfScope: string[];
}

export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  auth: boolean;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
}

export interface LinearTicket {
  title: string;
  type: "Epic" | "Story" | "Task";
  description: string;
  acceptanceCriteria: string[];
  url?: string;
  children?: LinearTicket[];
}

export type SecurityStatus = "PASS" | "WARN" | "FAIL" | "INFO";
export type SecurityCategory = "Auth" | "Data" | "API" | "Input" | "Logging" | "Infra";
export type SecurityLikelihood = "High" | "Medium" | "Low";

export interface SecurityCheckItem {
  id: string;
  status: SecurityStatus;
  category: SecurityCategory;
  title: string;
  description: string;
}

export interface ThreatModelItem {
  threat: string;
  likelihood: SecurityLikelihood;
  impact: SecurityLikelihood;
  mitigation: string;
}

export interface SecurityRecommendation {
  priority: number;
  title: string;
  detail: string;
  codeSnippet?: string;
}

export interface SecurityReview {
  summary: { passed: number; warnings: number; failed: number };
  checklist: SecurityCheckItem[];
  threatModel: ThreatModelItem[];
  recommendations: SecurityRecommendation[];
}

export interface PlanData {
  id: string;
  userId: string;
  title: string;
  rawRequirement: string;
  qaContext: Array<{ questionId: string; question: string; answer: string }> | null;
  requirements: PlanRequirements | null;
  entities: { nodes: RFNode[]; edges: RFEdge[] } | null;
  userFlows: { nodes: RFNode[]; edges: RFEdge[] } | null;
  apiEndpoints: ApiEndpoint[] | null;
  contextMd: string | null;
  linearTickets: LinearTicket[] | null;
  securityReview: SecurityReview | null;
  model: string;
  shareToken: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RFNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface RFEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
}
