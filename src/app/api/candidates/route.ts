import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { candidateInclude, parseCandidateInput } from "@/lib/candidateInput";

function parseId(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const keyword = sp.get("keyword")?.trim() ?? "";
  const brandId = parseId(sp.get("brandId"));
  const cityId = parseId(sp.get("cityId"));
  const storeId = parseId(sp.get("storeId"));

  const where: Prisma.CandidateWhereInput = {};
  if (keyword) where.name = { contains: keyword };
  if (storeId) where.storeId = storeId;
  else if (cityId) where.store = { cityId };
  else if (brandId) where.store = { city: { brandId } };

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 10));

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
  return NextResponse.json({ candidates, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = parseCandidateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { workExperiences, interviewSlots, ...fields } = parsed.data;

  const store = await prisma.store.findUnique({ where: { id: fields.storeId } });
  if (!store) {
    return NextResponse.json({ error: "店铺不存在" }, { status: 400 });
  }

  const candidate = await prisma.candidate.create({
    data: {
      ...fields,
      workExperiences: { create: workExperiences },
      interviewSlots: { create: interviewSlots },
    },
    include: candidateInclude,
  });
  return NextResponse.json({ candidate }, { status: 201 });
}
