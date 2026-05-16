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

export interface StoredCalendarEvent extends CalendarEvent {
  source: "agent" | "manual";
  sourceRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UrlReference {
  title: string;
  url: string;
  reason: string;
  category: "user_provided" | "suggested" | "research_needed";
}

export interface GeneratedFile {
  filename: string;
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
  usedLLM?: boolean;
}

export interface LLMStatus {
  connected: boolean;
  model: string;
  provider: string;
  latencyMs?: number;
  error?: string;
}

export interface LLMConnectionTest {
  ok: boolean;
  model: string;
  latencyMs: number;
  error?: string;
  provider: string;
}

export interface AgentResult {
  runId: string;
  agentPattern: "react";
  finalAnswer: string;
  tasks: PlannedTask[];
  calendarEvents: CalendarEvent[];
  urls: UrlReference[];
  files: GeneratedFile[];
  memoriesUsed: MemoryItem[];
  recommendations: string[];
  steps: AgentStepLog[];
  llmStatus?: LLMStatus;
}

export interface RunHistorySummary {
  runId: string;
  input: string;
  finalAnswer: string;
  createdAt: string;
  taskCount: number;
  eventCount: number;
  fileCount: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function runAgent(input: string) {
  return request<AgentResult>("/api/agent/run", {
    method: "POST",
    body: JSON.stringify({ input, options: { generateFiles: true, generateCalendar: true, useMemory: true } })
  });
}

export function testLLMConnection() {
  return request<LLMConnectionTest>("/api/agent/llm-status");
}

export const filesApi = {
  list: () => request<GeneratedFile[]>("/api/files")
};

export const runsApi = {
  list: () => request<RunHistorySummary[]>("/api/runs"),
  get: (runId: string) => request<AgentResult & { input: string; createdAt: string }>(`/api/runs/${runId}`)
};

export const calendarApi = {
  list: () => request<StoredCalendarEvent[]>("/api/calendar"),
  create: (data: Omit<CalendarEvent, "id" | "taskId"> & { taskId?: string }) => request<StoredCalendarEvent>("/api/calendar", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  update: (id: string, data: Partial<CalendarEvent>) => request<StoredCalendarEvent>(`/api/calendar/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<void>(`/api/calendar/${id}`, { method: "DELETE" })
};
