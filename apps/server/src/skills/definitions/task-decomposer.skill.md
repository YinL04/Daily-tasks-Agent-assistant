---
name: task_decomposer
title: 任务拆解 Skill
description: 将用户的自然语言目标拆解成可执行任务。
input: AgentContext
output: PlannedTask[]
---

## 目标

把用户输入的具体事务拆成可执行、可安排到日历的任务。

## 规则

- 每个任务必须包含 `title`、`description`、`priority`、`estimatedMinutes`、`dueDate`、`dependencies` 和 `tags`。
- 任务必须完全贴合用户输入的具体内容，禁止输出与用户场景无关的通用任务。
- title 和 description 要包含用户提到的具体细节（人名、地点、时间、数量、工具等）。
- `estimatedMinutes` 根据任务实际复杂度估算，不要所有任务都写同一个值。
- 高风险、高价值、有明确截止日期、或会阻塞后续步骤的任务应设为 `high`。
- MVP 场景下优先输出 3-7 个任务，避免过碎。
- 不要把敏感信息写入长期记忆或生成文件。

## 输出要求

只返回结构化任务数组，每条任务必须针对用户输入的具体场景。
