---
name: calendar_planner
title: 日历规划 Skill
description: 将计划任务转换成可展示的日历事件。
input: PlannedTask[]
output: CalendarEvent[]
---

## 目标

把任务安排到日历中，让用户能在周视图里看到具体执行时间。

## 规则

- 默认使用工作时段安排任务。
- 周末可以安排学习、旅行准备、复盘、健身等低协作任务。
- 长任务需要拆成多个较短时间块。
- 事件之间不能重叠。
- 日历事件必须保留 `taskId`、`priority` 和可读的 `description`。
- 输出应同时适合前端周视图展示和后续 ICS 导出。

## 输出要求

返回 `CalendarEvent[]`。每个事件至少包含标题、开始时间、结束时间、任务 ID、优先级和描述。
