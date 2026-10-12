export type Role = "admin" | "fahr" | "manager" | "hr";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "管理员",
  fahr: "FaHr",
  manager: "店长",
  hr: "客户HR",
};

export const ROLE_TAG: Record<Role, "warning" | "primary" | "success" | "info"> = {
  admin: "warning",
  fahr: "primary",
  manager: "success",
  hr: "info",
};

export interface StoreNode {
  id: number;
  name: string;
  _count?: { candidates: number };
}

export interface UserInfo {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
}

export interface CityNode {
  id: number;
  name: string;
  stores: StoreNode[];
}

export interface BrandNode {
  id: number;
  name: string;
  cities: CityNode[];
}

export interface WorkExperience {
  id: number;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface InterviewSlot {
  id: number;
  startAt: string;
  endAt: string;
}

export interface CandidateRow {
  id: number;
  name: string;
  gender: "MALE" | "FEMALE";
  age: number | null;
  phone: string;
  photo: string;
  remark: string;
  status: string;
  published: boolean;
  acceptedSlotId: number | null;
  updatedAt: string;
  store: {
    id: number;
    name: string;
    city: { id: number; name: string; brand: { id: number; name: string } };
  };
  workExperiences: WorkExperience[];
  interviewSlots: InterviewSlot[];
}
