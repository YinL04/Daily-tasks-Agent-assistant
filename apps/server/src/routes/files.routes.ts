import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
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

router.get("/", async (_req, res) => {
  const names = [...await listFiles(generatedPlansDir), ...await listFiles(generatedExportsDir)];
  res.json(names.sort().reverse().map((filename) => ({
    filename,
    type: filename.endsWith(".md") ? "markdown" : filename.endsWith(".json") ? "json" : filename.endsWith(".csv") ? "csv" : "ics",
    downloadUrl: `/api/files/${encodeURIComponent(filename)}`
  })));
});

router.get("/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);
  if (!filename || filename !== req.params.filename || !/\.(md|json|csv|ics)$/i.test(filename)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const base = filename.endsWith(".md") ? generatedPlansDir : generatedExportsDir;
  const resolvedBase = path.resolve(base);
  const filePath = path.resolve(path.join(resolvedBase, filename));
  if (!filePath.startsWith(`${resolvedBase}${path.sep}`)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    await fs.access(filePath);
    res.download(filePath, filename);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
