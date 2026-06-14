import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { generatedExportsDir, generatedPlansDir } from "../storage/db.js";
import { safeFilename } from "../utils/validation.js";

const router = Router();

async function listFiles(dir: string) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

function resolveGeneratedFile(filename: string) {
  const safe = safeFilename(filename);
  if (!safe || safe !== filename || !/\.(md|json|csv|ics)$/i.test(filename)) return undefined;
  const base = filename.endsWith(".md") ? generatedPlansDir : generatedExportsDir;
  const resolvedBase = path.resolve(base);
  const filePath = path.resolve(path.join(resolvedBase, filename));
  if (!filePath.startsWith(`${resolvedBase}${path.sep}`)) return undefined;
  return filePath;
}

router.get("/", async (_req, res) => {
  const names = [...(await listFiles(generatedPlansDir)), ...(await listFiles(generatedExportsDir))];
  const files = await Promise.all(
    names
      .sort()
      .reverse()
      .map(async (filename) => {
        const filePath = resolveGeneratedFile(filename);
        const stat = filePath ? await fs.stat(filePath).catch(() => undefined) : undefined;
        return {
          filename,
          type: filename.endsWith(".md")
            ? "markdown"
            : filename.endsWith(".json")
              ? "json"
              : filename.endsWith(".csv")
                ? "csv"
                : "ics",
          size: stat?.size ?? 0,
          updatedAt: stat?.mtime.toISOString(),
          downloadUrl: `/api/files/${encodeURIComponent(filename)}`
        };
      })
  );
  res.json(files);
});

router.post("/cleanup", async (req, res, next) => {
  try {
    const { olderThanDays } = z.object({ olderThanDays: z.number().int().min(0).default(30) }).parse(req.body);
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const names = [...(await listFiles(generatedPlansDir)), ...(await listFiles(generatedExportsDir))];
    const deleted: string[] = [];
    for (const filename of names) {
      const filePath = resolveGeneratedFile(filename);
      if (!filePath) continue;
      const stat = await fs.stat(filePath).catch(() => undefined);
      if (stat && stat.mtime.getTime() < cutoff) {
        await fs.unlink(filePath);
        deleted.push(filename);
      }
    }
    res.json({ deleted, count: deleted.length });
  } catch (error) {
    next(error);
  }
});

router.delete("/:filename", async (req, res) => {
  const filePath = resolveGeneratedFile(req.params.filename);
  if (!filePath) return res.status(403).json({ error: "Access denied" });
  try {
    await fs.unlink(filePath);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

router.get("/:filename", async (req, res) => {
  const filePath = resolveGeneratedFile(req.params.filename);
  if (!filePath) return res.status(403).json({ error: "Access denied" });
  try {
    await fs.access(filePath);
    res.download(filePath, req.params.filename);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
