import { calendarPlannerSkill as calendarPlannerRuntime } from "./calendarPlanner.skill.js";
import { fileWriterSkill as fileWriterRuntime } from "./fileWriter.skill.js";
import { prioritySorterSkill as prioritySorterRuntime } from "./prioritySorter.skill.js";
import { recommendationSkill as recommendationRuntime } from "./recommendation.skill.js";
import { taskDecomposerSkill as taskDecomposerRuntime } from "./taskDecomposer.skill.js";
import { urlCollectorSkill as urlCollectorRuntime } from "./urlCollector.skill.js";
import { withMarkdownDefinition } from "./markdownSkill.js";

export const taskDecomposerSkill = withMarkdownDefinition(taskDecomposerRuntime, "task-decomposer.skill.md");
export const prioritySorterSkill = withMarkdownDefinition(prioritySorterRuntime, "priority-sorter.skill.md");
export const calendarPlannerSkill = withMarkdownDefinition(calendarPlannerRuntime, "calendar-planner.skill.md");
export const fileWriterSkill = withMarkdownDefinition(fileWriterRuntime, "file-writer.skill.md");
export const urlCollectorSkill = withMarkdownDefinition(urlCollectorRuntime, "url-collector.skill.md");
export const recommendationSkill = withMarkdownDefinition(recommendationRuntime, "recommendation.skill.md");

export const skillDefinitions = [
  taskDecomposerSkill.definition,
  prioritySorterSkill.definition,
  calendarPlannerSkill.definition,
  fileWriterSkill.definition,
  urlCollectorSkill.definition,
  recommendationSkill.definition
];
