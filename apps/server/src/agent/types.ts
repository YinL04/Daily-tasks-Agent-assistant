export type Priority = "high" | "medium" | "low";

export interface PlannedTask {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  estimatedMinutes: number;
  dueDate?: string;
  dependencies: string[];
  tags: string[];
  status: "todo" | "doing" | "done" | "blocked";
}

export interface CalendarEvent {
  id: string;
  taskId: string;
  title: string;
  start: string;
  end: string;
  priority: Priority;
  description: string;
}

export interface UrlReference {
  title: string;
  url: string;
  reason: string;
  category: "user_provided" | "suggested" | "research_needed";
}

export interface GeneratedFile {
  filename: string;
  path: string;
  type: "markdown" | "json" | "csv" | "ics";
  downloadUrl: string;
}

export interface MemoryItem {
  id: string;
  type: "preference" | "habit" | "constraint" | "profile" | "project" | "other";
  key: string;
  value: string;
  confidence: number;
  source: "user_explicit" | "agent_inferred";
  createdAt: string;
  updatedAt: string;
}

export interface AgentStepLog {
  id: string;
  name: string;
  skillName?: string;
  status: "pending" | "running" | "success" | "error";
  thought?: string;
  action?: string;
  observation?: string;
  inputSummary: string;
  outputSummary?: string;
  error?: string;
  startedAt: string;
  endedAt?: string;
  usedLLM?: boolean;
}

export interface LLMStatus {
  connected: boolean;
  model: string;
  provider: string;
  latencyMs?: number;
  error?: string;
}

export interface HarnessRunResult {
  runId: string;
  agentPattern: "react";
  steps: AgentStepLog[];
  finalAnswer: string;
  tasks: PlannedTask[];
  calendarEvents: CalendarEvent[];
  urls: UrlReference[];
  files: GeneratedFile[];
  memoriesUsed: MemoryItem[];
  recommendations: string[];
  llmStatus?: LLMStatus;
}

export interface RunHistoryItem extends HarnessRunResult {
  input: string;
  createdAt: string;
}

export interface AgentOptions {
  generateFiles?: boolean;
  generateCalendar?: boolean;
  useMemory?: boolean;
}

export interface AgentRunRequest {
  input: string;
  options?: AgentOptions;
}

export interface AgentPlan {
  goal: string;
  intent: "plan_tasks" | "schedule" | "research" | "file_generation" | "memory_update" | "mixed";
  steps: PlannedAgentStep[];
}

export interface PlannedAgentStep {
  skillName: string;
  reason: string;
}

export interface AgentContext {
  runId: string;
  input: string;
  now: string;
  memories: MemoryItem[];
}

export interface Skill<I, O> {
  name: string;
  description: string;
  execute(input: I): Promise<O>;
}
