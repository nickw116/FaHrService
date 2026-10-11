export const CANDIDATE_STATUSES = [
  "PENDING_CONFIRMATION",
  "PENDING_INTERVIEW",
  "FAILED_SCREENING",
  "PASSED",
  "FAILED_INTERVIEW",
  "ONBOARDED",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  PENDING_CONFIRMATION: "待确认",
  PENDING_INTERVIEW: "待面试",
  FAILED_SCREENING: "未通过初筛",
  PASSED: "已通过",
  FAILED_INTERVIEW: "未通过面试",
  ONBOARDED: "已入职",
};

export const STATUS_BADGE_CLASS: Record<CandidateStatus, string> = {
  PENDING_CONFIRMATION: "bg-gray-100 text-gray-700 ring-gray-300",
  PENDING_INTERVIEW: "bg-blue-50 text-blue-700 ring-blue-300",
  FAILED_SCREENING: "bg-red-50 text-red-700 ring-red-300",
  PASSED: "bg-green-50 text-green-700 ring-green-300",
  FAILED_INTERVIEW: "bg-orange-50 text-orange-700 ring-orange-300",
  ONBOARDED: "bg-emerald-50 text-emerald-700 ring-emerald-300",
};

export function isCandidateStatus(value: string): value is CandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(value);
}
