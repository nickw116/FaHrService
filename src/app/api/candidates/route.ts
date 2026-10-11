import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isCandidateStatus } from "@/lib/constants";

const candidateInclude = {
  store: { include: { city: { include: { brand: true } } } },
} satisfies Prisma.CandidateInclude;

function parseId(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const keyword = sp.get("keyword")?.trim() ?? "";
  const status = sp.get("status") ?? "";
  const brandId = parseId(sp.get("brandId"));
  const cityId = parseId(sp.get("cityId"));
  const storeId = parseId(sp.get("storeId"));

  const where: Prisma.CandidateWhereInput = {};
  if (keyword) where.name = { contains: keyword };
  if (status && isCandidateStatus(status)) where.status = status;
  if (storeId) where.storeId = storeId;
  else if (cityId) where.store = { cityId };
  else if (brandId) where.store = { city: { brandId } };

  const candidates = await prisma.candidate.findMany({
    where,
    include: candidateInclude,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
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
  if (status !== undefined && (typeof status !== "string" || !isCandidateStatus(status))) {
    return NextResponse.json({ error: "人员状态不合法" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    return NextResponse.json({ error: "店铺不存在" }, { status: 400 });
  }

  const candidate = await prisma.candidate.create({
    data: {
      name: name.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      status: (status as string | undefined) ?? "PENDING_CONFIRMATION",
      remark: typeof remark === "string" ? remark.trim() : "",
      storeId,
    },
    include: candidateInclude,
  });
  return NextResponse.json({ candidate }, { status: 201 });
}
