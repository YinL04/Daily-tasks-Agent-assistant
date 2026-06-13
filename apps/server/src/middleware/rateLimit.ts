import type { NextFunction, Request, Response } from "express";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }

    if (record.count >= maxPerMinute) {
      return res.status(429).json({ error: "Too many requests" });
    }

    record.count += 1;
    next();
  };
}
