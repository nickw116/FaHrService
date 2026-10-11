import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCandidateStatus } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

async function parseCandidateId(ctx: RouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const id = await parseCandidateId(ctx);
  if (!id) return NextResponse.json({ error: "无效的人员 ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const { name, phone, status, remark, storeId } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  }
  if (typeof storeId !== "number" || !Number.isInteger(storeId)) {
    return NextResponse.json({ error: "必须选择所属店铺" }, { status: 400 });
  }
  if (typeof status !== "string" || !isCandidateStatus(status)) {
    return NextResponse.json({ error: "人员状态不合法" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    return NextResponse.json({ error: "店铺不存在" }, { status: 400 });
  }

  const existing = await prisma.candidate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "人员不存在" }, { status: 404 });
  }

  const candidate = await prisma.candidate.update({
    where: { id },
    data: {
      name: name.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      status,
      remark: typeof remark === "string" ? remark.trim() : "",
      storeId,
    },
    include: { store: { include: { city: { include: { brand: true } } } } },
  });
  return NextResponse.json({ candidate });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const id = await parseCandidateId(ctx);
  if (!id) return NextResponse.json({ error: "无效的人员 ID" }, { status: 400 });

  const existing = await prisma.candidate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "人员不存在" }, { status: 404 });
  }
  await prisma.candidate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
