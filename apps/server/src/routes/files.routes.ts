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
  const base = filename.endsWith(".md") ? generatedPlansDir : generatedExportsDir;
  const filePath = path.join(base, filename);
  res.download(filePath, filename);
});

export default router;
