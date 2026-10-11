import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { candidateInclude, parseCandidateInput } from "@/lib/candidateInput";

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

  const parsed = parseCandidateInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { workExperiences, interviewSlots, ...fields } = parsed.data;

  const store = await prisma.store.findUnique({ where: { id: fields.storeId } });
  if (!store) {
    return NextResponse.json({ error: "店铺不存在" }, { status: 400 });
  }

  const existing = await prisma.candidate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "人员不存在" }, { status: 404 });
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
