---
name: calendar_planner
title: 日历规划 Skill
description: 将计划任务转换成可展示的日历事件。
input: PlannedTask[]
output: CalendarEvent[]
---

## 目标

把任务安排到日历中，让用户能在周视图里看到具体执行时间。当前 runtime 使用从明天上午开始的连续时间块进行排程。

## 规则

- 默认从下一天 9:00 开始安排任务。
- 单个时间块最长约 120 分钟；较长任务会拆成多个时间块。
- 当时间推进到 18:00 之后，切到下一天继续安排。
- 如果排到周日，切到下一天继续安排。
- 事件之间按顺序生成，不应重叠。
- 日历事件必须保留 `taskId`、`priority` 和可读的 `description`。
- 输出应同时适合前端周视图展示和后续 ICS 导出。

## 输出要求

返回 `CalendarEvent[]`。每个事件至少包含标题、开始时间、结束时间、任务 ID、优先级和描述。
