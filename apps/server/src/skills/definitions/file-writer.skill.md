---
name: file_writer
title: 文件生成 Skill
description: 生成 Markdown、JSON、CSV 和 ICS 计划文件。
input: Aggregated agent result
output: GeneratedFile[]
---

## 目标

当 ReAct 循环选择 `file_writer` 且文件生成未关闭时，把 Agent 的聚合结果写成用户可下载和复用的计划文件。

## 当前 runtime 生成的文件

- Markdown 计划文档
- JSON 结构化结果
- CSV 任务表
- ICS 日历文件

## Markdown 内容要求

- 总目标
- 任务列表
- 时间安排
- 优先级说明
- 风险和建议
- 相关网址
- 下一步行动

## 安全规则

- 不要把 `.env`、API Key、访问令牌或敏感信息写入生成文件。
- 只能写入 `generated/plans` 和 `generated/exports` 目录。
- 文件名必须安全，避免 path traversal。
