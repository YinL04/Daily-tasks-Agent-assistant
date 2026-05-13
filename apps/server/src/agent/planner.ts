import type { AgentContext, AgentOptions, AgentPlan } from "./types.js";
import {
  calendarPlannerSkill,
  fileWriterSkill,
  prioritySorterSkill,
  recommendationSkill,
  taskDecomposerSkill,
  urlCollectorSkill
} from "../skills/index.js";

export function createPlan(context: AgentContext, options: AgentOptions): AgentPlan {
  const steps = [
    { skillName: taskDecomposerSkill.name, reason: taskDecomposerSkill.description },
    { skillName: prioritySorterSkill.name, reason: prioritySorterSkill.description }
  ];
  if (options.generateCalendar !== false) {
    steps.push({ skillName: calendarPlannerSkill.name, reason: calendarPlannerSkill.description });
  }
  steps.push({ skillName: urlCollectorSkill.name, reason: urlCollectorSkill.description });
  steps.push({ skillName: recommendationSkill.name, reason: recommendationSkill.description });
  if (options.generateFiles !== false) {
    steps.push({ skillName: fileWriterSkill.name, reason: fileWriterSkill.description });
  }

  return {
    goal: context.input,
    intent: "mixed",
    steps
  };
}
