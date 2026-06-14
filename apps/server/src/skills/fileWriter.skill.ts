import fs from "node:fs/promises";
import path from "node:path";
import { generatedExportsDir, generatedPlansDir } from "../storage/db.js";
import { formatIcsDate } from "../utils/time.js";
import type { CalendarEvent, GeneratedFile, PlannedTask, Skill, UrlReference } from "../agent/types.js";

interface FileWriterInput {
  runId: string;
  goal: string;
  finalAnswer: string;
  tasks: PlannedTask[];
  calendarEvents: CalendarEvent[];
  urls: UrlReference[];
  recommendations: string[];
}

function csvEscape(value: string | number | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function markdown(input: FileWriterInput) {
  return `# 计划文档

## 总目标

${input.goal}

## 任务列表

${input.tasks.map((task, index) => `${index + 1}. **${task.title}** (${task.priority}, ${task.estimatedMinutes} 分钟) - ${task.description}`).join("\n")}

## 时间安排

${input.calendarEvents.map((event) => `- ${event.start} - ${event.end}: ${event.title}`).join("\n")}

## 优先级说明

高优先级任务优先处理截止时间近、依赖链上游和风险较高的事项；低耗时任务可穿插在较长任务之间。

## 风险和建议

${input.recommendations.map((item) => `- ${item}`).join("\n")}

## 相关网址

${input.urls.map((url) => `- [${url.title}](${url.url})：${url.reason}`).join("\n")}

## 下一步行动

${input.finalAnswer}
`;
}

function ics(events: CalendarEvent[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Agent Planner//CN",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.id}@personal-agent-planner`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(event.start)}`,
      `DTEND:${formatIcsDate(event.end)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
      "END:VEVENT"
    ]),
    "END:VCALENDAR"
  ].join("\r\n");
}

export const fileWriterSkill: Skill<FileWriterInput, GeneratedFile[]> = {
  name: "file_writer",
  description: "生成 Markdown、JSON、CSV 和 ICS 文件。",
  async execute(input) {
    await fs.mkdir(generatedPlansDir, { recursive: true });
    await fs.mkdir(generatedExportsDir, { recursive: true });
    const files = [
      {
        filename: `plan-${input.runId}.md`,
        path: path.join(generatedPlansDir, `plan-${input.runId}.md`),
        type: "markdown" as const,
        content: markdown(input)
      },
      {
        filename: `result-${input.runId}.json`,
        path: path.join(generatedExportsDir, `result-${input.runId}.json`),
        type: "json" as const,
        content: JSON.stringify(input, null, 2)
      },
      {
        filename: `tasks-${input.runId}.csv`,
        path: path.join(generatedExportsDir, `tasks-${input.runId}.csv`),
        type: "csv" as const,
        content: [
          ["title", "description", "priority", "estimatedMinutes", "dueDate", "dependencies", "tags", "status"]
            .map(csvEscape)
            .join(","),
          ...input.tasks.map((task) =>
            [
              task.title,
              task.description,
              task.priority,
              task.estimatedMinutes,
              task.dueDate,
              task.dependencies.join("; "),
              task.tags.join("; "),
              task.status
            ]
              .map(csvEscape)
              .join(",")
          )
        ].join("\n")
      },
      {
        filename: `calendar-${input.runId}.ics`,
        path: path.join(generatedExportsDir, `calendar-${input.runId}.ics`),
        type: "ics" as const,
        content: ics(input.calendarEvents)
      }
    ];

    for (const file of files) {
      await fs.writeFile(file.path, file.content, "utf8");
    }

    return files.map(({ filename, path: filePath, type }) => ({
      filename,
      path: filePath,
      type,
      downloadUrl: `/api/files/${encodeURIComponent(filename)}`
    }));
  }
};
