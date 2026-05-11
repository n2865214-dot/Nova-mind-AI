import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export interface AuthedRequest extends Request {
  userId: string;
}

/** Hard auth — 401 if no session */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

/**
 * Soft auth — works for signed-in AND anonymous users.
 * Signed-in: userId = Clerk userId.
 * Anonymous: userId = stable guest_<hash> derived from IP + user-agent.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (auth?.userId) {
    (req as AuthedRequest).userId = auth.userId;
    next();
    return;
  }
  // Build a stable anonymous ID from network fingerprint
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "0.0.0.0";
  const ua = (req.headers["user-agent"] ?? "").slice(0, 40);
  const raw = `${ip}|${ua}`;
  // Simple deterministic hash (djb2-style, no crypto overhead)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
  const guestId = `guest_${(hash >>> 0).toString(36)}`;
  (req as AuthedRequest).userId = guestId;
  next();
}
