import { Router } from "express";
import { skillDefinitions } from "../skills/index.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(skillDefinitions.map(({ raw: _raw, ...definition }) => definition));
});

export default router;
