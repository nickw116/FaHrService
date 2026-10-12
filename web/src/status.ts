export const STATUS_LABEL: Record<string, string> = {
  PENDING: "待约面",
  ACCEPTED: "已接受约面",
  DECLINED: "已拒绝约面",
  PASSED: "面试通过",
  FAILED: "面试未通过",
  ONBOARDED: "已确认入职",
  ONBOARD_DECLINED: "已拒绝入职",
};

export const STATUS_TAG: Record<string, "info" | "primary" | "success" | "warning" | "danger"> = {
  PENDING: "info",
  ACCEPTED: "primary",
  DECLINED: "warning",
  PASSED: "success",
  FAILED: "danger",
  ONBOARDED: "success",
  ONBOARD_DECLINED: "warning",
};
