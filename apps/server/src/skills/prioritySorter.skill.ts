import type { PlannedTask, Skill } from "../agent/types.js";

const score = { high: 0, medium: 1, low: 2 };

export const prioritySorterSkill: Skill<PlannedTask[], PlannedTask[]> = {
  name: "priority_sorter",
  description: "根据优先级、依赖和截止日期排序任务。",
  async execute(tasks) {
    const byTitle = new Map(tasks.map((task, index) => [task.title, index]));
    return [...tasks].sort((a, b) => {
      if (b.dependencies.includes(a.title)) return -1;
      if (a.dependencies.includes(b.title)) return 1;
      const due = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      if (due !== 0) return due;
      const priority = score[a.priority] - score[b.priority];
      return priority !== 0 ? priority : (byTitle.get(a.title) ?? 0) - (byTitle.get(b.title) ?? 0);
    });
  }
};
