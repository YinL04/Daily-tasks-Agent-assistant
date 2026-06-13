import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ConversationStore } from "../storage/conversationStore.js";

async function createStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pap-conversations-"));
  return new ConversationStore(path.join(dir, "conversations.json"));
}

test("ConversationStore creates conversations and stores ordered messages", async () => {
  const store = await createStore();
  const conversation = await store.create();

  await store.addUserMessage(conversation.id, "帮我规划 TypeScript 学习");
  await store.addUserMessage(conversation.id, "预算改成 500");

  const saved = await store.get(conversation.id);
  assert.ok(saved);
  assert.equal(saved.title, "帮我规划 TypeScript 学习");
  assert.equal(saved.messages.length, 2);
  assert.deepEqual(saved.messages.map((message) => message.content), [
    "帮我规划 TypeScript 学习",
    "预算改成 500"
  ]);

  const recent = await store.getRecentMessages(conversation.id, 1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].content, "预算改成 500");
});

test("ConversationStore lists summaries and deletes conversations", async () => {
  const store = await createStore();
  const first = await store.create("first");
  const second = await store.create("second");

  await store.addUserMessage(first.id, "第一条");
  await store.addUserMessage(second.id, "第二条");

  const list = await store.list();
  assert.equal(list.length, 2);
  assert.equal(list[0].title, "second");
  assert.equal(list[0].messageCount, 1);

  assert.equal(await store.delete(first.id), true);
  assert.equal(await store.delete("missing"), false);
  assert.equal((await store.list()).length, 1);
});
