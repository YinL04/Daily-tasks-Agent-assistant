import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MemoryManager } from "../memory/memoryManager.js";
import { MemoryStore } from "../memory/memoryStore.js";
import { GoalStore } from "../storage/goalStore.js";
import { ReviewStore } from "../storage/reviewStore.js";
import { TemplateStore } from "../storage/templateStore.js";

async function tempFile(name: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pap-v2x-"));
  return path.join(dir, name);
}

test("MemoryManager keeps inferred memories pending and retrieves only active memories", async () => {
  process.env.MEMORY_LLM_TOPK = "false";
  const manager = new MemoryManager(new MemoryStore(await tempFile("memories.json")));

  const inferred = await manager.maybeInferMemories("我希望晚上学习，并且计划尽量详细");
  assert.ok(inferred.length >= 1);
  assert.equal(inferred[0].status, "pending");

  await manager.create({
    type: "preference",
    key: "preferred_city",
    value: "天津",
    confidence: 0.9,
    source: "user_explicit",
    status: "active",
    layer: "long",
    hitCount: 0
  });

  const relevant = await manager.retrieveRelevant("下周去天津");
  assert.equal(relevant.length, 1);
  assert.equal(relevant[0].key, "preferred_city");
  assert.equal((await manager.stats()).pending, inferred.length);
});

test("TemplateStore combines built-in templates with custom templates", async () => {
  const store = new TemplateStore(await tempFile("templates.json"));
  const created = await store.create({
    title: "自定义健康计划",
    category: "health",
    prompt: "帮我安排一周运动和饮食复盘。",
    defaultOptions: { generateFiles: true, generateCalendar: true, useMemory: true }
  });
  const list = await store.list();
  assert.ok(list.some((item) => item.id === created.id));
  assert.ok(list.some((item) => item.id === "template-study-plan"));
});

test("GoalStore and ReviewStore persist long-term planning records", async () => {
  const goalStore = new GoalStore(await tempFile("goals.json"));
  const reviewStore = new ReviewStore(await tempFile("reviews.json"));
  const goal = await goalStore.create({
    title: "完成 Agent v2",
    description: "把 v2 系列能力做成闭环",
    horizon: "quarterly",
    status: "active",
    tags: ["agent"],
    reviewCycle: "weekly",
    nextReviewAt: new Date().toISOString()
  });
  const review = await reviewStore.create({
    goalId: goal.id,
    title: "第一周复盘",
    summary: "完成会话和记忆管理",
    wins: ["测试通过"],
    blockers: [],
    nextActions: ["补 CI"]
  });
  assert.equal((await goalStore.list())[0].title, "完成 Agent v2");
  assert.equal((await reviewStore.list())[0].goalId, goal.id);
  assert.equal(review.nextActions[0], "补 CI");
});
