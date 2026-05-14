# Personal Agent Planner

一个本地可运行的个人事务规划 Agent 项目。用户输入自然语言目标、待办、链接或文件需求后，后端会构建运行上下文，检索长期记忆，按 Markdown Skill 定义编排任务拆解、优先级排序、日历规划、网址整理、建议生成和文件导出，前端展示一次完整 Agent Run 的结果与执行日志。

## 项目亮点

- 上下文工程：`Context Builder` 将用户输入、当前时间、相关记忆组合成统一 `AgentContext`，供后续 Skill 共享。
- Agent Harness：限制最大执行步数，记录每一步的状态、Skill 名称、输入摘要、输出摘要和是否使用 LLM，方便调试与面试讲解。
- Markdown Skills：Skill 的职责、输入输出和执行规则写在 `*.skill.md` 中，代码 handler 负责执行，做到“规则可读、执行可控”。
- LLM + 本地降级：任务拆解、网址整理、建议和总结优先使用 OpenAI 兼容接口；没有 API Key 或调用失败时仍能用本地规则跑通主流程。
- 长期记忆：后端保留记忆检索和低置信度推断能力，用于增强后续上下文；前端默认不展示记忆管理，避免把内部上下文状态暴露成主要产品界面。
- 可编辑日历：Agent 生成的日历事件会保存到本地日历，用户可以在前端新增、修改和删除安排。
- 可交付输出：每次运行可生成 Markdown 计划、JSON 结果、CSV 任务和 ICS 日历文件，并写入历史记录。
- 工程边界清晰：前后端 workspace、类型定义、路由、存储、LLM Provider、Skills、生成目录和文档分层明确。

## 当前完成度

已完成：

- 自然语言输入到结构化任务、可编辑日历事件、网址建议和执行建议的完整链路。
- Agent 执行日志、LLM 连接状态、运行历史和生成文件下载。
- OpenAI 兼容 Provider 抽象，可通过环境变量替换模型和 base URL。
- 长期记忆的后端 CRUD、相关记忆检索和自动推断入口。
- Markdown Skill 定义加载与本地确定性 handler。
- 旅行建议支持候选城市和景点方向推荐，并在 prompt 中约束不要编造价格、营业时间、交通班次等不稳定信息。

## 技术栈

- 前端：React、TypeScript、Vite、lucide-react
- 后端：Node.js、Express、TypeScript、Zod
- 存储：本地 JSON 文件
- Agent：Context Builder、Planner、Harness、Markdown Skills、LLM Provider
- LLM：OpenAI Compatible Chat Completions API

## 架构流程

```text
User Input
  -> Context Builder
     - runId
     - input
     - current time
     - relevant memories
  -> Planner
     - choose skill sequence
  -> Agent Harness
     - max step guard
     - step logs
     - error boundary
  -> Skill Execution
     - task decomposition
     - priority sorting
     - calendar planning
     - URL collection
     - recommendations
     - file generation
  -> Result Aggregation
  -> Run History
  -> Web UI
```

一次运行返回的核心结构：

```ts
interface HarnessRunResult {
  runId: string;
  steps: AgentStepLog[];
  finalAnswer: string;
  tasks: PlannedTask[];
  calendarEvents: CalendarEvent[];
  urls: UrlReference[];
  files: GeneratedFile[];
  memoriesUsed: MemoryItem[];
  recommendations: string[];
  llmStatus?: LLMStatus;
}
```

## 目录结构

```text
personal-agent-planner/
  README.md
  .env.example
  package.json
  docs/
    SKILLS.md
  apps/
    web/
      src/
        App.tsx
        pages/
        components/
        lib/api.ts
    server/
      src/
        index.ts
        routes/
        agent/
          context.ts
          planner.ts
          harness.ts
          executor.ts
          types.ts
        skills/
          definitions/
          *.skill.ts
          markdownSkill.ts
        memory/
        storage/
        llm/
        utils/
  data/
  generated/
    plans/
    exports/
```

## Markdown Skills

Skill 定义位于 `apps/server/src/skills/definitions/*.skill.md`，用于描述每个能力的职责、输入输出和规则。例如：

```md
---
name: task_decomposer
title: 任务拆解 Skill
description: 将用户的自然语言目标拆解成可执行任务。
input: AgentContext
output: PlannedTask[]
---

## 规则

- 每个任务必须包含 title、description、priority、estimatedMinutes、dueDate、dependencies 和 tags。
- 不要把敏感信息写入长期记忆或生成文件。
```

运行时由 `apps/server/src/skills/markdownSkill.ts` 加载 Markdown 定义，`apps/server/src/skills/*.skill.ts` 提供当前 MVP 的执行 handler。完整写法见 [docs/SKILLS.md](docs/SKILLS.md)。

## 上下文与记忆设计

记忆不是产品主界面的一部分，而是 Agent 的上下文增强层：

- `MemoryManager.retrieveRelevant(input)` 为当前输入检索相关记忆。
- `buildContext()` 把相关记忆放入 `AgentContext.memories`。
- `taskDecomposerSkill` 在 prompt 中读取这些上下文，辅助任务拆解。
- `maybeInferMemories(input)` 只保存稳定、重复、对未来规划有帮助的信息，并使用较低置信度标记 Agent 推断记忆。

## 环境变量

项目会读取 `personal-agent-planner/.env`，也兼容读取外层目录的 `.env`。

```env
LLM_API_KEY=你的密钥
LLM_MODEL_ID=模型 ID
LLM_BASE_URL=https://api.openai.com/v1
PORT=8787
```

如果没有配置 `LLM_API_KEY`，后端仍会启动，Agent 会用本地规则生成可用结果。

## 安装与启动

```bash
cd personal-agent-planner
npm install
npm run dev
```

打开：

- 前端：http://127.0.0.1:5173
- 后端健康检查：http://127.0.0.1:8787/api/health

也可以分别启动：

```bash
npm run dev:server
npm run dev:web
```

Windows PowerShell 如果禁止运行 `npm.ps1`，可以使用：

```bash
npm.cmd run dev
```

## API

- `POST /api/agent/run`：运行一次 Agent。
- `GET /api/agent/llm-status`：检查 LLM Provider 连通性。
- `GET /api/files`：列出生成文件。
- `GET /api/files/:filename`：下载生成文件。
- `GET /api/skills`：查看已加载 Skill 定义。
- `GET /api/runs`：查看运行历史摘要。
- `GET /api/runs/:runId`：查看单次运行详情。
- `GET /api/calendar`、`POST /api/calendar`、`PATCH /api/calendar/:id`、`DELETE /api/calendar/:id`：读取、新增、编辑和删除本地日历事件。
- `GET /api/memories`、`POST /api/memories`、`PATCH /api/memories/:id`、`DELETE /api/memories/:id`：后端记忆管理接口，默认不在前端展示。

## 示例输入

```text
帮我规划下周的学习安排。我想每天学 2 小时 TypeScript，还想周三前完成一个 React 小项目，并生成一个计划文档。
```

预期行为：

- 拆解 TypeScript 学习、React 小项目、复盘和交付任务。
- 按优先级排序，并生成一周日历安排。
- 推荐 TypeScript、React、MDN 等学习入口。
- 生成 Markdown、JSON、CSV 和 ICS 文件。

```text
我要准备一次大阪旅行，帮我把订机票、订酒店、做预算、查景点和准备行李这些事排一个顺序。
```

预期行为：

- 先安排预算、交通和住宿，再安排景点和行李。
- 生成旅行准备时间线和可导入日历的事件。
- 推荐航班、地图、酒店和景点查询入口。
- 提醒价格波动、证件和缓冲时间等风险。

## 生成文件

当 `generateFiles=true` 时，每次运行会写入：

- `generated/plans/plan-{runId}.md`
- `generated/exports/result-{runId}.json`
- `generated/exports/tasks-{runId}.csv`
- `generated/exports/calendar-{runId}.ics`

这些都是运行产物，默认被 `.gitignore` 忽略；仓库只保留 `.gitkeep` 以维持目录结构。
