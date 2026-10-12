import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { candidateInclude, parseCandidateInput } from "./candidateInput.js";
import {
  allowedStoreIds,
  createSession,
  ensureDefaultAdmin,
  hashPassword,
  publicUser,
  requireAdmin,
  requireAuth,
  requireRole,
  verifyPassword,
  type AuthedRequest,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const uploadsDir = path.join(rootDir, "uploads");
const isProd = process.argv.includes("--prod");
const PORT = Number(process.env.PORT) || (isProd ? 3000 : 3001);

const app = express();
app.use(express.json({ limit: "1mb" }));

// 生产环境通过 nginx 以 /faHr/ 前缀访问；本地直跑时剥掉该前缀，保持两种路径都可用
app.use((req, _res, next) => {
  if (req.path.startsWith("/faHr/api/")) req.url = req.url.slice(5);
  next();
});

type Handler = (req: Request, res: Response) => Promise<void> | void;
const h =
  (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

function parseId(value: unknown): number | null {
  const n = Number(String(value ?? ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}

app.get(
  "/api/org",
  requireAuth,
  h(async (req, res) => {
    const role = (req as AuthedRequest).user?.role;
    // 店长/客户hr 不算 HRS 内部用户，组织树只统计已发布人员
    const publishedOnly = req.query.published === "1" || role === "manager" || role === "hr";
    const storeInclude: Prisma.StoreInclude = publishedOnly
      ? { _count: { select: { candidates: { where: { resumeToken: { not: null } } } } } }
      : { _count: { select: { candidates: true } } };
    const brands = await prisma.brand.findMany({
      orderBy: { id: "asc" },
      include: {
        cities: {
          orderBy: { id: "asc" },
          include: {
            stores: {
              orderBy: { id: "asc" },
              include: storeInclude,
            },
          },
        },
      },
    });
    // 非管理员只能看到被分配店铺所属的品牌/城市节点
    const scope = await allowedStoreIds((req as AuthedRequest).user!);
    const scoped = scope
      ? brands
          .map((b) => ({
            ...b,
            cities: b.cities
              .map((c) => ({ ...c, stores: c.stores.filter((s) => scope.includes(s.id)) }))
              .filter((c) => c.stores.length > 0),
          }))
          .filter((b) => b.cities.length > 0)
      : brands;
    res.json({ brands: scoped });
  }),
);

function validName(body: unknown): string | null {
  const name = String((body as Record<string, unknown> | null)?.name ?? "").trim();
  return name || null;
}

function isDupError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function isMissingError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

// ---- 认证 ----

app.post(
  "/api/auth/login",
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }
    const token = await createSession(user.id);
    res.json({ token, user: publicUser(user) });
  }),
);

// 照片静态资源保持公开（<img> 标签无法携带 Authorization 头，文件名为 UUID 不可枚举）
app.use(
  "/api/uploads",
  express.static(uploadsDir, { immutable: true, maxAge: "365d" }),
);

// ---- 电子简历（候选人凭 token 公开访问，无需登录） ----

const RESUME_SELECT = {
  id: true,
  name: true,
  gender: true,
  age: true,
  phone: true,
  photo: true,
  status: true,
  acceptedSlotId: true,
  store: { select: { name: true, city: { select: { name: true, brand: { select: { name: true } } } } } },
  workExperiences: { orderBy: { id: "asc" as const } },
  interviewSlots: { orderBy: { startAt: "asc" as const } },
};

app.get(
  "/api/resume/:token",
  h(async (req, res) => {
    const candidate = await prisma.candidate.findUnique({
      where: { resumeToken: req.params.token },
      select: RESUME_SELECT,
    });
    if (!candidate) {
      res.status(404).json({ error: "链接无效或已过期" });
      return;
    }
    res.json({ candidate });
  }),
);

app.post(
  "/api/resume/:token/interview-response",
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const accept = Boolean(body.accept);
    const slotId = parseId(body.slotId);
    const candidate = await prisma.candidate.findUnique({
      where: { resumeToken: req.params.token },
      include: { interviewSlots: true },
    });
    if (!candidate) {
      res.status(404).json({ error: "链接无效或已过期" });
      return;
    }
    if (candidate.status !== "PENDING") {
      res.status(400).json({ error: "当前状态无法操作，请刷新页面" });
      return;
    }
    if (accept) {
      if (!slotId || !candidate.interviewSlots.some((s) => s.id === slotId)) {
        res.status(400).json({ error: "请选择要接受的面试时间" });
        return;
      }
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { status: "ACCEPTED", acceptedSlotId: slotId },
      });
    } else {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { status: "DECLINED" },
      });
    }
    res.json({ ok: true });
  }),
);

app.post(
  "/api/resume/:token/onboard-response",
  h(async (req, res) => {
    const accept = Boolean((req.body ?? {}).accept);
    const candidate = await prisma.candidate.findUnique({
      where: { resumeToken: req.params.token },
    });
    if (!candidate) {
      res.status(404).json({ error: "链接无效或已过期" });
      return;
    }
    if (candidate.status !== "PASSED") {
      res.status(400).json({ error: "当前状态无法操作，请刷新页面" });
      return;
    }
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: accept ? "ONBOARDED" : "ONBOARD_DECLINED" },
    });
    res.json({ ok: true });
  }),
);

// 以下 /api 路由全部要求登录
app.use("/api", requireAuth);

function bearerToken(req: Request): string {
  return /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1]?.trim() ?? "";
}

app.get(
  "/api/auth/me",
  h(async (req, res) => {
    res.json({ user: publicUser((req as AuthedRequest).user!) });
  }),
);

app.post(
  "/api/auth/logout",
  h(async (req, res) => {
    const token = bearerToken(req);
    if (token) await prisma.session.deleteMany({ where: { token } });
    res.json({ ok: true });
  }),
);

app.post(
  "/api/auth/change-password",
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const oldPassword = String(body.oldPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (newPassword.length < 6) {
      res.status(400).json({ error: "新密码至少 6 位" });
      return;
    }
    const user = (req as AuthedRequest).user!;
    if (!verifyPassword(oldPassword, user.passwordHash)) {
      res.status(400).json({ error: "原密码错误" });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });
    await prisma.session.deleteMany({
      where: { userId: user.id, token: { not: bearerToken(req) } },
    });
    res.json({ ok: true });
  }),
);

// ---- 用户管理（仅管理员） ----

function validRole(value: unknown): "admin" | "fahr" | "manager" | "hr" | null {
  return value === "admin" || value === "fahr" || value === "manager" || value === "hr"
    ? value
    : null;
}

app.get(
  "/api/users",
  requireAdmin,
  h(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" }, include: { scopes: true } });
    res.json({
      users: users.map((u) => ({
        ...publicUser(u),
        scopes: u.scopes.map((s) => ({ level: s.level, nodeId: s.nodeId })),
      })),
    });
  }),
);

app.post(
  "/api/users",
  requireAdmin,
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const role = validRole(body.role ?? "user");
    if (!username || password.length < 6 || !role) {
      res.status(400).json({ error: "参数不合法（用户名必填，密码至少 6 位，角色为 admin/user）" });
      return;
    }
    try {
      const user = await prisma.user.create({
        data: { username, passwordHash: hashPassword(password), role },
      });
      res.status(201).json({ user: publicUser(user) });
    } catch (e) {
      if (isDupError(e)) {
        res.status(400).json({ error: "用户名已存在" });
        return;
      }
      throw e;
    }
  }),
);

app.put(
  "/api/users/:id",
  requireAdmin,
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的用户 ID" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: { role?: string; passwordHash?: string } = {};
    if (body.role !== undefined) {
      const role = validRole(body.role);
      if (!role) {
        res.status(400).json({ error: "角色只能为 admin/user" });
        return;
      }
      data.role = role;
    }
    if (body.password !== undefined && String(body.password) !== "") {
      if (String(body.password).length < 6) {
        res.status(400).json({ error: "密码至少 6 位" });
        return;
      }
      data.passwordHash = hashPassword(String(body.password));
    }
    if (!data.role && !data.passwordHash) {
      res.status(400).json({ error: "没有需要修改的字段" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }
    if (target.role === "admin" && data.role === "user") {
      const otherAdmins = await prisma.user.count({ where: { role: "admin", id: { not: id } } });
      if (otherAdmins === 0) {
        res.status(400).json({ error: "至少需要保留一个管理员" });
        return;
      }
    }
    const user = await prisma.user.update({ where: { id }, data });
    if (data.passwordHash) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    res.json({ user: publicUser(user) });
  }),
);

app.put(
  "/api/users/:id/scope",
  requireAdmin,
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的用户 ID" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }
    if (target.role === "admin") {
      res.status(400).json({ error: "管理员拥有全部权限，无需分配" });
      return;
    }
    const raw = (req.body as Record<string, unknown> | null)?.scopes;
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    const items: { level: string; nodeId: number }[] = [];
    for (const it of raw) {
      const level = String((it as Record<string, unknown>)?.level ?? "");
      const nodeId = parseId((it as Record<string, unknown>)?.nodeId);
      if (!["brand", "city", "store"].includes(level) || !nodeId) {
        res.status(400).json({ error: "参数不合法" });
        return;
      }
      items.push({ level, nodeId });
    }
    await prisma.$transaction([
      prisma.userScope.deleteMany({ where: { userId: id } }),
      prisma.userScope.createMany({ data: items.map((s) => ({ userId: id, ...s })) }),
    ]);
    res.json({ ok: true });
  }),
);

app.delete(
  "/api/users/:id",
  requireAdmin,
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的用户 ID" });
      return;
    }
    if ((req as AuthedRequest).user!.id === id) {
      res.status(400).json({ error: "不能删除当前登录账号" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }
    if (target.role === "admin") {
      const otherAdmins = await prisma.user.count({ where: { role: "admin", id: { not: id } } });
      if (otherAdmins === 0) {
        res.status(400).json({ error: "至少需要保留一个管理员" });
        return;
      }
    }
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

const ORG_LEVELS = {
  brands: {
    label: "品牌",
    create: (name: string, _parentId = 0) => prisma.brand.create({ data: { name } }),
    update: (id: number, name: string) => prisma.brand.update({ where: { id }, data: { name } }),
    delete: (id: number) => prisma.brand.delete({ where: { id } }),
    childCount: (id: number) => prisma.city.count({ where: { brandId: id } }),
    childLabel: "城市",
  },
  cities: {
    label: "城市",
    create: (name: string, parentId = 0) =>
      prisma.city.create({ data: { name, brandId: parentId } }),
    update: (id: number, name: string) => prisma.city.update({ where: { id }, data: { name } }),
    delete: (id: number) => prisma.city.delete({ where: { id } }),
    childCount: (id: number) => prisma.store.count({ where: { cityId: id } }),
    childLabel: "店铺",
  },
  stores: {
    label: "店铺",
    create: (name: string, parentId = 0) =>
      prisma.store.create({ data: { name, cityId: parentId } }),
    update: (id: number, name: string) => prisma.store.update({ where: { id }, data: { name } }),
    delete: (id: number) => prisma.store.delete({ where: { id } }),
    childCount: (id: number) => prisma.candidate.count({ where: { storeId: id } }),
    childLabel: "人员",
  },
} as const;

type OrgLevel = keyof typeof ORG_LEVELS;

function parseLevel(value: string): OrgLevel | null {
  return value in ORG_LEVELS ? (value as OrgLevel) : null;
}

app.post(
  "/api/org/:level",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const level = parseLevel(req.params.level);
    const name = validName(req.body);
    if (!level || !name) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    const cfg = ORG_LEVELS[level];
    const parentId = parseId((req.body as Record<string, unknown>)?.parentId) ?? 0;
    if (level !== "brands" && !parentId) {
      res.status(400).json({ error: "缺少上级节点" });
      return;
    }
    try {
      const node = await cfg.create(name, parentId);
      res.status(201).json({ node });
    } catch (e) {
      if (isDupError(e)) {
        res.status(400).json({ error: `${cfg.label}名称已存在` });
        return;
      }
      if (isMissingError(e)) {
        res.status(400).json({ error: "上级节点不存在" });
        return;
      }
      throw e;
    }
  }),
);

app.put(
  "/api/org/:level/:id",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const level = parseLevel(req.params.level);
    const id = parseId(req.params.id);
    const name = validName(req.body);
    if (!level || !id || !name) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    const cfg = ORG_LEVELS[level];
    try {
      const node = await cfg.update(id, name);
      res.json({ node });
    } catch (e) {
      if (isDupError(e)) {
        res.status(400).json({ error: `${cfg.label}名称已存在` });
        return;
      }
      if (isMissingError(e)) {
        res.status(404).json({ error: `${cfg.label}不存在` });
        return;
      }
      throw e;
    }
  }),
);

app.delete(
  "/api/org/:level/:id",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const level = parseLevel(req.params.level);
    const id = parseId(req.params.id);
    if (!level || !id) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    const cfg = ORG_LEVELS[level];
    const children = await cfg.childCount(id);
    if (children > 0) {
      res.status(400).json({ error: `该${cfg.label}下还有 ${children} 个${cfg.childLabel}，无法删除` });
      return;
    }
    try {
      await cfg.delete(id);
      res.json({ ok: true });
    } catch (e) {
      if (isMissingError(e)) {
        res.status(404).json({ error: `${cfg.label}不存在` });
        return;
      }
      throw e;
    }
  }),
);

function withPublished<T extends { resumeToken: string | null }>(c: T): Omit<T, "resumeToken"> & { published: boolean } {
  const { resumeToken, ...rest } = c;
  return { ...rest, published: Boolean(resumeToken) };
}

const CANDIDATE_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "PASSED",
  "FAILED",
  "ONBOARDED",
  "ONBOARD_DECLINED",
] as const;

app.get(
  "/api/candidates",
  h(async (req, res) => {
    const keyword = String(req.query.keyword ?? "").trim();
    const brandId = parseId(req.query.brandId);
    const cityId = parseId(req.query.cityId);
    const storeId = parseId(req.query.storeId);
    const status = String(req.query.status ?? "");
    // 日期-only 参数（YYYY-MM-DD）按服务器本地时区解析，避免被当成 UTC 零点
    const parseDateParam = (value: unknown, endOfDay: boolean): Date | null => {
      const s = String(value ?? "").trim();
      if (!s) return null;
      const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? new Date(`${s}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`)
        : new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const updatedFrom = parseDateParam(req.query.updatedFrom, false);
    const updatedTo = parseDateParam(req.query.updatedTo, true);

    const where: Prisma.CandidateWhereInput = {};
    if (keyword) where.name = { contains: keyword };
    if (storeId) where.storeId = storeId;
    else if (cityId) where.store = { cityId };
    else if (brandId) where.store = { city: { brandId } };
    if ((CANDIDATE_STATUSES as readonly string[]).includes(status)) where.status = status;
    if (updatedFrom || updatedTo) {
      where.updatedAt = {};
      if (updatedFrom) where.updatedAt.gte = updatedFrom;
      if (updatedTo) where.updatedAt.lte = updatedTo;
    }
    const role = (req as AuthedRequest).user?.role;
    // 店长/客户hr 只能看到已发布人员
    if (req.query.published === "1" || role === "manager" || role === "hr") {
      where.resumeToken = { not: null };
    } else if (req.query.published === "0") {
      where.resumeToken = null;
    }
    // 非管理员只能看到被分配店铺的人员
    const scope = await allowedStoreIds((req as AuthedRequest).user!);
    if (scope) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { storeId: { in: scope } }];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));

    const [total, rows] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        include: candidateInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ candidates: rows.map(withPublished), total, page, pageSize });
  }),
);

app.post(
  "/api/candidates",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const parsed = parseCandidateInput(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { workExperiences, interviewSlots, ...fields } = parsed.data;

    const store = await prisma.store.findUnique({ where: { id: fields.storeId } });
    if (!store) {
      res.status(400).json({ error: "店铺不存在" });
      return;
    }
    const createScope = await allowedStoreIds((req as AuthedRequest).user!);
    if (createScope && !createScope.includes(fields.storeId)) {
      res.status(403).json({ error: "没有该店铺的操作权限" });
      return;
    }

    const candidate = await prisma.candidate.create({
      data: {
        ...fields,
        workExperiences: { create: workExperiences },
        interviewSlots: { create: interviewSlots },
      },
      include: candidateInclude,
    });
    res.status(201).json({ candidate: withPublished(candidate) });
  }),
);

app.put(
  "/api/candidates/:id",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的人员 ID" });
      return;
    }

    const parsed = parseCandidateInput(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { workExperiences, interviewSlots, ...fields } = parsed.data;

    const store = await prisma.store.findUnique({ where: { id: fields.storeId } });
    if (!store) {
      res.status(400).json({ error: "店铺不存在" });
      return;
    }

    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "人员不存在" });
      return;
    }
    if (existing.resumeToken) {
      res.status(400).json({ error: "该人员简历已发布，不能编辑信息，请先取消发布" });
      return;
    }
    const editScope = await allowedStoreIds((req as AuthedRequest).user!);
    if (editScope && (!editScope.includes(existing.storeId) || !editScope.includes(fields.storeId))) {
      res.status(403).json({ error: "没有该店铺的操作权限" });
      return;
    }

    const [, , candidate] = await prisma.$transaction([
      prisma.workExperience.deleteMany({ where: { candidateId: id } }),
      prisma.interviewSlot.deleteMany({ where: { candidateId: id } }),
      prisma.candidate.update({
        where: { id },
        data: {
          ...fields,
          workExperiences: { create: workExperiences },
          interviewSlots: { create: interviewSlots },
        },
        include: candidateInclude,
      }),
    ]);
    res.json({ candidate: withPublished(candidate) });
  }),
);

app.delete(
  "/api/candidates/:id",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的人员 ID" });
      return;
    }
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "人员不存在" });
      return;
    }
    const delScope = await allowedStoreIds((req as AuthedRequest).user!);
    if (delScope && !delScope.includes(existing.storeId)) {
      res.status(403).json({ error: "没有该店铺的操作权限" });
      return;
    }
    await prisma.candidate.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

function parseIdList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.map(parseId);
  if (ids.length === 0 || ids.length > 200 || ids.some((i) => i === null)) return null;
  return ids as number[];
}

app.post(
  "/api/candidates/batch-publish",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const ids = parseIdList((req.body as Record<string, unknown> | null)?.ids);
    if (!ids) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    const scope = await allowedStoreIds((req as AuthedRequest).user!);
    const rows = await prisma.candidate.findMany({
      where: { id: { in: ids }, ...(scope ? { storeId: { in: scope } } : {}) },
      select: { id: true, resumeToken: true },
    });
    const unpublished = rows.filter((r) => !r.resumeToken);
    await prisma.$transaction(
      unpublished.map((r) =>
        prisma.candidate.update({
          where: { id: r.id },
          data: { resumeToken: crypto.randomUUID() },
        }),
      ),
    );
    res.json({ ok: true, published: unpublished.length });
  }),
);

app.post(
  "/api/candidates/batch-delete",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const ids = parseIdList((req.body as Record<string, unknown> | null)?.ids);
    if (!ids) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    const scope = await allowedStoreIds((req as AuthedRequest).user!);
    const r = await prisma.candidate.deleteMany({
      where: { id: { in: ids }, ...(scope ? { storeId: { in: scope } } : {}) },
    });
    res.json({ ok: true, deleted: r.count });
  }),
);

app.post(
  "/api/candidates/:id/resume-link",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的人员 ID" });
      return;
    }
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "人员不存在" });
      return;
    }
    const pubScope = await allowedStoreIds((req as AuthedRequest).user!);
    if (pubScope && !pubScope.includes(existing.storeId)) {
      res.status(403).json({ error: "没有该店铺的操作权限" });
      return;
    }
    const token = existing.resumeToken ?? crypto.randomUUID();
    if (!existing.resumeToken) {
      await prisma.candidate.update({ where: { id }, data: { resumeToken: token } });
    }
    res.json({ path: `/r/${token}` });
  }),
);

app.post(
  "/api/candidates/:id/unpublish",
  requireRole("admin", "fahr"),
  h(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "无效的人员 ID" });
      return;
    }
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "人员不存在" });
      return;
    }
    const unpubScope = await allowedStoreIds((req as AuthedRequest).user!);
    if (unpubScope && !unpubScope.includes(existing.storeId)) {
      res.status(403).json({ error: "没有该店铺的操作权限" });
      return;
    }
    if (existing.resumeToken) {
      await prisma.candidate.update({ where: { id }, data: { resumeToken: null } });
    }
    res.json({ ok: true });
  }),
);

const STATUS_ACTIONS = [
  "accept-interview",
  "decline-interview",
  "pass",
  "fail",
  "onboard",
  "decline-onboard",
  "reset",
] as const;

// 店长只能操作约面确认和面试结果；入职确认、重置仅管理员和 fahr
const STATUS_ACTION_ROLES: Record<(typeof STATUS_ACTIONS)[number], string[]> = {
  "accept-interview": ["admin", "fahr", "manager"],
  "decline-interview": ["admin", "fahr", "manager"],
  pass: ["admin", "fahr", "manager"],
  fail: ["admin", "fahr", "manager"],
  onboard: ["admin", "fahr"],
  "decline-onboard": ["admin", "fahr"],
  reset: ["admin", "fahr"],
};

app.post(
  "/api/candidates/:id/status",
  h(async (req, res) => {
    const id = parseId(req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? "") as (typeof STATUS_ACTIONS)[number];
    if (!id || !STATUS_ACTIONS.includes(action)) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    if (!STATUS_ACTION_ROLES[action].includes((req as AuthedRequest).user?.role ?? "")) {
      res.status(403).json({ error: "没有操作权限" });
      return;
    }
    const existing = await prisma.candidate.findUnique({
      where: { id },
      include: { interviewSlots: true },
    });
    if (!existing) {
      res.status(404).json({ error: "人员不存在" });
      return;
    }
    const statusScope = await allowedStoreIds((req as AuthedRequest).user!);
    if (statusScope && !statusScope.includes(existing.storeId)) {
      res.status(403).json({ error: "没有该店铺的操作权限" });
      return;
    }
    switch (action) {
      case "reset":
        await prisma.candidate.update({
          where: { id },
          data: { status: "PENDING", acceptedSlotId: null },
        });
        break;
      case "accept-interview": {
        if (existing.status !== "PENDING" && existing.status !== "DECLINED") {
          res.status(400).json({ error: "当前状态无法确认约面" });
          return;
        }
        const slotId = parseId(body.slotId);
        if (!slotId || !existing.interviewSlots.some((s) => s.id === slotId)) {
          res.status(400).json({ error: "请选择面试时间" });
          return;
        }
        await prisma.candidate.update({
          where: { id },
          data: { status: "ACCEPTED", acceptedSlotId: slotId },
        });
        break;
      }
      case "decline-interview": {
        if (existing.status !== "PENDING") {
          res.status(400).json({ error: "当前状态无法拒绝约面" });
          return;
        }
        await prisma.candidate.update({ where: { id }, data: { status: "DECLINED" } });
        break;
      }
      case "pass":
      case "fail": {
        if (existing.status !== "ACCEPTED") {
          res.status(400).json({ error: "候选人还未确认面试时间" });
          return;
        }
        await prisma.candidate.update({
          where: { id },
          data: { status: action === "pass" ? "PASSED" : "FAILED" },
        });
        break;
      }
      case "onboard":
      case "decline-onboard": {
        if (existing.status !== "PASSED") {
          res.status(400).json({ error: "面试通过后才能确认入职" });
          return;
        }
        await prisma.candidate.update({
          where: { id },
          data: { status: action === "onboard" ? "ONBOARDED" : "ONBOARD_DECLINED" },
        });
        break;
      }
    }
    res.json({ ok: true });
  }),
);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, Boolean(MIME_EXT[file.mimetype]));
  },
});

app.post("/api/upload", requireRole("admin", "fahr"), upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "缺少上传文件或格式不支持（仅 JPG/PNG/GIF/WebP）" });
    return;
  }
  res.json({ url: `/api/uploads/${req.file.filename}` });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "接口不存在" });
});

if (isProd) {
  const distDir = path.join(rootDir, "web", "dist");
  app.use("/", express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(distDir, "index.html"));
      return;
    }
    next();
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "图片不能超过 10MB" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "服务器内部错误" });
});

await ensureDefaultAdmin();

app.listen(PORT, () => {
  console.log(`FaHRService ${isProd ? "(生产模式)" : "(开发 API)"} 运行在 http://localhost:${PORT}`);
});
