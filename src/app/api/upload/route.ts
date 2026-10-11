import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少上传文件" }, { status: 400 });
  }
  const ext = MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "仅支持 JPG/PNG/GIF/WebP 图片" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/api/uploads/${filename}` });
}
