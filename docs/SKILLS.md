# Markdown Skill 编写说明

本项目的 skill 由 Markdown 文件定义，位置在：

```text
apps/server/src/skills/definitions/*.skill.md
```

TypeScript 文件负责运行时执行，Markdown 文件负责描述 skill 的身份、输入输出契约和行为规则。经典 ReAct 循环会把当前可用 skill 作为工具列表交给 LLM，由模型每轮选择下一步 Action；后端会校验 action 是否在 `allowedActions` 中。任务拆解、工具选择、网址建议、执行建议和最终总结会优先使用 `.env` 中配置的 OpenAI 兼容 API；如果没有可用模型，后端可以启动并展示连接状态，但一次有效的自主 Agent Run 需要可用 LLM。

## 文件格式

每个 skill 文件必须包含 frontmatter：

```md
---
name: task_decomposer
title: 任务拆解 Skill
description: 将用户的自然语言目标拆解成可执行任务。
input: AgentContext
output: PlannedTask[]
---

## 目标

把用户输入拆成清晰、可执行、可安排到日历里的任务。

## 规则

- 优先输出 3-7 个任务。
- 每个任务包含优先级、预计耗时、依赖关系和标签；如果用户给出明确日期，再补充截止日期。
- 如果输入比较模糊，先创建澄清目标和成功标准的任务。
```

字段说明：

- `name`：运行时 skill 名称，ReAct 决策 prompt、`AgentExecutor` 工具路由和 Harness step log 会使用它。
- `title`：面向人类阅读的标题。
- `description`：skill 的短描述，会被 Markdown 绑定后的运行时 skill 暴露出来；当前 Planner 元数据和 ReAct 工具说明都会使用它。
- `input`：输入契约，例如 `AgentContext`、`PlannedTask[]`。
- `output`：输出契约，例如 `PlannedTask[]`、`CalendarEvent[]`。
- 正文：给 handler 或未来 LLM 执行器使用的规则、约束和输出要求。

## 已有 Skills

- `task-decomposer.skill.md`：把用户输入拆成任务。
- `priority-sorter.skill.md`：按依赖、截止日期和优先级排序任务。
- `calendar-planner.skill.md`：把任务转换成日历事件。
- `file-writer.skill.md`：生成 Markdown、JSON、CSV、ICS 文件。
- `url-collector.skill.md`：提取用户 URL 并补充常用参考入口。
- `recommendation.skill.md`：生成下一步建议。

## 加载方式

加载器位于：

```text
apps/server/src/skills/markdownSkill.ts
```

`withMarkdownDefinition(runtimeSkill, filename)` 会读取 `.skill.md`，并把 Markdown 中的 `name`、`description`、`input`、`output` 和正文挂到运行时 skill 上。

聚合入口位于：

```text
apps/server/src/skills/index.ts
```

新增 skill 时，需要在这里导入本地 handler，并绑定对应 Markdown 文件。

## 新增 Skill 步骤

1. 在 `apps/server/src/skills/definitions/` 新增 `your-skill.skill.md`。
2. 在 `apps/server/src/skills/` 新增 `yourSkill.skill.ts`，实现 `Skill<I, O>`。
3. 在 `apps/server/src/skills/index.ts` 中使用 `withMarkdownDefinition` 绑定它。
4. 如果需要让计划元数据包含这个 skill，在 `apps/server/src/agent/planner.ts` 中加入对应 step。
5. 在 `apps/server/src/agent/executor.ts` 的工具 runtime 列表中接入这个 skill，定义它的输入、输出写回逻辑、可用条件和是否使用 LLM。
6. 确认 `decideNextAction()` 的工具说明能让模型理解何时选择它。
7. 运行 `npm.cmd run typecheck` 和 `npm.cmd run build`。

## 使用 LLM 执行

当前任务拆解和执行建议会读取 Markdown prompt，并把 prompt 和结构化输入交给 `LLMProvider.generateJSON`；网址整理也会调用 `generateJSON` 生成推荐链接。示例：

```ts
const result = await provider.generateJSON<PlannedTask[]>(
  `${skill.definition.prompt}\n\nInput:\n${JSON.stringify(input)}`,
  skill.definition.output
);
```

工程上建议为高风险 LLM skill 保留 fallback：当 LLM 没有返回合法 JSON、网络失败或没有配置 API Key 时，应该能退回本地规则或给出清晰错误。当前 ReAct 决策层已经有保守的确定性 fallback，部分工具也是本地确定性 skill；但不是每个 LLM skill 都已经实现完整业务级 fallback，新增 skill 时应显式说明其失败行为。

## 设计原则

- Markdown 负责“规则和契约”，TypeScript 负责“执行和校验”。
- 不要在 Markdown skill 中写 API Key、`.env` 内容或敏感信息。
- 输出要求要尽量结构化，便于校验和前端展示。
- 对高成本 LLM skill 设置清晰边界，避免每次规划都调用大模型。
