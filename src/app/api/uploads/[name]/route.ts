import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

type RouteContext = { params: Promise<{ name: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { name } = await ctx.params;
  const safeName = path.basename(name);
  const mime = EXT_MIME[path.extname(safeName).toLowerCase()];
  if (!mime) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(path.join(process.cwd(), "uploads", safeName));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
