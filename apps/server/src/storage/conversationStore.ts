import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Conversation, ConversationSummary, HarnessRunResult, Message } from "../agent/types.js";
import { dataDir, readJsonFile, writeJsonFile } from "./db.js";

const defaultConversationsFile = path.join(dataDir, "conversations.json");

function nowIso() {
  return new Date().toISOString();
}

function createTitleFromInput(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  if (!compact) return "新对话";
  return compact.length > 18 ? `${compact.slice(0, 18)}...` : compact;
}

function toSummary(conversation: Conversation): ConversationSummary {
  const last = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.messages.length,
    lastMessage: last?.content,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export class ConversationStore {
  constructor(private conversationsFile = defaultConversationsFile) {}

  async list(): Promise<ConversationSummary[]> {
    const conversations = await this.readAll();
    return conversations.map(toSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Conversation | undefined> {
    const conversations = await this.readAll();
    return conversations.find((conversation) => conversation.id === id);
  }

  async create(title = "新对话"): Promise<Conversation> {
    const conversations = await this.readAll();
    const createdAt = nowIso();
    const conversation: Conversation = {
      id: randomUUID(),
      title,
      messages: [],
      createdAt,
      updatedAt: createdAt
    };
    conversations.unshift(conversation);
    await this.writeAll(conversations);
    return conversation;
  }

  async ensure(id?: string, title?: string): Promise<Conversation> {
    if (id) {
      const existing = await this.get(id);
      if (existing) return existing;
    }
    return this.create(title);
  }

  async addUserMessage(conversationId: string, content: string): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      role: "user",
      content,
      createdAt: nowIso()
    };
    await this.addMessage(conversationId, message, content);
    return message;
  }

  async addAssistantMessage(conversationId: string, result: HarnessRunResult): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      role: "assistant",
      content: result.finalAnswer,
      runId: result.runId,
      runResult: result,
      createdAt: nowIso()
    };
    await this.addMessage(conversationId, message);
    return message;
  }

  async addMessage(conversationId: string, message: Message, titleSeed?: string): Promise<Message> {
    const conversations = await this.readAll();
    const index = conversations.findIndex((conversation) => conversation.id === conversationId);
    if (index === -1) throw new Error("Conversation not found");

    const conversation = conversations[index];
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    if (conversation.title === "新对话" && titleSeed) {
      conversation.title = createTitleFromInput(titleSeed);
    }
    conversations[index] = conversation;
    await this.writeAll(conversations);
    return message;
  }

  async updateTitle(id: string, title: string): Promise<Conversation | undefined> {
    const conversations = await this.readAll();
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return undefined;
    conversation.title = title.trim() || conversation.title;
    conversation.updatedAt = nowIso();
    await this.writeAll(conversations);
    return conversation;
  }

  async delete(id: string): Promise<boolean> {
    const conversations = await this.readAll();
    const next = conversations.filter((conversation) => conversation.id !== id);
    if (next.length === conversations.length) return false;
    await this.writeAll(next);
    return true;
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    const conversation = await this.get(conversationId);
    return conversation ? conversation.messages.slice(-limit) : [];
  }

  private readAll() {
    return readJsonFile<Conversation[]>(this.conversationsFile, []);
  }

  private writeAll(conversations: Conversation[]) {
    return writeJsonFile(this.conversationsFile, conversations);
  }
}
