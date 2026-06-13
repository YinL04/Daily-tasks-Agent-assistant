# Personal Agent Planner

一个本地可运行的个人事务规划 Agent。用户输入自然语言目标、待办、旅行准备、学习计划、链接或文件需求后，系统会构建上下文，检索长期记忆，并通过经典 ReAct 循环让 LLM 在每一轮从可用工具中选择下一步 Action；工具执行后产生 Observation，再回到模型继续决策。

v2.0 已经从“一次性规划工作台”升级为“会话式个人事务 Agent”：支持多轮对话、流式执行反馈、会话历史注入、可中断运行和更紧凑的前端布局。

## 本次 v2.0 更新

- 新增会话系统：支持创建会话、会话列表、消息持久化、assistant 结果写回同一会话。
- 支持多轮上下文：`AgentContext` 会注入最近会话历史，用户可以在后续消息里说“预算改一下”“换成下周”。
- 支持流式运行：`POST /api/agent/run` 可返回 `text/event-stream`，前端实时展示 `step`、`observation`、`partial`、`done`、`error`。
- 支持中断运行：前端使用 `AbortController`，后端 Harness 会在步骤边界检查 abort signal。
- 修复自动中断问题：流式路由不再把正常 POST 请求关闭误判为用户取消。
- 前端改成聊天式界面：左侧会话列表，中间消息流，底部输入框。
- LLM 状态收纳到左侧小框：主内容区不再被大状态面板占用。
- 日历收进二级菜单：左侧 `工作台 -> 日历` 单独打开，不再占据对话首屏。
- 安全加固：输入长度限制、文件下载白名单、健康端点脱敏、可选 `AUTH_TOKEN`、Agent Run 基础 rate limit。
- 测试补强：新增 `ConversationStore` 测试和 Harness 事件/中断测试。

## 项目亮点

- 上下文工程：`Context Builder` 将用户输入、当前时间、相关记忆和最近会话历史组合成统一 `AgentContext`。
- 经典 ReAct 自主循环：`AgentExecutor` 每轮把当前状态、上一轮 Observation、可用工具和 `allowedActions` 交给 LLM，由模型返回 Thought / Action。
- 执行可观测：`AgentHarness` 包裹每个 Skill 调用，限制步数、检查中断、记录状态，并向前端推送步骤事件。
- Markdown Skills：Skill 的职责、输入输出和执行规则写在 `*.skill.md` 中，代码 handler 负责执行，做到“规则可读、执行可控”。
- LLM 驱动：工具选择、任务拆解、网址整理、建议和总结优先使用 OpenAI 兼容接口。
- 本地持久化：会话、运行历史、日历、记忆和生成文件都保存在本地。
- 可编辑日历：Agent 生成的日历事件会保存到本地日历，用户可以在 `工作台 -> 日历` 中新增、修改和删除安排。
- 可交付输出：当 ReAct 循环调用 `file_writer` 且 `generateFiles` 未关闭时，可生成 Markdown、JSON、CSV 和 ICS 文件。

## 当前完成度

已完成：

- 会话式前端工作台、会话列表和消息流。
- Agent Run 流式输出与实时步骤渲染。
- 多轮对话上下文注入。
- Agent Run 中断支持。
- LLM 连接状态小型侧边栏展示。
- 独立日历二级页面。
- OpenAI 兼容 Provider，可通过环境变量替换模型和 base URL。
- 长期记忆的后端 CRUD、相关记忆检索和自动推断入口。
- Markdown Skill 定义加载与 TypeScript runtime handler。
- 运行历史、生成文件下载、日历 CRUD。
- 基础安全加固和自动化测试。

仍待加强：

- 记忆管理前端页和 pending 确认机制。
- 更完整的 API 集成测试和前端组件测试。
- Docker/CI/SQLite 迁移。

## 技术栈

- 前端：React、TypeScript、Vite、lucide-react
- 后端：Node.js、Express、TypeScript、Zod
- 存储：本地 JSON 文件
- Agent：Classic ReAct Loop、Context Builder、Conversation Context、Harness、Markdown Skills、LLM Provider
- LLM：OpenAI Compatible Chat Completions API

## 架构流程

```text
User Message
  -> ConversationStore
     - create/list/get conversations
     - append user / assistant messages
  -> Context Builder
     - runId
     - input
     - current time
     - relevant memories
     - recent conversation history
  -> ReAct Loop
     -> AgentExecutor
        - ask LLM to choose next Thought / Action
        - validate Action against allowedActions
     -> AgentHarness
        - max step guard
        - abort guard
        - Thought / Action / Observation logs
        - stream events
     -> Skill Execution
        - task decomposition
        - priority sorting
        - calendar planning
        - URL collection
        - recommendations
        - final answer
        - optional file generation
     -> Observation
        - feed back into next ReAct turn
  -> Result Aggregation
  -> Run History
  -> Conversation Message
  -> Web UI
```

一次运行返回的核心结构：

```ts
interface HarnessRunResult {
  runId: string;
  agentPattern: "react";
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

流式事件：

```ts
type AgentRunEvent =
  | { type: "step"; step: AgentStepLog }
  | { type: "observation"; step: AgentStepLog }
  | { type: "partial"; result: Partial<HarnessRunResult> }
  | { type: "done"; result: HarnessRunResult; conversationId?: string }
  | { type: "error"; message: string; partialResult?: Partial<HarnessRunResult> };
```

## 目录结构

```text
personal-agent-planner/
  README.md
  .env.example
  package.json
  docs/
    PRD.md
    PRD_V2.md
    PRD_V2_OPTIMIZATION_PLAN.md
    SKILLS.md
    AGENT_ENGINEERING.md
    QUALITY_EVALUATION.md
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
          agent.routes.ts
          conversation.routes.ts
          files.routes.ts
          memory.routes.ts
        agent/
          context.ts
          planner.ts
          harness.ts
          executor.ts
          types.ts
        storage/
          conversationStore.ts
          calendarStore.ts
          runHistoryStore.ts
        skills/
          definitions/
            *.skill.md
          *.skill.ts
          markdownSkill.ts
        __tests__/
        memory/
        llm/
        middleware/
        utils/
  data/
  generated/
    plans/
    exports/
```

## 前端界面

- 左侧：
  - LLM 连接状态小框。
  - 新对话按钮。
  - 会话列表。
  - 工作台一级入口。
  - 工作台二级入口：`对话`、`日历`。
  - 历史记录。
- 主区域：
  - 对话页只展示消息流、结构化结果、执行日志和输入框。
  - 日历页单独展示周视图和手动新增/编辑入口。

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

- 每个任务必须包含 title、description、priority、estimatedMinutes、dependencies 和 tags；有明确截止日期时再包含 dueDate。
- 不要把敏感信息写入长期记忆或生成文件。
```

运行时由 `apps/server/src/skills/markdownSkill.ts` 加载 Markdown 定义，`apps/server/src/skills/*.skill.ts` 提供执行 handler。完整写法见 [docs/SKILLS.md](docs/SKILLS.md)。

## 上下文、会话与记忆

会话用于承载多轮对话，记忆用于跨会话保留偏好：

- `ConversationStore` 管理 `data/conversations.json`。
- 每次用户消息会写入当前会话。
- Agent 完成后，assistant 消息和完整 `runResult` 写回会话。
- `buildContext()` 会把最近消息压缩成 `conversationHistory`。
- `MemoryManager.retrieveRelevant(input)` 为当前输入检索相关记忆。
- `maybeInferMemories(input)` 只保存稳定、重复、对未来规划有帮助的信息，并使用较低置信度标记 Agent 推断记忆。

## 环境变量

项目会读取 `personal-agent-planner/.env`，也兼容读取外层目录的 `.env`。

```env
LLM_API_KEY=你的密钥
LLM_MODEL_ID=模型 ID
LLM_BASE_URL=https://api.openai.com/v1
PORT=8787
AUTH_TOKEN=可选，设置后所有 /api 请求需要 Bearer token
```

如果没有配置 `LLM_API_KEY`，后端仍会启动，前端也会显示 LLM 未连接状态；但经典 ReAct 的下一步工具选择依赖 LLM，一次有效的 Agent Run 需要配置可用模型。

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

- `POST /api/agent/run`：运行一次 Agent。支持普通 JSON 响应和 `stream=true` 的 SSE 格式响应。
- `GET /api/agent/run`：返回 405，并提示使用 POST。
- `GET /api/agent/llm-status`：检查 LLM Provider 连通性。
- `POST /api/conversations`：创建会话。
- `GET /api/conversations`：获取会话摘要列表。
- `GET /api/conversations/:id`：获取会话详情。
- `PATCH /api/conversations/:id`：修改会话标题。
- `DELETE /api/conversations/:id`：删除会话。
- `GET /api/files`：列出生成文件。
- `GET /api/files/:filename`：下载生成文件，带路径白名单校验。
- `GET /api/skills`：查看已加载 Skill 定义。
- `GET /api/runs`：查看运行历史摘要。
- `GET /api/runs/:runId`：查看单次运行详情。
- `GET /api/calendar`、`POST /api/calendar`、`PATCH /api/calendar/:id`、`DELETE /api/calendar/:id`：读取、新增、编辑和删除本地日历事件。
- `GET /api/memories`、`POST /api/memories`、`PATCH /api/memories/:id`、`DELETE /api/memories/:id`：后端记忆管理接口。

## 测试与构建

```bash
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

当前测试覆盖：

- Harness 成功、失败、最大步数限制。
- Harness 事件推送和 abort signal。
- ReAct trace 字段完整性。
- ConversationStore 创建、消息写入、摘要列表和删除。

## 示例输入

```text
帮我规划下周的学习安排。我想每天学 2 小时 TypeScript，还想周三前完成一个 React 小项目，并生成一个计划文档。
```

配置可用 LLM 后的预期行为：

- 拆解 TypeScript 学习、React 小项目、复盘和交付任务。
- 按优先级排序，并生成一周日历安排。
- 推荐 TypeScript、React、MDN 等学习入口。
- 在模型选择文件生成工具且 `generateFiles` 未关闭时，生成 Markdown、JSON、CSV 和 ICS 文件。

```text
我要准备一次大阪旅行，帮我把订机票、订酒店、做预算、查景点和准备行李这些事排一个顺序。
```

配置可用 LLM 后的预期行为：

- 先安排预算、交通和住宿，再安排景点和行李。
- 在 `generateCalendar` 未关闭时，生成旅行准备时间线和可导入日历的事件。
- 推荐航班、地图、酒店和景点查询入口。
- 提醒价格波动、证件和缓冲时间等风险。

## 生成文件

当 `generateFiles` 未关闭且 ReAct 循环调用 `file_writer` 时，运行会写入：

- `generated/plans/plan-{runId}.md`
- `generated/exports/result-{runId}.json`
- `generated/exports/tasks-{runId}.csv`
- `generated/exports/calendar-{runId}.ics`

这些都是运行产物，默认被 `.gitignore` 忽略；仓库只保留 `.gitkeep` 以维持目录结构。
