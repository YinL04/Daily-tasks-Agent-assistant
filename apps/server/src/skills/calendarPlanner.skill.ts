import { addMinutes, nextDayAt } from "../utils/time.js";
import type { CalendarEvent, PlannedTask, Skill } from "../agent/types.js";

export const calendarPlannerSkill: Skill<PlannedTask[], CalendarEvent[]> = {
  name: "calendar_planner",
  description: "把任务转换成适合周视图展示的日历事件。",
  async execute(tasks) {
    const events: CalendarEvent[] = [];
    let cursor = nextDayAt(9);

    for (const task of tasks) {
      let remaining = task.estimatedMinutes;
      while (remaining > 0) {
        const block = Math.min(remaining, remaining > 150 ? 120 : remaining);
        if (cursor.getHours() >= 18 || cursor.getDay() === 0) {
          cursor = nextDayAt(cursor.getDay() === 6 ? 10 : 9, 0, cursor);
        }
        const end = addMinutes(cursor, block);
        events.push({
          id: `${task.id}-${events.length + 1}`,
          taskId: task.id,
          title: task.title,
          start: cursor.toISOString(),
          end: end.toISOString(),
          priority: task.priority,
          description: task.description
        });
        remaining -= block;
        cursor = addMinutes(end, 30);
      }
    }
    return events;
  }
};
