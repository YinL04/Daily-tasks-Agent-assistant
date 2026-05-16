import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentHarness } from "../agent/harness.js";
import type { Skill } from "../agent/types.js";

test("AgentHarness records a successful ReAct step", async () => {
  const harness = new AgentHarness(3);
  const skill: Skill<{ goal: string }, string[]> = {
    name: "mock_task_decomposer",
    description: "mock skill",
    async execute(input) {
      return [`拆解 ${input.goal}`];
    }
  };

  const output = await harness.runStep(
    "ReAct: mock task decomposition",
    skill,
    { goal: "学习 TypeScript" },
    "用户目标",
    true,
    {
      thought: "先把用户目标拆成可执行任务。",
      action: "mock_task_decomposer"
    }
  );

  assert.deepEqual(output, ["拆解 学习 TypeScript"]);
  assert.equal(harness.logs.length, 1);
  assert.equal(harness.logs[0].status, "success");
  assert.equal(harness.logs[0].thought, "先把用户目标拆成可执行任务。");
  assert.equal(harness.logs[0].action, "mock_task_decomposer");
  assert.equal(harness.logs[0].observation, "输出 1 条结果");
  assert.equal(harness.logs[0].usedLLM, true);
  assert.ok(harness.logs[0].startedAt);
  assert.ok(harness.logs[0].endedAt);
});

test("AgentHarness records an error as the ReAct observation", async () => {
  const harness = new AgentHarness(3);
  const skill: Skill<void, string> = {
    name: "failing_skill",
    description: "mock failure",
    async execute() {
      throw new Error("工具调用失败");
    }
  };

  await assert.rejects(
    () => harness.runStep(
      "ReAct: failing action",
      skill,
      undefined,
      "无输入",
      false,
      {
        thought: "验证失败时 observation 是否记录错误。",
        action: "failing_skill"
      }
    ),
    /工具调用失败/
  );

  assert.equal(harness.logs.length, 1);
  assert.equal(harness.logs[0].status, "error");
  assert.equal(harness.logs[0].thought, "验证失败时 observation 是否记录错误。");
  assert.equal(harness.logs[0].action, "failing_skill");
  assert.equal(harness.logs[0].observation, "执行失败：工具调用失败");
  assert.equal(harness.logs[0].error, "工具调用失败");
});

test("AgentHarness stops execution after the max ReAct step count", async () => {
  const harness = new AgentHarness(1);
  const skill: Skill<string, string> = {
    name: "echo",
    description: "echo skill",
    async execute(input) {
      return input;
    }
  };

  await harness.runStep("ReAct: first", skill, "ok", "first input", false, {
    thought: "执行第一步。",
    action: "echo"
  });

  await assert.rejects(
    () => harness.runStep("ReAct: second", skill, "blocked", "second input", false, {
      thought: "这一步应该被最大步数限制拦截。",
      action: "echo"
    }),
    /Agent exceeded max steps: 1/
  );

  assert.equal(harness.logs.length, 1);
});
