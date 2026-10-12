import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "./prisma.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function ensureDefaultAdmin(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;
  await prisma.user.create({
    data: { username: "admin", passwordHash: hashPassword("admin123"), role: "admin" },
  });
  console.warn("已创建默认管理员 admin / admin123，请登录后尽快修改密码！");
}

export type AuthedRequest = Request & { user?: User };

function extractToken(req: Request): string | null {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  prisma.session
    .findUnique({ where: { token }, include: { user: true } })
    .then(async (session) => {
      if (!session) {
        res.status(401).json({ error: "未登录" });
        return;
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        await prisma.session.delete({ where: { token } }).catch(() => {});
        res.status(401).json({ error: "登录已过期，请重新登录" });
        return;
      }
      req.user = session.user;
      next();
    })
    .catch(next);
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "需要管理员权限" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "没有操作权限" });
      return;
    }
    next();
  };
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

export function publicUser(user: User) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

/** 返回用户被分配的店铺 id 列表；admin 返回 null 表示不限制 */
export async function allowedStoreIds(user: User): Promise<number[] | null> {
  if (user.role === "admin") return null;
  const scopes = await prisma.userScope.findMany({ where: { userId: user.id } });
  const ids = (level: string) => scopes.filter((s) => s.level === level).map((s) => s.nodeId);
  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { id: { in: ids("store") } },
        { cityId: { in: ids("city") } },
        { city: { brandId: { in: ids("brand") } } },
      ],
    },
    select: { id: true },
  });
  return stores.map((s) => s.id);
}
