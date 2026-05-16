import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentHarness } from "../agent/harness.js";
import type { CalendarEvent, PlannedTask, Skill } from "../agent/types.js";

function hasMeaningfulText(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

test("a ReAct run has complete Thought, Action and Observation coverage", async () => {
  const harness = new AgentHarness(5);

  const taskSkill: Skill<string, PlannedTask[]> = {
    name: "task_decomposer",
    description: "mock task decomposer",
    async execute(goal) {
      return [{
        id: "task-1",
        title: `规划 ${goal}`,
        description: "把目标拆成一个可执行任务。",
        priority: "high",
        estimatedMinutes: 45,
        dependencies: [],
        tags: ["planning"],
        status: "todo"
      }];
    }
  };

  const calendarSkill: Skill<PlannedTask[], CalendarEvent[]> = {
    name: "calendar_planner",
    description: "mock calendar planner",
    async execute(tasks) {
      return [{
        id: "event-1",
        taskId: tasks[0].id,
        title: tasks[0].title,
        start: "2026-05-17T09:00:00.000Z",
        end: "2026-05-17T09:45:00.000Z",
        priority: tasks[0].priority,
        description: tasks[0].description
      }];
    }
  };

  const answerSkill: Skill<{ tasks: PlannedTask[]; events: CalendarEvent[] }, string> = {
    name: "final_answer",
    description: "mock final answer",
    async execute(input) {
      return `已生成 ${input.tasks.length} 个任务和 ${input.events.length} 个日历事件。`;
    }
  };

  const tasks = await harness.runStep("ReAct: 任务拆解", taskSkill, "准备演示", "用户目标", true, {
    thought: "先理解用户目标，并拆成结构化任务。",
    action: "task_decomposer"
  });

  const events = await harness.runStep("ReAct: 日历生成", calendarSkill, tasks, "任务列表", false, {
    thought: "观察到任务后，把它们安排成可执行时间块。",
    action: "calendar_planner"
  });

  const finalAnswer = await harness.runStep("ReAct: 最终回答", answerSkill, { tasks, events }, "任务和日历", true, {
    thought: "观察到任务和日历后，生成用户能直接理解的总结。",
    action: "final_answer"
  });

  assert.equal(finalAnswer, "已生成 1 个任务和 1 个日历事件。");
  assert.equal(harness.logs.length, 3);

  const allStepsHaveReactFields = harness.logs.every((step) =>
    hasMeaningfulText(step.thought) &&
    hasMeaningfulText(step.action) &&
    hasMeaningfulText(step.observation)
  );
  assert.equal(allStepsHaveReactFields, true);

  const observationsMatchOutputs = harness.logs.map((step) => step.observation);
  assert.deepEqual(observationsMatchOutputs, [
    "输出 1 条结果",
    "输出 1 条结果",
    "输出结构化结果"
  ]);

  const actions = harness.logs.map((step) => step.action);
  assert.deepEqual(actions, ["task_decomposer", "calendar_planner", "final_answer"]);
});

test("a classic ReAct trace can follow a model-selected tool order", async () => {
  const harness = new AgentHarness(5);
  const selectedActions = ["task_decomposer", "url_collector", "priority_sorter"] as const;
  const completed: string[] = [];

  const tools: Record<typeof selectedActions[number], Skill<string, string[]>> = {
    task_decomposer: {
      name: "task_decomposer",
      description: "mock task decomposition",
      async execute(input) {
        return [`tasks for ${input}`];
      }
    },
    url_collector: {
      name: "url_collector",
      description: "mock url collection",
      async execute(input) {
        return [`urls for ${input}`];
      }
    },
    priority_sorter: {
      name: "priority_sorter",
      description: "mock priority sorting",
      async execute(input) {
        return [`sorted ${input}`];
      }
    }
  };

  for (const action of selectedActions) {
    const output = await harness.runStep(
      `ReAct: ${action}`,
      tools[action],
      "准备演示",
      "模型选择的下一步工具输入",
      action !== "priority_sorter",
      {
        thought: `模型观察当前状态后自主选择 ${action}。`,
        action
      }
    );
    completed.push(output[0]);
  }

  assert.deepEqual(harness.logs.map((step) => step.action), [...selectedActions]);
  assert.deepEqual(completed, [
    "tasks for 准备演示",
    "urls for 准备演示",
    "sorted 准备演示"
  ]);
  assert.ok(harness.logs.every((step) => step.thought?.includes("自主选择")));
});
