# ReAct Agent 质量评估报告

本文记录当前 `Personal Agent Planner` 的 ReAct loop、Harness 和文档化测试覆盖范围。它只描述已经由代码或测试支撑的事实，避免把未覆盖能力写成保证。

## 1. 当前实现边界

当前后端已经从固定流水线改为经典 ReAct 形态：

- `AgentExecutor` 维护运行状态，并在每轮调用 `decideNextAction()`。
- LLM 根据用户输入、当前状态、上一轮 Observation、可用工具和 `allowedActions` 返回 `thought` 与 `action`。
- `AgentExecutor` 只接受 `allowedActions` 中的 action；如果 LLM 决策失败或格式不合法，会使用保守的确定性 fallback。
- `AgentHarness` 执行被选中的 Skill，并记录 Thought / Action / Observation、状态、错误和时间戳。
- 运行结果仍聚合为 `HarnessRunResult`，供前端、历史记录和文件下载能力使用。

需要注意：当前测试不直接调用真实 LLM，也不覆盖完整 API 端到端流程。它们验证的是 Harness 可靠性、ReAct trace 字段，以及“工具顺序可以由外部决策选择”的基础能力。

## 2. 测试文件

测试文件：

- `apps/server/src/__tests__/agent-harness.test.ts`
- `apps/server/src/__tests__/react-quality.test.ts`

测试脚本：

- 根目录：`npm run test`
- 后端 workspace：`npm run test -w apps/server`

## 3. 测试覆盖点

### 3.1 Harness 成功路径

测试名：

```text
AgentHarness records a successful ReAct step
```

验证内容：

- Skill 正常执行后返回结果。
- `status` 被记录为 `success`。
- `thought`、`action`、`observation` 被写入 step log。
- `observation` 与输出摘要一致。
- `usedLLM`、`startedAt` 和 `endedAt` 被记录。

### 3.2 Harness 错误路径

测试名：

```text
AgentHarness records an error as the ReAct observation
```

验证内容：

- Skill 抛错时，错误继续向外抛出。
- Step 状态变为 `error`。
- 错误消息写入 `error`。
- Observation 写成 `执行失败：...`。

### 3.3 最大步数保护

测试名：

```text
AgentHarness stops execution after the max ReAct step count
```

验证内容：

- `AgentHarness(1)` 只允许执行一步。
- 第二步抛出 `Agent exceeded max steps: 1`。
- 被拦截的第二步不会新增到日志中。

### 3.4 ReAct 字段完整性

测试名：

```text
a ReAct run has complete Thought, Action and Observation coverage
```

验证内容：

- 构造一个小型 ReAct trace。
- 每一步都包含非空 `thought`、`action` 和 `observation`。
- Observation 能反映 Skill 输出。
- Action 顺序符合测试中显式指定的顺序。

### 3.5 可变工具顺序

测试名：

```text
a classic ReAct trace can follow a model-selected tool order
```

验证内容：

- 测试显式模拟一个外部决策序列。
- Harness 可以按该序列执行不同工具。
- 日志中的 action 与外部决策顺序一致。

这个测试不等同于真实 LLM 端到端测试；它验证的是 ReAct runtime 的执行日志能够承载模型选择出的工具顺序。

## 4. 当前测试结果

执行命令：

```bash
npm.cmd run test
```

最近一次结果：

```text
tests 5
pass 5
fail 0
```

执行命令：

```bash
npm.cmd run typecheck
```

最近一次结果：

```text
server typecheck passed
web typecheck passed
```

执行命令：

```bash
npm.cmd run build
```

最近一次结果：

```text
server build passed
web build passed
```

## 5. 有效性结论

根据当前测试，可以确认：

- Harness 成功路径和失败路径都有可观测日志。
- 最大步数保护有效。
- `thought / action / observation` 字段有后端测试覆盖。
- ReAct trace 可以记录非固定的工具顺序。
- TypeScript 类型检查没有破坏前后端契约。

不能从当前测试推出的结论：

- 真实 LLM 一定会按最佳工具顺序行动。
- 每次运行都一定会生成文件。
- 所有 LLM 依赖工具都有完整本地 fallback。
- 端到端 API、前端渲染和日历 CRUD 都已经被自动化测试覆盖。

## 6. 后续可补充评估

更完整的质量评估可以继续增加：

- 使用可注入 Mock LLM Provider 的 `AgentExecutor.run()` 端到端测试。
- 决策层测试：验证非法 action、空 JSON、重复 action 时 fallback 行为。
- 针对旅行规划、防幻觉提示词的 fixture 测试。
- 前端执行日志渲染测试。
- 日历 CRUD 的 API 集成测试。
