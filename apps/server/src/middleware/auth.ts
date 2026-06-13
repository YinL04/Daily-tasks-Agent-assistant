import type { NextFunction, Request, Response } from "express";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = process.env.AUTH_TOKEN;
  if (!token) return next();

  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "") || String(req.query.token || "");
  if (provided !== token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
