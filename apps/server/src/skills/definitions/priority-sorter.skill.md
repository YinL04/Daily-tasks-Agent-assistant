---
name: priority_sorter
title: 优先级排序 Skill
description: 根据依赖关系、截止日期和优先级对任务排序。
input: PlannedTask[]
output: PlannedTask[]
---

## 目标

把已经拆解好的任务排成更适合执行的顺序。

## 排序规则

- 被依赖的任务排在依赖它的任务之前。
- `dueDate` 按字符串升序比较；当前 runtime 没有额外推断日期语义。
- 同一截止日期下按 `high`、`medium`、`low` 排序。
- 上述条件都相同的任务保留原始相对顺序。
- 不要丢失原任务字段，不要改变任务含义。

## 输出要求

返回排序后的 `PlannedTask[]`。当前 runtime 不做循环依赖检测；如果需要检测循环依赖，应在后续实现或建议生成阶段显式补充。
