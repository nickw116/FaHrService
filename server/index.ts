import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { candidateInclude, parseCandidateInput } from "./candidateInput.js";

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
  h(async (_req, res) => {
    const brands = await prisma.brand.findMany({
      orderBy: { id: "asc" },
      include: {
        cities: {
          orderBy: { id: "asc" },
          include: {
            stores: {
              orderBy: { id: "asc" },
              include: { _count: { select: { candidates: true } } },
            },
          },
        },
      },
    });
    res.json({ brands });
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

app.get(
  "/api/candidates",
  h(async (req, res) => {
    const keyword = String(req.query.keyword ?? "").trim();
    const brandId = parseId(req.query.brandId);
    const cityId = parseId(req.query.cityId);
    const storeId = parseId(req.query.storeId);

    const where: Prisma.CandidateWhereInput = {};
    if (keyword) where.name = { contains: keyword };
    if (storeId) where.storeId = storeId;
    else if (cityId) where.store = { cityId };
    else if (brandId) where.store = { city: { brandId } };

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        include: candidateInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ candidates, total, page, pageSize });
  }),
);

app.post(
  "/api/candidates",
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

    const candidate = await prisma.candidate.create({
      data: {
        ...fields,
        workExperiences: { create: workExperiences },
        interviewSlots: { create: interviewSlots },
      },
      include: candidateInclude,
    });
    res.status(201).json({ candidate });
  }),
);

app.put(
  "/api/candidates/:id",
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
    res.json({ candidate });
  }),
);

app.delete(
  "/api/candidates/:id",
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
    await prisma.candidate.delete({ where: { id } });
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

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "缺少上传文件或格式不支持（仅 JPG/PNG/GIF/WebP）" });
    return;
  }
  res.json({ url: `/api/uploads/${req.file.filename}` });
});

app.use(
  "/api/uploads",
  express.static(uploadsDir, { immutable: true, maxAge: "365d" }),
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "接口不存在" });
});

if (isProd) {
  const distDir = path.join(rootDir, "web", "dist");
  app.use("/faHr", express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && req.path.startsWith("/faHr")) {
      res.sendFile(path.join(distDir, "index.html"));
      return;
    }
    next();
  });
  app.get("/", (_req, res) => {
    res.redirect("/faHr/");
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

app.listen(PORT, () => {
  console.log(`FaHrService ${isProd ? "(生产模式)" : "(开发 API)"} 运行在 http://localhost:${PORT}`);
});
