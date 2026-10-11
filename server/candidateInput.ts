import type { Prisma } from "@prisma/client";
import { isGender } from "./constants.js";

export const candidateInclude = {
  store: { include: { city: { include: { brand: true } } } },
  workExperiences: { orderBy: { id: "asc" } },
  interviewSlots: { orderBy: { startAt: "asc" } },
} satisfies Prisma.CandidateInclude;

export interface WorkExpInput {
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface SlotInput {
  startAt: Date;
  endAt: Date;
}

export interface ParsedCandidateInput {
  name: string;
  gender: string;
  age: number | null;
  phone: string;
  photo: string;
  remark: string;
  storeId: number;
  workExperiences: WorkExpInput[];
  interviewSlots: SlotInput[];
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseWorkExperiences(value: unknown): WorkExpInput[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const result: WorkExpInput[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { company, startDate, endDate, description } = item as Record<string, unknown>;
    const c = asTrimmedString(company);
    if (!c) continue;
    result.push({
      company: c,
      startDate: asTrimmedString(startDate),
      endDate: asTrimmedString(endDate),
      description: asTrimmedString(description),
    });
  }
  return result;
}

function parseInterviewSlots(value: unknown): SlotInput[] | "invalid" {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return "invalid";
  const result: SlotInput[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return "invalid";
    const { startAt, endAt } = item as Record<string, unknown>;
    const s = new Date(String(startAt));
    const e = new Date(String(endAt));
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "invalid";
    if (s >= e) return "invalid";
    result.push({ startAt: s, endAt: e });
  }
  return result;
}

function parseAge(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 150) return "invalid";
  return n;
}

export function parseCandidateInput(
  body: unknown,
): { data: ParsedCandidateInput } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "请求体不是合法 JSON" };
  }
  const raw = body as Record<string, unknown>;

  const name = asTrimmedString(raw.name);
  if (!name) return { error: "姓名不能为空" };

  if (typeof raw.storeId !== "number" || !Number.isInteger(raw.storeId) || raw.storeId <= 0) {
    return { error: "必须选择所属店铺" };
  }

  const gender = raw.gender === undefined ? "MALE" : String(raw.gender);
  if (!isGender(gender)) return { error: "性别不合法" };

  const age = parseAge(raw.age);
  if (age === "invalid") return { error: "年龄必须是 1-150 的整数" };

  const workExperiences = parseWorkExperiences(raw.workExperiences);
  if (workExperiences === null) return { error: "工作经历格式不合法" };

  const interviewSlots = parseInterviewSlots(raw.interviewSlots);
  if (interviewSlots === "invalid") return { error: "可面试时间格式不合法（需为时间区间且开始早于结束）" };

  return {
    data: {
      name,
      gender,
      age,
      phone: asTrimmedString(raw.phone),
      photo: asTrimmedString(raw.photo),
      remark: asTrimmedString(raw.remark),
      storeId: raw.storeId,
      workExperiences,
      interviewSlots,
    },
  };
}
