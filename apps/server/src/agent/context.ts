import { randomUUID } from "node:crypto";
import type { AgentContext, ConversationTurn, Message } from "./types.js";
import { MemoryManager } from "../memory/memoryManager.js";
import { ConversationStore } from "../storage/conversationStore.js";

function summarizeAssistantMessage(message: Message) {
  const result = message.runResult;
  if (!result) return message.content;
  const pieces = [
    message.content,
    `任务 ${result.tasks.length} 个`,
    `日历 ${result.calendarEvents.length} 个`,
    `建议 ${result.recommendations.length} 条`
  ];
  return pieces.join("；");
}

function trimConversationHistory(messages: Message[]): ConversationTurn[] {
  return messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.role === "assistant" ? summarizeAssistantMessage(message) : message.content,
    timestamp: message.createdAt
  }));
}

function summarizeOlderMessages(messages: Message[]) {
  if (messages.length <= 12) return undefined;
  const older = messages.slice(0, -12);
  const first = older[0];
  const last = older[older.length - 1];
  return `本会话此前已有 ${older.length} 条消息，时间范围 ${first.createdAt} 至 ${last.createdAt}。早期主题摘要：${older
    .slice(-4)
    .map((message) => `${message.role}: ${message.content.slice(0, 80)}`)
    .join(" / ")}`;
}

export async function buildContext(
  input: string,
  memoryManager: MemoryManager,
  useMemory = true,
  conversationStore?: ConversationStore,
  conversationId?: string
): Promise<AgentContext> {
  const messages =
    conversationStore && conversationId ? await conversationStore.getRecentMessages(conversationId, 24) : [];
  return {
    runId: randomUUID(),
    input,
    now: new Date().toISOString(),
    memories: useMemory ? await memoryManager.retrieveRelevant(input) : [],
    conversationHistory: trimConversationHistory(messages),
    conversationSummary: summarizeOlderMessages(messages)
  };
}
