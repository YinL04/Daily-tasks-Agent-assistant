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
  size?: number;
  updatedAt?: string;
  downloadUrl: string;
}

export interface MemoryItem {
  id: string;
  type: "preference" | "habit" | "constraint" | "profile" | "project" | "other";
  key: string;
  value: string;
  confidence: number;
  source: "user_explicit" | "agent_inferred";
  status: "pending" | "active" | "archived";
  layer: "working" | "long";
  hitCount: number;
  lastHitAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  total: number;
  pending: number;
  active: number;
  archived: number;
}

export interface ScenarioTemplate {
  id: string;
  title: string;
  category: "study" | "travel" | "project" | "health" | "review" | "custom";
  prompt: string;
  defaultOptions: { generateFiles?: boolean; generateCalendar?: boolean; useMemory?: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface LongTermGoal {
  id: string;
  title: string;
  description: string;
  horizon: "monthly" | "quarterly" | "yearly";
  status: "active" | "paused" | "completed" | "archived";
  tags: string[];
  reviewCycle: "weekly" | "monthly";
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodicReview {
  id: string;
  goalId?: string;
  title: string;
  summary: string;
  wins: string[];
  blockers: string[];
  nextActions: string[];
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
  startedAt?: string;
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

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  runId?: string;
  runResult?: AgentResult;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentRunEvent =
  | { type: "step"; step: AgentStepLog }
  | { type: "observation"; step: AgentStepLog }
  | { type: "partial"; result: Partial<AgentResult> }
  | { type: "done"; result: AgentResult; conversationId?: string }
  | { type: "error"; message: string; partialResult?: Partial<AgentResult> };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("AUTH_TOKEN") || "";
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
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

function dispatchStreamEvent(
  eventType: string,
  data: string,
  callbacks: {
    onEvent?: (event: AgentRunEvent) => void;
    onDone: (event: Extract<AgentRunEvent, { type: "done" }>) => void;
    onError: (message: string) => void;
  }
) {
  const parsed = JSON.parse(data) as AgentRunEvent;
  callbacks.onEvent?.(parsed);
  if (eventType === "done" && parsed.type === "done") callbacks.onDone(parsed);
  if (eventType === "error" && parsed.type === "error") callbacks.onError(parsed.message);
}

export function runAgentStream(
  input: string,
  conversationId: string,
  callbacks: {
    onEvent?: (event: AgentRunEvent) => void;
    onDone: (event: Extract<AgentRunEvent, { type: "done" }>) => void;
    onError: (message: string) => void;
  }
) {
  const controller = new AbortController();

  void fetch("/api/agent/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(localStorage.getItem("AUTH_TOKEN") ? { Authorization: `Bearer ${localStorage.getItem("AUTH_TOKEN")}` } : {})
    },
    body: JSON.stringify({
      input,
      conversationId,
      stream: true,
      options: { generateFiles: true, generateCalendar: true, useMemory: true }
    }),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || response.statusText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          const lines = block.split("\n");
          const eventType = lines.find((line) => line.startsWith("event: "))?.slice(7) || "message";
          const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
          if (data) dispatchStreamEvent(eventType, data, callbacks);
        }
      }
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      callbacks.onError(error instanceof Error ? error.message : "运行失败");
    });

  return controller;
}

export function testLLMConnection() {
  return request<LLMConnectionTest>("/api/agent/llm-status");
}

export const filesApi = {
  list: () => request<GeneratedFile[]>("/api/files"),
  delete: (filename: string) => request<void>(`/api/files/${encodeURIComponent(filename)}`, { method: "DELETE" }),
  cleanup: (olderThanDays: number) =>
    request<{ deleted: string[]; count: number }>("/api/files/cleanup", {
      method: "POST",
      body: JSON.stringify({ olderThanDays })
    })
};

export const runsApi = {
  list: () => request<RunHistorySummary[]>("/api/runs"),
  get: (runId: string) => request<AgentResult & { input: string; createdAt: string }>(`/api/runs/${runId}`)
};

export const calendarApi = {
  list: () => request<StoredCalendarEvent[]>("/api/calendar"),
  create: (data: Omit<CalendarEvent, "id" | "taskId"> & { taskId?: string }) =>
    request<StoredCalendarEvent>("/api/calendar", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<CalendarEvent>) =>
    request<StoredCalendarEvent>(`/api/calendar/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  delete: (id: string) => request<void>(`/api/calendar/${id}`, { method: "DELETE" }),
  importIcs: (ics: string) =>
    request<{ imported: StoredCalendarEvent[]; count: number }>("/api/calendar/import", {
      method: "POST",
      body: JSON.stringify({ ics })
    }),
  exportUrl: "/api/calendar/export.ics"
};

export const conversationsApi = {
  list: () => request<ConversationSummary[]>("/api/conversations"),
  create: (title?: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title })
    }),
  get: (id: string) => request<Conversation>(`/api/conversations/${id}`),
  updateTitle: (id: string, title: string) =>
    request<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title })
    }),
  delete: (id: string) => request<void>(`/api/conversations/${id}`, { method: "DELETE" })
};

export const memoriesApi = {
  list: () => request<MemoryItem[]>("/api/memories"),
  stats: () => request<MemoryStats>("/api/memories/stats"),
  create: (data: Partial<MemoryItem> & Pick<MemoryItem, "key" | "value">) =>
    request<MemoryItem>("/api/memories", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<MemoryItem>) =>
    request<MemoryItem>(`/api/memories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  confirm: (id: string) => request<MemoryItem>(`/api/memories/${id}/confirm`, { method: "POST" }),
  archive: (id: string) => request<MemoryItem>(`/api/memories/${id}/archive`, { method: "POST" }),
  delete: (id: string) => request<void>(`/api/memories/${id}`, { method: "DELETE" })
};

export const templatesApi = {
  list: () => request<ScenarioTemplate[]>("/api/templates"),
  create: (data: Omit<ScenarioTemplate, "id" | "createdAt" | "updatedAt">) =>
    request<ScenarioTemplate>("/api/templates", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<ScenarioTemplate>) =>
    request<ScenarioTemplate>(`/api/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  delete: (id: string) => request<void>(`/api/templates/${id}`, { method: "DELETE" })
};

export const goalsApi = {
  list: () => request<LongTermGoal[]>("/api/goals"),
  create: (data: Omit<LongTermGoal, "id" | "createdAt" | "updatedAt">) =>
    request<LongTermGoal>("/api/goals", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<LongTermGoal>) =>
    request<LongTermGoal>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  delete: (id: string) => request<void>(`/api/goals/${id}`, { method: "DELETE" })
};

export const reviewsApi = {
  list: () => request<PeriodicReview[]>("/api/reviews"),
  create: (data: Omit<PeriodicReview, "id" | "createdAt" | "updatedAt">) =>
    request<PeriodicReview>("/api/reviews", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<PeriodicReview>) =>
    request<PeriodicReview>(`/api/reviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  delete: (id: string) => request<void>(`/api/reviews/${id}`, { method: "DELETE" })
};
