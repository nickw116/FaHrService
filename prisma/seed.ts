import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = [
    {
      brand: "美味轩",
      cities: [
        { city: "上海", stores: ["南京东路店", "徐家汇店"] },
        { city: "北京", stores: ["三里屯店", "中关村店"] },
      ],
    },
    {
      brand: "香满楼",
      cities: [
        { city: "广州", stores: ["天河店", "越秀店"] },
        { city: "深圳", stores: ["南山店"] },
      ],
    },
  ];

  const storeIds: Record<string, number> = {};

  for (const b of org) {
    const brand = await prisma.brand.upsert({
      where: { name: b.brand },
      update: {},
      create: { name: b.brand },
    });
    for (const c of b.cities) {
      const city = await prisma.city.upsert({
        where: { brandId_name: { brandId: brand.id, name: c.city } },
        update: {},
        create: { name: c.city, brandId: brand.id },
      });
      for (const s of c.stores) {
        const store = await prisma.store.upsert({
          where: { cityId_name: { cityId: city.id, name: s } },
          update: {},
          create: { name: s, cityId: city.id },
        });
        storeIds[`${b.brand}/${c.city}/${s}`] = store.id;
      }
    }
  }

  await prisma.candidate.deleteMany();

  type SeedCandidate = {
    name: string;
    gender: "MALE" | "FEMALE";
    age: number;
    phone: string;
    store: string;
    remark?: string;
    work?: { company: string; startDate: string; endDate: string; description: string }[];
    slots?: [string, string][];
  };

  const candidates: SeedCandidate[] = [
    {
      name: "张伟", gender: "MALE", age: 26, phone: "13800001111", store: "美味轩/上海/南京东路店", remark: "朋友介绍",
      work: [
        { company: "海底捞", startDate: "2021-03", endDate: "2023-05", description: "前厅服务员，负责看台与顾客引导" },
        { company: "西贝莜面村", startDate: "2023-06", endDate: "2026-02", description: "领班，带 4 人小组" },
      ],
      slots: [["2026-10-14T14:00", "2026-10-14T16:00"], ["2026-10-16T10:00", "2026-10-16T12:00"]],
    },
    {
      name: "王芳", gender: "FEMALE", age: 23, phone: "13800002222", store: "美味轩/上海/徐家汇店", remark: "约了下周面试",
      work: [{ company: "星巴克", startDate: "2024-01", endDate: "", description: "咖啡师，兼职至今" }],
      slots: [["2026-10-13T09:30", "2026-10-13T11:30"]],
    },
    { name: "李娜", gender: "FEMALE", age: 28, phone: "13800003333", store: "美味轩/北京/三里屯店" },
    { name: "刘强", gender: "MALE", age: 31, phone: "13800004444", store: "美味轩/北京/中关村店", remark: "经验不足" },
    {
      name: "陈静", gender: "FEMALE", age: 35, phone: "13800005555", store: "香满楼/广州/天河店", remark: "已签合同",
      work: [{ company: "点都德", startDate: "2019-05", endDate: "2025-12", description: "楼面经理" }],
    },
    { name: "杨阳", gender: "MALE", age: 24, phone: "13800006666", store: "香满楼/广州/越秀店", remark: "面试迟到两次" },
    {
      name: "赵磊", gender: "MALE", age: 27, phone: "13800007777", store: "香满楼/深圳/南山店",
      slots: [["2026-10-15T15:00", "2026-10-15T17:00"]],
    },
    {
      name: "孙丽", gender: "FEMALE", age: 30, phone: "13800008888", store: "美味轩/上海/南京东路店", remark: "前厅主管推荐",
      work: [{ company: "外婆家", startDate: "2020-04", endDate: "2026-01", description: "收银员" }],
      slots: [["2026-10-14T10:00", "2026-10-14T12:00"]],
    },
    { name: "周杰", gender: "MALE", age: 22, phone: "13800009999", store: "香满楼/深圳/南山店" },
    { name: "吴敏", gender: "FEMALE", age: 26, phone: "13800010000", store: "美味轩/北京/三里屯店", remark: "复试通过" },
    { name: "郑爽", gender: "FEMALE", age: 25, phone: "13800021111", store: "美味轩/上海/徐家汇店" },
    { name: "冯浩", gender: "MALE", age: 29, phone: "13800022222", store: "美味轩/北京/三里屯店", remark: "周三下午面试" },
    { name: "褚燕", gender: "FEMALE", age: 33, phone: "13800023333", store: "香满楼/广州/天河店", remark: "无健康证" },
    { name: "卫东", gender: "MALE", age: 36, phone: "13800024444", store: "香满楼/深圳/南山店" },
    { name: "蒋涛", gender: "MALE", age: 28, phone: "13800025555", store: "美味轩/北京/中关村店", remark: "后厨" },
    { name: "沈慧", gender: "FEMALE", age: 24, phone: "13800026666", store: "美味轩/上海/南京东路店" },
    { name: "韩磊", gender: "MALE", age: 32, phone: "13800027777", store: "香满楼/广州/天河店", remark: "沟通能力欠佳" },
    { name: "曹颖", gender: "FEMALE", age: 27, phone: "13800028888", store: "香满楼/广州/越秀店" },
    { name: "朱军", gender: "MALE", age: 40, phone: "13800029999", store: "美味轩/上海/徐家汇店" },
    { name: "秦芳", gender: "FEMALE", age: 34, phone: "13800020000", store: "香满楼/深圳/南山店", remark: "店长" },
    { name: "尤勇", gender: "MALE", age: 26, phone: "13800031111", store: "美味轩/北京/中关村店" },
    { name: "许晴", gender: "FEMALE", age: 29, phone: "13800032222", store: "香满楼/广州/越秀店" },
    { name: "何斌", gender: "MALE", age: 21, phone: "13800033333", store: "美味轩/上海/南京东路店", remark: "兼职" },
    { name: "吕佳", gender: "FEMALE", age: 25, phone: "13800034444", store: "美味轩/北京/三里屯店" },
    { name: "张强", gender: "MALE", age: 38, phone: "13800035555", store: "香满楼/广州/天河店" },
  ];

  for (const c of candidates) {
    await prisma.candidate.create({
      data: {
        name: c.name,
        gender: c.gender,
        age: c.age,
        phone: c.phone,
        remark: c.remark ?? "",
        storeId: storeIds[c.store],
        workExperiences: { create: c.work ?? [] },
        interviewSlots: {
          create: (c.slots ?? []).map(([startAt, endAt]) => ({
            startAt: new Date(startAt),
            endAt: new Date(endAt),
          })),
        },
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
