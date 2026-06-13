# Personal Agent Planner v2 PRD 评审与优化方案

> 日期：2026-06-13  
> 对象：`docs/PRD_V2.md` 原始草案与 v2.0 落地实现  
> 结论：原草案方向正确；本轮已完成 v2.0 核心闭环，后续重点应放在记忆可信化、前端/E2E 测试和工程治理。

## 1. 总体评价

原 PRD 写得有明显优点：

- 抓住了 v2 的关键升级点：多轮对话、流式反馈、记忆系统、安全和测试。
- 对后端数据结构、API、前端改造、测试分层都有覆盖，不是只停留在产品口号。
- 能对齐现有项目基线，知道 v1 已经有 ReAct、Skills、本地存储、历史记录和基础测试。

主要问题：

- 范围过大。多轮对话、流式、中断、记忆语义化、安全、CI、Docker、SQLite 全放进 v2，会让排期和优先级失真。
- P0 过多。原文把记忆管理、语义记忆、多轮对话、实时反馈都列为 P0，但工程依赖不同，应该拆成 v2.0 和 v2.1。
- 技术细节有一处关键不一致。原文说使用 `EventSource`，但设计又沿用 `POST /api/agent/run`；`EventSource` 只能 GET。润色版已改为 `fetch` + `ReadableStream` 解析 SSE 格式。
- 验收标准不够量化。例如“越用越懂用户”“安全可部署”“测试可信赖”需要转成可验证指标。
- 记忆系统风险低估。自动推断记忆如果直接生效，会破坏用户信任；应默认 pending。
- SQLite 和 Docker 更像后续工程优化，不应阻塞核心产品闭环。

## 2. 已完成的文档优化

已重写 `docs/PRD_V2.md`，重点调整如下：

- 把状态改为 `v2.0 Revised Draft`，文档更像待评审规格。
- 增加“一句话定位”，明确它不是泛用聊天机器人。
- 把范围拆成 v2.0 必做、v2.1 应做、v2.x 后续。
- 把用户故事的 P0 收敛到会话、流式、中断三个核心体验。
- 修正流式方案：`POST` 接口采用 `fetch` stream，而不是 `EventSource`。
- 增加 `partial` 事件和非流式兼容说明。
- 明确 Conversation、Message、AgentContext 的最小数据结构。
- 增加上下文注入预算、摘要失败降级和敏感信息过滤要求。
- 把记忆系统从“自动语义记忆”改成“pending 确认机制优先”。
- 增加安全验收：超长输入、路径遍历、健康端点脱敏、Auth Token。
- 增加测试矩阵和质量门槛。
- 重排里程碑，让前 4 周先完成 v2.0 可用闭环。
- 结合本轮实现补充 v2.0 已完成项：会话、流式反馈、中断修复、左侧 LLM 状态小框、日历二级菜单、安全加固和 9 个后端核心测试。

## 2.1 本轮 v2.0 已落地的产品变化

- 多轮会话：新增会话存储、会话列表、消息写入和最近上下文注入。
- 流式反馈：Agent Run 返回步骤级事件，前端可以展示运行中状态和结果。
- 中断修复：前端 `AbortController` 与后端 abort/close 判断对齐，避免正常完成后误报“用户中断了 Agent 运行”。
- 版面收纳：LLM 连接状态从主内容区收进左侧小框；日历从主屏收进 `工作台 -> 日历` 二级菜单。
- 安全基线：输入长度限制、路径校验、健康端点脱敏、可选 `AUTH_TOKEN`、基础 Rate Limit。
- 质量基线：`npm run test` 当前通过 9 个后端测试，覆盖 Harness、ConversationStore、上下文注入、流式事件和中断行为。

## 3. 推荐产品策略

### 3.1 v2.0 先做“可对话、可观察、可停止”

这是用户体感最强、也最能证明 v2 价值的闭环。

最小闭环：

1. 创建会话。
2. 第一轮发送目标并得到结构化结果。
3. 第二轮说“预算改一下”“改成 Vue”“多加一天”，Agent 能引用前文。
4. 运行时看到步骤级进度。
5. 用户能停止运行。
6. 结果写入会话历史。

### 3.2 v2.1 再做“可信记忆”

记忆是高杠杆能力，但也最容易伤害信任。建议先让用户看见、确认、修正 Agent 记住了什么，再谈语义检索和自动晋升。

推荐原则：

- Agent 推断记忆默认 pending。
- pending 默认不参与后续规划。
- 用户确认后才进入 active。
- 敏感信息、一次性计划、不稳定事实不保存。
- 命中记忆时在结果中说明“使用了哪些记忆”。

### 3.3 工程基础按风险排序

优先级建议：

| 优先级 | 工作 | 原因 |
| --- | --- | --- |
| P0 | 输入校验、路径遍历防护、stream 错误路径测试 | 直接影响安全和可用性 |
| P0 | ConversationStore 测试、Agent 集成测试 | 直接保障 v2 核心链路 |
| P1 | Auth Token、Rate Limit、CI | 本地部署可信度 |
| P1 | 共享类型整理 | 减少前后端契约漂移 |
| P2 | Docker、SQLite、文件清理 | 重要但不应阻塞 v2.0 |

## 4. 具体实施路线

### 第 1 阶段：会话模型

交付：

- `Conversation`、`Message` 类型。
- `ConversationStore`。
- `/api/conversations` CRUD。
- `AgentRunRequest` 增加 `conversationId`。
- `buildContext` 支持最近消息注入。

验收：

- 创建会话后发送第一条消息。
- 第二条消息能读取第一条消息摘要。
- 会话列表按更新时间排序。
- Store 测试覆盖 create、addMessage、getRecentMessages、delete。

当前状态：已完成。

### 第 2 阶段：流式运行

交付：

- AgentHarness 支持 `onEvent` 回调。
- `/api/agent/run` 支持 `text/event-stream`。
- 前端使用 `fetch` stream 解析 step、observation、partial、done、error。
- 保留 JSON 兼容模式。

验收：

- 请求后 2 秒内能看到首个事件。
- 成功时收到 done 和完整 result。
- 失败时收到 error 和可读 message。
- 前端能展示步骤状态。

当前状态：已完成。

### 第 3 阶段：中断与错误态

交付：

- 前端 `AbortController`。
- 后端 close/abort 检查。
- Harness 每步前检查 abort flag。
- UI 保留 partial steps。

验收：

- 用户点击停止后 3 秒内 UI 可再次输入。
- 已完成步骤不丢失。
- 中断后不继续写文件或日历。

当前状态：已完成，并修正了 `res.close` 在正常完成后触发导致的误报问题。

### 第 4 阶段：安全与质量

交付：

- `input.max(5000)`。
- 文件下载路径白名单。
- `/api/health` 脱敏。
- 可选 `AUTH_TOKEN`。
- Agent stream、Conversation、Files 安全测试。

验收：

- 路径遍历测试全部被拒绝。
- 未授权请求返回 401。
- `npm run typecheck`、`npm run build`、`npm run test` 全部通过。

当前状态：v2.0 后端核心已完成；前端自动化和 E2E 仍建议补充。

### 第 5 阶段：记忆管理 v2.1

交付：

- `MemoryItem.status/layer/hitCount/lastHitAt`。
- pending 记忆确认、编辑、删除。
- 记忆管理页。
- LLM Top-K 语义筛选。

验收：

- 推断记忆进入 pending。
- 用户确认后变 active。
- Run 只使用 active 记忆。
- 结果显示 `memoriesUsed`。

## 5. PRD 后续还可补强的部分

- 增加 2-3 个完整用户旅程样例，例如“学习计划二轮调整”“旅行预算变更”“项目周报准备”。
- 为流式事件补一份正式 schema，而不是只给示例 JSON。
- 明确前端信息架构：会话列表、消息流、结果折叠、记忆页、历史页之间的关系。
- 补充数据迁移策略：已有 run history 如何和 conversation 关联。
- 增加降级策略：LLM 不可用时，会话、历史、记忆管理哪些功能仍可用。
- 增加埋点或本地指标采集方式，即使只写入本地 JSON，也能支撑成功指标。

## 6. 最小可执行任务清单

1. 新增 `ConversationStore` 和对应测试。
2. 新增 conversations routes。
3. 扩展 `AgentContext` 和 `buildContext`。
4. 修改 `AgentExecutor.run(input, options, conversationId, callbacks)`。
5. 为 Harness 增加事件回调。
6. 将 `/api/agent/run` 改造为可选流式响应。
7. 前端新增聊天式消息流。
8. 前端新增流式解析和停止按钮。
9. 补齐输入校验和文件下载安全测试。
10. 更新 README 的 v2 使用说明。

以上 1-10 已在 v2.0 完成或完成核心路径。下一批建议任务：

1. 为前端消息流、停止按钮、日历二级菜单补自动化测试。
2. 为 conversations 和 agent stream 路由补 API 级测试。
3. 建立 GitHub Actions，至少执行 typecheck、build、test。
4. 推进 pending/active/archived 记忆管理页。
5. 补充 Docker 或本地部署说明。
