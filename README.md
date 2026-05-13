


# 日常事务 Agent 助手

一个本地可运行的个人事务规划 MVP。用户输入自然语言事务、目标、待办、链接或文件需求后，后端 Agent 会构建上下文、读取可见记忆、按 Markdown skill 定义执行规划流程，最后生成任务、日历、网址、建议和计划文件。

当前主流程会优先使用 `.env` 中配置的 OpenAI 兼容 API 进行任务拆解和建议生成；调用失败或未配置 API Key 时才回退到本地确定性 handler。`.skill.md` 是 skill 的定义来源。

> **注意：** 本项目为早期 MVP 阶段，可能存在一些已知或未知的 bug，后续会逐步修复和完善。

## 功能

- 自然语言输入事务和目标
- Agent Harness 限制最大步骤、记录执行日志、统一错误处理
- Markdown Skills：任务拆解、优先级排序、日历规划、文件生成、网址整理、建议生成
- 长期记忆 CRUD，可区分用户显式记忆与 Agent 推断记忆
- 运行历史记录，保存每次用户输入、任务、日历、网址、建议和生成文件
- Dashboard 展示结果摘要、任务列表、周日历、网址、文件和执行日志
- 计划文件导出到 `generated/plans` 与 `generated/exports`
- OpenAI 兼容 LLM Provider 抽象，没有 API Key 也能运行

## 项目结构

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
        main.tsx
        components/
        pages/
        lib/api.ts
    server/
      src/
        index.ts
        routes/
        agent/
        skills/
          definitions/
            task-decomposer.skill.md
            priority-sorter.skill.md
            calendar-planner.skill.md
            file-writer.skill.md
            url-collector.skill.md
            recommendation.skill.md
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

Skills 定义在 `apps/server/src/skills/definitions/*.skill.md`。每个 skill 文件包含 frontmatter 和正文规则：

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
```

运行时由 `apps/server/src/skills/markdownSkill.ts` 加载这些 Markdown 定义。`apps/server/src/skills/*.skill.ts` 是当前 MVP 的本地执行 handler，用来按 Markdown 规则执行确定性逻辑并节省 LLM 调用。

更完整的 skill 编写说明见 [docs/SKILLS.md](docs/SKILLS.md)。

可通过接口查看已加载的 skill 定义：

```http
GET /api/skills
```

## Agent 流程

```text
User Input
  -> Context Builder
  -> Memory Retrieval
  -> Planner
  -> Harness
  -> Load Markdown Skill Definitions
  -> Skill Handler Execution
  -> Result Aggregation
  -> File Generation
  -> Calendar Event Generation
  -> URL List Generation
  -> Frontend
```

Harness 的结果包含 `runId`、`steps`、`finalAnswer`、`tasks`、`calendarEvents`、`urls`、`files`、`memoriesUsed` 和 `recommendations`。每个 step 都会记录状态、skill 名称、输入摘要和输出摘要，前端可以折叠查看。

## 记忆原则

长期记忆不会无条件保存所有输入，只保存稳定、重复、对未来规划有帮助的信息。敏感信息默认不保存。Agent 推断的记忆使用较低 `confidence`，并在记忆管理页允许用户查看、编辑和删除。

## 环境变量

项目会尝试读取 `personal-agent-planner/.env`，也会读取外层目录的 `.env`：

```env
LLM_API_KEY=你的密钥
LLM_MODEL_ID=模型 ID
LLM_BASE_URL=OpenAI 兼容地址
PORT=8787
```

任务拆解和执行建议会优先调用 `OpenAICompatibleProvider`。为了避免浪费模型调用，排序、日历排布、网址提取和文件生成仍然是本地确定性逻辑。

## 安装和启动

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

- `POST /api/agent/run`
- `GET /api/memories`
- `POST /api/memories`
- `PATCH /api/memories/:id`
- `DELETE /api/memories/:id`
- `GET /api/files`
- `GET /api/files/:filename`
- `GET /api/skills`
- `GET /api/runs`
- `GET /api/runs/:runId`

## 示例输入

示例 1：

```text
帮我规划下周的学习安排。我想每天学 2 小时 TypeScript，还想周三前完成一个 React 小项目，并生成一个计划文档。
```

预期行为：拆解 TypeScript 学习、React 小项目、每日学习块，生成日历事件，并输出 TypeScript Docs、React Docs、MDN 等网址。

示例 2：

```text
我要准备一次大阪旅行，帮我把订机票、订酒店、做预算、查景点和准备行李这些事排一个顺序。
```

预期行为：先安排预算、交通、住宿，再安排景点和行李；输出 Google Flights、Google Maps、Booking、Tripadvisor 等入口，并提示价格波动、证件和缓冲风险。

## 生成文件

每次运行 Agent 且 `generateFiles=true` 时会生成：

- `generated/plans/plan-{runId}.md`
- `generated/exports/result-{runId}.json`
- `generated/exports/tasks-{runId}.csv`
- `generated/exports/calendar-{runId}.ics`

前端“生成文件”面板可直接下载。

## 用户记录

每次运行 Agent 后会写入：

```text
data/run-history.json
```

前端“历史记录”页面可以查看过去的输入、结果、任务数量、日历事件数量和生成文件，并可打开详情。

## 后续扩展

- 将更多 Markdown skill 的 handler 切换为 LLM JSON 输出，并保留本地 fallback
- 支持导入已有任务
- 支持拖拽修改日历事件并回写任务
- 增加复盘报告和低置信度记忆一键清理
