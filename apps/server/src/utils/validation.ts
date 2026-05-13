import path from "node:path";

export function safeFilename(name: string) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function requireNonEmptyInput(input: string) {
  if (!input || !input.trim()) {
    const error = new Error("请输入要规划的事务或目标。");
    error.name = "ValidationError";
    throw error;
  }
}

export function asArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}
