export const GENDERS = ["MALE", "FEMALE"] as const;

export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "男",
  FEMALE: "女",
};

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}
