import fs from "node:fs";
import path from "node:path";
import type { Skill } from "../agent/types.js";

export interface MarkdownSkillDefinition {
  name: string;
  title: string;
  description: string;
  input: string;
  output: string;
  prompt: string;
  raw: string;
}

function parseFrontMatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { attrs: new Map<string, string>(), body: raw };
  const attrs = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length)
      attrs.set(
        key.trim(),
        rest
          .join(":")
          .trim()
          .replace(/^["']|["']$/g, "")
      );
  }
  return { attrs, body: match[2] };
}

export function loadMarkdownSkill(filename: string): MarkdownSkillDefinition {
  const candidates = [
    path.resolve(process.cwd(), "src", "skills", "definitions", filename),
    path.resolve(process.cwd(), "apps", "server", "src", "skills", "definitions", filename),
    path.resolve(process.cwd(), "dist", "skills", "definitions", filename)
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error(`Markdown skill not found: ${filename}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const { attrs, body } = parseFrontMatter(raw);
  return {
    name: attrs.get("name") || filename.replace(/\.skill\.md$/, ""),
    title: attrs.get("title") || attrs.get("name") || filename,
    description: attrs.get("description") || "",
    input: attrs.get("input") || "structured input",
    output: attrs.get("output") || "structured output",
    prompt: body.trim(),
    raw
  };
}

export function withMarkdownDefinition<I, O>(
  runtimeSkill: Skill<I, O>,
  filename: string
): Skill<I, O> & { definition: MarkdownSkillDefinition } {
  const definition = loadMarkdownSkill(filename);
  return {
    ...runtimeSkill,
    name: definition.name,
    description: definition.description || runtimeSkill.description,
    definition
  };
}
