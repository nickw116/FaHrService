export interface StoreNode {
  id: number;
  name: string;
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
  updatedAt: string;
  store: {
    id: number;
    name: string;
    city: { id: number; name: string; brand: { id: number; name: string } };
  };
  workExperiences: WorkExperience[];
  interviewSlots: InterviewSlot[];
}
