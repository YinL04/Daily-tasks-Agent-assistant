# Personal Agent Planner v2 产品需求文档

> 版本：v2.0 Revised Draft  
> 日期：2026-06-13  
> 状态：v2.0 已落地，v2.1 待规划  
> 目标读者：产品、研发、设计、测试、个人工具维护者

---

## 1. 产品概述

Personal Agent Planner 是一个本地运行的个人事务规划 Agent。v1 已经支持一次性 ReAct Agent Run：用户输入自然语言目标后，系统通过 Skills 生成任务、日历事件、参考链接、建议、执行日志和可下载文件。

v2 的目标不是把它扩展成泛用聊天机器人，而是把它升级为一个可持续协作的个人事务 Agent：用户可以在同一主题下多轮细化计划，实时看到 Agent 的执行进度，并管理 Agent 记住的长期偏好。

一句话定位：

> 一个本地优先、可追踪、可迭代的个人事务规划 Agent。

## 2. 当前基线

### 2.1 已实现能力

- 单次 ReAct Agent Run：输入、拆任务、排序、日历、链接、建议、总结、文件输出。
- 6 个 Skill：`task_decomposer`、`priority_sorter`、`calendar_planner`、`url_collector`、`recommendation`、`file_writer`。
- 本地 JSON 存储：运行历史、日历事件、记忆、会话消息。
- React 工作台、历史记录页、左侧 LLM 连接状态小框、工作台二级菜单日历。
- 聊天式消息流、运行步骤反馈、停止运行、会话列表。
- ReAct Harness、ConversationStore、上下文注入、流式事件和中断行为测试，当前质量文档记录为 9 个测试全部通过。

### 2.2 主要短板

| 维度 | 当前问题 | v2 改进方向 |
| --- | --- | --- |
| 对话 | v2.0 已支持同一主题下延续上下文 | 后续补摘要压缩、历史迁移、搜索 |
| 反馈 | v2.0 已支持步骤级流式反馈 | 后续补前端自动化测试和更细粒度状态 |
| 记忆 | 正则推断和子串匹配，误存风险较高 | 分层、待确认、可管理、语义筛选 |
| 安全 | 已增加输入限制、路径校验、健康端点脱敏、可选 Token 和基础限流 | 后续补更完整安全矩阵和部署说明 |
| 测试 | 已覆盖后端核心链路，缺少前端/E2E 自动化 | Store、API、Executor、前端、E2E 分层补齐 |
| 工程 | 类型重复、无 lint/CI、根路径定位脆弱 | 共享类型、CI、工程规范化 |

## 3. v2 目标与非目标

### 3.1 产品目标

1. 支持主题化多轮对话，Agent 能引用最近上下文并增量调整计划。
2. 支持流式执行反馈，用户能看到 ReAct 步骤、状态、错误和最终结果。
3. 支持可解释、可管理的记忆系统，让用户确认、修改或删除 Agent 推断出的偏好。
4. 支持本地部署时的基础安全能力，降低同网访问、路径遍历和信息泄露风险。
5. 建立可信的质量基线，让核心能力可以被自动化测试验证。

### 3.2 v2 非目标

- 不做多用户、团队协作、云同步、账号体系。
- 不做真实外部日历双向同步。
- 不承诺实时价格、票务、政策、营业时间、交通班次等不稳定信息准确。
- 不引入复杂项目管理能力，如甘特图、资源负载、跨项目容量规划。
- 不把 SQLite、向量数据库和多模型编排作为 v2 必做项；它们进入后续阶段。

## 4. 用户与场景

### 4.1 核心用户

- 独立开发者、学生、知识工作者：需要把学习、旅行、写作、项目推进等目标快速落成计划。
- Agent 工程学习者：希望观察 ReAct、Skills、Memory、Harness 的真实协作过程。
- 本地工具重度用户：希望数据留在本地，并能导出文件继续使用。

### 4.2 核心用户故事

| 编号 | 用户故事 | 优先级 | 验收口径 |
| --- | --- | --- | --- |
| US-01 | 我想创建一个主题会话，并在里面多轮细化计划 | P0 | 第二轮输入能引用第一轮目标和结果 |
| US-02 | 我想实时看到 Agent 当前执行到哪一步 | P0 | 运行中至少展示 step、observation、done/error 事件 |
| US-03 | 我想中断正在运行的 Agent，并保留已产生的结果 | P0 | 用户点击停止后，前端停止等待，后端返回可读中断状态或部分结果 |
| US-04 | 我想查看、确认、修改、删除 Agent 推断出的记忆 | P1 | 推断记忆默认 pending，确认后才进入长期记忆 |
| US-05 | 我想通过简单 token 保护本地服务 | P1 | 配置 `AUTH_TOKEN` 后 API 未授权请求返回 401 |
| US-06 | 我想用 Docker 一键启动服务 | P2 | `docker compose up` 后可访问前端和 API |

## 5. 范围分层

### 5.1 v2.0 已完成

- 会话与消息模型。
- 对话历史注入 AgentContext。
- `POST /api/agent/run` 的流式响应。
- 前端聊天式工作台和运行进度展示。
- 中断运行。
- 输入长度限制、文件下载路径校验、健康端点脱敏、可选 `AUTH_TOKEN`、基础 Rate Limit。
- ConversationStore、Agent Run、stream 事件和中断行为的自动化测试。
- 左侧 LLM 连接状态小框。
- 日历收进 `工作台 -> 日历` 二级菜单，避免占用主对话区空间。

### 5.2 v2.1 应做

- 记忆分层：pending、active、archived。
- 记忆管理页：确认、编辑、归档、删除。
- LLM-based Top-K 语义筛选，暂不引入向量库。
- Auth Token、Rate Limit、CI、ESLint/Prettier。

### 5.3 v2.x 后续

- SQLite 迁移。
- Docker 打包。
- 生成文件自动清理。
- 外部日历导入导出。
- 场景模板、长期目标追踪、周期性复盘。

## 6. 功能需求

### 6.1 会话与消息

新增 `Conversation` 和 `Message`，用于承载同一主题下的多轮规划。

```ts
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  runId?: string;
  runResult?: HarnessRunResult;
  createdAt: string;
}
```

验收标准：

- 用户可以创建、查看、重命名、删除会话。
- 每条用户消息触发一次 Agent Run。
- Run 完成后，assistant 消息写入同一会话。
- 会话列表按 `updatedAt` 倒序展示。

### 6.2 上下文注入

`AgentContext` 增加对话历史字段：

```ts
interface AgentContext {
  runId: string;
  input: string;
  now: string;
  memories: MemoryItem[];
  conversationHistory?: ConversationTurn[];
  conversationSummary?: string;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
```

上下文策略：

1. 默认注入最近 6 轮消息。
2. assistant 消息只注入 `finalAnswer`、任务摘要、日历摘要，避免塞入完整大对象。
3. 超过预算时保留最近 2 轮，并把更早内容压缩为摘要。
4. 摘要失败时降级为只注入最近消息，不阻断 Run。

验收标准：

- 第二轮输入如“预算改成 8000”时，Agent 能知道上一轮主题。
- 上下文压缩失败不影响当前 Run。
- 注入内容不包含 API Key、`.env`、本地绝对路径等敏感信息。

### 6.3 流式执行反馈

继续使用 `POST /api/agent/run`，响应体采用 `text/event-stream` 格式。前端使用 `fetch` + `ReadableStream` 解析事件。由于 `EventSource` 只支持 GET，本版本不使用原生 `EventSource` 发送 Run 请求。

事件协议：

```text
event: step
data: {"type":"step","stepIndex":0,"name":"ReAct: task_decomposer","status":"running","thought":"...","action":"task_decomposer"}

event: observation
data: {"type":"observation","stepIndex":0,"status":"success","observation":"输出 5 个任务"}

event: partial
data: {"type":"partial","tasks":[...],"calendarEvents":[...]}

event: done
data: {"type":"done","result":{...HarnessRunResult}}

event: error
data: {"type":"error","message":"可读错误","partialResult":{...}}
```

验收标准：

- 首个事件在请求成功后 2 秒内返回，LLM 首次决策较慢时也应返回 queued/running 事件。
- 前端能展示当前步骤、成功/失败状态和最终结果。
- 错误通过 `error` 事件返回，并尽量附带 `partialResult`。
- 非流式兼容模式可保留，但 v2 UI 默认使用流式模式。

### 6.4 中断运行

前端通过 `AbortController` 中断请求。后端监听 `req.aborted` 与未完成响应的 `res.close`，避免正常 `done` 后误判为用户中断；Agent Harness 在每个步骤前检查中断状态。

验收标准：

- 用户点击停止后，按钮状态恢复，输入框可继续使用。
- 已完成的步骤仍展示在当前消息中。
- 后端不继续写入后续文件或日历事件，除非结果已经进入提交阶段。

### 6.5 记忆系统

v2.0 只接入会话上下文；v2.1 升级记忆系统。

```ts
interface MemoryItem {
  id: string;
  type: "preference" | "habit" | "constraint" | "profile" | "project" | "other";
  key: string;
  value: string;
  confidence: number;
  source: "user_explicit" | "agent_inferred";
  status: "pending" | "active" | "archived";
  layer: "working" | "long";
  hitCount: number;
  lastHitAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

规则：

- Agent 推断记忆默认 `status=pending`，不直接进入长期记忆。
- 用户确认后变为 `active`。
- 敏感信息、一次性需求、不稳定事实不写入记忆。
- 语义检索先用 LLM Top-K 方案，不在 v2.1 引入向量库。

验收标准：

- 用户可以查看待确认记忆，并进行确认、编辑、删除。
- Run 结果展示使用了哪些 active 记忆。
- 待确认记忆不会被用于后续规划，除非用户允许。

### 6.6 安全加固

要求：

- `runSchema.input` 限制为 1-5000 字。
- `conversationId`、`memoryId` 等 ID 使用 UUID 或明确格式校验。
- 文件下载使用白名单目录和扩展名，不允许路径遍历。
- `/api/health` 不返回 base URL、API Key、完整环境变量。
- 配置 `AUTH_TOKEN` 后，所有 `/api` 请求需要 `Authorization: Bearer <token>`。
- Agent Run 增加基础 Rate Limit。

验收标准：

- `../`、URL 编码路径、反斜杠路径均无法越权下载文件。
- 超长输入返回 400。
- 未授权请求返回 401。
- 健康端点只返回必要状态。

### 6.7 前端体验

工作台从“一次性表单 + 结果面板”升级为“会话列表 + 消息流 + 结构化结果”。v2.0 还把占空间的连接状态和日历从主内容区移走：LLM 状态收纳为左侧小框，日历收进 `工作台` 的二级菜单。

主要区域：

- 左侧：新建会话、会话列表、LLM 连接状态小框、工作台入口、日历二级菜单、历史记录。
- 中间：消息流，每条 assistant 消息可展开任务、日历、链接、建议、文件和执行日志。
- 底部：输入框、发送、停止、运行选项。

验收标准：

- 移动端和桌面端文字不重叠。
- 运行中能看到进度，停止按钮可用。
- 失败时保留用户输入和已返回步骤。
- 长结果默认折叠，避免消息流过长。

## 7. API 需求

### 7.1 新增端点

```text
POST   /api/conversations
GET    /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id
DELETE /api/conversations/:id

GET    /api/memories/stats
POST   /api/memories/:id/confirm
POST   /api/memories/:id/archive
```

### 7.2 修改端点

```text
POST /api/agent/run
body: {
  input: string;
  options?: AgentOptions;
  conversationId?: string;
  stream?: boolean;
}
response:
  stream=true  -> text/event-stream
  stream=false -> application/json
```

说明：如果为了兼容现有前端保留 JSON 响应，建议通过 `stream` 或 `Accept` 头区分，而不是让同一路由在无约定情况下返回两种格式。

## 8. 数据与存储

v2.0 继续使用 JSON 文件，新增：

```text
data/conversations.json
```

存储要求：

- 写入使用 write-then-rename，避免半写入损坏。
- Store 方法需要覆盖 create、list、get、update、delete。
- 单个 Conversation 过大时，list 只返回摘要，不返回完整 messages。
- SQLite 迁移作为后续任务，不阻塞 v2.0。

## 9. 非功能需求

| 类别 | 指标 | 目标 |
| --- | --- | --- |
| 流式反馈 | 首个事件延迟 | P95 < 2 秒 |
| 会话切换 | 列表到详情渲染 | P95 < 300ms |
| 可靠性 | LLM 失败 | 返回可读错误或部分结果 |
| 安全 | 文件下载 | 0 个路径遍历漏洞 |
| 隐私 | 日志/文件 | 不写入 API Key 和环境变量 |
| 可维护性 | 类型检查 | `npm run typecheck` 通过 |
| 质量 | 后端核心覆盖率 | v2.0 >= 60%，v2.1 >= 70% |

## 10. 测试策略

v2.0 必须补齐：

| 层级 | 测试范围 | 示例 |
| --- | --- | --- |
| 单元测试 | ConversationStore、路径校验、输入校验 | create/list/addMessage/getRecentMessages |
| 集成测试 | Agent Run + Mock LLM + Conversation | 第二轮能看到第一轮上下文 |
| API 测试 | conversations、agent stream、files | 400/401/404/stream done/error |
| 前端测试 | 消息流、停止按钮、错误态 | 运行中展示 step，停止后恢复输入 |
| E2E | 新建会话、发送两轮、查看结果 | Playwright 核心路径 |

当前 v2.0 已完成后端核心测试 9 个，覆盖 Harness 成功/失败/最大步数、ReAct trace、ConversationStore、上下文注入、流式事件和中断行为。前端与 E2E 自动化仍属于后续补强项。

质量门槛：

- PR 合入前必须通过 `npm run typecheck`、`npm run build`、`npm run test`。
- 流式接口至少覆盖 success、error、abort 三种路径。
- 安全测试必须覆盖路径遍历和超长输入。

## 11. 里程碑

| 阶段 | 周期 | 交付内容 | 验收标准 |
| --- | --- | --- | --- |
| M1 | 第 1 周 | ConversationStore、API、AgentContext 对话注入 | 可创建会话并完成两轮上下文 Run |
| M2 | 第 2 周 | 流式 Run、步骤事件、前端进度展示 | 运行中可看到 step/observation/done |
| M3 | 第 3 周 | 中断支持、错误态、部分结果保留 | 用户可停止 Run，UI 状态恢复 |
| M4 | 第 4 周 | 安全加固和核心测试 | 输入、文件、认证、stream 测试通过 |
| M5 | 第 5 周 | 记忆管理 v2.1 基础版 | pending 记忆可确认、编辑、删除 |
| M6 | 第 6 周 | CI、lint、Docker 预研或落地 | CI 绿灯，部署说明可执行 |

## 12. 成功指标

产品指标：

- 二轮对话成功率：第二轮请求能正确引用前文的比例。
- 运行可见性：用户在 Run 完成前看到至少一个进度事件的比例。
- 中断成功率：用户点击停止后 3 秒内 UI 恢复可操作的比例。
- 记忆确认率：pending 记忆被用户确认或编辑的比例。
- 运行失败率：Agent Run 返回 error 的比例。

工程指标：

- 自动化测试通过率。
- 核心 API 覆盖率。
- 文件下载安全用例通过率。
- 平均首事件延迟。
- 构建与类型检查通过率。

## 13. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
| --- | --- | --- | --- |
| v2 范围过大导致延期 | 高 | 交付失焦 | 拆成 v2.0、v2.1、v2.x，先交付会话和流式反馈 |
| `EventSource` 与 POST 不匹配 | 高 | 前后端方案返工 | 采用 fetch stream，或另建 GET 事件通道 |
| 对话历史导致 token 超限 | 中 | LLM 报错或成本上升 | 摘要 + 最近消息 + 硬预算 |
| 记忆误存影响后续规划 | 中 | 用户信任下降 | pending 机制、敏感信息过滤、用户确认 |
| JSON 存储并发写入冲突 | 中 | 数据损坏 | 原子写入、写队列；SQLite 延后但保留迁移路线 |
| 流式响应在代理后被缓冲 | 中 | 进度不可见 | 文档说明代理配置，测试本地直连优先 |

## 14. 开放问题

| 编号 | 问题 | 建议 |
| --- | --- | --- |
| Q1 | 流式输出是否需要逐 token？ | v2.0 只做 ReAct 步骤级，后续再做 token 级 |
| Q2 | 非流式 JSON 响应是否保留？ | 保留一个版本周期，避免破坏现有调用 |
| Q3 | 记忆推断是否默认开启？ | 默认开启但只进入 pending，不自动生效 |
| Q4 | SQLite 是否纳入 v2.0？ | 不纳入，先用 JSON 原子写入降低风险 |
| Q5 | 是否支持多用户？ | 不支持，当前产品定位为单用户本地工具 |
