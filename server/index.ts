import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { candidateInclude, parseCandidateInput } from "./candidateInput.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const uploadsDir = path.join(rootDir, "uploads");
const isProd = process.argv.includes("--prod");
const PORT = Number(process.env.PORT) || (isProd ? 3000 : 3001);

const app = express();
app.use(express.json({ limit: "1mb" }));

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
        cities: { orderBy: { id: "asc" }, include: { stores: { orderBy: { id: "asc" } } } },
      },
    });
    res.json({ brands });
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
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === "GET") {
      res.sendFile(path.join(distDir, "index.html"));
    } else {
      next();
    }
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
